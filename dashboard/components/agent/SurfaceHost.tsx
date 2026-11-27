"use client";

import { Component, useCallback, type ReactNode } from "react";
import type { ActionIntent } from "@/lib/agent/actions/intents";
import type { HostChain, HostSurface } from "@/lib/agent/surfaces/host";
import type { SurfacePayloadV3 } from "@/lib/agent/surfaces/v3/document";
import { BlockList } from "./blocks/BlockList";
import { TreeRenderer } from "./tree/TreeRenderer";
import { SandboxFrame, type SandboxSurface } from "./sandbox/SandboxFrame";

// The agent page's surface host (plan Tasks 1.20 and 2.8). The page renders a surface only
// here: the payload and gathered data were total-parsed on the server
// (lib/agent/surfaces/host.ts), which also picked the renderer (R13, R15), and anything a
// renderer throws while rendering is caught by the boundary below and replaced with one
// fixed line.

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
  // A re-render (Task 2.9) joins its original's chain as another version, in place.
  const original = surface.rerenderOf === null ? -1 : chains.findIndex((c) => c.memberIds.includes(surface.rerenderOf as string));
  if (original !== -1) {
    const c = chains[original];
    const joined: HostChain = { ...c, memberIds: [...c.memberIds, surface.id], rerenders: [...(c.rerenders ?? []), surface] };
    return chains.map((x, i) => (i === original ? joined : x));
  }
  const parent = surface.supersedes === null ? -1 : chains.findIndex((c) => c.memberIds.includes(surface.supersedes as string));
  if (parent === -1) return [...chains, { chainId: surface.id, memberIds: [surface.id], surface }];
  const updated: HostChain = { ...chains[parent], memberIds: [...chains[parent].memberIds, surface.id], surface };
  // The updated chain moves to the end: it is now the newest surface.
  return [...chains.slice(0, parent), ...chains.slice(parent + 1), updated];
}

/** The caption under a view shown as blocks because it could not be built (spec 08 S11). */
export const DEGRADED_CAPTION = "Shown as blocks because the view could not be built.";

/**
 * Whether a surface carries DEGRADED_CAPTION: its stored row or gathered data no longer
 * parses, its frame fell back, or it is a variant 2 or 3 row stored as its variant 1
 * fallback. A variant 1 fallback is that variant's own view, and a valid variant 3 row
 * shown as blocks because variant 3 is switched off is not a degradation either.
 */
export function showsDegradedCaption(surface: HostSurface): boolean {
  return surface.degraded || (surface.variant !== 1 && surface.outcome === "fallback");
}

/**
 * A surface whose frame fell back in the browser now shows its variant 1 blocks (R15:
 * the fallback is sticky) and is marked degraded, so it carries the caption. The page
 * keeps this for the rest of the session, so a later render never mounts the frame again.
 */
export function withBlocksView(chains: readonly HostChain[], surfaceId: string): HostChain[] {
  const toBlocks = (s: HostSurface): HostSurface =>
    s.id === surfaceId && s.view.kind === "sandbox" ? { ...s, view: { kind: "blocks" }, degraded: true } : s;
  return chains.map((c) => {
    const surface = toBlocks(c.surface);
    const rerenders = c.rerenders?.map(toBlocks);
    const changed = surface !== c.surface || (rerenders ?? []).some((r, i) => r !== c.rerenders?.[i]);
    return changed ? { ...c, surface, ...(rerenders ? { rerenders } : {}) } : c;
  });
}

/**
 * A sandbox surface as a one-row chain, for the gallery pages that render SandboxFrame
 * themselves (the enforcement harness, the replay page) inside a ViewFrame.
 */
export function sandboxChain(surface: SandboxSurface): HostChain {
  return {
    chainId: surface.id,
    memberIds: [surface.id],
    surface: {
      id: surface.id,
      threadId: surface.threadId,
      supersedes: null,
      rerenderOf: null,
      createdAt: "1970-01-01T00:00:00.000Z",
      variant: 3,
      view: { kind: "sandbox", document: surface.payload },
      payload: surface.fallback,
      gathered: surface.gathered,
      rows: surface.rows,
      degraded: false,
      outcome: "valid",
    },
  };
}

function toSandboxSurface(surface: HostSurface, document: SurfacePayloadV3): SandboxSurface {
  return {
    id: surface.id,
    threadId: surface.threadId,
    payload: document,
    gathered: surface.gathered,
    fallback: surface.payload,
    rows: surface.rows,
  };
}

/**
 * One surface, drawn by the renderer the server chose for its row (host.ts): BlockList
 * for blocks, TreeRenderer for a validated variant 2 tree, SandboxFrame for a variant 3
 * document that passed canMountSandbox while variant 3 is on. `surfaceKey` is the row id,
 * so a new row remounts every block. A tree that throws falls to the boundary's fixed
 * line, like a block.
 */
export function SurfaceHost({
  surface,
  onIntent,
  onPrepSettled,
  onFallback,
}: {
  surface: HostSurface;
  onIntent: (surfaceId: string, intent: ActionIntent, source: "host" | "frame") => void;
  onPrepSettled: (surfaceId: string, jobId: string) => void;
  /** A frame fell back (the server stored the failure): show this surface as blocks from now on. */
  onFallback?: (surfaceId: string) => void;
}) {
  const id = surface.id;
  const intent = useCallback((i: ActionIntent) => onIntent(id, i, "host"), [onIntent, id]);
  const settled = useCallback((jobId: string) => onPrepSettled(id, jobId), [onPrepSettled, id]);
  const fellBack = useCallback(() => onFallback?.(id), [onFallback, id]);
  const view = surface.view;
  return (
    <div className="rf-agent-surface" data-surface-id={id} data-surface-view={view.kind}>
      <SurfaceBoundary key={id}>
        {view.kind === "tree" ? (
          <TreeRenderer payload={view.tree} gathered={surface.gathered} onIntent={intent} />
        ) : view.kind === "sandbox" ? (
          <SandboxFrame
            surface={toSandboxSurface(surface, view.document)}
            onIntent={onIntent}
            onFallback={fellBack}
            onPrepSettled={settled}
          />
        ) : (
          <BlockList
            payload={surface.payload}
            gathered={surface.gathered}
            rows={surface.rows}
            surfaceKey={id}
            onIntent={intent}
            onPrepSettled={settled}
          />
        )}
      </SurfaceBoundary>
    </div>
  );
}
