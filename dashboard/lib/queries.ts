import { withUserSql, withAnonSql } from "@/lib/db";
import type { Sql, TransactionSql } from "postgres";
import { unstable_cache } from "next/cache";
import { buildJobsQuery } from "@/lib/jobsQuery";
import type { Filters } from "@/lib/filters";
import type { ApplicationPackage, CompanyRow, CompanyReviewRow, DiscoveryStateRow, ReviewedJobRow, JobReviewDetail, PollRunRow, ReviewRunRow, ProfileLinks, ProfileRow, ReviewStats, ScreeningAnswers } from "@/lib/types";
import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
import type { PrefilledAnswer } from "@/lib/rolefit/prefillSchema";
import { profileVersion } from "@/lib/profileVersion";
import { parseProfileLinks } from "@/lib/profileLinks";
import { parseScreeningAnswers } from "@/lib/screeningAnswers";
import { companyProfileVersion } from "@/lib/companyProfileVersion";
import { isAccountDeleted } from "@/lib/tombstone";
import type { BoardFilterState } from "@/lib/rolefit/filter";
import {
  parseTailoredResume,
  parseTailoredCoverLetter,
  parsePrefilledAnswers,
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
  viewerLocations: string[] = [],
): Promise<ReviewedJobRow[]> {
  const { text, values } = buildJobsQuery(f, userId, viewerLocations);
  const run = async (tx: TransactionSql): Promise<ReviewedJobRow[]> => {
    const rows = await tx.unsafe(text, values as never[]);
    return (rows as unknown as Record<string, unknown>[]).map(toJobRow);
  };
  // Anonymous board reads run under the `anon` role (shared-read policy only); the
  // authed board runs under the viewer's `authenticated` context so RLS scopes the
  // review join to their own rows.
  return userId ? withUserSql(userId, run) : withAnonSql(run);
}

// The operator's deliberate rejects (verdict='deny' + human_override) — loaded so a
// mis-clicked reject is recoverable from the board's Rejected view AFTER a reload, not
// just in-session. The default board loads only verdict='approve', so these rows are
// otherwise never sent to the client. Same lean JobRow shape as the board list (reuses
// buildJobsQuery), bounded by its LIMIT. human_override scopes to operator rejects so
// the (huge) set of AI denies is excluded. Only called on the authed path.
export async function getRejectedJobs(
  userId: string,
  viewerLocations: string[] = [],
): Promise<ReviewedJobRow[]> {
  const f: Filters = {
    companies: [], include: [], exclude: [], remoteOnly: false,
    status: "open", verdict: "deny",
    experience: "", industry: "", subcategory: "", location: "",
  };
  const { text, values } = buildJobsQuery(f, userId, viewerLocations, { humanOverrideOnly: true });
  return withUserSql(userId, async (tx) => {
    const rows = await tx.unsafe(text, values as never[]);
    return (rows as unknown as Record<string, unknown>[]).map(toJobRow);
  });
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

export async function getJobReviewDetail(
  jobId: string,
  userId: string | null,
): Promise<JobReviewDetail | null> {
  // Heavy, detail-only fields for one job, scoped to the VIEWER's own review.
  // Driven FROM jobs so j.description (full JD plaintext) + j.url (apply link)
  // always come back — even for a pending job the viewer hasn't been reviewed for,
  // and for an anonymous viewer (userId=null → the review joins match nothing, so
  // every review field is null and only the job-only fields are populated). Fetched
  // lazily on job-open so the board list stays lean.
  const run = async (tx: TransactionSql): Promise<JobReviewDetail | null> => {
    const rows = await tx`
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
      FROM jobs j
      LEFT JOIN job_reviews r
        ON r.job_id = j.id AND r.user_id = ${userId}::uuid
      LEFT JOIN review_corrections rc
        ON rc.job_id = j.id AND rc.user_id = ${userId}::uuid
      WHERE j.id = ${jobId}
    `;
    const row = rows[0] as Record<string, unknown> | undefined;
    return row ? toJobReviewDetail(row) : null;
  };
  // Anonymous job-open runs under `anon` (userId=null → the review joins match no
  // rows; anon has SELECT-without-policy on the review tables, so it's zero rows,
  // not a permission error). Authed runs under the viewer's context.
  return userId ? withUserSql(userId, run) : withAnonSql(run);
}

export async function getLatestReviewRun(userId: string): Promise<ReviewRunRow | null> {
  // review_runs RLS scopes to the viewer's own runs + legacy NULL rows.
  return withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT * FROM review_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1
    `;
    return (rows[0] as unknown as ReviewRunRow) ?? null;
  });
}

function toReviewStats(row: Record<string, unknown>): ReviewStats {
  return {
    unreviewed: (row.unreviewed as number) ?? 0,
    reviewed: (row.reviewed as number) ?? 0,
    errors: (row.errors as number) ?? 0,
  };
}

// Executor-taking impl so the /analytics fan-out (metrics.ts) can run this within
// its single withUserSql transaction instead of opening a nested one.
//
// The pool is scoped to the viewer's review pool — open jobs that are remote OR in their
// preferred locations — mirroring lib/jobsQuery.ts:64 exactly (the reviewer only ever
// scores that pool, so counting the whole ~114k corpus overstated "unreviewed"). Empty
// preferred_locations → only remote jobs counted (locations are mandatory, so a non-issue).
// `reviewed` is the same pool's reviewed side; the header uses it to stay hidden until the
// viewer's first review lands (see components/rolefit/Header.tsx).
export async function reviewStatsWith(tx: TransactionSql, userId: string): Promise<ReviewStats> {
  const rows = await tx`
    SELECT
      (count(*) FILTER (WHERE r.job_id IS NULL))::int       AS unreviewed,
      (count(*) FILTER (WHERE r.job_id IS NOT NULL))::int    AS reviewed,
      (count(*) FILTER (WHERE r.error IS NOT NULL))::int     AS errors
    FROM jobs j
    LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${userId}::uuid
    WHERE j.closed_at IS NULL
      AND (j.remote IS TRUE OR j.location = ANY(COALESCE(
            (SELECT p.preferred_locations FROM profiles p WHERE p.user_id = ${userId}::uuid), '{}'::text[])))
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  return row ? toReviewStats(row) : { unreviewed: 0, reviewed: 0, errors: 0 };
}

export function getReviewStats(userId: string): Promise<ReviewStats> {
  return unstable_cache(
    () => withUserSql(userId, (tx) => reviewStatsWith(tx, userId)),
    ["review-stats", userId],
    { revalidate: 300 },
  )();
}

export async function getCompanies(userId: string): Promise<CompanyRow[]> {
  return withUserSql(userId, async (tx) => {
    const rows = await tx`SELECT id, name FROM companies WHERE active ORDER BY name`;
    return rows as unknown as CompanyRow[];
  });
}

export async function getDistinctLocations(userId: string): Promise<{ location: string; count: number }[]> {
  // Distinct non-empty locations from open jobs, most common first — the option
  // set for the profile LocationPicker. Capped so the payload stays bounded.
  return withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT location, count(*)::int AS count
      FROM jobs
      WHERE closed_at IS NULL AND location IS NOT NULL AND location <> ''
      GROUP BY location
      ORDER BY count DESC, location ASC
      LIMIT 500
    `;
    return rows as unknown as { location: string; count: number }[];
  });
}

export async function getLatestPollRun(userId: string): Promise<PollRunRow | null> {
  return withUserSql(userId, async (tx) => {
    const rows = await tx`SELECT * FROM poll_runs ORDER BY started_at DESC LIMIT 1`;
    return (rows[0] as unknown as PollRunRow) ?? null;
  });
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  return withUserSql(userId, async (tx) => {
  // ::uuid — postgres.js binds the JS string as text; the uuid column needs the cast.
  const rows = await tx`SELECT * FROM profiles WHERE user_id = ${userId}::uuid`;
  const row = rows[0] as unknown as ProfileRow | undefined;
  if (!row) return null;
  // links and screening_answers are jsonb — never trust the raw read (either can
  // arrive as a double-encoded string scalar). Route both through their total
  // parsers so a corrupt value can't propagate back into the write path or crash
  // a render.
  return {
    ...row,
    links: parseProfileLinks((row as { links: unknown }).links),
    screening_answers: parseScreeningAnswers((row as { screening_answers: unknown }).screening_answers),
  };
  });
}

export async function saveBoardFilters(
  userId: string,
  filters: BoardFilterState,
): Promise<void> {
  // UPDATE-only and intentionally does NOT touch updated_at: profile_version is
  // NOT NULL with no default, so we must not INSERT a row or bump updated_at when
  // persisting a viewer's filters (a filter change is not a profile edit).
  await withUserSql(userId, (tx) => tx`
    UPDATE profiles
    SET board_filters = ${JSON.stringify(filters)}::jsonb
    WHERE user_id = ${userId}::uuid
  `);
}

export async function getJobForResume(
  jobId: string,
  userId: string,
): Promise<{ title: string; company_name: string; description: string | null } | null> {
  return withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT j.title, COALESCE(c.display_name, c.name) AS company_name, j.description
      FROM jobs j JOIN companies c ON c.id = j.company_id
      WHERE j.id = ${jobId}
    `;
    return (rows[0] as unknown as { title: string; company_name: string; description: string | null }) ?? null;
  });
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
  return withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT j.title, COALESCE(c.display_name, c.name) AS company_name, j.description,
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
  });
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
  return withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT j.title, COALESCE(c.display_name, c.name) AS company_name, j.description, j.url, j.external_id,
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
  });
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
    prefilledAnswers: parseField("prefilled_answers", row.prefilled_answers, parsePrefilledAnswers),
    applyUrl: (row.apply_url as string | null) ?? null,
    profileVersion: (row.profile_version as string | null) ?? null,
    resumeInstructions: (row.resume_instructions as string | null) ?? null,
    coverLetterInstructions: (row.cover_letter_instructions as string | null) ?? null,
    resumeInstructionsDraft: (row.resume_instructions_draft as string | null) ?? null,
    coverLetterInstructionsDraft: (row.cover_letter_instructions_draft as string | null) ?? null,
    // Joined column — absent (undefined) on the upsert RETURNING path, which has no join.
    coverLetterEditedText: (row.cover_letter_edited_text as string | null) ?? null,
    preparedAt: iso(row.prepared_at),
    appliedAt: row.applied_at != null ? iso(row.applied_at) : null,
  };
}

// A bare "applied" marker row (created by one-click "Mark as applied") carries no
// prepared content — ALL of these columns are NULL. Setting ANY one makes the row
// a real package that un-apply must preserve rather than delete. Built from the
// active executor (a withUserSql tx) so the un-apply DELETE (app/actions/applications.ts)
// and any future reader agree on the column set — including apply_url, which closes
// the dormant un-apply gap if an apply_url-only write path is ever added, and the
// instruction-draft columns, so a Save-before-generating row (a saved box with no
// artifact yet) survives un-apply instead of being deleted along with its draft.
// The client mirror of this predicate is RolefitBoard's `hasContent` (handleUnapply) —
// keep the two column sets in lockstep.
export function bareMarkerPredicate(tx: Sql | TransactionSql) {
  return tx`
    resume_json IS NULL AND cover_letter_json IS NULL
      AND prefilled_answers IS NULL AND apply_url IS NULL
      AND resume_instructions_draft IS NULL
      AND cover_letter_instructions_draft IS NULL
  `;
}

// One job's prepared package — the async-generation completion path (GET
// /api/application/package) reloads just the settled job instead of the full set.
export async function getApplicationPackage(
  userId: string,
  jobId: string,
): Promise<ApplicationPackage | null> {
  return withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT ap.job_id, ap.status, ap.resume_json, ap.cover_letter_json,
             ap.prefilled_answers, ap.apply_url, ap.profile_version,
             ap.resume_instructions, ap.cover_letter_instructions,
             ap.resume_instructions_draft, ap.cover_letter_instructions_draft,
             ap.prepared_at, ap.applied_at,
             e.edited_text AS cover_letter_edited_text
      FROM application_packages ap
      LEFT JOIN cover_letter_edits e
        ON e.user_id = ap.user_id AND e.job_id = ap.job_id AND e.superseded_at IS NULL
      WHERE ap.user_id = ${userId}::uuid AND ap.job_id = ${jobId}
    `;
    return rows.length > 0
      ? toApplicationPackage(rows[0] as unknown as Record<string, unknown>)
      : null;
  });
}

// All of the viewer's prepared packages, keyed by job in the caller. Only created
// on explicit "Prepare", so the row count stays small.
export async function getApplicationPackages(userId: string): Promise<ApplicationPackage[]> {
  return withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT ap.job_id, ap.status, ap.resume_json, ap.cover_letter_json,
             ap.prefilled_answers, ap.apply_url, ap.profile_version,
             ap.resume_instructions, ap.cover_letter_instructions,
             ap.resume_instructions_draft, ap.cover_letter_instructions_draft,
             ap.prepared_at, ap.applied_at,
             e.edited_text AS cover_letter_edited_text
      FROM application_packages ap
      LEFT JOIN cover_letter_edits e
        ON e.user_id = ap.user_id AND e.job_id = ap.job_id AND e.superseded_at IS NULL
      WHERE ap.user_id = ${userId}::uuid
    `;
    return (rows as unknown as Record<string, unknown>[]).map(toApplicationPackage);
  });
}

// One job's question schema (job-level shared data — shared_read RLS lets the
// authenticated role SELECT it; no serviceSql needed). Total-parsed, never as-cast.
export async function getJobQuestion(
  userId: string,
  jobId: string,
): Promise<GreenhouseQuestions | null> {
  return withUserSql(userId, async (tx) => {
    const rows = await tx`SELECT questions FROM job_questions WHERE job_id = ${jobId}`;
    if (rows.length === 0) return null;
    return parseGreenhouseQuestionsJsonb((rows[0] as { questions: unknown }).questions);
  });
}

// Question schemas for a set of jobs, keyed by job_id (malformed rows dropped). Used by
// the board loader to surface the questions panel on every Greenhouse job.
export async function getJobQuestions(
  userId: string,
  jobIds: string[],
): Promise<Record<string, GreenhouseQuestions>> {
  if (jobIds.length === 0) return {};
  return withUserSql(userId, async (tx) => {
    const rows = await tx`
      SELECT job_id, questions FROM job_questions WHERE job_id = ANY(${jobIds})
    `;
    const out: Record<string, GreenhouseQuestions> = {};
    for (const r of rows as unknown as { job_id: string; questions: unknown }[]) {
      const parsed = parseGreenhouseQuestionsJsonb(r.questions);
      if (parsed == null) {
        console.warn(`[job_questions] dropping malformed questions for job ${r.job_id}`);
        continue;
      }
      out[r.job_id] = parsed;
    }
    return out;
  });
}

// Persist (or refresh) a prepared package. Re-preparing upserts the generated
// content in place; status / applied_at are deliberately left untouched so a
// previously "applied" package is never silently downgraded.
//
// Preserve-on-NULL: each generation route sends ONLY the artifact it produced and
// NULL for the rest. A NULL means "I didn't regenerate this", not "clear it" — so the
// ON CONFLICT clause COALESCEs to the stored value rather than overwriting with NULL.
// Without this, generating a cover letter alone nulled a persisted résumé (and
// regenerating a résumé nulled a persisted cover letter). A full "Prepare" still
// replaces everything because it sends non-NULL values for every column it owns.
export async function upsertApplicationPackage(
  userId: string,
  jobId: string,
  data: {
    resume: TailoredResume | null;
    coverLetter: TailoredCoverLetter | null;
    prefilledAnswers: PrefilledAnswer[] | null;
    applyUrl: string | null;
    resumeTraceId?: string | null;
    coverLetterTraceId?: string | null;
    profileVersion?: string | null;
    resumeInstructions?: string | null;
    coverLetterInstructions?: string | null;
  },
): Promise<ApplicationPackage> {
  // Bind jsonb as text + ::jsonb (mirrors upsertProfile); NULL stays SQL NULL.
  const j = (v: unknown): string | null => (v == null ? null : JSON.stringify(v));
  return withUserSql(userId, async (tx) => {
  // Regenerating the letter cleanly replaces the user's edit in their view: stamp the
  // current edit superseded (the row + its already-pushed golden item persist; re-saving
  // an edit resets superseded_at to NULL — see app/actions/coverLetterEdits.ts).
  if (data.coverLetter != null) {
    await tx`
      UPDATE cover_letter_edits SET superseded_at = now()
      WHERE user_id = ${userId}::uuid AND job_id = ${jobId} AND superseded_at IS NULL
    `;
  }
  const rows = await tx`
    INSERT INTO application_packages
      (user_id, job_id, resume_json, cover_letter_json,
       prefilled_answers, apply_url, resume_trace_id,
       cover_letter_trace_id, resume_instructions, cover_letter_instructions,
       profile_version, status, prepared_at)
    VALUES (${userId}::uuid, ${jobId},
            ${j(data.resume)}::jsonb, ${j(data.coverLetter)}::jsonb,
            ${j(data.prefilledAnswers)}::jsonb, ${data.applyUrl}, ${data.resumeTraceId ?? null},
            ${data.coverLetterTraceId ?? null}, ${data.resumeInstructions ?? null},
            ${data.coverLetterInstructions ?? null},
            ${data.profileVersion ?? null}, 'prepared', now())
    ON CONFLICT (user_id, job_id) DO UPDATE SET
      resume_json          = COALESCE(EXCLUDED.resume_json, application_packages.resume_json),
      cover_letter_json    = COALESCE(EXCLUDED.cover_letter_json, application_packages.cover_letter_json),
      prefilled_answers    = COALESCE(EXCLUDED.prefilled_answers, application_packages.prefilled_answers),
      apply_url            = COALESCE(EXCLUDED.apply_url, application_packages.apply_url),
      -- resume_trace_id and profile_version describe the résumé specifically, so they
      -- move in lockstep with resume_json: refreshed only when a new résumé is written,
      -- preserved (alongside the preserved résumé) otherwise. This keeps the résumé's
      -- "Outdated — regenerate" badge honest when only a cover letter is generated.
      resume_trace_id      = CASE WHEN EXCLUDED.resume_json IS NOT NULL
                                  THEN EXCLUDED.resume_trace_id
                                  ELSE application_packages.resume_trace_id END,
      profile_version      = CASE WHEN EXCLUDED.resume_json IS NOT NULL
                                  THEN EXCLUDED.profile_version
                                  ELSE application_packages.profile_version END,
      -- Same lockstep rule for the cover letter's trace id + per-job instructions:
      -- these describe the cover letter, so they refresh only when a new letter is
      -- written and are preserved (alongside the preserved letter) otherwise.
      cover_letter_trace_id = CASE WHEN EXCLUDED.cover_letter_json IS NOT NULL
                                   THEN EXCLUDED.cover_letter_trace_id
                                   ELSE application_packages.cover_letter_trace_id END,
      resume_instructions = CASE WHEN EXCLUDED.resume_json IS NOT NULL
                                 THEN EXCLUDED.resume_instructions
                                 ELSE application_packages.resume_instructions END,
      cover_letter_instructions = CASE WHEN EXCLUDED.cover_letter_json IS NOT NULL
                                       THEN EXCLUDED.cover_letter_instructions
                                       ELSE application_packages.cover_letter_instructions END,
      -- A freshly written artifact supersedes any pending saved draft for that leg:
      -- clear it so the box now mirrors the generated-with value (reads "applied").
      resume_instructions_draft = CASE WHEN EXCLUDED.resume_json IS NOT NULL
                                       THEN NULL
                                       ELSE application_packages.resume_instructions_draft END,
      cover_letter_instructions_draft = CASE WHEN EXCLUDED.cover_letter_json IS NOT NULL
                                             THEN NULL
                                             ELSE application_packages.cover_letter_instructions_draft END,
      prepared_at          = now()
    RETURNING job_id, status, resume_json, cover_letter_json,
              prefilled_answers, apply_url, profile_version,
              resume_instructions, cover_letter_instructions,
              resume_instructions_draft, cover_letter_instructions_draft,
              prepared_at, applied_at
  `;
  return toApplicationPackage(rows[0] as unknown as Record<string, unknown>);
  });
}

// Persist ONLY the saved DRAFT of one leg's generation-instructions box, independent of
// generating (Save button). Never touches resume_json/cover_letter_json/etc.; creates a
// bare 'prepared' row if none exists yet (benign — every pane is content-gated on
// resume/coverLetter, and the applied set is status='applied'-gated). Empty string is a
// valid saved value; the column is left as the caller passes it.
export async function upsertInstructionDraft(
  userId: string,
  jobId: string,
  leg: "resume" | "cover",
  value: string,
): Promise<void> {
  await withUserSql(userId, async (tx) => {
    if (leg === "resume") {
      await tx`
        INSERT INTO application_packages
          (user_id, job_id, resume_instructions_draft, status, prepared_at)
        VALUES (${userId}::uuid, ${jobId}, ${value}, 'prepared', now())
        ON CONFLICT (user_id, job_id) DO UPDATE SET
          resume_instructions_draft = EXCLUDED.resume_instructions_draft
      `;
    } else {
      await tx`
        INSERT INTO application_packages
          (user_id, job_id, cover_letter_instructions_draft, status, prepared_at)
        VALUES (${userId}::uuid, ${jobId}, ${value}, 'prepared', now())
        ON CONFLICT (user_id, job_id) DO UPDATE SET
          cover_letter_instructions_draft = EXCLUDED.cover_letter_instructions_draft
      `;
    }
  });
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
    // Standing generation guidance — reviewer-independent (NOT in profile_version).
    resumeGenerationInstructions: string | null;
    coverLetterGenerationInstructions: string | null;
  },
): Promise<void> {
  // M-RESURRECT-2: a deleted user's JWT stays valid ≤1h after the erasure cascade, so
  // a still-authenticated session (onboarding, /profile save, résumé save) could
  // re-INSERT the profiles row and resurrect PII. Refuse to write for a tombstoned
  // user — the write becomes a silent no-op (cheap EXISTS on account_deletions).
  if (await isAccountDeleted(userId)) return;
  // profile_version intentionally excludes the model choice, preferred locations,
  // AND the application answers — none must invalidate existing verdicts (spec §4).
  const version = profileVersion(data.resumeText, data.instructions);
  const companyVersion = companyProfileVersion(data.companyInstructions);
  await withUserSql(userId, (tx) => tx`
    INSERT INTO profiles (user_id, resume_text, instructions, resume_file_path,
                          model_stage1, model_stage2, preferred_locations, model_resume,
                          company_instructions, company_profile_version, model_company,
                          full_name, email, phone, links, location,
                          work_authorized, needs_sponsorship,
                          eeo_gender, eeo_race, eeo_veteran, eeo_disability,
                          screening_answers, model_cover,
                          resume_generation_instructions, cover_letter_generation_instructions,
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
            ${data.resumeGenerationInstructions}, ${data.coverLetterGenerationInstructions},
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
      resume_generation_instructions       = EXCLUDED.resume_generation_instructions,
      cover_letter_generation_instructions = EXCLUDED.cover_letter_generation_instructions,
      profile_version         = EXCLUDED.profile_version,
      updated_at              = now()
  `);
}

/**
 * ILIKE-name-search fragment for the companies query, built from the active executor
 * `tx`. Matches the slug (`c.name`) OR the enriched cased name (`c.display_name`). A
 * non-empty (trimmed) term binds `%term%` as a PARAMETER (postgres.js — injection-safe,
 * never interpolated) once per column; empty/whitespace yields an inert empty fragment
 * so behavior is identical to no search. Exported for unit tests.
 */
export function companyNameSearchFragment(tx: Sql | TransactionSql, search?: string) {
  const term = (search ?? "").trim();
  const like = "%" + term + "%";
  return term ? tx`AND (c.name ILIKE ${like} OR c.display_name ILIKE ${like})` : tx``;
}

export async function getCompanyReviews(
  userId: string,
  bucket: "include" | "exclude" | "unknown",
  limit = 200,
  search?: string,
): Promise<CompanyReviewRow[]> {
  return withUserSql(userId, async (tx) => {
  const rows = await tx`
    SELECT c.id, COALESCE(c.display_name, c.name) AS name, c.ats, c.token, c.discovery_source, c.active,
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
      ${companyNameSearchFragment(tx, search)}
    ORDER BY COALESCE(c.display_name, c.name)
    LIMIT ${limit}
  `;
  return rows as unknown as CompanyReviewRow[];
  });
}

// Executor-taking impl so metrics.ts can run it within its single withUserSql tx.
export async function companyVerdictCountsWith(
  tx: TransactionSql,
  userId: string,
): Promise<{ include: number; exclude: number; unknown: number }> {
  const rows = await tx`
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

export function getCompanyVerdictCounts(
  userId: string,
): Promise<{ include: number; exclude: number; unknown: number }> {
  return withUserSql(userId, (tx) => companyVerdictCountsWith(tx, userId));
}

// Executor-taking impl so metrics.ts can run it within its single withUserSql tx.
export async function discoveryStateWith(tx: TransactionSql, userId: string): Promise<DiscoveryStateRow> {
  const rows = await tx`
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

export function getDiscoveryState(userId: string): Promise<DiscoveryStateRow> {
  return withUserSql(userId, (tx) => discoveryStateWith(tx, userId));
}
