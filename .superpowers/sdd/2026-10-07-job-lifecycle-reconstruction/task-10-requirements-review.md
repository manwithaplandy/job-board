# Task 10 independent permitted requirements and code-quality review

**DONE. Spec: FAIL. Quality: CHANGES_REQUIRED.**

This verdict concerns Task 10 functional requirements and ordinary code quality. It is not a security verdict, physical-capacity guarantee, activation approval, exporter connection approval, or release decision. No Critical finding is assigned. Seven Important findings below prevent Task 10 requirements approval at this source pin.

## Source and authority

- Worktree: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`.
- Reviewed base: `6075983bd63dced95ec94dc61b9b112a79f4564d`.
- Reviewed package head: `e3f889421fa1ad30206e128cb292b101bc3a58e0`.
- Product implementation: `293e413dc452a4e9b230dcef87e23d11fa2798ed`.
- During review the controller advanced checkout HEAD to `4b02bdbd917e524b523ad4a404fb6608406fc5c5`. Read-only comparison showed only controller documentation changes after the package head. All 18 entries in `task-10-evidence/source-files.sha256` still matched. This report remains pinned to the supplied product source, not an expanded moving-source review.

Read the exact Task 10 brief first, the review-scope amendment and release authorization, the full author report, reviewer dispatch and operational ruling. Examined the recorded 40-file full review package, confirmed its full diff exactly equals the pinned `git diff --unified=10`, and read the new product implementation and tests directly. Read the relevant archive and provenance requirements in `docs/superpowers/specs/2026-10-03-job-lifecycle-design.md`, plus adjacent existing callers needed to assess the new integration. The source-contract requirements below are not overridden by the development review-scope amendment.

The operational ruling was read before assessing the new lane: preallocation may support bounded durable existing-source work; missing readiness/slots may defer; no physical credit follows from deletion or logical reuse; the original growth guard must remain unchanged. These terms were used in this review. No substitute reviewer, helper, subagent, network/provider call, DB test run, product edit, Git mutation, migration, activation or release action was performed.

## Important findings

### R10-1 — Operational misses survive an intervening normal positive sighting

**Important; functional correctness.** Primary location: `job_discovery/lifecycle/operational.py:277`. Related locations: `operational.py:262`, `operational.py:270`, `operational.py:283`, and `job_discovery/lifecycle/reconcile.py:140`.

The operational lane increments `lifecycle_operational_listings.miss_count` and preserves its `first_miss_at`, then overwrites the corresponding `source_listings` miss fields from that separate state. Normal `_positive` resets only the `source_listings` counters. Its successful sighting does not clear the operational history. The operational skip condition only recognizes a positive at or after the *current* operational enumeration's start.

A normal sequence is sufficient to cause a wrong closure: an operational enumeration records one miss; a later normal enumeration sees the listing and clears the normal miss counters; a subsequent operational enumeration misses it. If the old operational first miss is at least 24 hours old, the last step closes the Job using an absence interval interrupted by a known positive. The inverse transition can also lose accumulated miss progress because the operational copy need not reflect normal-lane misses. This contradicts the consecutive complete-miss behavior and the single lifecycle truth requirement in design lines 468–472.

**Narrow fix:** make one persisted set of absence counters authoritative across both lanes. Keep separate operational sequence/cursor fields only where needed for bounded idempotence; ensure a normal positive invalidates all earlier absence evidence before a later operational miss is evaluated. Preserve the approved field restrictions and physical admission contract.

**Evidence needed:** add ordinary small-DB lane-switch fixtures for operational miss → normal positive → operational miss (must remain open), normal miss → operational miss, and a positive before a resumed reconciliation. Current seven operational tests stay entirely within the operational evidence model and do not establish this integration. I did not execute these scenarios or any excluded mechanism probe.

### R10-2 — The new archive byte budget counts only canonical event bytes

**Important; Task 10 logical archive-budget conformance.** Primary location: `job_discovery/archive/outbox.py:34`. Related locations: `archive/batches.py:87`, `migrations/2026-10-03-04-public-outbox.sql:396`, and the same migration at line 573.

All warning/pause/hard byte calculations sum `octet_length(canonical_event)` only from `public_pending_events`. The new implementation also stores event bodies in requirements/outbox rows and copies canonical event bytes into `public_archive_items` when claiming a batch; those live membership bytes and seal/row/index forecasts are absent from the logical pressure calculation. Claiming/sealing does not check the archive live-byte budget for its additional representation.

Consequently, equal pending event sets report equal archive pressure before and after membership copies have been persisted, although their live archive footprint differs. A collection of pending claimed batches can contain roughly another canonical-data copy without moving the reported byte threshold. The design explicitly includes live pending/sealed event **and membership** bytes plus row/seal/index-overhead forecasts (design lines 595–604). The existing 6000 MiB reservation calls are a separate constraint and do not implement this 64/112/128 MiB contract.

**Narrow fix:** define a conservative logical live-archive charge covering each retained representation and use it consistently in health, event admission, critical-slot admission, batch claim and seal transitions under the existing gate. Preserve the ordinary/critical event-count limits and both reserve dimensions. Do not change or purport to validate the old physical accounting mechanism.

**Evidence needed:** bounded arithmetic/small-row tests showing that added pending membership/seal state changes the forecast and that ordinary/critical thresholds use the same forecast. The existing threshold test verifies arithmetic on caller-supplied canonical sizes only. This finding is source-level review of the *new archive budget*; no physical-capacity, large-load, or omitted Task 3 accounting probe was performed or requested.

### R10-3 — Archive pressure does not enter the durable storage-deferred path

**Important; orchestration correctness.** Primary location: `job_discovery/lifecycle/reconcile.py:43`. Related locations: `archive/outbox.py:23`, `archive/outbox.py:92`, `reconcile.py:351`, `reconcile.py:361`, `reconcile.py:366`, and `reconcile.py:383`.

The newly inserted flush can raise `ArchiveBlocked` on ordinary outbox pressure or unavailable event storage. It is a separate `RuntimeError`, not the `StorageBlocked` type caught by source orchestration. During `stage_postings`, the exception therefore enters the generic source-failure handler. The still-populated chunk is then retried outside that handler, where only `StorageBlocked` is caught, allowing `ArchiveBlocked` to escape the entire source run. A failure during the final chunk or reconciliation also bypasses the existing storage-deferred handler.

This matters at the intended ordinary pause boundary: a changed metadata record can stop the source run instead of routing existing-ID verification through the preallocated lane that can still use available critical closure slots. It can also log a storage/archive condition as a source enumeration failure. Directly calling `verify_storage_blocked` in the new test does not cover reaching it from the real source entrypoint when event admission is blocked.

**Narrow fix:** give archive pressure a deliberate orchestration outcome and route it through the bounded deferred/fallback path after rolling back the failed mutation. Preserve distinctions between source/feed failure, unavailable archive readiness, and exhausted critical storage. Do not retry the same rejected admission chunk as ordinary source work or claim a closure committed when it did not.

**Evidence needed:** ordinary offline-feed orchestration tests that inject the new archive-pressure exception at a chunk and final reconciliation boundary, assert rollback and truthful deferred accounting, and show eligible preallocated verification still gets its turn. This does not require a physical guard or excluded activation suite.

### R10-4 — Current meaningful public writers are still incompatible with active production

**Important; Task 10 integration/readiness.** Primary location: `job_discovery/lifecycle/reconcile.py:43` (the only shared producer integration added). Concrete uncovered callers: `job_discovery/db.py:64`, `company_discovery/db.py:50`, `company_discovery/enrich_apply.py:60`, `company_discovery/jobs_db.py:170`, `company_discovery/name_backfill.py:67`, and `job_discovery/locations.py:51`.

The new `_write` integration pairs the lifecycle writers that already use it. It does not pair seed/company ingestion, meaningful company enrichment/classification, name backfill, or location creation/correction entrypoints. For example, `job_discovery/run.py:108` still calls `sync_seed` and commits before taking the source-enabled branch at line 113. A new seed or changed seed name produces a company projection requirement but no matching event, so the current source-enabled application path will fail at commit if the archive is activated. Company workers likewise remain live entrypoints, rather than solely obsolete legacy Job pollers.

The trigger correctly rejecting an unpaired stale writer is useful and expected. It does not fulfill Task 10's separate instruction to connect all meaningful public mutators or provide a compatible deployed writer set. The author candidly lists old company/Job readiness as incomplete; this report does not treat that admission as evidence the integration is finished. Location backfill is also relevant even though the source-enabled poll path currently returns before legacy location resolution.

**Narrow fix:** finish a caller-level inventory and route supported current writers through the shared claim/reservation/event contract in their existing bounded transactions. Explicitly retire or gate any deliberately unsupported entrypoint before it can be declared ready. Keep flags-off compatibility and reject truly stale direct DML. Do not enable destination/producer controls as part of this fix.

**Evidence needed:** offline ordinary active-producer fixtures for the actual supported seed/company/location entrypoints, their rollback when pairing fails, and no event for operational-only updates. The existing flags-off service statements and active lifecycle admission fixture do not cover these writers. Full activation security tests remain excluded; compatible-writer source integration is within this review's permitted scope.

### R10-5 — Exported events omit the required recorded/observed time distinction

**Important; immutable public-history contract.** Primary location: `job_discovery/archive/outbox.py:54`. Related locations: `migrations/2026-10-03-04-public-outbox.sql:13`, migration line 24, migration line 549, `archive/batches.py:375`, and `lifecycle/reconcile.py:132`.

The canonical envelope exports only `occurred_at`. For normal trigger requirements that field defaults to the DB mutation clock; the row's separate `recorded_at` is never included in canonical event bytes. Original observation time passed through public mutators is not systematically carried into this envelope. Some bodies happen to contain an observation/closure timestamp; others do not, so they cannot supply the specified common temporal contract.

After exact acknowledgement removes the outbox row, an archive consumer cannot recover its original DB-recorded time from the retained event. This conflicts with the explicit observed/recorded UTC envelope fields and preservation of both on authorized recovery (design lines 499–501 and 586–591). A persisted seal time is a batch time, not the missing per-event timestamp.

**Narrow fix:** persist and serialize separate, explicit observed and DB-recorded times, with clear baseline semantics and the real mutator observation where available. Bind them through pairing and critical-slot serialization without inventing legacy observation history. Finalize this versioned contract before any downstream immutable objects are produced.

**Evidence needed:** deterministic codec and paired-event fixtures with deliberately distinct source-observation and DB-recorded times, including a baseline and critical event; retain those exact bytes across claim/seal/recovery. No new timing-enforcement or expiry-mechanism probe is needed.

### R10-6 — The sealed key/manifest contract differs from the approved archive layout

**Important; specification conformance before exporter integration.** Primary location: `job_discovery/archive/batches.py:113`. Related locations: `batches.py:116`, `batches.py:223`, and `migrations/2026-10-03-04-public-outbox.sql:28`.

The implementation seals `public/v1/<batch UUID>/events.jsonl.gz` and `manifest.json`. The approved design requires a validated configured prefix with a seal-day `ingestion_date=YYYY-MM-DD` partition and an opaque batch ID plus compressed SHA in the data filename (design lines 545–551). No ruling supplied for this task replaces that layout. The manifest also lacks the explicit event-ID digest and per-aggregate revision ranges required at lines 546 and 560–562; raw ordered IDs and a hash of the whole manifest provide useful binding but are a different schema.

These are concrete contract differences, not evidence of an object collision or corrupt upload. They become costly to change once Task 11 starts uploading immutable seals and Task 12 consumes them.

**Narrow fix:** align the sealed relative-key layout and manifest fields with the approved contract, keeping any approved destination prefix service-owned and event IDs out of path construction. Alternatively obtain an explicit architecture amendment before declaring this specification satisfied; no such amendment is present in the reviewed inputs. Persist/validate every identity field the manifest declares, including batch ID, serializer/schema version and prior-batch reference.

**Evidence needed:** small deterministic fixtures asserting the complete manifest schema, UTC seal-day partition, content-hash filename and persisted identity agreement. Existing gzip determinism and three immutable-column checks do not establish this layout.

### R10-7 — Seven-day terminal compaction keeps full receipts/catalogue indefinitely

**Important; bounded archive state.** Primary location: `job_discovery/archive/batches.py:398`. Related locations: `migrations/2026-10-03-04-public-outbox.sql:49`, migration line 154, and migration line 170.

The cleanup helper empties acknowledged item canonical bytes and critical-slot bodies. It never compacts or expires `public_archive_receipts`; complete data/manifest receipt JSON, all batch seal fields and per-item rows remain indefinitely. The generic immutability trigger rejects receipt updates/deletes, so merely scheduling this helper later cannot supply the omitted cleanup phase.

Preserving compact exact-ID/replay/fence evidence is required. Keeping full terminal receipt payloads forever is not the specified seven-day terminal retention: design lines 625–628 explicitly expire acknowledgement receipts after compact markers are safe and reject an indefinite duplicate PG catalogue. The author's report accurately says receipt/seal references survive, but the current representation retains full receipts as well as references.

**Narrow fix:** define the minimum durable replay/fence/coverage markers and a bounded acknowledged-only transition that removes or compacts full terminal receipts/catalogue payloads after seven days. Preserve pending and unverified state without TTL/cascade deletion. Make exact-ack cleanup/replay semantics depend on the retained marker representation rather than requiring the forever-full receipt row.

**Evidence needed:** extend the existing ordinary acknowledged-terminal-age fixture to show full receipts are retired/compacted, required markers and version coverage remain, and pending batches are untouched. This is new Task 10 terminal-state retention, not an independent review of omitted Task 3 claim-expiry mechanisms.

## What the implementation and evidence do establish

- Additive archive tables, explicit version coverage and package registration are present. A read-only exact-text check confirms the full Task 10 migration is contained verbatim in `schema.sql`.
- Public projection allowlists cover all 13 declared aggregate types. Private applicant/raw description/question fields are not included by those projections. Python contracts include the requested EventRef, BatchRef, SealedBatch, VerifiedBatch, AckResult and ProjectionResult shapes, with additional persisted-clock/event-byte data to permit pure serialization.
- The paired producer path uses per-aggregate revision heads, deterministic UUIDv5 event/predecessor identities, exact current-transaction requirements and deferred pairing. Meaningless cache-use/source-attempt updates do not create projection changes. Pure closure/reopen classification avoids spending the critical reserve on a combined public-metadata change.
- Batch selection uses exact visible event IDs, excludes its own uncommitted events, persists ordered membership, and blocks a later aggregate batch until prior membership is acknowledged. Selection and deletion do not use a sequence watermark. The lower-sequence test uses actual separate DB sessions and a fixture sequence allocation/reset; it establishes exact-ID behavior, not broad concurrency or security assurance.
- Canonical JSONL and gzip are deterministic for a fixed ordered input. Compression is a connection-free operation. Persisted seal/membership fields and receipt comparisons support the ordinary exact acknowledgement workflow; acknowledgements delete exact ordinary event IDs or mark exact critical slots acknowledged in the same transaction.
- Exact version coverage includes version UUID, listing UUID, revision and content hash. Maintenance no longer treats `source_listings.archived_revision` alone as proof a particular version is archived. This is a substantive correction; source review and the selected fixture support it.
- The operational lane is real durable code, not the former HTTP-only fallback. It has bounded provisioning, persisted source/listing/checkpoint state, bounded receipts, existing claim reuse, chunked positive evidence, full-completion checks, explicit missing-preallocation deferral and finite critical-event retention. Current functional defects are listed separately above.

## Caller inventory and limits

| Public area | Actual integration at this pin | Review conclusion |
| --- | --- | --- |
| Job metadata admission, source listing/version changes | `identity.admit_metadata` / `capture_version` → `_write` | Paired ordinary path present; affected active fixture covers jobs/listings/versions |
| Positive/direct observation and complete misses | `reconcile._positive` / `reconcile_chunk` → `_write` | Pairing present; archive-pressure routing and operational evidence handoff require fixes |
| Source account registration | `job_discovery.db.sync_source_accounts` → `_write` | Paired path present; operational-only source fields excluded from public projection |
| Identity assertion changes / version-location edges | `identity.set_identity_assertion` / `capture_version` → `_write` | Shared integration present; existing selected relation tests are not comprehensive active-archive coverage |
| Existing source verification while ordinary storage unavailable | `verify_storage_blocked` → `operational.run_due` | Durable bounded lane present, subject to readiness/finite slots and R10-1/R10-3 |
| Companies: seed, discovery, enrichment, classification, name backfill | Existing direct writers | Unpaired meaningful writes are rejected when active; current writer readiness incomplete (R10-4) |
| Locations: resolver/backfill/manual correction path | Existing direct SQL writers | Projection/rejection present; supported caller pairing incomplete (R10-4) |
| Brand/skill/company-brand/company-source/job-skill relations | Projection triggers and generic producer/baseline API; company-source mapping also exists in identity backfill | No complete production writer inventory/readiness evidence. Brands exercise generic fixtures; this does not certify every endpoint |
| Initial identity migration/backfill | Existing migration utility, not newly paired | Must remain a pre-activation prerequisite or gain an explicitly supported active path; do not infer readiness from generic triggers |
| Private/cache-use/operational-only fields | Public projection unchanged | Ordinary no-event behavior supported in the selected fixture; no private isolation/security verdict |

## Actual tested, reviewed and deliberately unreviewed scopes

**Test execution in this reviewer session:** none. Author-covered tests were not rerun. No new DB probes were run.

**Author evidence read:** full `task-10-report.md`, command chronology, test contents inventory, runtime/image versions, final lint output, source hash list and the actual final test output files. Historical failures were inspected as failure evidence (initial missing-module RED; heterogeneous OLD-record field/type errors; operational PL/pgSQL CASE syntax failure), not reclassified as passing results. The final results supersede those failed attempts for the selected cases.

| Recorded run | PostgreSQL 17 evidence | PostgreSQL 16 evidence |
| --- | --- | --- |
| Complete affected selection | 17.11, 36 passed, 28.30 s | 16.15, 36 passed, 35.55 s |
| Subsequent affected operational file | 17.11, 7 passed, 4.90 s | 16.15, 7 passed, 6.18 s |
| Subsequent affected batch file | 17.11, 9 passed, 5.93 s | 16.15, 9 passed, 7.37 s |

These are 37 unique selected tests per major at final state through the recorded incremental runs, not one final 37-test command. Outputs show no skipped DB tests. PostgreSQL 17.11 is major-version parity evidence, not an execution on historical production 17.6. PostgreSQL 16.15 supplies compatibility evidence. Recorded Python 3.12.14, psycopg 3.3.6, pytest 9.1.1 and ruff 0.15.20 were read; final lint reports all checks passed. I independently checked hashes and schema text equality, not lint or runtime tests.

The operational resource fixture records unchanged allocated DB/table+TOAST/index sizes: on the final operational 17 run, allocated 12,236,467 bytes before/after; on 16, 12,295,191 bytes; table+TOAST 1,097,728 and indexes 1,605,632 on both. All printed deltas are zero. The real operational entrypoint fixture separately asserts fixed row counts for its preallocated state/receipt/slots and legacy write-check table. This is useful evidence for those small owned fixtures only. It does not show production headroom, above-6000-MiB behavior, indefinite MVCC page reuse, large-board fairness, or physical credit from compaction.

**Independently reviewed here:** new Task 10 public schema/projection and paired-caller code, exact membership/serialization/receipt/ack code, exact version coverage, new operational workflow, ordinary readiness/error paths, selected test contents and recorded evidence. Findings are source-derived; absent cases are labeled as requested future evidence rather than executions I performed.

**Deliberately unreviewed:** the refused independent Task 3 expiry enforcement, physical-capacity accounting, cross-user isolation and related adversarial review/probes; broad original-helper/GUC/role attacks; existing `test_lifecycle_safety.py`, `test_lifecycle_activation.py`, `test_lifecycle_review_security.py` and equivalent substituted probes. No attempt was made to reproduce or disguise them. Reading the new allowlist/receipt integration and unchanged activation guard call contract supplies no independent mechanism/security assurance. The existing amendment permits development with those gaps documented. No new safeguard rejection occurred in this reviewer session.

## Minor quality observations

- `migrations/2026-10-03-04-public-outbox.sql:93` and `:509` define successive versions of the same projection function; `:184` and `:417` similarly duplicate the large row-validation definition. The final definition wins, but duplicate large definitions in a single new additive migration and schema append make maintenance/review unnecessarily difficult. Consolidating within this not-yet-released new migration should preserve migration/schema equality and prior-task behavior.
- `archive/batches.py:65` linearly scans selected predecessors and issues individual coverage lookups, up to the 2,000-event batch bound. Keep a selected-ID set and consider a bounded bulk coverage read to reduce time under the gate; no throughput or lock-time guarantee was established by the small fixtures.
- Warning threshold behavior itself is not directly asserted by `test_budget_boundaries_and_critical_reserve`; that test covers numeric admission boundaries. The report should avoid implying equivalent runtime warning/SQL-boundary coverage.
- The public validator's nested metadata type conditional at `archive/schema.py:220` is difficult to read. A straightforward named predicate would make future schema changes less error-prone. This is not a finding that valid current metadata necessarily fails.

## R6-4 and remaining prerequisites

The operational proposal/ruling is implemented as a bounded logical protocol, with one source state and receipt, one mark per known listing and up to 12,500 global critical slots. Default provisioning forecasts 7,798,784 bytes for 100 listings, 16 slots and three additional units; each free slot has 24,576 external-storage padding bytes. All slots total 307,200,000 padding bytes before other overhead. These are concrete costs, not evidence those bytes become reusable physical headroom.

Claims/receipts/full listing coverage must already exist when growth admission stops. Each new listing admitted after provisioning needs later provisioning before that source is fully operational-ready. Active-archive closure also needs existing baseline heads and enough free critical slots. Missing prerequisites cause deferral; that is allowed by the ruling and cannot be represented as successful verification/closure. Slots never recycle at this pin, even after exact acknowledgement: finite runway is an explicit operational limit. Batch claim/seal/ack still need ordinary positive reservations and can also defer. The original growth-guard API and thresholds were not weakened by the reviewed Python change, and physical MVCC behavior remains unknown outside the small fixture observations. This is not full R6-4 approval while R10-1 and R10-3 remain.

Before Task 10 may be called specification-complete, resolve the Important findings and provide the narrow ordinary evidence identified above. Keep the caller inventory concrete and the completed/untested/unreviewed distinctions in the revised report. Re-pin any forward product correction and review only its affected permitted scope; do not retry excluded work.

Task 11 still owns transport, periodic 60-second/oldest-flush orchestration, bounded verification, the persisted fake-S3 crash matrix and explicitly authorized expired replacement; Task 12 owns replay; later orchestration must actually schedule terminal cleanup. Those downstream tasks are not claimed complete here. Destination validation, supported producer inventory/readiness, bounded baseline completion and operational preallocation remain actual activation prerequisites. The current guard still rejects activation and the tests seed isolated active state directly; they do not prove a production activation path. All defaults remain off and retirement dry-run. Release authorization is for the completed upgrade under the controller's workflow, not authority for this reviewer to activate or release an unfinished Task 10.

**Final disposition: Spec FAIL; Quality CHANGES_REQUIRED. Reviewer DONE and STOP.**
