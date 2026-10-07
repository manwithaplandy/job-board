# Task 3 author dispatch preparation

Dispatch a fresh sole gpt-6-astra/high author only after Task 2 passes both
independent gates and its complete-history bundle has a confirmed Library ID.
Record the actual dispatch BASE then. Do not reuse old implementation SHAs.

Read all repository instructions, approved recovered spec/plan and the complete
`task-3-brief.md`, including global constraints and binding amendments. Inspect
the Task 2 contracts and report before designing SQL/module integration.
Implement exactly Task 3, tests first, with forward commits. No agents or
author-selected reviewers. The controller owns two independent gates and
checkpoint persistence; the author owns all source/test/migration fixes.

This is Checkpoint A's security/concurrency foundation. Inventory every relevant
mutator and cascade root from actual catalog FKs and code callers before
installing the ONE global BEFORE STATEMENT gate. It must precede relevant
row/FK locks, then sorted job locks. Include public typed evidence, the existing
seven private job-linked children, claims/reservations/staging, demands and root
account deletion paths. Do not defer an already-required writer to Task 13.
Record the inventory and actual grants as evidence. Read-only transactions
need no gate; no HTTP/model/S3/sleep inside transactions.

Controls already exist. Add guarded transitions and real activation/helper
tests, with original invoking SQL role/JWT subject/owner/job/scope validation.
Private helper execution must be denied through catalog checks AND attempted
calls; do not privilege user/job DML or trust a forged GUC. Legacy and collect
must stay compatible; capacity/version row enforcement activates only at the
approved enforced stage. Archive activation stays unavailable until destination
and producer/writer readiness are genuinely validated. Sticky archive state
cannot be cleared by disable/rollback. Map Task 2's bounded explicit legacy/
collect mapper into the required gate protocol without inventing safety-ready
history or permitting enforced/archive writes through its old path.

Use DB time, owner/version fencing, replay floors and current transaction/backend
capabilities. Test both orders of approval/prune, multi-job opposite orders,
root cascades, foreign-user rejection, concurrent reservations, expired claims,
crash fencing, active leases, snapshot protections and own valid zero-byte
protection. The physical guard remains 6000 MiB and includes every held
reservation; DELETE provides no physical credit. Keep flags off by default.

Use owned random-loopback PostgreSQL 17 AND 16 through the accepted harness.
Run affected safety/activation/migration/RLS tests without DB skips and new
dashboard lifecycle DB tests on both majors where practical, with actual
versions recorded. Keep existing CI 16 and added 17. Do not touch shared setup
port 55432 or run unchanged destructive feedback fixtures against new URLs.
Task 13 safely adapts those separate fixtures. Typecheck/lint affected dashboard
code and preserve total boundary parsers, no zod or unvalidated boundary casts.

No production/cloud/provider/paid calls, activation, push/merge/deploy,
infrastructure/IAM changes or unrelated Railway edits. Worktree
`/workspace/job-board/.claude/worktrees/lifecycle-recovery`, shell `/bin/bash`,
`login:false`; existing ignored dependency symlinks remain local only.
Write `task-3-report.md` and sanitized `task-3-evidence/` in this plan workspace
(git add -f required). Include RED/GREEN chronology, exact commands, inventory,
actual versions, limitations and resulting behavior. Exclude controller ledger,
dispatch/review files from commits. Return DONE + final SHA + evidence and stop
at Task 3 for controller independent review. Continue promptly without asking
for production readiness or user confirmation already covered by local scope.
