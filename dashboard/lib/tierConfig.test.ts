import { describe, expect, test, vi } from "vitest";
import { overlayPlan, overlayTierConfig, defaultTierConfig } from "@/lib/tierConfig";
import { ENTITLEMENTS, PLAN_PRICE_USD } from "@/lib/entitlements";

describe("overlayPlan (total parser, T1)", () => {
  const defaults = defaultTierConfig();

  test("undefined/empty config yields the compiled defaults", () => {
    expect(overlayPlan("standard", undefined, defaults)).toEqual({
      entitlement: ENTITLEMENTS.standard,
      price: PLAN_PRICE_USD.standard,
    });
    expect(overlayPlan("pro", {}, defaults)).toEqual({
      entitlement: ENTITLEMENTS.pro,
      price: PLAN_PRICE_USD.pro,
    });
  });

  test("a valid override changes only the named fields", () => {
    const { entitlement, price } = overlayPlan(
      "standard",
      { stage2Models: { cheap: 650 }, monthlyResume: 45, priceUsd: 10 },
      defaults,
    );
    expect(entitlement.stage2Models.cheap).toBe(650);
    expect(entitlement.monthlyResume).toBe(45);
    expect(entitlement.monthlyCover).toBe(ENTITLEMENTS.standard.monthlyCover);
    expect(price).toBe(10);
  });

  test("a string scalar config falls back to defaults and logs", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(overlayPlan("pro", "not-an-object", defaults)).toEqual({
      entitlement: ENTITLEMENTS.pro,
      price: PLAN_PRICE_USD.pro,
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test("negative/zero/fractional caps fall back field-by-field", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { entitlement, price } = overlayPlan(
      "pro",
      { stage2Models: { cheap: -5, premium: 0 }, monthlyResume: 3.5, monthlyCover: "x", priceUsd: -1 },
      defaults,
    );
    expect(entitlement).toEqual(ENTITLEMENTS.pro);
    expect(price).toBe(PLAN_PRICE_USD.pro);
    spy.mockRestore();
  });

  test("unknown keys are ignored", () => {
    const { entitlement } = overlayPlan("standard", { bogus: 999, nope: true }, defaults);
    expect(entitlement).toEqual(ENTITLEMENTS.standard);
  });

  test("a DB row cannot invent a premium slot for standard", () => {
    const { entitlement } = overlayPlan("standard", { stage2Models: { premium: 100 } }, defaults);
    expect(entitlement.stage2Models.premium).toBeUndefined();
  });

  test("double-encoded jsonb string scalar is unwrapped then validated", () => {
    const { entitlement } = overlayPlan(
      "standard",
      JSON.stringify({ stage2Models: { cheap: 500 } }),
      defaults,
    );
    expect(entitlement.stage2Models.cheap).toBe(500);
  });
});

describe("overlayTierConfig", () => {
  test("no rows → all compiled defaults", () => {
    expect(overlayTierConfig([])).toEqual(defaultTierConfig());
  });

  test("overlays per plan, leaving the other plan at defaults", () => {
    const cfg = overlayTierConfig([{ plan: "pro", config: { priceUsd: 25 } }]);
    expect(cfg.prices.pro).toBe(25);
    expect(cfg.prices.standard).toBe(PLAN_PRICE_USD.standard);
    expect(cfg.entitlements.standard).toEqual(ENTITLEMENTS.standard);
  });

  test("a malformed row never throws and yields defaults for that plan", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const cfg = overlayTierConfig([{ plan: "standard", config: 42 as unknown }]);
    expect(cfg.entitlements.standard).toEqual(ENTITLEMENTS.standard);
    spy.mockRestore();
  });
});
