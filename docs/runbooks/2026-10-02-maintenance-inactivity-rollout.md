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
3. During the separately authorized cutover, stop scheduling new poller/reviewer work
   and gracefully drain every old reviewer worker and poller. Confirm no old instance
   can consume requests or run legacy pruning. Do not touch the unrelated company
   discovery deployment or its five staged Railway changes.
4. Apply the matching-activity and feedback migrations while those old processes are
   stopped, before new dashboard/workers. Their definitions must match the reviewed
   commit, including `review_requests.claim_version`; no jobs data migration or cleanup
   command is part of this step. Start only new Python reviewer/poller versions, then
   release the new dashboard. Do not mix old queue consumers with new resume requests:
   old code does not enforce pause, resume markers or claim fencing. Verify paid
   entitlement and pause status with test accounts, a deliberate action, explicit resume,
   repeated resume, stale recovery/reclaim and an unauthorized request.
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
inactivity enforcement and claim fencing: stop/drain new consumers before any downgrade,
keep the metadata, and do not reactivate old consumers against live new resume requests.
A forward fix while affected consumers are stopped is the preferred recovery. Never resume ingestion by
raising the guard merely to work around physical file size.

## Read-only dry-run acceptance criteria

- Verify the destination against the repository production reference before querying.
  Use `BEGIN READ ONLY` and a statement timeout. The supplied SQL uses the default
  30-day retention; if a rollout intentionally configures another positive retention,
  change the estimate to that exact value before interpreting its result.
- A candidate must have `closed_at` older than that retention, no approved review,
  no correction of any verdict, and no application package of any status. `last_seen_at`
  and company activation state never substitute for this predicate.
- The recorded baseline is zero candidates. If pre-cutover candidates now appear,
  review their closure/source evidence before enabling automatic maintenance. Legacy
  `closed_at` alone does not prove the old crawler returned a complete source listing.
  A failed/incomplete check in the new code must not create new closures.
- Verify the intended cleanup batch/cap (defaults 2000/20000), READ COMMITTED isolation,
  and actual free disk/WAL headroom. Candidate counts/payload bytes do not measure
  filesystem bytes recoverable. No guard increase or rewrite is authorized by a dry-run.
- Abort rollout if the destination, protection predicates, source completeness, backup
  posture or headroom cannot be established. Keep source reconciliation failures visible;
  do not compensate by deleting open/inactive-company jobs or backdating closure age.
- The read-only estimate never authorizes mutation. Deployment/production maintenance
  still require the parent's separate approval; no production deletion was run here.

## Final implementation semantics

- `2026-10-02-matching-activity.sql` adds `matching_activity` and the queue's
  `resume_requested` marker and monotonic `claim_version` fencing. Existing profiles start a seven-day rollout grace period
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
  lock across processes. Execution and completion require the same running claim version,
  preventing delayed/recovered workers from consuming a reassigned request. Daily budgets
  remain enforced, including a resume after today's
  budget is spent. Existing jobs and application history remain available.
- `2026-10-02-feedback.sql` adds owner-readable feedback and an authenticated RPC.
  Raw user writes and anonymous access are revoked. Identity is taken from the session,
  text/type validation happens in application and database, and a per-user transaction
  lock enforces five messages per rolling hour. Stale transaction isolation modes are
  refused. Feedback and matching activity are included in account export/deletion. The erasure
  sweep shares the feedback transaction lock, so an earlier in-flight submission is
  committed and then erased rather than surviving the sweep.
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


## Final publication review of 4105c43

A fresh independent reviewer checked the complete `73ce118..4105c43` diff and ran
120 focused local tests. Two additional scoped races were reproduced:

1. Recovery in the user-lock-release/queue-finish gap could lose a pending resume.
   Completion is now conditional on running status and claim version; execution also
   rechecks that version after acquiring the user lock. Three new deterministic tests
   cover recovered pending work, recovered/reclaimed work and a delayed pre-lock worker.
2. An uncommitted feedback submission could survive erasure. The deletion transaction
   now acquires the feedback writer's lock before sweeping; two real-DB tests cover the
   opposite transaction orderings.

Both were observed failing before the fix and passing afterward. Rollout instructions
now explicitly prohibit mixed old/new queue consumers and define dry-run stop criteria.
The latest commit supersedes 4105c43 for publication; no publication or deployment was
performed. Final post-review suite counts and migration rehearsal are recorded below.

Post-review verification: **794 Python tests passed, 0 failed/skipped**; **1,676
dashboard tests passed, 14 skipped**, including feedback rate/security and both erasure
race tests. TypeScript typecheck and relevant lint checks passed. Revised migrations
were applied twice to a new local database from `73ce118`, preserving the existing
profile and queued request, initializing claim version to zero, and keeping exactly
two migration ledger records. The checked-in schema matches both final migrations.

## Production-default grant rehearsal

The pre-application audit found direct `anon` and `authenticated` EXECUTE default
privileges on new public functions, in addition to PostgreSQL's PUBLIC default.
The original matching migration revoked only PUBLIC, so the vanilla-Postgres
rehearsal did not prove anonymous denial under the production defaults.

The matching migration and schema mirror now revoke PUBLIC, anon and authenticated
access on all three new functions, then restore authenticated EXECUTE only on
`matching_paused` and `resume_matching`. The internal trigger needs no client
EXECUTE grant. The matching table also explicitly revokes PUBLIC. Existing
service_role privileges are retained. Feedback already explicitly revokes these
client grants on its table, identity sequence and RPC; it needs no SQL change.
No role, default privilege, existing unrelated function or policy is changed.

The SQL review retained invoker RLS for matching status, checked session identity
for the resume/feedback definers, and pinned function search paths. The regression
suite exercises both migration files and the schema mirror twice with production-
equivalent per-role defaults. It covers ACL and actual anonymous denials, owner
reads/RPCs, cross-tenant isolation, trigger execution after client EXECUTE revocation,
missing identity, temporary-table shadowing, service_role access, preserved queue
rows, and unchanged unrelated/default grants. The original code failed 10 checks.

Local verification after the correction: 846 Python tests passed; 1,676 dashboard
tests passed (14 skipped), including feedback concurrency and erasure races;
3 auth-harness browser tests passed. Typecheck, Ruff, ESLint (zero errors, nine
warnings in unchanged files), and diff checks passed. Production migrations remain
unapplied; latest-head authenticated preview approval and parent rollout release
remain separate gates.
