// Reading the render smoke's results back (plan Task 2.13): files that do not match are
// skipped, the judge gets each variant 3 frame's words, and the counts add up.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { readRenderResults, renderCounts, renderedTextIndex, v3MisstatementsByModel, type RenderResult } from "@/lib/agent/evals/renderResults";

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
    ...over,
  };
}

describe("render smoke results", () => {
  test("reads the files that match and skips the rest; a missing folder is empty", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "render-results-"));
    try {
      writeFileSync(path.join(dir, "a.json"), JSON.stringify({ ...result("matrix/m/v3/b.json#0"), gathered: {}, extra: 1 }));
      writeFileSync(path.join(dir, "b.json"), "{not json");
      writeFileSync(path.join(dir, "c.json"), JSON.stringify({ name: "x" }));
      writeFileSync(path.join(dir, "d.png"), "png");
      expect(readRenderResults(dir).map((r) => r.name)).toEqual(["matrix/m/v3/b.json#0"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect(readRenderResults(path.join(os.tmpdir(), "render-results-missing-folder"))).toEqual([]);
  });

  test("the judge's text index keeps desktop light frames with words", () => {
    const index = renderedTextIndex([
      result("a", { frameText: "Fit 94" }),
      result("b", { frameText: "Fit 92", viewport: "mobile" }),
      result("c", { frameText: "  " }),
      result("d"),
    ]);
    expect([...index.entries()]).toEqual([["a", "Fit 94"]]);
  });

  test("counts per source and variant, and variant 3 misstatements per model", () => {
    const rs = [
      result("matrix/anthropic-claude-sonnet-5.5/v3/b.json#0", { misstatements: ["fit 90 is 94"], failures: ["misstatement: fit"] }),
      result("matrix/anthropic-claude-sonnet-5.5/v3/b.json#0", { viewport: "mobile", misstatements: null }),
      result("matrix/anthropic-claude-sonnet-5.5/v3/c.json#0", { canaryHits: 1, frameLoads: 2 }),
      result("matrix/anthropic-claude-sonnet-5.5/v2/b.json#0", { variant: 2, misstatements: null, canaryHits: null, frameLoads: null }),
    ];
    expect(renderCounts(rs)).toEqual([
      { source: "matrix", variant: 2, surfaces: 1, failing: 0, misstatements: 0, canaryHits: 0, reloads: 0 },
      { source: "matrix", variant: 3, surfaces: 2, failing: 1, misstatements: 1, canaryHits: 1, reloads: 1 },
    ]);
    expect(v3MisstatementsByModel(rs, ["anthropic/claude-sonnet-5.5", "anthropic/claude-haiku-5.5"])).toEqual({ "anthropic/claude-sonnet-5.5": 1 });
  });
});
