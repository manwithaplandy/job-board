import { describe, expect, test } from "vitest";
import { computeHealth, isNew } from "@/lib/status";

const now = new Date("2026-06-23T12:00:00Z");

describe("computeHealth", () => {
  test("null run or no finished_at → stale", () => {
    expect(computeHealth(null, now, 12)).toBe("stale");
    expect(computeHealth({ finished_at: null, failures: 0 }, now, 12)).toBe("stale");
  });

  test("older than staleHours → stale", () => {
    expect(
      computeHealth({ finished_at: "2026-06-22T20:00:00Z", failures: 0 }, now, 12),
    ).toBe("stale"); // 16h old
  });

  test("recent with failures → warn", () => {
    expect(
      computeHealth({ finished_at: "2026-06-23T11:00:00Z", failures: 2 }, now, 12),
    ).toBe("warn");
  });

  test("recent and clean → ok", () => {
    expect(
      computeHealth({ finished_at: "2026-06-23T11:00:00Z", failures: 0 }, now, 12),
    ).toBe("ok");
  });
});

describe("isNew", () => {
  test("within window → true; outside → false", () => {
    expect(isNew("2026-06-23T06:00:00Z", now, 48)).toBe(true); // 6h
    expect(isNew("2026-06-20T06:00:00Z", now, 48)).toBe(false); // 78h
  });
});
