// JobFacts for workspace rows (shortlist, tracker): the job columns every workspace
// query selects, their total parser, and the mapping to the shared JobFacts shape. Ages
// come from the catalog clock (catalogNow), never the wall clock. Posting-derived text
// is capped at the same lengths as the agent's read tools (lib/agent/tools/read.ts
// TEXT_CAPS), since these rows also reach the agent's context.
import { z } from "zod";
import { ageDays } from "@/lib/catalogClock";
import type { JobFacts } from "@/lib/workspaces/types";

export const JOB_TEXT_CAPS = { title: 200, company: 120, location: 120 } as const;

/**
 * The board's closed test (boardClosedPredicateSql in lib/jobsQuery.ts), which the
 * workspace queries write out literally so they stay tagged templates. A test pins the
 * two equal.
 */
export const JOB_CLOSED_PREDICATE = "public.lifecycle_source_closed(j.id, j.closed_at)";

/**
 * The job columns as a workspace query selects them (joining `jobs j` and
 * `companies c`): j_id, j_title, j_company, j_location, j_remote, j_url,
 * j_first_seen_at and j_closed.
 */
export const jobFactsRowSchema = z.object({
  j_id: z.string(),
  j_title: z.string(),
  j_company: z.string(),
  j_location: z.string().nullable(),
  j_remote: z.boolean().nullable(),
  j_url: z.string(),
  j_first_seen_at: z.coerce.date(),
  j_closed: z.boolean(),
});
export type JobFactsRow = z.infer<typeof jobFactsRowSchema>;

/** The first `max` code points of `text`, so a surrogate pair is never split. */
export function capText(text: string, max: number): string {
  if (text.length <= max) return text;
  return Array.from(text).slice(0, max).join("");
}

export function toJobFacts(row: JobFactsRow, now: Date): JobFacts | null {
  if (Number.isNaN(row.j_first_seen_at.getTime())) return null;
  const firstSeenAt = row.j_first_seen_at.toISOString();
  return {
    jobId: row.j_id,
    title: capText(row.j_title, JOB_TEXT_CAPS.title),
    company: capText(row.j_company, JOB_TEXT_CAPS.company),
    location: row.j_location === null ? null : capText(row.j_location, JOB_TEXT_CAPS.location),
    remote: row.j_remote === true,
    url: row.j_url,
    firstSeenAt,
    ageDays: ageDays(firstSeenAt, { now }),
    closed: row.j_closed,
  };
}
