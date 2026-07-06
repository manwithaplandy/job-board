import { describe, expect, test } from "vitest";
import { tierGateNotice } from "./tierGate";

// The mapper is the single place a rejected gated fetch becomes an upsell notice; it
// must key off status + the body's machine `code` (never the human error string), and
// must return null for everything that is NOT a tier gate so generic error handling
// keeps working (e.g. an upstream LLM rate limit also arrives as a 429).

describe("tierGateNotice — 402 subscription required", () => {
  test("keeps the server's error as the base message and adds the entry price + CTA", () => {
    const n = tierGateNotice(402, {
      error: "Subscribe to generate résumés and cover letters.",
      code: "subscription_required",
    });
    expect(n).not.toBeNull();
    expect(n!.message).toContain("Subscribe to generate résumés and cover letters.");
    expect(n!.message).toContain("Plans start at $5/month.");
    expect(n!.cta).toBe("See plans");
  });

  test("402 is decisive even without a code or a usable body (defensive default copy)", () => {
    const n = tierGateNotice(402, "not-an-object");
    expect(n).not.toBeNull();
    expect(n!.message).toContain("active subscription");
    expect(n!.cta).toBe("See plans");
  });
});

describe("tierGateNotice — 429 monthly allowance", () => {
  test("Standard: pitches Pro's bigger allowance and mentions the monthly reset", () => {
    const n = tierGateNotice(429, {
      error: "Monthly résumé allowance used (30/30 on Standard).",
      code: "allowance_exhausted",
      plan: "standard",
    });
    expect(n).not.toBeNull();
    expect(n!.message).toContain("Monthly résumé allowance used (30/30 on Standard).");
    expect(n!.message).toContain("resets next month");
    expect(n!.cta).toBe("Upgrade to Pro");
  });

  test("Pro: no false 'Upgrade to Pro' — neutral reset note + billing link", () => {
    const n = tierGateNotice(429, {
      error: "Monthly résumé allowance used (100/100 on Pro).",
      code: "allowance_exhausted",
      plan: "pro",
    });
    expect(n).not.toBeNull();
    expect(n!.message).toContain("resets at the start of next month");
    expect(n!.cta).toBe("View billing");
  });

  test("a bare 429 WITHOUT the gate's code (upstream LLM rate limit) is NOT a tier gate", () => {
    expect(tierGateNotice(429, { error: "Rate limited — try again in a moment." })).toBeNull();
  });
});

describe("tierGateNotice — 409 daily review budget", () => {
  test("Standard: keeps the reset note and pitches Pro's bigger daily budget", () => {
    const n = tierGateNotice(409, {
      error: "Daily review budget used — resumes tomorrow.",
      code: "review_budget_exhausted",
      plan: "standard",
    });
    expect(n).not.toBeNull();
    expect(n!.message).toContain("Daily review budget used — resumes tomorrow.");
    expect(n!.message).toContain("bigger daily review budget");
    expect(n!.cta).toBe("Upgrade to Pro");
  });

  test("a 409 WITHOUT the gate's code (generic conflict) is NOT a tier gate", () => {
    expect(tierGateNotice(409, { error: "already exists" })).toBeNull();
  });
});

describe("tierGateNotice — non-gate statuses stay on the generic path", () => {
  test.each([400, 401, 404, 422, 500, 502])("%i → null", (status) => {
    expect(tierGateNotice(status, { error: "boom", code: "allowance_exhausted" })).toBeNull();
  });
});
