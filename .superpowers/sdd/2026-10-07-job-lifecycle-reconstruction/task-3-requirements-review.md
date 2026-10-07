# Task 3 independent requirements / quality review

Spec verdict: **FAIL**  
Quality verdict: **CHANGES_REQUIRED**

Reviewed BASE `ecf4b980bb254349a30af30d2f625afddaf30ad5` through HEAD
`6538fc70a8dc5d49d3a0812f18542730c49c381b` on `feature/lifecycle-recovery`.
Reviewer is independent of the implementation author. No implementation or Git
changes were made. Only this review and its local probe artifacts were written.

## Findings

### R1 — P1: Company-discovery callers hold the new global gate across HTTP, provider throttling, and waits

The gate installation includes `companies`, `company_reviews`, and
`classification_jobs` (`migrations/2026-10-03-02-lifecycle-safety.sql:107` and
`:111`). Their actual callers in `company_discovery/` are absent from the
submitted `task-3-evidence/caller-inventory.txt`, and their transaction boundaries
were not integrated.

In `company_discovery/enrich_apply.py:83`, all HTTP tasks are submitted and results
are consumed as they finish. `apply_enrichment` at line 90 writes `companies`,
acquiring the global transaction gate. The next iteration waits on remaining HTTP
without committing. This is a newly introduced application-wide blocking effect
of installing Task 3's mandatory statement triggers, including with flags off.
Every approval, generation request, account erasure, and lifecycle mutation can
then wait or hit its two-second lock timeout behind slow company HTTP.

Other concrete caller paths belonging to the same fix are:

- `company_discovery/worker.py:315`: weekly ingest writes candidate companies,
  then calls HTTP enrichment at line 327, committing only at line 332.
- `company_discovery/worker.py:199`: the SERP loop writes the first result at line
  204, then performs later HTTP and the provider's `time.sleep` throttle before
  the commit at line 209. The following enrichment uses the same transaction.
- `company_discovery/run.py:95`: candidate reads remain in a transaction while
  enrichment runs; when no enrichment succeeds, its conditional commit is
  skipped and model work begins in the read transaction at lines 100–104.
- `company_discovery/worker.py:188`: the analogous classification path retains
  its read transaction when neither SERP nor enrichment writes occur.
- `company_discovery/name_backfill.py:66` and
  `company_discovery/enrich_backfill.py:81`: HTTP futures are consumed between
  writes, with commits only every 50 writes. Both now hold the lifecycle gate
  during later network waits.

**Reproduction:** The owned PostgreSQL 17.11 probe calls the real
`enrich_selected(..., max_workers=1)` with two local fetch doubles. An Event lets
the second fetch observe the database only after the first real company UPDATE.
It records `transaction: INTRANS` and an independent backend's
`pg_try_advisory_xact_lock(20916294442894917)` returns `false`. This does not rely
on a sleep-based race guess and makes no provider call.

**Required correction:** Complete the source caller inventory, including company
discovery, and separate every network/model/throttle phase from all transactions.
Persist successful results in bounded short transactions while preserving existing
partial-result, retry, cancellation, accounting, and failure semantics. Add tests
that observe the actual connection idle and the global gate available during
fake fetch/model callbacks, including partially successful multi-company work and
the no-enrichment branch. A table/FK trigger inventory alone cannot establish this
caller contract.

### R2 — P2: Greenhouse polling refetches and overwrites already-cached questions, and can mark a healthy board failed

`job_discovery/run.py:89` passes every seen feed ID to `spool_questions`.
`job_discovery/lifecycle/legacy_spool.py:62` unions those IDs with the missing-only
query, so cached jobs are fetched on every ordinary poll. The write at
`job_discovery/run.py:112` calls an upsert that overwrites existing questions and
`fetched_at` (`job_discovery/db.py:242`). The previous rolling-backfill path fetched
only jobs without a question row. This breaks the binding flag-off legacy
compatibility requirement; it is not the later Task 7 removal of routine backfill.

The unnecessary fetches also run before any feed admission. Exhausting the new
question-spool deadline raises out of the context manager and reaches the board
failure handler, even though source enumeration was complete and all jobs already
had cached questions. Repeated failures can affect the existing failure-disabled
source policy.

**Reproduction:** In a fresh owned PostgreSQL 17.11 database, the real poll runner
with two synthetic Greenhouse jobs succeeds twice; the second unchanged poll
still performs both question HTTP callbacks. Replacing the stored question JSON
with a distinct valid cached value and polling again overwrites both rows. With
the spool's local monotonic clock advanced beyond 120 seconds before the second
unnecessary fetch, the same complete cached feed returns
`{"ok":0,"failed":1,"new_jobs":0,"closed_jobs":0}` and increments
`companies.poll_failures` to 1. All HTTP is replaced with local doubles.

**Required correction:** Select the old missing-only backlog plus genuinely new
admissible feed jobs, excluding existing cached IDs. Preserve cached rows and
avoid treating optional backfill exhaustion as evidence that source enumeration
failed. Keep the transaction-free network boundary and bounded memory/disk/write
limits. Add an actual `run()` regression for unchanged cached feeds; the existing
`test_backfill_fetches_only_missing_and_persists` exercises the standalone helper,
which does not pass the problematic `seen` set.

### R3 — P2: Several existing multi-Job service writers still skip the required sorted Job locks

The explicit contract is global gate → sorted namespaced Job keys → row/FK
locks. `lock_jobs` implements it and the main upsert, mapper, reviewer persistence,
and legacy prune now use it. However, these existing service paths still issue
multi-Job DML directly:

- `job_discovery/db.py:186` (`reopen_jobs`) and `:196` (`close_jobs`) issue set-based
  Job UPDATEs without selecting/acquiring the affected sorted Job keys first.
- `job_discovery/locations.py:61` (`stamp_jobs`) executes its set-based Job UPDATE
  directly; its SQL at line 35 contains no ordered prelock step.
- `reviewer/backfill_floors.py:53` iterates a fetched set of private Job review
  rows, updating them before any sorted Job-key acquisition.

The statement trigger acquires the global gate, but the Job key is acquired only
by `lifecycle_validate_row` (`migrations/2026-10-03-02-lifecycle-safety.sql:189`),
after the UPDATE executor has taken the affected row lock. That is the documented
allowance for arbitrary direct authenticated multi-row DML, not the specified
service protocol. The global gate currently serializes these writers; this
finding does **not** assert a demonstrated deadlock. It is a verified missing
step in a foundational contract that later tasks are told to consume.

**Required correction:** Inventory and integrate these service writers and any
other multi-Job service mutations under the shared sorted-lock helper before
their row/FK work. Preserve flag-off behavior and the defined batch limits. Add
targeted order assertions for the actual service functions rather than only
testing the helper or arbitrary SQL statements.

## Scope and supporting checks

Read repository `AGENTS.md`, `CLAUDE.md`, and `dashboard/CLAUDE.md`; the referenced
`dashboard/AGENTS.md` does not exist. Read the recovered approved spec and plan,
the complete Task 3 brief including all binding amendments, author report, and
complete pinned review package. Inspected its full source/test diff and historical
logs, and decoded both complete catalog inventories (grouping repeated grant
rows for comparison). Verified the package's complete diff equals
`git diff -U10 BASE HEAD` exactly (381,965 characters). Confirmed the complete
safety migration is the exact suffix of `schema.sql` (SHA-256
`5022b8ec3fede3540f81cc12bf815fe6ecbe6cf6b7a071ceebd3293b52a21776`).

The following implemented contracts have relevant code and accepted evidence;
these positive observations do not waive the findings or replace the separate
security/tenant/concurrency review:

| Contract | Review assessment |
| --- | --- |
| One global BEFORE STATEMENT gate | Installed on 43 cataloged tables, including all seven existing Job children, demands, source/typed entities, claims/reservations/staging, profile/matching cascade, and account-erasure siblings. The catalog test checks both FK parents and children. Explicit profile, allowance, generation, erasure, reviewer, and prune prelock sites were inspected. Caller coverage and service order remain incomplete as R1/R3 describe. |
| Claims and replay | Persistent token/generation/replay floor; DB-clock expiry; reassignment/cancellation fences before releasing held reservations; compact fence deletion prohibited. Current backend/xid binding and deferred receipt validation are present, with final focused test evidence. |
| Physical capacity | Uses actual `pg_database_size` plus all held reservations, including expired ones; 6000 MiB unchanged, no DELETE credit, same gate, conservative cumulative payload forecasts and 500 counted mutations. Final over-budget test permits zero-growth maintenance/bootstrap and still refuses new reservation bytes after retirement. |
| Protection | Version-ready description/snapshot checks; ready question checks; retirement/version replacement checks approvals, corrections, packages, scores, edits, pending generation, and active demand leases across users. Lean identity deletion and unsafe enforced rollback are blocked. Own no-growth protection and foreign-owner rejection are exercised. |
| Privileged helpers and client grants | Two private SECURITY DEFINER trigger functions use `search_path=pg_catalog`, contain claim/reservation reads and validation only, and have owner-only function ACLs in actual catalog output. Tests inspect grants and attempt denied anon/authenticated calls. Original DML remains invoker/RLS scoped. Demands grant only owner SELECT/DELETE plus INSERT of user/job/kind. Receipt INSERT guard includes inherited authenticated roles; clients cannot UPDATE/DELETE receipts. |
| Controls and rollout | Task 2 controls predate triggers; legacy/collect return before capacity/version row enforcement. `transition_control` requires current control singleton claim and activation CAS. Enforced/live retirement and archive activation are actually blocked pending later readiness; archive-ever is sticky, active/paused eventful public DML fails closed, and export-only pause does not remove that barrier. Task 10 pairing/budgets are appropriately still future work. |
| Legacy spool and changed reviewer | File spool caps rows/encoded bytes and checks cooperative elapsed time; partial/failed feed is not exposed for writes or closure; commits are at bounded admission chunks. Counts retain committed chunks. Changed job-poll and reviewer paths close reads before network/model callbacks. The R1/R2 exceptions prevent claiming complete compatibility/boundary coverage. |

Inspected final evidence: `handoff-final17.txt` and `handoff-final16.txt` report
**93 passed, zero skipped each**, on actual PostgreSQL **17.11 / 16.15**, after
final receipt and zero-growth hardening. Final dashboard logs report **4 passed
each**, zero skipped. The broader **290 passed each** runs are correctly labeled
as preceding the last receipt/zero-growth changes. The submitted 65 TypeScript
unit tests, typecheck, affected ESLint, and Ruff logs are also present. No fresh
whole-suite run or broader final coverage is asserted by this review.

## Independent probe evidence

Artifacts:

- `task-3-evidence/requirements-review-probe.py`
- `task-3-evidence/requirements-review-probe17.txt`

The probe was run with `/bin/bash`, `login:false` from the worktree:

```sh
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python /tmp/task3_requirements_probe.py
```

The saved probe is the same source as `/tmp/task3_requirements_probe.py`; it can be
rerun using its evidence path. Exit status **0** means the diagnostic completed;
its output deliberately demonstrates the defects rather than claiming tests
passed. A prior invocation omitted only the added fake-clock subcase. Both used
new owned harness databases and completed cleanup. No shared setup port 55432,
destructive feedback fixture, production/cloud/provider/paid network operation,
or implementation mutation was used. No baseline suites were rerun.

Task 3 remains unaccepted pending author corrections and fresh targeted evidence
for R1–R3, followed by independent re-review. Future cleanup, readiness, source,
demand, feed, and outbox/export work is not being classified as a Task 3 defect.
