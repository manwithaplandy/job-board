// ─────────────────────────────────────────────────────────────────────────────
// serviceSql JUSTIFICATION (RLS-bypass allowlist — lib/serviceRoleAllowlist.test.ts):
// plan_overrides is service-write-only (owner_read SELECT is its only authenticated
// policy). setPlanOverride/clearPlanOverride are the write paths, called ONLY from the
// isAdmin-gated action (app/actions/adminSettings.ts setPlanOverrideAction) — the
// operator pins ANOTHER user's tier, so the write is legitimately cross-tenant (same
// argument as lib/tenantMetrics.ts). getOwnPlanOverride READS stay on RLS (withUserSql).
// ─────────────────────────────────────────────────────────────────────────────
import { serviceSql, withUserSql } from "@/lib/db";
import type { Plan } from "@/lib/entitlements";

// Operator-pinned effective tier (spec 2026-07-16-admin-plan-override). One row per
// user; an ACTIVE row (expires_at NULL or future) wins in resolvePlan. Clearing the
// pin DELETES the row — absence is the "no override" state, so there is no
// tri-state to misread.

export interface PlanOverrideRow {
  plan: Plan;
  expires_at: Date | null;
}

/** The viewer's OWN pin (owner_read RLS) — getViewerPlan's override input. */
export async function getOwnPlanOverride(userId: string): Promise<PlanOverrideRow | null> {
  return withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT plan, expires_at FROM plan_overrides WHERE user_id = ${userId}::uuid
    `;
    return (rows[0] as unknown as PlanOverrideRow) ?? null;
  });
}

/** Pin a user's effective plan (admin). expiresAt null = pinned until cleared. */
export async function setPlanOverride(
  userId: string,
  plan: Plan,
  expiresAt: Date | null,
  note: string | null,
): Promise<void> {
  await serviceSql`
    INSERT INTO plan_overrides (user_id, plan, expires_at, note)
    VALUES (${userId}::uuid, ${plan}, ${expiresAt}, ${note})
    ON CONFLICT (user_id) DO UPDATE SET
      plan = EXCLUDED.plan, expires_at = EXCLUDED.expires_at, note = EXCLUDED.note,
      updated_at = now()
  `;
}

/** Remove the pin — resolution falls back to subscription, then invite comp. */
export async function clearPlanOverride(userId: string): Promise<void> {
  await serviceSql`DELETE FROM plan_overrides WHERE user_id = ${userId}::uuid`;
}
