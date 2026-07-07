import { describe, test, expect } from "vitest";
import { renderCoverLetterJudgePrompt } from "./coverLetterJudgeRubric";

describe("renderCoverLetterJudgePrompt", () => {
  test("substitutes every placeholder and inserts values literally", () => {
    const out = renderCoverLetterJudgePrompt({
      candidateBackground: "raise of $$ and a $& bonus", // regex-special chars in the value
      jobTitle: "SRE", company: "Acme", jobDescription: "keep it up",
      coverLetter: "Dear team", goldenLetter: "Dear hiring manager",
    });
    expect(out).not.toMatch(/\{\{[a-z_]+\}\}/);          // no placeholder survives
    expect(out).toContain("raise of $$ and a $& bonus"); // literal — fails if string (not fn) replacers are used
  });
});
