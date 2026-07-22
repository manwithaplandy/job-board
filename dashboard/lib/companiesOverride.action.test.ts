import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// SaaS cutover contract changes exercised here:
//  1. setCompanyOverride writes the per-user company_overrides table via
//     withUserSql(userId, tx => tx`...`) (RLS-scoped) and DELIBERATELY no longer flips the
//     global companies.active flag (companies is the shared corpus — one tenant must not
//     mutate a poller-wide flag) NOR touches the legacy company_reviews table (per-user
//     judgment now lives entirely in company_overrides). It calls assertNotDeleted(userId)
//     first (stale-JWT resurrection guard).
//  2. refreshCompanyDiscoveryStatus is ADMIN-ONLY: getUserClaims + isAdmin (real, pure,
//     reads ADMIN_EMAILS, fail-closed) instead of requireUserId, and writes the GLOBAL
//     discovery_state singleton via serviceSql (shared operator control), not withUserSql.
//
// Two capture arrays keep user-scoped (RLS) writes distinguishable from service-role
// ones. They live on the hoisted `mocks` object so the vi.mock factory (hoisted above
// module-level consts) can reference them without a TDZ error.
const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  getUserClaims: vi.fn(),
  revalidatePath: vi.fn(),
  getOpenRouterCredits: vi.fn(),
  assertNotDeleted: vi.fn(),
  withUserSql: vi.fn(),
  userCalls: [] as { text: string; values: unknown[] }[],
  serviceCalls: [] as { text: string; values: unknown[] }[],
}));

const userTx = (strings: readonly string[], ...values: unknown[]) => {
  mocks.userCalls.push({ text: strings.join("?"), values });
  return Promise.resolve([]);
};

vi.mock("@/lib/auth", () => ({ requireUserId: mocks.requireUserId, getUserClaims: mocks.getUserClaims }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/openrouter", () => ({ getOpenRouterCredits: mocks.getOpenRouterCredits }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: mocks.assertNotDeleted }));
// isAdmin is left REAL (pure ADMIN_EMAILS check) — don't over-mock the gate under test.
vi.mock("@/lib/db", () => ({
  withUserSql: mocks.withUserSql,
  serviceSql: (strings: readonly string[], ...values: unknown[]) => {
    mocks.serviceCalls.push({ text: strings.join("?"), values });
    return Promise.resolve([]);
  },
}));

import { setCompanyOverride, refreshCompanyDiscoveryStatus } from "@/app/actions/companies";

const USER = "9ae8b777-7c24-4290-8aad-bd2b10eff23b";

beforeEach(() => {
  mocks.userCalls.length = 0;
  mocks.serviceCalls.length = 0;
  vi.clearAllMocks();
  mocks.requireUserId.mockResolvedValue(USER);
  mocks.getOpenRouterCredits.mockResolvedValue(5);
  mocks.assertNotDeleted.mockResolvedValue(undefined);
  mocks.withUserSql.mockImplementation((_uid: string, fn: (t: typeof userTx) => unknown) => fn(userTx));
  vi.stubEnv("ADMIN_EMAILS", "op@x.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("setCompanyOverride", () => {
  test("upserts a per-user override into company_overrides, RLS-scoped to the authed user", async () => {
    await setCompanyOverride(42, "include");
    // Scoped to the authed user's RLS context — the tenant boundary.
    expect(mocks.withUserSql).toHaveBeenCalledWith(USER, expect.any(Function));
    const call = mocks.userCalls.find((c) => c.text.includes("company_overrides"))!;
    expect(call).toBeTruthy();
    expect(call.text).toContain("INSERT INTO company_overrides");
    expect(call.text).toContain("ON CONFLICT");
    expect(call.text).toContain("user_id, company_id");
    expect(call.text).toContain("updated_at");
    expect(call.values).toContain(USER);
    expect(call.values).toContain(42);
    expect(call.values).toContain("include");
    // /companies AND the board (/) both revalidate — an override re-scopes the board.
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/companies");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  test("binds the exclude verdict", async () => {
    await setCompanyOverride(42, "exclude");
    const call = mocks.userCalls.find((c) => c.text.includes("company_overrides"))!;
    expect(call.values).toContain("exclude");
    expect(call.values).not.toContain("include");
  });

  test("does NOT write the legacy company_reviews table (override retargeted)", async () => {
    await setCompanyOverride(42, "include");
    expect(mocks.userCalls.some((c) => c.text.includes("company_reviews"))).toBe(false);
  });

  test("does NOT mutate the global companies.active flag (shared-corpus regression guard)", async () => {
    await setCompanyOverride(42, "include");
    // The pre-SaaS version flipped companies.active; that is deliberately dropped.
    expect(mocks.userCalls.some((c) => /update\s+companies/i.test(c.text))).toBe(false);
    // And nothing touched the service role — a per-user override is never operator-global.
    expect(mocks.serviceCalls).toHaveLength(0);
  });

  test("asserts not-deleted before any SQL", async () => {
    await setCompanyOverride(42, "include");
    expect(mocks.assertNotDeleted).toHaveBeenCalledWith(USER);
    expect(mocks.assertNotDeleted.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.withUserSql.mock.invocationCallOrder[0],
    );
  });

  test("a tombstoned account cannot write an override via a stale JWT (no SQL)", async () => {
    mocks.assertNotDeleted.mockRejectedValue(new Error("account has been deleted"));
    await expect(setCompanyOverride(42, "include")).rejects.toThrow("account has been deleted");
    expect(mocks.withUserSql).not.toHaveBeenCalled();
    expect(mocks.userCalls).toHaveLength(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("refreshCompanyDiscoveryStatus — admin gate + credit halt", () => {
  test("admin + positive credits → clears the halt via serviceSql (TRUE bound)", async () => {
    mocks.getUserClaims.mockResolvedValue({ id: USER, email: "op@x.com" });
    mocks.getOpenRouterCredits.mockResolvedValue(5);
    await refreshCompanyDiscoveryStatus();
    const update = mocks.serviceCalls.find((c) => c.text.includes("discovery_state"))!;
    expect(update).toBeTruthy();
    expect(update.values).toContain(true);
    // The global singleton is written on the SERVICE role, never the per-user executor.
    expect(mocks.withUserSql).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/companies");
  });

  test("admin + zero credits → halt stays (FALSE bound, no TRUE)", async () => {
    mocks.getUserClaims.mockResolvedValue({ id: USER, email: "op@x.com" });
    mocks.getOpenRouterCredits.mockResolvedValue(0);
    await refreshCompanyDiscoveryStatus();
    const update = mocks.serviceCalls.find((c) => c.text.includes("discovery_state"))!;
    expect(update.values).toContain(false);
    expect(update.values).not.toContain(true);
  });

  test("admin + null credits (unknown, not topped up) → FALSE bound", async () => {
    mocks.getUserClaims.mockResolvedValue({ id: USER, email: "op@x.com" });
    mocks.getOpenRouterCredits.mockResolvedValue(null);
    await refreshCompanyDiscoveryStatus();
    const update = mocks.serviceCalls.find((c) => c.text.includes("discovery_state"))!;
    expect(update.values).toContain(false);
    expect(update.values).not.toContain(true);
  });

  test("a signed-in NON-admin is rejected before spending credits or SQL", async () => {
    mocks.getUserClaims.mockResolvedValue({ id: USER, email: "rando@x.com" });
    await expect(refreshCompanyDiscoveryStatus()).rejects.toThrow("not authorized");
    expect(mocks.getOpenRouterCredits).not.toHaveBeenCalled();
    expect(mocks.serviceCalls).toHaveLength(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test("an anonymous caller (null claims) is rejected", async () => {
    mocks.getUserClaims.mockResolvedValue(null);
    await expect(refreshCompanyDiscoveryStatus()).rejects.toThrow("not authorized");
    expect(mocks.getOpenRouterCredits).not.toHaveBeenCalled();
    expect(mocks.serviceCalls).toHaveLength(0);
  });

  test("blank ADMIN_EMAILS fails closed — even a matching-looking email is not admin", async () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    mocks.getUserClaims.mockResolvedValue({ id: USER, email: "op@x.com" });
    await expect(refreshCompanyDiscoveryStatus()).rejects.toThrow("not authorized");
    expect(mocks.serviceCalls).toHaveLength(0);
  });
});
