// The variant matrix's orchestration (plan Task 2.10). Pure: the work of a cell is done
// by an injected runner (the live one is in harness.ts, used only by matrix.eval.ts), so
// the CI tests drive the same loop with a fake runner and no model.
//
// Per model, in plan order: each variant 1 cell plays the scenario live; its variant 2 and
// 3 cells re-render that run's surfaces from the same gathered data. A model's first
// `maxCells` cells run (the plan keeps a re-render after its live cell, so a prefix never
// orphans one). Any error, a cap above all, stops the whole matrix at once: nothing is
// caught here, and only finished cells reach `onRecording`.
import type { Recording } from "@/lib/agent/evals/recording";
import { measure, type VariantMeasures } from "@/lib/agent/evals/measures";
import { cellKey, matrixPlan, MATRIX_REPEATS, type MatrixCell } from "@/lib/agent/evals/matrixPlan";

export interface MatrixRunner {
  /** Before a model's first cell (the live runner opens that model's RunBudget here). */
  startModel?(model: string): void | Promise<void>;
  /** After a model's last cell, also when a cell threw. */
  endModel?(model: string): void | Promise<void>;
  /** Plays a variant 1 cell live. */
  live(cell: MatrixCell): Promise<Recording>;
  /** Re-renders `from`'s surfaces into the cell's variant. */
  rerender(cell: MatrixCell, from: Recording): Promise<Recording>;
}

export interface MatrixUsage {
  costMicros: number;
  inputTokens: number;
  outputTokens: number;
}

export interface MatrixModelResult {
  model: string;
  cells: number;
  measures: VariantMeasures[];
  usage: MatrixUsage;
}

export interface MatrixResult {
  recordings: Recording[];
  models: MatrixModelResult[];
}

export interface RunMatrixArgs {
  models: readonly string[];
  runner: MatrixRunner;
  /** At most this many cells per model (--max-cells). */
  maxCells?: number;
  repeats?: number;
  /** Each finished cell, as soon as it finishes (the live run writes its file here). */
  onRecording?: (cell: MatrixCell, r: Recording) => void | Promise<void>;
}

/** Sums a set of recordings' usage. */
export function usageOf(rs: readonly Recording[]): MatrixUsage {
  return rs.reduce(
    (s, r) => ({
      costMicros: s.costMicros + r.usage.costMicros,
      inputTokens: s.inputTokens + r.usage.inputTokens,
      outputTokens: s.outputTokens + r.usage.outputTokens,
    }),
    { costMicros: 0, inputTokens: 0, outputTokens: 0 },
  );
}

/** Runs the matrix for each model in turn and returns every recording with its measures and cost per model. */
export async function runMatrix(a: RunMatrixArgs): Promise<MatrixResult> {
  const recordings: Recording[] = [];
  const models: MatrixModelResult[] = [];
  for (const model of a.models) {
    const cells = matrixPlan([model], a.repeats ?? MATRIX_REPEATS).slice(0, a.maxCells ?? Number.MAX_SAFE_INTEGER);
    const live = new Map<string, Recording>();
    const mine: Recording[] = [];
    await a.runner.startModel?.(model);
    try {
      for (const cell of cells) {
        let r: Recording;
        if (cell.kind === "live") {
          r = await a.runner.live(cell);
          live.set(cellKey(cell), r);
        } else {
          const from = cell.from === null ? undefined : live.get(cell.from);
          if (!from) throw new Error(`eval: matrix cell ${cellKey(cell)} has no variant 1 run to re-render`);
          r = await a.runner.rerender(cell, from);
        }
        mine.push(r);
        recordings.push(r);
        await a.onRecording?.(cell, r);
      }
    } finally {
      await a.runner.endModel?.(model);
    }
    models.push({ model, cells: mine.length, measures: measure(mine), usage: usageOf(mine) });
  }
  return { recordings, models };
}

/** Where a matrix recording is written, under recordings/matrix/: <model>/v<variant>/<scenario>.<persona>.r<repeat>.json. */
export function matrixRecordingPath(r: Pick<Recording, "model" | "variant" | "scenario" | "persona" | "seed">): string {
  const model = r.model.replace(/[^A-Za-z0-9.-]+/g, "-");
  return `${model}/v${r.variant}/${r.scenario}.${r.persona}.r${r.seed}.json`;
}

export const MATRIX_DATASET = "agent-freedom-matrix";

/**
 * A matrix cell as a Langfuse dataset item (lib/langfuseDataset.ts upsertDatasetRecord):
 * input the cell, output the surfaces' structure and outcomes, metadata the tags. Holds no
 * gathered data, payload text or database rows: the persona data is synthetic, but the
 * dataset only needs what the measures read.
 */
export function matrixDatasetItem(r: Recording, signature: string) {
  return {
    id: `${r.model}|${r.scenario}|${r.persona}|r${r.seed}|v${r.variant}`,
    datasetName: MATRIX_DATASET,
    input: { scenario: r.scenario, persona: r.persona, variant: r.variant, model: r.model, repeat: r.seed },
    expectedOutput: {
      signature,
      outcomes: r.surfaces.map((s) => s.outcome),
      usage: r.usage,
      timings: r.timings,
    },
    metadata: {
      tags: [`variant-${r.variant}`, `scenario-${r.scenario}`, `persona-${r.persona}`, `model-${r.model}`],
      source: r.source,
    },
  };
}

const pct = (v: number | null) => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);
const ms = (v: number | null) => (v === null ? "n/a" : `${(v / 1000).toFixed(1)}s`);
const dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;

/** The matrix's report: per model, the measures per variant and the cost. */
export function matrixTable(result: MatrixResult): string {
  const lines: string[] = [];
  for (const m of result.models) {
    lines.push(
      `${m.model}: ${m.cells} cells, ${dollars(m.usage.costMicros)}, ${m.usage.inputTokens} in / ${m.usage.outputTokens} out tokens`,
      "",
      "| Variant | Runs | Surfaces | Validation failures | Repaired | Fallback | First render p50/p90 | Complete p50/p90 | Mean out tokens | Assert failures | Misstatements | Structural variance | Cost |",
      "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    );
    for (const v of m.measures) {
      lines.push(
        `| ${v.variant} | ${v.runs} | ${v.surfaces} | ${pct(v.validationFailureRate)} | ${pct(v.repairRate)} | ${pct(v.fallbackRate)} | ` +
          `${ms(v.firstRenderMs.median)}/${ms(v.firstRenderMs.p90)} | ${ms(v.completeMs.median)}/${ms(v.completeMs.p90)} | ` +
          `${v.meanOutputTokens === null ? "n/a" : Math.round(v.meanOutputTokens)} | ${v.assertFailures} (${v.runsFailingAsserts} runs) | ` +
          `${v.misstatements ?? "render smoke"} | ${v.structuralVariance === null ? "n/a" : v.structuralVariance.toFixed(2)} | ${dollars(v.costMicros)} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
