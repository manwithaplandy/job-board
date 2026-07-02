import { describe, expect, test } from "vitest";
import { parseBoardFilters, serializeBoardFilters } from "@/lib/rolefit/boardFilters";
import { DEFAULT_FILTERS } from "@/lib/rolefit/filter";

describe("parseBoardFilters", () => {
  test("null/undefined/garbage/non-object → all defaults", () => {
    expect(parseBoardFilters(null)).toEqual(DEFAULT_FILTERS);
    expect(parseBoardFilters(undefined)).toEqual(DEFAULT_FILTERS);
    expect(parseBoardFilters("not json")).toEqual(DEFAULT_FILTERS);
    expect(parseBoardFilters(42)).toEqual(DEFAULT_FILTERS);
  });

  test("parses a valid JSON string", () => {
    const f = parseBoardFilters(
      '{"search":"eng","cats":["Backend"],"locs":["Berlin"],"remote":"remote","minFit":75,"payMin":150,"sort":"pay"}',
    );
    expect(f).toEqual({
      search: "eng", cats: ["Backend"], locs: ["Berlin"], sources: [],
      remote: "remote", minFit: 75, payMin: 150, sort: "pay",
    });
  });

  test("parses a plain object and falls back per-field for missing keys", () => {
    expect(parseBoardFilters({ search: "x" })).toEqual({ ...DEFAULT_FILTERS, search: "x" });
  });

  test("invalid enum values fall back to defaults", () => {
    expect(parseBoardFilters({ remote: "moon", sort: "weird" })).toMatchObject({
      remote: "all", sort: "match",
    });
  });

  test("negative, non-finite, or wrong-typed numbers → 0", () => {
    expect(parseBoardFilters({ minFit: -5, payMin: Infinity })).toMatchObject({ minFit: 0, payMin: 0 });
    expect(parseBoardFilters({ minFit: "75" })).toMatchObject({ minFit: 0 });
  });

  test("array fields drop non-strings and cap at 50 entries", () => {
    expect(parseBoardFilters({ cats: ["a", 5, null, "b"] }).cats).toEqual(["a", "b"]);
    const many = Array.from({ length: 80 }, (_, i) => `c${i}`);
    expect(parseBoardFilters({ cats: many }).cats).toHaveLength(50);
  });

  test("non-array cats/locs → []", () => {
    expect(parseBoardFilters({ cats: "Backend" }).cats).toEqual([]);
  });

  test("sources round-trips; invalid input collapses to []", () => {
    expect(parseBoardFilters({ sources: ["greenhouse", "workday"] }).sources)
      .toEqual(["greenhouse", "workday"]);
    expect(parseBoardFilters({ sources: "greenhouse" }).sources).toEqual([]);
    expect(parseBoardFilters({ sources: ["greenhouse", 5, null] }).sources).toEqual(["greenhouse"]);
    expect(parseBoardFilters({}).sources).toEqual([]);
  });

  test("over-long search is truncated to 200 chars", () => {
    expect(parseBoardFilters({ search: "x".repeat(500) }).search).toHaveLength(200);
  });

  test("serialize → parse round-trips", () => {
    const f = { ...DEFAULT_FILTERS, search: "hi", cats: ["X"], remote: "hybrid" as const };
    expect(parseBoardFilters(serializeBoardFilters(f))).toEqual(f);
  });
});
