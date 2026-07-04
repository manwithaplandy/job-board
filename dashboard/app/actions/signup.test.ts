import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// redirect() throws in Next; capture the destination and stop execution like the real one.
class RedirectError extends Error {
  constructor(public url: string) {
    super(`REDIRECT:${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Map<string, string>([["host", "app.test"]]),
}));

type RedeemResult = { ok: true } | { ok: false; reason: string };
const invites = vi.hoisted(() => ({
  redeemInvite: vi.fn(async (): Promise<RedeemResult> => ({ ok: true })),
  releaseInvite: vi.fn(async () => {}),
}));
vi.mock("@/lib/invites", () => invites);

const auth = vi.hoisted(() => ({ signUp: vi.fn(async () => ({ error: null })) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth }),
}));

const { signUp } = await import("@/app/actions/signup");

function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

async function runCatchRedirect(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof RedirectError) return e.url;
    throw e;
  }
  throw new Error("expected a redirect");
}

beforeEach(() => {
  invites.redeemInvite.mockClear();
  invites.releaseInvite.mockClear();
  auth.signUp.mockClear();
});
afterEach(() => vi.clearAllMocks());

describe("signUp disposable-email ordering (T7)", () => {
  test("a disposable email is rejected BEFORE redeemInvite and BEFORE any auth call", async () => {
    const url = await runCatchRedirect(
      signUp(fd({ email: "x@mailinator.com", password: "password123", invite_code: "CODE" })),
    );
    expect(url).toBe(`/signup?error=${encodeURIComponent("Please use a permanent email address.")}`);
    // The whole point: no invite burned, no Supabase account created.
    expect(invites.redeemInvite).not.toHaveBeenCalled();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  test("a subdomain of a disposable domain is also blocked before redeemInvite", async () => {
    const url = await runCatchRedirect(
      signUp(fd({ email: "a@sub.mailinator.com", password: "password123", invite_code: "CODE" })),
    );
    expect(url).toContain("permanent%20email");
    expect(invites.redeemInvite).not.toHaveBeenCalled();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  test("a permanent email proceeds to redeemInvite then the auth call", async () => {
    const url = await runCatchRedirect(
      signUp(fd({ email: "jane@gmail.com", password: "password123", invite_code: "CODE" })),
    );
    expect(url).toBe("/signup?sent=1");
    expect(invites.redeemInvite).toHaveBeenCalledOnce();
    expect(auth.signUp).toHaveBeenCalledOnce();
  });

  test("an invalid invite blocks the auth call (redeem fails first)", async () => {
    invites.redeemInvite.mockResolvedValueOnce({ ok: false, reason: "Invite code is invalid." });
    const url = await runCatchRedirect(
      signUp(fd({ email: "jane@gmail.com", password: "password123", invite_code: "BAD" })),
    );
    expect(url).toContain(encodeURIComponent("Invite code is invalid."));
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});
