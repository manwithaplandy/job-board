// Rough-order-of-magnitude (ROM) cost estimate for an admin-triggered company
// classification run. Pure module — no I/O, no serviceSql — so it is safe to import
// from BOTH the launch server action (est_cost stamped at insert time) and the
// client launcher (live estimate as the operator drags the cap / toggles SERP), and
// the two can never drift.
//
// The token counts are a fixed budget per company (the classification prompt is a
// compact facts-only extraction), so cost is linear in the company count. SERP adds
// a per-company Serper.dev query fee plus the extra prompt tokens the search snippet
// costs. Estimates are deliberately coarse — they gate operator spend, not billing.

export const CLASSIFICATION_MODELS = [
  "google/gemini-3.5-flash-lite", // default
  "google/gemini-3.6-flash",
  "deepseek/deepseek-v4-flash",
];

export const EST_INPUT_TOKENS = 1300;
export const EST_OUTPUT_TOKENS = 300;
export const EST_SERP_EXTRA_INPUT_TOKENS = 900;
export const SERP_QUERY_COST_USD = 0.001;

// 2026-07-21 openrouter.ai pricing (USD per token) — fallback when the live catalog
// is unavailable. Models absent here AND from the catalog get estimate=null.
export const FALLBACK_PRICING: Record<string, { prompt: number; completion: number }> = {
  "google/gemini-3.5-flash-lite": { prompt: 0.3e-6, completion: 2.5e-6 },
  "google/gemini-3.6-flash": { prompt: 1.5e-6, completion: 7.5e-6 },
};

/**
 * Estimated USD cost of classifying `count` companies with the given per-token
 * pricing. Returns `null` when pricing is unknown (neither live catalog nor
 * fallback), so the UI shows "estimate unavailable" rather than a fake $0. A
 * non-positive count is $0 (no work), even when pricing is unknown.
 */
export function estimateClassificationCost({ count, useSerp, pricing }: {
  count: number;
  useSerp: boolean;
  pricing: { prompt: number; completion: number } | null;
}): number | null {
  if (!pricing || count <= 0) return count <= 0 ? 0 : null;
  const perCall = EST_INPUT_TOKENS * pricing.prompt + EST_OUTPUT_TOKENS * pricing.completion;
  const serp = useSerp ? EST_SERP_EXTRA_INPUT_TOKENS * pricing.prompt + SERP_QUERY_COST_USD : 0;
  return count * (perCall + serp);
}
