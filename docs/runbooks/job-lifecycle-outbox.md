# Job lifecycle and public archive operations

This is a release procedure, not authorization to execute it. All controls remain off, retirement remains dry-run and archive remains never-activated/export-off after fresh schema installation. Task13 used owned local PostgreSQL and fake transports only. Publication/deployment authorization does not authorize production migrations, activation, permanent deletion, destination/IAM changes, new credentials or paid infrastructure. Obtain the applicable authorization at each such boundary. Do not use a readiness row as a substitute for operational verification.

## Additive rollout sequence

1. Pin deployed source and schema, inspect the actual production server/version/volume and backups through an authorized operator. Local17.11/16.15 evidence does not establish production17.6 patch, TLS or volume parity. Reconcile newer upstream changes forward; never reset history or drop retained identity/snapshots.
2. Apply authorized additive migrations in filename order: `2026-10-03-01-lifecycle-core.sql`, `2026-10-03-02-lifecycle-safety.sql`, `2026-10-03-02-maintenance.sql`, `2026-10-03-02-source-reconciliation.sql`, `2026-10-03-03-lifecycle-snapshots.sql`, `2026-10-03-04-public-outbox.sql`, `2026-10-03-05-public-outbox-fix1.sql`, `2026-10-03-06-public-outbox-fix2.sql`, `2026-10-03-07-archive-export.sql`, `2026-10-03-08-archive-recovery-approval-history.sql`, `2026-10-07-04-lifecycle-feed.sql`, `2026-10-07-09-lifecycle-readiness.sql`. The clean schema mirrors these definitions. No migration enables a control, supplies writer attestations, validates an archive destination or runs a population backfill.
3. Quiesce incompatible administrative writers. Enable authorized collect-only identity mapping through the existing control claim/CAS API. Run `identity.migrate_identity_batch` in bounded commits (at most500); retain Job IDs, private FKs and legacy timestamps. Populated legacy cache captures use activation time and migration provenance, with no invented use or historic source successes. Previously deleted discovery age is unrecoverable. Mapping is a pre-enforcement/pre-archive operation; do not retry it after cutover.
4. Enable source verification, then independent maintenance/pre-addition capacity, demand hydration, feed expiry and dry-run payload retirement in that order, each under its separately authorized control transition. Monitor actual due coverage before asserting a24-hour service objective. Keep the daily discovery cron at `0 0 * * *` UTC and one-shot. A separate source child in the existing reviewer supervisor drains due work every60 seconds, at most100 boards and300 seconds per turn, with a330-second hard process deadline and no overlap. It returns without polling when source_enabled is false. It never intentionally polls nondue/excluded sources.
5. Before enforcement or live retirement, service operators must evaluate the actual deployed components below, then explicitly record contract_version1, the same full40-character source_revision, validated_at and nonempty notes in service-only `lifecycle_writer_readiness`. Required keys are source_metadata, company_writers, location_writers, demand_snapshots, dashboard_snapshots, reviewer_snapshots, account_cascade, legacy_consumers, archive_producers and operational_preallocation. These are assertions by the operator, not automatic runtime discoveries. No component self-attests. Quiesce incompatible writers throughout mapping certification and transition. Run `readiness.verify_backfill_batch(conn, revision, limit<=500)` with one commit per call until true. It verifies existing listing/source mapping and capture/use timestamps, not payload contents or actual deployed code. A changed control generation/revision restarts the scan; recertify before each protected transition. Completion has the old control generation and matching source revision. The transition API retains the existing owner-bound control claim and CAS. Identity/source/maintenance/hydration prerequisites must be on. Missing mapping/attestation leaves readiness blocked; local seeded attestations do not approve production.
6. Archive is a separate gate. Validate the approved destination/account/region/prefix/private access/encryption/policy and persist the existing destination evidence only after authorization. Quiesce ordinary public writers; certify compatible producers and mapping; enter producer-active/export-off through the existing control transition. Produce a bounded current-state `baseline_batch` page (at most 100 rows) and commit, using existing claims/reservations. Recertify mapping for the new generation, then separately authorize export with all destination/writer prerequisites intact. Export enablement does **not** assert corpus completeness. Interleave further bounded baseline commits with the normal exporter and exact event-ID acknowledgement; drain before the fixed ordinary backlog budget prevents another page. Small batches follow the existing five-minute flush threshold; do not enlarge budgets, discard pending history or bypass export controls. Keep ordinary public writers quiesced while this protocol visits all 13 aggregate types; baselines record current state, never invented previous history. Before ending quiescence/cutover, require `lifecycle_private.archive_baseline_ready()` to report no current row missing a head, finish delivery of every baseline event and verify no pending baseline events/batches remain. Persist that completion evidence with the deployed source and control generation. The head-existence predicate is a completion/reporting check, not an export prerequisite; it reads the corpus and can hit the existing statement limit. A timeout means completion is unverified and cutover remains blocked. Missing destination/mapping/writer readiness still blocks export activation; incomplete baseline leaves rollout incomplete while correctly sealed pages can drain.
7. Observe successful exact-ID acknowledgement, backlog and actual resource headroom before separately authorizing archived public version/edge retirement or live payload retirement. Raw-content archive stays disabled; its90-day option requires separate approval. Public event horizon is730 days from persisted seal. Pending expired batches remain pending and blocked until separately authorized replacement preserving IDs, hashes and original times.

## Runtime and writer inventory

| Runtime path | Current integration and readiness evidence needed |
| --- | --- |
| `job_discovery.run` | Daily one-shot; pre-admission maintenance; source-enabled uses existing due scheduler; flag-off retains legacy paths. Actual persisted run closed_jobs now counts successful normal/fallback closure commits. |
| `lifecycle.source_worker` | Independent bounded supervisor child using the same maintenance and due scheduler/operational path. Both it and the daily caller pass the actual admission decision: blocked maintenance defers new metadata/version admission while exact membership and existing-source progress continue. Daily blocked runs also defer novel source catalog registration. No new transport, claim or capacity mechanism. |
| `lifecycle.identity.admit_metadata`, `capture_version`, `reconcile` | Metadata/version/listing observations and availability updates use paired public writes; unchanged polls keep compact markers rather than historical events. |
| `job_discovery.db.sync_seed`, `company_discovery.db.upsert_candidates`, `worker.ingest_candidates`, `weekly_ingest` | Existing paired company/source writers,100-row ingestion boundaries and committed progress. Verify all deployed entrypoints are these versions. Legacy unpaired archive writers fail closed. |
| `company_discovery.enrich_apply`, `jobs_db.apply_classification`, `name_backfill.apply_name` | Accepted paired public mutations; model/external work remains outside transactions. |
| `job_discovery.locations` | `_insert`, `_insert_unmappable`, `correct_location` pair canonical public changes; resolver bounded100-row commits. `stamp_jobs` changes cache references, not public facts. |
| Brands/skills/relations/assertions | Typed projections, baseline and paired APIs exist for all supported tables. No invented populated skill dictionary or speculative brand/identity merge. Any new producer needs an evaluated attestation. |
| Operational verification | Existing preallocated source/listing state and critical event slots. Provision below guard before readiness; missing/exhausted rows defer. Initial global critical-slot increment: 16 per provision batch (not per listing); global critical slots: 12,500 are finite and not automatically recycled. |
| Reviewer | Lifecycle feed filters before candidate hydration; actual consumed version/snapshots follow successful matching. `backfill_floors` takes gate/sorted jobs for private metadata updates; it is an administrative whole-selection transaction, not a measured bounded ingestion path. Quiesce it during cutover and evaluate before subsequent use. |
| Dashboard private writes | `withUserPayloadMutation`, demand wrappers, `jobLifecycle`, `generationJobs`, `queries` and corrections/resumeScores/coverLetterEdits/applications/jobs actions preserve snapshots/receipts. Known package inputs remain authoritative. |
| Dashboard consumers | `jobsQuery`, board server loaders, detail/history/application/calibration consumers distinguish source, discovery and payload. Count and rows use matching semantics. Public120-second ISR was removed for per-request expiry; load/cost impact is unmeasured. |
| Legacy private packages | Cached legacy use and known-input résumé-first preparation are supported. Unknown-input package with missing questions terminal-defers to protect old artifact lineage. Full-package recapture/recovery is not implemented; preserve old artifacts and surface this availability limitation. |
| Legacy shared readers | `legacy_description_capture_allowed` and permanent maintenance cutover prevent restoration of unconditional refill/prune. Old tools bypassing current wrappers are incompatible after cutover and must remain stopped. |
| Account deletion | `accountDeletion.deleteUserRowsTx`: service transaction, lifecycle gate, subject tombstone, feedback lock, explicit userScopedTables deletion. Profile cascade/matching activity roots retain their gate. Many user IDs lack auth FK and depend on this explicit inventory. No account erasure or cross-user adversarial validation was rerun in Task13. |
| Archive export/replay | Existing export child ticks60s/deadline120s/lease180s; maintenance never writes S3. Task12 reader is optional pure offline logic, with no runtime archive loader/caller or trusted current-time/comprehensive suppression adapter supplied by this rollout. |

Public projection inventory is exactly jobs, source_accounts, source_listings, job_versions, companies, locations, brands, skills, company_brands, company_sources, job_locations, job_skills and identity_assertions. Company polling health/private cache fields do not create shared public events. Private approvals, corrections, application packages, resume_scores, cover_letter_edits, generation_jobs, demand receipts and review state remain PostgreSQL owner-scoped; the seven original Job-linked child relationships must never be erased by identity retirement. Current APIs do not depend on archive availability.

## Grants and control combinations

Existing lifecycle controls, claims, reservations, readiness, outbox, destination and archive state are service-owned with RLS and no client write grants. Existing owner-scoped demands/snapshots retain their narrow grants and policies; migration03 grants authenticated consumption-time update without shared cache writes. Private helpers retain explicit PUBLIC/anon/authenticated EXECUTE revocation. Migration09 adds no client grants or SECURITY DEFINER bypass. This is a source inventory, not independent role/JWT/helper security certification; that omitted review remains absent.

| State | Permitted operation / rollback |
| --- | --- |
| Fresh/off/never-activated | Legacy compatibility remains. Installations do not retire cache or upload. |
| Collect + individual feature flags | Evaluate mapping and ordinary source/demand/feed behavior. Retirement remains dry-run until enforced readiness. |
| Enforced + dry-run | No claim that old unreserved writers remain compatible; deploy current wrappers and stop incompatible tools. |
| Retirement live | Requires enforced stage and complete readiness. Disabling retirement pauses it; it never deletes lean Job identity or protected snapshots. |
| Producer active + export off | Paired writes remain subject to logical backlog limits. Pending events retained. A bounded first baseline page is built before enabling export; subsequent pages interleave export and exact acknowledgement. |
| Export pause | Producers stay paired and stop at applicable backpressure. No pending/event/seal deletion. |
| Producer paused after any activation | Eventful changes remain blocked; archive history cannot reset to never-activated. Revalidate runtime/destination, recertify and resume through claim/CAS. |
| Rollback | Pause affected features/workers, retain schema/identity/private work/outbox/history. Never restore old prune/refill consumers, fabricate timestamps or clear permanent activation history. |

No runbook procedure changes grants, disables constraints, overrides database clocks/GUCs, rewrites claims or supplies physical credit for deletion.

## Health, lag and capacity

Use existing persisted state/logs: last successful sweep and retired rows/bytes; physical `pg_database_size/1024^2` and guard status; separately observed live/dead/reusable space; source last attempt/complete verification/due age/failure streak/exclusion and persisted cursor; committed closure counts; demand pending/deferred/status/version; outbox forecast bytes, live_bytes, rows and oldest age; seal/upload/verification/exact ack/error; retention-blocked and suppression/replay gap status. Two scheduled guard-active sweeps require operator action through existing logs/admin status; no notification infrastructure is introduced.

The supervisor checks at most5 seconds, starts maintenance immediately/every15 minutes, enforces90-second maintenance process deadline, and shares a30-second shutdown drain across all four children. Maintenance lease120s, archive/source-board/demand lease180s, renewal<=30s; transaction lock2s/statement5s remain. Source turn timeout is330s around300s work. Claims after interrupted work recover under the accepted fenced protocol.

Previously the sole daily scheduler caller could select at most100 boards/day. A15-minute100-board schedule has a9,600/day theoretical cap before HTTP/time tails. The60-second tick allows due backlog to drain between bounded turns; it is not proof of24-hour coverage. The arithmetic best case is144,000 selected turns/day at100 boards/minute, but300-second saturated turns reduce that to28,800/day before scheduling/HTTP tails; repeated330-second failures lower it further. Resumed tails and operational fallback change work per turn. Measure actual enabled/due population, source request latency and oldest-complete-verification lag before rollout. No production source count was queried for this task. The small six-cycle fairness fixture proves only its finite fixture bound.

The6000MiB guard measures allocated database size, not logical payload sums. Admission chunks<=500 and maintenance batch/cap2,000/20,000 remain. Logical retirement can leave allocation unchanged; reusable pages are unknown without direct authorized measurements. No DELETE credit, automatic vacuum-full/compaction, volume increase or lower bill is assumed. The existing above-guard operational lane can reconcile preallocated identities; finite slots, MVCC/index/WAL growth and sustained headroom remain rollout uncertainties, not proven physical guarantees.

Outbox thresholds: warn64MiB/50,000 events/15min; ordinary pause112MiB/87,500; hard128MiB/100,000, with16MiB AND12,500 critical slots reserved. Current accepted accounting also reserves `6*C+128,000` logical processing bytes per canonical event C. Consequently byte escrow can bind long before slot count: prior accepted fixtures estimate506–865 ordinary events or61 two-event closures, not12,500 guaranteed closure operations. Inspect actual event sizes and drain rate. Exact acknowledgement releases logical reservations; allocation may remain. Pending events/seals never TTL-delete; terminal large shells expire after seven days while replay/fence/suppression/auth history survives. Current plus<=10 superseded public versions/listing within30 days is permitted only after safe archival and protection checks.

## Local evidence and limitations

Task13 evidence is under `.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-evidence/`, with the report beside it. The committed `tools/lifecycle_test_selection.json` is the positive local/CI selection. Run Python and the two ordinary dashboard DB files through `tools/lifecycle_test_db.py --postgres-major 17` and16, using `tools/run_lifecycle_acceptance.py [dashboard]`. Default Vitest excludes all DB fixtures. Never use a shared55432 target or broaden discovery to the deliberately excluded mechanism/security suites.

The six-family fixture retained12 Job identities and six private snapshots, retired five unprotected descriptions totaling80 logical bytes, and measured1,744 Job row bytes with28,448,435 allocated database bytes. One archive fixture produced6,340 canonical/922 gzip/2,671 manifest bytes. These tiny synthetic ratios are illustrative, not population forecasts. Extrapolate only from an authorized representative sample using independent identity/row-index, cache-size/expiry/protection, meaningful event rate, escrow and retention dimensions. Do not infer savings for already deleted history. The combined offline sample measured four processes (real maintenance/fake-S3 export, inert stalled reviewer, source disabled), not active production model/source throughput. See exact phase metrics; no cost neutrality or provisioning promise follows.

Deliberately absent are the Task3 independent expiry-enforcement, physical-capacity, cross-user and related adversarial review/probes. Selected functional successes, service attestations and catalog parity do not supply those guarantees. Preserve that gap through final review and release decisions. Unknown legacy full recapture, actual runtime compatibility, sustained source coverage, physical runway, production17.6/TLS, archive destination/IAM/retention and cost/load remain explicit gates or functional limitations.


Final composition migration `2026-10-08-10-lifecycle-composition.sql` adds compact
service-only demand observation and suspicious-empty follow-up fields. Neither the
private demand UUID nor follow-up bookkeeping enters public archive/anonymous
projections. After two suspicious-empty turns, schedule at most three deterministic
existing-open exact-coordinate checks per source per 24 hours, sharing the original
board request/time budget. Logs and `followup_status` request migration review;
failed/malformed/missing details remain unknown and do not close postings. These
diagnostics do not infer migration links or reactivate excluded boards.

With retirement explicitly enabled and dry-run disabled, prospective replacement
can compact at most 12 archived version/edge row effects per admitted posting;
25-posting admission remains within 500 row effects. Maintenance independently
retires eligible superseded versions/edges, including the oldest at current plus
ten. Exact version/hash and current edge-head acknowledgement are required; any
private/cache reference, missing proof or pending event retains the needed row.
Replacement establishes its current public location edge before compacting the
superseded edge. Compact archive coverage/heads remain; no false relation-removal
event or physical space credit is produced.

Temporary terminal demand bodies/receipts become eligible seven days after the
latest settlement or actual consumption, after application of consumption receipts
and expiry of a short handoff pin. Durable private snapshots and active generation
remain protected. Actual review batches renew exact input pins every 30 seconds;
ready-input handoff pins last 180 seconds. Detail use means successful authenticated
ready payload delivery (which may be delivered but not seen), using its exact
receipt/input tuple. Queue/status-only helper reads do not count as use. When an
origin receipt is gone, retained package input uses the existing genuine new
private-copy capture; historical provenance is not reconstructed.

Demand and dashboard producers finalize only after their result transactions and
optional cache writes have committed/rolled back. Maintenance performs bounded
committed-only completion for transaction-specific public writers, review writers,
dashboard leftovers and terminal demand recovery; unresolved held reservations
remain. Demand recovery waits the original final-write window before finalizing.
Seven-day detail cleanup retains compact claim generations/replay floors. None of
these local functional changes supplies the deliberately omitted Task3 assurance,
production activation, live destination proof, or physical-reclamation evidence.
