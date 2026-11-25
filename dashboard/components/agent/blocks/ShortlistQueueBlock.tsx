"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { GatheredData } from "@/lib/agent/gathered";
import type { V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { BlockFrame, JobActions, JobHeadline, Unavailable, own } from "./shared";
import type { OnIntent } from "./types";

type ShortlistQueue = Extract<V1Block, { type: "ShortlistQueue" }>;

/**
 * A short queue of jobs to triage (spec 7.1 ShortlistQueue): each row with one-tap
 * Shortlist, Later and Skip, and a Compare that is enabled once exactly two rows are
 * selected. A row whose job is missing from gathered data shows the unavailable line.
 */
export function ShortlistQueueBlock({ block, gathered, onIntent }: { block: ShortlistQueue; gathered: GatheredData; onIntent: OnIntent }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (jobId: string) =>
    setSelected((s) => (s.includes(jobId) ? s.filter((id) => id !== jobId) : [...s, jobId].slice(-2)));
  const pair = selected.length === 2 ? ([selected[0], selected[1]] as [string, string]) : null;
  return (
    <BlockFrame title="Jobs to triage" className="rf-block-queue">
      <ol className="rf-block-queue__list">
        {block.jobIds.map((jobId) => {
          const job = own(gathered.jobs, jobId);
          if (!job) {
            return (
              <li key={jobId} className="rf-block-queue__item">
                <Unavailable />
              </li>
            );
          }
          const on = selected.includes(jobId);
          return (
            <li key={jobId} className="rf-block-queue__item">
              <JobHeadline job={job} review={own(gathered.reviews, jobId)} />
              <div className="rf-block__actions">
                <Button variant="ghost" size="sm" aria-pressed={on} onClick={() => toggle(jobId)}>
                  {on ? "Selected to compare" : "Select to compare"}
                </Button>
              </div>
              <JobActions jobId={jobId} title={job.title} onIntent={onIntent} />
            </li>
          );
        })}
      </ol>
      <div className="rf-block__actions">
        <Button variant="outline" size="sm" disabled={pair === null} onClick={() => pair && onIntent({ name: "compare", jobIds: pair })}>
          Compare selected
        </Button>
      </div>
    </BlockFrame>
  );
}
