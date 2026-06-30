// dashboard/lib/rolefit/prefillClient.ts
import {
  PREFILL_JSON_SCHEMA, buildPrefillPrompt,
  type PrefillJob, type PrefillQuestion, type PrefilledAnswer,
} from "@/lib/rolefit/prefillSchema";
import type { ApplicationAnswers } from "@/lib/types";
import { callOpenRouterStructured } from "@/lib/rolefit/openrouterClient";

export const DEFAULT_PREFILL_MODEL = "anthropic/claude-haiku-4.5";

// Map a Greenhouse posting's questions to suggested answers. Only the answers
// the model returns with non-empty text are kept (blank = "couldn't answer").
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
  const { system, user } = buildPrefillPrompt({
    resumeText: args.resumeText,
    instructions: args.instructions,
    answers: args.answers,
    job: args.job,
    questions: args.questions,
  });
  return callOpenRouterStructured<PrefilledAnswer[]>({
    generationName: "greenhouse-prefill-generation",
    label: "prefill",
    model: args.model,
    apiKey: args.apiKey,
    system,
    user,
    responseFormat: PREFILL_JSON_SCHEMA,
    maxTokens: 2000,
    fetchImpl: args.fetchImpl,
    parse: (raw) => {
      const parsed = raw as { answers?: PrefilledAnswer[] };
      if (!Array.isArray(parsed.answers)) {
        throw new Error("OpenRouter prefill missing answers array");
      }
      return parsed.answers
        .filter((a) => a && typeof a.question === "string" && typeof a.answer === "string")
        .map((a) => ({ question: a.question.trim(), answer: a.answer.trim() }))
        .filter((a) => a.question && a.answer);
    },
  });
}
