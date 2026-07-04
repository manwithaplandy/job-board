import type Stripe from "stripe";
import { getStripe, subscriptionPeriodEnd, subscriptionPlan } from "@/lib/stripe";
import { serviceSql } from "@/lib/db";
import { upsertSubscription } from "@/lib/subscriptions";
import { isAccountDeleted } from "@/lib/tombstone";

export const dynamic = "force-dynamic";

// Stripe → subscriptions mirror. The SOLE writer of the subscriptions table.
//
// SERVICE-ROLE JUSTIFICATION (this route is on the serviceRoleAllowlist): Stripe posts
// ANONYMOUSLY (no user session/JWT), so there is no authenticated context to drop into,
// and subscriptions has no authenticated write policy by design. The request is
// authenticated instead by the Stripe webhook SIGNATURE. It reads the RAW body via
// req.text() (constructEvent needs the exact bytes) and writes via serviceSql.
// Note: '/api/stripe/webhook' is in PUBLIC_PREFIXES (lib/paths.ts) — the auth proxy
// would otherwise 307 this anonymous POST to /login.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "webhook not configured" }, { status: 500 });

  const sig = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    // Bad/missing signature — reject (never process an unverified payload).
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (e) {
    // A handler failure returns non-2xx so Stripe retries (deliveries are idempotent).
    console.error("stripe webhook handler failed", event.type, e);
    return Response.json({ error: "handler error" }, { status: 500 });
  }
  // Unrecognized event types fall through here as a 200 ack (nothing to do).
  return Response.json({ received: true });
}

// Resolve our user_id for a subscription: prefer the metadata we stamped at checkout,
// else look it up by the Stripe customer id in our mirror, else read it off the
// customer object's metadata. Returns null if truly unknowable (event is then acked).
async function resolveUserId(
  stripe: Stripe,
  customerId: string | null,
  metadataUserId: string | undefined,
): Promise<string | null> {
  if (metadataUserId) return metadataUserId;
  if (customerId) {
    const rows = await serviceSql`
      SELECT user_id FROM subscriptions WHERE stripe_customer_id = ${customerId} LIMIT 1
    `;
    const existing = rows[0] as { user_id: string } | undefined;
    if (existing) return existing.user_id;
    const customer = await stripe.customers.retrieve(customerId);
    if (!("deleted" in customer)) {
      const uid = customer.metadata?.user_id;
      if (uid) return uid;
    }
  }
  return null;
}

// Map a Stripe Subscription onto our mirror and upsert it. `deletedStatus` forces
// status='canceled' on the subscription.deleted event (the object's own status may
// still read 'active' at deletion time). `eventCreatedAt` is the source event's
// `created` timestamp — the monotonic watermark upsertSubscription uses to drop a
// stale out-of-order delivery (M-WEBHOOK-ORDER).
async function upsertFromSubscription(
  stripe: Stripe,
  sub: Stripe.Subscription,
  eventCreatedAt: Date,
  deletedStatus?: "canceled",
): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  const userId = await resolveUserId(stripe, customerId, sub.metadata?.user_id);
  if (!userId) {
    console.warn("stripe webhook: could not resolve user_id for subscription", sub.id);
    return; // ack; nothing to persist
  }
  // M-RESURRECT-1: account deletion cancels the Stripe subscription, whose
  // customer.subscription.deleted (and any late .updated) event still carries the
  // erased user's metadata user_id. Re-INSERTing the subscriptions row here would
  // resurrect a mirror row for an account that no longer exists. Ack-and-skip any
  // event whose resolved user is tombstoned (a cheap EXISTS on account_deletions).
  if (await isAccountDeleted(userId)) {
    console.warn("stripe webhook: skipping write for deleted account", userId, sub.id);
    return; // ack; the account was erased — never resurrect its subscription mirror
  }
  await upsertSubscription(serviceSql, {
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    plan: subscriptionPlan(sub),
    status: deletedStatus ?? sub.status,
    currentPeriodEnd: subscriptionPeriodEnd(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    eventCreatedAt,
  });
}

// M-DOUBLE-SUB (minor 3): if a race opened more than one subscription for a customer
// (e.g. two checkouts completing near-simultaneously), Stripe would bill both. On
// checkout.session.completed we keep the subscription THIS session created and cancel
// any OTHER active ones for the customer. Best-effort: a list/cancel failure is logged,
// never fatal — the event is still acked and the mirror already reflects the kept sub.
export async function cancelOtherActiveSubscriptions(
  stripe: Stripe,
  customerId: string | null,
  keepSubscriptionId: string,
): Promise<void> {
  if (!customerId) return;
  let subs: Stripe.ApiList<Stripe.Subscription>;
  try {
    subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 100 });
  } catch (e) {
    console.error("stripe webhook: could not list subscriptions to dedupe", customerId, e);
    return;
  }
  for (const other of subs.data) {
    if (other.id === keepSubscriptionId) continue;
    try {
      await stripe.subscriptions.cancel(other.id);
      console.warn("stripe webhook: canceled duplicate subscription", other.id, "for customer", customerId);
    } catch (e) {
      console.error("stripe webhook: failed to cancel duplicate subscription", other.id, e);
    }
  }
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  const stripe = getStripe();
  // Stripe event.created is unix SECONDS; the monotonic watermark for M-WEBHOOK-ORDER.
  const eventCreatedAt = new Date(event.created * 1000);
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
      if (!subId) return;
      const sub = await stripe.subscriptions.retrieve(subId);
      // Ensure the user_id we stamped on the session reaches upsert even if the
      // retrieved subscription's metadata is empty.
      if (!sub.metadata?.user_id && session.metadata?.user_id) {
        sub.metadata = { ...sub.metadata, user_id: session.metadata.user_id };
      }
      await upsertFromSubscription(stripe, sub, eventCreatedAt);
      // Cancel any OTHER active subscription for this customer (double-subscribe race).
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
      await cancelOtherActiveSubscriptions(stripe, customerId, sub.id);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await upsertFromSubscription(stripe, event.data.object as Stripe.Subscription, eventCreatedAt);
      return;
    }
    case "customer.subscription.deleted": {
      await upsertFromSubscription(
        stripe,
        event.data.object as Stripe.Subscription,
        eventCreatedAt,
        "canceled",
      );
      return;
    }
    // Any other event type is intentionally a no-op 200 ack.
    default:
      return;
  }
}
