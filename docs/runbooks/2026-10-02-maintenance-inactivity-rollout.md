# Maintenance, inactivity and feedback rollout

Status: implementation branch only. Production migrations, deletion, deployment,
Railway staged changes, pushes and PRs have NOT been authorized by this task.
Base: `73ce118`; branch: `feat/maintenance-inactivity`.

## Read-only production findings

On 2026-10-02 at 20:12:49 UTC, the connected Supabase project identified by
`README.md` and `docs/runbooks/backup-restore.md` as production job-board was queried
inside `BEGIN READ ONLY`, with a 20-second statement timeout. No rows or schema were
changed. The first attempted query was rejected by automatic approval review until
repository evidence established the destination; a later aggregate query with an
incorrect `raw` column failed, then the corrected query below succeeded.

| Measurement | Result |
| --- | ---: |
| Database bytes | 6,644,329,619 |
| Jobs total bytes (heap, indexes, TOAST) | 6,304,456,704 |
| Jobs heap bytes | 1,239,777,280 |
| Jobs indexes bytes | 355,909,632 |
| Total job rows | 1,270,008 |
| Closed rows, all older than 30 days | 148 |
| Protected by approved reviews | 147 |
| Protected by application packages | 7 |
| Protected by corrections | 0 |
| Eligible safe deletion rows | **0** |
| Eligible description payload bytes | **0** |

Protection counts overlap. All closed rows are protected by at least one rule.
The measurement is a snapshot, not a forecast. Re-run
[the read-only SQL](sql/maintenance-cleanup-estimate.sql) before an authorized rollout.
Newly confirmed closures begin their retention period when detected; stale
`last_seen_at` must not backdate it. Failed, incomplete or ambiguous source checks
cannot supply deletion eligibility, and inactive companies are not deletion proof.

## Disk and compute limits

The 6000 MiB guard remains unchanged. Ordinary deletes/updates generate WAL and
leave dead tuples. Routine vacuum generally makes space reusable inside PostgreSQL;
it does not guarantee a smaller relation file or a lower `pg_database_size`, so even
successful future cleanup may not clear the ingestion guard. A table rewrite such
as `VACUUM FULL` needs extra free space and an exclusive lock. Do not run it blindly
near the disk limit. These are PostgreSQL's documented
[vacuum behaviors](https://www.postgresql.org/docs/current/routine-vacuuming.html).

The large difference between jobs total size and heap/index size includes TOAST
storage. A payload-byte sum cannot predict filesystem space recovery. With zero
current safe candidates, this change promises **no immediate disk reclamation**.
Plan a separately authorized capacity/retention/archival intervention if bounded
closure reconciliation does not create enough safe reusable space after retention.

Free/comped inactivity reduces personalized matching work only. Company discovery's
always-on admin queue and weekly LLM-backed free ingestion are separate baseline
workloads. They are not disabled here. The five staged Railway discovery changes
are unrelated and must not be applied as part of this rollout.

## Rollout sequence (requires separate authorization)

1. Review the final branch and test evidence. Verify backup/restore posture and
   deployment topology using the existing runbooks. Confirm enough disk/WAL headroom
   for additive metadata migrations and source-confirmed closure updates.
2. Rehearse both new migrations against a disposable database created from the
   prior schema, and exercise tenant grants, queue concurrency and rollback behavior.
3. Apply the matching-activity and feedback migrations before new dashboard/workers.
   Their schema definitions must match the checked-in schema; no jobs data migration
   or production cleanup command is part of this step.
4. Release dashboard and Python reviewer/poller from the same reviewed commit.
   Verify paid entitlement and pause status with test accounts, a deliberate action,
   explicit resume, queued execution, repeated resume and an unauthorized request.
5. Observe a guarded poll: zero ingestion/enrichment, successful source checks may
   close missing postings, failed/incomplete checks must not close anything. Inspect
   poll summaries, maintenance counts and WAL/disk headroom. Keep sweeps bounded.
6. Monitor feedback limits, RLS denials, reviewer pause counts and duplicate queue
   behavior. Repeat the read-only estimate after retention expires. Decide separately
   whether physical reclamation or capacity work is appropriate.

## Rollback constraints

Keep additive metadata tables/functions on rollback so feedback and activity history
are preserved. Do not drop tables as a rollback shortcut. Reverting the entire old
poller also restores unsafe shared-description/inactive-company pruning; prefer a
forward fix or stop the affected maintenance process. Reverting the reviewer removes
inactivity enforcement, so coordinate that explicitly. Never resume ingestion by
raising the guard merely to work around physical file size.

Implementation-specific migration semantics and final verification are recorded below
when integration is complete.

## Final implementation semantics

- `2026-10-02-matching-activity.sql` adds `matching_activity` and the queue's
  `resume_requested` marker. Existing profiles start a seven-day rollout grace period
  at migration time, because historical meaningful activity is unknown. New profiles
  initialize the same clock. Reapplying the migration does not reset existing clocks.
- Actual active Stripe subscriptions with a recognized plan and nonempty subscription
  ID bypass inactivity while within the entitlement system's existing three-day
  period-end grace. Trials, invite comps and operator tier overrides do not qualify
  merely because their effective tier says Standard or Pro.
- Explicit profile changes, corrections, company overrides, manual job rejection/undo
  and application applied/unapplied transitions count as meaningful activity. Automatic
  reviews/generation and background GET polling do not. Board-filter persistence also
  does not count, because the browser can save it through a passive pagehide beacon.
- Once inactivity has paused matching, ordinary saved changes preserve that pause.
  The board's Resume matching action clears it and queues work atomically. A running
  request receives one durable follow-up marker when necessary. Eligibility is freshly
  evaluated after the shared per-user review lock; stale recovery respects that database
  lock across processes. Daily budgets remain enforced, including a resume after today's
  budget is spent. Existing jobs and application history remain available.
- `2026-10-02-feedback.sql` adds owner-readable feedback and an authenticated RPC.
  Raw user writes and anonymous access are revoked. Identity is taken from the session,
  text/type validation happens in application and database, and a per-user transaction
  lock enforces five messages per rolling hour. Stale transaction isolation modes are
  refused. Feedback and matching activity are included in account export/deletion.
- Cleanup locks candidate jobs and existing reviews, then rechecks protections using
  a fresh READ COMMITTED snapshot. Busy history updates yield the sweep. The row cap
  applies to cleanup. Source reconciliation close/reopen transactions still cover one
  company at a time and can generate substantial WAL for a large board; watch headroom.
- Workday crawls that hit caps, wrapping, missing/duplicate identifiers, incomplete
  partitions or insufficient cardinality are conservative: the company transaction is
  rolled back rather than treating an incomplete listing as closure evidence. Existing
  large-empty-source protection remains. Operators must inspect failed companies;
  reconciliation is not guaranteed for every provider on every run.
- Previously stripped descriptions are not reconstructed. No production rows were
  recovered, closed, deleted or updated during implementation.

## Verification evidence

All database mutation tests used explicitly local disposable databases at
`127.0.0.1:55432`, separate from connected production.

- Baseline unit-only Python: 481 passed, 259 DB tests skipped.
- Baseline dashboard: 1,657 passed, 14 skipped.
- Closure focused final: 116 passed; includes partial/failed sources, guarded polls,
  changing/duplicate pages, reopen-before-prune, and concurrent history protections.
- Inactivity focused final: 26 passed; includes real concurrent resumes, billing/resume
  races and cross-process stale recovery. Earlier reviewer-focused run: 127 passed.
- Full dashboard including local feedback DB checks: 1,674 passed, 14 skipped.
- Feedback database security checks: 5 passed, including 12 simultaneous submissions
  with exactly 5 accepted, direct mutation denials, owner isolation and stale snapshots.
- Migration rehearsal: original `73ce118` schema, existing profile, both migrations
  applied twice; one initialized activity row, two migration records, anonymous RPC
  execution denied. Both migrations are mirrored into `schema.sql`.
- TypeScript typecheck, Python Ruff and changed dashboard ESLint checks passed.
- Independent review found incomplete Workday enumeration, concurrent-approval pruning,
  and cross-process queue recovery issues; all received failing regression tests and fixes.
- The first integrated Python run exposed two expected security-inventory omissions
  for the new tables (780 tests passed); both contracts were updated and their 17-test
  suite passed. Final full-suite result is appended below.

Authenticated live-browser verification was not performed: the prepared local dashboard
has placeholder Supabase auth settings. Component, route, schema, concurrency and access
checks above run locally; perform authenticated release smoke tests before deployment.

Final integrated Python verification: **791 passed, 0 failed, 0 skipped** in 75.45s
using `TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/poller_test .venv/bin/pytest -q`.
