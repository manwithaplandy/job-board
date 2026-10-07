# Task 10 implementation report

Status: DONE for local author implementation and permitted ordinary verification. Independent permitted requirements/code-quality review is pending controller dispatch. This is not a security approval, archive activation, exporter connection, or release decision.

Source commit: `293e413dc452a4e9b230dcef87e23d11fa2798ed`.
Base: `6075983bd63dced95ec94dc61b9b112a79f4564d`.
Branch/worktree: `feature/lifecycle-recovery`, `/workspace/job-board/.claude/worktrees/lifecycle-recovery`.
The controller supplied the approved base and prior-task pins. Locally cached `origin/main` was `73ce118205bfdbb56c18207acc0c1c4e3708c860`; the author did not contact a remote or independently refresh upstream. Existing pricing and Pro stage-2 GPT6-Luna/16000 configuration was not changed.

## Binding scope

Read task-10-brief.md, task-10-author-dispatch.md, repository AGENTS.md, REVIEW-SCOPE-AMENDMENT.md and RELEASE-AUTHORIZATION.md. Read the controller's full task-10-operational-ruling.md before operational guard changes. No whole-plan read, subagents, helper agents, reviewer substitution, production/provider/model/network calls, IAM/credential changes, permanent production deletion, push, PR, merge or deploy.

The author made only forward local commits and staged exact owned paths. Controller CURRENT/progress/resume/release/task13 documents were left unstaged. Root handles independent permitted review and eventual complete-upgrade release.

## Implemented public outbox

Added additive migration `2026-10-03-04-public-outbox.sql` and identical appended schema definitions, the archive package, package registration and tests.

* Typed `PublicChange`, aggregate/change enums, total validation, bounded body (8192 bytes), explicit required relation endpoints, public field allowlists and version identity/hash fields. Raw description/question content and private applicant fields are absent. UUID namespace `fb2201d3-79ac-5801-923c-471b7823cb15` deterministically produces aggregate-kind/ID/revision event IDs and predecessor IDs.
* After-row public projections create exact current-transaction requirements and monotonically ordered aggregate revisions. Deferred pairing requires the event's exact aggregate, revision, kind, body and occurred_at. Rollback removes state and event together. The old unconditional archive-placeholder rejection was replaced; established ordinary capacity/protection logic is otherwise retained. Paused producers reject eventful public changes; non-eventful private/cache-use and unchanged polling updates do not emit events.
* Projection coverage: jobs, source_accounts, source_listings, job_versions, companies, locations, brands, skills, company_brands, company_sources, job_locations, job_skills, identity_assertions. Source operational attempt/lease/counter timestamps are not public facts. Source exclusion identity, listing availability/version/anchor, exact version metadata, and typed relation endpoints are public facts.
* `_write` now flushes matching projections in the same transaction, connecting existing metadata admission, version capture/location edges, assertions, source catalog registration, positive/direct observations and complete-miss closure. `identity.py` explanatory comments reflect this shared integration. New source/listing/job rows retain their existing IDs and private FKs.
* Bounded baseline snapshots current existing rows only, max100 per call; missing heads are the durable checkpoint. They do not fabricate historic observations or public versions. Production destination/producer readiness remains unvalidated and activation guards remain closed.
* Ordinary budget112MiB/87500, critical hard budget128MiB/100000, reserving16MiB AND12500 slots; warning64MiB/50000/15minutes. Critical classification requires a pure closure/reopen field change; simultaneous other metadata changes remain ordinary. No per-unchanged-poll event growth. New budget SQL checks and API forecast use the same existing gate/capacity interfaces.
* No pending event/batch cascade or TTL cleanup. Service-only tables have RLS and client privileges revoked; no new client grants or privileged user/job-DML helper was introduced. This is implementation description, not independent security assurance.

Legacy direct writers remain compatible with flags off. Once archive-active, an eventful stale/direct writer without the paired contract fails closed. Old company/legacy Job writer entrypoints were not silently granted producer compatibility; their deployment readiness remains an activation prerequisite.

## Exact batches, deterministic seals and acknowledgement

`claim_batch(tx, limits, claim)` selects only committed, unassigned exact event IDs, excluding its own transaction's ordinary and critical-slot events. No sequence watermark determines membership/deletion. Earlier per-aggregate revisions must be in the same ordered batch or already covered; unacknowledged prior aggregate batches block later revisions. Maximum2000 events/8MiB expanded. Claiming is eager; no caller must wait five minutes. Task11 still owns the scheduled exporter tick/oldest-flush orchestration.

The caller commits the claim before invoking pure `seal_batch(batch_ref, serializer_version=1)`. BatchRef includes immutable event-byte snapshots and persisted DB seal clock/horizon in addition to the specified identity/claim/membership/version fields. SealedBatch exposes batch identity/claim/membership/version properties, fixed object keys, persisted seal time and730-day eligible_until, SHA256 canonical/compressed/manifest digests and all counts/byte sizes. VerifiedBatch binds that seal to exact data and manifest receipts. ProjectionResult is defined for later replay integration; no replay executor is implemented here.

Canonical UTF-8 sorted JSONL and deterministic gzip use mtime0 and no filename. Compression/serialization has no DB connection and runs outside SQL locks/transactions. `persist_seal` validates bytes, digests, membership, manifest identity, keys and sizes before writing immutable seal columns. `recover_batch` can adopt persisted work only after the prior owner is no longer active; its original membership and seal time survive. Expired seals fail closed and require future explicit authorized replacement; no replacement authorization or transport is invented in Task10.

`ack_batch` requires a current claim/fence, exact persisted seal and membership, unsuppressed aggregate membership, both matching verification receipts, and DB time strictly before eligible_until. It persists receipt/coverage and deletes ONLY exact ordinary IDs (or terminally marks exact critical slots) in the same transaction. Late-committing lower sequence events remain pending. Rollback preserves pending membership/receipts together. Seal/ack growth uses the ordinary physical reservation API, so missing physical headroom defers it.

`public_archive_version_coverage` binds version UUID + listing UUID + version revision + content hash + event/batch. Maintenance's version eligibility now requires that exact coverage; a listing archived_revision watermark cannot certify unknown versions. No unknown or privately referenced version is silently retired.

`compact_terminal_batches` compacts only verified, acknowledged bytes after7days, max2000 combined item/critical-slot operations. Exact IDs/revisions, receipt/seal references, suppression and coverage/fence markers survive. Pending state never ages out. This helper is ready for Task11/13 scheduled orchestration; no exporter/maintenance archive scheduling activation is added here. A compacted terminal byte history cannot be reconstituted through a fake pending replay.

## R6-4 operational closure and health contract

Concrete prior issue: claim_due_source→fresh claim/_write(source_accounts)→new source enumeration/membership/checkpoint rows reserved growth, and every source/listing update was charged as growth. The old fallback fetched/logged feeds without durable closure/health. A zero-byte reservation would not solve staging, receipt or archive event storage. The controller approved an additive preallocated lane; ordinary growth admission/6000MiB/all-held forecasts were not weakened.

New `lifecycle/operational.py` and tables provide:

* One `lifecycle_operational_sources` row per source: sequence, terminal/running status, started/completed/last-turn clocks, fixed UUID cursor, completion bit and membership count.
* One `lifecycle_operational_listings` row per existing listing: fixed source/listing IDs, positive sequence/time/kind, distinct miss sequence/count bounded0..2 and first-miss time.
* One reusable `lifecycle_operational_receipts` row per source with backend/transaction, actual invoking role/subject, current owner/generation and <=500 counted row effects. Receipt updates defer current claim/DB-time validation to standalone commit. No caller GUC enables this lane; it does not insert the old lifecycle_write_checks per operation.
* Existing source claim rows are reused. Fresh missing claims, operational rows, incomplete known-listing coverage or missing archive baseline produce explicit deferral. The same gate precedes sorted Job keys before affected Job/listing locks; source-only progress is gated. Each bounded operational transaction renews the existing claim; network requests follow committed transactions.
* Global fixed critical-event slots, integer IDs1..12500, with free→allocated→pending→acked transitions. Default provisioning adds16 slots per ordinary source turn; explicit provisioning allows0..100 per chunk. Slots are never automatically recycled. Above-guard closure/reopen in an archive-active fixture retains exact body/UUID/revision/predecessor/time in these slots and uses the same pending-event view/batching/ack. Missing slots or baseline rolls back closure; it cannot report success while dropping its event.

Below-guard `provision` uses the unchanged positive capacity API; at most100 listings and100 slots per call. Default forecast is65536*(100+16+3)=7798784 bytes, including existing ordinary claims/reservations. Each free critical slot carries24576 external-storage padding bytes (16 slots=393216 bytes; all12500=307200000 bytes before row/index overhead). A populated slot bounds body<=8192 and canonical event<=12288 bytes plus fixed metadata, and drops padding. These are logical/preallocation bounds, not physical credit or a promise of MVCC page reuse.

The operational reader streams existing IDs only; new IDs are not admitted or stored. Positive evidence commits in <=100-item chunks and survives partial feeds/restart. Only full successful, unsuspicious completion can supply absence. Empty feeds with >20 prior open jobs remain suspicious. Reconciliation uses per-listing sequence marks, two distinct successful misses>=24h apart, and durable cursor commits. An interrupted running feed restarts a new sequence; a complete unreconciled checkpoint resumes. No payload is hydrated, no identity is inserted. Successful/partial/failed health and next-due scheduling persist; the latter retains the established UTC day-boundary rule. Per-source last-turn ordering prevents resumed tails always retaining the oldest selection key, but large-board operational fairness is not independently load-proven here.

`verify_storage_blocked` now invokes this durable lane. Ordinary source turns proactively provision bounded state before regular staging. Full initial coverage of large/existing corpora requires repeated bounded provisioning BEFORE the guard binds; missing readiness yields a deferred result. No actual database was filled past6000MiB for this task, and no omitted Task3 physical-capacity/expiry/isolation probes were run.

## Verification evidence and limits

See `task-10-evidence/test-inventory.md` for explicit test contents recorded before each selection, `commands.md` for actual commands/chronology, `versions.txt` for exact runtime/image pins, and `source-files.sha256` for final owned source/test hashes.

Initial RED:3 collection errors from missing archive modules. Intermediate PostgreSQL failures are retained: heterogeneous-trigger OLD field access, then a PL/pgSQL CASE syntax mistake, were corrected before GREEN. No failed result is presented as a pass.

Complete affected selection:36 passed on actual PostgreSQL17.11 and36 passed on16.15, no skipped DB tests (`final-pinned17.txt`, `final-pinned16.txt`). After the final UTC-midnight scheduler adjustment, only the affected operational file was rerun:7 passed on each major (`final-operational17.txt`, `final-operational16.txt`). After the own-uncommitted-membership correction/additional test, only the affected batch file was rerun:9 passed on each major (`final-batches17.txt`, `final-batches16.txt`). Together these cover37 unique selected tests per major at the final state; there is no claim that a single final command executed all37. Identity's subsequent edits are comments only.

The selected tests cover paired rollback/direct unpaired commit rejection, revision/predecessor consistency, second-session lower-sequence late commit, exact partial membership, contiguous aggregate ordering, unchanged polling, pure outbox threshold arithmetic, canonical gzip/JSON, typed relation endpoints, exact version coverage, immutable seal/membership, receipt/suppression checks, transaction rollback at ack, terminal compaction, idempotent migration reapplication, active metadata/closure integration, flags-off legacy upsert/approval/prepare/generation/same-owner cleanup, a normal single-owner authenticated update, source misses/reopen/empty threshold, and the operational lane including durable restart/cursor/critical slots.

The owned small operational fixture measured allocated database bytes, table+TOAST bytes and index bytes before/after two successful enumerations/closure. Final operational17: allocated12236467 before/after; table+TOAST1097728 and indexes1605632 before/after. Operational16: allocated12295191 before/after; same table/index values. All three deltas were0 in those fixtures. The real operational entrypoint separately proved constant counts of operational state/receipt/critical slot and legacy write-check rows. These limited observations are NOT a general physical-growth or production headroom guarantee.

Python3.12.14, psycopg3.3.6, pytest9.1.1, ruff0.15.20. PostgreSQL17 proves major-version parity;17.11 is not a claim of having run historical production17.6. PostgreSQL16 evidence is compatibility evidence. Lint passed and git diff --check was clean.

No broad pytest tests/ run, no test_lifecycle_safety.py, test_lifecycle_activation.py, test_lifecycle_review_security.py or deferred cross-user/expiry/capacity/adversarial suites. Tests that import old setup helpers do not select their test functions. Numeric outbox threshold unit tests are not a claim of having loaded100000 events or proved the old physical accounting mechanism.

## Remaining integration and release concerns

1. Task11 transport/export loop, persisted fake-S3 crash matrix, authorized expired replacement and Task12 replay remain downstream work. No external archive destination, exporter or live archive was connected.
2. All production defaults remain off; retirement remains dry-run. Destination validation, compatible writer inventory/readiness, complete bounded baseline and operational preallocation must precede activation. Stale legacy eventful writers intentionally fail closed when active. Existing activation guard still rejects enabling; fixtures seed active state only in owned test databases.
3. Finite critical slots do not refill automatically even after acknowledgement. This preserves exact history/fences but creates an operational runway limit. Fresh lifecycle receipt/event/marker infrastructure above the guard cannot be assumed available; batching/seal/ack use ordinary capacity and may defer if there is no physical headroom. Reuse requires a separately correct exact-ack/fence/marker design, not ad hoc slot reset.
4. Physical MVCC allocation is unknown beyond the measured ordinary fixtures. This task neither lowers the6000MiB ceiling nor awards physical credit for DELETE/compaction. R6-4 has a concrete durable bounded implementation and ordinary DB evidence; it has no independent physical/security assurance. Missing slots/readiness/backlog remains truthful deferral.
5. Archive terminal compaction is implemented/tested as a bounded callable helper; its periodic exporter/maintenance integration belongs to the later orchestration task. Unverified state is retained if orchestration is inactive.
6. Existing deliberately omitted Task3 expiry-enforcement/capacity-accounting/cross-user/adversarial review gaps remain. No refused work was retried or substituted, no new security approval is claimed, and independent permitted Task10 review has not yet happened.

No safeguard rejection occurred in this author session. No remaining ordinary selected test failure. Author work is local-only and ready for the controller's fresh permitted review.
