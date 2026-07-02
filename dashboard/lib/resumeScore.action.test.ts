import { describe, it, expect, vi, beforeEach } from "vitest";

const sqlMock = vi.fn();
vi.mock("@/lib/db", () => ({ sql: Object.assign((...a: any[]) => sqlMock.apply(null, a), { json: (v: unknown) => v }) }));
vi.mock("@/lib/auth", () => ({ requireUserId: vi.fn(async () => "u1") }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const upsertMock = vi.fn(async () => undefined);
vi.mock("@/lib/resumeGoldenDataset", () => ({ upsertResumeGoldenItem: (...a: unknown[]) => (upsertMock as unknown as (...args: unknown[]) => unknown)(...a) }));

import { saveResumeScore } from "@/app/actions/resumeScores";

beforeEach(() => { sqlMock.mockReset(); upsertMock.mockReset(); upsertMock.mockResolvedValue(undefined); });

describe("saveResumeScore", () => {
  it("throws when no résumé package exists for the job", async () => {
    sqlMock.mockResolvedValueOnce([]);        // SELECT package/inputs → none
    await expect(saveResumeScore("j1", { grounding: 4, jdRelevance: 3, comment: null }))
      .rejects.toThrow(/no résumé/i);
  });

  it("writes the row, pushes the golden item, returns langfuseSynced=true", async () => {
    sqlMock
      .mockResolvedValueOnce([{ resume_json: { name: "A" }, resume_trace_id: "tr1", title: "Eng",
                                company_name: "Acme", description: "d", resume_text: "bg", model_resume: "m" }]) // SELECT
      .mockResolvedValueOnce(undefined); // INSERT ... ON CONFLICT
    const res = await saveResumeScore("j1", { grounding: 5, jdRelevance: 4, comment: "great" });
    expect(res).toEqual({ ok: true, langfuseSynced: true });
    expect(upsertMock).toHaveBeenCalledOnce();
    const item = (upsertMock.mock.calls[0] as unknown[])[0] as { id: string; expectedOutput: Record<string, unknown> };
    expect(item.id).toBe("u1:j1");
    expect(item.expectedOutput.overall).toBe(4.7); // 0.7*5 + 0.3*4
  });

  it("returns langfuseSynced=false when the push throws (DB already committed)", async () => {
    sqlMock
      .mockResolvedValueOnce([{ resume_json: { name: "A" }, resume_trace_id: null, title: "Eng",
                                company_name: "Acme", description: "d", resume_text: "bg", model_resume: "m" }])
      .mockResolvedValueOnce(undefined);
    upsertMock.mockRejectedValueOnce(new Error("langfuse down"));
    const res = await saveResumeScore("j1", { grounding: 3, jdRelevance: 3, comment: null });
    expect(res).toEqual({ ok: true, langfuseSynced: false });
  });
});
