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
  planTier,
  stage2ModelTier,
  planForTier,
  REASONING_EFFORTS,
  resolveReasoningEffort,
  validateReasoningEffort,
} from "@/lib/entitlements";

const NOW = new Date("2026-07-03T00:00:00Z");
const future = (days: number) => new Date(NOW.getTime() + days * 86400_000);
const GEMINI = "google/gemini-3.5-flash";

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
  test("pro runs an arbitrary catalog model; only blank/null falls back to cheap", () => {
    // Was: any non-whitelist id clamped to cheap. Now the tier gate grants any catalog
    // model to Pro (that IS the feature); only a null/absent request falls back.
    expect(resolveStage2Model("pro", "some/other-model")).toBe("some/other-model");
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
  test("maps model ids to slots (tier-derived; unassigned → premium, never null)", () => {
    // Was a two-id whitelist returning null for anything else; now derived from the
    // access tier, so an unassigned id/null meters at the conservative premium slot.
    expect(modelSlot(CHEAP_MODEL)).toBe("cheap");
    expect(modelSlot(PREMIUM_MODEL)).toBe("premium");
    expect(modelSlot("x")).toBe("premium");
    expect(modelSlot(null)).toBe("premium");
  });
});

describe("extensible plan tiers (spec 2026-07-17 'Stage-2 model tiers')", () => {
  test("plan tier ranks: null < standard < pro", () => {
    expect(planTier(null)).toBe(0);
    expect(planTier("standard")).toBe(1);
    expect(planTier("pro")).toBe(2);
  });

  test("stage2 model tier: explicit tier-1 model, everything else defaults to tier 2", () => {
    expect(stage2ModelTier(CHEAP_MODEL)).toBe(1);
    expect(stage2ModelTier(GEMINI)).toBe(2);
    expect(stage2ModelTier(PREMIUM_MODEL)).toBe(2);
    expect(stage2ModelTier(null)).toBe(2);
  });

  test("gpt-5.4-nano is a Standard-available tier-1 model (cheap slot)", () => {
    const GPT_NANO = "openai/gpt-5.4-nano";
    expect(stage2ModelTier(GPT_NANO)).toBe(1);
    expect(modelSlot(GPT_NANO)).toBe("cheap");
    expect(resolveStage2Model("standard", GPT_NANO)).toBe(GPT_NANO);
    expect(resolveStage2Model("pro", GPT_NANO)).toBe(GPT_NANO);
    expect(dailyReviewCap("standard", GPT_NANO)).toBe(400);
  });

  test("planForTier returns the lowest plan meeting the tier", () => {
    expect(planForTier(1)).toBe("standard");
    expect(planForTier(2)).toBe("pro");
  });

  test("resolveStage2Model: Pro can run any catalog model (Gemini), Standard cannot", () => {
    expect(resolveStage2Model("pro", GEMINI)).toBe(GEMINI);
    expect(resolveStage2Model("pro", PREMIUM_MODEL)).toBe(PREMIUM_MODEL);
    expect(resolveStage2Model("pro", CHEAP_MODEL)).toBe(CHEAP_MODEL);
    expect(resolveStage2Model("standard", GEMINI)).toBe(CHEAP_MODEL);
    expect(resolveStage2Model("standard", PREMIUM_MODEL)).toBe(CHEAP_MODEL);
    expect(resolveStage2Model("standard", CHEAP_MODEL)).toBe(CHEAP_MODEL);
    expect(resolveStage2Model(null, GEMINI)).toBe(CHEAP_MODEL);
  });

  test("modelSlot: tier-1 → cheap, tier-2+ → premium (never null)", () => {
    expect(modelSlot(CHEAP_MODEL)).toBe("cheap");
    expect(modelSlot(PREMIUM_MODEL)).toBe("premium");
    expect(modelSlot(GEMINI)).toBe("premium");
  });

  test("dailyReviewCap: a Pro Gemini review meters at the premium (conservative) cap", () => {
    expect(dailyReviewCap("pro", GEMINI)).toBe(100);
    expect(dailyReviewCap("pro", CHEAP_MODEL)).toBe(1000);
    expect(dailyReviewCap("standard", CHEAP_MODEL)).toBe(400);
    expect(dailyReviewCap(null, GEMINI)).toBe(0);
  });

  // Guard against a recurrence of the exact bug this change fixes: if a plan GRANTS a
  // model's tier but does not FUND that model's cost slot, resolveStage2Model would
  // silently clamp while the save gate blames the user's OWN plan ("requires the <your
  // plan> plan"). Pins the entitlement data so a future tier can't reintroduce it.
  test("invariant: granting a model's tier implies funding its cost slot (no self-contradiction)", () => {
    const plans: import("@/lib/entitlements").Plan[] = ["standard", "pro"];
    for (const p of plans) {
      for (const m of [CHEAP_MODEL, PREMIUM_MODEL, GEMINI]) {
        if (planTier(p) >= stage2ModelTier(m)) expect(resolveStage2Model(p, m)).toBe(m);
      }
    }
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
      ok: false, reason: "Medium and High reasoning effort require the Pro plan.", tierGated: true,
    });
    expect(validateReasoningEffort("high", null)).toEqual({
      ok: false, reason: "Medium and High reasoning effort require the Pro plan.", tierGated: true,
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
