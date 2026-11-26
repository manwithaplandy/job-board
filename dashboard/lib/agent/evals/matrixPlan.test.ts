// The variant matrix's plan and the dry run's estimate (plan Task 2.10). Pure; runs in CI.
import { describe, expect, test } from "vitest";
import { AGENT_EVAL_MODELS } from "@/lib/agent/config";
import { PERSONA_IDS } from "@/lib/agent/evals/personas";
import { SCENARIO_IDS } from "@/lib/agent/evals/scenarios";
import { PRICE_PER_MTOK_MICROS } from "@/lib/agent/budget";
import { profileDefaults, TOTAL_CAP_SPECS, parseTotalCaps } from "@/lib/agent/evals/budget";
import {
  MATRIX_PERSONAS,
  MATRIX_SCENARIOS,
  UnpricedModelError,
  assertPricedModels,
  cellKey,
  estimateInjection,
  estimateMatrix,
  unpricedModels,
  formatMatrixDryRun,
  formatSimpleDryRun,
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

  test("runModels: --models wins, then --model, then every AGENT_EVAL_MODELS entry", () => {
    expect(runModels({ models: ["a", "b"], model: "c" })).toEqual(["a", "b"]);
    expect(runModels({ model: "c" })).toEqual(["c"]);
    expect(runModels({})).toEqual([...AGENT_EVAL_MODELS]);
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

  test("Haiku costs a quarter of Sonnet for the same work", () => {
    const plan = matrixPlan(["anthropic/claude-haiku-5.5", "anthropic/claude-sonnet-5.5"]);
    const haiku = estimateMatrix(plan, "anthropic/claude-haiku-5.5").total;
    const sonnet = estimateMatrix(plan, "anthropic/claude-sonnet-5.5").total;
    expect(haiku.costMicros).toBe(10_260_000);
    expect(haiku.inputTokens).toBe(sonnet.inputTokens);
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
    expect(out).toContain("| anthropic/claude-sonnet-5.5 | 60 / 60 / 60 | 930 | 12.69M | 1.57M | $41.04 | yes |");
    expect(out).toContain("| (variant 3) | 60 | 210 | 2.52M | 0.84M | $13.44 | |");
    expect(out).toContain("| anthropic/claude-haiku-5.5 | 60 / 60 / 60 | 930 | 12.69M | 1.57M | $10.26 | yes |");
    expect(out).toContain("| all models | 360 | 1860 | 25.38M | 3.13M | $51.30 | yes |");
    expect(out).toContain("| --max-cells | matrix cells per model | 180 | 180 | 180 |");
    expect(out).toContain(`| --max-total-usd | US dollars over every model | 80 | ${TOTAL_CAP_SPECS.matrix!.maxTotalUsd.default} | 200 |`);
  });

  test("says when a lowered cap would stop the run", () => {
    const out = formatMatrixDryRun({
      models: ["anthropic/claude-sonnet-5.5"],
      caps: { ...profileDefaults("matrix"), maxUsd: 10 },
      totals: { maxTotalTokens: 1_000_000, maxTotalUsd: 80 },
    });
    expect(out).toMatch(/\$41\.04 \| NO: the run would stop at a cap \|/);
    expect(out).toMatch(/NO: the run would stop at the total cap/);
  });

  test("the injection and judge dry runs print their own estimate and caps", () => {
    const inj = formatSimpleDryRun({ profile: "injection", models: ["anthropic/claude-sonnet-5.5"], runs: 45, caps: profileDefaults("injection"), totals: parseTotalCaps({}, "injection") });
    expect(inj).toContain("| anthropic/claude-sonnet-5.5 | 45 | 360 | 5.40M | 0.22M | $12.96 |");
    expect(inj).toContain("--max-total-tokens");
    const judge = formatSimpleDryRun({ profile: "judge", models: ["openai/gpt-5.5"], runs: 144, caps: profileDefaults("judge"), totals: null });
    expect(judge).toContain("| openai/gpt-5.5 | 144 | 144 | 1.73M | 0.06M | $4.03 | yes |");
    expect(judge).toContain("| --max-pairs | judged pairs | 144 | 144 | 360 |");
    // The judge model is unpriced: the estimate says so and claims nothing about its direction.
    expect(judge).toMatch(/estimated at Sonnet 5\.5's list price: its real price may be\nhigher or lower/);
    expect(judge).not.toMatch(/probably high|dearest/);
  });

  test("the injection and judge dry runs warn when the estimate would pass a cap, like the matrix's", () => {
    const judge = formatSimpleDryRun({ profile: "judge", models: ["openai/gpt-5.5"], runs: 360, caps: profileDefaults("judge"), totals: null });
    // 360 pairs: 4.46M tokens and $10.08 against the 3M and $10 defaults.
    expect(judge).toMatch(/\| \$10\.08 \| NO: the run would stop at a cap \|/);
    const inj = formatSimpleDryRun({
      profile: "injection",
      models: [...AGENT_EVAL_MODELS],
      runs: 45,
      caps: { ...profileDefaults("injection"), maxUsd: 5 },
      totals: { maxTotalTokens: 18_000_000, maxTotalUsd: 10 },
    });
    expect(inj).toMatch(/\| anthropic\/claude-sonnet-5\.5 \| 45 \| .* \$12\.96 \| NO: the run would stop at a cap \|/);
    expect(inj).toMatch(/\| anthropic\/claude-haiku-5\.5 \| 45 \| .* \$3\.24 \| yes \|/);
    expect(inj).toMatch(/\| all models \| 90 \| 720 \| .* \$16\.20 \| NO: the run would stop at the total cap \|/);
  });
});
