# Analytics — Pipeline Dashboard — Design

**Date:** 2026-06-28
**Status:** approved for planning
**Author:** session with operator (Andrew)

## Context

The job board runs three backend pipelines, each already writing per-run
accounting rows to Postgres:

| Pipeline | Code | Run table | Per-entity table |
|---|---|---|---|
| Discovery (find companies) | `discovery/` | `discovery_runs` | `company_reviews`, `discovery_state` |
| Poller (find/close jobs) | `poller/` | `poll_runs` | `jobs` |
| Reviewer (AI-score jobs) | `reviewer/` | `review_runs` | `job_reviews` |

The operator can see the *results* of these pipelines (the Rolefit board at `/`,
the company classifications at `/companies`) but has **no view of the pipelines
themselves**. The only operational telemetry today is a single green/amber/grey
health dot plus an "N unreviewed" count in the board header (operator-only,
computed by `lib/status.ts:computeHealth` from the latest `poll_run`).

The operator wants a dedicated analytics surface to "track the progress of the
job boards" — totals, what gets filtered, what succeeds, and what errors — for
all three pipelines, both as a current snapshot and as trends over time.

## Goals

- A new **operator-only** analytics page that aggregates all three pipelines into
  one comprehensive view, in four sections: a **funnel** (current-state counts and
  drop-off), a **health** strip (latest run per pipeline), **pipeline trends** over
  time (volumes, plus derived rates/latency/cadence/backlog), and **breakdowns**
  (distribution of jobs/reviews/companies across their key dimensions).
- Live under an `/analytics` **namespace** so future analytics pages
  (`/analytics/...`) have an obvious home. This first page is the pipeline
  dashboard; it renders at `/analytics`.
- Cover the metrics the operator named — **total, filtered, successful, errors** —
  for each pipeline, **plus derived rates** (approval, inclusion, failure) and
  **entity breakdowns** (by industry, role, seniority, location, ATS, etc.), all
  sourced from columns that **already exist** (no schema migration).
- Trends are **interactive**: a day/week granularity toggle and a 30/90-day window
  toggle, rendered with a charting library (Recharts).
- Match the existing Rolefit visual style (same cards, palette, type as
  `/companies`); reuse existing query patterns (`lib/queries.ts`) and the existing
  auth gate (`getUserId`).

## Non-goals

- **No new schema / migration.** Every metric is derived from existing columns in
  `poll_runs`, `review_runs`, `discovery_runs`, `jobs`, `job_reviews`,
  `company_reviews`, `discovery_state`. If a desired metric turns out to need a
  column we don't have, it's cut from v1, not added here.
- **No public exposure.** The page is operator-only (same gate as the existing
  operator signals). No sanitized public summary in this pass.
- **No real-time streaming / auto-refresh.** Server-rendered on load
  (`force-dynamic`), like every other page; the operator reloads to refresh. A
  manual "Refresh" affordance is optional polish, not required.
- **No write actions.** This is a read-only dashboard. It does not trigger polls,
  reviews, or discovery runs, and does not edit verdicts (those live on `/` and
  `/companies`).
- **No materialized views or new API routes.** Aggregation is plain SQL through the
  existing `postgres` client; the trend toggle filters an already-fetched series
  in-memory.
- **No multi-tenant semantics.** Single-tenant: the viewer is the board owner is
  the operator, consistent with the rest of the app.

## Architecture

### Approach A — server component + query module, client charts (chosen)

The page is a server component that fetches everything in one round-trip via a new
`lib/metrics.ts` query module (same shape as `lib/queries.ts`: tagged-template SQL
through the shared `sql` client, typed row returns). It fetches:

1. a **snapshot** object — current-state funnel counts, latest-run rows, and the
   Tier-2 distribution group-bys (each bounded by top-N / fixed buckets), and
2. a **90-day daily-aggregated run series** per pipeline (the widest window the UI
   offers). Each daily row carries the summed counts **plus** `run_count`,
   `total_duration_seconds`, `last_backlog`, and `halt_count` — every field chosen
   so the client can **re-aggregate to weekly** by re-summing (avg latency =
   `total_duration_seconds / run_count` at any granularity; weekly backlog = the
   last day's `last_backlog`). This keeps the payload compact (≤ 90 days × 3
   pipelines) while still supporting both granularities and all Tier-1 derivations.

It passes both to a single client component (`PipelineDashboard`) that owns the
granularity/window toggles and re-buckets/filters the daily series in-memory
(daily→weekly re-sums adjacent days; 90→30 days is a slice; rates, net-growth, and
avg-latency are client-side arithmetic over the (re-)bucketed rows). No re-fetch on
toggle, no extra endpoint. The distribution group-bys are snapshot-only (current
state), not windowed by the trend toggle.

**Alternatives rejected:**

- **API route per toggle change** — smaller initial payload but adds round-trips
  and an endpoint for no benefit at this data volume (run tables are small and
  already aggregated).
- **SQL materialized views** — faster at scale, but adds a migration and refresh
  maintenance; premature for the current volume.

### Auth gate

The page resolves `getUserId()` (Supabase session). If null (anonymous), it
`redirect("/login")` — operator-only, no anonymous fallback content. This is
stricter than `/companies` (which renders a "set up a profile" prompt) because the
page is pure operator telemetry. The Header gains an **operator-only** "Analytics"
link, shown only when a viewer/owner is present, alongside the existing
"Companies" link.

### Route layout

```
app/analytics/page.tsx          # the pipeline dashboard (this spec)
                                # future: app/analytics/<sub>/page.tsx
```

`/analytics` is the dashboard now; the directory naming reserves the namespace for
later analytics pages without implying they exist yet.

## Metrics

All counts below come from existing columns. "Owner" = `getBoardOwnerId()` (the
single operator whose verdicts the board reflects).

### Section 1 — Funnel (current-state snapshot)

Two funnels side by side. Each stage shows a count; drop-off between stages is the
"filtered" quantity.

**Companies (Discovery funnel)** — from `companies` + `company_reviews` +
`discovery_state`:

| Stage | Source |
|---|---|
| Tracked (all companies) | `count(*) FROM companies` |
| Active | `... WHERE active` |
| Discovery-sourced | `... WHERE discovery_source <> 'manual'` |
| Reviewed | discovery-sourced with a `company_reviews` row for owner |
| Included / Excluded / Unknown | effective verdict, reusing the `getCompanyVerdictCounts` CASE logic |
| Backlog (awaiting review) | reuse `getDiscoveryState` backlog computation |

**Jobs (Poller → Reviewer funnel)** — from `jobs` + `job_reviews` (owner):

| Stage | Source |
|---|---|
| Ever seen | `count(*) FROM jobs` |
| Open now | `... WHERE closed_at IS NULL` |
| Closed | `... WHERE closed_at IS NOT NULL` |
| Reviewed (of open) | open jobs with a `job_reviews` row |
| Gate-rejected | `stage1_decision = 'reject'` |
| Approved / Denied | `verdict = 'approve' / 'deny'` |
| Errors | `error IS NOT NULL` |
| Unreviewed backlog | open jobs with no review row (reuse `getReviewStats.unreviewed`) |
| Manually rejected | `verdict='deny' AND human_override` |

### Section 2 — Pipeline health (latest run per pipeline)

One card per pipeline. Each shows a freshness dot (generalize
`lib/status.ts:computeHealth`, currently poll-only, to accept any run's
`finished_at`/`started_at` + a staleness threshold), the last-run timestamp, and
that run's counts:

- **Poller** — latest `poll_runs`: companies ok / failed, new / closed jobs.
- **Reviewer** — latest `review_runs`: reviewed, gate-rejected, approved, denied,
  errors.
- **Discovery** — latest `discovery_runs` + `discovery_state`: status, ingested,
  reviewed, included / excluded / unknown, errors, backlog. Renders a
  **credit-halt banner** when `discovery_state.halted_no_credits` is true (reusing
  the existing `CreditBanner` styling concept).

"Latest run" = most recent by `started_at`; for the freshness dot, prefer the most
recent **finished** run (`finished_at IS NOT NULL`), matching how
`getLatestPollRun`/`getLatestReviewRun` already behave.

### Section 3 — Pipeline trends (Recharts)

Controls: **granularity** (Day | Week) and **window** (30d | 90d), applied to every
chart in this section. The server pre-aggregates to **daily** rows per pipeline
(`date_trunc('day', started_at)`, SUM of counts + `run_count` +
`total_duration_seconds` + `last_backlog` + `halt_count`); the client re-buckets
those to weekly (re-summing adjacent days) and/or slices to 30 days. Missing days
are zero-filled client-side so lines don't lie about gaps. Derived series (rates,
net growth, cadence, avg latency) are computed client-side from the (re-)bucketed
rows; divide-by-zero yields null (a gap), not NaN.

**Volume** (raw counts — the original four):

| Chart | Series | Source |
|---|---|---|
| Jobs found vs closed | `new_jobs`, `closed_jobs` | `poll_runs` |
| Poller reliability | `companies_ok`, `companies_failed` | `poll_runs` |
| Review outcomes | `approved`, `denied`, `gate_rejected`, `errors` | `review_runs` |
| Discovery outcomes | `included`, `excluded`, `unknown`, `errors` | `discovery_runs` |

**Rates & operations** (Tier 1 — derived, mostly client-side arithmetic over the
same series):

| Chart | Definition | Source |
|---|---|---|
| Approval rate | `approved / NULLIF(reviewed,0)` per period | `review_runs` |
| Gate-rejection rate | `gate_rejected / NULLIF(reviewed,0)` | `review_runs` |
| Discovery inclusion rate | `included / NULLIF(reviewed,0)` | `discovery_runs` |
| Poller failure rate | `companies_failed / NULLIF(companies_ok+companies_failed,0)` | `poll_runs` |
| Net job growth | `new_jobs − closed_jobs` per period | `poll_runs` |
| Run latency | `finished_at − started_at`, avg per period, per pipeline | all three run tables |
| Run cadence | run count per period, per pipeline | all three run tables |
| Discovery backlog | `backlog` (last run in period) | `discovery_runs` |
| Credit-halt frequency | count of `status='halted_no_credits'` per period | `discovery_runs` |

The reviewer has no backlog column, so reviewer backlog is snapshot-only (in the
funnel), not a trend here.

Charts are stacked/area or grouped lines as fits each (decided at build time); axes,
tooltips, and legends come from Recharts. Recharts renders inside the client
component only (`"use client"`), keeping the server component dependency-free.

### Section 4 — Breakdowns (Tier 2 — current-state distributions)

Snapshot distributions (not windowed by the trend toggle), each a bounded query
(fixed buckets or top-N, default N=10). Rendered as bar charts (histograms / ranked
bars) and small category breakdowns. Grouped into three blocks:

**Jobs** — from `jobs` (open = `closed_at IS NULL`):

| Breakdown | Shape | Source |
|---|---|---|
| Open jobs by location | top-N bar | `jobs.location` |
| Open jobs by department | top-N bar | `jobs.department` |
| Remote vs non-remote | 2-way split | `jobs.remote` |
| Top companies by open roles | top-N bar | `jobs` ⨝ `companies` |
| Job lifespan (closed roles) | histogram of `closed_at − first_seen_at` | `jobs` |

**Reviews** — from `job_reviews` (owner):

| Breakdown | Shape | Source |
|---|---|---|
| Fit-score distribution | histogram, 10-pt buckets | `fit_score` |
| Approvals by industry | top-N bar | `industry` (verdict='approve') |
| Approvals by role category | top-N bar | `role_category` |
| Approvals by seniority | bar | `seniority` |
| Experience match | 4-way bar | `experience_match` |
| Work arrangement | 4-way bar | `work_arrangement` |

(The manual-reject total — `human_override` — already appears as a funnel stage in
Section 1, so it isn't repeated here.) Pay distribution is intentionally cut from
v1: `pay_min/max` mix `pay_currency` and `pay_period`, so a faithful chart needs
normalization logic that isn't worth the v1 cost. Noted under deferred.

**Companies** — from `companies` + `company_reviews`:

| Breakdown | Shape | Source |
|---|---|---|
| Companies by ATS | 3-way bar | `companies.ats` |
| Companies by discovery source | 4-way bar | `companies.discovery_source` |
| Included companies by industry | top-N bar | `company_reviews.industry` |
| Top tech tags | top-N bar | `company_reviews.tech_tags` (JSONB unnest) |
| Top red flags | top-N bar | `company_reviews.red_flags` (JSONB unnest) |

All top-N queries `ORDER BY count DESC LIMIT N`; JSONB-array breakdowns unnest with
`jsonb_array_elements_text` then group. Empty results render the section's
empty-state, not a blank chart.

## Components & files

| File | Role |
|---|---|
| `app/analytics/page.tsx` | Server component: gate on `getUserId`, fetch snapshot + series, render. `force-dynamic`. |
| `components/analytics/PipelineDashboard.tsx` | `"use client"` shell: owns granularity/window state + sticky section nav; renders the four sections. |
| `components/analytics/FunnelSection.tsx` | The two snapshot funnels. |
| `components/analytics/HealthCards.tsx` | The three latest-run cards + credit-halt banner. |
| `components/analytics/TrendCharts.tsx` | Toggle controls + the Volume and Rates&Ops Recharts charts; does in-memory bucketing/slicing + derived-rate math. |
| `components/analytics/BreakdownsSection.tsx` | The Jobs / Reviews / Companies distribution bar charts (snapshot-only). |
| `components/analytics/Chart.tsx` | Thin shared wrappers around Recharts (bar, line/area, histogram) for consistent axes/tooltip/legend styling. |
| `lib/metrics.ts` | `getPipelineSnapshot()` (funnel + latest runs + distributions), `getRunSeries()`, and pure bucketing/rate helpers. |
| `lib/metrics.test.ts` | Unit tests for the pure helpers (bucketing, zero-fill, weekly grouping, rate/net-growth math). |
| `lib/status.ts` | Generalize `computeHealth` to any run (keep the existing call site working). |
| `components/rolefit/Header.tsx` | Add operator-only "Analytics" link. |
| `dashboard/package.json` | Add `recharts`. |

Given the breadth, `getPipelineSnapshot()` fans its many group-by queries out with
`Promise.all` (the tables are small and single-tenant); each distribution query is
bounded by fixed buckets or `LIMIT N`. If the function grows unwieldy it may be
split into `getFunnel()` / `getLatestRuns()` / `getDistributions()` at build time —
an internal refactor, not a design change.

Naming/style: inline-styled React matching `/companies` and the Rolefit
components; the same palette (`#3b6fd4` accent, `#f4f6fa` page bg, card/border
tokens already in use).

## Data flow

```
app/analytics/page.tsx (server)
  getUserId() ─ null ─▶ redirect("/login")
        │ present
        ▼
  Promise.all([
    getPipelineSnapshot(ownerId),   // funnel + latest-run rows + distributions
    getRunSeries(90),               // 90d daily per-pipeline series (+finished_at/backlog/status)
  ])
        │
        ▼
  <PipelineDashboard snapshot=… series=… />   (client)
        ├─ FunnelSection      (snapshot.funnel)
        ├─ HealthCards        (snapshot.latestRuns + discovery_state)
        ├─ TrendCharts        (series → bucket(day|week) → slice(30|90) → rates → Recharts)
        └─ BreakdownsSection  (snapshot.distributions → Recharts bars)
```

## Error / empty handling

- **Young pipelines / no runs:** any "latest run" may be null → the card shows an
  "no runs yet" empty state rather than zeros that imply a finished run.
- **Sparse history:** trend series zero-fill missing days so a quiet day reads as 0,
  not a gap; a window with no runs at all shows an empty-chart placeholder.
- **Query failure:** the page is server-rendered; an unhandled DB error surfaces as
  the standard Next error boundary. We do not silently render partial zeros — a
  failed snapshot fetch should not look like an idle pipeline. (Per-section
  try/catch with a visible "couldn't load this section" is acceptable polish.)

## Testing

- **`lib/metrics.test.ts`** — pure-function coverage: daily→weekly bucketing,
  30/90-day slicing, zero-fill of missing days, empty-series handling, and the
  derived-rate / net-growth / cadence math (incl. divide-by-zero → null, not NaN).
  These are the parts with real logic and no DB.
- **Aggregation SQL** — validated against the existing DB-integration test harness
  (`TEST_DATABASE_URL`, local Postgres on `:55432`) if/where the plan adds query
  tests, mirroring how other `lib/*.test.ts` and poller DB tests run.
- **No new e2e.** Manual operator verification of the rendered page is sufficient
  for this read-only view.

## Open questions / deferred

- Exact chart types (area vs grouped line vs bar) per chart — decided at build time
  to fit the data; not load-bearing for the design.
- Optional manual "Refresh" button — polish, not required for v1.
- **Tier 3 — cumulative/stock-over-time** (total open jobs over time, total
  companies tracked over time): deferred. These need running-sum reconstruction
  from `first_seen_at`/`closed_at` rather than a per-run SUM, and read more like an
  exploration page — a natural fit for a future `/analytics/<sub>` route.
- **Pay distribution** of approved roles: deferred (post-v1) — needs
  currency/period normalization across `pay_min/max/currency/period`.
- Future `/analytics/<sub>` pages — out of scope; the namespace is the only thing
  reserved here.
