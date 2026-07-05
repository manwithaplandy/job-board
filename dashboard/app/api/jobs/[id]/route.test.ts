import { beforeEach, describe, expect, test, vi } from "vitest";

// The DB read is the only boundary; the JOB_ID_RE gate runs for real so we actually test
// the injection/abuse shield. The SaaS cutover made this route VIEWER-SCOPED: it resolves
// getUserId() and passes it into getJobReviewDetail(id, viewerId), and flips Cache-Control
// from a shared-CDN `public` cache to `private, no-store` (a tenant-leak guard).
const mocks = vi.hoisted(() => ({ getJobReviewDetail: vi.fn(), getUserId: vi.fn() }));
vi.mock("@/lib/queries", () => ({ getJobReviewDetail: mocks.getJobReviewDetail }));
vi.mock("@/lib/auth", () => ({ getUserId: mocks.getUserId }));

import { GET } from "@/app/api/jobs/[id]/route";

const VIEWER = "11111111-1111-1111-1111-111111111111";

function call(id: string) {
  return GET(new Request(`http://localhost/api/jobs/${id}`), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getJobReviewDetail.mockResolvedValue(null);
  mocks.getUserId.mockResolvedValue(VIEWER);
});

describe("GET /api/jobs/[id] — id validation gate", () => {
  const bad = ["abc", "1; DROP TABLE jobs", "", "café:x:y", "green house:a:b", "a:b"];
  for (const id of bad) {
    test(`malformed id ${JSON.stringify(id)} → 404, no DB hit, no auth`, async () => {
      const res = await call(id);
      expect(res.status).toBe(404);
      // The gate short-circuits BEFORE the DB (and before auth) — a regression that
      // queried first would expose the DB to arbitrary ids.
      expect(mocks.getJobReviewDetail).not.toHaveBeenCalled();
      expect(mocks.getUserId).not.toHaveBeenCalled();
    });
  }

  test("valid id reaches the DB scoped to the VIEWER's id", async () => {
    await call("greenhouse:acme:123");
    // Tenant scoping is the load-bearing new contract: the viewer id must reach the query.
    expect(mocks.getJobReviewDetail).toHaveBeenCalledWith("greenhouse:acme:123", VIEWER);
  });

  test("workday path-style id (slashes/percent) is accepted and viewer-scoped", async () => {
    const id = "workday:acme:/job/San-Francisco/Engineer_R-123";
    const res = await call(id);
    expect(res.status).toBe(200);
    expect(mocks.getJobReviewDetail).toHaveBeenCalledWith(id, VIEWER);
  });
});

describe("GET /api/jobs/[id] — anti-error contract survives multi-tenancy", () => {
  test("anonymous visitor → viewerId=null passed through, still 200 with the full EMPTY shape", async () => {
    mocks.getUserId.mockResolvedValue(null);
    mocks.getJobReviewDetail.mockResolvedValue(null);
    const res = await call("greenhouse:acme:123");
    expect(res.status).toBe(200);
    expect(mocks.getJobReviewDetail).toHaveBeenCalledWith("greenhouse:acme:123", null);
    const body = await res.json();
    expect(body).toEqual({
      reasoning: null, about: null, red_flags: null, benefits: null, requirements: null,
      description: null, url: null, experience_match: null, industry: null,
      industry_subcategory: null, confidence: null, note: null, corrected: false,
    });
  });

  test("detail present → passthrough body", async () => {
    const detail = { reasoning: "great fit", about: "acme", corrected: true, url: "https://x" };
    mocks.getJobReviewDetail.mockResolvedValue(detail);
    const res = await call("greenhouse:acme:123");
    expect(await res.json()).toEqual(detail);
  });

  test("viewer-scoped body is never CDN-cacheable (private, no-store — tenant-leak guard)", async () => {
    const res = await call("greenhouse:acme:123");
    // A `public` s-maxage cache would let a shared CDN serve one tenant's review to
    // another. The header MUST stay private + uncached.
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
