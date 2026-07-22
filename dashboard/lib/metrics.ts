import { withUserSql } from "@/lib/db";
import type { TransactionSql } from "postgres";
import {
  companyVerdictCountsWith, reviewStatsWith, discoveryStateWith,
} from "@/lib/queries";
import type { PollRunRow, ReviewRunRow, DiscoveryRunRow, DiscoveryStateRow, ReviewStats } from "@/lib/types";
import { dbLimit } from "@/lib/dbLimit";

// All metrics reads run inside a SINGLE withUserSql transaction (one connection),
// threading the `tx` executor through the internal functions. This keeps the whole
// /analytics fan-out under the viewer's `authenticated` RLS context — its review_runs
// series + job_reviews / company_reviews aggregates are viewer-scoped by the T1
// policies, while poll/discovery series read the shared SELECT-true tables — and
// avoids opening a nested transaction per helper.

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

export function getRunSeries(userId: string): Promise<RunSeries> {
  return withUserSql(userId, (tx) => runSeriesWith(tx));
}

async function runSeriesWith(tx: TransactionSql): Promise<RunSeries> {
  const [jobDiscovery, review, companyDiscovery] = await dbLimit([
    () => tx`
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
    () => tx`
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
    () => tx`
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

export interface ReviewAgg {
  reviewed: number; gate_rejected: number; approved: number; denied: number; manual_rejected: number;
}

// Executor-taking impl (mirrors reviewStatsWith / companyVerdictCountsWith) so the
// /analytics funnel runs it within its single withUserSql tx; exported so the real-DB
// regression test (lib/queries.locationScoping.db.test.ts) can drive the ACTUAL query.
// Scoped to the viewer's review pool — open jobs whose canonical locations (raw-string
// COALESCE fallback) overlap preferred_locations, plus remote jobs when 'Remote' is
// selected (opt-in). Its predicate BODY matches reviewStatsWith (lib/queries.ts) and
// lib/jobsQuery.ts; the empty-prefs handling deliberately diverges (board/reviewer: no
// filter). The preferred_locations subquery MUST be COALESCE'd to an empty array, which is
// load-bearing twice over: (a) the `= ANY((SELECT ...))` bare-subquery form is a plan-time
// 42883 (operator does not exist: text = text[]) that 500'd every authenticated render (the
// b0a2689 incident) — the array-form COALESCE makes it legal; (b) bare `&&` against a
// subquery IS legal, but a 0-row subquery yields NULL so the row drops only implicitly —
// COALESCE to '{}' makes `&&` definitively false. Empty/missing prefs → empty pool.
export async function reviewAggWith(tx: TransactionSql, userId: string): Promise<ReviewAgg> {
  const rows = await tx`
      SELECT count(*) FILTER (WHERE r.job_id IS NOT NULL)::int AS reviewed,
             count(*) FILTER (WHERE r.stage1_decision = 'reject')::int AS gate_rejected,
             count(*) FILTER (WHERE r.verdict = 'approve')::int AS approved,
             count(*) FILTER (WHERE r.verdict = 'deny')::int AS denied,
             count(*) FILTER (WHERE r.verdict = 'deny' AND r.human_override)::int AS manual_rejected
      FROM jobs j
      LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${userId}::uuid
      WHERE j.closed_at IS NULL
        AND (
          COALESCE(j.location_canonicals, ARRAY[j.location]) && COALESCE(
            (SELECT p.preferred_locations FROM profiles p WHERE p.user_id = ${userId}::uuid),
            '{}'::text[])
          OR ('Remote' = ANY(COALESCE(
            (SELECT p.preferred_locations FROM profiles p WHERE p.user_id = ${userId}::uuid),
            '{}'::text[])) AND j.remote IS TRUE)
        )
    `;
  return (rows[0] as unknown as ReviewAgg)
    ?? { reviewed: 0, gate_rejected: 0, approved: 0, denied: 0, manual_rejected: 0 };
}

async function getFunnel(
  tx: TransactionSql,
  userId: string,
  state: DiscoveryStateRow,
): Promise<FunnelCounts> {
  // Batch the six independent aggregates through dbLimit — pipelined over this
  // transaction's single connection instead of six sequential round-trips — the same
  // pattern getPipelineHealth uses. reviewAgg / verdicts / stats keep their
  // executor-taking helpers so the viewer-pool scoping SQL stays in lockstep with
  // reviewStatsWith (lib/queries.ts). dbLimit collapses the heterogeneous task types to
  // a union, so the tuple assertion restores the positional shape the destructure needs.
  const [companyAggRows, jobAggRows, rv, appliedAggRows, verdicts, stats] = await dbLimit<unknown>([
    () => tx`
      SELECT count(*)::int AS tracked,
             count(*) FILTER (WHERE c.active)::int AS active,
             count(*) FILTER (WHERE c.discovery_source <> 'manual')::int AS discovery_sourced,
             count(*) FILTER (WHERE c.discovery_source <> 'manual' AND cr.company_id IS NOT NULL)::int AS reviewed
      FROM companies c
      LEFT JOIN company_reviews cr ON cr.company_id = c.id AND cr.user_id = ${userId}::uuid
    `,
    () => tx`
      SELECT count(*)::int AS ever_seen,
             count(*) FILTER (WHERE closed_at IS NULL)::int AS open,
             count(*) FILTER (WHERE closed_at IS NOT NULL)::int AS closed
      FROM jobs
    `,
    () => reviewAggWith(tx, userId),
    () => tx`
      SELECT count(*)::int AS applied
      FROM application_packages
      WHERE user_id = ${userId}::uuid AND status = 'applied'
    `,
    () => companyVerdictCountsWith(tx, userId),
    () => reviewStatsWith(tx, userId),
  ]) as unknown as [
    Record<string, unknown>[],
    Record<string, unknown>[],
    ReviewAgg,
    Record<string, unknown>[],
    { include: number; exclude: number; unknown: number },
    ReviewStats,
  ];

  const c = companyAggRows[0] as unknown as { tracked: number; active: number; discovery_sourced: number; reviewed: number };
  const j = jobAggRows[0] as unknown as { ever_seen: number; open: number; closed: number };
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

async function getPipelineHealth(
  tx: TransactionSql,
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
    () => tx`SELECT * FROM poll_runs ORDER BY started_at DESC LIMIT 1`,
    () => tx`SELECT * FROM review_runs ORDER BY started_at DESC LIMIT 1`,
    () => tx`SELECT * FROM discovery_runs ORDER BY started_at DESC LIMIT 1`,
    () => tx`SELECT * FROM poll_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1`,
    () => tx`SELECT * FROM review_runs WHERE finished_at IS NOT NULL AND reviewed > 0 ORDER BY started_at DESC LIMIT 1`,
    () => tx`SELECT * FROM discovery_runs WHERE finished_at IS NOT NULL AND (ingested > 0 OR reviewed > 0) ORDER BY started_at DESC LIMIT 1`,
    () => tx`
      SELECT count(*)::int                            AS runs,
             COALESCE(sum(new_jobs), 0)::int          AS new_jobs,
             COALESCE(sum(closed_jobs), 0)::int       AS closed_jobs,
             COALESCE(sum(companies_ok), 0)::int      AS companies_ok,
             COALESCE(sum(companies_failed), 0)::int  AS companies_failed
      FROM poll_runs
    `,
    () => tx`
      SELECT count(*)::int                          AS runs,
             COALESCE(sum(reviewed), 0)::int        AS reviewed,
             COALESCE(sum(gate_rejected), 0)::int   AS gate_rejected,
             COALESCE(sum(approved), 0)::int        AS approved,
             COALESCE(sum(denied), 0)::int          AS denied,
             COALESCE(sum(errors), 0)::int          AS errors
      FROM review_runs
    `,
    () => tx`
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
  jobsByCompany: Bar[]; jobsByAts: Bar[]; jobLifespan: Bar[];
  fitScore: Bar[]; approvalsByIndustry: Bar[]; approvalsByRole: Bar[];
  approvalsBySeniority: Bar[]; experienceMatch: Bar[]; workArrangement: Bar[];
  companiesByAts: Bar[]; companiesBySource: Bar[]; includedByIndustry: Bar[];
  topTechTags: Bar[]; topRedFlags: Bar[]; otherRedFlags: Bar[];
}

const asBars = (rows: unknown) => rows as unknown as Bar[];

async function getDistributions(tx: TransactionSql, userId: string): Promise<Distributions> {
  const [
    jobsByLocation, jobsByDepartment, jobsRemote, jobsByCompany, jobsByAts, jobLifespan,
    fitScore, approvalsByIndustry, approvalsByRole, approvalsBySeniority,
    experienceMatch, workArrangement,
    companiesByAts, companiesBySource, includedByIndustry, topTechTags, topRedFlags,
    otherRedFlags,
  ] = await dbLimit([
    () => tx`SELECT location AS label, count FROM (
        SELECT loc AS location, count(*)::int AS count
        FROM jobs j
        CROSS JOIN LATERAL unnest(COALESCE(j.location_canonicals, ARRAY[j.location])) AS loc
        WHERE j.closed_at IS NULL AND loc IS NOT NULL AND loc <> '' AND loc <> 'Remote'
        GROUP BY loc
        UNION ALL
        SELECT 'Remote', count(*)::int FROM jobs
        WHERE closed_at IS NULL AND remote IS TRUE
        HAVING count(*) > 0
      ) t ORDER BY count DESC LIMIT ${TOP_N}`,
    () => tx`SELECT department AS label, count(*)::int AS count FROM jobs
        WHERE closed_at IS NULL AND department IS NOT NULL AND department <> ''
        GROUP BY department ORDER BY count DESC LIMIT ${TOP_N}`,
    () => tx`SELECT CASE WHEN remote THEN 'Remote' ELSE 'On-site / hybrid' END AS label, count(*)::int AS count
        FROM jobs WHERE closed_at IS NULL GROUP BY 1 ORDER BY count DESC`,
    () => tx`SELECT COALESCE(c.display_name, c.name) AS label, count(*)::int AS count
        FROM jobs j JOIN companies c ON c.id = j.company_id
        WHERE j.closed_at IS NULL GROUP BY COALESCE(c.display_name, c.name) ORDER BY count DESC LIMIT ${TOP_N}`,
    () => tx`SELECT c.ats AS label, count(*)::int AS count
        FROM jobs j JOIN companies c ON c.id = j.company_id
        WHERE j.closed_at IS NULL GROUP BY c.ats ORDER BY count DESC`,
    () => tx`SELECT CASE
               WHEN d < 1 THEN '<1d' WHEN d < 3 THEN '1-3d' WHEN d < 7 THEN '3-7d'
               WHEN d < 14 THEN '1-2w' WHEN d < 30 THEN '2-4w' WHEN d < 60 THEN '1-2mo'
               ELSE '2mo+' END AS label,
               count(*)::int AS count
        FROM (SELECT EXTRACT(EPOCH FROM (closed_at - first_seen_at)) / 86400 AS d
              FROM jobs WHERE closed_at IS NOT NULL) s
        GROUP BY label
        ORDER BY min(d)`,
    () => tx`SELECT ((fit_score / 10) * 10)::text || '-' || ((fit_score / 10) * 10 + 9)::text AS label,
               count(*)::int AS count
        FROM job_reviews
        WHERE user_id = ${userId}::uuid AND fit_score IS NOT NULL
        GROUP BY (fit_score / 10) ORDER BY (fit_score / 10)`,
    () => tx`SELECT industry AS label, count(*)::int AS count FROM job_reviews
        WHERE user_id = ${userId}::uuid AND verdict = 'approve' AND industry IS NOT NULL
        GROUP BY industry ORDER BY count DESC LIMIT ${TOP_N}`,
    () => tx`SELECT role_category AS label, count(*)::int AS count FROM job_reviews
        WHERE user_id = ${userId}::uuid AND verdict = 'approve' AND role_category IS NOT NULL
        GROUP BY role_category ORDER BY count DESC LIMIT ${TOP_N}`,
    () => tx`SELECT seniority AS label, count(*)::int AS count FROM job_reviews
        WHERE user_id = ${userId}::uuid AND verdict = 'approve' AND seniority IS NOT NULL
        GROUP BY seniority ORDER BY count DESC`,
    () => tx`SELECT experience_match AS label, count(*)::int AS count FROM job_reviews
        WHERE user_id = ${userId}::uuid AND experience_match IS NOT NULL
        GROUP BY experience_match ORDER BY count DESC`,
    () => tx`SELECT work_arrangement AS label, count(*)::int AS count FROM job_reviews
        WHERE user_id = ${userId}::uuid AND work_arrangement IS NOT NULL
        GROUP BY work_arrangement ORDER BY count DESC`,
    () => tx`SELECT ats AS label, count(*)::int AS count FROM companies GROUP BY ats ORDER BY count DESC`,
    () => tx`SELECT discovery_source AS label, count(*)::int AS count FROM companies
        GROUP BY discovery_source ORDER BY count DESC`,
    // Effective verdict (honors manual override), matching companyVerdictCountsWith
    // so this breakdown and the funnel's "Included" count agree. (Legacy company_reviews
    // read — the analytics funnel keeps using it until the post-rollout cleanup migration.)
    () => tx`SELECT industry AS label, count(*)::int AS count FROM company_reviews
        WHERE user_id = ${userId}::uuid
          AND (CASE WHEN human_override THEN override_verdict ELSE verdict END) = 'include'
          AND industry IS NOT NULL
        GROUP BY industry ORDER BY count DESC LIMIT ${TOP_N}`,
    () => tx`SELECT t AS label, count(*)::int AS count
        FROM company_reviews cr, jsonb_array_elements_text(cr.tech_tags) AS t
        WHERE cr.user_id = ${userId}::uuid
        GROUP BY t ORDER BY count DESC LIMIT ${TOP_N}`,
    () => tx`SELECT CASE WHEN jsonb_typeof(f) = 'object' THEN f->>'category' ELSE 'other' END AS label,
               count(*)::int AS count
        FROM company_reviews cr, jsonb_array_elements(cr.red_flags) AS f
        WHERE cr.user_id = ${userId}::uuid
        GROUP BY 1 ORDER BY count DESC LIMIT ${TOP_N}`,
    () => tx`SELECT COALESCE(f->>'note', '(no note)') AS label, count(*)::int AS count
        FROM company_reviews cr, jsonb_array_elements(cr.red_flags) AS f
        WHERE cr.user_id = ${userId}::uuid
          AND jsonb_typeof(f) = 'object' AND f->>'category' = 'other'
        GROUP BY 1 ORDER BY count DESC LIMIT ${TOP_N}`,
  ]);

  return {
    jobsByLocation: asBars(jobsByLocation), jobsByDepartment: asBars(jobsByDepartment),
    jobsRemote: asBars(jobsRemote), jobsByCompany: asBars(jobsByCompany),
    jobsByAts: asBars(jobsByAts), jobLifespan: asBars(jobLifespan),
    fitScore: asBars(fitScore), approvalsByIndustry: asBars(approvalsByIndustry),
    approvalsByRole: asBars(approvalsByRole), approvalsBySeniority: asBars(approvalsBySeniority),
    experienceMatch: asBars(experienceMatch), workArrangement: asBars(workArrangement),
    companiesByAts: asBars(companiesByAts), companiesBySource: asBars(companiesBySource),
    includedByIndustry: asBars(includedByIndustry), topTechTags: asBars(topTechTags),
    topRedFlags: asBars(topRedFlags), otherRedFlags: asBars(otherRedFlags),
  };
}

export interface PipelineSnapshot {
  funnel: FunnelCounts;
  health: PipelineHealth;
  distributions: Distributions;
}

export function getPipelineSnapshot(userId: string): Promise<PipelineSnapshot> {
  // One transaction (one connection) for the whole snapshot under the viewer's
  // authenticated RLS context. Discovery state (a correlated company-backlog count)
  // is read once and shared by the funnel and the pipeline health.
  return withUserSql(userId, async (tx) => {
    const state = await discoveryStateWith(tx, userId);
    const funnel = await getFunnel(tx, userId, state);
    const health = await getPipelineHealth(tx, userId, state);
    const distributions = await getDistributions(tx, userId);
    return { funnel, health, distributions };
  });
}
