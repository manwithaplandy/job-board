// The shortlist library and its undo against real Postgres, real RLS, the lifecycle
// trigger and the real agent_log_action / agent_mark_action_undone (Task 1.3). Runs only
// under `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { openTestDb, seedJob, seedProfile, seedReview, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { serviceSql } from "@/lib/db";
import { emptyGathered } from "@/lib/agent/gathered";
import { undoAction } from "@/lib/agent/actions/audit";
import type { ToolCtx } from "@/lib/agent/tools";
import { listShortlist, NotReviewedError, setShortlistState } from "@/lib/workspaces/shortlist";

const JOB = "lever:fixture-co:shortlist-1";
const JOB_2 = "lever:fixture-co:shortlist-2";
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
  await db.sql`DELETE FROM shortlist_items`;
  await db.sql`DELETE FROM job_reviews`;
  await db.sql`DELETE FROM profiles WHERE user_id IN (${USER_A}, ${USER_B})`;
  await db.sql`DELETE FROM jobs WHERE id IN (${JOB}, ${JOB_2})`;
  await seedJob(db.sql, JOB);
  await seedJob(db.sql, JOB_2);
  await seedProfile(db.sql, USER_A);
  await seedReview(db.sql, USER_A, JOB, { fit_score: 77 });
  await seedReview(db.sql, USER_A, JOB_2, { fit_score: 60 });
  await db.sql`INSERT INTO agent_threads (id, user_id) VALUES (${THREAD}, ${USER_A})`;
});

const review = async (job = JOB) =>
  (await db.sql`SELECT verdict, human_override, fit_score FROM job_reviews WHERE user_id = ${USER_A} AND job_id = ${job}`)[0];
const item = async (job = JOB) =>
  (await db.sql`SELECT state, reason_code, set_by FROM shortlist_items WHERE user_id = ${USER_A} AND job_id = ${job}`)[0];

test("a user skip writes the sticky deny and leaving it restores an unreviewed row, scores intact", async () => {
  await setShortlistState(USER_A, { jobId: JOB, state: "skipped", reasonCode: "pay", reasonText: " low ", setBy: "user" });
  expect(await item()).toEqual({ state: "skipped", reason_code: "pay", set_by: "user" });
  expect(await review()).toEqual({ verdict: "deny", human_override: true, fit_score: 77 });
  // Still a reviewed job for the shortlist: it can move again.
  await setShortlistState(USER_A, { jobId: JOB, state: "shortlisted", setBy: "user" });
  expect(await review()).toEqual({ verdict: null, human_override: false, fit_score: 77 });
  // An agent skip leaves job_reviews alone.
  await setShortlistState(USER_A, { jobId: JOB_2, state: "skipped", reasonCode: "red_flag", setBy: "agent" });
  expect(await review(JOB_2)).toEqual({ verdict: "approve", human_override: false, fit_score: 60 });
});

test("rows are the caller's alone and an unreviewed job is refused", async () => {
  await setShortlistState(USER_A, { jobId: JOB, state: "later", setBy: "user" });
  expect((await listShortlist(USER_A)).map((r) => [r.jobId, r.state, r.fitScore])).toEqual([[JOB, "later", 77]]);
  expect(await listShortlist(USER_B)).toEqual([]);
  await expect(setShortlistState(USER_B, { jobId: JOB, state: "later", setBy: "user" })).rejects.toThrow(
    NotReviewedError,
  );
  expect((await listShortlist(USER_A, ["shortlisted"])).length).toBe(0);
});

test("undo of an agent write restores before; a second undo is already_undone", async () => {
  await db.sql`INSERT INTO shortlist_items (user_id, job_id, state, set_by, brief_why)
               VALUES (${USER_A}, ${JOB}, 'suggested', 'system', 'Strong match')`;
  const out = await setShortlistState(USER_A, { jobId: JOB, state: "shortlisted", setBy: "agent", audit: ctx() });
  if (!("actionId" in out) || out.actionId === null) throw new Error("expected an action id");
  expect(await undoAction(USER_A, out.actionId)).toEqual({ ok: true });
  expect(await item()).toEqual({ state: "suggested", reason_code: null, set_by: "system" });
  const [kept] = await db.sql`SELECT brief_why FROM shortlist_items WHERE job_id = ${JOB}`;
  expect(kept.brief_why).toBe("Strong match");
  expect(await undoAction(USER_A, out.actionId)).toEqual({ ok: false, reason: "already_undone" });
  expect(await undoAction(USER_B, out.actionId)).toEqual({ ok: false, reason: "not_found" });
});

test("undo refuses with changed_since after the user edited the row again", async () => {
  const out = await setShortlistState(USER_A, {
    jobId: JOB, state: "skipped", reasonCode: "deal_breaker", setBy: "agent", audit: ctx(),
  });
  if (!("actionId" in out) || out.actionId === null) throw new Error("expected an action id");
  await setShortlistState(USER_A, { jobId: JOB, state: "later", setBy: "user" });
  expect(await undoAction(USER_A, out.actionId)).toEqual({ ok: false, reason: "changed_since" });
  expect(await item()).toEqual({ state: "later", reason_code: null, set_by: "user" });
  expect((await db.sql`SELECT undone_at FROM agent_actions`)[0].undone_at).toBeNull();
});

test("undo of a first triage removes the row; undo back to a user skip rewrites the deny", async () => {
  const first = await setShortlistState(USER_A, { jobId: JOB, state: "later", setBy: "agent", audit: ctx() });
  if (!("actionId" in first) || first.actionId === null) throw new Error("expected an action id");
  expect(await undoAction(USER_A, first.actionId)).toEqual({ ok: true });
  expect(await item()).toBeUndefined();

  await setShortlistState(USER_A, { jobId: JOB_2, state: "skipped", reasonCode: "stack", setBy: "user" });
  const over = await setShortlistState(USER_A, { jobId: JOB_2, state: "shortlisted", setBy: "agent", audit: ctx() });
  if (!("actionId" in over) || over.actionId === null) throw new Error("expected an action id");
  expect(await review(JOB_2)).toMatchObject({ verdict: null, human_override: false });
  expect(await undoAction(USER_A, over.actionId)).toEqual({ ok: true });
  expect(await item(JOB_2)).toEqual({ state: "skipped", reason_code: "stack", set_by: "user" });
  expect(await review(JOB_2)).toMatchObject({ verdict: "deny", human_override: true });
});

test("a forged action whose before fails the write schema changes nothing", async () => {
  await setShortlistState(USER_A, { jobId: JOB, state: "later", setBy: "user" });
  const [{ id }] = await db.asUser(USER_A, (tx) => tx`SELECT public.agent_log_action(
    ${RUN}::uuid, ${THREAD}::uuid, 'agent', 'shortlist.set', ${JSON.stringify({ jobId: JOB })}::text::jsonb,
    ${JSON.stringify({ state: "skipped", reasonCode: "pay", reasonText: null, setBy: "agent" })}::text::jsonb,
    ${JSON.stringify({ state: "later", reasonCode: null, reasonText: null, setBy: "user" })}::text::jsonb) AS id`);
  // "pay" is a user-only reason: the agent could not have written it.
  expect(await undoAction(USER_A, Number(id))).toEqual({ ok: false, reason: "not_found" });
  expect(await item()).toEqual({ state: "later", reason_code: null, set_by: "user" });
  expect(await review()).toMatchObject({ verdict: "approve", human_override: false });
});

test("an unattended write never overwrites a user-set row", async () => {
  await setShortlistState(USER_A, { jobId: JOB, state: "shortlisted", setBy: "user" });
  const out = await setShortlistState(USER_A, {
    jobId: JOB, state: "skipped", reasonCode: "posting_age", setBy: "agent", audit: ctx({ unattended: true, threadId: null }),
  });
  expect(out).toEqual({ skipped: "user_owned" });
  expect(await item()).toEqual({ state: "shortlisted", reason_code: null, set_by: "user" });
  expect((await db.sql`SELECT count(*)::int AS n FROM agent_actions`)[0].n).toBe(0);
});

test("an unattended write never touches a job the user rejected from the board", async () => {
  const unattended = ctx({ unattended: true, threadId: null });
  // The board's reject: verdict deny with human_override, and no shortlist row.
  await db.sql`UPDATE job_reviews SET verdict = 'deny', human_override = TRUE WHERE user_id = ${USER_A} AND job_id = ${JOB}`;
  expect(await setShortlistState(USER_A, { jobId: JOB, state: "shortlisted", setBy: "agent", audit: unattended }))
    .toEqual({ skipped: "user_owned" });
  expect(await item()).toBeUndefined();
  // Rejected after the agent had already triaged it: the agent's row is left alone too.
  await setShortlistState(USER_A, { jobId: JOB_2, state: "later", setBy: "agent", audit: unattended });
  await db.sql`UPDATE job_reviews SET verdict = 'deny', human_override = TRUE WHERE user_id = ${USER_A} AND job_id = ${JOB_2}`;
  expect(await setShortlistState(USER_A, { jobId: JOB_2, state: "shortlisted", setBy: "agent", audit: unattended }))
    .toEqual({ skipped: "user_owned" });
  expect(await item(JOB_2)).toEqual({ state: "later", reason_code: null, set_by: "agent" });
  expect(await review()).toEqual({ verdict: "deny", human_override: true, fit_score: 77 });
  expect((await db.sql`SELECT count(*)::int AS n FROM agent_actions`)[0].n).toBe(1);
  // A deny without human_override (the reviewer's own) is not a hand reject.
  await db.sql`UPDATE job_reviews SET verdict = 'deny', human_override = FALSE WHERE user_id = ${USER_A} AND job_id = ${JOB}`;
  expect(await setShortlistState(USER_A, { jobId: JOB, state: "later", setBy: "agent", audit: unattended }))
    .toMatchObject({ after: { state: "later", setBy: "agent" } });
});
