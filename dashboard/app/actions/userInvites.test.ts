import { beforeEach, describe, expect, test, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
vi.mock("@/lib/auth", () => auth);
const subs = vi.hoisted(() => ({ getViewerPlan: vi.fn() }));
vi.mock("@/lib/subscriptions", () => subs);
const settings = vi.hoisted(() => ({
  loadAppSettings: vi.fn(async () => ({ inviteCompPlan: "standard", inviteDefaultAllowance: 3 })),
}));
vi.mock("@/lib/appSettings", () => settings);
const invites = vi.hoisted(() => ({
  getInviteAllowance: vi.fn(async () => ({ remaining: 2, granted: 3 })),
  createUserInvite: vi.fn(),
  releaseUserInvite: vi.fn(async () => {}),
  isInvitedUser: vi.fn<(email: string) => Promise<boolean>>(async () => false),
}));
vi.mock("@/lib/invites", () => invites);
type SesCfg = { region: string; from: string; accessKeyId: string; secretAccessKey: string };
const mail = vi.hoisted(() => ({
  sesConfig: vi.fn<() => SesCfg | null>(() => ({ region: "r", from: "f", accessKeyId: "k", secretAccessKey: "s" })),
  sendInviteEmail: vi.fn<() => Promise<{ ok: true } | { ok: false; error: string }>>(async () => ({ ok: true })),
}));
vi.mock("@/lib/inviteEmail", () => mail);
vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-proto", "https"], ["host", "rolefit.app"]]),
}));

import { generateInviteCodeAction, getInviteStatusAction, sendInvitesAction } from "@/app/actions/userInvites";

const invite = (code: string) => ({
  ok: true as const,
  invite: { code, note: null, maxUses: 1, uses: 0, expiresAt: null, createdAt: new Date(),
            createdBy: "u-1", recipientEmail: null, creatorEmail: null },
});

beforeEach(() => {
  vi.clearAllMocks();
  auth.getUserClaims.mockResolvedValue({ id: "u-1", email: "me@x.com" });
  subs.getViewerPlan.mockResolvedValue("standard");
  invites.getInviteAllowance.mockResolvedValue({ remaining: 2, granted: 3 });
  invites.isInvitedUser.mockResolvedValue(false);
  mail.sesConfig.mockReturnValue({ region: "r", from: "f", accessKeyId: "k", secretAccessKey: "s" });
  mail.sendInviteEmail.mockResolvedValue({ ok: true });
  settings.loadAppSettings.mockResolvedValue({ inviteCompPlan: "standard", inviteDefaultAllowance: 3 });
});

describe("gate ordering", () => {
  test("anonymous caller is rejected before ANY invite/db work", async () => {
    auth.getUserClaims.mockResolvedValue(null);
    const r = await sendInvitesAction("a@b.com");
    expect(r.ok).toBe(false);
    expect(invites.createUserInvite).not.toHaveBeenCalled();
    expect(mail.sendInviteEmail).not.toHaveBeenCalled();
  });
  test("null-plan caller (direct-API account) is rejected the same way", async () => {
    subs.getViewerPlan.mockResolvedValue(null);
    for (const r of [await sendInvitesAction("a@b.com"), await generateInviteCodeAction(), await getInviteStatusAction()]) {
      expect(r.ok).toBe(false);
    }
    expect(invites.createUserInvite).not.toHaveBeenCalled();
  });
});

describe("getInviteStatusAction", () => {
  test("returns allowance + email configuration", async () => {
    const r = await getInviteStatusAction();
    expect(r).toEqual({ ok: true, remaining: 2, granted: 3, emailConfigured: true });
  });
});

describe("sendInvitesAction", () => {
  test("unconfigured SES fails legibly BEFORE spending anything", async () => {
    mail.sesConfig.mockReturnValue(null);
    const r = await sendInvitesAction("a@b.com");
    expect(r.ok).toBe(false);
    expect(invites.createUserInvite).not.toHaveBeenCalled();
  });

  test("zero invites left → rejected up front, NO per-address membership-oracle work", async () => {
    invites.getInviteAllowance.mockResolvedValue({ remaining: 0, granted: 3 });
    const r = await sendInvitesAction("a@b.com c@d.com member@x.com");
    expect(r).toEqual({ ok: false, error: "You've used all your invites." });
    // None of the per-address probes/mints/sends ran — no free membership oracle.
    expect(invites.isInvitedUser).not.toHaveBeenCalled();
    expect(invites.createUserInvite).not.toHaveBeenCalled();
    expect(mail.sendInviteEmail).not.toHaveBeenCalled();
  });

  test("zero-spend pre-checks: invalid, disposable, already-member — nothing minted", async () => {
    invites.isInvitedUser.mockImplementation(async (e: string) => e === "member@x.com");
    const r = await sendInvitesAction("not-an-email member@x.com a@mailinator.com");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.results.map((x) => x.status)).toEqual(["skipped", "skipped", "skipped"]);
    expect(invites.createUserInvite).not.toHaveBeenCalled();
  });

  test("happy path: mints then sends per address, dedupes + lowercases", async () => {
    invites.createUserInvite
      .mockResolvedValueOnce(invite("RF-AAAA-1111"))
      .mockResolvedValueOnce(invite("RF-BBBB-2222"));
    const r = await sendInvitesAction("A@x.com, b@y.com\na@X.com");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.results).toHaveLength(2); // duplicate collapsed
    expect(r.results.every((x) => x.status === "sent")).toBe(true);
    expect(mail.sendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "a@x.com",
        link: "https://rolefit.app/signup?code=RF-AAAA-1111",
        inviterEmail: "me@x.com",
      }),
    );
  });

  test("SES failure → refund via releaseUserInvite, result 'failed'", async () => {
    invites.createUserInvite.mockResolvedValueOnce(invite("RF-AAAA-1111"));
    mail.sendInviteEmail.mockResolvedValueOnce({ ok: false, error: "send_failed" });
    const r = await sendInvitesAction("a@b.com");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.results[0].status).toBe("failed");
    expect(invites.releaseUserInvite).toHaveBeenCalledWith("RF-AAAA-1111", "u-1");
  });

  test("more than 20 addresses → rejected outright, nothing minted", async () => {
    const many = Array.from({ length: 21 }, (_, i) => `u${i}@x.com`).join(" ");
    const r = await sendInvitesAction(many);
    expect(r.ok).toBe(false);
    expect(invites.createUserInvite).not.toHaveBeenCalled();
  });

  test("exhausted mid-batch: remaining addresses are skipped, not attempted", async () => {
    invites.createUserInvite
      .mockResolvedValueOnce(invite("RF-AAAA-1111"))
      .mockResolvedValueOnce({ ok: false, reason: "exhausted" });
    const r = await sendInvitesAction("a@x.com b@y.com c@z.com");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.results.map((x) => x.status)).toEqual(["sent", "failed", "skipped"]);
    expect(invites.createUserInvite).toHaveBeenCalledTimes(2); // c@z.com never minted
  });
});

describe("generateInviteCodeAction", () => {
  test("mints and returns code + full signup link + fresh remaining", async () => {
    invites.createUserInvite.mockResolvedValueOnce(invite("RF-CCCC-3333"));
    invites.getInviteAllowance.mockResolvedValue({ remaining: 1, granted: 3 });
    const r = await generateInviteCodeAction();
    expect(r).toEqual({
      ok: true, code: "RF-CCCC-3333",
      link: "https://rolefit.app/signup?code=RF-CCCC-3333", remaining: 1,
    });
  });
  test("exhausted → the spec's zero-state copy", async () => {
    invites.createUserInvite.mockResolvedValueOnce({ ok: false, reason: "exhausted" });
    const r = await generateInviteCodeAction();
    expect(r).toEqual({ ok: false, error: "You've used all your invites." });
  });
});
