# Task 6 Fix 1 — scoped independent requirements/quality re-review

Date: 2026-10-07. Same reviewer: recovery_task06_requirements_review.

BASE: `db73ad7365790419c4a1a82ec38ae21e4c7233c3`
HEAD: `72329abf6d1cf9832fb72d7c30ed2f3c22081b14`

**Permitted Fix 1 scoped Spec: PASS. Scoped Quality: APPROVED.**

**R6-1: ADDRESSED. R6-2: ADDRESSED. R6-3: ADDRESSED.** No fix-introduced Important or Critical finding identified in this scoped review. **Full Task 6 Spec remains FAIL because R6-4 and R6-5 remain unresolved functional/rollout blockers.** The scoped approval is not security approval.

## Scope and pinned evidence

Reviewed only original R6-1/R6-2/R6-3, their authorized ordinary source-handoff and analogous remaining-family corrections, and potential Important/Critical defects introduced by this fix. Reviewed the appended author report, actual recorded commands/results, forward source/test/migration changes and recorded range package. The range includes controller documentation commits `966fc38` and `3becce0`; product Fix 1 is `72329ab`.

Fresh read-only checks confirmed actual HEAD equals the pin, the complete diff in `task-6-fix-1-review-package.md` equals `git diff --unified=10 BASE HEAD`, and `schema.sql` ends with the exact new source-reconciliation migration text. Product/migration/test `git diff --check BASE HEAD` exited 0. The unrestricted range whitespace check exited 2 solely on blank diff-context lines in the previously generated `task-6-review-package.md`, committed in the intervening controller documentation. This is a review-artifact whitespace note, not a product defect or a reason to alter the preserved historical package.

No author-selected tests were rerun. No new diagnostic was needed after source and recorded regression evidence resolved the original concerns. No DB connection, network/provider/paid call, production access, subagent, source edit, commit, activation or deployment was performed. Only this report was added. No safeguard rejection occurred during this re-review.

## Original findings

### R6-1 — ADDRESSED: pending complete membership resumes through the entrypoint

`job_discovery/lifecycle/reconcile.py:51-74` selects pending complete/unreconciled enumerations independently of the next feed slot and orders reconciliation-only turns using persisted claim-start information without inventing a new feed-attempt timestamp. `:104-124` adopts the existing snapshot and updates checkpoint ownership in the same caller transaction. `:298-312` resumes before creating an enumeration and skips adapter/network work for that resume. Existing chunk/checkpoint processing consumes the retained cursor.

The additive `migrations/2026-10-03-02-source-reconciliation.sql:25-49` implements the authorized normal source-handoff contract: membership writes require running status; completion cannot revert to running; the handoff preserves the other enumeration fields through equality comparison. The caller changes owner/generation and checkpoint generation, preserving enumeration ID, source, sequence, evidence times and membership. This assessment is of the new ordinary recovery contract and source flow; it does not independently re-review the inherited expiry/capacity/cross-user validators.

`tests/test_lifecycle_reconcile.py:483` now exercises `verify_due_sources` with fresh connections and no prior in-memory EnumerationRef. Recorded RED shows stalled progress `[100,100,100,100]` and `[0,0,0,0]`; the covering green lanes include the corrected **100 → 200 → 205** deadline path and **0 → 100 → 200 → 205** post-completion interruption path. Assertions preserve enumeration ID/sequence/start/completion times, exactly one feed HTTP call, one sequence, and one miss per listing. Unsafe partial pagination remains on the fresh-enumeration path.

Evidence is bounded to these deterministic fixtures; it is not a general dynamic-corpus throughput or arbitrary process-kill guarantee. Within the original R6-1 concern, the missing production resume responsibility is implemented and covered.

### R6-2 — ADDRESSED: verification is eligible at the next authorized daily slot

`job_discovery/lifecycle/reconcile.py:216-218` schedules from the UTC midnight of the attempt date plus the selected 1/2/4/7-day interval. Feed completion duration no longer moves eligibility beyond the following midnight invocation. The distinct elapsed-24-hour successful-miss condition remains in reconciliation and was not relaxed.

`tests/test_lifecycle_reconcile.py:446` advances source scheduling/evidence time only, invokes the actual entrypoint at consecutive UTC slots with nonzero feed durations, covers enabled and failure-disabled schedules, and verifies a second successful completion less than 24 hours after the first does not close the Job. A subsequent qualifying completion does. This directly addresses the original completion-plus-24-hours/daily-cron mismatch. No production cron or supervisor schedule was changed.

### R6-3 — ADDRESSED: mixed responses retain the original three families' good positives

`job_discovery/adapters/completeness.py:95-131` now yields identities item by item, makes malformed/duplicate identities incomplete, and retains minimal identifiable positives when display parsing fails. Greenhouse, Lever and Ashby call this iterator instead of building the entire parsed list before returning SourceResult. Greenhouse total disagreement remains incomplete while retaining valid members. The six mixed-response DB fixtures at `tests/test_lifecycle_reconcile.py:404` assert good-job reopening, one sighting, no absence increments and partial status.

The authorized analogous extension is consistent with this correction: Workable retains its account-qualified minimal-Posting fallback through the shared iterator; SmartRecruiters skips non-object peers after marking the feed incomplete; Workday's page-ID helper retains valid peers and feeds existing raw-count, total, wrap/cap and partition checks. New fixtures at `tests/test_lifecycle_reconcile.py:534` and `:552` cover those concrete response losses. This does not claim a comprehensive redesign or review of every inherited parser edge case.

The maintenance fixture change at `tests/test_lifecycle_maintenance.py:143` follows the new completion contract by inserting running membership before marking the snapshot complete. Its original completed cleanup window assertions remain; no maintenance product behavior was changed.

## Recorded verification and chronology

These are inspected author results, not independently rerun test claims. Commands and exact selections are in `task-6-evidence/commands.txt`; all listed successful outputs report zero skips.

| Stage | Actual recorded result | Scope limit |
|---|---|---|
| Initial Fix 1 RED | 8 failures, then 2 restart failures on PostgreSQL 17.11 | Original R6-1/R6-2/R6-3 regressions |
| Initial focused green | 10 passed, 19 deselected on 17.11 | New original-finding cases |
| Original-three-family/current recovery and scheduling source | 97 passed on 17.11, 182.94s; 97 passed on 16.15, 182.58s | Includes ordinary run and two ordered migration/catalog-idempotency checks; precedes adapter-only extension |
| Remaining-family RED | 5 failures on 17.11 | Workable mixed fields/IDs and paged-family non-object peers |
| Remaining-family extension | 89 passed, 29 deselected on 17.11, 3.98s | Changed remaining adapters, completeness and new DB cases |
| Shared helper recheck | 6 passed, 28 deselected on 17.11, 5.97s | Original-three-family mixed-response DB cases after extension |
| Combined adapter scope | 95 passed, 23 deselected on 16.15, 10.76s | The preceding adapter scopes together |
| Completed cleanup fixture | 2 passed on 17.11, 3.56s; 2 passed on 16.15, 2.56s | Only the two affected completed-window cases |

The earlier 97-passing migration/run lane was not rerun after the adapter-only extension; no such chronology claim is made. Recorded Ruff reports success. Deselections are explicit, not skips or coverage of omitted suites.

## Remaining blockers and review boundary

- **R6-4 remains NOT ADDRESSED:** durable above-guard reconciliation. Read-only attempts and logging do not supply persisted health/positive/closure progress. Existing capacity requirements are not waived or independently reviewed here.
- **R6-5 remains NOT ADDRESSED:** inherited HTTP transport deadline, redirect/address and decompressed-size guarantees, and their implications for strict source-worker timing. No transport probes were run. These functional/rollout blockers remain assigned to downstream Task 8/10/13 integration as directed by the controller.
- The previously noted `closed_jobs` summary undercount remains the documented minor Task 13 reporting handoff; it was not part of this fix's approval scope.
- Task 3 independent expiry-enforcement, capacity-accounting, cross-user-isolation and related adversarial review gaps remain deliberately unreviewed. The source ownership handoff was reviewed only as the explicitly authorized new ordinary recovery contract. No refused probe or substitute security review was performed, and no full security approval can be inferred.
- No whole-task re-review, production execution, independent DB rerun, or release-readiness approval is supplied by this report. The author's transient same-interface executor disconnect/recovery is recorded as a transport incident, not an approval rejection or bypass.

The three requested functional corrections are accepted within this permitted scope. Full Task 6 acceptance remains qualified by R6-4/R6-5 and the preserved global review gaps.
