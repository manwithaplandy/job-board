// @vitest-environment jsdom
// The view frame (spec 08 S5, PR 2 Task 2.3): the chrome every chain renders in, with the
// version tabs and "Re-render as" (plan Task 2.9) moved inside it. fetch and
// loadSurfaceAction are stubs; the route's own gates are app/api/agent/rerender/route.test.ts.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const actions = vi.hoisted(() => ({ loadSurfaceAction: vi.fn(), describeFrameIntentAction: vi.fn(), reportSurfaceFailure: vi.fn() }));
vi.mock("@/app/actions/agent", () => actions);

import type { HostChain, HostSurface } from "@/lib/agent/surfaces/host";
import { gatheredFixture } from "@/lib/agent/surfaces/v1/testFixtures";
import { everyNodePayload } from "@/lib/agent/surfaces/v2/testFixtures";
import { RERENDER_ERRORS, VERSIONS_LABEL } from "./RerenderTabs";
import { DEGRADED_CAPTION, mergeSurface } from "./SurfaceHost";
import { ViewFrame } from "./ViewFrame";

const THREAD = "22222222-2222-4222-8222-222222222222";
const S1 = "aaaaaaaa-0000-4000-8000-000000000001";
const R1 = "aaaaaaaa-0000-4000-8000-000000000002";

function surface(id: string, variant: 1 | 2, text: string, rerenderOf: string | null = null): HostSurface {
  return {
    id,
    threadId: THREAD,
    supersedes: null,
    rerenderOf,
    createdAt: "2026-11-25T00:00:00.000Z",
    variant,
    view: variant === 2 ? { kind: "tree", tree: { ...everyNodePayload(), title: text } } : { kind: "blocks" },
    payload: { variant: 1, title: text, blocks: [{ type: "Callout", tone: "info", text: `${text} body` }] },
    gathered: gatheredFixture(),
    rows: {},
    degraded: false,
    outcome: "valid",
  };
}

function sandboxSurface(id: string, title: string): HostSurface {
  return {
    ...surface(id, 1, "Fallback"),
    variant: 3,
    view: { kind: "sandbox", document: { variant: 3, title, html: "<p>Hi</p>" } },
  };
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function frame(chain: HostChain, variant3Enabled: boolean | null = true, onRerendered = vi.fn()) {
  return (
    <ViewFrame chain={chain} threadId={THREAD} variant3Enabled={variant3Enabled} onIntent={vi.fn()} onPrepSettled={vi.fn()} onRerendered={onRerendered} />
  );
}

function mount(chain: HostChain, variant3Enabled: boolean | null = true) {
  const onRerendered = vi.fn();
  const view = render(frame(chain, variant3Enabled, onRerendered));
  return { ...view, onRerendered };
}

const original = (): HostChain => ({ chainId: S1, memberIds: [S1], surface: surface(S1, 1, "Original view") });
const section = (c: HTMLElement) => c.querySelector<HTMLElement>("section.rf-view");

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  actions.loadSurfaceAction.mockReset();
  actions.describeFrameIntentAction.mockReset();
  actions.reportSurfaceFailure.mockReset().mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("the title is the payload's title, labels the section, and falls back to View", () => {
  const { container, unmount } = mount({ chainId: S1, memberIds: [S1], surface: surface(S1, 1, "Top matches") });
  const s = section(container)!;
  expect(s.getAttribute("aria-label")).toBe("View: Top matches");
  expect(s.getAttribute("data-chain-id")).toBe(S1);
  expect(s.getAttribute("data-variant")).toBe("1");
  expect(s.getAttribute("data-frame")).toBe("solid");
  const title = screen.getByRole("heading", { level: 3, name: "Top matches" });
  expect(title.className).toContain("rf-view__title");
  expect(title.getAttribute("tabindex")).toBe("-1");
  expect(screen.queryByText("Generated view")).toBeNull();
  expect(screen.queryByText(DEGRADED_CAPTION)).toBeNull();
  unmount();

  const untitled = surface(S1, 1, "x");
  untitled.payload = { variant: 1, blocks: [{ type: "Callout", tone: "info", text: "No title here" }] };
  const again = mount({ chainId: S1, memberIds: [S1], surface: untitled });
  expect(section(again.container)!.getAttribute("aria-label")).toBe("View: View");
  expect(screen.getByRole("heading", { level: 3, name: "View" })).toBeTruthy();
});

test.each([1, 2] as const)("a variant %s view has exactly one title heading, the frame's h3 (spec 08 S5, S13)", (variant) => {
  const { container } = mount({ chainId: S1, memberIds: [S1], surface: surface(S1, variant, "Two strong matches") });
  const titled = screen.getAllByRole("heading", { name: "Two strong matches" });
  expect(titled).toHaveLength(1);
  expect(titled[0].tagName).toBe("H3");
  expect(titled[0].className).toContain("rf-view__title");
  expect(container.querySelector(".rf-blocks__title, .rf-tree__title")).toBeNull();
  // Nothing in the body outranks the frame's title.
  expect(container.querySelector(".rf-view__body h1, .rf-view__body h2")).toBeNull();
});

test("the header ref reaches the title", () => {
  const ref = createRef<HTMLHeadingElement>();
  render(
    <ViewFrame chain={original()} threadId={THREAD} variant3Enabled onIntent={vi.fn()} onPrepSettled={vi.fn()} onRerendered={vi.fn()} headerRef={ref} />,
  );
  expect(ref.current?.textContent).toBe("Original view");
});

test("a variant 3 view that mounts a frame has the dashed frame and the Generated view label; its chip sits in the requests region", async () => {
  actions.describeFrameIntentAction.mockResolvedValue({ label: "Shortlist it", intent: { name: "open", target: "shortlist" }, direct: false });
  const { container } = mount({ chainId: S1, memberIds: [S1], surface: sandboxSurface(S1, "Picks") });
  const s = section(container)!;
  expect(s.getAttribute("data-frame")).toBe("dashed");
  expect(s.getAttribute("data-variant")).toBe("3");
  expect(s.getAttribute("aria-label")).toBe("View: Picks");
  expect(container.querySelector(".rf-view__kind")?.textContent).toBe("Generated view");
  const requests = container.querySelector(".rf-view__requests")!;
  await waitFor(() => expect(requests.querySelector('[role="region"]')).not.toBeNull());
  expect(container.querySelector(".rf-view__body iframe")).not.toBeNull();
});

test("a variant 3 row stored as its fallback has the solid frame, no label, and the caption", () => {
  const fellBack: HostSurface = { ...surface(S1, 1, "Picks"), variant: 3, outcome: "fallback" };
  const { container } = mount({ chainId: S1, memberIds: [S1], surface: fellBack });
  expect(section(container)!.getAttribute("data-frame")).toBe("solid");
  expect(container.querySelector(".rf-view__kind")).toBeNull();
  expect(screen.getByText(DEGRADED_CAPTION)).toBeTruthy();
});

test("switching version tabs keeps the same section and changes the body", () => {
  const chain: HostChain = {
    chainId: S1,
    memberIds: [S1, R1],
    surface: surface(S1, 1, "Original view"),
    rerenders: [surface(R1, 2, "Layout view", S1)],
  };
  const { container } = mount(chain);
  const before = section(container);
  expect(screen.getByText("Original view body")).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Layout" }));
  expect(section(container)).toBe(before);
  expect(screen.queryByText("Original view body")).toBeNull();
  expect(container.querySelector(".rf-view__body [data-surface-view]")?.getAttribute("data-surface-view")).toBe("tree");
  expect(section(container)!.getAttribute("aria-label")).toBe("View: Layout view");
});

test("a surface offers a re-render in each other variant; with variant 3 off, Code is disabled", () => {
  mount(original(), false);
  expect((screen.getByRole("button", { name: "Re-render as Blocks" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Re-render as Layout" }) as HTMLButtonElement).disabled).toBe(false);
  expect((screen.getByRole("button", { name: "Re-render as Code" }) as HTMLButtonElement).disabled).toBe(true);
  // One version only: no tabs.
  expect(screen.queryByRole("radiogroup", { name: VERSIONS_LABEL })).toBeNull();
});

test("without a plan the buttons are not shown", () => {
  mount(original(), null);
  expect(screen.queryByRole("button", { name: /Re-render as/ })).toBeNull();
  expect(screen.getByText("Original view body")).toBeTruthy();
});

test("a re-render posts the surface and variant, loads the new row, shows it as a new tab, and keeps the frame", async () => {
  fetchMock.mockResolvedValue(Response.json({ surfaceId: R1, threadId: THREAD, variant: 2 }));
  const rerendered = surface(R1, 2, "Layout view", S1);
  actions.loadSurfaceAction.mockResolvedValue(rerendered);
  let chain = original();
  const { onRerendered, rerender, container } = mount(chain);
  const before = section(container);
  onRerendered.mockImplementation((s: HostSurface) => {
    chain = mergeSurface([chain], s)[0];
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Re-render as Layout" }));
  });
  await waitFor(() => expect(onRerendered).toHaveBeenCalledWith(rerendered));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/agent/rerender");
  expect(JSON.parse(String(init?.body))).toEqual({ surfaceId: S1, variant: 2 });
  expect(actions.loadSurfaceAction).toHaveBeenCalledWith(THREAD, R1);

  // The parent merged it into the chain as a version, not a new chain.
  expect(chain.memberIds).toEqual([S1, R1]);
  expect(chain.surface.id).toBe(S1);
  rerender(frame(chain, true, onRerendered));
  expect(section(container)).toBe(before);
  expect(screen.getByRole("radiogroup", { name: VERSIONS_LABEL })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Layout" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("heading", { level: 3, name: "Layout view" })).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Original" }));
  expect(screen.getByText("Original view body")).toBeTruthy();
  expect(section(container)).toBe(before);
});

test("the buttons describe the version shown: a press re-renders that version, and its own variant is disabled", async () => {
  fetchMock.mockResolvedValue(Response.json({ error: "x" }, { status: 500 }));
  const chain: HostChain = {
    chainId: S1,
    memberIds: [S1, R1],
    surface: surface(S1, 1, "Original view"),
    rerenders: [surface(R1, 2, "Layout view", S1)],
  };
  mount(chain);
  const button = (name: string) => screen.getByRole("button", { name: `Re-render as ${name}` }) as HTMLButtonElement;

  // The original (Blocks) is shown: Blocks is disabled, Layout re-renders the original.
  expect(button("Blocks").disabled).toBe(true);
  expect(button("Layout").disabled).toBe(false);
  await act(async () => {
    fireEvent.click(button("Layout"));
  });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ surfaceId: S1, variant: 2 });

  // The Layout re-render is shown: Layout is disabled, Blocks re-renders that version.
  fireEvent.click(screen.getByRole("radio", { name: "Layout" }));
  await waitFor(() => expect(button("Blocks").disabled).toBe(false));
  expect(button("Layout").disabled).toBe(true);
  await act(async () => {
    fireEvent.click(button("Blocks"));
  });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ surfaceId: R1, variant: 1 });
});

test("a refused re-render says why and adds nothing", async () => {
  for (const [status, text] of [
    [409, RERENDER_ERRORS.busy],
    [429, RERENDER_ERRORS.budget],
    [503, RERENDER_ERRORS.disabled],
    [402, RERENDER_ERRORS.plan],
    [404, RERENDER_ERRORS.failed],
    [500, RERENDER_ERRORS.failed],
  ] as const) {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "x" }, { status }));
    const { onRerendered, unmount, container } = mount(original());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Re-render as Layout" }));
    });
    await waitFor(() => expect(container.querySelector(".rf-view__footer .rf-agent-versions__status")?.textContent).toBe(text));
    expect(onRerendered).not.toHaveBeenCalled();
    unmount();
  }
  expect(actions.loadSurfaceAction).not.toHaveBeenCalled();
});
