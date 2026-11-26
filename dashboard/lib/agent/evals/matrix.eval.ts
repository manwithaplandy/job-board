// The variant matrix (plan Task 2.10): per model, 4 scenarios by 3 personas by 5 repeats
// played live in variant 1, each run's surfaces re-rendered into variants 2 and 3 from the
// same gathered data (180 cells a model). NEVER part of `npm test` or the db lane: only
// `npm run eval:agent -- --matrix` (scripts/eval-agent.mjs) runs it, inside
// tools/lifecycle_test_db.py's throwaway Postgres with the OpenRouter key forwarded
// (gate A17). It spends money: about 15 golden runs per model.
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
import { matrixDatasetItem, matrixRecordingPath, matrixTable, runMatrix, usageOf, type MatrixResult } from "@/lib/agent/evals/matrix";
import { measure, recordingSignature } from "@/lib/agent/evals/measures";
import type { Recording } from "@/lib/agent/evals/recording";
import { AGENT_EVAL_MODELS } from "@/lib/agent/config";
import { assertEvalMode, capsFromEnv, totalBudget, totalCapsFromEnv, type RunBudget } from "@/lib/agent/evals/budget";
import { assertPricedModels } from "@/lib/agent/evals/matrixPlan";
import { finishRun, newRunId, runRoot, startRun } from "@/lib/agent/evals/evalRuns";

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
const models = (process.env.EVAL_MODELS ?? "")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m.length > 0);
const runModels = models.length > 0 ? models : [...AGENT_EVAL_MODELS];
if (!runModels.every((m) => MODEL_RE.test(m))) throw new Error("eval: EVAL_MODELS holds something that is not a model id");
// Re-checked here as eval-agent.mjs does: only models with a row in the price table run.
assertPricedModels(runModels);
const evalRun = process.env.EVAL_RUN_ID || newRunId();
let runDir: string | null = null;
let ranToEnd = false;

vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", process.env.AGENT_TOOL_APPROVAL_SECRET || "e".repeat(40));

// A cap above its ceiling throws CapUsageError here, before any database or model work.
const caps = capsFromEnv(process.env, "matrix");
const totals = totalCapsFromEnv(process.env, "matrix");
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
      text,
    })}\n`,
  );
}

beforeAll(async () => {
  if (!process.env.OPENROUTER_API_KEY?.trim() && !process.env.AGENT_OPENROUTER_API_KEY?.trim()) {
    throw new Error("eval: OPENROUTER_API_KEY is not set (tools/lifecycle_test_db.py --allow-env OPENROUTER_API_KEY)");
  }
  runDir = startRun(runRoot("matrix"), { runId: evalRun, mode: "matrix", models: runModels, matrixRun: null });
  db = await openTestDb([]);
  await prepareHarness({ sql: db.sql });
});

afterAll(async () => {
  for (const b of budgets.values()) b.dispose();
  if (runDir) finishRun(runDir, tripped() ? "cap_exceeded" : ranToEnd ? "complete" : "failed");
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
      `Variant matrix over ${runModels.join(", ")}: ${recordings.length} cells recorded`,
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
      result = await runMatrix({
        models: runModels,
        maxCells: caps.maxCases,
        runner: liveMatrixRunner({ sql: db.sql }, { caps, total, onBudget: (model, b) => budgets.set(model, b) }),
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
