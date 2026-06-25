import { sql } from "@/lib/db";
import { buildJobsQuery } from "@/lib/jobsQuery";
import type { Filters } from "@/lib/filters";
import type { CompanyRow, JobRow, PollRunRow, ReviewRunRow, ProfileRow, ReviewStats } from "@/lib/types";
import { profileVersion } from "@/lib/profileVersion";

export async function getJobs(f: Filters, userId: string): Promise<JobRow[]> {
  const { text, values } = buildJobsQuery(f, userId);
  const rows = await sql.unsafe(text, values as never[]);
  return rows as unknown as JobRow[];
}

export async function getLatestReviewRun(): Promise<ReviewRunRow | null> {
  const rows = await sql`
    SELECT * FROM review_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1
  `;
  return (rows[0] as unknown as ReviewRunRow) ?? null;
}

export async function getReviewStats(userId: string): Promise<ReviewStats> {
  const rows = await sql`
    SELECT
      (count(*) FILTER (WHERE r.job_id IS NULL))::int      AS unreviewed,
      (count(*) FILTER (WHERE r.error IS NOT NULL))::int    AS errors
    FROM jobs j
    LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${userId}::uuid
    WHERE j.closed_at IS NULL
  `;
  return (rows[0] as unknown as ReviewStats) ?? { unreviewed: 0, errors: 0 };
}

export async function getCompanies(): Promise<CompanyRow[]> {
  const rows = await sql`
    SELECT id, name FROM companies WHERE active ORDER BY name
  `;
  return rows as unknown as CompanyRow[];
}

export async function getLatestPollRun(): Promise<PollRunRow | null> {
  const rows = await sql`
    SELECT * FROM poll_runs ORDER BY started_at DESC LIMIT 1
  `;
  return (rows[0] as unknown as PollRunRow) ?? null;
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  // ::uuid — postgres.js binds the JS string as text; the uuid column needs the cast.
  const rows = await sql`SELECT * FROM profiles WHERE user_id = ${userId}::uuid`;
  return (rows[0] as unknown as ProfileRow) ?? null;
}

export async function upsertProfile(
  userId: string,
  data: { resumeText: string | null; instructions: string | null; resumeFilePath: string | null },
): Promise<void> {
  const version = profileVersion(data.resumeText, data.instructions);
  await sql`
    INSERT INTO profiles (user_id, resume_text, instructions, resume_file_path,
                          profile_version, updated_at)
    VALUES (${userId}::uuid, ${data.resumeText}, ${data.instructions},
            ${data.resumeFilePath}, ${version}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      resume_text      = EXCLUDED.resume_text,
      instructions     = EXCLUDED.instructions,
      resume_file_path = EXCLUDED.resume_file_path,
      profile_version  = EXCLUDED.profile_version,
      updated_at       = now()
  `;
}
