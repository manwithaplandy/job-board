// Résumé replacement and its versions against real Postgres and RLS (plan Task 1.11 and
// the set_resume half of Task 1.14's interface): "Use as résumé", Restore, and the
// profile.set_resume undoer. Runs only under `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { openTestDb, seedProfile, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { serviceSql } from "@/lib/db";
import { emptyGathered } from "@/lib/agent/gathered";
import { undoAction } from "@/lib/agent/actions/audit";
import type { ToolCtx } from "@/lib/agent/tools";
import {
  listResumeVersions,
  ResumeInputError,
  restoreResumeVersion,
  setResumeFromDocument,
} from "@/lib/workspaces/resumeVersions";

const THREAD = "11111111-1111-4111-8111-111111111111";
const RUN = "33333333-3333-4333-8333-333333333333";
const DOC_OK = "44444444-4444-4444-8444-444444444444";
const DOC_EMPTY = "55555555-5555-4555-8555-555555555555";

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
  gathered: emptyGathered(), repairsLeft: { n: 1 }, views: { used: 0 }, fromView: false,
});

async function seedDoc(id: string, extraction: "ok" | "empty", text: string | null) {
  await db.sql`INSERT INTO documents (id, user_id, kind, filename, mime, bytes, storage_path, extracted_text, extraction)
               VALUES (${id}, ${USER_A}, 'other', 'cv.pdf', 'application/pdf', 10, ${`${USER_A}/doc-${id}-cv.pdf`}, ${text}, ${extraction})`;
}

beforeEach(async () => {
  await db.sql`DELETE FROM agent_actions`;
  await db.sql`DELETE FROM agent_threads`;
  await db.sql`DELETE FROM resume_versions`;
  await db.sql`DELETE FROM documents`;
  await db.sql`DELETE FROM profiles WHERE user_id IN (${USER_A}, ${USER_B})`;
  await seedProfile(db.sql, USER_A, { resume_text: "Old résumé", resume_file_path: `${USER_A}/1-old.pdf` });
  await seedDoc(DOC_OK, "ok", "New résumé from the upload");
  await seedDoc(DOC_EMPTY, "empty", null);
  await db.sql`INSERT INTO agent_threads (id, user_id) VALUES (${THREAD}, ${USER_A})`;
});

const profile = async () =>
  (await db.sql`SELECT resume_text, resume_file_path, profile_version FROM profiles WHERE user_id = ${USER_A}`)[0];

test("Use as résumé replaces the text, keeps the displaced text as a version, and moves profile_version", async () => {
  const before = await profile();
  const out = await setResumeFromDocument(USER_A, { documentId: DOC_OK, actor: "user" });
  expect(out).toEqual({ displacedVersion: 1, actionId: null });
  const after = await profile();
  expect(after.resume_text).toBe("New résumé from the upload");
  expect(after.resume_file_path).toBe(`${USER_A}/1-old.pdf`);
  expect(after.profile_version).not.toBe(before.profile_version);
  const versions = await listResumeVersions(USER_A);
  expect(versions).toHaveLength(1);
  expect(versions[0]).toMatchObject({ version: 1, source: "upload", documentId: DOC_OK, text: "Old résumé" });
  expect(await listResumeVersions(USER_B)).toEqual([]);
});

test("a document with no readable text, or another user's document, cannot become the résumé", async () => {
  await expect(setResumeFromDocument(USER_A, { documentId: DOC_EMPTY, actor: "user" })).rejects.toThrow(ResumeInputError);
  await seedProfile(db.sql, USER_B);
  await expect(setResumeFromDocument(USER_B, { documentId: DOC_OK, actor: "user" })).rejects.toThrow(ResumeInputError);
  expect((await profile()).resume_text).toBe("Old résumé");
  expect(await db.sql`SELECT 1 FROM resume_versions`).toHaveLength(0);
});

test("Restore puts an earlier version back as the résumé and keeps what it displaced", async () => {
  await setResumeFromDocument(USER_A, { documentId: DOC_OK, actor: "user" });
  const out = await restoreResumeVersion(USER_A, 1);
  expect(out).toEqual({ displacedVersion: 2 });
  expect((await profile()).resume_text).toBe("Old résumé");
  const versions = await listResumeVersions(USER_A);
  expect(versions.map((v) => [v.version, v.source, v.text])).toEqual([
    [2, "restore", "New résumé from the upload"],
    [1, "upload", "Old résumé"],
  ]);
  await expect(restoreResumeVersion(USER_A, 99)).rejects.toThrow(ResumeInputError);
});

test("undo of the agent's set_resume restores the displaced text as a new version", async () => {
  const out = await setResumeFromDocument(USER_A, { documentId: DOC_OK, actor: "agent", audit: ctx() });
  if (out.actionId === null) throw new Error("expected an action id");
  const [row] = await db.sql`SELECT actor, kind, target_key, before FROM agent_actions WHERE id = ${out.actionId}`;
  expect(row).toMatchObject({ actor: "agent", kind: "profile.set_resume", target_key: { documentId: DOC_OK }, before: { version: 1 } });
  expect((await listResumeVersions(USER_A))[0].source).toBe("agent");

  expect(await undoAction(USER_A, out.actionId)).toEqual({ ok: true });
  expect((await profile()).resume_text).toBe("Old résumé");
  expect((await listResumeVersions(USER_A))[0]).toMatchObject({ version: 2, source: "restore", text: "New résumé from the upload" });
  expect(await undoAction(USER_A, out.actionId)).toEqual({ ok: false, reason: "already_undone" });
});

test("undo of set_resume refuses with changed_since after the user edited the résumé", async () => {
  const out = await setResumeFromDocument(USER_A, { documentId: DOC_OK, actor: "agent", audit: ctx() });
  if (out.actionId === null) throw new Error("expected an action id");
  await db.sql`UPDATE profiles SET resume_text = 'Edited by hand' WHERE user_id = ${USER_A}`;
  expect(await undoAction(USER_A, out.actionId)).toEqual({ ok: false, reason: "changed_since" });
  expect((await profile()).resume_text).toBe("Edited by hand");
});

test("set_resume with the text already live logs no action, so Undo can never clear the résumé", async () => {
  const first = await setResumeFromDocument(USER_A, { documentId: DOC_OK, actor: "agent", audit: ctx() });
  if (first.actionId === null) throw new Error("expected an action id");
  const again = await setResumeFromDocument(USER_A, { documentId: DOC_OK, actor: "agent", audit: ctx() });
  expect(again).toEqual({ displacedVersion: null, actionId: null });
  expect(await db.sql`SELECT id FROM agent_actions WHERE kind = 'profile.set_resume'`).toHaveLength(1);
  expect(await listResumeVersions(USER_A)).toHaveLength(1);

  // Every set_resume row that exists undoes to a real earlier résumé, never to null.
  expect(await undoAction(USER_A, first.actionId)).toEqual({ ok: true });
  expect((await profile()).resume_text).toBe("Old résumé");
});

test("an unattended run may not replace the résumé", async () => {
  await expect(
    setResumeFromDocument(USER_A, { documentId: DOC_OK, actor: "agent", audit: { ...ctx(), unattended: true } }),
  ).rejects.toThrow(ResumeInputError);
  expect((await profile()).resume_text).toBe("Old résumé");
});
