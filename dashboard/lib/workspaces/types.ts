// Workspace and agent data shapes (plan "Shared types", Task 0.10). Types only: later
// tasks add the zod schemas and declare them `satisfies z.ZodType<TheseTypes>` so the
// two cannot drift.
import type { JobReviewDetail } from "@/lib/types";

export type Requirement = NonNullable<JobReviewDetail["requirements"]>[number]; // { text: string; met: boolean }

export interface ProfileSummary {
  name: string | null;
  titles: string[];
  yearsOfExperience: number | null;
  education: string[];
  preferredLocations: string[];
  workAuthorized: boolean | null;
  needsSponsorship: boolean | null;
}

/** A catalog job as the agent sees it. Ages come from the catalog clock (catalogNow). */
export interface JobFacts {
  jobId: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  url: string;
  firstSeenAt: string;
  ageDays: number;
  closed: boolean;
}

/** The caller's review of one job, every corrected field read as COALESCE(correction, review). */
export interface ReviewFacts {
  jobId: string;
  verdict: "approve" | "deny" | null;
  fitScore: number | null;
  skillsScore: number | null;
  experienceScore: number | null;
  compScore: number | null;
  payMin: number | null;
  payMax: number | null;
  payCurrency: string | null;
  payPeriod: string | null;
  workArrangement: string | null;
  seniority: string | null;
  redFlags: string[];
  skillGaps: string[];
  requirements: Requirement[];
  reasoning: string | null;
  /** The review was made against an older profile version than the current one. */
  stale: boolean;
}

export interface MemoDoc {
  role: string;
  locations: string;
  compensation: string;
  mustHaves: string;
  dealBreakers: string;
  companies: string;
  other: string;
}
export interface MemoProposal {
  id: string;
  baseVersion: number;
  proposedDoc: MemoDoc;
  rationale: string;
  status: "pending" | "approved" | "declined" | "superseded";
  source: "interactive" | "background";
  createdAt: string;
}
export interface MemoVersion {
  version: number;
  doc: MemoDoc;
  changedBy: "user" | "proposal" | "restore";
  createdAt: string;
}

export type ShortlistState = "suggested" | "shortlisted" | "later" | "skipped";
export type Stage = "preparing" | "ready" | "applied" | "interviewing" | "offer" | "closed";
export type ClosedReason = "rejected" | "withdrawn" | "no_response";

export interface ApplicationEvent {
  id: number;
  kind: "stage" | "note";
  fromStage: Stage | null;
  toStage: Stage | null;
  note: string | null;
  actor: "user" | "agent";
  createdAt: string;
}
export interface ShortlistRow {
  jobId: string;
  state: ShortlistState;
  reasonCode: string | null;
  reasonText: string | null;
  briefWhy: string | null;
  briefRisk: string | null;
  setBy: "user" | "agent" | "system";
  updatedAt: string;
  job: JobFacts;
  fitScore: number | null;
}
export interface ApplicationRow {
  id: string;
  jobId: string;
  stage: Stage;
  closedReason: ClosedReason | null;
  nextStepOn: string | null;
  updatedAt: string;
  job: JobFacts;
  events: ApplicationEvent[];
  documents: { resume: boolean; cover: boolean; outdated: boolean };
}
export interface DocumentMeta {
  id: string;
  kind: "resume" | "photo" | "other";
  filename: string;
  mime: string;
  bytes: number;
  extraction: "ok" | "empty" | "failed";
  createdAt: string;
}

export type MetricId =
  | "applications_by_stage"
  | "applications_over_time"
  | "response_rate"
  | "time_in_stage"
  | "shortlist_funnel"
  | "skip_reasons"
  | "fit_shortlisted_vs_applied"
  | "weekly_activity"
  | "stale_applications"
  | "memo_changes";
export interface MetricSpec {
  metric: MetricId;
  groupBy?: "stage" | "week" | "reason";
  filter?: { stage?: Stage[] };
  window: "7d" | "30d" | "90d" | "all";
}
export type MetricResult = { spec: MetricSpec; n: number } & (
  | { kind: "value"; value: number | null; delta?: number }
  | { kind: "series"; points: Array<{ x: string; y: number }> }
  | { kind: "rows"; columns: string[]; rows: Array<Array<string | number>> }
);

export interface InboxItem {
  id: number;
  kind: string;
  title: string;
  body: string;
  payload: unknown;
  createdAt: string;
  readAt: string | null;
  dismissedAt: string | null;
}
