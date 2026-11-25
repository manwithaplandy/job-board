"use client";

import { useState } from "react";
import type { ActionIntent } from "@/lib/agent/actions/intents";
import type { Variant } from "@/lib/agent/config";
import type { HostChain, HostSurface } from "@/lib/agent/surfaces/host";
import { VARIANTS, VARIANT_LABELS } from "@/lib/agent/variants";
import { loadSurfaceAction } from "@/app/actions/agent";
import { SegmentedControl } from "@/components/ui/Navigation";
import { Button } from "@/components/ui/Button";
import { SurfaceHost } from "./SurfaceHost";

// "Re-render as" (plan Task 2.9). A surface chain shows its original and every re-render
// of it as tabs (one radiogroup), and offers a re-render in each variant. A press posts to
// /api/agent/rerender (which checks the plan, the switch, the budget and that the surface
// is the caller's), then reads the new row through loadSurfaceAction and shows it. Variant 3
// is disabled while the operator switch is off. Without a plan (`variant3Enabled` null) the
// buttons are not shown; earlier re-renders still are.

export const VERSIONS_LABEL = "Versions of this view";
export const RERENDER_LABEL = "Re-render as";
export const RERENDER_BUSY = "Re-rendering the view…";
export const RERENDER_ERRORS = {
  budget: "You have reached your agent spending limit for now.",
  disabled: "The agent is switched off right now.",
  plan: "Re-rendering needs a plan.",
  failed: "The view could not be re-rendered. Try again.",
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
function versionLabels(versions: readonly HostSurface[]): string[] {
  const seen = new Map<Variant, number>();
  return versions.map((v, i) => {
    if (i === 0) return "Original";
    const n = (seen.get(v.variant) ?? 0) + 1;
    seen.set(v.variant, n);
    return n === 1 ? VARIANT_LABELS[v.variant] : `${VARIANT_LABELS[v.variant]} ${n}`;
  });
}

export function RerenderTabs({
  chain,
  threadId,
  variant3Enabled,
  onIntent,
  onPrepSettled,
  onFallback,
  onRerendered,
}: {
  chain: HostChain;
  threadId: string;
  /** The operator switch; null hides the re-render buttons (no plan). */
  variant3Enabled: boolean | null;
  onIntent: (surfaceId: string, intent: ActionIntent, source: "host" | "frame") => void;
  onPrepSettled: (surfaceId: string, jobId: string) => void;
  onFallback?: (surfaceId: string) => void;
  onRerendered: (surface: HostSurface) => void;
}) {
  const versions = [chain.surface, ...(chain.rerenders ?? [])];
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const shown = versions.find((v) => v.id === selected) ?? chain.surface;
  const labels = versionLabels(versions);

  const rerender = (variant: Variant) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    void (async () => {
      const answer = await requestRerender(chain.surface.id, variant);
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
    })().finally(() => setBusy(false));
  };

  return (
    <div className="rf-agent-versions">
      {versions.length > 1 && (
        <SegmentedControl
          label={VERSIONS_LABEL}
          value={shown.id}
          onChange={setSelected}
          items={versions.map((v, i) => ({ label: labels[i], value: v.id }))}
        />
      )}
      <SurfaceHost key={shown.id} surface={shown} onIntent={onIntent} onPrepSettled={onPrepSettled} onFallback={onFallback} />
      {variant3Enabled !== null && (
        <div className="rf-agent-versions__actions" role="group" aria-label={RERENDER_LABEL}>
          <span className="rf-agent-versions__label">{RERENDER_LABEL}</span>
          {VARIANTS.map((v) => (
            <Button
              key={v}
              variant="ghost"
              size="sm"
              disabled={busy || v === shown.variant || (v === 3 && !variant3Enabled)}
              onClick={() => rerender(v)}
              aria-label={`${RERENDER_LABEL} ${VARIANT_LABELS[v]}`}
            >
              {VARIANT_LABELS[v]}
            </Button>
          ))}
        </div>
      )}
      <p className="rf-agent-versions__status" role="status">
        {busy ? RERENDER_BUSY : (message ?? "")}
      </p>
    </div>
  );
}
