// The agent page's thread actions. withUserSql is stubbed (the next query returns
// db.rows); lib/agent/threads.ts is real, so an UPDATE that touches no row is refused.
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  rows: [] as unknown[],
  requireUserId: vi.fn(),
  assertNotDeleted: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUserId: m.requireUserId }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: m.assertNotDeleted }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_userId: string, fn: (tx: unknown) => Promise<unknown>) => fn(() => Promise.resolve(m.rows))),
}));
const undo = vi.hoisted(() => ({ undoAction: vi.fn() }));
vi.mock("@/lib/agent/actions/audit", () => ({ undoAction: undo.undoAction }));

import { renameThreadAction, undoAgentAction } from "@/app/actions/agent";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  m.rows = [];
  m.requireUserId.mockResolvedValue(USER);
  m.assertNotDeleted.mockResolvedValue(undefined);
});

test("renaming one of the caller's threads is ok and revalidates the page", async () => {
  m.rows = [{ id: THREAD }];
  expect(await renameThreadAction(THREAD, "Remote ML roles")).toEqual({ ok: true });
  expect(m.revalidatePath).toHaveBeenCalledWith("/agent");
});

test("an unknown thread is refused, not reported ok, and nothing is revalidated", async () => {
  m.rows = [];
  expect(await renameThreadAction(THREAD, "Remote ML roles")).toEqual({ ok: false });
  expect(m.revalidatePath).not.toHaveBeenCalled();
});

test("a malformed id or a blank title is refused", async () => {
  m.rows = [{ id: THREAD }];
  expect(await renameThreadAction("not-a-uuid", "Remote ML roles")).toEqual({ ok: false });
  expect(await renameThreadAction(THREAD, "   ")).toEqual({ ok: false });
  expect(m.revalidatePath).not.toHaveBeenCalled();
});

test("undoAgentAction undoes as the session user and revalidates the workspaces on success", async () => {
  undo.undoAction.mockResolvedValue({ ok: true });
  expect(await undoAgentAction(42)).toEqual({ ok: true });
  expect(m.assertNotDeleted).toHaveBeenCalledWith(USER);
  expect(undo.undoAction).toHaveBeenCalledWith(USER, 42);
  expect(m.revalidatePath).toHaveBeenCalledWith("/shortlist");
  expect(m.revalidatePath).toHaveBeenCalledWith("/agent");
});

test("a successful undo revalidates every page an undoable kind changes", async () => {
  // shortlist.set -> /shortlist; application.* -> /applications, /shortlist (stage) and the
  // board (package status); profile.set_resume -> /documents, /profile, /profile/resume,
  // /looking-for; analytics.set_tiles -> /analytics; every kind -> /agent.
  undo.undoAction.mockResolvedValue({ ok: true });
  await undoAgentAction(42);
  expect(m.revalidatePath.mock.calls.map((c) => c[0]).sort()).toEqual(
    ["/", "/agent", "/analytics", "/applications", "/board", "/documents", "/looking-for", "/profile", "/profile/resume", "/shortlist"].sort(),
  );
});

test("undoAgentAction passes a refusal through and revalidates nothing", async () => {
  undo.undoAction.mockResolvedValue({ ok: false, reason: "changed_since" });
  expect(await undoAgentAction(42)).toEqual({ ok: false, reason: "changed_since" });
  expect(m.revalidatePath).not.toHaveBeenCalled();
});

test("undoAgentAction refuses a malformed id without calling undo", async () => {
  expect(await undoAgentAction(Number.NaN)).toEqual({ ok: false, reason: "not_found" });
  expect(await undoAgentAction("7" as unknown as number)).toEqual({ ok: false, reason: "not_found" });
  expect(undo.undoAction).not.toHaveBeenCalled();
});

test("an erased account cannot undo", async () => {
  m.assertNotDeleted.mockRejectedValue(new Error("deleted"));
  await expect(undoAgentAction(42)).rejects.toThrow();
  expect(undo.undoAction).not.toHaveBeenCalled();
});
