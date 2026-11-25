"use client";

import type { ReactNode } from "react";
import type { GatheredData } from "@/lib/agent/gathered";
import type { V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { ageLabel } from "@/components/workspaces/ShortlistRowCard";
import { JobLink } from "@/components/workspaces/JobLink";
import type { JobFacts, ReviewFacts } from "@/lib/workspaces/types";
import { AgentText, BlockFrame, JobActions, Unavailable, own, payLabel } from "./shared";
import type { OnIntent } from "./types";

type JobComparison = Extract<V1Block, { type: "JobComparison" }>;
export type ComparisonRow = JobComparison["rowOrder"][number];

/** The fixed row labels; the agent only chooses their order. */
export const COMPARISON_ROW_LABELS: Record<ComparisonRow, string> = {
  requirements: "Requirements",
  pay: "Pay",
  arrangement: "Work arrangement",
  red_flags: "Red flags",
  age: "Posting age",
  unknowns: "Unknowns",
};

const ARRANGEMENTS: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site", on_site: "On-site" };

function arrangement(job: JobFacts, review: ReviewFacts | null): string | null {
  const stated = review?.workArrangement ? (ARRANGEMENTS[review.workArrangement] ?? null) : null;
  if (stated) return job.location ? `${stated} · ${job.location}` : stated;
  if (job.remote) return "Remote";
  return job.location;
}

function unknowns(job: JobFacts, review: ReviewFacts | null): string[] {
  if (!review) return ["Not reviewed yet"];
  const out: string[] = [];
  if (payLabel(review) === null) out.push("Pay");
  if (arrangement(job, review) === null) out.push("Work arrangement");
  if (review.requirements.length === 0) out.push("Requirements");
  if (review.seniority === null) out.push("Seniority");
  return out;
}

/** One cell, built from the job's gathered facts and review only. */
function cell(row: ComparisonRow, job: JobFacts, review: ReviewFacts | null): ReactNode {
  switch (row) {
    case "requirements": {
      if (!review || review.requirements.length === 0) return "Not known";
      const unmet = review.requirements.filter((r) => !r.met);
      return (
        <>
          <span>{`${review.requirements.length - unmet.length} of ${review.requirements.length} met`}</span>
          {unmet.length > 0 && (
            <ul className="rf-block-compare__list" aria-label="Not met">
              {unmet.map((r, i) => (
                <li key={i}>{r.text}</li>
              ))}
            </ul>
          )}
        </>
      );
    }
    case "pay":
      return payLabel(review) ?? "Not listed";
    case "arrangement":
      return arrangement(job, review) ?? "Not stated";
    case "red_flags":
      if (!review) return "Not reviewed yet";
      return review.redFlags.length === 0 ? (
        "None noted"
      ) : (
        <ul className="rf-block-compare__list">
          {review.redFlags.map((flag, i) => (
            <li key={i}>{flag}</li>
          ))}
        </ul>
      );
    case "age":
      return job.closed ? `${ageLabel(job.ageDays)} · Closed` : ageLabel(job.ageDays);
    case "unknowns": {
      const missing = unknowns(job, review);
      return missing.length === 0 ? "Nothing major" : missing.join(", ");
    }
  }
}

/**
 * Two jobs side by side (spec 5(b), variant 1). The columns are fixed (the two jobs,
 * titled from gathered data); the agent supplies only the row order and the verdict,
 * which renders as plain text. Either job missing from gathered data shows the fixed
 * unavailable line and no buttons.
 */
export function JobComparisonBlock({ block, gathered, onIntent }: { block: JobComparison; gathered: GatheredData; onIntent: OnIntent }) {
  const jobs = block.jobIds.map((id) => own(gathered.jobs, id));
  const [a, b] = jobs;
  if (!a || !b) {
    return (
      <BlockFrame title="Comparison" className="rf-block-compare">
        <Unavailable />
      </BlockFrame>
    );
  }
  const pair = [
    { job: a, review: own(gathered.reviews, a.jobId) },
    { job: b, review: own(gathered.reviews, b.jobId) },
  ];
  return (
    <BlockFrame title="Comparison" className="rf-block-compare">
      <div className="rf-block-compare__scroll">
        <table className="rf-block-compare__table">
          <thead>
            <tr>
              <th scope="col">What matters</th>
              {pair.map(({ job }) => (
                <th key={job.jobId} scope="col">
                  <JobLink url={job.url}>{job.title}</JobLink>
                  <span className="rf-block-compare__company">{job.company}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rowOrder.map((row) => (
              <tr key={row}>
                <th scope="row">{COMPARISON_ROW_LABELS[row]}</th>
                {pair.map(({ job, review }) => (
                  <td key={job.jobId}>{cell(row, job, review)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rf-block__labelled">
        <p className="rf-block__label">Recommendation</p>
        <AgentText text={block.verdict} />
      </div>
      {pair.map(({ job }) => (
        <div key={job.jobId} className="rf-block__labelled">
          <p className="rf-block__label">{job.title}</p>
          <JobActions jobId={job.jobId} title={job.title} onIntent={onIntent} prepare />
        </div>
      ))}
    </BlockFrame>
  );
}
