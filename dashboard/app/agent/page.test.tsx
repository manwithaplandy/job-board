// @vitest-environment jsdom
// The /agent route with no conversation open (PR I3b review I4, spec 5(a) step 1): a new
// user lands on the fixed empty state with the composer and an upload target, and the
// render creates nothing.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const knobs = vi.hoisted(() => ({
  plan: { tier: "pro" } as unknown,
  budget: { ok: true } as { ok: true } | { ok: false; reason: string },
  profile: null as Record<string, unknown> | null,
  newThread: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUserId: async () => "11111111-1111-4111-8111-111111111111",
  getUserClaims: async () => ({ email: "user@example.com" }),
}));
vi.mock("@/lib/admin", () => ({ isAdmin: () => false }));
vi.mock("@/lib/subscriptions", () => ({ getViewerPlan: async () => knobs.plan }));
vi.mock("@/lib/queries", () => ({ getProfile: async () => knobs.profile }));
vi.mock("@/lib/catalogClock", () => ({ catalogNow: async () => ({ now: new Date("2026-11-25T00:00:00Z"), frozen: false }) }));
vi.mock("@/lib/agent/budget", () => ({ checkBudget: async () => knobs.budget }));
vi.mock("@/lib/agent/approvalSecret", () => ({ approvalSecret: () => null, CONFIRMATIONS_UNAVAILABLE: "Confirmations aren't available yet." }));
vi.mock("@/lib/agent/surfaces/host", () => ({ loadThreadSurfaces: async () => [] }));
vi.mock("@/lib/agent/threads", () => ({ listThreads: async () => [], getThread: async () => null, loadMessages: async () => [] }));
vi.mock("@/lib/workspaces/activity", () => ({ readActivity: async () => [] }));
vi.mock("@/app/actions/agent", () => ({
  newThread: knobs.newThread,
  renameThreadAction: vi.fn(),
  undoAgentAction: vi.fn(),
  executeIntentAction: vi.fn(),
  confirmIntentAction: vi.fn(),
  loadSurfaceAction: vi.fn(),
  reloadSurfaceRowsAction: vi.fn(),
  describeApprovalAction: vi.fn(),
  describeFrameIntentAction: vi.fn(),
  reportSurfaceFailure: vi.fn(),
  setThreadVariantAction: vi.fn(),
  setDefaultVariantAction: vi.fn(),
}));
vi.mock("@/lib/appSettings", () => ({ loadAppSettings: async () => ({ agentEnabled: true, agentVariant3Enabled: true }) }));
vi.mock("@/lib/agent/settings", () => ({ getDefaultVariant: async () => 1 }));
vi.mock("@/app/actions/shortlist", () => ({ refreshSuggestedAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/agent",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/generation/GenerationToastProvider", () => ({ useGenerationTracker: () => null }));
vi.mock("@/components/shell/AppHeader", () => ({ AppHeader: () => <div /> }));
vi.mock("@/components/shell/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { default: AgentRoute } = await import("./page");
const { EMPTY_SENTENCE } = await import("@/components/agent/EmptyState");

afterEach(cleanup);
beforeEach(() => {
  knobs.plan = { tier: "pro" };
  knobs.budget = { ok: true };
  knobs.profile = null;
  knobs.newThread.mockReset();
});

const route = async (sp: Record<string, string> = {}) => render(await AgentRoute({ searchParams: Promise.resolve(sp) }));

test("a user with no threads sees the empty state's sentence, the composer and an upload target", async () => {
  const { container } = await route();
  const empty = container.querySelector(".rf-agent-empty") as HTMLElement;
  expect(empty).toBeTruthy();
  expect(empty.querySelectorAll("p.rf-agent-empty__sentence")).toHaveLength(1);
  expect(screen.getByText(EMPTY_SENTENCE.noProfile)).toBeTruthy();
  expect(screen.getByLabelText(/^Message/)).toBeTruthy();
  expect((screen.getByLabelText("Attach a file") as HTMLInputElement).type).toBe("file");
  expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  expect(knobs.newThread).not.toHaveBeenCalled();
});

test("with a profile the sentence asks about their jobs", async () => {
  knobs.profile = { resume_text: "x" };
  await route();
  expect(screen.getByText(EMPTY_SENTENCE.profile)).toBeTruthy();
});

test("a blocking notice shows instead of a composer that could not send", async () => {
  knobs.budget = { ok: false, reason: "daily_ceiling" };
  const { container } = await route();
  expect(container.querySelector(".rf-agent-empty")).toBeNull();
  expect(screen.queryByLabelText(/^Message/)).toBeNull();
  expect(screen.getByText("Start a new conversation, or pick one from the list.")).toBeTruthy();
});
