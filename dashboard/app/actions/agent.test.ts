// The agent page's thread actions. withUserSql is stubbed (the next query returns
// db.rows); lib/agent/threads.ts is real, so an UPDATE that touches no row is refused.
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({
  rows: [] as unknown[],
  requireUserId: vi.fn(),
  assertNotDeleted: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUserId: m.requireUserId, getUserClaims: vi.fn(async () => ({ id: "u", email: "a@example.com" })) }));
vi.mock("@/lib/tombstone", () => ({ assertNotDeleted: m.assertNotDeleted }));
vi.mock("next/cache", async (orig) => ({ ...(await orig<typeof import("next/cache")>()), revalidatePath: m.revalidatePath }));
vi.mock("@/lib/db", () => ({
  withUserSql: vi.fn(async (_userId: string, fn: (tx: unknown) => Promise<unknown>) => fn(() => Promise.resolve(m.rows))),
}));
const undo = vi.hoisted(() => ({ undoAction: vi.fn() }));
vi.mock("@/lib/agent/actions/audit", async (orig) => ({
  ...(await orig<typeof import("@/lib/agent/actions/audit")>()),
  undoAction: undo.undoAction,
}));
const intents = vi.hoisted(() => ({ executeIntent: vi.fn(), confirmIntent: vi.fn() }));
vi.mock("@/lib/agent/actions/handlers", () => intents);
const host = vi.hoisted(() => ({ loadHostSurface: vi.fn(), describePendingApproval: vi.fn() }));
vi.mock("@/lib/agent/surfaces/host", () => ({ loadHostSurface: host.loadHostSurface }));
vi.mock("@/lib/agent/actions/approvalCard", () => ({ describePendingApproval: host.describePendingApproval }));
const store = vi.hoisted(() => ({ getSurface: vi.fn(), markSurfaceFailed: vi.fn(), describeIntent: vi.fn() }));
vi.mock("@/lib/agent/surfaces/store", () => ({ getSurface: store.getSurface, markSurfaceFailed: store.markSurfaceFailed }));
vi.mock("@/lib/agent/actions/describe", async (orig) => ({
  ...(await orig<typeof import("@/lib/agent/actions/describe")>()),
  describeIntent: store.describeIntent,
}));

import {
  confirmIntentAction,
  describeApprovalAction,
  describeFrameIntentAction,
  executeIntentAction,
  loadSurfaceAction,
  reloadSurfaceRowsAction,
  renameThreadAction,
  reportSurfaceFailure,
  undoAgentAction,
} from "@/app/actions/agent";

import { fallbackSurface } from "@/lib/agent/surfaces/v1/fallback";
import { gatheredFixture } from "@/lib/agent/surfaces/v1/testFixtures";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  m.rows = [];
  m.requireUserId.mockResolvedValue(USER);
  m.assertNotDeleted.mockResolvedValue(undefined);
});

test("renaming one of the caller's threads is ok and revalidates the page", async () => {
  m.rows = [{ id: THREAD }];
  expect(await renameThreadAction(THREAD, "Remote ML roles")).toEqual({ ok: true });
  expect(m.revalidatePath).toHaveBeenCalledWith("/agent");
});

test("an unknown thread is refused, not reported ok, and nothing is revalidated", async () => {
  m.rows = [];
  expect(await renameThreadAction(THREAD, "Remote ML roles")).toEqual({ ok: false });
  expect(m.revalidatePath).not.toHaveBeenCalled();
});

test("a malformed id or a blank title is refused", async () => {
  m.rows = [{ id: THREAD }];
  expect(await renameThreadAction("not-a-uuid", "Remote ML roles")).toEqual({ ok: false });
  expect(await renameThreadAction(THREAD, "   ")).toEqual({ ok: false });
  expect(m.revalidatePath).not.toHaveBeenCalled();
});

test("undoAgentAction undoes as the session user and revalidates the workspaces on success", async () => {
  undo.undoAction.mockResolvedValue({ ok: true });
  expect(await undoAgentAction(42)).toEqual({ ok: true });
  expect(m.assertNotDeleted).toHaveBeenCalledWith(USER);
  expect(undo.undoAction).toHaveBeenCalledWith(USER, 42);
  expect(m.revalidatePath).toHaveBeenCalledWith("/shortlist");
  expect(m.revalidatePath).toHaveBeenCalledWith("/agent");
});

test("a successful undo revalidates every page an undoable kind changes", async () => {
  // shortlist.set -> /shortlist; application.* -> /applications, /shortlist (stage) and the
  // board (package status); profile.set_resume -> /documents, /profile, /profile/resume,
  // /looking-for; analytics.set_tiles -> /analytics; every kind -> /agent.
  undo.undoAction.mockResolvedValue({ ok: true });
  await undoAgentAction(42);
  expect(m.revalidatePath.mock.calls.map((c) => c[0]).sort()).toEqual(
    ["/", "/agent", "/analytics", "/applications", "/board", "/documents", "/looking-for", "/profile", "/profile/resume", "/shortlist"].sort(),
  );
});

test("undoAgentAction passes a refusal through and revalidates nothing", async () => {
  undo.undoAction.mockResolvedValue({ ok: false, reason: "changed_since" });
  expect(await undoAgentAction(42)).toEqual({ ok: false, reason: "changed_since" });
  expect(m.revalidatePath).not.toHaveBeenCalled();
});

test("undoAgentAction refuses a malformed id without calling undo", async () => {
  expect(await undoAgentAction(Number.NaN)).toEqual({ ok: false, reason: "not_found" });
  expect(await undoAgentAction("7" as unknown as number)).toEqual({ ok: false, reason: "not_found" });
  expect(undo.undoAction).not.toHaveBeenCalled();
});

test("an erased account cannot undo", async () => {
  m.assertNotDeleted.mockRejectedValue(new Error("deleted"));
  await expect(undoAgentAction(42)).rejects.toThrow();
  expect(undo.undoAction).not.toHaveBeenCalled();
});

test("executeIntentAction runs a host intent as the session user and refreshes the workspaces after a write", async () => {
  const SURFACE = "33333333-3333-4333-8333-333333333333";
  intents.executeIntent.mockResolvedValue({ kind: "done", toast: "Shortlist updated.", actionId: 9 });
  const raw = { name: "shortlist.set", jobId: "lever:a:1", state: "later" };
  expect(await executeIntentAction(THREAD, SURFACE, raw)).toEqual({ kind: "done", toast: "Shortlist updated.", actionId: 9 });
  expect(intents.executeIntent).toHaveBeenCalledWith(USER, { threadId: THREAD, surfaceId: SURFACE, raw, source: "host", email: "a@example.com" });
  expect(m.revalidatePath).toHaveBeenCalledWith("/shortlist");

  vi.clearAllMocks();
  intents.executeIntent.mockResolvedValue({ kind: "navigate", href: "/analytics" });
  await executeIntentAction(THREAD, SURFACE, { name: "open", target: "analytics" });
  expect(m.revalidatePath).not.toHaveBeenCalled();
  expect(await executeIntentAction(7 as unknown as string, SURFACE, {})).toEqual({ kind: "dropped" });
});

test("confirmIntentAction passes the token with the session user", async () => {
  intents.confirmIntent.mockResolvedValue({ kind: "dropped" });
  expect(await confirmIntentAction("tok")).toEqual({ kind: "dropped" });
  expect(intents.confirmIntent).toHaveBeenCalledWith(USER, "a@example.com", "tok");
});

test("the surface and approval readers take the user from the session, never from the client", async () => {
  const SURFACE = "22222222-2222-4222-8222-222222222222";
  host.loadHostSurface.mockResolvedValue({ id: SURFACE, rows: { packages: {} } });
  expect(await loadSurfaceAction(THREAD, SURFACE)).toEqual({ id: SURFACE, rows: { packages: {} } });
  expect(host.loadHostSurface).toHaveBeenCalledWith(USER, THREAD, SURFACE);
  expect(await reloadSurfaceRowsAction(THREAD, SURFACE)).toEqual({ packages: {} });
  host.loadHostSurface.mockResolvedValue(null);
  expect(await reloadSurfaceRowsAction(THREAD, SURFACE)).toBeNull();

  host.describePendingApproval.mockResolvedValue({ status: "pending" });
  expect(await describeApprovalAction(THREAD, "ap1")).toEqual({ status: "pending" });
  expect(host.describePendingApproval).toHaveBeenCalledWith(USER, THREAD, "ap1", "a@example.com");
});

// Variant 3 (plan Task 2.6).
const V3 = "44444444-4444-4444-8444-444444444444";
const FALLBACK = fallbackSurface(gatheredFixture());

function surfacesOf(owner: string, variant: number) {
  store.getSurface.mockImplementation(async (userId: string, id: string) =>
    userId === owner && id === V3 ? { id, threadId: THREAD, variant } : null,
  );
}

test("executeIntentAction passes a frame press as source frame and refuses any other source", async () => {
  const SURFACE = V3;
  intents.executeIntent.mockResolvedValue({ kind: "navigate", href: "/shortlist" });
  const raw = { name: "open", target: "shortlist" };
  await executeIntentAction(THREAD, SURFACE, raw, "frame");
  expect(intents.executeIntent).toHaveBeenCalledWith(USER, { threadId: THREAD, surfaceId: SURFACE, raw, source: "frame", email: "a@example.com" });
  vi.clearAllMocks();
  expect(await executeIntentAction(THREAD, SURFACE, raw, "agent" as unknown as "host")).toEqual({ kind: "dropped" });
  expect(intents.executeIntent).not.toHaveBeenCalled();
});

test("reportSurfaceFailure marks the caller's variant 3 surface and returns its fallback parsed as variant 1", async () => {
  surfacesOf(USER, 3);
  store.markSurfaceFailed.mockResolvedValue(FALLBACK);
  expect(await reportSurfaceFailure(V3, "no_handshake")).toEqual(FALLBACK);
  expect(m.assertNotDeleted).toHaveBeenCalledWith(USER);
  expect(store.getSurface).toHaveBeenCalledWith(USER, V3);
  expect(store.markSurfaceFailed).toHaveBeenCalledWith(USER, V3, "no_handshake");
});

test("reportSurfaceFailure refuses an unknown reason, another user's surface or another variant, and never returns an unparsed payload", async () => {
  surfacesOf(USER, 3);
  expect(await reportSurfaceFailure(V3, "made_up")).toBeNull();
  expect(await reportSurfaceFailure("not-a-uuid", "frame_error")).toBeNull();
  surfacesOf("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", 3);
  expect(await reportSurfaceFailure(V3, "frame_error")).toBeNull();
  surfacesOf(USER, 2);
  expect(await reportSurfaceFailure(V3, "frame_error")).toBeNull();
  expect(store.markSurfaceFailed).not.toHaveBeenCalled();

  surfacesOf(USER, 3);
  store.markSurfaceFailed.mockResolvedValue({ variant: 3, title: "x", html: "<p>x</p>" });
  expect(await reportSurfaceFailure(V3, "self_navigation")).toBeNull();
  store.markSurfaceFailed.mockResolvedValue(null);
  expect(await reportSurfaceFailure(V3, "self_navigation")).toBeNull();
});

test("describeFrameIntentAction parses the frame's request on the server and describes it from the database", async () => {
  surfacesOf(USER, 3);
  store.describeIntent.mockResolvedValue({ label: "Shortlist Staff Engineer at Acme" });
  const chip = await describeFrameIntentAction(THREAD, V3, "shortlist.set", { jobId: "greenhouse:acme:101", state: "shortlisted" });
  expect(chip).toEqual({
    label: "Shortlist Staff Engineer at Acme",
    intent: { name: "shortlist.set", jobId: "greenhouse:acme:101", state: "shortlisted" },
    direct: false,
  });
  expect(store.describeIntent).toHaveBeenCalledWith(USER, { name: "shortlist.set", jobId: "greenhouse:acme:101", state: "shortlisted" });

  store.describeIntent.mockResolvedValue({ label: "Open your shortlist" });
  expect((await describeFrameIntentAction(THREAD, V3, "open", { target: "shortlist" }))?.direct).toBe(true);

  // Not the closed enum, not a variant 3 surface, another thread.
  expect(await describeFrameIntentAction(THREAD, V3, "open", { target: "shortlist", label: "x" })).toBeNull();
  expect(await describeFrameIntentAction(THREAD, V3, 7, {})).toBeNull();
  expect(await describeFrameIntentAction("22222222-2222-4222-8222-222222222222", V3, "open", { target: "shortlist" })).toBeNull();
  surfacesOf(USER, 1);
  expect(await describeFrameIntentAction(THREAD, V3, "open", { target: "shortlist" })).toBeNull();
});
