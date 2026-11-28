"use client";

// The variant 3 host (plan Task 2.6, spec 10 "Variant 3 sandbox", decision D13). It shows
// the model's HTML in an iframe with sandbox="allow-scripts" and nothing else, no allow
// attribute, referrerpolicy="no-referrer", its srcdoc set from JavaScript before the frame
// is attached (so there is no about:blank load first), and it falls back to the variant 1
// payload (reportSurfaceFailure, then BlockList) on:
//   - no inited ack within 3,000 ms (no_handshake): the timer ends only on the kit's ack
//     of init over the port, not on ready (fix round 1, I2);
//   - a ping over the port, sent on every load event and about once a second after the
//     ack, with no pong within 2,500 ms (no_heartbeat): the document stopped answering,
//     because it navigated, hung, or was replaced (fix round 1, I2);
//   - an error message (frame_error);
//   - a second load event, which is the frame navigating itself (self_navigation);
//   - a navigating message from the kit (self_navigation, Task 2.7 CI run 2): the document
//     fired beforeunload or a navigate event to another document. WebKit never commits a
//     navigation whose response never finishes, so neither a second load nor a missed pong
//     would come. The message is ignored within FRAME_LIVENESS.hostLeavingGraceMs of this
//     page's own beforeunload or pagehide, because a page that unloads fires beforeunload
//     in its frames too;
//   - more than 10 action messages in a minute or 30 in all (action_rate_limit,
//     action_total_limit);
//   - more than 6 ask messages in a minute or 20 in all (ask_rate_limit, ask_total_limit;
//     PR 6, spec 08 S10.3). Every ask counts, one whose text normalises to nothing included.
// Every fallback removes the frame first, so nothing in it keeps running.
//
// The handshake (stricter than the plan, see kit.ts): the only window message accepted is
// the first ready, from this frame's window, with origin "null", parsed, carrying exactly
// one MessagePort. Init (the sandboxSnapshot of the gathered data, never the gathered
// data itself) goes back on that port, and every later message is read from it. Each
// message is parsed with parseFrameMessage and dropped if it does not parse.
//
// D13: an action message never runs anything by itself, since script in the frame can
// send one on load or in a loop. The server parses it with the closed enum and describes
// it from database values (describeFrameIntentAction); it becomes one chip under the
// frame, a newer request replacing it, and only the user's press of the chip calls
// onIntent with source "frame". The chip is keyed by its request number and ignores
// presses for CHIP_ARM_MS after it appears or changes, so a frame cannot swap a new
// request in under a press aimed at the old one (fix round 1, I3). High-risk intents then still answer with the fixed
// ConfirmCard (the parent's handling of the outcome). The one exception is an open of a
// workspace page with nothing else, which may run without a press once per surface.
//
// PR 6 (spec 08 S10.2, layer 2): an ask message never sends anything either. Its text is
// normalised (normalizeAskText) and shown in full as a pending message in the same request
// region, in place of whatever request was pending (one per frame, keyed by request number,
// the same CHIP_ARM_MS arming). Only a press on its Send, drawn here on host chrome where the
// frame can neither read, cover nor click, hands the text to the page through
// ViewHostContext's ask.send; Send is disabled, with the reason as its description, when the
// view host gives a reason or has no ask sink. initialRequest is the gallery fixture's way to
// show one at mount.
//
// The frame owns no chrome of its own (spec 08 S5): the dashed border, the "Generated view"
// label and the title are ViewFrame's. It renders only the holder, and its chip region goes
// into the view frame's `rf-view__requests` element through ViewHostContext. With no view
// host (the frame rendered alone) the region stays inline after the holder.
//
// What jsdom cannot show (the sandbox, the CSP, navigation, real message ports between
// documents) is Task 2.7's real-browser suite.
import { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ActionIntent } from "@/lib/agent/actions/intents";
import type { GatheredData } from "@/lib/agent/gathered";
import type { SurfacePayloadV1 } from "@/lib/agent/surfaces/v1/blocks";
import {
  V3_LIMITS,
  buildSandboxDocument,
  newSandboxNonce,
  sandboxSnapshot,
  type SurfacePayloadV3,
} from "@/lib/agent/surfaces/v3/document";
import { KIT_CSS, KIT_JS } from "@/lib/agent/surfaces/v3/kit";
import {
  FRAME_ACTION_LIMITS,
  FRAME_ASK_LIMITS,
  FRAME_LIVENESS,
  normalizeAskText,
  parseFrameMessage,
  type FrameAction,
  type FrameAsk,
  type FrameFailure,
} from "@/lib/agent/surfaces/v3/bridge";
import { describeFrameIntentAction, reportSurfaceFailure, type FrameChip } from "@/app/actions/agent";
import { Button } from "@/components/ui/Button";
import { BlockList } from "../blocks/BlockList";
import type { BlockRows } from "../blocks/types";
import { ViewHostContext } from "../ViewHostContext";

/** The label of a variant 3 view; ViewFrame shows it in the view's header (spec 08 S5). */
export const GENERATED_VIEW_LABEL = "Generated view";
export const CHIP_PROMPT = "The view wants to:";
export const CHIP_REGION_LABEL = "Requests from the generated view";
/** A chip ignores presses for this long after it appears or its request changes (I3). */
export const CHIP_ARM_MS = 700;
/** PR 6 (spec 08 S10.2): the caption over a view's pending ask, and its two buttons. */
export const ASK_CAPTION = "Ask from this view";
export const ASK_SEND_TEXT = "Send";
export const ASK_DISMISS_TEXT = "Dismiss";
/** Send's description when the view host has no ask sink (the frame rendered alone). */
export const ASK_UNAVAILABLE = "Sending is not available here.";

/** The one pending request of a frame: an action chip, or a view's ask (PR 6). */
export type PendingRequest = { kind: "action"; chip: FrameChip } | { kind: "ask"; n: number; text: string };

/** A stored variant 3 surface as the host shows it. */
export interface SandboxSurface {
  id: string;
  threadId: string;
  payload: SurfacePayloadV3;
  gathered: GatheredData;
  /** The stored variant 1 fallback (fallback_payload), shown on any failure. */
  fallback: SurfacePayloadV1;
  rows: BlockRows;
}

/** The two server calls the frame host makes. Production uses the server actions. */
export interface SandboxFrameServer {
  describe: typeof describeFrameIntentAction;
  report: typeof reportSurfaceFailure;
}

const SERVER_ACTIONS: SandboxFrameServer = { describe: describeFrameIntentAction, report: reportSurfaceFailure };

export interface SandboxFrameProps {
  surface: SandboxSurface;
  /** "frame" for a chip press or the one direct open; "host" for a press on the fallback's blocks. */
  onIntent: (surfaceId: string, intent: ActionIntent, source: "host" | "frame") => void;
  onFallback?: (reason: FrameFailure) => void;
  onPrepSettled?: (jobId: string) => void;
  /**
   * Test seam for the real-browser enforcement harness (plan Task 2.7,
   * app/ui-gallery/sandbox-harness), which has no database or session. Product code never
   * passes it and gets the server actions. It changes only where the describe and report
   * calls go: every check on the frame's messages, the chip arming and the limits stay.
   */
  server?: SandboxFrameServer;
  /**
   * Fixture seam (PR 6, the gallery's agent-page-ask-pending): a pending ask shown at mount,
   * normalised as a frame's would be and armed at once. Product code never passes it.
   */
  initialRequest?: { kind: "ask"; text: string };
}

interface Live {
  disposed: boolean;
  failed: boolean;
  loads: number;
  port: MessagePort | null;
  /** True once the kit has acknowledged init over the port. */
  inited: boolean;
  /** The last ping number sent, and the one still waiting for its pong (null when none). */
  pingSeq: number;
  awaitingPong: number | null;
  actionTimes: number[];
  actionTotal: number;
  openUsed: boolean;
  /** PR 6: the times of the ask messages in the last window, and how many in all. */
  askTimes: number[];
  askTotal: number;
  /** Bumped by every action and ask message, so only the newest request is shown. */
  requestSeq: number;
}

type RequestEntry = { id: string; seq: number; shownAt: number; request: PendingRequest };

function initialEntry(surfaceId: string, initial: SandboxFrameProps["initialRequest"]): RequestEntry | null {
  if (!initial || initial.kind !== "ask") return null;
  const text = normalizeAskText(initial.text);
  // Armed at once: shown as if it had appeared long ago.
  return text === null ? null : { id: surfaceId, seq: 0, shownAt: Number.NEGATIVE_INFINITY, request: { kind: "ask", n: 0, text } };
}

function pageTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function SandboxFrame({ surface, onIntent, onFallback, onPrepSettled, server, initialRequest }: SandboxFrameProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const viewHost = useContext(ViewHostContext);
  // Read by the port handler, which lives as long as the document: the host's onEscape
  // changes as its view expands and collapses, which must not remount the frame.
  const viewHostRef = useRef(viewHost);
  useLayoutEffect(() => {
    viewHostRef.current = viewHost;
  });
  const latest = useRef({ surface, onIntent, onFallback, server });
  // Both are kept with the surface id they belong to, so a new surface starts clean.
  const [fallbackState, setFallbackState] = useState<{ id: string; payload: SurfacePayloadV1 } | null>(null);
  const [requestState, setRequestState] = useState<RequestEntry | null>(() => initialEntry(surface.id, initialRequest));
  const fallback = fallbackState?.id === surface.id ? fallbackState.payload : null;
  const entry = requestState?.id === surface.id ? requestState : null;
  const reasonId = useId();

  useEffect(() => {
    latest.current = { surface, onIntent, onFallback, server };
  });

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const s = latest.current.surface;
    const live: Live = {
      disposed: false,
      failed: false,
      loads: 0,
      port: null,
      inited: false,
      pingSeq: 0,
      awaitingPong: null,
      actionTimes: [],
      actionTotal: 0,
      openUsed: false,
      askTimes: [],
      askTotal: 0,
      requestSeq: 0,
    };
    const iframe = document.createElement("iframe");
    let timer = 0;
    let pingTimer = 0;
    let pongTimer = 0;
    // Both beforeunload and pagehide stay (PR #58 follow-up, Task 2.8): when this page
    // unloads, the frame's beforeunload (and so the kit's navigating) comes in this page's
    // prompt-to-unload step, which can be well before this page's own pagehide (the
    // browser may wait for the next page's response in between). With pagehide alone that
    // navigating would land outside the grace window and store a false self_navigation on
    // every navigation away. The listeners exist only while a frame is mounted.
    let hostLeavingAt = Number.NEGATIVE_INFINITY;
    const onHostLeaving = () => {
      hostLeavingAt = Date.now();
    };
    // Review M8: a change of the page's theme goes to the frame as a theme message on the
    // port (the kit applies it to data-theme), never as a remount, which would start a new
    // document and spend the mount's action budget again. Sent once init has gone out: the
    // port keeps order, so the kit has init before it.
    let sentTheme: "light" | "dark" | null = null;
    const themeObserver =
      typeof MutationObserver === "function"
        ? new MutationObserver(() => {
            if (live.failed || live.disposed || live.port === null) return;
            const theme = pageTheme();
            if (theme === sentTheme) return;
            sentTheme = theme;
            try {
              live.port.postMessage({ type: "theme", theme });
            } catch {
              // The ping that follows notices a dead port.
            }
          })
        : null;

    function teardown() {
      window.clearTimeout(timer);
      window.clearInterval(pingTimer);
      window.clearTimeout(pongTimer);
      window.removeEventListener("message", onWindowMessage);
      window.removeEventListener("beforeunload", onHostLeaving, true);
      window.removeEventListener("pagehide", onHostLeaving, true);
      themeObserver?.disconnect();
      iframe.removeEventListener("load", onLoad);
      if (live.port) {
        live.port.onmessage = null;
        live.port.close();
        live.port = null;
      }
      iframe.remove();
    }

    function fail(reason: FrameFailure) {
      if (live.failed || live.disposed) return;
      live.failed = true;
      teardown();
      setRequestState(null);
      setFallbackState({ id: s.id, payload: s.fallback });
      latest.current.onFallback?.(reason);
      (latest.current.server ?? SERVER_ACTIONS).report(s.id, reason).then(
        (stored) => {
          if (stored && !live.disposed) setFallbackState({ id: s.id, payload: stored });
        },
        () => {},
      );
    }

    function onAction(msg: FrameAction) {
      const now = Date.now();
      live.actionTotal += 1;
      live.actionTimes = live.actionTimes.filter((t) => now - t < FRAME_ACTION_LIMITS.windowMs);
      live.actionTimes.push(now);
      if (live.actionTotal > FRAME_ACTION_LIMITS.total) return fail("action_total_limit");
      if (live.actionTimes.length > FRAME_ACTION_LIMITS.perMinute) return fail("action_rate_limit");
      const seq = ++live.requestSeq;
      (latest.current.server ?? SERVER_ACTIONS).describe(s.threadId, s.id, msg.name, msg.args).then(
        (described) => {
          if (live.disposed || live.failed || seq !== live.requestSeq) return;
          if (described !== null && described.direct && !live.openUsed) {
            live.openUsed = true;
            latest.current.onIntent(s.id, described.intent, "frame");
            return;
          }
          setRequestState(
            described === null ? null : { id: s.id, seq, shownAt: Date.now(), request: { kind: "action", chip: described } },
          );
        },
        () => {},
      );
    }

    /** PR 6 (spec 08 S10.2, S10.3): an ask becomes the pending request; it never sends anything. */
    function onAsk(msg: FrameAsk) {
      const now = Date.now();
      live.askTotal += 1;
      live.askTimes = live.askTimes.filter((t) => now - t < FRAME_ASK_LIMITS.windowMs);
      live.askTimes.push(now);
      if (live.askTotal > FRAME_ASK_LIMITS.total) return fail("ask_total_limit");
      if (live.askTimes.length > FRAME_ASK_LIMITS.perMinute) return fail("ask_rate_limit");
      const text = normalizeAskText(msg.text);
      if (text === null) return;
      const seq = ++live.requestSeq;
      setRequestState({ id: s.id, seq, shownAt: now, request: { kind: "ask", n: seq, text } });
    }

    /** One ping over the port; while one waits for its pong, no second deadline is set. */
    function ping() {
      if (live.failed || live.disposed || live.port === null || live.awaitingPong !== null) return;
      const n = ++live.pingSeq;
      live.awaitingPong = n;
      pongTimer = window.setTimeout(() => fail("no_heartbeat"), FRAME_LIVENESS.pongWithinMs);
      try {
        live.port.postMessage({ type: "ping", n });
      } catch {
        fail("no_heartbeat");
      }
    }

    function onPortMessage(e: MessageEvent) {
      if (live.failed || live.disposed) return;
      const msg = parseFrameMessage(e.data);
      if (msg === null) return;
      if (msg.type === "inited") {
        if (live.inited) return;
        live.inited = true;
        window.clearTimeout(timer);
        pingTimer = window.setInterval(ping, FRAME_LIVENESS.pingEveryMs);
      } else if (msg.type === "pong") {
        if (live.awaitingPong !== null && msg.n === live.awaitingPong) {
          live.awaitingPong = null;
          window.clearTimeout(pongTimer);
        }
      } else if (msg.type === "resize") {
        iframe.style.height = `${Math.min(msg.height, V3_LIMITS.maxHeightPx)}px`;
      } else if (msg.type === "error") {
        fail("frame_error");
      } else if (msg.type === "action") {
        onAction(msg);
      } else if (msg.type === "ask") {
        // Only once the kit is running, like escape: an ask before inited is ignored.
        if (live.inited) onAsk(msg);
      } else if (msg.type === "escape") {
        // A trusted Escape inside the frame (spec 08 S9.2), only once the kit is running: the
        // view host collapses when this is the expanded view and ignores it otherwise.
        if (live.inited) viewHostRef.current?.onEscape();
      } else if (msg.type === "navigating") {
        // This page is unloading itself, so its frames were told to unload too: not a failure.
        if (Date.now() - hostLeavingAt < FRAME_LIVENESS.hostLeavingGraceMs) return;
        fail("self_navigation");
      }
      // A ready on the port is ignored: the handshake is over.
    }

    function onWindowMessage(e: MessageEvent) {
      if (live.failed || live.disposed || live.port !== null) return;
      const frameWindow = iframe.contentWindow;
      if (frameWindow === null || e.source !== frameWindow || e.origin !== "null") return;
      const msg = parseFrameMessage(e.data);
      if (msg === null || msg.type !== "ready" || e.ports.length !== 1) return;
      let data: unknown;
      try {
        data = sandboxSnapshot(s.gathered);
      } catch {
        return fail("frame_error");
      }
      const port = e.ports[0];
      live.port = port;
      // The handshake timer keeps running until the kit acknowledges init (inited).
      window.removeEventListener("message", onWindowMessage);
      port.onmessage = onPortMessage;
      sentTheme = pageTheme();
      port.postMessage({ type: "init", data, theme: sentTheme });
    }

    function onLoad() {
      live.loads += 1;
      if (live.loads > 1) return fail("self_navigation");
      ping();
    }

    let srcdoc: string;
    try {
      srcdoc = buildSandboxDocument({ html: s.payload.html, nonce: newSandboxNonce(), kitJs: KIT_JS, kitCss: KIT_CSS });
    } catch {
      fail("frame_error");
      return () => {
        live.disposed = true;
      };
    }
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.setAttribute("title", s.payload.title);
    iframe.className = "rf-sandbox__frame";
    iframe.style.height = "0px";
    iframe.srcdoc = srcdoc;
    iframe.addEventListener("load", onLoad);
    window.addEventListener("message", onWindowMessage);
    window.addEventListener("beforeunload", onHostLeaving, true);
    window.addEventListener("pagehide", onHostLeaving, true);
    themeObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    timer = window.setTimeout(() => {
      if (!live.inited) fail("no_handshake");
    }, V3_LIMITS.handshakeMs);
    holder.appendChild(iframe);

    return () => {
      live.disposed = true;
      teardown();
    };
  }, [surface.id]);

  if (fallback) {
    return (
      <div className="rf-sandbox-fallback">
        <BlockList
          payload={fallback}
          gathered={surface.gathered}
          rows={surface.rows}
          surfaceKey={surface.id}
          onIntent={(intent) => onIntent(surface.id, intent, "host")}
          onPrepSettled={onPrepSettled}
        />
      </div>
    );
  }

  const pending = entry?.request ?? null;
  const askSink = viewHost?.ask ?? null;
  const askBlocked = askSink === null ? ASK_UNAVAILABLE : askSink.disabledReason;
  const requests = (
    <div className="rf-sandbox__requests" role="region" aria-label={CHIP_REGION_LABEL} aria-live="polite">
      {entry && pending?.kind === "action" && (
        <div className="rf-sandbox__chip" key={entry.seq}>
          <p className="rf-sandbox__prompt">{CHIP_PROMPT}</p>
          <Button
            variant="secondary"
            size="sm"
            data-sandbox-chip=""
            onClick={() => {
              // A press within CHIP_ARM_MS of the chip appearing or changing is ignored.
              if (Date.now() - entry.shownAt < CHIP_ARM_MS) return;
              setRequestState(null);
              onIntent(surface.id, pending.chip.intent, "frame");
            }}
          >
            {pending.chip.label}
          </Button>
          {pending.chip.proposed && pending.chip.proposed.length > 0 && (
            <ul className="rf-sandbox__proposed">
              {pending.chip.proposed.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          <Button variant="ghost" size="sm" onClick={() => setRequestState(null)}>
            Dismiss
          </Button>
        </div>
      )}
      {entry && pending?.kind === "ask" && (
        <div className="rf-sandbox__chip rf-ask" key={entry.seq} data-sandbox-ask="">
          <p className="rf-sandbox__prompt">{ASK_CAPTION}</p>
          <p className="rf-ask__text">{pending.text}</p>
          <div className="rf-ask__actions">
            <Button
              variant="primary"
              size="sm"
              data-sandbox-ask-send=""
              aria-label={`${ASK_SEND_TEXT}: ${pending.text}`}
              disabled={askBlocked !== null}
              aria-describedby={askBlocked !== null ? reasonId : undefined}
              onClick={() => {
                // A press within CHIP_ARM_MS of the request appearing or changing is ignored,
                // so a frame cannot swap the text in under a press aimed at the old one.
                if (Date.now() - entry.shownAt < CHIP_ARM_MS) return;
                const sink = viewHostRef.current?.ask ?? null;
                if (sink === null || sink.disabledReason !== null) return;
                setRequestState(null);
                sink.send(pending.text, surface.id);
              }}
            >
              {ASK_SEND_TEXT}
            </Button>
            <Button variant="ghost" size="sm" aria-label={`${ASK_DISMISS_TEXT}: ${pending.text}`} onClick={() => setRequestState(null)}>
              {ASK_DISMISS_TEXT}
            </Button>
          </div>
          {askBlocked !== null && (
            <p id={reasonId} className="rf-ask__reason">
              {askBlocked}
            </p>
          )}
        </div>
      )}
    </div>
  );
  return (
    <>
      <div ref={holderRef} className="rf-sandbox__holder" />
      {viewHost === null ? requests : viewHost.requestsEl === null ? null : createPortal(requests, viewHost.requestsEl)}
    </>
  );
}
