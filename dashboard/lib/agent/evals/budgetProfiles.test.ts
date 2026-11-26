// The matrix, injection and judge caps (Tasks 2.10, 2.12, 2.13): their own defaults and
// hard ceilings, the whole-command total over several models, and the golden A17 caps
// left exactly as they were. Pure; runs in CI.
import { describe, expect, test } from "vitest";
import { AGENT_EVAL_DEFAULT_MODEL, AGENT_SPOT_CHECK_MODEL } from "@/lib/agent/config";
import {
  PASS_USD_CEILING,
  PASS_USD_DEFAULT,
  parsePassUsd,
  passRemaining,
  CAP_DEFAULTS,
  CAP_KEYS,
  CAP_PROFILES,
  CAP_SPECS,
  CapExceededError,
  CapUsageError,
  MATRIX_CELLS,
  PROFILE_CAP_SPECS,
  PROFILE_REQUIRES_COST,
  RunBudget,
  TOTAL_CAP_KEYS,
  TOTAL_CAP_SPECS,
  capsFromEnv,
  capsToEnv,
  parseCaps,
  parseTotalCaps,
  profileCeilings,
  profileDefaults,
  profileBudget,
  profileFlags,
  totalBudget,
  totalCapsFromEnv,
  totalCapsToEnv,
} from "@/lib/agent/evals/budget";
import { estimateInjection, estimateJudge, estimateMatrix, matrixPlan, spotCheckPlan } from "@/lib/agent/evals/matrixPlan";
import { AGENT_JUDGE_MODEL } from "@/lib/agent/evals/judgeModel";

// A reported cost by default: the paid modes require one on every call (PROFILE_REQUIRES_COST).
const usage = (inputTokens: number, outputTokens: number, costUsd: number | null = 0.01) => ({ inputTokens, outputTokens, costUsd });

describe("cap profiles", () => {
  test("the golden profile is the A17 caps, with its dollar cap under $3 (PR J7)", () => {
    expect(PROFILE_CAP_SPECS.golden).toBe(CAP_SPECS);
    expect(profileDefaults("golden")).toEqual(CAP_DEFAULTS);
    expect(CAP_DEFAULTS).toEqual({ maxCases: 12, maxSteps: 8, maxTokens: 2_000_000, maxUsd: 2, maxMinutes: 30 });
    expect(profileCeilings("golden").maxUsd).toBe(3);
  });

  test("no mode can spend more than $3 on its own: every dollar ceiling is at most the pass's", () => {
    expect(PASS_USD_DEFAULT).toBe(3);
    expect(PASS_USD_CEILING).toBe(3);
    for (const profile of CAP_PROFILES) {
      expect(profileCeilings(profile).maxUsd, profile).toBeLessThanOrEqual(PASS_USD_CEILING);
      const t = TOTAL_CAP_SPECS[profile];
      if (t) expect(t.maxTotalUsd.ceiling, profile).toBeLessThanOrEqual(PASS_USD_CEILING);
    }
    expect(profileCeilings("spot-check").maxUsd).toBeLessThan(3);
    expect(profileDefaults("spot-check").maxCases).toBe(spotCheckPlan(AGENT_SPOT_CHECK_MODEL).length);
  });

  test("the pass budget: $3 by default, lowered by a flag and never raised; what is left goes down to the cent", () => {
    expect(parsePassUsd(undefined)).toBe(3);
    expect(parsePassUsd("2.5")).toBe(2.5);
    expect(() => parsePassUsd("3.01")).toThrow(/ceiling of 3/);
    expect(() => parsePassUsd("0")).toThrow(CapUsageError);
    expect(passRemaining(3, [])).toBe(3);
    expect(passRemaining(3, [1.2345])).toBe(1.76);
    expect(passRemaining(3, [2.71])).toBe(0.29);
    expect(passRemaining(3, [2.995])).toBe(0);
    expect(passRemaining(3, [3.2])).toBe(0);
    // A spend that is not a number leaves nothing: the pass fails closed.
    expect(passRemaining(3, [0.5, Number.NaN])).toBe(0);
    expect(passRemaining(3, [-1])).toBe(0);
  });

  test("every profile's defaults sit within its ceilings, and no step cap passes the route's", () => {
    for (const profile of CAP_PROFILES) {
      const d = profileDefaults(profile);
      const c = profileCeilings(profile);
      for (const key of CAP_KEYS) {
        expect(d[key], `${profile}.${key}`).toBeGreaterThan(0);
        expect(d[key], `${profile}.${key}`).toBeLessThanOrEqual(c[key]);
      }
      expect(c.maxSteps, profile).toBeLessThanOrEqual(CAP_SPECS.maxSteps.ceiling);
    }
    for (const profile of ["matrix", "injection"] as const) {
      const t = TOTAL_CAP_SPECS[profile];
      expect(t, profile).toBeDefined();
      for (const key of TOTAL_CAP_KEYS) expect(t![key].default).toBeLessThanOrEqual(t![key].ceiling);
    }
    expect(TOTAL_CAP_SPECS.golden).toBeUndefined();
    expect(TOTAL_CAP_SPECS.judge).toBeUndefined();
  });

  test("each default holds the full run's uncached Haiku 5.5 estimate with headroom (PR J7)", () => {
    const model = AGENT_EVAL_DEFAULT_MODEL;
    const m = profileDefaults("matrix");
    expect(m.maxCases).toBe(MATRIX_CELLS);
    const e = estimateMatrix(matrixPlan([model]), model).total;
    expect(e.inputTokens + e.outputTokens).toBeLessThanOrEqual(m.maxTokens / 1.2);
    expect(e.costMicros).toBeLessThanOrEqual((m.maxUsd * 1_000_000) / 1.2);
    expect(e.inputTokens + e.outputTokens).toBeLessThanOrEqual(TOTAL_CAP_SPECS.matrix!.maxTotalTokens.default);
    expect(e.costMicros).toBeLessThanOrEqual((TOTAL_CAP_SPECS.matrix!.maxTotalUsd.default * 1_000_000) / 1.2);

    const i = profileDefaults("injection");
    const inj = estimateInjection(model, i.maxCases);
    expect(inj.inputTokens + inj.outputTokens).toBeLessThanOrEqual(i.maxTokens / 1.2);
    expect(inj.costMicros).toBeLessThanOrEqual((i.maxUsd * 1_000_000) / 1.2);

    const j = profileDefaults("judge");
    expect(AGENT_JUDGE_MODEL).toBe(AGENT_EVAL_DEFAULT_MODEL);
    const judge = estimateJudge(AGENT_JUDGE_MODEL, j.maxCases);
    expect(judge.inputTokens + judge.outputTokens).toBeLessThanOrEqual(j.maxTokens / 1.2);
    expect(judge.costMicros).toBeLessThanOrEqual((j.maxUsd * 1_000_000) / 1.2);

    // The spot check's cap holds its uncached Sonnet estimate, under $3.
    const s = profileDefaults("spot-check");
    const spot = estimateMatrix(spotCheckPlan(AGENT_SPOT_CHECK_MODEL), AGENT_SPOT_CHECK_MODEL).total;
    expect(spot.costMicros).toBeLessThanOrEqual(s.maxUsd * 1_000_000);
    expect(spot.inputTokens + spot.outputTokens).toBeLessThanOrEqual(s.maxTokens / 1.2);

    // A full Sonnet matrix no longer fits any cap: it would stop at $3.
    const sonnet = estimateMatrix(matrixPlan([AGENT_SPOT_CHECK_MODEL]), AGENT_SPOT_CHECK_MODEL).total;
    expect(sonnet.costMicros).toBeGreaterThan(profileCeilings("matrix").maxUsd * 1_000_000);
  });

  test("a profile's flags are refused above their ceilings, and lowered values pass", () => {
    expect(() => parseCaps({ maxCases: "181" }, "matrix")).toThrow(CapUsageError);
    expect(() => parseCaps({ maxUsd: "3.01" }, "matrix")).toThrow(/ceiling of 3/);
    expect(() => parseCaps({ maxSteps: "2" }, "judge")).toThrow(CapUsageError);
    expect(parseCaps({ maxCases: "6", maxUsd: "1.25" }, "matrix")).toMatchObject({ maxCases: 6, maxUsd: 1.25 });
    expect(() => parseTotalCaps({ maxTotalUsd: "3.5" }, "matrix")).toThrow(CapUsageError);
    expect(parseTotalCaps({ maxTotalUsd: "2" }, "matrix")).toEqual({ maxTotalTokens: 44_000_000, maxTotalUsd: 2 });
    expect(() => parseCaps({ maxUsd: "2.95" }, "spot-check")).toThrow(/ceiling of 2.9/);
    expect(() => parseCaps({ maxCases: "13" }, "spot-check")).toThrow(CapUsageError);
    expect(() => parseTotalCaps({ maxTotalUsd: "1" }, "golden")).toThrow(/no whole-command caps/);
    expect(parseTotalCaps({}, "judge")).toBeNull();
  });

  test("the matrix names its cell cap --max-cells and the judge its pair cap --max-pairs", () => {
    expect([...profileFlags("matrix").keys()]).toEqual([
      "--max-cells",
      "--max-steps",
      "--max-tokens",
      "--max-usd",
      "--max-minutes",
      "--max-total-tokens",
      "--max-total-usd",
    ]);
    expect(profileFlags("judge").get("--max-pairs")).toEqual({ key: "maxCases", total: false });
    expect(profileFlags("golden").has("--max-total-usd")).toBe(false);
  });

  test("caps and totals survive the round trip through the environment and are re-checked there", () => {
    const caps = parseCaps({ maxCases: "9" }, "matrix");
    expect(capsFromEnv(capsToEnv(caps, "matrix"), "matrix")).toEqual(caps);
    const totals = parseTotalCaps({ maxTotalTokens: "1000000" }, "injection");
    expect(totalCapsFromEnv(totalCapsToEnv(totals, "injection"), "injection")).toEqual(totals);
    expect(() => capsFromEnv({ EVAL_MAX_CASES: "999" }, "matrix")).toThrow(CapUsageError);
    expect(() => totalCapsFromEnv({ EVAL_MAX_TOTAL_USD: "999" }, "matrix")).toThrow(CapUsageError);
  });
});

describe("the whole-command budget", () => {
  const modelCaps = { maxCases: 10, maxSteps: 8, maxTokens: 1_000_000, maxUsd: 100, maxMinutes: 60 };

  test("every model's calls add up in the total, and the total's cap stops the second model", () => {
    const total = totalBudget({ maxTotalTokens: 30_000, maxTotalUsd: 100 });
    const first = new RunBudget(modelCaps, Date.now, total);
    first.startCase();
    first.startTurn();
    first.beforeStep({ maxOutputTokens: 1000 });
    first.recordStep(usage(12_000, 1_000));
    expect(total.totals.inputTokens).toBe(12_000);

    const second = new RunBudget(modelCaps, Date.now, total);
    second.startCase();
    second.startTurn();
    second.beforeStep({ maxOutputTokens: 1000 });
    second.recordStep(usage(14_000, 1_000));
    // 28k used: the next call (14k input + 4k reserve) could pass the 30k total.
    let thrown: unknown;
    try {
      second.beforeStep();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(CapExceededError);
    expect((thrown as CapExceededError).cap).toBe("max_tokens");
    expect((thrown as CapExceededError).detail).toMatch(/^whole command: /);
    expect(second.signal.aborted).toBe(true);
    expect(total.tripped?.cap).toBe("max_tokens");
    // The refused call was never counted.
    expect(second.totals.steps).toBe(1);
  });

  test("a total that trips aborts a model's run in flight, and a model's own cap never trips the total", () => {
    const total = totalBudget({ maxTotalTokens: 12_000, maxTotalUsd: 100 });
    const run = new RunBudget({ ...modelCaps, maxTokens: 5_000 }, Date.now, total);
    run.startCase();
    run.startTurn();
    run.beforeStep({ maxOutputTokens: 500 });
    run.recordStep(usage(4_000, 2_000));
    expect(run.tripped?.cap).toBe("max_tokens");
    expect(total.tripped).toBeNull();

    const next = new RunBudget(modelCaps, Date.now, total);
    next.startCase();
    next.startTurn();
    next.beforeStep({ maxOutputTokens: 500 });
    next.recordStep(usage(5_000, 2_000));
    expect(total.tripped?.cap).toBe("max_tokens");
    expect(next.signal.aborted).toBe(true);
    expect(() => next.startCase()).toThrow(CapExceededError);
  });

  test("a call with no reported cost trips the total as cost_unknown, so the whole command stops", () => {
    const total = totalBudget({ maxTotalTokens: 1_000_000, maxTotalUsd: 100 });
    const run = profileBudget("matrix", modelCaps, total);
    run.startCase();
    run.startTurn();
    run.beforeStep();
    run.recordStep(usage(1_000, 100, null));
    expect(total.tripped?.cap).toBe("cost_unknown");
    expect(run.tripped?.cap).toBe("cost_unknown");
    expect(run.signal.aborted).toBe(true);
    expect(() => run.beforeStep()).toThrow(/cost_unknown/);
    const later = profileBudget("matrix", modelCaps, total);
    expect(() => later.startCase()).toThrow(/cost_unknown/);
  });

  test("unknown usage in any model trips the total, so the whole command stops", () => {
    const total = totalBudget({ maxTotalTokens: 1_000_000, maxTotalUsd: 100 });
    const run = new RunBudget(modelCaps, Date.now, total);
    run.startCase();
    run.startTurn();
    run.beforeStep();
    run.recordStep(null);
    expect(run.tripped?.cap).toBe("usage_unknown");
    expect(total.tripped?.cap).toBe("usage_unknown");
    const later = new RunBudget(modelCaps, Date.now, total);
    expect(later.signal.aborted).toBe(true);
    expect(() => later.startCase()).toThrow(/usage_unknown/);
  });
});

describe("dollar caps never switch off in the paid modes (cost_unknown)", () => {
  const caps = { maxCases: 10, maxSteps: 8, maxTokens: 1_000_000, maxUsd: 1, maxMinutes: 60 };
  const step = (b: RunBudget, u: ReturnType<typeof usage>) => {
    b.beforeStep();
    b.recordStep(u);
  };

  test("the matrix, injection and judge require a reported cost; the golden run keeps A17's rule", () => {
    expect(PROFILE_REQUIRES_COST).toEqual({ golden: false, matrix: true, injection: true, judge: true, "spot-check": true });
    expect(profileBudget("golden", caps).requireCost).toBe(false);
    expect(totalBudget({ maxTotalTokens: 1_000, maxTotalUsd: 1 }).requireCost).toBe(true);
  });

  for (const profile of ["matrix", "injection", "judge"] as const) {
    test(`${profile}: a first call without a cost trips cost_unknown, counts its tokens and refuses the next call`, () => {
      const b = profileBudget(profile, caps);
      b.startCase();
      b.startTurn();
      step(b, usage(2_000, 300, null));
      expect(b.tripped?.cap).toBe("cost_unknown");
      expect(b.signal.aborted).toBe(true);
      expect(b.usdEnforcement).not.toBe("not_enforced");
      expect(b.totals.inputTokens).toBe(2_000);
      expect(() => b.beforeStep()).toThrow(CapExceededError);
      expect(() => b.endTurn()).toThrow(/cost_unknown/);
      expect(b.report()).toMatch(/cap_exceeded \(cost_unknown/);
    });
  }

  test("a later call without a cost trips cost_unknown too, after the cap was enforced", () => {
    const b = profileBudget("matrix", caps);
    b.startCase();
    b.startTurn();
    step(b, usage(1_000, 100, 0.2));
    expect(b.usdEnforcement).toBe("enforced");
    step(b, usage(1_000, 100, null));
    expect(b.tripped?.cap).toBe("cost_unknown");
  });

  test("with every cost reported, max_usd still trips as before", () => {
    const b = profileBudget("judge", caps);
    b.startCase();
    b.startTurn();
    step(b, usage(1_000, 100, 0.6));
    // $0.60 spent plus the dearest call so far could pass $1: refused before it is sent.
    expect(() => b.beforeStep()).toThrow(/max_usd/);
    expect(b.tripped?.cap).toBe("max_usd");
  });

  test("the golden run is unchanged: no cost on the first call means tokens only, reported as not enforced", () => {
    const b = profileBudget("golden", caps);
    b.startCase();
    b.startTurn();
    step(b, usage(1_000, 100, null));
    expect(b.tripped).toBeNull();
    expect(b.usdEnforcement).toBe("not_enforced");
  });
});
