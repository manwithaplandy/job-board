# Task 4 — bounded maintenance before admission

BASE: `255909ec819f4908a8701a42ae5122fe121b0935`. Sole fresh author, working in
`/workspace/job-board/.claude/worktrees/lifecycle-recovery`, bash/login:false.
Read `REVIEW-SCOPE-AMENDMENT.md` before the brief/dispatch. Task 3 source
`a17b6427ea06c60e801836e56114890441166842` is the approved development basis,
**not fully security-approved**. This report describes author implementation and
ordinary business verification, not an independent requirements or security verdict.

The local `origin/main` reference is `73ce118205bfdbb56c18207acc0c1c4e3708c860`,
an ancestor of HEAD and of the supplied production/main reference
`114cce96cb244546864a6bddc5476b5630bc024a`. There is no newer local upstream delta.
No remote fetch was performed under the dispatch's no-network scope; remote
freshness is therefore unverified. Existing pricing/main changes were preserved.

## Implementation

`pre_admission_maintenance(dsn)` runs on its own connection before loading targets
or obtaining the poll session lock. It also runs before reconnecting a broken poll
session; the poll lock and capacity measurement are reacquired. A failed sweep,
contended maintenance claim or failed capacity measurement blocks admission while
complete-source verification/closure handling continues. Empty/inactive runs and a
held poll lock cannot skip the initial maintenance call. Existing flag-off behavior
remains available before cutover. Poll admission checks the physical guard again
under the common gate for each <=500-job chunk, including all held reservations
and a conservative payload/index/WAL forecast (16 KiB plus four times serialized
posting field bytes per row). This is no byte-perfect volume guarantee. A later
chunk stop preserves the count of already committed admissions and completes
verification. The original above-guard closure path remains intact.

The DB-only sweep uses a maintenance singleton claim, a 120-second lease renewed
at most 30 seconds apart, a 90-second cooperative deadline, 2-second lock and
5-second statement timeouts, 2,000-row maximum cleanup statements, and 20,000
work units per sweep. Description/question work locks at most 250 Job keys per
transaction, keeping paired cache mutations within the existing 500-mutation
contract. A separate **64 MiB logical payload retirement budget** supplies the
spec's byte bound (the spec does not prescribe its numeric value). Oversized or
remaining payloads are deferred; this budget never becomes physical credit.
The deadline is checked between bounded transactions; PostgreSQL statement/lock
timeouts bound in-flight DB waits. This is cooperative, not process preemption.

A persisted Job cursor advances across protected and NULL rows, with a persisted
round-robin phase for payloads, public versions, staging, reservations, terminal
demands and old write receipts. Short committed batches survive interruption.
Descriptions expire after 720 elapsed hours and questions after 168 hours from
actual last use or capture. Unknown capture remains unknown; sightings do not
extend TTL. NULL payloads are not counted as retirement. All existing approvals,
corrections, packages, scores, edits, pending generation, active demand leases,
and demand snapshots exclude shared payload retirement. Queries are under the
common gate and candidate Job keys are sorted before row locks and a fresh
protection read. Jobs and private work are never deleted by the new sweep.

Caller `dry_run=False` cannot override readiness: safety must be enforced,
retirement enabled and persisted dry-run disabled. Installed activation barriers
still prevent that transition. Default calls and all actual controls remain off /
dry-run. A narrowly scoped worker readiness double exercises live retirement
without disabling SQL triggers or changing real controls. Independently archived
superseded versions are removable only after 30 days or beyond ten superseded
versions, and only without any current/shared/private/edge FK reference. Pending
or unarchived versions remain. This uses persisted `archived_revision`; the
archive producer/exporter remains disabled and is future work.

The additive `2026-10-03-02-maintenance.sql`, mirrored in `schema.sql`, adds only
compact maintenance health/cursor and temporary staging-cleanup progress. Enabling
maintenance atomically records a permanent cutover timestamp. Legacy `prune_jobs`
then becomes a no-op, including after disabling maintenance. A separate statement
guard prevents stale direct Job DELETE/TRUNCATE after that cutover. No historical
Task 3 safety policy or activation barrier was relaxed. Service-only progress
retains RLS; authenticated invoker guards can read only the cutover timestamp.

Completed staging needs both committed reconciliation markers older than 24
hours. Unfinished staging needs 168 hours. Before deletion, maintenance fences the
matching old source claim, advances the persistent source replay floor, and
records completed/abandoned cleanup. It never fences a newer claim generation.
Held reservations for the fenced generation are recovered with measured physical
usage in bounded batches before draining members. Checkpoints/marker/parent are
removed only after members are gone; there is no unbounded cascading cleanup.
Source observations/counters/miss evidence are not updated or removed. Terminal
reservation details need a retained newer claim generation and replay floor;
held reservations never age out. Unresolved held accounting makes maintenance
block admission. Terminal demand snapshots remain; compact claim fences survive.
Write receipts and eligible terminal details use a seven-day retention cutoff.

Health persists allocated bytes, all held bytes, estimated live/dead tuple counts,
server-wide cumulative WAL bytes, guard state and last successful sweep. Reusable
bytes are explicitly NULL/unknown because pg_stat counters do not measure them;
retired bytes are logical content only. Two **scheduled** guard-active sweeps
record/log action-needed. Pre-admission calls do not inflate that scheduled streak.
There is no VACUUM FULL, compaction, notification or external write capability.

## Latent Task 3 functional defect and narrow repair

Normal `enumeration_members` insertion failed in the inherited staging trigger:
`psycopg.errors.UndefinedColumn: record "new" has no field "generation"`.
PL/pgSQL resolved a table-specific field in a combined AND expression even though
the current table was a membership table. The controller explicitly authorized
an ordinary SQL correctness repair. The additive migration nests the existing
checkpoint-generation and source-enumeration-identity checks inside table-name
branches. Every comparison and existing fencing policy is retained. Ordinary
member insertion and matching-generation checkpoint insertion now run through
the actual trigger. No fence was disabled, and no excluded security re-review
was attempted.

## Evidence and limits

All DB execution used `tools/lifecycle_test_db.py` on owned disposable random
loopback PostgreSQL instances. No shared port 55432, reserved dashboard fixtures,
production/provider/cloud/paid endpoint or infrastructure was accessed.
Existing ignored `.venv` was used; no dependencies were installed.

Evidence is in `task-4-evidence/`:

- `red17.txt`: 5 failed / 47 passed; missing maintenance module, call order and
  cutover behavior reproduced before implementation.
- `green-attempt17.txt`: initial five regressions pass.
- `green-cover-attempt17.txt`: 68 passed / 4 fixture failures because legacy tests
  reused a connection now independently owned/closed by maintenance. Fixtures
  now supply separate owned connections.
- `expanded-attempt17.txt`: 19 passed / 7 fixture errors (ambiguous smallint
  generate_series and ready demand without a version). Fixture types/state fixed.
- `expanded2-17.txt`: 20 passed / 6 failures exposing the inherited trigger error.
- `green-expanded3-17.txt`: 100 passed / 4 failures. Fixed early sweep termination
  that stranded staging after its fence and a migration filename ordering issue
  under database collation; the new filename sorts after safety in both orders.
- `green-expanded4-17.txt`: 50 passed / zero skips, including bounded staging
  resumption and full migration reapplication/catalog parity.
- `green-expanded5-17.txt`: 105 passed / 1 fixture assertion error. The identity
  mapper intentionally creates no synthetic version; the archived-version test
  now explicitly inserts and references version 1.

Final commands and results are recorded below. Tests cover TTL
business boundaries, never-used and unknown caches, protected work, actual poll
order/guard/failure/reconnect/inactivity, interrupted 21,005-member staging,
2,000/20,000 bounds, deadlines/renewal, archived-version retention, fenced detail
retention, logical-byte caps, physical metrics and forbidden external hooks.
A fresh connection resumes the persisted large cleanup. Catalog comparison covers
schema, grants, RLS policies, private functions and their definitions; that is
schema compatibility evidence, not tenant/adversarial validation.

Deliberately unrun: `tests/test_lifecycle_review_security.py`,
`tests/test_lifecycle_safety.py`, `tests/test_lifecycle_activation.py`,
`tests/test_rls_isolation.py`, and dashboard lifecycle DB security tests. No new
forged/stale-token, cross-user, expiry-enforcement or adversarial capacity probe
was executed. Cleanup tests inspect retained generations/replay floors and normal
writes; they do **not** supply the missing independent late-callback/security
verdict. A test-only retention cutoff exercises terminal-detail deletion while
leaving real lease clocks, production queries and SQL guards unchanged.

Independent expiry enforcement, capacity accounting, cross-user isolation and
related adversarial review gaps remain explicitly open under the amendment.
Task 3 is not fully security-approved; passing Task 4 ordinary tests cannot change
that. Permitted independent Task 4 requirements/code-quality review remains for
the controller. No deployment, activation, merge, push, Library publication or
Task 5 work was performed by this author. Production rollout remains blocked.

Exact final covering commands (all earlier RED/GREEN commands are also preserved
in `task-4-evidence/commands.txt`):

```sh
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_lifecycle_migrations.py tests/test_run_question_fetch.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_lifecycle_migrations.py tests/test_run_question_fetch.py -q
.venv/bin/ruff check .
git diff --check
git diff --cached --check
```

Final unchanged-source results:

- `final17.txt`: **111 passed, zero skipped**, PostgreSQL **17.11 (Debian
  17.11-1.pgdg13+2)**, 80.40 seconds.
- `final16.txt`: **111 passed, zero skipped**, PostgreSQL **16.15 (Debian
  16.15-1.pgdg13+2)**, 106.50 seconds.
- `ruff.txt`: repository Ruff passed. Working and staged whitespace checks passed.
- `pre-byte-final17.txt`: 110 passed before the final separate byte bound/test;
  the two final runs supersede that intermediate verification.

Product/test inventory: new `job_discovery/lifecycle/maintenance.py`, additive
`migrations/2026-10-03-02-maintenance.sql` and matching `schema.sql` suffix,
`job_discovery/prune.py`, `job_discovery/run.py`, new
`tests/test_lifecycle_maintenance.py`, `tests/test_run.py`, and
`tests/test_size_guard.py`. Existing `tests/test_prune.py` was exercised unchanged.
Only those files plus this report and its sanitized evidence are author-staged;
controller ledgers, amendment, dispatch and review files are excluded.

Artifact-only forward correction: the initial staged pytest failure logs contained
pytest-generated trailing whitespace. It was detected during staging, then
normalized without altering results or traceback content. The source/test commit
is `9608f7c`; the forward evidence-normalization commit contains no product or
test changes. Final source verification above remains applicable.

## Fix Round 1 — ordinary timing and reconnect-abort corrections

FIX_BASE: `8731cd32adb67755dfbbdd7ee53e09ec03d239c5`. Read the full independent
`task-4-requirements-review.md` and its exact saved offline diagnostics/output.
The permitted review verdict was **Spec FAIL / Quality CHANGES_REQUIRED**.
Both findings were valid; the earlier passing tests did not cover their actual
inner control flow. This forward fix addresses R4-1 and R4-2 only.

R4-1: the worker now applies a remaining-time wrapper to every phase statement,
including statements issued through a cursor and those after `enter_gate` resets
its timeout. The 5-second per-statement maximum is clipped to the remaining
transaction window. Each phase reserves five seconds to persist/commit progress
and a further five seconds for renewal or final health. Payload work checks its
yield point between Jobs **and between the two payload mutations**. A half-finished
pair retains the previous cursor so the next transaction/invocation revisits that
Job and sees the already-cleared field. Protected/empty rows still advance the
cursor. Only committed counts/cursors are published in the result; an exhausted
window rolls back its unfinished batch and returns blocked with earlier progress
intact. Renewal occurs in a separate transaction after progress has committed,
with its own remaining deadline. The 90/120/30-second approved values are unchanged;
renewal is scheduled early enough to fit within 30 seconds. No lease-clock,
commit-time validation or security-policy change was made.

The previous whole-batch replacement test accepted renewal at 31 seconds and was
removed. New deterministic regressions execute the **actual** payload loop over
250 paired caches, charging 0.2 seconds per successful mutation, with both zero
and 0.02-second per-Job lock costs. They check no new mutations after 90 seconds,
renewal intervals <=30 seconds, commit-before-renewal, timeout clipping after lock
helpers, and complete retirement across resumed invocations without skipped pairs.
A real owned-DB version executes normal SQL mutations and existing valid-claim
operations while advancing only the worker's monotonic scheduler clock; database
lease clocks and guards remain real and unmodified. This is ordinary timing
verification, not an expiry-enforcement probe.

R4-2: a reconnect or reacquisition failure now sets an explicit aborted state.
The abort path records available counts/diagnostics on a best-effort basis, then
returns before enrichment, model review or prune. Accounting failure is contained
and does not reactivate optional phases. Offline tests use raising hooks for all
three optional capabilities and cover both successful/failed abort accounting.
An owned-DB regression releases the broken poll session, lets a separate owned
session take the real poll lock, and proves denied reacquisition records the
aborted run and invokes no optional phase. Successful reconnect coverage remains.

Fix evidence (all under `task-4-evidence/`):

- `fix1-red17.txt`: **3 failed**, reproducing both findings before product edits
  (two ordinary timing variants and denied-lock fallthrough).
- `fix1-green-attempt17.txt`: **77 passed, zero skips** after the first fix.
- `fix1-green2-17.txt`: **79 passed, zero skips**, adding real-DB timing and
  contention regressions.
- Final unchanged-source results and actual versions are recorded below.

Exact fix commands, same owned worktree and bash/login:false:

```sh
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_run_question_fetch.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_run_question_fetch.py -q
.venv/bin/ruff check .
git diff --check
git diff --cached --check
```

Only maintenance/run implementation, their ordinary tests and author report/fix
logs are included in this fix. No SQL migration, policy, gate, claim or capacity
enforcement module changed. Prior migration parity evidence therefore remains
applicable; no excluded security suite/probe was rerun. Reviewer diagnostics,
review report, controller ledgers and authorization files remain controller-owned.
The same independent expiry/capacity/cross-user/adversarial review gaps persist.
Author verification does not supply independent re-review or security approval.

Release authorization chronology: the report's earlier deployment-hold statements
are historical. `RELEASE-AUTHORIZATION.md` records Andrew's later authorization to
publish/merge/deploy the **completed upgrade after all 13 tasks and permitted
verification**, with applicable safety-floor confirmations retained. This author
remains local-only and has not released Task 4. The controller owns scoped
re-review, Library checkpoint, continued implementation and final release.

Fix Round 1 final unchanged-source results:

- `fix1-final17.txt`: **97 passed, zero skipped**, actual PostgreSQL **17.11
  (Debian 17.11-1.pgdg13+2)**, **51.77 seconds**.
- `fix1-final16.txt`: **97 passed, zero skipped**, actual PostgreSQL **16.15
  (Debian 16.15-1.pgdg13+2)**, **64.45 seconds**.
- `fix1-ruff.txt`: repository Ruff passed. Working and staged whitespace checks
  passed after normalizing only pytest-generated trailing log whitespace.

No product/test edit occurred after either final lane started. The selected six
files are the new control-flow regressions, maintenance, run, guard, existing
prune and question-fetch tests, as listed in the exact commands above. No DB test
was skipped. The unchanged migration/security source was not redundantly tested
or re-reviewed. No new safeguard rejection occurred. Both findings are addressed
in author implementation/tests; independent scoped re-review remains pending.
