import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Boundary mock: the supabase server client. signOut resolves cleanly; the test asserts
// on whether it's CALLED (the CSRF-guard contract), not on its internals.
const supa = vi.hoisted(() => ({
  signOut: vi.fn<() => Promise<{ error: null }>>().mockResolvedValue({ error: null }),
  createClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    supa.createClient();
    return { auth: { signOut: supa.signOut } };
  },
}));

const { POST } = await import("@/app/auth/signout/route");

const post = (site?: string) => {
  const headers = new Headers();
  if (site !== undefined) headers.set("sec-fetch-site", site);
  return POST(new Request("https://app.example.com/auth/signout", { method: "POST", headers }));
};

beforeEach(() => {
  supa.signOut.mockClear();
  supa.createClient.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("POST /auth/signout — CSRF guard", () => {
  test("sec-fetch-site 'cross-site' → 403 { error: 'forbidden' } and signOut NOT called", async () => {
    const res = await post("cross-site");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    // Security-critical: the session must not be touched on a rejected cross-site POST.
    expect(supa.signOut).not.toHaveBeenCalled();
  });

  test("sec-fetch-site 'same-site' (subdomain-initiated) → 403, signOut NOT called", async () => {
    const res = await post("same-site");
    expect(res.status).toBe(403);
    expect(supa.signOut).not.toHaveBeenCalled();
  });
});

describe("POST /auth/signout — allowed origins", () => {
  test("'same-origin' → signOut once, EXACTLY 303, Location /login on the request origin", async () => {
    const res = await post("same-origin");
    expect(supa.signOut).toHaveBeenCalledTimes(1);
    // 303 (not the default 307): the browser GETs /login instead of re-POSTing the form.
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://app.example.com/login");
  });

  test("header absent (curl / legacy browsers) → allowed: signOut once, 303", async () => {
    const res = await post(undefined);
    expect(supa.signOut).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://app.example.com/login");
  });

  test("'none' (direct navigation) → allowed: signOut once, 303", async () => {
    const res = await post("none");
    expect(supa.signOut).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(303);
  });
});
