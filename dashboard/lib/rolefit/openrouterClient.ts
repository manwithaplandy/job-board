// dashboard/lib/rolefit/openrouterClient.ts
//
// Shared OpenRouter structured-output transport for the résumé / cover-letter /
// prefill clients. Each of those used to copy this same ~50-line block (chat
// completions POST, Langfuse generation span, content + JSON parse, usage
// extraction, error/finally). They now supply the prompt, schema, model, and a
// `parse` step that validates the raw JSON into the typed result, and share this.
import { startObservation } from "@langfuse/tracing";
import { tracingEnabled } from "@/lib/observability";

export const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function callOpenRouterStructured<T>(args: {
  // Langfuse generation name, e.g. "resume-generation".
  generationName: string;
  // Used in the request-failed / non-JSON error messages, e.g. "résumé".
  label: string;
  model: string;
  apiKey: string;
  system: string;
  user: string;
  responseFormat: unknown;
  maxTokens: number;
  // Validate + shape the parsed JSON into the typed result; throw on a bad payload.
  parse: (raw: unknown) => T;
  fetchImpl?: typeof fetch;
}): Promise<T> {
  const doFetch = args.fetchImpl ?? fetch;
  const gen = tracingEnabled()
    ? startObservation(
        args.generationName,
        { model: args.model, input: [{ role: "system", content: args.system }, { role: "user", content: args.user }] },
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
        max_tokens: args.maxTokens,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
        response_format: args.responseFormat,
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter ${args.label} request failed: ${res.status}`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned no content");
    let raw: unknown;
    try { raw = JSON.parse(content); }
    catch { throw new Error(`OpenRouter returned non-JSON ${args.label} content`); }
    const parsed = args.parse(raw);
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
