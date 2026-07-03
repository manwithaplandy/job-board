import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(async () => "u1"),
  getProfile: vi.fn(),
  upsertProfile: vi.fn(async (_userId: string, _data: any) => {}),
  revalidatePath: vi.fn(),
  createClient: vi.fn(),
  extractPdfText: vi.fn(async () => ""),
}));

vi.mock("@/lib/auth", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/queries", () => ({
  getProfile: mocks.getProfile,
  upsertProfile: mocks.upsertProfile,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/pdf", () => ({ extractPdfText: mocks.extractPdfText }));

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
  });

  test("pasting new text (no file) clears resume_file_path and revalidates", async () => {
    const { saveProfileResume } = await import("@/app/actions/profile");
    await saveProfileResume(fd({ resume_text: "BRAND NEW PASTED TEXT" }));

    expect(mocks.upsertProfile).toHaveBeenCalledTimes(1);
    const [, arg] = mocks.upsertProfile.mock.calls[0];
    expect(arg.resumeText).toBe("BRAND NEW PASTED TEXT");
    expect(arg.resumeFilePath).toBeNull();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  test("re-saving unchanged text preserves the uploaded PDF path", async () => {
    const { saveProfileResume } = await import("@/app/actions/profile");
    await saveProfileResume(fd({ resume_text: "OLD EXTRACTED TEXT" }));

    const [, arg] = mocks.upsertProfile.mock.calls[0];
    expect(arg.resumeFilePath).toBe("u1/old.pdf");
  });
});
