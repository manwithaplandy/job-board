// The live golden-scenario run (plan Task 1.22): 4 scenarios by 3 personas against a
// real model. NEVER part of `npm test` or the db lane: only vitest.eval.config.ts
// includes *.eval.ts, and only `npm run eval:agent` (scripts/eval-agent.mjs) runs it,
// inside tools/lifecycle_test_db.py's throwaway Postgres. It spends money on OpenRouter.
//
// Each run is judged, then written as <scenario>.<persona>.<model>.json: beside the
// hand-written ones (recordings/v<variant>/) when it passes, or to the gitignored
// recordings-failed/v<variant>/ when it does not, so a failing run can still be read.
// A run fails on any assert failure; the cost table is printed at the end either way.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { openTestDb, type TestDb } from "@/lib/testing/dbHarness";
import { endServicePool } from "@/lib/db";
import { assertRecording } from "@/lib/agent/evals/asserts";
import { costTable, prepareHarness, runScenario, writeRecording } from "@/lib/agent/evals/harness";
import { PERSONA_IDS } from "@/lib/agent/evals/personas";
import { SCENARIO_IDS } from "@/lib/agent/evals/scenarios";
import type { Recording } from "@/lib/agent/evals/recording";
import { AGENT_MODEL_DEFAULT } from "@/lib/agent/config";

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

beforeAll(async () => {
  if (!process.env.OPENROUTER_API_KEY?.trim() && !process.env.AGENT_OPENROUTER_API_KEY?.trim()) {
    throw new Error("eval: OPENROUTER_API_KEY is not set (tools/lifecycle_test_db.py --allow-env OPENROUTER_API_KEY)");
  }
  db = await openTestDb([]);
  await prepareHarness({ sql: db.sql });
});

afterAll(async () => {
  console.log(`\nGolden scenarios, variant ${variant}, ${model}, seed ${seed}\n\n${costTable(recordings)}\n`);
  await db?.close();
  // The app's own pool, closed without importing serviceSql (lib/serviceRoleAllowlist.test.ts).
  await endServicePool();
});

const RUNS = SCENARIO_IDS.flatMap((scenario) => PERSONA_IDS.map((persona) => [scenario, persona] as const));

describe(`golden scenarios (variant ${variant})`, () => {
  // Timeouts come from vitest.eval.config.ts (ten minutes a run).
  test.each(RUNS)("%s for %s", async (scenario, persona) => {
    const { skipped, ...recording } = await runScenario({ persona, scenario, variant, model, seed }, { sql: db.sql });
    recordings.push(recording);
    const failures = assertRecording(recording);
    const file = writeRecording(failures.length === 0 ? passDir : failDir, recording);
    if (skipped.length > 0) console.warn(`${file}: skipped ${skipped.join("; ")}`);
    expect(failures, file).toEqual([]);
  });
});
