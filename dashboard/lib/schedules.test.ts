import { describe, expect, test } from "vitest";
import { nextRun, SCHEDULES } from "@/lib/schedules";

describe("SCHEDULES shape", () => {
  test("poller is interval every 2h at minute 0", () => {
    expect(SCHEDULES.poller).toEqual({ kind: "interval", everyHours: 2, atMinute: 0 });
  });

  test("reviewer is interval every 2h at minute 0", () => {
    expect(SCHEDULES.reviewer).toEqual({ kind: "interval", everyHours: 2, atMinute: 0 });
  });

  test("discovery is weekly Mon 06:00 UTC", () => {
    expect(SCHEDULES.discovery).toEqual({ kind: "weekly", weekday: 1, atHour: 6, atMinute: 0 });
  });
});

describe("nextRun — interval (everyHours:2, atMinute:0)", () => {
  const s = SCHEDULES.poller; // { kind:"interval", everyHours:2, atMinute:0 }

  test("mid-interval: returns next even-hour boundary", () => {
    const now = new Date("2026-06-29T09:15:00Z");
    expect(nextRun(s, now).toISOString()).toBe("2026-06-29T10:00:00.000Z");
  });

  test("exactly on a boundary: returns the FOLLOWING fire time (strictly future)", () => {
    const now = new Date("2026-06-29T10:00:00Z");
    expect(nextRun(s, now).toISOString()).toBe("2026-06-29T12:00:00.000Z");
  });

  test("end-of-day rollover: wraps to next day at 00:00 UTC", () => {
    const now = new Date("2026-06-29T23:30:00Z");
    expect(nextRun(s, now).toISOString()).toBe("2026-06-30T00:00:00.000Z");
  });
});

describe("nextRun — weekly (weekday:1 Mon, atHour:6, atMinute:0)", () => {
  const s = SCHEDULES.discovery; // { kind:"weekly", weekday:1, atHour:6, atMinute:0 }

  test("same day before the time: returns today's fire time", () => {
    // 2026-06-29 is Monday
    const now = new Date("2026-06-29T05:00:00Z");
    expect(nextRun(s, now).toISOString()).toBe("2026-06-29T06:00:00.000Z");
  });

  test("same day after the time: returns next Monday", () => {
    const now = new Date("2026-06-29T07:00:00Z");
    expect(nextRun(s, now).toISOString()).toBe("2026-07-06T06:00:00.000Z");
  });

  test("exactly on the weekly boundary: returns the FOLLOWING occurrence (strictly future)", () => {
    const now = new Date("2026-06-29T06:00:00Z");
    expect(nextRun(s, now).toISOString()).toBe("2026-07-06T06:00:00.000Z");
  });

  test("mid-week (Wed): returns next Monday", () => {
    // 2026-07-01 is Wednesday
    const now = new Date("2026-07-01T12:00:00Z");
    expect(nextRun(s, now).toISOString()).toBe("2026-07-06T06:00:00.000Z");
  });

  test("week rollover from the day after (Tue): returns next Monday", () => {
    // 2026-06-30 is Tuesday
    const now = new Date("2026-06-30T12:00:00Z");
    expect(nextRun(s, now).toISOString()).toBe("2026-07-06T06:00:00.000Z");
  });
});
