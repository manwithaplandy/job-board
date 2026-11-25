// The live golden-scenario harness (plan Task 1.22). It plays a scenario for a persona
// against a real model, calling streamAgentTurn directly with the persona's user id (no
// HTTP and no Supabase Auth, D14), and reads the run back as a Recording.
//
// LIVE ONLY. It never runs in CI and no test imports it (asserts.test.ts checks that):
// it spends money on a model provider. Its one entry is lib/agent/evals/live.eval.ts,
// run by `npm run eval:agent` (scripts/eval-agent.mjs) inside the throwaway database of
// tools/lifecycle_test_db.py, which needs gate A17 (the opt-in OPENROUTER_API_KEY
// forward) before a key can reach it.
//
// Two things are stood in, as in the phase 1 gate: application prep writes the
// persona's fixed tailored résumé instead of fetching a posting and generating documents
// (writeStandInPackage), and the caller (live.eval.ts) mocks the plan lookup and
// next/cache. Everything else is the real loop, tools, stores and database.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { wrapLanguageModel, type LanguageModel } from "ai";
import { z } from "zod";
import type postgres from "postgres";
import { agentModel } from "@/lib/agent/provider";
import { streamAgentTurn } from "@/lib/agent/loop";
import { createThread, getThread } from "@/lib/agent/threads";
import { buildTools } from "@/lib/agent/tools";
import type { Variant } from "@/lib/agent/config";
import { parseOrNull } from "@/lib/zodParse";
import { PERSONAS, seedPersona, writeStandInPackage, type Persona, type PersonaId } from "@/lib/agent/evals/personas";
import { SCENARIOS, type ScenarioId } from "@/lib/agent/evals/scenarios";
import { collectRecording, snapshotDb } from "@/lib/agent/evals/record";
import { playScenario, readStream, type TurnRunner } from "@/lib/agent/evals/play";
import { recordingFileName, type Recording } from "@/lib/agent/evals/recording";

export interface RunScenarioArgs {
  persona: PersonaId;
  scenario: ScenarioId;
  variant: Variant;
  model: string;
  seed: number;
}

/** The harness database's owner connection (lib/testing/dbHarness openTestDb). */
export interface HarnessCtx {
  sql: postgres.Sql;
}

/** Ceilings for the eval users: far above one run, so the budget never cuts a scenario short. */
const EVAL_DAILY_CEILING_MICROS = 50_000_000;
const EVAL_MONTHLY_CEILING_MICROS = 500_000_000;
/** How long a turn's persistence may take after its stream ends. */
const PERSIST_WAIT_MS = 120_000;
const PERSIST_POLL_MS = 250;

/** Turns the agent on with the eval ceilings (owner connection; harness database only). */
export async function prepareHarness(ctx: HarnessCtx): Promise<void> {
  for (const [key, value] of [
    ["agent_enabled", true],
    ["agent_daily_ceiling_micros", EVAL_DAILY_CEILING_MICROS],
    ["agent_monthly_ceiling_micros", EVAL_MONTHLY_CEILING_MICROS],
  ] as const) {
    await ctx.sql`INSERT INTO app_settings (key, value) VALUES (${key}, ${JSON.stringify(value)}::text::jsonb)
                  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
}

/** The live model with the run's seed on every call (providers that support seeds use it). */
function seededModel(modelId: string, seed: number): LanguageModel {
  const base = agentModel(modelId);
  if (typeof base === "string") return base;
  return wrapLanguageModel({
    model: base,
    modelId,
    middleware: { transformParams: async ({ params }) => ({ ...params, seed }) },
  });
}

/** The real tools, with application prep's work replaced by the stand-in package. */
function evalTools(ctx: HarnessCtx, persona: Persona): typeof buildTools {
  return (toolCtx) => {
    const tools = buildTools(toolCtx);
    const prep = tools.start_application_prep;
    if (prep) {
      tools.start_application_prep = {
        ...prep,
        execute: async (input: { jobId: string }) => {
          await writeStandInPackage(ctx.sql, persona, input.jobId);
          return { status: "started" as const, generationId: "eval-stand-in" };
        },
      };
    }
    const refine = tools.refine_documents;
    if (refine) {
      tools.refine_documents = {
        ...refine,
        execute: async (input: { jobId: string }) => {
          await writeStandInPackage(ctx.sql, persona, input.jobId);
          return { status: "started" as const, generationId: "eval-stand-in" };
        },
      };
    }
    return tools;
  };
}

/** Waits until no run of the thread is still open (the turn's persistence has finished). */
async function waitForRuns(sql: postgres.Sql, threadId: string): Promise<void> {
  const deadline = Date.now() + PERSIST_WAIT_MS;
  for (;;) {
    const rows = await sql`
      SELECT count(*) AS open FROM agent_runs
      WHERE thread_id = ${threadId}::uuid AND status IN ('pending', 'running')`;
    const open = parseOrNull(z.object({ open: z.coerce.number() }), rows[0])?.open ?? 0;
    if (open === 0) return;
    if (Date.now() > deadline) throw new Error("eval: a turn's run never closed");
    await new Promise((resolve) => setTimeout(resolve, PERSIST_POLL_MS));
  }
}

/** Plays one scenario for one persona against the live model and returns its recording. */
export async function runScenario(a: RunScenarioArgs, ctx: HarnessCtx): Promise<Recording & { skipped: string[] }> {
  const persona = PERSONAS[a.persona];
  const scenario = SCENARIOS[a.scenario];
  const userId = await seedPersona(ctx.sql, persona, scenario.setup);
  const thread = await createThread(userId, a.variant);
  const dbBefore = await snapshotDb(ctx.sql, userId);
  const model = seededModel(a.model, a.seed);
  const tools = evalTools(ctx, persona);

  const runTurn: TurnRunner = async (input) => {
    const startedAt = Date.now();
    const current = (await getThread(userId, thread.id)) ?? thread;
    const res = await streamAgentTurn({ userId, email: persona.email, thread: current, input, model, tools });
    const { firstRenderMs } = await readStream(res, startedAt);
    await waitForRuns(ctx.sql, thread.id);
    return { status: res.status, ms: Date.now() - startedAt, firstRenderMs };
  };

  const played = await playScenario({ scenario, persona, userId, email: persona.email, threadId: thread.id, runTurn });
  const recording = await collectRecording({
    sql: ctx.sql,
    source: "live",
    scenario: a.scenario,
    persona: a.persona,
    userId,
    threadId: thread.id,
    variant: a.variant,
    model: a.model,
    seed: a.seed,
    approvals: played.approvals,
    intents: played.intents,
    dbBefore,
    timings: played.timings,
  });
  return { ...recording, skipped: played.skipped };
}

/** Writes a live recording beside the hand-written ones: <scenario>.<persona>.<model>.json. */
export function writeRecording(dir: string, r: Recording): string {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, recordingFileName(r));
  writeFileSync(file, `${JSON.stringify(r, null, 2)}\n`);
  return file;
}

const dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(4)}`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** The cost table per scenario (mean and max over its personas): dollars, tokens and seconds. */
export function costTable(recordings: Recording[]): string {
  const lines = [
    "| Scenario | Runs | Mean cost | Max cost | Mean tokens (in/out) | Mean time | Max time | Mean first render |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const id of Object.keys(SCENARIOS) as ScenarioId[]) {
    const rs = recordings.filter((r) => r.scenario === id);
    if (rs.length === 0) continue;
    const mean = (f: (r: Recording) => number) => rs.reduce((s, r) => s + f(r), 0) / rs.length;
    const max = (f: (r: Recording) => number) => Math.max(...rs.map(f));
    const renders = rs.map((r) => r.timings.firstRenderMs).filter((v): v is number => v !== null);
    lines.push(
      `| ${id} | ${rs.length} | ${dollars(mean((r) => r.usage.costMicros))} | ${dollars(max((r) => r.usage.costMicros))} | ` +
        `${Math.round(mean((r) => r.usage.inputTokens))}/${Math.round(mean((r) => r.usage.outputTokens))} | ` +
        `${seconds(mean((r) => r.timings.completeMs))} | ${seconds(max((r) => r.timings.completeMs))} | ` +
        `${renders.length ? seconds(renders.reduce((s, v) => s + v, 0) / renders.length) : "n/a"} |`,
    );
  }
  return lines.join("\n");
}
