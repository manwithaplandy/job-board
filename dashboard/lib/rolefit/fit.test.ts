import { describe, expect, test } from "vitest";
import { fitColor, fmtPay, fmtPosted, initialsOf } from "@/lib/rolefit/fit";

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
