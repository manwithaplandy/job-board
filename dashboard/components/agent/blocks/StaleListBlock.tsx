"use client";

import { Button } from "@/components/ui/Button";
import { JobLink } from "@/components/workspaces/JobLink";
import type { GatheredData } from "@/lib/agent/gathered";
import type { V1Block } from "@/lib/agent/surfaces/v1/blocks";
import { STALE_AFTER_DAYS } from "@/lib/workspaces/metrics/catalog";
import type { ApplicationRow } from "@/lib/workspaces/types";
import { BlockFrame } from "./shared";
import type { BlockRows, OnIntent } from "./types";

type StaleList = Extract<V1Block, { type: "StaleList" }>;

const DAY_MS = 86_400_000;
export const NO_APPLICATIONS_TEXT = "No applications were read in this conversation.";
export const NOTHING_STALE_TEXT = "Nothing is waiting on a reply for long.";

/** The newest moment anything happened to an application: its last event or update. */
function lastActivity(app: ApplicationRow): number {
  const times = [app.updatedAt, ...app.events.map((e) => e.createdAt)].map((t) => Date.parse(t)).filter(Number.isFinite);
  return times.length === 0 ? Number.NaN : Math.max(...times);
}

/**
 * Applications still at Applied with no news (spec 5(d)), from the applications the
 * turn read. With the catalog clock's now (rows.now) it lists those quiet for at least
 * STALE_AFTER_DAYS, longest first, with their age; without it, it never claims an age
 * and lists the quietest by date. Each row's one control closes it as no response.
 */
export function StaleListBlock({ block, gathered, rows, onIntent }: { block: StaleList; gathered: GatheredData; rows: BlockRows; onIntent: OnIntent }) {
  const now = rows.now ? Date.parse(rows.now) : Number.NaN;
  const applied = gathered.applications
    .filter((a) => a.stage === "applied")
    .map((a) => ({ app: a, last: lastActivity(a) }))
    .filter((a) => Number.isFinite(a.last));
  const listed = (Number.isFinite(now)
    ? applied.map((a) => ({ ...a, days: Math.floor((now - a.last) / DAY_MS) })).filter((a) => a.days >= STALE_AFTER_DAYS)
    : applied.map((a) => ({ ...a, days: null as number | null }))
  )
    .sort((x, y) => x.last - y.last)
    .slice(0, block.limit);
  return (
    <BlockFrame title="Waiting on a reply" className="rf-block-stale">
      {gathered.applications.length === 0 ? (
        <p className="rf-block__unavailable">{NO_APPLICATIONS_TEXT}</p>
      ) : listed.length === 0 ? (
        <p className="rf-block__unavailable">{NOTHING_STALE_TEXT}</p>
      ) : (
        <ul className="rf-block-stale__list">
          {listed.map(({ app, last, days }) => (
            <li key={app.id} className="rf-block-stale__item">
              <div className="rf-block-job__title">
                <JobLink url={app.job.url}>{app.job.title}</JobLink>
                <p className="rf-block-job__meta">
                  <span>{app.job.company}</span>
                  <span>{days === null ? `Last activity ${new Date(last).toISOString().slice(0, 10)}` : days === 1 ? "1 day with no news" : `${days} days with no news`}</span>
                </p>
              </div>
              <div className="rf-block__actions">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onIntent({ name: "application.set_stage", jobId: app.jobId, stage: "closed", closedReason: "no_response" })}
                >
                  Close as no response
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="rf-block__actions">
        <Button variant="outline" size="sm" onClick={() => onIntent({ name: "open", target: "applications" })}>
          Open the tracker
        </Button>
      </div>
    </BlockFrame>
  );
}
