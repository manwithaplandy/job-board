import { sql } from "@/lib/db";
import { buildJobsQuery } from "@/lib/jobsQuery";
import type { Filters } from "@/lib/filters";
import type { CompanyRow, CompanyReviewRow, DiscoveryStateRow, JobRow, PollRunRow, ReviewRunRow, ProfileLinks, ProfileRow, ReviewStats, ScreeningAnswers } from "@/lib/types";
import { profileVersion } from "@/lib/profileVersion";
import { companyProfileVersion } from "@/lib/companyProfileVersion";

export async function getJobs(
  f: Filters,
  userId: string | null,
  ownerLocations: string[] = [],
): Promise<JobRow[]> {
  const { text, values } = buildJobsQuery(f, userId, ownerLocations);
  const rows = await sql.unsafe(text, values as never[]);
  return rows as unknown as JobRow[];
}

export async function getBoardOwnerId(): Promise<string | null> {
  // Single-tenant: the one operator whose verdicts the public board shows.
  const rows = await sql`SELECT user_id FROM profiles ORDER BY updated_at DESC LIMIT 1`;
  return (rows[0]?.user_id as string | undefined) ?? null;
}

export async function getBoardOwnerLocations(): Promise<string[]> {
  // Single-tenant: the board owner's location include-list (same profile that
  // getBoardOwnerId resolves). Empty array = no location pre-filter on the board.
  const rows = await sql`
    SELECT preferred_locations FROM profiles ORDER BY updated_at DESC LIMIT 1
  `;
  return (rows[0]?.preferred_locations as string[] | undefined) ?? [];
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

export async function getDistinctLocations(): Promise<{ location: string; count: number }[]> {
  // Distinct non-empty locations from open jobs, most common first — the option
  // set for the profile LocationPicker. Capped so the payload stays bounded.
  const rows = await sql`
    SELECT location, count(*)::int AS count
    FROM jobs
    WHERE closed_at IS NULL AND location IS NOT NULL AND location <> ''
    GROUP BY location
    ORDER BY count DESC, location ASC
    LIMIT 500
  `;
  return rows as unknown as { location: string; count: number }[];
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

export async function getJobForResume(
  jobId: string,
): Promise<{ title: string; company_name: string; description: string | null } | null> {
  const rows = await sql`
    SELECT j.title, c.name AS company_name, j.description
    FROM jobs j JOIN companies c ON c.id = j.company_id
    WHERE j.id = ${jobId}
  `;
  return (rows[0] as unknown as { title: string; company_name: string; description: string | null }) ?? null;
}

// Mirrors getJobForResume but joins the viewer's job_reviews so the cover-letter
// prompt can lean on the rich per-job review context (about / requirements /
// skill_gaps / red_flags). Missing review → empty arrays / null about.
export async function getJobForCoverLetter(
  jobId: string,
  userId: string,
): Promise<{
  title: string;
  company_name: string;
  description: string | null;
  about: string | null;
  requirements: { text: string; met: boolean }[];
  skill_gaps: string[];
  red_flags: string[];
} | null> {
  const rows = await sql`
    SELECT j.title, c.name AS company_name, j.description,
           r.about,
           COALESCE(r.requirements, '[]'::jsonb) AS requirements,
           COALESCE(r.skill_gaps,   '[]'::jsonb) AS skill_gaps,
           COALESCE(r.red_flags,    '[]'::jsonb) AS red_flags
    FROM jobs j
    JOIN companies c ON c.id = j.company_id
    LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${userId}::uuid
    WHERE j.id = ${jobId}
  `;
  return (rows[0] as unknown as {
    title: string;
    company_name: string;
    description: string | null;
    about: string | null;
    requirements: { text: string; met: boolean }[];
    skill_gaps: string[];
    red_flags: string[];
  }) ?? null;
}

export async function upsertProfile(
  userId: string,
  data: {
    resumeText: string | null;
    instructions: string | null;
    resumeFilePath: string | null;
    modelStage1: string | null;
    modelStage2: string | null;
    preferredLocations: string[];
    modelResume: string | null;
    companyInstructions: string | null;
    modelCompany: string | null;
    // Reusable application answers (Phase 1).
    fullName: string | null;
    email: string | null;
    phone: string | null;
    links: ProfileLinks;
    location: string | null;
    workAuthorized: boolean | null;
    needsSponsorship: boolean | null;
    eeoGender: string | null;
    eeoRace: string | null;
    eeoVeteran: string | null;
    eeoDisability: string | null;
    screeningAnswers: ScreeningAnswers;
    modelCover: string | null;
  },
): Promise<void> {
  // profile_version intentionally excludes the model choice, preferred locations,
  // AND the application answers — none must invalidate existing verdicts (spec §4).
  const version = profileVersion(data.resumeText, data.instructions);
  const companyVersion = companyProfileVersion(data.companyInstructions);
  await sql`
    INSERT INTO profiles (user_id, resume_text, instructions, resume_file_path,
                          model_stage1, model_stage2, preferred_locations, model_resume,
                          company_instructions, company_profile_version, model_company,
                          full_name, email, phone, links, location,
                          work_authorized, needs_sponsorship,
                          eeo_gender, eeo_race, eeo_veteran, eeo_disability,
                          screening_answers, model_cover,
                          profile_version, updated_at)
    VALUES (${userId}::uuid, ${data.resumeText}, ${data.instructions},
            ${data.resumeFilePath}, ${data.modelStage1}, ${data.modelStage2},
            ${data.preferredLocations}, ${data.modelResume},
            ${data.companyInstructions}, ${companyVersion}, ${data.modelCompany},
            ${data.fullName}, ${data.email}, ${data.phone},
            ${JSON.stringify(data.links)}::jsonb, ${data.location},
            ${data.workAuthorized}, ${data.needsSponsorship},
            ${data.eeoGender}, ${data.eeoRace}, ${data.eeoVeteran}, ${data.eeoDisability},
            ${JSON.stringify(data.screeningAnswers)}::jsonb, ${data.modelCover},
            ${version}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      resume_text             = EXCLUDED.resume_text,
      instructions            = EXCLUDED.instructions,
      resume_file_path        = EXCLUDED.resume_file_path,
      model_stage1            = EXCLUDED.model_stage1,
      model_stage2            = EXCLUDED.model_stage2,
      preferred_locations     = EXCLUDED.preferred_locations,
      model_resume            = EXCLUDED.model_resume,
      company_instructions    = EXCLUDED.company_instructions,
      company_profile_version = EXCLUDED.company_profile_version,
      model_company           = EXCLUDED.model_company,
      full_name               = EXCLUDED.full_name,
      email                   = EXCLUDED.email,
      phone                   = EXCLUDED.phone,
      links                   = EXCLUDED.links,
      location                = EXCLUDED.location,
      work_authorized         = EXCLUDED.work_authorized,
      needs_sponsorship       = EXCLUDED.needs_sponsorship,
      eeo_gender              = EXCLUDED.eeo_gender,
      eeo_race                = EXCLUDED.eeo_race,
      eeo_veteran             = EXCLUDED.eeo_veteran,
      eeo_disability          = EXCLUDED.eeo_disability,
      screening_answers       = EXCLUDED.screening_answers,
      model_cover             = EXCLUDED.model_cover,
      profile_version         = EXCLUDED.profile_version,
      updated_at              = now()
  `;
}

export async function getCompanyReviews(
  userId: string,
  bucket: "include" | "exclude" | "unknown",
  limit = 200,
): Promise<CompanyReviewRow[]> {
  const rows = await sql`
    SELECT c.id, c.name, c.ats, c.token, c.discovery_source, c.active,
           r.verdict, r.override_verdict, r.human_override,
           COALESCE(
             CASE WHEN r.human_override THEN r.override_verdict ELSE r.verdict END,
             CASE WHEN c.discovery_source = 'seed' THEN 'include' ELSE 'unknown' END
           ) AS effective_verdict,
           r.confidence, r.reasoning, r.industry, r.industry_subcategory,
           r.tech_tags, r.red_flags
    FROM companies c
    LEFT JOIN company_reviews r ON r.company_id = c.id AND r.user_id = ${userId}::uuid
    WHERE c.discovery_source <> 'manual'
      AND COALESCE(
            CASE WHEN r.human_override THEN r.override_verdict ELSE r.verdict END,
            CASE WHEN c.discovery_source = 'seed' THEN 'include' ELSE 'unknown' END
          ) = ${bucket}
    ORDER BY c.name
    LIMIT ${limit}
  `;
  return rows as unknown as CompanyReviewRow[];
}

export async function getCompanyVerdictCounts(
  userId: string,
): Promise<{ include: number; exclude: number; unknown: number }> {
  const rows = await sql`
    SELECT
      (count(*) FILTER (WHERE eff = 'include'))::int AS include,
      (count(*) FILTER (WHERE eff = 'exclude'))::int AS exclude,
      (count(*) FILTER (WHERE eff = 'unknown'))::int AS unknown
    FROM (
      SELECT COALESCE(
               CASE WHEN r.human_override THEN r.override_verdict ELSE r.verdict END,
               CASE WHEN c.discovery_source = 'seed' THEN 'include' ELSE 'unknown' END
             ) AS eff
      FROM companies c
      LEFT JOIN company_reviews r ON r.company_id = c.id AND r.user_id = ${userId}::uuid
      WHERE c.discovery_source <> 'manual'
    ) s
  `;
  return (rows[0] as unknown as { include: number; exclude: number; unknown: number })
    ?? { include: 0, exclude: 0, unknown: 0 };
}

export async function getDiscoveryState(userId: string): Promise<DiscoveryStateRow> {
  const rows = await sql`
    SELECT s.halted_no_credits, s.resume_requested_at,
      (SELECT count(*)::int
       FROM companies c
       LEFT JOIN company_reviews r ON r.company_id = c.id AND r.user_id = ${userId}::uuid
       JOIN profiles p ON p.user_id = ${userId}::uuid
       WHERE c.discovery_source NOT IN ('seed', 'manual')
         AND (r.company_id IS NULL
              OR (r.human_override = FALSE
                  AND r.company_profile_version IS DISTINCT FROM p.company_profile_version))
      ) AS backlog
    FROM discovery_state s WHERE s.id = TRUE
  `;
  return (rows[0] as unknown as DiscoveryStateRow)
    ?? { halted_no_credits: false, resume_requested_at: null, backlog: 0 };
}
