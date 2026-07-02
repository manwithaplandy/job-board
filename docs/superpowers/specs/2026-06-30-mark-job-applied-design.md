# Mark Job Applied — Design

**Date:** 2026-06-30
**Status:** approved for planning
**Author:** session with operator (Andrew)

## Context

The Rolefit board shows AI-approved roles (default view: `verdict='approve'`). The
operator can already **Reject** a job by hand — a button in the detail-pane action
row that flips `job_reviews` to `verdict='deny', human_override=TRUE`, hides the job,
and offers a 5 s Undo toast (see `2026-06-28-manual-job-rejection-design.md`). There
is no positive counterpart: once the operator actually *submits* an application, there
is no way to record it.

A partial "applied" concept already exists but is buried. The `application_packages`
table (from the apply-assist / "Prepare application" work) has
`status TEXT CHECK (status IN ('prepared','applied'))` and `applied_at`, and a
`markApplicationApplied()` action wired to a "Mark as applied" button — but that button
lives **inside** the Prepare-application panel and its `UPDATE` only flips a row that a
prior "Prepare" step created. If the operator never prepared a tailored package, there
is no row and no way to mark the job applied. So from the operator's perspective there
is "no way to mark a job as Applied" from the main action row, and applied jobs are
invisible to analytics.

The apply flow is a **manual self-report**: the operator clicks **Apply** (opens the
ATS in a new tab), submits there, returns, and clicks **Mark as applied**.

## Goals

- Add a **Mark as applied** button to the detail-pane action row, next to **Reject**,
  available on any authed approved job — independent of the Prepare flow (one click).
- Persist the applied state durably in the DB, reusing `application_packages` as the
  single source of truth (the buried Prepare-panel button and the new button write the
  same place).
- A marked job **hides from the default board** (like a reject) and is reachable via a
  new **Applied** filter on the verdict facet.
- Applied jobs are **counted in the analytics funnel** as a new "Applied" stage.
- Provide a brief in-session **Undo** (toast) mirroring Reject, plus the ability to
  **un-mark** applied from the Applied view.

## Non-goals

- **No new table or migration.** `application_packages` already models this
  (`status`, `applied_at`); Approach A reuses it. (Approaches B "new `job_reviews`
  column" and C "new `job_applications` table" were considered and rejected — B risks
  two sources of truth, C duplicates `application_packages`.)
- **No employer-side / automated submission.** "Applied" is a manual self-report; we do
  not detect or confirm submission with the ATS.
- **No change to `job_reviews.verdict`.** Applied and rejected stay independent stores;
  the UI keeps them mutually exclusive (Mark-as-applied only shows on non-rejected
  approved jobs). We do not add an `applied` verdict value to `job_reviews`.
- **No card-level quick-apply.** The control lives in the detail pane only, matching
  Reject.
- **No multi-user semantics.** Single-tenant: the viewer is the board owner is the
  operator, as with Reject and the company override.
- **No separate "Applied" trend/breakdown charts.** Scope is the single funnel stage;
  richer applied analytics are out of scope for this pass.

## Architecture

### Reuse `application_packages` via an idempotent upsert

The applied state is `application_packages.status = 'applied'` for the operator's
`(user_id, job_id)`. Because the standalone button must work even when no package was
ever prepared, the write is an **upsert** (the current `markApplicationApplied` is an
`UPDATE`-only, which no-ops without a prepared row):

```sql
-- markJobApplied(jobId)
INSERT INTO application_packages (user_id, job_id, status, applied_at)
VALUES (${userId}::uuid, ${jobId}, 'applied', now())
ON CONFLICT (user_id, job_id) DO UPDATE
  SET status = 'applied',
      applied_at = COALESCE(application_packages.applied_at, now());
```

`prepared_at` defaults to `now()`; `resume_json` / `cover_letter_json` /
`greenhouse_questions` / `prefilled_answers` stay `NULL` for a pure marker. The
`UNIQUE (user_id, job_id)` constraint makes the upsert well-defined. `COALESCE`
preserves the *first* applied timestamp on re-clicks.

**Accepted trade-off:** a marker row is an `application_packages` row with no tailored
content and a `prepared_at` that reflects row-creation rather than an actual prepare
step. This is harmless — it simply means "applied without using the assist flow" — and
is the price of a single source of truth shared with the existing Prepare-panel button.

### Why reuse, not a new `job_reviews` column

Putting `applied_at` on `job_reviews` would give the cleanest analytics join (the
funnel already joins `job_reviews`), but it creates a **second** place that records
"applied" alongside `application_packages.status`, which the Prepare-panel button
already writes. Keeping both in sync would force migrating that button too, for no
functional gain. Reusing `application_packages` keeps one source of truth and needs no
migration.

### Applied and rejected are independent, UI-exclusive

`markJobApplied` never touches `job_reviews`, and Reject never touches
`application_packages`. They cannot conflict on the happy path: Mark-as-applied only
renders on a non-rejected approved job, and a rejected job is already hidden from the
board. This mirrors the manual-rejection design's "one-direction, keep it simple"
posture.

## Component changes

### 1. Server actions (`dashboard/app/actions/applications.ts`)

- Generalize `markApplicationApplied` into `markJobApplied(jobId)` — the upsert above —
  and point **both** the new action-row button and the existing Prepare-panel button at
  it (single source of truth). Behavior for the panel is unchanged (a row always exists
  there, so the upsert updates in place).
- Add `unmarkJobApplied(jobId)` for Undo / un-mark:
  - `UPDATE application_packages SET status='prepared', applied_at=NULL WHERE user_id=… AND job_id=…`,
  - then `DELETE` the row **iff it is a pure marker** (`resume_json IS NULL AND
    cover_letter_json IS NULL AND greenhouse_questions IS NULL AND prefilled_answers IS
    NULL`), so undoing a marker leaves no phantom "prepared" package, while a real
    prepared package is preserved (reverted to `prepared`).
- Both call `revalidatePath("/")`.

### 2. Board query + applied surfacing (`dashboard/lib/jobsQuery.ts`, `dashboard/lib/types.ts`)

- `buildJobsQuery`: `LEFT JOIN application_packages ap ON ap.user_id = <owner> AND
  ap.job_id = j.id`; select `ap.status` / `ap.applied_at` on the owner-scoped path
  (omitted for the anon no-owner path, like `human_override`).
- Verdict facet (currently `approve` / `deny` / `gate_rejected` / `pending` / `all`,
  `jobsQuery.ts:25-30`): add `applied`.
  - `verdict='applied'` → `WHERE ap.status = 'applied'` (ignore other verdict clauses).
  - **Every other view** excludes applied jobs: append
    `AND (ap.status IS DISTINCT FROM 'applied')` so applied roles drop out of the
    default `approve` queue (and all others).
- `JobRow`: add `applied: boolean` (and `appliedAt` if needed for the badge).

### 3. Detail-pane control (`dashboard/components/rolefit/JobDetail.tsx:340-386`)

- Add a **Mark as applied** button in the action row, rendered when
  `isAuthed && job.verdict === 'approve' && !job.applied`. Placement:
  `[Reject] [Mark as applied] [Apply]` — Apply stays the rightmost primary CTA. Calls an
  `onApply(job)` prop.
- When `job.applied`, replace the Reject / Mark-as-applied buttons with a green
  **"Applied · you"** badge, reusing the existing applied-badge styling in
  `ApplicationPanel.tsx:248-287` (mirrors the "Rejected · you" badge driven by
  `human_override`).

### 4. Filter control

- Add an **"Applied"** option to the verdict filter control (the UI backing the
  `verdict` facet). It persists via `profiles.board_filters` like the other verdict
  values — no new persistence plumbing.

### 5. Board wiring + Undo toast (`dashboard/components/rolefit/RolefitBoard.tsx`, `app/page.tsx`)

- `page.tsx`: pass `markJobApplied` / `unmarkJobApplied` into `RolefitBoard` as props
  (as the reject actions are passed today).
- `RolefitBoard`:
  - Add `handleApply` mirroring `handleReject` (`RolefitBoard.tsx:246-254`):
    optimistically hide the job via a new `appliedIds` set, clear the selection if it was
    open, call `markJobApplied(job.id)` in a `useTransition`.
  - Reuse the existing 5 s Undo toast (`RolefitBoard.tsx:535-572`), generalized to carry
    the action type so Undo dispatches to `unmarkJobApplied` (applied) or `unrejectJob`
    (reject). Undo un-hides the job.
  - The visible list filters out `appliedIds` alongside `rejectedIds`;
    `revalidatePath("/")` reconciles server truth on next load.

### 6. Analytics funnel (`dashboard/lib/metrics.ts`, `dashboard/components/analytics/FunnelSection.tsx`)

- `JobFunnel` interface (`metrics.ts:100-104`): add `applied: number`.
- `getFunnel()` (`metrics.ts:107-155`): add one **sequential** count (the file runs
  queries via `seq()` to avoid pool exhaustion — see the analytics-dashboard design):
  `SELECT count(*)::int AS applied FROM application_packages WHERE user_id = ${userId}::uuid AND status = 'applied'`,
  and populate `applied` on the returned funnel. Covered by the existing 600 s
  `unstable_cache` window keyed by `userId`.
- `FunnelSection.tsx:46-56`: insert `{ label: "Applied", value: j.applied }` right after
  "Approved" (positive tone): `Ever seen → Reviewed → Gate-rejected → Approved →
  **Applied** → Denied → Manual reject → Unreviewed → Errors`.

## Testing

- **TypeScript**
  - `lib/jobsQuery.test.ts`: `verdict='applied'` generates the `ap.status = 'applied'`
    clause; every other verdict view appends the `ap.status IS DISTINCT FROM 'applied'`
    exclusion; the owner path selects `ap.status`, the anon path omits it and the join.
  - Server actions: assert `markJobApplied` emits the upsert with the `COALESCE`
    timestamp guard; `unmarkJobApplied` reverts to `prepared`/NULL and deletes only a
    pure-marker row (a row with content survives as `prepared`).
  - `metrics` / `getFunnel`: the `applied` count reflects `application_packages` rows
    with `status='applied'` and is scoped to the owner.
  - `JobDetail`: renders **Mark as applied** for an authed approved non-applied job;
    renders the "Applied · you" badge when `job.applied`.
- **Manual smoke** (post-merge, against a dev/preview DB): mark an approved job applied →
  it leaves the default board; the Undo toast restores it; it appears under the
  **Applied** filter; the analytics funnel's **Applied** count increments; marking a job
  applied *without* preparing a package creates a marker row and un-marking it removes
  that row.

## Production rollout sequence (operator-assisted)

1. **Prerequisite:** confirm the existing `migrations/2026-06-30-application-packages.sql`
   is applied to the live Supabase DB. This feature adds **no new migration**, but it
   reads/writes `application_packages`, so that table must exist in prod first. (Per the
   deploy convention, apply migrations before pushing migration-coupled code.)
2. Merge the branch; deploy the dashboard (Vercel). No reviewer/Railway change.
3. Smoke-test: mark one approved job applied → confirm it leaves the board, Undo works,
   it shows under the Applied filter, and the funnel Applied count increments.

## Risks & mitigations

- **`application_packages` not yet in prod.** The new query would error selecting
  `ap.status`. Mitigated by the rollout prerequisite (#1): verify the table exists before
  deploy.
- **Optimistic removal diverges from server truth** (action fails). `revalidatePath("/")`
  reconciles on next load; the `useTransition` pending state prevents double-submits, as
  with Reject.
- **Marker-row clutter.** Marking applied without preparing leaves a content-less
  `application_packages` row. Accepted: it is the single source of truth; un-mark deletes
  pure markers so clutter is self-cleaning, and `status='prepared'` counts can exclude
  markers if ever surfaced.
- **Double-counting in analytics.** Applied jobs still have a `job_reviews` row
  (`verdict='approve'`), so they remain in the "Approved" funnel count as well as the new
  "Applied" count. This is intended — "Applied" is a positive *substage* of Approved, not
  a mutually exclusive bucket. The funnel labels/order make the nesting read correctly.
