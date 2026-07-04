import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { parseBoardFilters, serializeBoardFilters } from "@/lib/rolefit/boardFilters";

// next/headers cookies() is faked with a store that records set() calls; auth +
// saveBoardFilters are boundaries. parseBoardFilters/serializeBoardFilters run for
// real so the cookie value is exactly what the parser round-trips.
const mocks = vi.hoisted(() => ({
  getUserId: vi.fn(),
  saveBoardFilters: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet }),
}));
vi.mock("@/lib/auth", () => ({ getUserId: mocks.getUserId }));
vi.mock("@/lib/queries", () => ({ saveBoardFilters: mocks.saveBoardFilters }));

import { POST } from "@/app/api/board-filters/route";

function req(body: unknown, site?: string) {
  const headers: Record<string, string> = {};
  if (site !== undefined) headers["sec-fetch-site"] = site;
  return new Request("http://localhost/api/board-filters", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = { search: "eng", cats: ["Backend"], remote: "remote", minFit: 70, sort: "pay" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserId.mockResolvedValue(null);
  mocks.saveBoardFilters.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/board-filters — CSRF guard", () => {
  test("cross-site → 403 and no persistence", async () => {
    const res = await POST(req(validBody, "cross-site"));
    expect(res.status).toBe(403);
    expect(mocks.saveBoardFilters).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  for (const site of ["same-origin", "none", undefined]) {
    test(`sec-fetch-site=${site ?? "(absent)"} is allowed`, async () => {
      const res = await POST(req(validBody, site));
      expect(res.status).toBe(200);
    });
  }
});

describe("POST /api/board-filters — persistence", () => {
  test("authed → saveBoardFilters(userId, parsedFilters), no cookie", async () => {
    mocks.getUserId.mockResolvedValue("user-uuid");
    const res = await POST(req(validBody, "same-origin"));
    expect(res.status).toBe(200);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    const [uid, filters] = mocks.saveBoardFilters.mock.calls[0];
    expect(uid).toBe("user-uuid");
    // The real parser output — a regression that persisted the raw body would fail
    // this (e.g. unbounded search, junk sort).
    expect(filters).toEqual(parseBoardFilters(validBody));
    expect(filters.sort).toBe("pay");
  });

  test("anon → cookie set with serialized filters and hardened attributes", async () => {
    mocks.getUserId.mockResolvedValue(null);
    const res = await POST(req(validBody, "same-origin"));
    expect(res.status).toBe(200);
    expect(mocks.saveBoardFilters).not.toHaveBeenCalled();
    const [name, value, opts] = mocks.cookieSet.mock.calls[0];
    expect(name).toBe("board_filters");
    expect(value).toBe(serializeBoardFilters(parseBoardFilters(validBody)));
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.maxAge).toBe(60 * 60 * 24 * 180);
  });
});

describe("POST /api/board-filters — total-parser robustness", () => {
  test("malformed JSON body → defaults persisted, 200", async () => {
    mocks.getUserId.mockResolvedValue("user-uuid");
    const res = await POST(req("{not json", "same-origin"));
    expect(res.status).toBe(200);
    expect(mocks.saveBoardFilters.mock.calls[0][1]).toEqual(parseBoardFilters(null));
  });

  test("string-scalar / junk body never throws, persists defaults", async () => {
    mocks.getUserId.mockResolvedValue("user-uuid");
    // A JSON string scalar (double-encoded write shape) — parseBoardFilters must
    // coalesce to defaults rather than crash.
    const res = await POST(req(JSON.stringify("just a string"), "same-origin"));
    expect(res.status).toBe(200);
    expect(mocks.saveBoardFilters.mock.calls[0][1]).toEqual(parseBoardFilters("just a string"));
  });

  test("persistence failure never blocks filtering → 200 { ok:false }", async () => {
    mocks.getUserId.mockResolvedValue("user-uuid");
    mocks.saveBoardFilters.mockRejectedValue(new Error("db down"));
    const res = await POST(req(validBody, "same-origin"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false });
  });
});
