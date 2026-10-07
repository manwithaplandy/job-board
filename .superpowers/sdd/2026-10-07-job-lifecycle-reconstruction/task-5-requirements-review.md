# Task 5 independent requirements and code-quality review

Spec: **FAIL**

Quality: **CHANGES_REQUIRED**

Reviewed BASE `ee9cef2849b966835807c6c84d00cf2a8ed62788` through HEAD
`a6131a02282174078e34ecdd28d967294a524a90` on 2026-10-07. This is a fresh
Task 5 requirements/code-quality review, not a replacement security review.
Read `REVIEW-SCOPE-AMENDMENT.md` and `RELEASE-AUTHORIZATION.md` first, then
the exact brief/global constraints, author report, full pinned review package,
repository conventions, relevant actual source, test definitions and evidence.
The working product/test files match the pinned HEAD. No source or Git mutation,
subagent, provider/network/model/S3 call, database invocation or release action
was performed. The one new diagnostic was offline and narrowly justified below.

## Required correction

**P2 — Preserve the existing single-loop fallback for nonpositive parallelism.**

Anchor: `reviewer/worker.py:253`–`255`, compared with BASE
`reviewer/worker.py:213`–`222`; configuration is parsed without a positive lower
bound in `reviewer/config.py:6`–`10` and `:28`.

Before this change, `k <= 1` explicitly ran `_run_loop(stop, fatal, 0)`.
The new thread list uses `range(k)` directly. Consequently a configured
`REVIEW_WORKER_PARALLELISM=0` or negative value now starts no review loop,
returns successfully, and is restarted every scheduler check by the supervisor.
Pending requests never get processed under a configuration that previously ran
the single-loop worker. This is an introduced reviewer compatibility regression
outside the requested bounded-drain behavior; default 3 and explicit 1 work.

Restore the previous effective minimum of one loop when constructing the daemon
thread list (for example, normalize the effective count to at least one), and
add a small offline regression for 0/negative alongside 1. Retain the bounded
drain and single-loop SystemExit contract. A narrow forward fix and focused
verification are sufficient; no excluded security work is needed.

Fresh diagnostic on the pinned BASE and actual HEAD used each module's `main()`
with `_run_loop`, API-key check, signal registration and informational logging
mocked. It made no database or provider call. Actual results:

| Configured parallelism | BASE loops started | HEAD loops started |
| --- | --- | --- |
| -1 | 1 | 0 |
| 0 | 1 | 0 |
| 1 | 1 | 1 |
| 3 | 3 | 3 |

The reproducible diagnostic and captured output are in
`task-5-review-evidence/nonpositive-parallelism.txt`. Existing 84-test lanes
exercise 1/3, not this configuration boundary; neither lane was rerun.

## Other requirements assessed

- Startup and 900-second maintenance recurrence are independent of reviewer
  progress and the separate discovery process. `reviewer/supervisor.py:78`–`112`
  keeps separate child state, checks at intervals no greater than five seconds,
  and clips wakeups to the maintenance deadline and next scheduled tick.
  Production uses `time.monotonic` at `:127`. Existing fake-clock and real-child
  tests cover a stalled reviewer and an independently terminated cron process.
- The maintenance process deadline is 90 seconds, including during shutdown
  (`reviewer/supervisor.py:54`–`60`, `:90`–`94`). The existing regression at
  `tests/test_lifecycle_supervisor.py:363` checks shutdown at time 85, maintenance
  kill at 90 and reviewer kill at 115. The original process deadline is retained.
- Shutdown signals both children, allows one global 30-second cooperative drain,
  then kills survivors. A separate shared one-second kernel reaping allowance
  is explicit (`reviewer/supervisor.py:46`–`75`); all waits are bounded. Exited
  reviewer children restart independently, while maintenance failure waits for
  its next tick. Spawn failure drains the existing sibling and exits nonzero.
  No export child is registered. Child streams are inherited, avoiding unread
  subprocess pipes.
- The worker owns one connection, checks the service control under the existing
  gate, acquires the existing singleton claim, and calls the accepted sweep with
  `scheduled=True` (`job_discovery/lifecycle/worker.py:16`–`45`). Flag-off exits
  without a sweep. Normal completion, ordinary failure and cooperative SIGTERM
  reuse rollback/cancel/close behavior. Release failure reports blocked and
  relies on persisted recovery. The worker does not introduce a new claim policy.
- The accepted Task 4 sweep is reused unchanged. Its 120-second lease,
  renewal interval at most 30 seconds and 90-second deadline remain visible at
  `job_discovery/lifecycle/maintenance.py:21`–`23`, `:311`–`384`.
  `tests/test_maintenance_controlflow.py:21` covers the actual sweep's bounded
  control flow with deterministic time and renewal assertions. This review
  accepts these existing interfaces; it does not independently revalidate their
  excluded expiry/capacity/isolation guarantees.
- Reviewer loops still own individual connections. Daemon threads, the recorded
  signal deadline and per-join deadline checks provide bounded integration
  (`reviewer/worker.py:52`–`63`, `:153`–`267`). Existing queue processing and
  recovery code is unchanged. The two queue-fixture adaptations preserve
  distinct-claim and no-row assertions (`tests/test_reviewer_worker.py:64`–`114`):
  controlled second-claimer concurrency permits the first gate-owning transaction
  to commit; a plain row lock isolates the separate SKIP LOCKED assertion.
  Neither adaptation changes a database policy.
- The only Railway diff is reviewer `startCommand` to
  `python -m reviewer.supervisor`; `ON_FAILURE` and 100 retries remain
  (`railway.reviewer-worker.json:14`–`17`). A direct pinned diff confirms no
  changes to `railway.json`, `railway.discovery.json`, or
  `job_discovery/__main__.py`. This preserves the existing one-shot discovery
  and externally configured daily `0 0 * * *` UTC schedule; no live provider
  schedule was queried or changed by this reviewer.
- No migrations, schemas, lifecycle control defaults, identity/FK/RLS rules,
  archive settings or destructive-prune cutover behavior are changed by Task 5.
  Pinned whitespace verification also completed successfully.

## Evidence and honest limits

Independently read the actual final logs, not just the report. Both full selected
lanes contain **84 passed and zero skips**:

| Evidence | Server | Pytest wall time | Peak test DB connections | Before / after |
| --- | --- | --- | --- | --- |
| `task-5-evidence/final17.txt` | PostgreSQL 17.11 | 49.03 s | 4 | 0 / 0 |
| `task-5-evidence/final16.txt` | PostgreSQL 16.15 | 56.95 s | 4 | 0 / 0 |

The recorded command covers supervisor, reviewer-worker, lifecycle-maintenance,
and maintenance-controlflow modules. These are author-executed results inspected
independently; they are not fresh executions by this reviewer. RED/intermediate
failures remain historical evidence and are superseded by the final covering
lanes. The review diagnostic above supplies fresh evidence for the new finding.

Read the measurement helper and both resource records. PostgreSQL 17/16 sampled
test-tree RSS is 90,390,528 / 90,021,888 bytes; waited-child user CPU is
6.914 / 6.034 seconds and system CPU is 1.583 / 1.379 seconds. One observer DB
connection is excluded from the test connection counts. Sampling is nominally
50 ms plus overhead and may miss peaks. CPU/RSS measure test clients/waited
children, exclude server/container/harness costs, and summed RSS can duplicate
shared pages. The report correctly makes no cost-neutrality or production-load
claim. The supervisor has no DB connection; each maintenance child owns one.

Implemented and independently reviewed here: Task 5 scheduling/process control,
bounded drain integration, ordinary worker release/recovery wiring, fixture
compatibility, deployment-file scope and resource-reporting accuracy, subject to
the identified configuration regression. Tested in author evidence: the selected
ordinary process/DB cases on both server majors. Fresh reviewer testing: only the
offline configuration diagnostic.

Deliberately unreviewed: Task 3 expiry enforcement, capacity accounting,
cross-user isolation and related adversarial probes, including independent
stale/expired commit-time rejection guarantees. Passing ordinary generation or
queue-recovery cases cannot establish those guarantees. They remain explicit
gaps under the scope amendment; this verdict supplies no security approval.

No new safeguard refusal occurred. The configuration correction is the sole
new Task 5 review blocker. After a forward correction and permitted focused
verification/re-review, the controller can complete Library 05 and continue
Task 6. Completed-upgrade publication/merge/service-scoped deployment remains
the controller's later authorized action after all 13 tasks and permitted
verification, with the recorded safety-floor confirmation exceptions.
