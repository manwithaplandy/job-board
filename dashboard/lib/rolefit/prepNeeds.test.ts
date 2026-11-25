// What a full prep writes for a posting: the rule startApplicationPrep charges by.
import { expect, test } from "vitest";
import { prefillQuestionsFor, prepNeeds } from "@/lib/rolefit/prepNeeds";

const field = (name: string, type: string) => ({ name, type, options: [] });

test("a cover-letter question means a cover letter; it is never also a prefill question", () => {
  const questions = { questions: [{ label: "Cover Letter", required: false, fields: [field("cover_letter", "input_file")] }] };
  expect(prepNeeds(questions)).toEqual({ cover: true, answers: false });
  expect(prefillQuestionsFor(questions)).toEqual([]);
});

test("an answerable question means answers; a file-only question does not", () => {
  const questions = {
    questions: [
      { label: "Why us?", required: true, fields: [field("q0", "textarea")] },
      { label: "Resume", required: true, fields: [field("resume", "input_file")] },
    ],
  };
  expect(prepNeeds(questions)).toEqual({ cover: false, answers: true });
  expect(prefillQuestionsFor(questions).map((q) => q.label)).toEqual(["Why us?"]);
});

test("no questions stored means neither", () => {
  expect(prepNeeds(null)).toEqual({ cover: false, answers: false });
  expect(prepNeeds({ questions: [] })).toEqual({ cover: false, answers: false });
});
