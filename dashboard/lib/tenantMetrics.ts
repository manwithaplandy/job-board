// ─────────────────────────────────────────────────────────────────────────────
// serviceSql JUSTIFICATION (RLS-bypass allowlist — lib/serviceRoleAllowlist.test.ts):
// Per-tenant monitoring (T8, spec G) is a LEGITIMATELY CROSS-TENANT read: the operator
// needs one aggregate view of every tenant's plan, spend proxy, and pipeline health.
// RLS (the authenticated role) would restrict it to the operator's own rows, so this
// path must use the privileged role. It is imported ONLY by app/admin/tenants/page.tsx,
// which gates on isAdmin(claims) (lib/admin.ts) before rendering — a non-admin gets
// notFound(), never data.
// ─────────────────────────────────────────────────────────────────────────────
import { serviceSql } from "@/lib/db";
import { resolvePlan, type Plan } from "@/lib/entitlements";

// Blended cheap-model cost per reviewed job (spec 2026-07-03 Economics: gate + 0.235 ×
// stage2 on deepseek). A coarse cost proxy so a runaway tenant stands out — NOT billing.
export const BLENDED_COST_PER_REVIEW_USD = 0.000184;

export interface TenantMetric {
  userId: string;
  email: string | null;
  plan: Plan | null; // effective plan (subscription or comped-invite)
  subStatus: string | null;
  currentPeriodEnd: Date | null;
  invited: boolean;
  reviewsToday: number;
  reviews30d: number;
  resumeMonth: number;
  coverMonth: number;
  lastRunAt: Date | null;
  lastRunErrors: number | null;
  activeRequests: number;
  failedRequests: number;
  profileUpdatedAt: Date | null;
  estCost30dUsd: number;
}

interface Row {
  user_id: string;
  email: string | null;
  plan: string | null;
  status: string | null;
  current_period_end: Date | null;
  invited: boolean;
  reviews_today: number;
  reviews_30d: number;
  resume_month: number;
  cover_month: number;
  last_run_at: Date | null;
  last_run_errors: number | null;
  active_requests: number;
  failed_requests: number;
  profile_updated_at: Date | null;
}

// One aggregate pass per metric group (CTEs), then a single join over profiles — no
// N+1 per tenant. Anchored on profiles; a subscription/invite without a profile is a
// pre-onboarding account and intentionally not shown.
const _SQL = `
WITH usage AS (
  SELECT user_id,
    COALESCE(SUM(n) FILTER (WHERE kind='review' AND day = (now() AT TIME ZONE 'utc')::date), 0) AS reviews_today,
    COALESCE(SUM(n) FILTER (WHERE kind='review' AND day >= (now() AT TIME ZONE 'utc')::date - 29), 0) AS reviews_30d,
    COALESCE(SUM(n) FILTER (WHERE kind='resume' AND day >= date_trunc('month', (now() AT TIME ZONE 'utc'))::date), 0) AS resume_month,
    COALESCE(SUM(n) FILTER (WHERE kind='cover'  AND day >= date_trunc('month', (now() AT TIME ZONE 'utc'))::date), 0) AS cover_month
  FROM usage_counters GROUP BY user_id
),
last_run AS (
  SELECT DISTINCT ON (user_id) user_id, finished_at, errors
  FROM review_runs WHERE user_id IS NOT NULL
  ORDER BY user_id, started_at DESC
),
reqs AS (
  SELECT user_id,
    COUNT(*) FILTER (WHERE status IN ('pending','running')) AS active_requests,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_requests
  FROM review_requests GROUP BY user_id
),
inv AS (
  SELECT user_id, MIN(email) AS email FROM invite_redemptions WHERE user_id IS NOT NULL GROUP BY user_id
)
SELECT
  p.user_id,
  COALESCE(p.email, inv.email) AS email,
  s.plan, s.status, s.current_period_end,
  (inv.user_id IS NOT NULL) AS invited,
  COALESCE(u.reviews_today, 0)::int AS reviews_today,
  COALESCE(u.reviews_30d, 0)::int   AS reviews_30d,
  COALESCE(u.resume_month, 0)::int  AS resume_month,
  COALESCE(u.cover_month, 0)::int   AS cover_month,
  lr.finished_at AS last_run_at,
  lr.errors      AS last_run_errors,
  COALESCE(r.active_requests, 0)::int AS active_requests,
  COALESCE(r.failed_requests, 0)::int AS failed_requests,
  p.updated_at   AS profile_updated_at
FROM profiles p
LEFT JOIN subscriptions s ON s.user_id = p.user_id
LEFT JOIN usage u  ON u.user_id = p.user_id
LEFT JOIN last_run lr ON lr.user_id = p.user_id
LEFT JOIN reqs r   ON r.user_id = p.user_id
LEFT JOIN inv      ON inv.user_id = p.user_id
ORDER BY reviews_30d DESC, profile_updated_at DESC NULLS LAST
`;

/** Every tenant's plan, usage, spend proxy, and pipeline health (operator-only). */
export async function getTenantMetrics(): Promise<TenantMetric[]> {
  const rows = (await serviceSql.unsafe(_SQL)) as unknown as Row[];
  return rows.map((r) => {
    const plan = resolvePlan(
      { plan: r.plan, status: r.status, current_period_end: r.current_period_end },
      r.invited,
    );
    return {
      userId: r.user_id,
      email: r.email,
      plan,
      subStatus: r.status,
      currentPeriodEnd: r.current_period_end,
      invited: r.invited,
      reviewsToday: r.reviews_today,
      reviews30d: r.reviews_30d,
      resumeMonth: r.resume_month,
      coverMonth: r.cover_month,
      lastRunAt: r.last_run_at,
      lastRunErrors: r.last_run_errors,
      activeRequests: r.active_requests,
      failedRequests: r.failed_requests,
      profileUpdatedAt: r.profile_updated_at,
      estCost30dUsd: r.reviews_30d * BLENDED_COST_PER_REVIEW_USD,
    };
  });
}
