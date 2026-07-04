import { beforeEach, describe, expect, test, vi } from "vitest";

// Minor 3(c): on checkout.session.completed the webhook cancels any OTHER active
// subscription for the customer, keeping only the one this checkout created — so a
// double-subscribe race can never leave the customer billed twice.

// The route imports these at load; stub them so the module imports without env/config.
vi.mock("@/lib/db", () => ({ serviceSql: (..._a: unknown[]) => Promise.resolve([]) }));
vi.mock("@/lib/subscriptions", () => ({ upsertSubscription: vi.fn() }));
vi.mock("@/lib/tombstone", () => ({ isAccountDeleted: async () => false }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({}),
  subscriptionPeriodEnd: () => null,
  subscriptionPlan: () => null,
}));

const { cancelOtherActiveSubscriptions } = await import("@/app/api/stripe/webhook/route");

function fakeStripe(activeIds: string[]) {
  const canceled: string[] = [];
  const listCalls: unknown[] = [];
  return {
    canceled,
    listCalls,
    subscriptions: {
      list: async (args: unknown) => {
        listCalls.push(args);
        return { data: activeIds.map((id) => ({ id })) };
      },
      cancel: async (id: string) => {
        canceled.push(id);
        return { id };
      },
    },
  };
}

describe("cancelOtherActiveSubscriptions", () => {
  beforeEach(() => vi.clearAllMocks());

  test("cancels every active subscription except the one to keep", async () => {
    const stripe = fakeStripe(["sub_keep", "sub_dup1", "sub_dup2"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await cancelOtherActiveSubscriptions(stripe as any, "cus_1", "sub_keep");
    expect(stripe.canceled).toEqual(["sub_dup1", "sub_dup2"]);
    expect(stripe.listCalls[0]).toMatchObject({ customer: "cus_1", status: "active" });
  });

  test("no-op when the only active subscription is the kept one", async () => {
    const stripe = fakeStripe(["sub_keep"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await cancelOtherActiveSubscriptions(stripe as any, "cus_1", "sub_keep");
    expect(stripe.canceled).toEqual([]);
  });

  test("no customer id → does nothing (never lists)", async () => {
    const stripe = fakeStripe(["sub_x"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await cancelOtherActiveSubscriptions(stripe as any, null, "sub_keep");
    expect(stripe.listCalls).toEqual([]);
    expect(stripe.canceled).toEqual([]);
  });

  test("a list failure is swallowed (best-effort, never throws)", async () => {
    const stripe = {
      subscriptions: {
        list: async () => {
          throw new Error("stripe down");
        },
        cancel: async () => ({}),
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(cancelOtherActiveSubscriptions(stripe as any, "cus_1", "sub_keep")).resolves.toBeUndefined();
  });
});
