// dashboard/lib/rolefit/prefillClient.ts
import {
  PREFILL_JSON_SCHEMA, buildPrefillPrompt,
  type PrefillJob, type PrefillQuestion, type PrefilledAnswer,
} from "@/lib/rolefit/prefillSchema";
import type { ApplicationAnswers } from "@/lib/types";
import { callOpenRouterStructured, REASONING_SAFE_MAX_TOKENS } from "@/lib/rolefit/openrouterClient";
import { parsePrefilledAnswers } from "@/lib/rolefit/packageCodec";

export const DEFAULT_PREFILL_MODEL = "anthropic/claude-haiku-4.5";

// EEO questions are answered deterministically from the profile — never via LLM.
// This is more accurate (no hallucination risk), faster, and avoids token cost.
const EEO_PATTERNS: { pattern: RegExp; field: keyof ApplicationAnswers }[] = [
  { pattern: /gender/i, field: "eeo_gender" },
  { pattern: /race|ethnicity/i, field: "eeo_race" },
  { pattern: /veteran/i, field: "eeo_veteran" },
  { pattern: /disability/i, field: "eeo_disability" },
];

// Map a Greenhouse posting's questions to suggested answers. EEO questions are
// answered deterministically from the profile. Only the remaining LLM answers
// with non-empty text are kept (blank = "couldn't answer").
export async function generatePrefilledAnswers(args: {
  resumeText: string;
  instructions: string | null;
  answers: ApplicationAnswers | null;
  job: PrefillJob;
  questions: PrefillQuestion[];
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<PrefilledAnswer[]> {
  const eeoAnswers: PrefilledAnswer[] = [];
  const remainingQuestions = args.questions.filter((q) => {
    for (const { pattern, field } of EEO_PATTERNS) {
      if (pattern.test(q.label) && args.answers?.[field]) {
        const value = args.answers[field] as string;
        // Only use the saved value if it matches one of the allowed options (or is free-text).
        if (q.options.length === 0 || q.options.some((o) => o.toLowerCase() === value.toLowerCase())) {
          eeoAnswers.push({ question: q.label, answer: value });
          return false;
        }
      }
    }
    return true;
  });

  if (remainingQuestions.length === 0) return eeoAnswers;

  const { system, user } = buildPrefillPrompt({
    resumeText: args.resumeText,
    instructions: args.instructions,
    answers: args.answers,
    job: args.job,
    questions: remainingQuestions,
  });

  const llmAnswers = await callOpenRouterStructured<PrefilledAnswer[]>({
    generationName: "greenhouse-prefill-generation",
    label: "prefill",
    model: args.model,
    apiKey: args.apiKey,
    system,
    user,
    responseFormat: PREFILL_JSON_SCHEMA,
    maxTokens: REASONING_SAFE_MAX_TOKENS,
    // Always off: this leg is bounded to 45s by the prepare route and reasoning
    // only risks the deadline; DEFAULT_PREFILL_MODEL supports the param, so
    // {enabled:false} is safe (never omit — the model is fixed, not user-picked).
    reasoningEffort: "off",
    fetchImpl: args.fetchImpl,
    parse: (raw) => {
      const parsed = raw as { answers?: unknown };
      const answers = parsePrefilledAnswers(parsed.answers);
      if (!answers) throw new Error("OpenRouter prefill missing answers array");
      return answers;
    },
  });

  return [...eeoAnswers, ...llmAnswers];
}
