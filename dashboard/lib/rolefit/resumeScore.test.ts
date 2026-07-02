import { describe, it, expect } from "vitest";
import { resumeOverall, buildResumeGoldenItem, RESUME_GOLDEN_DATASET_NAME } from "./resumeScore";

describe("resumeOverall", () => {
  it("weights grounding 0.7 / jd 0.3, one decimal", () => {
    expect(resumeOverall(5, 5)).toBe(5);
    expect(resumeOverall(5, 1)).toBe(3.8); // 0.7*5 + 0.3*1 = 3.8
    expect(resumeOverall(1, 5)).toBe(2.2); // 0.7*1 + 0.3*5 = 2.2
  });
});

describe("buildResumeGoldenItem", () => {
  it("builds a deterministic golden item", () => {
    const item = buildResumeGoldenItem({
      userId: "u1", jobId: "j1",
      input: { title: "Eng", company: "Acme", description: "desc", background: "bg", model: "m" },
      form: { grounding: 4, jdRelevance: 3, comment: "solid" },
      traceId: "tr1", model: "m", scoredAt: "2026-07-02T00:00:00Z",
    });
    expect(item.id).toBe("u1:j1");
    expect(item.datasetName).toBe(RESUME_GOLDEN_DATASET_NAME);
    expect(item.input.title).toBe("Eng");
    expect(item.expectedOutput).toEqual({ grounding: 4, jd_relevance: 3, comment: "solid", overall: 3.7 });
    expect(item.metadata).toEqual({ resume_trace_id: "tr1", model: "m", scored_at: "2026-07-02T00:00:00Z", source: "dashboard" });
  });
});
