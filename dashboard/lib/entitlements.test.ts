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
  REASONING_EFFORTS,
  resolveReasoningEffort,
  validateReasoningEffort,
} from "@/lib/entitlements";

const NOW = new Date("2026-07-03T00:00:00Z");
const future = (days: number) => new Date(NOW.getTime() + days * 86400_000);

describe("resolvePlan", () => {
  test("active subscription within period returns its plan", () => {
    expect(
      resolvePlan({ plan: "pro", status: "active", current_period_end: future(10) }, false, NOW),
    ).toBe("pro");
  });

  test("trialing standard entitles at standard", () => {
    expect(
      resolvePlan({ plan: "standard", status: "trialing", current_period_end: future(5) }, false, NOW),
    ).toBe("standard");
  });

  test("trialing pro is CLAMPED to standard — an unpaid trial can't unlock premium", () => {
    expect(
      resolvePlan({ plan: "pro", status: "trialing", current_period_end: future(5) }, false, NOW),
    ).toBe("standard");
  });

  test("active pro (paid) still gets the full plan", () => {
    expect(
      resolvePlan({ plan: "pro", status: "active", current_period_end: future(5) }, false, NOW),
    ).toBe("pro");
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

describe("resolvePlan operator override (pin semantics)", () => {
  test("active pin DOWNGRADES below a paying subscription", () => {
    expect(
      resolvePlan(
        { plan: "pro", status: "active", current_period_end: future(10) },
        false, NOW, "standard", { plan: "standard", expires_at: null },
      ),
    ).toBe("standard");
  });

  test("active pin comps a stranger (no sub, not invited) to pro", () => {
    expect(resolvePlan(null, false, NOW, "standard", { plan: "pro", expires_at: null })).toBe("pro");
  });

  test("pin wins even when invite comping is off (compPlan none)", () => {
    expect(resolvePlan(null, true, NOW, "none", { plan: "standard", expires_at: null })).toBe("standard");
  });

  test("future-dated pin is active; expired pin falls through", () => {
    expect(resolvePlan(null, false, NOW, "standard", { plan: "pro", expires_at: future(1) })).toBe("pro");
    // expired + invited → back to the natural comp
    expect(resolvePlan(null, true, NOW, "standard", { plan: "pro", expires_at: future(-1) })).toBe("standard");
    // expired + stranger → null
    expect(resolvePlan(null, false, NOW, "standard", { plan: "pro", expires_at: future(-1) })).toBeNull();
  });

  test("string expiry (DB/json round-trip) works; junk plan or junk date is inert", () => {
    expect(
      resolvePlan(null, false, NOW, "standard", { plan: "pro", expires_at: future(2).toISOString() }),
    ).toBe("pro");
    expect(resolvePlan(null, false, NOW, "standard", { plan: "platinum", expires_at: null })).toBeNull();
    expect(resolvePlan(null, false, NOW, "standard", { plan: "pro", expires_at: "not-a-date" })).toBeNull();
  });

  test("a pin is NOT trial-clamped — pro pin + trialing pro sub stays pro", () => {
    expect(
      resolvePlan(
        { plan: "pro", status: "trialing", current_period_end: future(5) },
        false, NOW, "standard", { plan: "pro", expires_at: null },
      ),
    ).toBe("pro");
  });

  test("null/absent override preserves existing behavior exactly", () => {
    expect(
      resolvePlan({ plan: "pro", status: "active", current_period_end: future(10) }, false, NOW, "standard", null),
    ).toBe("pro");
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

describe("optional entitlements override (T1 overlay)", () => {
  const overlay = {
    standard: { stage2Models: { cheap: 650 }, monthlyResume: 45, monthlyCover: 30 },
    pro: { stage2Models: { cheap: 1000, premium: 250 }, monthlyResume: 100, monthlyCover: 100 },
  };
  test("dailyReviewCap honors the passed map", () => {
    expect(dailyReviewCap("standard", CHEAP_MODEL, overlay)).toBe(650);
    expect(dailyReviewCap("pro", PREMIUM_MODEL, overlay)).toBe(250);
    // default arg still resolves the compiled table
    expect(dailyReviewCap("standard", CHEAP_MODEL)).toBe(400);
  });
  test("monthlyAllowance honors the passed map", () => {
    expect(monthlyAllowance("standard", "resume", overlay)).toBe(45);
    expect(monthlyAllowance("standard", "resume")).toBe(30);
  });
  test("resolveStage2Model honors the passed map's slots", () => {
    expect(resolveStage2Model("pro", PREMIUM_MODEL, overlay)).toBe(PREMIUM_MODEL);
  });
});

describe("ENTITLEMENTS table shape", () => {
  test("standard has no premium slot; pro has both", () => {
    expect(ENTITLEMENTS.standard.stage2Models.premium).toBeUndefined();
    expect(ENTITLEMENTS.pro.stage2Models.premium).toBe(100);
  });
});

describe("resolveReasoningEffort", () => {
  test("pro keeps every level", () => {
    for (const e of ["off", "low", "medium", "high"] as const) {
      expect(resolveReasoningEffort("pro", e)).toBe(e);
    }
  });

  test("standard keeps off/low and CLAMPS medium/high down to low", () => {
    expect(resolveReasoningEffort("standard", "off")).toBe("off");
    expect(resolveReasoningEffort("standard", "low")).toBe("low");
    expect(resolveReasoningEffort("standard", "medium")).toBe("low");
    expect(resolveReasoningEffort("standard", "high")).toBe("low");
  });

  test("null plan always resolves to off", () => {
    expect(resolveReasoningEffort(null, "high")).toBe("off");
    expect(resolveReasoningEffort(null, "off")).toBe("off");
  });

  test("tier table matches the spec", () => {
    expect(REASONING_EFFORTS.standard).toEqual(["off", "low"]);
    expect(REASONING_EFFORTS.pro).toEqual(["off", "low", "medium", "high"]);
  });
});

describe("validateReasoningEffort", () => {
  test("empty and 'off' normalize to null (Off is the stored default)", () => {
    expect(validateReasoningEffort("", "pro")).toEqual({ ok: true, value: null });
    expect(validateReasoningEffort("off", "standard")).toEqual({ ok: true, value: null });
  });

  test("low is accepted on any plan (incl. null — call time clamps anyway)", () => {
    expect(validateReasoningEffort("low", "standard")).toEqual({ ok: true, value: "low" });
    expect(validateReasoningEffort("low", null)).toEqual({ ok: true, value: "low" });
  });

  test("medium/high require pro", () => {
    expect(validateReasoningEffort("medium", "pro")).toEqual({ ok: true, value: "medium" });
    expect(validateReasoningEffort("high", "pro")).toEqual({ ok: true, value: "high" });
    expect(validateReasoningEffort("medium", "standard")).toEqual({
      ok: false, reason: "Medium and High reasoning effort require the Pro plan.",
    });
    expect(validateReasoningEffort("high", null)).toEqual({
      ok: false, reason: "Medium and High reasoning effort require the Pro plan.",
    });
  });

  test("unknown values are rejected (hand-crafted form posts)", () => {
    expect(validateReasoningEffort("maximum", "pro")).toEqual({
      ok: false, reason: "unknown reasoning effort: maximum",
    });
  });
});

describe("resolvePlan comp plan (invite comp config)", () => {
  const now = new Date("2026-07-13T00:00:00Z");
  test("invited + default comp → standard (unchanged behavior)", () => {
    expect(resolvePlan(null, true, now)).toBe("standard");
  });
  test("invited + compPlan pro → pro", () => {
    expect(resolvePlan(null, true, now, "pro")).toBe("pro");
  });
  test("invited + compPlan none → null (comping switched off)", () => {
    expect(resolvePlan(null, true, now, "none")).toBeNull();
  });
  test("a paying subscription still wins over the comp plan", () => {
    const sub = { plan: "pro", status: "active", current_period_end: new Date("2026-08-01") };
    expect(resolvePlan(sub, true, now, "none")).toBe("pro");
  });
  test("not invited → compPlan irrelevant, null", () => {
    expect(resolvePlan(null, false, now, "pro")).toBeNull();
  });
});
