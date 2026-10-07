# Task 3 Fix Round 2 independent requirements / quality re-review

Spec verdict: **PASS** (scoped requirements re-review only)  
Quality verdict: **APPROVED** (scoped business changes only)

Reviewed the complete forward fix from
`3880e2eef93cae3ffc0fa33424ae7c2ce4ab6061` to
`a17b6427ea06c60e801836e56114890441166842` in the lifecycle-recovery worktree.
HEAD matches the pinned Fix Round 2 commit. Scope is FR1-R1: failed/incomplete
weekly-tick retry and truthful accounting, plus Important/Critical business
compatibility regressions directly introduced by this fix.

No remaining findings in that scope. FR1-R1 is resolved.

## Requirement assessment

| Requirement | Source and evidence |
| --- | --- |
| A failed tick must not suppress its next retry for seven days | `company_discovery/worker.py:352` restricts the cadence query to completed runs. The error path at `:385` rolls back the failed transaction, marks an existing durable run error, and commits that status before re-raising to the existing queue-isolation handler. An attempt failing before the initial commit leaves no durable run or candidate inserts. `tests/test_weekly_ingest_retry.py:28` reproduces a failure in the second batch and proves that the next invocation fetches only the five remaining companies; a subsequent invocation respects the restored weekly interval. |
| Preserve committed batches and accurate run accounting | Initial ingest count and selected backlog are saved before HTTP at `worker.py:366`. The optional progress callback at `:373` runs inside the same transaction as enrichment persistence (`company_discovery/enrich_apply.py:94`–`:104`), so rollback cannot advance the recorded enrichment count. The error finalizer at `worker.py:310` preserves those committed counters and adds error/finish information. The regression asserts 50 of 55 companies survive the later batch failure, with ingested=55, backlog=5, enriched=50 in notes, and error status; the retry records ingested=0 and backlog=0. Backlog here means the selected tick batch, as documented in the author report. |
| Recover interrupted durable markers on the same or a reconnected worker | `worker.py:330` records the backend incarnation; `:338`–`:351` distinguishes the prior same-connection attempt and a departed backend from a different live owner, finalizing interrupted weekly markers as error. `tests/test_weekly_ingest_retry.py:89` is parameterized over same-connection and reconnected recovery, bypasses the ordinary Exception handler, and checks both preserved original accounting and the completed retry. The old untagged initial markers do not satisfy the completed-run cadence. |
| Do not misclassify a live overlapping attempt | The short probe/start transaction is serialized at `worker.py:329`. A marker with a different still-live backend incarnation causes a committed return at `:348`, without starting another tick or rewriting that active marker. `tests/test_weekly_ingest_retry.py:130` invokes a second real connection during the first worker's synthetic fetch and verifies that only one ingest/run occurs. |
| Keep fetches outside transactions and preserve bounded persistence | The initial commit remains before enrichment at `worker.py:371`; the helper still completes bounded fetch batches before writes and commits each batch at `enrich_apply.py:101`. Progress recording is database-only and introduces no HTTP/model/throttle work into persistence. Every new synthetic fetch checks the actual connection is IDLE. The shared helper's callback defaults to None, preserving its other existing callers. Existing affected company boundary and queue-isolation tests are included in the final covering lanes. |

The change is local weekly bookkeeping and the helper's optional progress hook.
It does not change migrations, dashboard behavior, the existing enrichment batch
size, HTTP concurrency, or the successful weekly interval. Caught failure,
interrupted recovery, live overlap, initial-transaction rollback, and completed
cadence behavior are consistent with the required business contract. No further
independent business diagnostic was needed: the submitted regression exercises
the original failed composition directly and adds its interruption/overlap cases.

## Evidence inspected

Read repository `AGENTS.md`, `CLAUDE.md`, and `dashboard/CLAUDE.md`, the prior
requirements re-review and its FR1-R1 reproduction, the complete
`task-3-fix-2-review-package.md`, the full Fix Round 2 author-report appendix,
the changed source in its current surrounding context, and the complete new
regression test file. Verified that the package's entire diff exactly equals
`git diff -U10 FIX_BASE FIX_HEAD`: **29,179 characters**, across the nine listed
files. The production changes are confined to `company_discovery/worker.py` and
`company_discovery/enrich_apply.py`.

Inspected actual final stdout at the reviewed source state:

- `task-3-evidence/fix2-final17.txt`: **109 passed, zero skipped**, actual
  PostgreSQL **17.11 (Debian 17.11-1.pgdg13+2)**, **24.72 seconds**.
- `task-3-evidence/fix2-final16.txt`: **109 passed, zero skipped**, actual
  PostgreSQL **16.15 (Debian 16.15-1.pgdg13+2)**, **33.60 seconds**.
- `task-3-evidence/fix2-red17.txt`: the earlier **2 failed / 1 passed** run
  reproduces failed-batch and interrupted-marker retry suppression before the
  correction. `fix2-green17.txt` records the intermediate **75 passed** lane;
  it is distinguished from the final expanded 109-test lanes.
- `task-3-evidence/fix2-ruff.txt`: **All checks passed**.

The author report records the exact final commands and their affected business
suite scope. These are inspected author-run results, not fresh executions by this
reviewer. No 109-test lane, earlier baseline, or dashboard lane was rerun.
No database probe, shared port 55432 access, external/provider/cloud call,
source/Git mutation, or delegation occurred during this re-review. Only this
review artifact was written.

## Acceptance boundary

This passes only the authorized Fix Round 2 requirements/business review.
The independent security gate remains separately platform-blocked. No security
analysis or probe was attempted, rephrased, delegated, or taken over here.
**Task 3 remains unaccepted, and Library 03 / Task 4 progression remains blocked
until the required independent security review is legitimately available and
accepted.** This scoped PASS does not override that gate.
