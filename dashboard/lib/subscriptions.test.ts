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

// getViewerPlan also calls getOwnPlanOverride, which uses withUserSql — the shared tx mock
// above serves dbState.userRows to EVERY query, so an un-mocked override read would swallow
// the staged subscription row as a pin and silently switch the resolvePlan branch under test.
// Pin behavior is covered by lib/getViewerPlan.test.ts; here the override is always absent.
vi.mock("@/lib/planOverrides", () => ({ getOwnPlanOverride: vi.fn(async () => null) }));

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
    stripeState.event = {
      type: "customer.subscription.updated",
      created: 1_700_000_000,
      data: { object: subObject() },
    };
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
    // last_event_at = the Stripe event.created (unix seconds → ms Date) watermark.
    expect(v[7]).toBeInstanceOf(Date);
    expect((v[7] as Date).getTime()).toBe(1_700_000_000 * 1000);
  });

  // M-WEBHOOK-ORDER — a stale customer.subscription.updated delivered AFTER the delete
  // must not flip canceled→active. Stripe gives no ordering guarantee; the upsert carries
  // a monotonic guard keyed on event.created so the DB drops the older event.
  test("out-of-order delivery: upsert carries the monotonic event.created guard", async () => {
    // The cancellation (deleted) event, generated at T=200.
    stripeState.event = {
      type: "customer.subscription.deleted",
      created: 200,
      data: { object: subObject({ status: "active" }) },
    };
    await POST(req("{}"));
    // A STALE updated event (generated at T=100, before the cancel) delivered afterward.
    stripeState.event = {
      type: "customer.subscription.updated",
      created: 100,
      data: { object: subObject({ status: "active" }) },
    };
    await POST(req("{}"));

    const inserts = dbState.serviceCalls.filter((c) =>
      c.strings.join("").includes("INSERT INTO subscriptions"),
    );
    expect(inserts).toHaveLength(2);
    // Both upserts must emit the monotonic WHERE guard so Postgres skips the older event
    // (COALESCE(null) → -infinity lets a legacy/first event through).
    for (const ins of inserts) {
      const sql = ins.strings.join("");
      expect(sql).toContain("ON CONFLICT (user_id) DO UPDATE");
      expect(sql).toContain("last_event_at");
      expect(sql).toContain(">=");
      expect(sql).toContain("-infinity");
      // Same-second tie-break: event.created has 1s resolution, so a stale updated in
      // the SAME second as the cancel carries an EQUAL watermark that `>=` alone would
      // re-apply. The extra predicate keeps a canceled row canceled on an exact tie.
      expect(sql).toContain("subscriptions.status = 'canceled'");
      expect(sql).toContain("EXCLUDED.status <> 'canceled'");
      expect(sql).toContain("EXCLUDED.last_event_at = subscriptions.last_event_at");
    }
    // The cancel bound the newer watermark (200s); the stale updated bound the older
    // one (100s) → the DB guard drops it, so canceled status survives.
    const canceledWatermark = inserts[0].values[7] as Date;
    const staleWatermark = inserts[1].values[7] as Date;
    expect(canceledWatermark.getTime()).toBe(200_000);
    expect(staleWatermark.getTime()).toBe(100_000);
    expect(staleWatermark.getTime()).toBeLessThan(canceledWatermark.getTime());
    // The stale event maps status=active; only the DB WHERE (asserted above) stops it
    // overwriting the cancel — the mirror is never mutated in application code.
    expect(inserts[0].values[4]).toBe("canceled");
    expect(inserts[1].values[4]).toBe("active");
  });

  // A plan switch to a price OUTSIDE our catalog maps to plan=null; the upsert must take
  // that verbatim (plan = EXCLUDED.plan, NOT COALESCE) so the user is gated rather than
  // silently retaining their old (e.g. Pro) entitlement.
  test("unrecognized price → plan=null bound, and the upsert does not COALESCE plan", async () => {
    stripeState.event = {
      type: "customer.subscription.updated",
      created: 1_700_000_400,
      data: {
        object: subObject({
          items: { data: [{ price: { id: "price_not_ours" }, current_period_end: 1_800_000_000 }] },
        }),
      },
    };
    const res = await POST(req("{}"));
    expect(res.status).toBe(200);
    const insert = dbState.serviceCalls.find((c) => c.strings.join("").includes("INSERT INTO subscriptions"));
    // An unrecognized price → subscriptionPlan → null.
    expect(insert!.values[3]).toBeNull();
    const sql = insert!.strings.join("");
    // plan is authoritative from the current price, never coalesced back to the stale plan.
    expect(sql).toContain("plan                   = EXCLUDED.plan");
    expect(sql).not.toMatch(/plan\s*=\s*COALESCE/);
  });

  test("customer.subscription.deleted forces status=canceled (never deletes the row)", async () => {
    stripeState.event = {
      type: "customer.subscription.deleted",
      created: 1_700_000_100,
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
      created: 1_700_000_200,
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
      created: 1_700_000_300,
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
