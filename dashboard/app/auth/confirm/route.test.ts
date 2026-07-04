import type { EmailOtpType } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type VerifyResult = { error: null } | { error: { message: string } };
type VerifyArgs = { type: EmailOtpType; token_hash: string };

const supa = vi.hoisted(() => ({
  verifyOtp: vi.fn<(args: VerifyArgs) => Promise<VerifyResult>>(),
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    supa.createClient();
    return { auth: { verifyOtp: supa.verifyOtp } };
  },
}));

const { GET } = await import("@/app/auth/confirm/route");

const get = (query: string, headers?: Record<string, string>) =>
  GET(
    new Request(`https://app.example.com/auth/confirm${query}`, {
      headers: new Headers(headers),
    }),
  );

// The failure copy is routed to /login with an ?error= param; decode + assert semantics,
// not the encoded curly-quote form.
const errorParam = (loc: string | null) =>
  loc === null ? null : new URL(loc).searchParams.get("error");

beforeEach(() => {
  supa.verifyOtp.mockReset();
  supa.createClient.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("GET /auth/confirm — happy path", () => {
  test("valid token → verifyOtp with {type, token_hash}, 303 to next on request origin", async () => {
    supa.verifyOtp.mockResolvedValue({ error: null });
    const res = await get("?token_hash=abc&type=signup&next=/onboarding");
    expect(supa.verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "abc" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://app.example.com/onboarding");
  });

  test("no next param → defaults to origin root '/'", async () => {
    supa.verifyOtp.mockResolvedValue({ error: null });
    const res = await get("?token_hash=abc&type=recovery");
    expect(res.headers.get("location")).toBe("https://app.example.com/");
  });
});

describe("GET /auth/confirm — open-redirect guard on next", () => {
  test.each([
    ["absolute external", "https://evil.com"],
    ["protocol-relative", "//evil.com"],
    ["backslash-smuggled", "/ok\\evil"],
  ])("%s next falls back to '/'", async (_label, evil) => {
    supa.verifyOtp.mockResolvedValue({ error: null });
    const res = await get(`?token_hash=abc&type=signup&next=${encodeURIComponent(evil)}`);
    expect(res.headers.get("location")).toBe("https://app.example.com/");
  });
});

describe("GET /auth/confirm — forwarded-host origin resolution", () => {
  test("x-forwarded-proto/host win over the request URL origin", async () => {
    supa.verifyOtp.mockResolvedValue({ error: null });
    const res = await GET(
      new Request("http://localhost:3000/auth/confirm?token_hash=abc&type=signup&next=/onboarding", {
        headers: new Headers({
          "x-forwarded-proto": "https",
          "x-forwarded-host": "app.rolefit.io",
        }),
      }),
    );
    expect(res.headers.get("location")).toBe("https://app.rolefit.io/onboarding");
  });
});

describe("GET /auth/confirm — failure paths route to /login", () => {
  test("missing token_hash → verifyOtp NOT called, /login?error mentioning 'Forgot password'", async () => {
    const res = await get("?type=signup");
    expect(supa.verifyOtp).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
    const loc = res.headers.get("location");
    expect(new URL(loc!).pathname).toBe("/login");
    expect(errorParam(loc)).toContain("Forgot password");
  });

  test("missing type → verifyOtp NOT called, /login?error redirect", async () => {
    const res = await get("?token_hash=abc");
    expect(supa.verifyOtp).not.toHaveBeenCalled();
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  test("verifyOtp error (expired) → same /login?error redirect, no crash", async () => {
    supa.verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const res = await get("?token_hash=dead&type=signup&next=/onboarding");
    expect(supa.verifyOtp).toHaveBeenCalledOnce();
    expect(res.status).toBe(303);
    const loc = res.headers.get("location");
    expect(new URL(loc!).pathname).toBe("/login");
    expect(errorParam(loc)).toContain("Forgot password");
  });
});
