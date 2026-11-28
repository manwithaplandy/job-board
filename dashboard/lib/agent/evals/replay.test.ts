// The render smoke's closed list (plan Task 2.11): every committed golden surface and every
// hand-written variant 2 and 3 fixture is on it, each fixture renders through its own
// renderer (not a fallback) by the host's own parse rules, and a name that is not on the
// list resolves to nothing. Pure; runs in CI. The browsers are the render smoke's.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import nextConfig from "../../../next.config.mjs";
import { EVALS_DIR, buildReplayList, listReplaySurfaces, loadReplaySurface, replayRuns } from "@/lib/agent/evals/replay";
import { finishRun, runRoot, startRun } from "@/lib/agent/evals/evalRuns";
import { parseStoredSurface } from "@/lib/agent/surfaces/host";
import { checkV3Static } from "@/lib/agent/surfaces/v3/document";
import { validateSurfaceV2 } from "@/lib/agent/surfaces/v2/tree";
import { findMisstatements } from "@/lib/agent/evals/asserts";
import { parseGathered } from "@/lib/agent/gatheredSchema";

const entries = listReplaySurfaces();

describe("the replay list", () => {
  test("holds the 7 golden surfaces and the 5 hand-written fixtures: two variant 2, three variant 3 (one for the PR 5 kit)", () => {
    const golden = entries.filter((e) => e.source === "v1" && e.handwritten);
    expect(golden).toHaveLength(7);
    expect(golden.every((e) => e.variant === 1)).toBe(true);
    const fixtures = entries.filter((e) => e.source === "fixture");
    expect(fixtures.map((e) => [e.name, e.variant])).toEqual([
      ["fixture/v2-compare.json", 2],
      ["fixture/v2-weekly.json", 2],
      ["fixture/v3-compare.json", 3],
      ["fixture/v3-kit-controls.json", 3],
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
    expect(replayRuns({})).toEqual({ matrix: null, matrixSource: null, injection: null });
    expect(() => replayRuns({ EVAL_MATRIX_RUN: "20261126T010000Z" })).toThrow(/no run 20261126T010000Z/);
    expect(() => replayRuns({ EVAL_INJECTION_RUN: "latest" })).toThrow(/not a run id/);
    expect(entries.filter((e) => e.source === "v1" || e.source === "fixture").every((e) => e.evalRun === null)).toBe(true);
  });
});

describe("a rerender-only matrix run on the replay list (PR J7)", () => {
  test("lists the source run's variant 1 surfaces under the source's name, then its own variants 2 and 3", () => {
    const A = "20261126T010000Z";
    const B = "20261126T020000Z";
    const dir = mkdtempSync(path.join(os.tmpdir(), "replay-rr-"));
    try {
      const root = runRoot("matrix", path.join(dir, "recordings"));
      const base = JSON.parse(readFileSync(path.join(EVALS_DIR, "recordings", "v1", "b_compare.senior-backend.handwritten.json"), "utf8"));
      const put = (run: string, variant: 1 | 2 | 3) => {
        const file = path.join(root, run, "m", `v${variant}`, "b.json");
        mkdirSync(path.dirname(file), { recursive: true });
        const surfaces = base.surfaces.map((s: Record<string, unknown>) => ({ ...s, variant }));
        writeFileSync(file, JSON.stringify({ ...base, variant, evalRun: run, surfaces }));
      };
      finishRun(startRun(root, { runId: A, mode: "matrix", models: ["m"], matrixRun: null }), "complete");
      put(A, 1);
      put(A, 2);
      finishRun(startRun(root, { runId: B, mode: "matrix", models: ["m"], matrixRun: null, kind: "rerender-only", sourceRun: A }), "complete");
      put(B, 2);
      put(B, 3);
      const runs = replayRuns({}, dir);
      expect(runs).toEqual({ matrix: B, matrixSource: A, injection: null });
      const n = base.surfaces.length;
      const listed = buildReplayList(runs, dir).filter((e) => e.source === "matrix");
      expect(listed.map((e) => [e.name.replace(/#\d+$/, ""), e.variant, e.evalRun])).toEqual([
        ...Array.from({ length: n }, () => [`matrix/${A}/m/v1/b.json`, 1, A]),
        ...Array.from({ length: n }, () => [`matrix/${B}/m/v2/b.json`, 2, B]),
        ...Array.from({ length: n }, () => [`matrix/${B}/m/v3/b.json`, 3, B]),
      ]);
      // Named directly, the source run lists all of its own surfaces, as any full run.
      expect(replayRuns({ EVAL_MATRIX_RUN: A }, dir)).toEqual({ matrix: A, matrixSource: null, injection: null });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the replay page's server output (fix round 1, M4)", () => {
  test("file tracing leaves out every folder the replay list reads", () => {
    const excludes = (nextConfig as { outputFileTracingExcludes?: Record<string, string[]> }).outputFileTracingExcludes;
    expect(excludes?.["/ui-gallery/surface-replay"]).toEqual(["./lib/agent/evals/recordings/**", "./lib/agent/evals/fixtures/**"]);
  });
});
