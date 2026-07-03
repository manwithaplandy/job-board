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

describe("weekly binning conserves daily totals and places spikes correctly (real prod shape)", () => {
  // Reproduces the smoke-test production series: sparse history, one huge Saturday spike.
  const series: Point[] = [
    { day: "2026-06-24", new_jobs: 272 },
    { day: "2026-06-25", new_jobs: 2 },
    { day: "2026-06-26", new_jobs: 10 },
    { day: "2026-06-27", new_jobs: 114505 }, // Saturday spike
    { day: "2026-06-28", new_jobs: 132 },
    { day: "2026-06-29", new_jobs: 1765 },
    { day: "2026-06-30", new_jobs: 442 },
    { day: "2026-07-01", new_jobs: 2524 },
    { day: "2026-07-02", new_jobs: 2526 },
    { day: "2026-07-03", new_jobs: 2379 },
  ];
  const nowIso = "2026-07-03T09:00:00Z";
  const sum = (rows: Point[]) => rows.reduce((s, r) => s + (r.new_jobs as number), 0);

  test("the 2026-06-27 spike belongs to the ISO week starting 2026-06-22", () => {
    expect(weekStart("2026-06-27")).toBe("2026-06-22");
  });

  test("weekly totals equal daily totals over the same 90-day fill window", () => {
    const daily = fillDays(series, 90, nowIso, ["new_jobs"]);
    const weekly = toWeekly(daily, ["new_jobs"], []);
    expect(sum(weekly)).toBe(sum(daily));
    expect(sum(weekly)).toBe(124557);
  });

  test("weekly + 30-day window is NOT empty and carries the spike in week 2026-06-22", () => {
    const daily = fillDays(series, 90, nowIso, ["new_jobs"]);
    const weekly = toWeekly(daily, ["new_jobs"], []);
    const win30 = sliceWindow(weekly, 30, nowIso);
    expect(win30.find((w) => w.day === "2026-06-22")?.new_jobs).toBe(114921);
    expect(sum(win30)).toBe(124557);
  });

  test("weekly + 90-day window places the spike in 2026-06-22 (not weeks earlier)", () => {
    const daily = fillDays(series, 90, nowIso, ["new_jobs"]);
    const weekly = toWeekly(daily, ["new_jobs"], []);
    const win90 = sliceWindow(weekly, 90, nowIso);
    const nonZero = win90.filter((w) => (w.new_jobs as number) > 0).map((w) => w.day);
    expect(nonZero).toEqual(["2026-06-22", "2026-06-29"]);
  });
});
