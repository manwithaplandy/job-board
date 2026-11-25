import { describe, expect, test, vi } from "vitest";

// budget.ts imports the db and app-settings modules for its two reads; every test
// here exercises the pure functions, so the reads are stubbed out.
vi.mock("@/lib/db", () => ({ withUserSql: vi.fn() }));
vi.mock("@/lib/appSettings", () => ({ loadAppSettings: vi.fn() }));

import { headroom, PRICE_PER_MTOK_MICROS, stepCostMicros } from "@/lib/agent/budget";
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

  test("rounds up to at least 1 micro for any step with tokens", () => {
    expect(stepCostMicros({ usage: { inputTokens: 1, outputTokens: 0 } }, "anthropic/claude-haiku-5.5")).toBe(1);
    expect(stepCostMicros({ usage: { inputTokens: 0, outputTokens: 1 } }, "anthropic/claude-haiku-5.5")).toBe(3);
    expect(stepCostMicros({ providerMetadata: { openrouter: { usage: { cost: 1e-9 } } }, usage: { inputTokens: 5 } }, "x")).toBe(1);
    expect(stepCostMicros({ usage: {} }, AGENT_MODEL_DEFAULT)).toBe(0);
  });
});
