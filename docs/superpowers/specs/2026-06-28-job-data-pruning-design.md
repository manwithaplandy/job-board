# Job-Data Pruning & `raw` Elimination — Design

**Date:** 2026-06-28
**Status:** approved for planning
**Author:** session with operator (Andrew)

## Context

The job-board polls company ATS feeds every 2 hours, stores each open role, and
AI-reviews roles against the operator's resume/instructions. After auto-discovery
activated ~6,400 companies, the database grew to **1.1 GB** and threatened the
8 GB Supabase Pro volume (a disk-full crash loop already caused one outage; a
6 GB safety guard now halts the poller/discovery before the wall). The operator
needs a way to keep expanding scope — more companies, more roles — without the
database marching back into the ceiling.

### Where the space actually goes (measured 2026-06-28)

| Piece | Size | % of DB |
|---|---|---|
| `jobs` TOAST (= the `raw` JSONB column) | **1013 MB** | **92%** |
| `jobs` heap (title/url/location/dept/…) | 40 MB | 3.6% |
| `jobs` indexes | 15 MB | 1.4% |
| Everything else (companies, all reviews, runs) | ~13 MB | 1.2% |

Key findings driving this design:

- **The entire size problem is one column, `jobs.raw`.** It averages **16 kB/row**
  across 114,823 jobs and the poller **rewrites it on every poll**, so it churns
  constantly.
- **`raw` is never read by anything user-facing.** Its *only* consumer is
  `extract_description(ats, raw)`, which distills the plaintext JD into
  `jobs.description` (avg **5.7 kB**). The reviewer sends the model only
  `title/company/location` (stage 1) and that distilled `description` (stage 2) —
  never the raw JSON. The dashboard reads `description` + `job_reviews` fields,
  never `raw`. So `description` already contains 100% of what `raw` is used for;
  the ~10 kB difference is HTML markup + structured metadata nothing consumes.
- **99.7% of jobs are unreviewed** (114,522), with 149 approved + 153 denied +
  the rest gate-rejected/unreviewed. So almost all of that 1 GB is `raw` attached
  to jobs nobody has looked at.
- **All jobs belong to *active* companies** today — deactivated companies were
  filtered out *before* polling and never accrued jobs. So "prune inactive
  companies' jobs" is a forward-looking rule, not a present win.

## Goals

1. Stop the dominant storage cost: never persist `raw`; store the distilled
   `description` instead. ~65% smaller per job, no more blob churn.
2. Reclaim the existing ~1 GB safely (no repeat of the WAL/disk incident).
3. Keep rich data only where it's useful and keep a lightweight record where it
   isn't — implement the operator's lifecycle rules:
   - **Denied** role (auto: `verdict='deny'` or `stage1_decision='reject'`) →
     keep the review record + minimal job identity, **drop `description`**.
   - **Closed** role (dropped from the ATS feed) → **delete** after a retention
     window, unless it was approved.
   - **Deactivated company's** roles → **delete**, unless approved.
   - **Approved** role → **keep `description`** (the "best jobs" tier).
4. Preserve correctness of the review + dashboard pipeline throughout.

## Non-goals

- Lazy/at-review JD fetching over HTTP (the higher-headroom "Option C"). Rejected
  in favor of the simpler, no-network path.
- Size-budget-triggered emergency pruning. The existing 6 GB guard already pauses
  growth; pruning here is continuous hygiene, not a panic valve.
- A human "reject this job" UI/action. None exists today (jobs have no human
  override; only companies do). The pruning sweep keys off the review verdict, so
  if such a feature later sets `verdict='deny'`, pruning picks it up for free.
- Touching the production-only `job_reviews.user_id → auth.users` FK (it exists in
  prod but not in `schema.sql`; out of scope).

## Architecture

`jobs.raw` is eliminated. The plaintext JD becomes the single stored artifact in
`jobs.description`, produced **at poll time** and treated as **insert-only**.

### Why `description` is insert-only

The poller re-upserts every open job every 2 hours. If it overwrote
`description` on each poll (as it does `raw` today), any pruning we do would be
undone on the next cycle — the same churn that makes `raw` expensive. So
`description` is written **only on INSERT** (first sighting) and never touched on
the conflict/UPDATE path. This makes pruning durable.

**Accepted trade-off:** once a denied job's `description` is pruned, there is no
`raw` to re-derive it from, so that job cannot be re-evaluated *with its JD* on a
future profile-version change (it can still be title-gated). This is consistent
with the operator's intent ("denied → minimal, delete the data to make room").
Insert-only also means a company editing a live JD won't be picked up; this is
acceptable (rare, non-critical).

## Component changes

### 1. Move JD extraction to the ingest layer
- Move `extract_description` (+ `html_to_text`, `_lever`) from `reviewer/jd.py`
  to **`poller/jd.py`**. It's a pure function and is now an ingest concern.
  `reviewer/__main__.py` already imports `poller`, so reviewer importing
  `poller.jd` keeps the dependency direction clean.
- Update `tests/test_jd.py` import path.

### 2. Poller stores `description`, never `raw`
- `poller/db.py::upsert_job`: compute `description = extract_description(ats, p.raw)`;
  put `description` in the INSERT column list; **remove `raw`** from both the
  INSERT and the `ON CONFLICT DO UPDATE SET`. Leave `description` out of the
  UPDATE `SET` (insert-only). `raw` still rides in memory on the `Posting`; it is
  simply never written.
- `poller/models.py`: `Posting.raw` stays (adapters still populate it in memory
  as the extraction source).

### 3. Reviewer reads stored `description`
- `reviewer/db.py::select_candidates`: select `j.description` instead of `j.raw`.
- `reviewer/run.py::review_one`: use `candidate["description"]` directly as the
  stage-2 `jd` (drop the inline `extract_description(ats, raw)` call). Keep the
  `_NO_JD` fallback when it is null.
- Remove the now-redundant `db.set_job_description` write-back
  (`reviewer/run.py:147-148`) — `description` is already persisted at poll time.
  Remove `set_job_description` from `reviewer/db.py` (its only caller is that
  write-back) and drop the `description` field from `ReviewResult`.
- **Transition safety:** during the migration window (after deploy, before the
  backfill finishes and `raw` is dropped), keep `select_candidates` also
  selecting `j.raw` and have `review_one` fall back to `extract_description` when
  `description` is null. This fallback is removed in the cleanup commit after
  `raw` is dropped.

### 4. Lifecycle pruning sweep
A new `poller/prune.py::prune_jobs(conn)` called at the end of a poll run (after
`review_all`). All operations are **batched** (`PRUNE_BATCH_SIZE`, default 2000,
commit per batch) and **bounded per sweep** (`PRUNE_MAX_ROWS_PER_RUN`, default
20,000 — applied independently to each of Rules A/B/C) so a single run can never
generate a large WAL burst. Remaining work is picked up on the next poll.

- **Rule A — denied → drop description.** For jobs whose `job_reviews` row has
  `verdict='deny'` OR `stage1_decision='reject'`, and `description IS NOT NULL`:
  `UPDATE jobs SET description = NULL`. Keeps the `jobs` row and the `job_reviews`
  record (the "reviewed & rejected" record the operator wants).
- **Rule B — closed → delete after retention.** Delete `jobs` where
  `closed_at IS NOT NULL` and `closed_at < now() - (CLOSED_JOB_RETENTION_DAYS ||
  ' days')::interval` and the job is **not approved** (no `job_reviews` row with
  `verdict='approve'`). `CLOSED_JOB_RETENTION_DAYS` default **30**.
- **Rule C — deactivated company → delete.** Delete `jobs` joined to a company
  with `active = FALSE` that are **not approved**.

Approved jobs are spared by Rules B and C to preserve application history.

### 5. Schema / migrations
- `migrations/2026-06-28-job-data-pruning.sql`:
  - `ALTER TABLE job_reviews DROP CONSTRAINT job_reviews_job_id_fkey,
     ADD CONSTRAINT job_reviews_job_id_fkey FOREIGN KEY (job_id)
     REFERENCES jobs(id) ON DELETE CASCADE;` (so deleting a job removes its
    review in one statement).
  - `ALTER TABLE jobs DROP COLUMN raw;` (run **after** the backfill).
- `schema.sql`: remove the `raw` column from `jobs`; add `ON DELETE CASCADE` to
  the `job_reviews.job_id` FK; update the disk-safety-valve comment (a poll no
  longer adds ~1.8 GB).

### 6. Config
- `poller/config.py` (or reuse existing env helper): `CLOSED_JOB_RETENTION_DAYS`
  (default 30), `PRUNE_BATCH_SIZE` (default 2000), `PRUNE_MAX_ROWS_PER_RUN`
  (default 20000).

## One-time backfill of existing rows

`python -m poller.backfill_descriptions` (a new `poller/backfill_descriptions.py`):
- Loops batches (default 2000) of `jobs` where `description IS NULL AND raw IS NOT NULL`:
  for each, compute `extract_description(ats, raw)` and
  `UPDATE jobs SET description = <value>, raw = NULL WHERE id = ...`.
- Commits per batch; logs progress (`N/total`).
- Idempotent and resumable (only touches null-description rows); safe to re-run.
- Nulling `raw` in the same UPDATE turns the raw TOAST into dead tuples
  immediately; batched commits keep WAL bounded. With ~7 GB free, peak usage
  (descriptions added while raw still partly present + dead tuples) is safe.

Jobs where extraction yields NULL (no JD in the payload) keep `description = NULL`;
they remain reviewable via the title gate and are pruned normally.

## Production rollout sequence (operator-assisted)

Ordered so no job ever lacks a JD source, and no unbounded write occurs:

1. **Deploy code** (transition-safe reviewer fallback active). Poller now stores
   `description` and stops writing `raw`; existing rows still have `raw`.
2. **Run backfill** via `python -m poller.backfill_descriptions` until
   `SELECT count(*) FROM jobs WHERE closed_at IS NULL AND description IS NULL AND
   raw IS NOT NULL = 0`.
3. **Verify** the count is 0 (open jobs all have descriptions).
4. **Apply migration**: add the `ON DELETE CASCADE`, then `DROP COLUMN raw`
   (the drop is an instant catalog change; it does not reclaim disk yet).
5. **Reclaim disk**: pause the poller (Railway), run **`VACUUM FULL jobs;`** in
   the **Supabase dashboard SQL editor** (MCP can't run VACUUM — it wraps
   statements in a transaction), then resume the poller. ⚠️ This is the one step
   the operator runs by hand; the assistant pauses/resumes the poller and
   provides the exact statement. We have ~7 GB free, so the rewrite is safe.
6. **Cleanup commit**: remove the reviewer's `raw` fallback and the `j.raw`
   select; finalize `schema.sql`. Deploy.

## Expected outcome

- Per-job storage **16 kB → ~5.7 kB** (~65% cut); no more 2-hourly blob rewrite.
- DB after backfill + VACUUM FULL: ~**0.7 GB** (heap + descriptions + indexes),
  down from 1.1 GB, and growing ~3× slower per job.
- Headroom under the 6 GB guard rises from **~3×** to **~9–10×** today's scope;
  lifecycle pruning extends it further as denied/closed jobs are reclaimed.

## Testing

- `tests/test_jd.py`: update import to `poller.jd`.
- New poller test: `upsert_job` stores `description` and never writes `raw`;
  re-upsert (conflict path) does **not** overwrite an existing `description`.
- New `tests/test_backfill.py`: backfill populates `description` from `raw`,
  nulls `raw`, is idempotent, and skips already-populated rows.
- New `tests/test_prune.py`: Rule A nulls denied descriptions (keeps rows); Rule
  B deletes only old closed non-approved jobs; Rule C deletes inactive-company
  non-approved jobs; approved jobs survive B and C; batching/cap respected.
- Update `tests/test_reviewer_db.py`, `tests/test_reviewer_run.py`,
  `tests/test_greenhouse.py`, `tests/test_normalize.py` for the raw→description
  swap and moved function.
- DB-integration tests (cascade delete, prune sweeps) run under
  `TEST_DATABASE_URL` like the existing suite.
- Full suite green: `pytest -q`.

## Risks & mitigations

- **WAL/disk during backfill** (the prior incident): batched commits + bounded
  per-run prune caps + ~7 GB free headroom; no un-batched mass DELETE/rollback.
- **`VACUUM FULL` table lock**: poller paused during the (single, quick) run.
- **Re-review of pruned denied jobs**: documented accepted limitation (no JD
  source post-prune). Revisit only if profile-change re-rescue becomes desired.
- **Transition window correctness**: reviewer `raw` fallback guarantees every job
  is reviewable until the backfill completes and `raw` is dropped.
