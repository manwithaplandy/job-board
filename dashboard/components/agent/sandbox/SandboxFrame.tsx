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
//     action_total_limit).
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
// What jsdom cannot show (the sandbox, the CSP, navigation, real message ports between
// documents) is Task 2.7's real-browser suite.
import { useEffect, useRef, useState } from "react";
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
  FRAME_LIVENESS,
  parseFrameMessage,
  type FrameAction,
  type FrameFailure,
} from "@/lib/agent/surfaces/v3/bridge";
import { describeFrameIntentAction, reportSurfaceFailure, type FrameChip } from "@/app/actions/agent";
import { Button } from "@/components/ui/Button";
import { BlockList } from "../blocks/BlockList";
import type { BlockRows } from "../blocks/types";

export const GENERATED_VIEW_LABEL = "Generated view";
export const CHIP_PROMPT = "The view wants to:";
export const CHIP_REGION_LABEL = "Requests from the generated view";
/** A chip ignores presses for this long after it appears or its request changes (I3). */
export const CHIP_ARM_MS = 700;

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
  /** Bumped by every action message, so only the newest request's chip is shown. */
  requestSeq: number;
}

function pageTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function SandboxFrame({ surface, onIntent, onFallback, onPrepSettled, server }: SandboxFrameProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ surface, onIntent, onFallback, server });
  // Both are kept with the surface id they belong to, so a new surface starts clean.
  const [fallbackState, setFallbackState] = useState<{ id: string; payload: SurfacePayloadV1 } | null>(null);
  const [chipState, setChipState] = useState<{ id: string; seq: number; shownAt: number; chip: FrameChip } | null>(
    null,
  );
  const fallback = fallbackState?.id === surface.id ? fallbackState.payload : null;
  const chipEntry = chipState?.id === surface.id ? chipState : null;

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
      requestSeq: 0,
    };
    const iframe = document.createElement("iframe");
    let timer = 0;
    let pingTimer = 0;
    let pongTimer = 0;
    let hostLeavingAt = Number.NEGATIVE_INFINITY;
    const onHostLeaving = () => {
      hostLeavingAt = Date.now();
    };

    function teardown() {
      window.clearTimeout(timer);
      window.clearInterval(pingTimer);
      window.clearTimeout(pongTimer);
      window.removeEventListener("message", onWindowMessage);
      window.removeEventListener("beforeunload", onHostLeaving, true);
      window.removeEventListener("pagehide", onHostLeaving, true);
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
      setChipState(null);
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
          setChipState(described === null ? null : { id: s.id, seq, shownAt: Date.now(), chip: described });
        },
        () => {},
      );
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
      port.postMessage({ type: "init", data, theme: pageTheme() });
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

  const pending = chipEntry?.chip ?? null;
  return (
    <section className="rf-sandbox" aria-label={`${GENERATED_VIEW_LABEL}: ${surface.payload.title}`}>
      <p className="rf-sandbox__header">
        <span className="rf-sandbox__label">{GENERATED_VIEW_LABEL}</span>
        <span className="rf-sandbox__title">{surface.payload.title}</span>
      </p>
      <div ref={holderRef} className="rf-sandbox__holder" />
      <div className="rf-sandbox__requests" role="region" aria-label={CHIP_REGION_LABEL} aria-live="polite">
        {pending && chipEntry && (
          <div className="rf-sandbox__chip" key={chipEntry.seq}>
            <p className="rf-sandbox__prompt">{CHIP_PROMPT}</p>
            <Button
              variant="secondary"
              size="sm"
              data-sandbox-chip=""
              onClick={() => {
                // A press within CHIP_ARM_MS of the chip appearing or changing is ignored.
                if (Date.now() - chipEntry.shownAt < CHIP_ARM_MS) return;
                setChipState(null);
                onIntent(surface.id, pending.intent, "frame");
              }}
            >
              {pending.label}
            </Button>
            {pending.proposed && pending.proposed.length > 0 && (
              <ul className="rf-sandbox__proposed">
                {pending.proposed.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
            <Button variant="ghost" size="sm" onClick={() => setChipState(null)}>
              Dismiss
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
