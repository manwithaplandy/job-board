import { serviceSql } from "@/lib/db";
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
// row's user_id explicitly, so the charge lands on the right tenant. The atomic reserve
// (finding minor 4) reads spend in the SAME service-role transaction as the charge,
// under a per-(user,kind) advisory lock, so check-then-charge can't race. This is the
// sole justification for importing serviceSql here — see lib/serviceRoleAllowlist.test.ts.

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

// Advisory-lock key for the per-(user,kind) reserve critical section. hashtextextended
// (64-bit) not hashtext (32-bit) so distinct users can't collide onto the same lock.
const reserveLockKey = (userId: string, kind: GenerationKind) => `usage:${userId}:${kind}`;

/**
 * ATOMIC reserve-before-generate (finding minor 4 — TOCTOU). The old
 * check-then-charge (read spend → generate → increment) let N parallel requests each
 * read spend < limit and each proceed, overshooting the monthly cap. This instead
 * charges the slot UP FRONT inside one service-role transaction that:
 *   1. takes a per-(user,kind) transaction-scoped advisory lock, so concurrent reserves
 *      for the same user+kind serialize;
 *   2. re-reads month-to-date spend UNDER the lock and, only if still < limit, charges +1.
 * All-or-nothing across kinds: if ANY requested kind is exhausted, nothing is charged
 * (the transaction commits having only held locks). The caller REFUNDS on a failed
 * generation (refundGenerations), preserving "a failed generation never burns allowance".
 *
 * WRITES run as the service role (serviceSql) — users are SELECT-only on usage_counters
 * (B-COST), so the reserve can't be self-zeroed via the Data API. Reads happen in the
 * same transaction (service role, scoped by explicit user_id); the atomicity the lock
 * provides is why the read no longer needs the viewer's RLS role.
 */
export async function reserveGenerations(
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
  return serviceSql.begin(async (tx) => {
    // Lock every requested kind first, then check ALL under the locks before charging any
    // — so a dual-kind reserve is all-or-nothing and never charges a partially-exhausted set.
    for (const kind of kinds) {
      await tx.unsafe(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [reserveLockKey(userId, kind)]);
    }
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
    for (const kind of kinds) await chargeGeneration(tx, userId, kind);
    return { ok: true as const, plan };
  });
}

/**
 * Refund reserved slots (each −1 on today's UTC row) when a generation the caller
 * reserved for fails to produce+persist — so a failed generation never burns allowance
 * (T9), while the reserve above stays atomic. GREATEST(n-1,0) guards against underflow.
 * Service role (users are SELECT-only on usage_counters, B-COST).
 */
export async function refundGenerations(userId: string, kinds: GenerationKind[]): Promise<void> {
  for (const kind of kinds) {
    await serviceSql.unsafe(
      `UPDATE usage_counters SET n = GREATEST(n - 1, 0)
       WHERE user_id = $1::uuid AND day = (now() AT TIME ZONE 'utc')::date AND kind = $2`,
      [userId, kind],
    );
  }
}
