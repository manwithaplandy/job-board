// The scoped re-review queue, dashboard side (plan Task 1.9, spec decision 16).
//
// An approved memo change rewrites profiles.instructions, which changes
// profile_version and so makes every reviewed job due again under the daily cap. The
// reviewer worker instead re-reviews a scope first: the user's shortlist (every state
// but skipped) plus the newest reviewed jobs, enqueued here as one
// review_scope_requests row. The insert runs as the user (withUserSql, RLS): the
// table's INSERT policy admits only a fresh pending row for the caller, and its
// one_active_review_scope_request index allows one active request per user, so a
// second enqueue while one is pending or running is "already_active". The table has
// no lifecycle trigger, so it does not need withUserMutation's gate.
//
// The worker filters the list again (gone, closed, denied and fresh jobs drop out),
// so the scope here only has to be the right set, not a promise of work.
import { z } from "zod";
import { withUserSql } from "@/lib/db";
import { JOB_ID_RE } from "@/lib/jobIdValidator";
import { parseOrNull } from "@/lib/zodParse";

/** The newest reviewed jobs (by first_seen_at) added to the shortlist part of a scope. */
export const SCOPE_NEWEST_CAP = 50;
/** review_scope_requests.job_ids holds 1 to 200 ids (a CHECK on the table). */
export const SCOPE_MAX = 200;

export type EnqueueScopeResult = "queued" | "already_active" | "empty";

const jobIdRowSchema = z.object({ job_id: z.string().regex(JOB_ID_RE) });
// id is bigint: postgres.js returns it as a string.
const insertedRowSchema = z.object({ id: z.coerce.number().int().positive() });

/** Distinct well-formed job ids in first-seen order, at most SCOPE_MAX of them. */
function scopeIds(ids: Iterable<unknown>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string" || !JOB_ID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length === SCOPE_MAX) break;
  }
  return out;
}

function rowIds(rows: Iterable<unknown>): string[] {
  const out: string[] = [];
  for (const raw of rows) {
    const row = parseOrNull(jobIdRowSchema, raw);
    if (row) out.push(row.job_id);
  }
  return out;
}

/**
 * The jobs to re-review after the caller's memo changed: every shortlist row that is
 * not skipped (most recently changed first), then the SCOPE_NEWEST_CAP newest reviewed
 * jobs by first_seen_at that have no shortlist row and are not denied. Closed jobs are
 * left out of both. Deduplicated, at most SCOPE_MAX ids; empty when there is nothing.
 */
export async function reviewScopeForMemoChange(userId: string): Promise<string[]> {
  const [shortlisted, newest] = await withUserSql(userId, async (tx) => [
    await tx`
      SELECT s.job_id
      FROM shortlist_items s
      JOIN jobs j ON j.id = s.job_id
      WHERE s.user_id = ${userId}::uuid AND s.state <> 'skipped'
        AND (public.lifecycle_source_closed(j.id, j.closed_at)) IS NOT TRUE
      ORDER BY s.updated_at DESC, s.job_id
      LIMIT ${SCOPE_MAX}`,
    await tx`
      SELECT r.job_id
      FROM job_reviews r
      JOIN jobs j ON j.id = r.job_id
      WHERE r.user_id = ${userId}::uuid
        AND r.verdict IS DISTINCT FROM 'deny'
        AND (public.lifecycle_source_closed(j.id, j.closed_at)) IS NOT TRUE
        AND NOT EXISTS (
          SELECT 1 FROM shortlist_items s WHERE s.user_id = r.user_id AND s.job_id = r.job_id)
      ORDER BY j.first_seen_at DESC, j.id
      LIMIT ${SCOPE_NEWEST_CAP}`,
  ]);
  return scopeIds([...rowIds(shortlisted), ...rowIds(newest)]);
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && e.code === "23505";
}

/**
 * Enqueues one scoped re-review of `jobIds` for the caller. "empty" (nothing written)
 * when no well-formed id is left; "already_active" when the caller already has a
 * pending or running request (the unique index's 23505); "queued" otherwise. Ids are
 * deduplicated and cut to SCOPE_MAX. Any other database error is thrown.
 */
export async function enqueueScopedReview(userId: string, jobIds: string[]): Promise<EnqueueScopeResult> {
  const ids = scopeIds(jobIds);
  if (ids.length === 0) return "empty";
  try {
    const rows = await withUserSql(userId, (tx) => tx`
      INSERT INTO review_scope_requests (user_id, job_ids, reason)
      VALUES (${userId}::uuid, ${ids}::text[], 'memo_change')
      RETURNING id`);
    if (!parseOrNull(insertedRowSchema, rows[0])) throw new Error("reviewScope: the new request failed the parse");
    return "queued";
  } catch (e) {
    if (isUniqueViolation(e)) return "already_active";
    throw e;
  }
}
