import { sql } from "@/lib/db";
import {
  getCompanyVerdictCounts, getReviewStats, getDiscoveryState,
  getLatestPollRun, getLatestReviewRun,
} from "@/lib/queries";
import type { PollRunRow, ReviewRunRow, DiscoveryRunRow, DiscoveryStateRow } from "@/lib/types";

// ── Pure trend helpers (DB-free; unit-tested in metrics.test.ts) ──────────────

// Permissive row shape for tests; the helpers below are generic and keep the
// caller's concrete type (e.g. PollDay), so numeric fields stay typed `number`.
export type Point = { day: string; [metric: string]: number | string };

const DAY_MS = 86_400_000;

/** UTC date portion (YYYY-MM-DD) of an ISO timestamp or date string. */
function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/** Monday (UTC) of the ISO week containing `dayISO`, as YYYY-MM-DD. */
export function weekStart(dayISO: string): string {
  const d = new Date(dayOf(dayISO) + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const deltaToMonday = (dow + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - deltaToMonday);
  return d.toISOString().slice(0, 10);
}

/** Dense ascending series of `days` points ending on nowISO's UTC date. */
export function fillDays<T extends { day: string }>(
  rows: T[], days: number, nowISO: string, numericKeys: (keyof T)[],
): T[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const end = new Date(dayOf(nowISO) + "T00:00:00Z").getTime();
  const out: T[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(end - i * DAY_MS).toISOString().slice(0, 10);
    const existing = byDay.get(day);
    if (existing) {
      out.push(existing);
    } else {
      const zero = { day } as T;
      for (const k of numericKeys) (zero as Record<string, unknown>)[k as string] = 0;
      out.push(zero);
    }
  }
  return out;
}

/** Re-aggregate daily points into ISO-week points. */
export function toWeekly<T extends { day: string }>(
  rows: T[], sumKeys: (keyof T)[], lastKeys: (keyof T)[],
): T[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const wk = weekStart(r.day);
    const g = groups.get(wk);
    if (g) g.push(r);
    else groups.set(wk, [r]);
  }
  const out: T[] = [];
  for (const [wk, members] of groups) {
    const sorted = [...members].sort((a, b) => (a.day < b.day ? -1 : 1));
    const acc = { day: wk } as T;
    for (const k of sumKeys) {
      (acc as Record<string, unknown>)[k as string] =
        sorted.reduce((s, m) => s + ((m[k] as unknown as number) ?? 0), 0);
    }
    for (const k of lastKeys) {
      (acc as Record<string, unknown>)[k as string] = (sorted[sorted.length - 1][k] as unknown as number) ?? 0;
    }
    out.push(acc);
  }
  out.sort((a, b) => (a.day < b.day ? -1 : 1));
  return out;
}

/** Keep points whose day is within the last `days` of nowISO's UTC date. */
export function sliceWindow<T extends { day: string }>(rows: T[], days: number, nowISO: string): T[] {
  const end = new Date(dayOf(nowISO) + "T00:00:00Z").getTime();
  const cutoff = end - (days - 1) * DAY_MS;
  return rows.filter((r) => new Date(r.day + "T00:00:00Z").getTime() >= cutoff);
}

/** Safe division: null (not NaN) when the denominator is zero. */
export function rate(numer: number, denom: number): number | null {
  return denom === 0 ? null : numer / denom;
}

// ── Run series: 90-day daily aggregates per pipeline ─────────────────────────

export interface PollDay {
  day: string; new_jobs: number; closed_jobs: number;
  companies_ok: number; companies_failed: number;
  run_count: number; total_duration_seconds: number;
}
export interface ReviewDay {
  day: string; reviewed: number; gate_rejected: number;
  approved: number; denied: number; errors: number;
  run_count: number; total_duration_seconds: number;
}
export interface DiscoveryDay {
  day: string; ingested: number; reviewed: number;
  included: number; excluded: number; unknown: number; errors: number;
  run_count: number; total_duration_seconds: number;
  last_backlog: number; halt_count: number;
}
export interface RunSeries { poll: PollDay[]; review: ReviewDay[]; discovery: DiscoveryDay[] }

export async function getRunSeries(): Promise<RunSeries> {
  const [poll, review, discovery] = await Promise.all([
    sql`
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
    sql`
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
    sql`
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
    poll: poll as unknown as PollDay[],
    review: review as unknown as ReviewDay[],
    discovery: discovery as unknown as DiscoveryDay[],
  };
}

// ── Funnel snapshot + latest runs ────────────────────────────────────────────

export interface CompanyFunnel {
  tracked: number; active: number; discovery_sourced: number; reviewed: number;
  include: number; exclude: number; unknown: number; backlog: number;
}
export interface JobFunnel {
  ever_seen: number; open: number; closed: number; reviewed: number;
  gate_rejected: number; approved: number; denied: number;
  manual_rejected: number; unreviewed: number; errors: number;
}
export interface FunnelCounts { companies: CompanyFunnel; jobs: JobFunnel }

export async function getFunnel(userId: string): Promise<FunnelCounts> {
  const [companyAggRows, jobAggRows, reviewAggRows, verdicts, stats, state] = await Promise.all([
    sql`
      SELECT count(*)::int AS tracked,
             count(*) FILTER (WHERE c.active)::int AS active,
             count(*) FILTER (WHERE c.discovery_source <> 'manual')::int AS discovery_sourced,
             count(*) FILTER (WHERE c.discovery_source <> 'manual' AND cr.company_id IS NOT NULL)::int AS reviewed
      FROM companies c
      LEFT JOIN company_reviews cr ON cr.company_id = c.id AND cr.user_id = ${userId}::uuid
    `,
    sql`
      SELECT count(*)::int AS ever_seen,
             count(*) FILTER (WHERE closed_at IS NULL)::int AS open,
             count(*) FILTER (WHERE closed_at IS NOT NULL)::int AS closed
      FROM jobs
    `,
    sql`
      SELECT count(*) FILTER (WHERE r.job_id IS NOT NULL)::int AS reviewed,
             count(*) FILTER (WHERE r.stage1_decision = 'reject')::int AS gate_rejected,
             count(*) FILTER (WHERE r.verdict = 'approve')::int AS approved,
             count(*) FILTER (WHERE r.verdict = 'deny')::int AS denied,
             count(*) FILTER (WHERE r.verdict = 'deny' AND r.human_override)::int AS manual_rejected
      FROM jobs j
      LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = ${userId}::uuid
      WHERE j.closed_at IS NULL
    `,
    getCompanyVerdictCounts(userId),
    getReviewStats(userId),
    getDiscoveryState(userId),
  ]);

  const c = companyAggRows[0] as unknown as { tracked: number; active: number; discovery_sourced: number; reviewed: number };
  const j = jobAggRows[0] as unknown as { ever_seen: number; open: number; closed: number };
  const rv = reviewAggRows[0] as unknown as { reviewed: number; gate_rejected: number; approved: number; denied: number; manual_rejected: number };

  return {
    companies: {
      tracked: c.tracked, active: c.active, discovery_sourced: c.discovery_sourced, reviewed: c.reviewed,
      include: verdicts.include, exclude: verdicts.exclude, unknown: verdicts.unknown,
      backlog: state.backlog,
    },
    jobs: {
      ever_seen: j.ever_seen, open: j.open, closed: j.closed,
      reviewed: rv.reviewed, gate_rejected: rv.gate_rejected,
      approved: rv.approved, denied: rv.denied, manual_rejected: rv.manual_rejected,
      unreviewed: stats.unreviewed, errors: stats.errors,
    },
  };
}

export interface LatestRuns {
  poll: PollRunRow | null;
  review: ReviewRunRow | null;
  discovery: DiscoveryRunRow | null;
  discoveryState: DiscoveryStateRow;
}

export async function getLatestRuns(userId: string): Promise<LatestRuns> {
  const [poll, review, discoveryRows, discoveryState] = await Promise.all([
    getLatestPollRun(),
    getLatestReviewRun(),
    sql`SELECT * FROM discovery_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1`,
    getDiscoveryState(userId),
  ]);
  return {
    poll,
    review,
    discovery: (discoveryRows[0] as unknown as DiscoveryRunRow) ?? null,
    discoveryState,
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
  ] = await Promise.all([
    sql`SELECT location AS label, count(*)::int AS count FROM jobs
        WHERE closed_at IS NULL AND location IS NOT NULL AND location <> ''
        GROUP BY location ORDER BY count DESC LIMIT ${TOP_N}`,
    sql`SELECT department AS label, count(*)::int AS count FROM jobs
        WHERE closed_at IS NULL AND department IS NOT NULL AND department <> ''
        GROUP BY department ORDER BY count DESC LIMIT ${TOP_N}`,
    sql`SELECT CASE WHEN remote THEN 'Remote' ELSE 'On-site / hybrid' END AS label, count(*)::int AS count
        FROM jobs WHERE closed_at IS NULL GROUP BY 1 ORDER BY count DESC`,
    sql`SELECT c.name AS label, count(*)::int AS count
        FROM jobs j JOIN companies c ON c.id = j.company_id
        WHERE j.closed_at IS NULL GROUP BY c.name ORDER BY count DESC LIMIT ${TOP_N}`,
    sql`SELECT CASE
               WHEN d < 1 THEN '<1d' WHEN d < 3 THEN '1-3d' WHEN d < 7 THEN '3-7d'
               WHEN d < 14 THEN '1-2w' WHEN d < 30 THEN '2-4w' WHEN d < 60 THEN '1-2mo'
               ELSE '2mo+' END AS label,
               count(*)::int AS count
        FROM (SELECT EXTRACT(EPOCH FROM (closed_at - first_seen_at)) / 86400 AS d
              FROM jobs WHERE closed_at IS NOT NULL) s
        GROUP BY label
        ORDER BY min(d)`,
    sql`SELECT ((fit_score / 10) * 10)::text || '-' || ((fit_score / 10) * 10 + 9)::text AS label,
               count(*)::int AS count
        FROM job_reviews
        WHERE user_id = ${userId}::uuid AND fit_score IS NOT NULL
        GROUP BY (fit_score / 10) ORDER BY (fit_score / 10)`,
    sql`SELECT industry AS label, count(*)::int AS count FROM job_reviews
        WHERE user_id = ${userId}::uuid AND verdict = 'approve' AND industry IS NOT NULL
        GROUP BY industry ORDER BY count DESC LIMIT ${TOP_N}`,
    sql`SELECT role_category AS label, count(*)::int AS count FROM job_reviews
        WHERE user_id = ${userId}::uuid AND verdict = 'approve' AND role_category IS NOT NULL
        GROUP BY role_category ORDER BY count DESC LIMIT ${TOP_N}`,
    sql`SELECT seniority AS label, count(*)::int AS count FROM job_reviews
        WHERE user_id = ${userId}::uuid AND verdict = 'approve' AND seniority IS NOT NULL
        GROUP BY seniority ORDER BY count DESC`,
    sql`SELECT experience_match AS label, count(*)::int AS count FROM job_reviews
        WHERE user_id = ${userId}::uuid AND experience_match IS NOT NULL
        GROUP BY experience_match ORDER BY count DESC`,
    sql`SELECT work_arrangement AS label, count(*)::int AS count FROM job_reviews
        WHERE user_id = ${userId}::uuid AND work_arrangement IS NOT NULL
        GROUP BY work_arrangement ORDER BY count DESC`,
    sql`SELECT ats AS label, count(*)::int AS count FROM companies GROUP BY ats ORDER BY count DESC`,
    sql`SELECT discovery_source AS label, count(*)::int AS count FROM companies
        GROUP BY discovery_source ORDER BY count DESC`,
    sql`SELECT industry AS label, count(*)::int AS count FROM company_reviews
        WHERE user_id = ${userId}::uuid AND verdict = 'include' AND industry IS NOT NULL
        GROUP BY industry ORDER BY count DESC LIMIT ${TOP_N}`,
    sql`SELECT t AS label, count(*)::int AS count
        FROM company_reviews cr, jsonb_array_elements_text(cr.tech_tags) AS t
        WHERE cr.user_id = ${userId}::uuid
        GROUP BY t ORDER BY count DESC LIMIT ${TOP_N}`,
    sql`SELECT f AS label, count(*)::int AS count
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
  latest: LatestRuns;
  distributions: Distributions;
}

export async function getPipelineSnapshot(userId: string): Promise<PipelineSnapshot> {
  const [funnel, latest, distributions] = await Promise.all([
    getFunnel(userId), getLatestRuns(userId), getDistributions(userId),
  ]);
  return { funnel, latest, distributions };
}
