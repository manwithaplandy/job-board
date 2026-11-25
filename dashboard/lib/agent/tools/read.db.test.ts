// The read tools against real Postgres and real RLS (Task 0.10). Every tool runs under
// the caller's own context, so another user's review never reaches the model. Runs only
// under `npm run test:db`.
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { openTestDb, seedJob, seedProfile, seedReview, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { emptyGathered } from "@/lib/agent/gathered";
import type { ToolCtx } from "@/lib/agent/tools";
import { getJob, getReview, searchJobs } from "@/lib/agent/tools/read";
import { serviceSql } from "@/lib/db";

const JOB_1 = "lever:fixture-co:one";
const JOB_2 = "lever:fixture-co:two";
const JOB_3 = "lever:fixture-co:three";
const JOB_4 = "lever:fixture-co:four";

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});

function ctx(userId: string): ToolCtx {
  return {
    userId,
    email: null,
    threadId: null,
    runId: "11111111-1111-4111-8111-111111111111",
    variant: 1,
    unattended: false,
    gathered: emptyGathered(),
    repairsLeft: { n: 1 },
  };
}

beforeEach(async () => {
  // Plain deletes, not TRUNCATE ... CASCADE: the schema protects some seeded rows.
  await db.sql`DELETE FROM review_corrections`;
  await db.sql`DELETE FROM job_reviews`;
  await db.sql`DELETE FROM profiles WHERE user_id IN (${USER_A}, ${USER_B})`;
  await db.sql`DELETE FROM company_overrides WHERE user_id IN (${USER_A}, ${USER_B})`;
  await db.sql`DELETE FROM jobs WHERE id IN (${JOB_1}, ${JOB_2}, ${JOB_3}, ${JOB_4})`;
  await seedJob(db.sql, JOB_1, { description: "Posting one" });
  await seedJob(db.sql, JOB_2);
  await seedJob(db.sql, JOB_3);
  await seedProfile(db.sql, USER_A);
  await seedProfile(db.sql, USER_B);
  await seedReview(db.sql, USER_A, JOB_1, { fit_score: 90, pay_min: 100_000, pay_max: 120_000, pay_currency: "USD" });
  await seedReview(db.sql, USER_A, JOB_2, { fit_score: 60 });
  await seedReview(db.sql, USER_B, JOB_3, { fit_score: 70 });
});

describe("read tools under RLS", () => {
  test("user B's get_review for a job only user A reviewed is not_reviewed", async () => {
    expect(await getReview(ctx(USER_B), { jobId: JOB_1 })).toEqual({ status: "not_available", reason: "not_reviewed" });
    expect(await getJob(ctx(USER_B), { jobId: JOB_1 })).toEqual({ status: "not_available", reason: "not_reviewed" });
    expect(await getReview(ctx(USER_A), { jobId: JOB_1 })).toMatchObject({ jobId: JOB_1, fitScore: 90, stale: false });
  });

  test("search_jobs returns only the caller's reviewed jobs", async () => {
    const a = await searchJobs(ctx(USER_A), { sort: "fit", limit: 10 });
    expect(a.rows.map((r) => r.jobId)).toEqual([JOB_1, JOB_2]);
    expect(a.total).toBe(2);
    const b = await searchJobs(ctx(USER_B), { sort: "fit", limit: 10 });
    expect(b.rows.map((r) => r.jobId)).toEqual([JOB_3]);
    expect(b.total).toBe(1);
  });

  test("a correction drives both search_jobs and get_review", async () => {
    await db.sql`INSERT INTO review_corrections (user_id, job_id, fit_score, pay_min, pay_max, pay_currency, verdict)
                 VALUES (${USER_A}, ${JOB_2}, 95, 200000, 250000, 'EUR', 'approve')`;
    const a = await searchJobs(ctx(USER_A), { sort: "fit", limit: 10 });
    expect(a.rows[0]).toMatchObject({ jobId: JOB_2, fitScore: 95, payMin: 200_000, payMax: 250_000, payCurrency: "EUR" });
    expect(await getReview(ctx(USER_A), { jobId: JOB_2 })).toMatchObject({ fitScore: 95, payMin: 200_000, payCurrency: "EUR" });
  });

  test("filters, text search and the open-only rule", async () => {
    await db.sql`UPDATE jobs SET closed_at = now() WHERE id = ${JOB_2}`;
    expect((await searchJobs(ctx(USER_A), { sort: "fit", limit: 10 })).rows.map((r) => r.jobId)).toEqual([JOB_1]);
    expect((await searchJobs(ctx(USER_A), { minFit: 95, sort: "fit", limit: 10 })).rows).toEqual([]);
    expect((await searchJobs(ctx(USER_A), { text: "one", sort: "pay", limit: 10 })).rows.map((r) => r.jobId)).toEqual([JOB_1]);
    expect((await searchJobs(ctx(USER_A), { text: "%", sort: "fit", limit: 10 })).rows).toEqual([]);
    expect(await getJob(ctx(USER_A), { jobId: JOB_2 })).toEqual({ status: "not_available", reason: "closed" });
  });

  test("a job whose every listing is proven closed is closed though closed_at is NULL", async () => {
    const source = await db.sql`INSERT INTO source_accounts (ats, public_board_ref) VALUES ('lever', 'agent-read-test')
                                ON CONFLICT DO NOTHING RETURNING id`;
    const sourceId =
      source[0]?.id ?? (await db.sql`SELECT id FROM source_accounts WHERE public_board_ref = 'agent-read-test'`)[0].id;
    await db.sql`INSERT INTO source_listings (source_account_id, external_id, job_id, original_discovered_at,
                   discovery_anchor_at, discovery_anchor_provenance, discovery_expires_at, source_availability)
                 VALUES (${sourceId}, ${JOB_2}, ${JOB_2}, now(), now(), 'local_observation',
                   now() + interval '720 hours', 'closed')`;
    const closed = await db.sql`SELECT closed_at FROM jobs WHERE id = ${JOB_2}`;
    expect(closed[0].closed_at).toBeNull();
    expect((await searchJobs(ctx(USER_A), { sort: "fit", limit: 10 })).rows.map((r) => r.jobId)).toEqual([JOB_1]);
    expect(await getJob(ctx(USER_A), { jobId: JOB_2 })).toEqual({ status: "not_available", reason: "closed" });
    expect(await getReview(ctx(USER_A), { jobId: JOB_2 })).toEqual({ status: "not_available", reason: "closed" });
  });

  test("a company the user excluded is hidden from search and get_job, by override or by profile", async () => {
    await db.sql`INSERT INTO companies (id, name, ats, token, industry)
                 VALUES (2, 'Casino Co', 'lever', 'casino-co', 'gambling') ON CONFLICT (id) DO NOTHING`;
    await db.sql`DELETE FROM company_overrides WHERE user_id = ${USER_A}`;
    await seedJob(db.sql, JOB_4, { company_id: 2 });
    await seedReview(db.sql, USER_A, JOB_4, { fit_score: 99 });
    expect((await searchJobs(ctx(USER_A), { sort: "fit", limit: 10 })).rows[0]?.jobId).toBe(JOB_4);

    await db.sql`UPDATE profiles SET company_exclusions = ${db.sql.json({ industries: ["gambling"] })}
                 WHERE user_id = ${USER_A}`;
    expect((await searchJobs(ctx(USER_A), { sort: "fit", limit: 10 })).rows.map((r) => r.jobId)).toEqual([JOB_1, JOB_2]);
    expect(await getJob(ctx(USER_A), { jobId: JOB_4 })).toEqual({ status: "not_available", reason: "excluded" });

    // An explicit include beats the profile exclusion; an explicit exclude hides it again.
    await db.sql`INSERT INTO company_overrides (user_id, company_id, verdict) VALUES (${USER_A}, 2, 'include')`;
    expect((await searchJobs(ctx(USER_A), { sort: "fit", limit: 10 })).rows[0]?.jobId).toBe(JOB_4);
    await db.sql`UPDATE profiles SET company_exclusions = NULL WHERE user_id = ${USER_A}`;
    await db.sql`UPDATE company_overrides SET verdict = 'exclude' WHERE user_id = ${USER_A} AND company_id = 2`;
    expect((await searchJobs(ctx(USER_A), { sort: "fit", limit: 10 })).rows.map((r) => r.jobId)).toEqual([JOB_1, JOB_2]);
    expect(await getReview(ctx(USER_A), { jobId: JOB_4 })).toEqual({ status: "not_available", reason: "excluded" });
    // User B never excluded it.
    await seedReview(db.sql, USER_B, JOB_4, { fit_score: 50 });
    expect((await searchJobs(ctx(USER_B), { sort: "fit", limit: 10 })).rows.map((r) => r.jobId)).toContain(JOB_4);
    await db.sql`DELETE FROM company_overrides WHERE user_id = ${USER_A}`;
  });

  test("an errored review counts as not reviewed", async () => {
    await db.sql`UPDATE job_reviews SET error = 'reviewer_failed' WHERE user_id = ${USER_A} AND job_id = ${JOB_2}`;
    expect((await searchJobs(ctx(USER_A), { sort: "fit", limit: 10 })).rows.map((r) => r.jobId)).toEqual([JOB_1]);
    expect(await getReview(ctx(USER_A), { jobId: JOB_2 })).toEqual({ status: "not_available", reason: "not_reviewed" });
    expect(await getJob(ctx(USER_A), { jobId: JOB_2 })).toEqual({ status: "not_available", reason: "not_reviewed" });
  });

  test("sort pay annualizes hours and months and ranks USD before other currencies", async () => {
    await seedJob(db.sql, JOB_4);
    await db.sql`UPDATE job_reviews SET pay_min = 140000, pay_max = 150000, pay_currency = 'USD', pay_period = 'year'
                 WHERE user_id = ${USER_A} AND job_id = ${JOB_1}`;
    await db.sql`UPDATE job_reviews SET pay_min = 80, pay_max = 90, pay_currency = 'USD', pay_period = 'hour'
                 WHERE user_id = ${USER_A} AND job_id = ${JOB_2}`;
    await seedReview(db.sql, USER_A, JOB_4, {
      fit_score: 99,
      pay_min: 9_000_000,
      pay_max: 12_000_000,
      pay_currency: "JPY",
      pay_period: "year",
    });
    const out = await searchJobs(ctx(USER_A), { sort: "pay", limit: 10 });
    // 90/hour is 187,200 a year, above 150,000 a year; JPY after every USD row.
    expect(out.rows.map((r) => r.jobId)).toEqual([JOB_2, JOB_1, JOB_4]);
    expect(out.rows[0]).toMatchObject({ payMax: 90, payCurrency: "USD", payPeriod: "hour" });
    expect(out.rows[2]).toMatchObject({ payCurrency: "JPY", payPeriod: "year" });
  });

  test("get_job returns the wrapped posting and a stale review is flagged", async () => {
    const job = await getJob(ctx(USER_A), { jobId: JOB_1 });
    expect(job).toMatchObject({ jobId: JOB_1, company: "Fixture Co", descriptionOmitted: false });
    expect(job).toHaveProperty("description", expect.stringContaining("Posting one"));
    await db.sql`UPDATE profiles SET profile_version = 'v2' WHERE user_id = ${USER_A}`;
    expect(await getReview(ctx(USER_A), { jobId: JOB_1 })).toMatchObject({ stale: true });
    expect(await getReview(ctx(USER_A), { jobId: "lever:fixture-co:missing" })).toEqual({
      status: "not_available",
      reason: "unknown_job",
    });
  });
});
