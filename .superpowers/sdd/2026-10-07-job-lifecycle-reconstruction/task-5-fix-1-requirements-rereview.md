# Task 5 Fix 1 independent scoped re-review

Spec: **PASS**

Quality: **APPROVED**

FIX_BASE: `a6131a02282174078e34ecdd28d967294a524a90`

FIX_HEAD: `ed9788105f98fd0d8f7438636d6e6c50ac3c919a`

Reviewed on 2026-10-07. Scope is the single nonpositive-parallelism P2 finding
from `task-5-requirements-review.md` and any important ordinary regression
introduced by this correction. The original review remains the assessment of
the rest of Task 5. This report closes its sole blocker; it does not reopen or
broaden the baseline review and supplies no security approval.

## Finding resolved

`reviewer/worker.py:229`–`230` now computes
`k = max(1, config.REVIEW_WORKER_PARALLELISM)` before constructing the daemon
threads. Configured values -1, 0 and 1 therefore all take the existing effective
single-loop path; 3 still starts three loops. This restores the pre-Task-5
fallback and prevents successful child exits with no queue-processing loop.

The actual diff changes only that effective-count expression and its explanatory
comment in product code. Thread ownership, signal handling, `_drain_threads`,
daemon status, process deadlines, single-loop SystemExit forwarding and parallel
fatal handling are unchanged. At `reviewer/worker.py:263` the normalized count
still selects the single-loop exit contract for every configured value <=1.
The established bounded drain path now also applies to restored 0/negative
configurations through the same effective path as 1. No new important ordinary
regression was found in this correction.

The new test at `tests/test_reviewer_worker.py:595`–`633` uses actual `main()`
and `_run_loop` with offline connection/request/signal/API-key boundary doubles.
It verifies -1/0/1/3 start the correct number of loops, every connection reaches
request processing, connections close, no review-loop thread remains, and exits
retain code 7 for one loop versus code 1 for parallel fatal termination. The
three-loop bounded barrier ensures every loop reaches processing before a
sibling's simulated exit can stop it. This is meaningful behavioral coverage
of the reported failure, not merely an assertion of the normalization expression.

## Evidence inspected

Read the full `task-5-fix-1-review-package.md`, actual worker/test source,
`task-5-report.md`'s **Fix Round 1** section (the fix report is appended there),
the exact command additions and actual evidence files:

- `task-5-evidence/fix1-red.txt`: **2 failed, 2 passed** before correction;
  specifically -1 and 0 failed to enter the expected processing/exit path.
- `task-5-evidence/fix1-green.txt`: **4 passed** in 0.24 seconds after correction.
- `task-5-evidence/fix1-focused.txt`: **23 passed, 23 deliberately deselected,
  zero skips** in 4.54 seconds. Its explicit selection covers ordinary offline
  reviewer/supervisor process paths, existing controlled SIGTERM/stalled-request
  drain cases, normal cooperative drain, reconnect/fatal exit and the new
  configuration regression. Deselected DB cases are not represented as passing.
- `task-5-evidence/fix1-ruff.txt`: recorded repository Ruff result is clean.

Fresh reviewer verification confirmed HEAD is the stated fix commit, the
working product/test files have no diff from that commit, and the pinned
BASE-to-HEAD whitespace check exits successfully. The test results above are
author-executed evidence independently read by this reviewer; no covered lane
was rerun and no new dynamic diagnostic was necessary for the one-line fix.

The original **84 passed / zero skips on PostgreSQL 17.11** and **84 passed /
zero skips on PostgreSQL 16.15**, including their resource figures, remain
historical evidence at FIX_BASE `a6131a0`, as the updated author report states.
They are not claimed as fresh runs of FIX_HEAD. This correction changes no
database interface/protocol, maintenance code, Railway file, existing DB test
or measurement helper, and makes no new resource or production-cost claim.

## Scope and handoff

Implemented: the effective minimum of one reviewer loop. Author-tested: the
four offline configuration cases and selected 23-case ordinary suite.
Independently reviewed: the correction, regression test, selected evidence and
unchanged drain/exit integration. No remaining Task 5 requirements/code-quality
blocker was identified after this correction.

Task 3 expiry enforcement, capacity accounting, cross-user isolation and related
adversarial/stale-commit guarantees remain deliberately unreviewed under
`REVIEW-SCOPE-AMENDMENT.md`. No refused probes were retried or reconstructed.
No source/Git mutation, subagent, DB/provider/network/model/S3 call, release
action or new safeguard refusal occurred during this re-review; only this report
was written.

The permitted Task 5 development gate is clear for the controller to complete
Library 05 and proceed to fresh Task 6. `RELEASE-AUTHORIZATION.md` continues to
govern completed-all-13-task publication/merge/service-scoped deployment by the
controller, with the recorded safety-floor confirmation exceptions and explicit
security-review gaps. This reviewer performed no release action.
