# Task 4 author dispatch preparation

Dispatch after the approved REVIEW-SCOPE-AMENDMENT.md and confirmed reduced-scope
development checkpoint. Task 3 is usable for development, never fully security-approved. Record that actual BASE. Use a fresh sole
implementation author; no author subagents or self-selected reviewers.

Read repository instructions, complete `task-4-brief.md`, approved spec/plan,
Task 3 contracts/report and actual gate/claim interfaces. Implement precisely
bounded global maintenance before additions, with tests first and forward
commits. Controller owns reviews/ledger/persistence, never source fixes.

Call pre-admission maintenance before target loading and poll lock, including
inactive users, empty targets, held lock, blocked/failed physical guard,
exceptions and reconnects. Failed safety maintenance blocks admission while
verification can proceed. Preserve PR 16's existing above-guard closure path;
verify actual control order rather than rediscovering the old issue.

Retire only eligible unprotected payloads, never Job identity or private work.
Description/question limits are 30/7 elapsed UTC days from actual use or
capture; sightings/cache reads do not reset them. All users' approvals,
corrections, packages, scores, edits, active generation/review leases and demand
snapshots remain protected. Query and recheck under the reviewed gate with
sorted job locks. Batches 2000, total cap 20000, deadline 90 seconds, persisted
fairness cursor. Dry-run remains default and retirement stays dry-run if
readiness is incomplete.

Enabling new maintenance must atomically disable legacy destructive prune;
stale callers and rollback cannot restore unsafe Job deletion/refill. Preserve
the tested flag-off legacy path before cutover. Pending/unarchived versions
cannot be erased as if safely archived. Cleanup completed staging only after
committed reconciliation and 24 hours; abandoned staging at seven days only
after fencing and advancing persistent replay floors. Never age away unresolved
reservations or lose counter/miss evidence; stale callbacks cannot resurrect
cleaned state. Add the binding real-DB tests for these cases.

The physical limit stays 6000 MiB with every held reservation and headroom;
DELETE supplies no physical credit. Measure allocated/live/reusable metrics
honestly and mark action needed after two guard-active scheduled sweeps. No
VACUUM FULL, notifications, LLM, network or production writes. Use raising hooks
to prove maintenance cannot invoke external/paid actions.

Use owned random-loopback PostgreSQL 17 AND 16 via the accepted harness, with
zero DB skips. Run maintenance plus affected prune/guard/run and migration/RLS
tests; broaden once only if changes or failures justify it. Do not touch shared
setup port 55432 or destructive reserved dashboard fixtures. No production,
activation, provider/cloud calls, paid calls, push/merge/deploy, infrastructure
or unrelated Railway edits. Worktree:
`/workspace/job-board/.claude/worktrees/lifecycle-recovery`; `/bin/bash`,
`login:false`.

Write `task-4-report.md` and sanitized `task-4-evidence/` in this ignored plan
workspace (git add -f). Include exact commands/versions, RED/GREEN, resulting
behavior, limits and inventory changes. Commit Task 4 files/report/evidence
forward; exclude controller artifacts. Return DONE + SHA + actual evidence,
then stop for independent review. No Task 5 before permitted requirements/quality review and Library save.
Read REVIEW-SCOPE-AMENDMENT.md first; never retry refused security analysis/probes.
Ordinary Task 4 correctness tests are permitted; report the deliberately unreviewed gaps.
