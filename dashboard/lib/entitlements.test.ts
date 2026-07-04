import { describe, expect, test } from "vitest";
import {
  CHEAP_MODEL,
  PREMIUM_MODEL,
  ENTITLEMENTS,
  resolvePlan,
  resolveStage2Model,
  dailyReviewCap,
  monthlyAllowance,
  modelSlot,
} from "@/lib/entitlements";

const NOW = new Date("2026-07-03T00:00:00Z");
const future = (days: number) => new Date(NOW.getTime() + days * 86400_000);

describe("resolvePlan", () => {
  test("active subscription within period returns its plan", () => {
    expect(
      resolvePlan({ plan: "pro", status: "active", current_period_end: future(10) }, false, NOW),
    ).toBe("pro");
  });

  test("trialing counts as active", () => {
    expect(
      resolvePlan({ plan: "standard", status: "trialing", current_period_end: future(5) }, false, NOW),
    ).toBe("standard");
  });

  test("expired but within 3-day grace still resolves", () => {
    expect(
      resolvePlan({ plan: "pro", status: "active", current_period_end: future(-2) }, false, NOW),
    ).toBe("pro");
  });

  test("past the grace boundary no longer resolves via subscription", () => {
    expect(
      resolvePlan({ plan: "pro", status: "active", current_period_end: future(-4) }, false, NOW),
    ).toBeNull();
  });

  test("canceled status does not entitle", () => {
    expect(
      resolvePlan({ plan: "pro", status: "canceled", current_period_end: future(10) }, false, NOW),
    ).toBeNull();
  });

  test("comped invited user with no subscription gets standard", () => {
    expect(resolvePlan(null, true, NOW)).toBe("standard");
    expect(
      resolvePlan({ plan: "pro", status: "canceled", current_period_end: future(-40) }, true, NOW),
    ).toBe("standard");
  });

  test("stranger with neither gets null", () => {
    expect(resolvePlan(null, false, NOW)).toBeNull();
  });
});

describe("resolveStage2Model", () => {
  test("standard cannot run premium — falls back to cheap", () => {
    expect(resolveStage2Model("standard", PREMIUM_MODEL)).toBe(CHEAP_MODEL);
  });
  test("pro runs premium when requested", () => {
    expect(resolveStage2Model("pro", PREMIUM_MODEL)).toBe(PREMIUM_MODEL);
  });
  test("unknown/blank requested model falls back to cheap", () => {
    expect(resolveStage2Model("pro", "some/other-model")).toBe(CHEAP_MODEL);
    expect(resolveStage2Model("pro", null)).toBe(CHEAP_MODEL);
  });
  test("null plan is always cheap", () => {
    expect(resolveStage2Model(null, PREMIUM_MODEL)).toBe(CHEAP_MODEL);
  });
});

describe("dailyReviewCap", () => {
  test("per-model caps match the pricing table", () => {
    expect(dailyReviewCap("standard", CHEAP_MODEL)).toBe(400);
    expect(dailyReviewCap("pro", CHEAP_MODEL)).toBe(1000);
    expect(dailyReviewCap("pro", PREMIUM_MODEL)).toBe(100);
  });
  test("null plan caps at 0", () => {
    expect(dailyReviewCap(null, CHEAP_MODEL)).toBe(0);
  });
});

describe("monthlyAllowance", () => {
  test("matches the pricing table", () => {
    expect(monthlyAllowance("standard", "resume")).toBe(30);
    expect(monthlyAllowance("standard", "cover")).toBe(30);
    expect(monthlyAllowance("pro", "resume")).toBe(100);
    expect(monthlyAllowance("pro", "cover")).toBe(100);
    expect(monthlyAllowance(null, "resume")).toBe(0);
  });
});

describe("modelSlot", () => {
  test("maps model ids to slots", () => {
    expect(modelSlot(CHEAP_MODEL)).toBe("cheap");
    expect(modelSlot(PREMIUM_MODEL)).toBe("premium");
    expect(modelSlot("x")).toBeNull();
    expect(modelSlot(null)).toBeNull();
  });
});

describe("ENTITLEMENTS table shape", () => {
  test("standard has no premium slot; pro has both", () => {
    expect(ENTITLEMENTS.standard.stage2Models.premium).toBeUndefined();
    expect(ENTITLEMENTS.pro.stage2Models.premium).toBe(100);
  });
});
