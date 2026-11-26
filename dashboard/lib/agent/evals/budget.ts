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
//   max_usd      spend summed from the provider's reported cost; enforced only when
//                the provider reports it (OpenRouter usage.cost), never from a price table
//   max_minutes  wall clock from the start of the run
//
// Pure, with no runtime imports, so scripts/eval-agent.mjs can load it (Node strips the
// types) and refuse a bad flag before vitest starts. live.eval.ts holds the one
// RunBudget of a run; budgetMiddleware.ts calls it around every model call.

export const CAP_KEYS = ["maxCases", "maxSteps", "maxTokens", "maxUsd", "maxMinutes"] as const;
export type CapKey = (typeof CAP_KEYS)[number];
export type EvalCaps = Record<CapKey, number>;

/** What tripped: one of the caps, or a step whose usage could not be read. */
export type CapName = "max_cases" | "max_steps" | "max_tokens" | "max_usd" | "max_minutes" | "usage_unknown";

/** The route's per-turn step limit (AGENT_LIMITS.maxSteps); budget.test.ts holds them equal. */
export const ROUTE_MAX_STEPS = 8;
/** Every scenario x persona combination (SCENARIO_IDS x PERSONA_IDS); budget.test.ts checks it. */
export const ALL_CASES = 12;
/** The output reserve of a call that names no maxOutputTokens: AGENT_LIMITS.maxOutputTokens. */
export const DEFAULT_OUTPUT_RESERVE = 4000;

interface CapSpec {
  name: Exclude<CapName, "usage_unknown">;
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
// - max_usd: 2M tokens of a mid-size model (Sonnet 5.5 at its $2/$10 per million list
//   price) is about $4-5, so $5 agrees with the token default; the ceiling is $20.
// - max_minutes: 12 cases at a few minutes each fit in 30; the ceiling is 60.
export const CAP_SPECS: Record<CapKey, CapSpec> = {
  maxCases: { name: "max_cases", flag: "--max-cases", env: "EVAL_MAX_CASES", integer: true, default: ALL_CASES, ceiling: ALL_CASES, label: "cases" },
  maxSteps: { name: "max_steps", flag: "--max-steps", env: "EVAL_MAX_STEPS", integer: true, default: ROUTE_MAX_STEPS, ceiling: ROUTE_MAX_STEPS, label: "model steps in one turn" },
  maxTokens: { name: "max_tokens", flag: "--max-tokens", env: "EVAL_MAX_TOKENS", integer: true, default: 2_000_000, ceiling: 8_000_000, label: "tokens (input + output)" },
  maxUsd: { name: "max_usd", flag: "--max-usd", env: "EVAL_MAX_USD", integer: false, default: 5, ceiling: 20, label: "US dollars (reported cost)" },
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
// Sizing (matrixPlan.ts estimateMatrix / estimateInjection / estimateJudge make the
// numbers, and budget.test.ts holds every default above its Sonnet 5.5 estimate):
// - matrix, per model: one full run is 180 cells (60 live variant 1 scenario runs plus
//   210 re-renders of their surfaces into variants 2 and 3). Estimated about 14.3M tokens
//   and $41 on Sonnet 5.5 at its list price, about $10 on Haiku 5.5. Defaults are about
//   1.5 times the Sonnet estimate (22M tokens, $60); ceilings are twice the defaults.
//   The whole-command total defaults cover both AGENT_EVAL_MODELS (44M tokens, $80).
//   Minutes: about 3 to 5 hours a model (60 scenario runs at the golden pace plus 210
//   re-renders), so 360 by default and 600 at most.
// - injection, per model: 15 model-driven cases by 3 variants (45 runs), estimated about
//   5.6M tokens and $13 on Sonnet; defaults 9M tokens and $25, ceilings twice that.
// - judge: one model (openai/gpt-5.5), 144 pairs by default (two repeats of each
//   scenario, persona and variant pair, both models), estimated about 1.8M tokens and
//   $4 at the fallback price; a small cap of 3M tokens and $10.
// ---------------------------------------------------------------------------

export const CAP_PROFILES = ["golden", "matrix", "injection", "judge"] as const;
export type CapProfile = (typeof CAP_PROFILES)[number];

export const TOTAL_CAP_KEYS = ["maxTotalTokens", "maxTotalUsd"] as const;
export type TotalCapKey = (typeof TOTAL_CAP_KEYS)[number];
export type TotalCaps = Record<TotalCapKey, number>;

const spec = (
  base: CapSpec,
  over: Partial<Pick<CapSpec, "flag" | "label">> & { default: number; ceiling: number },
): CapSpec => ({ ...base, ...over });

export const MATRIX_CELLS = 180;
export const INJECTION_RUNS_PER_MODEL = 45;
export const JUDGE_PAIRS_DEFAULT = 144;
export const JUDGE_PAIRS_CEILING = 360;

export const PROFILE_CAP_SPECS: Record<CapProfile, Record<CapKey, CapSpec>> = {
  golden: CAP_SPECS,
  matrix: {
    maxCases: spec(CAP_SPECS.maxCases, { flag: "--max-cells", label: "matrix cells per model", default: MATRIX_CELLS, ceiling: MATRIX_CELLS }),
    maxSteps: CAP_SPECS.maxSteps,
    maxTokens: spec(CAP_SPECS.maxTokens, { label: "tokens per model (input + output)", default: 22_000_000, ceiling: 44_000_000 }),
    maxUsd: spec(CAP_SPECS.maxUsd, { label: "US dollars per model (reported cost)", default: 60, ceiling: 120 }),
    maxMinutes: spec(CAP_SPECS.maxMinutes, { label: "minutes per model", default: 360, ceiling: 600 }),
  },
  injection: {
    maxCases: spec(CAP_SPECS.maxCases, { label: "injection runs per model", default: INJECTION_RUNS_PER_MODEL, ceiling: INJECTION_RUNS_PER_MODEL }),
    maxSteps: CAP_SPECS.maxSteps,
    maxTokens: spec(CAP_SPECS.maxTokens, { label: "tokens per model (input + output)", default: 9_000_000, ceiling: 18_000_000 }),
    maxUsd: spec(CAP_SPECS.maxUsd, { label: "US dollars per model (reported cost)", default: 25, ceiling: 50 }),
    maxMinutes: spec(CAP_SPECS.maxMinutes, { label: "minutes per model", default: 120, ceiling: 240 }),
  },
  judge: {
    maxCases: spec(CAP_SPECS.maxCases, { flag: "--max-pairs", label: "judged pairs", default: JUDGE_PAIRS_DEFAULT, ceiling: JUDGE_PAIRS_CEILING }),
    maxSteps: spec(CAP_SPECS.maxSteps, { label: "model calls per pair", default: 1, ceiling: 1 }),
    maxTokens: spec(CAP_SPECS.maxTokens, { default: 3_000_000, ceiling: 6_000_000 }),
    maxUsd: spec(CAP_SPECS.maxUsd, { default: 10, ceiling: 20 }),
    maxMinutes: spec(CAP_SPECS.maxMinutes, { default: 60, ceiling: 120 }),
  },
};

const TOTAL_BASE = { integer: true, env: "", flag: "", label: "", name: "max_tokens" } as const;

/** The whole-command caps of the modes that run once per model. */
export const TOTAL_CAP_SPECS: Partial<Record<CapProfile, Record<TotalCapKey, CapSpec>>> = {
  matrix: {
    maxTotalTokens: { ...TOTAL_BASE, name: "max_tokens", flag: "--max-total-tokens", env: "EVAL_MAX_TOTAL_TOKENS", label: "tokens over every model", default: 44_000_000, ceiling: 88_000_000 },
    maxTotalUsd: { ...TOTAL_BASE, name: "max_usd", integer: false, flag: "--max-total-usd", env: "EVAL_MAX_TOTAL_USD", label: "US dollars over every model", default: 80, ceiling: 200 },
  },
  injection: {
    maxTotalTokens: { ...TOTAL_BASE, name: "max_tokens", flag: "--max-total-tokens", env: "EVAL_MAX_TOTAL_TOKENS", label: "tokens over every model", default: 18_000_000, ceiling: 36_000_000 },
    maxTotalUsd: { ...TOTAL_BASE, name: "max_usd", integer: false, flag: "--max-total-usd", env: "EVAL_MAX_TOTAL_USD", label: "US dollars over every model", default: 35, ceiling: 90 },
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
 * reports each call to it.
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
  );
}

/** One model call's usage: tokens, and the provider's reported cost in dollars when it gave one. */
export interface StepUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
}

function tokenTotal(v: unknown): number | null {
  const n = typeof v === "object" && v !== null && "total" in v ? (v as { total: unknown }).total : v;
  return typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n : null;
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
  return { inputTokens, outputTokens, costUsd };
}

/** How the dollar cap stands: undecided until the first step, then fixed for the run. */
export type UsdEnforcement = "pending" | "enforced" | "not_enforced";

export interface BudgetTotals {
  cases: number;
  steps: number;
  maxStepsInTurn: number;
  inputTokens: number;
  outputTokens: number;
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
  private costUsd = 0;
  private lastInputTokens = 0;
  private maxStepCostUsd = 0;
  private usd: UsdEnforcement = "pending";

  /** The whole-command budget every call also reports to (a run over several models), or null. */
  private readonly parent: RunBudget | null;

  constructor(caps: EvalCaps, now: () => number = Date.now, parent: RunBudget | null = null) {
    this.caps = caps;
    this.now = now;
    this.startedAt = now();
    this.parent = parent;
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
   * reserve, or dollars spent plus the dearest call so far.
   */
  beforeStep(a: { maxOutputTokens?: number } = {}): void {
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
    if (this.usd === "enforced" && this.costUsd + this.maxStepCostUsd > this.caps.maxUsd) {
      throw this.trip("max_usd", `$${this.costUsd.toFixed(4)} spent; the next call (up to $${this.maxStepCostUsd.toFixed(4)}) could pass the cap of $${this.caps.maxUsd}`);
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
   * The first call decides the dollar cap: enforced when it reported a cost, not
   * enforced (tokens only) when it did not. Once enforced, a call without a cost trips
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
    this.lastInputTokens = usage.inputTokens;
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
      this.usd === "enforced"
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
      `| max_tokens (in ${t.inputTokens} / out ${t.outputTokens}) | ${t.inputTokens + t.outputTokens} | ${this.caps.maxTokens} |`,
      `| max_usd | ${usd} | $${this.caps.maxUsd} |`,
      `| max_minutes | ${(t.elapsedMs / 60_000).toFixed(1)} | ${this.caps.maxMinutes} |`,
    ].join("\n");
  }
}
