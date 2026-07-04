import { beforeEach, describe, expect, test, vi } from "vitest";

// Route-level test for POST /api/stripe/checkout: anon → 401; a bad plan → 400; a
// customer who ALREADY has a live subscription → 409 (no duplicate/double-billing
// checkout); otherwise a Checkout Session is created for the caller's own id.

const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
vi.mock("@/lib/auth", () => auth);

const subs = vi.hoisted(() => ({ getSubscription: vi.fn() }));
vi.mock("@/lib/subscriptions", () => subs);

const stripeState = vi.hoisted(() => ({
  created: [] as unknown[],
  customersCreated: [] as unknown[],
}));
vi.mock("@/lib/stripe", () => ({
  planToPrice: (plan: string) => (plan === "pro" ? "price_pro" : "price_standard"),
  getStripe: () => ({
    customers: {
      create: async (args: unknown) => {
        stripeState.customersCreated.push(args);
        return { id: "cus_new" };
      },
    },
    checkout: {
      sessions: {
        create: async (args: unknown) => {
          stripeState.created.push(args);
          return { url: "https://checkout.stripe/session" };
        },
      },
    },
  }),
}));

const { POST } = await import("@/app/api/stripe/checkout/route");

const req = (body: unknown) =>
  new Request("https://x/api/stripe/checkout", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  auth.getUserClaims.mockReset();
  subs.getSubscription.mockReset();
  stripeState.created.length = 0;
  stripeState.customersCreated.length = 0;
});

describe("POST /api/stripe/checkout", () => {
  test("401 for an anonymous caller", async () => {
    auth.getUserClaims.mockResolvedValue(null);
    const res = await POST(req({ plan: "pro" }));
    expect(res.status).toBe(401);
    expect(stripeState.created).toHaveLength(0);
  });

  test("400 for an invalid plan", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "u1@x.com" });
    const res = await POST(req({ plan: "enterprise" }));
    expect(res.status).toBe(400);
    expect(stripeState.created).toHaveLength(0);
  });

  test.each(["active", "trialing", "past_due", "unpaid"])(
    "409 when the customer already has a %s subscription (no second checkout)",
    async (status) => {
      auth.getUserClaims.mockResolvedValue({ id: "u1", email: "u1@x.com" });
      subs.getSubscription.mockResolvedValue({ stripe_customer_id: "cus_1", status });
      const res = await POST(req({ plan: "pro" }));
      expect(res.status).toBe(409);
      expect(stripeState.created).toHaveLength(0); // no duplicate subscription opened
    },
  );

  test("canceled subscriber may re-subscribe (reuses the stored customer)", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "u1@x.com" });
    subs.getSubscription.mockResolvedValue({ stripe_customer_id: "cus_1", status: "canceled" });
    const res = await POST(req({ plan: "pro" }));
    expect(res.status).toBe(200);
    expect(stripeState.created).toHaveLength(1);
    expect(stripeState.customersCreated).toHaveLength(0); // reused cus_1, no new customer
    const session = stripeState.created[0] as { customer: string; client_reference_id: string };
    expect(session.customer).toBe("cus_1");
    expect(session.client_reference_id).toBe("u1");
  });

  test("a brand-new subscriber gets a fresh customer + checkout session", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u2", email: "u2@x.com" });
    subs.getSubscription.mockResolvedValue(null);
    const res = await POST(req({ plan: "standard" }));
    expect(res.status).toBe(200);
    expect(stripeState.customersCreated).toHaveLength(1);
    expect(stripeState.created).toHaveLength(1);
    const body = (await res.json()) as { url: string };
    expect(body.url).toBe("https://checkout.stripe/session");
  });
});
