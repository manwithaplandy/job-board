import { describe, expect, test } from "vitest";
import {
  estimateClassificationCost,
  FALLBACK_PRICING,
  CLASSIFICATION_MODELS,
} from "@/lib/classificationEstimate";

const flashLite = FALLBACK_PRICING["google/gemini-3.5-flash-lite"];

describe("estimateClassificationCost", () => {
  // 1000 * (1300 * 0.30e-6 + 300 * 2.5e-6) = 1000 * (0.00039 + 0.00075) = $1.14
  test("no-SERP Flash-Lite over 1000 companies ≈ $1.14", () => {
    const est = estimateClassificationCost({ count: 1000, useSerp: false, pricing: flashLite });
    expect(est).not.toBeNull();
    expect(est as number).toBeCloseTo(1.14, 5);
  });

  // SERP adds 1000 * (900 * 0.30e-6 + 0.001) = 1000 * (0.00027 + 0.001) = $1.27 → $2.41 total
  test("with SERP adds the per-company delta → ≈ $2.41 total", () => {
    const est = estimateClassificationCost({ count: 1000, useSerp: true, pricing: flashLite });
    expect(est as number).toBeCloseTo(2.41, 5);
  });

  test("null pricing → null (estimate unavailable)", () => {
    expect(estimateClassificationCost({ count: 1000, useSerp: false, pricing: null })).toBeNull();
    expect(estimateClassificationCost({ count: 1000, useSerp: true, pricing: null })).toBeNull();
  });

  test("count <= 0 → 0 regardless of pricing", () => {
    expect(estimateClassificationCost({ count: 0, useSerp: true, pricing: flashLite })).toBe(0);
    expect(estimateClassificationCost({ count: -5, useSerp: false, pricing: null })).toBe(0);
  });

  test("scales linearly with company count", () => {
    const one = estimateClassificationCost({ count: 1, useSerp: false, pricing: flashLite }) as number;
    const ten = estimateClassificationCost({ count: 10, useSerp: false, pricing: flashLite }) as number;
    expect(ten).toBeCloseTo(one * 10, 10);
  });
});

describe("CLASSIFICATION_MODELS", () => {
  test("Flash-Lite is the default (first) entry", () => {
    expect(CLASSIFICATION_MODELS[0]).toBe("google/gemini-3.5-flash-lite");
  });
  test("every fallback-priced model is offered", () => {
    for (const id of Object.keys(FALLBACK_PRICING)) {
      expect(CLASSIFICATION_MODELS).toContain(id);
    }
  });
});
