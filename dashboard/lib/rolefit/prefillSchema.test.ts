import { describe, expect, test } from "vitest";
import { buildPrefillPrompt } from "@/lib/rolefit/prefillSchema";
import { ENGLISH_ONLY_INSTRUCTION } from "@/lib/rolefit/promptPolicy";

describe("buildPrefillPrompt", () => {
  const out = buildPrefillPrompt({
    resumeText: "Alex Morgan — Senior Engineer, React/TS",
    instructions: null,
    answers: null,
    job: { title: "Frontend Engineer", company: "Cobalt", description: "Build React apps." },
    questions: [
      { label: "Why do you want this role?", type: "input_text", required: true, options: [] },
    ],
  });

  test("includes the application question", () => {
    expect(out.user).toContain("Why do you want this role?");
  });

  test("system prompt mandates English output", () => {
    expect(out.system).toContain(ENGLISH_ONLY_INSTRUCTION);
  });
});
