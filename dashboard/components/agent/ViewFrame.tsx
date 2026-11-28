"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import type { ActionIntent } from "@/lib/agent/actions/intents";
import type { HostChain, HostSurface } from "@/lib/agent/surfaces/host";
import { Button } from "@/components/ui/Button";
import { RERENDER_LABEL, RerenderControls, VersionTabs, useRerender } from "./RerenderTabs";
import { DEGRADED_CAPTION, showsDegradedCaption, SurfaceHost } from "./SurfaceHost";
import { GENERATED_VIEW_LABEL } from "./sandbox/SandboxFrame";
import { ViewHostContext, type ViewHost } from "./ViewHostContext";

// The view frame (spec 08 S5): the one wrapper every chain renders in, in every variant,
// inline at the present part that made it. It owns the title, the version tabs, the
// "Re-render as" buttons (spec 08 S8) and, for a sandbox view, the region its chip goes to
// (ViewHostContext). The page keys it by chain id, never by row id, so an update or a
// version switch keeps this <section> and swaps only the SurfaceHost inside it, which is
// keyed by row id.
//
// A variant 3 view that mounts a frame keeps the dashed border and the "Generated view"
// label (spec 05 S10 item 5), moved here from SandboxFrame; every other view, a variant 3
// row showing its fallback blocks included, has the solid frame.
//
// Expand (spec 08 S6) restyles this same <section> to fill the viewport
// (`data-expanded="true"`, agent.css); it is never moved, portalled or re-created, because a
// browser reloads an iframe that is re-parented and SandboxFrame stores a second load as a
// self-navigation. The page holds which chain is expanded (useExpandedView) and passes it in,
// so a frame that remounts in a newer message (its chain was updated there) comes back
// expanded. The header button is Expand, or Close while expanded; focus moves to it on each
// change. Expanded, the frame is a non-modal dialog (the composer stays reachable in the
// dock), and below 900px the "Re-render as" buttons sit behind one disclosure.
//
// The change fades over 120ms both ways (spec 08 S6.1), and not at all under
// prefers-reduced-motion. Opening fades the expanded frame in (`data-fade="open"`).
// Closing keeps the fixed layout for the fade out (`data-fade="close"`, agent.css), while
// everything else (the dialog role, focus, the page's inert and scroll) is restored at once.
// A frame mounted already expanded has no fade, so a remount does not replay the open one.

export const EXPAND_TEXT = "Expand";
export const CLOSE_TEXT = "Close";
export const CLOSE_LABEL = "Close expanded view";
/** How long a closing view keeps its fixed layout: the 120ms fade out and a little slack. */
export const CLOSE_FADE_MS = 150;

type Fade = "open" | "close" | null;

/**
 * Focuses a control in this page, also when focus is inside a view's sandbox iframe (an
 * Escape pressed in the frame). Chromium and WebKit move focus out of the frame on
 * element.focus() alone; Firefox keeps the frame's browsing context focused, so the page's
 * activeElement stays the iframe. Blurring the iframe gives focus back to this document,
 * and focusing the window makes it the focused browsing context, before the control takes
 * focus. With focus already in the page (Close, Escape on the page) this is a plain focus.
 */
export function focusInPage(el: HTMLElement): void {
  const active = document.activeElement;
  if (active instanceof HTMLIFrameElement) {
    active.blur();
    window.focus();
  }
  el.focus({ preventScroll: true });
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The heading of a view: its payload's title when it has one, else "View". */
export function viewTitle(surface: HostSurface): string {
  const title =
    surface.view.kind === "tree" ? surface.view.tree.title : surface.view.kind === "sandbox" ? surface.view.document.title : surface.payload.title;
  return typeof title === "string" && title.trim() !== "" ? title : "View";
}

export interface ViewFrameProps {
  chain: HostChain;
  threadId: string;
  /** The operator switch; null hides the re-render buttons (no plan). */
  variant3Enabled: boolean | null;
  onIntent: (surfaceId: string, intent: ActionIntent, source: "host" | "frame") => void;
  onPrepSettled: (surfaceId: string, jobId: string) => void;
  onFallback?: (surfaceId: string) => void;
  onRerendered: (surface: HostSurface) => void;
  /** This frame is the expanded one (spec 08 S6). */
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  /**
   * Escape from inside the view (the sandbox frame's in-frame Escape). The page passes its
   * gated path (useExpandedView's requestEscape), so a confirm card blocks it as it blocks
   * Escape on the page; without it, onCollapse.
   */
  onEscape?: () => void;
  /** The title heading, so "Go to it" can focus it. */
  headerRef?: Ref<HTMLHeadingElement>;
  /** PR 6 (spec 08 S10): where a sandbox view's pending ask goes on Send; none disables Send. */
  ask?: ViewHost["ask"];
  /** Fixture seam (PR 6): the sandbox view of this surface id shows this request at mount. */
  initialRequest?: { surfaceId: string; request: { kind: "ask"; text: string } };
  /**
   * Gallery seam only (the sandbox harness and the replay page, which drive SandboxFrame
   * with their own server stub and log its fallback reasons): drawn in the body in place of
   * SurfaceHost. Product code never passes it.
   */
  children?: ReactNode;
}

export function ViewFrame({
  chain,
  threadId,
  variant3Enabled,
  onIntent,
  onPrepSettled,
  onFallback,
  onRerendered,
  expanded,
  onExpand,
  onCollapse,
  onEscape,
  headerRef,
  ask,
  initialRequest,
  children,
}: ViewFrameProps) {
  const { versions, shown, selected, select, busy, message, rerender } = useRerender(chain, onRerendered, threadId);
  // The requests element goes to the renderer through state, so a sandbox frame portals its
  // chip there once the element exists.
  const [requestsEl, setRequestsEl] = useState<HTMLDivElement | null>(null);
  const escape = onEscape ?? onCollapse;
  const askSink = ask ?? null;
  const host = useMemo<ViewHost>(
    () => ({ requestsEl, expanded, onEscape: expanded ? escape : () => {}, ask: askSink }),
    [requestsEl, expanded, escape, askSink],
  );
  const [rerenderOpen, setRerenderOpen] = useState(false);
  // The fade, and the disclosure closed again on collapse. State adjusted during render.
  const [prevExpanded, setPrevExpanded] = useState(expanded);
  const [fade, setFade] = useState<Fade>(null);
  if (prevExpanded !== expanded) {
    setPrevExpanded(expanded);
    setFade(expanded ? "open" : prefersReducedMotion() ? null : "close");
    if (!expanded) setRerenderOpen(false);
  }
  useEffect(() => {
    if (fade !== "close") return;
    const timer = window.setTimeout(() => setFade(null), CLOSE_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [fade]);
  const actionsId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const title = viewTitle(shown);
  const generated = shown.variant === 3 && shown.view.kind === "sandbox";

  // Focus follows the change (spec 08 S6.3): Close on expand, the same button (now Expand)
  // on collapse. A frame mounted already expanded (its chain was updated in a newer message,
  // which mounts a new section) takes focus only when the old one's removal left it nowhere.
  const wasExpanded = useRef<boolean | null>(null);
  useEffect(() => {
    const before = wasExpanded.current;
    wasExpanded.current = expanded;
    const button = sectionRef.current?.querySelector<HTMLButtonElement>(".rf-view__expand");
    if (!button) return;
    if (before === null) {
      const active = document.activeElement;
      if (expanded && (active === null || active === document.body)) button.focus({ preventScroll: true });
      return;
    }
    if (before !== expanded) focusInPage(button);
  }, [expanded]);

  return (
    <section
      ref={sectionRef}
      className="rf-view"
      data-chain-id={chain.chainId}
      data-variant={shown.variant}
      data-frame={generated ? "dashed" : "solid"}
      data-expanded={expanded ? "true" : undefined}
      data-fade={fade ?? undefined}
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded ? "false" : undefined}
      aria-label={expanded ? `Expanded view: ${title}` : `View: ${title}`}
    >
      <header className="rf-view__header">
        <div className="rf-view__heading">
          {generated && <span className="rf-view__kind">{GENERATED_VIEW_LABEL}</span>}
          <h3 ref={headerRef} className="rf-view__title" tabIndex={-1}>
            {title}
          </h3>
          {showsDegradedCaption(shown) && <p className="rf-view__caption">{DEGRADED_CAPTION}</p>}
        </div>
        <div className="rf-view__versions">
          <VersionTabs versions={versions} selected={selected} onSelect={select} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="rf-view__expand"
          aria-expanded={expanded}
          aria-label={expanded ? CLOSE_LABEL : `Expand view: ${title}`}
          onClick={expanded ? onCollapse : onExpand}
        >
          {expanded ? CLOSE_TEXT : EXPAND_TEXT}
        </Button>
      </header>
      <div className="rf-view__body">
        <ViewHostContext.Provider value={host}>
          {children ?? (
            <SurfaceHost
              key={shown.id}
              surface={shown}
              onIntent={onIntent}
              onPrepSettled={onPrepSettled}
              onFallback={onFallback}
              initialRequest={initialRequest?.surfaceId === shown.id ? initialRequest.request : undefined}
            />
          )}
        </ViewHostContext.Provider>
      </div>
      <div ref={setRequestsEl} className="rf-view__requests" />
      {/* Without a plan there is nothing to re-render, so no footer (busy and message stay unset). */}
      {variant3Enabled !== null && (
        <footer className="rf-view__footer" data-rerender-open={expanded ? String(rerenderOpen) : undefined}>
          {/* Expanded below 900px the buttons sit behind this disclosure (agent.css hides it from 900px). */}
          {expanded && (
            <Button
              variant="ghost"
              size="sm"
              className="rf-view__rerender-toggle"
              aria-expanded={rerenderOpen}
              aria-controls={actionsId}
              onClick={() => setRerenderOpen((open) => !open)}
            >
              {RERENDER_LABEL}
            </Button>
          )}
          <RerenderControls
            shownVariant={shown.variant}
            variant3Enabled={variant3Enabled}
            busy={busy}
            message={message}
            onRerender={rerender}
            actionsId={actionsId}
          />
        </footer>
      )}
    </section>
  );
}
