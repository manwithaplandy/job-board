import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { upsertCoverLetterGoldenItem } from "./coverLetterGoldenDataset";
import type { CoverLetterGoldenItem } from "./rolefit/coverLetterScore";

const ITEM: CoverLetterGoldenItem = {
  id: "u1:j1", datasetName: "cover-letter-golden",
  input: {
    background: "b", candidateName: "A", instructions: null,
    job: { title: "Eng", company: "Acme", description: "d", about: null, requirements: [], skillGaps: [], redFlags: [] },
    model: "m",
  },
  expectedOutput: { cover_letter: "Dear…", comment: null },
  metadata: { cover_letter_trace_id: "tr1", model: "m", original_text: null, edited_at: "2026-07-07T00:00:00Z", source: "dashboard" },
};

describe("upsertCoverLetterGoldenItem", () => {
  const saved = { pub: process.env.LANGFUSE_PUBLIC_KEY, sec: process.env.LANGFUSE_SECRET_KEY };
  beforeEach(() => { delete process.env.LANGFUSE_PUBLIC_KEY; delete process.env.LANGFUSE_SECRET_KEY; });
  afterEach(() => { process.env.LANGFUSE_PUBLIC_KEY = saved.pub; process.env.LANGFUSE_SECRET_KEY = saved.sec; });

  it("is a no-op (resolves) when LangFuse keys are absent", async () => {
    await expect(upsertCoverLetterGoldenItem(ITEM)).resolves.toBeUndefined();
  });
});
