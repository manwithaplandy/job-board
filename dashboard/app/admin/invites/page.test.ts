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
  // The page imports InviteGenerator, which imports useRouter from this module.
  // It is never CALLED here (the gate test never renders JSX), but the mocked
  // module must still define the export or vitest errors on access.
  useRouter: () => ({ refresh: () => {} }),
}));

const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
vi.mock("@/lib/auth", () => auth);

const invites = vi.hoisted(() => ({ listInvites: vi.fn(async () => []) }));
vi.mock("@/lib/invites", () => invites);

// The page now loads operator settings for the InviteSettings card; stub it so the
// gate suite stays a pure unit (no real DB connect during the "admin proceeds" case).
const appSettings = vi.hoisted(() => ({
  loadAppSettings: vi.fn(async () => ({ inviteCompPlan: "standard", inviteDefaultAllowance: 3 })),
}));
vi.mock("@/lib/appSettings", () => appSettings);

const OLD = process.env.ADMIN_EMAILS;
const { default: AdminInvitesPage } = await import("@/app/admin/invites/page");

beforeEach(() => {
  auth.getUserClaims.mockReset();
  invites.listInvites.mockClear();
});
afterEach(() => {
  if (OLD === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = OLD;
  vi.restoreAllMocks();
});

describe("AdminInvitesPage gate", () => {
  test("an authed NON-admin gets notFound() BEFORE any data fetch", async () => {
    process.env.ADMIN_EMAILS = "op@example.com";
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "stranger@x.com" });
    await expect(AdminInvitesPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(invites.listInvites).not.toHaveBeenCalled();
  });

  test("fails closed: with ADMIN_EMAILS unset even a plausible email is notFound", async () => {
    delete process.env.ADMIN_EMAILS;
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "op@example.com" });
    await expect(AdminInvitesPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(invites.listInvites).not.toHaveBeenCalled();
  });

  test("anon (null claims) is notFound, never a data response", async () => {
    process.env.ADMIN_EMAILS = "op@example.com";
    auth.getUserClaims.mockResolvedValue(null);
    await expect(AdminInvitesPage()).rejects.toBeInstanceOf(NotFoundError);
    expect(invites.listInvites).not.toHaveBeenCalled();
  });

  test("an admin proceeds to fetch the invite list", async () => {
    process.env.ADMIN_EMAILS = "op@example.com";
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "op@example.com" });
    await AdminInvitesPage();
    expect(invites.listInvites).toHaveBeenCalledOnce();
  });
});
