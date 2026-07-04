import { withUserSql } from "@/lib/db";
import type { Sql, TransactionSql } from "postgres";
import { resolvePlan, type Plan } from "@/lib/entitlements";
import { isInvitedUser } from "@/lib/invites";

// The local mirror of Stripe truth (subsystem C). The Stripe webhook is the SOLE
// writer (service role); everything else reads the viewer's own row under RLS.
export interface SubscriptionRow {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: Plan | null;
  status: string;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
}

export async function getSubscription(userId: string): Promise<SubscriptionRow | null> {
  return withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT user_id, stripe_customer_id, stripe_subscription_id, plan, status,
             current_period_end, cancel_at_period_end
      FROM subscriptions WHERE user_id = ${userId}::uuid
    `;
    return (rows[0] as unknown as SubscriptionRow) ?? null;
  });
}

/**
 * The viewer's effective plan — the ONE helper every gate (reviewer excepted; it
 * has its own Python resolver) calls. Composes the subscription mirror + the
 * server-side invite proof through resolvePlan (T6): a paying subscriber gets their
 * plan, a comped Phase-0 invitee gets Standard, everyone else gets null.
 */
export async function getViewerPlan(userId: string, email: string | null): Promise<Plan | null> {
  const [sub, invited] = await Promise.all([
    getSubscription(userId),
    email ? isInvitedUser(email) : Promise.resolve(false),
  ]);
  return resolvePlan(sub, invited);
}

/**
 * Upsert the subscription mirror from a Stripe event. The executor is PASSED IN (the
 * webhook route supplies serviceSql — this file stays off the service-role allowlist).
 * Keyed by user_id; idempotent, so duplicate/out-of-order webhook deliveries are safe.
 * subscription.deleted maps to status='canceled' and NEVER deletes the row.
 */
export async function upsertSubscription(
  tx: Sql | TransactionSql,
  row: {
    userId: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    plan: Plan | null;
    status: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  },
): Promise<void> {
  await tx`
    INSERT INTO subscriptions (
      user_id, stripe_customer_id, stripe_subscription_id, plan, status,
      current_period_end, cancel_at_period_end, updated_at
    ) VALUES (
      ${row.userId}::uuid, ${row.stripeCustomerId}, ${row.stripeSubscriptionId},
      ${row.plan}, ${row.status}, ${row.currentPeriodEnd}, ${row.cancelAtPeriodEnd}, now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id     = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
      stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
      plan                   = COALESCE(EXCLUDED.plan, subscriptions.plan),
      status                 = EXCLUDED.status,
      current_period_end     = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
      cancel_at_period_end   = EXCLUDED.cancel_at_period_end,
      updated_at             = now()
  `;
}
