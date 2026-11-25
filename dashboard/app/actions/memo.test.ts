// The memo page's actions (plan Task 1.8): the user comes from the session, an erased
// account is refused, a refusal comes back as a message (server-action errors are
// hidden in production), and the page is revalidated only after a write.
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  assertNotDeleted: vi.fn(),
  revalidatePath: vi.fn(),
  saveMemo: vi.fn(),
  resolveMemoProposal: vi.fn(),
  restoreMemoVersion: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUserId: m.requireUserId }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: m.assertNotDeleted }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/workspaces/memo", async () => {
  class MemoInputError extends Error {
    constructor(message: string, readonly code = "invalid", readonly over: number | null = null) {
      super(message);
    }
  }
  class MemoNotFoundError extends Error {}
  return {
    MemoInputError,
    MemoNotFoundError,
    saveMemo: m.saveMemo,
    resolveMemoProposal: m.resolveMemoProposal,
    restoreMemoVersion: m.restoreMemoVersion,
  };
});

import { resolveProposalAction, restoreMemoAction, saveMemoAction } from "@/app/actions/memo";
import { MemoInputError, MemoNotFoundError } from "@/lib/workspaces/memo";
import { emptyMemoDoc } from "@/lib/workspaces/memoSchema";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID = "11111111-2222-4333-8444-555555555555";
const DOC = { ...emptyMemoDoc(), role: "Backend" };

beforeEach(() => {
  vi.clearAllMocks();
  m.requireUserId.mockResolvedValue(USER);
  m.assertNotDeleted.mockResolvedValue(undefined);
  m.saveMemo.mockResolvedValue(4);
  m.resolveMemoProposal.mockResolvedValue({ version: 5 });
  m.restoreMemoVersion.mockResolvedValue(6);
});

test("each action writes as the session user and revalidates the page", async () => {
  expect(await saveMemoAction(DOC)).toEqual({ ok: true, version: 4 });
  expect(m.saveMemo).toHaveBeenCalledWith(USER, DOC, "user");
  expect(await resolveProposalAction(ID, "approve", DOC)).toEqual({ ok: true, version: 5 });
  expect(m.resolveMemoProposal).toHaveBeenCalledWith(USER, ID, "approve", DOC);
  expect(await resolveProposalAction(ID, "decline")).toEqual({ ok: true, version: 5 });
  expect(m.resolveMemoProposal).toHaveBeenLastCalledWith(USER, ID, "decline");
  expect(await restoreMemoAction(2)).toEqual({ ok: true, version: 6 });
  expect(m.restoreMemoVersion).toHaveBeenCalledWith(USER, 2);
  expect(m.revalidatePath.mock.calls.every(([path]) => path === "/looking-for")).toBe(true);
  expect(m.revalidatePath).toHaveBeenCalledTimes(4);
});

test("refusals come back as messages and revalidate nothing", async () => {
  m.saveMemo.mockRejectedValueOnce(new MemoInputError("That memo is 12 characters too long.", "memo_too_long", 12));
  expect(await saveMemoAction(DOC)).toEqual({ ok: false, message: "That memo is 12 characters too long." });
  m.resolveMemoProposal.mockResolvedValueOnce(null);
  expect(await resolveProposalAction(ID, "approve")).toEqual({
    ok: false,
    message: "This proposal is no longer open. It may be out of date or already handled.",
  });
  m.restoreMemoVersion.mockRejectedValueOnce(new MemoNotFoundError("No such version."));
  expect(await restoreMemoAction(9)).toEqual({ ok: false, message: "No such version." });
  expect(m.revalidatePath).not.toHaveBeenCalled();
});

test("an unexpected failure is not passed through as text", async () => {
  m.saveMemo.mockRejectedValueOnce(new Error("connection refused at 10.0.0.1"));
  const out = await saveMemoAction(DOC);
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.message).not.toContain("10.0.0.1");
});

test("an erased account writes nothing", async () => {
  m.assertNotDeleted.mockRejectedValue(new Error("deleted"));
  await expect(saveMemoAction(DOC)).rejects.toThrow();
  await expect(resolveProposalAction(ID, "decline")).rejects.toThrow();
  await expect(restoreMemoAction(1)).rejects.toThrow();
  expect(m.saveMemo).not.toHaveBeenCalled();
  expect(m.resolveMemoProposal).not.toHaveBeenCalled();
  expect(m.restoreMemoVersion).not.toHaveBeenCalled();
});
