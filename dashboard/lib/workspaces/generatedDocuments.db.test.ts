// Generated documents per job against real Postgres and RLS (plan Task 1.11). Runs
// only under `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { openTestDb, seedJob, seedProfile, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { serviceSql } from "@/lib/db";
import { listGeneratedDocuments } from "@/lib/workspaces/generatedDocuments";

const JOB_1 = "lever:fixture-co:generated-1";
const JOB_2 = "lever:fixture-co:generated-2";
const JOB_3 = "lever:fixture-co:generated-3";

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});
beforeEach(async () => {
  await db.sql`DELETE FROM application_packages`;
  await db.sql`DELETE FROM profiles WHERE user_id IN (${USER_A}, ${USER_B})`;
  await db.sql`DELETE FROM jobs WHERE id IN (${JOB_1}, ${JOB_2}, ${JOB_3})`;
  for (const id of [JOB_1, JOB_2, JOB_3]) await seedJob(db.sql, id);
  await seedProfile(db.sql, USER_A, { profile_version: "v2" });
});

test("lists packages with a résumé or cover letter, flags Outdated, and only for the caller", async () => {
  await db.sql`INSERT INTO application_packages (user_id, job_id, resume_json, profile_version, prepared_at)
               VALUES (${USER_A}, ${JOB_1}, '{"r":1}', 'v1', now() - interval '1 day')`;
  await db.sql`INSERT INTO application_packages (user_id, job_id, cover_letter_json, profile_version, prepared_at)
               VALUES (${USER_A}, ${JOB_2}, '{"c":1}', 'v2', now())`;
  await db.sql`INSERT INTO application_packages (user_id, job_id) VALUES (${USER_A}, ${JOB_3})`;
  const rows = await listGeneratedDocuments(USER_A);
  expect(rows.map((r) => [r.job.jobId, r.resume, r.cover, r.outdated])).toEqual([
    [JOB_2, false, true, false],
    [JOB_1, true, false, true],
  ]);
  expect(rows[0].job.url).toMatch(/^https?:\/\//);
  expect(await listGeneratedDocuments(USER_B)).toEqual([]);
});
