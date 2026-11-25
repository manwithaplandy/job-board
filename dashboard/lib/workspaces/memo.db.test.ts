// The memo library against real Postgres, RLS, column grants and the lifecycle gate
// (Task 1.7). Runs only under `npm run test:db`.
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { openTestDb, seedProfile, USER_A, USER_B, type TestDb } from "@/lib/testing/dbHarness";
import { serviceSql } from "@/lib/db";
import { profileVersion } from "@/lib/profileVersion";
import {
  createMemoProposal, getMemo, listMemoVersions, MemoNotFoundError, resolveMemoProposal, restoreMemoVersion, saveMemo,
} from "@/lib/workspaces/memo";
import { COMPILED_MEMO_MAX, compiledMemoOverflow, compileMemo } from "@/lib/workspaces/memoCompile";
import { emptyMemoDoc, MEMO_SECTIONS } from "@/lib/workspaces/memoSchema";

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

/** A doc whose compiled text is exactly the cap, with every section non-empty and distinct. */
function docAtCap() {
  const d = doc({ role: "r", locations: "l", compensation: "c", mustHaves: "m", dealBreakers: "d", companies: "o", other: "e" });
  let room = COMPILED_MEMO_MAX - compileMemo(d).length;
  for (const { key } of MEMO_SECTIONS) {
    const add = Math.min(room, 2000 - d[key].length);
    d[key] = d[key].repeat(1 + add);
    room -= add;
  }
  return d;
}

test("a memo whose later sections would be cut is refused; one at the cap keeps every section", async () => {
  const long = doc({ role: "r".repeat(2000), locations: "l".repeat(2000), mustHaves: "m".repeat(2000),
    dealBreakers: "No crypto", companies: "Fintech", other: "Four-day week" });
  const before = await profile();
  await expect(saveMemo(USER_A, long, "user")).rejects.toMatchObject({
    name: "MemoInputError", code: "memo_too_long", over: compiledMemoOverflow(long),
  });
  expect((await db.sql`SELECT count(*)::int AS n FROM search_memo_versions`)[0].n).toBe(0);
  expect(await profile()).toEqual(before);

  // An approved proposal is held to the same cap, even one stored before the check.
  await saveMemo(USER_A, doc({ role: "Backend" }), "user");
  const [stored] = await db.sql`
    INSERT INTO search_memo_proposals (user_id, base_version, proposed_doc, rationale, source)
    VALUES (${USER_A}, 1, ${db.sql.json(long)}, '', 'background') RETURNING id`;
  await expect(resolveMemoProposal(USER_A, stored.id, "approve")).rejects.toMatchObject({ code: "memo_too_long" });
  const [still] = await db.sql`SELECT status FROM search_memo_proposals WHERE id = ${stored.id}`;
  expect(still.status).toBe("pending");
  expect((await getMemo(USER_A))?.version).toBe(1);

  const full = docAtCap();
  expect(compileMemo(full)).toHaveLength(COMPILED_MEMO_MAX);
  expect(await saveMemo(USER_A, full, "user")).toBe(2);
  const { instructions } = await profile();
  expect(instructions).toBe(compileMemo(full));
  for (const { key, label } of MEMO_SECTIONS) expect(instructions).toContain(`${label}: ${full[key]}`);
});

test("saving the current doc again writes no version and keeps profile_version", async () => {
  expect(await saveMemo(USER_A, doc({ role: "Backend" }), "user")).toBe(1);
  const before = await profile();
  expect(await saveMemo(USER_A, doc({ role: "Backend" }), "user")).toBe(1);
  expect(await restoreMemoVersion(USER_A, 1)).toBe(1);
  expect(await profile()).toEqual(before);
  expect((await db.sql`SELECT count(*)::int AS n FROM search_memo_versions`)[0].n).toBe(1);
  // The settings page wrote the instructions directly: the same doc is written again.
  await db.sql`UPDATE profiles SET instructions = 'Edited in settings' WHERE user_id = ${USER_A}`;
  expect(await saveMemo(USER_A, doc({ role: "Backend" }), "user")).toBe(2);
  expect((await profile()).instructions).toBe("Role and seniority: Backend");
});

test("old instructions too long for Anything else are flagged and kept whole as version 0", async () => {
  const legacy = `${"Remote only. ".repeat(300)}End.`;
  await db.sql`UPDATE profiles SET instructions = ${legacy} WHERE user_id = ${USER_A}`;
  const read = await getMemo(USER_A);
  expect(read).toMatchObject({ version: 0, legacyTruncated: true, legacyLength: legacy.trim().length });
  expect(read?.doc.other).toHaveLength(2000);
  expect(await saveMemo(USER_A, read?.doc ?? doc(), "user")).toBe(1);
  const rows = await db.sql`SELECT version, doc, changed_by FROM search_memo_versions WHERE user_id = ${USER_A} ORDER BY version`;
  expect(rows.map((r) => [Number(r.version), r.changed_by])).toEqual([[0, "user"], [1, "user"]]);
  expect(rows[0].doc).toEqual({ legacyInstructions: legacy });
  // Never listed or restored as a memo, never written twice, never counted as a memo change.
  expect((await listMemoVersions(USER_A)).map((v) => v.version)).toEqual([1]);
  await expect(restoreMemoVersion(USER_A, 0)).rejects.toThrow(MemoNotFoundError);
  expect(await saveMemo(USER_A, doc({ role: "Backend" }), "user")).toBe(2);
  expect((await db.sql`SELECT count(*)::int AS n FROM search_memo_versions WHERE version = 0`)[0].n).toBe(1);
  // Short old instructions keep no version 0 (USER_A's beforeEach text is short).
  await db.sql`DELETE FROM search_memo_versions`;
  await db.sql`DELETE FROM search_memos`;
  await db.sql`UPDATE profiles SET instructions = 'Short' WHERE user_id = ${USER_A}`;
  expect(await getMemo(USER_A)).toEqual({ version: 0, doc: doc({ other: "Short" }), pending: [] });
  await saveMemo(USER_A, doc({ other: "Short" }), "user");
  expect((await db.sql`SELECT count(*)::int AS n FROM search_memo_versions WHERE version = 0`)[0].n).toBe(0);
});

test("a user with no profile cannot save a memo", async () => {
  await expect(saveMemo(USER_B, doc({ role: "x" }), "user")).rejects.toThrow(MemoNotFoundError);
  expect((await db.sql`SELECT count(*)::int AS n FROM search_memos`)[0].n).toBe(0);
});
