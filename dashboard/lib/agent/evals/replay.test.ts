// The render smoke's closed list (plan Task 2.11): every committed golden surface and every
// hand-written variant 2 and 3 fixture is on it, each fixture renders through its own
// renderer (not a fallback) by the host's own parse rules, and a name that is not on the
// list resolves to nothing. Pure; runs in CI. The browsers are the render smoke's.
import { describe, expect, test } from "vitest";
import { listReplaySurfaces, loadReplaySurface, replayRuns } from "@/lib/agent/evals/replay";
import { parseStoredSurface } from "@/lib/agent/surfaces/host";
import { checkV3Static } from "@/lib/agent/surfaces/v3/document";
import { validateSurfaceV2 } from "@/lib/agent/surfaces/v2/tree";
import { findMisstatements } from "@/lib/agent/evals/asserts";
import { parseGathered } from "@/lib/agent/gatheredSchema";

const entries = listReplaySurfaces();

describe("the replay list", () => {
  test("holds the 7 golden surfaces and the 4 hand-written fixtures, two per variant", () => {
    const golden = entries.filter((e) => e.source === "v1" && e.handwritten);
    expect(golden).toHaveLength(7);
    expect(golden.every((e) => e.variant === 1)).toBe(true);
    const fixtures = entries.filter((e) => e.source === "fixture");
    expect(fixtures.map((e) => [e.name, e.variant])).toEqual([
      ["fixture/v2-compare.json", 2],
      ["fixture/v2-weekly.json", 2],
      ["fixture/v3-compare.json", 3],
      ["fixture/v3-weekly.json", 3],
    ]);
    expect(new Set(entries.map((e) => e.name)).size).toBe(entries.length);
  });

  test("each hand-written surface renders with its own renderer, not degraded", () => {
    const want = { 1: "blocks", 2: "tree", 3: "sandbox" } as const;
    for (const e of entries.filter((x) => x.handwritten)) {
      const parsed = parseStoredSurface(e.surface, { variant3Enabled: true });
      const why = e.variant === 2 ? validateSurfaceV2(e.surface.payload, parseGathered(e.surface.gathered)!) : null;
      expect(parsed.degraded, `${e.name}: ${JSON.stringify(why)}`).toBe(false);
      expect(parsed.view.kind, e.name).toBe(want[e.variant]);
      if (e.variant === 3) expect(checkV3Static(String(e.surface.payload.html)), e.name).toEqual([]);
    }
  });

  test("the variant 3 compare fixture's figures are the stored ones (the text it would render)", () => {
    const e = entries.find((x) => x.name === "fixture/v3-compare.json")!;
    const gathered = parseGathered(e.surface.gathered)!;
    const text = Object.values(gathered.jobs)
      .map((j) => {
        const r = gathered.reviews[j.jobId];
        return `${j.title}\n${j.company}\nFit ${r?.fitScore}\n$${Math.round((r?.payMin ?? 0) / 1000)}k to $${Math.round((r?.payMax ?? 0) / 1000)}k`;
      })
      .join("\n");
    expect(findMisstatements(text, gathered)).toEqual([]);
  });

  test("only a name on the list resolves", () => {
    expect(loadReplaySurface("fixture/v3-compare.json")?.variant).toBe(3);
    expect(loadReplaySurface(entries[0].name)?.name).toBe(entries[0].name);
    for (const bad of [
      "",
      "fixture/../recordings/v1/b_compare.senior-backend.handwritten.json",
      "fixture/missing.json",
      "v1/b_compare.senior-backend.handwritten.json#9",
      "/etc/passwd",
      "fixture/v3-compare.json?x=1",
      null,
      ["fixture/v3-compare.json"],
    ]) {
      expect(loadReplaySurface(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("which runs the replay lists (fix round 1, I3)", () => {
  test("with no run committed and none named it lists none; a named run that is missing or malformed is refused", () => {
    expect(replayRuns({})).toEqual({ matrix: null, injection: null });
    expect(() => replayRuns({ EVAL_MATRIX_RUN: "20261126T010000Z" })).toThrow(/no run 20261126T010000Z/);
    expect(() => replayRuns({ EVAL_INJECTION_RUN: "latest" })).toThrow(/not a run id/);
    expect(entries.filter((e) => e.source === "v1" || e.source === "fixture").every((e) => e.evalRun === null)).toBe(true);
  });
});
