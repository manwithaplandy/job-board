# Analytics Pipeline Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an operator-only `/analytics` page that aggregates the discovery, poller, and reviewer pipelines into a funnel snapshot, latest-run health cards, interactive trend charts, and current-state breakdowns.

**Architecture:** A server component (`app/analytics/page.tsx`) gates on the existing auth helper, fetches a snapshot object + a 90-day daily-aggregated run series via a new `lib/metrics.ts` query module (same tagged-template `sql` pattern as `lib/queries.ts`), and hands both to a `"use client"` `PipelineDashboard`. The client owns the day/week × 30/90d toggles and re-buckets/derives in-memory using pure helpers in `lib/metrics.ts`. Charts render with Recharts inside client components only. No schema migration — every metric maps to existing columns.

**Tech Stack:** Next.js 15 App Router (React 19, server + client components), `postgres` (postgres.js, `prepare:false`), Recharts (new), Vitest, TypeScript, inline-styled React (Rolefit aesthetic, no Tailwind classes).

## Global Constraints

- **No schema migration.** Every metric derives from existing columns in `poll_runs`, `review_runs`, `discovery_runs`, `jobs`, `job_reviews`, `company_reviews`, `companies`, `discovery_state`.
- **Operator-only.** The page gates via `requireUserId()` from `@/lib/auth` (redirects to `/login` when anonymous). The single authenticated viewer is the owner; pass their id directly to owner-scoped queries.
- **All work happens in `dashboard/`.** Run every `npm`/`npx` command from the `dashboard/` directory. Import via the `@/` path alias (e.g. `@/lib/metrics`).
- **Test runner:** `npx vitest run <relative-path>` for a single file; `npm test` for all. Tests live alongside source (`lib/foo.ts` → `lib/foo.test.ts`).
- **Typecheck gate (non-test tasks):** `npx tsc --noEmit` from `dashboard/`. `next build` is NOT a valid gate here — it executes `lib/db.ts` which throws without `DATABASE_URL` (absent in worktrees).
- **Only `lib/metrics.ts` pure helpers are unit-tested.** SQL query functions and React components follow the repo convention of no unit tests; their gate is `npx tsc --noEmit` plus careful review. Keep all real logic in the tested helpers so components stay trivial.
- **Styling:** inline `style={{…}}` objects matching `components/companies/*` and `components/rolefit/*`. Palette: accent `#3b6fd4`, page bg `#f4f6fa`, card bg `#fff`, border `#e7eaf0`, muted text `#8a93a3`, heading `#161d29`.
- **Commits:** conventional-commit style (`feat(dashboard): …`, `test(dashboard): …`, `chore(dashboard): …`). Every commit message ends with the trailer line `Claude-Session: https://claude.ai/code/session_01F21hqrXZtymwbjft6iVHdC` (omitted from the example commands below for brevity — add it to each).

---

### Task 1: Generalize `computeHealth` + add `DiscoveryRunRow` type

Make the existing poll-only health function work for any pipeline run by replacing the poll-specific `companies_failed` field with a generic `failures` field, and add the missing discovery run-row type.

**Files:**
- Modify: `dashboard/lib/status.ts` (the `computeHealth` signature + body)
- Modify: `dashboard/lib/status.test.ts` (rename the field in existing cases)
- Modify: `dashboard/app/page.tsx:38-41` (the one existing call site)
- Modify: `dashboard/lib/types.ts` (add `DiscoveryRunRow`)

**Interfaces:**
- Produces: `computeHealth(run: { finished_at: string | null; failures: number | null } | null, now: Date, staleHours: number): Health`
- Produces: `interface DiscoveryRunRow { id: number; started_at: string; finished_at: string | null; status: string; ingested: number | null; reviewed: number | null; included: number | null; excluded: number | null; unknown: number | null; errors: number | null; backlog: number | null; notes: string | null }`

- [ ] **Step 1: Update the existing test to the generalized field**

Replace the `computeHealth` `describe` block in `dashboard/lib/status.test.ts` (keep the `isNew` block untouched):

```typescript
describe("computeHealth", () => {
  test("null run or no finished_at → stale", () => {
    expect(computeHealth(null, now, 12)).toBe("stale");
    expect(computeHealth({ finished_at: null, failures: 0 }, now, 12)).toBe("stale");
  });

  test("older than staleHours → stale", () => {
    expect(
      computeHealth({ finished_at: "2026-06-22T20:00:00Z", failures: 0 }, now, 12),
    ).toBe("stale"); // 16h old
  });

  test("recent with failures → warn", () => {
    expect(
      computeHealth({ finished_at: "2026-06-23T11:00:00Z", failures: 2 }, now, 12),
    ).toBe("warn");
  });

  test("recent and clean → ok", () => {
    expect(
      computeHealth({ finished_at: "2026-06-23T11:00:00Z", failures: 0 }, now, 12),
    ).toBe("ok");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd dashboard && npx vitest run lib/status.test.ts`
Expected: FAIL — `computeHealth` still expects `companies_failed`; the `failures` object is a type error / wrong field read.

- [ ] **Step 3: Generalize the implementation**

In `dashboard/lib/status.ts`, replace the `computeHealth` function (leave `Health`, `HOUR_MS`, and `isNew` as-is):

```typescript
export function computeHealth(
  run: { finished_at: string | null; failures: number | null } | null,
  now: Date,
  staleHours: number,
): Health {
  if (!run || !run.finished_at) return "stale";
  const ageHours = (now.getTime() - new Date(run.finished_at).getTime()) / HOUR_MS;
  if (ageHours > staleHours) return "stale";
  if ((run.failures ?? 0) > 0) return "warn";
  return "ok";
}
```

- [ ] **Step 4: Fix the existing call site**

In `dashboard/app/page.tsx`, the operator block currently calls `computeHealth(pollRun, …)`. Update it to map the poll-specific field:

```typescript
    operator = {
      health: computeHealth(
        pollRun ? { finished_at: pollRun.finished_at, failures: pollRun.companies_failed } : null,
        new Date(),
        STALE_HEALTH_HOURS,
      ),
      unreviewed: reviewStats.unreviewed,
    };
```

- [ ] **Step 5: Add the `DiscoveryRunRow` type**

Append to `dashboard/lib/types.ts` (after `ReviewRunRow`):

```typescript
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
```

- [ ] **Step 6: Run the test + typecheck to verify green**

Run: `cd dashboard && npx vitest run lib/status.test.ts && npx tsc --noEmit`
Expected: test PASS; `tsc` exits 0 (no type errors).

- [ ] **Step 7: Commit**

```bash
cd dashboard && git add lib/status.ts lib/status.test.ts app/page.tsx lib/types.ts
git commit -m "refactor(dashboard): generalize computeHealth to any run + add DiscoveryRunRow"
```

---

### Task 2: `lib/metrics.ts` — pure trend helpers (TDD)

Create the metrics module's pure, DB-free helpers: week bucketing, zero-fill, window slicing, and safe rate division. These hold all the trend logic; later components only call them.

**Files:**
- Create: `dashboard/lib/metrics.ts`
- Create: `dashboard/lib/metrics.test.ts`

**Interfaces:**
- Produces: `type Point = { day: string; [metric: string]: number | string }` (a permissive shape used only by the tests; the helpers are generic and preserve concrete row types)
- Produces: `weekStart(dayISO: string): string` — the Monday (UTC) of that day's ISO week, as `YYYY-MM-DD`
- Produces: `fillDays<T extends { day: string }>(rows: T[], days: number, nowISO: string, numericKeys: (keyof T)[]): T[]` — dense ascending series of exactly `days` daily points ending on `nowISO`'s UTC date, missing days zero-filled for `numericKeys`
- Produces: `toWeekly<T extends { day: string }>(rows: T[], sumKeys: (keyof T)[], lastKeys: (keyof T)[]): T[]` — re-aggregates daily points by ISO week; `sumKeys` summed, `lastKeys` take the latest in-week day's value; `day` becomes the week-start
- Produces: `sliceWindow<T extends { day: string }>(rows: T[], days: number, nowISO: string): T[]` — keeps points whose `day` is within the last `days` of `nowISO`'s UTC date
- Produces: `rate(numer: number, denom: number): number | null` — `denom === 0 ? null : numer / denom`
- Note: generics let the caller pass `PollDay[]`/`ReviewDay[]`/`DiscoveryDay[]` (Task 3) and get the same concrete type back, so component arithmetic on numeric fields needs no casts.

- [ ] **Step 1: Write the failing tests**

Create `dashboard/lib/metrics.test.ts`:

```typescript
import { describe, expect, test } from "vitest";
import { weekStart, fillDays, toWeekly, sliceWindow, rate, type Point } from "@/lib/metrics";

describe("weekStart", () => {
  test("returns the Monday of the ISO week (UTC)", () => {
    // 2026-06-24 is a Wednesday → Monday is 2026-06-22
    expect(weekStart("2026-06-24")).toBe("2026-06-22");
    // Monday maps to itself
    expect(weekStart("2026-06-22")).toBe("2026-06-22");
    // Sunday belongs to the same ISO week as the preceding Monday
    expect(weekStart("2026-06-28")).toBe("2026-06-22");
  });
});

describe("fillDays", () => {
  test("produces exactly `days` ascending points ending on now, zero-filling gaps", () => {
    const rows: Point[] = [{ day: "2026-06-26", n: 5 }];
    const out = fillDays(rows, 3, "2026-06-28T12:00:00Z", ["n"]);
    expect(out.map((p) => p.day)).toEqual(["2026-06-26", "2026-06-27", "2026-06-28"]);
    expect(out.map((p) => p.n)).toEqual([5, 0, 0]);
  });
});

describe("toWeekly", () => {
  test("sums sumKeys and takes the latest in-week value for lastKeys", () => {
    const rows: Point[] = [
      { day: "2026-06-22", added: 2, backlog: 100 }, // Mon
      { day: "2026-06-24", added: 3, backlog: 80 },  // Wed (later in week)
    ];
    const out = toWeekly(rows, ["added"], ["backlog"]);
    expect(out).toEqual([{ day: "2026-06-22", added: 5, backlog: 80 }]);
  });
});

describe("sliceWindow", () => {
  test("keeps only points within the last `days`", () => {
    const rows: Point[] = [
      { day: "2026-05-01", n: 1 },
      { day: "2026-06-27", n: 2 },
      { day: "2026-06-28", n: 3 },
    ];
    const out = sliceWindow(rows, 30, "2026-06-28T00:00:00Z");
    expect(out.map((p) => p.day)).toEqual(["2026-06-27", "2026-06-28"]);
  });
});

describe("rate", () => {
  test("divides, and returns null (not NaN) on zero denominator", () => {
    expect(rate(3, 4)).toBe(0.75);
    expect(rate(0, 0)).toBeNull();
    expect(rate(5, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dashboard && npx vitest run lib/metrics.test.ts`
Expected: FAIL — `@/lib/metrics` does not exist yet.

- [ ] **Step 3: Implement the helpers**

Create `dashboard/lib/metrics.ts`:

```typescript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd dashboard && npx vitest run lib/metrics.test.ts`
Expected: PASS (all 5 describe blocks green).

- [ ] **Step 5: Commit**

```bash
cd dashboard && git add lib/metrics.ts lib/metrics.test.ts
git commit -m "feat(dashboard): metrics trend helpers (week bucket, fill, slice, rate)"
```

---

### Task 3: `lib/metrics.ts` — `getRunSeries()` daily-aggregated queries

Add the three per-pipeline daily-aggregation queries that feed the trend charts. Each row carries summed counts plus `run_count`, `total_duration_seconds`, and (discovery only) `last_backlog` and `halt_count`, so the client can re-bucket to weekly and derive rates/latency/cadence.

**Files:**
- Modify: `dashboard/lib/metrics.ts` (append types + `getRunSeries`)

**Interfaces:**
- Consumes: `sql` from `@/lib/db`
- Produces:
  ```typescript
  interface PollDay { day: string; new_jobs: number; closed_jobs: number; companies_ok: number; companies_failed: number; run_count: number; total_duration_seconds: number }
  interface ReviewDay { day: string; reviewed: number; gate_rejected: number; approved: number; denied: number; errors: number; run_count: number; total_duration_seconds: number }
  interface DiscoveryDay { day: string; ingested: number; reviewed: number; included: number; excluded: number; unknown: number; errors: number; run_count: number; total_duration_seconds: number; last_backlog: number; halt_count: number }
  interface RunSeries { poll: PollDay[]; review: ReviewDay[]; discovery: DiscoveryDay[] }
  getRunSeries(): Promise<RunSeries>
  ```

- [ ] **Step 1: Append the series types and query**

Add to `dashboard/lib/metrics.ts` (below the helpers):

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: exits 0 (no type errors).

- [ ] **Step 3: Commit**

```bash
cd dashboard && git add lib/metrics.ts
git commit -m "feat(dashboard): getRunSeries 90-day daily aggregates per pipeline"
```

---

### Task 4: `lib/metrics.ts` — funnel + latest-run queries

Add the current-state funnel counts (companies + jobs) and the latest-run rows per pipeline, reusing existing `lib/queries.ts` helpers where they already encode the right logic.

**Files:**
- Modify: `dashboard/lib/metrics.ts` (append types + `getFunnel`, `getLatestRuns`)

**Interfaces:**
- Consumes: `sql` from `@/lib/db`; `getCompanyVerdictCounts`, `getReviewStats`, `getDiscoveryState`, `getLatestPollRun`, `getLatestReviewRun` from `@/lib/queries`; `PollRunRow`, `ReviewRunRow`, `DiscoveryRunRow`, `DiscoveryStateRow` from `@/lib/types`
- Produces:
  ```typescript
  interface CompanyFunnel { tracked: number; active: number; discovery_sourced: number; reviewed: number; include: number; exclude: number; unknown: number; backlog: number }
  interface JobFunnel { ever_seen: number; open: number; closed: number; reviewed: number; gate_rejected: number; approved: number; denied: number; manual_rejected: number; unreviewed: number; errors: number }
  interface FunnelCounts { companies: CompanyFunnel; jobs: JobFunnel }
  interface LatestRuns { poll: PollRunRow | null; review: ReviewRunRow | null; discovery: DiscoveryRunRow | null; discoveryState: DiscoveryStateRow }
  getFunnel(userId: string): Promise<FunnelCounts>
  getLatestRuns(userId: string): Promise<LatestRuns>
  ```

- [ ] **Step 1: Append imports, types, and the two queries**

At the top of `dashboard/lib/metrics.ts`, extend the import line and add the `@/lib/queries` import:

```typescript
import { sql } from "@/lib/db";
import {
  getCompanyVerdictCounts, getReviewStats, getDiscoveryState,
  getLatestPollRun, getLatestReviewRun,
} from "@/lib/queries";
import type { PollRunRow, ReviewRunRow, DiscoveryRunRow, DiscoveryStateRow } from "@/lib/types";
```

Append below `getRunSeries`:

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
cd dashboard && git add lib/metrics.ts
git commit -m "feat(dashboard): funnel counts + latest-run queries for analytics"
```

---

### Task 5: `lib/metrics.ts` — distribution queries + `getPipelineSnapshot` assembler

Add the Tier-2 current-state breakdowns (jobs / reviews / companies) and the top-level assembler the page calls.

**Files:**
- Modify: `dashboard/lib/metrics.ts` (append `Bar`, `Distributions`, `getDistributions`, `PipelineSnapshot`, `getPipelineSnapshot`)

**Interfaces:**
- Consumes: `getFunnel`, `getLatestRuns` (Task 4); `sql` from `@/lib/db`
- Produces:
  ```typescript
  interface Bar { label: string; count: number }
  interface Distributions {
    jobsByLocation: Bar[]; jobsByDepartment: Bar[]; jobsRemote: Bar[];
    jobsByCompany: Bar[]; jobLifespan: Bar[];
    fitScore: Bar[]; approvalsByIndustry: Bar[]; approvalsByRole: Bar[];
    approvalsBySeniority: Bar[]; experienceMatch: Bar[]; workArrangement: Bar[];
    companiesByAts: Bar[]; companiesBySource: Bar[]; includedByIndustry: Bar[];
    topTechTags: Bar[]; topRedFlags: Bar[];
  }
  interface PipelineSnapshot { funnel: FunnelCounts; latest: LatestRuns; distributions: Distributions }
  getDistributions(userId: string): Promise<Distributions>
  getPipelineSnapshot(userId: string): Promise<PipelineSnapshot>
  ```

- [ ] **Step 1: Append the distribution queries and assembler**

Append to `dashboard/lib/metrics.ts`:

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
cd dashboard && git add lib/metrics.ts
git commit -m "feat(dashboard): distribution breakdowns + getPipelineSnapshot assembler"
```

---

### Task 6: Add Recharts + shared `Chart.tsx` wrappers

Install Recharts and create thin, consistently-styled bar/line chart wrappers so the section components stay trivial.

**Files:**
- Modify: `dashboard/package.json` (add `recharts`)
- Create: `dashboard/components/analytics/Chart.tsx`

**Interfaces:**
- Produces:
  ```typescript
  interface SeriesDef { key: string; name: string; color: string }
  // Card<>title wrappers, each a "use client" Recharts component:
  BarsCard(props: { title: string; data: Array<Record<string, string | number>>; xKey: string; bars: SeriesDef[]; empty?: string }): JSX.Element
  LinesCard(props: { title: string; data: Array<Record<string, string | number | null>>; xKey: string; lines: SeriesDef[]; percent?: boolean; empty?: string }): JSX.Element
  SimpleBarCard(props: { title: string; data: Bar[]; color?: string; empty?: string }): JSX.Element  // single-series label/count (for breakdowns)
  ```

- [ ] **Step 1: Install Recharts**

Run: `cd dashboard && npm install recharts@^2.13.0`
Expected: `package.json` gains `"recharts"` under dependencies; `package-lock.json` updates.

- [ ] **Step 2: Create the chart wrappers**

Create `dashboard/components/analytics/Chart.tsx`:

```tsx
"use client";

import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import type { Bar as BarDatum } from "@/lib/metrics";

export interface SeriesDef { key: string; name: string; color: string }

const CARD: React.CSSProperties = {
  background: "#fff", border: "1px solid #e7eaf0", borderRadius: "14px",
  padding: "16px 18px 8px", marginBottom: "16px",
};
const TITLE: React.CSSProperties = {
  fontSize: "13.5px", fontWeight: 800, color: "#161d29", marginBottom: "12px", letterSpacing: "-.2px",
};
const EMPTY: React.CSSProperties = { fontSize: "12.5px", color: "#9aa3b0", padding: "28px 0" };
const AXIS = { fontSize: 11, fill: "#8a93a3" } as const;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={CARD}><div style={TITLE}>{title}</div>{children}</div>;
}

export function BarsCard(
  { title, data, xKey, bars, empty = "No data yet." }:
  { title: string; data: Array<Record<string, string | number | null>>; xKey: string; bars: SeriesDef[]; empty?: string },
) {
  if (data.length === 0) return <Card title={title}><div style={EMPTY}>{empty}</div></Card>;
  return (
    <Card title={title}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -12 }}>
          <CartesianGrid stroke="#f0f2f6" vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: "#e7eaf0" }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e7eaf0" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {bars.map((b) => <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[3, 3, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function LinesCard(
  { title, data, xKey, lines, percent = false, empty = "No data yet." }:
  { title: string; data: Array<Record<string, string | number | null>>; xKey: string; lines: SeriesDef[]; percent?: boolean; empty?: string },
) {
  if (data.length === 0) return <Card title={title}><div style={EMPTY}>{empty}</div></Card>;
  return (
    <Card title={title}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -12 }}>
          <CartesianGrid stroke="#f0f2f6" vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: "#e7eaf0" }} />
          <YAxis
            tick={AXIS} tickLine={false} axisLine={false}
            domain={percent ? [0, 1] : undefined}
            tickFormatter={percent ? (v: number) => `${Math.round(v * 100)}%` : undefined}
          />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e7eaf0" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {lines.map((l) => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color}
                  dot={false} strokeWidth={2} connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function SimpleBarCard(
  { title, data, color = "#3b6fd4", empty = "No data yet." }:
  { title: string; data: BarDatum[]; color?: string; empty?: string },
) {
  return <BarsCard title={title} data={data as unknown as Array<Record<string, string | number | null>>}
                   xKey="label" bars={[{ key: "count", name: "Count", color }]} empty={empty} />;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
cd dashboard && git add package.json package-lock.json components/analytics/Chart.tsx
git commit -m "feat(dashboard): add recharts + shared analytics chart wrappers"
```

---

### Task 7: `FunnelSection.tsx` + `HealthCards.tsx`

Build the two snapshot sections: the funnel (stage rows with proportional bars) and the per-pipeline latest-run health cards.

**Files:**
- Create: `dashboard/components/analytics/FunnelSection.tsx`
- Create: `dashboard/components/analytics/HealthCards.tsx`

**Interfaces:**
- Consumes: `FunnelCounts`, `LatestRuns` from `@/lib/metrics`; `computeHealth` from `@/lib/status`; `STALE_HEALTH_HOURS` from `@/lib/config`
- Produces: `FunnelSection(props: { funnel: FunnelCounts }): JSX.Element`; `HealthCards(props: { latest: LatestRuns; nowIso: string }): JSX.Element`

- [ ] **Step 1: Create `FunnelSection.tsx`**

```tsx
"use client";

import type { FunnelCounts } from "@/lib/metrics";

interface Stage { label: string; value: number; tone?: "ok" | "bad" | "muted" }

const TONES = { ok: "#3b6fd4", bad: "#e0607e", muted: "#9aa3b0" } as const;

function Funnel({ title, stages }: { title: string; stages: Stage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: "13.5px", fontWeight: 800, color: "#161d29", marginBottom: "12px" }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {stages.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "118px", flex: "0 0 auto", fontSize: "12px", color: "#5b6472", fontWeight: 600 }}>{s.label}</div>
            <div style={{ flex: 1, height: "22px", background: "#f0f2f6", borderRadius: "6px", overflow: "hidden" }}>
              <div style={{
                width: `${Math.round((s.value / max) * 100)}%`, height: "100%",
                background: TONES[s.tone ?? "ok"], borderRadius: "6px", minWidth: s.value > 0 ? "3px" : 0,
              }} />
            </div>
            <div style={{ width: "52px", textAlign: "right", fontSize: "12.5px", fontWeight: 700, color: "#1f2430" }}>
              {s.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FunnelSection({ funnel }: { funnel: FunnelCounts }) {
  const { companies: c, jobs: j } = funnel;
  const companyStages: Stage[] = [
    { label: "Tracked", value: c.tracked },
    { label: "Active", value: c.active },
    { label: "Discovery-sourced", value: c.discovery_sourced },
    { label: "Reviewed", value: c.reviewed },
    { label: "Included", value: c.include },
    { label: "Excluded", value: c.exclude, tone: "bad" },
    { label: "Unknown", value: c.unknown, tone: "muted" },
    { label: "Backlog", value: c.backlog, tone: "muted" },
  ];
  const jobStages: Stage[] = [
    { label: "Ever seen", value: j.ever_seen },
    { label: "Open now", value: j.open },
    { label: "Reviewed", value: j.reviewed },
    { label: "Gate-rejected", value: j.gate_rejected, tone: "bad" },
    { label: "Approved", value: j.approved },
    { label: "Denied", value: j.denied, tone: "bad" },
    { label: "Manual reject", value: j.manual_rejected, tone: "bad" },
    { label: "Unreviewed", value: j.unreviewed, tone: "muted" },
    { label: "Errors", value: j.errors, tone: "bad" },
  ];
  return (
    <div style={{
      display: "flex", gap: "32px", flexWrap: "wrap",
      background: "#fff", border: "1px solid #e7eaf0", borderRadius: "14px", padding: "18px 20px",
    }}>
      <Funnel title="Companies — discovery" stages={companyStages} />
      <Funnel title="Jobs — poller → reviewer" stages={jobStages} />
    </div>
  );
}
```

- [ ] **Step 2: Create `HealthCards.tsx`**

```tsx
"use client";

import type { LatestRuns } from "@/lib/metrics";
import { computeHealth, type Health } from "@/lib/status";
import { STALE_HEALTH_HOURS } from "@/lib/config";

const DOT: Record<Health, string> = { ok: "#22c55e", warn: "#f59e0b", stale: "#9aa3b0" };

function rel(nowIso: string, iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function Card(
  { name, health, when, stats, banner }:
  { name: string; health: Health; when: string; stats: [string, number | null | string][]; banner?: string },
) {
  return (
    <div style={{ flex: "1 1 220px", background: "#fff", border: "1px solid #e7eaf0", borderRadius: "14px", padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: DOT[health] }} title={health} />
        <span style={{ fontSize: "13.5px", fontWeight: 800, color: "#161d29" }}>{name}</span>
        <span style={{ marginLeft: "auto", fontSize: "11.5px", color: "#9aa3b0" }}>{when}</span>
      </div>
      {banner && (
        <div style={{ margin: "8px 0", padding: "7px 10px", background: "#fdf3e6", border: "1px solid #f3d9ad",
          borderRadius: "9px", color: "#8a5a12", fontSize: "11.5px", fontWeight: 600 }}>{banner}</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 14px", marginTop: "8px" }}>
        {stats.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
            <span style={{ color: "#8a93a3" }}>{k}</span>
            <span style={{ color: "#1f2430", fontWeight: 700 }}>{v ?? "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HealthCards({ latest, nowIso }: { latest: LatestRuns; nowIso: string }) {
  const now = new Date(nowIso);
  const { poll, review, discovery, discoveryState } = latest;
  return (
    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
      <Card
        name="Poller" when={rel(nowIso, poll?.finished_at ?? null)}
        health={computeHealth(poll ? { finished_at: poll.finished_at, failures: poll.companies_failed } : null, now, STALE_HEALTH_HOURS)}
        stats={[["companies ok", poll?.companies_ok ?? null], ["failed", poll?.companies_failed ?? null],
                ["new jobs", poll?.new_jobs ?? null], ["closed", poll?.closed_jobs ?? null]]}
      />
      <Card
        name="Reviewer" when={rel(nowIso, review?.finished_at ?? null)}
        health={computeHealth(review ? { finished_at: review.finished_at, failures: review.errors } : null, now, STALE_HEALTH_HOURS)}
        stats={[["reviewed", review?.reviewed ?? null], ["gate-rejected", review?.gate_rejected ?? null],
                ["approved", review?.approved ?? null], ["denied", review?.denied ?? null],
                ["errors", review?.errors ?? null]]}
      />
      <Card
        name="Discovery" when={rel(nowIso, discovery?.finished_at ?? null)}
        health={computeHealth(discovery ? { finished_at: discovery.finished_at, failures: discovery.errors } : null, now, STALE_HEALTH_HOURS)}
        banner={discoveryState.halted_no_credits ? "⚠️ Paused — OpenRouter out of credits" : undefined}
        stats={[["ingested", discovery?.ingested ?? null], ["included", discovery?.included ?? null],
                ["excluded", discovery?.excluded ?? null], ["unknown", discovery?.unknown ?? null],
                ["errors", discovery?.errors ?? null], ["backlog", discovery?.backlog ?? null]]}
      />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: exits 0. (`computeHealth`'s generalized `failures` field, from Task 1, is what makes the reviewer/discovery calls typecheck.)

- [ ] **Step 4: Commit**

```bash
cd dashboard && git add components/analytics/FunnelSection.tsx components/analytics/HealthCards.tsx
git commit -m "feat(dashboard): analytics funnel + pipeline health-card sections"
```

---

### Task 8: `TrendCharts.tsx` — toggles + volume + rates charts

Build the interactive trends section: the day/week × 30/90d toggles, the four Volume charts, and the Tier-1 Rates & operations charts. All bucketing/derivation goes through the tested `lib/metrics` helpers.

**Files:**
- Create: `dashboard/components/analytics/TrendCharts.tsx`

**Interfaces:**
- Consumes: `RunSeries`, `fillDays`, `toWeekly`, `sliceWindow`, `rate` from `@/lib/metrics`; `LinesCard`, `BarsCard` from `@/components/analytics/Chart`
- Produces: `TrendCharts(props: { series: RunSeries; nowIso: string }): JSX.Element`

- [ ] **Step 1: Create `TrendCharts.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import type { RunSeries } from "@/lib/metrics";
import { fillDays, toWeekly, sliceWindow, rate } from "@/lib/metrics";
import { LinesCard, BarsCard } from "@/components/analytics/Chart";

type Gran = "day" | "week";
type Win = 30 | 90;

const COLORS = {
  blue: "#3b6fd4", green: "#22a06b", red: "#e0607e", amber: "#f59e0b",
  slate: "#7a8699", violet: "#7c6cd4",
};

function Toggle<T extends string | number>(
  { value, onChange, options }:
  { value: T; onChange: (v: T) => void; options: { v: T; label: string }[] },
) {
  return (
    <div style={{ display: "inline-flex", background: "#eef1f5", borderRadius: "9px", padding: "3px" }}>
      {options.map((o) => {
        const active = o.v === value;
        return (
          <button key={String(o.v)} onClick={() => onChange(o.v)} style={{
            border: "none", cursor: "pointer", fontWeight: 700, fontSize: "12.5px", padding: "6px 14px",
            borderRadius: "7px", background: active ? "#fff" : "transparent",
            color: active ? "#1f2430" : "#8a93a3", boxShadow: active ? "0 1px 4px rgba(0,0,0,.1)" : "none",
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

export function TrendCharts({ series, nowIso }: { series: RunSeries; nowIso: string }) {
  const [gran, setGran] = useState<Gran>("day");
  const [win, setWin] = useState<Win>(30);

  // Re-bucket one pipeline's rows through fill → (weekly) → slice. lastKeys
  // carry "take latest in week" fields (e.g. backlog); everything else sums.
  // All three pipelines fill over the same 90-day window ending nowIso, so the
  // resulting day (or week) sequences are identical and index-aligned — which is
  // what lets the merged `ops` array below zip them together by index.
  function prep<T extends { day: string }>(rows: T[], sumKeys: (keyof T)[], lastKeys: (keyof T)[] = []): T[] {
    const dense = fillDays(rows, 90, nowIso, [...sumKeys, ...lastKeys]);
    const bucketed = gran === "week" ? toWeekly(dense, sumKeys, lastKeys) : dense;
    return sliceWindow(bucketed, win, nowIso);
  }

  const poll = useMemo(
    () => prep(series.poll,
      ["new_jobs", "closed_jobs", "companies_ok", "companies_failed", "run_count", "total_duration_seconds"]),
    [series, gran, win, nowIso],
  );
  const review = useMemo(
    () => prep(series.review,
      ["reviewed", "gate_rejected", "approved", "denied", "errors", "run_count", "total_duration_seconds"]),
    [series, gran, win, nowIso],
  );
  const discovery = useMemo(
    () => prep(series.discovery,
      ["ingested", "reviewed", "included", "excluded", "unknown", "errors", "run_count", "total_duration_seconds", "halt_count"],
      ["last_backlog"]),
    [series, gran, win, nowIso],
  );

  // Derived rate/net series (null on zero-denominator → gap in the line).
  const pollDerived = poll.map((p) => ({
    day: p.day,
    net_growth: p.new_jobs - p.closed_jobs,
    failure_rate: rate(p.companies_failed, p.companies_ok + p.companies_failed),
  }));
  const reviewDerived = review.map((p) => ({
    day: p.day,
    approval_rate: rate(p.approved, p.reviewed),
    gate_rate: rate(p.gate_rejected, p.reviewed),
  }));
  const discoveryDerived = discovery.map((p) => ({
    day: p.day,
    inclusion_rate: rate(p.included, p.reviewed),
    backlog: p.last_backlog,
    halt_count: p.halt_count,
  }));

  // Cross-pipeline cadence + latency (index-aligned per the prep note above).
  const ops = poll.map((p, i) => ({
    day: p.day,
    poll_runs: p.run_count,
    review_runs: review[i]?.run_count ?? 0,
    discovery_runs: discovery[i]?.run_count ?? 0,
    poll_latency: rate(p.total_duration_seconds, p.run_count),
    review_latency: rate(review[i]?.total_duration_seconds ?? 0, review[i]?.run_count ?? 0),
    discovery_latency: rate(discovery[i]?.total_duration_seconds ?? 0, discovery[i]?.run_count ?? 0),
  }));

  return (
    <div>
      <div style={{ display: "flex", gap: "12px", marginBottom: "14px" }}>
        <Toggle value={gran} onChange={setGran}
          options={[{ v: "day", label: "Daily" }, { v: "week", label: "Weekly" }]} />
        <Toggle value={win} onChange={setWin}
          options={[{ v: 30, label: "30 days" }, { v: 90, label: "90 days" }]} />
      </div>

      <div style={{ fontSize: "12px", fontWeight: 800, color: "#8a93a3", letterSpacing: ".4px", margin: "4px 0 10px" }}>VOLUME</div>
      <BarsCard title="Jobs found vs closed" data={poll} xKey="day"
        bars={[{ key: "new_jobs", name: "New", color: COLORS.green }, { key: "closed_jobs", name: "Closed", color: COLORS.red }]} />
      <BarsCard title="Poller — companies ok vs failed" data={poll} xKey="day"
        bars={[{ key: "companies_ok", name: "OK", color: COLORS.blue }, { key: "companies_failed", name: "Failed", color: COLORS.red }]} />
      <BarsCard title="Review outcomes" data={review} xKey="day"
        bars={[{ key: "approved", name: "Approved", color: COLORS.green }, { key: "denied", name: "Denied", color: COLORS.red },
               { key: "gate_rejected", name: "Gate-rejected", color: COLORS.amber }, { key: "errors", name: "Errors", color: COLORS.slate }]} />
      <BarsCard title="Discovery outcomes" data={discovery} xKey="day"
        bars={[{ key: "included", name: "Included", color: COLORS.green }, { key: "excluded", name: "Excluded", color: COLORS.red },
               { key: "unknown", name: "Unknown", color: COLORS.slate }, { key: "errors", name: "Errors", color: COLORS.amber }]} />

      <div style={{ fontSize: "12px", fontWeight: 800, color: "#8a93a3", letterSpacing: ".4px", margin: "18px 0 10px" }}>RATES &amp; OPERATIONS</div>
      <LinesCard title="Review rates" data={reviewDerived} xKey="day" percent
        lines={[{ key: "approval_rate", name: "Approval", color: COLORS.green }, { key: "gate_rate", name: "Gate-reject", color: COLORS.amber }]} />
      <LinesCard title="Discovery inclusion rate" data={discoveryDerived} xKey="day" percent
        lines={[{ key: "inclusion_rate", name: "Inclusion", color: COLORS.blue }]} />
      <LinesCard title="Poller failure rate" data={pollDerived} xKey="day" percent
        lines={[{ key: "failure_rate", name: "Failure", color: COLORS.red }]} />
      <BarsCard title="Net job growth (new − closed)" data={pollDerived} xKey="day"
        bars={[{ key: "net_growth", name: "Net", color: COLORS.blue }]} />
      <LinesCard title="Discovery backlog" data={discoveryDerived} xKey="day"
        lines={[{ key: "backlog", name: "Backlog", color: COLORS.violet }]} />
      <BarsCard title="Run cadence (runs per period)" data={ops} xKey="day"
        bars={[{ key: "poll_runs", name: "Poller", color: COLORS.blue }, { key: "review_runs", name: "Reviewer", color: COLORS.green },
               { key: "discovery_runs", name: "Discovery", color: COLORS.violet }]} />
      <LinesCard title="Avg run latency (seconds)" data={ops} xKey="day"
        lines={[{ key: "poll_latency", name: "Poller", color: COLORS.blue }, { key: "review_latency", name: "Reviewer", color: COLORS.green },
                { key: "discovery_latency", name: "Discovery", color: COLORS.violet }]} />
      <BarsCard title="Credit-halt frequency" data={discoveryDerived} xKey="day"
        bars={[{ key: "halt_count", name: "Halts", color: COLORS.amber }]} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
cd dashboard && git add components/analytics/TrendCharts.tsx
git commit -m "feat(dashboard): analytics trend charts with day/week + 30/90d toggles"
```

---

### Task 9: `BreakdownsSection.tsx`

Render the Tier-2 distribution charts, grouped into Jobs / Reviews / Companies, by mapping over the `Distributions` object.

**Files:**
- Create: `dashboard/components/analytics/BreakdownsSection.tsx`

**Interfaces:**
- Consumes: `Distributions` from `@/lib/metrics`; `SimpleBarCard` from `@/components/analytics/Chart`
- Produces: `BreakdownsSection(props: { distributions: Distributions }): JSX.Element`

- [ ] **Step 1: Create `BreakdownsSection.tsx`**

```tsx
"use client";

import type { Distributions } from "@/lib/metrics";
import { SimpleBarCard } from "@/components/analytics/Chart";

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ fontSize: "12px", fontWeight: 800, color: "#8a93a3", letterSpacing: ".4px", margin: "4px 0 10px" }}>
        {label}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        {children}
      </div>
    </div>
  );
}

export function BreakdownsSection({ distributions: d }: { distributions: Distributions }) {
  return (
    <div>
      <Group label="JOBS">
        <SimpleBarCard title="Open jobs by location" data={d.jobsByLocation} />
        <SimpleBarCard title="Open jobs by department" data={d.jobsByDepartment} />
        <SimpleBarCard title="Remote vs on-site/hybrid" data={d.jobsRemote} />
        <SimpleBarCard title="Top companies by open roles" data={d.jobsByCompany} />
        <SimpleBarCard title="Job lifespan (closed roles)" data={d.jobLifespan} />
      </Group>
      <Group label="REVIEWS">
        <SimpleBarCard title="Fit-score distribution" data={d.fitScore} color="#22a06b" />
        <SimpleBarCard title="Approvals by industry" data={d.approvalsByIndustry} color="#22a06b" />
        <SimpleBarCard title="Approvals by role category" data={d.approvalsByRole} color="#22a06b" />
        <SimpleBarCard title="Approvals by seniority" data={d.approvalsBySeniority} color="#22a06b" />
        <SimpleBarCard title="Experience match" data={d.experienceMatch} color="#7c6cd4" />
        <SimpleBarCard title="Work arrangement" data={d.workArrangement} color="#7c6cd4" />
      </Group>
      <Group label="COMPANIES">
        <SimpleBarCard title="Companies by ATS" data={d.companiesByAts} />
        <SimpleBarCard title="Companies by discovery source" data={d.companiesBySource} />
        <SimpleBarCard title="Included companies by industry" data={d.includedByIndustry} />
        <SimpleBarCard title="Top tech tags" data={d.topTechTags} color="#7a8699" />
        <SimpleBarCard title="Top red flags" data={d.topRedFlags} color="#e0607e" />
      </Group>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
cd dashboard && git add components/analytics/BreakdownsSection.tsx
git commit -m "feat(dashboard): analytics breakdowns section (jobs/reviews/companies)"
```

---

### Task 10: `PipelineDashboard` shell + `/analytics` route + Header link

Assemble the four sections into a client shell with sticky section nav, add the server-rendered gated route, and link to it from the operator header.

**Files:**
- Create: `dashboard/components/analytics/PipelineDashboard.tsx`
- Create: `dashboard/app/analytics/page.tsx`
- Modify: `dashboard/components/rolefit/Header.tsx` (add operator-only "Analytics" link)

**Interfaces:**
- Consumes: `PipelineSnapshot`, `RunSeries` from `@/lib/metrics`; `FunnelSection`, `HealthCards`, `TrendCharts`, `BreakdownsSection`; `getPipelineSnapshot`, `getRunSeries` from `@/lib/metrics`; `requireUserId` from `@/lib/auth`
- Produces: `PipelineDashboard(props: { snapshot: PipelineSnapshot; series: RunSeries; nowIso: string }): JSX.Element`

- [ ] **Step 1: Create `PipelineDashboard.tsx`**

```tsx
"use client";

import type { PipelineSnapshot, RunSeries } from "@/lib/metrics";
import { FunnelSection } from "@/components/analytics/FunnelSection";
import { HealthCards } from "@/components/analytics/HealthCards";
import { TrendCharts } from "@/components/analytics/TrendCharts";
import { BreakdownsSection } from "@/components/analytics/BreakdownsSection";

const SECTIONS = [
  { id: "funnel", label: "Funnel" },
  { id: "health", label: "Health" },
  { id: "trends", label: "Trends" },
  { id: "breakdowns", label: "Breakdowns" },
];

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} style={{ scrollMarginTop: "70px", fontSize: "16px", fontWeight: 800, color: "#161d29", margin: "28px 0 14px" }}>
      {children}
    </h2>
  );
}

export function PipelineDashboard({ snapshot, series, nowIso }: { snapshot: PipelineSnapshot; series: RunSeries; nowIso: string }) {
  return (
    <main style={{ minHeight: "100vh", background: "#f4f6fa", color: "#1f2430", padding: "32px 20px 64px" }}>
      <div style={{ maxWidth: "1040px", margin: "0 auto" }}>
        <a href="/" style={{ fontSize: "12.5px", fontWeight: 600, color: "#5b6472", textDecoration: "none" }}>← Back to board</a>
        <h1 style={{ margin: "14px 0 4px", fontSize: "22px", fontWeight: 800, letterSpacing: "-.4px", color: "#161d29" }}>
          Pipeline analytics
        </h1>
        <div style={{ fontSize: "13px", color: "#8a93a3", marginBottom: "18px" }}>
          Discovery, poller, and reviewer pipelines — totals, throughput, and trends.
        </div>

        <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", gap: "8px",
          padding: "10px 0", background: "#f4f6fa", borderBottom: "1px solid #e7eaf0", marginBottom: "8px" }}>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} style={{
              fontSize: "12.5px", fontWeight: 700, color: "#3b6fd4", textDecoration: "none",
              padding: "6px 12px", background: "#eef3fc", borderRadius: "8px",
            }}>{s.label}</a>
          ))}
        </div>

        <SectionHeading id="funnel">Funnel</SectionHeading>
        <FunnelSection funnel={snapshot.funnel} />

        <SectionHeading id="health">Pipeline health</SectionHeading>
        <HealthCards latest={snapshot.latest} nowIso={nowIso} />

        <SectionHeading id="trends">Trends</SectionHeading>
        <TrendCharts series={series} nowIso={nowIso} />

        <SectionHeading id="breakdowns">Breakdowns</SectionHeading>
        <BreakdownsSection distributions={snapshot.distributions} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create the gated route `app/analytics/page.tsx`**

```tsx
import { requireUserId } from "@/lib/auth";
import { getPipelineSnapshot, getRunSeries } from "@/lib/metrics";
import { PipelineDashboard } from "@/components/analytics/PipelineDashboard";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const userId = await requireUserId(); // redirects to /login when anonymous
  const [snapshot, series] = await Promise.all([
    getPipelineSnapshot(userId),
    getRunSeries(),
  ]);
  return <PipelineDashboard snapshot={snapshot} series={series} nowIso={new Date().toISOString()} />;
}
```

- [ ] **Step 3: Add the operator-only Header link**

In `dashboard/components/rolefit/Header.tsx`, add an "Analytics" link next to the existing "Companies" link, gated on `isAuthed`. Replace the existing Companies `<a>` block with:

```tsx
        {isAuthed && (
          <a href="/analytics" style={{
            fontWeight: 700, fontSize: "13px", color: "#3b6fd4",
            textDecoration: "none", padding: "9px 6px",
          }}>
            Analytics
          </a>
        )}

        <a href="/companies" style={{
          fontWeight: 700, fontSize: "13px", color: "#3b6fd4",
          textDecoration: "none", padding: "9px 6px",
        }}>
          Companies
        </a>
```

- [ ] **Step 4: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Run the full unit-test suite**

Run: `cd dashboard && npm test`
Expected: all suites pass (status + metrics + the pre-existing tests).

- [ ] **Step 6: Manual smoke (requires env)**

If `dashboard/.env.local` is present with `DATABASE_URL` + `NEXT_PUBLIC_SUPABASE_*` (see the "Dashboard .env.local not in worktrees" memory — copy it in if missing), run `cd dashboard && npm run dev`, sign in, and visit `/analytics`. Verify: anonymous visit redirects to `/login`; the four sections render; the day/week and 30/90d toggles change the trend charts; the discovery credit banner shows only when halted. If env is unavailable in this worktree, note that and rely on the typecheck + unit gates.

- [ ] **Step 7: Commit**

```bash
cd dashboard && git add components/analytics/PipelineDashboard.tsx app/analytics/page.tsx components/rolefit/Header.tsx
git commit -m "feat(dashboard): /analytics page shell, gated route, and header link"
```

---

## Self-Review Notes (for the planner; not an execution step)

**Spec coverage** — every spec section maps to a task:
- Auth gate / operator-only / `/analytics` namespace → Task 10 (`requireUserId`, route).
- Section 1 Funnel → Task 4 (`getFunnel`) + Task 7 (`FunnelSection`).
- Section 2 Health (generalized `computeHealth`, credit-halt banner) → Task 1 + Task 4 (`getLatestRuns`) + Task 7 (`HealthCards`).
- Section 3 Trends, Volume + Tier-1 rates/latency/cadence/backlog/halt, day/week × 30/90 toggle, daily-aggregated re-bucketable series → Task 2 (helpers) + Task 3 (`getRunSeries`) + Task 6 (chart wrappers) + Task 8 (`TrendCharts`).
- Section 4 Breakdowns (Tier-2 jobs/reviews/companies) → Task 5 (`getDistributions`) + Task 9 (`BreakdownsSection`).
- Recharts dependency → Task 6. No schema migration → confirmed (all SQL reads existing columns).
- Deferred (pay distribution, Tier-3 cumulative) → intentionally absent.

**Type consistency** — `computeHealth({finished_at, failures})` defined Task 1, consumed Task 7. `Point`/`RunSeries`/`PipelineSnapshot`/`Distributions`/`Bar`/`FunnelCounts`/`LatestRuns` defined in `lib/metrics.ts` (Tasks 2–5), consumed by components (Tasks 6–10) under the same names. `BarsCard`/`LinesCard`/`SimpleBarCard`/`SeriesDef` defined Task 6, consumed Tasks 8–9.

**Edge handling** — empty datasets render each card's empty state (`Chart.tsx`); null latest-runs show "never"/"—" (`HealthCards`); divide-by-zero rates return null → line gaps (`rate`, tested Task 2); zero-filled days prevent misleading gaps (`fillDays`, tested Task 2).
