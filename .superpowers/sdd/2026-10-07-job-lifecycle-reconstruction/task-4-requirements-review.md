# Task 4 independent requirements and code-quality review

**Spec verdict: FAIL. Quality verdict: CHANGES_REQUIRED.**

These verdicts concern the permitted ordinary Task 4 development scope. Two
implementation defects require correction below. They are separate from the
explicitly deferred security-review gaps. This is not a security approval or a
rollout decision.

Reviewed BASE `255909ec819f4908a8701a42ae5122fe121b0935` through HEAD
`8731cd32adb67755dfbbdd7ee53e09ec03d239c5`; product/test source is
`9608f7c0ca6d409e2d694ec2dadc70f4a6b70629`. The scope amendment was read first,
followed by the brief, author report, full pinned review package, applicable
repository instructions, relevant approved-spec sections and actual source.
The review package exactly equals `git diff --unified=10 BASE HEAD`. All eight
product/test files match the working tree, HEAD and product commit byte-for-byte.
No source edits, Git mutations, DB runs, network calls or subagents were used.
Only this report and sanitized reviewer evidence were written.

## Required fixes

### R4-1 — P1: a single payload batch can exceed the sweep deadline and renewal interval

Anchors: `job_discovery/lifecycle/maintenance.py:48`, `:66`, `:225`, `:227`,
`:230`; `job_discovery/lifecycle/locks.py:16`.

The outer loop checks the 90-second deadline and the 30-second renewal threshold
only between phase batches. `_payload_batch` can execute up to 250 job-lock
queries and 500 separate payload mutations without a time check. The statement
timeout limits each individual statement, so it does not bound their accumulated
duration. Moreover, `lock_jobs` calls `enter_gate`, which restores a five-second
statement timeout after `sweep` installs its remaining-time timeout.

A fresh offline diagnostic ran the actual `sweep` and `_payload_batch` with 250
ordinary paired caches and a connection double that charges 0.2 seconds for each
successful payload mutation. It reported:

```text
TIMING: elapsed=100.0s retired=500 mutations_started_after_90s=50 renewals=[]
```

This is a scheduler/control-flow observation, not a test of lease expiry or
commit-time enforcement. Validation and metrics were doubles; no security
mechanism was exercised. It demonstrates that the implementation itself neither
stops starting work at its deadline nor schedules renewal within 30 seconds.
The existing `test_cooperative_deadline_and_renewal_between_short_transactions`
replaces the entire payload batch and accepts renewal times `[31,62]`; it cannot
prove the exact approved `<=30s` value and does not inspect the inner SQL loop.

The future Task 5 supervisor's process deadline does not fix the direct,
synchronous pre-admission call in `run.py:79`. Preserve the approved 90/120/30
values; bound work within a phase, return and commit resumable progress before the
next renewal is due, and prevent timeout reinstallation from extending remaining
runtime. Add a deterministic ordinary regression with many individually slow,
successful statements. Do not add refused expiry-enforcement probes.

### R4-2 — P2: unsuccessful poll-lock reacquisition still runs post-poll work

Anchors: `job_discovery/run.py:181`, `:187`, `:195`, `:222`, `:232`, `:241`, `:249`.

After an adapter failure and a broken rollback, the reconnect path properly runs
maintenance and opens a new session. If another poll acquired the session lock,
`locked=False` raises and the handler logs `reconnect failed; aborting poll`, but
it only breaks the company loop. With the original `over=False`, execution then
falls through to location enrichment, model review and legacy prune without
having reacquired the poll lock. This differs from the initial lock-denied path,
which exits immediately at lines 88–90.

An offline diagnostic using the actual `run()` and a successful initial lock,
broken rollback and denied reconnect lock recorded:

```text
RECONNECT_LOCK_DENIED: later_phases=['finish_run', 'location_enrichment', 'model_review', 'prune']
```

The external capabilities were recording doubles; no model or network calls took
place. The existing reconnect test covers successful reacquisition only. Exit
through an explicit aborted-run path after safely recording available counts;
skip enrichment/review/prune when reacquisition fails. Add an ordinary regression
that denies the second lock and installs raising hooks on those later phases.

## Evidence examined

Actual final stdout, not just the report, records:

- `task-4-evidence/final17.txt`: PostgreSQL **17.11 (Debian
  17.11-1.pgdg13+2)**; **111 passed**, no skipped tests reported, 80.40 seconds.
- `task-4-evidence/final16.txt`: PostgreSQL **16.15 (Debian
  16.15-1.pgdg13+2)**; **111 passed**, no skipped tests reported, 106.50 seconds.
- `task-4-evidence/ruff.txt`: `All checks passed!`.

Exact final covering commands in the author report and `commands.txt` agree:

```sh
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_lifecycle_migrations.py tests/test_run_question_fetch.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_lifecycle_migrations.py tests/test_run_question_fetch.py -q
.venv/bin/ruff check .
git diff --check
git diff --cached --check
```

The normalization commit changes evidence whitespace and the report, not product
or tests. Earlier failed iterations were read as historical debugging evidence;
they are superseded by the final unchanged-source runs. The two covered database
lanes were not rerun. These 111-test lanes are ordinary Task 4/migration evidence,
not the broader security/concurrency parity lane specified for Tasks 1 and 13.

Fresh reviewer evidence:

- `task-4-evidence/reviewer_source_evidence.txt`: exact source equality, SHA-256
  hashes, complete review-package equality, exact schema/migration suffix parity,
  final stdout summaries.
- `task-4-evidence/reviewer_functional_diagnostics.py`: two self-contained offline
  control-flow diagnostics; assertions confirm the reported defects.
- `task-4-evidence/reviewer_functional_diagnostics.txt`: actual successful
  diagnostic output with expected simulated reconnect error logs.

Run the diagnostic from the repository root with:

```sh
PYTHONPATH=. .venv/bin/python .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/reviewer_functional_diagnostics.py
```

An initial diagnostic fixture used a bare object without the required claim
attributes and stopped with `AttributeError`; its double was corrected before the
successful recorded run. No product change was needed for that fixture issue.

## Scoped requirements assessment

| Contract | Implemented / tested / independently reviewed assessment |
| --- | --- |
| Pre-admission order, empty/inactive runs, held initial poll lock | Source places maintenance before target loading and poll lock. Recorded ordinary tests cover initial lock, empty/inactive, normal, blocked, failed guard, above guard and poll failure cases. Reviewed as satisfied apart from the reconnect-abort defect R4-2. |
| Failed sweep/measurement blocks additions while verification continues | Existing control flow propagates `blocked`, catches initial/chunk measurement errors, and retains verification. Tests cover the normal failure branches and preservation of 500 committed admissions when a later chunk stops. Capacity-enforcement guarantees remain outside this review. |
| Default dry run and readiness | `sweep` defaults dry, and effective dry run also depends on persisted flags and enforced readiness (`maintenance.py:236`). Recorded test verifies caller `dry_run=False` does not override incomplete readiness. Future live worker test uses a clearly labelled read-control double; installed activation is not demonstrated or approved. |
| Identity, payload TTL and declared protection behavior | Worker retains Job IDs, retires description/question payloads, uses COALESCE(actual use,capture), 720/168 elapsed hours, ignores sightings, and skips unknown/NULL caches. Ordinary tests cover each declared protected-work category and actual retirement with a readiness double. Reviewed functional predicates and source behavior only; no cross-user or racing protection guarantee is supplied. |
| Row/byte budgets and fairness | Constants preserve 2,000/20,000 and a separate 64 MiB logical retirement budget. Payload batches scan at most 250 keys and advance the persisted Job cursor across all scanned rows; phase rotation persists after each committed batch. Source and recorded small-cursor/byte-bound/21,005-member tests support these ordinary bounds. Deadline/renewal contract fails R4-1. No physical credit is derived from logical retired bytes. |
| Public-version retirement | `maintenance.py:84` selects only superseded versions at/below archived revision, older than 720 hours or beyond ten superseded versions, while preserving listed FK references. Recorded test covers retained current, referenced and unarchived versions. Actual archive production is future work, so trustworthy archive activation and full archival guarantees are not verified here. |
| Staging TTL and committed resumption | Completed staging requires both reconciliation markers at least 24h old; unfinished staging uses 168h. Source records cleanup progress and persistent floors before bounded member deletion, then removes checkpoint/marker/parent after members are gone. Recorded 21,005-member fixture leaves 1,008 after 20,000 units and resumes on a fresh connection. Counter/miss/observation tables are not mutated by this worker. No stale-callback rejection or reservation-resurrection claim is made. |
| Terminal details and retained snapshots | Seven-day terminal-detail/receipt queries are bounded; snapshots and compact claim rows remain. Author tests cover ordinary retention including a test-only terminal cutoff. Accounting/enforcement implications are deliberately unreviewed. |
| Physical metrics and action-needed | Source uses actual pg_database_size, separates held bytes and estimated live/dead tuples, labels server-wide cumulative WAL, and persists reusable bytes as NULL/unknown. Recorded tests cover action-needed after two scheduled guarded sweeps and exclude pre-admission calls from that streak. This is metrics correctness evidence, not capacity security approval. |
| Legacy prune cutover | Additive cutover timestamp is installed atomically by the control update trigger; Python legacy prune checks it under the gate and remains disabled after maintenance is toggled off. Recorded ordinary cutover and existing unchanged prune tests pass. Stale direct-DML/adversarial enforcement is not independently approved. |
| Migration and ordinary staging compatibility | New maintenance migration exactly matches the schema.sql suffix. Final migration tests cover reapplication/catalog parity. The narrowly authorized staging-trigger repair nests table-specific NEW-field access and preserves the comparisons; normal member/checkpoint inserts pass in the recorded tests. This assessment is compatibility only, not a new security verdict on the trigger. |
| Side effects and scheduled execution | Maintenance source imports no model/notification/external-write capability; recorded raising hooks cover review, HTTP, location enrichment and socket connection. Task 5 owns the supervisor/startup/15-minute execution and process termination integration; those are not present or certified by this Task 4 review. |

## Residual review gaps, not implementation findings

The approved `REVIEW-SCOPE-AMENDMENT.md` permits development while deferring
independent expiry-enforcement, capacity-accounting, cross-user-isolation and
related adversarial reviews. Required stale enumeration/claim/reservation callback
and resurrection rejection guarantees after cleanup therefore cannot be verified
in this permitted scope. Ordinary persisted-floor inspection and passing tests
do not replace those reviews. Protection races, authenticated invocation behavior,
and all-writer accounting guarantees are likewise not independently certified.
No refused probes were retried, split, disguised or reproduced; no replacement
security reviewer was used. Task 3 remains **not fully security-approved**.

Remote upstream freshness remains unverified under the no-network dispatch. The
local-source checks support the supplied pins only. Final database stdout is
reviewed author evidence; the new diagnostics are offline reviewer evidence.
No claim is made that every full-plan contract has been independently verified.

Fix R4-1 and R4-2, preserve the exact brief values and flag-off/default-dry behavior,
and provide focused ordinary regression evidence for a follow-up scoped review.
Deployment, activation, merge and production writes remain blocked. No new
safeguard rejection occurred during this review.
