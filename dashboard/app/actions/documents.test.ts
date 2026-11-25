// The documents page's actions (plan Task 1.11): the user comes from the session, an
// erased account is refused, refusals come back as messages, and the pages that show
// the résumé are revalidated only after a write.
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => {
  class ResumeInputError extends Error {}
  return {
    ResumeInputError,
    requireUserId: vi.fn(),
    assertNotDeleted: vi.fn(),
    revalidatePath: vi.fn(),
    deleteDocument: vi.fn(),
    setResumeFromDocument: vi.fn(),
    restoreResumeVersion: vi.fn(),
  };
});
vi.mock("@/lib/auth", () => ({ requireUserId: m.requireUserId }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: m.assertNotDeleted }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/workspaces/documents", () => ({ deleteDocument: m.deleteDocument }));
vi.mock("@/lib/workspaces/resumeVersions", () => ({
  ResumeInputError: m.ResumeInputError,
  setResumeFromDocument: m.setResumeFromDocument,
  restoreResumeVersion: m.restoreResumeVersion,
}));

import { deleteDocumentAction, restoreResumeVersionAction, useAsResumeAction as replaceResume } from "@/app/actions/documents";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DOC = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  m.requireUserId.mockResolvedValue(USER);
  m.assertNotDeleted.mockResolvedValue(undefined);
  m.deleteDocument.mockResolvedValue(undefined);
  m.setResumeFromDocument.mockResolvedValue({ displacedVersion: 1, actionId: null });
  m.restoreResumeVersion.mockResolvedValue({ displacedVersion: 2 });
});

test("each action writes as the session user, as the user, then revalidates", async () => {
  expect(await replaceResume(DOC)).toEqual({ ok: true });
  expect(m.setResumeFromDocument).toHaveBeenCalledWith(USER, { documentId: DOC, actor: "user" });
  expect(await restoreResumeVersionAction(1)).toEqual({ ok: true });
  expect(m.restoreResumeVersion).toHaveBeenCalledWith(USER, 1);
  expect(await deleteDocumentAction(DOC)).toEqual({ ok: true });
  expect(m.deleteDocument).toHaveBeenCalledWith(USER, DOC);
  const paths = m.revalidatePath.mock.calls.map(([p]) => p);
  expect(paths).toContain("/documents");
  expect(paths).toContain("/profile/resume");
});

test("refusals come back as messages; unexpected errors do not leak", async () => {
  m.setResumeFromDocument.mockRejectedValueOnce(new m.ResumeInputError("That file had no readable text, so it cannot be your résumé."));
  expect(await replaceResume(DOC)).toEqual({ ok: false, message: "That file had no readable text, so it cannot be your résumé." });
  m.deleteDocument.mockRejectedValueOnce(new Error("storage remove failed: bucket xyz"));
  const out = await deleteDocumentAction(DOC);
  expect(out.ok).toBe(false);
  if (!out.ok) expect(out.message).not.toContain("bucket");
  expect(m.revalidatePath).not.toHaveBeenCalled();
});

test("an erased account writes nothing", async () => {
  m.assertNotDeleted.mockRejectedValue(new Error("deleted"));
  await expect(replaceResume(DOC)).rejects.toThrow();
  await expect(restoreResumeVersionAction(1)).rejects.toThrow();
  await expect(deleteDocumentAction(DOC)).rejects.toThrow();
  expect(m.setResumeFromDocument).not.toHaveBeenCalled();
  expect(m.restoreResumeVersion).not.toHaveBeenCalled();
  expect(m.deleteDocument).not.toHaveBeenCalled();
});
