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
import { ViewHostContext } from "../ViewHostContext";
import { CHIP_ARM_MS, CHIP_PROMPT, GENERATED_VIEW_LABEL, SandboxFrame, type SandboxSurface } from "./SandboxFrame";

const ID = "44444444-4444-4444-8444-444444444444";
const THREAD = "11111111-1111-4111-8111-111111111111";
const FALLBACK_TEXT = "Here is the plain view.";
const SHORTLIST_A: ActionIntent = { name: "shortlist.set", jobId: JOB_A, state: "shortlisted" };
const SKIP_B: ActionIntent = { name: "shortlist.set", jobId: JOB_B, state: "skipped", reasonCode: "pay" };

const ports: MessagePort[] = [];

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  actions.describeFrameIntentAction.mockReset();
  actions.reportSurfaceFailure.mockReset();
  actions.reportSurfaceFailure.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
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
          <ViewHostContext.Provider value={{ requestsEl: el, expanded: false, onEscape: () => {} }}>
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
      <ViewHostContext.Provider value={{ requestsEl: null, expanded: true, onEscape }}>
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
      <ViewHostContext.Provider value={{ requestsEl: null, expanded: false, onEscape: second }}>
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
