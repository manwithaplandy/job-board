// Reading the render smoke's results back (plan Task 2.13): files that do not match are
// skipped, the judge gets each variant 3 frame's words from its own matrix run only, and
// the counts add up.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { forRuns, isExpandedResult, readRenderResults, renderCounts, renderedTextIndex, v3MisstatementsByModel, type RenderResult } from "@/lib/agent/evals/renderResults";

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

  test("PR J7: a rerender-only matrix run also keeps its source run's variant 1 results, and nothing else of that run", () => {
    const rs = [
      result(`matrix/${RUN}/m/v3/a.json#0`),
      result(`matrix/${OLD}/m/v1/a.json#0`, { variant: 1, evalRun: OLD }),
      result(`matrix/${OLD}/m/v3/a.json#0`, { evalRun: OLD }),
      result(`matrix/${OLD}/m/v2/a.json#0`, { variant: 1, evalRun: OLD }),
      result(`injection/${OLD}/m/v1/x.json#0`, { source: "injection", variant: 1, evalRun: OLD }),
    ];
    expect(forRuns(rs, { matrix: RUN, matrixSource: OLD, injection: null }).map((r) => r.name)).toEqual([`matrix/${RUN}/m/v3/a.json#0`, `matrix/${OLD}/m/v1/a.json#0`]);
    expect(forRuns(rs, { matrix: RUN, injection: null }).map((r) => r.name)).toEqual([`matrix/${RUN}/m/v3/a.json#0`]);
    // The source's variant 3 words never stand in for this run's.
    expect([...renderedTextIndex(rs.map((r) => ({ ...r, frameText: "x" })), RUN).keys()]).toEqual([`matrix/${RUN}/m/v3/a.json#0`]);
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

  // PR 3 review fix round 1: every surface also renders expanded. An expanded row must not
  // count a surface a second time, even one written with the measures filled in (an older
  // spec did that), and a finding seen in both modes is one combination.
  test("an expanded row does not count its surface twice", () => {
    const name = `matrix/${RUN}/anthropic-claude-sonnet-5.5/v3/b.json#0`;
    const inline = result(name, { mode: "inline", misstatements: ["fit 90 is 94"], failures: ["misstatement: fit"], canaryHits: 1, frameLoads: 2, frameText: "Fit 90" });
    const expanded = result(name, { viewport: "desktop-expanded", mode: "expanded", misstatements: ["fit 90 is 94"], failures: ["misstatement: fit"], canaryHits: 1, frameLoads: 2, frameText: "Fit 91" });
    // A file written before results had a mode is told apart by its viewport id.
    const legacyExpanded = result(name, { viewport: "mobile-expanded", theme: "dark", misstatements: ["x"], failures: ["axe: y"], canaryHits: 3 });
    const rs = [inline, expanded, legacyExpanded];
    expect(rs.map(isExpandedResult)).toEqual([false, true, true]);
    expect(renderCounts(rs)).toEqual([{ source: "matrix", variant: 3, surfaces: 1, failing: 2, misstatements: 1, canaryHits: 1, reloads: 1 }]);
    expect(renderCounts([inline])).toEqual([{ source: "matrix", variant: 3, surfaces: 1, failing: 1, misstatements: 1, canaryHits: 1, reloads: 1 }]);
    expect(v3MisstatementsByModel(rs, ["anthropic/claude-sonnet-5.5"], RUN)).toEqual({ "anthropic/claude-sonnet-5.5": 1 });
    expect([...renderedTextIndex(rs, RUN).entries()]).toEqual([[name, "Fit 90"]]);
  });

  test("the full matrix of eight rows per surface counts it once", () => {
    const name = `matrix/${RUN}/anthropic-claude-sonnet-5.5/v3/c.json#0`;
    const rows: RenderResult[] = [];
    for (const viewport of ["mobile", "desktop"]) {
      for (const theme of ["light", "dark"]) {
        for (const mode of ["inline", "expanded"] as const) {
          const once = viewport === "desktop" && theme === "light" && mode === "inline";
          rows.push(
            result(name, {
              viewport: mode === "expanded" ? `${viewport}-expanded` : viewport,
              theme,
              mode,
              misstatements: once ? ["pay 180k is 175k"] : null,
              canaryHits: once ? 0 : null,
              frameLoads: once ? 1 : null,
              frameText: once ? "Pay 180k" : null,
            }),
          );
        }
      }
    }
    expect(renderCounts(rows)).toEqual([{ source: "matrix", variant: 3, surfaces: 1, failing: 0, misstatements: 1, canaryHits: 0, reloads: 0 }]);
    expect(v3MisstatementsByModel(rows, ["anthropic/claude-sonnet-5.5"], RUN)).toEqual({ "anthropic/claude-sonnet-5.5": 1 });
    expect(renderedTextIndex(rows, RUN).size).toBe(1);
  });
});
