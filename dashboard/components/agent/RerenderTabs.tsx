"use client";

import { useState } from "react";
import type { Variant } from "@/lib/agent/config";
import type { HostChain, HostSurface } from "@/lib/agent/surfaces/host";
import { VARIANTS, VARIANT_LABELS } from "@/lib/agent/variants";
import { loadSurfaceAction } from "@/app/actions/agent";
import { SegmentedControl } from "@/components/ui/Navigation";
import { Button } from "@/components/ui/Button";

// "Re-render as" (plan Task 2.9). A surface chain shows its original and every re-render
// of it as tabs (one radiogroup), and offers a re-render in each variant. A press posts to
// /api/agent/rerender (which checks the plan, the switch, the budget and that the surface
// is the caller's), then reads the new row through loadSurfaceAction and shows it. The
// buttons describe the version shown (PR J4 review M3): a press re-renders that version, and
// the button for its own recorded variant is disabled. The new row still joins the chain's
// first original (the server sets rerender_of to the root). Variant 3 is disabled while the
// operator switch is off. Without a plan (`variant3Enabled` null) the buttons are not shown;
// earlier re-renders still are.
//
// Since PR 2 (spec 08 S8) the view frame (ViewFrame) holds these: the version tabs in its
// header, the buttons and the status line in its footer, the state in useRerender.

export const VERSIONS_LABEL = "Versions of this view";
export const RERENDER_LABEL = "Re-render as";
export const RERENDER_BUSY = "Re-rendering the view…";
export const RERENDER_ERRORS = {
  budget: "You have reached your agent spending limit for now.",
  disabled: "The agent is switched off right now.",
  plan: "Re-rendering needs a plan.",
  failed: "The view could not be re-rendered. Try again.",
  busy: "Another re-render is still running. Try again when it is done.",
} as const;

/** What a re-render request answered: the new surface id, or the error line to show. */
export type RerenderAnswer = { ok: true; surfaceId: string } | { ok: false; message: string };

/** POSTs one re-render. Never throws. */
export async function requestRerender(surfaceId: string, variant: Variant): Promise<RerenderAnswer> {
  let res: Response;
  try {
    res = await fetch("/api/agent/rerender", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ surfaceId, variant }),
    });
  } catch {
    return { ok: false, message: RERENDER_ERRORS.failed };
  }
  if (res.status === 429) return { ok: false, message: RERENDER_ERRORS.budget };
  if (res.status === 503) return { ok: false, message: RERENDER_ERRORS.disabled };
  if (res.status === 402) return { ok: false, message: RERENDER_ERRORS.plan };
  if (res.status === 409) return { ok: false, message: RERENDER_ERRORS.busy };
  if (!res.ok) return { ok: false, message: RERENDER_ERRORS.failed };
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, message: RERENDER_ERRORS.failed };
  }
  const id = body && typeof body === "object" && "surfaceId" in body ? body.surfaceId : null;
  return typeof id === "string" ? { ok: true, surfaceId: id } : { ok: false, message: RERENDER_ERRORS.failed };
}

/** Tab labels: "Original", then each re-render's variant, numbered when a variant repeats. */
export function versionLabels(versions: readonly Pick<HostSurface, "variant">[]): string[] {
  const seen = new Map<Variant, number>();
  return versions.map((v, i) => {
    if (i === 0) return "Original";
    const n = (seen.get(v.variant) ?? 0) + 1;
    seen.set(v.variant, n);
    return n === 1 ? VARIANT_LABELS[v.variant] : `${VARIANT_LABELS[v.variant]} ${n}`;
  });
}

/** What useRerender gives the view frame: the version shown and the re-render state. */
export interface Rerender {
  /** The chain's original first, then its re-renders, oldest first. */
  versions: HostSurface[];
  /** The version shown: the selected one, else the chain's surface. */
  shown: HostSurface;
  selected: string;
  select(id: string): void;
  /** The variant being re-rendered, or null when none is running. */
  busy: Variant | null;
  /** The last refusal's line, or null. */
  message: string | null;
  rerender(variant: Variant): void;
}

/**
 * The state behind a chain's version tabs and "Re-render as" buttons. A press re-renders
 * the version shown when it was pressed, reads the new row through loadSurfaceAction,
 * hands it to `onRerendered` (the page merges it into the chain) and selects it.
 * `threadId` defaults to the chain's own thread.
 */
export function useRerender(
  chain: HostChain,
  onRerendered: (surface: HostSurface) => void,
  threadId: string = chain.surface.threadId,
): Rerender {
  const versions = [chain.surface, ...(chain.rerenders ?? [])];
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<Variant | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const shown = versions.find((v) => v.id === selected) ?? chain.surface;

  const rerender = (variant: Variant) => {
    if (busy !== null) return;
    // The version the buttons describe: the one shown when the button was pressed.
    const sourceId = shown.id;
    setBusy(variant);
    setMessage(null);
    void (async () => {
      const answer = await requestRerender(sourceId, variant);
      if (!answer.ok) {
        setMessage(answer.message);
        return;
      }
      const surface = await loadSurfaceAction(threadId, answer.surfaceId).catch(() => null);
      if (!surface) {
        setMessage(RERENDER_ERRORS.failed);
        return;
      }
      onRerendered(surface);
      setSelected(surface.id);
    })().finally(() => setBusy(null));
  };

  return { versions, shown, selected: shown.id, select: setSelected, busy, message, rerender };
}

/** The chain's versions as one radiogroup; nothing when the chain has no re-renders. */
export function VersionTabs({
  versions,
  selected,
  onSelect,
}: {
  versions: readonly HostSurface[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  if (versions.length < 2) return null;
  const labels = versionLabels(versions);
  return (
    <SegmentedControl
      label={VERSIONS_LABEL}
      value={selected}
      onChange={onSelect}
      items={versions.map((v, i) => ({ label: labels[i], value: v.id }))}
    />
  );
}

/**
 * "Re-render as" one button per variant, for the version shown, and the status line. The
 * buttons are hidden without a plan (`variant3Enabled` null); the status line stays.
 */
export function RerenderControls({
  shownVariant,
  variant3Enabled,
  busy,
  message,
  onRerender,
  actionsId,
}: {
  shownVariant: Variant;
  /** The operator switch; null hides the re-render buttons (no plan). */
  variant3Enabled: boolean | null;
  busy: Variant | null;
  message: string | null;
  onRerender: (variant: Variant) => void;
  /** The buttons' group id, so a disclosure (the expanded frame below 900px) can name it. */
  actionsId?: string;
}) {
  return (
    <div className="rf-agent-versions">
      {variant3Enabled !== null && (
        <div id={actionsId} className="rf-agent-versions__actions" role="group" aria-label={RERENDER_LABEL}>
          <span className="rf-agent-versions__label">{RERENDER_LABEL}</span>
          {VARIANTS.map((v) => (
            <Button
              key={v}
              variant="ghost"
              size="sm"
              disabled={busy !== null || v === shownVariant || (v === 3 && !variant3Enabled)}
              onClick={() => onRerender(v)}
              aria-label={`${RERENDER_LABEL} ${VARIANT_LABELS[v]}`}
            >
              {VARIANT_LABELS[v]}
            </Button>
          ))}
        </div>
      )}
      <p className="rf-agent-versions__status" role="status">
        {busy !== null ? RERENDER_BUSY : (message ?? "")}
      </p>
    </div>
  );
}
