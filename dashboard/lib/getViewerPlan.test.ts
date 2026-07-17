import { beforeEach, describe, expect, test, vi } from "vitest";

// getViewerPlan = getSubscription (withUserSql) + isInvitedUser + loadAppSettings +
// getOwnPlanOverride, composed through resolvePlan (REAL — the pin semantics under
// test live there). Everything else is mocked at the module boundary.

const state = vi.hoisted(() => ({
  sub: null as unknown,
  invited: false,
  override: null as unknown,
}));

vi.mock("@/lib/db", () => ({
  serviceSql: vi.fn(),
  withUserSql: (_userId: string, fn: (t: unknown) => unknown) =>
    fn(() => Promise.resolve(state.sub ? [state.sub] : [])),
}));
vi.mock("@/lib/invites", () => ({ isInvitedUser: vi.fn(async () => state.invited) }));
vi.mock("@/lib/appSettings", () => ({
  loadAppSettings: vi.fn(async () => ({ inviteCompPlan: "standard", inviteDefaultAllowance: 3 })),
}));
vi.mock("@/lib/planOverrides", () => ({
  getOwnPlanOverride: vi.fn(async () => state.override),
}));

const { getViewerPlan } = await import("@/lib/subscriptions");

beforeEach(() => {
  state.sub = null;
  state.invited = false;
  state.override = null;
});

describe("getViewerPlan operator pin", () => {
  test("active pin comps a stranger to pro", async () => {
    state.override = { plan: "pro", expires_at: null };
    expect(await getViewerPlan("u1", "a@x.com")).toBe("pro");
  });

  test("active pin downgrades a paying pro subscriber to standard", async () => {
    state.sub = {
      user_id: "u1", stripe_customer_id: null, stripe_subscription_id: null,
      plan: "pro", status: "active",
      current_period_end: new Date(Date.now() + 10 * 86400_000), cancel_at_period_end: false,
    };
    state.override = { plan: "standard", expires_at: null };
    expect(await getViewerPlan("u1", "a@x.com")).toBe("standard");
  });

  test("expired pin falls back to the invite comp", async () => {
    state.invited = true;
    state.override = { plan: "pro", expires_at: new Date(Date.now() - 86400_000) };
    expect(await getViewerPlan("u1", "a@x.com")).toBe("standard");
  });

  test("no pin: stranger stays null (existing behavior)", async () => {
    expect(await getViewerPlan("u1", "a@x.com")).toBeNull();
  });
});
