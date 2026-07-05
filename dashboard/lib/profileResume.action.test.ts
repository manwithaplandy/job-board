import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(async () => "u1"),
  getProfile: vi.fn(),
  upsertProfile: vi.fn(async (_userId: string, _data: Parameters<typeof import("@/lib/queries").upsertProfile>[1]) => {}),
  revalidatePath: vi.fn(),
  createClient: vi.fn(),
  assertNotDeleted: vi.fn(async (_userId: string) => {}),
}));

vi.mock("@/lib/auth", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/queries", () => ({
  getProfile: mocks.getProfile,
  upsertProfile: mocks.upsertProfile,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: mocks.assertNotDeleted }));

const existingProfile = {
  resume_text: "OLD EXTRACTED TEXT",
  resume_file_path: "u1/old.pdf",
  instructions: null,
};

const fd = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("saveProfileResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProfile.mockResolvedValue(existingProfile);
    mocks.assertNotDeleted.mockResolvedValue(undefined);
  });

  test("pasting new text (no file) stores the text and revalidates", async () => {
    const { saveProfileResume } = await import("@/app/actions/profile");
    await saveProfileResume(fd({ resume_text: "BRAND NEW PASTED TEXT" }));

    expect(mocks.upsertProfile).toHaveBeenCalledTimes(1);
    const [, arg] = mocks.upsertProfile.mock.calls[0];
    expect(arg.resumeText).toBe("BRAND NEW PASTED TEXT");
    // resume_text is now the single source of truth; the archived PDF path is
    // no longer a competing parse source, so a text edit alone leaves it as-is
    // (an upload replaces it; an empty file input never wipes it).
    expect(arg.resumeFilePath).toBe("u1/old.pdf");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  test("re-saving without a file preserves the archived PDF path", async () => {
    const { saveProfileResume } = await import("@/app/actions/profile");
    await saveProfileResume(fd({ resume_text: "OLD EXTRACTED TEXT" }));

    const [, arg] = mocks.upsertProfile.mock.calls[0];
    expect(arg.resumeFilePath).toBe("u1/old.pdf");
  });

  test("a tombstoned (deleted) user throws before any write — no storage upload, no upsert (M-RESURRECT-2)", async () => {
    mocks.assertNotDeleted.mockRejectedValue(new Error("account has been deleted"));
    const { saveProfileResume } = await import("@/app/actions/profile");

    // The shared guard throws (fail-loud); a stale-JWT session must not resurrect the
    // profile or a stored résumé, and the throw stops before getProfile/upload/upsert.
    await expect(saveProfileResume(fd({ resume_text: "STALE JWT WRITE" }))).rejects.toThrow(/deleted/);
    expect(mocks.createClient).not.toHaveBeenCalled(); // no storage client → no upload
    expect(mocks.upsertProfile).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
