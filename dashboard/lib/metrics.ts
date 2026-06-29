import { sql } from "@/lib/db";

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
