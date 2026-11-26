// The variant matrix's loop (plan Task 2.10) with a fake runner: no model, no database.
// The live runner (harness.ts) does the same work with rerenderSurface; this pins the
// order, the reuse of variant 1's data, the per-model results and the stop at a cap.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { AGENT_EVAL_MODELS } from "@/lib/agent/config";
import { CapExceededError } from "@/lib/agent/evals/budget";
import { matrixDatasetItem, matrixRecordingPath, matrixTable, runMatrix, sourcesByCell, type MatrixRunner } from "@/lib/agent/evals/matrix";
import { cellKey, type MatrixCell } from "@/lib/agent/evals/matrixPlan";
import { parseRecording, type Recording } from "@/lib/agent/evals/recording";

const V1_DIR = fileURLToPath(new URL("./recordings/v1/", import.meta.url));
const BASE: Record<string, Recording> = {};
for (const f of readdirSync(V1_DIR).filter((x) => x.endsWith(".json"))) {
  const r = parseRecording(JSON.parse(readFileSync(path.join(V1_DIR, f), "utf8")));
  if (r) BASE[r.scenario] = r;
}

/** A fake runner: variant 1 copies the committed recording; a re-render copies its source's gathered data. */
function fakeRunner(log: string[], opts: { failAt?: number } = {}): MatrixRunner & { rerenderedFrom: Map<string, Recording> } {
  let calls = 0;
  const rerenderedFrom = new Map<string, Recording>();
  const tick = () => {
    calls += 1;
    if (opts.failAt !== undefined && calls === opts.failAt) throw new CapExceededError("max_usd", "test cap");
  };
  return {
    rerenderedFrom,
    startModel: (m) => void log.push(`start ${m}`),
    endModel: (m) => void log.push(`end ${m}`),
    live: async (cell: MatrixCell) => {
      tick();
      log.push(cellKey(cell));
      return {
        ...structuredClone(BASE[cell.scenario]),
        source: "live",
        model: cell.model,
        persona: cell.persona,
        seed: cell.repeat,
        usage: { costMicros: 1000, inputTokens: 100, outputTokens: 10 },
      };
    },
    rerender: async (cell: MatrixCell, from: Recording) => {
      tick();
      log.push(cellKey(cell));
      rerenderedFrom.set(cellKey(cell), from);
      return {
        ...structuredClone(from),
        source: "rerender",
        variant: cell.variant,
        surfaces: from.surfaces.map((s) => ({ ...structuredClone(s), variant: cell.variant, outcome: "fallback" as const })),
        usage: { costMicros: 500, inputTokens: 50, outputTokens: 20 },
      };
    },
  };
}

describe("runMatrix", () => {
  test("the matrix plan has 180 cells and variants 2 and 3 reuse variant 1's gathered data", async () => {
    const log: string[] = [];
    const runner = fakeRunner(log);
    const result = await runMatrix({ models: ["m/one"], runner });
    expect(result.recordings).toHaveLength(180);
    expect(log[0]).toBe("start m/one");
    expect(log.at(-1)).toBe("end m/one");
    for (const r of result.recordings.filter((x) => x.variant !== 1)) {
      const key = cellKey({ model: r.model, scenario: r.scenario, persona: r.persona, repeat: r.seed, variant: r.variant });
      const from = runner.rerenderedFrom.get(key)!;
      expect(from.variant).toBe(1);
      expect(from.seed).toBe(r.seed);
      expect(r.surfaces.map((s) => s.gathered)).toEqual(from.surfaces.map((s) => s.gathered));
    }
  });

  test("the matrix runs once per model in AGENT_EVAL_MODELS and reports measures and cost per model", async () => {
    const log: string[] = [];
    const result = await runMatrix({ models: AGENT_EVAL_MODELS, runner: fakeRunner(log) });
    expect(result.models.map((m) => m.model)).toEqual([...AGENT_EVAL_MODELS]);
    expect(log.filter((l) => l.startsWith("start "))).toEqual(AGENT_EVAL_MODELS.map((m) => `start ${m}`));
    for (const m of result.models) {
      expect(m.cells).toBe(180);
      expect(m.measures.map((v) => v.variant)).toEqual([1, 2, 3]);
      expect(m.measures.map((v) => v.runs)).toEqual([60, 60, 60]);
      expect(m.measures[1].fallbackRate).toBe(1);
      expect(m.usage).toEqual({ costMicros: 60 * 1000 + 120 * 500, inputTokens: 60 * 100 + 120 * 50, outputTokens: 60 * 10 + 120 * 20 });
    }
    const table = matrixTable(result);
    for (const model of AGENT_EVAL_MODELS) expect(table).toContain(`${model}: 180 cells, $0.12`);
    expect(table).toContain("| Variant | Runs | Surfaces |");
  });

  test("--max-cells runs a prefix of each model's plan, never a re-render without its run", async () => {
    const log: string[] = [];
    const result = await runMatrix({ models: ["m/one", "m/two"], runner: fakeRunner(log), maxCells: 4 });
    expect(result.models.map((m) => m.cells)).toEqual([4, 4]);
    expect(result.recordings.map((r) => r.variant)).toEqual([1, 2, 3, 1, 1, 2, 3, 1]);
  });

  test("a cap stops the whole matrix: no later cell or model runs and the failed cell is not recorded", async () => {
    const log: string[] = [];
    const seen: string[] = [];
    await expect(
      runMatrix({ models: ["m/one", "m/two"], runner: fakeRunner(log, { failAt: 5 }), onRecording: (c) => void seen.push(cellKey(c)) }),
    ).rejects.toBeInstanceOf(CapExceededError);
    expect(seen).toHaveLength(4);
    expect(log).toContain("end m/one");
    expect(log).not.toContain("start m/two");
  });
});

describe("runMatrix over an earlier run's variant 1 (PR J7, rerender-only)", () => {
  const v1 = (scenario: string, seed: number, model = "m/one"): Recording => ({ ...structuredClone(BASE[scenario]), model, persona: "senior-backend", seed, variant: 1 });

  test("no cell plays live: only the re-render cells whose variant 1 recording is given run, from that recording", async () => {
    const log: string[] = [];
    const runner = fakeRunner(log);
    const sources = sourcesByCell([v1("b_compare", 1), v1("d_weekly", 3)]);
    const recorded: string[] = [];
    const result = await runMatrix({ models: ["m/one"], runner, sources, onRecording: (cell) => void recorded.push(cellKey(cell)) });
    expect(result.recordings.map((r) => [r.scenario, r.seed, r.variant])).toEqual([
      ["b_compare", 1, 2],
      ["b_compare", 1, 3],
      ["d_weekly", 3, 2],
      ["d_weekly", 3, 3],
    ]);
    expect(log.filter((l) => l.endsWith("|v1"))).toEqual([]);
    expect(recorded).toHaveLength(4);
    expect(runner.rerenderedFrom.get(cellKey({ model: "m/one", scenario: "b_compare", persona: "senior-backend", repeat: 1, variant: 3 }))).toBe(
      sources.get(cellKey({ model: "m/one", scenario: "b_compare", persona: "senior-backend", repeat: 1, variant: 1 })),
    );
    expect(result.models[0].measures.map((m) => m.variant)).toEqual([2, 3]);
  });

  test("--max-cells counts re-render cells; a model with no recording runs nothing", async () => {
    const log: string[] = [];
    const sources = sourcesByCell([v1("b_compare", 1), v1("b_compare", 2)]);
    const result = await runMatrix({ models: ["m/one", "m/two"], runner: fakeRunner(log), sources, maxCells: 3 });
    expect(result.recordings.map((r) => [r.model, r.seed, r.variant])).toEqual([
      ["m/one", 1, 2],
      ["m/one", 1, 3],
      ["m/one", 2, 2],
    ]);
    expect(result.models.map((m) => [m.model, m.cells])).toEqual([
      ["m/one", 3],
      ["m/two", 0],
    ]);
  });

  test("sourcesByCell keys variant 1 recordings only, and refuses two for one cell", () => {
    const sources = sourcesByCell([v1("b_compare", 1), { ...v1("b_compare", 1), variant: 2 }]);
    expect([...sources.keys()]).toEqual([cellKey({ model: "m/one", scenario: "b_compare", persona: "senior-backend", repeat: 1, variant: 1 })]);
    expect(() => sourcesByCell([v1("b_compare", 1), v1("b_compare", 1)])).toThrow(/two variant 1 recordings/);
  });
});

describe("matrix outputs", () => {
  test("a recording's path names its model, variant and repeat", () => {
    expect(
      matrixRecordingPath({ model: "anthropic/claude-sonnet-5.5", variant: 2, scenario: "b_compare", persona: "new-grad", seed: 3 }),
    ).toBe("anthropic-claude-sonnet-5.5/v2/b_compare.new-grad.r3.json");
  });

  test("the dataset item carries the tags and no gathered data or payload text", () => {
    const r = BASE.b_compare;
    const item = matrixDatasetItem(r, "JobComparison | MemoDiff Callout");
    expect(item.datasetName).toBe("agent-freedom-matrix");
    expect(item.metadata.tags).toEqual([`variant-1`, `scenario-b_compare`, `persona-${r.persona}`, `model-${r.model}`]);
    const text = JSON.stringify(item);
    expect(text).not.toContain("gathered");
    expect(text).not.toContain("greenhouse:");
  });
});
