import { beforeEach, describe, expect, test, vi } from "vitest";

// Route-level test for GET /api/account/export (T2): anon → 401; authed → JSON
// attachment built ONLY from the caller's own claims (never an arbitrary target id),
// with private/no-store caching. buildAccountExport is mocked (its own tenancy scoping
// is unit-tested in lib/accountExport.test.ts).

const state = vi.hoisted(() => ({
  claims: null as { id: string; email: string | null } | null,
  builtFor: [] as string[],
}));

vi.mock("@/lib/auth", () => ({
  getUserClaims: vi.fn(async () => state.claims),
}));

vi.mock("@/lib/accountExport", () => ({
  buildAccountExport: vi.fn(async (userId: string, email: string | null) => {
    state.builtFor.push(userId);
    return { exported_at: "2026-07-04T00:00:00Z", user_id: userId, email, profiles: { user_id: userId } };
  }),
}));

const { GET } = await import("./route");

beforeEach(() => {
  state.claims = null;
  state.builtFor = [];
});

describe("GET /api/account/export", () => {
  test("401 for an anonymous caller", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
    expect(state.builtFor).toEqual([]);
  });

  test("authed → JSON attachment with no-store, built for the caller's own id", async () => {
    state.claims = { id: "user-a", email: "a@x.com" };
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; filename="rolefit-export-/);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    // The export id is derived ONLY from the verified claims — never a request param.
    expect(state.builtFor).toEqual(["user-a"]);
    const body = JSON.parse(await res.text());
    expect(body.user_id).toBe("user-a");
  });
});
