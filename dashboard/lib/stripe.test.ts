import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock the Stripe SDK so getStripe() yields a controllable subscriptions.cancel.
const state = vi.hoisted(() => ({
  cancelError: null as unknown,
  cancelCalls: [] as string[],
  customerDelError: null as unknown,
  customerDelCalls: [] as string[],
}));

vi.mock("stripe", () => ({
  default: class {
    subscriptions = {
      cancel: vi.fn(async (id: string) => {
        state.cancelCalls.push(id);
        if (state.cancelError) throw state.cancelError;
        return { id, status: "canceled" };
      }),
    };
    customers = {
      del: vi.fn(async (id: string) => {
        state.customerDelCalls.push(id);
        if (state.customerDelError) throw state.customerDelError;
        return { id, deleted: true };
      }),
    };
  },
}));

const { cancelSubscriptionIfPresent, deleteCustomerIfPresent } = await import("@/lib/stripe");

beforeEach(() => {
  state.cancelError = null;
  state.cancelCalls = [];
  state.customerDelError = null;
  state.customerDelCalls = [];
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
});
afterEach(() => vi.restoreAllMocks());

describe("cancelSubscriptionIfPresent already-gone tolerance", () => {
  test("null/blank id is a no-op (no API call)", async () => {
    await expect(cancelSubscriptionIfPresent(null)).resolves.toBeUndefined();
    await expect(cancelSubscriptionIfPresent("")).resolves.toBeUndefined();
    expect(state.cancelCalls).toEqual([]);
  });

  test("swallows a resource_missing error (id already gone)", async () => {
    state.cancelError = Object.assign(new Error("No such subscription"), {
      code: "resource_missing",
    });
    await expect(cancelSubscriptionIfPresent("sub_1")).resolves.toBeUndefined();
  });

  test("swallows a non-resource_missing 'already canceled' invalid_request_error", async () => {
    // The common lapsed-subscriber path: the mirror kept the id, Stripe rejects the
    // double-cancel with this — must be treated as already-gone, not fatal.
    state.cancelError = Object.assign(
      new Error("This subscription has already been canceled and can no longer be updated."),
      { type: "invalid_request_error" },
    );
    await expect(cancelSubscriptionIfPresent("sub_1")).resolves.toBeUndefined();
  });

  test("rethrows an unrelated Stripe error (does not silently pass)", async () => {
    state.cancelError = Object.assign(new Error("api connection error"), {
      type: "api_connection_error",
    });
    await expect(cancelSubscriptionIfPresent("sub_1")).rejects.toBeTruthy();
  });
});

describe("deleteCustomerIfPresent (M-STRIPE-CUSTOMER)", () => {
  test("null/blank id is a no-op (no API call)", async () => {
    await expect(deleteCustomerIfPresent(null)).resolves.toBeUndefined();
    await expect(deleteCustomerIfPresent("")).resolves.toBeUndefined();
    expect(state.customerDelCalls).toEqual([]);
  });

  test("deletes the customer (erases the email/name PII Stripe holds)", async () => {
    await expect(deleteCustomerIfPresent("cus_1")).resolves.toBeUndefined();
    expect(state.customerDelCalls).toEqual(["cus_1"]);
  });

  test("swallows a resource_missing error (customer already gone) — idempotent retry", async () => {
    state.customerDelError = Object.assign(new Error("No such customer"), {
      code: "resource_missing",
    });
    await expect(deleteCustomerIfPresent("cus_1")).resolves.toBeUndefined();
  });

  test("rethrows an unrelated Stripe error (aborts before DB rows are deleted)", async () => {
    state.customerDelError = Object.assign(new Error("api connection error"), {
      type: "api_connection_error",
    });
    await expect(deleteCustomerIfPresent("cus_1")).rejects.toBeTruthy();
  });
});
