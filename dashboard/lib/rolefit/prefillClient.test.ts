// dashboard/lib/rolefit/prefillClient.test.ts
import { describe, expect, test, vi } from "vitest";
import { DEFAULT_PREFILL_MODEL, generatePrefilledAnswers } from "@/lib/rolefit/prefillClient";
import { toPrefillQuestions } from "@/lib/rolefit/prefillSchema";
import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";

function fakeFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({ ok, status: ok ? 200 : 502, json: async () => payload })) as unknown as typeof fetch;
}

const GH: GreenhouseQuestions = {
  questions: [
    { label: "Resume", required: true, fields: [{ name: "resume", type: "input_file", options: [] }] },
    { label: "Why us?", required: false, fields: [{ name: "q1", type: "textarea", options: [] }] },
    {
      label: "Work authorized?",
      required: true,
      fields: [{ name: "q2", type: "multi_value_single_select", options: [{ value: "0", label: "Yes" }, { value: "1", label: "No" }] }],
    },
  ],
};

describe("toPrefillQuestions", () => {
  test("drops file-upload questions and flattens options to labels", () => {
    const out = toPrefillQuestions(GH);
    expect(out.map((q) => q.label)).toEqual(["Why us?", "Work authorized?"]);
    expect(out[1].options).toEqual(["Yes", "No"]);
    expect(out[1].required).toBe(true);
  });
});

describe("generatePrefilledAnswers", () => {
  const args = {
    resumeText: "Alex Morgan, React engineer",
    instructions: null,
    answers: null,
    job: { title: "Frontend Engineer", company: "Cobalt", description: "Build apps." },
    questions: toPrefillQuestions(GH),
    model: "test/model",
    apiKey: "sk-test",
  };

  test("posts schema + messages and returns trimmed non-empty answers", async () => {
    const payload = {
      choices: [{ message: { content: JSON.stringify({
        answers: [
          { question: "Why us?", answer: "  I admire your devtools.  " },
          { question: "Work authorized?", answer: "Yes" },
          { question: "Empty", answer: "   " }, // dropped — blank answer
        ],
      }) } }],
    };
    const f = fakeFetch(payload);
    const out = await generatePrefilledAnswers({ ...args, fetchImpl: f });
    expect(out).toEqual([
      { question: "Why us?", answer: "I admire your devtools." },
      { question: "Work authorized?", answer: "Yes" },
    ]);
    const call = (f as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.model).toBe("test/model");
    expect(body.response_format.type).toBe("json_schema");
    expect(JSON.stringify(body.messages)).toContain("Work authorized?");
  });

  test("throws on non-ok response", async () => {
    await expect(generatePrefilledAnswers({ ...args, fetchImpl: fakeFetch({}, false) })).rejects.toThrow();
  });

  test("throws when content is not valid JSON", async () => {
    const f = fakeFetch({ choices: [{ message: { content: "not json" } }] });
    await expect(generatePrefilledAnswers({ ...args, fetchImpl: f })).rejects.toThrow();
  });

  test("throws when the answers array is missing", async () => {
    const f = fakeFetch({ choices: [{ message: { content: JSON.stringify({ foo: 1 }) } }] });
    await expect(generatePrefilledAnswers({ ...args, fetchImpl: f })).rejects.toThrow();
  });

  test("always disables reasoning (bounded extraction leg)", async () => {
    const payload = {
      choices: [{ message: { content: JSON.stringify({
        answers: [{ question: "Why us?", answer: "I admire your devtools." }],
      }) } }],
    };
    const f = fakeFetch(payload);
    await generatePrefilledAnswers({ ...args, fetchImpl: f });
    const body = JSON.parse(((f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1]).body as string);
    expect(body.reasoning).toEqual({ enabled: false });
  });
});

test("DEFAULT_PREFILL_MODEL is claude haiku", () => {
  expect(DEFAULT_PREFILL_MODEL).toBe("anthropic/claude-haiku-4.5");
});
