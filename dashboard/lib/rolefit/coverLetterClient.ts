// dashboard/lib/rolefit/coverLetterClient.ts
import {
  COVER_LETTER_JSON_SCHEMA, buildCoverLetterPrompt,
  type CoverLetterJob, type TailoredCoverLetter,
} from "@/lib/rolefit/coverLetterSchema";
import { startObservation } from "@langfuse/tracing";
import { tracingEnabled } from "@/lib/observability";

export const DEFAULT_COVER_MODEL = "anthropic/claude-haiku-4.5";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function generateCoverLetter(args: {
  resumeText: string;
  candidateName: string | null;
  instructions: string | null;
  job: CoverLetterJob;
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<TailoredCoverLetter> {
  const doFetch = args.fetchImpl ?? fetch;
  const { system, user } = buildCoverLetterPrompt({
    resumeText: args.resumeText,
    candidateName: args.candidateName,
    instructions: args.instructions,
    job: args.job,
  });
  const gen = tracingEnabled()
    ? startObservation(
        "cover-letter-generation",
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
        response_format: COVER_LETTER_JSON_SCHEMA,
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter cover letter request failed: ${res.status}`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned no content");
    let parsed: TailoredCoverLetter;
    try { parsed = JSON.parse(content) as TailoredCoverLetter; }
    catch { throw new Error("OpenRouter returned non-JSON cover letter content"); }
    if (!parsed.greeting || !Array.isArray(parsed.paragraphs)) {
      throw new Error("OpenRouter cover letter missing required fields");
    }
    gen?.update({
      output: parsed,
      usageDetails: json.usage
        ? { input: json.usage.prompt_tokens ?? 0, output: json.usage.completion_tokens ?? 0 }
        : undefined,
    });
    return parsed;
  } catch (e) {
    gen?.update({ level: "ERROR", statusMessage: e instanceof Error ? e.message : String(e) });
    throw e;
  } finally {
    gen?.end();
  }
}
