// The generated résumés and cover letters, one row per job with a prepared package
// (plan Task 1.11's third documents section). Read-only, under RLS. Outdated is the
// board's own test (isResumeStale): the package was generated from an older profile.
import { z } from "zod";
import { withUserSql } from "@/lib/db";
import { catalogNow } from "@/lib/catalogClock";
import { isResumeStale } from "@/lib/resumeStale";
import { parseOrNull } from "@/lib/zodParse";
import { jobFactsRowSchema, toJobFacts } from "@/lib/workspaces/jobFacts";
import type { JobFacts } from "@/lib/workspaces/types";

export interface GeneratedDocuments {
  job: JobFacts;
  status: "prepared" | "applied";
  resume: boolean;
  cover: boolean;
  outdated: boolean;
  preparedAt: string;
}

const rowSchema = jobFactsRowSchema.extend({
  status: z.enum(["prepared", "applied"]),
  has_resume: z.boolean(),
  has_cover: z.boolean(),
  package_profile_version: z.string().nullable(),
  current_profile_version: z.string().nullable(),
  prepared_at: z.coerce.date(),
});

/** The caller's packages that hold a résumé or a cover letter, most recently prepared first. */
export async function listGeneratedDocuments(userId: string): Promise<GeneratedDocuments[]> {
  const rows = await withUserSql(userId, (tx) => tx`
    SELECT p.status, p.prepared_at,
           COALESCE(jsonb_typeof(p.resume_json) = 'object', false) AS has_resume,
           (COALESCE(jsonb_typeof(p.cover_letter_json) = 'object', false) OR e.edited_text IS NOT NULL) AS has_cover,
           p.profile_version AS package_profile_version, pr.profile_version AS current_profile_version,
           j.id AS j_id, j.title AS j_title, COALESCE(c.display_name, c.name) AS j_company,
           j.location AS j_location, j.remote AS j_remote, j.url AS j_url, j.first_seen_at AS j_first_seen_at,
           (public.lifecycle_source_closed(j.id, j.closed_at)) IS TRUE AS j_closed
    FROM application_packages p
    JOIN jobs j ON j.id = p.job_id
    JOIN companies c ON c.id = j.company_id
    LEFT JOIN profiles pr ON pr.user_id = p.user_id
    LEFT JOIN cover_letter_edits e ON e.user_id = p.user_id AND e.job_id = p.job_id AND e.superseded_at IS NULL
    WHERE p.user_id = ${userId}::uuid
    ORDER BY p.prepared_at DESC, p.job_id`);
  const { now } = await catalogNow();
  const out: GeneratedDocuments[] = [];
  for (const raw of rows) {
    const r = parseOrNull(rowSchema, raw);
    if (!r || Number.isNaN(r.prepared_at.getTime()) || (!r.has_resume && !r.has_cover)) continue;
    const job = toJobFacts(r, now);
    if (!job) continue;
    out.push({
      job,
      status: r.status,
      resume: r.has_resume,
      cover: r.has_cover,
      outdated: isResumeStale({
        hasResume: r.has_resume,
        packageProfileVersion: r.package_profile_version,
        currentProfileVersion: r.current_profile_version,
      }),
      preparedAt: r.prepared_at.toISOString(),
    });
  }
  return out;
}
