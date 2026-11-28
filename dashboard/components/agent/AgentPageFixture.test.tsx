// @vitest-environment jsdom
// The gallery's agent page fixtures (PR K1): every state renders the production page
// layout with its fixed data and no network.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

import { validateSurfaceV3 } from "@/lib/agent/surfaces/v3/document";
import { AgentPageFixture, agentPageFixtureMessages, CODE_FIXTURE_DOCUMENT } from "./AgentPageFixture";
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

// PR 2 (spec 08 S14.2): the inline-view states.
test("agent-page-view-building shows the placeholder between two paragraphs while the turn works", () => {
  const { container } = render(<AgentPageFixture state="agent-page-view-building" />);
  const reply = [...container.querySelectorAll(".rf-agent-transcript > li")].at(-1)!;
  const order = [...reply.querySelectorAll(".rf-md, .rf-view-placeholder")].map((el) => (el.classList.contains("rf-view-placeholder") ? "placeholder" : "text"));
  expect(order).toEqual(["text", "placeholder", "text"]);
  expect(reply.querySelector(".rf-view-placeholder")?.getAttribute("role")).toBe("status");
  expect(reply.querySelector(".rf-view-placeholder")?.textContent).toBe("Building a view…");
  expect(screen.getByRole("button", { name: /Building a view/ }).closest(".rf-steps--working")).not.toBeNull();
  expect(screen.queryByText("This reply was interrupted")).toBeNull();
});

test("agent-page-view-updated shows the updated-below stub at the older part and the view at the newer one", () => {
  const { container } = render(<AgentPageFixture state="agent-page-view-updated" />);
  expect(screen.getByText("This view was updated below.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Go to it" })).toBeTruthy();
  const views = container.querySelectorAll(".rf-view");
  expect(views).toHaveLength(1);
  expect([...container.querySelectorAll(".rf-agent-transcript > li")].at(-1)?.contains(views[0])).toBe(true);
});

test("agent-page-view-degraded shows a layout view stored as blocks, solid-framed, with the caption", () => {
  const { container } = render(<AgentPageFixture state="agent-page-view-degraded" />);
  const view = container.querySelector(".rf-view")!;
  expect(view.getAttribute("data-variant")).toBe("2");
  expect(view.getAttribute("data-frame")).toBe("solid");
  expect(screen.getByText("Shown as blocks because the view could not be built.")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Layout" }).getAttribute("aria-checked")).toBe("true");
});

// PR 3 (spec 08 S6, S14.2): the expanded states, through the chat's fixture seam.
describe("the expanded states", () => {
  afterEach(() => {
    document.documentElement.classList.remove("rf-view-expanded");
  });

  test("agent-page-view-expanded shows the blocks view expanded, with the dock live and the rest inert", () => {
    const { container } = render(<AgentPageFixture state="agent-page-view-expanded" />);
    const view = container.querySelector<HTMLElement>(".rf-view")!;
    expect(view.dataset.expanded).toBe("true");
    expect(view.getAttribute("role")).toBe("dialog");
    expect(view.getAttribute("aria-modal")).toBe("false");
    expect(view.querySelector(".rf-agent-surface")?.getAttribute("data-surface-view")).toBe("blocks");
    expect(screen.getByRole("button", { name: "Close expanded view" }).getAttribute("aria-expanded")).toBe("true");
    const dock = container.querySelector<HTMLElement>(".rf-agent-dock")!;
    expect(dock.dataset.expanded).toBe("true");
    expect(dock.contains(screen.getByLabelText(/^Message/))).toBe(true);
    expect(view.closest("[inert]")).toBeNull();
    expect(dock.closest("[inert]")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Conversations" }).closest("[inert]")).not.toBeNull();
    expect(document.documentElement.classList.contains("rf-view-expanded")).toBe(true);
  });

  test("agent-page-code-expanded shows a variant 3 view expanded in its generated-view frame, with Code selected", () => {
    const { container } = render(<AgentPageFixture state="agent-page-code-expanded" />);
    const view = container.querySelector<HTMLElement>(".rf-view")!;
    expect(view.dataset.expanded).toBe("true");
    expect(view.dataset.variant).toBe("3");
    expect(view.dataset.frame).toBe("dashed");
    expect(view.querySelector("iframe.rf-sandbox__frame")).not.toBeNull();
    expect(screen.getByRole("radio", { name: "Code" }).getAttribute("aria-checked")).toBe("true");
  });

  test("the code view's document passes the variant 3 checks and is static: no script, action or request", () => {
    expect(validateSurfaceV3(CODE_FIXTURE_DOCUMENT).ok).toBe(true);
    expect(CODE_FIXTURE_DOCUMENT.html).not.toMatch(/<script|host\.|action=|fetch|https?:/i);
  });
});

// PR 4 (spec 08 S4.4): present's tool output carries no payload, so neither do the fixtures'.
test.each(AGENT_PAGE_FIXTURE_STATES)("%s: every present output is payload-free, as the tool returns it", (state) => {
  for (const message of agentPageFixtureMessages(state)) {
    for (const part of message.parts) {
      if (part.type !== "tool-present" || !("output" in part)) continue;
      expect(part.output).toEqual({ surfaceId: expect.any(String), variant: expect.any(Number), outcome: "valid" });
    }
  }
});
