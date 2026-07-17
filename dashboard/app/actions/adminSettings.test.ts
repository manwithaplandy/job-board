import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
vi.mock("@/lib/auth", () => auth);
const settings = vi.hoisted(() => ({ saveInviteSettings: vi.fn(async () => {}) }));
vi.mock("@/lib/appSettings", () => settings);
const invites = vi.hoisted(() => ({ setInviteAllowance: vi.fn(async () => {}) }));
vi.mock("@/lib/invites", () => invites);

import { saveInviteSettingsAction, setInviteAllowanceAction } from "@/app/actions/adminSettings";

const OLD = process.env.ADMIN_EMAILS;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAILS = "op@example.com";
  auth.getUserClaims.mockResolvedValue({ id: "u-op", email: "op@example.com" });
});
afterEach(() => {
  if (OLD === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = OLD;
});

describe("admin gate FIRST (mirrors createInviteAction)", () => {
  test("non-admin throws before any write", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u-x", email: "stranger@x.com" });
    await expect(saveInviteSettingsAction({ compPlan: "standard", defaultAllowance: 3 })).rejects.toThrow();
    await expect(setInviteAllowanceAction({ userId: "8f14e45f-ceea-4a7b-9c6d-3d1c2b4a5e6f", remaining: 5 })).rejects.toThrow();
    expect(settings.saveInviteSettings).not.toHaveBeenCalled();
    expect(invites.setInviteAllowance).not.toHaveBeenCalled();
  });
});

describe("saveInviteSettingsAction", () => {
  test("valid input writes both keys atomically (one call, both values)", async () => {
    const r = await saveInviteSettingsAction({ compPlan: "pro", defaultAllowance: 5 });
    expect(r).toEqual({ ok: true });
    expect(settings.saveInviteSettings).toHaveBeenCalledTimes(1);
    expect(settings.saveInviteSettings).toHaveBeenCalledWith("pro", 5);
  });
  test("bad comp plan / bad allowance → legible errors, no writes", async () => {
    expect((await saveInviteSettingsAction({ compPlan: "platinum", defaultAllowance: 3 })).ok).toBe(false);
    expect((await saveInviteSettingsAction({ compPlan: "standard", defaultAllowance: 2.5 })).ok).toBe(false);
    expect((await saveInviteSettingsAction({ compPlan: "standard", defaultAllowance: -1 })).ok).toBe(false);
    expect(settings.saveInviteSettings).not.toHaveBeenCalled();
  });
  test("'none' is a valid comp plan", async () => {
    expect((await saveInviteSettingsAction({ compPlan: "none", defaultAllowance: 0 })).ok).toBe(true);
  });
});

describe("setInviteAllowanceAction", () => {
  test("valid input upserts", async () => {
    const r = await setInviteAllowanceAction({ userId: "8f14e45f-ceea-4a7b-9c6d-3d1c2b4a5e6f", remaining: 7 });
    expect(r).toEqual({ ok: true });
    expect(invites.setInviteAllowance).toHaveBeenCalledWith("8f14e45f-ceea-4a7b-9c6d-3d1c2b4a5e6f", 7);
  });
  test("bad uuid / bad remaining → legible errors, no writes", async () => {
    expect((await setInviteAllowanceAction({ userId: "not-a-uuid", remaining: 5 })).ok).toBe(false);
    expect((await setInviteAllowanceAction({ userId: "8f14e45f-ceea-4a7b-9c6d-3d1c2b4a5e6f", remaining: 1.5 })).ok).toBe(false);
    expect(invites.setInviteAllowance).not.toHaveBeenCalled();
  });
});
