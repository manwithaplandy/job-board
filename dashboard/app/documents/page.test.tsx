// @vitest-environment jsdom
// The /documents route renders the profile's real `updated_at`. postgres.js returns a
// timestamptz as a JS Date (not a string), so the page must convert it before it reaches
// the client component, which slices an ISO string (review G2 C1).
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const knobs = vi.hoisted(() => ({ profile: null as Record<string, unknown> | null }));

vi.mock("@/lib/auth", () => ({
  requireUserId: async () => "11111111-1111-4111-8111-111111111111",
  getUserClaims: async () => ({ email: "user@example.com" }),
}));
vi.mock("@/lib/admin", () => ({ isAdmin: () => false }));
vi.mock("@/lib/queries", () => ({ getProfile: async () => knobs.profile }));
vi.mock("@/lib/workspaces/documents", () => ({ listDocuments: async () => [] }));
vi.mock("@/lib/workspaces/generatedDocuments", () => ({ listGeneratedDocuments: async () => [] }));
vi.mock("@/lib/workspaces/resumeVersions", () => ({ listResumeVersions: async () => [] }));
vi.mock("@/lib/workspaces/activity", () => ({ readActivity: async () => [] }));
vi.mock("@/app/actions/agent", () => ({ undoAgentAction: vi.fn() }));
vi.mock("@/app/actions/documents", () => ({
  deleteDocumentAction: vi.fn(),
  useAsResumeAction: vi.fn(),
  restoreResumeVersionAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/shell/AppHeader", () => ({ AppHeader: () => <div /> }));
vi.mock("@/components/shell/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { default: DocumentsRoute } = await import("./page");

afterEach(cleanup);
beforeEach(() => {
  knobs.profile = null;
});

test("a profile whose updated_at is a Date (as postgres.js returns it) renders the saved day", async () => {
  knobs.profile = { resume_text: "My résumé", updated_at: new Date("2026-11-24T15:30:00.000Z") };
  render(await DocumentsRoute());
  expect(screen.getByText(/Profile last saved 2026-11-24\./)).toBeTruthy();
});

test("an ISO-string updated_at still renders the saved day", async () => {
  knobs.profile = { resume_text: "My résumé", updated_at: "2026-11-20T01:00:00.000Z" };
  render(await DocumentsRoute());
  expect(screen.getByText(/Profile last saved 2026-11-20\./)).toBeTruthy();
});

test("no profile renders without a saved day", async () => {
  render(await DocumentsRoute());
  expect(screen.queryByText(/Profile last saved/)).toBeNull();
});
