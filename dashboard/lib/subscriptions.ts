// ─────────────────────────────────────────────────────────────────────────────
// serviceSql JUSTIFICATION (RLS-bypass allowlist — lib/serviceRoleAllowlist.test.ts):
// subscriptions is service-write-only (no authenticated write policy). The Stripe
// webhook is the authoritative writer of subscription STATE; persistCheckoutCustomer
// (minor 3) additionally writes ONLY the stripe_customer_id at checkout-creation time so
// the erasure cascade can reach the Stripe customer and a re-checkout dedupes — it never
// touches plan/status/last_event_at, so the webhook stays authoritative. Both write the
// caller's OWN user_id (no cross-tenant surface). getSubscription READS stay on RLS.
// ─────────────────────────────────────────────────────────────────────────────
import { serviceSql, withUserSql } from "@/lib/db";
import type { Sql, TransactionSql } from "postgres";
import { resolvePlan, type Plan } from "@/lib/entitlements";
import { isInvitedUser } from "@/lib/invites";
import { loadAppSettings } from "@/lib/appSettings";
import { getOwnPlanOverride } from "@/lib/planOverrides";

// The local mirror of Stripe truth (subsystem C). The Stripe webhook is the SOLE
// writer of subscription STATE (service role); everything else reads the viewer's own
// row under RLS. persistCheckoutCustomer is the one exception — it fills in only the
// stripe_customer_id at checkout time (see its doc).
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
 * server-side invite proof + the operator pin (plan_overrides) through resolvePlan
 * (T6): a paying subscriber gets their plan, a comped Phase-0 invitee gets Standard,
 * everyone else gets null.
 */
export async function getViewerPlan(userId: string, email: string | null): Promise<Plan | null> {
  const [sub, invited, settings, override] = await Promise.all([
    getSubscription(userId),
    email ? isInvitedUser(email) : Promise.resolve(false),
    loadAppSettings(),
    getOwnPlanOverride(userId),
  ]);
  return resolvePlan(sub, invited, new Date(), settings.inviteCompPlan, override);
}

/**
 * Persist the Stripe customer id created during a Checkout Session, at customer-CREATION
 * time (minor 3). Without this, a user who abandons checkout leaves an orphaned Stripe
 * customer with no id→customer mapping in our DB, so the erasure cascade
 * (cancelStripeForUser) can never delete it AND a second checkout would mint a DUPLICATE
 * customer. We write ONLY the customer id: ON CONFLICT keeps any existing customer id and
 * NEVER touches plan/status/last_event_at, so the webhook stays the authoritative writer
 * of subscription state and its monotonic watermark (M-WEBHOOK-ORDER) is untouched. The
 * placeholder status 'incomplete' entitles nothing (resolvePlan → null) until a real
 * subscription event lands. Service role: subscriptions has no authenticated write policy.
 */
export async function persistCheckoutCustomer(
  userId: string,
  stripeCustomerId: string,
): Promise<void> {
  await serviceSql`
    INSERT INTO subscriptions (user_id, stripe_customer_id, status)
    VALUES (${userId}::uuid, ${stripeCustomerId}, 'incomplete')
    ON CONFLICT (user_id) DO UPDATE SET
      stripe_customer_id = COALESCE(subscriptions.stripe_customer_id, EXCLUDED.stripe_customer_id),
      updated_at = now()
  `;
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
 * PLAN IS AUTHORITATIVE, NOT COALESCED: `plan` is derived from the subscription's
 * CURRENT price on every event (subscriptionPlan → priceToPlan), so EXCLUDED.plan is
 * null ONLY when the subscription sits on a price we don't sell (a plan switch to an
 * unrecognized price, or no line item). COALESCE-ing it back to the stored plan would
 * leave a user entitled to Pro after they switched to a price outside our catalog; we
 * instead take EXCLUDED.plan verbatim so an unknown price gates the user (plan → null →
 * resolvePlan returns null). The monotonic guard below still drops stale/out-of-order
 * events entirely, so this only ever applies a fresher truth.
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
      plan                   = EXCLUDED.plan,
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
