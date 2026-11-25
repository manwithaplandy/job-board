// Shared agent configuration (plan "Shared types"). Pure constants and types, safe to
// import from client and server code alike.

export type Variant = 1 | 2 | 3;
// Every kind but interactive may have no thread.
export type RunKind = "interactive" | "background" | "rerender" | "eval" | "vision" | "transcription";
export type RunStatus = "pending" | "running" | "done" | "failed" | "aborted" | "over_budget";

// Andrew 2026-11-20: start on Sonnet. The OpenRouter slug is [Unverified]: Spike A
// (Task 0.2) did not run, so no live call has confirmed it.
export const AGENT_MODEL_DEFAULT = "anthropic/claude-sonnet-5.5";

// Models the eval matrix sweeps for cost/benefit (Task 2.10). Add entries freely; each
// needs a PRICE_PER_MTOK_MICROS row in lib/agent/budget.ts.
export const AGENT_EVAL_MODELS = ["anthropic/claude-sonnet-5.5", "anthropic/claude-haiku-5.5"] as const;

export const AGENT_LIMITS = {
  maxSteps: 8,
  maxOutputTokens: 4000,
  wallClockMs: 240_000,
  backgroundMaxSteps: 6,
  staleTurnMs: 300_000,
  // The history window sent to the model (PR C batch 3 review M5): the newest stored
  // messages, at most 40 of them and at most 120,000 characters of serialized parts
  // (roughly 30k tokens), cut so the window starts at a user message. Every step of a
  // turn re-sends it, so this bounds one step's input. Older turns stay stored and
  // shown; past summarizeAboveMessages they are summarised (Task 1.21, lib/agent/summary.ts).
  historyMaxMessages: 40,
  historyMaxChars: 120_000,
  // A thread longer than this is sent as a summary plus its newest summaryKeepMessages.
  summarizeAboveMessages: 40,
  summaryKeepMessages: 12,
  // The summary call's own limit, well inside wallClockMs (which it also counts against).
  // On timeout the turn goes on with the unsummarised window.
  summaryTimeoutMs: 25_000,
} as const;

// usage_counters.kind for agent spend; n is in micro-dollars.
export const USAGE_KIND_AGENT = "agent_micros";
