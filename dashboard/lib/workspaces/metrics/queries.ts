// The metric queries (plan Task 1.12). runMetric validates the spec against the closed
// catalog, then runs one fixed, parameterized query under the caller's RLS context
// (withUserSql, plus an explicit user_id predicate). Every result carries `n`, the
// sample behind it.
//
// Windows count back from the database's now(): these are the user's own actions,
// which happen in real time even while discovery is frozen. stale_applications is the
// one age judgement and uses the catalog clock (catalogNow), never the wall clock.
// Weeks are date_trunc('week') in the database's time zone (UTC on Supabase), labelled
// by their Monday as YYYY-MM-DD.
import { z } from "zod";
import type { TransactionSql } from "postgres";
import { withUserSql } from "@/lib/db";
import { catalogNow } from "@/lib/catalogClock";
import { parseOrNull } from "@/lib/zodParse";
import {
  METRIC_CATALOG,
  MetricSpecSchema,
  RESPONSE_RATE_MIN_N,
  STAGES,
  STALE_AFTER_DAYS,
  WINDOW_DAYS,
} from "@/lib/workspaces/metrics/catalog";
import type { MetricResult, MetricSpec } from "@/lib/workspaces/types";

/** The spec does not fit the catalog. */
export class MetricSpecError extends Error {
  constructor() {
    super("That metric request is not in the catalog.");
    this.name = "MetricSpecError";
  }
}

const count = z.coerce.number().int().min(0);
const decimal = z.coerce.number();

function rowsOf<T>(schema: z.ZodType<T>, rows: Iterable<unknown>, what: string): T[] {
  const out: T[] = [];
  for (const raw of rows) {
    const r = parseOrNull(schema, raw);
    if (r === null) throw new Error(`metrics: ${what} row failed the parse`);
    out.push(r);
  }
  return out;
}

/** A result without its spec, kept as a union over the three kinds. */
type MetricBody = MetricResult extends infer R ? (R extends unknown ? Omit<R, "spec"> : never) : never;

type Ctx = { tx: TransactionSql; userId: string; days: number | null; stages: string[] | null };

const STAGE_ARRAY = [...STAGES];

async function applicationsByStage({ tx, userId, days, stages }: Ctx) {
  const rows = await tx`
    SELECT s.stage, count(a.id) AS n
    FROM unnest(${STAGE_ARRAY}::text[]) WITH ORDINALITY AS s(stage, ord)
    LEFT JOIN applications a ON a.stage = s.stage AND a.user_id = ${userId}::uuid
      AND (${days}::int IS NULL OR a.created_at >= now() - make_interval(days => ${days}::int))
    WHERE (${stages}::text[] IS NULL OR s.stage = ANY(${stages}::text[]))
    GROUP BY s.stage, s.ord
    ORDER BY s.ord`;
  const parsed = rowsOf(z.object({ stage: z.string(), n: count }), rows, "applications_by_stage");
  return {
    kind: "rows" as const,
    columns: ["stage", "count"],
    rows: parsed.map((r) => [r.stage, r.n]),
    n: parsed.reduce((a, r) => a + r.n, 0),
  };
}

async function applicationsOverTime({ tx, userId, days }: Ctx) {
  const rows = await tx`
    WITH ev AS (
      SELECT date_trunc('week', e.created_at) AS wk
      FROM application_events e
      WHERE e.user_id = ${userId}::uuid AND e.kind = 'stage' AND e.to_stage = 'applied'
        AND (${days}::int IS NULL OR e.created_at >= now() - make_interval(days => ${days}::int))
    ), bounds AS (
      SELECT date_trunc('week', COALESCE(now() - make_interval(days => ${days}::int), (SELECT min(wk) FROM ev), now())) AS lo,
             date_trunc('week', now()) AS hi
    )
    SELECT to_char(g.wk, 'YYYY-MM-DD') AS x, count(ev.wk) AS y
    FROM bounds CROSS JOIN generate_series(bounds.lo, bounds.hi, interval '1 week') AS g(wk)
    LEFT JOIN ev ON ev.wk = g.wk
    GROUP BY g.wk
    ORDER BY g.wk`;
  const points = rowsOf(z.object({ x: z.string(), y: count }), rows, "applications_over_time");
  return { kind: "series" as const, points, n: points.reduce((a, p) => a + p.y, 0) };
}

async function responseRate({ tx, userId, days }: Ctx) {
  const rows = await tx`
    WITH applied AS (
      SELECT DISTINCT a.id, a.stage, a.closed_reason
      FROM applications a
      JOIN application_events e ON e.application_id = a.id AND e.kind = 'stage' AND e.to_stage = 'applied'
      WHERE a.user_id = ${userId}::uuid
        AND (${days}::int IS NULL OR e.created_at >= now() - make_interval(days => ${days}::int))
    )
    SELECT count(*) AS n,
           count(*) FILTER (WHERE stage IN ('interviewing', 'offer')
             OR (stage = 'closed' AND closed_reason = 'rejected')
             OR EXISTS (SELECT 1 FROM application_events x
                        WHERE x.application_id = applied.id AND x.kind = 'stage'
                          AND x.to_stage IN ('interviewing', 'offer'))) AS responded
    FROM applied`;
  const [r] = rowsOf(z.object({ n: count, responded: count }), rows, "response_rate");
  const n = r?.n ?? 0;
  const value = n < RESPONSE_RATE_MIN_N ? null : Math.round((r.responded / n) * 1000) / 1000;
  return { kind: "value" as const, value, n };
}

async function timeInStage({ tx, userId, days, stages }: Ctx) {
  const rows = await tx`
    WITH ev AS (
      SELECT e.to_stage AS stage, e.created_at AS entered,
             lead(e.created_at) OVER (PARTITION BY e.application_id ORDER BY e.created_at, e.id) AS left_at
      FROM application_events e
      WHERE e.user_id = ${userId}::uuid AND e.kind = 'stage'
    )
    SELECT stage,
           round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM left_at - entered)) / 86400)::numeric, 1)
             AS median_days,
           count(*) AS n
    FROM ev
    WHERE left_at IS NOT NULL
      AND (${days}::int IS NULL OR left_at >= now() - make_interval(days => ${days}::int))
      AND (${stages}::text[] IS NULL OR stage = ANY(${stages}::text[]))
    GROUP BY stage
    ORDER BY array_position(${STAGE_ARRAY}::text[], stage)`;
  const parsed = rowsOf(z.object({ stage: z.string(), median_days: decimal, n: count }), rows, "time_in_stage");
  return {
    kind: "rows" as const,
    columns: ["stage", "median_days", "moves"],
    rows: parsed.map((r) => [r.stage, r.median_days, r.n]),
    n: parsed.reduce((a, r) => a + r.n, 0),
  };
}

async function shortlistFunnel({ tx, userId, days }: Ctx) {
  const rows = await tx`
    WITH s AS (
      SELECT s.state, a.stage,
             EXISTS (SELECT 1 FROM application_events e WHERE e.application_id = a.id AND e.kind = 'stage'
                     AND e.to_stage = 'applied') AS was_applied,
             EXISTS (SELECT 1 FROM application_events e WHERE e.application_id = a.id AND e.kind = 'stage'
                     AND e.to_stage IN ('interviewing', 'offer')) AS was_interviewing,
             EXISTS (SELECT 1 FROM application_events e WHERE e.application_id = a.id AND e.kind = 'stage'
                     AND e.to_stage = 'offer') AS was_offer
      FROM shortlist_items s
      LEFT JOIN applications a ON a.user_id = s.user_id AND a.job_id = s.job_id
      WHERE s.user_id = ${userId}::uuid
        AND (${days}::int IS NULL OR s.created_at >= now() - make_interval(days => ${days}::int))
    )
    SELECT count(*) AS in_shortlist,
           count(*) FILTER (WHERE state IN ('shortlisted', 'later') OR stage IS NOT NULL) AS kept,
           count(*) FILTER (WHERE was_applied OR stage IN ('applied', 'interviewing', 'offer')) AS applied,
           count(*) FILTER (WHERE was_interviewing OR stage IN ('interviewing', 'offer')) AS interviewing,
           count(*) FILTER (WHERE was_offer OR stage = 'offer') AS offer
    FROM s`;
  const [r] = rowsOf(
    z.object({ in_shortlist: count, kept: count, applied: count, interviewing: count, offer: count }),
    rows,
    "shortlist_funnel",
  );
  return {
    kind: "rows" as const,
    columns: ["step", "count"],
    rows: [
      ["in_shortlist", r.in_shortlist],
      ["kept", r.kept],
      ["applied", r.applied],
      ["interviewing", r.interviewing],
      ["offer", r.offer],
    ],
    n: r.in_shortlist,
  };
}

async function skipReasons({ tx, userId, days }: Ctx) {
  const rows = await tx`
    SELECT reason_code AS reason, count(*) AS n
    FROM shortlist_items
    WHERE user_id = ${userId}::uuid AND state = 'skipped' AND reason_code IS NOT NULL
      AND (${days}::int IS NULL OR updated_at >= now() - make_interval(days => ${days}::int))
    GROUP BY reason_code
    ORDER BY count(*) DESC, reason_code`;
  const parsed = rowsOf(z.object({ reason: z.string(), n: count }), rows, "skip_reasons");
  return {
    kind: "rows" as const,
    columns: ["reason", "count"],
    rows: parsed.map((r) => [r.reason, r.n]),
    n: parsed.reduce((a, r) => a + r.n, 0),
  };
}

async function fitShortlistedVsApplied({ tx, userId, days }: Ctx) {
  const rows = await tx`
    SELECT 'shortlisted' AS grp, round(avg(COALESCE(rc.fit_score, r.fit_score))::numeric, 1) AS avg_fit,
           count(COALESCE(rc.fit_score, r.fit_score)) AS n
    FROM shortlist_items s
    LEFT JOIN job_reviews r ON r.user_id = s.user_id AND r.job_id = s.job_id
    LEFT JOIN review_corrections rc ON rc.user_id = s.user_id AND rc.job_id = s.job_id
    WHERE s.user_id = ${userId}::uuid AND s.state = 'shortlisted'
      AND (${days}::int IS NULL OR s.updated_at >= now() - make_interval(days => ${days}::int))
    UNION ALL
    SELECT 'applied', round(avg(COALESCE(rc.fit_score, r.fit_score))::numeric, 1),
           count(COALESCE(rc.fit_score, r.fit_score))
    FROM applications a
    LEFT JOIN job_reviews r ON r.user_id = a.user_id AND r.job_id = a.job_id
    LEFT JOIN review_corrections rc ON rc.user_id = a.user_id AND rc.job_id = a.job_id
    WHERE a.user_id = ${userId}::uuid
      AND (a.stage IN ('applied', 'interviewing', 'offer')
           OR EXISTS (SELECT 1 FROM application_events e WHERE e.application_id = a.id AND e.kind = 'stage'
                      AND e.to_stage = 'applied'))
      AND (${days}::int IS NULL OR a.created_at >= now() - make_interval(days => ${days}::int))`;
  const parsed = rowsOf(z.object({ grp: z.string(), avg_fit: decimal.nullable(), n: count }), rows, "fit");
  const present = parsed.filter((r) => r.n > 0 && r.avg_fit !== null);
  return {
    kind: "rows" as const,
    columns: ["group", "avg_fit", "jobs"],
    rows: present.map((r) => [r.grp, r.avg_fit ?? 0, r.n]),
    n: present.reduce((a, r) => a + r.n, 0),
  };
}

// Agent events (actor 'agent') are not the user's. The migration's backfilled "applied"
// events carry actor 'user' at the package's applied_at, the time the user marked it
// applied, and no column sets them apart, so they count as that user action.
async function weeklyActivity({ tx, userId, days }: Ctx) {
  const rows = await tx`
    WITH acts AS (
      SELECT date_trunc('week', e.created_at) AS wk FROM application_events e
      WHERE e.user_id = ${userId}::uuid AND e.actor = 'user'
        AND (${days}::int IS NULL OR e.created_at >= now() - make_interval(days => ${days}::int))
      UNION ALL
      SELECT date_trunc('week', s.updated_at) FROM shortlist_items s
      WHERE s.user_id = ${userId}::uuid AND s.set_by = 'user'
        AND (${days}::int IS NULL OR s.updated_at >= now() - make_interval(days => ${days}::int))
    ), bounds AS (
      SELECT date_trunc('week', COALESCE(now() - make_interval(days => ${days}::int), (SELECT min(wk) FROM acts), now())) AS lo,
             date_trunc('week', now()) AS hi
    )
    SELECT to_char(g.wk, 'YYYY-MM-DD') AS x, count(acts.wk) AS y
    FROM bounds CROSS JOIN generate_series(bounds.lo, bounds.hi, interval '1 week') AS g(wk)
    LEFT JOIN acts ON acts.wk = g.wk
    GROUP BY g.wk
    ORDER BY g.wk`;
  const points = rowsOf(z.object({ x: z.string(), y: count }), rows, "weekly_activity");
  return { kind: "series" as const, points, n: points.reduce((a, p) => a + p.y, 0) };
}

async function staleApplications({ tx, userId }: Ctx, now: Date) {
  const rows = await tx`
    SELECT count(*) AS n,
           count(*) FILTER (WHERE COALESCE(
             (SELECT max(e.created_at) FROM application_events e WHERE e.application_id = a.id), a.updated_at)
             <= ${now.toISOString()}::timestamptz - make_interval(days => ${STALE_AFTER_DAYS}::int)) AS stale
    FROM applications a
    WHERE a.user_id = ${userId}::uuid AND a.stage = 'applied'`;
  const [r] = rowsOf(z.object({ n: count, stale: count }), rows, "stale_applications");
  return { kind: "value" as const, value: r.stale, n: r.n };
}

// Version 0 is the old free-text instructions kept at the first memo save, not a change.
async function memoChanges({ tx, userId, days }: Ctx) {
  const rows = await tx`
    SELECT count(*) AS n FROM search_memo_versions
    WHERE user_id = ${userId}::uuid AND version > 0
      AND (${days}::int IS NULL OR created_at >= now() - make_interval(days => ${days}::int))`;
  const [r] = rowsOf(z.object({ n: count }), rows, "memo_changes");
  return { kind: "value" as const, value: r.n, n: r.n };
}

/**
 * Runs one catalog metric for the caller. Throws MetricSpecError before any SQL when the
 * spec is not one the catalog allows.
 */
export async function runMetric(userId: string, spec: MetricSpec): Promise<MetricResult> {
  const parsed = MetricSpecSchema.safeParse(spec);
  if (!parsed.success) throw new MetricSpecError();
  const s = parsed.data;
  const days = WINDOW_DAYS[s.window];
  const stages = METRIC_CATALOG[s.metric].stageFilter ? (s.filter?.stage ?? null) : null;
  const clock = s.metric === "stale_applications" ? await catalogNow() : null;
  const body = await withUserSql<MetricBody>(userId, (tx) => {
    const ctx: Ctx = { tx, userId, days, stages };
    switch (s.metric) {
      case "applications_by_stage":
        return applicationsByStage(ctx);
      case "applications_over_time":
        return applicationsOverTime(ctx);
      case "response_rate":
        return responseRate(ctx);
      case "time_in_stage":
        return timeInStage(ctx);
      case "shortlist_funnel":
        return shortlistFunnel(ctx);
      case "skip_reasons":
        return skipReasons(ctx);
      case "fit_shortlisted_vs_applied":
        return fitShortlistedVsApplied(ctx);
      case "weekly_activity":
        return weeklyActivity(ctx);
      case "stale_applications":
        return staleApplications(ctx, clock?.now ?? new Date());
      case "memo_changes":
        return memoChanges(ctx);
    }
  });
  return { spec: s, ...body };
}
