import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// POST /api/stripe/webhook is the SOLE writer of the subscriptions mirror and the only
// anonymous, signature-authenticated write path. We mock only true boundaries: the Stripe
// SDK (getStripe + the pure mappers), upsertSubscription, isAccountDeleted, and serviceSql
// (the customer→user mirror lookup). We assert the SIGNATURE gate, event dispatch, the
// user-id resolution ladder, the tombstone skip, and retry semantics — NOT the watermark
// logic (that lives in lib/subscriptions.test.ts).
const stripe = vi.hoisted(() => ({
  webhooks: { constructEvent: vi.fn() },
  subscriptions: { retrieve: vi.fn(), list: vi.fn(), cancel: vi.fn() },
  customers: { retrieve: vi.fn() },
}));
const mocks = vi.hoisted(() => ({
  subscriptionPlan: vi.fn(),
  subscriptionPeriodEnd: vi.fn(),
  upsertSubscription: vi.fn(),
  isAccountDeleted: vi.fn(),
  serviceSql: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => stripe,
  subscriptionPlan: mocks.subscriptionPlan,
  subscriptionPeriodEnd: mocks.subscriptionPeriodEnd,
}));
vi.mock("@/lib/subscriptions", () => ({ upsertSubscription: mocks.upsertSubscription }));
vi.mock("@/lib/tombstone", () => ({ isAccountDeleted: mocks.isAccountDeleted }));
vi.mock("@/lib/db", () => ({ serviceSql: mocks.serviceSql }));

import { POST, cancelOtherActiveSubscriptions } from "@/app/api/stripe/webhook/route";

const SECRET = "whsec_test";

function req(body: string, sig = "sig_1") {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": sig },
    body,
  });
}
// A subscription object the mappers read from.
function sub(over: Record<string, unknown> = {}) {
  return { id: "sub_1", customer: "cus_1", status: "active", metadata: {}, items: { data: [] }, cancel_at_period_end: false, ...over };
}

let warnSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
  mocks.subscriptionPlan.mockReturnValue("pro");
  mocks.subscriptionPeriodEnd.mockReturnValue(null);
  mocks.upsertSubscription.mockResolvedValue(undefined);
  mocks.isAccountDeleted.mockResolvedValue(false);
  mocks.serviceSql.mockResolvedValue([]); // mirror lookup: no existing row by default
  stripe.subscriptions.retrieve.mockResolvedValue(sub());
  stripe.subscriptions.list.mockResolvedValue({ data: [] });
  stripe.subscriptions.cancel.mockResolvedValue({});
  stripe.customers.retrieve.mockResolvedValue({ metadata: {} });
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
  errSpy.mockRestore();
  vi.unstubAllEnvs();
});

describe("signature gate", () => {
  test("STRIPE_WEBHOOK_SECRET unset → 500, signature never verified", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", undefined as unknown as string);
    const res = await POST(req("{}"));
    expect(res.status).toBe(500);
    expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
  });

  test("bad signature (constructEvent throws) → 400, no side effects", async () => {
    stripe.webhooks.constructEvent.mockImplementation(() => { throw new Error("bad sig"); });
    const res = await POST(req("raw-body"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid signature");
    expect(mocks.upsertSubscription).not.toHaveBeenCalled();
  });

  test("constructEvent is given the EXACT raw body, signature header, and secret", async () => {
    stripe.webhooks.constructEvent.mockReturnValue({ type: "ping", created: 1, data: { object: {} } });
    await POST(req("the-exact-raw-bytes", "sig_abc"));
    expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith("the-exact-raw-bytes", "sig_abc", SECRET);
  });
});

describe("event dispatch", () => {
  test("unknown event type → 200 {received:true}, no upsert", async () => {
    stripe.webhooks.constructEvent.mockReturnValue({ type: "invoice.paid", created: 10, data: { object: {} } });
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect((await res.json())).toEqual({ received: true });
    expect(mocks.upsertSubscription).not.toHaveBeenCalled();
  });

  test("customer.subscription.updated → upsert with mapped fields + event watermark", async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      created: 1700,
      data: { object: sub({ status: "active", metadata: { user_id: "u1" } }) },
    });
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    const [, row] = mocks.upsertSubscription.mock.calls[0];
    expect(row.userId).toBe("u1"); // from sub.metadata.user_id
    expect(row.plan).toBe("pro"); // from subscriptionPlan(sub)
    expect(row.status).toBe("active"); // passthrough
    expect(row.stripeSubscriptionId).toBe("sub_1");
    expect(row.stripeCustomerId).toBe("cus_1");
    expect(row.eventCreatedAt).toEqual(new Date(1700 * 1000)); // created seconds → ms
  });

  test("customer.subscription.deleted → status FORCED to 'canceled' even if the object still reads active", async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      created: 2000,
      data: { object: sub({ status: "active", metadata: { user_id: "u1" } }) },
    });
    await POST(req("{}"));
    const [, row] = mocks.upsertSubscription.mock.calls[0];
    expect(row.status).toBe("canceled");
  });

  test("checkout.session.completed → retrieves the sub, backfills user_id from session, dedupes", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue(sub({ id: "sub_9", customer: "cus_9", metadata: {} }));
    stripe.subscriptions.list.mockResolvedValue({ data: [{ id: "sub_9" }, { id: "sub_old" }] });
    stripe.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      created: 3000,
      data: { object: { subscription: "sub_9", metadata: { user_id: "u-backfill" } } },
    });
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_9");
    // user_id backfilled from the session onto the retrieved sub → reaches upsert.
    expect(mocks.upsertSubscription.mock.calls[0][1].userId).toBe("u-backfill");
    // Dedupe: the OTHER active sub for the customer is canceled, the kept one is not.
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith("sub_old");
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalledWith("sub_9");
  });

  test("checkout.session.completed with no subscription id → clean 200 ack, no retrieve", async () => {
    stripe.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      created: 3100,
      data: { object: { subscription: null, metadata: { user_id: "u1" } } },
    });
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(mocks.upsertSubscription).not.toHaveBeenCalled();
  });
});

describe("user-id resolution ladder", () => {
  test("no metadata → mirror lookup by customer id → upsert with the found user", async () => {
    mocks.serviceSql.mockResolvedValue([{ user_id: "u-from-mirror" }]);
    stripe.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      created: 4000,
      data: { object: sub({ customer: "cus_1", metadata: {} }) },
    });
    await POST(req("{}"));
    expect(mocks.upsertSubscription.mock.calls[0][1].userId).toBe("u-from-mirror");
    // Didn't need the Stripe customer object — the mirror answered.
    expect(stripe.customers.retrieve).not.toHaveBeenCalled();
  });

  test("no metadata, no mirror row → falls back to the Stripe customer's metadata", async () => {
    mocks.serviceSql.mockResolvedValue([]);
    stripe.customers.retrieve.mockResolvedValue({ metadata: { user_id: "u-from-customer" } });
    stripe.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      created: 4100,
      data: { object: sub({ customer: "cus_1", metadata: {} }) },
    });
    await POST(req("{}"));
    expect(stripe.customers.retrieve).toHaveBeenCalledWith("cus_1");
    expect(mocks.upsertSubscription.mock.calls[0][1].userId).toBe("u-from-customer");
  });

  test("unresolvable user (all sources null) → 200 ack, NO upsert", async () => {
    mocks.serviceSql.mockResolvedValue([]);
    stripe.customers.retrieve.mockResolvedValue({ metadata: {} });
    stripe.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      created: 4200,
      data: { object: sub({ customer: "cus_1", metadata: {} }) },
    });
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(mocks.upsertSubscription).not.toHaveBeenCalled();
  });
});

describe("tombstone + retry semantics", () => {
  test("resolved user is tombstoned → 200 ack, NO upsert (M-RESURRECT-1)", async () => {
    mocks.isAccountDeleted.mockResolvedValue(true);
    stripe.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      created: 5000,
      data: { object: sub({ metadata: { user_id: "u-deleted" } }) },
    });
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(mocks.isAccountDeleted).toHaveBeenCalledWith("u-deleted");
    expect(mocks.upsertSubscription).not.toHaveBeenCalled();
  });

  test("handler throw (upsert rejects) → 500 so Stripe retries", async () => {
    mocks.upsertSubscription.mockRejectedValue(new Error("db down"));
    stripe.webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      created: 5100,
      data: { object: sub({ metadata: { user_id: "u1" } }) },
    });
    const res = await POST(req("{}"));
    expect(res.status).toBe(500);
  });
});

describe("cancelOtherActiveSubscriptions", () => {
  test("cancels every active sub except the one to keep", async () => {
    stripe.subscriptions.list.mockResolvedValue({ data: [{ id: "a" }, { id: "keep" }, { id: "b" }] });
    await cancelOtherActiveSubscriptions(stripe as never, "cus_1", "keep");
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith("a");
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith("b");
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalledWith("keep");
  });

  test("null customerId → no list, no cancel (nothing to dedupe)", async () => {
    await cancelOtherActiveSubscriptions(stripe as never, null, "keep");
    expect(stripe.subscriptions.list).not.toHaveBeenCalled();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  test("a list failure is swallowed (non-fatal)", async () => {
    stripe.subscriptions.list.mockRejectedValue(new Error("stripe 500"));
    await expect(cancelOtherActiveSubscriptions(stripe as never, "cus_1", "keep")).resolves.toBeUndefined();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  test("one cancel failure does not abort the rest of the loop", async () => {
    stripe.subscriptions.list.mockResolvedValue({ data: [{ id: "a" }, { id: "b" }] });
    stripe.subscriptions.cancel.mockRejectedValueOnce(new Error("cancel a failed"));
    await cancelOtherActiveSubscriptions(stripe as never, "cus_1", "keep");
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith("a");
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith("b");
  });
});
