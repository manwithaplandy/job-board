import { sql } from "@/lib/db";
import { unstable_cache } from "next/cache";
import { buildJobsQuery } from "@/lib/jobsQuery";
import type { Filters } from "@/lib/filters";
import type { ApplicationAnswers, ApplicationPackage, CompanyRow, CompanyReviewRow, DiscoveryStateRow, JobRow, ReviewedJobRow, JobReviewDetail, PollRunRow, ReviewRunRow, ProfileLinks, ProfileRow, ReviewStats, ScreeningAnswers } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
import type { PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
import { profileVersion } from "@/lib/profileVersion";
import { companyProfileVersion } from "@/lib/companyProfileVersion";
import type { BoardFilterState } from "@/lib/rolefit/filter";
import {
  parseTailoredResume,
  parseTailoredCoverLetter,
  parsePrefilledAnswers,
  parseApplicationAnswers,
  parseGreenhouseQuestionsJsonb,
} from "@/lib/rolefit/packageCodec";

function toJobRow(row: Record<string, unknown>): ReviewedJobRow {
  const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v ?? ""));
  return {
    id: row.id as string,
    title: row.title as string,
    location: (row.location as string | null) ?? null,
    remote: (row.remote as boolean | null) ?? null,
    first_seen_at: iso(row.first_seen_at),
    closed_at: row.closed_at != null ? iso(row.closed_at) : null,
    company_name: row.company_name as string,
    ats: row.ats as string,
    verdict: (row.verdict as string | null) ?? null,
    human_override: (row.human_override as boolean) ?? false,
    corrected: row.corrected as boolean | undefined,
    role_category: (row.role_category as string | null) ?? null,
    seniority: (row.seniority as string | null) ?? null,
    work_arrangement: (row.work_arrangement as string | null) ?? null,
    pay_min: (row.pay_min as number | null) ?? null,
    pay_max: (row.pay_max as number | null) ?? null,
    pay_currency: (row.pay_currency as string | null) ?? null,
    pay_period: (row.pay_period as string | null) ?? null,
    headcount: (row.headcount as string | null) ?? null,
    skills_score: (row.skills_score as number | null) ?? null,
    experience_score: (row.experience_score as number | null) ?? null,
    comp_score: (row.comp_score as number | null) ?? null,
    fit_score: (row.fit_score as number | null) ?? null,
    skill_gaps: (row.skill_gaps as string[] | null) ?? null,
  };
}

export async function getJobs(
  f: Filters,
  userId: string | null,
  ownerLocations: string[] = [],
): Promise<ReviewedJobRow[]> {
  const { text, values } = buildJobsQuery(f, userId, ownerLocations);
  const rows = await sql.unsafe(text, values as never[]);
  return (rows as unknown as Record<string, unknown>[]).map(toJobRow);
}

// The operator's deliberate rejects (verdict='deny' + human_override) — loaded so a
// mis-clicked reject is recoverable from the board's Rejected view AFTER a reload, not
// just in-session. The default board loads only verdict='approve', so these rows are
// otherwise never sent to the client. Same lean JobRow shape as the board list (reuses
// buildJobsQuery), bounded by its LIMIT. human_override scopes to operator rejects so
// the (huge) set of AI denies is excluded. Only called on the authed path.
export async function getRejectedJobs(
  userId: string,
  ownerLocations: string[] = [],
): Promise<ReviewedJobRow[]> {
  const f: Filters = {
    companies: [], include: [], exclude: [], remoteOnly: false,
    status: "open", verdict: "deny",
    experience: "", industry: "", subcategory: "", location: "",
  };
  const { text, values } = buildJobsQuery(f, userId, ownerLocations, { humanOverrideOnly: true });
  const rows = await sql.unsafe(text, values as never[]);
  return (rows as unknown as Record<string, unknown>[]).map(toJobRow);
}

export async function getBoardOwnerId(): Promise<string | null> {
  // Single-tenant: the one operator whose verdicts the public board shows.
  const rows = await sql`SELECT user_id FROM profiles WHERE is_owner LIMIT 1`;
  return (rows[0]?.user_id as string | undefined) ?? null;
}

export async function getBoardOwner(): Promise<{ id: string | null; locations: string[] }> {
  // Single-tenant: the board owner's id AND location include-list come from the
  // same is_owner profile row. One query instead of two separate SELECTs.
  const rows = await sql`
    SELECT user_id, preferred_locations FROM profiles WHERE is_owner LIMIT 1
  `;
  const row = rows[0] as { user_id?: string; preferred_locations?: string[] } | undefined;
  return { id: row?.user_id ?? null, locations: row?.preferred_locations ?? [] };
}

// postgres.js delivers jsonb columns as parsed JS values; normalize a detail row
// into the typed shape at the boundary instead of an `as unknown as` cast.
function toJobReviewDetail(row: Record<string, unknown>): JobReviewDetail {
  return {
    reasoning: (row.reasoning as string | null) ?? null,
    about: (row.about as string | null) ?? null,
    red_flags: (row.red_flags as string[] | null) ?? null,
    benefits: (row.benefits as string[] | null) ?? null,
    requirements: (row.requirements as { text: string; met: boolean }[] | null) ?? null,
    description: (row.description as string | null) ?? null,
    url: (row.url as string | null) ?? null,
    experience_match: (row.experience_match as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    industry_subcategory: (row.industry_subcategory as string | null) ?? null,
    confidence: (row.confidence as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    corrected: (row.corrected as boolean) ?? false,
  };
}

export async function getJobReviewDetail(jobId: string): Promise<JobReviewDetail | null> {
  // Heavy, detail-only fields for one job, scoped to the board owner's review
  // (the same owner the list LEFT JOINs). Resolved in one round-trip via the
  // owner subquery. Fetched lazily on job-open so the board list stays lean.
  // j.description (full JD plaintext) and j.url (apply link) ride along here too
  // — both were dropped from the list payload for the same payload-size reason.
  const rows = await sql`
    SELECT
      COALESCE(rc.reasoning, r.reasoning) AS reasoning,
      COALESCE(rc.about, r.about) AS about,
      COALESCE(rc.red_flags, r.red_flags) AS red_flags,
      COALESCE(rc.benefits, r.benefits) AS benefits,
      COALESCE(rc.requirements, r.requirements) AS requirements,
      j.description, j.url,
      COALESCE(rc.experience_match, r.experience_match) AS experience_match,
      COALESCE(rc.industry, r.industry) AS industry,
      COALESCE(rc.industry_subcategory, r.industry_subcategory) AS industry_subcategory,
      COALESCE(rc.confidence, r.confidence) AS confidence,
      rc.note,
      (rc.job_id IS NOT NULL) AS corrected
    FROM job_reviews r
    JOIN jobs j ON j.id = r.job_id
    LEFT JOIN review_corrections rc
      ON rc.job_id = r.job_id AND rc.user_id = r.user_id
    WHERE r.job_id = ${jobId}
      AND r.user_id = (SELECT user_id FROM profiles WHERE is_owner LIMIT 1)
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  return row ? toJobReviewDetail(row) : null;
}

export async function getLatestReviewRun(): Promise<ReviewRunRow | null> {
  const rows = await sql`
    SELECT * FROM review_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1
  `;
  return (rows[0] as unknown as ReviewRunRow) ?? null;
}

function toReviewStats(row: Record<string, unknown>): ReviewStats {
  return {
    unreviewed: (row.unreviewed as number) ?? 0,
    errors: (row.errors as number) ?? 0,
  };
}

async function _getReviewStatsImpl(userId: string): Promise<ReviewStats> {
  const rows = await sql`
    SELECT
      (count(*) FILTER (WHERE r.job_id IS NULL))::int      AS unreviewed,
      (count(*) FILTER (WHERE r.error IS NOT NULL))::int    AS errors
    FROM jobs j
    LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${userId}::uuid
    WHERE j.closed_at IS NULL
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  return row ? toReviewStats(row) : { unreviewed: 0, errors: 0 };
}

export function getReviewStats(userId: string): Promise<ReviewStats> {
  return unstable_cache(
    () => _getReviewStatsImpl(userId),
    ["review-stats", userId],
    { revalidate: 300 },
  )();
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

export async function saveBoardFilters(
  userId: string,
  filters: BoardFilterState,
): Promise<void> {
  // UPDATE-only and intentionally does NOT touch updated_at: getBoardOwnerId()
  // resolves the single-tenant board owner by is_owner flag, and
  // profile_version is NOT NULL with no default — so we must not INSERT a row
  // or bump updated_at when persisting a viewer's filters.
  await sql`
    UPDATE profiles
    SET board_filters = ${JSON.stringify(filters)}::jsonb
    WHERE user_id = ${userId}::uuid
  `;
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

// postgres.js returns jsonb columns as parsed JS values (a jsonb string scalar comes
// back as a STRING) and timestamptz as Date. Every jsonb column is run through a total
// parser: a malformed payload becomes null (the UI degrades to "not generated") and is
// logged with the jobId, instead of a bad shape reaching React and crashing the board.
export function toApplicationPackage(row: Record<string, unknown>): ApplicationPackage {
  const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));
  const jobId = row.job_id as string;
  const parseField = <T>(field: string, raw: unknown, parse: (r: unknown) => T | null): T | null => {
    if (raw == null) return null;
    const parsed = parse(raw);
    if (parsed == null) {
      console.warn(`[application_packages] dropping malformed ${field} for job ${jobId}`);
    }
    return parsed;
  };
  return {
    jobId,
    status: row.status as "prepared" | "applied",
    resume: parseField("resume_json", row.resume_json, parseTailoredResume),
    coverLetter: parseField("cover_letter_json", row.cover_letter_json, parseTailoredCoverLetter),
    answersSnapshot: parseField("answers_snapshot", row.answers_snapshot, parseApplicationAnswers),
    greenhouseQuestions: parseField("greenhouse_questions", row.greenhouse_questions, parseGreenhouseQuestionsJsonb),
    prefilledAnswers: parseField("prefilled_answers", row.prefilled_answers, parsePrefilledAnswers),
    applyUrl: (row.apply_url as string | null) ?? null,
    profileVersion: (row.profile_version as string | null) ?? null,
    preparedAt: iso(row.prepared_at),
    appliedAt: row.applied_at != null ? iso(row.applied_at) : null,
  };
}

// A bare "applied" marker row (created by one-click "Mark as applied") carries no
// prepared content — ALL of these columns are NULL. Setting ANY one makes the row
// a real package that un-apply must preserve rather than delete. Kept as one shared
// SQL fragment so the un-apply DELETE (app/actions/applications.ts) and any future
// reader agree on the column set — including apply_url, which closes the dormant
// un-apply gap if an apply_url-only write path is ever added.
export const BARE_MARKER_PREDICATE = sql`
  resume_json IS NULL AND cover_letter_json IS NULL
    AND greenhouse_questions IS NULL AND prefilled_answers IS NULL
    AND answers_snapshot IS NULL AND apply_url IS NULL
`;

// All of the viewer's prepared packages, keyed by job in the caller. Single-tenant
// + only created on explicit "Prepare", so the row count stays small.
export async function getApplicationPackages(userId: string): Promise<ApplicationPackage[]> {
  const rows = await sql`
    SELECT job_id, status, resume_json, cover_letter_json, answers_snapshot,
           greenhouse_questions, prefilled_answers, apply_url, profile_version,
           prepared_at, applied_at
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
    resumeTraceId?: string | null;
    profileVersion?: string | null;
  },
): Promise<ApplicationPackage> {
  // Bind jsonb as text + ::jsonb (mirrors upsertProfile); NULL stays SQL NULL.
  const j = (v: unknown): string | null => (v == null ? null : JSON.stringify(v));
  const rows = await sql`
    INSERT INTO application_packages
      (user_id, job_id, resume_json, cover_letter_json, answers_snapshot,
       greenhouse_questions, prefilled_answers, apply_url, resume_trace_id,
       profile_version, status, prepared_at)
    VALUES (${userId}::uuid, ${jobId},
            ${j(data.resume)}::jsonb, ${j(data.coverLetter)}::jsonb,
            ${j(data.answersSnapshot)}::jsonb, ${j(data.greenhouseQuestions)}::jsonb,
            ${j(data.prefilledAnswers)}::jsonb, ${data.applyUrl}, ${data.resumeTraceId ?? null},
            ${data.profileVersion ?? null}, 'prepared', now())
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      resume_json          = EXCLUDED.resume_json,
      cover_letter_json    = EXCLUDED.cover_letter_json,
      answers_snapshot     = EXCLUDED.answers_snapshot,
      greenhouse_questions = EXCLUDED.greenhouse_questions,
      prefilled_answers    = EXCLUDED.prefilled_answers,
      apply_url            = EXCLUDED.apply_url,
      resume_trace_id      = EXCLUDED.resume_trace_id,
      profile_version      = EXCLUDED.profile_version,
      prepared_at          = now()
    RETURNING job_id, status, resume_json, cover_letter_json, answers_snapshot,
              greenhouse_questions, prefilled_answers, apply_url, profile_version,
              prepared_at, applied_at
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
