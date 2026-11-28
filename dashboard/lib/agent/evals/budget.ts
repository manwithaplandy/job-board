// Spend caps for one live eval run (gate A17; Andrew 2026-11-25: "as long as it's
// toggleable and won't cause runaway usage"). Every cap fails closed: the run stops the
// moment a cap would be or has been passed, and a step whose usage cannot be read counts
// as a breach, never as zero.
//
// Each cap has a default and a hard ceiling. A flag on `npm run eval:agent` may lower a
// cap, never raise it past its ceiling (CapUsageError). The caps:
//   max_cases    scenario x persona runs played (the first n of the 12)
//   max_steps    model calls in one turn of a case; at most the route's own AGENT_LIMITS.maxSteps
//   max_tokens   input + output tokens summed over every model call in the run
//   max_usd      spend summed from the provider's reported cost (OpenRouter usage.cost),
//                never from a price table. In every mode (the golden run too, since PR J7
//                fix round 1) a call without a reported cost trips the run
//                (cost_unknown), so this cap never switches off. Before each call, the
//                spend so far plus that call's worst-case price (prices.ts
//                worstCaseCallMicros) must fit under it
//   max_minutes  wall clock from the start of the run
//
// Pure, with no runtime imports, so scripts/eval-agent.mjs can load it (Node strips the
// types) and refuse a bad flag before vitest starts. live.eval.ts holds the one
// RunBudget of a run; budgetMiddleware.ts calls it around every model call.

export const CAP_KEYS = ["maxCases", "maxSteps", "maxTokens", "maxUsd", "maxMinutes"] as const;
export type CapKey = (typeof CAP_KEYS)[number];
export type EvalCaps = Record<CapKey, number>;

/**
 * What tripped: one of the caps, a step whose usage could not be read, or (matrix,
 * injection and judge runs only) a step that reported no OpenRouter cost, so the dollar
 * caps could not be enforced.
 */
export type CapName = "max_cases" | "max_steps" | "max_tokens" | "max_usd" | "max_minutes" | "usage_unknown" | "cost_unknown";

/** The route's per-turn step limit (AGENT_LIMITS.maxSteps); budget.test.ts holds them equal. */
export const ROUTE_MAX_STEPS = 8;
/** Every scenario x persona combination (SCENARIO_IDS x PERSONA_IDS); budget.test.ts checks it. */
export const ALL_CASES = 12;
/** The output reserve of a call that names no maxOutputTokens: AGENT_LIMITS.maxOutputTokens. */
export const DEFAULT_OUTPUT_RESERVE = 4000;

interface CapSpec {
  name: Exclude<CapName, "usage_unknown" | "cost_unknown">;
  flag: string;
  env: string;
  /** Whole numbers only (all but max_usd, which takes cents). */
  integer: boolean;
  default: number;
  ceiling: number;
  label: string;
}

// Sizing (docs/architecture.md, "Running the live agent eval", has the commands):
// - max_steps: the scripted gate turns need at most 6 calls (d_weekly); 8 is that plus
//   two, and is the route's own limit, which a flag may lower and never raise.
// - max_tokens: one step sends about 7k tokens of fixed prefix (23 tool schemas ~19k
//   characters, instructions, profile, memo) plus the growing thread. The scripted
//   turns make 32 calls per persona, about 100 for a 12-case run; at an average of
//   12-15k input tokens a call plus a few hundred output tokens that is about 1.3-1.6M
//   tokens. 2M is that with headroom; the ceiling is 4x.
// - max_usd (PR J7, Andrew's $3 per pass): no mode may spend more than $3 on its own, so
//   the golden run's default is $2 and its ceiling $3 (it was $5 / $20). A 12-case run
//   on Haiku 5.5, now its default model, is about $0.18 at list price; on Sonnet 5.5
//   about $3.60 uncached, so a Sonnet golden run fits only with the prompt cache working
//   (about $1.40 cached) and otherwise stops at the cap. Since fix round 1 the golden run
//   needs --allow-non-haiku for any model but Haiku 5.5, refuses an unpriced model, and
//   stops on a call that reports no cost, so its $3 ceiling always holds.
// - max_minutes: 12 cases at a few minutes each fit in 30; the ceiling is 60.
export const CAP_SPECS: Record<CapKey, CapSpec> = {
  maxCases: { name: "max_cases", flag: "--max-cases", env: "EVAL_MAX_CASES", integer: true, default: ALL_CASES, ceiling: ALL_CASES, label: "cases" },
  maxSteps: { name: "max_steps", flag: "--max-steps", env: "EVAL_MAX_STEPS", integer: true, default: ROUTE_MAX_STEPS, ceiling: ROUTE_MAX_STEPS, label: "model steps in one turn" },
  maxTokens: { name: "max_tokens", flag: "--max-tokens", env: "EVAL_MAX_TOKENS", integer: true, default: 2_000_000, ceiling: 8_000_000, label: "tokens (input + output)" },
  maxUsd: { name: "max_usd", flag: "--max-usd", env: "EVAL_MAX_USD", integer: false, default: 2, ceiling: 3, label: "US dollars (reported cost)" },
  maxMinutes: { name: "max_minutes", flag: "--max-minutes", env: "EVAL_MAX_MINUTES", integer: true, default: 30, ceiling: 60, label: "minutes" },
};

export const CAP_DEFAULTS: EvalCaps = mapCaps((s) => s.default);
export const CAP_CEILINGS: EvalCaps = mapCaps((s) => s.ceiling);

function mapCaps(f: (s: CapSpec) => number, specs: Record<CapKey, CapSpec> = CAP_SPECS): EvalCaps {
  const out = {} as EvalCaps;
  for (const key of CAP_KEYS) out[key] = f(specs[key]);
  return out;
}

// ---------------------------------------------------------------------------
// Cap profiles (Tasks 2.10, 2.12, 2.13). The golden run keeps the A17 caps above,
// unchanged. The matrix, the injection set and the judge are separate opt-in modes of the
// same entry point, each with its own caps: defaults and hard ceilings here, enforced by
// the same RunBudget and budgetMiddleware. The matrix and the injection set run once per
// model; each model's run has its own RunBudget, and every model's budget also reports to
// one whole-command budget with the TOTAL caps. The first cap to trip, a model's or the
// total, stops the whole command.
//
// Sizing (PR J7, Andrew 2026-11-26: "max $2-3 per pass total, ideally without
// compromising quality"). No mode can spend more than $3 on its own: every dollar
// ceiling is at most PASS_USD_CEILING. matrixPlan.ts estimateMatrix / estimateInjection /
// estimateJudge make the numbers (uncached list prices, the conservative figure), and
// budgetProfiles.test.ts holds every dollar default at least 1.2 times its Haiku 5.5
// estimate:
// - matrix, per model: one full run is 180 cells (60 live variant 1 scenario runs plus
//   their 120 re-render cells, 420 re-render calls). On Haiku 5.5, the default model,
//   about 14.3M tokens and $2.05 uncached; $2.50 by default, $3 at most, per model and
//   for the whole command. A full Sonnet 5.5 matrix (about $41) no longer fits any cap:
//   Sonnet runs as the spot check below, or with --allow-non-haiku and a run the cap
//   stops. Tokens and minutes keep their earlier sizes (a token is a token on either
//   model; Haiku is not slower).
// - injection, per model: 19 model-driven cases by 3 variants (57 runs; PR 6 added the
//   four ask cases), about 7.1M tokens and $0.82 uncached on Haiku; $1 by default, $1.50
//   at most.
// - judge: Haiku 5.5 (judgeModel.ts), 144 pairs by default, about 1.8M tokens and $0.20;
//   $0.50 by default, $1 at most (360 pairs would be about $0.50).
// - spot-check (--matrix --spot-check): Sonnet 5.5, one persona and one repeat, all 4
//   scenarios in all 3 variants (12 cells, 34 live calls and 28 re-render calls), about
//   0.95M tokens and $2.74 uncached ($1.75 with the prompt cache): $2.90 by default and
//   at most. Since fix round 1's look-ahead reserves a Sonnet step's worst case (about
//   $0.20 at the plan's call size) before each call, an uncached spot check may stop about
//   one cell short of the end; with the prompt cache working it completes.
//
// The look-ahead (PR J7 fix round 1, RunBudget.beforeStep): every capped mode, and each
// stage of a pass, starts a call only when the spend so far plus that call's worst case at
// list price (prices.ts worstCaseCallMicros, from budgetMiddleware.ts) fits under the
// dollar cap, never reserving less than the dearest call so far. So no run passes its cap,
// and no pass its budget, at list prices (OpenRouter's are unverified).
//
// Dollar caps never switch off in any mode: a model call that reports no OpenRouter cost
// trips the run as cost_unknown (PROFILE_REQUIRES_COST). The golden run used to fall back
// to its token cap alone (A17); PR J7 fix round 1 holds it to the same rule, so "no mode
// can spend more than $3" holds for it too.
// ---------------------------------------------------------------------------

/**
 * golden, matrix, injection and judge are the four modes (EVAL_MODE); spot-check is the
 * matrix mode's opt-in Sonnet spot check, which runs matrix.eval.ts under its own caps.
 */
export const CAP_PROFILES = ["golden", "matrix", "injection", "judge", "spot-check"] as const;
export type CapProfile = (typeof CAP_PROFILES)[number];

/**
 * One `eval-agent.mjs --pass` (matrix, then injection, then judge, all on Haiku 5.5) has
 * one dollar budget shared by its three stages: $3 by default and at most (Andrew
 * 2026-11-26); --max-usd may lower it. Each stage's dollar caps are what is left of it.
 */
export const PASS_USD_DEFAULT = 3;
export const PASS_USD_CEILING = 3;

/** The pass's --max-usd: a positive number of dollars with at most two decimals, never above PASS_USD_CEILING. */
export function parsePassUsd(raw: string | undefined): number {
  if (raw === undefined) return PASS_USD_DEFAULT;
  return parseSpec({ ...CAP_SPECS.maxUsd, label: "US dollars over the whole pass", default: PASS_USD_DEFAULT, ceiling: PASS_USD_CEILING }, raw);
}

/**
 * What is left of a pass's budget for its next stage, in whole cents rounded down (a cap
 * takes at most two decimals), or 0 when less than a cent is left. A spend that is not a
 * finite, non-negative number leaves nothing: the pass fails closed.
 */
export function passRemaining(budgetUsd: number, spentUsd: readonly number[]): number {
  if (spentUsd.some((s) => !Number.isFinite(s) || s < 0)) return 0;
  const left = budgetUsd - spentUsd.reduce((a, b) => a + b, 0);
  return left < 0.01 ? 0 : Math.floor(left * 100 + 1e-9) / 100;
}

/**
 * The variable scripts/eval-agent.mjs sets to the mode it starts (golden, matrix,
 * injection or judge), and nothing else sets. vitest.eval.config.ts includes every
 * *.eval.ts, so a bare `vitest -c vitest.eval.config.ts` would load all four live files
 * at once, each with its own default caps: each file calls assertEvalMode with its own
 * mode first and refuses to start under any other value.
 */
export const EVAL_MODE_ENV = "EVAL_MODE";

export function assertEvalMode(env: Readonly<Record<string, string | undefined>>, mode: CapProfile): void {
  const got = env[EVAL_MODE_ENV];
  if (got === mode) return;
  const command = mode === "golden" ? "npm run eval:agent -- --variant <1|2|3>" : `npm run eval:agent -- --${mode}`;
  throw new Error(`eval: this file runs only through \`${command}\` (${EVAL_MODE_ENV}=${mode}); ${EVAL_MODE_ENV} is ${got === undefined ? "unset" : JSON.stringify(got)}`);
}

/**
 * Whether every model call of a profile must report its OpenRouter cost: true for every
 * profile. A call without one trips cost_unknown, so max_usd and max_total_usd always
 * hold. The golden run was false (A17: no cost on the first call meant tokens only);
 * PR J7 fix round 1 made it fail closed too, so its $3 ceiling is a real bound.
 */
export const PROFILE_REQUIRES_COST: Record<CapProfile, boolean> = {
  golden: true,
  matrix: true,
  injection: true,
  judge: true,
  "spot-check": true,
};

export const TOTAL_CAP_KEYS = ["maxTotalTokens", "maxTotalUsd"] as const;
export type TotalCapKey = (typeof TOTAL_CAP_KEYS)[number];
export type TotalCaps = Record<TotalCapKey, number>;

const spec = (
  base: CapSpec,
  over: Partial<Pick<CapSpec, "flag" | "label">> & { default: number; ceiling: number },
): CapSpec => ({ ...base, ...over });

export const MATRIX_CELLS = 180;
export const INJECTION_RUNS_PER_MODEL = 57;
export const JUDGE_PAIRS_DEFAULT = 144;
export const JUDGE_PAIRS_CEILING = 360;
/** The spot check: 4 scenarios, one persona, one repeat, 3 variants. */
export const SPOT_CHECK_CELLS = 12;
export const SPOT_CHECK_USD = 2.9;

export const PROFILE_CAP_SPECS: Record<CapProfile, Record<CapKey, CapSpec>> = {
  golden: CAP_SPECS,
  matrix: {
    maxCases: spec(CAP_SPECS.maxCases, { flag: "--max-cells", label: "matrix cells per model", default: MATRIX_CELLS, ceiling: MATRIX_CELLS }),
    maxSteps: CAP_SPECS.maxSteps,
    maxTokens: spec(CAP_SPECS.maxTokens, { label: "tokens per model (input + output)", default: 22_000_000, ceiling: 44_000_000 }),
    maxUsd: spec(CAP_SPECS.maxUsd, { label: "US dollars per model (reported cost)", default: 2.5, ceiling: 3 }),
    maxMinutes: spec(CAP_SPECS.maxMinutes, { label: "minutes per model", default: 360, ceiling: 600 }),
  },
  injection: {
    maxCases: spec(CAP_SPECS.maxCases, { label: "injection runs per model", default: INJECTION_RUNS_PER_MODEL, ceiling: INJECTION_RUNS_PER_MODEL }),
    maxSteps: CAP_SPECS.maxSteps,
    maxTokens: spec(CAP_SPECS.maxTokens, { label: "tokens per model (input + output)", default: 9_000_000, ceiling: 18_000_000 }),
    maxUsd: spec(CAP_SPECS.maxUsd, { label: "US dollars per model (reported cost)", default: 1, ceiling: 1.5 }),
    maxMinutes: spec(CAP_SPECS.maxMinutes, { label: "minutes per model", default: 120, ceiling: 240 }),
  },
  judge: {
    maxCases: spec(CAP_SPECS.maxCases, { flag: "--max-pairs", label: "judged pairs", default: JUDGE_PAIRS_DEFAULT, ceiling: JUDGE_PAIRS_CEILING }),
    maxSteps: spec(CAP_SPECS.maxSteps, { label: "model calls per pair", default: 1, ceiling: 1 }),
    maxTokens: spec(CAP_SPECS.maxTokens, { default: 3_000_000, ceiling: 6_000_000 }),
    maxUsd: spec(CAP_SPECS.maxUsd, { default: 0.5, ceiling: 1 }),
    maxMinutes: spec(CAP_SPECS.maxMinutes, { default: 60, ceiling: 120 }),
  },
  "spot-check": {
    maxCases: spec(CAP_SPECS.maxCases, { flag: "--max-cells", label: "spot-check cells", default: SPOT_CHECK_CELLS, ceiling: SPOT_CHECK_CELLS }),
    maxSteps: CAP_SPECS.maxSteps,
    maxTokens: spec(CAP_SPECS.maxTokens, { label: "tokens (input + output)", default: 2_000_000, ceiling: 4_000_000 }),
    maxUsd: spec(CAP_SPECS.maxUsd, { label: "US dollars (reported cost)", default: SPOT_CHECK_USD, ceiling: SPOT_CHECK_USD }),
    maxMinutes: spec(CAP_SPECS.maxMinutes, { label: "minutes", default: 60, ceiling: 120 }),
  },
};

const TOTAL_BASE = { integer: true, env: "", flag: "", label: "", name: "max_tokens" } as const;

/** The whole-command caps of the modes that run once per model. */
export const TOTAL_CAP_SPECS: Partial<Record<CapProfile, Record<TotalCapKey, CapSpec>>> = {
  matrix: {
    maxTotalTokens: { ...TOTAL_BASE, name: "max_tokens", flag: "--max-total-tokens", env: "EVAL_MAX_TOTAL_TOKENS", label: "tokens over every model", default: 44_000_000, ceiling: 88_000_000 },
    maxTotalUsd: { ...TOTAL_BASE, name: "max_usd", integer: false, flag: "--max-total-usd", env: "EVAL_MAX_TOTAL_USD", label: "US dollars over every model", default: 2.5, ceiling: 3 },
  },
  injection: {
    maxTotalTokens: { ...TOTAL_BASE, name: "max_tokens", flag: "--max-total-tokens", env: "EVAL_MAX_TOTAL_TOKENS", label: "tokens over every model", default: 18_000_000, ceiling: 36_000_000 },
    maxTotalUsd: { ...TOTAL_BASE, name: "max_usd", integer: false, flag: "--max-total-usd", env: "EVAL_MAX_TOTAL_USD", label: "US dollars over every model", default: 1, ceiling: 1.5 },
  },
  // One model (Sonnet 5.5), so the totals equal its own caps; matrix.eval.ts needs them.
  "spot-check": {
    maxTotalTokens: { ...TOTAL_BASE, name: "max_tokens", flag: "--max-total-tokens", env: "EVAL_MAX_TOTAL_TOKENS", label: "tokens over the run", default: 2_000_000, ceiling: 4_000_000 },
    maxTotalUsd: { ...TOTAL_BASE, name: "max_usd", integer: false, flag: "--max-total-usd", env: "EVAL_MAX_TOTAL_USD", label: "US dollars over the run", default: SPOT_CHECK_USD, ceiling: SPOT_CHECK_USD },
  },
};

export function profileDefaults(profile: CapProfile): EvalCaps {
  return mapCaps((s) => s.default, PROFILE_CAP_SPECS[profile]);
}

export function profileCeilings(profile: CapProfile): EvalCaps {
  return mapCaps((s) => s.ceiling, PROFILE_CAP_SPECS[profile]);
}

/** The flag names a profile accepts: its own cap flags and, where it has them, the total flags. */
export function profileFlags(profile: CapProfile): Map<string, { key: CapKey | TotalCapKey; total: boolean }> {
  const out = new Map<string, { key: CapKey | TotalCapKey; total: boolean }>();
  for (const key of CAP_KEYS) out.set(PROFILE_CAP_SPECS[profile][key].flag, { key, total: false });
  const totals = TOTAL_CAP_SPECS[profile];
  if (totals) for (const key of TOTAL_CAP_KEYS) out.set(totals[key].flag, { key, total: true });
  return out;
}

/** A flag the run refuses: not a positive number, or above its ceiling. */
export class CapUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapUsageError";
  }
}

/** The run stopped at a cap. Every later step, turn and case refuses with the same cap. */
export class CapExceededError extends Error {
  // Plain fields, not parameter properties: Node's type stripping (eval-agent.mjs loads
  // this file) does not support those.
  readonly cap: CapName;
  readonly detail: string;

  constructor(cap: CapName, detail: string) {
    super(`eval: cap_exceeded (${cap}): ${detail}`);
    this.name = "CapExceededError";
    this.cap = cap;
    this.detail = detail;
  }
}

const INTEGER_RE = /^\d{1,12}$/;
const DECIMAL_RE = /^\d{1,6}(\.\d{1,2})?$/;

/** One flag's value, checked against its spec. */
export function parseCap(key: CapKey, raw: string, profile: CapProfile = "golden"): number {
  return parseSpec(PROFILE_CAP_SPECS[profile][key], raw);
}

function parseSpec(spec: CapSpec, raw: string): number {
  const text = raw.trim();
  const shape = spec.integer ? INTEGER_RE : DECIMAL_RE;
  const value = Number(text);
  if (!shape.test(text) || !Number.isFinite(value) || value <= 0) {
    throw new CapUsageError(`${spec.flag} must be a positive ${spec.integer ? "whole number" : "number (at most two decimals)"}`);
  }
  if (value > spec.ceiling) {
    throw new CapUsageError(`${spec.flag} ${text} is above its ceiling of ${spec.ceiling}; it can only be lowered`);
  }
  return value;
}

/** The caps from flag values; a missing one takes its default. */
export function parseCaps(raw: Partial<Record<CapKey, string | undefined>>, profile: CapProfile = "golden"): EvalCaps {
  const out = profileDefaults(profile);
  for (const key of CAP_KEYS) {
    const value = raw[key];
    if (value !== undefined) out[key] = parseCap(key, value, profile);
  }
  return out;
}

/** The whole-command caps from flag values; a missing one takes its default. A profile without them refuses any. */
export function parseTotalCaps(raw: Partial<Record<TotalCapKey, string | undefined>>, profile: CapProfile): TotalCaps | null {
  const specs = TOTAL_CAP_SPECS[profile];
  if (!specs) {
    if (TOTAL_CAP_KEYS.some((k) => raw[k] !== undefined)) throw new CapUsageError(`the ${profile} run has no whole-command caps`);
    return null;
  }
  const out = {} as TotalCaps;
  for (const key of TOTAL_CAP_KEYS) {
    const value = raw[key];
    out[key] = value === undefined ? specs[key].default : parseSpec(specs[key], value);
  }
  return out;
}

/** The caps eval-agent.mjs passed to vitest (EVAL_MAX_*), re-checked on this side. */
export function capsFromEnv(env: Record<string, string | undefined>, profile: CapProfile = "golden"): EvalCaps {
  const raw: Partial<Record<CapKey, string>> = {};
  for (const key of CAP_KEYS) {
    const value = env[PROFILE_CAP_SPECS[profile][key].env];
    if (value !== undefined && value !== "") raw[key] = value;
  }
  return parseCaps(raw, profile);
}

/** The whole-command caps eval-agent.mjs passed (EVAL_MAX_TOTAL_*), re-checked on this side. */
export function totalCapsFromEnv(env: Record<string, string | undefined>, profile: CapProfile): TotalCaps | null {
  const specs = TOTAL_CAP_SPECS[profile];
  const raw: Partial<Record<TotalCapKey, string>> = {};
  if (specs) {
    for (const key of TOTAL_CAP_KEYS) {
      const value = env[specs[key].env];
      if (value !== undefined && value !== "") raw[key] = value;
    }
  }
  return parseTotalCaps(raw, profile);
}

export function capsToEnv(caps: EvalCaps, profile: CapProfile = "golden"): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of CAP_KEYS) out[PROFILE_CAP_SPECS[profile][key].env] = String(caps[key]);
  return out;
}

export function totalCapsToEnv(caps: TotalCaps | null, profile: CapProfile): Record<string, string> {
  const specs = TOTAL_CAP_SPECS[profile];
  const out: Record<string, string> = {};
  if (caps && specs) for (const key of TOTAL_CAP_KEYS) out[specs[key].env] = String(caps[key]);
  return out;
}

/**
 * The whole-command budget of a run over several models: only its token and dollar caps
 * count (cases, steps and minutes are each model's own), and every model's RunBudget
 * reports each call to it. Only the matrix and the injection set have one, and both
 * require a reported cost on every call (PROFILE_REQUIRES_COST), so this one does too.
 */
export function totalBudget(caps: TotalCaps, now: () => number = Date.now): RunBudget {
  return new RunBudget(
    {
      maxCases: Number.MAX_SAFE_INTEGER,
      maxSteps: Number.MAX_SAFE_INTEGER,
      maxTokens: caps.maxTotalTokens,
      maxUsd: caps.maxTotalUsd,
      maxMinutes: Number.MAX_SAFE_INTEGER / 120_000,
    },
    now,
    null,
    true,
  );
}

/** One model's RunBudget for a profile: its caps, the cost rule of the profile, and an optional whole-command parent. */
export function profileBudget(profile: CapProfile, caps: EvalCaps, parent: RunBudget | null = null, now: () => number = Date.now): RunBudget {
  return new RunBudget(caps, now, parent, PROFILE_REQUIRES_COST[profile]);
}

/**
 * One model call's usage: tokens, and the provider's reported cost in dollars when it gave
 * one. The cache counts (PR J7) are part of inputTokens; 0 when the provider reported none.
 */
export interface StepUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

function tokenTotal(v: unknown): number | null {
  const n = typeof v === "object" && v !== null && "total" in v ? (v as { total: unknown }).total : v;
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/** A cache count from the provider's input-token detail (cacheRead, cacheWrite); 0 when missing or malformed. */
function cacheCount(v: unknown, key: "cacheRead" | "cacheWrite"): number {
  const n = typeof v === "object" && v !== null && key in v ? (v as Record<string, unknown>)[key] : undefined;
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : 0;
}

/**
 * A model call's usage from its finish part (or generate result): the token totals and
 * OpenRouter's providerMetadata.openrouter.usage.cost. Null when either token total is
 * missing or not a whole number: the caller treats that as a breach (usage_unknown).
 */
export function readStepUsage(usage: unknown, providerMetadata: unknown): StepUsage | null {
  if (typeof usage !== "object" || usage === null) return null;
  const u = usage as { inputTokens?: unknown; outputTokens?: unknown };
  const inputTokens = tokenTotal(u.inputTokens);
  const outputTokens = tokenTotal(u.outputTokens);
  if (inputTokens === null || outputTokens === null) return null;
  const cost = (providerMetadata as { openrouter?: { usage?: { cost?: unknown } } } | undefined)?.openrouter?.usage?.cost;
  const costUsd = typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? cost : null;
  return {
    inputTokens,
    outputTokens,
    costUsd,
    cacheReadTokens: Math.min(inputTokens, cacheCount(u.inputTokens, "cacheRead")),
    cacheWriteTokens: Math.min(inputTokens, cacheCount(u.inputTokens, "cacheWrite")),
  };
}

/**
 * A call's dollar reserve (RunBudget.beforeStep): its worst case when given, never less
 * than the dearest call so far; a worst case that is given but not a finite, non-negative
 * number is Infinity, so the call is refused rather than priced low.
 */
export function dollarReserve(worstCaseUsd: number | undefined, dearestSoFarUsd: number): number {
  if (worstCaseUsd === undefined) return dearestSoFarUsd;
  if (!Number.isFinite(worstCaseUsd) || worstCaseUsd < 0) return Number.POSITIVE_INFINITY;
  return Math.max(worstCaseUsd, dearestSoFarUsd);
}

/** How the dollar cap stands: undecided until the first step, then fixed for the run. */
export type UsdEnforcement = "pending" | "enforced" | "not_enforced";

export interface BudgetTotals {
  cases: number;
  steps: number;
  maxStepsInTurn: number;
  inputTokens: number;
  outputTokens: number;
  /** Of inputTokens: read from and written to the prompt cache (PR J7), as the provider reported them. */
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  elapsedMs: number;
}

/**
 * The caps of one run, checked before every model call (beforeStep) and after it
 * (recordStep). The first breach trips the run: `signal` aborts (so a call in flight
 * stops), and every later startCase, startTurn and beforeStep throws CapExceededError
 * with that first cap.
 */
export class RunBudget {
  readonly caps: EvalCaps;
  private readonly now: () => number;
  private readonly controller = new AbortController();
  private readonly startedAt: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private trippedAt: { cap: CapName; detail: string } | null = null;
  private cases = 0;
  private steps = 0;
  private stepsThisTurn = 0;
  private maxStepsInTurn = 0;
  private inFlight = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private cacheReadTokens = 0;
  private cacheWriteTokens = 0;
  private costUsd = 0;
  private lastInputTokens = 0;
  private maxStepCostUsd = 0;
  private usd: UsdEnforcement = "pending";

  /** The whole-command budget every call also reports to (a run over several models), or null. */
  private readonly parent: RunBudget | null;
  /** A call that reports no cost trips cost_unknown (matrix, injection, judge), never "not enforced". */
  readonly requireCost: boolean;

  constructor(caps: EvalCaps, now: () => number = Date.now, parent: RunBudget | null = null, requireCost = false) {
    this.caps = caps;
    this.now = now;
    this.startedAt = now();
    this.parent = parent;
    this.requireCost = requireCost;
    if (parent) {
      // A trip of the whole command trips this run too (and aborts a call in flight).
      const follow = () => {
        const t = parent.tripped;
        if (t) this.trip(t.cap, `whole command: ${t.detail}`);
      };
      if (parent.signal.aborted) follow();
      else parent.signal.addEventListener("abort", follow, { once: true });
    }
  }

  /** Aborted at the first breach; the budgeted model passes it to every call. */
  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get tripped(): { cap: CapName; detail: string } | null {
    return this.trippedAt;
  }

  get usdEnforcement(): UsdEnforcement {
    return this.usd;
  }

  get totals(): BudgetTotals {
    return {
      cases: this.cases,
      steps: this.steps,
      maxStepsInTurn: this.maxStepsInTurn,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      cacheReadTokens: this.cacheReadTokens,
      cacheWriteTokens: this.cacheWriteTokens,
      costUsd: this.costUsd,
      elapsedMs: this.now() - this.startedAt,
    };
  }

  /** Trips the run at the wall-clock cap even while a model call is in flight. */
  armClock(): void {
    if (this.timer !== null) return;
    const left = this.startedAt + this.caps.maxMinutes * 60_000 - this.now();
    // Trips without throwing: a throw here would be an uncaught timer error.
    this.timer = setTimeout(() => this.clockBreach(), Math.max(0, left));
    (this.timer as { unref?: () => void }).unref?.();
  }

  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Records the first breach and aborts the signal; returns the error for that first cap. */
  trip(cap: CapName, detail: string): CapExceededError {
    if (this.trippedAt === null) {
      this.trippedAt = { cap, detail };
      this.dispose();
      this.controller.abort(new CapExceededError(cap, detail));
    }
    return new CapExceededError(this.trippedAt.cap, this.trippedAt.detail);
  }

  throwIfTripped(): void {
    if (this.trippedAt !== null) throw new CapExceededError(this.trippedAt.cap, this.trippedAt.detail);
  }

  /** Trips max_minutes once the wall clock has run out; returns the error, or null. */
  private clockBreach(): CapExceededError | null {
    const elapsed = this.now() - this.startedAt;
    if (elapsed < this.caps.maxMinutes * 60_000) return null;
    return this.trip("max_minutes", `${(elapsed / 60_000).toFixed(1)} minutes passed, cap ${this.caps.maxMinutes}`);
  }

  private checkClock(): void {
    const breach = this.clockBreach();
    if (breach) throw breach;
  }

  /** Before a case starts: refuses once tripped, past the clock, or past max_cases. */
  startCase(): void {
    this.throwIfTripped();
    this.checkClock();
    if (this.cases >= this.caps.maxCases) {
      throw this.trip("max_cases", `case ${this.cases + 1} would pass the cap of ${this.caps.maxCases}`);
    }
    this.cases += 1;
    this.stepsThisTurn = 0;
  }

  /** Before each scripted turn: the per-turn step count starts again. */
  startTurn(): void {
    this.throwIfTripped();
    this.checkClock();
    this.stepsThisTurn = 0;
  }

  /**
   * After each turn has fully settled: a model call whose usage was never read (its
   * stream cancelled or errored before the finish part) trips usage_unknown, then any
   * trip throws.
   */
  endTurn(): void {
    if (this.inFlight > 0) this.trip("usage_unknown", "a model call ended without reporting its usage");
    this.throwIfTripped();
  }

  /**
   * Before every model call. Refuses (and trips the run) when it is tripped, when a call's
   * usage is still unread, past the clock, past max_steps for the turn, or when the next
   * call could pass a cap: tokens used plus the last call's input plus this call's output
   * reserve, or dollars spent plus this call's dollar reserve.
   *
   * The dollar reserve (PR J7 fix round 1) is `worstCaseUsd`, this call's worst case at
   * list price (budgetMiddleware.ts, from prices.ts worstCaseCallMicros), and never less
   * than the dearest call so far; a worstCaseUsd that is given but not a finite,
   * non-negative number reserves Infinity (the call is refused). Without one (a direct
   * caller) the reserve is the dearest call so far, as before. It applies unless the run
   * found the dollar cap not enforced (a bare RunBudget whose first call reported no cost);
   * every profile requires a cost, so it applies from the first call on.
   */
  beforeStep(a: { maxOutputTokens?: number; worstCaseUsd?: number } = {}): void {
    this.throwIfTripped();
    if (this.inFlight > 0) throw this.trip("usage_unknown", "a model call started before the previous call's usage was read");
    this.checkClock();
    if (this.stepsThisTurn >= this.caps.maxSteps) {
      throw this.trip("max_steps", `step ${this.stepsThisTurn + 1} of one turn would pass the cap of ${this.caps.maxSteps}`);
    }
    const used = this.inputTokens + this.outputTokens;
    const reserve = this.lastInputTokens + (a.maxOutputTokens ?? DEFAULT_OUTPUT_RESERVE);
    if (used + reserve > this.caps.maxTokens) {
      throw this.trip("max_tokens", `${used} tokens used; the next call (up to ${reserve}) could pass the cap of ${this.caps.maxTokens}`);
    }
    const usdReserve = dollarReserve(a.worstCaseUsd, this.maxStepCostUsd);
    if (this.usd !== "not_enforced" && this.costUsd + usdReserve > this.caps.maxUsd) {
      const what = a.worstCaseUsd === undefined ? "up to" : "worst case";
      throw this.trip("max_usd", `$${this.costUsd.toFixed(4)} spent; the next call (${what} $${usdReserve.toFixed(4)}) could pass the cap of $${this.caps.maxUsd}`);
    }
    if (this.parent) {
      // The whole command's caps, checked last: a refusal there trips this run through the
      // parent's abort (constructor), and the call never reaches the provider.
      try {
        this.parent.beforeStep(a);
      } catch (error) {
        const t = this.parent.tripped;
        throw t ? this.trip(t.cap, `whole command: ${t.detail}`) : error;
      }
    }
    this.steps += 1;
    this.stepsThisTurn += 1;
    this.maxStepsInTurn = Math.max(this.maxStepsInTurn, this.stepsThisTurn);
    this.inFlight += 1;
  }

  /**
   * After a model call, with its usage, or null when it could not be read (a missing or
   * malformed finish part, a stream that ended without one): null trips usage_unknown.
   * With requireCost (every profile since PR J7 fix round 1), a call without a cost trips
   * cost_unknown, so the dollar caps are always enforced. Otherwise (a bare RunBudget, as
   * the golden run had under A17) the first call decides the dollar cap: enforced when it reported a cost, not enforced
   * (tokens only) when it did not; once enforced, a call without a cost trips
   * usage_unknown. Does not throw: the trip aborts `signal` and the next check throws.
   */
  recordStep(usage: StepUsage | null): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    this.parent?.recordStep(usage);
    if (usage === null) {
      this.trip("usage_unknown", "a model call's token usage could not be read");
      return;
    }
    this.inputTokens += usage.inputTokens;
    this.outputTokens += usage.outputTokens;
    this.cacheReadTokens += usage.cacheReadTokens ?? 0;
    this.cacheWriteTokens += usage.cacheWriteTokens ?? 0;
    this.lastInputTokens = usage.inputTokens;
    if (usage.costUsd === null && this.requireCost) {
      this.trip("cost_unknown", "a model call reported no OpenRouter cost, so the dollar caps could not be enforced");
      return;
    }
    if (this.usd === "pending") this.usd = usage.costUsd === null ? "not_enforced" : "enforced";
    if (this.usd === "enforced") {
      if (usage.costUsd === null) {
        this.trip("usage_unknown", "a model call reported no cost after earlier calls did");
        return;
      }
      this.costUsd += usage.costUsd;
      this.maxStepCostUsd = Math.max(this.maxStepCostUsd, usage.costUsd);
    }
    const used = this.inputTokens + this.outputTokens;
    if (used > this.caps.maxTokens) this.trip("max_tokens", `${used} tokens used, cap ${this.caps.maxTokens}`);
    else if (this.usd === "enforced" && this.costUsd > this.caps.maxUsd) {
      this.trip("max_usd", `$${this.costUsd.toFixed(4)} spent, cap $${this.caps.maxUsd}`);
    }
  }

  /** The run's status line and its usage against every cap, as printed at the end. */
  report(): string {
    const t = this.totals;
    const status = this.trippedAt ? `cap_exceeded (${this.trippedAt.cap}: ${this.trippedAt.detail})` : "within caps";
    const usd =
      this.trippedAt?.cap === "cost_unknown"
        ? `$${t.costUsd.toFixed(4)} reported before a call came back without its cost (the run stopped there)`
        : this.usd === "enforced"
        ? `$${t.costUsd.toFixed(4)}`
        : this.usd === "not_enforced"
          ? "not enforced: the provider reported no cost, so only the token cap applied"
          : "no model call yet";
    return [
      `Run: ${status}`,
      "",
      "| Cap | Used | Limit |",
      "|---|---|---|",
      `| max_cases | ${t.cases} | ${this.caps.maxCases} |`,
      `| max_steps (most in one turn; ${t.steps} in all) | ${t.maxStepsInTurn} | ${this.caps.maxSteps} |`,
      `| max_tokens (in ${t.inputTokens} / out ${t.outputTokens}; of the input, cache read ${t.cacheReadTokens} / written ${t.cacheWriteTokens}) | ${t.inputTokens + t.outputTokens} | ${this.caps.maxTokens} |`,
      `| max_usd | ${usd} | $${this.caps.maxUsd} |`,
      `| max_minutes | ${(t.elapsedMs / 60_000).toFixed(1)} | ${this.caps.maxMinutes} |`,
    ].join("\n");
  }
}
