# Task 10 Fix1 author report

Author implementation and scoped verification are complete. All seven Important findings R10-1 through R10-7 have corresponding source corrections and ordinary regression evidence. This is the same author's one complete correction pass, ready for the controller's same independent permitted reviewer. It is not a reviewer verdict, activation authorization, physical-capacity guarantee or security approval.

## Pins, authority and scope

- Worktree: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`; branch `feature/lifecycle-recovery`.
- Original reconstruction base: `6075983bd63dced95ec94dc61b9b112a79f4564d`.
- Original Task10 source: `293e413dc452a4e9b230dcef87e23d11fa2798ed`; reviewed package/FixBASE: `e3f889421fa1ad30206e128cb292b101bc3a58e0`.
- Parent/controller-only changes through `0f0a759d009a042821465e0ac2c0dc4dece9501b` were preserved.
- Fix1 product/test source: **`01408f0fce8743a98a55726cc9da50f808955443`**. This commit changes 25 owned product/test/schema files. No product edits followed the final 66-test runs or this source commit.
- The following report/evidence-only commit contains this report, the appended original-report pointer and `task-10-evidence/fix1/`. Its exact SHA is supplied in the author handoff; a self-referential commit hash is not invented inside this file.

Read the full original requirements review and Fix1 dispatch, the binding brief/specification sections, review-scope amendment, release authorization and recorded operational ruling. The original seven Important findings are retained verbatim in `task-10-requirements-review.md`; no controller review text was edited or staged by this author. The amendment permits continued development with explicitly omitted Task3 review/probes. It does not remove Task10 functional requirements.

This report supersedes the earlier author report's incomplete claims about independent operational miss counters, canonical-only archive byte accounting, legacy/current writer readiness, occurrence-only envelope time, fixed `public/v1` object keys and forever-retained full receipts/catalogue. Earlier reports and failed evidence remain preserved as history.

## R10-1: common absence evidence across normal and operational work

Both lanes now use `source_listings.consecutive_complete_misses` and `first_complete_miss_at` as the authoritative absence history. Operational reconciliation updates these existing fields directly. Its per-listing `miss_sequence`, positive sequence and source cursor retain bounded idempotence; the old preallocated mirror miss columns remain schema history but no longer control closure or overwrite the authoritative counters. A positive normal sighting clears the same history the next operational miss reads.

The existing full-success requirement, two distinct misses at least 24 hours apart, partial-positive preservation and completed cursor protocol remain. No new identity or payload is admitted through operational reconciliation, and the approved receipt/field allowlist and original physical growth admission remain unchanged.

New ordinary tests cover operational miss → normal positive → operational miss remaining open, normal miss → operational miss closing after the fixture's sufficient interval, and a positive recorded before resumed operational reconciliation invalidating older absence evidence. Existing operational restart/completion and normal miss/reopen cases also pass. This resolves the functional handoff defect without claiming broad scheduling, race or physical-pressure assurance.

## R10-2: one logical live archive forecast

The additive Fix1 migration defines `lifecycle_private.archive_row_charge` and `archive_live_bytes`. The forecast is the sum of each retained live representation, not merely pending canonical bytes:

| Representation | Logical byte charge |
| --- | --- |
| Each pending change requirement | `2 * JSON body bytes + 2048` |
| Each ordinary outbox row | `2 * (JSON body bytes + canonical event bytes) + 2048` |
| Each allocated/pending critical slot | Same body/canonical charge plus 2048 |
| Each unacknowledged batch membership row | `2 * canonical event bytes + 1024` |
| Each unacknowledged batch | 8192; sealed state adds `4096 + 2 * manifest_bytes` |

The multipliers and fixed terms are conservative logical row/index/seal forecasts. They are not measured PostgreSQL allocation, free-space credit or a substitute for the existing positive physical reservation contract. Free preallocation padding and compact acknowledged historical markers are not live pending archive payload; their physical cost still exists and is not subtracted from the physical database-size guard.

Health and warnings read this same SQL total. Ordinary event admission adds the new outbox representation; the already-persisted requirement is already included. Critical flush adds the new canonical representation to the already-counted allocated slot. Both Python and SQL event checks use this charge, preserving ordinary 112 MiB/87,500 versus hard 128 MiB/100,000 and the 16 MiB/12,500 critical reserve dimensions. Warning thresholds remain 64 MiB, 50,000 events or 15 minutes. Batch claim forecasts the membership copies and batch row before writing them; seal persistence forecasts its additional seal state. These checks run inside the existing gated service transaction. Physical claim/seal/ack reservations remain additional requirements.

Small-row tests calculate the exact expected logical total, show membership and then seal persistence increase it, exercise the warning predicate, check ordinary/critical boundary arithmetic using that charge, and show a bounded membership forecast can defer without inserting a batch. There was no large-load or old Task3 physical accounting/enforcement probe.

## R10-3: archive pressure reaches durable storage deferral

`StorageBlocked` now lives in `lifecycle/errors.py`; `ArchiveBlocked` derives from it. The actual source orchestration catches archive admission pressure at the chunk and final reconciliation boundaries. It rolls back the rejected mutation, records `storage_deferred`, cancels the current ordinary claim, and gives the preallocated lane a turn. It does not retry the rejected ordinary chunk as a source failure or claim a closure committed when it did not.

Fallback carries the affected source ID. That source remains eligible for the operational turn even when a normal completion already advanced `next_due_at`; otherwise final-reconciliation pressure could hide it until the following schedule. Other existing due/resumable operational sources retain their normal selection behavior. Missing readiness/slots still returns a deferred result.

Two new offline-feed tests invoke `verify_due_sources`, inject the new archive exception at the actual chunk and final-reconciliation boundaries, assert one rejected call, zero source failures, explicit storage-deferred accounting and durable healthy operational completion. The injection concerns the new archive outcome, not an emulated or bypassed physical guard.

## R10-4: current supported writer inventory

`archive/writers.py:public_write` provides a narrow allowlisted service wrapper for companies, locations and derived Job cache stamping. It enters the existing gate, uses one server transaction-identified claim per transaction and the established `_write` reservation/flush contract, then leaves commit ownership to the current caller. It adds no client grants, generic privileged DML or operational bypass. Flags-off/unenforced callers retain their existing write behavior.

| Actual area/caller | Final integration and boundary |
| --- | --- |
| Seed companies, `job_discovery.db.sync_seed` | Each public mutation uses `public_write`; scheduled seed entrypoint commits chunks of 100. |
| Dataset candidates, `company_discovery.db.upsert_candidates` | Paired writes; current scheduled discovery and weekly worker use `ingest_candidates` with chunks of 100. |
| Weekly ingestion progress, `company_discovery.worker._weekly_ingest` | The chunk's cumulative progress/owner note commits with its companies and events. A later failed chunk preserves committed progress and remains retryable. |
| Company enrichment, `enrich_apply.apply_enrichment` | Paired public facts in the caller's existing bounded enrichment transaction. |
| Company classification, `jobs_db.apply_classification` | Paired classification facts in existing worker chunk transactions. |
| Name backfill, `name_backfill.apply_name` and `main` | Extracted persistence helper is paired; the actual main loop uses it and retains existing bounded fetched-result commits. |
| Location rule/LLM dictionary insertion | `_insert` and `_insert_unmappable` pair changes; rule work commits every 100 raws, existing LLM batches retain their bounded boundaries. |
| Manual location correction | `correct_location` is the supported paired service helper. Raw ad hoc SQL is not silently certified as a supported active writer. |
| Derived location cache stamping | Sorted affected Job chunks use scoped reservations; changing only `location_canonicals` creates no meaningful public event. |
| Lifecycle metadata/version/listing admission, source account registration, observations and closure | Existing `_write` integration remains paired; the newly shared exception routes pressure correctly. |
| Version-location edges and identity assertions | Existing `capture_version` / `set_identity_assertion` shared transactions remain paired. |
| Brands, skills and other typed relation aggregates | Projections, typed producer and bounded baseline exist. There is no new production creator for unimplemented relation workflows; arbitrary direct writers are not declared ready. |
| Initial legacy identity mapping | Explicitly pre-cutover only. Existing guard rejects enforced or ever-archive-activated mapping. |
| Legacy public Job ingestion/closure/poll writer entrypoints | `_legacy_public_writer` explicitly rejects them after archive cutover before DML and directs callers to lifecycle source admission. They remain supported with flags off. |
| Private reviews, operational/cache-only company fields | They do not produce public projection changes. No private isolation/security assurance follows from these no-event fixtures. |

The tests exercise real seed, candidate, enrichment, classification, name and location persistence, plus an actual weekly entrypoint with 100+1 candidates and a second-chunk archive deferral. Pair-failure tests inject failure after actual seed/enrichment mutation and prove caller rollback preserves the old state and event/revision counts. Five individually selected existing flags-off/current-caller regressions cover weekly enrichment checkpoint retry, rule/manual location continuity and classification field/empty-list persistence. All providers/feeds are offline fixtures; no paid or network calls are made.

This inventory is narrower and more concrete than saying every public writer is ready. Destination validation, full baseline and deployment orchestration still must ensure only these supported active paths run; unspecified external/ad hoc writers remain unsupported.

## R10-5: explicit observation and database recording time

Canonical events now contain aware UTC `observed_at` (nullable), DB-generated `recorded_at`, and sanitized provenance `source_observation`, `current_baseline` or `database_change`. The earlier `occurred_at` field remains for internal compatibility; it no longer stands in for the two required concepts. Exact transaction pairing and critical-slot envelope validation bind the persisted time/provenance fields.

Current baseline scans explicitly record an unknown observation with `observed_at=null` and `current_baseline`; they do not infer historic source times. A current mutator with actual supplied observation evidence retains it, including version/typed relation observations, changed listing sighting/content time, direct Job closure or source completion evidence. A change without such evidence records an unknown observation and `database_change` rather than borrowing an unrelated old timestamp. First-seen actual mutations may carry real supplied evidence even when their first aggregate revision is baseline-kind. `capture_version` preserves the explicit observation through version/listing updates.

New fixtures deliberately separate observed and recorded times for baseline, ordinary listing/version mutation and critical operational closure. Critical bytes survive claim, seal, persistence and recovery exactly. Recorded time remains a database clock; no application-configurable production clock or old expiry mechanism test was added.

## R10-6: service prefix, UTC partition and complete manifest identity

The additive migration creates a service-owned `public_archive_destination` contract with a syntactically bounded prefix and validation timestamp. It deliberately inserts **no production row**. Claiming pending events without a validated row defers. The prefix `fixture/public` exists only in owned test fixtures; it is not a chosen production destination or evidence that an external destination has been validated. The later rollout owns actual destination checks and approved configuration.

Batch claim persists prefix, schema version and UTC ingestion date alongside the original DB seal timestamp/730-day horizon. The key is:

`<validated-prefix>/ingestion_date=YYYY-MM-DD/<opaque-batch-UUID>-<compressed-SHA256>.jsonl.gz`

The adjacent manifest uses the same stem and `.manifest.json`. Public aggregate/event IDs are not path components. The date is always the UTC seal day, including an offset-aware reference tested at +14:00.

The canonical manifest includes schema and serializer versions, batch UUID, configured prefix, ingestion day, ordered exact event IDs, SHA256 of the canonical ordered-ID array, sorted per-aggregate first/last revision ranges, seal/horizon timestamps, prior-batch reference, both object keys, canonical/compressed hashes, count and expanded/compressed sizes. Digest/ranges are persisted with the seal; schema/date are checked while reconstructing the persisted BatchRef. `persist_seal` compares the complete canonical expected manifest, including identity fields previously omitted. Small tests alter each declared identity field, assert rejection, then persist/recover the unchanged deterministic seal.

Predecessor selection now uses an in-memory selected-ID set and one bounded coverage query instead of a linear selected scan and one coverage query per event. No throughput/lock-time guarantee is claimed. Compression remains outside the SQL transaction. Expired replacement/prior-chain creation is still Task11 work, not an implied authorization in this Task10 API.

This is a pre-activation schema correction. Existing released archive objects in the old envelope/key format were not migrated or rewritten; no such production objects were produced by this task. Supporting an already-active older deployment would require a separate explicit migration/readiness assessment, not silently treating the old format as this contract.

## R10-7: acknowledged terminal retirement with compact durable evidence

Acknowledgement now persists `public_archive_batch_markers` in the same transaction as exact coverage, full verification receipts, pending-event removal and terminal state. The compact marker contains batch UUID, owner/generation fence, event-ID digest, manifest hash and acknowledged DB time. Exact aggregate/revision/event coverage and exact version UUID/listing/revision/hash coverage reference this durable marker rather than requiring an eternal full batch catalogue.

After seven days, `compact_terminal_batches` performs at most 2,000 combined row operations per call: clear terminal critical payload bytes, delete acknowledged item payload/catalogue rows, delete full verification receipts once item retirement permits, then delete the full terminal batch row after children are gone. The marker and exact/version coverage remain. Partial cleanup is resumable; pending/unverified batches and events have no TTL and are untouched. Slot identities/fences remain terminal and are never reset to free. Callbacks against a retired batch cannot fabricate a new pending seal; exact coverage still supplies predecessor/version evidence.

Tests show full receipts/items/batches are retired, compact markers survive, exact version coverage survives, and an unrelated pending batch remains intact. Existing exact acknowledgement/rollback/late-commit cases still pass. The callable cleanup is ready for later periodic orchestration; Task10 does not activate an exporter or cleanup scheduler. Deleting these rows grants no physical allocation credit.

## Actual execution and retained failure history

The final source is verified by one complete **66-test selection per PostgreSQL major**, not a cumulative count assembled from development reruns. Selection comprises 37 original permitted Task10 cases, 24 new Fix1 cases and five individually selected affected caller regressions. `selection-final.txt` and `final-selection.json` enumerate every node, and `inventory.md` records contents before execution. Exact full commands are in `final17.command.txt` and `final16.command.txt`; both adjacent exit files are 0.

| Final owned run | Actual result |
| --- | --- |
| PostgreSQL 17.11, Debian 17.11-1.pgdg13+2 | 66 passed, 110.76 seconds; no skipped DB cases |
| PostgreSQL 16.15, Debian 16.15-1.pgdg13+2 | 66 passed, 120.18 seconds; no skipped DB cases |
| Final Ruff affected-source check | All checks passed |
| Migration/schema parity | Both complete Task10 migrations occur verbatim in schema.sql |
| Whitespace check | `git diff --check` clean before source commit |

Python 3.12.14, psycopg 3.3.6, pytest 9.1.1, Ruff 0.15.20. `versions.json` and `image-pins.txt` preserve exact runtime/local image pins. PG17.11 is major-version parity evidence, not an execution on historical production17.6; PG16.15 is compatibility evidence. `source-files.sha256` pins the tested product/test contents; `source-commit.txt` pins the source commit. No source changed after the final runs.

Raw failures are preserved, not relabeled as successful:

- Initial `red17.txt`: all seven original new regressions failed against reviewed behavior.
- `development17.txt`: collection failed because the expanded file lacked its now-needed pytest import.
- `development17b.txt`: 15 passed/1 failed due to a fixture classification source outside existing allowed values.
- `selection17.txt`: 55 passed/1 failed due to a fixture company size outside existing allowed values.
- `development17c.txt`: 1 passed/19 setup errors from an invalid PL/pgSQL CASE comparison; the corrected explicit old-row value is covered by the final runs.
- `development17d.txt`: 21 passed before the last ordinary regression additions; it is not the final source claim.
- Initial lint/import errors and formatting outputs remain included. `commands.md` records chronology and corrections.

All shell commands used `/bin/bash`, `login:false`. Owned harnesses used random loopback ports and only their own disposable PG17/16 containers from cached images. No shared 55432 or reserved destructive fixture was used. Test logs contain only fixture targets and sanitized public data; no production credentials or provider payloads were recorded.

## Resource observations, minor dispositions and carry-forward limits

The ordinary two-enumeration/closure fixture measured the following; it did not fill a database to the guard:

| Major | Allocated bytes before/after | Table + TOAST before/after | Index bytes before/after |
| --- | --- | --- | --- |
| 17 | 40,711,859 / 40,711,859 | 1,114,112 / 1,114,112 | 1,622,016 / 1,622,016 |
| 16 | 41,032,727 / 41,032,727 | 1,114,112 / 1,114,112 | 1,622,016 / 1,622,016 |

All printed deltas are zero for these small owned fixtures only. They do not establish production headroom, above-6000-MiB execution, repeated MVCC page reuse, large-board fairness or a physical allocation bound. The preallocation counts/costs from the operational ruling still apply: one source state/receipt, one mark per known listing, default16 critical slots per provisioning turn, max12,500 slots, 24,576 external padding bytes per free slot. Full-pool padding is 307,200,000 bytes before other row/index overhead; default bounded provisioning forecast remains 7,798,784 bytes. The finite critical pool never recycles automatically, even after acknowledgement.

Minor review dispositions: selected predecessor lookup was made set-based with one bounded coverage query; runtime warning behavior now has a direct small-row assertion; nested public metadata type logic was simplified. Historical Task10 migration04 was preserved rather than rewriting its earlier repeated definitions. Migration05 supplies each Fix1 override once and schema.sql contains both exact migrations. This preserves forward history and leaves the historical duplication visible for reviewers.

Concrete remaining limits and downstream work:

1. Production flags remain off, retirement dry-run and archive inactive. This source adds an empty configuration contract, not a production prefix/destination decision. Actual destination/producer readiness, complete bounded baseline and complete operational preallocation remain activation prerequisites. Existing activation guard remains closed; active tests are fixture-only state seeds.
2. Task11 still owns transport/export loop, periodic flush/cleanup scheduling, persisted fake-S3 crash matrix and explicitly authorized expired replacement. Task12 owns replay. No archive provider was connected or paid call made.
3. Missing claim/listing/receipt/baseline slots and exhausted critical capacity cause truthful operational deferral. Batch claim/seal/ack still require ordinary physical capacity and can defer. The logical archive reserve is not a physical exception or delete credit.
4. Full receipt/catalogue retention now ends after acknowledged seven-day retirement; compact exact/fence/version markers intentionally survive. Their ongoing physical footprint still needs later operational sizing. No unlimited physical-growth guarantee is claimed.
5. Current supported callers are inventoried above; unimplemented relation creators and arbitrary external/direct writers have not been certified. Legacy initial mapping remains a pre-cutover prerequisite, and legacy public Job mutators are explicitly gated after archive cutover.
6. Deliberately omitted Task3 expiry enforcement, physical-capacity accounting, cross-user isolation and adversarial review/probes remain omitted. No broad `pytest tests/`, safety/activation/security suite, renamed equivalent or substitute reviewer was used. The original logical and physical guard contract was not weakened. These ordinary functional tests and source fixes confer no new security assurance.
7. Same independent permitted review of original R10-1..7 plus any fix-introduced Important/Critical issue remains the controller's next step. The author's completion does not preempt that verdict or authorize release.

No safeguard rejection occurred in this correction pass. A transient tool/transport interruption was followed by successful same-executor checks; no replacement writer, environment or duplicate source implementation was introduced. There is no remaining ordinary selected test failure or source handoff blocker. Author work is local-only; no push, PR, merge, deployment, activation, IAM/credential change, external archive write or production deletion occurred.
