// dashboard/lib/rolefit/prefillClient.ts
import {
  PREFILL_JSON_SCHEMA, buildPrefillPrompt,
  type PrefillJob, type PrefillQuestion, type PrefilledAnswer,
} from "@/lib/rolefit/prefillSchema";
import type { ApplicationAnswers } from "@/lib/types";
import { startObservation } from "@langfuse/tracing";
import { tracingEnabled } from "@/lib/observability";

export const DEFAULT_PREFILL_MODEL = "anthropic/claude-haiku-4.5";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

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
  const doFetch = args.fetchImpl ?? fetch;
  const { system, user } = buildPrefillPrompt({
    resumeText: args.resumeText,
    instructions: args.instructions,
    answers: args.answers,
    job: args.job,
    questions: args.questions,
  });
  const gen = tracingEnabled()
    ? startObservation(
        "greenhouse-prefill-generation",
        { model: args.model, input: [{ role: "system", content: system }, { role: "user", content: user }] },
        { asType: "generation" },
      )
    : null;
  try {
    const res = await doFetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "job-board",
      },
      body: JSON.stringify({
        model: args.model,
        max_tokens: 2000,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: PREFILL_JSON_SCHEMA,
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter prefill request failed: ${res.status}`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned no content");
    let parsed: { answers?: PrefilledAnswer[] };
    try { parsed = JSON.parse(content) as { answers?: PrefilledAnswer[] }; }
    catch { throw new Error("OpenRouter returned non-JSON prefill content"); }
    if (!Array.isArray(parsed.answers)) {
      throw new Error("OpenRouter prefill missing answers array");
    }
    const answers = parsed.answers
      .filter((a) => a && typeof a.question === "string" && typeof a.answer === "string")
      .map((a) => ({ question: a.question.trim(), answer: a.answer.trim() }))
      .filter((a) => a.question && a.answer);
    gen?.update({
      output: answers,
      usageDetails: json.usage
        ? { input: json.usage.prompt_tokens ?? 0, output: json.usage.completion_tokens ?? 0 }
        : undefined,
    });
    return answers;
  } catch (e) {
    gen?.update({ level: "ERROR", statusMessage: e instanceof Error ? e.message : String(e) });
    throw e;
  } finally {
    gen?.end();
  }
}
