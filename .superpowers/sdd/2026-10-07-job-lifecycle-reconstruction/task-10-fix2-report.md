# Task10 Fix2 author report

The same author completed the three remaining corrections F1-1, F1-2 and F1-3 together. The implementation is ready for the controller's same independent reviewer, scoped to those findings and fix-introduced Important/Critical issues. This report does not supply a reviewer verdict, security assurance, activation permission or release approval.

## Scope and pins

Worktree `/workspace/job-board/.claude/worktrees/lifecycle-recovery`, branch `feature/lifecycle-recovery`. FixBASE is reviewed report/evidence `095fec89132bec361c6b1733d1fd97ff5018a6ed`, source `01408f0fce8743a98a55726cc9da50f808955443`. Controller commit `ae0b73f` and later controller documents were preserved. Original reconstruction base remains `6075983bd63dced95ec94dc61b9b112a79f4564d`.

Final Fix2 source/test commit: **872a9844f59d3ed4db483ff13fe40c0e02bff09b**. The subsequent report/evidence-only commit is supplied exactly in the author handoff. No product source changed after the final affected verification.

Read the full Fix2 dispatch and full same-reviewer Fix1 review. Their three findings/narrow corrections are the complete correction list. Binding original brief/specification, operational ruling, review-scope and release amendments remain in force. The controller confirmed the logical event-admission escrow design and its receipt-bound correction before completion. No existing physical/role/claim enforcement was changed. No helper, replacement author, subagent or independent reviewer was launched.

The receiving-code-review and test-driven-development skills guided source verification and ordinary RED/GREEN tests. Their broad-suite guidance did not override the explicit authorized test boundaries. Exact contents were inventoried before each selection; no omitted Task3 probe was rerun, renamed or substituted.

## F1-1: admission reserves a bounded processing lifecycle

The previous Fix1 implementation counted actual pending representations but charged membership and seal creation as new growth against the hard ceiling. That could spend critical-only space on ordinary copies or admit pending work with no room to process it. Fix2 reserves future logical processing space when each event is admitted. Claim, seal and acknowledgement materialize their bounded representations inside that event's reservation; they do not require a new share of the ordinary/critical logical allowance.

`archive_budget_bytes` is now the committed lifecycle forecast: current requirements, ordinary outbox rows and allocated/pending critical-slot base representations, plus processing escrow for each pending event. `outbox_health['bytes']` and warning/pause/admission use that forecast. `outbox_health['live_bytes']` separately reports the previous actual-retained-representation forecast, including current memberships and seals. Neither value is physical PostgreSQL allocation. All original 112/128MiB,87,500/100,000 event limits and the16MiB/12,500 reserve dimensions remain unchanged. Ordinary admission including its entire future workspace must fit112MiB; critical closure/reopen admission including its entire workspace must fit128MiB.

For an immutable canonical event of `C` bytes, processing escrow is **`6*C + 128,000` bytes**. The conservative singleton decomposition is:

| Phase/representation | Reserved logical charge per event |
| --- | --- |
| Membership copy and row/index forecast | `2*C + 1,024` |
| Standalone batch metadata | `8,192` |
| Seal metadata and manifest | `4,096 + 2*(8,192 + 2*C)` |
| Exact-ack receipt, coverage and compact-marker workspace | `98,304` |
| Total | `6*C + 128,000` |

The existing pending representation charges remain: each requirement `2*body_bytes+2,048`, ordinary outbox `2*(body_bytes+C)+2,048`, and allocated/pending critical row `2*(body_bytes+C)+2,048`. A pending ordinary event therefore commits `4*body_bytes+2*C+4,096` plus escrow. A preallocated critical event has no separate requirement copy, so it commits `2*body_bytes+2*C+2,048` plus escrow. During critical allocation the body is already counted; flush adds canonical bytes and the processing escrow. Python and SQL ordinary/critical event admission use the same SQL charge functions under the existing gate.

The reservation is derived from exact immutable pending event bytes, so it survives recovery without mutable release counters. It remains charged while pending even after claim/seal. Other arrivals cannot take it. Exact acknowledgement removes only its verified pending IDs and releases their logical reservation; unverified data is never deleted to make processing room. Terminal full records retain their separate seven-day policy and physical footprint; compact markers persist.

`_processing_capacity` checks a selected batch against the sum of its events' escrow at claim, seal and ack. Membership costs `2*sum(C)+1,024*N`; a manifest bound of `8,192*N+2*sum(C)` covers fixed identity/key/time fields plus ordered IDs/ranges; batch/seal headers are shared. For `N>=1`, the grouped worst-case charge is no greater than the sum of singleton escrows. A valid singleton therefore has a logical path through all phases independently of remaining admission capacity. The selector also conservatively stops before its expanded-data or1MiB manifest bound, rather than choosing a batch that cannot be sealed. Smaller committed batches repeatedly drain the130-event fixture. The configured maximum remains2,000 events/8MiB; the conservative manifest bound may select fewer.

The98,304 ack allowance is a new conservative logical forecast, **not a measurement or reuse of the old physical reservation**. It checks `2*serialized_receipt_bytes + 16,384*N` against that allowance, with the fixed term covering exact coverage/marker row/index forecasts. Each of two accepted receipt strings is at most2,048 characters; JSON escaping can require six bytes per character, and bounded keys/hashes/metadata add further bytes. The initial65,536 allowance failed an ordinary accepted escaped-string fixture: serialized receipts totaled25,130 bytes, giving66,644 after doubling and16,384 coverage allowance. The corrected98,304 allows this representation with margin. Maximum-length UTF-8 and escaped-string fixtures both pass. The old physical `reserve_capacity` calls and forecasts for batch/seal/ack are unchanged and may independently defer work.

### Effective backlog and critical runway

The conservative per-event reservation materially reduces how many pending events fit. Byte ceilings bind long before the nominal50,000 warning/87,500 ordinary/100,000 hard event counts. The12,500 preallocated critical slots are an identity/event-count bound, not a promise of12,500 closure events in16MiB. A closure can emit more than one event, reducing closure count further.

| Actual final fixture | Body / canonical bytes | Processing escrow | Whole ordinary event or critical-slot charge | Calculated logical capacity |
| --- | --- | --- | --- | --- |
| Small brand baseline, both majors | 65 /422 | 130,532 | Ordinary135,732 | 865 equal events in112MiB |
| Large valid UTF-8 baseline, both majors | 8,058 /8,415 | 178,490 | Ordinary231,648 | 506 equal events in112MiB |
| Actual critical Job closure, both majors | 217 /601 | 131,606 | Critical135,290 | 124 equal events in16MiB |
| Actual critical listing closure, PG17 | 572 /978 | 133,868 | Critical139,016 | 120 equal events in16MiB |
| Actual critical listing closure, PG16 | 575 /981 | 133,886 | Critical139,046 | 120 equal events in16MiB |

That fixture closes one Job through two public events. Their combined charge is274,306 bytes on17 and274,336 on16, so an otherwise free16MiB critical allowance fits61 such two-event closures. The slight listing-size difference follows serialized fixture timestamps. Logs also print a same-sized hypothetical critical-slot charge for each ordinary baseline example; brands themselves are not critical transitions. The table above uses actual closure events for the operational runway calculation.

These are calculations from actual small fixture event sizes, not production throughput, savings, physical reuse or headroom promises. They assume an otherwise available logical budget and equal-sized events; real mixes, outstanding ordinary/critical work and source facts change the available runway. Conservative singleton charging intentionally trades throughput/runway for a provable bounded logical processing path. Optimizing that reservation is not part of this correction and must not silently weaken the critical reserve.

The ordinary scaled-boundary fixture lowers only Python's new logical policy limits: an actual public mutation is admitted exactly at its scaled ordinary ceiling; ordinary claim/seal keep committed budget unchanged; another ordinary mutation rolls back; a pure closure fits exactly at the scaled hard ceiling; both events claim/seal/exact-ack without unverified deletion. SQL and physical ceilings are unchanged. Critical operational slot pairing/ack and the real event-byte accounting are also in the affected final selection. No database was loaded to a physical guard or nominal count limit.

## F1-2: the real location pass continues and reports interruption

`stamp_jobs` remains a sorted-lock, at-most100-row transaction helper. `resolve_new_locations` now loops it, committing every chunk and incrementing `stamped` only after a successful commit. It finishes all mismatches in the intended pass. Rule dictionary work also counts only committed100-raw chunks; fake/real LLM persistence retains its existing batch commit accounting. Public dictionary inserts/corrections remain paired; derived cache-only Job updates emit no public fact event.

The returned result retains the existing committed counters and adds `complete` and `storage_deferred`. A later stamping/storage failure rolls back only that chunk, preserves earlier committed totals, and returns incomplete. Other ordinary exceptions also log and return incomplete. Remaining unresolved raw mappings or cache mismatches keep `complete=false`. A later invocation selects the remaining mismatches and resumes. No unsupported deadline or unlimited physical reuse is claimed.

The actual backfill entrypoint now returns this result and logs complete versus incomplete honestly. The daily caller explicitly logs incomplete location results rather than labeling the location phase complete. Existing caller interfaces still receive the original numeric count keys.

New tests call the real resolver with101 jobs for initial resolution and manual correction; both finish the entire pass. A later-chunk injected storage exception preserves100 committed rows, rolls back the101st, reports incomplete/deferred, then a resumed pass commits the remaining row. An active-archive101-row pass produces exactly the dictionary baseline event and no derived-cache events. The ten existing location-resolution tests cover offline rule, fake LLM, unanswered/error, manual correction and multibatch continuity. No real LLM or HTTP call runs.

## F1-3: seed deferral no longer aborts existing-source verification

The daily `job_discovery.run.run` now commits its poll-run row before beginning seed chunks. Each at-most100-target seed chunk still uses exact paired public mutation transactions. `StorageBlocked` (including `ArchiveBlocked`) rolls back only the failed chunk, stops further seed admission for that turn and durably records a seed-storage-deferred note. Earlier committed companies/events remain. The durable run ID is valid even when the first seed chunk fails.

Existing-source verification still executes through the established normal/operational orchestration. Returned counts add `seed_storage_deferred`, `seed_targets_committed` and the seed deferral to `storage_deferred`; the committed target count means successfully processed seed targets, not a claim that every target was newly inserted. Final poll-run notes preserve the deferral. In legacy mode seed deferral stops ordinary payload admission while retaining the existing verification-only loop. No paired admission bypass or false source failure is introduced.

Two actual daily-entrypoint tests inject archive deferral after paired mutation in the first and later seed chunk. They establish rejected company/event rollback, zero versus100 committed target progress, a durable finalized poll-run row/note, and a healthy existing source's actual offline feed verification. New-source catalog expansion is stubbed in these fixtures to isolate the specified seed/existing-corpus boundary; verification itself is real orchestration. An existing flags-off daily failure-isolation/run-accounting test and run-row persistence test pass in the broader candidate selection.

## Actual verification and failure history

Evidence resides in `task-10-evidence/fix2/`: full commands, content inventories, exact collected node lists, source hashes, server/runtime/image pins, output and exit files. Final12-file source hashes were recorded after formatting and before final affected execution. No source changed during either final run.

| Recorded phase | PostgreSQL17.11 | PostgreSQL16.15 |
| --- | --- | --- |
| Candidate63-case selection, before receipt-bound correction | 63 passed,102.57s,exit0 | 63 passed,110.64s,exit0 |
| Final37 affected cases after correction | 37 passed,52.06s,exit0 | 37 passed,58.49s,exit0 |

No skipped DB tests appear. Final Ruff reports all checks passed; source hashes remained unchanged through both final runs and were checked again immediately before source commit. The source commit contains12 owned product/schema/test files. No covered tests were rerun during report handoff.

The broader candidate selection was63 cases on each major. After the receipt-bound correction, only the meaningful37-case affected selection was rerun on each major. It includes all11 final Fix2 cases,10 outbox cases,9 batch cases,2 critical operational cases and5 relevant Fix1 budget/manifest/critical/retirement cases. The unchanged caller/codec cases retain their candidate evidence. Together these support64 unique cases per major at final state; there was no single final64-case command. Overlapping tests are not counted as extra coverage.

Initial RED is preserved: four of the six initial failures directly reproduced logical workspace and location defects; two were local test setup errors because connection info intentionally omits the disposable password. Switching the fixtures to the harness-provided validated TEST_DSN produced the intended two uncaught seed ArchiveBlocked failures. No credential was exposed or guessed. The six-case post-fix development run passed; the expanded19-case development run passed. The later receipt representation RED was1 passed/1 failed before the logical bound increase. These outputs remain intact and are not relabeled as passes.

Both final and candidate harnesses use owned random-loopback PG17/16 databases and cached images. No shared55432, broad whole-suite run, omitted mechanism/security/activation/cross-user/physical/expiry/adversarial test or substituted probe was executed. Existing reviewed source helpers are interfaces, not freshly certified mechanisms. PostgreSQL17.11 supplies major-version parity, not a claim of running historical production17.6;16.15 supplies compatibility. Python3.12.14, psycopg3.3.6, pytest9.1.1 and Ruff0.15.20 are recorded. Migration04/05/06 text appears verbatim in schema.sql; final Ruff and whitespace checks pass.

## Remaining limits and handoff

1. Production defaults remain off, retirement dry-run and archive inactive. No destination row, provider connection, activation, IAM/credential change, production deletion, push/PR/merge/deployment or release action occurred. Actual destination/readiness and compatible rollout remain pending.
2. Full baseline and operational claim/receipt/listing/critical-slot preallocation must precede reliance on the bounded lane. Missing readiness or exhausted finite slots defers truthfully. Slots never recycle automatically; the logical closure runway is substantially smaller than the slot count because of byte escrow.
3. This correction guarantees a bounded **logical** processing path for admitted valid events within the service protocol. Physical admission can still prevent claim/seal/ack. Physical MVCC growth/reuse remains unknown; no logical reservation or terminal cleanup supplies physical delete credit. No new physical measurements were needed or run in Fix2.
4. The additive pre-activation migration changes the admission forecast for all pending events. This task does not certify upgrading an already-active older archive with a near-full backlog, nor rewrite existing external objects. Such a rollout would need separate readiness assessment.
5. Task11 still owns transport, periodic flush/cleanup scheduling, persisted fake-S3 crash cases and authorized expired replacement; Task12 owns replay. Compact markers still require operational sizing. No downstream completion is claimed here.
6. Original deliberately omitted Task3 physical-capacity/expiry/cross-user/adversarial assurance remains omitted. No new security approval is claimed. The controller's same-reviewer assessment of F1-1..3 and fix-introduced Important/Critical issues remains pending.

No safeguard rejection occurred. The local missing-password fixture error and ordinary serialization-bound failure are preserved with their exact causes; neither triggered a bypass or production access. Controller documents remain unstaged by the author. Local author implementation/report work is complete and will STOP Git after the handoff pins.
