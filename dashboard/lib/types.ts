export interface JobRow {
  id: string;
  title: string;
  url: string;
  location: string | null;
  remote: boolean | null;
  first_seen_at: string; // ISO timestamp
  closed_at: string | null;
  company_name: string;
  ats: string;
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

export interface ProfileRow {
  user_id: string;
  resume_text: string | null;
  resume_file_path: string | null;
  instructions: string | null;
  profile_version: string;
  updated_at: string;
}
