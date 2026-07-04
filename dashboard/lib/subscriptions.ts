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
 *
 * M-WEBHOOK-ORDER — MONOTONIC GUARD: Stripe does not guarantee delivery order, so a
 * customer.subscription.updated generated BEFORE a cancellation can arrive AFTER the
 * customer.subscription.deleted and would otherwise flip status canceled→active (unpaid
 * access). `eventCreatedAt` is the Stripe event's own `created` timestamp; the ON CONFLICT
 * DO UPDATE only fires when the incoming event is NOT older than the last one applied
 * (`EXCLUDED.last_event_at >= subscriptions.last_event_at`). A stale event becomes a no-op;
 * a re-delivered duplicate (equal timestamp) still applies (`>=`, harmless — same values).
 * Legacy rows have last_event_at IS NULL, treated as -infinity so the first event lands.
 *
 * SAME-SECOND TIE-BREAK: event.created has 1-SECOND resolution, so an updated event
 * generated in the SAME second as the cancel (first delivery failed, retried after the
 * deleted) carries an EQUAL watermark and `>=` alone would re-apply it, flipping
 * canceled→active. A canceled subscription id is terminal in Stripe (reactivation is a
 * NEW subscription whose events carry a strictly-later `created`), so on an exact tie the
 * cancel WINS: the second predicate blocks the update when the stored row is already
 * canceled, the incoming event is not a cancel, AND the watermarks are exactly equal.
 * This is directional — the reverse (updated then deleted at the same second) still lands
 * the cancel (EXCLUDED.status = 'canceled' fails the guard), and a duplicate cancel
 * redelivery is still idempotent. `>` is NOT usable instead: it would drop an in-order
 * same-second cancellation, which is strictly worse.
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
    eventCreatedAt: Date;
  },
): Promise<void> {
  await tx`
    INSERT INTO subscriptions (
      user_id, stripe_customer_id, stripe_subscription_id, plan, status,
      current_period_end, cancel_at_period_end, last_event_at, updated_at
    ) VALUES (
      ${row.userId}::uuid, ${row.stripeCustomerId}, ${row.stripeSubscriptionId},
      ${row.plan}, ${row.status}, ${row.currentPeriodEnd}, ${row.cancelAtPeriodEnd},
      ${row.eventCreatedAt}, now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id     = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
      stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
      plan                   = COALESCE(EXCLUDED.plan, subscriptions.plan),
      status                 = EXCLUDED.status,
      current_period_end     = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
      cancel_at_period_end   = EXCLUDED.cancel_at_period_end,
      last_event_at          = EXCLUDED.last_event_at,
      updated_at             = now()
    WHERE EXCLUDED.last_event_at
        >= COALESCE(subscriptions.last_event_at, '-infinity'::timestamptz)
      AND NOT (
        subscriptions.status = 'canceled'
        AND EXCLUDED.status <> 'canceled'
        AND EXCLUDED.last_event_at = subscriptions.last_event_at
      )
  `;
}
