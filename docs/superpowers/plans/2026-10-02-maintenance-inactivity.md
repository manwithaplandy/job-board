# Maintenance, inactivity and feedback implementation plan

> For agentic workers: follow test-driven-development; independent domains use dispatching-parallel-agents, then integrated verification and review.

**Goal:** Reconcile closures under the disk guard, protect shared history, pause inactive free/comped matching, and capture authenticated feedback.
**Architecture:** Keep the existing Python poller/reviewer, PostgreSQL tenant isolation, Next.js dashboard and per-user review queue. Database state coordinates eligibility and duplicate requests across processes. No new services.
**Spec:** User-approved delegation in this session; constraints and acceptance cases copied below.
**Tech stack:** Python/pytest, PostgreSQL, Next.js/React/TypeScript/Vitest.

## Global constraints
- Base 73ce118; isolated branch feat/maintenance-inactivity. No push, PR, deployment, production migration or production row mutation.
- Never raise the 6000 MB guard, use stale last_seen as deletion age, or blindly VACUUM FULL.
- Preserve application packages, approved reviews, all corrections and unrelated Railway changes.
- Free/comped users pause after 7 days of meaningful inactivity; paid subscribed users continue. Polling is not activity. Explicit resume queues per-user work, deduplicated and rechecked when executed.
- Discovery is separate and always-on; inactivity alone does not remove baseline discovery cost.

## Review focus
- Incomplete/truncated/failed source responses must never imply closure.
- A failed source that deactivates a company must not become deletion authorization.
- Queued work must observe subscription/activity changes after enqueue, including across workers.
- Resume racing an active request must not lose the request or duplicate paid work.
- Feedback authorization and database-enforced limits must survive concurrent requests and direct authenticated access.

### Task 1: closure reconciliation and bounded history-safe cleanup
Files: job_discovery/run.py, prune.py, adapters as needed; tests/test_size_guard.py, test_prune.py and source adapter tests.
Produces: guarded poll still checks complete authoritative sources, never ingests or enriches; closed-only bounded cleanup with protected histories, no per-user description stripping.
- [x] Write failing source-error/partial-result/guarded-closure tests; run pytest to see assertion failures.
- [x] Write failing history and inactive-company retention tests; verify failures against throwaway local Postgres.
- [x] Implement only successful complete source reconciliation and bounded maintenance.
- [x] Run targeted tests, record outcome, commit domain changes.

### Task 2: inactivity policy, meaningful activity and explicit resume
Files: reviewer/db.py, run.py; dashboard review request library/API/panel and deliberate mutation actions; new migration and matching schema additions.
Produces: durable 7-day eligibility policy shared by all Python review entrypoints, status UX and explicit resume using existing deduplicated queue. Paid exemption based on valid actual subscription, never comp tier name alone.
- [x] Write failing paid/free/comped/boundary/no-poll-activity/queued-recheck/resume-duplicate tests.
- [x] Implement schema, worker execution gate, explicit action tracking and resume transaction.
- [x] Verify targeted Python and dashboard tests plus local DB concurrency cases; commit domain changes.

### Task 3: authenticated feedback
Files: dashboard feedback action/component/page and focused library; separate migration; tests for schema/security/validation/rate limiting.
Produces: issue/criticism/feature-request capture, no paid external service; authenticated own-user insert, validated bounded input, serialized database rate limit and no broad user read/update access.
- [x] Write failing unauthenticated/invalid/oversize/cross-user/concurrent-rate tests.
- [x] Implement capture and accessible UX within existing dashboard architecture.
- [x] Verify targeted tests; commit domain changes.

### Task 4: integrated verification and rollout handoff
- [x] Run full pytest against explicit local throwaway DB, full dashboard test suite, typecheck and relevant lint.
- [x] Review complete diff and remediate important findings with regression tests.
- [x] Write migration sequencing, rollback/disable path, dry-run cleanup SQL and disk reclamation limits.
- [x] Read-only connected production estimate only if credentials/tools available; otherwise report unavailable without guessing.
- [x] Commit final documentation and report evidence plus blockers to parent. No remote mutations.

## Execution ledger
- Checkout clean at 73ce118; missing checkout .agents/skills and dashboard/AGENTS.md; dashboard/CLAUDE.md read.
- Python baseline: 481 passed, 259 DB-dependent skipped (no DB environment configured). Local throwaway Postgres is supplied and will be explicitly used for integration tests.
- Ruling: existing user-selected isolated cloud checkout plus new branch satisfies requested isolation; no extra nested worktree or unrelated ignore commit.
- Ruling: execute approved scope without re-requesting approval of the plan, as explicitly directed by user.

- Task 1 complete: e2148f3; 116 focused regression tests passed, including failed/incomplete source and concurrency cases.
- Task 2 complete: 8cae672; 26 final inactivity regressions passed, including duplicate/resume/billing/cross-process recovery races.
- Task 3 complete: d1452e3; 1674 dashboard tests passed (14 skipped), including 5 real feedback database tests.
- Task 4 complete: integrated Python 791 passed (0 skipped); typecheck/Ruff/scoped ESLint/diff checks passed; additive migrations rehearsed against 73ce118 schema twice and final revisions reapplied locally.
- Independent review important findings fixed with red-green regressions: Workday duplicate/changing totals, prune versus approval update, cross-process stale recovery of resume. No important findings remain open.
- Read-only production estimate: 0 eligible cleanup rows; 148 closed>30d all protected; database 6,644,329,619 bytes. No production mutations.
- Known limits: closure/reopen writes are per-company; cleanup row-bounded. Incomplete Workday boards conservatively skip. Seven-day rollout grace uses migration time; passive board filter writes do not count. No live authenticated browser test with placeholder local auth. No immediate physical disk reclamation promised.

- Final prepublication review (fresh reviewer, pinned4105c43) found residual unlock-to-finish queue race and in-flight feedback erasure race. Fixed within original scope: generation-fenced execution/completion and feedback-lock-coordinated erasure. New regressions observed red then green; final suites794 Python,1676 dashboard passed (14 dashboard skipped). Revised migrations rehearsed twice from73ce118. Deployment order explicitly drains old consumers; no production/publication action authorized or performed.
