# Task 7 Fix 1 — scoped independent requirements / quality rereview

**Scoped Spec: PASS. Quality: APPROVED. Original R7-1: ADDRESSED.**

No fix-introduced Important or Critical finding was established. This verdict covers the original sole finding and regressions introduced by its correction; it is not a new whole-task, full-source, security, activation or release approval.

Pinned range: `1f897475023a50fa029def5a5e9e016ded794a8b..1f05ae5d9b9d2e80369cfdfcfa57b86e2151898b`. Working HEAD matched the fix pin when inspected. The complete recorded `task-7-fix-1-review-package.md` diff was compared with `git diff --no-ext-diff --unified=10` over these exact commits and matched. Controller documentation in the range was distinguished from the seven changed product/test files. Concurrent controller working-document edits were left untouched.

Reviewed the original requirements review, Task 7 brief/binding amendments, Fix1 report addition, exact commands and all eight Fix1 evidence logs, plus relevant changed callers and tests. The review-scope amendment and release authorization remain applicable. No product edits, commits, subagents, covered-suite reruns, production/network/paid calls or new diagnostic execution occurred. Read-only source/package comparisons were sufficient for this rereview.

## R7-1 closure

The correction restores a functioning, tested pre-cutover flag-off path instead of relying on future Task 8 hydration to satisfy the intermediate-commit requirement.

- `job_discovery/lifecycle/config.py:41–60` adds a read-side compatibility decision over existing service controls and the existing permanent maintenance cutover timestamp. It permits legacy description capture before source/hydration/maintenance activation, enforced mode, archive-ever activation or recorded cutover; missing cutover state raises an error. The existing cutover interface is consumed without a new activation flag or schema change. The existing maintenance contract records cutover on maintenance enable and preserves it; this review did not independently retest its enforcement.
- `job_discovery/db.py:133–162` restores extraction only when that decision permits it. Both batch and single-item legacy writes pass through the decision. Existing SQL at lines 108–129 still preserves populated descriptions and refuses to refill pruned rows. The default `_posting_row` behavior remains lean unless its internal caller explicitly supplies the compatibility result.
- `job_discovery/run.py:49–70` makes the conditional description part of the existing chunk forecast and calls the guarded upsert in the same transaction. Lines 137–141 commit the control/gate read before Workday/SmartRecruiters adapter work, and the writer rechecks after fetching. This is ordinary use of the established write contract, not an independent capacity, expiry or concurrency-enforcement verdict.
- `tests/test_lifecycle_legacy_consumer.py:22–52` now runs actual polling, SQL admission, reviewer selection, stage 2 and review persistence for new Lever, Workday and SmartRecruiters Jobs. Only external adapter/provider boundaries and unrelated location/prune work are doubled. It checks the precise JD received by the provider double and the stored approved review. The formerly affected reviewer is no longer replaced with a no-op in this compatibility coverage.
- The durable-cutover fixture at lines 55–67 covers both a new Job and a previously uncaptured Job with flags off; both stay lean after recorded cutover. The Workday/SmartRecruiters fixtures at lines 90–106 check that details are disabled and unsolicited descriptions remain transient after cutover. The seven-state reader matrix is explicitly mock-based; it does not claim to test control transitions or privileges.
- `dashboard/app/api/application/prepare/route.test.ts:205–219` checks propagation of the stored JD into prepare's generation arguments and the real resume prompt builder. This is appropriate narrow coverage for the unchanged dashboard consumer: DB-query and generation boundaries are mocked, so it is not claimed as a cross-language database-to-model integration test. Existing question fallback tests remain present and were included in the recorded selected Vitest run. Routine question backfill is not restored.

The source-admission implementation in `identity.py` and `reconcile.py` is unchanged by Fix1 and does not call the new legacy compatibility reader. Its lean behavior and existing 25-posting business-row bound are not altered by this correction. No new migration, control default, archive producer or retirement activation is introduced. Compatible demand consumers remain required before actual lifecycle cutover.

## Exact evidence and timing limitation

Commands and exit statuses are preserved in `task-7-evidence/commands.json`; results below were read from the corresponding actual logs, not rerun by this reviewer.

| Log | Recorded result |
| --- | --- |
| `fix1-01-red.txt` | PostgreSQL 17.11: 10 failed, 1 passed, 3.73 seconds; includes the real missing-JD/detail failures before correction |
| `fix1-02-green.txt` | PostgreSQL 17.11: initial 11 compatibility cases passed, 6.77 seconds |
| `fix1-03-prepare-generation.txt` | Offline Vitest: 45 passed across 2 files, 1.65 seconds |
| `fix1-04-covering-pg17.txt` | PostgreSQL 17.11: **72 passed, 1 failed**, 114.87 seconds; zero skips |
| `fix1-05-covering-pg16.txt` | PostgreSQL 16.15: **72 passed, 1 failed**, 135.03 seconds; zero skips |
| `fix1-06-bulk-pg17.txt` | Only the previously failing bulk case, unchanged: 1 passed, 9.36 seconds |
| `fix1-07-bulk-pg16.txt` | Only the previously failing bulk case, unchanged: 1 passed, 13.38 seconds |
| `fix1-08-static.txt` | Changed Python Ruff passed; `git diff --check` exit 0 |

All 13 final Fix1 consumer/read-side/cutover cases passed in each covering DB lane. The only failure in each 73-case selection was the existing `test_enforced_source_orchestration_chunks_metadata_and_sightings`: `new_jobs` was 50 instead of 70. Both concurrent combined runs remain failed runs; there is **no complete 73-case all-green run** in this evidence. The subsequent sequential passes neither erase those failures nor prove a throughput guarantee.

The author identifies the real 60-second source budget under concurrent execution as a possible explanation. That explanation remains **unproven**: the logs do not establish the elapsed board-time cause. The bulk fixture and its source-admission path are unchanged by the fix, and the new compatibility function is not called there. The unchanged single-case passes on both versions, together with the absence of a changed caller on that path, do not establish a concrete fix-introduced Important regression. The result is retained as a timing/reproducibility limitation for later integration verification, not converted into either a proven contention diagnosis or an all-green suite claim.

Vitest was run before two Python-only post-cutover fixtures were added; no later dashboard change invalidates that selected result. The original pre-Fix1 72-pass lanes and still earlier 101/71-pass lanes remain historical snapshots, not final Fix1 evidence. No whole-source recovery/performance retest was requested or supplied here.

## Remaining boundaries

No separate minor finding is required. Full Task 6 Spec remains FAIL pending mandatory R6-4 above-guard durable reconciliation and R6-5 shared transport integration in Tasks 8/10/13. Task 3 expiry/capacity/cross-user/adversarial independent-review gaps remain deliberately unreviewed. This rereview did not retry, reproduce or substitute for refused work, and did not revisit the abandoned process-environment diagnostic. Task 8 demand hydration, Task 10 outbox integration, later verification and the controller's completed-upgrade release workflow remain separate requirements. The scoped approval closes R7-1 only within the permitted development review.
