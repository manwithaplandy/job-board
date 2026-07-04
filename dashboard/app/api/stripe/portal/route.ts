import { getUserClaims } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { getSubscription } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

// Open the Stripe Billing Portal so the user can manage/cancel their subscription.
// NOT public — anon → 401. A user with no Stripe customer yet gets a clear 404.
export async function POST(req: Request) {
  const claims = await getUserClaims();
  if (!claims) return Response.json({ error: "sign in to manage billing" }, { status: 401 });

  const sub = await getSubscription(claims.id);
  if (!sub?.stripe_customer_id) {
    return Response.json({ error: "No billing account yet — subscribe first." }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const session = await getStripe().billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${siteUrl}/billing`,
  });

  return Response.json({ url: session.url });
}
