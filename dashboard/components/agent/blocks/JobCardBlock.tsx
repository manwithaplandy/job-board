"use client";

import { useId } from "react";
import type { GatheredData } from "@/lib/agent/gathered";
import type { V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { AgentText, JobActions, JobHeadline, Unavailable, own } from "./shared";
import type { OnIntent } from "./types";

type JobCard = Extract<V1Block, { type: "JobCard" }>;

/**
 * One job (spec 7.1 JobCard). Title, company, fit, pay and the posting link come from
 * gathered data by id; the agent's note is plain text. A job missing from gathered
 * data renders the fixed unavailable line and no buttons.
 */
export function JobCardBlock({ block, gathered, onIntent }: { block: JobCard; gathered: GatheredData; onIntent: OnIntent }) {
  const titleId = useId();
  const job = own(gathered.jobs, block.jobId);
  if (!job) {
    return (
      <article className="rf-block rf-block-job">
        <Unavailable />
      </article>
    );
  }
  const review = own(gathered.reviews, block.jobId);
  return (
    <article className="rf-block rf-block-job" aria-labelledby={titleId}>
      <JobHeadline job={job} review={review} titleId={titleId} />
      {block.note && <AgentText text={block.note} />}
      <JobActions jobId={block.jobId} title={job.title} onIntent={onIntent} prepare />
    </article>
  );
}
