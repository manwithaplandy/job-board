import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";

// The database is a fake: agent_actions is an in-memory list that the SELECT and the
// agent_mark_action_undone call read and change, filtered by the bound user id the way
// RLS and the definer function filter. Every statement's text and values are recorded.
type ActionRow = {
  id: string; // bigint arrives as a string
  user_id: string;
  kind: string;
  actor: string;
  target_key: unknown;
  before: unknown;
  after: unknown;
  undone_at: Date | null;
  created_at: Date;
};
const db = vi.hoisted(() => ({
  actions: [] as ActionRow[],
  calls: [] as { userId: string; text: string; values: unknown[] }[],
  markResult: null as boolean | null,
  queue: [] as unknown[][],
}));

function fakeTx(userId: string) {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?");
    db.calls.push({ userId, text, values });
    if (text.includes("agent_mark_action_undone")) {
      const row = db.actions.find((a) => Number(a.id) === Number(values[0]) && a.user_id === userId && !a.undone_at);
      if (db.markResult !== null) return Promise.resolve([{ ok: db.markResult }]);
      if (row) row.undone_at = new Date();
      return Promise.resolve([{ ok: Boolean(row) }]);
    }
    if (text.includes("FROM agent_actions") && text.includes("WHERE id =")) {
      return Promise.resolve(db.actions.filter((a) => Number(a.id) === values[0] && a.user_id === values[1]));
    }
    return Promise.resolve(db.queue.shift() ?? []);
  };
}

vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (userId: string, fn: (t: unknown) => Promise<unknown>) => fn(fakeTx(userId))),
  withUserMutation: vi.fn(async (userId: string, fn: (t: unknown) => Promise<unknown>) => fn(fakeTx(userId))),
}));
// The real undoers module would register the group's real libraries; these tests use
// their own fake library instead.
vi.mock("@/lib/agent/actions/undoers", () => ({ UNDOABLE_KINDS: [] }));

import {
  listRecentActions,
  logAction,
  registerUndoer,
  undoAction,
  type StoredAction,
} from "@/lib/agent/actions/audit";
import { emptyGathered } from "@/lib/agent/gathered";
import type { ToolCtx } from "@/lib/agent/tools";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const KIND = "document.update_draft"; // a kind whose real library is not in this group
const created = new Date("2026-11-25T10:00:00Z");

// A fake library: one value per target, written only through its own validated setter,
// with an undoer that follows the contract (re-read live, compare to after, parse
// before with the write schema, write through the setter).
const lib = { store: new Map<string, string>() };
const writeSchema = z.object({ text: z.string().max(20) });
const targetSchema = z.object({ id: z.string() });
const setDraft = vi.fn(async (_tx: unknown, id: string, value: z.infer<typeof writeSchema>) => {
  lib.store.set(id, value.text);
});
registerUndoer(KIND, async (tx, action: StoredAction) => {
  const target = targetSchema.safeParse(action.targetKey);
  const before = writeSchema.safeParse(action.before);
  const after = writeSchema.safeParse(action.after);
  if (!target.success || !before.success || !after.success) return "invalid";
  if (lib.store.get(target.data.id) !== after.data.text) return "changed_since";
  await setDraft(tx, target.data.id, before.data);
  return "restored";
});

function seedAction(extra: Partial<ActionRow> = {}): number {
  const id = db.actions.length + 1;
  db.actions.push({
    id: String(id),
    user_id: USER,
    kind: KIND,
    actor: "agent",
    target_key: { id: "d1" },
    before: { text: "old" },
    after: { text: "new" },
    undone_at: null,
    created_at: created,
    ...extra,
  });
  return id;
}

beforeEach(() => {
  db.actions = [];
  db.calls = [];
  db.queue = [];
  db.markResult = null;
  lib.store = new Map([["d1", "new"]]);
  setDraft.mockClear();
});

describe("undoAction", () => {
  test("undo restores before when the row still equals after", async () => {
    const id = seedAction();
    expect(await undoAction(USER, id)).toEqual({ ok: true });
    expect(lib.store.get("d1")).toBe("old");
    expect(db.actions[0].undone_at).not.toBeNull();
  });

  test("undo refuses with changed_since when the row was edited again", async () => {
    const id = seedAction();
    lib.store.set("d1", "edited by the user");
    expect(await undoAction(USER, id)).toEqual({ ok: false, reason: "changed_since" });
    expect(lib.store.get("d1")).toBe("edited by the user");
    expect(setDraft).not.toHaveBeenCalled();
    expect(db.actions[0].undone_at).toBeNull();
  });

  test("undo of an already undone action returns already_undone", async () => {
    const id = seedAction({ undone_at: created });
    expect(await undoAction(USER, id)).toEqual({ ok: false, reason: "already_undone" });
    expect(setDraft).not.toHaveBeenCalled();
  });

  test("a mark that loses a race reports already_undone", async () => {
    const id = seedAction();
    db.markResult = false;
    expect(await undoAction(USER, id)).toEqual({ ok: false, reason: "already_undone" });
  });

  test("undo of another user's action is not_found", async () => {
    const id = seedAction({ user_id: OTHER });
    expect(await undoAction(USER, id)).toEqual({ ok: false, reason: "not_found" });
    expect(setDraft).not.toHaveBeenCalled();
    expect(lib.store.get("d1")).toBe("new");
  });

  test("a forged action whose before fails the write schema is refused and nothing is written", async () => {
    const id = seedAction({ before: { text: "x".repeat(500), extra: "<script>" } });
    expect(await undoAction(USER, id)).toEqual({ ok: false, reason: "not_found" });
    expect(setDraft).not.toHaveBeenCalled();
    expect(lib.store.get("d1")).toBe("new");
    expect(db.calls.some((c) => c.text.includes("agent_mark_action_undone"))).toBe(false);
  });

  test("undo writes through the registered library function, never raw SQL from the row", async () => {
    const id = seedAction({ before: { text: "restored-value" } });
    expect(await undoAction(USER, id)).toEqual({ ok: true });
    expect(setDraft).toHaveBeenCalledWith(expect.anything(), "d1", { text: "restored-value" });
    // undoAction itself ran only the read and the mark, and bound nothing from the row.
    expect(db.calls.map((c) => (c.text.includes("agent_mark_action_undone") ? "mark" : "read"))).toEqual([
      "read",
      "mark",
    ]);
    for (const c of db.calls) expect(JSON.stringify(c.values)).not.toContain("restored-value");
  });

  test("a kind with no registered undoer, a bad id or a malformed row is not_found", async () => {
    const id = seedAction({ kind: "profile.set_resume" });
    expect(await undoAction(USER, id)).toEqual({ ok: false, reason: "not_found" });
    expect(await undoAction(USER, 0)).toEqual({ ok: false, reason: "not_found" });
    expect(await undoAction(USER, 1.5)).toEqual({ ok: false, reason: "not_found" });
    const bad = seedAction({ kind: "document.delete" });
    expect(await undoAction(USER, bad)).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("logAction", () => {
  const ctx: ToolCtx = {
    userId: USER,
    email: null,
    threadId: "22222222-2222-4222-8222-222222222222",
    runId: "33333333-3333-4333-8333-333333333333",
    variant: 1,
    unattended: false,
    gathered: emptyGathered(),
    repairsLeft: { n: 1 }, views: { used: 0 },
  };

  test("calls agent_log_action with the run, the thread and json text, never a user id", async () => {
    db.queue = [[{ id: "42" }]];
    const id = await logAction(fakeTx(USER) as never, {
      ctx,
      actor: "agent",
      kind: "shortlist.set",
      targetKey: { jobId: "lever:x:1" },
      before: null,
      after: { state: "shortlisted" },
    });
    expect(id).toBe(42);
    const { text, values } = db.calls[0];
    expect(text).toContain("agent_log_action");
    expect(values).toEqual([
      ctx.runId,
      ctx.threadId,
      "agent",
      "shortlist.set",
      JSON.stringify({ jobId: "lever:x:1" }),
      null,
      JSON.stringify({ state: "shortlisted" }),
    ]);
  });

  test("without a ctx the run and thread are null; an unknown kind throws before SQL", async () => {
    db.queue = [[{ id: "1" }]];
    await logAction(fakeTx(USER) as never, {
      ctx: null,
      actor: "user_via_surface",
      kind: "shortlist.set",
      targetKey: { jobId: "lever:x:1" },
      before: { state: "later" },
      after: { state: "shortlisted" },
    });
    expect(db.calls[0].values.slice(0, 2)).toEqual([null, null]);
    await expect(
      logAction(fakeTx(USER) as never, {
        ctx: null,
        actor: "agent",
        kind: "document.delete" as never,
        targetKey: {},
        before: null,
        after: null,
      }),
    ).rejects.toThrow(/kind/);
    expect(db.calls).toHaveLength(1);
  });
});

describe("listRecentActions", () => {
  test("parses bigint ids and timestamps and skips malformed rows", async () => {
    db.queue = [
      [
        { id: "7", kind: KIND, actor: "agent", target_key: { id: "d1" }, before: null, after: { text: "a" },
          undone_at: null, created_at: created },
        { id: "8", kind: "bogus", actor: "agent", target_key: {}, before: null, after: null, undone_at: null,
          created_at: created },
      ],
    ];
    expect(await listRecentActions(USER, 500)).toEqual([
      { id: 7, kind: KIND, actor: "agent", targetKey: { id: "d1" }, before: null, after: { text: "a" },
        undoneAt: null, createdAt: created.toISOString() },
    ]);
    expect(db.calls[0].values).toEqual([USER, 100]);
  });
});
