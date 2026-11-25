"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Panel";
import { useGenerationTracker } from "@/components/generation/GenerationToastProvider";
import type { GatheredData } from "@/lib/agent/gathered";
import type { V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { parseGenerationJobList, type GenerationJobKind, type GenerationJobView } from "@/lib/generationJobCodec";
import { packageFields } from "./packageFields";
import { BlockFrame, JobHeadline, Unavailable, own } from "./shared";
import type { BlockRows, OnIntent } from "./types";

type PrepChecklist = Extract<V1Block, { type: "PrepChecklist" }>;

/** The generations poll interval while this job has a pending generation (as GenerationToastProvider). */
export const PREP_POLL_MS = 4_000;

/**
 * This job's generation rows from GET /api/generations (the one fetch a block makes):
 * once on mount, when the tab becomes visible again, and every PREP_POLL_MS while any
 * row for the job is pending (here or in the global tracker). A sign-in redirect or 401
 * stops it, as in the provider.
 */
function useJobGenerations(jobId: string): GenerationJobView[] {
  const tracker = useGenerationTracker();
  const [rows, setRows] = useState<GenerationJobView[]>([]);
  const stopped = useRef(false);
  const inFlight = useRef(false);
  // Applied from the poll's response, never synchronously in an effect (as the provider).
  const apply = useCallback((body: unknown) => setRows(parseGenerationJobList(body).filter((j) => j.jobId === jobId)), [jobId]);
  const poll = useCallback(async () => {
    if (stopped.current || inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/generations", { cache: "no-store", redirect: "manual" });
      if (res.type === "opaqueredirect" || res.redirected || res.status === 401) {
        stopped.current = true;
        return;
      }
      if (!res.ok) return;
      const body: unknown = await res.json().catch(() => null);
      if (body === null) return;
      apply(body);
    } catch {
      // A network hiccup: the next tick retries.
    } finally {
      inFlight.current = false;
    }
  }, [apply]);

  // Mount: one poll. setRows runs only after the fetch resolves, never synchronously in
  // this effect; the compiler's rule cannot see past the await.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async poll, see comment above
  useEffect(() => { void poll(); }, [poll]);

  const pending =
    rows.some((j) => j.status === "pending") || (tracker?.pending.some((j) => j.jobId === jobId) ?? false);
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => void poll(), PREP_POLL_MS);
    return () => clearInterval(t);
  }, [pending, poll]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [poll]);

  return rows;
}

type ItemStatus = { label: string; tone: BadgeTone; done: boolean };

const READY: ItemStatus = { label: "Ready", tone: "success", done: true };
const GENERATING: ItemStatus = { label: "Generating", tone: "accent", done: false };
const FAILED: ItemStatus = { label: "Failed", tone: "danger", done: false };
const FINISHED: ItemStatus = { label: "Finished", tone: "success", done: true };
const NOT_STARTED: ItemStatus = { label: "Not started", tone: "neutral", done: false };

/** One item's status: the package row first, then the newest generation that builds it. */
function itemStatus(ready: boolean, kinds: GenerationJobKind[], rows: GenerationJobView[]): ItemStatus {
  if (ready) return READY;
  const mine = rows.filter((r) => kinds.includes(r.kind));
  if (mine.some((r) => r.status === "pending")) return GENERATING;
  const latest = [...mine].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!latest) return NOT_STARTED;
  return latest.status === "failed" ? FAILED : FINISHED;
}

/**
 * The application prep checklist (spec 5(c) step 2): résumé, cover letter and answers,
 * each from the job's package row the host read, updated from the generations poll
 * while a prep runs. Its controls emit application.prepare and open documents only.
 */
export function PrepChecklistBlock({ block, gathered, rows, onIntent }: { block: PrepChecklist; gathered: GatheredData; rows: BlockRows; onIntent: OnIntent }) {
  const generations = useJobGenerations(block.jobId);
  const job = own(gathered.jobs, block.jobId);
  if (!job) {
    return (
      <BlockFrame title="Application prep" className="rf-block-prep">
        <Unavailable />
      </BlockFrame>
    );
  }
  const fields = packageFields(rows.packages ? own(rows.packages, block.jobId) : null);
  const items: Array<{ label: string; status: ItemStatus; detail?: string }> = [
    { label: "Tailored résumé", status: itemStatus(fields.resume !== null, ["prepare", "resume"], generations) },
    { label: "Cover letter", status: itemStatus(fields.coverText !== null, ["prepare", "cover"], generations) },
    {
      label: "Application answers",
      status: itemStatus(fields.answers.length > 0, ["prepare"], generations),
      detail: fields.answers.length > 0 ? `${fields.answers.length} prefilled` : undefined,
    },
  ];
  const settled = [...generations].filter((g) => g.status !== "pending").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const running = items.some((i) => i.status === GENERATING);
  const anyDone = items.some((i) => i.status.done);
  return (
    <BlockFrame title="Application prep" className="rf-block-prep">
      <JobHeadline job={job} review={own(gathered.reviews, block.jobId)} />
      <ul className="rf-block-prep__list" aria-label="Prep checklist">
        {items.map((item) => (
          <li key={item.label} className="rf-block-prep__item">
            <span className="rf-block-prep__label">{item.label}</span>
            {item.detail && <span className="rf-block-prep__detail">{item.detail}</span>}
            <Badge tone={item.status.tone}>{item.status.label}</Badge>
          </li>
        ))}
      </ul>
      {settled?.error && !running && <p className="rf-block-prep__note">{settled.error}</p>}
      {(!running || anyDone) && (
        <div className="rf-block__actions">
          {!running && !anyDone && (
            <Button size="sm" onClick={() => onIntent({ name: "application.prepare", jobId: block.jobId })}>
              Prepare application
            </Button>
          )}
          {anyDone && (
            <Button variant="outline" size="sm" onClick={() => onIntent({ name: "open", target: "documents" })}>
              Open documents
            </Button>
          )}
        </div>
      )}
    </BlockFrame>
  );
}
