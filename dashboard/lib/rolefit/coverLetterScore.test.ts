import { describe, expect, test } from "vitest";
import {
  COVER_LETTER_GOLDEN_DATASET_NAME,
  coverLetterOverall,
  buildCoverLetterGoldenItem,
  type CoverLetterGoldenInput,
} from "@/lib/rolefit/coverLetterScore";

const INPUT: CoverLetterGoldenInput = {
  background: "Alex Morgan, React engineer",
  candidateName: "Alex Morgan",
  instructions: "Mention the design-system work",
  job: {
    title: "Frontend Engineer", company: "Cobalt", description: "Build apps.",
    about: "Devtools.", requirements: [{ text: "React", met: true }],
    skillGaps: ["rust"], redFlags: ["hours"],
  },
  model: "test/model",
};

describe("coverLetterOverall", () => {
  test("weights grounding 0.5 / fidelity 0.3 / jd_relevance 0.2, one decimal", () => {
    expect(coverLetterOverall(5, 4, 3)).toBe(4.3); // 2.5 + 1.2 + 0.6
    expect(coverLetterOverall(1, 1, 1)).toBe(1);
    expect(coverLetterOverall(3, 4, 5)).toBe(3.7); // 1.5 + 1.2 + 1.0
  });
});

describe("buildCoverLetterGoldenItem", () => {
  test("id, dataset, expectedOutput = the edited letter, metadata carries the trace join", () => {
    const item = buildCoverLetterGoldenItem({
      userId: "u1", jobId: "j1", input: INPUT,
      editedText: "Dear Hiring Manager,\n\nEdited body.\n\nSincerely,\nAlex Morgan\n",
      comment: "tightened paragraph 2", traceId: "tr-9", model: "test/model",
      originalText: "Dear Hiring Manager,\n\nOriginal body.\n\nSincerely,\nAlex Morgan\n",
      editedAt: "2026-07-07T00:00:00.000Z",
    });
    expect(item.id).toBe("u1:j1");
    expect(item.datasetName).toBe(COVER_LETTER_GOLDEN_DATASET_NAME);
    expect(item.input).toEqual(INPUT);
    expect(item.expectedOutput).toEqual({
      cover_letter: "Dear Hiring Manager,\n\nEdited body.\n\nSincerely,\nAlex Morgan\n",
      comment: "tightened paragraph 2",
    });
    expect(item.metadata).toEqual({
      cover_letter_trace_id: "tr-9",
      model: "test/model",
      original_text: "Dear Hiring Manager,\n\nOriginal body.\n\nSincerely,\nAlex Morgan\n",
      edited_at: "2026-07-07T00:00:00.000Z",
      source: "dashboard",
    });
  });
});
