import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// POST /api/stripe/portal opens the Stripe Billing Portal for the CALLER's own customer.
// A wrong customer id or missing gate would open another tenant's billing, so the
// load-bearing assertions are: anon → 401 (no Stripe call); no billing row / no customer
// id → 404 (no Stripe call); success → portal session for the row's OWN customer id, and
// getSubscription is scoped to the caller's id.
const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
const subs = vi.hoisted(() => ({ getSubscription: vi.fn() }));
const stripeState = vi.hoisted(() => ({ created: [] as unknown[] }));

vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/subscriptions", () => subs);
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    billingPortal: {
      sessions: {
        create: async (args: unknown) => {
          stripeState.created.push(args);
          return { url: "https://billing.stripe/portal" };
        },
      },
    },
  }),
}));

const { POST } = await import("@/app/api/stripe/portal/route");

const req = (origin = "https://app.example.com") =>
  new Request(`${origin}/api/stripe/portal`, { method: "POST" });

beforeEach(() => {
  auth.getUserClaims.mockReset();
  subs.getSubscription.mockReset();
  stripeState.created.length = 0;
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/stripe/portal", () => {
  test("401 for an anonymous caller — no Stripe call", async () => {
    auth.getUserClaims.mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(subs.getSubscription).not.toHaveBeenCalled();
    expect(stripeState.created).toHaveLength(0);
  });

  test("404 when there is no subscription row yet — no Stripe call", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "u1@x.com" });
    subs.getSubscription.mockResolvedValue(null);
    const res = await POST(req());
    expect(res.status).toBe(404);
    expect(stripeState.created).toHaveLength(0);
  });

  test("404 when the row has no stripe_customer_id (e.g. comped invite plan)", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "u1@x.com" });
    subs.getSubscription.mockResolvedValue({ stripe_customer_id: null, status: "active" });
    const res = await POST(req());
    expect(res.status).toBe(404);
    expect(stripeState.created).toHaveLength(0);
  });

  test("success → portal session for the row's OWN customer id; getSubscription scoped to the caller", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://rolefit.app");
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "u1@x.com" });
    subs.getSubscription.mockResolvedValue({ stripe_customer_id: "cus_1", status: "active" });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(subs.getSubscription).toHaveBeenCalledWith("u1");
    const session = stripeState.created[0] as { customer: string; return_url: string };
    expect(session.customer).toBe("cus_1");
    expect(session.return_url).toBe("https://rolefit.app/billing");
    expect((await res.json()).url).toBe("https://billing.stripe/portal");
  });

  test("NEXT_PUBLIC_SITE_URL unset → return_url falls back to the request's origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined as unknown as string);
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "u1@x.com" });
    subs.getSubscription.mockResolvedValue({ stripe_customer_id: "cus_1", status: "active" });
    await POST(req("https://preview-xyz.vercel.app"));
    const session = stripeState.created[0] as { return_url: string };
    expect(session.return_url).toBe("https://preview-xyz.vercel.app/billing");
  });
});
