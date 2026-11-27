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
//   ignored; any other state collapses. Popstate never writes history.
// - Escape on the page collapses, unless `blocked()` (a confirm card shows; it has its own
//   Cancel) or something already handled the key.
// - A chain that leaves the page collapses the view without touching history.
// - While expanded, <html> carries EXPANDED_HTML_CLASS (overflow: hidden). Unmount removes
//   it and the listeners and leaves history alone.
// Not deep-linkable by design: a reload shows the view inline.

export const EXPANDED_HTML_CLASS = "rf-view-expanded";

/** The chain an `rfView` history entry names, or null. History state is untrusted input. */
function rfViewOf(state: unknown): string | null {
  return state !== null && typeof state === "object" && "rfView" in state && typeof state.rfView === "string" ? state.rfView : null;
}

export interface ExpandedView {
  expandedChainId: string | null;
  expand(chainId: string): void;
  collapse(): void;
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

  const collapse = useCallback(() => {
    const current = latest.current.expandedChainId;
    if (current === null) return;
    latest.current = { ...latest.current, expandedChainId: null };
    setStored(null);
    if (rfViewOf(window.history.state) === current) window.history.back();
  }, []);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
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
      if (e.key !== "Escape" || e.defaultPrevented || latest.current.expandedChainId === null || latest.current.blocked()) return;
      collapse();
    };
    window.addEventListener("popstate", onPopState);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [collapse]);

  const isExpanded = expandedChainId !== null;
  useEffect(() => {
    if (!isExpanded) return;
    const html = document.documentElement;
    html.classList.add(EXPANDED_HTML_CLASS);
    return () => html.classList.remove(EXPANDED_HTML_CLASS);
  }, [isExpanded]);

  return { expandedChainId, expand, collapse };
}
