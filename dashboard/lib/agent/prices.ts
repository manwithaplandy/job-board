// Model list prices for the agent (Task 0.7), in micro-dollars per million tokens. Pure, with
// one relative import of a pure file, so scripts/eval-agent.mjs can load it through Node's
// type stripping for the matrix dry run's cost estimate (Task 2.10). lib/agent/budget.ts
// re-exports PRICE_PER_MTOK_MICROS and uses it only when a step carries no billed cost.
//
// Anthropic first-party list prices (claude-api reference, cached 2026-11-03); the
// OpenRouter prices for these slugs are [Unverified] (Spike A did not run). Haiku 5.5 is
// priced at its long-prompt tier ($0.50 / $2.50 above 100K input tokens), because an
// estimate that runs high only stops a user early, while one that runs low lets spend pass
// the ceiling.
import { AGENT_EVAL_MODELS } from "./config.ts";

export type Price = { input: number; output: number };

const MODEL_PRICES: Record<(typeof AGENT_EVAL_MODELS)[number], Price> = {
  "anthropic/claude-sonnet-5.5": { input: 2_000_000, output: 10_000_000 },
  "anthropic/claude-haiku-5.5": { input: 500_000, output: 2_500_000 },
};

function mostExpensive(prices: Price[]): Price {
  return prices.reduce((a, b) => (b.input + b.output > a.input + a.output ? b : a));
}

/** Every AGENT_EVAL_MODELS entry, plus `default` (the most expensive of them) for anything else. */
export const PRICE_PER_MTOK_MICROS: Record<string, Price> & { default: Price } = {
  ...MODEL_PRICES,
  default: mostExpensive(Object.values(MODEL_PRICES)),
};

/** Own-property lookup, so "constructor" or "__proto__" is an unknown model, not a price. */
export function priceFor(modelId: string): Price {
  return Object.hasOwn(PRICE_PER_MTOK_MICROS, modelId) ? PRICE_PER_MTOK_MICROS[modelId] : PRICE_PER_MTOK_MICROS.default;
}
