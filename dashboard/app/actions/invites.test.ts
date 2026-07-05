import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Gate + validation contract for the invite-minting action. REAL isAdmin driven by
// ADMIN_EMAILS (mirrors app/admin/tenants/page.test.ts); getUserClaims and
// createInvite are mocked so no test touches auth or a DB.

const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
vi.mock("@/lib/auth", () => auth);

const invites = vi.hoisted(() => {
  class InviteCodeExistsError extends Error {}
  return {
    InviteCodeExistsError,
    createInvite: vi.fn(async () => ({
      code: "RF-AAAA-AAAA",
      note: null as string | null,
      maxUses: 1,
      uses: 0,
      expiresAt: null as Date | null,
      createdAt: new Date("2026-07-04T00:00:00Z"),
    })),
  };
});
vi.mock("@/lib/invites", () => invites);

const OLD = process.env.ADMIN_EMAILS;
const { createInviteAction } = await import("@/app/actions/invites");

const asAdmin = () =>
  auth.getUserClaims.mockResolvedValue({ id: "u1", email: "op@example.com" });

beforeEach(() => {
  auth.getUserClaims.mockReset();
  invites.createInvite.mockClear();
  process.env.ADMIN_EMAILS = "op@example.com";
});
afterEach(() => {
  if (OLD === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = OLD;
  vi.restoreAllMocks();
});

describe("createInviteAction gate (before any DB work)", () => {
  test("an authed NON-admin throws 'not authorized' and never reaches createInvite", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "stranger@x.com" });
    await expect(createInviteAction({})).rejects.toThrow("not authorized");
    expect(invites.createInvite).not.toHaveBeenCalled();
  });

  test("anon (null claims) throws and never reaches createInvite", async () => {
    auth.getUserClaims.mockResolvedValue(null);
    await expect(createInviteAction({})).rejects.toThrow("not authorized");
    expect(invites.createInvite).not.toHaveBeenCalled();
  });

  test("fails closed: ADMIN_EMAILS unset rejects even a plausible email", async () => {
    delete process.env.ADMIN_EMAILS;
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "op@example.com" });
    await expect(createInviteAction({})).rejects.toThrow("not authorized");
    expect(invites.createInvite).not.toHaveBeenCalled();
  });

  test("an admin proceeds: defaults forwarded, minted code returned", async () => {
    asAdmin();
    const res = await createInviteAction({});
    expect(res).toEqual({ ok: true, code: "RF-AAAA-AAAA" });
    expect(invites.createInvite).toHaveBeenCalledTimes(1);
    expect(invites.createInvite).toHaveBeenCalledWith({
      note: undefined,
      maxUses: 1,
      expiresAt: null,
      code: undefined,
    });
  });
});

describe("createInviteAction validation (runs before the DB)", () => {
  test.each([0, -1, 1.5, 1001])(
    "maxUses=%s is rejected legibly without an insert",
    async (bad) => {
      asAdmin();
      const res = await createInviteAction({ maxUses: bad });
      expect(res).toEqual({
        ok: false,
        error: expect.stringContaining("between 1 and 1000"),
      });
      expect(invites.createInvite).not.toHaveBeenCalled();
    },
  );

  test("a past expiry is rejected without an insert", async () => {
    asAdmin();
    const res = await createInviteAction({ expiresAt: "2020-01-01" });
    expect(res).toEqual({ ok: false, error: expect.stringContaining("today or later") });
    expect(invites.createInvite).not.toHaveBeenCalled();
  });

  test("an unparseable expiry is rejected without an insert", async () => {
    asAdmin();
    const res = await createInviteAction({ expiresAt: "not-a-date" });
    expect(res).toEqual({ ok: false, error: expect.stringContaining("valid date") });
    expect(invites.createInvite).not.toHaveBeenCalled();
  });

  test("a custom code with an illegal charset is rejected without an insert", async () => {
    asAdmin();
    const res = await createInviteAction({ code: "bad code!" });
    expect(res.ok).toBe(false);
    expect(invites.createInvite).not.toHaveBeenCalled();
  });

  test("a lowercase custom code is uppercased before insert (redeem is case-sensitive)", async () => {
    asAdmin();
    await createInviteAction({ code: "team-2026" });
    expect(invites.createInvite).toHaveBeenCalledWith(
      expect.objectContaining({ code: "TEAM-2026" }),
    );
  });

  test("a valid future expiry is forwarded as an end-of-day Date", async () => {
    asAdmin();
    await createInviteAction({ expiresAt: "2030-01-01" });
    expect(invites.createInvite).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: new Date("2030-01-01T23:59:59.999Z") }),
    );
  });

  test("an expiry of today is accepted (interpreted as end of day)", async () => {
    asAdmin();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T09:00:00Z"));
    try {
      await createInviteAction({ expiresAt: "2026-07-04" });
      expect(invites.createInvite).toHaveBeenCalledWith(
        expect.objectContaining({ expiresAt: new Date("2026-07-04T23:59:59.999Z") }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createInviteAction error surfacing", () => {
  test("a custom-code collision comes back as a legible result, not a masked throw", async () => {
    asAdmin();
    invites.createInvite.mockRejectedValueOnce(
      new invites.InviteCodeExistsError("That code already exists."),
    );
    const res = await createInviteAction({ code: "FOUNDER-01" });
    expect(res).toEqual({ ok: false, error: "That code already exists." });
  });

  test("an unexpected failure returns a generic message (no internals leaked)", async () => {
    asAdmin();
    vi.spyOn(console, "error").mockImplementation(() => {});
    invites.createInvite.mockRejectedValueOnce(new Error("connection refused"));
    const res = await createInviteAction({});
    expect(res).toEqual({
      ok: false,
      error: "Couldn't create the invite. Please try again.",
    });
  });
});
