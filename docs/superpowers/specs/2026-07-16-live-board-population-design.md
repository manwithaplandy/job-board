# Live board population during review runs

**Date:** 2026-07-16
**Status:** Approved design, pre-implementation

## Problem

When a review request runs — most importantly the first run enqueued by
`completeOnboarding` for a brand-new user — the board gives feedback only via
the `ReviewNowPanel` counter ("N roles scored so far"). Approved matches appear
in one batch when the whole request settles and the panel calls
`router.refresh()`. A new user can watch a counter tick for minutes over an
empty board before anything appears.

Goal: approved jobs appear on the board incrementally, near-real-time, while
the review runs — for **all** on-demand review runs (first-run onboarding and
"Review my board now" re-runs alike), with a visible pop-in so the user
watches the board build.

Explicitly out of scope: changing the trigger (already exists in
`completeOnboarding`), speeding up the review itself, candidate-ordering
changes, and the nightly cron path (no active request → no panel → no stream).

## Decision summary

- **Mechanism: cursor polling** on the existing `GET /api/review/request`
  endpoint (approach chosen over Supabase Realtime and SSE). Review
  completions arrive in concurrency-5 bursts, each stage-2 eval taking
  seconds, so a 4s poll is indistinguishable from push here. Load scales with
  *concurrent watchers of active runs*, not total users; at this product's
  scale it is noise next to the LLM run it watches. The transport is isolated
  behind one callback seam so a later swap to Realtime touches only the poll
  hook, not the merge/animation logic.
- **Scope:** every active review request streams; not first-run-only.
- **Arrival UX:** visible pop-in (slide/fade + decaying highlight).

## Architecture

Unchanged: signup → onboarding → `enqueueReviewRequest` → always-on reviewer
worker claims the `review_requests` row and runs `_review_user`, upserting
`job_reviews` with `reviewed_at = now()` (also bumped on re-review upserts,
`reviewer/db.py:27`). Settle-time `router.refresh()` stays the authoritative
reconcile.

New: while the request is `pending|running`, the board's existing poll gains a
cursor and returns newly approved matches, which the client merges as an
overlay.

**No migrations. No Python/Railway changes.** Frontend + one query function.
Backward-compatible endpoint change (clients that don't send `since` see
today's behavior).

## API

`GET /api/review/request` (authed, not in `PUBLIC_PREFIXES`) gains:

- Optional `?since=<cursor>` query param.
- Response fields `cursor: string` (always) and `newMatches: JobRow[]`
  (non-empty only when `since` was provided and new approvals exist).

Cursor semantics:

- `cursor` is **server-generated** (`now()` captured in the same round-trip).
  The client echoes back the last cursor it received and never uses its own
  clock — no skew hazard.
- First poll sends no `since` → establishes the cursor, returns no rows
  (pre-cursor rows are already in the server-rendered props).
- Delta query: viewer's `job_reviews` where `verdict = 'approve'` and
  `reviewed_at > since − 10s`. The overlap window plus client dedupe-by-job-id
  gives **at-least-once** delivery: duplicates are harmless, gaps are what we
  avoid.

Query implementation: new `getJobsReviewedSince(viewerId, viewerLocations,
since)` in `dashboard/lib/queries.ts`, reusing `buildJobsQuery` with the one
extra `reviewed_at` predicate so rows come back in exactly the board's
`JobRow` shape, with the same location pre-filter, under `withUserSql`
(RLS-scoped). Served by the existing `idx_job_reviews_user_verdict` index.

**Self-healing guarantee:** the stream is cosmetic-best-effort. Anything a
poll misses (in-flight transaction, closed tab, failed tick) is delivered by
the settle-time `router.refresh()`. The stream can only show a subset early —
never persistent wrong state.

## Client

**Poll ownership stays with `ReviewNowPanel`** (it already owns the status
loop and settle transition):

- Interval 10s → **4s while `running`** (stays 10s while `pending` — nothing
  to stream from a queued request).
- Threads the cursor through a ref, appends `since=` to its existing GET.
- New prop `onNewMatches(rows: JobRow[])`, called when a poll returns rows.
- Existing `onSettled` → `router.refresh()` unchanged, fires exactly once.

**Merge lives in `RolefitBoard`** as an overlay (mirrors the existing
`corrections` overlay pattern):

- New state `liveMatches: Record<string, JobRow>` keyed by job id. Working
  list = `props.jobs ⊕ liveMatches`; overlay entries whose id exists in props
  are dropped (**props win**). Merged rows flow through the existing client
  filter/sort pipeline untouched, so arrivals respect active filters and sort
  into correct position.
- **Prune, don't clear:** an effect removes overlay entries whose id appears
  in `props.jobs`. When the settle-refresh lands, entries prune away naturally
  — no flicker window.
- Delta rows pass through the same `toJobRow` codec boundary as the
  server-rendered board; malformed rows are rejected at the boundary (jsonb
  hardening rule), never crash the board.

**Pop-in:** ~2.5s entrance — slide/fade plus a background highlight that
decays — built on design-system tokens (both themes), tracked via a transient
`newIds` set with timestamps. `prefers-reduced-motion` → no motion, keep the
brief highlight. First-run boards visibly assemble row by row; on re-runs the
highlight makes mid-list insertions findable.

**Panel UX:** "Your board is being built" card and the "N roles scored so
far" counter stay as-is; the counter carries progress for reviewed-but-denied
jobs that never appear as rows.

## Edge cases

- **Tab closed mid-run, reopened:** RSC re-renders with all reviews so far
  (`force-dynamic`); panel resumes and establishes a fresh cursor. The
  ≤one-tick render-to-first-cursor gap self-heals at settle.
- **Re-review upserts a job already on the board:** dedupe drops it (props
  win); settle-refresh delivers updated scores. Live rows never fight the
  corrections overlay.
- **approve→deny flip mid-run:** not removed live; settle-refresh removes it.
  Accepted transient, self-correcting.
- **Request fails:** panel already stops on `failed`; streamed rows stay
  (they're real reviews); refresh reconciles.
- **Multiple tabs:** independent cursors, per-tab dedupe; harmless.
- **Poll tick errors:** skip, retry next tick, keep last good cursor
  (at-least-once makes retries safe). No error banner for a cosmetic stream
  (no-banner-for-benign-states convention).

## Testing

- **Query/route (vitest + pg):** `getJobsReviewedSince` returns only the
  viewer's approved rows after the cursor, respects the location pre-filter
  and RLS; route always returns `cursor`, returns `newMatches` only with
  `since`.
- **Component (jsdom):** board merges `onNewMatches` rows, drops ids already
  in props, prunes on props update, applies/expires the highlight class;
  panel threads the cursor, calls `onNewMatches`, tightens the interval while
  `running`, still fires `onSettled` exactly once.
- **UI-contract suite** runs as-is over the new markup.
- **Live smoke:** dev-shim harness in a worktree — enqueue a review for a
  test user, watch the board populate; verify light + dark.

## Rollout

Frontend-only; deploy in any order; endpoint change backward-compatible.

## Scaling posture (recorded for the future)

Polling cost scales with concurrent active-run watchers, not signups; the
first real bottlenecks at scale are the single reviewer worker (queue wait)
and LLM spend, both orders of magnitude larger than poll traffic. If
concurrent watchers ever reach the thousands, swap the panel's poll for a
Supabase Realtime subscription feeding the same `onNewMatches` seam.
