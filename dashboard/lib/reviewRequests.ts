import { withUserSql } from "@/lib/db";
import { resolveStage2Model, dailyReviewCap, type Plan } from "@/lib/entitlements";
import { loadTierConfig } from "@/lib/tierConfig";

// The dashboard ↔ reviewer-worker contract for on-demand "review my board now"
// (spec F core). Precedent: discovery_state.resume_requested_at. The partial unique
// index one_active_review_request enforces one active (pending|running) request per
// user; the enqueue path treats its 23505 as idempotent success.

export type ReviewRequestStatus = "pending" | "running" | "done" | "failed";

export interface ReviewRequestRow {
  id: number;
  user_id: string;
  status: ReviewRequestStatus;
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
  notes: string | null;
}

/** Newest request for the user (any status), or null. */
export async function getLatestReviewRequest(userId: string): Promise<ReviewRequestRow | null> {
  return withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT id, user_id, status, requested_at, started_at, finished_at, notes
      FROM review_requests WHERE user_id = ${userId}::uuid
      ORDER BY requested_at DESC LIMIT 1
    `;
    return (rows[0] as unknown as ReviewRequestRow) ?? null;
  });
}

async function getActiveReviewRequest(userId: string): Promise<ReviewRequestRow | null> {
  return withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT id, user_id, status, requested_at, started_at, finished_at, notes
      FROM review_requests
      WHERE user_id = ${userId}::uuid AND status IN ('pending','running')
      ORDER BY requested_at DESC LIMIT 1
    `;
    return (rows[0] as unknown as ReviewRequestRow) ?? null;
  });
}

/**
 * Enqueue a pending request. Idempotent: if the user already has an active
 * (pending|running) request, the partial-unique-index violation (23505) is treated
 * as success and the existing active request is returned. The failed INSERT aborts
 * its transaction, so the existing-request read runs in a fresh one.
 */
export async function enqueueReviewRequest(
  userId: string,
): Promise<{ status: ReviewRequestStatus; existing: boolean }> {
  try {
    return await withUserSql(userId, async (tx) => {
      const rows = await tx`
        INSERT INTO review_requests (user_id, status) VALUES (${userId}::uuid, 'pending')
        RETURNING status
      `;
      return { status: (rows[0] as { status: ReviewRequestStatus }).status, existing: false };
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      const active = await getActiveReviewRequest(userId);
      return { status: active?.status ?? "pending", existing: true };
    }
    throw e;
  }
}

/**
 * Reviews charged to this user today (UTC) — the reviewer's kind='review' usage counter.
 * Used as the first-run progress figure ("N roles scored so far") the panel renders
 * while an on-demand review is running. 0 when none yet.
 */
export async function reviewsChargedToday(userId: string): Promise<number> {
  return withUserSql(userId, async (tx) => {
    const rows = await tx.unsafe(
      `SELECT COALESCE(n, 0)::int AS n FROM usage_counters
       WHERE user_id = $1::uuid AND kind = 'review' AND day = (now() AT TIME ZONE 'utc')::date`,
      [userId],
    );
    return ((rows[0] as unknown as { n: number } | undefined)?.n) ?? 0;
  });
}

/**
 * The user's remaining daily review budget: their per-model daily cap (profile
 * override, else the tier cap for their resolved stage-2 model) minus today's 'review'
 * spend (UTC). 0 when they have no plan. Mirrors the reviewer's cap computation (T8).
 */
export async function remainingDailyBudget(userId: string, plan: Plan | null): Promise<number> {
  if (!plan) return 0;
  // DB-overlaid caps (T1): tunable without a redeploy via tier_settings.
  const { entitlements } = await loadTierConfig();
  return withUserSql(userId, async (tx) => {
    const prow = await tx`
      SELECT model_stage2, daily_review_cap FROM profiles WHERE user_id = ${userId}::uuid
    `;
    const p = prow[0] as { model_stage2: string | null; daily_review_cap: number | null } | undefined;
    const model = resolveStage2Model(plan, p?.model_stage2 ?? null, entitlements);
    const cap = p?.daily_review_cap ?? dailyReviewCap(plan, model, entitlements);
    const srow = await tx.unsafe(
      `SELECT COALESCE(n, 0)::int AS n FROM usage_counters
       WHERE user_id = $1::uuid AND kind = 'review' AND day = (now() AT TIME ZONE 'utc')::date`,
      [userId],
    );
    const spent = ((srow[0] as unknown as { n: number } | undefined)?.n) ?? 0;
    return Math.max(0, cap - spent);
  });
}
