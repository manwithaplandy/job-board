import { describe, expect, test, vi } from "vitest";

// budget.ts imports the db and app-settings modules for its two reads; every test
// here exercises the pure functions, so the reads are stubbed out.
vi.mock("@/lib/db", () => ({ withUserSql: vi.fn() }));
vi.mock("@/lib/appSettings", () => ({ loadAppSettings: vi.fn() }));

import { headroom, PRICE_PER_MTOK_MICROS, STEP_COST_MAX_MICROS, stepCostMicros } from "@/lib/agent/budget";
import { AGENT_EVAL_MODELS, AGENT_MODEL_DEFAULT } from "@/lib/agent/config";

const settings = { agentEnabled: true, agentDailyCeilingMicros: 1_000_000, agentMonthlyCeilingMicros: 10_000_000 };

describe("headroom", () => {
  test("ok with the smaller headroom", () => {
    expect(headroom({ dayMicros: 200_000, monthMicros: 9_900_000 }, settings)).toEqual({
      ok: true,
      remainingMicros: 100_000,
    });
  });

  test("daily ceiling reached", () => {
    expect(headroom({ dayMicros: 1_000_000, monthMicros: 1_000_000 }, settings)).toEqual({
      ok: false,
      reason: "daily_ceiling",
    });
    expect(headroom({ dayMicros: 0, monthMicros: 10_000_001 }, settings)).toEqual({
      ok: false,
      reason: "monthly_ceiling",
    });
  });

  test("monthly spend exactly at the ceiling is over the monthly ceiling", () => {
    expect(headroom({ dayMicros: 0, monthMicros: 10_000_000 }, settings)).toEqual({
      ok: false,
      reason: "monthly_ceiling",
    });
    expect(headroom({ dayMicros: 0, monthMicros: 9_999_999 }, settings)).toEqual({ ok: true, remainingMicros: 1 });
  });

  test("agent_disabled wins over spend", () => {
    expect(headroom({ dayMicros: 0, monthMicros: 0 }, { ...settings, agentEnabled: false })).toEqual({
      ok: false,
      reason: "agent_disabled",
    });
    expect(headroom({ dayMicros: 5_000_000, monthMicros: 50_000_000 }, { ...settings, agentEnabled: false })).toEqual({
      ok: false,
      reason: "agent_disabled",
    });
  });
});

describe("stepCostMicros", () => {
  test("reads cost from providerMetadata.openrouter.usage.cost in dollars", () =>
    expect(stepCostMicros({ providerMetadata: { openrouter: { usage: { cost: 0.0123 } } }, usage: {} }, "x")).toBe(12_300));

  test("charges an estimate when cost is missing", () => {
    expect(stepCostMicros({ usage: { inputTokens: 1_000_000, outputTokens: 0 } }, AGENT_MODEL_DEFAULT)).toBeGreaterThan(0);
    // Malformed metadata (cost as a string, negative cost) is ignored, not trusted.
    const estimate = stepCostMicros({ usage: { inputTokens: 1000, outputTokens: 1000 } }, AGENT_MODEL_DEFAULT);
    expect(
      stepCostMicros(
        { providerMetadata: { openrouter: { usage: { cost: "0.5" } } }, usage: { inputTokens: 1000, outputTokens: 1000 } },
        AGENT_MODEL_DEFAULT,
      ),
    ).toBe(estimate);
    expect(
      stepCostMicros(
        { providerMetadata: { openrouter: { usage: { cost: -1 } } }, usage: { inputTokens: 1000, outputTokens: 1000 } },
        AGENT_MODEL_DEFAULT,
      ),
    ).toBe(estimate);
  });

  test("an unknown model is priced at the default entry, never zero", () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };
    const unknown = stepCostMicros({ usage }, "someone/unpriced-model");
    expect(unknown).toBe(PRICE_PER_MTOK_MICROS.default.input + PRICE_PER_MTOK_MICROS.default.output);
    expect(unknown).toBeGreaterThan(0);
    // Every eval model has its own row, and none costs more than the default.
    for (const model of AGENT_EVAL_MODELS) {
      expect(PRICE_PER_MTOK_MICROS[model], model).toBeDefined();
      expect(stepCostMicros({ usage }, model)).toBeLessThanOrEqual(unknown);
    }
  });

  test("non-finite or negative token counts count as zero", () => {
    const m = "anthropic/claude-haiku-5.5";
    expect(stepCostMicros({ usage: { inputTokens: Number.NaN, outputTokens: 0 } }, m)).toBe(0);
    expect(stepCostMicros({ usage: { inputTokens: Number.POSITIVE_INFINITY, outputTokens: -5 } }, m)).toBe(0);
    expect(stepCostMicros({ usage: { inputTokens: 1_000_000, outputTokens: Number.NaN } }, m)).toBe(
      PRICE_PER_MTOK_MICROS[m].input,
    );
  });

  test("a prototype name is not a model: it is priced at the default", () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 0 };
    for (const name of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(stepCostMicros({ usage }, name), name).toBe(PRICE_PER_MTOK_MICROS.default.input);
    }
  });

  test("a billed or estimated cost is clamped to STEP_COST_MAX_MICROS", () => {
    // $100: two parallel clamped steps on a day at its $1,000 ceiling stay inside int4.
    expect(STEP_COST_MAX_MICROS).toBe(100_000_000);
    expect(2 * STEP_COST_MAX_MICROS + 1_000_000_000).toBeLessThan(2 ** 31 - 1);
    expect(stepCostMicros({ providerMetadata: { openrouter: { usage: { cost: 1e30 } } }, usage: {} }, "x")).toBe(
      STEP_COST_MAX_MICROS,
    );
    expect(stepCostMicros({ providerMetadata: { openrouter: { usage: { cost: 150 } } }, usage: {} }, "x")).toBe(
      100_000_000,
    );
    expect(stepCostMicros({ usage: { inputTokens: 1e15, outputTokens: 1e15 } }, "x")).toBe(STEP_COST_MAX_MICROS);
  });

  test("rounds up to at least 1 micro for any step with tokens", () => {
    expect(stepCostMicros({ usage: { inputTokens: 1, outputTokens: 0 } }, "anthropic/claude-haiku-5.5")).toBe(1);
    // Haiku 5.5's short-prompt tier: $0.50 per million output tokens is half a micro, rounded up.
    expect(stepCostMicros({ usage: { inputTokens: 0, outputTokens: 1 } }, "anthropic/claude-haiku-5.5")).toBe(1);
    expect(stepCostMicros({ providerMetadata: { openrouter: { usage: { cost: 1e-9 } } }, usage: { inputTokens: 5 } }, "x")).toBe(1);
    expect(stepCostMicros({ usage: {} }, AGENT_MODEL_DEFAULT)).toBe(0);
  });
});

describe("stepCostMicros fallback: tiers and prompt caching (PR J7)", () => {
  const haiku = "anthropic/claude-haiku-5.5";
  const sonnet = "anthropic/claude-sonnet-5.5";

  test("Haiku 5.5 is priced per call: $0.10/$0.50 up to 100K input tokens, $0.50/$2.50 above", () => {
    // 15k in, 600 out: 15,000 x 0.1 + 600 x 0.5 = 1,800 micros.
    expect(stepCostMicros({ usage: { inputTokens: 15_000, outputTokens: 600 } }, haiku)).toBe(1_800);
    expect(stepCostMicros({ usage: { inputTokens: 100_000, outputTokens: 0 } }, haiku)).toBe(10_000);
    // One token past the tier: the whole call is at the long-prompt price.
    expect(stepCostMicros({ usage: { inputTokens: 100_001, outputTokens: 0 } }, haiku)).toBe(50_001);
    expect(stepCostMicros({ usage: { inputTokens: 1_000, outputTokens: 1_000 } }, sonnet)).toBe(12_000);
  });

  test("cache writes cost 1.25x the input price; cache reads are never discounted in the fallback", () => {
    const base = stepCostMicros({ usage: { inputTokens: 10_000, outputTokens: 0 } }, sonnet);
    expect(base).toBe(20_000);
    const written = stepCostMicros(
      { usage: { inputTokens: 10_000, outputTokens: 0, inputTokenDetails: { cacheWriteTokens: 8_000 } } },
      sonnet,
    );
    // 2,000 plain at $2 plus 8,000 written at $2.50.
    expect(written).toBe(24_000);
    const read = stepCostMicros(
      { usage: { inputTokens: 10_000, outputTokens: 0, inputTokenDetails: { cacheReadTokens: 8_000 } } },
      sonnet,
    );
    expect(read).toBe(base);
  });

  test("the fallback never prices a cached step below the uncached price", () => {
    for (const model of [haiku, sonnet, "someone/unpriced-model"]) {
      for (const details of [{}, { cacheReadTokens: 9_000 }, { cacheWriteTokens: 9_000 }, { cacheReadTokens: 4_000, cacheWriteTokens: 5_000 }]) {
        const plain = stepCostMicros({ usage: { inputTokens: 10_000, outputTokens: 300 } }, model);
        const cached = stepCostMicros({ usage: { inputTokens: 10_000, outputTokens: 300, inputTokenDetails: details } }, model);
        expect(cached, `${model} ${JSON.stringify(details)}`).toBeGreaterThanOrEqual(plain);
      }
    }
  });

  test("cache counts above the input count are clamped, and bad counts are zero", () => {
    expect(
      stepCostMicros({ usage: { inputTokens: 1_000, outputTokens: 0, inputTokenDetails: { cacheWriteTokens: 5_000 } } }, sonnet),
    ).toBe(2_500);
    expect(
      stepCostMicros({ usage: { inputTokens: 1_000, outputTokens: 0, inputTokenDetails: { cacheWriteTokens: Number.NaN } } }, sonnet),
    ).toBe(2_000);
  });

  test("a billed cost still wins over every estimate", () => {
    expect(
      stepCostMicros(
        {
          providerMetadata: { openrouter: { usage: { cost: 0.0001 } } },
          usage: { inputTokens: 10_000, outputTokens: 0, inputTokenDetails: { cacheWriteTokens: 10_000 } },
        },
        sonnet,
      ),
    ).toBe(100);
  });
});
