// The tracker library and its undoers against real Postgres, real RLS, the lifecycle
// trigger, the board's applied core and the real agent_log_action /
// agent_mark_action_undone (Task 1.6). Runs only under `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { openTestDb, seedJob, seedProfile, seedReview, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { serviceSql } from "@/lib/db";
import { emptyGathered } from "@/lib/agent/gathered";
import { undoAction } from "@/lib/agent/actions/audit";
import type { ToolCtx } from "@/lib/agent/tools";
import {
  addApplicationNote,
  listApplications,
  NotReviewedError,
  setApplicationStage,
  setNextStep,
} from "@/lib/workspaces/applications";

const JOB = "lever:fixture-co:tracker-1";
const JOB_2 = "lever:fixture-co:tracker-2";
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

const ctx = (extra: Partial<ToolCtx> = {}): ToolCtx => ({
  userId: USER_A, email: null, threadId: THREAD, runId: RUN, variant: 1, unattended: false,
  gathered: emptyGathered(), repairsLeft: { n: 1 }, ...extra,
});

beforeEach(async () => {
  await db.sql`DELETE FROM agent_actions`;
  await db.sql`DELETE FROM agent_threads`;
  await db.sql`DELETE FROM applications`;
  await db.sql`DELETE FROM application_packages`;
  await db.sql`DELETE FROM job_payload_demands`;
  await db.sql`DELETE FROM job_reviews`;
  await db.sql`DELETE FROM profiles WHERE user_id IN (${USER_A}, ${USER_B})`;
  await db.sql`DELETE FROM jobs WHERE id IN (${JOB}, ${JOB_2})`;
  // A cached description lets the board's mark-applied path take its legacy branch.
  await seedJob(db.sql, JOB, { description: "Fixture JD" });
  await seedJob(db.sql, JOB_2, { description: "Fixture JD" });
  await seedProfile(db.sql, USER_A);
  await seedReview(db.sql, USER_A, JOB, { fit_score: 77 });
  await seedReview(db.sql, USER_A, JOB_2, { fit_score: 60 });
  await db.sql`INSERT INTO agent_threads (id, user_id) VALUES (${THREAD}, ${USER_A})`;
});

const app = async (job = JOB) =>
  (await db.sql`SELECT stage, closed_reason FROM applications WHERE user_id = ${USER_A} AND job_id = ${job}`)[0];
const pkg = async (job = JOB) =>
  (await db.sql`SELECT status, applied_at IS NOT NULL AS stamped, resume_json FROM application_packages WHERE user_id = ${USER_A} AND job_id = ${job}`)[0];
const stageEvents = async (job = JOB) =>
  (await db.sql`SELECT e.from_stage, e.to_stage, e.actor FROM application_events e JOIN applications a ON a.id = e.application_id
                WHERE a.user_id = ${USER_A} AND a.job_id = ${job} AND e.kind = 'stage' ORDER BY e.id`).map((r) => ({ ...r }));

test("every move appends one stage event and the history lists oldest first", async () => {
  await setApplicationStage(USER_A, { jobId: JOB, stage: "preparing", actor: "user" });
  await setApplicationStage(USER_A, { jobId: JOB, stage: "interviewing", actor: "user" });
  await setApplicationStage(USER_A, { jobId: JOB, stage: "interviewing", actor: "user" });
  await setApplicationStage(USER_A, { jobId: JOB, stage: "closed", closedReason: "no_response", actor: "user" });
  expect(await stageEvents()).toEqual([
    { from_stage: null, to_stage: "preparing", actor: "user" },
    { from_stage: "preparing", to_stage: "interviewing", actor: "user" },
    { from_stage: "interviewing", to_stage: "closed", actor: "user" },
  ]);
  const [row] = await listApplications(USER_A);
  expect(row).toMatchObject({ jobId: JOB, stage: "closed", closedReason: "no_response" });
  expect(row.events.map((e) => e.toStage)).toEqual(["preparing", "interviewing", "closed"]);
  expect(await listApplications(USER_B)).toEqual([]);
});

test("moving to applied marks the package applied when one exists and is fine when none exists", async () => {
  await db.sql`INSERT INTO application_packages (user_id, job_id, resume_json) VALUES (${USER_A}, ${JOB}, '{"kept":true}')`;
  await setApplicationStage(USER_A, { jobId: JOB, stage: "applied", actor: "user" });
  expect(await app()).toEqual({ stage: "applied", closed_reason: null });
  expect(await pkg()).toEqual({ status: "applied", stamped: true, resume_json: { kept: true } });

  await setApplicationStage(USER_A, { jobId: JOB_2, stage: "applied", actor: "user" });
  expect(await app(JOB_2)).toEqual({ stage: "applied", closed_reason: null });
  expect(await pkg(JOB_2)).toMatchObject({ status: "applied", stamped: true, resume_json: null });

  // Back to ready unmarks: the prepared package reverts, the bare marker goes.
  await setApplicationStage(USER_A, { jobId: JOB, stage: "ready", actor: "user" });
  expect(await pkg()).toEqual({ status: "prepared", stamped: false, resume_json: { kept: true } });
  await setApplicationStage(USER_A, { jobId: JOB_2, stage: "ready", actor: "user" });
  expect(await pkg(JOB_2)).toBeUndefined();
});

test("a job with no review for the user cannot be tracked, and nothing is written", async () => {
  await expect(setApplicationStage(USER_B, { jobId: JOB, stage: "applied", actor: "user" })).rejects.toThrow(NotReviewedError);
  await expect(addApplicationNote(USER_B, { jobId: JOB, note: "hi", actor: "user" })).rejects.toThrow(NotReviewedError);
  expect(await db.sql`SELECT 1 FROM applications`).toHaveLength(0);
  expect(await db.sql`SELECT 1 FROM application_packages`).toHaveLength(0);
});

test("next step is set and cleared; another user's job is not tracked", async () => {
  await setApplicationStage(USER_A, { jobId: JOB, stage: "applied", actor: "user" });
  await setNextStep(USER_A, JOB, "2026-12-01");
  expect((await listApplications(USER_A))[0].nextStepOn).toBe("2026-12-01");
  await setNextStep(USER_A, JOB, null);
  expect((await listApplications(USER_A))[0].nextStepOn).toBeNull();
  await expect(setNextStep(USER_B, JOB, "2026-12-01")).rejects.toThrow();
});

test("documents flags read the package and Outdated follows the profile version", async () => {
  await db.sql`UPDATE profiles SET profile_version = 'v2' WHERE user_id = ${USER_A}`;
  await db.sql`INSERT INTO application_packages (user_id, job_id, resume_json, cover_letter_json, profile_version)
               VALUES (${USER_A}, ${JOB}, '{"r":1}', '"double encoded"', 'v1')`;
  await setApplicationStage(USER_A, { jobId: JOB, stage: "preparing", actor: "user" });
  expect((await listApplications(USER_A))[0].documents).toEqual({ resume: true, cover: false, outdated: true });
});

test("undo of an agent move restores the stage; a later user move makes it changed_since", async () => {
  await setApplicationStage(USER_A, { jobId: JOB, stage: "applied", actor: "user" });
  const moved = await setApplicationStage(USER_A, { jobId: JOB, stage: "interviewing", actor: "agent", audit: ctx() });
  if (moved.actionId === null) throw new Error("expected an action id");
  expect(await undoAction(USER_A, moved.actionId)).toEqual({ ok: true });
  expect(await app()).toEqual({ stage: "applied", closed_reason: null });
  expect((await stageEvents()).at(-1)).toEqual({ from_stage: "interviewing", to_stage: "applied", actor: "user" });

  const again = await setApplicationStage(USER_A, { jobId: JOB, stage: "offer", actor: "agent", audit: ctx() });
  if (again.actionId === null) throw new Error("expected an action id");
  await setApplicationStage(USER_A, { jobId: JOB, stage: "closed", closedReason: "withdrawn", actor: "user" });
  expect(await undoAction(USER_A, again.actionId)).toEqual({ ok: false, reason: "changed_since" });
  expect(await app()).toEqual({ stage: "closed", closed_reason: "withdrawn" });
});

test("undo of an agent move to applied that created the row removes it and unmarks the package", async () => {
  const out = await setApplicationStage(USER_A, { jobId: JOB, stage: "applied", actor: "agent", audit: ctx() });
  if (out.actionId === null) throw new Error("expected an action id");
  expect(await pkg()).toMatchObject({ status: "applied" });
  expect(await undoAction(USER_A, out.actionId)).toEqual({ ok: true });
  expect(await app()).toBeUndefined();
  expect(await pkg()).toBeUndefined();
});

test("undo of an agent note hides it from the history; the user's own notes stay", async () => {
  await addApplicationNote(USER_A, { jobId: JOB, note: "My own note", actor: "user" });
  const out = await addApplicationNote(USER_A, { jobId: JOB, note: "Agent note", actor: "agent", audit: ctx() });
  if (out.actionId === null) throw new Error("expected an action id");
  const notes = async () => (await listApplications(USER_A))[0].events.filter((e) => e.kind === "note").map((e) => e.note);
  expect(await notes()).toEqual(["My own note", "Agent note"]);
  expect(await undoAction(USER_A, out.actionId)).toEqual({ ok: true });
  expect(await notes()).toEqual(["My own note"]);
  expect(await undoAction(USER_A, out.actionId)).toEqual({ ok: false, reason: "already_undone" });
});

test("a forged add_note action cannot hide the user's own note", async () => {
  const mine = await addApplicationNote(USER_A, { jobId: JOB, note: "Keep me", actor: "user" });
  const [{ id }] = await db.asUser(USER_A, (tx) => tx`SELECT public.agent_log_action(
    ${RUN}::uuid, ${THREAD}::uuid, 'agent', 'application.add_note',
    ${JSON.stringify({ jobId: JOB, eventId: mine.eventId })}::text::jsonb, NULL,
    ${JSON.stringify({ eventId: mine.eventId, note: "Keep me" })}::text::jsonb) AS id`);
  expect(await undoAction(USER_A, Number(id))).toEqual({ ok: false, reason: "not_found" });
  expect((await listApplications(USER_A))[0].events.filter((e) => e.kind === "note").map((e) => e.note)).toEqual(["Keep me"]);
});
