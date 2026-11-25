"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Panel";
import { useGenerationTracker } from "@/components/generation/GenerationToastProvider";
import type { GatheredData } from "@/lib/agent/gathered";
import type { V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { parseGenerationJobList, type GenerationJobKind, type GenerationJobView } from "@/lib/generationJobCodec";
import { parseGreenhouseQuestionsJsonb } from "@/lib/rolefit/packageCodec";
import { prepNeeds, type PrepNeeds } from "@/lib/rolefit/prepNeeds";
import { packageFields } from "./packageFields";
import { BlockFrame, JobHeadline, Unavailable, own } from "./shared";
import type { BlockRows, OnIntent } from "./types";

type PrepChecklist = Extract<V1Block, { type: "PrepChecklist" }>;

/** The fixed line when this block cannot read generation status itself (no tracker, and its one fetch failed). */
export const PREP_STATUS_UNAVAILABLE_TEXT = "Prep status can't be checked right now.";

/** What the block knows about this job's generations. */
interface JobGenerations {
  pending: GenerationJobView[];
  settled: GenerationJobView[];
  /**
   * Whether the package rows were reloaded since the newest settle, so a document still
   * missing from them was not produced (rather than not loaded yet).
   */
  reloaded: boolean;
  unavailable: boolean;
}

/** Newest first; one entry per generation id (a later report of the same id wins). */
function mergeSettled(prev: GenerationJobView[], next: GenerationJobView[]): GenerationJobView[] {
  const byId = new Map(prev.map((g) => [g.id, g]));
  for (const g of next) byId.set(g.id, g);
  return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * With the GenerationToastProvider mounted (the app), the provider is the only poller:
 * pending comes from tracker.pending, and each settle of this job in tracker.settledFeed
 * is applied once (by feed seq) and reported through onSettled so the host reloads the
 * package rows. Settles from before this block mounted are already in those rows.
 */
function useTrackedGenerations(jobId: string, packages: BlockRows["packages"], onSettled?: (jobId: string) => void): JobGenerations | null {
  const tracker = useGenerationTracker();
  const feed = tracker?.settledFeed ?? null;
  const [seen, setSeen] = useState<{ jobId: string; seq: number; settled: GenerationJobView[]; settleSeq: number; packagesAtSettle: unknown }>(
    () => ({ jobId, seq: feed?.seq ?? 0, settled: [], settleSeq: 0, packagesAtSettle: null }),
  );
  // A new feed batch is folded in while rendering (React's "adjust state on a prop
  // change"), so the items never show a stale status for a frame.
  if (feed && feed.seq !== seen.seq) {
    const mine = feed.jobs.filter((j) => j.jobId === jobId);
    setSeen({
      jobId,
      seq: feed.seq,
      settled: mine.length > 0 ? mergeSettled(seen.jobId === jobId ? seen.settled : [], mine) : seen.settled,
      settleSeq: mine.length > 0 ? feed.seq : seen.settleSeq,
      packagesAtSettle: mine.length > 0 ? packages : seen.packagesAtSettle,
    });
  }
  const notified = useRef(seen.settleSeq);
  useEffect(() => {
    if (seen.settleSeq > notified.current) {
      notified.current = seen.settleSeq;
      onSettled?.(jobId);
    }
  }, [seen.settleSeq, jobId, onSettled]);

  if (!tracker) return null;
  const settled = seen.jobId === jobId ? seen.settled : [];
  return {
    pending: tracker.pending.filter((j) => j.jobId === jobId),
    settled,
    reloaded: !onSettled || packages !== seen.packagesAtSettle,
    unavailable: false,
  };
}

/**
 * Without the provider (the gallery, isolated tests): one GET /api/generations on mount,
 * aborted on unmount, with no re-polling. A sign-in redirect, a 401 or any other failure
 * shows the fixed unavailable line; nothing retries.
 */
function useOwnGenerations(jobId: string, enabled: boolean): JobGenerations | null {
  const [loaded, setLoaded] = useState<{ jobId: string; rows: GenerationJobView[]; unavailable: boolean } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    const load = async () => {
      try {
        const res = await fetch("/api/generations", { cache: "no-store", redirect: "manual", signal: ac.signal });
        if (res.type === "opaqueredirect" || res.redirected || !res.ok) {
          if (!ac.signal.aborted) setLoaded({ jobId, rows: [], unavailable: true });
          return;
        }
        const body: unknown = await res.json().catch(() => null);
        if (ac.signal.aborted) return;
        setLoaded({ jobId, rows: parseGenerationJobList(body).filter((j) => j.jobId === jobId), unavailable: body === null });
      } catch {
        if (!ac.signal.aborted) setLoaded({ jobId, rows: [], unavailable: true });
      }
    };
    void load();
    return () => ac.abort();
  }, [enabled, jobId]);
  if (!enabled) return null;
  const current = loaded?.jobId === jobId ? loaded : null;
  const rows = current?.rows ?? [];
  return {
    pending: rows.filter((r) => r.status === "pending"),
    settled: rows.filter((r) => r.status !== "pending").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    reloaded: true,
    unavailable: current?.unavailable ?? false,
  };
}

type ItemStatus = { label: string; tone: BadgeTone; done: boolean };

const READY: ItemStatus = { label: "Ready", tone: "success", done: true };
const GENERATING: ItemStatus = { label: "Generating", tone: "accent", done: false };
const FAILED: ItemStatus = { label: "Failed", tone: "danger", done: false };
const NOT_NEEDED: ItemStatus = { label: "Not needed", tone: "neutral", done: false };
const NOT_PRODUCED: ItemStatus = { label: "Not produced", tone: "neutral", done: false };
const UPDATING: ItemStatus = { label: "Updating", tone: "neutral", done: false };
const NOT_STARTED: ItemStatus = { label: "Not started", tone: "neutral", done: false };

/**
 * One item's status. The package row is the truth for what exists: Ready only when the
 * document is in it. "Not needed" when the posting does not ask for it (prepNeeds, the
 * rule a prep charges by). Otherwise from the newest generation that builds it: pending
 * is Generating; failed is Failed; a finished one whose document is still missing is
 * Failed once the rows were reloaded after it (Updating until then), or "Not produced"
 * when a full prep may simply not have been asked for it (needs unknown).
 */
function itemStatus(
  present: boolean,
  needed: boolean | null,
  kinds: GenerationJobKind[],
  gens: JobGenerations,
): ItemStatus {
  if (present) return READY;
  if (needed === false) return NOT_NEEDED;
  if (gens.pending.some((g) => kinds.includes(g.kind))) return GENERATING;
  const latest = gens.settled.find((g) => kinds.includes(g.kind));
  if (!latest) return NOT_STARTED;
  if (latest.status === "failed") return FAILED;
  if (!gens.reloaded) return UPDATING;
  return needed === null && latest.kind === "prepare" ? NOT_PRODUCED : FAILED;
}

const NO_GENERATIONS: JobGenerations = { pending: [], settled: [], reloaded: true, unavailable: false };

/**
 * The application prep checklist (spec 5(c) step 2): résumé, cover letter and answers,
 * each from the job's package row the host read, with live status from the generation
 * tracker. Its controls emit application.prepare and open documents only.
 *
 * Host contract (Task 1.20): pass `onSettled`, and reload `rows.packages` for that job
 * when it fires (keep the `rows.packages` object the same between reloads: a new object
 * is how the block knows the rows were reloaded); pass `rows.questions`; after confirmIntentAction returns done for application.prepare, call
 * tracker.notifyStarted(...) with the started generation, or tracker.refresh() when the
 * outcome carries none, so the block shows Generating at once.
 */
export function PrepChecklistBlock({
  block,
  gathered,
  rows,
  onIntent,
  onSettled,
}: {
  block: PrepChecklist;
  gathered: GatheredData;
  rows: BlockRows;
  onIntent: OnIntent;
  onSettled?: (jobId: string) => void;
}) {
  const tracked = useTrackedGenerations(block.jobId, rows.packages, onSettled);
  const fetched = useOwnGenerations(block.jobId, tracked === null);
  const gens = tracked ?? fetched ?? NO_GENERATIONS;
  const job = own(gathered.jobs, block.jobId);
  if (!job) {
    return (
      <BlockFrame title="Application prep" className="rf-block-prep">
        <Unavailable />
      </BlockFrame>
    );
  }
  const fields = packageFields(rows.packages ? own(rows.packages, block.jobId) : null);
  const storedQuestions = rows.questions ? own(rows.questions, block.jobId) : null;
  const questions = storedQuestions === null ? null : parseGreenhouseQuestionsJsonb(storedQuestions);
  const needs: PrepNeeds | null = questions === null ? null : prepNeeds(questions);
  const items: Array<{ label: string; status: ItemStatus; detail?: string }> = [
    { label: "Tailored résumé", status: itemStatus(fields.resume !== null, true, ["prepare", "resume"], gens) },
    { label: "Cover letter", status: itemStatus(fields.coverText !== null, needs?.cover ?? null, ["prepare", "cover"], gens) },
    {
      label: "Application answers",
      status: itemStatus(fields.answers.length > 0, needs?.answers ?? null, ["prepare"], gens),
      detail: fields.answers.length > 0 ? `${fields.answers.length} prefilled` : undefined,
    },
  ];
  const settled = gens.settled[0];
  const running = items.some((i) => i.status === GENERATING);
  const anyDone = items.some((i) => i.status.done);
  return (
    <BlockFrame title="Application prep" className="rf-block-prep">
      <JobHeadline job={job} review={own(gathered.reviews, block.jobId)} />
      <ul className="rf-block-prep__list" aria-label="Prep checklist" aria-live="polite">
        {items.map((item) => (
          <li key={item.label} className="rf-block-prep__item">
            <span className="rf-block-prep__label">{item.label}</span>
            {item.detail && <span className="rf-block-prep__detail">{item.detail}</span>}
            <Badge tone={item.status.tone}>{item.status.label}</Badge>
          </li>
        ))}
      </ul>
      {gens.unavailable && <p className="rf-block-prep__note">{PREP_STATUS_UNAVAILABLE_TEXT}</p>}
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
