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
}));

const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
vi.mock("@/lib/auth", () => auth);

const metrics = vi.hoisted(() => ({ getTenantMetrics: vi.fn(async () => []) }));
vi.mock("@/lib/tenantMetrics", () => metrics);

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
