import { describe, expect, test } from "vitest";
import { computeHealth, isNew, derivePipelineStatus } from "@/lib/status";

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

describe("derivePipelineStatus", () => {
  const now = new Date("2026-06-29T12:00:00Z");

  test("1. running — unfinished within grace", () => {
    expect(
      derivePipelineStatus({
        latest: { started_at: "2026-06-29T11:00:00Z", finished_at: null },
        lastSuccess: { finished_at: "2026-06-29T11:00:00Z" },
        now,
        intervalHours: 2,
      }),
    ).toBe("running");
  });

  test("2. crash-failed — unfinished beyond grace (6h ≥ 3h)", () => {
    expect(
      derivePipelineStatus({
        latest: { started_at: "2026-06-29T06:00:00Z", finished_at: null },
        lastSuccess: { finished_at: "2026-06-29T11:00:00Z" },
        now,
        intervalHours: 2,
      }),
    ).toBe("failed");
  });

  test("3. discovery error → failed", () => {
    expect(
      derivePipelineStatus({
        latest: {
          started_at: "2026-06-29T10:00:00Z",
          finished_at: "2026-06-29T10:30:00Z",
          status: "error",
        },
        lastSuccess: { finished_at: "2026-06-27T06:00:00Z" },
        now,
        intervalHours: 168,
      }),
    ).toBe("failed");
  });

  test("4. discovery halted_no_credits → failed", () => {
    expect(
      derivePipelineStatus({
        latest: {
          started_at: "2026-06-29T10:00:00Z",
          finished_at: "2026-06-29T10:30:00Z",
          status: "halted_no_credits",
        },
        lastSuccess: { finished_at: "2026-06-27T06:00:00Z" },
        now,
        intervalHours: 168,
      }),
    ).toBe("failed");
  });

  test("5. poller warn — failure rate 0.667 > 0.6", () => {
    expect(
      derivePipelineStatus({
        latest: {
          started_at: "2026-06-29T11:00:00Z",
          finished_at: "2026-06-29T11:05:00Z",
          companies_ok: 10,
          companies_failed: 20,
        },
        lastSuccess: { finished_at: "2026-06-29T11:05:00Z" },
        now,
        intervalHours: 2,
      }),
    ).toBe("warn");
  });

  test("6. poller ~38% failure rate → ok", () => {
    expect(
      derivePipelineStatus({
        latest: {
          started_at: "2026-06-29T11:00:00Z",
          finished_at: "2026-06-29T11:05:00Z",
          companies_ok: 62,
          companies_failed: 38,
        },
        lastSuccess: { finished_at: "2026-06-29T11:05:00Z" },
        now,
        intervalHours: 2,
      }),
    ).toBe("ok");
  });

  test("7. poller exactly 60% failure rate → ok (boundary: strict >)", () => {
    expect(
      derivePipelineStatus({
        latest: {
          started_at: "2026-06-29T11:00:00Z",
          finished_at: "2026-06-29T11:05:00Z",
          companies_ok: 40,
          companies_failed: 60,
        },
        lastSuccess: { finished_at: "2026-06-29T11:05:00Z" },
        now,
        intervalHours: 2,
      }),
    ).toBe("ok");
  });

  test("8. stale — lastSuccess ~5.8h ago > 2×2h threshold", () => {
    expect(
      derivePipelineStatus({
        latest: {
          started_at: "2026-06-29T06:00:00Z",
          finished_at: "2026-06-29T06:10:00Z",
          companies_ok: 50,
          companies_failed: 5,
        },
        lastSuccess: { finished_at: "2026-06-29T06:10:00Z" },
        now,
        intervalHours: 2,
      }),
    ).toBe("stale");
  });

  test("9a. weekly discovery NOT stale with intervalHours:168 (53.5h < 336h)", () => {
    expect(
      derivePipelineStatus({
        latest: {
          started_at: "2026-06-27T06:00:00Z",
          finished_at: "2026-06-27T06:30:00Z",
          status: "completed",
        },
        lastSuccess: { finished_at: "2026-06-27T06:30:00Z" },
        now,
        intervalHours: 168,
      }),
    ).toBe("ok");
  });

  test("9b. same rows stale with intervalHours:2 (53.5h > 4h)", () => {
    expect(
      derivePipelineStatus({
        latest: {
          started_at: "2026-06-27T06:00:00Z",
          finished_at: "2026-06-27T06:30:00Z",
          status: "completed",
        },
        lastSuccess: { finished_at: "2026-06-27T06:30:00Z" },
        now,
        intervalHours: 2,
      }),
    ).toBe("stale");
  });

  test("10. no runs at all → stale", () => {
    expect(
      derivePipelineStatus({
        latest: null,
        lastSuccess: null,
        now,
        intervalHours: 2,
      }),
    ).toBe("stale");
  });

  test("11. reviewer per-item errors ignored → ok", () => {
    const reviewerRun = { started_at: "2026-06-29T11:00:00Z", finished_at: "2026-06-29T11:05:00Z", errors: 1 };
    expect(
      derivePipelineStatus({
        latest: reviewerRun,
        lastSuccess: { finished_at: "2026-06-29T11:05:00Z" },
        now,
        intervalHours: 2,
      }),
    ).toBe("ok");
  });

  test("12. discovery per-item errors ignored → ok", () => {
    const discoveryRun = { started_at: "2026-06-29T11:00:00Z", finished_at: "2026-06-29T11:05:00Z", status: "completed", errors: 90 };
    expect(
      derivePipelineStatus({
        latest: discoveryRun,
        lastSuccess: { finished_at: "2026-06-28T06:00:00Z" },
        now,
        intervalHours: 168,
      }),
    ).toBe("ok");
  });

  test("13. plain ok", () => {
    expect(
      derivePipelineStatus({
        latest: {
          started_at: "2026-06-29T11:00:00Z",
          finished_at: "2026-06-29T11:05:00Z",
          companies_ok: 60,
          companies_failed: 2,
        },
        lastSuccess: { finished_at: "2026-06-29T11:05:00Z" },
        now,
        intervalHours: 2,
      }),
    ).toBe("ok");
  });
});
