// Model list prices for the agent (Task 0.7), in micro-dollars per million tokens. Pure, with
// one relative import of a pure file, so scripts/eval-agent.mjs can load it through Node's
// type stripping for the dry runs' cost estimates (Task 2.10). lib/agent/budget.ts
// re-exports PRICE_PER_MTOK_MICROS and prices a step here only when it carries no billed cost.
//
// Anthropic first-party list prices (claude-api reference, cached 2026-11-03); the
// OpenRouter prices for these slugs are [Unverified] (Spike A did not run):
//   - Sonnet 5.5: $2 in / $10 out per million tokens.
//   - Haiku 5.5: $0.10 in / $0.50 out for a call whose prompt is at most 100K input tokens,
//     $0.50 / $2.50 above that. The tier is chosen per call from that call's own input
//     tokens (cached ones included), so a ~15k-token agent step is priced at the short-prompt
//     tier (PR J7; before it every Haiku call was priced at the long tier, 5x high).
//
// Prompt caching (PR J7): a cache write costs 1.25x the base input price (the 5-minute TTL,
// the only one lib/agent/cache.ts asks for; the 1-hour TTL would be 2x) and a cache read
// 0.1x. Anthropic's page lists Sonnet 5.5 and Opus 5.5 reads at 0.05x; what OpenRouter bills
// for those is unverified, so every estimate here uses 0.1x, the conservative figure.
import { AGENT_EVAL_MODELS } from "./config.ts";

export type Price = { input: number; output: number };

/** One price band: it applies to a call with at most `upToInputTokens` input tokens (null: no limit). */
export type PriceTier = Price & { upToInputTokens: number | null };

/** Haiku 5.5's short-prompt tier ends here (input tokens of one call, cached ones included). */
export const HAIKU_SHORT_PROMPT_MAX_TOKENS = 100_000;

/** A cache write's price as a multiple of the base input price (5-minute TTL). */
export const CACHE_WRITE_MULTIPLIER = 1.25;
/** A cache read's price as a multiple of the base input price: 0.1x, conservative (see above). */
export const CACHE_READ_MULTIPLIER = 0.1;

/** Each model's tiers, cheapest (shortest prompt) first; the last tier has no limit. */
export const MODEL_PRICE_TIERS: Record<(typeof AGENT_EVAL_MODELS)[number], readonly PriceTier[]> = {
  "anthropic/claude-sonnet-5.5": [{ upToInputTokens: null, input: 2_000_000, output: 10_000_000 }],
  "anthropic/claude-haiku-5.5": [
    { upToInputTokens: HAIKU_SHORT_PROMPT_MAX_TOKENS, input: 100_000, output: 500_000 },
    { upToInputTokens: null, input: 500_000, output: 2_500_000 },
  ],
};

function topTier(tiers: readonly PriceTier[]): Price {
  const t = tiers[tiers.length - 1];
  return { input: t.input, output: t.output };
}

function mostExpensive(prices: Price[]): Price {
  return prices.reduce((a, b) => (b.input + b.output > a.input + a.output ? b : a));
}

const TOP_PRICES: Record<string, Price> = Object.fromEntries(
  Object.entries(MODEL_PRICE_TIERS).map(([model, tiers]) => [model, topTier(tiers)]),
);

/**
 * Every AGENT_EVAL_MODELS entry at its dearest tier (the price of a call with an unlimited
 * prompt), plus `default` (the most expensive of them) for anything else. A per-call price
 * is priceFor(model, inputTokens).
 */
export const PRICE_PER_MTOK_MICROS: Record<string, Price> & { default: Price } = {
  ...TOP_PRICES,
  default: mostExpensive(Object.values(TOP_PRICES)),
};

/**
 * The price of one call of `modelId` with `inputTokens` input tokens (cached ones included).
 * Own-property lookup, so "constructor" or "__proto__" is an unknown model, not a price. An
 * unknown model takes `default`: the dearer of the two eval models, not a worst case (a model
 * dearer than Sonnet 5.5 is priced low here). With no input count, a tiered model takes its
 * dearest tier.
 */
export function priceFor(modelId: string, inputTokens: number = Number.POSITIVE_INFINITY): Price {
  if (!Object.hasOwn(MODEL_PRICE_TIERS, modelId)) return PRICE_PER_MTOK_MICROS.default;
  const tiers = MODEL_PRICE_TIERS[modelId as keyof typeof MODEL_PRICE_TIERS];
  const tier = tiers.find((t) => t.upToInputTokens === null || inputTokens <= t.upToInputTokens) ?? tiers[tiers.length - 1];
  return { input: tier.input, output: tier.output };
}

/** Whether the table has the model's own row (`default` is not a model). The paid eval modes run only priced models. */
export function isPriced(modelId: string): boolean {
  return Object.hasOwn(MODEL_PRICE_TIERS, modelId);
}

// ---------------------------------------------------------------------------
// One call's worst case (PR J7 fix round 1). The eval budget (evals/budget.ts beforeStep)
// lets a call start only when the spend so far plus this worst case fits under the dollar
// cap, so no capped run can pass its cap on list prices.
// ---------------------------------------------------------------------------

/**
 * The output bound of a call that names no maxOutputTokens: the most any priced model may
 * return in one call (claude-api reference, cached 2026-11-03: Haiku 5.5 and Sonnet 5.5
 * both allow up to 128K output tokens). Every eval call names its own (AGENT_LIMITS 4,000;
 * the judge 2,000), so this is the fallback only.
 */
export const MODEL_MAX_OUTPUT_TOKENS = 128_000;

/**
 * Tokens added to a prompt's serialized size for what the provider wraps around it (the
 * role and turn markers, the tool-use system prompt the provider adds when tools are sent).
 */
export const PROMPT_TOKEN_OVERHEAD = 2_048;

/** A file the prompt names by URL or by provider reference: its size is unknown here. */
function hasUnboundedPart(value: unknown, seen: Set<object> = new Set()): boolean {
  if (value instanceof URL) return true;
  if (typeof value !== "object" || value === null || ArrayBuffer.isView(value)) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const o = value as Record<string, unknown>;
  if ((o.type === "url" && "url" in o) || (o.type === "reference" && "reference" in o)) return true;
  for (const v of Array.isArray(value) ? value : Object.values(o)) if (hasUnboundedPart(v, seen)) return true;
  return false;
}

/**
 * An upper bound on the input tokens of a call that sends `prompt` and `tools`: the UTF-8
 * size of their JSON (every token stands for at least one byte of what it encodes; raw
 * bytes are counted as their base64 length) plus PROMPT_TOKEN_OVERHEAD. Infinity when it
 * cannot be bounded: a file given by URL or provider reference, or a prompt that does not
 * serialize. Far above the real count (about 4 bytes a token), which is the point: it never
 * prices a call low.
 */
export function inputTokenBound(prompt: unknown, tools?: unknown): number {
  if (hasUnboundedPart(prompt) || hasUnboundedPart(tools)) return Number.POSITIVE_INFINITY;
  let raw = 0;
  let json: string | undefined;
  try {
    json = JSON.stringify([prompt, tools ?? null], (_key, v: unknown) => {
      if (v instanceof Uint8Array) {
        raw += Math.ceil(v.byteLength / 3) * 4;
        return "";
      }
      return v;
    });
  } catch {
    return Number.POSITIVE_INFINITY;
  }
  if (typeof json !== "string") return Number.POSITIVE_INFINITY;
  return new TextEncoder().encode(json).length + raw + PROMPT_TOKEN_OVERHEAD;
}

/**
 * The most one call of `modelId` can cost at list price, in micro-dollars: every input
 * token (up to `inputTokensBound`) at the dearest input price of any tier that could apply
 * (a tier applies when its band starts at or below the bound), and written to the cache
 * (CACHE_WRITE_MULTIPLIER, dearer than a plain or read token), plus `maxOutputTokens`
 * (MODEL_MAX_OUTPUT_TOKENS when the call names none) at the dearest output price of those
 * tiers. Infinity for an unbounded or malformed bound. An unknown model takes `default`;
 * the eval modes run only priced models.
 */
export function worstCaseCallMicros(modelId: string, a: { inputTokensBound: number; maxOutputTokens?: number }): number {
  const bound = a.inputTokensBound;
  const output = a.maxOutputTokens ?? MODEL_MAX_OUTPUT_TOKENS;
  if (!(bound >= 0) || !Number.isFinite(bound) || !(output >= 0) || !Number.isFinite(output)) return Number.POSITIVE_INFINITY;
  const tiers: readonly PriceTier[] = isPriced(modelId)
    ? MODEL_PRICE_TIERS[modelId as keyof typeof MODEL_PRICE_TIERS]
    : [{ upToInputTokens: null, ...PRICE_PER_MTOK_MICROS.default }];
  let inputPrice = 0;
  let outputPrice = 0;
  let bandStart = 0;
  for (const t of tiers) {
    if (bandStart > bound) break;
    inputPrice = Math.max(inputPrice, t.input);
    outputPrice = Math.max(outputPrice, t.output);
    if (t.upToInputTokens === null) break;
    bandStart = t.upToInputTokens + 1;
  }
  return (bound * inputPrice * CACHE_WRITE_MULTIPLIER + output * outputPrice) / 1_000_000;
}

/** One call's tokens. `inputTokens` counts every input token, cache reads and writes included. */
export interface CallTokens {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/**
 * One call's list-price cost in micro-dollars (a float; callers round). Cache writes cost
 * CACHE_WRITE_MULTIPLIER times the input price. Cache reads cost CACHE_READ_MULTIPLIER times
 * it only with `discountReads` (the dry runs' estimates); without it (budget.ts's fallback
 * for a step with no billed cost, which must never price a step low) a read costs the full
 * input price.
 *
 * The input is never taken as less than the cache reads plus writes (PR J7 fix round 1): a
 * route that reports its input without the cached tokens would otherwise have its writes
 * clamped down and the call priced low. So input = max(inputTokens, reads + writes), every
 * write is priced, reads are what is left of the input after the writes, and the tier is
 * chosen from that input.
 */
export function callCostMicros(t: CallTokens, modelId: string, opts: { discountReads: boolean }): number {
  const writeIn = Math.max(0, t.cacheWriteTokens ?? 0);
  const readIn = Math.max(0, t.cacheReadTokens ?? 0);
  const input = Math.max(0, t.inputTokens, readIn + writeIn);
  const write = writeIn;
  const read = Math.min(input - write, readIn);
  const plain = input - write - read;
  const price = priceFor(modelId, input);
  const readRate = opts.discountReads ? CACHE_READ_MULTIPLIER : 1;
  return (
    (plain * price.input + write * price.input * CACHE_WRITE_MULTIPLIER + read * price.input * readRate + Math.max(0, t.outputTokens) * price.output) /
    1_000_000
  );
}
