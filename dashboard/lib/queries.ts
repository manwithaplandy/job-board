import { sql } from "@/lib/db";
import { buildJobsQuery } from "@/lib/jobsQuery";
import type { Filters } from "@/lib/filters";
import type { ApplicationAnswers, ApplicationPackage, CompanyRow, CompanyReviewRow, DiscoveryStateRow, JobRow, PollRunRow, ReviewRunRow, ProfileLinks, ProfileRow, ReviewStats, ScreeningAnswers } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
import type { PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
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

// Everything the "Prepare application" builder needs in one round-trip: the
// résumé/cover-letter context (superset of getJobForCoverLetter) PLUS the ats,
// company board token, and external_id required to construct the Greenhouse
// question fetch, and the raw url for the apply link.
export async function getJobForPackage(
  jobId: string,
  userId: string,
): Promise<{
  title: string;
  company_name: string;
  description: string | null;
  url: string;
  external_id: string;
  ats: string;
  company_token: string;
  about: string | null;
  requirements: { text: string; met: boolean }[];
  skill_gaps: string[];
  red_flags: string[];
} | null> {
  const rows = await sql`
    SELECT j.title, c.name AS company_name, j.description, j.url, j.external_id,
           c.ats, c.token AS company_token,
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
    url: string;
    external_id: string;
    ats: string;
    company_token: string;
    about: string | null;
    requirements: { text: string; met: boolean }[];
    skill_gaps: string[];
    red_flags: string[];
  }) ?? null;
}

// postgres.js returns jsonb columns as parsed JS values and timestamptz as Date.
function toApplicationPackage(row: Record<string, unknown>): ApplicationPackage {
  const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));
  return {
    jobId: row.job_id as string,
    status: row.status as "prepared" | "applied",
    resume: (row.resume_json as TailoredResume | null) ?? null,
    coverLetter: (row.cover_letter_json as TailoredCoverLetter | null) ?? null,
    answersSnapshot: (row.answers_snapshot as ApplicationAnswers | null) ?? null,
    greenhouseQuestions: (row.greenhouse_questions as GreenhouseQuestions | null) ?? null,
    prefilledAnswers: (row.prefilled_answers as PrefilledAnswer[] | null) ?? null,
    applyUrl: (row.apply_url as string | null) ?? null,
    preparedAt: iso(row.prepared_at),
    appliedAt: row.applied_at != null ? iso(row.applied_at) : null,
  };
}

// All of the viewer's prepared packages, keyed by job in the caller. Single-tenant
// + only created on explicit "Prepare", so the row count stays small.
export async function getApplicationPackages(userId: string): Promise<ApplicationPackage[]> {
  const rows = await sql`
    SELECT job_id, status, resume_json, cover_letter_json, answers_snapshot,
           greenhouse_questions, prefilled_answers, apply_url, prepared_at, applied_at
    FROM application_packages
    WHERE user_id = ${userId}::uuid
  `;
  return (rows as unknown as Record<string, unknown>[]).map(toApplicationPackage);
}

// Persist (or refresh) a prepared package. Re-preparing upserts the generated
// content in place; status / applied_at are deliberately left untouched so a
// previously "applied" package is never silently downgraded.
export async function upsertApplicationPackage(
  userId: string,
  jobId: string,
  data: {
    resume: TailoredResume | null;
    coverLetter: TailoredCoverLetter | null;
    answersSnapshot: ApplicationAnswers | null;
    greenhouseQuestions: GreenhouseQuestions | null;
    prefilledAnswers: PrefilledAnswer[] | null;
    applyUrl: string | null;
  },
): Promise<ApplicationPackage> {
  // Bind jsonb as text + ::jsonb (mirrors upsertProfile); NULL stays SQL NULL.
  const j = (v: unknown): string | null => (v == null ? null : JSON.stringify(v));
  const rows = await sql`
    INSERT INTO application_packages
      (user_id, job_id, resume_json, cover_letter_json, answers_snapshot,
       greenhouse_questions, prefilled_answers, apply_url, status, prepared_at)
    VALUES (${userId}::uuid, ${jobId},
            ${j(data.resume)}::jsonb, ${j(data.coverLetter)}::jsonb,
            ${j(data.answersSnapshot)}::jsonb, ${j(data.greenhouseQuestions)}::jsonb,
            ${j(data.prefilledAnswers)}::jsonb, ${data.applyUrl},
            'prepared', now())
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      resume_json          = EXCLUDED.resume_json,
      cover_letter_json    = EXCLUDED.cover_letter_json,
      answers_snapshot     = EXCLUDED.answers_snapshot,
      greenhouse_questions = EXCLUDED.greenhouse_questions,
      prefilled_answers    = EXCLUDED.prefilled_answers,
      apply_url            = EXCLUDED.apply_url,
      prepared_at          = now()
    RETURNING job_id, status, resume_json, cover_letter_json, answers_snapshot,
              greenhouse_questions, prefilled_answers, apply_url, prepared_at, applied_at
  `;
  return toApplicationPackage(rows[0] as unknown as Record<string, unknown>);
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
