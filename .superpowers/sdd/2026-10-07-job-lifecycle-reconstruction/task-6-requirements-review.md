# Task 6 independent requirements and code-quality review

Date: 2026-10-07. Reviewer: recovery_task06_requirements_review.

BASE: `ec588ac87f1dc0a3bbf685d9c8dfee0b79e1b409`
HEAD: `db73ad7365790419c4a1a82ec38ae21e4c7233c3`

**Spec: FAIL. Quality: CHANGES_REQUIRED.** No Critical findings. Five Important findings below; two are already documented integration limitations and three are additional ordinary functional gaps. Development-continuation authorization does not waive these functional requirements or establish release readiness.

## Scope and evidence

Read the reviewer dispatch, REVIEW-SCOPE-AMENDMENT.md, RELEASE-AUTHORIZATION.md, Task 6 brief/report, full recorded range package and evidence outputs. Inspected the changed product/test files and relevant existing caller/adapter interfaces. Actual worktree HEAD matched the pinned HEAD. Controller documentation changes already present in the worktree were left untouched.

This is a fresh Task 6 requirements/source-correctness and code-quality review. It is not a replacement Task 3 security review. Expiry enforcement, capacity accounting, cross-user isolation and related refused adversarial review/probes remain deliberately unreviewed. No such probes were attempted. No subagents, network/provider/paid calls, production access, DB connections, source edits, commits, activation or deployment were used. No new safeguard rejection occurred.

Author-selected tests were not rerun. Inspected recorded evidence reports:

- PostgreSQL 17.11: broad affected suite 231 passed in 134.78s; PostgreSQL 16.15: 231 passed in 167.87s. These precede the final refinements.
- Final qualifying-completion source/completeness lanes: 43 passed on 17.11 in 67.68s; 43 passed on 16.15 in 54.97s. Separate caller/rotation lane: 36 passed on 17.11 in 4.33s.
- Earlier RED and failing integration outputs match the report's chronology (78/8, 132/5, 141/3 passed/failed), followed by 159 passed and 38 passed lanes. Successful recorded lanes show no skips. Commands, scopes, server versions, Python 3.12.14, pytest 9.1.1 and Ruff 0.15.20 are recorded in `task-6-evidence/commands.txt`.
- These are inspected author results, not independently rerun DB verification. The broad compatibility lane is not represented as having run after all final source changes.
- Fresh reviewer checks: pinned `git diff --check BASE HEAD` exited 0; two narrow in-memory diagnostics described below exited 0 and demonstrated uncovered ordinary functional problems. Both mocked all external interfaces and used no DB or network.

## Important findings

### R6-1 — Production deadline exit abandons the persisted reconciliation tail

Location: `job_discovery/lifecycle/reconcile.py:320-338`; selection and new-enumeration path at `:51-57` and `:265-267`; checkpoint consumption at `:199-208`.

After a complete feed, the caller commits a reconciliation chunk and exits its loop when the cycle deadline is reached, even when `done` is false. It then unconditionally cancels the claim. There is no production selection/resume path for that incomplete completed enumeration: the next due turn creates a new enumeration, whose checkpoint starts at the beginning. A restart after feed completion likewise has no caller path to load the old enumeration/checkpoint. The completed feed's successful timestamp and next-due timestamp have already advanced.

This defeats the required persisted checkpoint recovery at the actual entrypoint. Repeated exhaustion can keep the same lexicographic tail from receiving absence reconciliation even while repeated feed verification succeeds. Starting mutable *pagination* afresh is appropriate; it does not justify abandoning reconciliation of already complete, immutable membership.

Evidence: `tests/test_lifecycle_reconcile.py:118-135` directly calls `reconcile_chunk` with the same in-memory EnumerationRef on a new connection. It proves that helper can read a checkpoint; it does not exercise scheduled recovery. The reviewer ran the actual `verify_due_sources` with local doubles, an empty complete feed and a `reconcile_chunk` double that advanced monotonic time past the deadline and returned false. Output:

```text
caller trace: ['complete feed', 'checkpoint committed; done=False', 'cancelled claim']
reported: {'ok': 1, 'failed': 0, 'new_jobs': 0, 'closed_jobs': 0}
```

Fix: make pending complete-enumeration reconciliation an explicit resumable scheduler responsibility, with a permitted fenced ownership handoff and persisted cursor. Do not mark that responsibility finished on budget exit. Add an ordinary entrypoint test that stops after a committed nonterminal chunk, discards the worker/connection, resumes through the production scheduler, and proves finite completion of the tail. Keep unsafe partial pagination restarting from page zero.

### R6-2 — Completion-plus-24-hours scheduling skips the next daily cron

Location: `job_discovery/lifecycle/reconcile.py:53` and `:180-187`; sole scheduled invocation at `job_discovery/run.py:120`. Binding cadence: design spec `:134-135`, daily one-shot cron `:176-179`.

For enabled sources, `next_due_at` is completion time plus 24 hours. A board finishing at 00:00:20 UTC is therefore not eligible at the next day's 00:00:00 run. When it is the only board, `claim_due_source` returns None and the run exits; there is no later wake-up. It next verifies approximately 48 hours after the previous attempt. This can happen to healthy small boards without budget pressure, and failure-disabled day-based retries have the analogous extra-day slippage.

The finite-six-turn test explicitly clears `next_due_at` between fixture cycles (`tests/test_lifecycle_reconcile.py:214`), so it does not establish daily scheduled eligibility. This is source/caller analysis, not a runtime cron test.

Fix: align scheduling eligibility to the authorized UTC cron slots (or otherwise provide an authorized due-work invocation that meets the cadence), while keeping the separate **elapsed 24-hour successful-miss qualification** intact. Add ordinary deterministic tests spanning real daily invocation slots and nonzero feed duration. Do not relax the two-miss elapsed-time rule to fix scheduling.

### R6-3 — Three adapters still lose trustworthy positives on later parse failure

Location: `job_discovery/adapters/greenhouse.py:32-36`, `lever.py:39-40`, `ashby.py:30-31`; eager parsers at `greenhouse.py:7-24`, `lever.py:15-31`, `ashby.py:7-22`.

These adapters construct an entire list before returning SourceResult. A valid first item followed by another identifiable item missing title/text raises before any item is exposed to staging. The first valid identity cannot refresh availability, clear misses or reopen its existing Job, although its source response was received successfully. Whole-list identity validation also prevents retaining good identities when a separate item makes absence unsafe. The lazy SourceResult wrapper does not make the enclosed eager parse lazy.

Task 6's all-family trustworthy-positive requirement remains incomplete; this behavior is inherited parsing now used by the new reconciler, not a newly introduced parser regression. SmartRecruiters' streamed final-page behavior does not cover these families.

Evidence: a fresh offline diagnostic patched each adapter's `get_json` to return two distinct IDs, `good` with all required fields and `bad` with a URL but no title/text; invoked the public adapter with `fetch_details=False`; collected yielded IDs. Exact output:

```text
job_discovery.adapters.greenhouse yielded= [] error= KeyError 'title'
job_discovery.adapters.lever yielded= [] error= KeyError 'text'
job_discovery.adapters.ashby yielded= [] error= KeyError 'title'
```

Fix: separate per-item positive identity acceptance from whole-enumeration absence certification. Yield/stage trustworthy identities despite unrelated malformed items; retain minimal identifiable postings where appropriate and make the enumeration incomplete when identity/completeness cannot be established. Add mixed-valid/malformed and mixed-valid/duplicate fixtures asserting committed good positives and zero absence certification.

### R6-4 — Durable above-guard reconciliation remains unimplemented (known integration limitation)

Location: `job_discovery/lifecycle/reconcile.py:35-42`, `:258-272`, `:300-306`, `:331-371`; `task-6-report.md` “Above-ceiling durable reconciliation is unresolved.”

The prescribed storage-blocked fallback attempts feeds and logs health, but does not persist source health, positive observations, misses or closure reconciliation. Thus the required above-guard durable verification/reconciliation guarantee is absent. Read-only daily rotation proves a bounded attempt for a fixed registered due set; it does not prove durable closure progress or registration of the full corpus.

This finding accepts the controller/author's recorded boundary that the existing claim/reservation/row-validation contracts block these writes. It does not independently re-review or probe capacity accounting. `tests/test_lifecycle_reconcile.py:236-247` changes the outer size-check result only; `:252-266` uses an ordinary claim interface double and verifies truthful logs/no absence. Neither is proof of real enforced above-guard durability.

Fix/handoff: retain as an unresolved functional requirement for Task 10/13/final integration review, implementing an authorized bounded metadata reconciliation path compatible with existing safety contracts and ordinary end-to-end caller evidence. Do not weaken the guard or describe this limitation as waived. Preserve flag-off legacy closure above guard.

### R6-5 — New source budgets inherit transport guarantees they cannot enforce (known integration limitation)

Location: `job_discovery/adapters/completeness.py:74-84`, `job_discovery/http.py:20`, `:49-51`; source pulse and progression at `job_discovery/lifecycle/reconcile.py:278-298`.

The wrapper limits attempts and supplies a timeout argument, but the inherited shared client transparently follows redirects and reads/parses the response without the specified three-redirect, address-revalidation and 10 MiB decompressed-body enforcement. A timeout argument and cooperative monotonic checks do not implement a strict 20-second whole-response deadline. Therefore the claimed board/cycle bounds and <=30-second progressing renewal schedule are conditional on transport and chunk duration; current evidence does not establish the binding end-to-end bounds.

This is limited source/interface assessment of the documented functional gap, with no transport attack/probe, external lookup or blocked mechanism review. The author report already carries it to Task 9/13.

Fix/handoff: implement the shared bounded transport contract and ordinary deterministic transport/caller verification in the designated task; demonstrate the source worker's renewal and elapsed limits with it. Keep the gap explicit until then.

## Requirements supported by inspected implementation/evidence

- All six public adapters expose SourceResult; completeness requires iterator exhaustion. Paged-family changed totals, caps, duplicate/page-wrap and final-page failures are conservative. Single-response endpoints have no fabricated pagination requirement. R6-3 qualifies positive preservation for those endpoints.
- The reconciliation SQL uses two distinct enumeration sequences and successful completion timestamps at least 24 elapsed hours apart. Same-enumeration membership insertion/checkpoint replay is idempotent. Partial/failed status cannot supply absence; >20 prior-open empty is suspicious. Missing is ignored; unlisted is positive. Exact removed/expired observations are scoped to source/listing identity.
- Listing sequences and observation timestamps protect newer positives from older absence. Existing job IDs, first_seen, frozen anchors/expiry fields and private FK targets are not rewritten by the new reconciliation path. This is Task 6 mutation review, not independent expiry or isolation enforcement approval.
- Sightings and reconciliation use 100 identities per business batch; effects/checkpoint are committed together. Network entry follows commits, and the request pulse commits before HTTP. No new network-in-SQL path was identified. Strict wall-time/renewal bounds remain unverified as noted above.
- Last-attempt ordering plus the recorded six-family fixture establishes finite source-turn fairness under repeated budget exhaustion for that fixed corpus; the test runs two six-turn cycles. It does not establish reconciliation-tail progress (R6-1), actual daily cadence (R6-2), or arbitrary changing-corpus throughput.
- Failure-disabled sources use 1/2/4/7/7-day backoff arithmetic; deliberate and unknown exclusions are not selected. Source polling is independent of user matching; normal caller source-enabled routing occurs before legacy company ingestion, including the above-guard/no-user entry case.
- Flag-off legacy ingestion, closure-above-guard, maintenance/supervisor and iterable consumers retain recorded compatibility coverage. Current Task 6 source-enabled mode is metadata-only; lean admission remains Task 7 and is not claimed complete here. Source, retirement and archive activation readiness is not granted by this review.

## Minor notes and cannot-verify items

- `verify_due_sources` initializes `closed_jobs=0` at `reconcile.py:250` and never increments it despite closure writes at `:228-229`; `run.py:121-123` persists that zero. The run summary therefore underreports actual closures. Carry actual committed close counts without double-counting checkpoint replay when completing the reporting interface.
- Dense multi-statement SQL/control code and an import of private `_write` from `db.py:293` make the interface harder to maintain. Prefer a named shared writer interface during subsequent integration; this is not itself an approval blocker.
- No independent current-HEAD DB rerun was performed, by dispatch instruction. In particular, no production restart/cron run, real transport boundary, large dynamic-corpus throughput or strict renewal/chunk wall-time guarantee was verified. The two reviewer diagnostics are local ordinary behavior evidence, not DB integration tests.
- Task 3 independent expiry/capacity/cross-user/adversarial review gaps remain deliberately unreviewed. Passing author results, this limited source review, or a future functional fix must not be represented as closing those gaps.

Only this review report was added. Product files and controller ledgers were not modified. Author fixes and focused ordinary evidence are required for R6-1 through R6-3; R6-4 and R6-5 remain explicit downstream functional blockers until their designated integration work is complete.
