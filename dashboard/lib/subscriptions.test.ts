import { beforeEach, describe, expect, test, vi } from "vitest";

// ── Shared mocks ─────────────────────────────────────────────────────────────
// The Stripe SDK is faked: constructEvent returns a staged event, subscriptions.
// retrieve returns a staged subscription. subscriptionPlan/subscriptionPeriodEnd
// stay REAL (importOriginal) so the event→row mapping is exercised end-to-end.
const stripeState = vi.hoisted(() => ({
  event: null as unknown,
  retrieved: null as unknown,
  throwOnConstruct: false,
}));
const dbState = vi.hoisted(() => ({
  serviceCalls: [] as { strings: readonly string[]; values: unknown[] }[],
  userRows: [] as unknown[],
  deleted: false, // account_deletions tombstone flag returned by the EXISTS probe
}));

vi.mock("@/lib/stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe")>();
  return {
    ...actual,
    getStripe: () => ({
      webhooks: {
        constructEvent: () => {
          if (stripeState.throwOnConstruct) throw new Error("bad sig");
          return stripeState.event;
        },
      },
      subscriptions: { retrieve: async () => stripeState.retrieved },
      customers: { retrieve: async () => ({ metadata: {} }) },
    }),
  };
});

vi.mock("@/lib/db", () => {
  const serviceSql = (strings: readonly string[], ...values: unknown[]) => {
    dbState.serviceCalls.push({ strings, values });
    // The shared tombstone probe (lib/tombstone.ts) — resolve the EXISTS to dbState.deleted.
    if (strings.join("").includes("account_deletions")) {
      return Promise.resolve([{ deleted: dbState.deleted }]);
    }
    return Promise.resolve([]);
  };
  const tx = () => Promise.resolve(dbState.userRows);
  return {
    serviceSql,
    withUserSql: (_userId: string, fn: (t: unknown) => unknown) => fn(tx),
  };
});

vi.mock("@/lib/invites", () => ({ isInvitedUser: vi.fn(async () => false) }));

import { POST } from "@/app/api/stripe/webhook/route";
import { getViewerPlan } from "@/lib/subscriptions";
import { isInvitedUser } from "@/lib/invites";

const req = (body: string, sig = "sig") =>
  new Request("https://x/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": sig },
    body,
  });

beforeEach(() => {
  vi.clearAllMocks();
  dbState.serviceCalls.length = 0;
  dbState.userRows.length = 0;
  dbState.deleted = false;
  stripeState.throwOnConstruct = false;
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.STRIPE_PRICE_STANDARD = "price_standard";
  process.env.STRIPE_PRICE_PRO = "price_pro";
});

const subObject = (over: Record<string, unknown> = {}) => ({
  id: "sub_123",
  customer: "cus_123",
  status: "active",
  cancel_at_period_end: false,
  metadata: { user_id: "user-1" },
  items: { data: [{ price: { id: "price_pro" }, current_period_end: 1_800_000_000 }] },
  ...over,
});

describe("stripe webhook", () => {
  test("bad signature → 400", async () => {
    stripeState.throwOnConstruct = true;
    const res = await POST(req("{}"));
    expect(res.status).toBe(400);
    expect(dbState.serviceCalls).toHaveLength(0);
  });

  test("customer.subscription.updated maps price→plan, status, period, cancel flag", async () => {
    stripeState.event = { type: "customer.subscription.updated", data: { object: subObject() } };
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    // The only serviceSql call is the upsert INSERT; assert the bound values.
    const insert = dbState.serviceCalls.find((c) => c.strings.join("").includes("INSERT INTO subscriptions"));
    expect(insert).toBeDefined();
    const v = insert!.values;
    expect(v[0]).toBe("user-1"); // user_id
    expect(v[1]).toBe("cus_123"); // stripe_customer_id
    expect(v[2]).toBe("sub_123"); // stripe_subscription_id
    expect(v[3]).toBe("pro"); // plan (from price_pro)
    expect(v[4]).toBe("active"); // status
    expect(v[5]).toBeInstanceOf(Date); // current_period_end
    expect(v[6]).toBe(false); // cancel_at_period_end
  });

  test("customer.subscription.deleted forces status=canceled (never deletes the row)", async () => {
    stripeState.event = {
      type: "customer.subscription.deleted",
      data: { object: subObject({ status: "active" }) },
    };
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    const insert = dbState.serviceCalls.find((c) => c.strings.join("").includes("INSERT INTO subscriptions"));
    expect(insert!.values[4]).toBe("canceled");
    // It is an UPSERT, not a DELETE.
    expect(dbState.serviceCalls.some((c) => c.strings.join("").includes("DELETE"))).toBe(false);
  });

  test("checkout.session.completed retrieves the subscription then upserts", async () => {
    stripeState.retrieved = subObject();
    stripeState.event = {
      type: "checkout.session.completed",
      data: { object: { subscription: "sub_123", metadata: { user_id: "user-1" } } },
    };
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(dbState.serviceCalls.some((c) => c.strings.join("").includes("INSERT INTO subscriptions"))).toBe(true);
  });

  test("acks-and-skips the upsert for a tombstoned (deleted) user (M-RESURRECT-1)", async () => {
    dbState.deleted = true; // account_deletions has a row for this user_id
    stripeState.event = {
      type: "customer.subscription.deleted",
      data: { object: subObject() },
    };
    const res = await POST(req("{}"));
    expect(res.status).toBe(200); // still ack so Stripe stops retrying
    // The subscription mirror is NOT re-INSERTed for the erased account.
    expect(dbState.serviceCalls.some((c) => c.strings.join("").includes("INSERT INTO subscriptions"))).toBe(false);
  });

  test("unknown event type is acked with 200 and writes nothing", async () => {
    stripeState.event = { type: "invoice.paid", data: { object: {} } };
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    expect(dbState.serviceCalls).toHaveLength(0);
  });
});

describe("getViewerPlan", () => {
  test("passes the subscription mirror + invite proof through resolvePlan", async () => {
    // Active pro subscription (far-future period) → 'pro'.
    dbState.userRows.push({
      user_id: "user-1",
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
      plan: "pro",
      status: "active",
      current_period_end: new Date(Date.now() + 30 * 86400_000),
      cancel_at_period_end: false,
    });
    expect(await getViewerPlan("user-1", "a@b.com")).toBe("pro");
  });

  test("no subscription but invited → comped Standard", async () => {
    (isInvitedUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    // no userRows → getSubscription returns null
    expect(await getViewerPlan("user-2", "b@b.com")).toBe("standard");
  });

  test("stranger with neither → null", async () => {
    expect(await getViewerPlan("user-3", "c@b.com")).toBeNull();
  });
});
