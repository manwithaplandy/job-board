# Task 4 Fix Round 1 — scoped independent rereview

**Spec verdict: FAIL. Quality verdict: CHANGES_REQUIRED.**

R4-2 is addressed. R4-1's inner-mutation overrun is corrected for the tested
scenarios, but the fix introduces a blocking lack-of-progress case during
candidate lock acquisition. This is an ordinary scheduling/resumption finding,
not a deferred security-review finding.

BASE: `8731cd32adb67755dfbbdd7ee53e09ec03d239c5`.
HEAD: `7825265abac2c2e32a61ace1caebd45563128faa`.

Read the full Fix 1 review package, author appendix and actual final stdout,
original review and saved offline diagnostic evidence, the relevant original
brief/spec requirements and scope amendment. Read `RELEASE-AUTHORIZATION.md`:
the former permanent deployment hold is superseded for the completed upgrade,
after all 13 tasks and permitted verification, with applicable safety-floor
confirmations. This reviewer takes no release action.

The complete fix package equals `git diff --unified=10 BASE HEAD`. All five
changed product/test files match HEAD exactly. Scope was only R4-1/R4-2 and
important regressions introduced by their fix. No whole-task baseline review,
covered DB test rerun, source/Git mutation, external call or subagent was used.

## Remaining important finding

### R4-1a — P1: timed prework repeatedly rolls back the same 250-Job prefix

Anchors: `job_discovery/lifecycle/maintenance.py:104`, `:109`, `:122`, `:308`,
`:335`, `:350`; `job_discovery/lifecycle/locks.py:19`.

The new timed phase ends 25 seconds after the most recent renewal starts and
begins yielding at 20 seconds. However, `_payload_batch` still loads 250 IDs and
calls `lock_jobs` for **every ID before the first yield check** or payload work.
With individually successful but moderately slow lock calls, the wrapper exhausts
the phase during that acquisition loop. `_PhaseEnded` then rolls back the entire
phase and returns blocked. Neither the persisted cursor nor `next_phase` advances.
A subsequent sweep starts with exactly the same 250 IDs and fails identically.
Thus payload retirement and the later maintenance phases can make no progress;
pre-admission maintenance repeatedly blocks additions as well.

A fresh offline diagnostic used the actual `sweep`, `_payload_batch`, `lock_jobs`
and timeout wrapper. A raw connection double charges 0.11 seconds for each
successful per-Job lock statement, well below the approved two-second lock
limit. Validation/control reads are doubles: no DB lease clock, expiry,
reservation, tenant or security enforcement was exercised. Three invocations:

```text
attempt=1 duration=25.08s retired=0 blocked=True cursor=None phase=0 total_mutations=0
attempt=2 duration=25.08s retired=0 blocked=True cursor=None phase=0 total_mutations=0
attempt=3 duration=25.08s retired=0 blocked=True cursor=None phase=0 total_mutations=0
```

No payload or progress mutation occurs before any rollback, so the diagnostic's
simple rollback implementation cannot hide an earlier committed advancement.
The author regression at `tests/test_maintenance_controlflow.py:20` covers only
0 and 0.02-second lock costs, both of which finish the upfront acquisition well
inside the phase window. Its resumable pair checks therefore do not cover this
new failure mode.

Make candidate acquisition itself bounded and resumable/adaptive, so ordinary
successful slow statements still permit a smaller chunk to commit. Preserve
sorted-lock order and the existing 2,000/20,000, 64 MiB, 90/120/30 values. Do not
advance the payload cursor past unprocessed work merely to avoid retrying it.
Add a deterministic regression in which upfront acquisition would exceed one
phase window, and prove finite committed progress through resumed invocations.
Consider the same prework pattern in version/terminal phases when implementing
the fix; no extra security guarantees or probes are requested.

## Addressed status

| Original finding | Status and evidence |
| --- | --- |
| R4-1: payload SQL loop exceeds deadline and delays renewal | **Partially addressed; not closed because of R4-1a.** `_TimedConnection` clips phase SQL and commit timeouts, including cursor statements and operations after `enter_gate`; payload checks yield between Jobs and between cache fields (`maintenance.py:47`, `:121`). An unfinished pair preserves the preceding cursor (`:148`). Counts publish after progress commit (`:338`); renewal gets a separate bounded transaction (`:301`). New actual-loop and owned-DB tests exercise slow mutations, <=30-second renewal intervals, timeout reapplication and resumed retirement. These changes address the original 500-mutation overrun, but do not provide required resumable progress when candidate acquisition itself consumes the window. |
| R4-2: denied reconnect lock falls through to optional work | **Addressed.** The failure handler sets `aborted` at `run.py:197`. The explicit branch at `:224` performs best-effort accounting and returns at `:236` before location enrichment, review or prune. Tests cover denied locks with successful and failed accounting, raising hooks on all optional phases, and a real separate-session poll-lock denial (`tests/test_run.py:710`). No further important fix-introduced reconnect regression was found in this scope. |

## Recorded test and source evidence

Actual final files were read directly:

- `task-4-evidence/fix1-final17.txt`: PostgreSQL **17.11 (Debian
  17.11-1.pgdg13+2)**; **97 passed**, zero skipped reported, **51.77s**.
- `task-4-evidence/fix1-final16.txt`: PostgreSQL **16.15 (Debian
  16.15-1.pgdg13+2)**; **97 passed**, zero skipped reported, **64.45s**.
- `task-4-evidence/fix1-ruff.txt`: `All checks passed!`.

Exact final commands in the appendix:

```sh
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_run_question_fetch.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_run_question_fetch.py -q
.venv/bin/ruff check .
git diff --check
git diff --cached --check
```

These remain valid author evidence for the covered scenarios. No covered lane
was rerun. The original 111-test results remain historical evidence for the
previous source; the current 97-test selection omits unchanged migration tests
and adds focused control-flow cases. No schema/enforcement source changed here.

New reviewer artifacts, in `task-4-evidence/`:

- `reviewer_fix1_source_evidence.txt`: exact package/source equality, SHA-256
  fingerprints and actual final test stdout.
- `reviewer_fix1_lock_progress.py`: standalone offline progress diagnostic.
- `reviewer_fix1_lock_progress.txt`: actual diagnostic output above.

Diagnostic command, run from the worktree using `/bin/bash`, `login:false`:

```sh
PYTHONPATH=. .venv/bin/python .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/reviewer_fix1_lock_progress.py
```

## Limits and next gate

The independent expiry-enforcement, capacity-accounting, cross-user-isolation,
related adversarial, stale-callback and resurrection review gaps remain open and
**not security-approved** under the amendment. Task 3 is not fully
security-approved. No refused work was retried or substituted. Neither the
passing tests nor this functional review establishes those missing guarantees.

No new safeguard rejection occurred. Source equality and recorded tests are
reviewed evidence; the new runtime observation is an offline scheduling double,
not real database latency measurement. Process-level interruption remains Task 5
work. No broader Task 4 baseline or full-plan certification is implied.

Correct R4-1a and obtain the permitted review gate and Library 04 checkpoint
before Task 5. Final completed-upgrade release remains authorized only according
to `RELEASE-AUTHORIZATION.md`; the controller owns that later action and any
applicable confirmations.
