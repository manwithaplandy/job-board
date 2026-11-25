"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshSuggestedAction, setShortlistStateAction } from "@/app/actions/shortlist";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert, EmptyState } from "@/components/ui/SystemStates";
import { BrowseAll, type BrowseFilters, type BrowseRow } from "@/components/workspaces/BrowseAll";
import { ShortlistRowCard } from "@/components/workspaces/ShortlistRowCard";
import type { ShortlistRow, ShortlistState } from "@/lib/workspaces/types";

export type { BrowseFilters, BrowseRow };

const SECTIONS: Array<{ state: ShortlistState; title: string; empty: string }> = [
  { state: "suggested", title: "Suggested", empty: "No suggestions right now." },
  { state: "shortlisted", title: "Shortlisted", empty: "Nothing shortlisted yet." },
  { state: "later", title: "Later", empty: "Nothing saved for later." },
  { state: "skipped", title: "Skipped", empty: "Nothing skipped." },
];

/**
 * The shortlist workspace (plan Task 1.5): Suggested, Shortlisted, Later, Skipped
 * (collapsed) and Browse all. Triage is one tap and needs no chat. Two checked rows
 * enable Compare, which hands the pair to the agent page.
 */
export function ShortlistBoard({
  rows,
  markers,
  browse,
  filters,
  browseError,
  skippedOpen = false,
}: {
  rows: ShortlistRow[];
  /** Job id to the id of the agent write that set the row, for its Undo. */
  markers: Record<string, number>;
  browse: BrowseRow[];
  filters: BrowseFilters;
  browseError: boolean;
  /** Opens the Skipped section, which starts collapsed (the gallery fixture shows it open). */
  skippedOpen?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useState<string[]>([]);
  const [failed, setFailed] = useState<string | null>(null);

  const run = (work: () => Promise<unknown>, failure: string) =>
    startTransition(async () => {
      setFailed(null);
      try {
        await work();
        router.refresh();
      } catch {
        setFailed(failure);
      }
    });
  const setState = (jobId: string, state: ShortlistState, reasonCode?: string, reasonText?: string) =>
    run(
      () =>
        reasonCode === undefined
          ? setShortlistStateAction(jobId, state)
          : setShortlistStateAction(jobId, state, reasonCode, reasonText),
      "That change could not be saved. Try again.",
    );
  const refresh = () => run(() => refreshSuggestedAction(), "Suggestions could not be refreshed. Try again.");
  const toggle = (jobId: string, on: boolean) =>
    setChecked((current) => (on ? [...current.filter((id) => id !== jobId), jobId] : current.filter((id) => id !== jobId)));

  const byState = (state: ShortlistState) => rows.filter((r) => r.state === state);
  const compareHref =
    checked.length === 2 ? `/agent?compare=${checked.map((id) => encodeURIComponent(id)).join(",")}` : null;

  const renderRows = (list: ShortlistRow[]) => (
    <div className="rf-ws-list">
      {list.map((row) => (
        <ShortlistRowCard
          key={row.jobId}
          row={row}
          actionId={markers[row.jobId] ?? null}
          checked={checked.includes(row.jobId)}
          onCheck={(on) => toggle(row.jobId, on)}
          onSet={(state, code, text) => setState(row.jobId, state, code, text)}
          pending={pending}
        />
      ))}
    </div>
  );

  return (
    <div className="rf-ws-board">
      <div className="rf-ws-toolbar">
        {compareHref ? (
          <ButtonLink href={compareHref} variant="primary">
            Compare
          </ButtonLink>
        ) : (
          <Button disabled>Compare</Button>
        )}
        <span className="rf-ws-toolbar__hint">Check two rows to compare them with the agent.</span>
      </div>
      {failed && <Alert tone="danger">{failed}</Alert>}
      {rows.length === 0 && (
        <EmptyState
          title="Nothing on your shortlist yet"
          description="Ask the agent to find roles that fit, or refresh suggestions from your finished reviews."
          action={<ButtonLink href="/agent">Ask the agent</ButtonLink>}
        />
      )}
      {SECTIONS.map((section) => {
        const list = byState(section.state);
        const heading = (
          <h2 className="rf-ws-section__title">
            {section.title} <span className="rf-ws-section__count">{list.length}</span>
          </h2>
        );
        if (section.state === "skipped") {
          return (
            <section key={section.state} className="rf-ws-section">
              <details className="rf-ws-disclosure" open={skippedOpen || undefined}>
                <summary className="rf-ws-disclosure__summary">{heading}</summary>
                {list.length === 0 ? <p className="rf-ws-section__empty">{section.empty}</p> : renderRows(list)}
              </details>
            </section>
          );
        }
        return (
          <section key={section.state} className="rf-ws-section">
            {heading}
            {section.state === "suggested" && list.length === 0 && (
              <div className="rf-ws-section__refresh">
                <Button variant="outline" onClick={refresh} disabled={pending}>
                  Refresh suggestions
                </Button>
              </div>
            )}
            {list.length === 0 ? <p className="rf-ws-section__empty">{section.empty}</p> : renderRows(list)}
          </section>
        );
      })}
      <section className="rf-ws-section">
        <h2 className="rf-ws-section__title">Browse all</h2>
        <BrowseAll
          rows={browse}
          filters={filters}
          error={browseError}
          pending={pending}
          onShortlist={(jobId) => setState(jobId, "shortlisted")}
        />
      </section>
    </div>
  );
}
