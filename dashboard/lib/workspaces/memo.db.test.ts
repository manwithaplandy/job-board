// The memo library against real Postgres, RLS, column grants and the lifecycle gate
// (Task 1.7). Runs only under `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { openTestDb, seedProfile, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { serviceSql } from "@/lib/db";
import { profileVersion } from "@/lib/profileVersion";
import {
  createMemoProposal, getMemo, listMemoVersions, MemoNotFoundError, resolveMemoProposal, restoreMemoVersion, saveMemo,
} from "@/lib/workspaces/memo";
import { compileMemo } from "@/lib/workspaces/memoCompile";
import { emptyMemoDoc } from "@/lib/workspaces/memoSchema";

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb([]);
});
afterAll(async () => {
  await db?.close();
  await serviceSql.end();
});

beforeEach(async () => {
  await db.sql`DELETE FROM search_memo_proposals`;
  await db.sql`DELETE FROM search_memo_versions`;
  await db.sql`DELETE FROM search_memos`;
  await db.sql`DELETE FROM profiles WHERE user_id IN (${USER_A}, ${USER_B})`;
  await seedProfile(db.sql, USER_A, { resume_text: "Résumé A", instructions: "Old free text" });
});

const doc = (extra: Partial<ReturnType<typeof emptyMemoDoc>> = {}) => ({ ...emptyMemoDoc(), ...extra });
const profile = async () =>
  (await db.sql`SELECT instructions, profile_version FROM profiles WHERE user_id = ${USER_A}`)[0];

test("save, propose, approve and restore keep history and the compiled instructions in step", async () => {
  expect(await getMemo(USER_A)).toEqual({ version: 0, doc: doc({ other: "Old free text" }), pending: [] });
  expect(await saveMemo(USER_A, doc({ role: "Backend" }), "user")).toBe(1);
  expect(await profile()).toEqual({
    instructions: "Role and seniority: Backend",
    profile_version: profileVersion("Résumé A", "Role and seniority: Backend"),
  });

  const p = await createMemoProposal(USER_A, { proposedDoc: doc({ role: "Staff backend" }), rationale: "From chat", source: "interactive" });
  expect((await getMemo(USER_A))?.pending.map((x) => x.id)).toEqual([p.id]);
  expect(await resolveMemoProposal(USER_A, p.id, "approve")).toEqual({ version: 2 });
  expect((await profile()).instructions).toBe(compileMemo(doc({ role: "Staff backend" })));

  expect(await restoreMemoVersion(USER_A, 1)).toBe(3);
  expect((await listMemoVersions(USER_A)).map((v) => [v.version, v.changedBy])).toEqual([
    [3, "restore"], [2, "proposal"], [1, "user"],
  ]);
  const [link] = await db.sql`SELECT proposal_id FROM search_memo_versions WHERE user_id = ${USER_A} AND version = 2`;
  expect(link.proposal_id).toBe(p.id);
  await expect(restoreMemoVersion(USER_A, 42)).rejects.toThrow(MemoNotFoundError);
});

test("a stale proposal is refused; another user's proposal is invisible; content is fixed once written", async () => {
  const p = await createMemoProposal(USER_A, { proposedDoc: doc({ role: "Staff" }), rationale: "", source: "background" });
  expect(await resolveMemoProposal(USER_B, p.id, "approve")).toBeNull();
  await saveMemo(USER_A, doc({ role: "Mine" }), "user");
  expect(await resolveMemoProposal(USER_A, p.id, "approve")).toBeNull();
  const [row] = await db.sql`SELECT status FROM search_memo_proposals WHERE id = ${p.id}`;
  expect(row.status).toBe("superseded");
  expect((await getMemo(USER_A))?.doc).toEqual(doc({ role: "Mine" }));
  // The user's own token can resolve a proposal but never rewrite its doc.
  const code = await db.asUser(USER_A, (tx) => tx`UPDATE search_memo_proposals SET proposed_doc = '{}'::jsonb`)
    .then(() => null, (e: { code?: string }) => e.code);
  expect(code).toBe("42501");
});

test("a user with no profile cannot save a memo", async () => {
  await expect(saveMemo(USER_B, doc({ role: "x" }), "user")).rejects.toThrow(MemoNotFoundError);
  expect((await db.sql`SELECT count(*)::int AS n FROM search_memos`)[0].n).toBe(0);
});
