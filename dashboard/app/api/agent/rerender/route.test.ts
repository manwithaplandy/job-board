// POST /api/agent/rerender (plan Task 2.9). Every consumed module is mocked; the route's job
// is /api/agent's status contract, in its order, and that the user id comes only from the
// server session. rerenderSurface itself is lib/agent/rerender.test.ts.
import { beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => {
  class AccountDeletedError extends Error {}
  return {
    AccountDeletedError,
    getUserClaims: vi.fn(),
    getViewerPlan: vi.fn(),
    assertNotDeleted: vi.fn(),
    loadAppSettings: vi.fn(),
    checkBudget: vi.fn(),
    rerenderSurface: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({ getUserClaims: m.getUserClaims }));
vi.mock("@/lib/subscriptions", () => ({ getViewerPlan: m.getViewerPlan }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: m.assertNotDeleted, AccountDeletedError: m.AccountDeletedError }));
vi.mock("@/lib/appSettings", () => ({ loadAppSettings: m.loadAppSettings }));
vi.mock("@/lib/agent/budget", () => ({ checkBudget: m.checkBudget }));
vi.mock("@/lib/agent/rerender", () => ({ rerenderSurface: m.rerenderSurface }));

import { POST, dynamic, maxDuration } from "@/app/api/agent/rerender/route";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THREAD = "22222222-2222-4222-8222-222222222222";
const SURFACE = "33333333-3333-4333-8333-333333333333";
const NEW = "44444444-4444-4444-8444-444444444444";

const valid = { surfaceId: SURFACE, variant: 2 };

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/agent/rerender", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.getUserClaims.mockResolvedValue({ id: USER, email: "pat@example.com" });
  m.assertNotDeleted.mockResolvedValue(undefined);
  m.getViewerPlan.mockResolvedValue("standard");
  m.loadAppSettings.mockResolvedValue({ agentEnabled: true, agentVariant3Enabled: true });
  m.checkBudget.mockResolvedValue({ ok: true });
  // Only the session user's surface exists.
  m.rerenderSurface.mockImplementation(async (userId: string, a: { surfaceId: string; variant: number }) =>
    userId === USER && a.surfaceId === SURFACE
      ? { ok: true, surface: { id: NEW, threadId: THREAD, variant: a.variant } }
      : { ok: false, reason: "not_found" },
  );
});

type Case = [string, number, unknown, () => void, unknown?];

const cases: Case[] = [
  ["a cross-site request", 403, { error: "forbidden" }, () => {}],
  ["no session", 401, { error: "sign in" }, () => m.getUserClaims.mockResolvedValue(null)],
  ["an erased account", 401, { error: "sign in" }, () => m.assertNotDeleted.mockRejectedValue(new m.AccountDeletedError())],
  ["a variant outside 1 to 3", 400, { error: "bad_request" }, () => {}, { surfaceId: SURFACE, variant: 4 }],
  ["a malformed surface id", 400, { error: "bad_request" }, () => {}, { surfaceId: "x", variant: 2 }],
  ["an extra key (no user id from the body)", 400, { error: "bad_request" }, () => {}, { ...valid, userId: OTHER }],
  ["non-JSON", 400, { error: "bad_request" }, () => {}, "surfaceId=x"],
  ["no plan", 402, { error: "subscription_required" }, () => m.getViewerPlan.mockResolvedValue(null)],
  ["agent_enabled false", 503, { error: "agent_disabled" }, () => m.loadAppSettings.mockResolvedValue({ agentEnabled: false, agentVariant3Enabled: true })],
  ["the budget's kill switch", 503, { error: "agent_disabled" }, () => m.checkBudget.mockResolvedValue({ ok: false, reason: "agent_disabled" })],
  [
    "daily ceiling reached",
    429,
    { error: "agent_budget_exhausted", reason: "daily_ceiling" },
    () => m.checkBudget.mockResolvedValue({ ok: false, reason: "daily_ceiling" }),
  ],
  ["another user's surface", 404, { error: "not_found" }, () => m.getUserClaims.mockResolvedValue({ id: OTHER, email: null })],
  ["the model stored no surface", 500, { error: "rerender_failed" }, () => m.rerenderSurface.mockResolvedValue({ ok: false, reason: "failed" })],
];

describe("POST /api/agent/rerender", () => {
  test("exports the route config", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(maxDuration).toBe(300);
  });

  test.each(cases)("%s answers %i", async (name, status, body, arrange, payload) => {
    arrange();
    const res = await POST(post(payload ?? valid, name === "a cross-site request" ? { "sec-fetch-site": "cross-site" } : {}));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual(body);
    if (status !== 404 && status !== 500) {
      // Refused before any re-render ran.
      expect(m.rerenderSurface).not.toHaveBeenCalled();
    }
  });

  test("a valid request re-renders as the session user and answers the new surface", async () => {
    const res = await POST(post(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ surfaceId: NEW, threadId: THREAD, variant: 2 });
    expect(m.rerenderSurface).toHaveBeenCalledWith(USER, { surfaceId: SURFACE, variant: 2, email: "pat@example.com", variant3Enabled: true });
  });

  test("variant 3 is refused with 400 while it is switched off, before any spend; other variants still run", async () => {
    m.loadAppSettings.mockResolvedValue({ agentEnabled: true, agentVariant3Enabled: false });
    const res = await POST(post({ surfaceId: SURFACE, variant: 3 }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
    expect(m.checkBudget).not.toHaveBeenCalled();
    expect(m.rerenderSurface).not.toHaveBeenCalled();
    expect((await POST(post({ surfaceId: SURFACE, variant: 1 }))).status).toBe(200);
  });

  test("a ceiling reached between the pre-check and the run is still a 429", async () => {
    m.rerenderSurface.mockResolvedValue({ ok: false, reason: "budget", budget: { ok: false, reason: "monthly_ceiling" } });
    const res = await POST(post(valid));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "agent_budget_exhausted", reason: "monthly_ceiling" });
  });
});
