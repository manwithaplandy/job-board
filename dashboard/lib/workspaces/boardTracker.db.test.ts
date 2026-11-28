// The board's Mark applied / Unmark dual-write into the tracker (review G2 I1, concern b)
// and the set_stage undoer's forward restore to applied (concern a), against real
// Postgres, RLS and the lifecycle gate. The board actions run as they do in production,
// with only the session mocked. Runs only under `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { openTestDb, seedJob, seedProfile, seedReview, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";

const session = vi.hoisted(() => ({ user: "" }));
vi.mock("@/lib/auth", () => ({ requireUserId: async () => session.user, getUserId: async () => session.user }));

import { serviceSql } from "@/lib/db";
import { emptyGathered } from "@/lib/agent/gathered";
import { undoAction } from "@/lib/agent/actions/audit";
import type { ToolCtx } from "@/lib/agent/tools";
import { markApplicationApplied, unmarkApplicationApplied } from "@/app/actions/applications";
import { setApplicationStage } from "@/lib/workspaces/applications";

const JOB = "lever:fixture-co:board-1";
const UNREVIEWED = "lever:fixture-co:board-2";
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
  session.user = USER_A;
  await db.sql`DELETE FROM agent_actions`;
  await db.sql`DELETE FROM agent_threads`;
  await db.sql`DELETE FROM applications`;
  await db.sql`DELETE FROM application_packages`;
  await db.sql`DELETE FROM job_payload_demands`;
  await db.sql`DELETE FROM job_reviews`;
  await db.sql`DELETE FROM profiles WHERE user_id IN (${USER_A}, ${USER_B})`;
  await db.sql`DELETE FROM jobs WHERE id IN (${JOB}, ${UNREVIEWED})`;
  // A cached description lets the board's mark-applied path take its legacy branch.
  await seedJob(db.sql, JOB, { description: "Fixture JD" });
  await seedJob(db.sql, UNREVIEWED, { description: "Fixture JD" });
  await seedProfile(db.sql, USER_A);
  await seedReview(db.sql, USER_A, JOB, { fit_score: 77 });
  await db.sql`INSERT INTO agent_threads (id, user_id) VALUES (${THREAD}, ${USER_A})`;
});

const app = async (job = JOB) =>
  (await db.sql`SELECT stage, closed_reason FROM applications WHERE user_id = ${USER_A} AND job_id = ${job}`)[0];
const pkg = async (job = JOB) =>
  (await db.sql`SELECT status, applied_at IS NOT NULL AS stamped, resume_json FROM application_packages WHERE user_id = ${USER_A} AND job_id = ${job}`)[0];
const stageEvents = async (job = JOB) =>
  (await db.sql`SELECT e.from_stage, e.to_stage, e.actor FROM application_events e JOIN applications a ON a.id = e.application_id
                WHERE a.user_id = ${USER_A} AND a.job_id = ${job} AND e.kind = 'stage' ORDER BY e.id`).map((r) => ({ ...r }));
const actionCount = async () => (await db.sql`SELECT count(*)::int AS n FROM agent_actions`)[0].n;

test("board mark on an untracked reviewed job adds it to the tracker at applied, as the user, with no audit row", async () => {
  await markApplicationApplied(JOB);
  expect(await pkg()).toMatchObject({ status: "applied", stamped: true });
  expect(await app()).toEqual({ stage: "applied", closed_reason: null });
  expect(await stageEvents()).toEqual([{ from_stage: null, to_stage: "applied", actor: "user" }]);
  expect(await actionCount()).toBe(0);

  // Marking again is a no-op on the tracker: no second event.
  await markApplicationApplied(JOB);
  expect(await stageEvents()).toHaveLength(1);
});

test("board mark on an unreviewed job marks the package but adds no tracker row", async () => {
  await markApplicationApplied(UNREVIEWED);
  expect(await pkg(UNREVIEWED)).toMatchObject({ status: "applied" });
  expect(await app(UNREVIEWED)).toBeUndefined();
});

test("board mark moves preparing or ready to applied with one stage event", async () => {
  await setApplicationStage(USER_A, { jobId: JOB, stage: "ready", actor: "user" });
  await markApplicationApplied(JOB);
  expect(await app()).toEqual({ stage: "applied", closed_reason: null });
  expect(await stageEvents()).toEqual([
    { from_stage: null, to_stage: "ready", actor: "user" },
    { from_stage: "ready", to_stage: "applied", actor: "user" },
  ]);
});

test("board mark leaves interviewing, offer and closed alone", async () => {
  await setApplicationStage(USER_A, { jobId: JOB, stage: "interviewing", actor: "user" });
  await markApplicationApplied(JOB);
  expect(await app()).toEqual({ stage: "interviewing", closed_reason: null });

  await setApplicationStage(USER_A, { jobId: JOB, stage: "closed", closedReason: "rejected", actor: "user" });
  await markApplicationApplied(JOB);
  expect(await app()).toEqual({ stage: "closed", closed_reason: "rejected" });
  expect((await stageEvents()).map((e) => e.to_stage)).toEqual(["interviewing", "closed"]);
});

test("board unmark moves applied back to ready and unmarks the package", async () => {
  await db.sql`INSERT INTO application_packages (user_id, job_id, resume_json) VALUES (${USER_A}, ${JOB}, '{"kept":true}')`;
  await markApplicationApplied(JOB);
  await unmarkApplicationApplied(JOB);
  expect(await app()).toEqual({ stage: "ready", closed_reason: null });
  expect(await pkg()).toEqual({ status: "prepared", stamped: false, resume_json: { kept: true } });
  expect((await stageEvents()).at(-1)).toEqual({ from_stage: "applied", to_stage: "ready", actor: "user" });
  expect(await actionCount()).toBe(0);
});

test("board unmark leaves a row past applied, and an untracked job, alone", async () => {
  await setApplicationStage(USER_A, { jobId: JOB, stage: "offer", actor: "user" });
  await unmarkApplicationApplied(JOB);
  expect(await app()).toEqual({ stage: "offer", closed_reason: null });

  await markApplicationApplied(UNREVIEWED);
  await unmarkApplicationApplied(UNREVIEWED);
  expect(await app(UNREVIEWED)).toBeUndefined();
  expect(await pkg(UNREVIEWED)).toBeUndefined();
});

test("after a board mark, the agent's set_stage to applied logs nothing, so no Undo can delete the row or unmark", async () => {
  await markApplicationApplied(JOB);
  const out = await setApplicationStage(USER_A, { jobId: JOB, stage: "applied", actor: "agent", audit: ctx() });
  expect(out.actionId).toBeNull();
  expect(await actionCount()).toBe(0);
  expect(await app()).toEqual({ stage: "applied", closed_reason: null });
  expect(await pkg()).toMatchObject({ status: "applied" });
});

test("an agent-created row the user then marks on the board cannot be removed by the agent's Undo", async () => {
  const out = await setApplicationStage(USER_A, { jobId: JOB, stage: "preparing", actor: "agent", audit: ctx() });
  if (out.actionId === null) throw new Error("expected an action id");
  await markApplicationApplied(JOB);
  expect(await undoAction(USER_A, out.actionId)).toEqual({ ok: false, reason: "changed_since" });
  expect(await app()).toEqual({ stage: "applied", closed_reason: null });
  expect(await pkg()).toMatchObject({ status: "applied", stamped: true });
});

test("undo of an agent move from applied to ready re-marks the board's bare marker", async () => {
  await markApplicationApplied(JOB);
  const out = await setApplicationStage(USER_A, { jobId: JOB, stage: "ready", actor: "agent", audit: ctx() });
  if (out.actionId === null) throw new Error("expected an action id");
  expect(await pkg()).toBeUndefined();
  expect(await undoAction(USER_A, out.actionId)).toEqual({ ok: true });
  expect(await app()).toEqual({ stage: "applied", closed_reason: null });
  expect(await pkg()).toMatchObject({ status: "applied", stamped: true, resume_json: null });
});

test("undo of an agent move from interviewing to preparing re-marks a prepared package, keeping its content", async () => {
  await db.sql`INSERT INTO application_packages (user_id, job_id, resume_json) VALUES (${USER_A}, ${JOB}, '{"kept":true}')`;
  await setApplicationStage(USER_A, { jobId: JOB, stage: "applied", actor: "user" });
  await setApplicationStage(USER_A, { jobId: JOB, stage: "interviewing", actor: "user" });
  const out = await setApplicationStage(USER_A, { jobId: JOB, stage: "preparing", actor: "agent", audit: ctx() });
  if (out.actionId === null) throw new Error("expected an action id");
  expect(await pkg()).toEqual({ status: "prepared", stamped: false, resume_json: { kept: true } });
  expect(await undoAction(USER_A, out.actionId)).toEqual({ ok: true });
  expect(await app()).toEqual({ stage: "interviewing", closed_reason: null });
  expect(await pkg()).toEqual({ status: "applied", stamped: true, resume_json: { kept: true } });
});
