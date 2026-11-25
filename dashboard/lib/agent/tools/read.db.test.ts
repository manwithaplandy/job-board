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
  await db.sql`DELETE FROM jobs WHERE id IN (${JOB_1}, ${JOB_2}, ${JOB_3})`;
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
