// The variant matrix (plan Task 2.10): per model, 4 scenarios by 3 personas by 5 repeats
// played live in variant 1, each run's surfaces re-rendered into variants 2 and 3 from the
// same gathered data (180 cells a model). NEVER part of `npm test` or the db lane: only
// `npm run eval:agent -- --matrix` (scripts/eval-agent.mjs) runs it, inside
// tools/lifecycle_test_db.py's throwaway Postgres with the OpenRouter key forwarded
// (gate A17). It spends money: about 15 golden runs per model.
//
// PR J7: Haiku 5.5 unless EVAL_MODELS names others, and another model only with
// EVAL_ALLOW_NON_HAIKU=1 (eval-agent.mjs --allow-non-haiku). EVAL_MATRIX_KIND=spot-check
// (eval-agent.mjs --matrix --spot-check) plays one persona (EVAL_PERSONA) and one repeat
// under the spot-check caps; run.json records the kind and, for a stage of --pass, the
// pass id (EVAL_PASS_ID), and the whole command's reported cost when the run ends.
// EVAL_MATRIX_KIND=rerender-only (eval-agent.mjs --matrix --rerender-only --run <id>)
// plays nothing live: it reads the variant 1 recordings of the complete full matrix run
// EVAL_SOURCE_RUN, writes their surfaces into this throwaway database and re-renders them
// into variants 2 and 3, on the source run's models, under the matrix caps; run.json names
// the source run, and readers pair this run's variants 2 and 3 with the source's variant 1.
//
// Spend caps (budget.ts, matrix profile): one RunBudget per model with the matrix caps,
// each reporting to one whole-command budget with the total caps. The first cap to trip,
// a model's or the total, stops the whole command: the cell in progress writes nothing,
// no later cell or model runs, and the report says cap_exceeded with the usage so far.
//
// The run gets its own folder, recordings/matrix/<run id>/ (evalRuns.ts; the id comes from
// eval-agent.mjs as EVAL_RUN_ID), with run.json saying how it ended. Every finished cell
// is written there under <model>/v<variant>/, carrying the run id (assert failures are
// data here, counted by the measures) and, when Langfuse keys are set, to the dataset
// agent-freedom-matrix. The throwaway database forwards only the OpenRouter key, so in
// that run the dataset write is a no-op.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { openTestDb, type TestDb } from "@/lib/testing/dbHarness";
import { endServicePool } from "@/lib/db";
import { upsertDatasetRecord } from "@/lib/langfuseDataset";
import { liveMatrixRunner, prepareHarness } from "@/lib/agent/evals/harness";
import { matrixDatasetItem, matrixRecordingPath, matrixTable, runMatrix, sourcesByCell, usageOf, type MatrixResult } from "@/lib/agent/evals/matrix";
import { readRerenderSources } from "@/lib/agent/evals/evalFiles";
import { measure, recordingSignature } from "@/lib/agent/evals/measures";
import type { Recording } from "@/lib/agent/evals/recording";
import { AGENT_EVAL_DEFAULT_MODEL } from "@/lib/agent/config";
import { assertEvalMode, capsFromEnv, totalBudget, totalCapsFromEnv, type RunBudget } from "@/lib/agent/evals/budget";
import { assertDefaultModelOrAllowed, assertPricedModels, isMatrixPersona, MATRIX_PERSONAS, MATRIX_REPEATS, SPOT_CHECK_PERSONA } from "@/lib/agent/evals/matrixPlan";
import { assertRerenderSource, costIsFloor, finishRun, newRunId, passBudgetFromEnv, passIdFromEnv, runRoot, selectRun, startRun } from "@/lib/agent/evals/evalRuns";

vi.mock("next/server", async (importOriginal) => {
  const real = await importOriginal<typeof import("next/server")>();
  return {
    ...real,
    after: (task: Promise<unknown> | (() => unknown)) => {
      void (typeof task === "function" ? Promise.resolve().then(task) : task).catch(() => {});
    },
  };
});
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/subscriptions", () => ({ getViewerPlan: vi.fn(async () => "standard") }));

// Only eval-agent.mjs starts this file (it sets EVAL_MODE): refuse anything else first.
assertEvalMode(process.env, "matrix");

const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
// PR J7: full (the plan), spot-check (one persona, one repeat, its own caps) or
// rerender-only (variants 2 and 3 from an earlier full run's variant 1 recordings). The spot
// check is the explicit way to run Sonnet; any other non-Haiku run needs --allow-non-haiku.
const kind = process.env.EVAL_MATRIX_KIND || "full";
if (kind !== "full" && kind !== "spot-check" && kind !== "rerender-only") {
  throw new Error(`eval: EVAL_MATRIX_KIND must be full, spot-check or rerender-only, not ${JSON.stringify(kind)}`);
}
// A rerender-only run's source: a complete full matrix run, named by eval-agent.mjs --run.
if (kind === "rerender-only" && !process.env.EVAL_SOURCE_RUN) throw new Error("eval: a rerender-only matrix run needs EVAL_SOURCE_RUN (eval-agent.mjs --run)");
const sourceRun = kind === "rerender-only" ? assertRerenderSource(selectRun(runRoot("matrix"), process.env.EVAL_SOURCE_RUN)) : null;
const models = (process.env.EVAL_MODELS ?? "")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m.length > 0);
// A rerender-only run re-renders with the source run's own models.
const runModels = sourceRun ? [...sourceRun.models] : models.length > 0 ? models : [AGENT_EVAL_DEFAULT_MODEL];
if (runModels.length === 0) throw new Error("eval: the matrix has no model to run");
if (!runModels.every((m) => MODEL_RE.test(m))) throw new Error("eval: EVAL_MODELS holds something that is not a model id");
// Re-checked here as eval-agent.mjs does: only models with a row in the price table run.
assertPricedModels(runModels);
assertDefaultModelOrAllowed(runModels, kind === "spot-check" || process.env.EVAL_ALLOW_NON_HAIKU === "1");
const persona = process.env.EVAL_PERSONA || SPOT_CHECK_PERSONA;
if (!isMatrixPersona(persona)) throw new Error(`eval: EVAL_PERSONA ${JSON.stringify(persona)} is not one of the matrix personas`);
const personas = kind === "spot-check" ? [persona] : [...MATRIX_PERSONAS];
const repeats = kind === "spot-check" ? 1 : MATRIX_REPEATS;
const passId = passIdFromEnv(process.env);
// Fix round 1: the pass's whole budget, recorded in run.json for the summary.
const passBudgetUsd = passBudgetFromEnv(process.env);
const evalRun = process.env.EVAL_RUN_ID || newRunId();
let runDir: string | null = null;
let ranToEnd = false;

vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", process.env.AGENT_TOOL_APPROVAL_SECRET || "e".repeat(40));

// A cap above its ceiling throws CapUsageError here, before any database or model work.
const profile = kind === "spot-check" ? "spot-check" : "matrix";
const caps = capsFromEnv(process.env, profile);
const totals = totalCapsFromEnv(process.env, profile);
if (!totals) throw new Error("eval: the matrix needs its whole-command caps");
const total = totalBudget(totals);
const budgets = new Map<string, RunBudget>();
const recordings: Recording[] = [];
let result: MatrixResult | null = null;
let db: TestDb;

function tripped(): { cap: string } | null {
  if (total.tripped) return total.tripped;
  for (const b of budgets.values()) if (b.tripped) return b.tripped;
  return null;
}

function writeRunReport(text: string): void {
  const file = process.env.EVAL_RUN_REPORT;
  if (!file) {
    console.log(text);
    return;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  const t = tripped();
  const usd = [...budgets.values()].map((b) => b.usdEnforcement);
  writeFileSync(
    file,
    `${JSON.stringify({
      status: t ? "cap_exceeded" : "complete",
      cap: t?.cap ?? null,
      usd: usd.includes("not_enforced") ? "not_enforced" : usd.includes("enforced") ? "enforced" : "pending",
      // The whole command's reported spend: eval-agent.mjs --pass takes it from what is left.
      costUsd: total.totals.costUsd,
      text,
    })}\n`,
  );
}

beforeAll(async () => {
  if (!process.env.OPENROUTER_API_KEY?.trim() && !process.env.AGENT_OPENROUTER_API_KEY?.trim()) {
    throw new Error("eval: OPENROUTER_API_KEY is not set (tools/lifecycle_test_db.py --allow-env OPENROUTER_API_KEY)");
  }
  runDir = startRun(runRoot("matrix"), {
    runId: evalRun,
    mode: "matrix",
    models: runModels,
    matrixRun: null,
    kind,
    passId,
    sourceRun: sourceRun?.runId ?? null,
    passBudgetUsd,
  });
  db = await openTestDb([]);
  await prepareHarness({ sql: db.sql });
});

afterAll(async () => {
  for (const b of budgets.values()) b.dispose();
  if (runDir) finishRun(runDir, tripped() ? "cap_exceeded" : ranToEnd ? "complete" : "failed", new Date(), total.totals.costUsd, costIsFloor(tripped()?.cap));
  // On a cap the matrix threw before it returned: measure what finished.
  const finished: MatrixResult = result ?? {
    recordings,
    models: runModels
      .map((model) => recordings.filter((r) => r.model === model))
      .filter((rs) => rs.length > 0)
      .map((rs) => ({ model: rs[0].model, cells: rs.length, measures: measure(rs), usage: usageOf(rs) })),
  };
  writeRunReport(
    [
      `Variant matrix${kind === "spot-check" ? ` spot check (persona ${persona}, one repeat)` : kind === "rerender-only" ? ` re-render of run ${sourceRun?.runId}` : ""} over ${runModels.join(", ")}: ${recordings.length} cells recorded`,
      ...(passId ? [`Pass ${passId}`] : []),
      `Run ${evalRun}: ${runDir ? path.relative(process.cwd(), runDir) : "no folder (the run did not start)"}`,
      "",
      matrixTable(finished),
      ...[...budgets.entries()].flatMap(([model, b]) => [`${model}:`, b.report(), ""]),
      "Whole command:",
      total.report(),
    ].join("\n"),
  );
  await db?.close();
  await endServicePool();
});

describe("variant matrix", () => {
  // Hours, not minutes: the per-model wall-clock caps are what bound it.
  const timeout = (caps.maxMinutes * runModels.length + 10) * 60_000;
  test(
    `${runModels.length} model(s), up to ${caps.maxCases} cells each`,
    async () => {
      // Rerender-only: the source's variant 1 recordings stand in for the live cells.
      let sources: Map<string, Recording> | undefined;
      if (sourceRun) {
        const read = readRerenderSources(runRoot("matrix"), sourceRun.runId);
        if (read.unreadable.length > 0) console.warn(`eval: ${read.unreadable.length} variant 1 file(s) of run ${sourceRun.runId} did not parse and are not re-rendered`);
        if (read.items.length === 0) throw new Error(`eval: matrix run ${sourceRun.runId} has no variant 1 recording to re-render`);
        sources = sourcesByCell(read.items);
      }
      result = await runMatrix({
        models: runModels,
        maxCells: caps.maxCases,
        repeats,
        personas,
        sources,
        runner: liveMatrixRunner({ sql: db.sql }, { caps, total, onBudget: (model, b) => budgets.set(model, b), seedSources: sources !== undefined }),
        onRecording: async (_cell, cell) => {
          const r: Recording = { ...cell, evalRun };
          recordings.push(r);
          const file = path.join(runDir!, matrixRecordingPath(r));
          mkdirSync(path.dirname(file), { recursive: true });
          writeFileSync(file, `${JSON.stringify(r, null, 2)}\n`, { flag: "wx" });
          try {
            await upsertDatasetRecord(matrixDatasetItem(r, recordingSignature(r)));
          } catch (e) {
            console.warn("eval: matrix dataset write failed", e instanceof Error ? e.name : typeof e);
          }
        },
      });
      expect(tripped()).toBeNull();
      ranToEnd = true;
    },
    timeout,
  );
});
