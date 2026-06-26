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
  experience_match: string | null;
  industry: string | null;
  industry_subcategory: string | null;
  confidence: string | null;
  reasoning: string | null;
  stage1_decision: string | null;
  stage1_reason: string | null;
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
  profile_version: string;
  updated_at: string;
}

export interface ReviewStats {
  unreviewed: number;
  errors: number;
}
