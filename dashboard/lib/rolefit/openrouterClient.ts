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

// Per-attempt fetch timeout. We retry once on a stall, so two attempts plus the
// back-off must fit inside the calling route's `maxDuration` (120s for
// /api/resume): 2 × 55s + 2s ≈ 112s, leaving headroom. A healthy
// `deepseek-*-flash` response returns in a few seconds; a 55s wait only ever
// hits a stalled backend, which the retry routes around.
const PER_ATTEMPT_TIMEOUT_MS = 55_000;
// Total attempts (1 original + 1 retry). Keep ≥2-attempt cost within maxDuration.
const MAX_ATTEMPTS = 2;

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
      signal: AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS),
    }) as Promise<Response>;

  const retryDelay = args.retryDelayMs ?? 2000;
  // One retry within the route's time budget, covering BOTH failure shapes of a
  // flaky OpenRouter backend: a thrown timeout/abort/network error (the stalled
  // backend that returns 0 tokens after the full timeout — this REJECTS the
  // fetch, so the old status-only check missed it) and a resolved 429/5xx. A
  // fresh backend usually answers the retry. Response processing (JSON/parse)
  // stays outside this loop so a bad payload is never re-fetched.
  const fetchOk = async (): Promise<Response> => {
    for (let attempt = 1; ; attempt++) {
      let r: Response;
      try {
        r = await doPost();
      } catch (err) {
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((res) => setTimeout(res, retryDelay));
          continue;
        }
        throw err; // out of attempts — propagate (outer catch marks the span ERROR)
      }
      if (r.ok) return r;
      if ((r.status === 429 || r.status >= 500) && attempt < MAX_ATTEMPTS) {
        await errText(r); // consume the body so the connection is freed
        await new Promise((res) => setTimeout(res, retryDelay));
        continue;
      }
      // Non-retryable status (e.g. 400/402), or the final attempt failed.
      const txt = await errText(r);
      throw new Error(
        `OpenRouter ${args.label} request failed: ${r.status}${txt ? " " + txt : ""}`,
      );
    }
  };

  try {
    const res = await fetchOk();

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
      // usage: { include: true } (above) opts into OpenRouter cost accounting;
      // record it on the span so Langfuse shows real spend, not a model estimate.
      costDetails: json.usage?.cost != null ? { total: json.usage.cost } : undefined,
    });
    return parsed;
  } catch (e) {
    gen?.update({ level: "ERROR", statusMessage: e instanceof Error ? e.message : String(e) });
    throw e;
  } finally {
    gen?.end();
  }
}
