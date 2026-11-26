// Reading the render smoke's results back (plan Task 2.13): files that do not match are
// skipped, the judge gets each variant 3 frame's words from its own matrix run only, and
// the counts add up.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { forRuns, readRenderResults, renderCounts, renderedTextIndex, v3MisstatementsByModel, type RenderResult } from "@/lib/agent/evals/renderResults";

const RUN = "20261126T010000Z";
const OLD = "20261120T010000Z";

function result(name: string, over: Partial<RenderResult> = {}): RenderResult {
  return {
    name,
    source: "matrix",
    variant: 3,
    handwritten: false,
    viewport: "desktop",
    theme: "light",
    failures: [],
    misstatements: [],
    canaryHits: 0,
    frameLoads: 1,
    frameText: null,
    evalRun: RUN,
    ...over,
  };
}

describe("render smoke results", () => {
  test("reads the files that match and skips the rest; a missing folder is empty", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "render-results-"));
    try {
      writeFileSync(path.join(dir, "a.json"), JSON.stringify({ ...result(`matrix/${RUN}/m/v3/b.json#0`), gathered: {}, extra: 1 }));
      writeFileSync(path.join(dir, "b.json"), "{not json");
      writeFileSync(path.join(dir, "c.json"), JSON.stringify({ name: "x" }));
      writeFileSync(path.join(dir, "d.png"), "png");
      expect(readRenderResults(dir).map((r) => r.name)).toEqual([`matrix/${RUN}/m/v3/b.json#0`]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect(readRenderResults(path.join(os.tmpdir(), "render-results-missing-folder"))).toEqual([]);
  });

  test("the judge's text index keeps desktop light frames with words, from its own matrix run only", () => {
    const index = renderedTextIndex(
      [
        result(`matrix/${RUN}/m/v3/a.json#0`, { frameText: "Fit 94" }),
        result(`matrix/${RUN}/m/v3/b.json#0`, { frameText: "Fit 92", viewport: "mobile" }),
        result(`matrix/${RUN}/m/v3/c.json#0`, { frameText: "  " }),
        result(`matrix/${RUN}/m/v3/d.json#0`),
        // Another run's words for a surface: stale, never read.
        result(`matrix/${OLD}/m/v3/a.json#0`, { frameText: "Fit 12", evalRun: OLD }),
        // A result whose folder and run id disagree, or that has no run id, is left out too.
        result(`matrix/${OLD}/m/v3/e.json#0`, { frameText: "Fit 13" }),
        result(`matrix/${RUN}/m/v3/f.json#0`, { frameText: "Fit 14", evalRun: undefined }),
      ],
      RUN,
    );
    expect([...index.entries()]).toEqual([[`matrix/${RUN}/m/v3/a.json#0`, "Fit 94"]]);
    expect(renderedTextIndex([result(`matrix/${RUN}/m/v3/a.json#0`, { frameText: "Fit 94" })], OLD).size).toBe(0);
  });

  test("forRuns keeps the hand-written surfaces and the named runs' recorded ones", () => {
    const rs = [
      result("v1/a.handwritten.json#0", { source: "v1", variant: 1, handwritten: true, evalRun: null }),
      result("fixture/v3-compare.json", { source: "fixture", handwritten: true, evalRun: null }),
      result(`matrix/${RUN}/m/v3/a.json#0`),
      result(`matrix/${OLD}/m/v3/a.json#0`, { evalRun: OLD }),
      result(`injection/${OLD}/m/v3/x.json#0`, { source: "injection", evalRun: OLD }),
    ];
    expect(forRuns(rs, { matrix: RUN, injection: OLD }).map((r) => r.name)).toEqual([
      "v1/a.handwritten.json#0",
      "fixture/v3-compare.json",
      `matrix/${RUN}/m/v3/a.json#0`,
      `injection/${OLD}/m/v3/x.json#0`,
    ]);
    expect(forRuns(rs, { matrix: null, injection: null }).map((r) => r.source)).toEqual(["v1", "fixture"]);
  });

  test("counts per source and variant, and variant 3 misstatements per model in one matrix run", () => {
    const rs = [
      result(`matrix/${RUN}/anthropic-claude-sonnet-5.5/v3/b.json#0`, { misstatements: ["fit 90 is 94"], failures: ["misstatement: fit"] }),
      result(`matrix/${RUN}/anthropic-claude-sonnet-5.5/v3/b.json#0`, { viewport: "mobile", misstatements: null }),
      result(`matrix/${RUN}/anthropic-claude-sonnet-5.5/v3/c.json#0`, { canaryHits: 1, frameLoads: 2 }),
      result(`matrix/${RUN}/anthropic-claude-sonnet-5.5/v2/b.json#0`, { variant: 2, misstatements: null, canaryHits: null, frameLoads: null }),
    ];
    expect(renderCounts(rs)).toEqual([
      { source: "matrix", variant: 2, surfaces: 1, failing: 0, misstatements: 0, canaryHits: 0, reloads: 0 },
      { source: "matrix", variant: 3, surfaces: 2, failing: 1, misstatements: 1, canaryHits: 1, reloads: 1 },
    ]);
    expect(v3MisstatementsByModel(rs, ["anthropic/claude-sonnet-5.5", "anthropic/claude-haiku-5.5"], RUN)).toEqual({ "anthropic/claude-sonnet-5.5": 1 });
    // Another run's misstatements do not count toward this one.
    const stale = [...rs, result(`matrix/${OLD}/anthropic-claude-sonnet-5.5/v3/b.json#0`, { misstatements: ["a", "b"], evalRun: OLD })];
    expect(v3MisstatementsByModel(stale, ["anthropic/claude-sonnet-5.5"], RUN)).toEqual({ "anthropic/claude-sonnet-5.5": 1 });
    expect(v3MisstatementsByModel(stale, ["anthropic/claude-sonnet-5.5"], OLD)).toEqual({ "anthropic/claude-sonnet-5.5": 2 });
  });
});
