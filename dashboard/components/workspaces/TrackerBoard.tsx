"use client";

import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/SystemStates";
import { TrackerRow } from "@/components/workspaces/TrackerRow";
import { STAGE_LABELS } from "@/lib/workspaces/labels";
import type { ApplicationRow, Stage } from "@/lib/workspaces/types";

const STAGE_ORDER = Object.keys(STAGE_LABELS) as Stage[];

/**
 * The application tracker (plan Task 1.6): one section per stage, preparing to closed,
 * each row with its history, documents and controls. Moving, noting and dating need no
 * chat.
 */
export function TrackerBoard({
  rows,
  markers,
}: {
  rows: ApplicationRow[];
  /** Job id to the id of the agent's latest stage write, for its Undo. */
  markers: Record<string, number>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rf-ws-board">
        <EmptyState
          title="No applications tracked yet"
          description="Choose Start preparing on a shortlisted job, mark a job applied on your board, or ask the agent to track one."
          action={<ButtonLink href="/shortlist">Open your shortlist</ButtonLink>}
        />
      </div>
    );
  }
  return (
    <div className="rf-ws-board">
      {STAGE_ORDER.map((stage) => {
        const list = rows.filter((r) => r.stage === stage);
        return (
          <section key={stage} className="rf-ws-section">
            <h2 className="rf-ws-section__title">
              {STAGE_LABELS[stage]} <span className="rf-ws-section__count">{list.length}</span>
            </h2>
            {list.length === 0 ? (
              <p className="rf-ws-section__empty">Nothing here.</p>
            ) : (
              <div className="rf-ws-list">
                {list.map((row) => (
                  <TrackerRow key={row.jobId} row={row} actionId={markers[row.jobId] ?? null} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
