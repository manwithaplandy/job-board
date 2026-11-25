// The shortlist page's actions (plan Task 1.5): the user comes from the session, an
// erased account is refused, and the page is revalidated after a write.
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  assertNotDeleted: vi.fn(),
  revalidatePath: vi.fn(),
  setShortlistState: vi.fn(),
  fillSuggested: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUserId: m.requireUserId }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: m.assertNotDeleted }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/workspaces/shortlist", () => ({ setShortlistState: m.setShortlistState }));
vi.mock("@/lib/workspaces/suggested", () => ({ fillSuggested: m.fillSuggested }));

import { refreshSuggestedAction, setShortlistStateAction } from "@/app/actions/shortlist";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => {
  vi.clearAllMocks();
  m.requireUserId.mockResolvedValue(USER);
  m.assertNotDeleted.mockResolvedValue(undefined);
  m.setShortlistState.mockResolvedValue({ before: null, after: {}, actionId: null });
  m.fillSuggested.mockResolvedValue(4);
});

test("setShortlistStateAction writes as the session user, set by the user, then revalidates", async () => {
  await setShortlistStateAction("gh:acme:1", "skipped", "pay", "Too low");
  expect(m.assertNotDeleted).toHaveBeenCalledWith(USER);
  expect(m.setShortlistState).toHaveBeenCalledWith(USER, {
    jobId: "gh:acme:1",
    state: "skipped",
    reasonCode: "pay",
    reasonText: "Too low",
    setBy: "user",
  });
  expect(m.revalidatePath).toHaveBeenCalledWith("/shortlist");
});

test("an erased account writes nothing", async () => {
  m.assertNotDeleted.mockRejectedValue(new Error("deleted"));
  await expect(setShortlistStateAction("gh:acme:1", "later")).rejects.toThrow();
  expect(m.setShortlistState).not.toHaveBeenCalled();
  expect(m.revalidatePath).not.toHaveBeenCalled();
});

test("refreshSuggestedAction fills suggestions for the session user and returns the count", async () => {
  expect(await refreshSuggestedAction()).toBe(4);
  expect(m.fillSuggested).toHaveBeenCalledWith(USER);
  expect(m.revalidatePath).toHaveBeenCalledWith("/shortlist");
});
