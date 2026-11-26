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
 * input price. Counts are clamped so reads plus writes never exceed the input.
 */
export function callCostMicros(t: CallTokens, modelId: string, opts: { discountReads: boolean }): number {
  const input = Math.max(0, t.inputTokens);
  const write = Math.min(input, Math.max(0, t.cacheWriteTokens ?? 0));
  const read = Math.min(input - write, Math.max(0, t.cacheReadTokens ?? 0));
  const plain = input - write - read;
  const price = priceFor(modelId, input);
  const readRate = opts.discountReads ? CACHE_READ_MULTIPLIER : 1;
  return (
    (plain * price.input + write * price.input * CACHE_WRITE_MULTIPLIER + read * price.input * readRate + Math.max(0, t.outputTokens) * price.output) /
    1_000_000
  );
}
