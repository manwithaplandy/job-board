import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
vi.mock("@/lib/auth", () => auth);
const settings = vi.hoisted(() => ({ saveInviteSettings: vi.fn(async () => {}) }));
vi.mock("@/lib/appSettings", () => settings);
const invites = vi.hoisted(() => ({ setInviteAllowance: vi.fn(async () => {}) }));
vi.mock("@/lib/invites", () => invites);
const overrides = vi.hoisted(() => ({
  setPlanOverride: vi.fn(async () => {}),
  clearPlanOverride: vi.fn(async () => {}),
}));
vi.mock("@/lib/planOverrides", () => overrides);

import {
  saveInviteSettingsAction,
  setInviteAllowanceAction,
  setPlanOverrideAction,
} from "@/app/actions/adminSettings";

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
    await expect(
      setPlanOverrideAction({ userId: "8f14e45f-ceea-4a7b-9c6d-3d1c2b4a5e6f", plan: "pro", expiresAt: "", note: "" }),
    ).rejects.toThrow();
    expect(settings.saveInviteSettings).not.toHaveBeenCalled();
    expect(invites.setInviteAllowance).not.toHaveBeenCalled();
    expect(overrides.setPlanOverride).not.toHaveBeenCalled();
    expect(overrides.clearPlanOverride).not.toHaveBeenCalled();
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

describe("setPlanOverrideAction", () => {
  const UID = "8f14e45f-ceea-4a7b-9c6d-3d1c2b4a5e6f";

  test("valid set upserts with UTC-midnight expiry and trimmed note", async () => {
    const r = await setPlanOverrideAction({ userId: UID, plan: "pro", expiresAt: "2099-01-02", note: " beta comp " });
    expect(r).toEqual({ ok: true });
    expect(overrides.setPlanOverride).toHaveBeenCalledWith(UID, "pro", new Date("2099-01-02T00:00:00Z"), "beta comp");
  });

  test("no expiry and empty note are stored as nulls", async () => {
    await setPlanOverrideAction({ userId: UID, plan: "standard", expiresAt: "", note: "" });
    expect(overrides.setPlanOverride).toHaveBeenCalledWith(UID, "standard", null, null);
  });

  test("empty plan clears the pin (never upserts)", async () => {
    const r = await setPlanOverrideAction({ userId: UID, plan: "", expiresAt: "", note: "" });
    expect(r).toEqual({ ok: true });
    expect(overrides.clearPlanOverride).toHaveBeenCalledWith(UID);
    expect(overrides.setPlanOverride).not.toHaveBeenCalled();
  });

  test("bad uuid / bad plan / malformed or past expiry / oversized note → legible errors, no writes", async () => {
    expect((await setPlanOverrideAction({ userId: "nope", plan: "pro", expiresAt: "", note: "" })).ok).toBe(false);
    expect((await setPlanOverrideAction({ userId: UID, plan: "platinum", expiresAt: "", note: "" })).ok).toBe(false);
    expect((await setPlanOverrideAction({ userId: UID, plan: "pro", expiresAt: "someday", note: "" })).ok).toBe(false);
    expect((await setPlanOverrideAction({ userId: UID, plan: "pro", expiresAt: "2001-01-01", note: "" })).ok).toBe(false);
    expect((await setPlanOverrideAction({ userId: UID, plan: "pro", expiresAt: "", note: "x".repeat(201) })).ok).toBe(false);
    expect(overrides.setPlanOverride).not.toHaveBeenCalled();
    expect(overrides.clearPlanOverride).not.toHaveBeenCalled();
  });
});
