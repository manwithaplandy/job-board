// ─────────────────────────────────────────────────────────────────────────────
// serviceSql JUSTIFICATION (RLS-bypass allowlist — lib/serviceRoleAllowlist.test.ts):
// B-COST. agent_runs, agent_messages and agent spend in usage_counters are
// service-write-only (migration 17 grants authenticated SELECT only), so a signed-in
// user cannot zero or pre-empt a charge, finish a run early or plant an approved tool
// call through the Data API (plan Review Focus 6, Decision D4). Every function here
// takes `userId` from the caller's verified session and puts it in every WHERE;
// nothing here accepts an id from a request body. No model or network call happens
// inside any transaction in this file.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from "zod";
import { loadAppSettings } from "@/lib/appSettings";
import { serviceSql } from "@/lib/db";
import { acquireLifecycleGate } from "@/lib/jobLifecycle";
import { parseOrNull } from "@/lib/zodParse";
import { AGENT_LIMITS, USAGE_KIND_AGENT, type RunKind, type RunStatus, type Variant } from "@/lib/agent/config";
import { STEP_COST_MAX_MICROS } from "@/lib/agent/budget";
import {
  MESSAGE_STATUSES,
  StoredMessageSchema,
  redactForStorage,
  type AgentUIMessage,
  type MessageStatus,
} from "@/lib/agent/messageCodec";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A second interactive turn while one is still running on the thread (route: 409 turn_in_progress). */
export class TurnInProgressError extends Error {
  constructor() {
    super("agent: a turn is already running on this thread");
    this.name = "TurnInProgressError";
  }
}

/**
 * A second re-render while one of this user's re-renders is still running (route: 409
 * rerender_in_progress). PR J4 review M1: one re-render in flight per user.
 */
export class RerenderInProgressError extends Error {
  constructor() {
    super("agent: a re-render is already running for this user");
    this.name = "RerenderInProgressError";
  }
}

// The per-user lock that serializes re-render starts (agent_runs_one_live_turn covers
// interactive turns only, and a new index would need a migration).
const rerenderLockKey = (userId: string) => `agent-rerender:${userId}`;

function assertUuid(id: string | null, what: string): void {
  if (id === null || !UUID_RE.test(id)) throw new Error(`agent: ${what} not found`);
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && e.code === "23505";
}

const idRowSchema = z.object({ id: z.string() });

/**
 * Opens a run in status `running` and returns its id. One transaction: the thread must
 * belong to `userId`; for an interactive turn, that thread's running interactive runs
 * older than AGENT_LIMITS.staleTurnMs are aborted first. A second live turn on the
 * thread violates agent_runs_one_live_turn and becomes TurnInProgressError. For a
 * re-render, under a per-user advisory lock, this user's running re-renders older than
 * AGENT_LIMITS.staleTurnMs are aborted first, and a re-render still running becomes
 * RerenderInProgressError, so a user has at most one re-render in flight (PR J4 review
 * M1). Nothing is spent before this check: the model call comes after startRun.
 */
export async function startRun(
  userId: string,
  a: { threadId: string | null; kind: RunKind; model: string; variant: Variant | null; job?: string },
): Promise<string> {
  if (a.kind === "interactive" && a.threadId === null) throw new Error("agent: an interactive run needs a thread");
  if (a.threadId !== null) assertUuid(a.threadId, "thread");
  try {
    return await serviceSql.begin(async (tx) => {
      if (a.threadId !== null) {
        const owned = await tx`
          SELECT 1 FROM agent_threads WHERE id = ${a.threadId}::uuid AND user_id = ${userId}::uuid FOR UPDATE
        `;
        if (owned.length === 0) throw new Error("agent: thread not found");
        if (a.kind === "interactive") {
          await tx`
            UPDATE agent_runs SET status = 'aborted', error = 'stale_turn', finished_at = now()
            WHERE thread_id = ${a.threadId}::uuid AND user_id = ${userId}::uuid
              AND kind = 'interactive' AND status = 'running'
              AND COALESCE(started_at, created_at) < now() - ${`${AGENT_LIMITS.staleTurnMs} milliseconds`}::interval
          `;
        }
      }
      if (a.kind === "rerender") {
        // Taken after the thread lock, and only here, so the lock order is always the same.
        await tx`SELECT pg_advisory_xact_lock(hashtextextended(${rerenderLockKey(userId)}, 0))`;
        await tx`
          UPDATE agent_runs SET status = 'aborted', error = 'stale_rerender', finished_at = now()
          WHERE user_id = ${userId}::uuid AND kind = 'rerender' AND status = 'running'
            AND COALESCE(started_at, created_at) < now() - ${`${AGENT_LIMITS.staleTurnMs} milliseconds`}::interval
        `;
        const live = await tx`
          SELECT 1 FROM agent_runs WHERE user_id = ${userId}::uuid AND kind = 'rerender' AND status = 'running' LIMIT 1
        `;
        if (live.length > 0) throw new RerenderInProgressError();
      }
      const rows = await tx`
        INSERT INTO agent_runs (user_id, thread_id, kind, job, status, model, variant, started_at)
        VALUES (${userId}::uuid, ${a.threadId}, ${a.kind}, ${a.job ?? null}, 'running', ${a.model}, ${a.variant}, now())
        RETURNING id
      `;
      const row = parseOrNull(idRowSchema, rows[0]);
      if (!row) throw new Error("agent: startRun returned an unexpected row");
      return row.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new TurnInProgressError();
    throw e;
  }
}

// Same key shape as lib/usage.ts reserveLockKey, so agent charges share its namespace.
const spendLockKey = (userId: string) => `usage:${userId}:${USAGE_KIND_AGENT}`;

function isWholeCount(n: number, max: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= max;
}

const spendRowSchema = z.object({
  day_micros: z.coerce.number().int().nonnegative(),
  month_micros: z.coerce.number().int().nonnegative(),
});

export type ChargeResult = { ok: boolean; reason?: "daily_ceiling" | "monthly_ceiling" };

/**
 * Charges one model step. One service-role transaction shaped like reserveGenerations
 * (lib/usage.ts): the lifecycle gate (usage_counters is in the lifecycle trigger loop,
 * so the gate is taken first to keep lock order), then the per-(user, agent_micros)
 * advisory lock; add the cost to today's UTC usage_counters row; add cost, tokens and
 * one step to the run while it is `running`; then read day and month spend under the
 * lock and compare with the ceilings. `ok` is false once either ceiling is reached; the
 * step is recorded either way, because the money is already spent. Worst case is one
 * step of overshoot per live run.
 *
 * The counter is charged even when the run is no longer running (or is not this
 * user's): spend that happened always counts toward this user's ceiling.
 */
export async function chargeStep(
  userId: string,
  runId: string,
  s: { costMicros: number; inputTokens: number; outputTokens: number },
): Promise<ChargeResult> {
  if (!isWholeCount(s.costMicros, STEP_COST_MAX_MICROS)) {
    throw new Error("agent: a step cost must be a whole number of micros from 0 to STEP_COST_MAX_MICROS");
  }
  if (!isWholeCount(s.inputTokens, Number.MAX_SAFE_INTEGER) || !isWholeCount(s.outputTokens, Number.MAX_SAFE_INTEGER)) {
    throw new Error("agent: token counts must be whole non-negative numbers");
  }
  // Read before the transaction: no settings read while holding the spend lock.
  const settings = await loadAppSettings();
  const runMatches = UUID_RE.test(runId);
  // The model call is already billed, so a busy lifecycle gate (its 2 s lock_timeout or
  // 5 s statement_timeout) gets one retry before the step is lost (PR C batch 2 review
  // M1). The transaction rolled back, so a retry never double-charges.
  let spend: z.infer<typeof spendRowSchema>;
  try {
    spend = await chargeTx(userId, runId, runMatches, s);
  } catch (e) {
    if (!isTimeout(e)) throw e;
    console.warn("agent: chargeStep timed out on a lock; retrying once");
    spend = await chargeTx(userId, runId, runMatches, s);
  }
  if (spend.day_micros >= settings.agentDailyCeilingMicros) return { ok: false, reason: "daily_ceiling" };
  if (spend.month_micros >= settings.agentMonthlyCeilingMicros) return { ok: false, reason: "monthly_ceiling" };
  return { ok: true };
}

/** 55P03 lock_not_available (lock_timeout) or 57014 query_canceled (statement_timeout). */
function isTimeout(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e.code === "55P03" || e.code === "57014");
}

/** chargeStep's one transaction; returns day and month spend read under the lock. */
async function chargeTx(
  userId: string,
  runId: string,
  runMatches: boolean,
  s: { costMicros: number; inputTokens: number; outputTokens: number },
): Promise<z.infer<typeof spendRowSchema>> {
  return serviceSql.begin(async (tx) => {
    await acquireLifecycleGate(tx);
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${spendLockKey(userId)}, 0))`;
    await tx`
      INSERT INTO usage_counters (user_id, day, kind, n)
      VALUES (${userId}::uuid, (now() AT TIME ZONE 'utc')::date, ${USAGE_KIND_AGENT}, ${s.costMicros})
      ON CONFLICT (user_id, day, kind) DO UPDATE SET n = usage_counters.n + EXCLUDED.n
    `;
    if (runMatches) {
      await tx`
        UPDATE agent_runs
        SET cost_micros = cost_micros + ${s.costMicros},
            input_tokens = input_tokens + ${s.inputTokens},
            output_tokens = output_tokens + ${s.outputTokens},
            steps = steps + 1
        WHERE id = ${runId}::uuid AND user_id = ${userId}::uuid AND status = 'running'
      `;
    }
    const rows = await tx`
      SELECT
        COALESCE(SUM(n) FILTER (WHERE day = (now() AT TIME ZONE 'utc')::date), 0) AS day_micros,
        COALESCE(SUM(n), 0) AS month_micros
      FROM usage_counters
      WHERE user_id = ${userId}::uuid
        AND kind = ${USAGE_KIND_AGENT}
        AND day >= date_trunc('month', (now() AT TIME ZONE 'utc'))::date
    `;
    const row = parseOrNull(spendRowSchema, rows[0]);
    if (!row) throw new Error("agent: spend read returned an unexpected row");
    return row;
  });
}

type FinalStatus = Exclude<RunStatus, "pending" | "running">;
const FINAL_STATUSES: ReadonlySet<string> = new Set<FinalStatus>(["done", "failed", "aborted", "over_budget"]);

// agent_runs.error is exported to the user, so it holds a short code only (migration 17).
const ERROR_CODE_RE = /^[a-z][a-z0-9_]{0,63}$/;

/**
 * Moves a running run to a final status. Status change only (and finished_at, and a
 * short error code); it moves no money. A run that is not `running`, or not this
 * user's, is left unchanged, so a second call is a no-op. An error that is not a short
 * snake_case code is stored as `unknown_error`, never as free text.
 */
export async function finishRun(
  userId: string,
  runId: string,
  o: { status: FinalStatus; error?: string },
): Promise<void> {
  if (!FINAL_STATUSES.has(o.status)) throw new Error("agent: finishRun needs a final status");
  if (!UUID_RE.test(runId)) return;
  const error = o.error === undefined ? null : ERROR_CODE_RE.test(o.error) ? o.error : "unknown_error";
  await serviceSql`
    UPDATE agent_runs SET status = ${o.status}, error = ${error}, finished_at = now()
    WHERE id = ${runId}::uuid AND user_id = ${userId}::uuid AND status = 'running'
  `;
}

/**
 * Records a call that is not a turn (image reading, transcription) as a one-step run
 * with no thread: startRun, chargeStep, finishRun. The run ends `done`, or
 * `over_budget` when the charge reached a ceiling.
 */
export async function chargeFlat(
  userId: string,
  a: { kind: "vision" | "transcription"; model: string; costMicros: number },
): Promise<{ ok: boolean }> {
  const runId = await startRun(userId, { threadId: null, kind: a.kind, model: a.model, variant: null });
  try {
    const charged = await chargeStep(userId, runId, { costMicros: a.costMicros, inputTokens: 0, outputTokens: 0 });
    await finishRun(userId, runId, { status: charged.ok ? "done" : "over_budget" });
    return { ok: charged.ok };
  } catch (e) {
    await finishRun(userId, runId, { status: "failed", error: "charge_failed" });
    throw e;
  }
}

const SAVE_MAX_MESSAGES = 50;
const SAVE_MAX_BYTES = 1_000_000;

/**
 * Stores messages for the thread, upserting by (thread_id, id). Each message is
 * redacted (redactForStorage) and must pass StoredMessageSchema, so loadMessages can
 * read back everything stored. A `pending` write never overwrites a `complete` row, so
 * a late pending-row hedge cannot turn a finished turn back into an interrupted one
 * (PR C batch 2 review M3). At most 50 messages and 1 MB of parts per call. Bumps
 * agent_threads.updated_at. Service-only because stored history carries tool-approval
 * state and is fed back to the model as trusted history.
 */
export async function saveMessages(
  userId: string,
  threadId: string,
  messages: AgentUIMessage[],
  status: MessageStatus,
): Promise<void> {
  if (!MESSAGE_STATUSES.includes(status)) throw new Error("agent: bad message status");
  assertUuid(threadId, "thread");
  if (messages.length > SAVE_MAX_MESSAGES) throw new Error(`agent: at most ${SAVE_MAX_MESSAGES} messages per save`);
  const rows = messages.map((m) => {
    const redacted = redactForStorage(m);
    const parsed = StoredMessageSchema.safeParse({ id: redacted.id, role: redacted.role, parts: redacted.parts, status });
    if (!parsed.success) throw new Error("agent: a message does not match the stored-message schema");
    return { id: parsed.data.id, role: parsed.data.role, partsJson: JSON.stringify(parsed.data.parts) };
  });
  const bytes = rows.reduce((n, r) => n + Buffer.byteLength(r.partsJson, "utf8"), 0);
  if (bytes > SAVE_MAX_BYTES) throw new Error("agent: messages exceed 1 MB per save");

  // `::text::jsonb`: the parameter is typed text, so postgres.js sends the JSON text as
  // is and Postgres parses it. A bare `::jsonb` types the parameter jsonb, and
  // postgres.js then JSON-encodes the string again, storing a jsonb string scalar.
  await serviceSql.begin(async (tx) => {
    const owned = await tx`
      SELECT 1 FROM agent_threads WHERE id = ${threadId}::uuid AND user_id = ${userId}::uuid FOR UPDATE
    `;
    if (owned.length === 0) throw new Error("agent: thread not found");
    for (const r of rows) {
      await tx`
        INSERT INTO agent_messages (thread_id, id, user_id, role, parts, status)
        VALUES (${threadId}::uuid, ${r.id}, ${userId}::uuid, ${r.role}, ${r.partsJson}::text::jsonb, ${status})
        ON CONFLICT (thread_id, id) DO UPDATE SET parts = EXCLUDED.parts, status = EXCLUDED.status
        WHERE agent_messages.user_id = EXCLUDED.user_id
          AND NOT (agent_messages.status = 'complete' AND EXCLUDED.status = 'pending')
      `;
    }
    await tx`UPDATE agent_threads SET updated_at = now() WHERE id = ${threadId}::uuid AND user_id = ${userId}::uuid`;
  });
}
