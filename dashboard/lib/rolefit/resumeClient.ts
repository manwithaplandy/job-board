// dashboard/lib/rolefit/resumeClient.ts
import {
  TAILORED_RESUME_SCHEMA,
  buildResumePrompt,
  assembleResume,
  type TailoredResume,
  type TailoredContent,
} from "@/lib/rolefit/resumeSchema";
import { parseProfile, yearsOfExperience } from "@/lib/rolefit/parseProfile";
import { startObservation } from "@langfuse/tracing";
import { tracingEnabled } from "@/lib/observability";

export const DEFAULT_RESUME_MODEL = "anthropic/claude-haiku-4.5";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function generateResume(args: {
  resumeText: string;
  pdfBytes?: Uint8Array | null;
  job: { title: string; company: string; description: string | null };
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<TailoredResume> {
  const doFetch = args.fetchImpl ?? fetch;
  // Deterministically extract the fixed fields; the LLM only tailors the rest.
  const profile = await parseProfile({ pdfBytes: args.pdfBytes ?? null, text: args.resumeText });
  const tenureYears = yearsOfExperience(profile, Date.now());
  const { system, user } = buildResumePrompt({ profile, resumeText: args.resumeText, job: args.job, tenureYears });
  const gen = tracingEnabled()
    ? startObservation(
        "resume-generation",
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
        max_tokens: 4000,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: TAILORED_RESUME_SCHEMA,
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter résumé request failed: ${res.status}`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned no content");
    let tailored: TailoredContent;
    try { tailored = JSON.parse(content) as TailoredContent; }
    catch { throw new Error("OpenRouter returned non-JSON résumé content"); }
    if (!tailored.headline || !Array.isArray(tailored.experience)) {
      throw new Error("OpenRouter résumé missing required fields");
    }
    const resume = assembleResume(profile, tailored);
    gen?.update({
      output: resume,
      usageDetails: json.usage
        ? { input: json.usage.prompt_tokens ?? 0, output: json.usage.completion_tokens ?? 0 }
        : undefined,
    });
    return resume;
  } catch (e) {
    gen?.update({ level: "ERROR", statusMessage: e instanceof Error ? e.message : String(e) });
    throw e;
  } finally {
    gen?.end();
  }
}
