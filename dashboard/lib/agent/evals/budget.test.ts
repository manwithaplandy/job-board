// The live eval's spend caps (gate A17): every cap trips, unknown usage trips, flags above
// their ceilings are refused, and the defaults sit within them. Pure; runs in CI.
import { afterEach, describe, expect, test, vi } from "vitest";
import { AGENT_LIMITS } from "@/lib/agent/config";
import { PERSONA_IDS } from "@/lib/agent/evals/personas";
import { SCENARIO_IDS } from "@/lib/agent/evals/scenarios";
import {
  ALL_CASES,
  CAP_CEILINGS,
  CAP_DEFAULTS,
  CAP_KEYS,
  CAP_SPECS,
  CapExceededError,
  CapUsageError,
  DEFAULT_OUTPUT_RESERVE,
  ROUTE_MAX_STEPS,
  RunBudget,
  capsFromEnv,
  capsToEnv,
  parseCaps,
  readStepUsage,
  type CapName,
  type EvalCaps,
} from "@/lib/agent/evals/budget";

const caps = (over: Partial<EvalCaps> = {}): EvalCaps => ({ ...CAP_DEFAULTS, ...over });
const usage = (inputTokens: number, outputTokens: number, costUsd: number | null = null) => ({ inputTokens, outputTokens, costUsd });

/** Runs `f`, expecting it to throw CapExceededError for `cap`. */
function expectCap(f: () => unknown, cap: CapName): void {
  let thrown: unknown;
  try {
    f();
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(CapExceededError);
  expect((thrown as CapExceededError).cap).toBe(cap);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("defaults and ceilings", () => {
  test("every default is within its ceiling, and the USD ones within the approved bounds", () => {
    for (const key of CAP_KEYS) {
      expect(CAP_DEFAULTS[key], key).toBeGreaterThan(0);
      expect(CAP_DEFAULTS[key], key).toBeLessThanOrEqual(CAP_CEILINGS[key]);
    }
    expect(CAP_DEFAULTS.maxUsd).toBeLessThanOrEqual(5);
    expect(CAP_CEILINGS.maxUsd).toBeLessThanOrEqual(20);
    expect(CAP_DEFAULTS.maxMinutes).toBe(30);
    expect(CAP_CEILINGS.maxMinutes).toBe(60);
  });

  test("the step ceiling is the route's own step limit", () => {
    expect(ROUTE_MAX_STEPS).toBe(AGENT_LIMITS.maxSteps);
    expect(CAP_CEILINGS.maxSteps).toBeLessThanOrEqual(AGENT_LIMITS.maxSteps);
    expect(DEFAULT_OUTPUT_RESERVE).toBe(AGENT_LIMITS.maxOutputTokens);
  });

  test("all 12 cases are the default and the ceiling", () => {
    expect(ALL_CASES).toBe(SCENARIO_IDS.length * PERSONA_IDS.length);
    expect(CAP_DEFAULTS.maxCases).toBe(ALL_CASES);
    expect(CAP_CEILINGS.maxCases).toBe(ALL_CASES);
  });

  test("the token ceiling is a sane multiple of the default", () => {
    expect(CAP_CEILINGS.maxTokens / CAP_DEFAULTS.maxTokens).toBeGreaterThanOrEqual(2);
    expect(CAP_CEILINGS.maxTokens / CAP_DEFAULTS.maxTokens).toBeLessThanOrEqual(5);
  });
});

describe("flags", () => {
  test("missing flags take their defaults", () => {
    expect(parseCaps({})).toEqual(CAP_DEFAULTS);
    expect(capsFromEnv({})).toEqual(CAP_DEFAULTS);
  });

  test("a flag may lower its cap, up to the ceiling itself", () => {
    expect(parseCaps({ maxCases: "3", maxSteps: "4", maxTokens: "100000", maxUsd: "1.25", maxMinutes: "10" })).toEqual({
      maxCases: 3,
      maxSteps: 4,
      maxTokens: 100_000,
      maxUsd: 1.25,
      maxMinutes: 10,
    });
    const atCeilings = Object.fromEntries(CAP_KEYS.map((k) => [k, String(CAP_CEILINGS[k])]));
    expect(parseCaps(atCeilings)).toEqual(CAP_CEILINGS);
  });

  test.each(CAP_KEYS)("%s above its ceiling is a usage error naming the flag", (key) => {
    const above = String(CAP_CEILINGS[key] + 1);
    expect(() => parseCaps({ [key]: above })).toThrow(CapUsageError);
    expect(() => parseCaps({ [key]: above })).toThrow(`${CAP_SPECS[key].flag} ${above} is above its ceiling`);
    expect(() => capsFromEnv({ [CAP_SPECS[key].env]: above })).toThrow(CapUsageError);
  });

  test.each([
    ["maxCases", "0"],
    ["maxSteps", "-1"],
    ["maxTokens", "1e6"],
    ["maxTokens", "2.5"],
    ["maxMinutes", "ten"],
    ["maxUsd", "0"],
    ["maxUsd", "1.234"],
    ["maxUsd", "Infinity"],
    ["maxUsd", ""],
  ] as const)("%s %j is a usage error", (key, raw) => {
    expect(() => parseCaps({ [key]: raw })).toThrow(CapUsageError);
  });

  test("capsToEnv and capsFromEnv round-trip", () => {
    const c = caps({ maxCases: 2, maxUsd: 0.5 });
    expect(capsFromEnv(capsToEnv(c))).toEqual(c);
  });
});

describe("readStepUsage", () => {
  test("reads the token totals and OpenRouter's reported cost", () => {
    const u = { inputTokens: { total: 1200, noCache: 1200 }, outputTokens: { total: 80, text: 80 } };
    const none = { cacheReadTokens: 0, cacheWriteTokens: 0 };
    expect(readStepUsage(u, { openrouter: { usage: { cost: 0.0042 } } })).toEqual({ ...usage(1200, 80, 0.0042), ...none });
    expect(readStepUsage(u, undefined)).toEqual({ ...usage(1200, 80, null), ...none });
    expect(readStepUsage(u, { openrouter: { usage: { cost: -1 } } })).toEqual({ ...usage(1200, 80, null), ...none });
  });

  test("reads the prompt cache's read and write counts, which a run's totals and report carry (PR J7)", () => {
    const u = { inputTokens: { total: 1200, noCache: 200, cacheRead: 900, cacheWrite: 100 }, outputTokens: { total: 80 } };
    expect(readStepUsage(u, { openrouter: { usage: { cost: 0.001 } } })).toEqual({
      ...usage(1200, 80, 0.001),
      cacheReadTokens: 900,
      cacheWriteTokens: 100,
    });
    // Malformed or larger than the input: never more than the input, never negative.
    const bad = { inputTokens: { total: 50, cacheRead: 900, cacheWrite: -3 }, outputTokens: { total: 1 } };
    expect(readStepUsage(bad, undefined)).toMatchObject({ cacheReadTokens: 50, cacheWriteTokens: 0 });
    const b = new RunBudget(caps());
    b.startCase();
    b.startTurn();
    b.beforeStep();
    b.recordStep(readStepUsage(u, { openrouter: { usage: { cost: 0.001 } } }));
    expect(b.totals).toMatchObject({ inputTokens: 1200, cacheReadTokens: 900, cacheWriteTokens: 100 });
    expect(b.report()).toContain("cache read 900 / written 100");
  });

  test.each([
    ["no usage", undefined],
    ["no input total", { inputTokens: { total: undefined }, outputTokens: { total: 5 } }],
    ["no output total", { inputTokens: { total: 5 }, outputTokens: {} }],
    ["a fractional count", { inputTokens: { total: 1.5 }, outputTokens: { total: 5 } }],
    ["a negative count", { inputTokens: { total: -1 }, outputTokens: { total: 5 } }],
    ["a string count", { inputTokens: { total: "5" }, outputTokens: { total: 5 } }],
  ])("unknown when %s", (_name, u) => {
    expect(readStepUsage(u, { openrouter: { usage: { cost: 0.01 } } })).toBeNull();
  });
});

describe("RunBudget", () => {
  test("a run within every cap stays untripped", () => {
    const b = new RunBudget(caps());
    b.startCase();
    b.startTurn();
    b.beforeStep();
    b.recordStep(usage(10_000, 300, 0.03));
    expect(b.tripped).toBeNull();
    expect(b.totals).toMatchObject({ cases: 1, steps: 1, inputTokens: 10_000, outputTokens: 300, costUsd: 0.03 });
    expect(b.usdEnforcement).toBe("enforced");
    expect(b.report()).toContain("Run: within caps");
  });

  test("max_cases trips past the cap", () => {
    const b = new RunBudget(caps({ maxCases: 2 }));
    b.startCase();
    b.startCase();
    expectCap(() => b.startCase(), "max_cases");
    expect(b.tripped?.cap).toBe("max_cases");
  });

  test("max_steps trips at the step past the per-turn cap, and a new turn starts the count again", () => {
    const b = new RunBudget(caps({ maxSteps: 2 }));
    b.startCase();
    b.startTurn();
    for (let i = 0; i < 2; i++) {
      b.beforeStep();
      b.recordStep(usage(10, 1));
    }
    b.startTurn();
    b.beforeStep();
    b.recordStep(usage(10, 1));
    b.beforeStep();
    b.recordStep(usage(10, 1));
    expectCap(() => b.beforeStep(), "max_steps");
  });

  test("max_tokens trips once the total passes the cap", () => {
    const b = new RunBudget(caps({ maxTokens: 1000 }));
    b.beforeStep({ maxOutputTokens: 100 });
    b.recordStep(usage(900, 200));
    expect(b.tripped?.cap).toBe("max_tokens");
    expectCap(() => b.beforeStep(), "max_tokens");
  });

  test("max_tokens trips before a call that could pass the cap", () => {
    const b = new RunBudget(caps({ maxTokens: 10_000 }));
    b.beforeStep({ maxOutputTokens: 1000 });
    b.recordStep(usage(4000, 500));
    // 4500 used + 4000 (the last input) + 1000 (this call's output) = 9500: allowed.
    b.beforeStep({ maxOutputTokens: 1000 });
    b.recordStep(usage(4400, 500));
    // 9400 used + 4400 + 1000 > 10000: refused before the call.
    expectCap(() => b.beforeStep({ maxOutputTokens: 1000 }), "max_tokens");
    expect(b.totals.steps).toBe(2);
  });

  test("max_usd trips once the reported cost passes the cap", () => {
    const b = new RunBudget(caps({ maxUsd: 1 }));
    b.beforeStep();
    b.recordStep(usage(10, 1, 0.3));
    // $0.30 + $0.30 (dearest so far) is within $1, so the call goes; it then costs $0.80.
    b.beforeStep();
    b.recordStep(usage(10, 1, 0.8));
    expect(b.tripped?.cap).toBe("max_usd");
    expectCap(() => b.beforeStep(), "max_usd");
  });

  test("max_usd trips before a call that could pass the cap at the dearest call so far", () => {
    const b = new RunBudget(caps({ maxUsd: 1 }));
    b.beforeStep();
    b.recordStep(usage(10, 1, 0.45));
    b.beforeStep();
    b.recordStep(usage(10, 1, 0.1));
    // $0.55 spent + $0.45 (dearest) = $1.00: allowed; one more cent would not be.
    b.beforeStep();
    b.recordStep(usage(10, 1, 0.01));
    expectCap(() => b.beforeStep(), "max_usd");
  });

  test("without a reported cost the dollar cap is not enforced and the token cap still is", () => {
    const b = new RunBudget(caps({ maxUsd: 0.01, maxTokens: 50_000 }));
    b.beforeStep();
    b.recordStep(usage(1000, 10, null));
    expect(b.usdEnforcement).toBe("not_enforced");
    expect(b.tripped).toBeNull();
    expect(b.report()).toContain("not enforced");
    b.beforeStep();
    b.recordStep(usage(60_000, 10, null));
    expect(b.tripped?.cap).toBe("max_tokens");
  });

  test("max_minutes trips at the next check once the wall clock runs out", () => {
    let now = 0;
    const b = new RunBudget(caps({ maxMinutes: 1 }), () => now);
    b.startCase();
    now = 60_000;
    expectCap(() => b.startTurn(), "max_minutes");
  });

  test("max_minutes trips by itself, aborting a call in flight", () => {
    vi.useFakeTimers();
    const b = new RunBudget(caps({ maxMinutes: 1 }));
    b.armClock();
    b.beforeStep();
    vi.advanceTimersByTime(60_000);
    expect(b.tripped?.cap).toBe("max_minutes");
    expect(b.signal.aborted).toBe(true);
    expect(b.signal.reason).toBeInstanceOf(CapExceededError);
  });

  test("unreadable usage trips usage_unknown, never counts as zero", () => {
    const b = new RunBudget(caps());
    b.beforeStep();
    b.recordStep(null);
    expect(b.tripped?.cap).toBe("usage_unknown");
    expectCap(() => b.beforeStep(), "usage_unknown");
    expect(b.signal.aborted).toBe(true);
  });

  test("a call that never reported its usage trips usage_unknown at the next call", () => {
    const b = new RunBudget(caps());
    b.beforeStep();
    expectCap(() => b.beforeStep(), "usage_unknown");
  });

  test("a turn that ends with a call's usage unread trips usage_unknown", () => {
    const b = new RunBudget(caps());
    b.startTurn();
    b.beforeStep();
    b.recordStep(usage(10, 1));
    b.endTurn();
    b.startTurn();
    b.beforeStep();
    expectCap(() => b.endTurn(), "usage_unknown");
  });

  test("a missing cost after earlier calls reported one trips usage_unknown", () => {
    const b = new RunBudget(caps());
    b.beforeStep();
    b.recordStep(usage(10, 1, 0.01));
    b.beforeStep();
    b.recordStep(usage(10, 1, null));
    expect(b.tripped?.cap).toBe("usage_unknown");
  });

  test("the first cap to trip stays the run's cap, and everything after refuses", () => {
    const b = new RunBudget(caps({ maxTokens: 100 }));
    b.beforeStep({ maxOutputTokens: 10 });
    b.recordStep(usage(200, 1));
    b.recordStep(null);
    expect(b.tripped?.cap).toBe("max_tokens");
    expectCap(() => b.startCase(), "max_tokens");
    expectCap(() => b.startTurn(), "max_tokens");
    expectCap(() => b.throwIfTripped(), "max_tokens");
    expect(b.report()).toContain("Run: cap_exceeded (max_tokens");
  });
});
