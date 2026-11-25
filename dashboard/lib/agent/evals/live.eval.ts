// The live golden-scenario run (plan Task 1.22): 4 scenarios by 3 personas against a
// real model. NEVER part of `npm test` or the db lane: only vitest.eval.config.ts
// includes *.eval.ts, and only `npm run eval:agent` (scripts/eval-agent.mjs) runs it,
// inside tools/lifecycle_test_db.py's throwaway Postgres. It spends money on OpenRouter.
//
// Each run is judged, then written as <scenario>.<persona>.<model>.json: beside the
// hand-written ones (recordings/v<variant>/) when it passes, or to the gitignored
// recordings-failed/v<variant>/ when it does not, so a failing run can still be read.
// A run fails on any assert failure; the cost table is printed at the end either way.
//
// Spend caps (gate A17, budget.ts): one RunBudget for the whole run, from the EVAL_MAX_*
// values eval-agent.mjs passes (re-checked here against the same ceilings). The first
// cap to trip fails that case (no recording is written for it), skips every case after
// it, and marks the run cap_exceeded in the report eval-agent.mjs prints.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openTestDb, type TestDb } from "@/lib/testing/dbHarness";
import { endServicePool } from "@/lib/db";
import { assertRecording } from "@/lib/agent/evals/asserts";
import { costTable, prepareHarness, runScenario, writeRecording } from "@/lib/agent/evals/harness";
import { PERSONA_IDS } from "@/lib/agent/evals/personas";
import { SCENARIO_IDS } from "@/lib/agent/evals/scenarios";
import type { Recording } from "@/lib/agent/evals/recording";
import { AGENT_MODEL_DEFAULT } from "@/lib/agent/config";
import { ALL_CASES, RunBudget, capsFromEnv } from "@/lib/agent/evals/budget";

vi.mock("next/server", async (importOriginal) => {
  const real = await importOriginal<typeof import("next/server")>();
  // after() needs a Next request scope. The work starts at once; the harness waits for
  // each turn's run to close before the next step.
  return {
    ...real,
    after: (task: Promise<unknown> | (() => unknown)) => {
      void (typeof task === "function" ? Promise.resolve().then(task) : task).catch(() => {});
    },
  };
});
// No request scope to revalidate, and the personas have no subscription rows.
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/subscriptions", () => ({ getViewerPlan: vi.fn(async () => "standard") }));

const variant = Number(process.env.EVAL_VARIANT ?? "1");
if (variant !== 1 && variant !== 2 && variant !== 3) throw new Error("eval: EVAL_VARIANT must be 1, 2 or 3");
const model = process.env.EVAL_MODEL?.trim() || AGENT_MODEL_DEFAULT;
const seed = Number(process.env.EVAL_SEED ?? "1");
if (!Number.isSafeInteger(seed)) throw new Error("eval: EVAL_SEED must be an integer");
// A run that passes its asserts goes beside the committed recordings; a failing one goes
// to the gitignored recordings-failed/ folder, where it can be read but never reaches
// the committed-recordings test.
const passDir = fileURLToPath(new URL(`./recordings/v${variant}/`, import.meta.url));
const failDir = fileURLToPath(new URL(`./recordings-failed/v${variant}/`, import.meta.url));

// Approval tools exist only with a signing secret. This is a local, low-entropy value for
// the throwaway harness database, never a deployed secret.
vi.stubEnv("AGENT_TOOL_APPROVAL_SECRET", process.env.AGENT_TOOL_APPROVAL_SECRET || "e".repeat(40));

let db: TestDb;
const recordings: Recording[] = [];
// A cap value above its ceiling throws CapUsageError here, before any database or model work.
const caps = capsFromEnv(process.env);
// The wall clock (max_minutes) runs from here: the start of the run.
const budget = new RunBudget(caps);

/** The run's outcome for eval-agent.mjs, which prints it and sets the exit code. */
function writeRunReport(text: string): void {
  const file = process.env.EVAL_RUN_REPORT;
  if (!file) {
    console.log(text);
    return;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  const report = {
    status: budget.tripped ? "cap_exceeded" : "complete",
    cap: budget.tripped?.cap ?? null,
    usd: budget.usdEnforcement,
    text,
  };
  writeFileSync(file, `${JSON.stringify(report)}\n`);
}

beforeAll(async () => {
  budget.armClock();
  if (!process.env.OPENROUTER_API_KEY?.trim() && !process.env.AGENT_OPENROUTER_API_KEY?.trim()) {
    throw new Error("eval: OPENROUTER_API_KEY is not set (tools/lifecycle_test_db.py --allow-env OPENROUTER_API_KEY)");
  }
  db = await openTestDb([]);
  await prepareHarness({ sql: db.sql });
});

afterAll(async () => {
  budget.dispose();
  writeRunReport(
    [
      `Golden scenarios, variant ${variant}, ${model}, seed ${seed}: ${recordings.length} of ${RUNS.length} planned cases recorded`,
      "",
      costTable(recordings),
      "",
      budget.report(),
    ].join("\n"),
  );
  await db?.close();
  // The app's own pool, closed without importing serviceSql (lib/serviceRoleAllowlist.test.ts).
  await endServicePool();
});

const ALL_RUNS = SCENARIO_IDS.flatMap((scenario) => PERSONA_IDS.map((persona) => [scenario, persona] as const));
if (ALL_RUNS.length !== ALL_CASES) throw new Error(`eval: ${ALL_RUNS.length} cases, but budget.ts counts ${ALL_CASES}`);
// --max-cases plays the first n of them.
const RUNS = ALL_RUNS.slice(0, caps.maxCases);

describe(`golden scenarios (variant ${variant})`, () => {
  // Timeouts come from vitest.eval.config.ts (ten minutes a run).
  test.for(RUNS)("%s for %s", async ([scenario, persona], { skip }) => {
    // The whole run stops at the first cap: every later case is skipped, not played.
    if (budget.tripped) skip(`run stopped: cap_exceeded (${budget.tripped.cap})`);
    // A cap tripping inside runScenario throws CapExceededError: this case fails and
    // nothing is written for it.
    const { skipped, ...recording } = await runScenario({ persona, scenario, variant, model, seed }, { sql: db.sql, budget });
    budget.throwIfTripped();
    recordings.push(recording);
    const failures = assertRecording(recording);
    const file = writeRecording(failures.length === 0 ? passDir : failDir, recording);
    if (skipped.length > 0) console.warn(`${file}: skipped ${skipped.join("; ")}`);
    expect(failures, file).toEqual([]);
  });
});
