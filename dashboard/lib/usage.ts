import { serviceSql, withUserSql } from "@/lib/db";
import type { Sql, TransactionSql } from "postgres";
import { getViewerPlan } from "@/lib/subscriptions";
import { monthlyAllowance, PLAN_LABEL, type Plan } from "@/lib/entitlements";
import { loadTierConfig } from "@/lib/tierConfig";

// Monthly generation-allowance enforcement (spec subsystem D / scope item 3). Reuses
// the Phase-0 usage_counters table (kinds 'resume' / 'cover'); "this month" = SUM over
// the current UTC month, matching the reviewer's UTC-day convention (reviewer/db.py).
// Cheap by design — the counter is an abuse cap, not a margin lever (generation is
// 1–3% of cost).
//
// COST INTEGRITY (finding B-COST): usage_counters WRITES run as the service role
// (serviceSql), never as `authenticated`. Users have SELECT-only on the table (see the
// grant block in schema.sql + migrations/2026-07-04-cost-cap-hardening.sql), so they
// cannot PATCH/DELETE their own counter to reset the monthly allowance or the daily
// review budget via the Supabase Data API. serviceSql bypasses RLS but always sets the
// row's user_id explicitly, so the charge lands on the right tenant. Budget READS stay
// on withUserSql (RLS-scoped). This is the sole justification for importing serviceSql
// here — see lib/serviceRoleAllowlist.test.ts.

export type GenerationKind = "resume" | "cover";

const KIND_LABEL: Record<GenerationKind, string> = {
  resume: "résumé",
  cover: "cover letter",
};

// UTC month start, mirroring reviewer/db.py's `(now() AT TIME ZONE 'utc')::date` day clock.
const _UTC_MONTH_START = "date_trunc('month', (now() AT TIME ZONE 'utc'))::date";

/** Jobs of `kind` already charged to this user this UTC month. Runs on the caller's executor. */
export async function monthlyGenerationSpend(
  tx: Sql | TransactionSql,
  userId: string,
  kind: GenerationKind,
): Promise<number> {
  const rows = await tx.unsafe(
    `SELECT COALESCE(SUM(n), 0)::int AS n FROM usage_counters
     WHERE user_id = $1::uuid AND kind = $2 AND day >= ${_UTC_MONTH_START}`,
    [userId, kind],
  );
  return ((rows[0] as unknown as { n: number } | undefined)?.n) ?? 0;
}

/** Charge +1 of `kind` to today's UTC row (upsert in place). Runs on the caller's executor. */
export async function chargeGeneration(
  tx: Sql | TransactionSql,
  userId: string,
  kind: GenerationKind,
): Promise<void> {
  await tx.unsafe(
    `INSERT INTO usage_counters (user_id, day, kind, n)
     VALUES ($1::uuid, (now() AT TIME ZONE 'utc')::date, $2, 1)
     ON CONFLICT (user_id, day, kind) DO UPDATE SET n = usage_counters.n + 1`,
    [userId, kind],
  );
}

export type AllowanceGate =
  | { ok: true; plan: Plan }
  | { ok: false; status: 402 | 429; error: string };

/**
 * Gate a generation BEFORE any LLM call. Resolves the viewer's plan (null → 402
 * subscribe), then checks each requested kind's monthly spend against the tier
 * allowance (exhausted → 429 naming used/limit and the tier). Reads under the
 * viewer's RLS context.
 */
export async function checkGenerationAllowance(
  userId: string,
  email: string | null,
  kinds: GenerationKind[],
): Promise<AllowanceGate> {
  const plan = await getViewerPlan(userId, email);
  if (!plan) {
    return { ok: false, status: 402, error: "Subscribe to generate résumés and cover letters." };
  }
  // DB-overlaid allowances (T1): tunable without a redeploy via tier_settings.
  const { entitlements } = await loadTierConfig();
  return withUserSql(userId, async (tx) => {
    for (const kind of kinds) {
      const used = await monthlyGenerationSpend(tx, userId, kind);
      const limit = monthlyAllowance(plan, kind, entitlements);
      if (used >= limit) {
        return {
          ok: false as const,
          status: 429 as const,
          error: `Monthly ${KIND_LABEL[kind]} allowance used (${used}/${limit} on ${PLAN_LABEL[plan]}).`,
        };
      }
    }
    return { ok: true as const, plan };
  });
}

/**
 * Charge the given kinds (each +1) after a successful generation+persist. Runs on the
 * service role (serviceSql), NOT the user's `authenticated` role — users have
 * SELECT-only on usage_counters, so the counter can only ever be incremented by the
 * server, never zeroed by a user's own Data-API write (finding B-COST).
 */
export async function chargeGenerations(userId: string, kinds: GenerationKind[]): Promise<void> {
  for (const kind of kinds) await chargeGeneration(serviceSql, userId, kind);
}
