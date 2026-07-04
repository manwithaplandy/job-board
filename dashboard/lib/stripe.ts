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

/**
 * Cancel a Stripe subscription immediately, tolerating "already gone" (T3 deletion
 * step 1). A null/blank id is a no-op. Two flavours of "already gone" are swallowed so
 * a retry after partial failure — and, crucially, the common lapsed/canceled-subscriber
 * case — converges instead of aborting the whole account deletion:
 *   • a "resource_missing" error (the subscription id no longer exists), and
 *   • an invalid_request_error whose message says the subscription is already canceled.
 * Our webhook mirror deliberately KEEPS canceled subscriptions (customer.subscription
 * .deleted → status='canceled' with the id intact), so a canceled subscriber's row
 * still carries a real id and double-cancel returns the latter, NOT resource_missing.
 * Any other Stripe error propagates so the caller can abort before deleting DB rows.
 */
export async function cancelSubscriptionIfPresent(
  stripeSubscriptionId: string | null | undefined,
): Promise<void> {
  if (!stripeSubscriptionId) return;
  try {
    await getStripe().subscriptions.cancel(stripeSubscriptionId);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "resource_missing") return; // id gone — idempotent
    const type = (e as { type?: string }).type;
    const message = (e as { message?: string }).message ?? "";
    // Double-cancel of an already-canceled subscription: not resource_missing, but a
    // non-retryable "already canceled" — treat as already-gone so deletion proceeds.
    if (type === "invalid_request_error" && /cancel(l)?ed/i.test(message)) return;
    throw e;
  }
}

/**
 * Delete a Stripe Customer, tolerating "already gone" (T3 deletion step 1,
 * M-STRIPE-CUSTOMER). Account deletion is an ERASURE cascade, so we do not merely cancel
 * the subscription and orphan the customer — we delete the Customer object itself, which
 * removes the email/name/address PII profile Stripe holds and detaches saved payment
 * methods. (Stripe retains only its own charge/invoice accounting records, on its side,
 * for the merchant's tax compliance — deleting the Customer does not and cannot erase
 * those, and the privacy policy discloses that third-party retention.)
 *
 * A null/blank id is a no-op. A "resource_missing" error (the customer id no longer
 * exists — e.g. a retry after a partial failure, or a customer deleted out of band) is
 * swallowed so the ordered, idempotent cascade converges. Any other error propagates so
 * the caller can abort before deleting DB rows. Deleting a customer also cancels its
 * subscriptions Stripe-side, so this is safe to run after cancelSubscriptionIfPresent.
 */
export async function deleteCustomerIfPresent(
  stripeCustomerId: string | null | undefined,
): Promise<void> {
  if (!stripeCustomerId) return;
  try {
    await getStripe().customers.del(stripeCustomerId);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "resource_missing") return; // id gone — idempotent
    throw e;
  }
}
