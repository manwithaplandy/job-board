"use client";

import { Component, useCallback, useSyncExternalStore, type ReactNode } from "react";
import type { ActionIntent } from "@/lib/agent/actions/intents";
import type { HostChain, HostSurface } from "@/lib/agent/surfaces/host";
import { BlockList } from "./blocks/BlockList";

// The agent page's surface host (plan Task 1.20). The page renders a surface only here,
// through BlockList: the payload and gathered data were total-parsed on the server
// (lib/agent/surfaces/host.ts), and anything a block throws while rendering is caught
// by the boundary below and replaced with one fixed line.

/** The fixed line in place of a surface that failed to render. */
export const SURFACE_FAILED_TEXT = "This view could not be shown. Ask again to see it.";

class SurfaceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("agent: a surface failed to render", error instanceof Error ? error.name : typeof error);
  }
  render() {
    return this.state.failed ? <p className="rf-agent-surface__failed">{SURFACE_FAILED_TEXT}</p> : this.props.children;
  }
}

/**
 * Folds a surface row into the chains: an update (its `supersedes` is a row of a known
 * chain) replaces that chain's surface in place, so an updated surface stays one object;
 * anything else starts a new chain. Returns the same array when the row is already the
 * latest of its chain.
 */
export function mergeSurface(chains: readonly HostChain[], surface: HostSurface): HostChain[] {
  const known = chains.findIndex((c) => c.memberIds.includes(surface.id));
  if (known !== -1) return chains as HostChain[];
  const parent = surface.supersedes === null ? -1 : chains.findIndex((c) => c.memberIds.includes(surface.supersedes as string));
  if (parent === -1) return [...chains, { chainId: surface.id, memberIds: [surface.id], surface }];
  const updated: HostChain = { ...chains[parent], memberIds: [...chains[parent].memberIds, surface.id], surface };
  // The updated chain moves to the end: it is now the newest surface.
  return [...chains.slice(0, parent), ...chains.slice(parent + 1), updated];
}

const WIDE_QUERY = "(min-width: 1024px)";

function subscribeWide(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function wideNow(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(WIDE_QUERY).matches;
}

/** Whether the latest surface takes the wide column (1024px and wider). Narrow on the server. */
export function useWideLayout(): boolean {
  return useSyncExternalStore(subscribeWide, wideNow, () => false);
}

/** One surface, drawn by BlockList. `surfaceKey` is the row id, so a new row remounts every block. */
export function SurfaceHost({
  surface,
  onIntent,
  onPrepSettled,
}: {
  surface: HostSurface;
  onIntent: (surfaceId: string, intent: ActionIntent) => void;
  onPrepSettled: (surfaceId: string, jobId: string) => void;
}) {
  const id = surface.id;
  const intent = useCallback((i: ActionIntent) => onIntent(id, i), [onIntent, id]);
  const settled = useCallback((jobId: string) => onPrepSettled(id, jobId), [onPrepSettled, id]);
  return (
    <div className="rf-agent-surface" data-surface-id={id}>
      <SurfaceBoundary key={id}>
        <BlockList
          payload={surface.payload}
          gathered={surface.gathered}
          rows={surface.rows}
          surfaceKey={id}
          onIntent={intent}
          onPrepSettled={settled}
        />
      </SurfaceBoundary>
    </div>
  );
}
