export interface JobRow {
  id: string;
  title: string;
  url: string;
  location: string | null;
  remote: boolean | null;
  first_seen_at: string;
  closed_at: string | null;
  company_name: string;
  ats: string;
  // Review fields below are populated only when the board has an owner whose
  // job_reviews are joined (buildJobsQuery). With no owner the query omits these
  // columns and they are undefined at runtime — read them only behind the
  // showMatch / verdict guards (see JobsTable, FilterBar review filters).
  verdict: string | null;
  human_override: boolean;  // TRUE when the operator manually rejected this job
  experience_match: string | null;
  industry: string | null;
  industry_subcategory: string | null;
  confidence: string | null;
  reasoning: string | null;
  stage1_decision: string | null;
  stage1_reason: string | null;
  role_category: string | null;
  seniority: string | null;
  work_arrangement: string | null;
  about: string | null;
  pay_min: number | null;
  pay_max: number | null;
  pay_currency: string | null;
  pay_period: string | null;
  headcount: string | null;
  skills_score: number | null;
  experience_score: number | null;
  comp_score: number | null;
  fit_score: number | null;
  red_flags: string[] | null;
  skill_gaps: string[] | null;
  benefits: string[] | null;
  requirements: { text: string; met: boolean }[] | null;
}

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
  profile_version: string;
  updated_at: string;
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

export interface DiscoveryStateRow {
  halted_no_credits: boolean;
  resume_requested_at: string | null;
  backlog: number;
}
