# Analytics — Pipeline Health Panel Upgrade — Design

**Date:** 2026-06-29
**Status:** approved for planning
**Author:** session with operator (Andrew)

## Context

The `/analytics` dashboard's **Pipeline health** section (`components/analytics/HealthCards.tsx`)
currently renders one card per pipeline (poller / reviewer / discovery) showing the
*latest run's* counts plus a freshness dot. Two problems surfaced in production:

- The **poller** card reads the latest `poll_runs` row regardless of completion, so
  while a poll is in progress its counts are NULL and the card shows blanks. (Root
  cause: `getLatestPollRun()` lacks the `finished_at IS NOT NULL` filter that
  `getLatestReviewRun()` and the discovery latest-run query have.)
- The **discovery** card shows the latest *finished* run, but discovery runs weekly and
  its most recent run can be a legitimate no-op (all-zero counts), so the card looks
  empty even though prior runs did real work.

The operator wants the health section to be richer and never-misleading: show the last
run that actually did work, **and** surface when the latest run failed or is still
running; add all-time aggregate totals per pipeline; and clearly show when each pipeline
last ran and when it is next scheduled.

No schema migration — everything derives from the existing `poll_runs`, `review_runs`,
`discovery_runs`, `discovery_state` tables plus a hardcoded schedule config.

## Goals

- Replace the three latest-run health cards with richer per-pipeline cards that show:
  1. **Last successful run** — the most recent run that finished and did real work, so the
     card's headline numbers are never blank/misleading.
  2. **Latest run state** — surface when the latest run is still running, failed, or was a
     no-op (i.e. when the latest run differs from the last successful run).
  3. **All-time totals** — cumulative aggregates per pipeline since inception.
  4. **Last run time** and **next scheduled run time**.
- Keep the existing Rolefit visual style and the discovery credit-halt banner.
- Keep the client/server boundary clean: client-imported helpers stay DB-free (the page
  already had a server/client bundling bug; do not reintroduce it).

## Non-goals

- No schema migration; no new run columns.
- No change to the Funnel, Trends, or Breakdowns sections.
- No live polling of Railway for cron schedules — schedules are hardcoded in the
  dashboard (operator-maintained), mirroring the Railway settings.
- No per-run drill-down / history table (the Trends section already shows series).

## Pipelines & schedules (verified)

| Pipeline | Run table | Schedule (UTC) | Source of truth |
|---|---|---|---|
| Poller | `poll_runs` | every 2h at :00 (`0 */2 * * *`) | Railway service settings (documented in README) |
| Reviewer | `review_runs` | every 2h (runs *inside* each poller execution: poll → review → prune) | same as poller |
| Discovery | `discovery_runs` | Mondays 06:00 (`0 6 * * 1`) | `railway.discovery.json` |

Reviewer has no separate cron: each poller execution writes a `poll_runs` row (early) and
a `review_runs` row (later in the same run), so reviewer shares the poller's cadence.

## Data model

### Per-pipeline health (new query layer in `lib/metrics.ts`)

`getPipelineHealth(userId: string): Promise<PipelineHealth>` returns, for each pipeline,
the raw rows + totals (status and next-run are derived client-side from `nowIso`, see
below). Run-table rows are NOT user-scoped (no `user_id` column); only `discoveryState`
is user-scoped.

```ts
interface PollerTotals    { runs: number; new_jobs: number; closed_jobs: number; companies_ok: number; companies_failed: number }
interface ReviewerTotals  { runs: number; reviewed: number; gate_rejected: number; approved: number; denied: number; errors: number }
interface DiscoveryTotals { runs: number; ingested: number; reviewed: number; included: number; excluded: number; errors: number }

interface PipelineHealth {
  poller:    { latest: PollRunRow | null;     lastSuccess: PollRunRow | null;     totals: PollerTotals }
  reviewer:  { latest: ReviewRunRow | null;   lastSuccess: ReviewRunRow | null;   totals: ReviewerTotals }
  discovery: { latest: DiscoveryRunRow | null; lastSuccess: DiscoveryRunRow | null; totals: DiscoveryTotals;
               state: DiscoveryStateRow }
}
```

**Queries** (each `ORDER BY started_at DESC LIMIT 1`, run sequentially via the existing
`seq` helper so the fan-out never exceeds the connection pool):

- `latest`: most recent row, any state (no filter).
- `lastSuccess` — "finished AND did work":
  - poller: `WHERE finished_at IS NOT NULL`
  - reviewer: `WHERE finished_at IS NOT NULL AND reviewed > 0`
  - discovery: `WHERE finished_at IS NOT NULL AND (ingested > 0 OR reviewed > 0)`
- `totals`: all-time `count(*)` + `COALESCE(sum(col),0)::int` over each table (no date
  filter). Tables are tiny (tens of rows), so these are cheap.
- `state`: reuse `getDiscoveryState(userId)` (credit-halt banner + backlog).

This replaces `getLatestRuns`/`LatestRuns`; `PipelineSnapshot.latest` becomes
`PipelineSnapshot.health: PipelineHealth`. `getPipelineSnapshot` continues to run its
groups sequentially.

### Status derivation (pure, DB-free — `lib/status.ts`, unit-tested)

`derivePipelineStatus(args): PipelineStatus` where
`type PipelineStatus = "running" | "failed" | "warn" | "stale" | "ok"`.

The badge reflects **run-level** health only — did the latest run finish, and did it
finish in a non-error state. **Per-item errors are expected** and do NOT affect the badge:
reviewer `errors` and discovery `errors` are normal pipeline noise, shown as stats only.

Inputs: `latest` row (finished_at, started_at, discovery `status`, poller
companies_ok/companies_failed), `lastSuccess` row, `now`, the schedule `intervalHours`
(for staleness), `RUNNING_GRACE_HOURS = 3`, and `POLLER_FAILURE_WARN_RATE = 0.60`.

Precedence:
1. **running** — `latest.finished_at` is null AND `latest.started_at` age `< RUNNING_GRACE_HOURS`.
2. **failed** — the run did not complete healthily:
   - crashed / never finished: `latest.finished_at` null AND age `>= RUNNING_GRACE_HOURS`; OR
   - discovery finished in an error state: `latest.status IN ('error','halted_no_credits')`.
   (Poller and reviewer have no `status` column, so for them "failed" = crash only.)
3. **stale** — no `lastSuccess`, or `lastSuccess.finished_at` age `> 2 × intervalHours`
   (schedule-aware, so the weekly discovery job isn't flagged stale at the poller threshold).
4. **warn** — poller only: the latest finished poll's failure rate
   `companies_failed / (companies_ok + companies_failed) > POLLER_FAILURE_WARN_RATE`
   (catches an abnormal ATS-wide outage; the ~38% baseline stays `ok`). The
   `companies_failed` count is always shown regardless of the badge.
5. **ok** — finished, in a non-error state, within schedule. Per-item `errors` are expected
   here and do not downgrade the badge.

This is separate from the existing `computeHealth` (used by the board header), which is
left unchanged.

### Schedules + next run (pure, DB-free — `lib/schedules.ts`, unit-tested)

Typed config (no cron-string parser dependency — only two shapes are needed):

```ts
type Schedule =
  | { kind: "interval"; everyHours: number; atMinute: number }   // anchored at hour 0
  | { kind: "weekly";   weekday: number; atHour: number; atMinute: number }; // weekday 0=Sun..6=Sat

export const SCHEDULES = {
  poller:    { kind: "interval", everyHours: 2, atMinute: 0 },
  reviewer:  { kind: "interval", everyHours: 2, atMinute: 0 },
  discovery: { kind: "weekly", weekday: 1, atHour: 6, atMinute: 0 }, // Mon 06:00 UTC
} as const;
// NOTE: these mirror the Railway crons (poller = Railway service settings; discovery =
// railway.discovery.json `0 6 * * 1`). Keep in sync if the Railway schedules change.

export function nextRun(schedule: Schedule, now: Date): Date; // next fire strictly after `now`, in UTC
```

`nextRun` is computed in UTC: interval → next hour in {0, everyHours, 2·everyHours, …}
at `atMinute` strictly after `now`; weekly → next `weekday` at `atHour:atMinute` strictly
after `now`.

## UI (`components/analytics/HealthCards.tsx`)

`HealthCards({ health, nowIso })` — one richer card per pipeline. The component imports
**types** from `@/lib/metrics` (erased) and **value helpers** only from DB-free modules
(`@/lib/status`, `@/lib/schedules`, `@/lib/config`) so the client bundle stays DB-free.

Card layout (inline styles, Rolefit palette):

- **Header row:** status dot + pipeline name; right-aligned "last run · {rel(latest.started_at)}".
  The dot color maps all five `PipelineStatus` values: ok=green, warn=amber, running=blue,
  failed=red, stale=grey.
- **Schedule line:** next scheduled run from `nextRun(SCHEDULES[p], now)`. Poller and
  discovery fire at the cron boundary, shown relative + absolute ("in ~40m",
  "Mon 06:00 UTC"). The **reviewer** runs ~1.5h into each poll cycle, so its card labels
  the same boundary as the cycle — e.g. "next cycle ~08:00 UTC" — not a precise review time.
- **Status banner (shown when the latest run isn't a clean recent success):**
  - running → "Last run started {rel} ago, still running"
  - failed (crash / didn't finish) → "Last run didn't finish"
  - failed (discovery error status) → "Last run errored"; (halted_no_credits) → existing credit-halt banner
  - warn (poller high failure rate) → "High failure rate: {pct}% of companies failed last run"
  - no-op → "Last run did no work (showing last successful run)"
- **Last successful run block:** the pipeline's key counts from `lastSuccess` (poller:
  companies ok/failed, new/closed; reviewer: reviewed/gate-rejected/approved/denied/errors;
  discovery: ingested/included/excluded/unknown/errors/backlog). Renders "—" only if the
  pipeline has *never* had a successful run.
- **All-time totals block:** a compact labeled row from `totals` (e.g. "All-time: {runs}
  runs · {new_jobs} new · {closed_jobs} closed" for poller; analogous per pipeline).

The discovery credit-halt banner (`state.halted_no_credits`) is preserved.

`PipelineDashboard` passes `snapshot.health` + `nowIso` to `HealthCards`;
`app/analytics/page.tsx` is unchanged except for the snapshot field rename.

## Files

| File | Change |
|---|---|
| `lib/schedules.ts` | **new** — `Schedule` type, `SCHEDULES` config, `nextRun()` |
| `lib/schedules.test.ts` | **new** — unit tests for `nextRun` (interval + weekly + boundaries) |
| `lib/status.ts` | add `PipelineStatus` + `derivePipelineStatus()` (keep `computeHealth`/`isNew`) |
| `lib/status.test.ts` | add `derivePipelineStatus` cases |
| `lib/metrics.ts` | replace `getLatestRuns`/`LatestRuns` with `getPipelineHealth`/`PipelineHealth` + totals types; update `getPipelineSnapshot` (sequential) |
| `components/analytics/HealthCards.tsx` | richer per-pipeline cards |
| `components/analytics/PipelineDashboard.tsx` | pass `snapshot.health` to `HealthCards` |
| `app/analytics/page.tsx` | snapshot field rename only (still cached + sequential) |

## Testing

- **`lib/schedules.test.ts`** — `nextRun` for interval (mid-interval, exactly on a boundary,
  end-of-day rollover) and weekly (mid-week, same day before/after the time, week rollover).
- **`lib/status.test.ts`** — `derivePipelineStatus`: running; crash-failed (unfinished &
  past the grace window); discovery error-status failed (`error` and `halted_no_credits`);
  poller high-failure-rate warn (>60%) and the ~38% baseline staying `ok`; stale (incl.
  weekly discovery NOT stale at the poller threshold); per-item errors stay `ok` (reviewer
  `errors=1`, discovery `errors=90`); plain `ok`.
- Query functions + React components: `npx tsc --noEmit` + `npm run build`, per repo
  convention (no unit tests for SQL/components). The build is a required gate (it caught
  the earlier client/server bundling regression).
- All metrics queries must remain sequential (`seq`) — verify no `Promise.all` fan-out is
  reintroduced in the analytics path.

## Edge cases

- Pipeline with **no runs at all** → `latest`/`lastSuccess` null → card shows "No runs yet";
  status `stale`.
- Pipeline that has run but **never successfully** (e.g. discovery only ever no-op) →
  `lastSuccess` null → headline counts "—", status reflects latest (warn/failed), all-time
  totals still shown.
- **Clock skew** (latest.started_at slightly in the future) → relative time clamps to
  "just now"; `nextRun` still returns a strictly-future time.
- **In-progress latest run** is the normal case for the poller right after a trigger →
  `running` status + banner, last-success numbers shown underneath (the original bug).
