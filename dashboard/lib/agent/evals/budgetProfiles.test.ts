// The matrix, injection and judge caps (Tasks 2.10, 2.12, 2.13): their own defaults and
// hard ceilings, the whole-command total over several models, and the golden A17 caps
// left exactly as they were. Pure; runs in CI.
import { describe, expect, test } from "vitest";
import { AGENT_EVAL_MODELS } from "@/lib/agent/config";
import {
  CAP_DEFAULTS,
  CAP_KEYS,
  CAP_PROFILES,
  CAP_SPECS,
  CapExceededError,
  CapUsageError,
  MATRIX_CELLS,
  PROFILE_CAP_SPECS,
  RunBudget,
  TOTAL_CAP_KEYS,
  TOTAL_CAP_SPECS,
  capsFromEnv,
  capsToEnv,
  parseCaps,
  parseTotalCaps,
  profileCeilings,
  profileDefaults,
  profileFlags,
  totalBudget,
  totalCapsFromEnv,
  totalCapsToEnv,
} from "@/lib/agent/evals/budget";
import { estimateInjection, estimateJudge, estimateMatrix, matrixPlan } from "@/lib/agent/evals/matrixPlan";
import { AGENT_JUDGE_MODEL } from "@/lib/agent/evals/judgeModel";

const usage = (inputTokens: number, outputTokens: number, costUsd: number | null = null) => ({ inputTokens, outputTokens, costUsd });

describe("cap profiles", () => {
  test("the golden profile is the A17 caps, unchanged", () => {
    expect(PROFILE_CAP_SPECS.golden).toBe(CAP_SPECS);
    expect(profileDefaults("golden")).toEqual(CAP_DEFAULTS);
    expect(CAP_DEFAULTS).toEqual({ maxCases: 12, maxSteps: 8, maxTokens: 2_000_000, maxUsd: 5, maxMinutes: 30 });
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

  test("each default holds the full run's Sonnet estimate with headroom, and the total holds every model's", () => {
    const plan = matrixPlan(AGENT_EVAL_MODELS);
    const m = profileDefaults("matrix");
    expect(m.maxCases).toBe(MATRIX_CELLS);
    let tokens = 0;
    let micros = 0;
    for (const model of AGENT_EVAL_MODELS) {
      const e = estimateMatrix(plan, model).total;
      expect(e.inputTokens + e.outputTokens, model).toBeLessThanOrEqual(m.maxTokens / 1.2);
      expect(e.costMicros, model).toBeLessThanOrEqual((m.maxUsd * 1_000_000) / 1.2);
      tokens += e.inputTokens + e.outputTokens;
      micros += e.costMicros;
    }
    expect(tokens).toBeLessThanOrEqual(TOTAL_CAP_SPECS.matrix!.maxTotalTokens.default);
    expect(micros).toBeLessThanOrEqual(TOTAL_CAP_SPECS.matrix!.maxTotalUsd.default * 1_000_000);

    const i = profileDefaults("injection");
    const inj = estimateInjection(AGENT_EVAL_MODELS[0], i.maxCases);
    expect(inj.inputTokens + inj.outputTokens).toBeLessThanOrEqual(i.maxTokens / 1.2);
    expect(inj.costMicros).toBeLessThanOrEqual((i.maxUsd * 1_000_000) / 1.2);

    const j = profileDefaults("judge");
    const judge = estimateJudge(AGENT_JUDGE_MODEL, j.maxCases);
    expect(judge.inputTokens + judge.outputTokens).toBeLessThanOrEqual(j.maxTokens / 1.2);
    expect(judge.costMicros).toBeLessThanOrEqual((j.maxUsd * 1_000_000) / 1.2);
  });

  test("a profile's flags are refused above their ceilings, and lowered values pass", () => {
    expect(() => parseCaps({ maxCases: "181" }, "matrix")).toThrow(CapUsageError);
    expect(() => parseCaps({ maxUsd: "120.01" }, "matrix")).toThrow(/ceiling of 120/);
    expect(() => parseCaps({ maxSteps: "2" }, "judge")).toThrow(CapUsageError);
    expect(parseCaps({ maxCases: "6", maxUsd: "12.5" }, "matrix")).toMatchObject({ maxCases: 6, maxUsd: 12.5 });
    expect(() => parseTotalCaps({ maxTotalUsd: "201" }, "matrix")).toThrow(CapUsageError);
    expect(parseTotalCaps({ maxTotalUsd: "40" }, "matrix")).toEqual({ maxTotalTokens: 44_000_000, maxTotalUsd: 40 });
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
