# Task 10 Fix1 — same-reviewer scoped requirements and code-quality review

**DONE. Requirements / Spec: FAIL. Quality: CHANGES_REQUIRED.**

Fix1 corrects substantial parts of all seven original findings. Three Important residual/fix-introduced functional issues remain. No Critical finding is assigned. This report is the same original reviewer's one scoped rereview; it is not a whole-task rerun, a security approval, an activation decision or a release decision.

## Exact pins and review scope

- Worktree: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`.
- Original Task10 base: `6075983bd63dced95ec94dc61b9b112a79f4564d`.
- Original reviewed head / FixBASE: `e3f889421fa1ad30206e128cb292b101bc3a58e0`.
- Fix1 product/test source: `01408f0fce8743a98a55726cc9da50f808955443`.
- Fix1 full report/evidence head: `095fec89132bec361c6b1733d1fd97ff5018a6ed`.
- Observed checkout HEAD during the final read-only integrity check: `095fec89132bec361c6b1733d1fd97ff5018a6ed`.

Read `task-10-fix1-reviewer-dispatch.md` first, the complete Fix1 author report, the original requirements review, the binding review-scope/release amendments, and the operational ruling. Examined the complete pinned Fix1 review package and the actual affected source/test files. The package includes controller documents and the historical original review package; these historical inclusions do not expand this rereview's product scope. A full text comparison confirms its recorded diff equals `git diff --unified=10` for the exact FixBASE/head. All 25 Fix1 source hash entries match. Both Task10 migrations, 04 and 05, occur verbatim in `schema.sql`.

Scope is original R10-1 through R10-7 and Important/Critical defects introduced by their corrections only. Earlier unrelated/minor observations are carried without expanding review. No tests, DB probes, migrations, product edits, staging/commits, subagents, network/provider calls, activation or release actions were performed by this reviewer. Only this review report was written.

## Disposition of each original finding

| Original finding | Scoped disposition | Source/evidence assessment |
| --- | --- | --- |
| **R10-1: independent operational absence history** | **CLOSED** | `lifecycle/operational.py:276` now uses `source_listings.consecutive_complete_misses` and `first_complete_miss_at`; the operational row retains only miss-sequence idempotence. Normal positives clear that same authoritative history. Three new ordinary lane-switch/resume cases cover the reported sequences. This closes the stale counter defect, not broad concurrency/fairness assurance. |
| **R10-2: canonical-only live-byte accounting** | **PARTIALLY FIXED; OPEN** | Migration05 `archive_live_bytes` includes requirements, outbox/critical rows, membership and seals; Python/SQL producer checks and health use it. The original omitted-representation problem is corrected. However, batch claim/seal additions use only the hard ceiling and can consume the closure-only reserve or strand admitted work without logical processing room. See F1-1. |
| **R10-3: ArchiveBlocked misses storage-deferred orchestration** | **DIRECT SOURCE-LOOP DEFECT FIXED; INTEGRATION OPEN** | `ArchiveBlocked` now subclasses the shared `StorageBlocked`; chunk and final-reconciliation handlers roll back, count deferral and call the operational lane. The affected source can remain eligible even after normal completion moved its due date. The two recorded offline actual-source-loop cases support this correction. The newly paired seed phase at the containing daily entrypoint remains uncaught and can stop verification before that corrected loop is reached. See F1-3. |
| **R10-4: unsupported current public writers** | **PAIRING/INVENTORY FIXED; FIX REGRESSIONS OPEN** | Seed, candidate, enrichment, classification, name and location helpers now use `archive.writers.public_write`; scheduled candidate/seed ingestion is chunked, and weekly progress shares the mutation transaction. Legacy public Job writers have an explicit post-cutover rejection. The inventory no longer certifies unspecified creators/ad hoc SQL. Remaining issues are the new 100-row restamp truncation (F1-2) and daily seed-pressure integration (F1-3). |
| **R10-5: missing observed/recorded distinction** | **CLOSED** | Canonical envelopes now carry nullable aware observation time, DB-recorded time and explicit provenance; the migration binds these fields in ordinary/critical pair checks. Baseline scans retain unknown observation, while version/listing and critical observation fixtures carry supplied evidence distinctly from recording time. No legacy observation history is invented by the baseline API. |
| **R10-6: sealed key/manifest mismatch** | **CLOSED** | `archive/batches.py:29` derives service-prefix/UTC-day/batch-ID/compressed-hash keys. `_manifest` includes exact-ID digest, aggregate revision ranges and full batch/schema/serializer/prior identity. `persist_seal` compares the complete expected canonical manifest. Prefix/date/schema are persisted; no production destination row is created. Recorded identity-rejection, deterministic recovery and +14:00 UTC-partition cases support the fix. |
| **R10-7: permanent full terminal receipts/catalogue** | **CLOSED** | Ack creates compact batch markers with coverage referencing them. `compact_terminal_batches` retires aged acknowledged slot payloads/items/full receipts/batches in a shared ≤2,000-row operation budget; exact/version/fence markers remain. Recorded limit=1 continuation and unrelated-pending-batch fixtures support bounded acknowledged-only cleanup. Scheduling remains downstream. |

“Closed” means the original ordinary requirement defect is addressed within this scoped source/evidence review. It supplies no omitted mechanism/security approval and does not certify downstream transport/replay work.

## Remaining Important findings — complete Fix1 fix list

### F1-1 — Ordinary batch processing can spend the critical reserve and exhaust its own processing room

**Important. Original R10-2 remains open.** Exact primary location: `job_discovery/archive/batches.py:24`. Call sites: `batches.py:157` (membership/batch addition) and `batches.py:338` (seal addition). Producer-side comparison: `job_discovery/archive/outbox.py:95`; logical representations: `migrations/2026-10-03-05-public-outbox-fix1.sql:37`.

The new logical forecast correctly counts more than canonical event bytes. But `_live_capacity` admits every batch claim and seal against `HARD_BYTES`, regardless of whether its selected events are ordinary. For example, an ordinary pending set at 110 MiB can claim an ordinary batch whose additional membership/batch charge is 4 MiB: 114 MiB passes the 128 MiB check although 2 MiB of the closure/reopen-only reserve has now been spent by ordinary work. The added representation is explicitly part of the live archive budget; it cannot be excluded from the reserve requirement after being counted for other purposes. The approved contract reserves the final 16 MiB **and** 12,500 event slots for critical closure/reopen transitions.

There is also no logical room reserved at event admission for the future membership and seal representations. Critical events may be admitted close enough to 128 MiB that no batch can be claimed, or already-claimed work can lose the room needed to persist its seal. Pending events cannot be acknowledged until those stages succeed, and pending data cannot be deleted to free the budget. This can leave a healthy exporter unable to drain a backlog solely because of the new logical accounting, independently of physical headroom. The default selector also attempts its full chosen membership charge rather than shrinking it to available processing room.

The new small-row test checks that added membership is counted and that an over-budget claim defers. It does not show that ordinary processing preserves critical reserve or that admitted pending work retains a bounded path through seal/ack. Transparent deferral is necessary, but does not make this reserve consumption or self-blocking logical workflow conformant.

**Narrow correction:** make the logical accounting cover an event's bounded processing lifecycle while preserving the critical-only byte reserve. Account for future membership/seal workspace before admitting work, or provide another explicit bounded accounting design that prevents ordinary copies from spending critical allowance and guarantees processing room for admitted pending work. Charge only within the unchanged total logical ceiling and unchanged physical reservation contract. Merely changing the batch check from 128 to 112 MiB would leave ordinary admission able to fill all ordinary space before membership can be created, so that alone is insufficient. If selecting smaller batches is part of the solution, ensure repeated selection makes progress and reserves its subsequent seal charge.

**Ordinary evidence needed:** small/scaled logical-budget fixtures showing (1) an ordinary claim/seal cannot reduce the reserved critical allowance; (2) a permitted critical transition still fits its reserved logical space; and (3) pending events admitted near the relevant logical boundary can be claimed, sealed and acknowledged without deleting unverified data or exceeding the hard limit. These are arithmetic/new archive-state tests, not physical-capacity, MVCC, adversarial or omitted Task3 mechanism probes. None was run in this review.

### F1-2 — Location restamping silently stops after the first 100 Jobs

**Important. Introduced by the R10-4 writer batching correction.** Exact primary location: `job_discovery/locations.py:68`. Containing caller: `locations.py:151`.

`stamp_jobs` was changed from a full set-based update to `ORDER BY j.id LIMIT 100`, which is an appropriate per-transaction bound only if the caller continues. `resolve_new_locations` still invokes it exactly once, commits, logs counts and returns. The actual daily/location-backfill caller therefore leaves all remaining mismatched Jobs untouched while presenting the pass as completed. This affects flags-off callers too.

For a rule resolution or manual correction affecting 101 Jobs, only the first 100 get their canonical locations during that invocation. A correction affecting thousands can take many daily runs, with the review/filtering phase consuming stale canonical locations in the meantime. This is a regression from the existing documented next-poll correction propagation. The report's “sorted affected Job chunks” description is incomplete: the current code processes one chunk, with no continuation.

The two selected location regressions use small fixtures and do not exercise more than one stamping chunk. The active location test verifies dictionary event pairing, not completion of all dependent Job cache rows.

**Narrow correction:** retain the ≤100-row transaction helper but have the real resolution/backfill workflow iterate and commit bounded chunks until its intended pass is complete, accumulating the actual committed count. If a deadline or storage deferral interrupts it, expose an explicit incomplete/deferred outcome and retain committed progress rather than reporting full completion. Preserve sorted Job locking, paired location facts and no public event for derived-cache-only stamping.

**Ordinary evidence needed:** invoke `resolve_new_locations` with at least 101 affected Jobs (both initial resolution and correction can share a compact fixture design), confirm all intended rows are eventually stamped in bounded committed chunks, and verify a later-chunk failure preserves earlier committed progress and reports incomplete work. No network/model call or physical guard experiment is necessary.

### F1-3 — Seed archive pressure aborts the daily entrypoint before source verification

**Important. Residual R10-3/R10-4 integration gap exposed by the newly paired seed writer.** Exact primary location: `job_discovery/run.py:108`. Related locations: `run.py:112`, `run.py:115`, `job_discovery/db.py:63`, and `job_discovery/archive/writers.py:40`.

The daily runner starts its poll-run row and executes the newly paired `sync_seed` chunks before reading `source_enabled` or entering source verification. There is no `StorageBlocked`/`ArchiveBlocked` handler around those chunks. The outer runner block has only `finally: conn.close()`. A new seed or a changed seed name while ordinary archive admission is paused therefore raises from the seed flush and exits the complete daily run before any existing-source health/closure work gets a turn. The later handler around `sync_source_accounts` cannot catch an earlier seed exception.

This is the real entrypoint boundary, beyond the two new tests that invoke `verify_due_sources` directly. The new individual seed pair-failure tests correctly prove rollback, but not that a rejected ingestion phase permits existing-source verification to continue. With a persistent changed seed and no immediately drained backlog, the same startup failure can repeat on subsequent scheduled runs while critical reserve or operational slots are still available.

There is an accounting detail to preserve when fixing this: the first seed chunk currently shares the initial uncommitted `poll_runs` insertion, while successful later chunks may already have committed. Simply rolling back the first failed chunk and proceeding with the old `run_id` can leave no durable run row to finalize.

**Narrow correction:** handle seed storage/archive deferral at the containing daily entrypoint. Roll back only the failed chunk, stop further ordinary seed admission for that turn, retain earlier committed seed/event chunks, record a truthful storage-deferred outcome, and continue existing-source verification through the supported normal/operational orchestration. Ensure run accounting exists durably after the first-chunk rollback case and reflects the deferral; do not count rolled-back seed mutations as committed. Do not skip required source verification or bypass paired event admission.

**Ordinary evidence needed:** offline actual `job_discovery.run.run` fixtures injecting the new archive-pressure outcome at the first seed chunk and a later chunk, proving rejected mutation/event rollback, preservation of already committed chunks, durable run accounting, and that existing-source verification still executes. Keep the test at this new integration boundary; no large-load, activation-security or old capacity-mechanism test is requested.

## Evidence actually read and verification performed

**Reviewer execution:** no tests rerun and no new tests/probes executed. Read-only checks performed were exact source hash verification, full pinned diff/package comparison, schema/migration text equality, line/caller inspection and HEAD lookup. This is source-derived review supported by author-recorded execution, not a claim that the reviewer reproduced runtime behavior.

Read the complete `task-10-fix1-report.md`, original review, scoped dispatch and amendments/ruling; the affected product diff; the full new `tests/test_archive_fix1.py`; changed original test expectations and helper; exact selection JSON/collected node list; command chronology; both final command files, output files and zero exit files; runtime versions and final lint result. The package preserves the RED/development failures and author explains their chronology; they are not counted as passes. The original report's errors are not silently erased by this review.

| Final author evidence | Actual result |
| --- | --- |
| Owned PostgreSQL 17.11 | **66 passed**, 110.76 seconds; exit 0; no skips shown |
| Owned PostgreSQL 16.15 | **66 passed**, 120.18 seconds; exit 0; no skips shown |
| Final Ruff affected-source evidence | All checks passed |
| Reviewer source integrity | All 25 Fix1 hash entries matched |
| Reviewer schema parity | Entire migrations 04 and 05 present verbatim in `schema.sql` |
| Reviewer package integrity | Complete recorded FixBASE→head diff matched pinned Git diff |

The 66-case selection is 37 original permitted cases, 24 new Fix1 cases and five selected caller regressions. Unlike the earlier incremental original-task evidence, this is one complete final selection on each major. Actual versions are Python 3.12.14, psycopg 3.3.6, pytest 9.1.1 and Ruff 0.15.20. PostgreSQL 17.11 supports major-version parity; it is not a run on historical production 17.6. PostgreSQL 16.15 supplies compatibility evidence.

The final small operational fixture printed zero allocated/table+TOAST/index deltas: PG17 allocated 40,711,859 bytes before/after; PG16 41,032,727; table+TOAST 1,114,112 and indexes 1,622,016 on both. These are measurements of those fixtures only. They do not show production headroom, operation beyond 6000 MiB, repeated MVCC reuse, unlimited physical growth avoidance, large-board fairness or physical credit after cleanup.

The recorded selected tests establish useful narrow behavior: authoritative lane-switch absence counters, actual-source-loop pressure classification, real public writer pairing and rollback, bounded weekly committed progress, explicit temporal provenance, UTC key layout and complete manifest identity, and acknowledged-only terminal retirement with exact coverage/pending preservation. They do not cover the three remaining source-derived scenarios above.

## Scope distinctions, minor carry-forward and remaining prerequisites

**Implemented and ordinarily reviewed here:** the Fix1 changes for shared absence evidence; expanded logical archive forecasts; new exception hierarchy and source-loop deferral; current writer wrapper/caller changes; observed/recorded/provenance persistence; service-prefix/UTC/hash key/manifest contract; and marker-backed terminal retirement. The remaining defects are limited to those changes' reserve/liveness and actual caller behavior.

**Deliberately unreviewed:** refused Task3 independent expiry enforcement, physical-capacity accounting, cross-user isolation and related adversarial reviews/probes, including renamed/split/substituted equivalents. No security/activation/helper attack suite was rerun or reproduced. New logical archive accounting and normal lane-switch correctness were inspected as explicitly authorized original findings; neither supplies a physical/security mechanism verdict. The unchanged old physical reservation calls were treated as interfaces, not independently certified. No new safeguard rejection occurred in this reviewer session.

Earlier minor observations remain subordinate to the scoped Important review. The predecessor set/bulk coverage lookup, directly asserted warning predicate and clearer metadata type predicate address three earlier readability/efficiency/evidence comments. Historical duplicate migration04 definitions remain preserved; migration05 adds forward overrides and schema parity holds. No claim of throughput, deadline or lock-time proof is made, and no unrelated cleanup is required for this verdict.

The R6-4 lane remains a concrete bounded durable implementation. Its single source/receipt rows, per-known-listing marks and finite 12,500 critical slots must be provisioned before storage admission stops. Default provisioning remains 100 listings/16 slots with a 7,798,784-byte forecast; each free slot has 24,576 padding bytes, or 307,200,000 bytes for a full pool before overhead. Those logical preallocations do not guarantee physical UPDATE reuse. Slots remain terminal after exact acknowledgement; no automatic recycling is implied. Missing existing claim/listing/receipt coverage or active-archive baseline, exhausted slots and unavailable physical capacity still cause explicit deferral. Batch/seal/ack physical reservations remain necessary. F1-1 additionally requires fixing the new logical processing-room policy.

Production defaults remain off, retirement dry-run and archive inactive. The new destination table is empty in production by design; owned fixtures insert only `fixture/public`. Actual destination validation, approved configuration, compatible supported writer deployment, complete bounded baselines and operational preallocation remain prerequisites. The author explicitly treats this as a pre-activation contract correction; the evidence does not establish migration of an already-active older archive format. Supporting such an active older deployment would need separate scoped planning rather than an implied compatibility claim.

Task11 still owns transport/export loop, periodic flush/terminal scheduling, persisted fake-S3 crash cases and separately authorized expired replacement. Task12 owns replay. Compact markers deliberately outlive full terminal receipts/catalogue and require later operational sizing. The existing amendment permits development with omitted independent review gaps; the later release authorization remains for the controller's completed-upgrade workflow, not permission to accept these remaining Important findings or release from this reviewer.

The author should address F1-1, F1-2 and F1-3 together as the complete remaining scoped fix list, retain truthful evidence/limits, and provide forward source/report pins. No previously covered test rerun or omitted probe was performed by this reviewer. No further review surface was added beyond the original findings and their fixes.

**Final disposition: Requirements / Spec FAIL; Quality CHANGES_REQUIRED. Same reviewer DONE and STOP.**
