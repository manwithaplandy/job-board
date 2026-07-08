import { describe, expect, test } from "vitest";
import { hasCoverLetterQuestion, stripCoverLetterQuestions } from "./coverLetterQuestion";
import type { GreenhouseQuestions } from "./greenhouseQuestions";

const q = (label: string, name: string): GreenhouseQuestions["questions"][number] => ({
  label, required: false, fields: [{ name, type: "input_file", options: [] }],
});

describe("hasCoverLetterQuestion", () => {
  test("true when a field name is cover_letter", () => {
    expect(hasCoverLetterQuestion({ questions: [q("Attach a letter", "cover_letter")] })).toBe(true);
  });
  test("true when a label matches /cover letter/i (spacing/casing tolerant)", () => {
    expect(hasCoverLetterQuestion({ questions: [q("Cover Letter", "custom_1")] })).toBe(true);
    expect(hasCoverLetterQuestion({ questions: [q("Your coverletter", "custom_2")] })).toBe(true);
  });
  test("false for essay prompts (not cover letters)", () => {
    expect(hasCoverLetterQuestion({ questions: [q("Why do you want to work here?", "question_0")] })).toBe(false);
  });
  test("false for null / empty", () => {
    expect(hasCoverLetterQuestion(null)).toBe(false);
    expect(hasCoverLetterQuestion({ questions: [] })).toBe(false);
  });
});

describe("stripCoverLetterQuestions", () => {
  test("removes only the cover-letter question, keeps the rest", () => {
    const gh: GreenhouseQuestions = {
      questions: [q("Why us?", "question_0"), q("Cover Letter", "cover_letter")],
    };
    expect(stripCoverLetterQuestions(gh)).toEqual({ questions: [q("Why us?", "question_0")] });
  });
  test("null → empty questions", () => {
    expect(stripCoverLetterQuestions(null)).toEqual({ questions: [] });
  });
});
