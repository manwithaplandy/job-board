// dashboard/lib/rolefit/greenhouseAnswers.test.ts
import { describe, expect, test } from "vitest";
import { mergeGreenhouseQuestions } from "@/lib/rolefit/greenhouseAnswers";
import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";

const GH: GreenhouseQuestions = {
  questions: [
    { label: "Resume", required: true, fields: [{ name: "resume", type: "input_file", options: [] }] },
    { label: "Why us?", required: false, fields: [{ name: "q1", type: "textarea", options: [] }] },
    { label: "Work authorized?", required: true, fields: [{ name: "q2", type: "multi_value_single_select", options: [] }] },
  ],
};

describe("mergeGreenhouseQuestions", () => {
  test("renders BOTH answered and still-unanswered questions, keeping required flags", () => {
    const rows = mergeGreenhouseQuestions(GH, [{ question: "Why us?", answer: "I admire your devtools." }]);
    // File question dropped; both remaining questions surfaced.
    expect(rows.map((r) => r.label)).toEqual(["Why us?", "Work authorized?"]);
    expect(rows[0]).toMatchObject({ label: "Why us?", required: false, answer: "I admire your devtools." });
    // The unanswered REQUIRED question stays visible with a null answer + required flag.
    expect(rows[1]).toMatchObject({ label: "Work authorized?", required: true, answer: null });
  });

  test("excludes file-upload questions entirely", () => {
    const rows = mergeGreenhouseQuestions(GH, null);
    expect(rows.some((r) => r.label === "Resume")).toBe(false);
    expect(rows.every((r) => r.answer === null)).toBe(true);
  });

  test("trims answers and treats blank answers as unanswered", () => {
    const rows = mergeGreenhouseQuestions(GH, [{ question: "Why us?", answer: "   " }]);
    expect(rows.find((r) => r.label === "Why us?")?.answer).toBeNull();
  });

  test("preserves orphan answers that don't match any question", () => {
    const rows = mergeGreenhouseQuestions(GH, [{ question: "Extra question", answer: "Some answer" }]);
    const orphan = rows.find((r) => r.label === "Extra question");
    expect(orphan).toMatchObject({ required: false, answer: "Some answer" });
    // The posting's own questions still render too.
    expect(rows.map((r) => r.label)).toContain("Work authorized?");
  });

  test("returns [] when there are no questions and no answers", () => {
    expect(mergeGreenhouseQuestions(null, null)).toEqual([]);
    expect(mergeGreenhouseQuestions({ questions: [] }, [])).toEqual([]);
  });

  test("drops answers that match no option (option validation)", () => {
    const questions: GreenhouseQuestions = { questions: [{ label: "Can you start immediately?", required: false, fields: [{ name: "q1", type: "select", options: [{ label: "Yes" }, { label: "No" }] }] }] };
    const answers = [{ question: "Can you start immediately?", answer: "Yes, definitely" }];
    const merged = mergeGreenhouseQuestions(questions, answers);
    expect(merged[0].answer).toBeNull();
  });

  test("keeps case-insensitive exact option match", () => {
    const questions: GreenhouseQuestions = { questions: [{ label: "Are you authorized?", required: true, fields: [{ name: "q1", type: "select", options: [{ label: "Yes" }, { label: "No" }] }] }] };
    const answers = [{ question: "Are you authorized?", answer: "yes" }];
    const merged = mergeGreenhouseQuestions(questions, answers);
    expect(merged[0].answer).toBe("Yes");
  });
});
