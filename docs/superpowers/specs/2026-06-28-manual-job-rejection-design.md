# Manual Job Rejection — Design

**Date:** 2026-06-28
**Status:** approved for planning
**Author:** session with operator (Andrew)

## Context

The job board AI-reviews each open role against the operator's résumé and shows
the survivors on the Rolefit board (default view: `verdict='approve'`). The
operator can already override **companies** by hand (Include/Exclude on
`/companies`), but there is no equivalent for an individual **job**: if the AI
approves a role the operator knows is wrong, the only recourse today is to leave
it on the board.

The operator wants a manual **Reject** that is, in their words, "fundamentally the
same as the AI reviewer rejecting jobs" — it removes the role from the board and
purges the now-unnecessary job data, exactly as an AI `deny` already does.

The recent job-data-pruning work makes this almost free: an AI `deny` already (a)
drops out of the default board, (b) gets its `description` nulled by `prune.py`
Rule A on the next poll, and (c) is never re-reviewed by `select_candidates`. A
manual reject only has to *produce a `deny`* and the rest of the machinery
already does the work.

## Goals

- Let the authenticated operator reject any non-denied job from the Rolefit board.
- A manual reject is **final**, identical in effect to an AI `deny`: removed from
  the board now, JD purged on the next poll (~2 h), never re-reviewed.
- Record that the reject was **human-initiated**, so manual rejects are
  distinguishable from AI denials (a "· you" badge in the Denied view), mirroring
  how `company_reviews.human_override` already works.
- Provide a brief in-session **Undo** (toast) that restores the prior state,
  effective until the next poll runs prune.

## Non-goals

- **No reversible/restorable rejects.** Once the JD is purged, a restore would be
  JD-blind; we deliberately do not retain job data to enable late undo. (The
  ephemeral toast is the only undo.)
- **No manual "approve" / promote.** The only manual action is reject. We do not
  add an `override_verdict` column or a general two-way override for jobs.
- **No layered `effective_verdict` for jobs.** Unlike companies, jobs flip
  `verdict` in place (see Architecture); we do not introduce the company-style
  computed effective verdict across prune/select/board.
- **No card-level quick-reject.** The control lives in the detail pane only.
- **No multi-user semantics.** Single-tenant: the viewer is the board owner is
  the operator, mirroring the existing company override action.

## Architecture

### In-place verdict flip + a `human_override` marker

A manual reject writes the operator's `job_reviews` row to
`verdict='deny', human_override=TRUE` (inserting a minimal row if the job was
never reviewed). The row now *is* a `deny`, so every existing consumer keyed on
`verdict='deny'` behaves correctly **with no change**:

| Requirement | Mechanism | Change |
|---|---|---|
| Removed from board | default board filters `r.verdict='approve'`; the flip drops it | none |
| JD purged next poll | `prune.py` Rule A keys on `verdict='deny' OR stage1_decision='reject'` | none |
| Never re-reviewed | `select_candidates` excludes `r.verdict IS DISTINCT FROM 'deny'` | none |
| Distinguish from AI | new `human_override` flag drives a "· you" badge | new column |

### Why in-place flip, not the company layered model

`company_reviews` keeps the AI `verdict` untouched, adds `override_verdict`, and
every consumer computes `effective_verdict = CASE WHEN human_override THEN
override_verdict ELSE verdict END` (see `discovery/db.py`, `dashboard/lib/queries.ts`).
That is necessary for companies because overrides go **both** directions
(include⇄exclude) and nothing purges company data.

Jobs only ever override in **one** direction (reject → `deny`). Reusing the
layered model would force the board query, `prune.py` Rule A, and
`select_candidates` to all switch from `verdict='deny'` to a computed
`effective_verdict` — three hot paths just migrated by the pruning work — for no
functional gain. The in-place flip keeps those paths untouched and matches the
operator's intent ("the same as the AI rejecting").

**Accepted trade-off:** flipping `verdict` overwrites the AI's original verdict
(e.g. `approve`→`deny`). The AI's *analysis* columns (`fit_score`, `reasoning`,
sub-scores, etc.) are left intact, and `human_override=TRUE` records that a human
set this deny. We lose only the record that the AI had said "approve," which is
acceptable given the goal.

### Durability of a manual reject

A denied job is excluded from `select_candidates`, so the AI reviewer never
re-selects it and the manual reject is durable. As defense-in-depth against the
narrow race where a job is selected for review *before* the operator rejects it
mid-run, the reviewer's upsert is made non-clobbering for human-overridden rows
(see Component changes #2). This mirrors discovery's "human_override is sticky"
guarantee.

## Component changes

### 1. Schema / migration

- `schema.sql`: add to `job_reviews`
  `human_override BOOLEAN NOT NULL DEFAULT FALSE`. No `override_verdict` column.
- `migrations/2026-06-28-job-human-override.sql`:
  `ALTER TABLE job_reviews ADD COLUMN human_override BOOLEAN NOT NULL DEFAULT FALSE;`
  A constant default adds no table rewrite (instant on the existing rows).

### 2. Reviewer upsert stickiness (`reviewer/db.py`)

Append a guard to the existing `_UPSERT_REVIEW_SQL` conflict clause:
`ON CONFLICT (user_id, job_id) DO UPDATE SET … WHERE job_reviews.human_override IS NOT TRUE`.
The AI reviewer thus never modifies a human-overridden row. Harmless for normal
rows (`human_override` defaults `FALSE`); protective for manual rejects. The
`_REVIEW_COLUMNS` tuple is unchanged (the reviewer never writes `human_override`).

### 3. Server actions (new `dashboard/app/actions/jobs.ts`)

Mirrors `dashboard/app/actions/companies.ts` (`"use server"`, `requireUserId()`,
`sql` tagged template, `revalidatePath`).

- `rejectJob(jobId: string)`: upsert the operator's row —
  `INSERT … (user_id, job_id, profile_version='', verdict='deny', human_override=TRUE)
  ON CONFLICT (user_id, job_id) DO UPDATE SET verdict='deny', human_override=TRUE,
  reviewed_at=now()`; then `revalidatePath("/")`.
- `unrejectJob(jobId: string, priorVerdict: string | null)`: the Undo path. If
  `priorVerdict` is non-null, `UPDATE … SET verdict=priorVerdict,
  human_override=FALSE` for the operator's row; if `priorVerdict` is null (the job
  was unreviewed before the reject), `DELETE` the row that reject inserted. Then
  `revalidatePath("/")`.

### 4. Surface `human_override` (`lib/jobsQuery.ts`, `lib/types.ts`)

- `buildJobsQuery`: add `r.human_override` to the review-scoped `selectCols`.
- `JobRow`: add `human_override: boolean`.

### 5. Detail-pane Reject control (`components/rolefit/JobDetail.tsx`)

- A **Reject** button in the detail header action area, rendered only when
  `isAuthed && job.verdict !== 'deny'`. Calls an `onReject(job)` prop.
- A "rejected · you" badge when `job.human_override` is true (visible when
  browsing the Denied view). Style matches the existing tag/badge language.

### 6. Board wiring + Undo toast (`components/rolefit/RolefitBoard.tsx`, `app/page.tsx`)

- `page.tsx`: pass the `rejectJob` / `unrejectJob` server actions into
  `RolefitBoard` as props (as `saveResume` is passed today).
- `RolefitBoard`:
  - On reject: optimistically hide the job from the visible list (a `rejectedIds`
    set), clear the selection if it was the open job, call `rejectJob(job.id)`
    inside a `useTransition` (matching `CompanyCard`), and remember
    `priorVerdict = job.verdict` for the toast.
  - Show a fixed bottom **"Rejected · Undo"** toast that auto-dismisses after
    ~5 s (reuse the existing copy-timer ref pattern). Undo calls
    `unrejectJob(job.id, priorVerdict)` and un-hides the job.
  - The detail/list panes filter out `rejectedIds` so the optimistic removal is
    immediate; `revalidatePath("/")` reconciles server truth on the next load.

## Testing

- **Python**
  - `tests/test_schema.py`: `job_reviews.human_override` exists,
    `BOOLEAN NOT NULL DEFAULT FALSE`.
  - `tests/test_reviewer_db.py`: a row with `human_override=TRUE` is **not**
    modified by a subsequent `upsert_review` (verdict/columns unchanged); a normal
    (`human_override=FALSE`) row still upserts as before.
- **TypeScript**
  - `lib/jobsQuery.test.ts`: the generated SQL selects `r.human_override` when an
    owner is joined, and omits it for the anon (no-owner) path.
  - Unit-cover the SQL shape of `rejectJob` / `unrejectJob` where practical for a
    server action (assert the deny/flag write and the null-vs-restore branch).
- **Manual smoke** (post-merge, against a dev/preview DB): reject an approved job
  → it leaves the board; Undo restores it; after a poll, the rejected job's
  `description` is `NULL` and it is absent from `select_candidates`.

## Production rollout sequence (operator-assisted)

1. Merge the branch; deploy the dashboard (Vercel) and reviewer (Railway).
2. Apply `migrations/2026-06-28-job-human-override.sql` via Supabase
   (`ADD COLUMN`, instant). The new board query selects `human_override`, so the
   migration must land **before or together with** the deploy — the prior
   dashboard never references the column, so applying it early is safe.
3. Smoke-test: reject one approved job, confirm it leaves the board and Undo
   works; confirm the next poll nulls its `description`.

## Risks & mitigations

- **AI reviewer clobbers a manual reject mid-run.** Mitigated by the upsert
  stickiness guard (#2) plus `select_candidates` already excluding denies.
- **Optimistic removal diverges from server truth** (e.g. action fails).
  `revalidatePath("/")` reconciles on next load; the `useTransition` pending state
  prevents double-submits, as in `CompanyCard`.
- **Operator rejects, then wants it back after prune.** By design final; the toast
  is the only undo and is documented as effective only until the next poll. The
  JD is recoverable on a future poll only if the role is still open (it will be
  re-ingested, but stays denied — consistent with AI-deny semantics).
- **Column missing at runtime** (deploy before migration). Order the rollout so
  the migration lands with the deploy; `human_override` selection would otherwise
  error. Same operational care as any additive column.
