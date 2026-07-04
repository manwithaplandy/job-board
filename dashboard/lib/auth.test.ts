import { beforeEach, describe, expect, test, vi } from "vitest";

// getUserClaims/getUserId are the tenant-resolution primitives every route + action now
// depends on. The load-bearing rules: the user id is the JWT `sub` claim; a claims object
// WITHOUT sub collapses to null (not a partial identity); a missing email is null (not
// undefined). The Supabase client is the only boundary.
const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { getUserId, getUserClaims } from "@/lib/auth";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ auth: { getClaims: mocks.getClaims } });
});

describe("getUserClaims", () => {
  test("extracts {id: sub, email} from verified claims", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "u-1", email: "a@x.com" } } });
    expect(await getUserClaims()).toEqual({ id: "u-1", email: "a@x.com" });
  });

  test("sub present but no email → email is null (not undefined)", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "u-1" } } });
    const claims = await getUserClaims();
    expect(claims).toEqual({ id: "u-1", email: null });
    // Explicit null matters: downstream (isInvitedUser gate) branches on email == null.
    expect(claims?.email).toBeNull();
  });

  test("claims without a sub → null (no partially-formed identity)", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { email: "a@x.com" } } });
    expect(await getUserClaims()).toBeNull();
  });

  test("no data (anonymous) → null", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });
    expect(await getUserClaims()).toBeNull();
  });
});

describe("getUserId", () => {
  test("returns exactly the sub string", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "u-9", email: "a@x.com" } } });
    expect(await getUserId()).toBe("u-9");
  });

  test("no sub → null", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} } });
    expect(await getUserId()).toBeNull();
  });
});
