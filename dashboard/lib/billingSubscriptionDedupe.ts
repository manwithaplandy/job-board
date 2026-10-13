import type Stripe from "stripe";

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

