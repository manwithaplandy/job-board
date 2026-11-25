import { beforeEach, describe, expect, test, vi } from "vitest";

const db = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_u: string, fn: (t: unknown) => Promise<unknown>) =>
    fn((strings: TemplateStringsArray) => {
      db.calls.push(strings.join("?"));
      return Promise.resolve([]);
    }),
  ),
  withUserMutation: vi.fn(),
}));

import {
  saveTileLayout, TileLayoutError, TileLayoutSchema, TileSpecSchema, VIZ, VIZ_FOR_KIND, type TileSpec,
} from "@/lib/workspaces/analyticsTiles";
import { METRIC_CATALOG, METRIC_IDS } from "@/lib/workspaces/metrics/catalog";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tile = (extra: Partial<TileSpec> = {}): TileSpec => ({
  id: "t1", metric: "applications_by_stage", window: "30d", viz: "bar", size: "medium", title: "By stage", ...extra,
});

beforeEach(() => {
  db.calls = [];
});

describe("TileSpecSchema", () => {
  test("a stat tile on a series metric is rejected", () => {
    expect(TileSpecSchema.safeParse(tile({ metric: "weekly_activity", viz: "stat" })).success).toBe(false);
    expect(TileSpecSchema.safeParse(tile({ metric: "weekly_activity", viz: "line" })).success).toBe(true);
    expect(TileSpecSchema.safeParse(tile({ metric: "response_rate", viz: "table" })).success).toBe(false);
    expect(TileSpecSchema.safeParse(tile({ metric: "response_rate", viz: "stat" })).success).toBe(true);
  });

  test("every metric has at least one viz, and every viz draws some kind", () => {
    for (const id of METRIC_IDS) expect(VIZ_FOR_KIND[METRIC_CATALOG[id].kind].length).toBeGreaterThan(0);
    const drawn = new Set(Object.values(VIZ_FOR_KIND).flat());
    expect([...VIZ].every((v) => drawn.has(v))).toBe(true);
  });

  test("the catalog's groupBy, window and filter rules apply to tiles", () => {
    expect(TileSpecSchema.safeParse(tile({ groupBy: "week" })).success).toBe(false);
    expect(TileSpecSchema.safeParse(tile({ metric: "stale_applications", viz: "stat", window: "7d" })).success).toBe(false);
    expect(TileSpecSchema.safeParse(tile({ metric: "skip_reasons", filter: { stage: ["applied"] } })).success).toBe(false);
    expect(TileSpecSchema.safeParse(tile({ filter: { stage: ["applied"] } })).success).toBe(true);
  });

  test("title, note, id and unknown keys are checked", () => {
    expect(TileSpecSchema.safeParse(tile({ title: "" })).success).toBe(false);
    expect(TileSpecSchema.safeParse(tile({ title: "   " })).success).toBe(false);
    expect(TileSpecSchema.safeParse(tile({ title: "x".repeat(61) })).success).toBe(false);
    expect(TileSpecSchema.safeParse(tile({ note: "n".repeat(141) })).success).toBe(false);
    expect(TileSpecSchema.safeParse(tile({ note: "n".repeat(140) })).success).toBe(true);
    expect(TileSpecSchema.safeParse(tile({ id: "has space" })).success).toBe(false);
    expect(TileSpecSchema.safeParse({ ...tile(), sql: "select 1" }).success).toBe(false);
    expect(TileSpecSchema.safeParse(tile({ size: "huge" as TileSpec["size"] })).success).toBe(false);
  });
});

describe("TileLayoutSchema", () => {
  const items = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      i % 2 === 0 ? { type: "tile" as const, tile: tile({ id: `t${i}` }) } : { type: "heading" as const, text: `H${i}` });

  test("a 25th item is rejected", () => {
    expect(TileLayoutSchema.safeParse({ items: items(24) }).success).toBe(true);
    expect(TileLayoutSchema.safeParse({ items: items(25) }).success).toBe(false);
  });

  test("duplicate tile ids, blank headings and unknown item types are rejected", () => {
    expect(TileLayoutSchema.safeParse({ items: [{ type: "tile", tile: tile() }, { type: "tile", tile: tile() }] }).success)
      .toBe(false);
    expect(TileLayoutSchema.safeParse({ items: [{ type: "heading", text: " " }] }).success).toBe(false);
    expect(TileLayoutSchema.safeParse({ items: [{ type: "image", src: "x" }] }).success).toBe(false);
  });

  test("saveTileLayout refuses a bad layout or writer before any SQL", async () => {
    await expect(saveTileLayout(USER, { items: items(25) }, "user")).rejects.toThrow(TileLayoutError);
    await expect(saveTileLayout(USER, { items: [] }, "system" as "user")).rejects.toThrow(TileLayoutError);
    expect(db.calls).toHaveLength(0);
  });

  test("an unattended run may not change the analytics page", async () => {
    const audit = { userId: USER, threadId: null, runId: "22222222-2222-4222-8222-222222222222", unattended: true };
    await expect(saveTileLayout(USER, { items: [] }, "agent", audit)).rejects.toThrow(TileLayoutError);
    expect(db.calls).toHaveLength(0);
  });
});
