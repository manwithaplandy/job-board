// @vitest-environment jsdom
// The surface host's renderer choice (plan Task 2.8): it draws the view the server picked
// for the row (lib/agent/surfaces/host.ts, R13 and R15), and a frame's fallback stays.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const actions = vi.hoisted(() => ({ describeFrameIntentAction: vi.fn(), reportSurfaceFailure: vi.fn() }));
vi.mock("@/app/actions/agent", () => actions);

import type { HostChain, HostSurface } from "@/lib/agent/surfaces/host";
import { gatheredFixture, JOB_A } from "@/lib/agent/surfaces/v1/testFixtures";
import { everyNodePayload } from "@/lib/agent/surfaces/v2/testFixtures";
import { DEGRADED_CAPTION, showsDegradedCaption, SurfaceHost, withBlocksView } from "./SurfaceHost";

const THREAD = "22222222-2222-4222-8222-222222222222";
const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const FALLBACK_TEXT = "The plain view.";

function surface(view: HostSurface["view"], variant: HostSurface["variant"]): HostSurface {
  return {
    id: ID,
    threadId: THREAD,
    supersedes: null,
    rerenderOf: null,
    createdAt: "2026-11-25T00:00:00.000Z",
    variant,
    view,
    payload: { variant: 1, title: "Plain", blocks: [{ type: "Callout", tone: "info", text: FALLBACK_TEXT }] },
    gathered: gatheredFixture(),
    rows: {},
    degraded: false,
    outcome: "valid",
  };
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  actions.reportSurfaceFailure.mockReset().mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("a blocks view draws the variant 1 payload", () => {
  const { container } = render(<SurfaceHost surface={surface({ kind: "blocks" }, 1)} onIntent={vi.fn()} onPrepSettled={vi.fn()} />);
  expect(screen.getByText(FALLBACK_TEXT)).toBeTruthy();
  expect(container.querySelector("[data-surface-view]")?.getAttribute("data-surface-view")).toBe("blocks");
});

test("a tree view draws the variant 2 tree, and its presses are host presses", () => {
  const onIntent = vi.fn();
  render(<SurfaceHost surface={surface({ kind: "tree", tree: everyNodePayload() }, 2)} onIntent={onIntent} onPrepSettled={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "Your matches" })).toBeTruthy();
  expect(screen.queryByText(FALLBACK_TEXT)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Shortlist" }));
  expect(onIntent).toHaveBeenCalledWith(ID, { name: "shortlist.set", jobId: JOB_A, state: "shortlisted" }, "host");
});

test("a sandbox view mounts the frame; when it falls back the page is told, and the chain then shows blocks for good", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  const document = { variant: 3 as const, title: "Picks", html: "<p>Hi</p>" };
  const onFallback = vi.fn();
  const { container } = render(
    <SurfaceHost surface={surface({ kind: "sandbox", document }, 3)} onIntent={vi.fn()} onPrepSettled={vi.fn()} onFallback={onFallback} />,
  );
  expect(container.querySelector("iframe")?.getAttribute("sandbox")).toBe("allow-scripts");
  // No handshake within 3000 ms: the frame falls back and reports the failure.
  await vi.advanceTimersByTimeAsync(3_100);
  expect(onFallback).toHaveBeenCalledWith(ID);
  expect(actions.reportSurfaceFailure).toHaveBeenCalledWith(ID, "no_handshake");
  expect(container.querySelector("iframe")).toBeNull();

  const chains: HostChain[] = [{ chainId: ID, memberIds: [ID], surface: surface({ kind: "sandbox", document }, 3) }];
  const after = withBlocksView(chains, ID);
  expect(after[0].surface.view).toEqual({ kind: "blocks" });
  expect(after[0].surface.variant).toBe(3);
  // Another chain, or a chain already on blocks, is left as it is.
  expect(withBlocksView(chains, "other")[0]).toBe(chains[0]);
});

// PR 2 Task 2.1: the caption under a view that could not be built (spec S11).
test("the degraded caption shows for a degraded row and for a variant 2 or 3 row stored as its fallback", () => {
  expect(DEGRADED_CAPTION).toBe("Shown as blocks because the view could not be built.");
  const blocks = { kind: "blocks" } as const;
  expect(showsDegradedCaption({ ...surface(blocks, 1), degraded: true })).toBe(true);
  expect(showsDegradedCaption({ ...surface(blocks, 3), outcome: "fallback" })).toBe(true);
  expect(showsDegradedCaption({ ...surface(blocks, 2), outcome: "fallback" })).toBe(true);
  // Variant 1 stores its fallback at once: that is its view, not a degradation.
  expect(showsDegradedCaption({ ...surface(blocks, 1), outcome: "fallback" })).toBe(false);
  // A valid variant 3 row shown as blocks because variant 3 is switched off.
  expect(showsDegradedCaption(surface(blocks, 3))).toBe(false);
});

test("a frame that fell back in the browser is marked degraded", () => {
  const document = { variant: 3 as const, title: "Picks", html: "<p>Hi</p>" };
  const chains: HostChain[] = [{ chainId: ID, memberIds: [ID], surface: surface({ kind: "sandbox", document }, 3) }];
  const after = withBlocksView(chains, ID);
  expect(after[0].surface.degraded).toBe(true);
  expect(showsDegradedCaption(after[0].surface)).toBe(true);
});
