# Task 10 Fix2 — same-reviewer scoped requirements and code-quality review

**DONE. Requirements / Spec: PASS. Quality: APPROVED.**

F1-1, F1-2 and F1-3 are closed within the authorized ordinary functional scope. No residual or fix-introduced Important/Critical finding was identified. This verdict completes the same reviewer's scoped correction review; it supplies neither omitted security/physical-mechanism assurance nor activation or release approval.

## Exact pins and scope

- Worktree: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`.
- Original reconstruction base: `6075983bd63dced95ec94dc61b9b112a79f4564d`.
- Fix2 reviewed BASE: `095fec89132bec361c6b1733d1fd97ff5018a6ed` (Fix1 report/evidence; Fix1 source `01408f0fce8743a98a55726cc9da50f808955443`).
- Fix2 final product/test source: **`872a9844f59d3ed4db483ff13fe40c0e02bff09b`**.
- Fix2 report/evidence HEAD: **`51d1000e6954b3e7bff56652718c8d90084b216a`**, also the observed checkout HEAD.

Read the Fix2 reviewer dispatch, full author report, previous Fix1 requirements review, binding review-scope/release amendments and operational/escrow rulings. The recorded FixBASE-to-HEAD package is the review input, not HEAD~1. Its complete 13,890-line diff matches `git diff -U10 BASE..HEAD` exactly; it includes historical review/package material as well as this correction. Examined affected source and test changes and their ordinary caller context. Review scope is the three prior findings and Important/Critical breakage introduced by their fixes, without reopening the whole task. Prior original-finding dispositions are carried through the original review and Fix1 review; this closes their remaining scoped defects.

## Finding dispositions

### F1-1 — CLOSED: admission reserves processing room without spending critical allowance later

Primary implementation: `migrations/2026-10-03-06-public-outbox-fix2.sql:5` and `:11`; ordinary admission at `job_discovery/archive/outbox.py:98` and migration `:42`; critical flush at `job_discovery/lifecycle/operational.py:166` and migration `:82`. Processing checks are at `job_discovery/archive/batches.py:24`, called at `:186`, `:365` and `:451`. Selection's conservative manifest bound is at `:165`.

The new committed lifecycle forecast counts current pending base representations and reserves **6*C + 128,000 bytes per event**, where C is immutable canonical-event length. The ordinary event's entire forecast must fit 112 MiB; critical closure/reopen work must fit 128 MiB. Count limits remain 87,500/100,000. Membership, seal and acknowledgement consume the event's already-charged workspace instead of asking for another share of the hard allowance. The escrow stays charged while pending, including after claim/seal, and exact acknowledgement releases only verified pending work. The prior logical self-blocking path and ordinary-copy consumption of the critical reserve are corrected.

The singleton decomposition is 2*C+1,024 for membership, 8,192 for batch metadata, 4,096+2*(8,192+2*C) for seal/manifest and 98,304 for acknowledgement workspace. For N selected events with total canonical size S, the worst grouped processing requirement is **6*S + 115,712*N + 12,288**. The reserved sum is **6*S + 128,000*N**, so the requirement fits for every N>=1, with equality for one event. The selector respects a conservative manifest bound before committing membership and can drain smaller batches. This is an explicit logical accounting argument for valid service events, not a PostgreSQL storage calculation.

The receipt check includes serialized representation cost: `2*receipt_bytes + 16,384*N <= 98,304*N`. The recorded maximum-length escaped-string case exposed the former 65,536 allowance; its 25,130 serialized bytes require 66,644 by that check. The final increased allowance and maximum-length UTF-8/escaped cases address that concrete undersizing. Source validation keeps receipt strings and other receipt fields bounded. `outbox_health` at `outbox.py:34` now reports committed lifecycle budget as `bytes` and the previous retained-representation forecast separately as `live_bytes`; neither is physical allocated bytes.

Evidence: `tests/test_archive_fix2.py:18` checks escrow remains unchanged through claim/seal while retained representation grows; `:218` covers small scaled ordinary/critical boundaries and exact draining; `:279` drains 130 events in multiple bounded batches; `:310` covers a large valid UTF-8 event and both accepted receipt-string representations. The scaled fixture changes only new Python logical policy limits, leaving SQL and physical limits intact. Existing selected critical-slot pairing/ack cases supplement the new ordinary arithmetic. Recorded final runs include these cases on both majors. The reviewer did not execute them.

### F1-2 — CLOSED: actual location workflow continues bounded chunks and reports committed progress

Primary implementation: `job_discovery/locations.py:147`, especially rule chunks at `:170`, stamping continuation at `:209` and remaining-work status at `:225`. The backfill caller reports and returns complete/incomplete at `job_discovery/location_backfill.py:27`; the daily caller also consumes the explicit outcome.

The sorted, at-most-100-row stamping helper remains bounded, and the real resolver repeatedly invokes and commits it. Counts advance only after commit. A later storage exception rolls back that chunk, retains earlier committed counts and returns `complete=false` with `storage_deferred=true`; other failures return incomplete too. Unresolved raw mappings or remaining mismatches prevent a false complete result. Rule persistence also uses committed chunk accounting. Dictionary public facts remain paired and derived cache stamping produces no extra public fact event.

Evidence: `tests/test_archive_fix2.py:78` invokes the real resolver for 101 Jobs in initial-resolution and correction cases; `:102` covers a failed second chunk, 100 committed rows, truthful interruption and a one-row resumed pass; `:370` covers an active 101-row pass with one dictionary baseline and no cache events. Existing ten location-resolution cases supply unchanged offline rule/fake-LLM/error/unanswered/manual-correction/multibatch evidence. No new deadline or provider behavior is claimed.

### F1-3 — CLOSED: seed deferral preserves accounting and existing-source verification

Primary implementation: `job_discovery/run.py:144` commits the run row before seed work; `:149` handles bounded seed chunks and rollback; `:168` proceeds to source orchestration; `:180` preserves truthful result accounting and `:192` retains the deferral note. Legacy verification-only continuation is explicit at `:199`.

An archive/storage failure now rolls back only the failed seed chunk, stops further seed admission and records a durable note. Previously committed seed/event chunks survive. The first-chunk rollback cannot erase the already-committed poll-run row. Existing-source verification runs through the established orchestration, and final counts distinguish seed deferral and successfully processed targets. The target count is not presented as the number of newly inserted companies. Pairing is not bypassed and seed failure is not converted into a source failure.

Evidence: `tests/test_archive_fix2.py:138` exercises actual `run.run` with first- and second-chunk injected ArchiveBlocked outcomes, verifying zero/100 committed targets, rejected company/event rollback, finalized durable accounting and actual offline existing-source feed verification. Source-catalog expansion is stubbed to isolate this entrypoint boundary; verification itself uses real orchestration. These cases do not independently test the pre-existing physical mechanism or every operational-lane condition. Existing daily isolation and run-row tests remain candidate evidence.

## Execution evidence and integrity

**Reviewer execution:** no test rerun, new runtime probe, product/test edit, Git mutation, helper/subagent, network/provider call or production action. Read-only checks were pinned HEAD/package comparison, all 12 final source SHA-256 comparisons, schema/migration text parity and source/caller inspection. Only this review document was created.

Read the author report, command chronology and inventory, collected selections, actual candidate/final commands, outputs and zero-exit records, runtime/image pins, final lint evidence and relevant preserved failure history. Recorded author execution is distinguished from reviewer source analysis:

| Recorded phase/check | Result |
| --- | --- |
| Candidate selection, PostgreSQL 17.11 | 63 passed in 102.57s, exit 0 |
| Candidate selection, PostgreSQL 16.15 | 63 passed in 110.64s, exit 0 |
| Final affected selection, PostgreSQL 17.11 | 37 passed in 52.06s, exit 0 |
| Final affected selection, PostgreSQL 16.15 | 37 passed in 58.49s, exit 0 |
| Final Ruff evidence | All checks passed |
| Reviewer integrity checks | All 12 final source hashes match; migrations 04/05/06 each occur verbatim in schema.sql; full pinned package diff matches |

The 63-case candidate preceded the receipt-bound correction. The final 37-case selection contains all 11 final Fix2 cases, ten outbox cases, nine batch cases, two critical operational cases and five relevant Fix1 cases. The unchanged caller/codec cases retain earlier candidate evidence. This supports 64 unique cases per major across the incremental phases; **there was no single final 64-case run**, and overlapping tests are not extra coverage. No skipped DB tests appear. Python 3.12.14, psycopg 3.3.6, pytest 9.1.1 and Ruff 0.15.20 are recorded. PostgreSQL 17.11 is major-version evidence, not historical production 17.6; 16.15 supplies compatibility evidence.

The preserved initial failures include four intended logical/location failures and two disposable-connection setup errors; using the validated harness TEST_DSN then produced the intended two seed failures. The receipt RED remains one pass/one fail before increasing the bound. These failures are explained, not relabeled as passes. Candidate sample capacities used the smaller old allowance and are historical; final capacity statements below use final output.

## Costs, minor note and remaining limits

The escrow ruling explicitly permits conservative admission-time reservation and requires its cost to remain visible. That tradeoff is material: final equal-sized fixture charges allow **865 small or 506 large ordinary events in 112 MiB**, far below nominal event-count limits. Same-sized hypothetical critical charges printed for those ordinary samples give 125/78 events in 16 MiB; those brand examples are not real critical transitions.

Actual closure events cost 135,290 bytes for the Job and 139,016 bytes for the PG17 listing (139,046 on PG16). One fixture closure emits both events, totaling 274,306/274,336 bytes. An otherwise available **16 MiB critical allowance fits 61 such two-event closures**. Existing outstanding work, allocated representations and real event sizes change that runway. The finite 12,500 slot count does not promise 12,500 closure events, much less 12,500 multi-event closures. Optimization is deferred; no production throughput, savings or physical-headroom guarantee follows from these calculations.

One nonblocking controller-document correction was reported to the parent: the Fix2 evidence paragraph in `progress.md` says those 61 closures come from “112MiB”; the author report and arithmetic correctly use **16 MiB**. The parent owns forward controller documentation. No product fix or test rerun is needed for that typo. Earlier historical duplicate migration definitions remain a minor carry-forward; forward overrides and schema parity hold. No unrelated cleanup is requested.

- Production defaults remain off, retirement dry-run and archive inactive. Destination validation/configuration, compatible supported writers, bounded baselines and operational claim/receipt/listing/critical-slot provisioning remain prerequisites. No destination or provider readiness is inferred from `fixture/public`.
- The existing R6-4 operational implementation and its earlier ordinary evidence remain concrete but bounded. Missing coverage/baselines/readiness, exhausted finite slots or unavailable physical capacity can still defer work. Slots do not automatically recycle after acknowledgement. Logical preallocation does not establish MVCC UPDATE reuse or physical delete credit.
- Old physical reservation interfaces and their forecasts are unchanged. Physical claim/seal/ack may independently defer admitted events; this correction's processing-room result is logical. No new physical measurement was performed in Fix2 and no physical guarantee is added here.
- This is a pre-activation contract correction. The additive migration changes the forecast for pending events; upgrading an already-active older archive near its prior ceiling is not certified by this evidence and needs separate rollout assessment. Existing external objects are not rewritten.
- Task11 still owns transport/export orchestration, periodic flush/terminal cleanup, persisted fake-S3 crash cases and separately authorized expired replacement. Task12 owns replay. Persistent compact markers still require operational sizing. These downstream prerequisites are not silently completed by this verdict.
- **Deliberately unreviewed:** Task3 independent expiry enforcement, physical-capacity accounting, cross-user isolation and related adversarial reviews/probes, including renamed, split or substituted equivalents. No replacement reviewer or mechanism/security/activation suite was used. Ordinary new escrow arithmetic and actual caller behavior were inspected only within the scoped findings. No full security assurance follows from PASS.

The binding reduced-review amendment and subsequent completed-upgrade release authorization remain in force. The controller owns task acceptance, checkpointing and eventual completed-upgrade release after all required tasks and permitted final review. No safeguard rejection occurred during this rereview; there is no remaining scoped Important/Critical blocker to return to the author.

**Final disposition: Requirements / Spec PASS; Quality APPROVED. Same reviewer DONE and STOP.**
