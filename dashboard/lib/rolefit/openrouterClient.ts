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

/** Extract error body text safely — handles fakes without a text() method. */
async function errText(res: Response): Promise<string> {
  try {
    return typeof (res as unknown as { text: unknown }).text === "function"
      ? ((await (res as unknown as { text: () => Promise<string> }).text()) ?? "").slice(0, 300)
      : "";
  } catch { return ""; }
}

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
  /** Retry back-off in ms (default 2000; override in tests). */
  retryDelayMs?: number;
}): Promise<T> {
  const doFetch = args.fetchImpl ?? fetch;
  const gen = tracingEnabled()
    ? startObservation(
        args.generationName,
        { model: args.model, input: [{ role: "system", content: args.system }, { role: "user", content: args.user }] },
        { asType: "generation" },
      )
    : null;

  const body = JSON.stringify({
    model: args.model,
    max_tokens: args.maxTokens,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    response_format: args.responseFormat,
    usage: { include: true },
  });

  const doPost = (): Promise<Response> =>
    doFetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "job-board",
      },
      body,
      signal: AbortSignal.timeout(60_000),
    }) as Promise<Response>;

  try {
    let res = await doPost();

    // Retry once on 429 or 5xx.
    if (!res.ok && (res.status === 429 || res.status >= 500)) {
      await errText(res); // consume the body so the connection is freed
      await new Promise((r) => setTimeout(r, args.retryDelayMs ?? 2000));
      const res2 = await doPost();
      if (!res2.ok) {
        const txt2 = await errText(res2);
        throw new Error(
          `OpenRouter ${args.label} request failed: ${res2.status}${txt2 ? " " + txt2 : ""}`,
        );
      }
      res = res2;
    } else if (!res.ok) {
      const txt = await errText(res);
      throw new Error(
        `OpenRouter ${args.label} request failed: ${res.status}${txt ? " " + txt : ""}`,
      );
    }

    const json = (await (res as unknown as { json: () => Promise<unknown> }).json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
    };

    const choice = json.choices?.[0];
    if (choice?.finish_reason === "length") {
      throw new Error(`OpenRouter ${args.label} output truncated (max_tokens reached)`);
    }

    const content = choice?.message?.content;
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
