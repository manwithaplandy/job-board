import { describe, it, expect, vi, beforeEach } from "vitest";

const sqlMock = vi.fn();
vi.mock("@/lib/db", () => {
  const tx = Object.assign((...a: unknown[]) => sqlMock(...a), { json: (v: unknown) => v });
  return { withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx) };
});
vi.mock("@/lib/auth", () => ({
  requireUserId: vi.fn(async () => "u1"),
}));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const upsertMock = vi.fn(async () => undefined);
vi.mock("@/lib/coverLetterGoldenDataset", () => ({
  upsertCoverLetterGoldenItem: (...a: unknown[]) => (upsertMock as unknown as (...args: unknown[]) => unknown)(...a),
}));

import { saveCoverLetterEdit, deleteCoverLetterEdit } from "@/app/actions/coverLetterEdits";

const LETTER_JSON = {
  greeting: "Dear Hiring Manager,", paragraphs: ["Original body."],
  closing: "Sincerely,", signature: "Ada",
};
const SRC_ROW = {
  cover_letter_json: LETTER_JSON, cover_letter_trace_id: "tr-1",
  cover_letter_instructions: "C focus", title: "Eng", company_name: "Acme",
  description: "jd", about: "about", requirements: [{ text: "5y", met: true }],
  skill_gaps: ["rust"], red_flags: [], resume_text: "bg", full_name: "Ada",
  model_cover: "m-cover",
};

beforeEach(() => {
  sqlMock.mockReset();
  upsertMock.mockReset();
  upsertMock.mockResolvedValue(undefined);
});

describe("saveCoverLetterEdit", () => {
  it("rejects empty / whitespace-only text", async () => {
    await expect(saveCoverLetterEdit("j1", "   \n ")).rejects.toThrow(/empty/i);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("rejects over-cap text", async () => {
    await expect(saveCoverLetterEdit("j1", "x".repeat(20_001))).rejects.toThrow(/too long/i);
  });

  it("throws when no package exists for the job", async () => {
    sqlMock.mockResolvedValueOnce([]); // SELECT → none
    await expect(saveCoverLetterEdit("j1", "Edited.")).rejects.toThrow(/no cover letter/i);
  });

  it("persists the edit and pushes the golden item: expectedOutput = the edit", async () => {
    sqlMock.mockResolvedValueOnce([SRC_ROW]).mockResolvedValueOnce(undefined); // SELECT, then upsert
    const res = await saveCoverLetterEdit("j1", "Dear Hiring Manager,\n\nEdited body.", "note");
    expect(res).toEqual({ ok: true, langfuseSynced: true });
    expect(upsertMock).toHaveBeenCalledOnce();
    const item = (upsertMock.mock.calls[0] as unknown[])[0] as {
      id: string; expectedOutput: Record<string, unknown>;
      input: { instructions: string | null; job: { company: string } };
      metadata: Record<string, unknown>;
    };
    expect(item.id).toBe("u1:j1");
    expect(item.expectedOutput.cover_letter).toBe("Dear Hiring Manager,\n\nEdited body.");
    expect(item.input.instructions).toBe("C focus");
    expect(item.input.job.company).toBe("Acme");
    expect(item.metadata.cover_letter_trace_id).toBe("tr-1");
    // original_text is the COMPOSED text of the stored structured letter.
    expect(item.metadata.original_text).toContain("Original body.");
  });

  it("returns langfuseSynced=false when the push throws (DB already committed)", async () => {
    sqlMock.mockResolvedValueOnce([SRC_ROW]).mockResolvedValueOnce(undefined);
    upsertMock.mockRejectedValueOnce(new Error("langfuse down"));
    const res = await saveCoverLetterEdit("j1", "Edited.");
    expect(res).toEqual({ ok: true, langfuseSynced: false });
  });

  it("any authenticated user's edit pushes to the shared dataset", async () => {
    sqlMock.mockResolvedValueOnce([SRC_ROW]).mockResolvedValueOnce(undefined);
    const res = await saveCoverLetterEdit("j1", "Edited.");
    expect(sqlMock).toHaveBeenCalledTimes(2); // SELECT + INSERT still ran
    expect(upsertMock).toHaveBeenCalledOnce();
    expect(res).toEqual({ ok: true, langfuseSynced: true });
  });

  it("a malformed stored letter yields original_text=null but the edit still saves", async () => {
    sqlMock.mockResolvedValueOnce([{ ...SRC_ROW, cover_letter_json: "not-an-object" }]).mockResolvedValueOnce(undefined);
    const res = await saveCoverLetterEdit("j1", "Edited.");
    expect(res.ok).toBe(true);
    const item = (upsertMock.mock.calls[0] as unknown[])[0] as { metadata: Record<string, unknown> };
    expect(item.metadata.original_text).toBeNull();
  });
});

describe("deleteCoverLetterEdit", () => {
  it("issues the owner-scoped DELETE and resolves", async () => {
    sqlMock.mockResolvedValueOnce(undefined);
    await expect(deleteCoverLetterEdit("j1")).resolves.toEqual({ ok: true });
    expect(sqlMock).toHaveBeenCalledOnce();
  });
});
