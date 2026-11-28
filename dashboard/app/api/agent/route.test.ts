// POST /api/agent (plan Task 0.13). Every consumed module is mocked; the route's job is
// the order of its gates and that the user id comes only from the server session.
import { beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => {
  class TurnInProgressError extends Error {}
  class TurnInputError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  class AccountDeletedError extends Error {}
  return {
    TurnInProgressError,
    TurnInputError,
    AccountDeletedError,
    getUserClaims: vi.fn(),
    getViewerPlan: vi.fn(),
    assertNotDeleted: vi.fn(),
    loadAppSettings: vi.fn(),
    checkBudget: vi.fn(),
    getThread: vi.fn(),
    streamAgentTurn: vi.fn(),
    // agent_surfaces rows the stubbed withUserSql serves: the real store runs over them.
    surfaces: [] as Record<string, unknown>[],
  };
});

vi.mock("@/lib/auth", () => ({ getUserClaims: m.getUserClaims }));
vi.mock("@/lib/subscriptions", () => ({ getViewerPlan: m.getViewerPlan }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: m.assertNotDeleted, AccountDeletedError: m.AccountDeletedError }));
vi.mock("@/lib/appSettings", () => ({ loadAppSettings: m.loadAppSettings }));
vi.mock("@/lib/agent/budget", () => ({ checkBudget: m.checkBudget }));
vi.mock("@/lib/agent/threads", () => ({ getThread: m.getThread }));
vi.mock("@/lib/agent/runs", () => ({ TurnInProgressError: m.TurnInProgressError }));
vi.mock("@/lib/agent/loop", () => ({ streamAgentTurn: m.streamAgentTurn, TurnInputError: m.TurnInputError }));
// getSurface binds [id, userId]; the stub answers the rows that match both, the way the
// query's WHERE clause does.
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_userId: string, fn: (t: unknown) => Promise<unknown>) =>
    fn((_strings: TemplateStringsArray, ...values: unknown[]) =>
      Promise.resolve(m.surfaces.filter((r) => r.id === values[0] && r.user_id === values[1])),
    ),
  ),
}));

import { POST, dynamic, maxDuration } from "@/app/api/agent/route";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THREAD = "22222222-2222-4222-8222-222222222222";
const DOC = "33333333-3333-4333-8333-333333333333";
const thread = {
  id: THREAD,
  title: "New conversation",
  variant: 1,
  summary: null,
  createdAt: "2026-11-25T00:00:00.000Z",
  updatedAt: "2026-11-25T00:00:00.000Z",
};

const valid = { threadId: THREAD, kind: "message", id: "m-1", text: "What did you review today?" };

function post(body: unknown): Request {
  return new Request("http://localhost/api/agent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.getUserClaims.mockResolvedValue({ id: USER, email: "pat@example.com" });
  m.assertNotDeleted.mockResolvedValue(undefined);
  m.getViewerPlan.mockResolvedValue("standard");
  m.loadAppSettings.mockResolvedValue({ agentEnabled: true, agentVariant3Enabled: true });
  m.checkBudget.mockResolvedValue({ ok: true, remainingMicros: 1_000_000 });
  m.getThread.mockImplementation(async (userId: string, id: string) => (userId === USER && id === THREAD ? thread : null));
  m.streamAgentTurn.mockResolvedValue(new Response("stream", { status: 200 }));
  m.surfaces = [];
});

type Case = [string, number, () => void, unknown?];

const cases: Case[] = [
  ["no session", 401, () => m.getUserClaims.mockResolvedValue(null)],
  ["text of 8001 chars", 400, () => {}, { ...valid, text: "x".repeat(8001) }],
  ["five documentIds", 400, () => {}, { ...valid, documentIds: [DOC, DOC, DOC, DOC, DOC] }],
  ["no plan", 402, () => m.getViewerPlan.mockResolvedValue(null)],
  ["agent_enabled false", 503, () => m.loadAppSettings.mockResolvedValue({ agentEnabled: false })],
  ["daily ceiling reached", 429, () => m.checkBudget.mockResolvedValue({ ok: false, reason: "daily_ceiling" })],
  ["thread of another user", 404, () => m.getUserClaims.mockResolvedValue({ id: OTHER, email: null })],
  ["turn in progress", 409, () => m.streamAgentTurn.mockRejectedValue(new m.TurnInProgressError())],
];

describe("POST /api/agent", () => {
  test("exports the route config", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(maxDuration).toBe(300);
  });

  test.each(cases)("%s -> %i", async (_name, status, arrange, body = valid) => {
    arrange();
    const res = await POST(post(body));
    expect(res.status).toBe(status);
    if (status !== 409) expect(m.streamAgentTurn).not.toHaveBeenCalled();
  });

  test("the error bodies carry the contract's codes", async () => {
    expect(await (await POST(post({ ...valid, text: "" }))).json()).toEqual({ error: "bad_request" });

    m.getViewerPlan.mockResolvedValue(null);
    expect(await (await POST(post(valid))).json()).toEqual({ error: "subscription_required" });
    m.getViewerPlan.mockResolvedValue("standard");

    m.loadAppSettings.mockResolvedValue({ agentEnabled: false });
    expect(await (await POST(post(valid))).json()).toEqual({ error: "agent_disabled" });
    m.loadAppSettings.mockResolvedValue({ agentEnabled: true });

    m.checkBudget.mockResolvedValue({ ok: false, reason: "monthly_ceiling" });
    expect(await (await POST(post(valid))).json()).toEqual({ error: "agent_budget_exhausted", reason: "monthly_ceiling" });
    m.checkBudget.mockResolvedValue({ ok: true, remainingMicros: 1 });

    m.streamAgentTurn.mockRejectedValueOnce(new m.TurnInProgressError());
    expect(await (await POST(post(valid))).json()).toEqual({ error: "turn_in_progress" });
  });

  test("the kill switch read by checkBudget also answers 503, never 429", async () => {
    m.checkBudget.mockResolvedValue({ ok: false, reason: "agent_disabled" });
    const res = await POST(post(valid));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "agent_disabled" });
  });

  test("the plan gate comes before the kill switch and the budget", async () => {
    m.getViewerPlan.mockResolvedValue(null);
    m.loadAppSettings.mockResolvedValue({ agentEnabled: false });
    expect((await POST(post(valid))).status).toBe(402);
    expect(m.checkBudget).not.toHaveBeenCalled();
  });

  test("a valid message calls streamAgentTurn once with the session user, never a body-supplied id", async () => {
    const res = await POST(post(valid));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("stream");
    expect(m.getViewerPlan).toHaveBeenCalledWith(USER, "pat@example.com");
    expect(m.checkBudget).toHaveBeenCalledWith(USER);
    expect(m.getThread).toHaveBeenCalledWith(USER, THREAD);
    expect(m.streamAgentTurn).toHaveBeenCalledTimes(1);
    expect(m.streamAgentTurn).toHaveBeenCalledWith({
      userId: USER,
      email: "pat@example.com",
      thread,
      input: { kind: "message", id: "m-1", text: valid.text, documentIds: [] },
      variant3Enabled: true,
    });
  });

  test("Task 2.8: the operator's variant 3 switch goes with the turn", async () => {
    m.loadAppSettings.mockResolvedValue({ agentEnabled: true, agentVariant3Enabled: false });
    await POST(post(valid));
    expect(m.streamAgentTurn).toHaveBeenCalledWith(expect.objectContaining({ variant3Enabled: false }));
  });

  test("a body with an extra userId field is rejected", async () => {
    const res = await POST(post({ ...valid, userId: OTHER }));
    expect(res.status).toBe(400);
    expect(m.getThread).not.toHaveBeenCalled();
    expect(m.streamAgentTurn).not.toHaveBeenCalled();
  });

  test.each([
    ["malformed JSON", "{not json"],
    ["a non-uuid threadId", { ...valid, threadId: "t-1" }],
    ["an unknown kind", { ...valid, kind: "tool" }],
    ["an id of 65 chars", { ...valid, id: "x".repeat(65) }],
    ["an empty id", { ...valid, id: "" }],
    ["a non-uuid document id", { ...valid, documentIds: ["doc"] }],
    ["an array body", [valid]],
    ["an approval without approved", { threadId: THREAD, kind: "approval", approvalId: "a1" }],
    ["client-sent message parts", { ...valid, parts: [{ type: "text", text: "x" }] }],
    ["a retry that carries text", { threadId: THREAD, kind: "retry", id: "m-1", text: "changed" }],
    ["a retry without an id", { threadId: THREAD, kind: "retry" }],
  ])("%s is a 400", async (_name, body) => {
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
  });

  test("an approval is parsed and passed on as an approval input", async () => {
    await POST(post({ threadId: THREAD, kind: "approval", approvalId: "a1", approved: true }));
    expect(m.streamAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({ input: { kind: "approval", approvalId: "a1", approved: true } }),
    );
  });

  test("a retry is parsed and passed on as a retry input (PR K2)", async () => {
    await POST(post({ threadId: THREAD, kind: "retry", id: "m-1" }));
    expect(m.streamAgentTurn).toHaveBeenCalledWith(expect.objectContaining({ input: { kind: "retry", id: "m-1" } }));
  });

  test("a turn input the loop rejects is a 400", async () => {
    m.streamAgentTurn.mockRejectedValue(new m.TurnInputError("unknown_document"));
    const res = await POST(post({ ...valid, documentIds: [DOC] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
  });

  test("an approval the loop cannot match to a pending part is a 400 (Task 1.16)", async () => {
    m.streamAgentTurn.mockRejectedValue(new m.TurnInputError("approval_not_found"));
    const res = await POST(post({ threadId: THREAD, kind: "approval", approvalId: "stale", approved: true }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
  });

  test("a deleted account is refused before the body is read", async () => {
    m.assertNotDeleted.mockRejectedValue(new m.AccountDeletedError());
    const res = await POST(post(valid));
    expect(res.status).toBe(401);
    expect(m.getViewerPlan).not.toHaveBeenCalled();
  });

  test("an unexpected failure is rethrown, not answered as a client error", async () => {
    m.streamAgentTurn.mockRejectedValue(new Error("db down"));
    await expect(POST(post(valid))).rejects.toThrow("db down");
  });

  test("a body over the size cap is a 400 without parsing", async () => {
    const res = await POST(post("x".repeat(70_000)));
    expect(res.status).toBe(400);
  });
});

// The same-origin guard of app/auth/signout and app/api/board-filters: the route spends
// money, so a cross-site or sibling-subdomain POST is refused before the session is read.
describe("POST /api/agent same-origin guard", () => {
  function postWith(headers: Record<string, string>): Request {
    return new Request("http://localhost/api/agent", { method: "POST", headers, body: JSON.stringify(valid) });
  }

  test.each(["cross-site", "same-site"])("sec-fetch-site %s -> 403 forbidden, nothing read", async (site) => {
    const res = await POST(postWith({ "content-type": "application/json", "sec-fetch-site": site }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(m.getUserClaims).not.toHaveBeenCalled();
    expect(m.streamAgentTurn).not.toHaveBeenCalled();
  });

  test.each([["same-origin"], ["none"], [undefined]])("sec-fetch-site %s is allowed", async (site) => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (site !== undefined) headers["sec-fetch-site"] = site;
    const res = await POST(postWith(headers));
    expect(res.status).toBe(200);
  });

  test("the chat transport's content type with a charset is accepted", async () => {
    const res = await POST(postWith({ "content-type": "application/json; charset=utf-8" }));
    expect(res.status).toBe(200);
  });

  test.each([["text/plain"], ["application/x-www-form-urlencoded"], [undefined]])(
    "a %s body (a form post needs no preflight) is a 400 before the body is parsed",
    async (type) => {
      const headers: Record<string, string> = {};
      if (type !== undefined) headers["content-type"] = type;
      const res = await POST(postWith(headers));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "bad_request" });
      expect(m.getViewerPlan).not.toHaveBeenCalled();
      expect(m.streamAgentTurn).not.toHaveBeenCalled();
    },
  );
});

// PR 6 (inline-UI spec S10.3): a message a view sent. Its id starts "view-", it names the
// view in source, and the route checks the view is a variant 3 surface of this user's thread.
describe("POST /api/agent: a view's ask", () => {
  const SURFACE = "44444444-4444-4444-8444-444444444444";
  const OTHER_THREAD = "55555555-5555-4555-8555-555555555555";
  const surfaceRow = (extra: Record<string, unknown> = {}) => ({
    id: SURFACE,
    user_id: USER,
    thread_id: THREAD,
    run_id: null,
    variant: "3",
    payload: { html: "<p>x</p>" },
    fallback_payload: null,
    gathered: { jobs: {} },
    outcome: "valid",
    failure: null,
    supersedes: null,
    rerender_of: null,
    model: "m",
    latency_ms: "1200",
    created_at: new Date("2026-11-25T10:00:00Z"),
    ...extra,
  });
  const ask = { threadId: THREAD, kind: "message", id: "view-abc", text: "Show the Berlin jobs", source: { kind: "view", surfaceId: SURFACE } };

  async function refused(body: unknown, error: string) {
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(m.streamAgentTurn).not.toHaveBeenCalled();
  }

  test("a view- id without a source is 400", async () => {
    m.surfaces = [surfaceRow()];
    const { source: _source, ...noSource } = ask;
    await refused(noSource, "view_id_without_source");
  });

  test("a source on a u- id is 400", async () => {
    m.surfaces = [surfaceRow()];
    await refused({ ...ask, id: "u-abc" }, "source_without_view_id");
  });

  test("a view's text of 281 characters is 400, and 280 passes", async () => {
    m.surfaces = [surfaceRow()];
    await refused({ ...ask, text: "x".repeat(281) }, "view_text_too_long");
    expect((await POST(post({ ...ask, text: "x".repeat(280) }))).status).toBe(200);
  });

  // Polish wave, M4: the text must be the normalised text the host showed beside Send.
  test("a view's text that normalizeAskText would change is 400, with nothing started", async () => {
    m.surfaces = [surfaceRow()];
    await refused({ ...ask, text: "Show the Berlin\u200B jobs" }, "view_text_not_normalized");
    await refused({ ...ask, text: "Show the  Berlin jobs " }, "view_text_not_normalized");
  });

  test("a source that is not a uuid fails the strict schema", async () => {
    await refused({ ...ask, source: { kind: "view", surfaceId: "nope" } }, "bad_request");
    await refused({ ...ask, source: { kind: "view", surfaceId: SURFACE, extra: 1 } }, "bad_request");
  });

  test.each([
    ["a variant 1 surface", () => [surfaceRow({ variant: "1", payload: { blocks: [] } })]],
    ["another user's surface", () => [surfaceRow({ user_id: OTHER })]],
    ["a surface in another thread", () => [surfaceRow({ thread_id: OTHER_THREAD })]],
    ["no such surface", () => []],
  ])("%s is 400 view_source_invalid", async (_name, rows) => {
    m.surfaces = rows();
    await refused(ask, "view_source_invalid");
  });

  test("a valid view message reaches streamAgentTurn, stored from its text alone", async () => {
    m.surfaces = [surfaceRow()];
    const res = await POST(post(ask));
    expect(res.status).toBe(200);
    expect(m.streamAgentTurn).toHaveBeenCalledTimes(1);
    expect(m.streamAgentTurn.mock.calls[0][0].input).toEqual({
      kind: "message",
      id: "view-abc",
      text: "Show the Berlin jobs",
      documentIds: [],
    });
  });
});
