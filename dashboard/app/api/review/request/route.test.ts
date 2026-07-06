import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUserClaims: vi.fn() }));
vi.mock("@/lib/auth", () => auth);

const subs = vi.hoisted(() => ({ getViewerPlan: vi.fn() }));
vi.mock("@/lib/subscriptions", () => subs);

const rr = vi.hoisted(() => ({
  enqueueReviewRequest: vi.fn(),
  getLatestReviewRequest: vi.fn(),
  remainingDailyBudget: vi.fn(),
  reviewsChargedToday: vi.fn(),
}));
vi.mock("@/lib/reviewRequests", () => rr);

const { GET, POST } = await import("@/app/api/review/request/route");

beforeEach(() => {
  auth.getUserClaims.mockReset();
  subs.getViewerPlan.mockReset();
  rr.enqueueReviewRequest.mockReset();
  rr.getLatestReviewRequest.mockReset();
  rr.remainingDailyBudget.mockReset();
  rr.reviewsChargedToday.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/review/request", () => {
  test("401 for anon", async () => {
    auth.getUserClaims.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  test("authed GET returns status/remaining/plan/reviewedToday with no-store", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "u1@x.com" });
    subs.getViewerPlan.mockResolvedValue("standard");
    rr.getLatestReviewRequest.mockResolvedValue({ status: "running" });
    rr.remainingDailyBudget.mockResolvedValue(7);
    rr.reviewsChargedToday.mockResolvedValue(3);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await res.json();
    expect(body).toEqual({ status: "running", remaining: 7, plan: "standard", reviewedToday: 3 });
  });

  test("null latest request → status null, progress figure still present", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: null });
    subs.getViewerPlan.mockResolvedValue(null);
    rr.getLatestReviewRequest.mockResolvedValue(null);
    rr.remainingDailyBudget.mockResolvedValue(0);
    rr.reviewsChargedToday.mockResolvedValue(0);

    const res = await GET();
    const body = await res.json();
    expect(body.status).toBeNull();
    expect(body.reviewedToday).toBe(0);
  });
});

describe("POST /api/review/request", () => {
  test("401 for anon", async () => {
    auth.getUserClaims.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  test("402 when the viewer has no plan — body carries the upsell's machine code", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "u1@x.com" });
    subs.getViewerPlan.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain("Subscribe");
    expect(body.code).toBe("subscription_required");
  });

  test("409 when the daily budget is spent — body carries code + plan for the upsell", async () => {
    auth.getUserClaims.mockResolvedValue({ id: "u1", email: "u1@x.com" });
    subs.getViewerPlan.mockResolvedValue("standard");
    rr.remainingDailyBudget.mockResolvedValue(0);
    const res = await POST();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("Daily review budget used");
    expect(body.code).toBe("review_budget_exhausted");
    expect(body.plan).toBe("standard");
    expect(body.remaining).toBe(0);
    expect(rr.enqueueReviewRequest).not.toHaveBeenCalled();
  });
});
