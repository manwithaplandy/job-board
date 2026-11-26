// The prompt-injection set, live (plan Task 2.12): per model, the 15 model-driven cases
// (injection.ts) in variants 1, 2 and 3, 45 runs a model. NEVER part of `npm test` or the
// db lane: only `npm run eval:agent -- --injection` (scripts/eval-agent.mjs) runs it,
// inside tools/lifecycle_test_db.py's throwaway Postgres with the OpenRouter key forwarded
// (gate A17). It spends money.
//
// Spend caps (budget.ts, injection profile): one RunBudget per model, each reporting to
// one whole-command budget. The first cap to trip stops the whole command: the run in
// progress writes nothing, no later run or model starts, and the report says
// cap_exceeded with the usage so far.
//
// Each finished run's result (its recording, the agent's replies and the contact details
// it must not repeat) is written to recordings/injection/<model>/v<variant>/<case>.json.
// A breach is data here, shown in the pass table, not a test failure; only a cap fails the
// command. Variant 3 results carry no replay: test:render-smoke replays their stored
// surfaces in the sandbox harness (zero canary hits, one load) once they are committed.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openTestDb, type TestDb } from "@/lib/testing/dbHarness";
import { endServicePool } from "@/lib/db";
import { prepareHarness, runInjectionCase } from "@/lib/agent/evals/harness";
import { INJECTION_CASES, injectionPlan, injectionResultPath, injectionTable, type InjectionResult } from "@/lib/agent/evals/injection";
import { AGENT_EVAL_MODELS } from "@/lib/agent/config";
import { capsFromEnv, profileBudget, totalBudget, totalCapsFromEnv, type RunBudget } from "@/lib/agent/evals/budget";
import { assertPricedModels } from "@/lib/agent/evals/matrixPlan";

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

const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
const models = (process.env.EVAL_MODELS ?? "")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m.length > 0);
const runModels = models.length > 0 ? models : [...AGENT_EVAL_MODELS];
if (!runModels.every((m) => MODEL_RE.test(m))) throw new Error("eval: EVAL_MODELS holds something that is not a model id");
// Re-checked here as eval-agent.mjs does: only models with a row in the price table run.
assertPricedModels(runModels);
const outDir = fileURLToPath(new URL("./recordings/injection/", import.meta.url));

vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", process.env.AGENT_TOOL_APPROVAL_SECRET || "e".repeat(40));

// A cap above its ceiling throws CapUsageError here, before any database or model work.
const caps = capsFromEnv(process.env, "injection");
const totals = totalCapsFromEnv(process.env, "injection");
if (!totals) throw new Error("eval: the injection set needs its whole-command caps");
const total = totalBudget(totals);
const budgets = new Map<string, RunBudget>();
const results: InjectionResult[] = [];
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
  db = await openTestDb([]);
  await prepareHarness({ sql: db.sql });
});

afterAll(async () => {
  for (const b of budgets.values()) b.dispose();
  writeRunReport(
    [
      `Prompt-injection set over ${runModels.join(", ")}: ${results.length} runs recorded`,
      "",
      injectionTable(results),
      ...[...budgets.entries()].flatMap(([model, b]) => [`${model}:`, b.report(), ""]),
      "Whole command:",
      total.report(),
    ].join("\n"),
  );
  await db?.close();
  await endServicePool();
});

describe("prompt-injection set", () => {
  const timeout = (caps.maxMinutes * runModels.length + 10) * 60_000;
  test(
    `${runModels.length} model(s), up to ${caps.maxCases} runs each`,
    async () => {
      for (const model of runModels) {
        // The injection profile: a call that reports no cost trips cost_unknown.
        const budget = profileBudget("injection", caps, total);
        budget.armClock();
        budgets.set(model, budget);
        try {
          for (const run of injectionPlan([model]).slice(0, caps.maxCases)) {
            const injection = INJECTION_CASES.find((c) => c.id === run.caseId);
            if (!injection) throw new Error(`eval: unknown injection case ${run.caseId}`);
            const r = await runInjectionCase({ injection, variant: run.variant, model, seed: 1 }, { sql: db.sql, budget });
            results.push(r);
            const file = path.join(outDir, injectionResultPath(r));
            mkdirSync(path.dirname(file), { recursive: true });
            writeFileSync(file, `${JSON.stringify(r, null, 2)}\n`);
          }
        } finally {
          budget.dispose();
        }
      }
      expect(tripped()).toBeNull();
    },
    timeout,
  );
});
