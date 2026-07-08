// dashboard/lib/rolefit/greenhouseQuestions.test.ts
import { describe, expect, test, vi } from "vitest";
import {
  parseGreenhouseQuestions,
  fetchGreenhouseQuestions,
} from "@/lib/rolefit/greenhouseQuestions";

// Trimmed real-shape payload from boards-api.greenhouse.io/.../jobs/{id}?questions=true
const FIXTURE = {
  id: 4011,
  title: "Senior Frontend Engineer",
  questions: [
    { label: "First Name", required: true, fields: [{ name: "first_name", type: "input_text", values: [] }] },
    { label: "Last Name", required: true, fields: [{ name: "last_name", type: "input_text", values: [] }] },
    { label: "Resume/CV", required: true, fields: [{ name: "resume", type: "input_file", values: [] }] },
    {
      label: "Why do you want to work here?",
      required: false,
      fields: [{ name: "question_1001", type: "textarea", values: [] }],
    },
    {
      label: "Are you authorized to work in the US?",
      required: true,
      fields: [
        {
          name: "question_1002",
          type: "multi_value_single_select",
          // Greenhouse encodes option values as numbers.
          values: [
            { value: 0, label: "Yes" },
            { value: 1, label: "No" },
          ],
        },
      ],
    },
  ],
};

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({
    ok,
    status: ok ? 200 : 404,
    json: async () => payload,
  })) as unknown as typeof fetch;
}

describe("parseGreenhouseQuestions", () => {
  test("parses labels, required flags, field types, and select options", () => {
    const out = parseGreenhouseQuestions(FIXTURE);
    expect(out).not.toBeNull();
    expect(out!.questions).toHaveLength(5);

    const first = out!.questions[0];
    expect(first.label).toBe("First Name");
    expect(first.required).toBe(true);
    expect(first.fields[0]).toEqual({ name: "first_name", type: "input_text", options: [] });

    const select = out!.questions[4];
    expect(select.label).toBe("Are you authorized to work in the US?");
    expect(select.fields[0].type).toBe("multi_value_single_select");
    // Numeric option values normalize to strings.
    expect(select.fields[0].options).toEqual([
      { value: "0", label: "Yes" },
      { value: "1", label: "No" },
    ]);
  });

  test("returns null when there is no questions array", () => {
    expect(parseGreenhouseQuestions({ id: 1, title: "x" })).toBeNull();
    expect(parseGreenhouseQuestions(null)).toBeNull();
    expect(parseGreenhouseQuestions("nope")).toBeNull();
  });

  test("skips malformed questions and options without crashing", () => {
    const out = parseGreenhouseQuestions({
      questions: [
        null,
        { required: true }, // no label → skipped
        { label: "Pronouns", fields: [{ name: "q", type: "select", values: [{ value: 5 }, { label: "They/Them" }] }] },
      ],
    });
    expect(out!.questions).toHaveLength(1);
    expect(out!.questions[0].label).toBe("Pronouns");
    expect(out!.questions[0].required).toBe(false);
    // The option missing a label is dropped; the one missing a value keeps value "".
    expect(out!.questions[0].fields[0].options).toEqual([{ value: "", label: "They/Them" }]);
  });
});

describe("fetchGreenhouseQuestions", () => {
  test("builds the boards-api URL and returns the parsed schema", async () => {
    const f = fakeFetch(FIXTURE);
    const out = await fetchGreenhouseQuestions({ token: "acme", externalId: "4011", fetchImpl: f });
    expect(out!.questions).toHaveLength(5);
    const call = (f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(call[0]).toBe("https://boards-api.greenhouse.io/v1/boards/acme/jobs/4011?questions=true");
  });

  test("returns null on a non-ok response", async () => {
    expect(await fetchGreenhouseQuestions({ token: "acme", externalId: "4011", fetchImpl: fakeFetch({}, false) })).toBeNull();
  });

  test("returns null when fetch throws", async () => {
    const f = vi.fn(async () => { throw new Error("network"); }) as unknown as typeof fetch;
    expect(await fetchGreenhouseQuestions({ token: "acme", externalId: "4011", fetchImpl: f })).toBeNull();
  });

  test("returns null when the schema has no questions", async () => {
    expect(await fetchGreenhouseQuestions({ token: "acme", externalId: "4011", fetchImpl: fakeFetch({ questions: [] }) })).toBeNull();
  });

  test("returns null without fetching when token or id is missing", async () => {
    const f = fakeFetch(FIXTURE);
    expect(await fetchGreenhouseQuestions({ token: "", externalId: "4011", fetchImpl: f })).toBeNull();
    expect(await fetchGreenhouseQuestions({ token: "acme", externalId: "  ", fetchImpl: f })).toBeNull();
    expect((f as unknown as { mock: { calls: unknown[][] } }).mock.calls).toHaveLength(0);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

// Drift guard: the SAME fixture the Python parser test asserts (tests/fixtures/
// greenhouse_questions.json) must parse to the SAME canonical shape here. If the two
// parsers diverge, one of these tests breaks. Path reaches out of dashboard/ to the repo root.
const SHARED_FIXTURE = JSON.parse(
  readFileSync(join(__dirname, "../../../tests/fixtures/greenhouse_questions.json"), "utf8"),
);

describe("parseGreenhouseQuestions — shared fixture parity", () => {
  test("parses the shared Python fixture to the canonical shape", () => {
    expect(parseGreenhouseQuestions(SHARED_FIXTURE)).toEqual({
      questions: [
        { label: "Why do you want to work here?", required: true,
          fields: [{ name: "question_0", type: "textarea", options: [] }] },
        { label: "Are you authorized to work in the US?", required: true,
          fields: [{ name: "question_1", type: "multi_value_single_select",
                     options: [{ value: "0", label: "Yes" }, { value: "1", label: "No" }] }] },
        { label: "Cover Letter", required: false,
          fields: [{ name: "cover_letter", type: "input_file", options: [] }] },
      ],
    });
  });
});
