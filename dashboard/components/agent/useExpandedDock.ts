"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { inertOthers, isToastContainer } from "./inertOthers";

// The dock's side of an expanded view (spec 08 S6.2, S6.3). The dock is the bottom of the
// chat (status line, approval alert, confirm card, composer); while a view is expanded it is
// fixed over the view's bottom edge, and everything but the expanded frame, the dock and
// the toast region is inert. Nothing is moved in the DOM.
//
// - inert: applied when a view is expanded, and re-applied (restore, then apply) only when
//   the page's structure around it changes: the expanded frame or the dock is a new element
//   (a chain's update landed in a newer message), or an element on the kept paths gained or
//   lost children (new messages are appended while a turn runs). A MutationObserver on the
//   conversation root watches childList only, so a timer tick or a streamed word, which
//   changes text deeper down, does not re-walk the page. The restore runs on collapse and
//   unmount.
// - `--rf-dock-h` on the conversation root: the dock's height, for the view's bottom
//   padding, written by a ResizeObserver while expanded.
// - `--rf-dock-bottom` on the conversation root: how far the on-screen keyboard pushes the
//   dock up on phones (layout viewport height minus visual viewport height and offset),
//   from visualViewport's resize and scroll events while expanded.

export const DOCK_HEIGHT_VAR = "--rf-dock-h";
export const DOCK_BOTTOM_VAR = "--rf-dock-bottom";

/** The `.rf-view` of a chain inside `root`, matched on its data attribute (no selector escaping needed). */
export function frameOfChain(root: ParentNode | null | undefined, chainId: string): HTMLElement | null {
  return [...(root?.querySelectorAll<HTMLElement>(".rf-view") ?? [])].find((el) => el.dataset.chainId === chainId) ?? null;
}

export function useExpandedDock({
  expandedChainId,
  rootRef,
  chatRef,
}: {
  expandedChainId: string | null;
  /** The conversation root (`.rf-agent-conversation`), which carries the dock variables. */
  rootRef: RefObject<HTMLElement | null>;
  /** The chat section that holds the frames and the dock. */
  chatRef: RefObject<HTMLElement | null>;
}): RefObject<HTMLDivElement | null> {
  const dockRef = useRef<HTMLDivElement | null>(null);

  // Applied on expand and re-applied on a structural change only: see the header.
  useLayoutEffect(() => {
    if (expandedChainId === null) return;
    let frame: HTMLElement | null = null;
    let dock: HTMLElement | null = null;
    let restore: (() => void) | null = null;
    // The elements whose children inert was decided for: every ancestor of the frame and
    // the dock up to body. A childList change on one of them may add a sibling to make inert.
    let watched = new Set<Node>();
    const apply = () => {
      restore?.();
      restore = null;
      watched = new Set();
      frame = frameOfChain(chatRef.current, expandedChainId);
      dock = dockRef.current;
      if (!frame || !dock) return;
      for (const kept of [frame, dock]) {
        for (let e = kept.parentElement; e && e !== document.body; e = e.parentElement) watched.add(e);
      }
      watched.add(document.body);
      restore = inertOthers([frame, dock], isToastContainer);
    };
    apply();
    const target = rootRef.current ?? chatRef.current;
    const observer =
      target && typeof MutationObserver === "function"
        ? new MutationObserver((records) => {
            const moved = frameOfChain(chatRef.current, expandedChainId) !== frame || dockRef.current !== dock;
            if (moved || records.some((r) => watched.has(r.target))) apply();
          })
        : null;
    if (target) observer?.observe(target, { childList: true, subtree: true });
    return () => {
      observer?.disconnect();
      restore?.();
    };
  }, [expandedChainId, chatRef, rootRef]);

  const isExpanded = expandedChainId !== null;
  useEffect(() => {
    const root = rootRef.current;
    const dock = dockRef.current;
    if (!isExpanded || !root || !dock) return;
    const writeHeight = () => root.style.setProperty(DOCK_HEIGHT_VAR, `${Math.round(dock.getBoundingClientRect().height)}px`);
    writeHeight();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(writeHeight) : null;
    observer?.observe(dock);

    const viewport = window.visualViewport;
    const writeBottom = () => {
      if (!viewport) return;
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty(DOCK_BOTTOM_VAR, `${Math.round(covered)}px`);
    };
    writeBottom();
    viewport?.addEventListener("resize", writeBottom);
    viewport?.addEventListener("scroll", writeBottom);
    return () => {
      observer?.disconnect();
      viewport?.removeEventListener("resize", writeBottom);
      viewport?.removeEventListener("scroll", writeBottom);
      root.style.removeProperty(DOCK_HEIGHT_VAR);
      root.style.removeProperty(DOCK_BOTTOM_VAR);
    };
  }, [isExpanded, rootRef]);

  return dockRef;
}
