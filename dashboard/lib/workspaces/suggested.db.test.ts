// fillSuggested against real Postgres, RLS and the lifecycle trigger (Task 1.4). Runs
// only under `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { openTestDb, seedJob, seedProfile, seedReview, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { serviceSql } from "@/lib/db";
import { fillSuggested } from "@/lib/workspaces/suggested";

const jobId = (n: number) => `lever:fixture-co:suggested-${String(n).padStart(2, "0")}`;
const GATED_CO = 9101;
const CASINO_CO = 9102;
const KEPT_CO = 9103;

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});

beforeEach(async () => {
  await db.sql`DELETE FROM shortlist_items`;
  await db.sql`DELETE FROM company_overrides`;
  await db.sql`DELETE FROM review_corrections`;
  await db.sql`DELETE FROM job_reviews`;
  await db.sql`DELETE FROM profiles WHERE user_id IN (${USER_A}, ${USER_B})`;
  await db.sql`DELETE FROM jobs WHERE id LIKE 'lever:fixture-co:suggested-%'`;
  await seedProfile(db.sql, USER_A);
  await seedProfile(db.sql, USER_B);
});

async function seedApproved(n: number, user = USER_A) {
  for (let i = 1; i <= n; i++) {
    await seedJob(db.sql, jobId(i)).catch(() => undefined);
    await seedReview(db.sql, user, jobId(i), { fit_score: 50 + i, reasoning: `Reason ${i}. More text.` });
  }
}

const suggested = async (user = USER_A) =>
  (await db.sql`SELECT job_id FROM shortlist_items WHERE user_id = ${user} AND state = 'suggested' ORDER BY job_id`)
    .map((r) => r.job_id);

test("never holds more than 10 suggested rows", async () => {
  await seedApproved(25);
  expect(await fillSuggested(USER_A)).toBe(10);
  expect(await fillSuggested(USER_A)).toBe(0);
  // Best fit first: jobs 16..25 have the highest scores.
  expect(await suggested()).toEqual(Array.from({ length: 10 }, (_, i) => jobId(16 + i)));
  const [row] = await db.sql`SELECT set_by FROM shortlist_items WHERE job_id = ${jobId(25)}`;
  expect(row.set_by).toBe("system");
  // Triaging one away makes room for exactly one more.
  await db.sql`UPDATE shortlist_items SET state = 'later', set_by = 'user' WHERE job_id = ${jobId(25)}`;
  expect(await fillSuggested(USER_A)).toBe(1);
  expect(await suggested()).toContain(jobId(15));
  // Another user's reviews are not touched.
  expect(await suggested(USER_B)).toEqual([]);
});

test("skips jobs already triaged in any state", async () => {
  await seedApproved(5);
  await db.sql`INSERT INTO shortlist_items (user_id, job_id, state, reason_code, set_by) VALUES
    (${USER_A}, ${jobId(5)}, 'skipped', 'pay', 'user'),
    (${USER_A}, ${jobId(4)}, 'later', NULL, 'user'),
    (${USER_A}, ${jobId(3)}, 'shortlisted', NULL, 'agent')`;
  expect(await fillSuggested(USER_A)).toBe(2);
  expect(await suggested()).toEqual([jobId(1), jobId(2)]);
  const [skipped] = await db.sql`SELECT state FROM shortlist_items WHERE job_id = ${jobId(5)}`;
  expect(skipped.state).toBe("skipped");
});

test("briefs come from the review, cut to 300 chars", async () => {
  await seedJob(db.sql, jobId(1));
  await seedJob(db.sql, jobId(2));
  await seedJob(db.sql, jobId(3));
  await seedReview(db.sql, USER_A, jobId(1), {
    reasoning: "Strong backend match! Second sentence.",
    red_flags: db.sql.json(["Unpaid trial", "x"]),
    skill_gaps: db.sql.json(["Rust"]),
  });
  await seedReview(db.sql, USER_A, jobId(2), {
    reasoning: "a".repeat(400),
    red_flags: db.sql.json([]),
    skill_gaps: db.sql.json(["b".repeat(400)]),
  });
  // A non-string first flag and a double-encoded (jsonb string) gap list read as no risk.
  await seedReview(db.sql, USER_A, jobId(3), {
    reasoning: null, red_flags: db.sql.json([7]), skill_gaps: db.sql.json(JSON.stringify(["Go"])),
  });
  expect(await fillSuggested(USER_A)).toBe(3);
  const rows = await db.sql`SELECT job_id, brief_why, brief_risk FROM shortlist_items ORDER BY job_id`;
  expect(Array.from(rows)).toEqual([
    { job_id: jobId(1), brief_why: "Strong backend match!", brief_risk: "Unpaid trial" },
    { job_id: jobId(2), brief_why: "a".repeat(300), brief_risk: "b".repeat(300) },
    { job_id: jobId(3), brief_why: null, brief_risk: null },
  ]);
});

test("a denied or unscored review is never suggested", async () => {
  for (let i = 1; i <= 6; i++) await seedJob(db.sql, jobId(i));
  await seedReview(db.sql, USER_A, jobId(1), { verdict: "deny" });
  await seedReview(db.sql, USER_A, jobId(2), { fit_score: null });
  await seedReview(db.sql, USER_A, jobId(3), { error: "boom" });
  await seedReview(db.sql, USER_A, jobId(4), { profile_version: "old" });
  await seedReview(db.sql, USER_A, jobId(5), { verdict: "deny", human_override: true });
  await seedReview(db.sql, USER_A, jobId(6));
  // A correction to deny wins over the review's approve.
  await db.sql`INSERT INTO review_corrections (user_id, job_id, verdict) VALUES (${USER_A}, ${jobId(6)}, 'deny')`;
  expect(await fillSuggested(USER_A)).toBe(0);
});

test("a closed job is never suggested", async () => {
  await seedApproved(3);
  // No source listing: the legacy closed_at decides, as on the board.
  await db.sql`UPDATE jobs SET closed_at = now() WHERE id = ${jobId(3)}`;
  expect(await fillSuggested(USER_A)).toBe(2);
  expect(await suggested()).toEqual([jobId(1), jobId(2)]);
});

test("a company the user excluded is never suggested, unless they included it by hand", async () => {
  await db.sql`INSERT INTO companies (id, name, ats, token, industry) VALUES
    (${GATED_CO}, 'Gated Co', 'lever', 'suggested-gated', NULL),
    (${CASINO_CO}, 'Casino Co', 'lever', 'suggested-casino', 'Gambling'),
    (${KEPT_CO}, 'Kept Casino Co', 'lever', 'suggested-kept', 'Gambling')
    ON CONFLICT (id) DO NOTHING`;
  await seedJob(db.sql, jobId(1));
  await seedJob(db.sql, jobId(2), { company_id: GATED_CO });
  await seedJob(db.sql, jobId(3), { company_id: CASINO_CO });
  await seedJob(db.sql, jobId(4), { company_id: KEPT_CO });
  for (let i = 1; i <= 4; i++) {
    await seedReview(db.sql, USER_A, jobId(i), { fit_score: 60 + i });
    await seedReview(db.sql, USER_B, jobId(i), { fit_score: 60 + i });
  }
  await db.sql`INSERT INTO company_overrides (user_id, company_id, verdict) VALUES
    (${USER_A}, ${GATED_CO}, 'exclude'), (${USER_A}, ${KEPT_CO}, 'include')`;
  await db.sql`UPDATE profiles SET company_exclusions = ${db.sql.json({ industries: ["Gambling"] })}
               WHERE user_id = ${USER_A}`;
  expect(await fillSuggested(USER_A)).toBe(2);
  expect(await suggested()).toEqual([jobId(1), jobId(4)]);
  // USER_A's gate is theirs alone.
  expect(await fillSuggested(USER_B)).toBe(4);
});

test("concurrent calls insert no duplicates", async () => {
  await seedApproved(25);
  const counts = await Promise.all([1, 2, 3, 4].map(() => fillSuggested(USER_A)));
  expect(counts.reduce((a, b) => a + b, 0)).toBe(10);
  expect(await suggested()).toHaveLength(10);
});
