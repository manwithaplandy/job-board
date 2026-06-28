// dashboard/lib/rolefit/resumeClient.ts
import { RESUME_JSON_SCHEMA, buildResumePrompt, type TailoredResume } from "@/lib/rolefit/resumeSchema";
import { startObservation } from "@langfuse/tracing";
import { tracingEnabled } from "@/lib/observability";

export const DEFAULT_RESUME_MODEL = "anthropic/claude-haiku-4.5";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function generateResume(args: {
  resumeText: string;
  job: { title: string; company: string; description: string | null };
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<TailoredResume> {
  const doFetch = args.fetchImpl ?? fetch;
  const { system, user } = buildResumePrompt({ resumeText: args.resumeText, job: args.job });
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
        response_format: RESUME_JSON_SCHEMA,
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter résumé request failed: ${res.status}`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned no content");
    let parsed: TailoredResume;
    try { parsed = JSON.parse(content) as TailoredResume; }
    catch { throw new Error("OpenRouter returned non-JSON résumé content"); }
    if (!parsed.name || !Array.isArray(parsed.experience)) {
      throw new Error("OpenRouter résumé missing required fields");
    }
    gen?.update({
      output: parsed,
      usageDetails: json.usage
        ? { input: json.usage.prompt_tokens ?? 0, output: json.usage.completion_tokens ?? 0 }
        : undefined,
    });
    return parsed;
  } catch (e) {
    gen?.update({ level: "ERROR", statusMessage: (e as Error).message });
    throw e;
  } finally {
    gen?.end();
  }
}
