// The render smoke's results (Task 2.11, tests/sandbox/render-smoke.spec.ts), read back for
// the judge and the summary (Task 2.13). The spec writes one JSON file per surface,
// viewport and theme under test-results/render-smoke/results/: CI uploads the folder as
// the render-smoke artifact, and `npm run test:render-smoke` writes it locally.
//
// Matrix and injection results carry the eval run their surface came from (evalRun, and
// the run folder in the name): readers keep only the run they read (forRuns), so words
// rendered from another run never reach the judge or the summary.
//
// PR 3: every surface renders inline and expanded (spec 08 S15.2 layer 4). An expanded
// result has mode "expanded" and its viewport id ends "-expanded", so its file name is its
// own. The per-surface measures (misstatements, canary hits, loads, the frame's words) are
// counted from inline results only, and a finding counts once per surface, width and theme
// whichever mode it showed in, so no surface is counted twice.
//
// Reads files only; a file that does not match is skipped. No database, no model.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

export const RENDER_RESULTS_DIR = path.join(process.cwd(), "test-results", "render-smoke", "results");

const ResultSchema = z.object({
  name: z.string(),
  source: z.enum(["v1", "matrix", "injection", "fixture"]),
  variant: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  handwritten: z.boolean(),
  viewport: z.string(),
  theme: z.string(),
  /** Inline or expanded (PR 3); results written before PR 3 have none and are inline. */
  mode: z.enum(["inline", "expanded"]).optional(),
  failures: z.array(z.string()),
  misstatements: z.array(z.string()).nullable(),
  canaryHits: z.number().nullable(),
  frameLoads: z.number().nullable(),
  /**
   * Asks the frame made without a real click (PR 6, inline-UI spec S15.2). Optional: the
   * render smoke does not count them yet, and a result without it leaves an ask case
   * awaiting its replay.
   */
  asksWithoutClick: z.number().optional(),
  frameText: z.string().nullable().optional(),
  evalRun: z.string().nullable().optional(),
});
export type RenderResult = z.infer<typeof ResultSchema>;

/** An expanded-mode result (PR 3): by its mode, or by its viewport id where a file has no mode. */
export function isExpandedResult(r: Pick<RenderResult, "mode" | "viewport">): boolean {
  return r.mode === "expanded" || r.viewport.endsWith("-expanded");
}

/** The viewport a result was rendered at, without its mode ("desktop-expanded" is "desktop"). */
function baseViewport(r: Pick<RenderResult, "viewport">): string {
  return r.viewport.replace(/-expanded$/, "");
}

/** How many distinct surface, width and theme combinations among `rs` match `pred`, in either mode. */
function combinations(rs: readonly RenderResult[], pred: (r: RenderResult) => boolean): number {
  return new Set(rs.filter(pred).map((r) => JSON.stringify([r.name, baseViewport(r), r.theme]))).size;
}

/** Every result file in `dir` that parses; [] when the folder is missing. */
export function readRenderResults(dir: string = RENDER_RESULTS_DIR): RenderResult[] {
  if (!existsSync(dir)) return [];
  const out: RenderResult[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".json")) continue;
    try {
      const parsed = ResultSchema.safeParse(JSON.parse(readFileSync(path.join(dir, file), "utf8")));
      if (parsed.success) out.push(parsed.data);
    } catch {
      // Not JSON: skipped, like any file that does not match.
    }
  }
  return out;
}

/**
 * The results of the hand-written surfaces (v1, fixture) and of the given matrix and
 * injection runs only; a recorded result from any other run, or with no run, is left out.
 * A rerender-only matrix run (PR J7) also keeps its source run's variant 1 results
 * (`matrixSource`), the surfaces its own variants 2 and 3 were re-rendered from.
 */
export function forRuns(
  results: readonly RenderResult[],
  runs: { matrix: string | null; injection: string | null; matrixSource?: string | null },
): RenderResult[] {
  const source = runs.matrixSource ?? null;
  return results.filter((r) => {
    if (r.source === "v1" || r.source === "fixture") return true;
    const run = runs[r.source];
    if (run !== null && r.evalRun === run && r.name.startsWith(`${r.source}/${run}/`)) return true;
    return r.source === "matrix" && source !== null && r.variant === 1 && r.evalRun === source && /^matrix\/[^/]+\/[^/]+\/v1\//.test(r.name) && r.name.startsWith(`matrix/${source}/`);
  });
}

/**
 * The rendered words of each variant 3 surface of matrix run `matrixRun` (desktop, light,
 * where the spec reads them), by replay name.
 */
export function renderedTextIndex(results: readonly RenderResult[], matrixRun: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of forRuns(results, { matrix: matrixRun, injection: null })) {
    if (r.source !== "matrix" || isExpandedResult(r)) continue;
    if (r.viewport === "desktop" && r.theme === "light" && typeof r.frameText === "string" && r.frameText.trim()) out.set(r.name, r.frameText);
  }
  return out;
}

/** The render smoke in numbers, per replay source and variant. */
export interface RenderCounts {
  source: RenderResult["source"];
  variant: 1 | 2 | 3;
  /** Surfaces rendered (each at two widths, two themes, inline and expanded). */
  surfaces: number;
  /** Surface, width and theme combinations with any failure, inline or expanded (counted once). */
  failing: number;
  /** Misstated figures in variant 3 frames (findMisstatements), over every surface, from inline results. */
  misstatements: number;
  /** Canary hits, from inline results (an expanded run's are asserted by the spec, not counted). */
  canaryHits: number;
  /** Surface, width and theme combinations whose frame loaded more than once, in either mode. */
  reloads: number;
}

export function renderCounts(results: readonly RenderResult[]): RenderCounts[] {
  const out: RenderCounts[] = [];
  for (const source of ["v1", "fixture", "matrix", "injection"] as const) {
    for (const variant of [1, 2, 3] as const) {
      const rs = results.filter((r) => r.source === source && r.variant === variant);
      if (rs.length === 0) continue;
      const inline = rs.filter((r) => !isExpandedResult(r));
      out.push({
        source,
        variant,
        surfaces: new Set(rs.map((r) => r.name)).size,
        failing: combinations(rs, (r) => r.failures.length > 0),
        misstatements: inline.reduce((n, r) => n + (r.misstatements?.length ?? 0), 0),
        canaryHits: inline.reduce((n, r) => n + (r.canaryHits ?? 0), 0),
        reloads: combinations(rs, (r) => (r.frameLoads ?? 0) > 1),
      });
    }
  }
  return out;
}

/**
 * Variant 3 misstatements per model from matrix run `matrixRun`'s surfaces: the input
 * measure() takes for variant 3. A model with no rendered matrix surface is left out (its
 * count stays "not run yet"). Matrix files sit under the run and the model's slug
 * (matrixRecordingPath).
 */
export function v3MisstatementsByModel(results: readonly RenderResult[], models: readonly string[], matrixRun: string): Record<string, number> {
  const out: Record<string, number> = {};
  const run = forRuns(results, { matrix: matrixRun, injection: null });
  for (const model of models) {
    const slug = model.replace(/[^A-Za-z0-9.-]+/g, "-");
    const rs = run.filter(
      (r) => r.source === "matrix" && r.variant === 3 && !isExpandedResult(r) && r.misstatements !== null && r.name.startsWith(`matrix/${matrixRun}/${slug}/`),
    );
    if (rs.length > 0) out[model] = rs.reduce((n, r) => n + (r.misstatements?.length ?? 0), 0);
  }
  return out;
}
