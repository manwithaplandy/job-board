import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { upsertResumeGoldenItem } from "./resumeGoldenDataset";
import type { ResumeGoldenItem } from "./rolefit/resumeScore";

const ITEM: ResumeGoldenItem = {
  id: "u1:j1", datasetName: "resume-golden",
  input: { title: "Eng", company: "Acme", description: "d", background: "b", model: "m" },
  expectedOutput: { grounding: 4, jd_relevance: 3, comment: null, overall: 3.7 },
  metadata: { resume_trace_id: "tr1", model: "m", scored_at: "2026-07-02T00:00:00Z", source: "dashboard" },
};

describe("upsertResumeGoldenItem", () => {
  const saved = { pub: process.env.LANGFUSE_PUBLIC_KEY, sec: process.env.LANGFUSE_SECRET_KEY };
  beforeEach(() => { delete process.env.LANGFUSE_PUBLIC_KEY; delete process.env.LANGFUSE_SECRET_KEY; });
  afterEach(() => { process.env.LANGFUSE_PUBLIC_KEY = saved.pub; process.env.LANGFUSE_SECRET_KEY = saved.sec; });

  it("is a no-op (resolves) when LangFuse keys are absent", async () => {
    await expect(upsertResumeGoldenItem(ITEM)).resolves.toBeUndefined();
  });
});
