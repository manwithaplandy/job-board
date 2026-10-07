# Task 2 author dispatch preparation

Dispatch only after Task 1's requirements and security gates pass and its full
Git bundle has a confirmed Library ID. Record the actual dispatch BASE then.

Fresh sole implementation author, gpt-6-astra/high, fork none. Worktree:
`/workspace/job-board/.claude/worktrees/lifecycle-recovery`; branch:
`feature/lifecycle-recovery`. Shell `/bin/bash`, `login:false`.

Read repository AGENTS.md/CLAUDE.md instructions, the approved recovered spec
and plan, and `task-2-brief.md` completely. Global constraints, shared interfaces
and binding amendments in that brief are authoritative. Existing upstream
main a8c4b82 is preserved; original source 114cce96 is historical reference.
Implement precisely Task 2 with tests first and forward commits. No agents or
reviewers: the controller performs both independent gates. Do not stage the
controller ledger, review packages, dispatch notes or reviewer reports.

This task must create service-only versioned lifecycle controls and nullable
private snapshot/version prerequisites before Task 3 installs enforcement.
Flags default off; no activation or invented historical timestamps. Preserve
current main's existing legacy Job IDs, private FKs, RLS and behavior. Avoid a
whole-corpus migration update; explicit bounded identity mapping, restart and
idempotence tests are required. Shared SQL migration and schema must match via
the frozen-baseline harness. New service tables have RLS and no client writes.
Read/reuse Supabase skill guidance for local SQL, not production calls.

Run targeted migration/identity tests against actual owned PostgreSQL 17 and
16, with zero DB skips, plus the required existing schema/company/location
tests. Include representative flag-off legacy writes and existing RLS safety
where affected. Do not repeatedly run the whole suite without new concern.
Use the Task 1 harness only; do not touch shared setup PostgreSQL port 55432.
No production/cloud/provider/paid calls, push/merge/deploy, activation or
unrelated Railway changes. No history rewriting or source-copy shortcuts from
unavailable old implementation SHAs.

Write `task-2-report.md` and sanitized `task-2-evidence/` under this plan
workspace (git add -f required). Record exact commands, actual server versions,
RED/GREEN chronology, limitations, files and resulting behavior. Commit only
Task 2 source/tests/migration/schema/report/evidence forward. Return DONE,
final SHA and verification evidence. Stop after Task 2; await independent
review/fix rounds before any next task.
