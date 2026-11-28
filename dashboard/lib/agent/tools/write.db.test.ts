// The phase 1 write tools against real Postgres, RLS, the lifecycle gate and the audit
// functions (plan Task 1.15). Runs only under `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { openTestDb, seedJob, seedProfile, seedReview, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { serviceSql } from "@/lib/db";
import { emptyGathered } from "@/lib/agent/gathered";
import { undoAction } from "@/lib/agent/actions/audit";
import type { ToolCtx } from "@/lib/agent/tools";
import { proposeMemoChangeTool, setShortlistStateTool, updateDocumentDraftTool } from "@/lib/agent/tools/write";
import { saveCoverLetterEditCore } from "@/lib/coverLetterEditCore";
import { saveMemo } from "@/lib/workspaces/memo";
import { emptyMemoDoc } from "@/lib/workspaces/memoSchema";
import { setShortlistState } from "@/lib/workspaces/shortlist";

const JOB = "lever:fixture-co:write-1";
const JOB_NO_LETTER = "lever:fixture-co:write-2";
const THREAD = "11111111-1111-4111-8111-111111111111";
const RUN = "33333333-3333-4333-8333-333333333333";
const LETTER = { greeting: "Dear Hiring Manager,", paragraphs: ["Generated body."], closing: "Sincerely,", signature: "Ada" };

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
  gathered: emptyGathered(), repairsLeft: { n: 1 }, views: { used: 0 }, fromView: false, ...extra,
});

beforeEach(async () => {
  await db.sql`DELETE FROM agent_actions`;
  await db.sql`DELETE FROM agent_threads`;
  await db.sql`DELETE FROM cover_letter_edits`;
  await db.sql`DELETE FROM application_packages`;
  await db.sql`DELETE FROM shortlist_items`;
  await db.sql`DELETE FROM search_memo_proposals`;
  await db.sql`DELETE FROM search_memo_versions`;
  await db.sql`DELETE FROM search_memos`;
  await db.sql`DELETE FROM job_reviews`;
  await db.sql`DELETE FROM profiles WHERE user_id IN (${USER_A}, ${USER_B})`;
  await db.sql`DELETE FROM jobs WHERE id IN (${JOB}, ${JOB_NO_LETTER})`;
  await seedJob(db.sql, JOB, { description: "Fixture JD" });
  await seedJob(db.sql, JOB_NO_LETTER, { description: "Fixture JD" });
  await seedProfile(db.sql, USER_A, { resume_text: "Résumé A" });
  await seedReview(db.sql, USER_A, JOB, { fit_score: 80 });
  await seedReview(db.sql, USER_A, JOB_NO_LETTER, { fit_score: 70 });
  await db.sql`INSERT INTO agent_threads (id, user_id) VALUES (${THREAD}, ${USER_A})`;
  await db.sql`INSERT INTO application_packages (user_id, job_id, cover_letter_json, resume_json)
               VALUES (${USER_A}, ${JOB}, ${JSON.stringify(LETTER)}::text::jsonb, '{"kept":true}')`;
  await db.sql`INSERT INTO application_packages (user_id, job_id, resume_json) VALUES (${USER_A}, ${JOB_NO_LETTER}, '{"kept":true}')`;
});

const pkg = async (job = JOB) =>
  (await db.sql`SELECT cover_letter_json, resume_json, status FROM application_packages WHERE user_id = ${USER_A} AND job_id = ${job}`)[0];
const edit = async (job = JOB) =>
  (await db.sql`SELECT edited_text FROM cover_letter_edits WHERE user_id = ${USER_A} AND job_id = ${job}`)[0];

test("propose_memo_change leaves search_memos untouched", async () => {
  await saveMemo(USER_A, { ...emptyMemoDoc(), role: "Backend" }, "user");
  const before = await db.sql`SELECT version, doc FROM search_memos WHERE user_id = ${USER_A}`;
  const out = await proposeMemoChangeTool(ctx(), { proposedDoc: { ...emptyMemoDoc(), role: "Staff backend" }, rationale: "From chat" });
  if (out.status !== "done") throw new Error("expected a proposal");
  expect(out.diff).toEqual([{ section: "role", before: "Backend", after: "Staff backend" }]);
  expect(await db.sql`SELECT version, doc FROM search_memos WHERE user_id = ${USER_A}`).toEqual(before);
  const [proposal] = await db.sql`SELECT status, source FROM search_memo_proposals WHERE id = ${out.proposalId}`;
  expect(proposal).toEqual({ status: "pending", source: "interactive" });
});

test("update_document_draft writes cover_letter_edits.edited_text only and leaves application_packages untouched", async () => {
  const before = await pkg();
  const out = await updateDocumentDraftTool(ctx(), { jobId: JOB, text: "Agent's edited letter." });
  expect(out).toMatchObject({ status: "done", actionId: expect.any(Number) });
  expect(await edit()).toEqual({ edited_text: "Agent's edited letter." });
  expect(await pkg()).toEqual(before);
  // No generated letter: refused, nothing written.
  expect(await updateDocumentDraftTool(ctx(), { jobId: JOB_NO_LETTER, text: "x" })).toEqual({
    status: "refused", reason: "no_generated_letter",
  });
  expect(await edit(JOB_NO_LETTER)).toBeUndefined();
});

test("undo of the first agent edit deletes the overlay row; undo of a later one restores the previous text", async () => {
  const first = await updateDocumentDraftTool(ctx(), { jobId: JOB, text: "First agent edit." });
  const second = await updateDocumentDraftTool(ctx(), { jobId: JOB, text: "Second agent edit." });
  if (first.status !== "done" || second.status !== "done" || first.actionId === null || second.actionId === null) {
    throw new Error("expected two audited edits");
  }
  const [logged] = await db.sql`SELECT before, after FROM agent_actions WHERE id = ${second.actionId}`;
  expect(logged).toEqual({ before: "First agent edit.", after: "Second agent edit." });

  expect(await undoAction(USER_A, second.actionId)).toEqual({ ok: true });
  expect(await edit()).toEqual({ edited_text: "First agent edit." });
  expect(await undoAction(USER_A, first.actionId)).toEqual({ ok: true });
  expect(await edit()).toBeUndefined();

  // An edit the user made since makes the agent's edit changed_since.
  const third = await updateDocumentDraftTool(ctx(), { jobId: JOB, text: "Third agent edit." });
  if (third.status !== "done" || third.actionId === null) throw new Error("expected an audited edit");
  await db.sql`UPDATE cover_letter_edits SET edited_text = 'The user rewrote it.' WHERE user_id = ${USER_A} AND job_id = ${JOB}`;
  expect(await undoAction(USER_A, third.actionId)).toEqual({ ok: false, reason: "changed_since" });
  expect(await edit()).toEqual({ edited_text: "The user rewrote it." });
});

test("an agent edit keeps the user's cover letter comment, and its undo restores the user's text with it", async () => {
  await saveCoverLetterEditCore(USER_A, JOB, "The user's edit.", { comment: "Too formal before." });
  const row = async () =>
    (await db.sql`SELECT edited_text, comment FROM cover_letter_edits WHERE user_id = ${USER_A} AND job_id = ${JOB}`)[0];
  expect(await row()).toEqual({ edited_text: "The user's edit.", comment: "Too formal before." });

  const out = await updateDocumentDraftTool(ctx(), { jobId: JOB, text: "Agent's edited letter." });
  if (out.status !== "done" || out.actionId === null) throw new Error("expected an audited edit");
  expect(await row()).toEqual({ edited_text: "Agent's edited letter.", comment: "Too formal before." });

  expect(await undoAction(USER_A, out.actionId)).toEqual({ ok: true });
  expect(await row()).toEqual({ edited_text: "The user's edit.", comment: "Too formal before." });
  // The user's own save still sets (or clears) the comment.
  await saveCoverLetterEditCore(USER_A, JOB, "The user's edit.", { comment: null });
  expect(await row()).toEqual({ edited_text: "The user's edit.", comment: null });
});

test("unattended set_shortlist_state on a row the user set returns user_owned", async () => {
  await setShortlistState(USER_A, { jobId: JOB, state: "shortlisted", setBy: "user" });
  const out = await setShortlistStateTool(ctx({ unattended: true, threadId: null }), { jobId: JOB, state: "skipped", reasonCode: "red_flag" });
  expect(out).toEqual({ status: "refused", reason: "user_owned" });
  const [row] = await db.sql`SELECT state, set_by FROM shortlist_items WHERE user_id = ${USER_A} AND job_id = ${JOB}`;
  expect(row).toEqual({ state: "shortlisted", set_by: "user" });
  expect(await db.sql`SELECT 1 FROM agent_actions`).toHaveLength(0);
});
