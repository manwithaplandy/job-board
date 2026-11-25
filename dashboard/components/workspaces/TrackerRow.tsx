"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addNoteAction, setNextStepAction, setStageAction } from "@/app/actions/tracker";
import { Button } from "@/components/ui/Button";
import { SelectField, TextArea, TextField } from "@/components/ui/FormControls";
import { Badge } from "@/components/ui/Panel";
import { Alert } from "@/components/ui/SystemStates";
import { AgentMarker } from "@/components/workspaces/AgentMarker";
import { ageLabel } from "@/components/workspaces/ShortlistRowCard";
import { CLOSED_REASON_LABELS, STAGE_LABELS } from "@/lib/workspaces/labels";
import type { ApplicationEvent, ApplicationRow, ClosedReason, Stage } from "@/lib/workspaces/types";

const STAGE_ORDER = Object.keys(STAGE_LABELS) as Stage[];
const CLOSED_ORDER = Object.keys(CLOSED_REASON_LABELS) as ClosedReason[];

/** One line of a row's history, as plain text. */
export function historyText(event: ApplicationEvent): string {
  if (event.kind === "note") return event.note ?? "";
  const to = event.toStage ? STAGE_LABELS[event.toStage] : "an unknown stage";
  return event.fromStage ? `Moved from ${STAGE_LABELS[event.fromStage]} to ${to}` : `Moved to ${to}`;
}

/** The newest stage move, which the agent marker belongs to. */
function latestStageEvent(events: ApplicationEvent[]): ApplicationEvent | null {
  for (let i = events.length - 1; i >= 0; i -= 1) if (events[i].kind === "stage") return events[i];
  return null;
}

/**
 * One tracked application (plan Task 1.6): the posting link (from the database), its
 * documents, the stage history oldest first, and the user's controls to move it, add a
 * note or set the next step. Notes and every other text field render as plain text.
 */
export function TrackerRow({ row, actionId }: { row: ApplicationRow; actionId: number | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>(row.stage);
  const [reason, setReason] = useState<ClosedReason | "">("");
  const [note, setNote] = useState("");
  const [nextStep, setNextStep] = useState(row.nextStepOn ?? "");

  const run = (work: () => Promise<unknown>, failure: string, after?: () => void) =>
    startTransition(async () => {
      setFailed(null);
      try {
        await work();
        after?.();
        router.refresh();
      } catch {
        setFailed(failure);
      }
    });

  const slug = row.jobId.replace(/[^\w-]/g, "-");
  const titleId = `ws-app-${slug}`;
  const latest = latestStageEvent(row.events);
  const showMarker = actionId !== null && latest?.actor === "agent";
  const moveDisabled = pending || stage === row.stage || (stage === "closed" && reason === "");
  const move = () =>
    run(
      () => (stage === "closed" && reason !== "" ? setStageAction(row.jobId, stage, reason) : setStageAction(row.jobId, stage)),
      "That move could not be saved. Try again.",
    );
  const saveNote = () =>
    run(() => addNoteAction(row.jobId, note), "That note could not be saved. Try again.", () => setNote(""));
  const saveNextStep = () =>
    run(() => setNextStepAction(row.jobId, nextStep === "" ? null : nextStep), "That date could not be saved. Try again.");

  const docs = row.documents;
  return (
    <article className="rf-ws-row" aria-labelledby={titleId}>
      <div className="rf-ws-row__head">
        <div className="rf-ws-row__title">
          <a id={titleId} className="rf-secondary-link" href={row.job.url} target="_blank" rel="noopener noreferrer">
            {row.job.title}
          </a>
          <p className="rf-ws-row__meta">
            {row.job.company}
            {row.job.location ? ` · ${row.job.location}` : ""}
            {` · ${ageLabel(row.job.ageDays)}`}
            {row.nextStepOn ? ` · Next step ${row.nextStepOn}` : ""}
          </p>
        </div>
        <div className="rf-ws-row__badges">
          {row.stage === "closed" && row.closedReason && <Badge tone="neutral">{CLOSED_REASON_LABELS[row.closedReason]}</Badge>}
          {row.job.closed && <Badge tone="warning">Posting closed</Badge>}
        </div>
      </div>
      <div className="rf-ws-row__status">
        {docs.resume && <Badge tone="success">Résumé</Badge>}
        {docs.cover && <Badge tone="success">Cover letter</Badge>}
        {(docs.resume || docs.cover) && docs.outdated && <Badge tone="warning">Outdated</Badge>}
        {!docs.resume && !docs.cover && <span className="rf-ws-row__reason-text">No documents yet</span>}
        {showMarker && actionId !== null && <AgentMarker actionId={actionId} />}
      </div>
      {row.events.length > 0 && (
        <ol className="rf-ws-history" aria-label="History">
          {row.events.map((event) => (
            <li key={event.id} className="rf-ws-history__item">
              <span className="rf-ws-history__text">{historyText(event)}</span>
              <span className="rf-ws-history__meta">
                {event.actor === "agent" ? "by agent" : "by you"} · <time dateTime={event.createdAt}>{event.createdAt.slice(0, 10)}</time>
              </span>
            </li>
          ))}
        </ol>
      )}
      {failed && <Alert tone="danger">{failed}</Alert>}
      <div className="rf-ws-tracker__controls">
        <div className="rf-ws-tracker__move">
          <SelectField label="Stage" value={stage} disabled={pending} onChange={(e) => setStage(e.currentTarget.value as Stage)}>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </SelectField>
          {stage === "closed" && (
            <SelectField
              label="Why it closed"
              value={reason}
              disabled={pending}
              onChange={(e) => setReason(e.currentTarget.value as ClosedReason | "")}
            >
              <option value="">Choose a reason</option>
              {CLOSED_ORDER.map((r) => (
                <option key={r} value={r}>
                  {CLOSED_REASON_LABELS[r]}
                </option>
              ))}
            </SelectField>
          )}
          <Button variant="outline" size="sm" disabled={moveDisabled} onClick={move}>
            Move
          </Button>
        </div>
        <div className="rf-ws-tracker__note">
          <TextArea label="Add a note" rows={2} value={note} disabled={pending} onChange={(e) => setNote(e.currentTarget.value)} />
          <Button variant="outline" size="sm" disabled={pending || note.trim() === ""} onClick={saveNote}>
            Add note
          </Button>
        </div>
        <div className="rf-ws-tracker__next">
          <TextField
            label="Next step on"
            type="date"
            value={nextStep}
            disabled={pending}
            onChange={(e) => setNextStep(e.currentTarget.value)}
          />
          <Button variant="outline" size="sm" disabled={pending || nextStep === (row.nextStepOn ?? "")} onClick={saveNextStep}>
            Save date
          </Button>
        </div>
      </div>
    </article>
  );
}
