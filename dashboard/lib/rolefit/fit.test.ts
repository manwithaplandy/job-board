import { describe, expect, it, test } from "vitest";
import { fitColor, fmtPay, fmtPosted, initialsOf } from "@/lib/rolefit/fit";
import { computeFit } from "@/lib/rolefit/fit";

describe("fitColor", () => {
  test("returns oklch strings across the range", () => {
    for (const f of [48, 72, 96]) {
      expect(fitColor(f).strong).toMatch(/^oklch\(/);
    }
  });
  test("low fit uses light text-on, high fit also defined", () => {
    expect(typeof fitColor(50).textOn).toBe("string");
    expect(typeof fitColor(95).textOn).toBe("string");
  });
});

describe("initialsOf", () => {
  test("two words -> first letters", () => { expect(initialsOf("Pixel Co")).toBe("PC"); });
  test("single word -> first two chars upper", () => { expect(initialsOf("cobalt")).toBe("CO"); });
});

describe("fmtPay", () => {
  test("annual range formats to $k", () => {
    expect(fmtPay({ pay_min: 170000, pay_max: 210000, pay_currency: "USD", pay_period: "year" }))
      .toBe("$170k–210k");
  });
  test("hourly formats with /hr", () => {
    expect(fmtPay({ pay_min: 80, pay_max: 100, pay_currency: "USD", pay_period: "hour" }))
      .toBe("$80–100/hr");
  });
  test("no pay -> null", () => {
    expect(fmtPay({ pay_min: null, pay_max: null, pay_currency: null, pay_period: null })).toBeNull();
  });
  it("formats lower-bound-only pay", () => expect(fmtPay({ pay_min: 120_000, pay_max: null, pay_currency: "USD", pay_period: "year" })).toBe("From $120k"));
  it("formats upper-bound-only pay", () => expect(fmtPay({ pay_max: 180_000, pay_min: null, pay_currency: "USD", pay_period: "year" })).toBe("Up to $180k"));
});

describe("fmtPosted", () => {
  test("same day -> today", () => {
    expect(fmtPosted("2026-06-26T08:00:00Z", "2026-06-26T20:00:00Z")).toBe("today");
  });
  test("one day -> 1 day ago", () => {
    expect(fmtPosted("2026-06-25T08:00:00Z", "2026-06-26T20:00:00Z")).toBe("1 day ago");
  });
  test("n days", () => {
    expect(fmtPosted("2026-06-20T08:00:00Z", "2026-06-26T08:00:00Z")).toBe("6 days ago");
  });
});

describe("computeFit (parity with reviewer/scoring.py)", () => {
  const base = {
    skillsScore: 80, experienceScore: 70, compScore: 60,
    experienceMatch: "match", confidence: "high", redFlags: [], verdict: "approve",
  };
  test("weighted sum + bonuses", () => {
    // 0.45*80 + 0.30*70 + 0.25*60 = 72; +4 (match) +3 (high) = 79
    expect(computeFit(base)).toBe(79);
  });
  test("red-flag penalty caps at 9", () => {
    expect(computeFit({ ...base, redFlags: ["a", "b", "c", "d"] })).toBe(70); // 79-9
  });
  test("deny caps at 58", () => {
    expect(computeFit({ ...base, verdict: "deny" })).toBe(58);
  });
  test("banker's rounding: .5 rounds to even (down) — 0.5 -> 0", () => {
    // 0.45*0 + 0.30*0 + 0.25*2 = 0.5; no bonuses (experienceMatch null, confidence "medium")
    expect(computeFit({ skillsScore: 0, experienceScore: 0, compScore: 2,
      experienceMatch: null, confidence: "medium", redFlags: [], verdict: "approve" })).toBe(0);
  });
  test("banker's rounding: .5 rounds to even (up) — 1.5 -> 2", () => {
    // 0.25*6 = 1.5 -> nearest even is 2
    expect(computeFit({ skillsScore: 0, experienceScore: 0, compScore: 6,
      experienceMatch: null, confidence: "medium", redFlags: [], verdict: "approve" })).toBe(2);
  });
});
