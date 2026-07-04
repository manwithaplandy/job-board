import Stripe from "stripe";
import type { Plan } from "@/lib/entitlements";

// Lazy singleton so importing this module (e.g. in a route that also serves GET, or
// in a test) never requires STRIPE_SECRET_KEY at load time — only the first API call
// does. Stripe covers PCI; we store only ids + status (see lib/subscriptions.ts).
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    // No explicit apiVersion → the installed SDK's pinned default.
    _stripe = new Stripe(key);
  }
  return _stripe;
}

// Env is read at CALL time (not module load) so tests can set the vars per-case and
// the values aren't frozen at import.
export function planToPrice(plan: Plan): string | undefined {
  return plan === "standard"
    ? process.env.STRIPE_PRICE_STANDARD
    : process.env.STRIPE_PRICE_PRO;
}

/** Reverse lookup: a Stripe price id → our plan, or null if it's neither. */
export function priceToPlan(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STANDARD) return "standard";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return null;
}

// A Stripe Subscription's renewal timestamp. It lived at the top level historically
// and moved onto the line item in the 2025-03 API; read either so we don't depend on
// the pinned version. Returns a Date or null.
export function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const top = (sub as unknown as { current_period_end?: number }).current_period_end;
  const item = sub.items?.data?.[0] as { current_period_end?: number } | undefined;
  const ts = top ?? item?.current_period_end;
  return typeof ts === "number" ? new Date(ts * 1000) : null;
}

/** The plan a subscription is on, from its first item's price id. */
export function subscriptionPlan(sub: Stripe.Subscription): Plan | null {
  return priceToPlan(sub.items?.data?.[0]?.price?.id);
}
