"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Panel";
import { AgentMarker } from "@/components/workspaces/AgentMarker";
import { SkipReasonPicker } from "@/components/workspaces/SkipReasonPicker";
import { skipReasonLabel } from "@/lib/workspaces/labels";
import type { ShortlistRow, ShortlistState } from "@/lib/workspaces/types";

const TRIAGE: Array<{ state: Exclude<ShortlistState, "suggested" | "skipped">; label: string }> = [
  { state: "shortlisted", label: "Shortlist" },
  { state: "later", label: "Later" },
];

export function fitLabel(fit: number | null): string | null {
  return fit === null || !Number.isFinite(fit) ? null : `${Math.round(fit)} fit`;
}

export function ageLabel(days: number): string {
  if (days <= 0) return "New today";
  return days === 1 ? "1 day old" : `${days} days old`;
}

/**
 * One shortlist row: the posting link (from the database, never model text), the brief
 * why and risk, the skip reason, the agent marker, a compare checkbox, and one-tap
 * triage. Every text field renders as plain text.
 */
export function ShortlistRowCard({
  row,
  actionId,
  checked,
  onCheck,
  onSet,
  pending,
}: {
  row: ShortlistRow;
  actionId: number | null;
  checked: boolean;
  onCheck: (checked: boolean) => void;
  onSet: (state: ShortlistState, reasonCode?: string, reasonText?: string) => void;
  pending: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const titleId = `ws-row-${row.jobId.replace(/[^\w-]/g, "-")}`;
  const fit = fitLabel(row.fitScore);
  const reason = row.state === "skipped" ? skipReasonLabel(row.reasonCode) : null;
  return (
    <article className="rf-ws-row" aria-labelledby={titleId}>
      <div className="rf-ws-row__head">
        <label
          className="rf-ws-check"
          data-ui-contract-composite="native checkbox keeps keyboard/AT support; layout lives in shared CSS"
        >
          <input type="checkbox" checked={checked} onChange={(event) => onCheck(event.currentTarget.checked)} />
          <span className="sr-only">Compare {row.job.title}</span>
        </label>
        <div className="rf-ws-row__title">
          <a id={titleId} className="rf-secondary-link" href={row.job.url} target="_blank" rel="noopener noreferrer">
            {row.job.title}
          </a>
          <p className="rf-ws-row__meta">
            {row.job.company}
            {row.job.location ? ` · ${row.job.location}` : ""}
            {` · ${ageLabel(row.job.ageDays)}`}
          </p>
        </div>
        <div className="rf-ws-row__badges">
          {fit && <Badge tone="accent">{fit}</Badge>}
          {row.job.closed && <Badge tone="warning">Closed</Badge>}
        </div>
      </div>
      {(row.briefWhy || row.briefRisk) && (
        <dl className="rf-ws-row__brief">
          {row.briefWhy && (
            <div>
              <dt>Why</dt>
              <dd>{row.briefWhy}</dd>
            </div>
          )}
          {row.briefRisk && (
            <div>
              <dt>Risk</dt>
              <dd>{row.briefRisk}</dd>
            </div>
          )}
        </dl>
      )}
      {(reason || (row.setBy === "agent" && actionId !== null)) && (
        <div className="rf-ws-row__status">
          {reason && <Badge tone="neutral">{reason}</Badge>}
          {reason && row.reasonText && <span className="rf-ws-row__reason-text">{row.reasonText}</span>}
          {row.setBy === "agent" && actionId !== null && <AgentMarker actionId={actionId} />}
        </div>
      )}
      {picking ? (
        <SkipReasonPicker
          disabled={pending}
          onCancel={() => setPicking(false)}
          onPick={(code, text) => {
            setPicking(false);
            onSet("skipped", code, text);
          }}
        />
      ) : (
        <div className="rf-ws-row__actions">
          {TRIAGE.filter((t) => t.state !== row.state).map((t) => (
            <Button key={t.state} variant="outline" size="sm" disabled={pending} onClick={() => onSet(t.state)}>
              {t.label}
            </Button>
          ))}
          {row.state !== "skipped" && (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setPicking(true)}>
              Skip
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
