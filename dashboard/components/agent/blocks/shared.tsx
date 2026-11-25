"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Panel";
import { JobLink } from "@/components/workspaces/JobLink";
import { SkipReasonPicker } from "@/components/workspaces/SkipReasonPicker";
import { ageLabel, fitLabel } from "@/components/workspaces/ShortlistRowCard";
import { fmtPay } from "@/lib/rolefit/fit";
import type { JobFacts, ReviewFacts } from "@/lib/workspaces/types";
import { UNAVAILABLE_TEXT, type OnIntent } from "./types";

// Building blocks shared by the variant 1 blocks. Every displayed job field (title,
// company, location, age, fit, pay, posting link) is read from the turn's gathered
// data by id; agent-written text is rendered as React text nodes only.

/** An own key of a record (job ids index plain objects; never read a prototype key). */
export function own<T>(record: Record<string, T>, key: string): T | null {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : null;
}

/** The pay range from the review, or null when none was listed. */
export function payLabel(review: ReviewFacts | null): string | null {
  if (!review) return null;
  return fmtPay({ pay_min: review.payMin, pay_max: review.payMax, pay_currency: review.payCurrency, pay_period: review.payPeriod });
}

/** The fixed line for a job that was not read this turn (or is no longer reachable). */
export function Unavailable() {
  return <p className="rf-block__unavailable">{UNAVAILABLE_TEXT}</p>;
}

/** One block's frame: a labelled section with a fixed heading. */
export function BlockFrame({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section className={["rf-block", className].filter(Boolean).join(" ")} aria-labelledby={id}>
      <h3 id={id} className="rf-block__title">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A job's title (the posting link from the database), company line and badges. */
export function JobHeadline({ job, review, titleId }: { job: JobFacts; review: ReviewFacts | null; titleId?: string }) {
  const fit = fitLabel(review?.fitScore ?? null);
  const pay = payLabel(review);
  return (
    <div className="rf-block-job__head">
      <div className="rf-block-job__title">
        <JobLink id={titleId} url={job.url}>
          {job.title}
        </JobLink>
        <p className="rf-block-job__meta">
          <span>{job.company}</span>
          {job.location && <span>{job.location}</span>}
          <span>{ageLabel(job.ageDays)}</span>
          {pay && <span>{pay}</span>}
        </p>
      </div>
      <div className="rf-block-job__badges">
        {fit && <Badge tone="accent">{fit}</Badge>}
        {job.closed && <Badge tone="warning">Closed</Badge>}
      </div>
    </div>
  );
}

/**
 * Triage for one job: Shortlist, Later, Skip (with the user's reason) and, when asked
 * for, Prepare application. Each press emits one closed-enum intent.
 */
export function JobActions({ jobId, title, onIntent, prepare = false }: { jobId: string; title: string; onIntent: OnIntent; prepare?: boolean }) {
  const [picking, setPicking] = useState(false);
  if (picking) {
    return (
      <SkipReasonPicker
        onCancel={() => setPicking(false)}
        onPick={(reasonCode, reasonText) => {
          setPicking(false);
          onIntent({ name: "shortlist.set", jobId, state: "skipped", reasonCode, ...(reasonText ? { reasonText } : {}) });
        }}
      />
    );
  }
  return (
    <div className="rf-block__actions" role="group" aria-label={`Actions for ${title}`}>
      <Button variant="outline" size="sm" onClick={() => onIntent({ name: "shortlist.set", jobId, state: "shortlisted" })}>
        Shortlist
      </Button>
      <Button variant="outline" size="sm" onClick={() => onIntent({ name: "shortlist.set", jobId, state: "later" })}>
        Later
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
        Skip
      </Button>
      {prepare && (
        <Button size="sm" onClick={() => onIntent({ name: "application.prepare", jobId })}>
          Prepare application
        </Button>
      )}
    </div>
  );
}

/** Agent-written text: a plain paragraph, line breaks kept, never markup or links. */
export function AgentText({ text, className }: { text: string; className?: string }) {
  return <p className={["rf-block__agent-text", className].filter(Boolean).join(" ")}>{text}</p>;
}
