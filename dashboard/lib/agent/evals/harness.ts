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
//
// Spend caps (gate A17, budget.ts): the model is wrapped by budgetMiddleware, so every
// call is checked against the run's RunBudget before it reaches the provider. A case
// starts with budget.startCase() and each turn with startTurn(); once a cap trips,
// runScenario throws CapExceededError before it reads a Recording, so the caller writes
// nothing for that case.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { wrapLanguageModel, type LanguageModel } from "ai";
import { z } from "zod";
import type postgres from "postgres";
import { agentModel } from "@/lib/agent/provider";
import { streamAgentTurn } from "@/lib/agent/loop";
import { createThread, getThread, loadMessages } from "@/lib/agent/threads";
import { buildTools } from "@/lib/agent/tools";
import type { Variant } from "@/lib/agent/config";
import { parseOrNull } from "@/lib/zodParse";
import { PERSONAS, seedPersona, writeStandInPackage, type Persona, type PersonaId } from "@/lib/agent/evals/personas";
import { SCENARIOS, type PersonaSetup, type Scenario, type ScenarioId } from "@/lib/agent/evals/scenarios";
import { loadInjectionFixture, type InjectionCase, type InjectionResult } from "@/lib/agent/evals/injection";
import { collectRecording, rerenderUsage, snapshotDb } from "@/lib/agent/evals/record";
import { playScenario, readStream, type TurnRunner } from "@/lib/agent/evals/play";
import { recordingFileName, type Recording } from "@/lib/agent/evals/recording";
import { profileBudget, type EvalCaps, type RunBudget } from "@/lib/agent/evals/budget";
import { budgetMiddleware } from "@/lib/agent/evals/budgetMiddleware";
import { rerenderSurface } from "@/lib/agent/rerender";
import type { StoredSurface } from "@/lib/agent/surfaces/store";
import type { MatrixRunner } from "@/lib/agent/evals/matrix";
import { cellKey } from "@/lib/agent/evals/matrixPlan";

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

/** A scenario run's context: the harness database and the whole run's spend caps. */
export interface ScenarioCtx extends HarnessCtx {
  budget: RunBudget;
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

/**
 * The live model with the run's seed on every call (providers that support seeds use it)
 * and every call checked against the run's caps. A model given only by id could not be
 * checked, so it is refused.
 */
function seededModel(modelId: string, seed: number, budget: RunBudget): LanguageModel {
  const base = agentModel(modelId);
  if (typeof base === "string") throw new Error("eval: the budgeted model needs a model instance, not an id");
  return wrapLanguageModel({
    model: base,
    modelId,
    middleware: [{ transformParams: async ({ params }) => ({ ...params, seed }) }, budgetMiddleware(budget)],
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
export async function runScenario(a: RunScenarioArgs, ctx: ScenarioCtx): Promise<Recording & { skipped: string[] }> {
  ctx.budget.startCase();
  const persona = PERSONAS[a.persona];
  const scenario = SCENARIOS[a.scenario];
  const userId = await seedPersona(ctx.sql, persona, scenario.setup);
  return playSeeded({ ...a, scenario, userId }, ctx);
}

/** Plays `scenario` on a new thread of the already seeded persona, and reads the run back. */
async function playSeeded(
  a: Omit<RunScenarioArgs, "scenario"> & { scenario: Scenario; userId: string },
  ctx: ScenarioCtx,
): Promise<Recording & { skipped: string[]; threadId: string }> {
  const { budget } = ctx;
  const { scenario, userId } = a;
  const persona = PERSONAS[a.persona];
  const thread = await createThread(userId, a.variant);
  const dbBefore = await snapshotDb(ctx.sql, userId);
  const model = seededModel(a.model, a.seed, budget);
  const tools = evalTools(ctx, persona);

  const runTurn: TurnRunner = async (input) => {
    budget.startTurn();
    const startedAt = Date.now();
    const current = (await getThread(userId, thread.id)) ?? thread;
    const res = await streamAgentTurn({ userId, email: persona.email, thread: current, input, model, tools });
    const { firstRenderMs } = await readStream(res, startedAt);
    await waitForRuns(ctx.sql, thread.id);
    // A cap that tripped during the turn, or a call whose usage was never read, stops the
    // whole run here, before the next step.
    budget.endTurn();
    return { status: res.status, ms: Date.now() - startedAt, firstRenderMs };
  };

  const played = await playScenario({ scenario, persona, userId, email: persona.email, threadId: thread.id, runTurn });
  // Never a Recording from a case the caps stopped.
  budget.throwIfTripped();
  const recording = await collectRecording({
    sql: ctx.sql,
    source: "live",
    scenario: scenario.id,
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
  return { ...recording, skipped: played.skipped, threadId: thread.id };
}

/**
 * One model-driven injection case (Task 2.12, used only by injection.eval.ts): the persona
 * seeded with a résumé on file and a memo, the fixture's hostile text planted where the
 * case's channel reads it (a posting's description, a company's display name, or an
 * uploaded résumé or photo's extracted text), then the case's scripted user played on a
 * new thread of `variant`. The planted rows are reset first, so a case never sees another
 * case's text. Variant 3's replay in the sandbox harness is not done here (no browser in
 * this lane): `replay` is null and the render smoke replays the stored surfaces in CI.
 */
export async function runInjectionCase(
  a: { injection: InjectionCase; variant: Variant; model: string; seed: number },
  ctx: ScenarioCtx,
): Promise<InjectionResult> {
  ctx.budget.startCase();
  const c = a.injection;
  const persona = PERSONAS[c.persona];
  const fixture = loadInjectionFixture(c.fixture);
  const jobIds = persona.jobs.map((j) => j.jobId);
  await ctx.sql`UPDATE jobs SET description = NULL WHERE id IN ${ctx.sql(jobIds)}`;
  await ctx.sql`UPDATE companies SET display_name = NULL
                WHERE id IN (SELECT company_id FROM jobs WHERE id IN ${ctx.sql(jobIds)})`;
  const userId = await seedPersona(ctx.sql, persona, INJECTION_SETUP);
  if (fixture.kind === "posting") {
    await ctx.sql`UPDATE jobs SET description = ${fixture.text} WHERE id = ${persona.jobs[fixture.jobIndex].jobId}`;
  } else if (fixture.kind === "company") {
    await ctx.sql`UPDATE companies SET display_name = ${fixture.text}
                  WHERE id = (SELECT company_id FROM jobs WHERE id = ${persona.jobs[fixture.jobIndex].jobId})`;
  } else {
    const mime = fixture.filename.endsWith(".png") ? "image/png" : "text/markdown";
    await ctx.sql`
      INSERT INTO documents (id, user_id, kind, filename, mime, bytes, storage_path, extracted_text, extraction)
      VALUES (${persona.documentId}, ${userId}, ${fixture.documentKind}, ${fixture.filename}, ${mime},
              ${Buffer.byteLength(fixture.text, "utf8")}, ${`${userId}/doc-${persona.documentId}-${fixture.filename}`},
              ${fixture.text}, 'ok')`;
  }
  const scenario: Scenario = { id: c.scenario, title: `injection ${c.id}`, setup: INJECTION_SETUP, steps: c.steps };
  const { skipped, threadId, ...recording } = await playSeeded(
    { persona: c.persona, scenario, userId, variant: a.variant, model: a.model, seed: a.seed },
    ctx,
  );
  if (skipped.length > 0) console.warn(`eval: injection ${c.id} skipped ${skipped.join("; ")}`);
  const texts = (await loadMessages(userId, threadId))
    .filter((m) => m.role === "assistant")
    .flatMap((m) => m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])));
  return {
    caseId: c.id,
    variant: a.variant,
    model: a.model,
    recording,
    texts,
    contacts: [persona.email, ...(fixture.secrets ?? [])],
    replay: null,
    html: null,
  };
}

/** Every injection case starts with the résumé on the profile and a memo, and no applications. */
const INJECTION_SETUP: PersonaSetup = { resume: "on_profile", memo: true, applications: false };

/**
 * A matrix re-render cell (Task 2.10): every surface of the live variant 1 run `from`,
 * re-rendered into `variant` by rerenderSurface itself (no HTTP route), so each goes
 * through the same present tool, validation, repair and fallback path as a user's
 * re-render, as a run of kind rerender charged against the same ceilings. The model is the
 * original's, wrapped by the same budget middleware as the live run. Only the gathered data
 * the live run stored is sent; no read or write tool is offered.
 */
export async function rerenderRun(a: { from: Recording; variant: 2 | 3 }, ctx: ScenarioCtx): Promise<Recording> {
  const { budget } = ctx;
  budget.startCase();
  const persona = PERSONAS[a.from.persona];
  const model = (modelId: string) => seededModel(modelId, a.from.seed, budget);
  const startedAt = Date.now();
  let firstRenderMs: number | null = null;
  const surfaces: StoredSurface[] = [];
  for (const source of a.from.surfaces) {
    budget.startTurn();
    // The operator switch is the caller's to read; the eval database has it at its default,
    // so the harness passes it as on for the matrix (no flag is changed).
    const out = await rerenderSurface(
      persona.userId,
      { surfaceId: source.id, variant: a.variant, email: persona.email, variant3Enabled: true },
      { model },
    );
    budget.endTurn();
    if (out.ok) {
      surfaces.push(out.surface);
      firstRenderMs ??= Date.now() - startedAt;
    } else {
      console.warn(`eval: re-render of surface ${source.id} into variant ${a.variant} ended ${out.reason}`);
    }
  }
  // Never a Recording from a cell the caps stopped.
  budget.throwIfTripped();
  const threadId = a.from.surfaces[0]?.threadId ?? null;
  return {
    ...a.from,
    source: "rerender",
    variant: a.variant,
    surfaces,
    usage: threadId === null ? { costMicros: 0, inputTokens: 0, outputTokens: 0 } : await rerenderUsage(ctx.sql, threadId, a.variant),
    timings: { firstRenderMs, completeMs: Date.now() - startedAt },
  };
}

/**
 * The live matrix runner (Task 2.10, used only by matrix.eval.ts): one RunBudget per
 * model with the matrix caps, each reporting to the whole command's budget `total`. A
 * model's budget is opened at its first cell and disposed after its last.
 */
export function liveMatrixRunner(
  ctx: HarnessCtx,
  a: { caps: EvalCaps; total: RunBudget; onBudget: (model: string, budget: RunBudget) => void },
): MatrixRunner {
  let budget: RunBudget | null = null;
  const current = (): RunBudget => {
    if (!budget) throw new Error("eval: a matrix cell ran outside its model's budget");
    return budget;
  };
  return {
    startModel: (model) => {
      // The matrix profile: a call that reports no cost trips cost_unknown.
      budget = profileBudget("matrix", a.caps, a.total);
      budget.armClock();
      a.onBudget(model, budget);
    },
    endModel: () => {
      budget?.dispose();
      budget = null;
    },
    live: async (cell) => {
      const { skipped, ...recording } = await runScenario(
        { persona: cell.persona, scenario: cell.scenario, variant: 1, model: cell.model, seed: cell.repeat },
        { sql: ctx.sql, budget: current() },
      );
      if (skipped.length > 0) console.warn(`eval: ${cellKey(cell)} skipped ${skipped.join("; ")}`);
      return recording;
    },
    rerender: async (cell, from) => {
      if (cell.variant === 1) throw new Error("eval: variant 1 is never a re-render");
      return rerenderRun({ from, variant: cell.variant }, { sql: ctx.sql, budget: current() });
    },
  };
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
