"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// The expanded view's state (spec 08 S6.3): one view at a time, held by the chat (above the
// message list, so a chain that moves to a newer message keeps it), with the browser's Back
// button and Escape on the page closing it.
//
// - expand(id) pushes `{ rfView: id }` with the URL unchanged. When another view is already
//   expanded and its entry is on top, the entry is replaced instead, so one Back still
//   closes whatever is expanded ("Show it", spec 08 S6.2).
// - collapse() goes back when the view's own entry is on top, so no dead entry is left;
//   otherwise (the fixture seam, or something pushed since) it only clears the id.
// - popstate: an `rfView` naming a chain on the page expands it; an unknown chain is
//   ignored; any other state collapses. Popstate never writes history. The first popstate
//   after collapse()'s own back() is that back arriving, and is swallowed: back() is
//   asynchronous, so a view expanded again before it lands is not collapsed by it. If no
//   popstate comes within PENDING_BACK_MS (back() can be a no-op, for example when the
//   browser drops the entry), the flag is cleared, so the user's next real Back is not
//   swallowed.
// - requestEscape() is the one Escape path, for Escape on the page and the sandbox frame's
//   in-frame Escape alike: it collapses unless `blocked()` (a confirm card shows; it has its
//   own Cancel). Escape on the page is also ignored when something already handled the key
//   or an IME composition is under way (the key ends the composition).
// - A chain that leaves the page collapses the view without touching history.
// - While expanded, <html> carries EXPANDED_HTML_CLASS (overflow: hidden). Unmount removes
//   it and the listeners and leaves history alone.
// Not deep-linkable by design: a reload shows the view inline.

export const EXPANDED_HTML_CLASS = "rf-view-expanded";

/** How long collapse()'s back() may take to arrive as a popstate before the page stops waiting for it. */
export const PENDING_BACK_MS = 500;

/** The chain an `rfView` history entry names, or null. History state is untrusted input. */
function rfViewOf(state: unknown): string | null {
  return state !== null && typeof state === "object" && "rfView" in state && typeof state.rfView === "string" ? state.rfView : null;
}

export interface ExpandedView {
  expandedChainId: string | null;
  expand(chainId: string): void;
  collapse(): void;
  /** Escape, from the page or from inside a view: collapses unless blocked(). */
  requestEscape(): void;
}

export function useExpandedView(opts: {
  /** The chains on the page now. */
  chainIds: readonly string[];
  /** True while a ConfirmCard shows: Escape does nothing. */
  blocked: () => boolean;
  /** Fixture seam: start with this chain expanded. No history entry is pushed for it. */
  initial?: string;
}): ExpandedView {
  const { chainIds, blocked } = opts;
  const [stored, setStored] = useState<string | null>(opts.initial ?? null);
  // A chain that left the page (thread switch, its row replaced) collapses the view; history
  // is left as it is. State adjusted during render, so no effect and no extra frame.
  const expandedChainId = stored !== null && chainIds.includes(stored) ? stored : null;
  if (stored !== null && expandedChainId === null) setStored(null);

  const latest = useRef({ expandedChainId, chainIds, blocked });
  useLayoutEffect(() => {
    latest.current = { expandedChainId, chainIds, blocked };
  });

  const expand = useCallback((chainId: string) => {
    const current = latest.current.expandedChainId;
    if (current !== null && rfViewOf(window.history.state) === current) window.history.replaceState({ rfView: chainId }, "");
    else window.history.pushState({ rfView: chainId }, "");
    latest.current = { ...latest.current, expandedChainId: chainId };
    setStored(chainId);
  }, []);

  // Set while collapse()'s back() has not yet arrived as a popstate, for PENDING_BACK_MS at most.
  const pendingBack = useRef(false);
  const pendingBackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPendingBack = useCallback(() => {
    pendingBack.current = false;
    if (pendingBackTimer.current !== null) clearTimeout(pendingBackTimer.current);
    pendingBackTimer.current = null;
  }, []);
  const collapse = useCallback(() => {
    const current = latest.current.expandedChainId;
    if (current === null) return;
    latest.current = { ...latest.current, expandedChainId: null };
    setStored(null);
    if (rfViewOf(window.history.state) === current) {
      clearPendingBack();
      pendingBack.current = true;
      pendingBackTimer.current = setTimeout(clearPendingBack, PENDING_BACK_MS);
      window.history.back();
    }
  }, [clearPendingBack]);

  const requestEscape = useCallback(() => {
    if (latest.current.expandedChainId === null || latest.current.blocked()) return;
    collapse();
  }, [collapse]);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (pendingBack.current) {
        clearPendingBack();
        return;
      }
      const named = rfViewOf(e.state);
      if (named === null) {
        latest.current = { ...latest.current, expandedChainId: null };
        setStored(null);
      } else if (latest.current.chainIds.includes(named)) {
        latest.current = { ...latest.current, expandedChainId: named };
        setStored(named);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
      requestEscape();
    };
    window.addEventListener("popstate", onPopState);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [requestEscape, clearPendingBack]);

  // Unmount drops a pending timer (and the flag with it).
  useEffect(() => clearPendingBack, [clearPendingBack]);

  const isExpanded = expandedChainId !== null;
  useEffect(() => {
    if (!isExpanded) return;
    const html = document.documentElement;
    html.classList.add(EXPANDED_HTML_CLASS);
    return () => html.classList.remove(EXPANDED_HTML_CLASS);
  }, [isExpanded]);

  return { expandedChainId, expand, collapse, requestEscape };
}
