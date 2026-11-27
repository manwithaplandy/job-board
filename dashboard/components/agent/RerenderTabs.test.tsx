// @vitest-environment jsdom
// "Re-render as" on the agent page (plan Task 2.9). fetch and loadSurfaceAction are stubs;
// the route's own gates are app/api/agent/rerender/route.test.ts.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const actions = vi.hoisted(() => ({ loadSurfaceAction: vi.fn(), describeFrameIntentAction: vi.fn(), reportSurfaceFailure: vi.fn() }));
vi.mock("@/app/actions/agent", () => actions);

import type { HostChain, HostSurface } from "@/lib/agent/surfaces/host";
import { gatheredFixture } from "@/lib/agent/surfaces/v1/testFixtures";
import { everyNodePayload } from "@/lib/agent/surfaces/v2/testFixtures";
import { RERENDER_ERRORS, RerenderTabs, VERSIONS_LABEL } from "./RerenderTabs";
import { mergeSurface } from "./SurfaceHost";

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

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function mount(chain: HostChain, variant3Enabled: boolean | null = true) {
  const onRerendered = vi.fn();
  const view = render(
    <RerenderTabs chain={chain} threadId={THREAD} variant3Enabled={variant3Enabled} onIntent={vi.fn()} onPrepSettled={vi.fn()} onRerendered={onRerendered} />,
  );
  return { ...view, onRerendered };
}

const original = (): HostChain => ({ chainId: S1, memberIds: [S1], surface: surface(S1, 1, "Original view") });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  actions.loadSurfaceAction.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
  expect(screen.getByText("Original view")).toBeTruthy();
});

test("a re-render posts the surface and variant, loads the new row and shows it as a new tab", async () => {
  fetchMock.mockResolvedValue(Response.json({ surfaceId: R1, threadId: THREAD, variant: 2 }));
  const rerendered = surface(R1, 2, "Layout view", S1);
  actions.loadSurfaceAction.mockResolvedValue(rerendered);
  let chain = original();
  const { onRerendered, rerender } = mount(chain);
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
  rerender(<RerenderTabs chain={chain} threadId={THREAD} variant3Enabled onIntent={vi.fn()} onPrepSettled={vi.fn()} onRerendered={onRerendered} />);
  expect(screen.getByRole("radiogroup", { name: VERSIONS_LABEL })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Layout" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("heading", { name: "Layout view" })).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Original" }));
  expect(screen.getByText("Original view")).toBeTruthy();
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
    await waitFor(() => expect(container.querySelector(".rf-agent-versions__status")?.textContent).toBe(text));
    expect(onRerendered).not.toHaveBeenCalled();
    unmount();
  }
  expect(actions.loadSurfaceAction).not.toHaveBeenCalled();
});
