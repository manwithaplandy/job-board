// The render smoke's results (Task 2.11, tests/sandbox/render-smoke.spec.ts), read back for
// the judge and the summary (Task 2.13). The spec writes one JSON file per surface,
// viewport and theme under test-results/render-smoke/results/: CI uploads the folder as
// the render-smoke artifact, and `npm run test:render-smoke` writes it locally.
//
// Matrix and injection results carry the eval run their surface came from (evalRun, and
// the run folder in the name): readers keep only the run they read (forRuns), so words
// rendered from another run never reach the judge or the summary.
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
  failures: z.array(z.string()),
  misstatements: z.array(z.string()).nullable(),
  canaryHits: z.number().nullable(),
  frameLoads: z.number().nullable(),
  frameText: z.string().nullable().optional(),
  evalRun: z.string().nullable().optional(),
});
export type RenderResult = z.infer<typeof ResultSchema>;

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
 */
export function forRuns(results: readonly RenderResult[], runs: { matrix: string | null; injection: string | null }): RenderResult[] {
  return results.filter((r) => {
    if (r.source === "v1" || r.source === "fixture") return true;
    const run = runs[r.source];
    return run !== null && r.evalRun === run && r.name.startsWith(`${r.source}/${run}/`);
  });
}

/**
 * The rendered words of each variant 3 surface of matrix run `matrixRun` (desktop, light,
 * where the spec reads them), by replay name.
 */
export function renderedTextIndex(results: readonly RenderResult[], matrixRun: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of forRuns(results, { matrix: matrixRun, injection: null })) {
    if (r.source !== "matrix") continue;
    if (r.viewport === "desktop" && r.theme === "light" && typeof r.frameText === "string" && r.frameText.trim()) out.set(r.name, r.frameText);
  }
  return out;
}

/** The render smoke in numbers, per replay source and variant. */
export interface RenderCounts {
  source: RenderResult["source"];
  variant: 1 | 2 | 3;
  /** Surfaces rendered (hand-written ones at two widths and two themes, recorded ones at desktop light). */
  surfaces: number;
  /** Surface, width and theme combinations with any failure. */
  failing: number;
  /** Misstated figures in variant 3 frames (findMisstatements), over every surface. */
  misstatements: number;
  canaryHits: number;
  /** Frames that loaded more than once. */
  reloads: number;
}

export function renderCounts(results: readonly RenderResult[]): RenderCounts[] {
  const out: RenderCounts[] = [];
  for (const source of ["v1", "fixture", "matrix", "injection"] as const) {
    for (const variant of [1, 2, 3] as const) {
      const rs = results.filter((r) => r.source === source && r.variant === variant);
      if (rs.length === 0) continue;
      out.push({
        source,
        variant,
        surfaces: new Set(rs.map((r) => r.name)).size,
        failing: rs.filter((r) => r.failures.length > 0).length,
        misstatements: rs.reduce((n, r) => n + (r.misstatements?.length ?? 0), 0),
        canaryHits: rs.reduce((n, r) => n + (r.canaryHits ?? 0), 0),
        reloads: rs.filter((r) => (r.frameLoads ?? 0) > 1).length,
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
    const rs = run.filter((r) => r.source === "matrix" && r.variant === 3 && r.misstatements !== null && r.name.startsWith(`matrix/${matrixRun}/${slug}/`));
    if (rs.length > 0) out[model] = rs.reduce((n, r) => n + (r.misstatements?.length ?? 0), 0);
  }
  return out;
}
