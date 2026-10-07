# Task 5 — independent maintenance supervisor

BASE: `ee9cef2849b966835807c6c84d00cf2a8ed62788`. Sole fresh author in
`/workspace/job-board/.claude/worktrees/lifecycle-recovery`, bash/login:false.
Read `REVIEW-SCOPE-AMENDMENT.md` and `RELEASE-AUTHORIZATION.md` first, followed
by the exact Task 5 brief/dispatch, repository instructions and accepted Task 4
interfaces/report. No author subagents or reviewers were used.

Task 3 is a usable development basis, **not fully security-approved**. Independent
expiry-enforcement, capacity-accounting, cross-user-isolation and related
adversarial review gaps remain open. This is author implementation and ordinary
verification, not an independent requirements, quality or security verdict.

The provided production reference `114cce96cb244546864a6bddc5476b5630bc024a`
is an ancestor of HEAD. The local `origin/main` reference remains
`73ce118205bfdbb56c18207acc0c1c4e3708c860`; no newer local upstream delta was
found. The author did not fetch external upstream state. Controller release
preflight and eventual completed-upgrade release are separate work.

## Implemented behavior

`reviewer.supervisor.supervise(stop, spawn, clock)` starts the reviewer and a
separate one-shot maintenance process at startup. Maintenance runs every 900
monotonic seconds regardless of reviewer progress or the discovery cron's
lifetime. Checks occur at most five seconds apart, clipped to maintenance's
90-second process deadline. At that deadline the process is killed, including
when shutdown is already in progress. Successful, failed and timed-out sweeps
wait for the next scheduled tick; missed ticks are skipped instead of replayed
in a burst. Reviewer exit restarts just that child on the next check.

SIGTERM/SIGINT stops new children and signals both existing children to drain.
One shared 30-second deadline bounds cooperative drain; remaining children are
killed at that deadline. There is one further shared second solely for bounded
kernel-exit reaping, not an extension of cooperative work. No child wait/join is
unbounded. Failure to spawn/manage/reap exits nonzero for the service restart
policy. Child stdout/stderr are inherited, avoiding unconsumed subprocess pipes.
The supervisor owns no DB connections. Only reviewer and maintenance children
are registered; Task 11 export registration remains absent/disabled.

`job_discovery.lifecycle.worker.run_maintenance_once(dsn)` owns one connection,
reads the existing service control under the existing gate, acquires the existing
maintenance singleton claim, and calls the accepted sweep with `scheduled=True`.
Flag-off performs no sweep and closes the connection. Claim contention returns a
blocked result. Normal completion, ordinary failure and cooperative SIGTERM
roll back unfinished work and cancel the owned claim before closing. Failed
release retains the persisted lease for recovery and reports blocked. A hard
process kill can leave a claim active until expiry; the next ordinary acquisition
uses existing DB-time validation and generation fencing before recovery. No
client clock bypass, SQL change, gate change or claim-policy change was added.

The accepted sweep retains its 120-second lease, renewal at most 30 seconds apart,
90-second cooperative deadline, two-second lock and five-second statement bounds,
2,000/20,000 cleanup limits, checkpoint commits and readiness-enforced dry-run.
The new parent adds a process deadline around connection/startup/sweep/cleanup.
No HTTP/model/S3 work is introduced into this worker or its transactions.

Reviewer changes are limited to bounded drain integration: all loop counts use
connection-owning daemon threads, including K=1, so a permanently stalled
request cannot prevent process exit. Signal delivery records the drain deadline;
thread joins recheck it individually. The single-loop SystemExit contract and
parallel fatal/nonzero behavior are preserved. Normal loops still finish their
request and close their connection; forced process exit relies on existing queue
recovery, not invented successful completion.

Only `railway.reviewer-worker.json`'s startCommand changes, to
`python -m reviewer.supervisor`. ON_FAILURE and 100 retries are preserved.
`railway.json`, `railway.discovery.json`, and `job_discovery/__main__.py` have no
diff from BASE. The separately configured daily `0 0 * * *` UTC cron and one-shot
entry point are untouched. No provider configuration was written or activated.

## Verification chronology and scope

Exact commands and complete sanitized output are in `task-5-evidence/`.
Every DB run uses the accepted harness with its own random loopback port and
owned disposable PostgreSQL container. No shared 55432 instance, destructive
feedback fixture, production endpoint, paid/model/provider call or external
storage was used. Existing `.venv` was reused; no dependency installation.

- `red17.txt`: **15 failed, 22 passed**. Thirteen expected new-task failures
  demonstrate the missing supervisor/worker/drain/configuration interfaces.
  Two pre-existing reviewer tests fail because they sequentially attempt a
  second write while the first connection holds the now-global statement gate:
  `test_two_claimers_never_take_the_same_row` and
  `test_second_claimer_gets_nothing_when_only_row_is_locked`.
- `green-attempt17.txt`: **3 failed, 34 passed**. The first implementation exposed
  a real subprocess reaping race, plus those two inherited fixture failures.
  Reaping now has the explicit shared bound described above. The first queue
  fixture now runs its second claimant on a controlled sibling thread and commits
  the first before joining. The second uses a plain row lock to isolate SKIP
  LOCKED behavior. Exactly-once/distinct-row and no-row assertions remain; no
  database gate or policy was weakened. Controller confirmed this ordinary
  fixture adaptation is in scope.
- `green-expanded17.txt`: **1 failed, 81 passed**. A real K=3 stalled reviewer
  exposed deadline observation delayed across three joins. The signal now records
  the deadline and every individual join checks it.
- `red-drain-deadline.txt`: **1 failed**. Shutdown initially extended maintenance
  past its original process deadline. The drain loop now independently enforces
  that original deadline; the regression expects maintenance killed at 90 seconds
  and a reviewer stopped at its separate 30-second drain deadline.
- `green-process.txt`: **13 passed, 4 deselected**. An intentionally process-only
  selection excluded DB tests by name; this is not the required DB covering lane.
- `green-measured17.txt`: **83 passed, zero skips**, before adding the final real
  maintenance SIGTERM integration case. Final covering runs supersede it.

Final covering scope includes the entire `test_lifecycle_supervisor.py`,
`test_reviewer_worker.py`, `test_lifecycle_maintenance.py`, and
`test_maintenance_controlflow.py` modules. Controlled fake clocks prove startup,
900-second recurrence, restart isolation, 90-second kill, shared drain, spawn
failure and already-stopped behavior. Real children prove stalled-reviewer
independence from a terminated external cron, bounded SIGTERM with K=1/K=3,
supervisor signal handling and repeated startup. A real maintenance subprocess
acquires its persisted claim, receives SIGTERM, releases normally, and a fresh
worker/connection completes the next sweep. Ordinary DB tests cover flag-off,
claim contention/release, failure rollback, scheduled health, increasing normal
restart generations and connection closure. Existing accepted sweep timing tests
exercise actual bounded transaction flow and renewal on both server versions.

No excluded lifecycle security modules or refused probes were run, reconstructed,
split or delegated. In particular this work does not independently establish
expired/stale callback rejection at commit time, adversarial capacity accounting
or tenant isolation. Existing reviewer queue claim-version/recovery tests are
ordinary queue regressions, not substitutes for that missing lifecycle security
review. Normal generation/replay-floor observations are not an adversarial verdict.
A repository-wide pytest run would enter the explicitly excluded review scope;
the dispatch's selected covering suite takes precedence over generic skill advice.

## Final results and resource measurements

Python: **3.12.14**. Final lane versions, results and resource figures follow.
The measurement helper is included in evidence for reproducibility; it samples
only test subprocesses and the harness-owned database, never credentials.

| Metric | PostgreSQL 17 lane | PostgreSQL 16 lane |
| --- | --- | --- |
| Server | 17.11 (Debian 17.11-1.pgdg13+2) | 16.15 (Debian 16.15-1.pgdg13+2) |
| Result | **84 passed, zero skipped** | **84 passed, zero skipped** |
| Pytest wall time | 49.03 s | 56.95 s |
| Measured command wall time | 49.773 s | 57.951 s |
| Waited child user CPU | 6.914 s | 6.034 s |
| Waited child system CPU | 1.583 s | 1.379 s |
| Waited child maximum RSS | 56,528 KiB | 56,144 KiB |
| Sampled peak test-process tree RSS | 90,390,528 bytes | 90,021,888 bytes |
| Sampled peak test DB connections | 4 | 4 |
| Test DB connections before / after | 0 / 0 | 0 / 0 |
| Sampling iterations | 713 | 872 |

The observer adds one separate DB connection, excluded from the test-connection
counts. Nominal sample interval is 50 ms plus sampling/query overhead; peaks
between samples may be missed. CPU and RSS cover test client processes (and
waited children), not PostgreSQL server CPU/memory, Docker/harness overhead or
production load. Shared pages can be counted more than once in the summed
process-tree RSS. These are actual test measurements, **not cost neutrality or a
production resource forecast**. The supervisor adds one process and no DB
connection; a scheduled worker temporarily adds one connection alongside the
reviewer's configured per-loop connections.

Repository Ruff passed (`ruff.txt`). Working/staged whitespace checks passed.
The final product/test source is identical across the two covering runs. The
only edits after these runs are this report and evidence formatting/staging.

Deliverables: `reviewer/supervisor.py`, `job_discovery/lifecycle/worker.py`,
reviewer bounded drain changes, the single reviewer startCommand change,
`tests/test_lifecycle_supervisor.py`, the two reviewer queue fixture adaptations,
this report, and `task-5-evidence/` (commands, measurement helper, RED/GREEN logs).
Controller ledgers, briefs, dispatch, amendment, release-preflight and reviewer
files are explicitly excluded from author staging.

No new safeguard refusal occurred. No production write, activation, external
publication, merge, push, deployment, credential/IAM change or unrelated Railway
mutation was performed. Default flags/dry-run/archive settings are unchanged;
local fixture enablement is confined to disposable DBs. Completed-upgrade release
is authorized for the controller after all 13 tasks and permitted verification;
Task 5 alone is not the upgrade release. Safety-floor confirmation exceptions
and the reduced independent-review gaps persist.

Remaining handoff: controller's fresh permitted Task 5 requirements/code-quality
gate and Library 05 checkpoint, then Task 6. Author verification does not replace
that gate or imply any missing security approval.

## Fix Round 1 — nonpositive reviewer parallelism compatibility

FIX_BASE: `a6131a02282174078e34ecdd28d967294a524a90`. Read the full
`task-5-requirements-review.md` and its complete saved ordinary diagnostic,
`task-5-review-evidence/nonpositive-parallelism.txt`. The permitted review verdict
was **Spec FAIL / Quality CHANGES_REQUIRED**, with one P2 finding: the new daemon
thread construction used `range(k)`, silently starting no reviewer loops when
configured parallelism was zero or negative. The pre-Task-5 `k <= 1` branch ran
one loop for those values. Configuration accepts them, so the finding is valid.

The narrow correction normalizes effective parallelism to at least one before
thread construction. The supervisor, process deadlines, signal-time drain,
single-loop SystemExit forwarding, parallel failure behavior, SQL/DB interfaces,
Railway config and all existing test fixtures are unchanged by this fix.

Added an offline parameterized regression for configured values **-1, 0, 1, 3**.
It runs actual `main()` and `_run_loop`, with only connection/API-key/signal and
request-handler boundaries stubbed. A bounded barrier ensures all three parallel
loops reach the handler before a simulated exit can stop siblings. Assertions
verify the effective loop count, request-handler invocation for every connection,
connection closure, no surviving loop thread, single-loop exit code 7 and parallel
fatal exit code 1. No real DB or provider is contacted.

Exact commands are appended to `task-5-evidence/commands.txt`:

- `fix1-red.txt`: **2 failed, 2 passed**, reproducing the missing processing path
  at -1/0 before changing product code; 1/3 already worked.
- `fix1-green.txt`: **4 passed** after normalization.
- `fix1-focused.txt`: **23 passed, 23 deliberately deselected, zero skips**,
  4.54 seconds. This covers offline supervisor scheduling/termination/restart,
  real controlled child processes and reviewer drain/failure/configuration paths.
  DB cases were excluded by explicit name selection.
- `fix1-ruff.txt`: repository Ruff passed. Working and staged whitespace checks
  passed. Source/tests were unchanged after those runs.

This fix changes no DB test, DB protocol or maintenance code. Per the narrow fix
scope, the full 84-test resource lanes were not repeated. The earlier PostgreSQL
17.11/16.15 results and measurements remain pinned to the original Task 5 source
`a6131a0`; they are historical evidence, not fresh executions of the correction.
The correction has the fresh focused offline verification listed above. No new
resource/cost claim is made.

No excluded security review or probes, external/provider calls, release actions,
new safeguards, subagents or reviewer substitutions occurred. Task 3 remains
not fully security-approved, with its expiry/capacity/cross-user/adversarial
review gaps unchanged. The configuration finding is author-fixed and tested;
independent scoped re-review of the original package plus correction remains
for the controller before Library 05 and Task 6. Only this worker line change,
the new offline test, author report and author evidence are committed forward;
controller/reviewer files remain excluded.
