import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// notFound() throws in Next; make the mock throw a sentinel we can assert on.
class NotFoundError extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundError();
  },
  // The page imports AllowanceEditor, which imports useRouter from this module.
  // It is never CALLED here (the gate suite never renders JSX), but the mocked
  // module must still define the export or vitest errors on access.
  useRouter: () => ({ refresh: () => {} }),
}));

const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
vi.mock("@/lib/auth", () => auth);

const metrics = vi.hoisted(() => ({ getTenantMetrics: vi.fn(async () => []) }));
vi.mock("@/lib/tenantMetrics", () => metrics);

// The page now loads operator settings for the per-tenant AllowanceEditor default;
// stub it so the gate suite stays a pure unit (no real DB connect on "admin proceeds").
const appSettings = vi.hoisted(() => ({
  loadAppSettings: vi.fn(async () => ({ inviteCompPlan: "standard", inviteDefaultAllowance: 3 })),
}));
vi.mock("@/lib/appSettings", () => appSettings);

const OLD = process.env.ADMIN_EMAILS;
const { default: AdminTenantsPage } = await import("@/app/admin/tenants/page");

beforeEach(() => {
  auth.getUserClaims.mockReset();
  metrics.getTenantMetrics.mockClear();
});
afterEach(() => {
  if (OLD === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = OLD;
  vi.restoreAllMocks();
});

describe("AdminTenantsPage gate", () => {
  test("an authed NON-admin gets notFound() BEFORE any data fetch", async () => {
    process.env.ADMIN_EMAILS = "op@example.com";
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "stranger@x.com" });
    await expect(AdminTenantsPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(metrics.getTenantMetrics).not.toHaveBeenCalled();
  });

  test("fails closed: with ADMIN_EMAILS unset even a plausible email is notFound", async () => {
    delete process.env.ADMIN_EMAILS;
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "op@example.com" });
    await expect(AdminTenantsPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(metrics.getTenantMetrics).not.toHaveBeenCalled();
  });

  test("anon (null claims) is notFound, never a data response", async () => {
    process.env.ADMIN_EMAILS = "op@example.com";
    auth.getUserClaims.mockResolvedValue(null);
    await expect(AdminTenantsPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(metrics.getTenantMetrics).not.toHaveBeenCalled();
  });

  test("an admin proceeds to fetch tenant metrics", async () => {
    process.env.ADMIN_EMAILS = "op@example.com";
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "op@example.com" });
    await AdminTenantsPage();
    expect(metrics.getTenantMetrics).toHaveBeenCalledOnce();
  });
});
