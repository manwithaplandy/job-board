import { getUserClaims } from "@/lib/auth";
import { getStripe, planToPrice } from "@/lib/stripe";
import { getSubscription, persistCheckoutCustomer } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

// Stripe statuses under which a subscription is still live (being billed, or still
// entitling within grace) — a customer in any of these must NOT open a second checkout.
// canceled / incomplete_expired are terminal, so those users may re-subscribe.
const LIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

// Start a subscription Checkout Session for the signed-in user. NOT public (a
// stranger must not be able to open a checkout) — anon → 401. Reuses the stored
// Stripe customer when present so a user never accumulates duplicate customers.
export async function POST(req: Request) {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in to subscribe" }, { status: 401 });

  const { plan } = (await req.json().catch(() => ({}))) as { plan?: string };
  if (plan !== "standard" && plan !== "pro") {
    return Response.json({ error: "invalid plan" }, { status: 400 });
  }
  const price = planToPrice(plan);
  if (!price) return Response.json({ error: "billing not configured" }, { status: 500 });

  const stripe = getStripe();
  const sub = await getSubscription(claims.id);
  // Block opening a SECOND subscription for a customer who already has a live one:
  // Stripe would happily create a duplicate subscription (double-billing) on a fresh
  // checkout. A user changing plans goes through the billing portal (plan switch), not
  // a new checkout. Canceled/lapsed rows fall through so a former subscriber can
  // re-subscribe. LIVE = the statuses Stripe is still billing (or would entitle).
  if (sub && LIVE_SUBSCRIPTION_STATUSES.has(sub.status)) {
    return Response.json(
      { error: "you already have an active subscription; manage it from billing" },
      { status: 409 },
    );
  }
  let customerId = sub?.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: claims.email ?? undefined,
      metadata: { user_id: claims.id },
    });
    customerId = customer.id;
    // Persist the new customer id NOW (minor 3): if the user abandons checkout no webhook
    // fires, so without this the erasure cascade couldn't reach the orphaned Stripe
    // customer and a re-checkout would mint a duplicate. Writes only the id (webhook
    // still owns plan/status).
    await persistCheckoutCustomer(claims.id, customerId);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: claims.id,
    // user_id on BOTH the session and the created subscription so the webhook can
    // resolve the account from either the checkout.session.completed event or a bare
    // customer.subscription.* event.
    metadata: { user_id: claims.id },
    subscription_data: { metadata: { user_id: claims.id } },
    // Expire the session ~30min out (minor 3) so an abandoned checkout doesn't leave a
    // stale payable session lingering for Stripe's 24h default. 31min stays safely above
    // Stripe's 30-minute floor after request/clock skew.
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    success_url: `${siteUrl}/billing?status=success`,
    cancel_url: `${siteUrl}/billing`,
  });

  return Response.json({ url: session.url });
}
