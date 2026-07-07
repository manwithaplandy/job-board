import { withUserSql } from "@/lib/db";
import {
  parseGenerationJob,
  type GenerationJobKind,
  type GenerationJobView,
} from "@/lib/generationJobCodec";

// Data layer for generation_jobs (async background generation tracking — see
// migrations/2026-07-05-generation-jobs.sql). Lifecycle:
//   1. a generate route RESERVES allowance, then createGenerationJob() → 'pending'
//      and returns 202;
//   2. the route's `after()` callback runs the LLM work and settleGenerationJob()s
//      the row to 'ready'/'failed' (refunding allowance on failure BEFORE settling,
//      so the money invariant survives a crash between the two writes);
//   3. the client polls listGenerationActivity() via GET /api/generations and
//      toasts settled rows.
//
// Everything runs through withUserSql (owner-scoped RLS): a user can only ever
// see or touch their own rows, and nothing here reads or writes usage_counters —
// charges/refunds stay in lib/usage.ts on the service role.

// How long a settled row stays visible to the poll. Long enough that a client
// that was closed mid-generation still surfaces the completion on its next
// mount; short enough that ancient completions never re-toast (the client also
// de-dupes via localStorage).
const RECENT_WINDOW = "10 minutes";

// All queries return rows through the total parser (dashboard/CLAUDE.md boundary
// rule); a row that fails to parse is a bug or a manual write — drop it rather
// than let a bad shape reach the client.
const SELECT_COLS = "id, job_id, kind, status, error, created_at, updated_at";

export type CreatedGenerationJob = {
  /** false = an identical pending row already existed (double-submit) — the
   *  caller must NOT start new background work or keep its extra reservation. */
  created: boolean;
  job: GenerationJobView;
};

/**
 * Insert the 'pending' tracking row for an accepted generation. The partial
 * unique index (one pending per user/job/kind) makes concurrent double-submits
 * converge: the loser gets `created: false` plus the winner's row.
 */
export async function createGenerationJob(
  userId: string,
  jobId: string,
  kind: GenerationJobKind,
): Promise<CreatedGenerationJob> {
  return withUserSql(userId, async (tx) => {
    // Housekeeping: settled rows are only useful within RECENT_WINDOW; prune the
    // viewer's stale ones here (write path) so the table never needs a cron.
    await tx`
      DELETE FROM generation_jobs
      WHERE user_id = ${userId}::uuid AND status <> 'pending'
        AND updated_at < now() - interval '1 day'
    `;
    const inserted = await tx.unsafe(
      `INSERT INTO generation_jobs (user_id, job_id, kind)
       VALUES ($1::uuid, $2, $3)
       ON CONFLICT (user_id, job_id, kind) WHERE status = 'pending' DO NOTHING
       RETURNING ${SELECT_COLS}`,
      [userId, jobId, kind],
    );
    if (inserted.length > 0) {
      const job = parseGenerationJob(inserted[0]);
      if (!job) throw new Error("generation job row failed to parse after insert");
      return { created: true, job };
    }
    // Conflict: an identical pending row exists — hand it back so the route can
    // 202 idempotently. (If it settled in the microseconds since the conflict,
    // fail loud; the route refunds and reports.)
    const existing = await tx.unsafe(
      `SELECT ${SELECT_COLS} FROM generation_jobs
       WHERE user_id = $1::uuid AND job_id = $2 AND kind = $3 AND status = 'pending'`,
      [userId, jobId, kind],
    );
    const job = existing.length > 0 ? parseGenerationJob(existing[0]) : null;
    if (!job) throw new Error("generation job insert conflicted but no pending row found");
    return { created: false, job };
  });
}

/**
 * Settle a pending row to its terminal status. `error` must already be the
 * USER-SAFE message (the routes map raw failures before calling). The
 * status='pending' guard makes settling idempotent — a row the staleness sweep
 * already failed is never flipped back.
 */
export async function settleGenerationJob(
  userId: string,
  id: string,
  outcome: { status: "ready" | "failed"; error?: string | null },
): Promise<void> {
  await withUserSql(userId, (tx) => tx`
    UPDATE generation_jobs
    SET status = ${outcome.status}, error = ${outcome.error ?? null}, updated_at = now()
    WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND status = 'pending'
  `);
}

/**
 * The poll payload: every pending row plus rows settled within RECENT_WINDOW,
 * joined with jobs/companies for toast copy. Also sweeps pending rows that
 * outlived any possible invocation (maxDuration is 300s; 10 minutes means the
 * instance died) to 'failed', so a vaporized background run can't leave the
 * client polling forever. The sweep deliberately does NOT refund allowance:
 * refunds are the background catch's job, and rows are user-writable under RLS,
 * so a sweep-triggered refund would let a hand-inserted backdated row mint free
 * allowance. An instance death therefore burns the slot — exactly as it did in
 * the old blocking model, where a killed invocation never reached its refund.
 */
export async function listGenerationActivity(userId: string): Promise<GenerationJobView[]> {
  return withUserSql(userId, async (tx) => {
    await tx.unsafe(
      `UPDATE generation_jobs
       SET status = 'failed', error = 'Generation timed out — please try again.',
           updated_at = now()
       WHERE user_id = $1::uuid AND status = 'pending'
         AND created_at < now() - interval '${RECENT_WINDOW}'`,
      [userId],
    );
    const rows = await tx.unsafe(
      `SELECT g.id, g.job_id, g.kind, g.status, g.error, g.created_at, g.updated_at,
              j.title AS job_title, COALESCE(c.display_name, c.name) AS company
       FROM generation_jobs g
       LEFT JOIN jobs j ON j.id = g.job_id
       LEFT JOIN companies c ON c.id = j.company_id
       WHERE g.user_id = $1::uuid
         AND (g.status = 'pending' OR g.updated_at > now() - interval '${RECENT_WINDOW}')
       ORDER BY g.created_at`,
      [userId],
    );
    return (rows as unknown as Record<string, unknown>[])
      .map(parseGenerationJob)
      .filter((j): j is GenerationJobView => j !== null);
  });
}
