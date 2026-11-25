import { beforeEach, describe, expect, test, vi } from "vitest";

// A fake transaction that records every statement; returns one canned row.
const db = vi.hoisted(() => ({
  calls: [] as { text: string; values: unknown[] }[],
  row: {} as Record<string, unknown>,
}));

vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_u: string, fn: (t: unknown) => Promise<unknown>) =>
    fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      db.calls.push({ text: strings.join("?"), values });
      return Promise.resolve([db.row]);
    }),
  ),
}));

const clock = vi.hoisted(() => ({ now: new Date("2026-06-01T00:00:00Z"), frozen: true }));
vi.mock("@/lib/catalogClock", () => ({ catalogNow: vi.fn(async () => clock) }));

import { METRIC_CATALOG, METRIC_IDS, MetricSpecSchema } from "@/lib/workspaces/metrics/catalog";
import { MetricSpecError, runMetric } from "@/lib/workspaces/metrics/queries";
import type { MetricSpec } from "@/lib/workspaces/types";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => {
  db.calls = [];
  db.row = {};
});

describe("the metric catalog", () => {
  test("a spec with a groupBy the metric does not allow fails the schema", () => {
    expect(MetricSpecSchema.safeParse({ metric: "response_rate", groupBy: "stage", window: "30d" }).success).toBe(false);
    expect(MetricSpecSchema.safeParse({ metric: "skip_reasons", groupBy: "week", window: "30d" }).success).toBe(false);
    expect(MetricSpecSchema.safeParse({ metric: "applications_by_stage", groupBy: "stage", window: "30d" }).success).toBe(true);
  });

  test("windows, filters and unknown keys outside the catalog fail the schema", () => {
    expect(MetricSpecSchema.safeParse({ metric: "stale_applications", window: "7d" }).success).toBe(false);
    expect(MetricSpecSchema.safeParse({ metric: "stale_applications", window: "all" }).success).toBe(true);
    expect(MetricSpecSchema.safeParse({ metric: "memo_changes", window: "30d", filter: { stage: ["applied"] } }).success)
      .toBe(false);
    expect(MetricSpecSchema.safeParse({ metric: "time_in_stage", window: "30d", filter: { stage: ["applied"] } }).success)
      .toBe(true);
    expect(MetricSpecSchema.safeParse({ metric: "memo_changes", window: "1y" }).success).toBe(false);
    expect(MetricSpecSchema.safeParse({ metric: "memo_changes", window: "all", sql: "x" }).success).toBe(false);
    expect(MetricSpecSchema.safeParse({ metric: "drop_tables", window: "all" }).success).toBe(false);
  });

  test("every metric has a catalog entry with a description and at least one window", () => {
    expect(Object.keys(METRIC_CATALOG).sort()).toEqual([...METRIC_IDS].sort());
    for (const id of METRIC_IDS) {
      expect(METRIC_CATALOG[id].description.length).toBeGreaterThan(0);
      expect(METRIC_CATALOG[id].windows.length).toBeGreaterThan(0);
    }
  });
});

describe("runMetric", () => {
  test("a spec outside the catalog throws before any SQL", async () => {
    const bad = { metric: "response_rate", groupBy: "stage", window: "30d" } as MetricSpec;
    await expect(runMetric(USER, bad)).rejects.toThrow(MetricSpecError);
    await expect(runMetric(USER, { metric: "nope", window: "all" } as unknown as MetricSpec)).rejects.toThrow(
      MetricSpecError,
    );
    expect(db.calls).toHaveLength(0);
  });

  test("stale_applications binds the catalog clock, not the wall clock", async () => {
    db.row = { n: "3", stale: "2" };
    const r = await runMetric(USER, { metric: "stale_applications", window: "all" });
    expect(r).toEqual({ spec: { metric: "stale_applications", window: "all" }, kind: "value", value: 2, n: 3 });
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].values).toContain(clock.now.toISOString());
    expect(db.calls[0].text).not.toMatch(/now\(\)/);
  });

  test("response_rate is null below five applications", async () => {
    db.row = { n: "4", responded: "4" };
    expect(await runMetric(USER, { metric: "response_rate", window: "all" })).toMatchObject({ value: null, n: 4 });
    db.row = { n: "8", responded: "3" };
    expect(await runMetric(USER, { metric: "response_rate", window: "all" })).toMatchObject({ value: 0.375, n: 8 });
  });

  test("a row that fails the parse throws rather than reading as zero", async () => {
    db.row = { n: "lots" };
    await expect(runMetric(USER, { metric: "memo_changes", window: "all" })).rejects.toThrow(/failed the parse/);
  });
});
