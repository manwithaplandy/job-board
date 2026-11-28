// listAgentMarkers against real Postgres and RLS (review follow-up: one query per kind,
// DISTINCT ON the job, so older markers don't fall off a shared 100-row read). Runs only
// under `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { openTestDb, seedJob, seedProfile, seedReview, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { serviceSql } from "@/lib/db";
import { emptyGathered } from "@/lib/agent/gathered";
import { undoAction } from "@/lib/agent/actions/audit";
import type { ToolCtx } from "@/lib/agent/tools";
import { setApplicationStage } from "@/lib/workspaces/applications";
import { listAgentMarkers } from "@/lib/workspaces/agentMarkers";

const JOB = "lever:fixture-co:marker-1";
const JOB_2 = "lever:fixture-co:marker-2";
const THREAD = "11111111-1111-4111-8111-111111111111";
const RUN = "33333333-3333-4333-8333-333333333333";

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});

const ctx = (): ToolCtx => ({
  userId: USER_A, email: null, threadId: THREAD, runId: RUN, variant: 1, unattended: false,
  gathered: emptyGathered(), repairsLeft: { n: 1 }, views: { used: 0 },
});

beforeEach(async () => {
  await db.sql`DELETE FROM agent_actions`;
  await db.sql`DELETE FROM agent_threads`;
  await db.sql`DELETE FROM applications`;
  await db.sql`DELETE FROM application_packages`;
  await db.sql`DELETE FROM job_reviews`;
  await db.sql`DELETE FROM profiles WHERE user_id IN (${USER_A}, ${USER_B})`;
  await db.sql`DELETE FROM jobs WHERE id IN (${JOB}, ${JOB_2})`;
  await seedJob(db.sql, JOB, { description: "Fixture JD" });
  await seedJob(db.sql, JOB_2, { description: "Fixture JD" });
  await seedProfile(db.sql, USER_A);
  await seedReview(db.sql, USER_A, JOB, { fit_score: 77 });
  await seedReview(db.sql, USER_A, JOB_2, { fit_score: 60 });
  await db.sql`INSERT INTO agent_threads (id, user_id) VALUES (${THREAD}, ${USER_A})`;
});

test("one marker per job for the newest agent move, hidden by a later user move or an undo, kept past 100 other actions", async () => {
  const first = await setApplicationStage(USER_A, { jobId: JOB, stage: "preparing", actor: "agent", audit: ctx() });
  const second = await setApplicationStage(USER_A, { jobId: JOB, stage: "ready", actor: "agent", audit: ctx() });
  const other = await setApplicationStage(USER_A, { jobId: JOB_2, stage: "preparing", actor: "agent", audit: ctx() });
  if (first.actionId === null || second.actionId === null || other.actionId === null) throw new Error("expected action ids");
  // 120 newer actions of another kind would have pushed these out of a 100-row read.
  await db.sql`INSERT INTO agent_actions (user_id, actor, kind, target_key)
               SELECT ${USER_A}::uuid, 'agent', 'shortlist.set', jsonb_build_object('jobId', 'lever:other:' || g)
               FROM generate_series(1, 120) g`;
  expect(await listAgentMarkers(USER_A, "application.set_stage")).toEqual({ [JOB]: second.actionId, [JOB_2]: other.actionId });
  expect(await listAgentMarkers(USER_B, "application.set_stage")).toEqual({});

  // A later user move through a surface hides JOB's marker; an undo hides JOB_2's.
  await setApplicationStage(USER_A, { jobId: JOB, stage: "preparing", actor: "user", audit: ctx() });
  expect(await undoAction(USER_A, other.actionId)).toEqual({ ok: true });
  expect(await listAgentMarkers(USER_A, "application.set_stage")).toEqual({});
});
