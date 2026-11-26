// The judge's model (plan Task 2.13): a different family from both AGENT_EVAL_MODELS, so
// neither variant's author grades its own work. Called through the same OpenRouter path
// and the same fail-closed caps as the eval (judge profile in budget.ts). It is not in
// PRICE_PER_MTOK_MICROS (no price for it has been checked against a source), so the dry
// run estimates it at the default price, Sonnet 5.5's list price. Its real price may be
// higher or lower; the judge's reported-cost cap is what bounds a run, and a call that
// reports no cost stops it (cost_unknown). Pure.
export const AGENT_JUDGE_MODEL = "openai/gpt-5.5";
