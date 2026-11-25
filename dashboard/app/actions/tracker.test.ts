// The tracker's actions (plan Task 1.6): the user comes from the session, an erased
// account is refused, and the page is revalidated after a write.
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  assertNotDeleted: vi.fn(),
  revalidatePath: vi.fn(),
  setApplicationStage: vi.fn(),
  addApplicationNote: vi.fn(),
  setNextStep: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUserId: m.requireUserId }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: m.assertNotDeleted }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/workspaces/applications", () => ({
  setApplicationStage: m.setApplicationStage,
  addApplicationNote: m.addApplicationNote,
  setNextStep: m.setNextStep,
}));

import { addNoteAction, setNextStepAction, setStageAction } from "@/app/actions/tracker";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => {
  vi.clearAllMocks();
  m.requireUserId.mockResolvedValue(USER);
  m.assertNotDeleted.mockResolvedValue(undefined);
  m.setApplicationStage.mockResolvedValue({ actionId: null });
  m.addApplicationNote.mockResolvedValue({ eventId: 1, actionId: null });
  m.setNextStep.mockResolvedValue(undefined);
});

test("each action writes as the session user, as the user, then revalidates the tracker", async () => {
  await setStageAction("gh:acme:1", "closed", "rejected");
  expect(m.setApplicationStage).toHaveBeenCalledWith(USER, { jobId: "gh:acme:1", stage: "closed", closedReason: "rejected", actor: "user" });
  await addNoteAction("gh:acme:1", "Phone screen");
  expect(m.addApplicationNote).toHaveBeenCalledWith(USER, { jobId: "gh:acme:1", note: "Phone screen", actor: "user" });
  await setNextStepAction("gh:acme:1", null);
  expect(m.setNextStep).toHaveBeenCalledWith(USER, "gh:acme:1", null);
  expect(m.assertNotDeleted).toHaveBeenCalledTimes(3);
  // A stage move also revalidates the shortlist, which shows each tracked job's stage.
  expect(m.revalidatePath.mock.calls).toEqual([["/applications"], ["/shortlist"], ["/applications"], ["/applications"]]);
});

test("an erased account writes nothing", async () => {
  m.assertNotDeleted.mockRejectedValue(new Error("deleted"));
  await expect(setStageAction("gh:acme:1", "applied")).rejects.toThrow();
  await expect(addNoteAction("gh:acme:1", "x")).rejects.toThrow();
  await expect(setNextStepAction("gh:acme:1", "2026-12-01")).rejects.toThrow();
  expect(m.setApplicationStage).not.toHaveBeenCalled();
  expect(m.addApplicationNote).not.toHaveBeenCalled();
  expect(m.setNextStep).not.toHaveBeenCalled();
});
