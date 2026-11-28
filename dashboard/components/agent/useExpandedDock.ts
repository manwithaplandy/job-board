"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { inertOthers, isToastContainer } from "./inertOthers";

// The dock's side of an expanded view (spec 08 S6.2, S6.3). The dock is the bottom of the
// chat (status line, approval alert, confirm card, composer); while a view is expanded it is
// fixed over the view's bottom edge, and everything but the expanded frame, the dock and
// the toast region is inert. Nothing is moved in the DOM.
//
// - inert: re-applied on every commit while expanded (restore, then apply), because the
//   expanded frame can be a new element (its chain's update landed in a newer message) and
//   new messages are appended while a turn runs. The restore runs on collapse and unmount.
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

  // No dependency list on purpose: see the header.
  useLayoutEffect(() => {
    if (expandedChainId === null) return;
    const frame = frameOfChain(chatRef.current, expandedChainId);
    const dock = dockRef.current;
    if (!frame || !dock) return;
    return inertOthers([frame, dock], isToastContainer);
  });

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
