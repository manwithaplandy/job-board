"use client";

// The variant 3 host (plan Task 2.6, spec 10 "Variant 3 sandbox", decision D13). It shows
// the model's HTML in an iframe with sandbox="allow-scripts" and nothing else, no allow
// attribute, referrerpolicy="no-referrer", its srcdoc set from JavaScript before the frame
// is attached (so there is no about:blank load first), and it falls back to the variant 1
// payload (reportSurfaceFailure, then BlockList) on:
//   - no ready within 3,000 ms (no_handshake);
//   - an error message (frame_error);
//   - a second load event, which is the frame navigating itself (self_navigation);
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
// onIntent with source "frame". High-risk intents then still answer with the fixed
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
import { FRAME_ACTION_LIMITS, parseFrameMessage, type FrameAction, type FrameFailure } from "@/lib/agent/surfaces/v3/bridge";
import { describeFrameIntentAction, reportSurfaceFailure, type FrameChip } from "@/app/actions/agent";
import { Button } from "@/components/ui/Button";
import { BlockList } from "../blocks/BlockList";
import type { BlockRows } from "../blocks/types";

export const GENERATED_VIEW_LABEL = "Generated view";
export const CHIP_PROMPT = "The view wants to:";
export const CHIP_REGION_LABEL = "Requests from the generated view";

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

export interface SandboxFrameProps {
  surface: SandboxSurface;
  /** "frame" for a chip press or the one direct open; "host" for a press on the fallback's blocks. */
  onIntent: (surfaceId: string, intent: ActionIntent, source: "host" | "frame") => void;
  onFallback?: (reason: FrameFailure) => void;
  onPrepSettled?: (jobId: string) => void;
}

interface Live {
  disposed: boolean;
  failed: boolean;
  loads: number;
  port: MessagePort | null;
  actionTimes: number[];
  actionTotal: number;
  openUsed: boolean;
  /** Bumped by every action message, so only the newest request's chip is shown. */
  requestSeq: number;
}

function pageTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function SandboxFrame({ surface, onIntent, onFallback, onPrepSettled }: SandboxFrameProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ surface, onIntent, onFallback });
  // Both are kept with the surface id they belong to, so a new surface starts clean.
  const [fallbackState, setFallbackState] = useState<{ id: string; payload: SurfacePayloadV1 } | null>(null);
  const [chipState, setChipState] = useState<{ id: string; chip: FrameChip } | null>(null);
  const fallback = fallbackState?.id === surface.id ? fallbackState.payload : null;
  const chip = chipState?.id === surface.id ? chipState.chip : null;

  useEffect(() => {
    latest.current = { surface, onIntent, onFallback };
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
      actionTimes: [],
      actionTotal: 0,
      openUsed: false,
      requestSeq: 0,
    };
    const iframe = document.createElement("iframe");
    let timer = 0;

    function teardown() {
      window.clearTimeout(timer);
      window.removeEventListener("message", onWindowMessage);
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
      reportSurfaceFailure(s.id, reason).then(
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
      describeFrameIntentAction(s.threadId, s.id, msg.name, msg.args).then(
        (described) => {
          if (live.disposed || live.failed || seq !== live.requestSeq) return;
          if (described !== null && described.direct && !live.openUsed) {
            live.openUsed = true;
            latest.current.onIntent(s.id, described.intent, "frame");
            return;
          }
          setChipState(described === null ? null : { id: s.id, chip: described });
        },
        () => {},
      );
    }

    function onPortMessage(e: MessageEvent) {
      if (live.failed || live.disposed) return;
      const msg = parseFrameMessage(e.data);
      if (msg === null) return;
      if (msg.type === "resize") {
        iframe.style.height = `${Math.min(msg.height, V3_LIMITS.maxHeightPx)}px`;
      } else if (msg.type === "error") {
        fail("frame_error");
      } else if (msg.type === "action") {
        onAction(msg);
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
      window.clearTimeout(timer);
      window.removeEventListener("message", onWindowMessage);
      port.onmessage = onPortMessage;
      port.postMessage({ type: "init", data, theme: pageTheme() });
    }

    function onLoad() {
      live.loads += 1;
      if (live.loads > 1) fail("self_navigation");
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
    timer = window.setTimeout(() => {
      if (live.port === null) fail("no_handshake");
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

  const pending = chip;
  return (
    <section className="rf-sandbox" aria-label={`${GENERATED_VIEW_LABEL}: ${surface.payload.title}`}>
      <p className="rf-sandbox__header">
        <span className="rf-sandbox__label">{GENERATED_VIEW_LABEL}</span>
        <span className="rf-sandbox__title">{surface.payload.title}</span>
      </p>
      <div ref={holderRef} className="rf-sandbox__holder" />
      <div className="rf-sandbox__requests" role="region" aria-label={CHIP_REGION_LABEL} aria-live="polite">
        {pending && (
          <div className="rf-sandbox__chip">
            <p className="rf-sandbox__prompt">{CHIP_PROMPT}</p>
            <Button
              variant="secondary"
              size="sm"
              data-sandbox-chip=""
              onClick={() => {
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
