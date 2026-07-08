import { describe, it, expect, vi, beforeEach } from "vitest";

const draftMock = vi.fn(async () => undefined);
vi.mock("@/lib/queries", () => ({
  upsertInstructionDraft: (...a: unknown[]) =>
    (draftMock as unknown as (...args: unknown[]) => unknown)(...a),
}));
vi.mock("@/lib/auth", () => ({ requireUserId: vi.fn(async () => "u1") }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveGenerationInstructions } from "@/app/actions/generationInstructions";

beforeEach(() => draftMock.mockReset());

describe("saveGenerationInstructions", () => {
  it("writes only the résumé leg when only résumé instructions are given", async () => {
    const res = await saveGenerationInstructions("j1", { resumeInstructions: "  Focus infra  " });
    expect(res).toEqual({ ok: true });
    expect(draftMock).toHaveBeenCalledOnce();
    expect(draftMock).toHaveBeenCalledWith("u1", "j1", "resume", "Focus infra"); // trimmed
  });

  it("writes only the cover leg when only cover instructions are given", async () => {
    await saveGenerationInstructions("j1", { coverLetterInstructions: "Mention launch" });
    expect(draftMock).toHaveBeenCalledOnce();
    expect(draftMock).toHaveBeenCalledWith("u1", "j1", "cover", "Mention launch");
  });

  it("preserves an empty saved value as '' (does NOT collapse to null)", async () => {
    await saveGenerationInstructions("j1", { resumeInstructions: "   " });
    expect(draftMock).toHaveBeenCalledWith("u1", "j1", "resume", "");
  });

  it("rejects over-cap input and writes nothing", async () => {
    await expect(
      saveGenerationInstructions("j1", { resumeInstructions: "x".repeat(4001) }),
    ).rejects.toThrow(/too long/i);
    expect(draftMock).not.toHaveBeenCalled();
  });

  it("no-ops (no write) when the patch has neither leg", async () => {
    const res = await saveGenerationInstructions("j1", {});
    expect(res).toEqual({ ok: true });
    expect(draftMock).not.toHaveBeenCalled();
  });
});
