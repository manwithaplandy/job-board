// The variant matrix's plan and the dry run's estimate (plan Task 2.10). Pure; runs in CI.
import { describe, expect, test } from "vitest";
import { AGENT_EVAL_DEFAULT_MODEL, AGENT_EVAL_MODELS, AGENT_MODEL_DEFAULT } from "@/lib/agent/config";
import { PERSONA_IDS } from "@/lib/agent/evals/personas";
import { SCENARIO_IDS } from "@/lib/agent/evals/scenarios";
import { PRICE_PER_MTOK_MICROS } from "@/lib/agent/budget";
import { profileDefaults, TOTAL_CAP_SPECS, parseTotalCaps } from "@/lib/agent/evals/budget";
import { JUDGE_MAX_OUTPUT_TOKENS } from "@/lib/agent/evals/judge";
import {
  MATRIX_PERSONAS,
  MATRIX_SCENARIOS,
  CACHE_SHARES,
  NonDefaultModelError,
  SPOT_CHECK_PERSONA,
  UnpricedModelError,
  assertDefaultModelOrAllowed,
  assertPricedModels,
  JUDGE_OUTPUT_LIMIT,
  callReserveMicros,
  estimateJudge,
  estimatePass,
  formatPassDryRun,
  fullWindowReserveMicros,
  passStageFits,
  runReserveMicros,
  isMatrixPersona,
  nonDefaultModels,
  spotCheckPlan,
  cellKey,
  estimateInjection,
  estimateMatrix,
  unpricedModels,
  formatMatrixDryRun,
  formatSimpleDryRun,
  formatRerenderOnlyDryRun,
  rerenderOnlyCells,
  V1_SURFACES,
  matrixPlan,
  runModels,
} from "@/lib/agent/evals/matrixPlan";

describe("matrixPlan", () => {
  test("the plan's scenarios and personas are the eval's own", () => {
    expect([...MATRIX_SCENARIOS]).toEqual([...SCENARIO_IDS]);
    expect([...MATRIX_PERSONAS]).toEqual([...PERSONA_IDS]);
  });

  test("matrix plan has 180 cells and variants 2 and 3 reuse variant 1's gathered data", () => {
    const plan = matrixPlan(["m"]);
    expect(plan).toHaveLength(180);
    expect(new Set(plan.map(cellKey)).size).toBe(180);
    const live = plan.filter((c) => c.variant === 1);
    expect(live).toHaveLength(60);
    expect(live.every((c) => c.kind === "live" && c.from === null)).toBe(true);
    const liveKeys = new Set(live.map(cellKey));
    for (const c of plan.filter((x) => x.variant !== 1)) {
      expect(c.kind).toBe("rerender");
      expect(liveKeys.has(c.from!)).toBe(true);
      // The same scenario, persona and repeat: the re-render shows that run's data.
      expect(c.from).toBe(cellKey({ ...c, variant: 1 }));
      // ...and comes after it, so the data exists when the re-render runs.
      expect(plan.findIndex((x) => cellKey(x) === c.from)).toBeLessThan(plan.indexOf(c));
    }
  });

  test("a plan over two models runs each model's 180 cells in turn, the first model first", () => {
    const plan = matrixPlan(AGENT_EVAL_MODELS);
    expect(plan).toHaveLength(180 * AGENT_EVAL_MODELS.length);
    expect(plan[0].model).toBe(AGENT_EVAL_MODELS[0]);
    expect(plan[180].model).toBe(AGENT_EVAL_MODELS[1]);
    expect(AGENT_EVAL_MODELS[0]).toMatch(/sonnet/);
  });

  test("runModels: --models wins, then --model, then the eval default, Haiku 5.5 (PR J7)", () => {
    expect(runModels({ models: ["a", "b"], model: "c" })).toEqual(["a", "b"]);
    expect(runModels({ model: "c" })).toEqual(["c"]);
    expect(runModels({})).toEqual([AGENT_EVAL_DEFAULT_MODEL]);
    expect(AGENT_EVAL_DEFAULT_MODEL).toBe("anthropic/claude-haiku-5.5");
    // Production's own model is not the eval's: it stays Sonnet 5.5.
    expect(AGENT_MODEL_DEFAULT).toBe("anthropic/claude-sonnet-5.5");
  });

  test("any model but Haiku 5.5 needs an explicit allowance", () => {
    expect(nonDefaultModels([AGENT_EVAL_DEFAULT_MODEL])).toEqual([]);
    expect(nonDefaultModels([...AGENT_EVAL_MODELS])).toEqual(["anthropic/claude-sonnet-5.5"]);
    expect(() => assertDefaultModelOrAllowed([...AGENT_EVAL_MODELS], false)).toThrow(NonDefaultModelError);
    expect(() => assertDefaultModelOrAllowed([...AGENT_EVAL_MODELS], false)).toThrow(/--allow-non-haiku/);
    expect(() => assertDefaultModelOrAllowed([...AGENT_EVAL_MODELS], true)).not.toThrow();
    expect(() => assertDefaultModelOrAllowed([AGENT_EVAL_DEFAULT_MODEL], false)).not.toThrow();
  });

  test("the spot check: one persona, one repeat, every scenario and variant, in plan order", () => {
    const plan = spotCheckPlan("m");
    expect(plan).toHaveLength(12);
    expect(new Set(plan.map((c) => c.persona))).toEqual(new Set([SPOT_CHECK_PERSONA]));
    expect(new Set(plan.map((c) => c.repeat))).toEqual(new Set([1]));
    expect(new Set(plan.map((c) => c.scenario))).toEqual(new Set(MATRIX_SCENARIOS));
    expect(plan.filter((c) => c.variant === 1)).toHaveLength(4);
    expect(spotCheckPlan("m", "new-grad").every((c) => c.persona === "new-grad")).toBe(true);
    expect(isMatrixPersona("new-grad")).toBe(true);
    expect(isMatrixPersona("intern")).toBe(false);
  });
});

describe("the estimate", () => {
  test("variant 1 counts the scenario's calls, re-renders two calls per surface, at the model's list price", () => {
    const plan = matrixPlan(["anthropic/claude-sonnet-5.5"]);
    const e = estimateMatrix(plan, "anthropic/claude-sonnet-5.5");
    expect(e.cells).toEqual({ 1: 60, 2: 60, 3: 60 });
    // 15 runs per scenario: (13 + 7 + 7 + 7) x 15 = 510 calls; surfaces (3 + 2 + 1 + 1) x 15 = 105.
    expect(e.byVariant[1].calls).toBe(510);
    expect(e.byVariant[2].calls).toBe(210);
    expect(e.byVariant[3].calls).toBe(210);
    expect(e.byVariant[1].inputTokens).toBe(510 * 15_000);
    expect(e.byVariant[3].outputTokens).toBe(210 * 4_000);
    const p = PRICE_PER_MTOK_MICROS["anthropic/claude-sonnet-5.5"];
    const expected = Math.ceil((510 * 15_000 * p.input + 510 * 600 * p.output) / 1_000_000);
    expect(e.byVariant[1].costMicros).toBe(expected);
    expect(e.total.inputTokens + e.total.outputTokens).toBe(14_256_000);
    expect(e.total.costMicros).toBe(41_040_000);
  });

  test("Haiku 5.5 is priced at its short-prompt tier per call: a twentieth of Sonnet's input price", () => {
    const plan = matrixPlan(["anthropic/claude-haiku-5.5", "anthropic/claude-sonnet-5.5"]);
    const haiku = estimateMatrix(plan, "anthropic/claude-haiku-5.5").total;
    const sonnet = estimateMatrix(plan, "anthropic/claude-sonnet-5.5").total;
    expect(haiku.costMicros).toBe(2_052_000);
    expect(haiku.inputTokens).toBe(sonnet.inputTokens);
  });

  test("the cached estimate uses CACHE_SHARES: reads at 0.1x and writes at 1.25x the input price, never above uncached", () => {
    expect(CACHE_SHARES).toEqual({ agent: { read: 0.75, write: 0.25 }, rerender: { read: 0.25, write: 0.1 }, judge: { read: 0, write: 0 } });
    const model = "anthropic/claude-haiku-5.5";
    const e = estimateMatrix(matrixPlan([model]), model);
    // A variant 1 call: 15,000 in at $0.10 x (0.75 x 0.1 + 0.25 x 1.25) plus 600 out at $0.50 = 881.25 micros;
    // rounded up per cell (13 calls in a, 7 in b, c and d), 15 cells of each.
    expect(e.byVariant[1].cachedCostMicros).toBe(449_460);
    // A variant 2 call: 12,000 in at $0.10 x (0.65 + 0.25 x 0.1 + 0.1 x 1.25) plus 2,000 out at $0.50 = 1,960 micros; 210 calls.
    expect(e.byVariant[2].cachedCostMicros).toBe(411_600);
    for (const v of [1, 2, 3] as const) expect(e.byVariant[v].cachedCostMicros).toBeLessThanOrEqual(e.byVariant[v].costMicros);
    expect(e.total.cachedCostMicros).toBe(1_482_660);
    expect(estimateInjection(model, 45).cachedCostMicros).toBe(317_250);
  });

  test("an unpriced model is refused for the matrix and the injection set, never priced at Sonnet's rate", () => {
    expect(unpricedModels(["anthropic/claude-sonnet-5.5", "x/unknown", "default", "constructor"])).toEqual(["x/unknown", "default", "constructor"]);
    expect(() => assertPricedModels(AGENT_EVAL_MODELS)).not.toThrow();
    const plan = matrixPlan(["x/unknown"]);
    expect(() => estimateMatrix(plan, "x/unknown")).toThrow(UnpricedModelError);
    expect(() => estimateInjection("x/unknown", 45)).toThrow(/no price for x\/unknown/);
    expect(() => formatMatrixDryRun({ models: ["x/unknown"], caps: profileDefaults("matrix"), totals: null })).toThrow(UnpricedModelError);
    expect(() =>
      formatSimpleDryRun({ profile: "injection", models: ["x/unknown"], runs: 45, caps: profileDefaults("injection"), totals: null }),
    ).toThrow(UnpricedModelError);
  });
});

describe("the dry run", () => {
  test("prints the cell plan, the estimate per model and the caps, from the defaults", () => {
    const out = formatMatrixDryRun({
      models: AGENT_EVAL_MODELS,
      caps: profileDefaults("matrix"),
      totals: parseTotalCaps({}, "matrix"),
    });
    expect(out).toMatch(/nothing is run and nothing is spent\. 360 cells over 2 model\(s\)/);
    // Uncached, then cached (CACHE_SHARES); a full Sonnet matrix no longer fits the $2.50 default.
    expect(out).toContain("| anthropic/claude-sonnet-5.5 | 60 / 60 / 60 | 930 | 12.69M | 1.57M | $41.04 | $29.65 | NO: the run would stop at a cap |");
    expect(out).toContain("| (variant 3) | 60 | 210 | 2.52M | 0.84M | $13.44 | $12.43 | |");
    expect(out).toContain("| anthropic/claude-haiku-5.5 | 60 / 60 / 60 | 930 | 12.69M | 1.57M | $2.05 | $1.48 | yes |");
    expect(out).toContain("| (variant 1) | 60 | 510 | 7.65M | 0.31M | $0.92 | $0.45 | |");
    expect(out).toContain("| all models | 360 | 1860 | 25.38M | 3.13M | $43.09 | $31.14 | NO: the run would stop at the total cap |");
    expect(out).toContain("| --max-cells | matrix cells per model | 180 | 180 | 180 |");
    expect(out).toContain(`| --max-total-usd | US dollars over every model | 2.5 | ${TOTAL_CAP_SPECS.matrix!.maxTotalUsd.default} | 3 |`);
    expect(out).toMatch(/an agent step reads 75% of its input from the prompt cache and writes 25%/);
  });

  test("says when a lowered cap would stop the run", () => {
    const out = formatMatrixDryRun({
      models: ["anthropic/claude-haiku-5.5"],
      caps: { ...profileDefaults("matrix"), maxUsd: 1 },
      totals: { maxTotalTokens: 1_000_000, maxTotalUsd: 2.5 },
    });
    expect(out).toMatch(/\$2\.05 \| \$1\.48 \| NO: the run would stop at a cap \|/);
    expect(out).toMatch(/NO: the run would stop at the total cap/);
  });

  test("the spot check's dry run: 12 Sonnet cells; uncached, the look-ahead stops it short of its $2.90 cap (fix round 1)", () => {
    const out = formatMatrixDryRun({
      models: ["anthropic/claude-sonnet-5.5"],
      caps: profileDefaults("spot-check"),
      totals: parseTotalCaps({}, "spot-check"),
      plan: spotCheckPlan("anthropic/claude-sonnet-5.5"),
      profile: "spot-check",
      title: "Spot check dry run",
    });
    expect(out).toMatch(/^Spot check dry run: nothing is run and nothing is spent\. 12 cells over 1 model\(s\)/);
    // $2.74 uncached plus a $0.1951 reserve (a 15k-token Sonnet step) is above $2.90: the last cell or so would not run.
    expect(out).toContain("| anthropic/claude-sonnet-5.5 | 4 / 4 / 4 | 62 | 0.85M | 0.10M | $2.74 | $1.98 | NO: the run would stop at a cap |");
    expect(out).toContain("the dearest call reserves $0.1951, so the run may stop once it has spent");
    expect(out).toContain("more than $2.7049 of its $2.90 cap: $0.1951 (6.5% of $3) of headroom");
    expect(out).toContain("| --max-usd | US dollars (reported cost) | 2.9 | 2.9 | 2.9 |");
  });

  test("fix round 1: the look-ahead's reserve at the plan's call sizes, and when it would stop a run", () => {
    expect(JUDGE_OUTPUT_LIMIT).toBe(JUDGE_MAX_OUTPUT_TOKENS);
    const haiku = AGENT_EVAL_DEFAULT_MODEL;
    // A 15k-token agent step serializes to about 62K bytes: Haiku's short tier, 4,000 output tokens.
    expect(callReserveMicros(haiku, "agent")).toBeCloseTo(((15_000 * 4 + 2_048) * 100_000 * 1.25 + 4_000 * 500_000) / 1e6, 6);
    expect(callReserveMicros(haiku, "judge")).toBeCloseTo(((12_000 * 4 + 2_048) * 100_000 * 1.25 + 2_000 * 500_000) / 1e6, 6);
    expect(runReserveMicros(haiku, ["agent", "rerender"])).toBe(callReserveMicros(haiku, "agent"));
    // A full history window takes Haiku's long tier.
    expect(fullWindowReserveMicros(haiku)).toBeCloseTo(((160_000 + 2_048) * 500_000 * 1.25 + 4_000 * 2_500_000) / 1e6, 6);
    const out = formatMatrixDryRun({ models: [haiku], caps: profileDefaults("matrix"), totals: parseTotalCaps({}, "matrix") });
    expect(out).toContain("the dearest call reserves $0.0098");
    expect(out).toContain("reserves $0.1113 (3.7% of $3)");
    // $2.05 fits $2.50 with its reserve; at $2.06 it does not.
    expect(formatMatrixDryRun({ models: [haiku], caps: { ...profileDefaults("matrix"), maxUsd: 2.06 }, totals: null })).toMatch(
      /\| anthropic\/claude-haiku-5\.5 \| 60 \/ 60 \/ 60 \| .* NO: the run would stop at a cap \|/,
    );
  });

  test("fix round 1: each pass stage fits its cap (what is left) with its reserve, uncached and cached", () => {
    const stages = estimatePass();
    const uncached = passStageFits(stages, 3, (c) => c.costMicros);
    expect(uncached.map((f) => f.capUsd)).toEqual([3, 0.94, 0.3]);
    expect(uncached.every((f) => f.fits)).toBe(true);
    expect(passStageFits(stages, 3, (c) => c.cachedCostMicros).map((f) => f.capUsd)).toEqual([3, 1.5, 1]);
    // At $2.50 the matrix still fits its cap; the injection, with $0.44 left, does not.
    expect(passStageFits(stages, 2.5, (c) => c.costMicros).map((f) => f.fits)).toEqual([true, false, false]);
  });

  test("the pass's dry run prints each stage and the total against the $3 budget", () => {
    const out = formatPassDryRun({ budgetUsd: 3 });
    expect(out).toContain("| matrix | anthropic/claude-haiku-5.5 | 180 cells | 930 | 12.69M | 1.57M | $2.05 | $1.48 |");
    expect(out).toContain("| injection | anthropic/claude-haiku-5.5 | 45 runs | 360 | 5.40M | 0.22M | $0.65 | $0.32 |");
    expect(out).toContain("| judge | anthropic/claude-haiku-5.5 | up to 144 pairs | 144 | 1.73M | 0.06M | $0.20 | $0.20 |");
    expect(out).toContain("| pass total | | | 1434 | 19.82M | 1.84M | $2.90 | $2.00 |");
    expect(out).toContain("Pass total against the budget: $2.90 uncached (within $3.00: yes), $2.00 cached (within: yes).");
    // Fix round 1: every stage, with its look-ahead reserve, within what is left when it starts.
    expect(out).toContain("| matrix | $0.0098 | $2.0618 vs $3.00: fits | $1.4924 vs $3.00: fits |");
    expect(out).toContain("| injection | $0.0098 | $0.6578 vs $0.94: fits | $0.3270 vs $1.50: fits |");
    expect(out).toContain("| judge | $0.0073 | $0.2089 vs $0.30: fits | $0.2089 vs $1.00: fits |");
    expect(out).toContain("Every stage completes within the budget: uncached yes, cached yes.");
    expect(out).toContain("a reserve of $0.1113), every stage would complete uncached: yes.");
    expect(out).not.toMatch(/Uncached, a stage would reach its cap/);
    // A lowered budget the uncached pass does not fit: it says so, and how the cap still holds.
    const low = formatPassDryRun({ budgetUsd: 2.5 });
    expect(low).toContain("$2.90 uncached (within $2.50: NO), $2.00 cached (within: yes)");
    expect(low).toContain("Every stage completes within the budget: uncached NO, cached yes.");
    expect(low).toMatch(/The cap still holds: the stage stops \(cap_exceeded\) before a call that could/);
  });

  test("PR J7: the re-render-only dry run prices only re-render cells, at the source run's recorded surface counts", () => {
    const model = AGENT_EVAL_DEFAULT_MODEL;
    // A full one-model source recorded with the plan's own surface counts costs what the plan's variants 2 and 3 cost.
    const full = matrixPlan([model])
      .filter((c) => c.variant === 1)
      .map((c) => ({ model, scenario: c.scenario, persona: c.persona, seed: c.repeat, surfaces: V1_SURFACES[c.scenario] }));
    const e = estimateMatrix(matrixPlan([model]), model);
    expect(rerenderOnlyCells(model, full, 180)).toHaveLength(120);
    const out = formatRerenderOnlyDryRun({ sourceRun: "20261126T010000Z", sources: full, unreadable: 0, models: [model], caps: profileDefaults("matrix"), totals: parseTotalCaps({}, "matrix") });
    const v23 = e.byVariant[2].costMicros + e.byVariant[3].costMicros;
    expect(out).toMatch(/^Re-render-only dry run over matrix run 20261126T010000Z: nothing is run and nothing is spent\. 120 re-render cells over 1 model\(s\); no variant 1 cell is played\./);
    expect(out).toContain(`| ${model} | 60 / 60 | 210 | 420 | 5.04M | 1.26M | $1.13 | $1.03 | yes |`);
    expect(v23).toBe(1_134_000);
    expect(out).toContain("| --max-cells | matrix cells per model | 180 | 180 | 180 |");

    // Only the recordings there, in plan order, --max-cells of them; another model's recordings are not this model's.
    const few = [
      { model, scenario: "d_weekly", persona: "new-grad", seed: 2, surfaces: 4 },
      { model, scenario: "a_resume_upload", persona: "senior-backend", seed: 1, surfaces: 1 },
      { model: "anthropic/claude-sonnet-5.5", scenario: "b_compare", persona: "senior-backend", seed: 1, surfaces: 9 },
    ];
    expect(rerenderOnlyCells(model, few, 3).map(({ cell, surfaces }) => [cell.scenario, cell.variant, surfaces])).toEqual([
      ["a_resume_upload", 2, 1],
      ["a_resume_upload", 3, 1],
      ["d_weekly", 2, 4],
    ]);
    const small = formatRerenderOnlyDryRun({ sourceRun: "20261126T010000Z", sources: few, unreadable: 2, models: [model], caps: { ...profileDefaults("matrix"), maxCases: 3 }, totals: null });
    expect(small).toContain(`| ${model} | 2 / 1 | 6 | 12 |`);
    expect(small).toContain("(2 file(s) did not parse and are left out)");
    expect(() => formatRerenderOnlyDryRun({ sourceRun: "x", sources: few, unreadable: 0, models: ["openai/gpt-5.5"], caps: profileDefaults("matrix"), totals: null })).toThrow(UnpricedModelError);
  });

  test("the judge is priced at Haiku 5.5's own row", () => {
    // 144 calls of 12,000 in and 400 out at $0.10 / $0.50 per million.
    expect(estimateJudge(AGENT_EVAL_DEFAULT_MODEL, 144).costMicros).toBe(201_600);
    expect(() => estimateJudge("openai/gpt-5.5", 144)).toThrow(UnpricedModelError);
  });

  test("the injection and judge dry runs print their own estimate and caps", () => {
    const inj = formatSimpleDryRun({ profile: "injection", models: ["anthropic/claude-sonnet-5.5"], runs: 45, caps: profileDefaults("injection"), totals: parseTotalCaps({}, "injection") });
    expect(inj).toContain("| anthropic/claude-sonnet-5.5 | 45 | 360 | 5.40M | 0.22M | $12.96 | $6.34 |");
    expect(inj).toContain("--max-total-tokens");
    const judge = formatSimpleDryRun({ profile: "judge", models: [AGENT_EVAL_DEFAULT_MODEL], runs: 144, caps: profileDefaults("judge"), totals: null });
    expect(judge).toContain("| anthropic/claude-haiku-5.5 | 144 | 144 | 1.73M | 0.06M | $0.20 | $0.20 | yes |");
    expect(judge).toContain("| --max-pairs | judged pairs | 144 | 144 | 360 |");
    expect(judge).toMatch(/without it only the variant 1 and 2 pairs are judged\n\(60 for a full one-model matrix\)/);
    // The judge is priced now: no more "estimated at Sonnet's price".
    expect(judge).not.toMatch(/Sonnet 5\.5's list price/);
  });

  test("the injection and judge dry runs warn when the estimate would pass a cap, like the matrix's", () => {
    const judge = formatSimpleDryRun({ profile: "judge", models: [AGENT_EVAL_DEFAULT_MODEL], runs: 360, caps: profileDefaults("judge"), totals: null });
    // 360 pairs: 4.46M tokens and $0.50 against the 3M and $0.50 defaults.
    expect(judge).toMatch(/\| \$0\.50 \| \$0\.50 \| NO: the run would stop at a cap \|/);
    const inj = formatSimpleDryRun({
      profile: "injection",
      models: [...AGENT_EVAL_MODELS],
      runs: 45,
      caps: { ...profileDefaults("injection"), maxUsd: 1 },
      totals: { maxTotalTokens: 18_000_000, maxTotalUsd: 1.5 },
    });
    expect(inj).toMatch(/\| anthropic\/claude-sonnet-5\.5 \| 45 \| .* \$12\.96 \| \$6\.34 \| NO: the run would stop at a cap \|/);
    expect(inj).toMatch(/\| anthropic\/claude-haiku-5\.5 \| 45 \| .* \$0\.65 \| \$0\.32 \| yes \|/);
    expect(inj).toMatch(/\| all models \| 90 \| 720 \| .* \$13\.61 \| \$6\.66 \| NO: the run would stop at the total cap \|/);
  });
});
