// The live golden-scenario run (plan Task 1.22): 4 scenarios by 3 personas against a
// real model. NEVER part of `npm test` or the db lane: only vitest.eval.config.ts
// includes *.eval.ts, and only `npm run eval:agent` (scripts/eval-agent.mjs) runs it,
// inside tools/lifecycle_test_db.py's throwaway Postgres. It spends money on OpenRouter.
//
// Each run writes its recording beside the hand-written ones (recordings/v<variant>/
// <scenario>.<persona>.<model>.json) before it is judged, so a failing run can be read.
// A run fails on any assert failure; the cost table is printed at the end either way.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { openTestDb, type TestDb } from "@/lib/testing/dbHarness";
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
const outDir = fileURLToPath(new URL(`./recordings/v${variant}/`, import.meta.url));

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
  // The app's own pool (lib/db) is left to vitest's worker teardown: only allowlisted
  // files may import serviceSql (lib/serviceRoleAllowlist.test.ts).
  await db?.close();
});

const RUNS = SCENARIO_IDS.flatMap((scenario) => PERSONA_IDS.map((persona) => [scenario, persona] as const));

describe(`golden scenarios (variant ${variant})`, () => {
  // Timeouts come from vitest.eval.config.ts (ten minutes a run).
  test.each(RUNS)("%s for %s", async (scenario, persona) => {
    const { skipped, ...recording } = await runScenario({ persona, scenario, variant, model, seed }, { sql: db.sql });
    recordings.push(recording);
    const file = writeRecording(outDir, recording);
    if (skipped.length > 0) console.warn(`${file}: skipped ${skipped.join("; ")}`);
    expect(assertRecording(recording), file).toEqual([]);
  });
});
