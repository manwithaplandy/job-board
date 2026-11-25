import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
vi.mock("@/lib/auth", () => auth);
const settings = vi.hoisted(() => ({
  saveInviteSettings: vi.fn(async () => {}),
  saveAgentSettings: vi.fn(async () => {}),
}));
// The real validator; only the writes are stubbed.
vi.mock("@/lib/appSettings", async (importOriginal) => ({
  isValidAgentCeiling: (await importOriginal<typeof import("@/lib/appSettings")>()).isValidAgentCeiling,
  ...settings,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
const invites = vi.hoisted(() => ({ setInviteAllowance: vi.fn(async () => {}) }));
vi.mock("@/lib/invites", () => invites);
const overrides = vi.hoisted(() => ({
  setPlanOverride: vi.fn(async () => {}),
  clearPlanOverride: vi.fn(async () => {}),
}));
vi.mock("@/lib/planOverrides", () => overrides);

import {
  saveAgentSettingsAction,
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

describe("saveAgentSettingsAction", () => {
  const valid = {
    agentEnabled: true,
    agentBackgroundEnabled: false,
    agentVariant3Enabled: true,
    agentDailyCeilingMicros: 500_000,
    agentMonthlyCeilingMicros: 5_000_000,
  };
  test("non-admin throws before any write", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u-x", email: "stranger@x.com" });
    await expect(saveAgentSettingsAction(valid)).rejects.toThrow();
    expect(settings.saveAgentSettings).not.toHaveBeenCalled();
  });
  test("valid input saves all five values in one call", async () => {
    expect(await saveAgentSettingsAction(valid)).toEqual({ ok: true });
    expect(settings.saveAgentSettings).toHaveBeenCalledTimes(1);
    expect(settings.saveAgentSettings).toHaveBeenCalledWith(valid);
  });
  test("a bad ceiling or a non-boolean switch is refused with no write", async () => {
    expect((await saveAgentSettingsAction({ ...valid, agentDailyCeilingMicros: -1 })).ok).toBe(false);
    expect((await saveAgentSettingsAction({ ...valid, agentMonthlyCeilingMicros: 1_000_000_001 })).ok).toBe(false);
    expect((await saveAgentSettingsAction({ ...valid, agentDailyCeilingMicros: Number.NaN })).ok).toBe(false);
    expect((await saveAgentSettingsAction({ ...valid, agentDailyCeilingMicros: 0.5 })).ok).toBe(false);
    const notBool: unknown = "true";
    expect((await saveAgentSettingsAction({ ...valid, agentEnabled: notBool as boolean })).ok).toBe(false);
    expect(settings.saveAgentSettings).not.toHaveBeenCalled();
  });
  test("an Infinity ceiling is refused before any write", async () => {
    expect((await saveAgentSettingsAction({ ...valid, agentDailyCeilingMicros: Number.POSITIVE_INFINITY })).ok).toBe(false);
    expect((await saveAgentSettingsAction({ ...valid, agentMonthlyCeilingMicros: Number.POSITIVE_INFINITY })).ok).toBe(
      false,
    );
    expect(settings.saveAgentSettings).not.toHaveBeenCalled();
  });
  test("a daily ceiling above the monthly ceiling is refused with no write", async () => {
    const r = await saveAgentSettingsAction({ ...valid, agentDailyCeilingMicros: 6_000_000, agentMonthlyCeilingMicros: 5_000_000 });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/daily.*monthly/i) });
    expect(settings.saveAgentSettings).not.toHaveBeenCalled();
    // Equal ceilings are allowed.
    expect(
      (await saveAgentSettingsAction({ ...valid, agentDailyCeilingMicros: 5_000_000, agentMonthlyCeilingMicros: 5_000_000 })).ok,
    ).toBe(true);
  });
  test("a zero ceiling is allowed (it stops all spend)", async () => {
    expect((await saveAgentSettingsAction({ ...valid, agentDailyCeilingMicros: 0 })).ok).toBe(true);
  });
  test("a failed write is reported, not thrown", async () => {
    settings.saveAgentSettings.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await saveAgentSettingsAction(valid)).ok).toBe(false);
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
