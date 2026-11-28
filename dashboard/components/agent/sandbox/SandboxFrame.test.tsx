// @vitest-environment jsdom
// The variant 3 host (plan Task 2.6). jsdom does not run srcdoc documents, so the frame's
// side is played by the test: a ready event dispatched on the window with this frame's
// window as its source, origin "null" and a MessagePort, then messages on that port. The
// sandbox and CSP themselves are Task 2.7's real-browser tests.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const actions = vi.hoisted(() => ({ describeFrameIntentAction: vi.fn(), reportSurfaceFailure: vi.fn() }));
vi.mock("@/app/actions/agent", () => actions);

import type { ActionIntent } from "@/lib/agent/actions/intents";
import { fallbackSurface } from "@/lib/agent/surfaces/v1/fallback";
import { gatheredFixture, JOB_A, JOB_B } from "@/lib/agent/surfaces/v1/testFixtures";
import { sandboxSnapshot } from "@/lib/agent/surfaces/v3/document";
import { useState } from "react";
import { ViewHostContext, type ViewHost } from "../ViewHostContext";
import {
  ASK_CAPTION,
  CHIP_ARM_MS,
  CHIP_PROMPT,
  GENERATED_VIEW_LABEL,
  SandboxFrame,
  type SandboxFrameServer,
  type SandboxSurface,
} from "./SandboxFrame";
import { resetPageClocks } from "./arming";

const ID = "44444444-4444-4444-8444-444444444444";
const THREAD = "11111111-1111-4111-8111-111111111111";
const FALLBACK_TEXT = "Here is the plain view.";
const SHORTLIST_A: ActionIntent = { name: "shortlist.set", jobId: JOB_A, state: "shortlisted" };
const SKIP_B: ActionIntent = { name: "shortlist.set", jobId: JOB_B, state: "skipped", reasonCode: "pay" };

const ports: MessagePort[] = [];

beforeEach(() => {
  resetPageClocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  actions.describeFrameIntentAction.mockReset();
  actions.reportSurfaceFailure.mockReset();
  actions.reportSurfaceFailure.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  resetPageClocks();
  for (const p of ports.splice(0)) p.close();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-theme");
});

function surface(): SandboxSurface {
  const gathered = gatheredFixture();
  gathered.jobs[JOB_A] = { ...gathered.jobs[JOB_A], title: "Staff Engineer", url: "https://jobs.example/acme/101" };
  return {
    id: ID,
    threadId: THREAD,
    payload: { variant: 3, title: "Your matches", html: "<p>Hello from the view</p>" },
    gathered,
    fallback: fallbackSurface(gathered, FALLBACK_TEXT),
    rows: {},
  };
}

function mount(s: SandboxSurface = surface()) {
  const onIntent = vi.fn<(surfaceId: string, intent: ActionIntent, source: "host" | "frame") => void>();
  const onFallback = vi.fn();
  const view = render(<SandboxFrame surface={s} onIntent={onIntent} onFallback={onFallback} />);
  const iframe = view.container.querySelector("iframe");
  if (!iframe) throw new Error("no iframe");
  return { ...view, iframe, onIntent, onFallback, s };
}

interface ReadyOptions {
  source?: MessageEventSource | null;
  origin?: string;
  data?: unknown;
  port?: boolean;
  /** Answer init with inited, as the kit does (default true). */
  ack?: boolean;
}

/**
 * The frame's ready: returns the frame's end of the port, what it receives (pings aside),
 * the pings, and a switch for answering them. Like the kit, it acks init and answers
 * every ping with a pong unless told not to.
 */
function ready(iframe: HTMLIFrameElement, opts: ReadyOptions = {}) {
  const channel = new MessageChannel();
  ports.push(channel.port1, channel.port2);
  const received: unknown[] = [];
  const pings: number[] = [];
  const frame = { answerPings: true };
  channel.port1.onmessage = (e) => {
    const m: unknown = e.data;
    const type = m && typeof m === "object" && "type" in m ? m.type : null;
    if (type === "ping") {
      const n = m && typeof m === "object" && "n" in m && typeof m.n === "number" ? m.n : -1;
      pings.push(n);
      if (frame.answerPings) channel.port1.postMessage({ type: "pong", n });
      return;
    }
    received.push(m);
    if (type === "init" && opts.ack !== false) channel.port1.postMessage({ type: "inited" });
  };
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: "data" in opts ? opts.data : { type: "ready" },
        origin: opts.origin ?? "null",
        source: opts.source === undefined ? iframe.contentWindow : opts.source,
        ports: opts.port === false ? [] : [channel.port2],
      }),
    );
  });
  return { port: channel.port1, received, pings, frame };
}

const settle = () => act(() => new Promise((r) => setTimeout(r, 30)));

/** With fake timers: lets port messages and promises through (setImmediate is not faked). */
async function flush(rounds = 5) {
  for (let i = 0; i < rounds; i++) await act(() => new Promise<void>((r) => setImmediate(r)));
}

const LIVENESS_TIMERS: Parameters<typeof vi.useFakeTimers>[0] = {
  toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
};

/** A pointer press (detail 1); fireEvent.click's default detail 0 reads as a keyboard activation. */
function pointerClick(el: HTMLElement) {
  fireEvent.click(el, { detail: 1 });
}

/** A press on the chip once it is armed (CHIP_ARM_MS after it appeared). */
function pressChip(el: HTMLElement) {
  const at = Date.now() + CHIP_ARM_MS;
  const spy = vi.spyOn(Date, "now").mockReturnValue(at);
  fireEvent.click(el);
  spy.mockRestore();
}

function chips(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("[data-sandbox-chip]")];
}

function chipFor(intent: ActionIntent, label: string, extra: { proposed?: string[]; direct?: boolean } = {}) {
  return { label, intent, direct: extra.direct ?? false, ...(extra.proposed ? { proposed: extra.proposed } : {}) };
}

describe("SandboxFrame", () => {
  test("the iframe has sandbox exactly 'allow-scripts' and no allow attribute", () => {
    const { iframe } = mount();
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
    expect(iframe.hasAttribute("allow")).toBe(false);
    expect(iframe.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(iframe.hasAttribute("src")).toBe(false);
    // srcdoc set from JavaScript: the built document, CSP first, then the model's HTML.
    expect(iframe.srcdoc.startsWith('<!doctype html><html lang="en"><meta http-equiv="Content-Security-Policy" content="default-src \'none\';')).toBe(true);
    // The frame document's title is the host's label for it.
    expect(iframe.srcdoc).toContain(`<title>${GENERATED_VIEW_LABEL}</title>`);
    expect(iframe.srcdoc).toContain("<p>Hello from the view</p>");
    // The label and the title are the view frame's (ViewFrame), not the sandbox frame's.
    expect(screen.queryByText(GENERATED_VIEW_LABEL)).toBeNull();
    expect(iframe.getAttribute("title")).toBe("Your matches");
  });

  test("a message from another window or with origin other than 'null' is ignored", async () => {
    const { iframe } = mount();
    const fromWindow = ready(iframe, { source: window });
    const fromOrigin = ready(iframe, { origin: "https://evil.example" });
    const noSource = ready(iframe, { source: null });
    const noPort = ready(iframe, { port: false });
    const notReady = ready(iframe, { data: { type: "ready", extra: 1 } });
    await settle();
    for (const r of [fromWindow, fromOrigin, noSource, noPort, notReady]) expect(r.received).toEqual([]);

    const good = ready(iframe);
    await waitFor(() => expect(good.received).toHaveLength(1));
    // After the handshake the window is not listened to: an action there does nothing.
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", { data: { type: "action", name: "open", args: { target: "shortlist" } }, origin: "null", source: iframe.contentWindow }),
      );
    });
    const again = ready(iframe);
    await settle();
    expect(again.received).toEqual([]);
    expect(actions.describeFrameIntentAction).not.toHaveBeenCalled();
  });

  test("no ready within 3000 ms triggers the fallback and reports the failure", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { iframe, onFallback, container } = mount();
    act(() => vi.advanceTimersByTime(2999));
    expect(actions.reportSurfaceFailure).not.toHaveBeenCalled();
    expect(iframe.isConnected).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(actions.reportSurfaceFailure).toHaveBeenCalledWith(ID, "no_handshake");
    expect(onFallback).toHaveBeenCalledWith("no_handshake");
    expect(iframe.isConnected).toBe(false);
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText(FALLBACK_TEXT)).toBeTruthy();
    expect(screen.queryByText(GENERATED_VIEW_LABEL)).toBeNull();
  });

  test("a ready with no inited ack still falls back at 3000 ms (fix round 1, I2)", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    const { iframe, onFallback } = mount();
    const r = ready(iframe, { ack: false });
    await flush();
    expect(r.received).toHaveLength(1); // the init went out
    act(() => vi.advanceTimersByTime(2999));
    await flush();
    expect(actions.reportSurfaceFailure).not.toHaveBeenCalled();
    expect(iframe.isConnected).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(actions.reportSurfaceFailure).toHaveBeenCalledWith(ID, "no_handshake");
    expect(onFallback).toHaveBeenCalledWith("no_handshake");
    expect(iframe.isConnected).toBe(false);
    expect(screen.getByText(FALLBACK_TEXT)).toBeTruthy();
  });

  test("after the ack, pings about once a second that get pongs keep the frame (fix round 1, I2)", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    const { iframe } = mount();
    const r = ready(iframe);
    await flush();
    const before = r.pings.length; // a load event may already have pinged
    for (let s = 0; s < 10; s++) {
      act(() => vi.advanceTimersByTime(1000));
      await flush();
    }
    expect(r.pings.length - before).toBeGreaterThanOrEqual(9);
    // Each ping carries a new number.
    expect(new Set(r.pings).size).toBe(r.pings.length);
    expect(actions.reportSurfaceFailure).not.toHaveBeenCalled();
    expect(iframe.isConnected).toBe(true);
  });

  test("an interval ping with no pong within 2500 ms falls back (fix round 1, I2)", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    const { iframe, onFallback } = mount();
    const r = ready(iframe);
    await flush();
    act(() => vi.advanceTimersByTime(3000));
    await flush();
    expect(actions.reportSurfaceFailure).not.toHaveBeenCalled();
    // The document stops answering (it navigated away or hung).
    r.frame.answerPings = false;
    const sentAt = r.pings.length;
    act(() => vi.advanceTimersByTime(1000)); // the next interval ping goes out
    await flush();
    expect(r.pings.length).toBe(sentAt + 1);
    act(() => vi.advanceTimersByTime(2499));
    await flush();
    expect(actions.reportSurfaceFailure).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    await flush();
    expect(actions.reportSurfaceFailure).toHaveBeenCalledWith(ID, "no_heartbeat");
    expect(onFallback).toHaveBeenCalledWith("no_heartbeat");
    expect(iframe.isConnected).toBe(false);
    expect(screen.getByText(FALLBACK_TEXT)).toBeTruthy();
  });

  test("a load event pings at once, and no pong falls back even with one load only (fix round 1, I2)", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    const { iframe, onFallback } = mount();
    let loads = 0;
    iframe.addEventListener("load", () => {
      loads += 1;
    });
    const r = ready(iframe);
    r.frame.answerPings = false;
    await flush();
    if (loads === 0) fireEvent.load(iframe);
    await flush();
    expect(loads).toBe(1);
    expect(r.pings.length).toBeGreaterThanOrEqual(1); // sent on the load, before any interval tick
    act(() => vi.advanceTimersByTime(2499));
    await flush();
    expect(actions.reportSurfaceFailure).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    await flush();
    expect(actions.reportSurfaceFailure).toHaveBeenCalledWith(ID, "no_heartbeat");
    expect(onFallback).toHaveBeenCalledWith("no_heartbeat");
    expect(iframe.isConnected).toBe(false);
  });

  test("a chip swapped in under a press ignores presses for 700 ms (fix round 1, I3)", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    actions.describeFrameIntentAction.mockResolvedValueOnce(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    actions.describeFrameIntentAction.mockResolvedValueOnce(chipFor(SKIP_B, "Skip Engineer at Acme"));
    const { iframe, onIntent } = mount();
    const { port } = ready(iframe);
    await flush();
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    await flush();
    const first = screen.getByRole("button", { name: "Shortlist Staff Engineer at Acme" });
    // A fresh chip is not pressable at once either.
    fireEvent.click(first);
    expect(onIntent).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2000));
    await flush();

    // The pointer is on its way to the first chip; the frame swaps in a second request.
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_B, state: "skipped", reasonCode: "pay" } });
    await flush();
    const second = screen.getByRole("button", { name: "Skip Engineer at Acme" });
    expect(second).not.toBe(first); // a new element, keyed by the request number
    expect(first.isConnected).toBe(false);
    fireEvent.click(second);
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS - 1));
    fireEvent.click(second);
    expect(onIntent).not.toHaveBeenCalled();
    expect(chips()).toHaveLength(1);

    act(() => vi.advanceTimersByTime(1));
    fireEvent.click(second);
    expect(onIntent).toHaveBeenCalledTimes(1);
    expect(onIntent).toHaveBeenCalledWith(ID, SKIP_B, "frame");
    expect(chips()).toHaveLength(0);
  });

  test("a frame that changes its height re-arms a pending chip for 700 ms (fix wave I1)", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    actions.describeFrameIntentAction.mockResolvedValueOnce(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    const { iframe, onIntent } = mount();
    const { port } = ready(iframe);
    await flush();
    port.postMessage({ type: "resize", height: 400 });
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    await flush();
    const chip = screen.getByRole("button", { name: "Shortlist Staff Engineer at Acme" });
    // Long past the arm delay; then the view shrinks itself, sliding the chip up.
    act(() => vi.advanceTimersByTime(2000));
    port.postMessage({ type: "resize", height: 40 });
    await flush();
    expect(iframe.style.height).toBe("40px");
    pointerClick(chip);
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS - 1));
    pointerClick(chip);
    expect(onIntent).not.toHaveBeenCalled();
    expect(chips()).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    pointerClick(chip);
    expect(onIntent).toHaveBeenCalledTimes(1);
    expect(onIntent).toHaveBeenCalledWith(ID, SHORTLIST_A, "frame");
  });

  test("a resize that leaves the applied height as it was does not re-arm the chip (fix wave I1)", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    actions.describeFrameIntentAction.mockResolvedValueOnce(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    const { iframe, onIntent } = mount();
    const { port } = ready(iframe);
    await flush();
    port.postMessage({ type: "resize", height: 5000 });
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    await flush();
    act(() => vi.advanceTimersByTime(2000));
    // Same height again, and a taller one that the cap holds at 1200: the region did not move.
    port.postMessage({ type: "resize", height: 6000 });
    port.postMessage({ type: "resize", height: 1200 });
    await flush();
    expect(iframe.style.height).toBe("1200px");
    pointerClick(screen.getByRole("button", { name: "Shortlist Staff Engineer at Acme" }));
    expect(onIntent).toHaveBeenCalledTimes(1);
  });

  test("another view's resize re-arms this view's chip too (fix wave follow-up, residual a)", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    // View A above, view B below with the chip; A shrinks itself, sliding B's chip up.
    const a = mount({ ...surface(), id: "55555555-5555-4555-8555-555555555555" });
    actions.describeFrameIntentAction.mockResolvedValueOnce(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    const b = mount();
    const portA = ready(a.iframe).port;
    const portB = ready(b.iframe).port;
    await flush();
    portA.postMessage({ type: "resize", height: 600 });
    portB.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    await flush();
    const chip = screen.getByRole("button", { name: "Shortlist Staff Engineer at Acme" });
    act(() => vi.advanceTimersByTime(2000));
    portA.postMessage({ type: "resize", height: 240 });
    await flush();
    expect(a.iframe.style.height).toBe("240px");
    pointerClick(chip);
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS - 1));
    pointerClick(chip);
    expect(b.onIntent).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    pointerClick(chip);
    expect(b.onIntent).toHaveBeenCalledTimes(1);
    expect(b.onIntent).toHaveBeenCalledWith(ID, SHORTLIST_A, "frame");
    expect(a.onIntent).not.toHaveBeenCalled();
  });

  test("another view falling back to its plain view re-arms this view's chip (fix wave follow-up)", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    const a = mount({ ...surface(), id: "55555555-5555-4555-8555-555555555555" });
    actions.describeFrameIntentAction.mockResolvedValueOnce(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    const b = mount();
    const portA = ready(a.iframe).port;
    const portB = ready(b.iframe).port;
    await flush();
    portB.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    await flush();
    const chip = screen.getByRole("button", { name: "Shortlist Staff Engineer at Acme" });
    act(() => vi.advanceTimersByTime(2000));
    // A's frame is torn down for its fallback, which changes the layout above B.
    portA.postMessage({ type: "error", message: "boom" });
    await flush();
    expect(a.onFallback).toHaveBeenCalledWith("frame_error");
    pointerClick(chip);
    expect(b.onIntent).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS));
    pointerClick(chip);
    expect(b.onIntent).toHaveBeenCalledTimes(1);
  });

  test("a host scroll with no user input before it re-arms the chip (fix wave follow-up, residual b)", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    actions.describeFrameIntentAction.mockResolvedValueOnce(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    const { iframe, onIntent } = mount();
    const { port } = ready(iframe);
    await flush();
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    await flush();
    const chip = screen.getByRole("button", { name: "Shortlist Staff Engineer at Acme" });
    act(() => vi.advanceTimersByTime(2000));
    // A scroll of any element on the page (captured on window), with no wheel, touch or key
    // before it: the frame may have scrolled its ancestors from inside.
    act(() => {
      document.body.dispatchEvent(new Event("scroll"));
    });
    pointerClick(chip);
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS - 1));
    pointerClick(chip);
    expect(onIntent).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    pointerClick(chip);
    expect(onIntent).toHaveBeenCalledTimes(1);
  });

  test("a keyboard press on the chip skips the move clocks but not the arm delay (fix wave follow-up)", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    actions.describeFrameIntentAction.mockResolvedValueOnce(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    const { iframe, onIntent } = mount();
    const { port } = ready(iframe);
    await flush();
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    await flush();
    const chip = screen.getByRole("button", { name: "Shortlist Staff Engineer at Acme" });
    // Inside the chip's own arm delay a key press is ignored like any other.
    fireEvent.click(chip, { detail: 0 });
    expect(onIntent).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2000));
    // The view keeps resizing: a pointer press is held, a key press (detail 0) is not.
    port.postMessage({ type: "resize", height: 300 });
    await flush();
    pointerClick(chip);
    expect(onIntent).not.toHaveBeenCalled();
    fireEvent.click(chip, { detail: 0 });
    expect(onIntent).toHaveBeenCalledTimes(1);
  });

  test("the fallback shows the stored variant 1 payload the server returns", async () => {
    const s = surface();
    actions.reportSurfaceFailure.mockResolvedValue(fallbackSurface(s.gathered, "Stored fallback from the server"));
    const { iframe } = mount(s);
    const { port } = ready(iframe);
    port.postMessage({ type: "error", message: "boom" });
    expect(await screen.findByText("Stored fallback from the server")).toBeTruthy();
  });

  test("an error message triggers the fallback", async () => {
    const { iframe, onFallback } = mount();
    const { port } = ready(iframe);
    port.postMessage({ type: "error", message: "TypeError: x is undefined" });
    await waitFor(() => expect(actions.reportSurfaceFailure).toHaveBeenCalledWith(ID, "frame_error"));
    expect(onFallback).toHaveBeenCalledWith("frame_error");
    expect(iframe.isConnected).toBe(false);
    expect(screen.getByText(FALLBACK_TEXT)).toBeTruthy();
  });

  test("a second load event blanks the frame and triggers the fallback; the first alone does not", async () => {
    const { iframe, onFallback } = mount();
    // Counted from right after mount, so jsdom's own first load (if it fires one) is seen.
    let loads = 0;
    iframe.addEventListener("load", () => {
      loads += 1;
    });
    ready(iframe);
    await settle();
    if (loads === 0) fireEvent.load(iframe);
    await settle();
    // Fix round 1, M5: exactly one load so far, and it did not fall back.
    expect(loads).toBe(1);
    expect(actions.reportSurfaceFailure).not.toHaveBeenCalled();
    expect(onFallback).not.toHaveBeenCalled();
    expect(iframe.isConnected).toBe(true);

    fireEvent.load(iframe);
    expect(loads).toBe(2);
    await waitFor(() => expect(actions.reportSurfaceFailure).toHaveBeenCalledWith(ID, "self_navigation"));
    expect(actions.reportSurfaceFailure).toHaveBeenCalledTimes(1);
    expect(onFallback).toHaveBeenCalledWith("self_navigation");
    expect(iframe.isConnected).toBe(false);
    expect(screen.getByText(FALLBACK_TEXT)).toBeTruthy();
  });

  test("a navigating message from the kit falls back at once, though the frame still answers pings (Task 2.7, CI run 2)", async () => {
    const { iframe, onFallback } = mount();
    const { port, frame } = ready(iframe);
    await settle();
    expect(frame.answerPings).toBe(true);
    port.postMessage({ type: "navigating" });
    await waitFor(() => expect(actions.reportSurfaceFailure).toHaveBeenCalledWith(ID, "self_navigation"));
    expect(actions.reportSurfaceFailure).toHaveBeenCalledTimes(1);
    expect(onFallback).toHaveBeenCalledWith("self_navigation");
    expect(iframe.isConnected).toBe(false);
    expect(screen.getByText(FALLBACK_TEXT)).toBeTruthy();
  });

  test("a navigating message right after this page's own beforeunload or pagehide is not a failure (Task 2.7, CI run 2)", async () => {
    for (const event of ["beforeunload", "pagehide"]) {
      const { iframe, onFallback, unmount } = mount();
      const { port } = ready(iframe);
      await settle();
      act(() => {
        window.dispatchEvent(new Event(event));
      });
      port.postMessage({ type: "navigating" });
      await settle();
      expect({ event, reported: actions.reportSurfaceFailure.mock.calls.length }).toEqual({ event, reported: 0 });
      expect(onFallback).not.toHaveBeenCalled();
      expect(iframe.isConnected).toBe(true);
      unmount();
    }
  });

  test("a navigating message after the grace period is a failure again (Task 2.7, CI run 2)", async () => {
    const { iframe } = mount();
    const { port } = ready(iframe);
    await settle();
    const leftAt = Date.now();
    act(() => {
      window.dispatchEvent(new Event("beforeunload"));
    });
    const spy = vi.spyOn(Date, "now").mockReturnValue(leftAt + 10_000);
    port.postMessage({ type: "navigating" });
    await waitFor(() => expect(actions.reportSurfaceFailure).toHaveBeenCalledWith(ID, "self_navigation"));
    spy.mockRestore();
  });

  test("the host listens for its own beforeunload as well as pagehide (PR #58 follow-up kept, Task 2.8)", () => {
    // The frame's navigating comes in this page's prompt-to-unload, possibly well before
    // this page's pagehide; pagehide alone would store a false self_navigation.
    const add = vi.spyOn(window, "addEventListener");
    const { unmount } = mount();
    const kinds = add.mock.calls.map(([type]) => type);
    expect(kinds).toContain("beforeunload");
    expect(kinds).toContain("pagehide");
    const remove = vi.spyOn(window, "removeEventListener");
    unmount();
    expect(remove.mock.calls.map(([type]) => type)).toEqual(expect.arrayContaining(["beforeunload", "pagehide"]));
  });

  test("a change of the page's theme goes to the mounted frame as a theme message, with no remount (Task 2.8, review M8)", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    const { iframe, onFallback } = mount();
    // Before ready there is no port: nothing to send, and no failure.
    act(() => document.documentElement.setAttribute("data-theme", "dark"));
    await settle();
    const { received } = ready(iframe);
    await waitFor(() => expect(received).toHaveLength(1));
    expect(received[0]).toMatchObject({ type: "init", theme: "dark" });

    act(() => document.documentElement.setAttribute("data-theme", "light"));
    await waitFor(() => expect(received).toHaveLength(2));
    expect(received[1]).toEqual({ type: "theme", theme: "light" });
    // The same theme again sends nothing; an unknown value reads as light, already sent.
    act(() => document.documentElement.setAttribute("data-theme", "light"));
    act(() => document.documentElement.setAttribute("data-theme", "sepia"));
    act(() => document.documentElement.setAttribute("data-theme", "dark"));
    await waitFor(() => expect(received).toHaveLength(3));
    await settle();
    expect(received[2]).toEqual({ type: "theme", theme: "dark" });
    expect(received).toHaveLength(3);
    // Still the same frame: nothing remounted, nothing fell back.
    expect(iframe.isConnected).toBe(true);
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
    expect(onFallback).not.toHaveBeenCalled();
  });

  test("resize above 1200 is clamped", async () => {
    const { iframe } = mount();
    expect(iframe.style.height).toBe("0px");
    const { port } = ready(iframe);
    port.postMessage({ type: "resize", height: 5000 });
    await waitFor(() => expect(iframe.style.height).toBe("1200px"));
    port.postMessage({ type: "resize", height: 320 });
    await waitFor(() => expect(iframe.style.height).toBe("320px"));
    port.postMessage({ type: "resize", height: 20_001 });
    port.postMessage({ type: "resize", height: "900" });
    await settle();
    expect(iframe.style.height).toBe("320px");
  });

  test("init is sent only after ready and contains the snapshot, not raw gathered data", async () => {
    document.documentElement.setAttribute("data-theme", "dark");
    const { iframe, s } = mount();
    await settle();
    const { received } = ready(iframe);
    await waitFor(() => expect(received).toHaveLength(1));
    expect(received[0]).toEqual({ type: "init", data: sandboxSnapshot(s.gathered), theme: "dark" });
    const sent = JSON.stringify(received[0]);
    expect(sent).not.toContain("jobs.example");
    expect(sent).not.toContain('"url"');
    expect(sent).not.toContain('"location"');
  });

  test("an action message on load writes nothing and shows one host chip", async () => {
    actions.describeFrameIntentAction.mockResolvedValue(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    const { iframe, onIntent } = mount();
    const { port } = ready(iframe);
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    expect(await screen.findByRole("button", { name: "Shortlist Staff Engineer at Acme" })).toBeTruthy();
    expect(screen.getByText(CHIP_PROMPT)).toBeTruthy();
    expect(chips()).toHaveLength(1);
    expect(onIntent).not.toHaveBeenCalled();
    expect(actions.describeFrameIntentAction).toHaveBeenCalledWith(THREAD, ID, "shortlist.set", { jobId: JOB_A, state: "shortlisted" });
  });

  test("pressing the chip executes the intent once; a second message replaces the chip without executing", async () => {
    actions.describeFrameIntentAction.mockResolvedValueOnce(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    actions.describeFrameIntentAction.mockResolvedValueOnce(chipFor(SKIP_B, "Skip Engineer at Acme", { proposed: ["Reason: Pay"] }));
    const { iframe, onIntent } = mount();
    const { port } = ready(iframe);
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    await screen.findByRole("button", { name: "Shortlist Staff Engineer at Acme" });
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_B, state: "skipped", reasonCode: "pay" } });
    await screen.findByRole("button", { name: "Skip Engineer at Acme" });
    expect(chips()).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Shortlist Staff Engineer at Acme" })).toBeNull();
    expect(screen.getByText("Reason: Pay")).toBeTruthy();
    expect(onIntent).not.toHaveBeenCalled();

    pressChip(chips()[0]);
    expect(onIntent).toHaveBeenCalledTimes(1);
    expect(onIntent).toHaveBeenCalledWith(ID, SKIP_B, "frame");
    expect(chips()).toHaveLength(0);
    await settle();
    expect(onIntent).toHaveBeenCalledTimes(1);
  });

  test("answer and compare from the frame send no message until the chip is pressed", async () => {
    const answer: ActionIntent = { name: "answer", questionId: "q1", value: "remote only" };
    const compare: ActionIntent = { name: "compare", jobIds: [JOB_A, JOB_B] };
    actions.describeFrameIntentAction.mockResolvedValueOnce(
      chipFor(answer, "Send a message to the agent", { proposed: ["From the view: Answer to q1: remote only"] }),
    );
    actions.describeFrameIntentAction.mockResolvedValueOnce(chipFor(compare, "Compare Staff Engineer at Acme with Engineer at Acme"));
    const { iframe, onIntent } = mount();
    const { port } = ready(iframe);
    port.postMessage({ type: "action", name: "answer", args: { questionId: "q1", value: "remote only" } });
    await screen.findByRole("button", { name: "Send a message to the agent" });
    expect(screen.getByText("From the view: Answer to q1: remote only")).toBeTruthy();
    await settle();
    expect(onIntent).not.toHaveBeenCalled();

    port.postMessage({ type: "action", name: "compare", args: { jobIds: [JOB_A, JOB_B] } });
    await screen.findByRole("button", { name: "Compare Staff Engineer at Acme with Engineer at Acme" });
    await settle();
    expect(onIntent).not.toHaveBeenCalled();
    pressChip(chips()[0]);
    expect(onIntent).toHaveBeenCalledWith(ID, compare, "frame");
  });

  test("the 11th action message within a minute blanks the frame and falls back", async () => {
    actions.describeFrameIntentAction.mockResolvedValue(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    const { iframe, onIntent } = mount();
    const { port } = ready(iframe);
    for (let i = 0; i < 10; i++) port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    await waitFor(() => expect(actions.describeFrameIntentAction).toHaveBeenCalledTimes(10));
    await settle();
    expect(actions.reportSurfaceFailure).not.toHaveBeenCalled();
    expect(iframe.isConnected).toBe(true);

    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    await waitFor(() => expect(actions.reportSurfaceFailure).toHaveBeenCalledWith(ID, "action_rate_limit"));
    expect(actions.describeFrameIntentAction).toHaveBeenCalledTimes(10);
    expect(iframe.isConnected).toBe(false);
    expect(chips()).toHaveLength(0);
    expect(screen.getByText(FALLBACK_TEXT)).toBeTruthy();
    expect(onIntent).not.toHaveBeenCalled();
  });

  test("the 31st action message in all falls back even when spread over minutes", async () => {
    actions.describeFrameIntentAction.mockResolvedValue(null);
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const { iframe } = mount();
    const { port } = ready(iframe);
    for (let batch = 0; batch < 3; batch++) {
      for (let i = 0; i < 10; i++) port.postMessage({ type: "action", name: "open", args: { target: "shortlist" } });
      await waitFor(() => expect(actions.describeFrameIntentAction).toHaveBeenCalledTimes(10 * (batch + 1)));
      now += 61_000;
    }
    expect(actions.reportSurfaceFailure).not.toHaveBeenCalled();
    port.postMessage({ type: "action", name: "open", args: { target: "shortlist" } });
    await waitFor(() => expect(actions.reportSurfaceFailure).toHaveBeenCalledWith(ID, "action_total_limit"));
    expect(iframe.isConnected).toBe(false);
  });

  test("the host renders the server's label, not strings from the frame's message", async () => {
    // This only shows that the host renders the label the server returned (the server is
    // mocked here). That the label itself ignores the frame's strings is tested where it is
    // built, in lib/agent/actions/describe.test.ts.
    actions.describeFrameIntentAction.mockResolvedValue(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    const { iframe, container } = mount();
    const { port } = ready(iframe);
    port.postMessage({
      type: "action",
      name: "shortlist.set",
      args: { jobId: JOB_A, state: "shortlisted", label: "Pay $500 now", title: "Approve everything" },
    });
    const button = await screen.findByRole("button", { name: "Shortlist Staff Engineer at Acme" });
    expect(button.textContent).toBe("Shortlist Staff Engineer at Acme");
    expect(container.textContent).not.toContain("Pay $500 now");
    expect(container.textContent).not.toContain("Approve everything");

    // A request the server will not describe shows no chip and replaces the old one.
    actions.describeFrameIntentAction.mockResolvedValue(null);
    port.postMessage({ type: "action", name: "delete.everything", args: { label: "Click me" } });
    await waitFor(() => expect(chips()).toHaveLength(0));
    expect(container.textContent).not.toContain("Click me");
  });

  test("an open of a workspace page runs without a press, once per surface", async () => {
    const open: ActionIntent = { name: "open", target: "shortlist" };
    actions.describeFrameIntentAction.mockResolvedValue(chipFor(open, "Open your shortlist", { direct: true }));
    const { iframe, onIntent } = mount();
    const { port } = ready(iframe);
    port.postMessage({ type: "action", name: "open", args: { target: "shortlist" } });
    await waitFor(() => expect(onIntent).toHaveBeenCalledWith(ID, open, "frame"));
    expect(chips()).toHaveLength(0);
    port.postMessage({ type: "action", name: "open", args: { target: "shortlist" } });
    await screen.findByRole("button", { name: "Open your shortlist" });
    expect(onIntent).toHaveBeenCalledTimes(1);
  });

  test("a press on the fallback's blocks is a host press", async () => {
    const { iframe, onIntent } = mount();
    const { port } = ready(iframe);
    port.postMessage({ type: "error", message: "boom" });
    await screen.findByText(FALLBACK_TEXT);
    const group = screen.getByRole("group", { name: "Actions for Staff Engineer" });
    fireEvent.click(group.querySelector("button")!);
    expect(onIntent).toHaveBeenCalledWith(ID, SHORTLIST_A, "host");
  });

  test("a new surface after a fallback gets a fresh frame", async () => {
    const { iframe, rerender, onIntent, s } = mount();
    const { port } = ready(iframe);
    port.postMessage({ type: "error", message: "boom" });
    await screen.findByText(FALLBACK_TEXT);
    const next = { ...s, id: "55555555-5555-4555-8555-555555555555" };
    rerender(<SandboxFrame surface={next} onIntent={onIntent} />);
    expect(document.querySelector(".rf-sandbox__holder")).not.toBeNull();
    const fresh = document.querySelector("iframe");
    expect(fresh).not.toBeNull();
    expect(fresh).not.toBe(iframe);
    expect(screen.queryByText(FALLBACK_TEXT)).toBeNull();
  });

  test("unmounting removes the frame and stops listening", async () => {
    actions.describeFrameIntentAction.mockResolvedValue(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    const { iframe, unmount } = mount();
    const { port } = ready(iframe);
    unmount();
    expect(iframe.isConnected).toBe(false);
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    await settle();
    expect(actions.describeFrameIntentAction).not.toHaveBeenCalled();
    expect(actions.reportSurfaceFailure).not.toHaveBeenCalled();
  });

  test("the harness seam replaces only where describe and report go; the frame checks still apply", async () => {
    // Task 2.7's harness passes `server` (no database or session there); product code does not.
    const server = {
      describe: vi.fn().mockResolvedValue(chipFor(SHORTLIST_A, "Shortlist from the stub")),
      report: vi.fn().mockResolvedValue(null),
    };
    const s = surface();
    const onIntent = vi.fn();
    const view = render(<SandboxFrame surface={s} onIntent={onIntent} server={server} />);
    const iframe = view.container.querySelector("iframe")!;
    const wrong = ready(iframe, { origin: "https://evil.example" });
    const { port } = ready(iframe);
    await waitFor(() => expect(wrong.received).toEqual([]));
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    const chip = await screen.findByRole("button", { name: "Shortlist from the stub" });
    expect(server.describe).toHaveBeenCalledWith(THREAD, ID, "shortlist.set", { jobId: JOB_A, state: "shortlisted" });
    expect(actions.describeFrameIntentAction).not.toHaveBeenCalled();
    fireEvent.click(chip);
    expect(onIntent).not.toHaveBeenCalled(); // still unarmed
    port.postMessage({ type: "error", message: "boom" });
    await screen.findByText(FALLBACK_TEXT);
    expect(server.report).toHaveBeenCalledWith(ID, "frame_error");
    expect(actions.reportSurfaceFailure).not.toHaveBeenCalled();
  });
});

// PR 2 Task 2.2: the frame keeps only its holder; its chip region goes to the view frame
// that hosts it (ViewHostContext.requestsEl), so the chip sits in `rf-view__requests`.
describe("SandboxFrame inside a view host", () => {
  /** A stand-in for ViewFrame: a requests element it owns, handed down through the context. */
  function Host({ s, onIntent, tag }: { s: SandboxSurface; onIntent: () => void; tag: string }) {
    const [el, setEl] = useState<HTMLElement | null>(null);
    return (
      <div data-host={tag}>
        <div data-body={tag}>
          <ViewHostContext.Provider value={{ requestsEl: el, expanded: false, onEscape: () => {}, ask: null }}>
            <SandboxFrame surface={s} onIntent={onIntent} />
          </ViewHostContext.Provider>
        </div>
        <div data-requests={tag} ref={setEl} />
      </div>
    );
  }

  test("an action chip appears in the host's requests element, not beside the holder", async () => {
    actions.describeFrameIntentAction.mockResolvedValue(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    const view = render(<Host s={surface()} onIntent={vi.fn()} tag="a" />);
    const iframe = view.container.querySelector("iframe")!;
    const { port } = ready(iframe);
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    const chip = await screen.findByRole("button", { name: "Shortlist Staff Engineer at Acme" });
    const requests = view.container.querySelector('[data-requests="a"]')!;
    expect(requests.contains(chip)).toBe(true);
    const region = requests.querySelector('[role="region"]')!;
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("aria-label")).toBe("Requests from the generated view");
    const holder = view.container.querySelector(".rf-sandbox__holder")!;
    // Nothing is rendered after the holder: the region lives only in the host's element.
    expect(holder.nextElementSibling).toBeNull();
    expect(view.container.querySelectorAll('[role="region"]')).toHaveLength(1);
  });

  test("two frames in two hosts each keep their own chip; a new action in A leaves B's as it was (Review Focus 4)", async () => {
    const second: SandboxSurface = { ...surface(), id: "55555555-5555-4555-8555-555555555555" };
    actions.describeFrameIntentAction.mockImplementation(async (_t: string, surfaceId: string, name: string) =>
      surfaceId === ID
        ? name === "compare" ? chipFor(SKIP_B, "Skip Engineer at Acme") : chipFor(SHORTLIST_A, "Shortlist in A")
        : chipFor(SHORTLIST_A, "Shortlist in B"),
    );
    const view = render(
      <>
        <Host s={surface()} onIntent={vi.fn()} tag="a" />
        <Host s={second} onIntent={vi.fn()} tag="b" />
      </>,
    );
    const [frameA, frameB] = [...view.container.querySelectorAll("iframe")];
    const a = ready(frameA);
    const b = ready(frameB);
    a.port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    b.port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    const chipA = await screen.findByRole("button", { name: "Shortlist in A" });
    const chipB = await screen.findByRole("button", { name: "Shortlist in B" });
    const reqA = view.container.querySelector('[data-requests="a"]')!;
    const reqB = view.container.querySelector('[data-requests="b"]')!;
    expect(reqA.contains(chipA)).toBe(true);
    expect(reqB.contains(chipB)).toBe(true);

    a.port.postMessage({ type: "action", name: "compare", args: { jobIds: [JOB_A, JOB_B] } });
    const nextA = await screen.findByRole("button", { name: "Skip Engineer at Acme" });
    expect(reqA.contains(nextA)).toBe(true);
    expect(chipA.isConnected).toBe(false);
    // B's chip is the same element, still in B's region.
    expect(chipB.isConnected).toBe(true);
    expect(reqB.contains(chipB)).toBe(true);
    expect(reqB.querySelectorAll("[data-sandbox-chip]")).toHaveLength(1);
  });

  test("without a provider the chip region is the holder's sibling", async () => {
    actions.describeFrameIntentAction.mockResolvedValue(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    const { iframe, container } = mount();
    const { port } = ready(iframe);
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    const chip = await screen.findByRole("button", { name: "Shortlist Staff Engineer at Acme" });
    const holder = container.querySelector(".rf-sandbox__holder")!;
    expect(holder.nextElementSibling?.getAttribute("role")).toBe("region");
    expect(holder.nextElementSibling?.contains(chip)).toBe(true);
  });

  test("the frame renders no header and no section of its own", () => {
    const { container } = mount();
    expect(container.querySelector(".rf-sandbox__header")).toBeNull();
    expect(container.querySelector("section")).toBeNull();
    expect(container.querySelector(".rf-sandbox__holder")).not.toBeNull();
  });
});

// PR 3 Task 3.5: the kit's escape reaches the view host only after the handshake, and only
// through the host's onEscape (ViewFrame passes its collapse when expanded, a no-op otherwise).
describe("escape from the frame", () => {
  function mountHosted(onEscape: () => void) {
    const view = render(
      <ViewHostContext.Provider value={{ requestsEl: null, expanded: true, onEscape, ask: null }}>
        <SandboxFrame surface={surface()} onIntent={vi.fn()} />
      </ViewHostContext.Provider>,
    );
    const iframe = view.container.querySelector("iframe");
    if (!iframe) throw new Error("no iframe");
    return { ...view, iframe };
  }

  test("an escape before the kit acknowledged init is ignored", async () => {
    const onEscape = vi.fn();
    const { iframe } = mountHosted(onEscape);
    const { port } = ready(iframe, { ack: false });
    port.postMessage({ type: "escape" });
    await settle();
    expect(onEscape).not.toHaveBeenCalled();
  });

  test("after inited, each escape calls the host's onEscape once; a malformed one does nothing", async () => {
    const onEscape = vi.fn();
    const { iframe } = mountHosted(onEscape);
    const { port } = ready(iframe);
    await settle();
    port.postMessage({ type: "escape", extra: 1 });
    await settle();
    expect(onEscape).not.toHaveBeenCalled();
    port.postMessage({ type: "escape" });
    await settle();
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  test("the latest onEscape is called, without remounting the frame", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { iframe, rerender } = mountHosted(first);
    const { port } = ready(iframe);
    await settle();
    rerender(
      <ViewHostContext.Provider value={{ requestsEl: null, expanded: false, onEscape: second, ask: null }}>
        <SandboxFrame surface={surface()} onIntent={vi.fn()} />
      </ViewHostContext.Provider>,
    );
    port.postMessage({ type: "escape" });
    await settle();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(iframe.isConnected).toBe(true);
  });
});

// PR 6 Task 6.3 (spec 08 S10.2 layer 2, S10.3): an ask from the frame is only ever a pending
// message on host chrome, in the view frame's requests element. Only a press on its Send,
// once armed, hands the text to the page (ViewHost.ask.send).
describe("a view's ask", () => {
  const SECOND_ID = "55555555-5555-4555-8555-555555555555";
  type Ask = NonNullable<ViewHost["ask"]>;

  function stubServer() {
    return { describe: vi.fn().mockResolvedValue(null), report: vi.fn().mockResolvedValue(null) };
  }

  /** A stand-in for ViewFrame with an ask sink, as the page passes it. */
  function AskHost(props: {
    s: SandboxSurface;
    ask: Ask | null;
    tag?: string;
    server?: SandboxFrameServer;
    initialRequest?: { kind: "ask"; text: string };
  }) {
    const tag = props.tag ?? "a";
    const [el, setEl] = useState<HTMLElement | null>(null);
    return (
      <div data-host={tag}>
        <ViewHostContext.Provider value={{ requestsEl: el, expanded: false, onEscape: () => {}, ask: props.ask }}>
          <SandboxFrame surface={props.s} onIntent={vi.fn()} server={props.server} initialRequest={props.initialRequest} />
        </ViewHostContext.Provider>
        <div data-requests={tag} ref={setEl} />
      </div>
    );
  }

  function mountAsk(opts: { disabledReason?: string | null; server?: SandboxFrameServer; initialRequest?: { kind: "ask"; text: string } } = {}) {
    const send = vi.fn<(text: string, surfaceId: string, onRefused: () => void) => void>();
    const ask: Ask = { send, disabledReason: opts.disabledReason ?? null };
    const view = render(<AskHost s={surface()} ask={ask} server={opts.server} initialRequest={opts.initialRequest} />);
    const iframe = view.container.querySelector("iframe");
    if (!iframe) throw new Error("no iframe");
    return { ...view, iframe, send, ask };
  }

  const sendButton = () => screen.queryByRole("button", { name: /^Send: / });
  const askText = () => document.querySelector(".rf-ask__text")?.textContent ?? null;

  test("the holder counts every ask message the host took, so one replaced by a newer request still counts (fix wave follow-up)", async () => {
    actions.describeFrameIntentAction.mockResolvedValueOnce(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    const { iframe, container } = mountAsk();
    const { port } = ready(iframe);
    await settle();
    const holder = container.querySelector<HTMLElement>(".rf-sandbox__holder")!;
    expect(holder.dataset.sandboxAsksReceived).toBeUndefined();
    port.postMessage({ type: "ask", text: "Compare the top two" });
    await screen.findByText(ASK_CAPTION);
    expect(holder.dataset.sandboxAsksReceived).toBe("1");
    // An empty ask (normalised away) is still an ask the view made.
    port.postMessage({ type: "ask", text: "\u200B " });
    await waitFor(() => expect(holder.dataset.sandboxAsksReceived).toBe("2"));
    // A newer action replaces the pending message; the count stays.
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    await screen.findByRole("button", { name: "Shortlist Staff Engineer at Acme" });
    expect(document.querySelector("[data-sandbox-ask]")).toBeNull();
    expect(holder.dataset.sandboxAsksReceived).toBe("2");
  });

  test("an ask after inited shows the pending message with the normalised text and sends nothing", async () => {
    const { iframe, send, container } = mountAsk();
    const { port } = ready(iframe);
    await settle();
    port.postMessage({ type: "ask", text: "  Compare\n the\ttop \u202Etwo " });
    await screen.findByText(ASK_CAPTION);
    expect(askText()).toBe("Compare the top two");
    const requests = container.querySelector('[data-requests="a"]')!;
    expect(requests.contains(sendButton())).toBe(true);
    expect(screen.getByRole("button", { name: "Send: Compare the top two" }).textContent).toBe("Send");
    expect(screen.getByRole("button", { name: "Dismiss: Compare the top two" }).textContent).toBe("Dismiss");
    expect(send).not.toHaveBeenCalled();
  });

  test("Send inside 700 ms does nothing; after, it sends once with the text and the surface id and clears", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    const { iframe, send } = mountAsk();
    const { port } = ready(iframe);
    await flush();
    port.postMessage({ type: "ask", text: "Compare the top two" });
    await flush();
    const button = sendButton()!;
    fireEvent.click(button);
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS - 1));
    fireEvent.click(button);
    expect(send).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    fireEvent.click(button);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("Compare the top two", ID, expect.any(Function));
    expect(sendButton()).toBeNull();
    expect(askText()).toBeNull();
  });

  test("a frame that changes its height re-arms Send for 700 ms (fix wave I1)", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    const { iframe, send } = mountAsk();
    const { port } = ready(iframe);
    await flush();
    port.postMessage({ type: "resize", height: 400 });
    port.postMessage({ type: "ask", text: "Compare the top two" });
    await flush();
    const button = sendButton()!;
    act(() => vi.advanceTimersByTime(2000));
    // The view grows itself on a pointer move: Send slides down under the pointer.
    port.postMessage({ type: "resize", height: 640 });
    await flush();
    expect(iframe.style.height).toBe("640px");
    pointerClick(button);
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS - 1));
    pointerClick(button);
    expect(send).not.toHaveBeenCalled();
    expect(askText()).toBe("Compare the top two");
    // Every further move re-arms it again from that move.
    port.postMessage({ type: "resize", height: 500 });
    await flush();
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS - 1));
    pointerClick(button);
    expect(send).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    pointerClick(button);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("Compare the top two", ID, expect.any(Function));
  });

  test("the gallery's initialRequest is re-armed by a resize too (fix wave I1)", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    const { iframe, send } = mountAsk({ initialRequest: { kind: "ask", text: "Compare the top two" } });
    const { port } = ready(iframe);
    await flush();
    port.postMessage({ type: "resize", height: 300 });
    await flush();
    pointerClick(sendButton()!);
    expect(send).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS));
    pointerClick(sendButton()!);
    expect(send).toHaveBeenCalledTimes(1);
  });

  test("another view's resize re-arms Send (fix wave follow-up, residual a)", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    const other = mount({ ...surface(), id: "55555555-5555-4555-8555-555555555555" });
    const { iframe, send } = mountAsk();
    const otherPort = ready(other.iframe).port;
    const { port } = ready(iframe);
    await flush();
    port.postMessage({ type: "ask", text: "Compare the top two" });
    await flush();
    const button = sendButton()!;
    act(() => vi.advanceTimersByTime(2000));
    otherPort.postMessage({ type: "resize", height: 500 });
    await flush();
    pointerClick(button);
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS - 1));
    pointerClick(button);
    expect(send).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    pointerClick(button);
    expect(send).toHaveBeenCalledTimes(1);
  });

  test("a keyboard press on Send skips the move clocks, so a view that keeps resizing cannot leave Send dead to keys (fix wave follow-up)", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    const { iframe, send } = mountAsk();
    const { port } = ready(iframe);
    await flush();
    port.postMessage({ type: "ask", text: "Compare the top two" });
    await flush();
    const button = sendButton()!;
    fireEvent.click(button, { detail: 0 });
    expect(send).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS));
    port.postMessage({ type: "resize", height: 410 });
    await flush();
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    pointerClick(button);
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(button, { detail: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  // PR 6 review, minor 9: a send refused before the server accepted it shows the ask again.
  test("a refused send shows the ask again, armed afresh, so it can be sent or dismissed", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    const { iframe, send } = mountAsk();
    const { port } = ready(iframe);
    await flush();
    port.postMessage({ type: "ask", text: "Compare the top two" });
    await flush();
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS));
    fireEvent.click(sendButton()!);
    expect(askText()).toBeNull();
    const refused = send.mock.calls[0][2];
    act(() => refused());
    expect(askText()).toBe("Compare the top two");
    // Armed afresh: a press inside the arm window does nothing.
    fireEvent.click(sendButton()!);
    expect(send).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS));
    fireEvent.click(sendButton()!);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1].slice(0, 2)).toEqual(["Compare the top two", ID]);
    // A second refusal shows it again, and Dismiss then clears it.
    act(() => send.mock.calls[1][2]());
    fireEvent.click(screen.getByRole("button", { name: "Dismiss: Compare the top two" }));
    expect(askText()).toBeNull();
  });

  test("a refusal never replaces a newer request, and a frame that failed shows nothing again", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    const { iframe, send } = mountAsk();
    const { port } = ready(iframe);
    await flush();
    port.postMessage({ type: "ask", text: "First" });
    await flush();
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS));
    fireEvent.click(sendButton()!);
    port.postMessage({ type: "ask", text: "Second" });
    await flush();
    act(() => send.mock.calls[0][2]());
    expect(askText()).toBe("Second");
    // Dismissed: the older refusal is still stale (the frame asked since), so it shows nothing.
    fireEvent.click(screen.getByRole("button", { name: "Dismiss: Second" }));
    act(() => send.mock.calls[0][2]());
    expect(askText()).toBeNull();
    // After the frame fails (too many asks), a refusal shows nothing.
    port.postMessage({ type: "ask", text: "Third" });
    await flush();
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS));
    fireEvent.click(sendButton()!);
    for (let i = 0; i < 6; i++) port.postMessage({ type: "ask", text: `Loop ${i}` });
    await flush();
    expect(iframe.isConnected).toBe(false);
    act(() => send.mock.calls[1][2]());
    expect(askText()).toBeNull();
  });

  test("Dismiss removes it without sending", async () => {
    const { iframe, send } = mountAsk();
    const { port } = ready(iframe);
    await settle();
    port.postMessage({ type: "ask", text: "Compare the top two" });
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss: Compare the top two" }));
    expect(askText()).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  test("a second ask replaces the text and arms again", async () => {
    vi.useFakeTimers(LIVENESS_TIMERS);
    const { iframe, send } = mountAsk();
    const { port } = ready(iframe);
    await flush();
    port.postMessage({ type: "ask", text: "First" });
    await flush();
    const first = sendButton()!;
    act(() => vi.advanceTimersByTime(2000));
    port.postMessage({ type: "ask", text: "Second" });
    await flush();
    const second = screen.getByRole("button", { name: "Send: Second" });
    expect(first.isConnected).toBe(false);
    expect(askText()).toBe("Second");
    fireEvent.click(second);
    act(() => vi.advanceTimersByTime(CHIP_ARM_MS - 1));
    fireEvent.click(second);
    expect(send).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    fireEvent.click(second);
    expect(send).toHaveBeenCalledWith("Second", ID, expect.any(Function));
  });

  test("an action replaces a pending ask, and an ask replaces a pending action chip", async () => {
    actions.describeFrameIntentAction.mockResolvedValue(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme"));
    const { iframe } = mountAsk();
    const { port } = ready(iframe);
    await settle();
    port.postMessage({ type: "ask", text: "Compare the top two" });
    await screen.findByText(ASK_CAPTION);
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    await screen.findByRole("button", { name: "Shortlist Staff Engineer at Acme" });
    expect(askText()).toBeNull();
    expect(chips()).toHaveLength(1);
    port.postMessage({ type: "ask", text: "Tell me more" });
    await screen.findByRole("button", { name: "Send: Tell me more" });
    expect(chips()).toHaveLength(0);
    expect(document.querySelectorAll(".rf-sandbox__chip")).toHaveLength(1);
  });

  test("an ask that arrives while an action is being described wins: the late chip is not shown", async () => {
    let resolve: (v: unknown) => void = () => {};
    actions.describeFrameIntentAction.mockReturnValue(new Promise((r) => (resolve = r)));
    const { iframe } = mountAsk();
    const { port } = ready(iframe);
    await settle();
    port.postMessage({ type: "action", name: "shortlist.set", args: { jobId: JOB_A, state: "shortlisted" } });
    await waitFor(() => expect(actions.describeFrameIntentAction).toHaveBeenCalledTimes(1));
    port.postMessage({ type: "ask", text: "Compare the top two" });
    await screen.findByText(ASK_CAPTION);
    await act(async () => resolve(chipFor(SHORTLIST_A, "Shortlist Staff Engineer at Acme")));
    await settle();
    expect(chips()).toHaveLength(0);
    expect(askText()).toBe("Compare the top two");
  });

  test("a disabledReason disables Send and is its accessible description; Dismiss still works", async () => {
    const { iframe, send } = mountAsk({ disabledReason: "Wait for the current reply." });
    const { port } = ready(iframe);
    await settle();
    port.postMessage({ type: "ask", text: "Compare the top two" });
    const button = await screen.findByRole("button", { name: "Send: Compare the top two" });
    expect(button).toHaveProperty("disabled", true);
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe("Wait for the current reply.");
    pressChip(button);
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss: Compare the top two" }));
    expect(askText()).toBeNull();
  });

  test("with no ask sink in the view host, Send is disabled with a reason", async () => {
    const view = render(<AskHost s={surface()} ask={null} />);
    const { port } = ready(view.container.querySelector("iframe")!);
    await settle();
    port.postMessage({ type: "ask", text: "Compare the top two" });
    const button = await screen.findByRole("button", { name: "Send: Compare the top two" });
    expect(button).toHaveProperty("disabled", true);
    expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent).toBeTruthy();
  });

  test("the 7th ask within 60 s tears the frame down with ask_rate_limit", async () => {
    const server = stubServer();
    const { iframe, send } = mountAsk({ server });
    const { port } = ready(iframe);
    await settle();
    for (let i = 0; i < 6; i++) port.postMessage({ type: "ask", text: `Ask ${i}` });
    await waitFor(() => expect(askText()).toBe("Ask 5"));
    await settle();
    expect(server.report).not.toHaveBeenCalled();
    expect(iframe.isConnected).toBe(true);
    port.postMessage({ type: "ask", text: "Ask 6" });
    await waitFor(() => expect(server.report).toHaveBeenCalledWith(ID, "ask_rate_limit"));
    expect(iframe.isConnected).toBe(false);
    expect(askText()).toBeNull();
    expect(screen.getByText(FALLBACK_TEXT)).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
  });

  test("asks whose text normalises to nothing count toward the limit and show nothing", async () => {
    const server = stubServer();
    const { iframe } = mountAsk({ server });
    const { port } = ready(iframe);
    await settle();
    for (let i = 0; i < 6; i++) port.postMessage({ type: "ask", text: " \u200B\n " });
    await settle();
    expect(askText()).toBeNull();
    expect(server.report).not.toHaveBeenCalled();
    port.postMessage({ type: "ask", text: "Compare the top two" });
    await waitFor(() => expect(server.report).toHaveBeenCalledWith(ID, "ask_rate_limit"));
  });

  test("the 21st ask in all tears the frame down with ask_total_limit, even spread over minutes", async () => {
    const server = stubServer();
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const { iframe } = mountAsk({ server });
    const { port } = ready(iframe);
    await settle();
    for (let batch = 0; batch < 4; batch++) {
      for (let i = 0; i < 5; i++) port.postMessage({ type: "ask", text: `Ask ${batch}.${i}` });
      await waitFor(() => expect(askText()).toBe(`Ask ${batch}.4`));
      now += 61_000;
    }
    expect(server.report).not.toHaveBeenCalled();
    port.postMessage({ type: "ask", text: "One too many" });
    await waitFor(() => expect(server.report).toHaveBeenCalledWith(ID, "ask_total_limit"));
    expect(iframe.isConnected).toBe(false);
  });

  test("an ask before the kit acknowledged init is ignored", async () => {
    const server = stubServer();
    const { iframe } = mountAsk({ server });
    const { port } = ready(iframe, { ack: false });
    port.postMessage({ type: "ask", text: "Compare the top two" });
    await settle();
    expect(askText()).toBeNull();
    expect(server.report).not.toHaveBeenCalled();
  });

  test("an oversized or malformed ask is dropped and counts for nothing", async () => {
    const { iframe } = mountAsk();
    const { port } = ready(iframe);
    await settle();
    port.postMessage({ type: "ask", text: "x".repeat(281) });
    port.postMessage({ type: "ask", text: "x", extra: 1 });
    await settle();
    expect(askText()).toBeNull();
  });

  test("initialRequest shows at mount, normalised and armed at once", async () => {
    const { send } = mountAsk({ initialRequest: { kind: "ask", text: "Compare\n the top two" } });
    const button = await screen.findByRole("button", { name: "Send: Compare the top two" });
    fireEvent.click(button);
    expect(send).toHaveBeenCalledWith("Compare the top two", ID, expect.any(Function));
  });

  test("with two frames, an ask in A leaves B's pending request as it was (Review Focus 4)", async () => {
    const sendA = vi.fn();
    const sendB = vi.fn();
    const view = render(
      <>
        <AskHost s={surface()} ask={{ send: sendA, disabledReason: null }} tag="a" />
        <AskHost s={{ ...surface(), id: SECOND_ID }} ask={{ send: sendB, disabledReason: null }} tag="b" />
      </>,
    );
    const [frameA, frameB] = [...view.container.querySelectorAll("iframe")];
    const a = ready(frameA);
    const b = ready(frameB);
    await settle();
    b.port.postMessage({ type: "ask", text: "From B" });
    const fromB = await screen.findByRole("button", { name: "Send: From B" });
    a.port.postMessage({ type: "ask", text: "From A" });
    const fromA = await screen.findByRole("button", { name: "Send: From A" });
    const reqA = view.container.querySelector('[data-requests="a"]')!;
    const reqB = view.container.querySelector('[data-requests="b"]')!;
    expect(reqA.contains(fromA)).toBe(true);
    expect(reqB.contains(fromB)).toBe(true);
    a.port.postMessage({ type: "ask", text: "From A again" });
    await screen.findByRole("button", { name: "Send: From A again" });
    expect(fromB.isConnected).toBe(true);
    expect(reqB.querySelectorAll(".rf-ask__text")).toHaveLength(1);
    pressChip(fromB);
    expect(sendB).toHaveBeenCalledWith("From B", SECOND_ID, expect.any(Function));
    expect(sendA).not.toHaveBeenCalled();
  });
});
