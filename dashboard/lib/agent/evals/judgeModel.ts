// The judge's model (plan Task 2.13; PR J7). Haiku 5.5, the eval default
// (AGENT_EVAL_DEFAULT_MODEL in config.ts; budgetProfiles.test.ts holds them equal), replaces
// openai/gpt-5.5 to keep a full pass within Andrew's $3 (2026-11-26). It is priced in
// lib/agent/prices.ts, so the dry run's estimate uses its own list price. Called through
// the same OpenRouter path and the same fail-closed caps as the eval (judge profile in
// budget.ts): a call that reports no cost stops it (cost_unknown).
//
// The judge is now the same family as the default eval model, so a Haiku matrix is graded
// by Haiku. What keeps it fair is unchanged: the judge never sees which variant a surface
// is (judge.ts redacts naming words and shows the pair in a random order), it informs and
// never decides, and about 10% of its verdicts go to Andrew's hand-check CSV. Pure.
export const AGENT_JUDGE_MODEL = "anthropic/claude-haiku-5.5";
