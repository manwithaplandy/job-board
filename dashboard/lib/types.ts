import type { TailoredResume } from "@/lib/rolefit/resumeSchema";
import type { TailoredCoverLetter } from "@/lib/rolefit/coverLetterSchema";
import type { GreenhouseQuestions } from "@/lib/rolefit/greenhouseQuestions";
import type { PrefilledAnswer } from "@/lib/rolefit/prefillSchema";

// Heavy, detail-only fields. These are NOT included in the board's list query
// (they serialized ~171KB into every board response while only ever showing
// one-at-a-time in JobDetail). They're fetched on job-open via GET /api/jobs/[id]
// and merged into the selected JobRow client-side. description (full JD plaintext)
// and url (apply link) come from the jobs table and ride along on the same fetch.
export interface JobReviewDetail {
  reasoning: string | null;
  about: string | null;
  red_flags: string[] | null;
  benefits: string[] | null;
  requirements: { text: string; met: boolean }[] | null;
  description: string | null;
  url: string | null;
  // categoricals + provenance for the correction edit form
  experience_match: string | null;
  industry: string | null;
  industry_subcategory: string | null;
  confidence: string | null;
  note: string | null;
  corrected: boolean;
}

export interface ReviewedJobRow {
  id: string;
  title: string;
  location: string | null;
  remote: boolean | null;
  first_seen_at: string;
  closed_at: string | null;
  company_name: string;
  // Review fields below are populated only when the board has an owner whose
  // job_reviews are joined (buildJobsQuery). With no owner the query omits these
  // columns and they are undefined at runtime — read them only behind the
  // showMatch / verdict guards (see JobCard, FilterBar review filters).
  verdict: string | null;
  human_override: boolean;  // TRUE when the operator manually rejected this job
  corrected?: boolean;      // TRUE when a review_corrections row overrides the model review
  role_category: string | null;
  seniority: string | null;
  work_arrangement: string | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_currency: string | null;
  pay_period: string | null;
  headcount: string | null;
  skills_score: number | null;
  experience_score: number | null;
  comp_score: number | null;
  fit_score: number | null;
  skill_gaps: string[] | null;
  // Detail-only fields — see JobReviewDetail. Absent from the list payload;
  // present on the selected job only after the /api/jobs/[id] fetch resolves.
  reasoning?: string | null;
  about?: string | null;
  red_flags?: string[] | null;
  benefits?: string[] | null;
  requirements?: { text: string; met: boolean }[] | null;
  description?: string | null;  // full JD plaintext (apply view)
  url?: string | null;          // apply link
  // experience_match/industry/industry_subcategory/confidence/note are detail-only,
  // like reasoning/about/etc. above: absent from the list payload, populated on the
  // selected job via the /api/jobs/[id] fetch (see JobReviewDetail) and consumed by
  // the correction edit form (ReviewPanel). ats/stage1_decision/stage1_reason remain
  // genuinely dropped from every query — no render path reads them — and are kept
  // optional only so a stray reference still type-checks rather than silently breaking.
  ats?: string;
  experience_match?: string | null;
  industry?: string | null;
  industry_subcategory?: string | null;
  confidence?: string | null;
  note?: string | null;
  stage1_decision?: string | null;
  stage1_reason?: string | null;
}

// Backward-compat alias so existing component imports keep compiling.
export type JobRow = ReviewedJobRow;

export interface CompanyRow {
  id: number;
  name: string;
}

export interface PollRunRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  companies_ok: number | null;
  companies_failed: number | null;
  new_jobs: number | null;
  closed_jobs: number | null;
  notes: string | null;
}

export interface ReviewRunRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  reviewed: number | null;
  gate_rejected: number | null;
  approved: number | null;
  denied: number | null;
  errors: number | null;
  notes: string | null;
}

/** Free-form profile URLs stored in profiles.links (jsonb). */
export interface ProfileLinks {
  linkedin?: string | null;
  github?: string | null;
  portfolio?: string | null;
}

/** Free-form reusable application answers stored in profiles.screening_answers (jsonb). */
export interface ScreeningAnswers {
  notice_period?: string | null;
  salary_expectation?: string | null;
  relocation?: string | null;
  [key: string]: string | null | undefined;
}

export interface ProfileRow {
  user_id: string;
  resume_text: string | null;
  resume_file_path: string | null;
  instructions: string | null;
  model_stage1: string | null;
  model_stage2: string | null;
  preferred_locations: string[];
  model_resume: string | null;
  company_instructions: string | null;
  company_profile_version: string | null;
  model_company: string | null;
  board_filters: import("@/lib/rolefit/filter").BoardFilterState | null;
  // Reusable application answers (Phase 1). jsonb columns are NOT NULL DEFAULT '{}'.
  full_name: string | null;
  email: string | null;
  phone: string | null;
  links: ProfileLinks;
  location: string | null;
  work_authorized: boolean | null;
  needs_sponsorship: boolean | null;
  eeo_gender: string | null;
  eeo_race: string | null;
  eeo_veteran: string | null;
  eeo_disability: string | null;
  screening_answers: ScreeningAnswers;
  model_cover: string | null;
  profile_version: string;
  updated_at: string;
}

/** The reusable application answers surfaced (read-only) in the board's ApplicationPanel. */
export interface ApplicationAnswers {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: ProfileLinks;
  work_authorized: boolean | null;
  needs_sponsorship: boolean | null;
  eeo_gender: string | null;
  eeo_race: string | null;
  eeo_veteran: string | null;
  eeo_disability: string | null;
  screening_answers: ScreeningAnswers;
}

/**
 * A persisted, prepared application package for one (user, job) — the board loads
 * this instead of regenerating on every click (Phase 3). `greenhouseQuestions` /
 * `prefilledAnswers` are populated only for Greenhouse postings whose schema fetch
 * + prefill succeeded; everything else falls back to the generic package.
 */
export interface ApplicationPackage {
  jobId: string;
  status: "prepared" | "applied";
  resume: TailoredResume | null;
  coverLetter: TailoredCoverLetter | null;
  answersSnapshot: ApplicationAnswers | null;
  greenhouseQuestions: GreenhouseQuestions | null;
  prefilledAnswers: PrefilledAnswer[] | null;
  applyUrl: string | null;
  preparedAt: string;
  appliedAt: string | null;
}

export interface ReviewStats {
  unreviewed: number;
  errors: number;
}

/** Compact telemetry surfaced in the header only when the viewer is authenticated. */
export interface OperatorSignals {
  health: "ok" | "warn" | "stale";
  unreviewed: number;
}

export interface CompanyReviewRow {
  id: number;
  name: string;
  ats: string;
  token: string;
  discovery_source: string;
  active: boolean;
  verdict: string | null;
  override_verdict: string | null;
  human_override: boolean;
  effective_verdict: string;
  confidence: string | null;
  reasoning: string | null;
  industry: string | null;
  industry_subcategory: string | null;
  tech_tags: string[] | null;
  red_flags: string[] | null;
}

export interface DiscoveryRunRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  ingested: number | null;
  reviewed: number | null;
  included: number | null;
  excluded: number | null;
  unknown: number | null;
  errors: number | null;
  backlog: number | null;
  notes: string | null;
}

export interface DiscoveryStateRow {
  halted_no_credits: boolean;
  resume_requested_at: string | null;
  backlog: number;
}
