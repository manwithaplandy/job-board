import { describe, expect, test } from "vitest";
import { weekStart, fillDays, toWeekly, sliceWindow, rate, type Point } from "@/lib/trend";

describe("weekStart", () => {
  test("returns the Monday of the ISO week (UTC)", () => {
    // 2026-06-24 is a Wednesday → Monday is 2026-06-22
    expect(weekStart("2026-06-24")).toBe("2026-06-22");
    // Monday maps to itself
    expect(weekStart("2026-06-22")).toBe("2026-06-22");
    // Sunday belongs to the same ISO week as the preceding Monday
    expect(weekStart("2026-06-28")).toBe("2026-06-22");
  });
});

describe("fillDays", () => {
  test("produces exactly `days` ascending points ending on now, zero-filling gaps", () => {
    const rows: Point[] = [{ day: "2026-06-26", n: 5 }];
    const out = fillDays(rows, 3, "2026-06-28T12:00:00Z", ["n"]);
    expect(out.map((p) => p.day)).toEqual(["2026-06-26", "2026-06-27", "2026-06-28"]);
    expect(out.map((p) => p.n)).toEqual([5, 0, 0]);
  });
});

describe("toWeekly", () => {
  test("sums sumKeys and takes the latest in-week value for lastKeys", () => {
    const rows: Point[] = [
      { day: "2026-06-22", added: 2, backlog: 100 }, // Mon
      { day: "2026-06-24", added: 3, backlog: 80 },  // Wed (later in week)
    ];
    const out = toWeekly(rows, ["added"], ["backlog"]);
    expect(out).toEqual([{ day: "2026-06-22", added: 5, backlog: 80 }]);
  });
});

describe("sliceWindow", () => {
  test("keeps only points within the last `days`", () => {
    const rows: Point[] = [
      { day: "2026-05-01", n: 1 },
      { day: "2026-06-27", n: 2 },
      { day: "2026-06-28", n: 3 },
    ];
    const out = sliceWindow(rows, 30, "2026-06-28T00:00:00Z");
    expect(out.map((p) => p.day)).toEqual(["2026-06-27", "2026-06-28"]);
  });
});

describe("rate", () => {
  test("divides, and returns null (not NaN) on zero denominator", () => {
    expect(rate(3, 4)).toBe(0.75);
    expect(rate(0, 0)).toBeNull();
    expect(rate(5, 0)).toBeNull();
  });
});
