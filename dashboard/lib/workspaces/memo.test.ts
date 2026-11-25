import { beforeEach, describe, expect, test, vi } from "vitest";

// A stateful fake of the five tables the memo touches, routed by SQL text. Every
// statement is recorded with the wrapper it ran under.
type Proposal = { id: string; base_version: string; proposed_doc: unknown; rationale: string; status: string;
  source: string; created_at: Date };
const db = vi.hoisted(() => ({
  memo: null as { version: string; doc: unknown } | null,
  versions: [] as { version: string; doc: unknown; changed_by: string; proposal_id: unknown; created_at: Date }[],
  proposals: [] as Proposal[],
  profile: null as { resume_text: string | null; instructions: string | null; profile_version: string } | null,
  calls: [] as { wrapper: string; text: string; values: unknown[] }[],
}));

const now = new Date("2026-11-25T10:00:00Z");

function fakeTx(wrapper: string) {
  return (strings: TemplateStringsArray, ...v: unknown[]) => {
    const text = strings.join("?");
    db.calls.push({ wrapper, text, values: v });
    const ok = (rows: unknown[] = []) => Promise.resolve(rows);
    if (text.includes("SELECT version, doc FROM search_memos")) return ok(db.memo ? [db.memo] : []);
    if (text.includes("SELECT version FROM search_memos")) return ok(db.memo ? [{ version: db.memo.version }] : []);
    if (text.includes("SELECT instructions FROM profiles")) return ok(db.profile ? [db.profile] : []);
    if (text.includes("SELECT 1 FROM profiles")) return ok(db.profile ? [{ "?column?": 1 }] : []);
    if (text.includes("SELECT resume_text FROM profiles")) return ok(db.profile ? [db.profile] : []);
    if (text.includes("UPDATE profiles SET")) {
      if (db.profile) Object.assign(db.profile, { instructions: v[0], profile_version: v[1] });
      return ok();
    }
    if (text.includes("INSERT INTO search_memos")) {
      db.memo = { version: String(v[1]), doc: JSON.parse(v[2] as string) };
      return ok();
    }
    if (text.includes("INSERT INTO search_memo_versions")) {
      db.versions.push({ version: String(v[1]), doc: JSON.parse(v[2] as string), changed_by: v[3] as string,
        proposal_id: v[4], created_at: now });
      return ok();
    }
    if (text.includes("FROM search_memo_versions") && text.includes("ORDER BY version DESC")) {
      return ok([...db.versions].reverse());
    }
    if (text.includes("FROM search_memo_versions")) return ok(db.versions.filter((x) => Number(x.version) === v[1]));
    if (text.includes("INSERT INTO search_memo_proposals")) {
      const p: Proposal = { id: `00000000-0000-4000-8000-00000000000${db.proposals.length + 1}`,
        base_version: String(v[1]), proposed_doc: JSON.parse(v[2] as string), rationale: v[3] as string,
        status: "pending", source: v[4] as string, created_at: now };
      db.proposals.push(p);
      return ok([p]);
    }
    if (text.includes("UPDATE search_memo_proposals")) {
      const status = /status = '(\w+)'/.exec(text)?.[1] ?? "";
      for (const p of db.proposals) {
        if (text.includes("WHERE id =") ? p.id === v[0] : p.status === "pending") p.status = status;
      }
      return ok();
    }
    if (text.includes("FROM search_memo_proposals") && text.includes("WHERE id =")) {
      return ok(db.proposals.filter((p) => p.id === v[0]));
    }
    if (text.includes("FROM search_memo_proposals")) return ok(db.proposals.filter((p) => p.status === "pending"));
    return ok();
  };
}

vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_u: string, fn: (t: unknown) => Promise<unknown>) => fn(fakeTx("withUserSql"))),
  withUserMutation: vi.fn(async (_u: string, fn: (t: unknown) => Promise<unknown>) => fn(fakeTx("withUserMutation"))),
}));

import * as memoModule from "@/lib/workspaces/memo";
import {
  createMemoProposal,
  getMemo,
  listMemoVersions,
  MemoInputError,
  resolveMemoProposal,
  restoreMemoVersion,
  saveMemo,
} from "@/lib/workspaces/memo";
import { compileMemo } from "@/lib/workspaces/memoCompile";
import { emptyMemoDoc } from "@/lib/workspaces/memoSchema";
import { profileVersion } from "@/lib/profileVersion";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const doc = (extra: Partial<ReturnType<typeof emptyMemoDoc>> = {}) => ({ ...emptyMemoDoc(), ...extra });

beforeEach(() => {
  db.memo = null;
  db.versions = [];
  db.proposals = [];
  db.profile = { resume_text: "My résumé", instructions: null, profile_version: "v0" };
  db.calls = [];
});

describe("memo versions", () => {
  test("first visit reads the old instructions into Anything else at version 0", async () => {
    expect(await getMemo(USER)).toBeNull();
    db.profile = { resume_text: null, instructions: "  Remote only  ", profile_version: "v" };
    expect(await getMemo(USER)).toEqual({ version: 0, doc: doc({ other: "Remote only" }), pending: [] });
  });

  test("approving a proposal writes version n+1, changed_by proposal, and the compiled text to profiles.instructions", async () => {
    await saveMemo(USER, doc({ role: "Backend" }), "user");
    const p = await createMemoProposal(USER, { proposedDoc: doc({ role: "Staff backend" }), rationale: "You said staff", source: "interactive" });
    expect(p).toMatchObject({ baseVersion: 1, status: "pending" });
    expect(await resolveMemoProposal(USER, p.id, "approve")).toEqual({ version: 2 });
    expect(db.versions.at(-1)).toMatchObject({ version: "2", changed_by: "proposal", proposal_id: p.id });
    expect(db.profile?.instructions).toBe("Role and seniority: Staff backend");
    expect(db.proposals[0].status).toBe("approved");
    // Every version-creating statement ran in the mutation wrapper.
    const writes = db.calls.filter((c) => /INSERT INTO search_memo(s|_versions)|UPDATE profiles/.test(c.text));
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) expect(w.wrapper).toBe("withUserMutation");
  });

  test("approve with an edited doc stores the edit, not the proposal", async () => {
    const p = await createMemoProposal(USER, { proposedDoc: doc({ role: "Staff" }), rationale: "", source: "background" });
    expect(await resolveMemoProposal(USER, p.id, "approve", doc({ role: "Principal" }))).toEqual({ version: 1 });
    expect(db.memo?.doc).toEqual(doc({ role: "Principal" }));
    expect(db.profile?.instructions).toBe("Role and seniority: Principal");
  });

  test("decline changes nothing but the proposal status", async () => {
    await saveMemo(USER, doc({ role: "Backend" }), "user");
    const before = { memo: structuredClone(db.memo), versions: db.versions.length, profile: { ...db.profile } };
    const p = await createMemoProposal(USER, { proposedDoc: doc({ role: "Frontend" }), rationale: "x", source: "interactive" });
    expect(await resolveMemoProposal(USER, p.id, "decline")).toEqual({ version: 1 });
    expect(db.proposals[0].status).toBe("declined");
    expect(db.memo).toEqual(before.memo);
    expect(db.versions).toHaveLength(before.versions);
    expect(db.profile).toEqual(before.profile);
    // A resolved proposal cannot be resolved again.
    expect(await resolveMemoProposal(USER, p.id, "approve")).toBeNull();
  });

  test("a proposal against an older base_version cannot be approved", async () => {
    const p = await createMemoProposal(USER, { proposedDoc: doc({ role: "Staff" }), rationale: "", source: "background" });
    await saveMemo(USER, doc({ role: "Mine" }), "user");
    expect(await resolveMemoProposal(USER, p.id, "approve")).toBeNull();
    expect(db.memo?.doc).toEqual(doc({ role: "Mine" }));
    expect(db.proposals[0].status).toBe("superseded");
  });

  test("a new proposal supersedes older pending ones", async () => {
    await createMemoProposal(USER, { proposedDoc: doc({ role: "A" }), rationale: "", source: "background" });
    await createMemoProposal(USER, { proposedDoc: doc({ role: "B" }), rationale: "", source: "background" });
    expect(db.proposals.map((p) => p.status)).toEqual(["superseded", "pending"]);
    expect((await getMemo(USER))?.pending.map((p) => p.proposedDoc.role)).toEqual(["B"]);
  });

  test("there is no function that lets a proposal skip approval", () => {
    expect(Object.keys(memoModule).sort()).toEqual([
      "MemoInputError", "MemoNotFoundError", "afterMemoChange", "createMemoProposal", "getMemo",
      "listMemoVersions", "resolveMemoProposal", "restoreMemoVersion", "saveMemo",
    ]);
  });

  test("restore creates a new version rather than rewriting history", async () => {
    await saveMemo(USER, doc({ role: "One" }), "user");
    await saveMemo(USER, doc({ role: "Two" }), "user");
    expect(await restoreMemoVersion(USER, 1)).toBe(3);
    expect(db.versions.map((x) => [x.version, x.changed_by, (x.doc as { role: string }).role])).toEqual([
      ["1", "user", "One"], ["2", "user", "Two"], ["3", "restore", "One"],
    ]);
    expect((await listMemoVersions(USER)).map((x) => x.version)).toEqual([3, 2, 1]);
    await expect(restoreMemoVersion(USER, 9)).rejects.toThrow(/No such version/);
  });

  test("profile_version equals the reviewer's sha256(resume + NUL + instructions)", async () => {
    const d = doc({ role: "Backend", other: "Remote" });
    await saveMemo(USER, d, "user");
    expect(db.profile?.profile_version).toBe(profileVersion("My résumé", compileMemo(d)));
    // An empty memo clears the instructions; the hash is the same as for "".
    await saveMemo(USER, emptyMemoDoc(), "user");
    expect(db.profile?.instructions).toBeNull();
    expect(db.profile?.profile_version).toBe(profileVersion("My résumé", ""));
  });

  test("a malformed doc or rationale throws before any SQL", async () => {
    await expect(saveMemo(USER, { ...doc(), role: "x".repeat(2001) }, "user")).rejects.toThrow(MemoInputError);
    await expect(
      createMemoProposal(USER, { proposedDoc: doc(), rationale: "r".repeat(501), source: "interactive" }),
    ).rejects.toThrow(MemoInputError);
    expect(db.calls).toHaveLength(0);
  });
});
