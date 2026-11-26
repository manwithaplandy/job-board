// The judge's model (plan Task 2.13): a different family from both AGENT_EVAL_MODELS, so
// neither variant's author grades its own work. Called through the same OpenRouter path
// and the same fail-closed caps as the eval (judge profile in budget.ts). It is not in
// PRICE_PER_MTOK_MICROS, so estimates price it at the default (dearest) price. Pure.
export const AGENT_JUDGE_MODEL = "openai/gpt-5.5";
