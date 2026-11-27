// @vitest-environment jsdom
// The gallery's agent page fixtures (PR K1): every state renders the production page
// layout with its fixed data and no network.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("@/app/actions/agent", () => ({
  newThread: vi.fn(),
  renameThreadAction: vi.fn(),
  undoAgentAction: vi.fn(),
  executeIntentAction: vi.fn(),
  confirmIntentAction: vi.fn(),
  loadSurfaceAction: vi.fn(async () => null),
  reloadSurfaceRowsAction: vi.fn(),
  describeApprovalAction: vi.fn(),
  describeFrameIntentAction: vi.fn(),
  reportSurfaceFailure: vi.fn(),
  setThreadVariantAction: vi.fn(),
  setDefaultVariantAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/agent",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("./ReviewProgress", () => ({ ReviewProgress: () => null }));

import { AgentPageFixture } from "./AgentPageFixture";
import { AGENT_PAGE_FIXTURE_STATES } from "./agentPageFixtureStates";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: null })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test.each(AGENT_PAGE_FIXTURE_STATES)("%s renders the agent page with its composer", (state) => {
  render(<AgentPageFixture state={state} />);
  expect(screen.getByRole("heading", { name: "Agent", level: 1 })).toBeTruthy();
  expect(screen.getByRole("navigation", { name: "Conversations" })).toBeTruthy();
  expect(screen.getByLabelText(/^Message/)).toBeTruthy();
});

test("the variant states select Blocks, Layout and Code", () => {
  for (const [state, label] of [["agent-page-blocks", "Blocks"], ["agent-page-layout", "Layout"], ["agent-page-code", "Code"]] as const) {
    render(<AgentPageFixture state={state} />);
    expect(screen.getByRole("radio", { name: label }).getAttribute("aria-checked")).toBe("true");
    cleanup();
  }
});

test("agent-page-steps-working shows the working row with its frozen timer", () => {
  const { container } = render(<AgentPageFixture state="agent-page-steps-working" />);
  const toggle = screen.getByRole("button", { name: /Searching your reviewed jobs/ });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(container.querySelector(".rf-steps--working .rf-steps__timer")?.textContent).toBe("1:05");
  expect(screen.queryByText("This reply was interrupted")).toBeNull();
});

test("agent-page-steps-done shows eight steps collapsed, one of which did not work", () => {
  render(<AgentPageFixture state="agent-page-steps-done" />);
  const toggle = screen.getByRole("button", { name: /Worked through 8 steps/ });
  expect(toggle.textContent).toContain("Worked through 8 steps, 1 did not work");
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
});

test("agent-page-steps-open shows the same steps expanded, with a grouped count and the failed step", () => {
  const { container } = render(<AgentPageFixture state="agent-page-steps-open" />);
  const toggle = screen.getByRole("button", { name: /Worked through 8 steps/ });
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  const panel = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
  expect(panel?.hidden).toBe(false);
  expect(panel?.textContent).toContain("Searched your reviewed jobs (5 times)");
  expect(container.querySelector(".rf-steps__item--failed")?.textContent).toBe("Could not read a job review");
});
