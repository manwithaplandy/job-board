import { sql } from "@/lib/db";
import {
  getCompanyVerdictCounts, getReviewStats, getDiscoveryState,
} from "@/lib/queries";
import type { PollRunRow, ReviewRunRow, DiscoveryRunRow, DiscoveryStateRow } from "@/lib/types";
import { dbLimit } from "@/lib/dbLimit";

// ── Run series: 90-day daily aggregates per pipeline ─────────────────────────

export interface JobDiscoveryDay {
  day: string; new_jobs: number; closed_jobs: number;
  companies_ok: number; companies_failed: number;
  run_count: number; total_duration_seconds: number;
}
export interface ReviewDay {
  day: string; reviewed: number; gate_rejected: number;
  approved: number; denied: number; errors: number;
  run_count: number; total_duration_seconds: number;
}
export interface CompanyDiscoveryDay {
  day: string; ingested: number; reviewed: number;
  included: number; excluded: number; unknown: number; errors: number;
  run_count: number; total_duration_seconds: number;
  last_backlog: number; halt_count: number;
}
export interface RunSeries { jobDiscovery: JobDiscoveryDay[]; review: ReviewDay[]; companyDiscovery: CompanyDiscoveryDay[] }

export async function getRunSeries(): Promise<RunSeries> {
  const [jobDiscovery, review, companyDiscovery] = await dbLimit([
    () => sql`
      SELECT to_char(date_trunc('day', started_at), 'YYYY-MM-DD') AS day,
             COALESCE(sum(new_jobs), 0)::int          AS new_jobs,
             COALESCE(sum(closed_jobs), 0)::int       AS closed_jobs,
             COALESCE(sum(companies_ok), 0)::int      AS companies_ok,
             COALESCE(sum(companies_failed), 0)::int  AS companies_failed,
             count(*)::int                            AS run_count,
             COALESCE(sum(EXTRACT(EPOCH FROM (finished_at - started_at)))
                      FILTER (WHERE finished_at IS NOT NULL), 0)::float AS total_duration_seconds
      FROM poll_runs
      WHERE started_at >= now() - interval '90 days'
      GROUP BY 1 ORDER BY 1
    `,
    () => sql`
      SELECT to_char(date_trunc('day', started_at), 'YYYY-MM-DD') AS day,
             COALESCE(sum(reviewed), 0)::int       AS reviewed,
             COALESCE(sum(gate_rejected), 0)::int  AS gate_rejected,
             COALESCE(sum(approved), 0)::int       AS approved,
             COALESCE(sum(denied), 0)::int         AS denied,
             COALESCE(sum(errors), 0)::int         AS errors,
             count(*)::int                         AS run_count,
             COALESCE(sum(EXTRACT(EPOCH FROM (finished_at - started_at)))
                      FILTER (WHERE finished_at IS NOT NULL), 0)::float AS total_duration_seconds
      FROM review_runs
      WHERE started_at >= now() - interval '90 days'
      GROUP BY 1 ORDER BY 1
    `,
    () => sql`
      SELECT to_char(date_trunc('day', started_at), 'YYYY-MM-DD') AS day,
             COALESCE(sum(ingested), 0)::int   AS ingested,
             COALESCE(sum(reviewed), 0)::int   AS reviewed,
             COALESCE(sum(included), 0)::int   AS included,
             COALESCE(sum(excluded), 0)::int   AS excluded,
             COALESCE(sum(unknown), 0)::int    AS unknown,
             COALESCE(sum(errors), 0)::int     AS errors,
             count(*)::int                     AS run_count,
             COALESCE(sum(EXTRACT(EPOCH FROM (finished_at - started_at)))
                      FILTER (WHERE finished_at IS NOT NULL), 0)::float AS total_duration_seconds,
             COALESCE((array_agg(backlog ORDER BY started_at DESC))[1], 0)::int AS last_backlog,
             count(*) FILTER (WHERE status = 'halted_no_credits')::int          AS halt_count
      FROM discovery_runs
      WHERE started_at >= now() - interval '90 days'
      GROUP BY 1 ORDER BY 1
    `,
  ]);
  return {
    jobDiscovery: jobDiscovery as unknown as JobDiscoveryDay[],
    review: review as unknown as ReviewDay[],
    companyDiscovery: companyDiscovery as unknown as CompanyDiscoveryDay[],
  };
}

// ── Funnel snapshot + latest runs ────────────────────────────────────────────

export interface CompanyFunnel {
  tracked: number; active: number; discovery_sourced: number; reviewed: number;
  include: number; exclude: number; unknown: number; backlog: number;
}
export interface JobFunnel {
  ever_seen: number; open: number; closed: number; reviewed: number;
  gate_rejected: number; approved: number; applied: number; denied: number;
  manual_rejected: number; unreviewed: number; errors: number;
}
export interface FunnelCounts { companies: CompanyFunnel; jobs: JobFunnel }

export async function getFunnel(
  userId: string,
  state: DiscoveryStateRow,
): Promise<FunnelCounts> {
  const companyAggRows = await sql`
      SELECT count(*)::int AS tracked,
             count(*) FILTER (WHERE c.active)::int AS active,
             count(*) FILTER (WHERE c.discovery_source <> 'manual')::int AS discovery_sourced,
             count(*) FILTER (WHERE c.discovery_source <> 'manual' AND cr.company_id IS NOT NULL)::int AS reviewed
      FROM companies c
      LEFT JOIN company_reviews cr ON cr.company_id = c.id AND cr.user_id = ${userId}::uuid
    `;
  const jobAggRows = await sql`
      SELECT count(*)::int AS ever_seen,
             count(*) FILTER (WHERE closed_at IS NULL)::int AS open,
             count(*) FILTER (WHERE closed_at IS NOT NULL)::int AS closed
      FROM jobs
    `;
  const reviewAggRows = await sql`
      SELECT count(*) FILTER (WHERE r.job_id IS NOT NULL)::int AS reviewed,
             count(*) FILTER (WHERE r.stage1_decision = 'reject')::int AS gate_rejected,
             count(*) FILTER (WHERE r.verdict = 'approve')::int AS approved,
             count(*) FILTER (WHERE r.verdict = 'deny')::int AS denied,
             count(*) FILTER (WHERE r.verdict = 'deny' AND r.human_override)::int AS manual_rejected
      FROM jobs j
      LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${userId}::uuid
      WHERE j.closed_at IS NULL
    `;
  const appliedAggRows = await sql`
      SELECT count(*)::int AS applied
      FROM application_packages
      WHERE user_id = ${userId}::uuid AND status = 'applied'
    `;
  const verdicts = await getCompanyVerdictCounts(userId);
  const stats = await getReviewStats(userId);

  const c = companyAggRows[0] as unknown as { tracked: number; active: number; discovery_sourced: number; reviewed: number };
  const j = jobAggRows[0] as unknown as { ever_seen: number; open: number; closed: number };
  const rv = reviewAggRows[0] as unknown as { reviewed: number; gate_rejected: number; approved: number; denied: number; manual_rejected: number };
  const ap = appliedAggRows[0] as unknown as { applied: number };

  return {
    companies: {
      tracked: c.tracked, active: c.active, discovery_sourced: c.discovery_sourced, reviewed: c.reviewed,
      include: verdicts.include, exclude: verdicts.exclude, unknown: verdicts.unknown,
      backlog: state.backlog,
    },
    jobs: {
      ever_seen: j.ever_seen, open: j.open, closed: j.closed,
      reviewed: rv.reviewed, gate_rejected: rv.gate_rejected,
      approved: rv.approved, applied: ap.applied, denied: rv.denied,
      manual_rejected: rv.manual_rejected,
      unreviewed: stats.unreviewed, errors: stats.errors,
    },
  };
}

// ── Per-pipeline health (latest / lastSuccess / all-time totals) ──────────────

export interface JobDiscoveryTotals     { runs: number; new_jobs: number; closed_jobs: number; companies_ok: number; companies_failed: number }
export interface ReviewerTotals         { runs: number; reviewed: number; gate_rejected: number; approved: number; denied: number; errors: number }
export interface CompanyDiscoveryTotals { runs: number; ingested: number; reviewed: number; included: number; excluded: number; errors: number }

export interface PipelineHealth {
  jobDiscovery:     { latest: PollRunRow | null;      lastSuccess: PollRunRow | null;      totals: JobDiscoveryTotals }
  reviewer:         { latest: ReviewRunRow | null;    lastSuccess: ReviewRunRow | null;    totals: ReviewerTotals }
  companyDiscovery: { latest: DiscoveryRunRow | null; lastSuccess: DiscoveryRunRow | null; totals: CompanyDiscoveryTotals; state: DiscoveryStateRow }
}

export async function getPipelineHealth(
  userId: string,
  state: DiscoveryStateRow,
): Promise<PipelineHealth> {
  const [
    jobDiscoveryLatestRows,
    reviewerLatestRows,
    companyDiscoveryLatestRows,
    jobDiscoveryLastSuccessRows,
    reviewerLastSuccessRows,
    companyDiscoveryLastSuccessRows,
    jobDiscoveryTotalsRows,
    reviewerTotalsRows,
    companyDiscoveryTotalsRows,
  ] = await dbLimit([
    () => sql`SELECT * FROM poll_runs ORDER BY started_at DESC LIMIT 1`,
    () => sql`SELECT * FROM review_runs ORDER BY started_at DESC LIMIT 1`,
    () => sql`SELECT * FROM discovery_runs ORDER BY started_at DESC LIMIT 1`,
    () => sql`SELECT * FROM poll_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1`,
    () => sql`SELECT * FROM review_runs WHERE finished_at IS NOT NULL AND reviewed > 0 ORDER BY started_at DESC LIMIT 1`,
    () => sql`SELECT * FROM discovery_runs WHERE finished_at IS NOT NULL AND (ingested > 0 OR reviewed > 0) ORDER BY started_at DESC LIMIT 1`,
    () => sql`
      SELECT count(*)::int                            AS runs,
             COALESCE(sum(new_jobs), 0)::int          AS new_jobs,
             COALESCE(sum(closed_jobs), 0)::int       AS closed_jobs,
             COALESCE(sum(companies_ok), 0)::int      AS companies_ok,
             COALESCE(sum(companies_failed), 0)::int  AS companies_failed
      FROM poll_runs
    `,
    () => sql`
      SELECT count(*)::int                          AS runs,
             COALESCE(sum(reviewed), 0)::int        AS reviewed,
             COALESCE(sum(gate_rejected), 0)::int   AS gate_rejected,
             COALESCE(sum(approved), 0)::int        AS approved,
             COALESCE(sum(denied), 0)::int          AS denied,
             COALESCE(sum(errors), 0)::int          AS errors
      FROM review_runs
    `,
    () => sql`
      SELECT count(*)::int                        AS runs,
             COALESCE(sum(ingested), 0)::int      AS ingested,
             COALESCE(sum(reviewed), 0)::int      AS reviewed,
             COALESCE(sum(included), 0)::int      AS included,
             COALESCE(sum(excluded), 0)::int      AS excluded,
             COALESCE(sum(errors), 0)::int        AS errors
      FROM discovery_runs
    `,
  ]);

  return {
    jobDiscovery: {
      latest:      (jobDiscoveryLatestRows[0] as unknown as PollRunRow) ?? null,
      lastSuccess: (jobDiscoveryLastSuccessRows[0] as unknown as PollRunRow) ?? null,
      totals:      jobDiscoveryTotalsRows[0] as unknown as JobDiscoveryTotals,
    },
    reviewer: {
      latest:      (reviewerLatestRows[0] as unknown as ReviewRunRow) ?? null,
      lastSuccess: (reviewerLastSuccessRows[0] as unknown as ReviewRunRow) ?? null,
      totals:      reviewerTotalsRows[0] as unknown as ReviewerTotals,
    },
    companyDiscovery: {
      latest:      (companyDiscoveryLatestRows[0] as unknown as DiscoveryRunRow) ?? null,
      lastSuccess: (companyDiscoveryLastSuccessRows[0] as unknown as DiscoveryRunRow) ?? null,
      totals:      companyDiscoveryTotalsRows[0] as unknown as CompanyDiscoveryTotals,
      state,
    },
  };
}

// ── Breakdowns (current-state distributions) ─────────────────────────────────

export interface Bar { label: string; count: number }
const TOP_N = 10;

export interface Distributions {
  jobsByLocation: Bar[]; jobsByDepartment: Bar[]; jobsRemote: Bar[];
  jobsByCompany: Bar[]; jobLifespan: Bar[];
  fitScore: Bar[]; approvalsByIndustry: Bar[]; approvalsByRole: Bar[];
  approvalsBySeniority: Bar[]; experienceMatch: Bar[]; workArrangement: Bar[];
  companiesByAts: Bar[]; companiesBySource: Bar[]; includedByIndustry: Bar[];
  topTechTags: Bar[]; topRedFlags: Bar[];
}

const asBars = (rows: unknown) => rows as unknown as Bar[];

export async function getDistributions(userId: string): Promise<Distributions> {
  const [
    jobsByLocation, jobsByDepartment, jobsRemote, jobsByCompany, jobLifespan,
    fitScore, approvalsByIndustry, approvalsByRole, approvalsBySeniority,
    experienceMatch, workArrangement,
    companiesByAts, companiesBySource, includedByIndustry, topTechTags, topRedFlags,
  ] = await dbLimit([
    () => sql`SELECT location AS label, count(*)::int AS count FROM jobs
        WHERE closed_at IS NULL AND location IS NOT NULL AND location <> ''
        GROUP BY location ORDER BY count DESC LIMIT ${TOP_N}`,
    () => sql`SELECT department AS label, count(*)::int AS count FROM jobs
        WHERE closed_at IS NULL AND department IS NOT NULL AND department <> ''
        GROUP BY department ORDER BY count DESC LIMIT ${TOP_N}`,
    () => sql`SELECT CASE WHEN remote THEN 'Remote' ELSE 'On-site / hybrid' END AS label, count(*)::int AS count
        FROM jobs WHERE closed_at IS NULL GROUP BY 1 ORDER BY count DESC`,
    () => sql`SELECT c.name AS label, count(*)::int AS count
        FROM jobs j JOIN companies c ON c.id = j.company_id
        WHERE j.closed_at IS NULL GROUP BY c.name ORDER BY count DESC LIMIT ${TOP_N}`,
    () => sql`SELECT CASE
               WHEN d < 1 THEN '<1d' WHEN d < 3 THEN '1-3d' WHEN d < 7 THEN '3-7d'
               WHEN d < 14 THEN '1-2w' WHEN d < 30 THEN '2-4w' WHEN d < 60 THEN '1-2mo'
               ELSE '2mo+' END AS label,
               count(*)::int AS count
        FROM (SELECT EXTRACT(EPOCH FROM (closed_at - first_seen_at)) / 86400 AS d
              FROM jobs WHERE closed_at IS NOT NULL) s
        GROUP BY label
        ORDER BY min(d)`,
    () => sql`SELECT ((fit_score / 10) * 10)::text || '-' || ((fit_score / 10) * 10 + 9)::text AS label,
               count(*)::int AS count
        FROM job_reviews
        WHERE user_id = ${userId}::uuid AND fit_score IS NOT NULL
        GROUP BY (fit_score / 10) ORDER BY (fit_score / 10)`,
    () => sql`SELECT industry AS label, count(*)::int AS count FROM job_reviews
        WHERE user_id = ${userId}::uuid AND verdict = 'approve' AND industry IS NOT NULL
        GROUP BY industry ORDER BY count DESC LIMIT ${TOP_N}`,
    () => sql`SELECT role_category AS label, count(*)::int AS count FROM job_reviews
        WHERE user_id = ${userId}::uuid AND verdict = 'approve' AND role_category IS NOT NULL
        GROUP BY role_category ORDER BY count DESC LIMIT ${TOP_N}`,
    () => sql`SELECT seniority AS label, count(*)::int AS count FROM job_reviews
        WHERE user_id = ${userId}::uuid AND verdict = 'approve' AND seniority IS NOT NULL
        GROUP BY seniority ORDER BY count DESC`,
    () => sql`SELECT experience_match AS label, count(*)::int AS count FROM job_reviews
        WHERE user_id = ${userId}::uuid AND experience_match IS NOT NULL
        GROUP BY experience_match ORDER BY count DESC`,
    () => sql`SELECT work_arrangement AS label, count(*)::int AS count FROM job_reviews
        WHERE user_id = ${userId}::uuid AND work_arrangement IS NOT NULL
        GROUP BY work_arrangement ORDER BY count DESC`,
    () => sql`SELECT ats AS label, count(*)::int AS count FROM companies GROUP BY ats ORDER BY count DESC`,
    () => sql`SELECT discovery_source AS label, count(*)::int AS count FROM companies
        GROUP BY discovery_source ORDER BY count DESC`,
    // Effective verdict (honors manual override), matching getCompanyVerdictCounts
    // so this breakdown and the funnel's "Included" count agree.
    () => sql`SELECT industry AS label, count(*)::int AS count FROM company_reviews
        WHERE user_id = ${userId}::uuid
          AND (CASE WHEN human_override THEN override_verdict ELSE verdict END) = 'include'
          AND industry IS NOT NULL
        GROUP BY industry ORDER BY count DESC LIMIT ${TOP_N}`,
    () => sql`SELECT t AS label, count(*)::int AS count
        FROM company_reviews cr, jsonb_array_elements_text(cr.tech_tags) AS t
        WHERE cr.user_id = ${userId}::uuid
        GROUP BY t ORDER BY count DESC LIMIT ${TOP_N}`,
    () => sql`SELECT f AS label, count(*)::int AS count
        FROM company_reviews cr, jsonb_array_elements_text(cr.red_flags) AS f
        WHERE cr.user_id = ${userId}::uuid
        GROUP BY f ORDER BY count DESC LIMIT ${TOP_N}`,
  ]);

  return {
    jobsByLocation: asBars(jobsByLocation), jobsByDepartment: asBars(jobsByDepartment),
    jobsRemote: asBars(jobsRemote), jobsByCompany: asBars(jobsByCompany), jobLifespan: asBars(jobLifespan),
    fitScore: asBars(fitScore), approvalsByIndustry: asBars(approvalsByIndustry),
    approvalsByRole: asBars(approvalsByRole), approvalsBySeniority: asBars(approvalsBySeniority),
    experienceMatch: asBars(experienceMatch), workArrangement: asBars(workArrangement),
    companiesByAts: asBars(companiesByAts), companiesBySource: asBars(companiesBySource),
    includedByIndustry: asBars(includedByIndustry), topTechTags: asBars(topTechTags),
    topRedFlags: asBars(topRedFlags),
  };
}

export interface PipelineSnapshot {
  funnel: FunnelCounts;
  health: PipelineHealth;
  distributions: Distributions;
}

export async function getPipelineSnapshot(userId: string): Promise<PipelineSnapshot> {
  // Discovery state (a correlated company-backlog count) is read by both the
  // funnel and the pipeline health. Compute it once and share it rather than
  // running the same subquery twice per snapshot.
  const state = await getDiscoveryState(userId);
  const funnel = await getFunnel(userId, state);
  const health = await getPipelineHealth(userId, state);
  const distributions = await getDistributions(userId);
  return { funnel, health, distributions };
}
