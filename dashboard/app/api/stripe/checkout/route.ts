import { getUserClaims } from "@/lib/auth";
import { getStripe, planToPrice } from "@/lib/stripe";
import { getSubscription } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

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
  let customerId = sub?.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: claims.email ?? undefined,
      metadata: { user_id: claims.id },
    });
    customerId = customer.id;
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
    success_url: `${siteUrl}/billing?status=success`,
    cancel_url: `${siteUrl}/billing`,
  });

  return Response.json({ url: session.url });
}
