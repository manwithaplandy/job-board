// Prompt caching for the agent's model calls (PR J7). Behaviour-neutral apart from cost:
// it adds Anthropic cache breakpoints to the request and fixes the byte order of tool
// results, and changes nothing the model is told.
//
// How a breakpoint reaches Anthropic: @openrouter/ai-sdk-provider 3.1.0 (the pinned
// version; node_modules/@openrouter/ai-sdk-provider/dist/index.js,
// convertToOpenRouterChatMessages) turns `providerOptions.openrouter.cacheControl` (or
// cache_control, or the same two under `anthropic`: getCacheControl, index.js:3679-3684)
// into `cache_control` on the OpenRouter request:
//   - a system message: on its one text block (index.js:3690-3701);
//   - a user message: on its text block when it has one text part (the message's own
//     option, else the part's: index.js:3705-3716), else on each part that carries one,
//     with the message's own option on its last text part (index.js:3720-3733);
//   - a tool message: each tool result becomes its own OpenRouter `role: "tool"` message,
//     whose content is a plain string, with `cache_control` as a field of that message,
//     from the tool message's own option, else the result's (index.js:3892-3902; line 3901).
//     There is no content block to carry it, so whether OpenRouter moves that field onto
//     Anthropic's tool_result block is [Unverified]; if it does not, the tail breakpoint
//     on a tool result is simply not cached, at no extra cost;
//   - an assistant message: as a field of the message (index.js:3886);
// and OpenRouter passes it to Anthropic. A call-level providerOptions.openrouter.cacheControl
// becomes a top-level cache_control (index.js:4357-4358). The provider sends tools
// without cache_control (its getArgs maps only name, description and parameters), but
// Anthropic renders tools, then system, then messages, so a breakpoint on the system
// message caches the tool schemas and the instructions together.
//
// Two breakpoints at most, inside Anthropic's limit of 4 (MAX_CACHE_BREAKPOINTS):
//   1. the last system message: the stable prefix (tools + instructions);
//   2. with `tail` (the agent loop): the last user or tool message of each call, so the
//      next step of the turn reads the whole conversation so far from the cache and pays
//      full price only for what it adds. The breakpoint moves forward with each call, as
//      in Anthropic's multi-turn example. A re-render (rerender.ts) sends no tail: its
//      data block differs per surface, and is reused only by a repair call.
// The minimum cacheable prefix is 512 tokens for Sonnet 5.5 and Haiku 5.5 (OpenRouter's
// docs); a shorter prefix is simply not cached, at no extra cost. Writes use the default
// 5-minute TTL (1.25x the input price; lib/agent/prices.ts).
//
// Silent invalidators (the prefix audit): the instructions hold no time or id
// (context.ts; loop.test.ts pins two turns byte-identical), the tool set is fixed per
// thread (variant, approval secret, interactive) and built in a fixed key order, and the
// provider already sorts tool-call arguments (deterministicStringify). Tool results were
// the one gap: a tool's output reaches the model in the key order the tool built it in
// during the turn that ran it, but in Postgres jsonb key order when the thread is read
// back for a later turn (agent_messages.parts is jsonb), so the same history differed in
// bytes between the turn that made it and the next one. canonicalToolResults writes every
// JSON tool result in jsonb's own key order (shorter keys first, then bytewise), which is
// exactly what a later turn reads back: the content is unchanged, only the order of keys
// in the turn that ran the tool. What still changes the prefix, by design: the history
// window sliding past its oldest message, a new thread summary, outputs that storage
// redacts (get_job descriptions, read_document text; messageCodec.ts), and a new profile
// or memo in the instructions.
import { wrapLanguageModel, type LanguageModel, type LanguageModelMiddleware } from "ai";
import type { LanguageModelV4Message, LanguageModelV4Prompt, SharedV4ProviderOptions } from "@ai-sdk/provider";

/** Anthropic's limit on cache breakpoints in one request. */
export const MAX_CACHE_BREAKPOINTS = 4;

/** The provider option one breakpoint carries (an ephemeral breakpoint: the 5-minute TTL). */
export const CACHE_BREAKPOINT = { openrouter: { cacheControl: { type: "ephemeral" } } } as const satisfies SharedV4ProviderOptions;

export interface CacheOptions {
  /** Also mark the last user or tool message of the call (the growing conversation). */
  tail: boolean;
}

function withBreakpoint(providerOptions: SharedV4ProviderOptions | undefined): SharedV4ProviderOptions {
  return { ...providerOptions, openrouter: { ...providerOptions?.openrouter, ...CACHE_BREAKPOINT.openrouter } };
}

const encoder = new TextEncoder();

/** Postgres jsonb's object key order: shorter keys first (in UTF-8 bytes), then bytewise. */
export function jsonbKeyOrder(a: string, b: string): number {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  if (x.length !== y.length) return x.length - y.length;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

function sortJsonb(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonb);
  if (value !== null && typeof value === "object") {
    // Object.fromEntries defines each key as an own property, so a "__proto__" key from
    // JSON.parse stays a key (an assignment would set the prototype and drop it).
    return Object.fromEntries(
      Object.keys(value)
        .sort(jsonbKeyOrder)
        .map((key) => [key, sortJsonb((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/**
 * `value` as plain JSON (what JSON.stringify would send: toJSON applied, undefined dropped)
 * with every object's keys in jsonb order. A value JSON cannot represent comes back as is.
 */
export function canonicalJson(value: unknown): unknown {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? value : sortJsonb(JSON.parse(text));
  } catch {
    return value;
  }
}

function canonicalToolMessage(m: Extract<LanguageModelV4Message, { role: "tool" }>): LanguageModelV4Message {
  return {
    ...m,
    content: m.content.map((part) => {
      if (part.type !== "tool-result") return part;
      const output = part.output;
      if (output.type !== "json" && output.type !== "error-json") return part;
      return { ...part, output: { ...output, value: canonicalJson(output.value) as typeof output.value } };
    }),
  };
}

/** Marks the last cacheable part of a user or tool message; null when it has none. */
function markTail(m: LanguageModelV4Message): LanguageModelV4Message | null {
  if (m.role === "user") {
    if (m.content.length === 0) return null;
    const last = m.content.length - 1;
    return { ...m, content: m.content.map((p, i) => (i === last ? { ...p, providerOptions: withBreakpoint(p.providerOptions) } : p)) };
  }
  if (m.role === "tool") {
    // Each tool result is sent as its own OpenRouter tool message, with the breakpoint as a
    // field of that message (index.js:3892-3902, the header above); an approval response
    // is not sent. So the last result's message carries the one tail breakpoint.
    let last = -1;
    m.content.forEach((p, i) => {
      if (p.type === "tool-result") last = i;
    });
    if (last < 0) return null;
    return { ...m, content: m.content.map((p, i) => (i === last ? { ...p, providerOptions: withBreakpoint(p.providerOptions) } : p)) };
  }
  return null;
}

/**
 * The prompt with its cache breakpoints (the system message and, with `tail`, the last user
 * or tool message) and every JSON tool result in jsonb key order. Never mutates `prompt`.
 * Breakpoints are set on message parts, never on a tool message as a whole: the provider
 * copies a tool message's own option onto every tool result in it, which could pass 4.
 */
export function withCacheBreakpoints(prompt: LanguageModelV4Prompt, opts: CacheOptions): LanguageModelV4Prompt {
  const out = prompt.map((m) => (m.role === "tool" ? canonicalToolMessage(m) : m));
  let system = -1;
  out.forEach((m, i) => {
    if (m.role === "system") system = i;
  });
  if (system >= 0) {
    const m = out[system] as Extract<LanguageModelV4Message, { role: "system" }>;
    out[system] = { ...m, providerOptions: withBreakpoint(m.providerOptions) };
  }
  if (opts.tail) {
    for (let i = out.length - 1; i > system; i--) {
      const marked = markTail(out[i]);
      if (marked) {
        out[i] = marked;
        break;
      }
    }
  }
  return out;
}

/** The spellings the provider reads a breakpoint from, in its order (getCacheControl, index.js:3679-3684). */
const CACHE_CONTROL_KEYS = [
  ["openrouter", "cacheControl"],
  ["openrouter", "cache_control"],
  ["anthropic", "cacheControl"],
  ["anthropic", "cache_control"],
] as const;

/** The provider's getCacheControl: the first spelling whose value is not null or undefined. */
function cacheControlOf(o: SharedV4ProviderOptions | undefined): unknown {
  for (const [ns, key] of CACHE_CONTROL_KEYS) {
    const v = o?.[ns]?.[key];
    if (v !== null && v !== undefined) return v;
  }
  return undefined;
}

/** A user file part the provider sends by http(s) URL, as a file block without cache_control (index.js:3778-3789). */
function dropsCacheControl(p: Extract<LanguageModelV4Message, { role: "user" }>["content"][number]): boolean {
  if (p.type !== "file" || /^(image|video|audio)\//.test(p.mediaType)) return false;
  return p.data.type === "url" && (p.data.url.protocol === "http:" || p.data.url.protocol === "https:");
}

/**
 * Counts the breakpoints the provider would send for `prompt` (and the call-level
 * `providerOptions`, when given), the way @openrouter/ai-sdk-provider 3.1.0 builds them
 * (the header above): every alias spelling counts; a tool message's own option counts once
 * per tool result it holds; a user message's own option counts on its last text part
 * unless that part has its own. Tests, and the guard in the middleware.
 */
export function countCacheBreakpoints(prompt: LanguageModelV4Prompt, callProviderOptions?: SharedV4ProviderOptions): number {
  let n = 0;
  for (const m of prompt) {
    switch (m.role) {
      case "system":
        if (cacheControlOf(m.providerOptions)) n += 1;
        break;
      case "user": {
        if (m.content.length === 1 && m.content[0].type === "text") {
          if (cacheControlOf(m.providerOptions) ?? cacheControlOf(m.content[0].providerOptions)) n += 1;
          break;
        }
        const own = cacheControlOf(m.providerOptions);
        let lastText = -1;
        m.content.forEach((p, i) => {
          if (p.type === "text") lastText = i;
        });
        m.content.forEach((p, i) => {
          const part = cacheControlOf(p.providerOptions);
          const cc = p.type === "text" ? (part ?? (i === lastText ? own : undefined)) : part;
          if (cc && !dropsCacheControl(p)) n += 1;
        });
        break;
      }
      case "assistant":
        if (cacheControlOf(m.providerOptions) !== undefined) n += 1;
        break;
      case "tool":
        for (const p of m.content) {
          if (p.type === "tool-approval-response") continue;
          if ((cacheControlOf(m.providerOptions) ?? cacheControlOf(p.providerOptions)) !== undefined) n += 1;
        }
        break;
    }
  }
  const call = callProviderOptions?.openrouter;
  if (call && ((call.cacheControl !== null && call.cacheControl !== undefined) || (call.cache_control !== null && call.cache_control !== undefined))) n += 1;
  return n;
}

export function cacheBreakpointMiddleware(opts: CacheOptions): LanguageModelMiddleware {
  return {
    transformParams: async ({ params }) => {
      const prompt = withCacheBreakpoints(params.prompt, opts);
      // Never more breakpoints than Anthropic takes: send the prompt as it came instead.
      return { ...params, prompt: countCacheBreakpoints(prompt, params.providerOptions) <= MAX_CACHE_BREAKPOINTS ? prompt : params.prompt };
    },
  };
}

/**
 * `model` with prompt caching on every call. A model given only by id (a gateway string)
 * is returned as is: production always passes an instance (provider.ts agentModel).
 */
export function withPromptCaching(model: LanguageModel, opts: CacheOptions): LanguageModel {
  if (typeof model === "string") return model;
  return wrapLanguageModel({ model, middleware: cacheBreakpointMiddleware(opts) });
}
