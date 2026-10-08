# Recovered approved lifecycle requirements

Recovered 2026-10-07 through supported Library full read. Original source Git objects are unavailable; this is document text, not byte-identical original Markdown. Historical pending-approval labels are superseded by explicit owner implementation/reconstruction authorization in the conversation. No old implementation or test result is current evidence.

<PARSED TEXT FOR PAGE: 1 / 15>
Page 1
Job lifecycle and public event archive 
implementation plan
Reviewed plan pending owner confirmation
This plan sequences the approved retention design into 13 implementation tasks, with explicit test 
evidence, independent review checkpoints and separate production authorization gates. It is ready for 
Andrew’s plan review and confirmation of the execution method.
Status: The amended plan has passed independent requirements and security review. The tasks, tests
and commits below are planned work; this document does not report implementation or test completion.
Review summary
 Confirm the concrete task plan and the proposed execution method: a fresh implementer and an 
independent reviewer for each task, plus focused and whole-branch reviews.
 Tasks 1 to 9 deliver current-state lifecycle behavior. Tasks 10 to 12 add the public event archive. 
Task 13 verifies their integration and rollout evidence.
 The binding review amendments come first. They establish early service-owned controls and 
snapshot prerequisites, staged enforcement, real database security and crash tests, cleanup and 
scheduling proofs, and PostgreSQL 17 parity alongside PostgreSQL 16 coverage.
 Production migrations, writes, archive destination configuration, S3 or IAM provisioning, deletion, 
deployment, merge, publication and paid calls require the authorization described in the plan.
Source and approval basis
Amended plan commit: 654019765b6f4b60bf156d0a11cb0373f9f17520
Approved architecture commit: badd19b5f85eb693673a770e93b5a4f97d086e2e
Production and main reference: 114cce96cb244546864a6bddc5476b5630bc024a
Architecture approval is complete. The amended plan and execution method remain pending owner 
confirmation.
<PARSED TEXT FOR PAGE: 2 / 15>
Page 2
Binding plan review amendments
These requirements apply to Tasks 1 to 13 and take precedence over shorthand in the full task plan 
that follows.
These narrow sequencing/test requirements override any shorthand above; they do not change the 
approved architecture. Every intermediate commit must retain a tested flag-off legacy path and tests for 
stale/legacy writer behavior. New enforcement is exercised in isolated DBs; production enabling 
remains separately authorized.
Flags precede triggers for Tasks 2 and 3
Tasks2–3: flags precede triggers. Task2's 2026-10-03-01-lifecycle-core.sql creates a service￾only lifecycle_control row with versioned flags, safety_stage (legacy/collect/enforced), durable 
archive_ever_activated, archive_stage (never_activated/active/producer_paused), export_enabled 
and activation_generation. job_discovery/lifecycle/config.py owns read_control(conn)-
>LifecycleControl; Task3 adds 
transition_control(conn,expected_generation:int,target:LifecycleControl,claim:ClaimRef)-
>LifecycleControl, validating transitions under the gate. Client roles have no control-table writes; 
callers cannot override it through GUCs. archive_ever_activated is monotonic and cannot be cleared 
by disable/rollback. Never-activated permits ordinary lifecycle writes; active requires matching outbox 
events; producer_paused blocks eventful writes even from direct DML; export-only pause leaves 
producers subject to budget and retains pending events.
Activation requires destination validation AND compatible producer/writer readiness, not merely 
export_enabled=true. Task10 consumes this established state rather than adding an independent 
boolean bypass.
Early snapshots and staged enforcement for Tasks 2 and 3 and 8
Tasks2–3/8: early snapshot prerequisites and staged enforcement. Move all required nullable job￾version references, description/question snapshot fields and validity constraints for 
approvals/corrections/packages/active demand into Task2's additive migration/schema.sql; never 
fabricate legacy version/use history. Task3 installs the global BEFORE STATEMENT gate immediately,
but version/capacity row enforcement remains guarded by service-owned safety_stage until compatible 
writers and backfills are ready. Only explicit transition to enforced activates those checks; Task4 
retirement stays dry-run while readiness is incomplete. Task8 migration03 validates/records writer 
readiness over existing prerequisite columns.
Before cutover legacy writers remain compatible; after cutover stale legacy growth/eventful/protection 
writes lacking required reservations/events/versions fail closed without data loss. New writers must 
work with controls off, collect and enforced; rollback cannot restore unsafe prune/refill consumers.
Activation and helper database tests for Tasks 3 and 10
Tasks3/10: activation and helper database tests. Add tests/test_lifecycle_activation.py and 
extend real two-session safety/outbox tests. Assert never-activated ordinary writes work; enable -> 
producer-disable -> direct eventful DML and stale legacy writer fail; export-only pause keeps exact 
events pending and producers stop at budget; caller-set GUC cannot disable active/paused 
enforcement. Exercise every intermediate flag-off schema with representative legacy upsert, approval, 
prepare, generation and account-cascade statements. Test private helper EXECUTE is denied to 
PUBLIC/anon/authenticated; trigger invocation still enforces original statement RLS.
<PARSED TEXT FOR PAGE: 3 / 15>
Page 3
Verify actual invoking role/JWT/owner-bound claim, not SECURITY DEFINER owner identity, 
determines validation: valid token for another user/job/claim is rejected, forged GUC/identity cannot 
acquire privileges, and own valid no-growth protection remains supported. A privileged helper must not 
perform user/job DML. Check grants through catalog inspection AND attempted calls, with independent 
Checkpoint A/D review.
Bounded cleanup and fairness proofs for Tasks 4 and 6
Tasks4/6: bounded cleanup and fairness proofs. Task4 real DB tests exercise completed staging 
deletion only after fully committed reconciliation and24h, abandoned staging fencing/replay-floor 
advance at7d, bounded2,000/20,000 cleanup and stale enumeration/claim/reservation callbacks after 
cleanup; no lost counter/miss evidence or reservation resurrection. Task6 adds deterministic scheduler 
tests with one huge board, several small boards across ATS families, repeated exhausted request/time 
budgets and interruptions: persisted cursor/oldest-verification ordering gives every due board a turn, 
resumed unsafe partial feeds never certify absence, and progress/checkpoint commits survive worker 
restart.
Record finite fixture-cycle bound and prove small boards are not starved, rather than relying on one 
healthy poll.
Persisted crash recovery for Task 11
Task11: persisted crash recovery, not mock-only orchestration. Seal/upload/manifest/verify/ack 
fault tests MUST use isolated PostgreSQL plus fake S3. At each boundary terminate/discard worker 
AND database connection, then resume with a fresh worker/connection from persisted rows. Assert 
exact membership/seal survives, pending events are retained, stale owner cannot ack, and only verified
exact IDs are cleaned; include data-only upload, ambiguous success and corrupt manifest. Advance 
DB-clock fixture between verify/ack across eligible_until; ack fails and no pending cleanup occurs.
Expired replacement without valid explicit authorization fails; authorized replacement preserves 
IDs/hashes/times and rejects old callbacks. Use local test-time injection in the test harness, never a 
production caller-controlled clock/GUC bypass.
PostgreSQL 17 parity for Tasks 1 and 13
Tasks1/13: PostgreSQL17 parity. Preserve existing CI postgres16 job and add a PostgreSQL17 
migration/RLS/concurrency lane using the same harness and tests; production was previously 
verified17.6. Run python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest
tests/test_lifecycle_migrations.py tests/test_lifecycle_safety.py 
tests/test_lifecycle_activation.py tests/test_archive_outbox.py 
tests/test_archive_retention_recovery.py -q, then the same command with --postgres-major 
16. Record actual server versions and no skipped DB tests. New dashboard DB tests also run 
against17. A16-only run is compatibility evidence, never production parity proof; unavailable17 
verification is an explicit readiness blocker/gap, not silently omitted.
<PARSED TEXT FOR PAGE: 4 / 15>
Page 4
Full task plan
The five review replacements are incorporated below. Read every task together with the binding 
amendments.
Goal: Implement bounded discovery/maintenance with preserved private history and a small public￾event outbox exporting to S3.
Architecture: Existing PostgreSQL current state remains authoritative; additive 
SourceListing/JobVersion mappings separate public source identity from private Job anchors. Short 
gated transactions own claims, protections, reservations and public outbox events; independent 
maintenance and archive children share the existing reviewer supervisor. Current application flows 
never depend on replay.
Tech Stack: Python >=3.12, psycopg 3, existing ATS adapters, isolated PostgreSQL 17 verification 
(production previously verified 17.6) plus preserved PostgreSQL 16 CI coverage, 
Next.js/TypeScript/postgres.js, pytest/Vitest; boto3 only for the bounded exporter.
Approved architecture: Owner-approved commit badd19b5f85eb693673a770e93b5a4f97d086e2e. 
Independent requirements and security review of this amended plan is complete. Owner confirmation of
this plan and its execution method is pending before product changes.
Global Constraints
 Preserve existing Job IDs/private FKs, legacy timestamps and RLS. Additive migrations only; never 
rewrite commits. Production/main reference is 114cce96cb244546864a6bddc5476b5630bc024a. 
Before execution verify upstream and review any newer delta without resetting documentation 
commits.
 No production migrations/writes, S3/IAM provisioning, deletion, deployment, merge or paid calls 
under this plan alone. Local isolated DB tests and offline SDK doubles are permitted. Destination 
configuration/activation is a later authorization gate, not an implementation blocker.
 Daily discovery cron remains 0 0 * * * UTC and one-shot. Maintenance startup/every15min, 
supervisor check <=5s, maintenance deadline90s/lease120s/renew<=30s, lock2s/statement5s, 
SIGTERM drain30s. Export tick60s/deadline120s/lease180s.
 Same global transaction advisory gate before relevant row/FK locks; sorted job keys next. No 
HTTP/model/S3/sleep inside transactions. Claims owner-bound, version-fenced, DB-time checked; 
board/demand lease180s/renew<=30s.
 Physical guard remains 6000 MiB (pg_database_size/1024^2), <=500-row admission/reconciliation 
chunks, maintenance batch/cap2,000/20,000. Reservations include all writers; DELETE never 
supplies physical credit.
 Complete misses require two distinct successful enumerations >=24h apart. 
Partial/failing/suspicious-empty feeds never prove absence; empty with >20 prior open jobs is 
suspicious. Verify enabled sources24h, failure-disabled retries24h..7d, deliberate exclusions stay 
excluded.
 Frozen feed anchor expires after30 elapsed UTC days. Lean identity indefinite; 
descriptions30d/questions7d from COALESCE(last_used,captured). Legacy populated caches 
capture migration activation with provenance, never invented use. Protect 
approvals/corrections/packages/scores/edits and active generation/review leases across all users.
 Public fetch deadline20s/redirects<=3/decompressed<=10MiB; each redirect/address revalidated, no
forwarded credentials. Total JSON parsers, no zod or unvalidated boundary casts.
<PARSED TEXT FOR PAGE: 5 / 15>
Page 5
 Public event body<=8KiB; no per-unchanged-poll events. Batch<=2,000 events/8MiB expanded, 
oldest flush5min; deterministic JSONL/gzip, exact-ID ack, no sequence<=max deletion. 
Verification<=16MiB compressed/8MiB expanded/1MiB manifest.
 Outbox warning64MiB/50,000 events/age15min; ordinary pause112MiB/87,500; 
hard128MiB/100,000. Reserve16MiB AND12,500 slots for closure/reopen. Pending events/seals 
never TTL-delete. Seven-day terminal state, compact replay/fence markers survive.
 Current plus<=10 superseded public versions/listing within30d only after safe archival. Archive 
horizon730d from persisted seal; raw content archive disabled (90d only if separately approved). 
Expired pending seals fail closed, authorized replacement preserves event identity/time. Replay 
terminal retention gaps cannot invent history or resurrect suppression.
 Flags default off, payload retirement dry-run, archive producer/export disabled without validated 
approved destination. Existing legacy destructive prune must never run alongside new identity￾preserving maintenance after cutover. No automatic graph merges/Kafka/graph engine/paid 
extraction.
Review Focus
1. Partial source progress followed by rollback: committed sightings survive but no absence proof 
(Task6).
2. Direct SQL/account cascade takes implicit FK locks: global gate must precede them and preserve 
tenant isolation (Task3).
3. Pending prepare succeeds without JD/version: protect pending work but never report usable output 
or spend on JD-blind generation (Task8).
4. Lower sequence commits after batch selection: exact acknowledgement leaves it pending (Task10).
5. Baseline expires while later revision remains, or seal outlives horizon: bounded incomplete replay 
and fail-closed pending retention (Tasks11–12).
Sequence ownership and evidence
Execute Tasks1–9 as the current-state lifecycle deliverable; Tasks10–12 add the archive deliverable, 
Task13 verifies their integration. Archive mode stays off until the explicit destination gate. No parallel 
edits to shared schema/contracts; independent review can run while unrelated tests execute. Every task
uses red test -> observed expected failure -> minimal implementation -> green test -> forward commit 
-> fresh independent requirements/code review before a dependent task starts; checkpoints A–E add 
focused security/adversarial review.
Record exact commands/results/commit in the runbook evidence table, not just a checklist claim. A 
missing DB, skipped concurrency test or mock-only RLS proof is a blocker, not a pass. Fresh reviewers 
do not review code they authored. Independent reviewers are coordinated throughout execution. The 
owner confirms the concrete plan and execution method, preserving the independent-review 
requirement.
File and interface boundaries
Use focused modules under job_discovery/lifecycle/ (config/types/db 
locks/claims/capacity/identity/maintenance/reconcile/demand) and job_discovery/archive/
(types/schema/outbox/batches/codec/s3/export/replay). Add these packages to pyproject setuptools 
registration; leave existing adapter/reviewer/dashboard responsibilities intact. Shared SQL lives in 
<PARSED TEXT FOR PAGE: 6 / 15>
Page 6
ordered additive migrations and matching schema.sql definitions, not divergent Python/TS schemas. 
New dashboard module lib/jobLifecycle.ts owns total parsing, demand/protection helpers and feed 
semantics; keep owner-scoped existing DB wrappers.
Core types in lifecycle/types.py: 
ClaimRef(owner_token:str,generation:int,lease_until:datetime), 
ReservationRef(id:UUID,claim:ClaimRef,bytes:int), 
EnumerationRef(id:UUID,source_id:UUID,sequence:int,claim:ClaimRef), 
Observation(id:str,listing_id:UUID,kind:str,observed_at:datetime), 
DemandRef(id:UUID,job_id:str,kind:str,claim:ClaimRef|None,status:str), 
SweepResult(retired_rows:int,retired_bytes:int,blocked:bool,cursor:str|None). 
Archive/types.py owns EventRef, BatchRef, SealedBatch, VerifiedBatch, AckResult, 
ProjectionResult, with exact fields defined in Task10. Database times are timezone-aware; no client￾time lease decisions.
Task 1 Isolated migration and concurrency harness
Files: Create tools/lifecycle_test_db.py, tests/lifecycle_helpers.py, 
tests/test_lifecycle_test_db.py, tests/test_lifecycle_migrations.py; modify 
tests/conftest.py, .github/workflows/ci.yml only as needed to keep DB checks mandatory.
Interfaces: isolated_database(command:list[str],postgres_major:int=17)->int provisions local 
postgres:17 or postgres:16 and passes TEST_DATABASE_URL; CLI --postgres-major 17|16 selects
the image. validate_test_dsn(dsn:str)->None rejects unsafe targets before any DDL; 
open_sessions(dsn:str,count:int)->list[Connection] connects to the SAME throwaway schema; 
apply_migrations(conn,paths:list[Path])->None. Sessions synchronize with threading 
Events/barriers, never sleep-based race guesses.
1. Write tests: validate_test_dsn rejects production/nonlocal DSNs before DROP SCHEMA; bootstrap 
schema and same-cluster authenticated/anon roles; independent sessions share seeded rows. 
Assert len(sessions) == 2 and authenticated foreign-user row count0; Supabase project host 
raises ValueError. Permit only localhost and database poller_test/poller_lifecycle_test; 
missing DSN uses owned Docker container, no ambient DATABASE_URL fallback.
2. Run python -m pytest tests/test_lifecycle_test_db.py -q; observe failure for absent harness.
3. Implement harness with loopback-only random published port, locally generated test password, 
bounded readiness, subprocess timeout and finally cleanup of ONLY owned container. Set BOTH 
TEST_DATABASE_URL and child DATABASE_URL to this isolated DSN; remove live 
model/tracing/AWS credentials and inject test placeholders/doubles so tests cannot fall back to 
production. Reuse existing CI postgres:16/55432/poller_test; new required test entry refuses skipped
integration tests. Migration tests compare clean schema.sql to sequential migrations on the pre￾change schema and rerun using existing schema_migrations conventions; 
table/constraint/index/grant parity is required.
4. Run python tools/lifecycle_test_db.py -- python -m pytest tests/test_rls_isolation.py 
tests/test_lifecycle_test_db.py -q; all assertions pass and no integration skips. Commit test: 
add isolated lifecycle database harness.
<PARSED TEXT FOR PAGE: 7 / 15>
Page 7
Task 2 Additive identity and lifecycle schema and compatibility mapping
Files: Create migrations/2026-10-03-01-lifecycle-core.sql, 
job_discovery/lifecycle/{__init__,types,config,identity}.py, 
tests/test_lifecycle_identity.py; modify schema.sql, pyproject.toml, 
tests/test_lifecycle_migrations.py.
Interfaces: migrate_identity_batch(conn,limit:int=500)->int; 
choose_anchor(published_at:datetime|None,discovered_at:datetime,now:datetime)-
>tuple[datetime,str]; 
capture_version(conn,listing_id:UUID,metadata:dict,observed_at:datetime,claim:ClaimRef)-
>UUID|None. Last interface is flag-off until gated/outbox contracts exist.
1. Write migration/identity tests asserting preserved Job IDs/FKs/first_seen, frozen legacy local 
anchors, counter0/last-observedNULL, cache migration captured activation/last-usedNULL, UTC30d 
boundary, future-date fallback, identical hash creates no version, same ID cannot reset age. 
Migration rerun does not reset fields; batched restart completes exactly once.
2. Run python tools/lifecycle_test_db.py -- python -m pytest 
tests/test_lifecycle_migrations.py tests/test_lifecycle_identity.py -q; confirm missing 
new schema/functions fail.
3. Add source_accounts/source_listings, compact job_versions, brands/skills and typed 
company/brand/source/job-skill/job-location relationships plus reviewed identity_assertions. UUID 
new public IDs, existing company INT/Job TEXT stable. Reuse existing locations(raw TEXT 
PK,canonicals,components): job_locations.location_id TEXT REFERENCES locations(raw), no 
invented UUID canonical table or new LLM resolver. Empty brand/skill evidence is valid. Add 
lifecycle/cache/provenance/claim/revision fields and indexes; no baseline history fabricated. New 
service tables RLS enabled with no client write grants; publish only needed shared current-state 
views later. Migration DDL does not run whole-corpus data updates: mapping/backfill is bounded 
explicit command.
4. Repeat targeted tests and python -m pytest tests/test_schema.py 
tests/test_company_schema.py tests/test_locations_schema.py -q. Commit feat: add 
additive source listing lifecycle identities.
Task 3 Pre DML gate fenced claims protections and capacity
Files: Create migrations/2026-10-03-02-lifecycle-safety.sql, 
job_discovery/lifecycle/{locks,claims,capacity}.py, dashboard/lib/jobLifecycle.ts, 
tests/test_lifecycle_safety.py, dashboard/lib/jobLifecycle.db.test.ts; modify schema.sql, 
dashboard/lib/db.ts, dashboard/lib/generationJobs.ts, dashboard/lib/accountDeletion.ts and 
existing job/protection mutators identified by FK inventory.
Interfaces: enter_gate(conn)->None; claim_work(conn,kind:str,id:str,lease_seconds:int)-
>ClaimRef|None; validate_claim(conn,claim:ClaimRef)->None; 
reserve_capacity(conn,claim:ClaimRef,bytes:int,critical:bool=False)->ReservationRef|None;
settle_capacity(conn,reservation:ReservationRef)->None. TS 
acquireLifecycleGate(tx):Promise<void> and 
withJobProtection(tx,jobId,versionId,operation):Promise<T> must acquire before row/FK locks; 
claim/protection queue is owner scoped.
1. Write real two-session tests: A approval/B prune in both orders, opposite-order multi-job DML, root 
account cascades, RLS foreign-user rejection, two concurrent reservations cannot oversubscribe, 
<PARSED TEXT FOR PAGE: 8 / 15>
Page 8
expired claim cannot commit, crash-release only after fencing. Assert shared JD/private snapshots 
survive and growth_without_reservation raises. Test zero-byte authenticated protection still 
succeeds.
2. Run harness on tests/test_lifecycle_safety.py; observe absent safety contract failures.
3. Add source_enumerations/enumeration_members/reconciliation_checkpoints, 
lifecycle_claims/capacity_reservations and owner-scoped job_payload_demands tables with 
generation/replay-floor/terminal-time indexes. Implement ONE transaction advisory gate acquired by 
BEFORE STATEMENT triggers on Jobs, source listings/versions/typed evidence tables, seven job￾linked children, claims/reservations/staging and every cascade root from catalog inventory. Services 
acquire first, then sorted job keys, then rows; read-only dashboard transactions need no global gate. 
Enforce timeouts, active demands, version-ready snapshots and owner-bound capacity; narrowly 
scoped private claim-read helper only if necessary, fixed search_path/no public EXECUTE/no 
privileged user DML. Revoke no required existing shared reads; expose no service claim writes to 
clients. Test inventory prevents missing new mutation path. Record 
approved/package/correction/scores/edits/generation root paths and actual grants.
4. Run python tools/lifecycle_test_db.py -- python -m pytest 
tests/test_lifecycle_safety.py tests/test_rls_isolation.py -q and python 
tools/lifecycle_test_db.py -- npm --prefix dashboard test -- 
lib/jobLifecycle.db.test.ts; both pass without integration skips. Commit feat: enforce fenced
lifecycle protection and capacity gates. Checkpoint A: independent 
security/tenant/concurrency review before retirement or source cutover uses this contract.
Task 4 Bounded global maintenance before additions
Files: Create job_discovery/lifecycle/maintenance.py, tests/test_lifecycle_maintenance.py; 
modify job_discovery/prune.py, job_discovery/run.py, tests/test_prune.py, 
tests/test_size_guard.py, tests/test_run.py.
Interfaces: sweep(conn,claim:ClaimRef,dry_run:bool=True,max_rows:int=20000)->SweepResult; 
pre_admission_maintenance(dsn:str|None)->SweepResult. Retire payloads, never Job identity or 
user work.
1. Write tests asserting call order maintenance < capacity < upsert, including poll-lock held, no 
targets, failed guard, above guard, poll exception/reconnect and user inactivity. Assert global 
unprotected cache expiry30d/7d, never-used expiry, pending lease exclusion, NULL-payload 
handling, batch2000/cap20000/deadline90s and persisted fairness cursor. No source sightings reset 
TTL. Install raising hooks for LLM/notifications/external writes.
2. Run harness tests/test_lifecycle_maintenance.py plus existing prune/guard/run tests; observe 
current end-of-cycle/delete behavior failures.
3. Implement independent bounded sweep before target loading/poll lock; failed safety sweep blocks 
admission but permits verification. Under gate recheck protections/demands and retire 
descriptions/questions/eligible archived superseded versions; maintain identities. Flag-off preserves 
current path until reviewed cutover; enabling new maintenance disables old DELETE prune path 
atomically. Clean temporary state7d/completed staging24h only after fencing/replay-floor advance; 
unresolved reservations block growth rather than age out. Emit measured physical/reusable/live 
metrics; two guard-active scheduled sweeps mark action-needed, no VACUUM FULL/notifications.
4. Repeat tests; commit feat: run bounded identity-preserving maintenance before admission.
<PARSED TEXT FOR PAGE: 9 / 15>
Page 9
Task 5 Supervisor independent of reviewer and discovery
Files: Create reviewer/supervisor.py, job_discovery/lifecycle/worker.py, 
tests/test_lifecycle_supervisor.py; modify railway.reviewer-worker.json, reviewer/worker.py
only for bounded drain integration; preserve railway.json/job_discovery/__main__.py semantics.
Interfaces: supervise(stop:Event,spawn:Callable,clock:Callable)->int; 
run_maintenance_once(dsn:str|None)->SweepResult. Export child is registered in Task11, disabled 
by default.
1. Write process tests with controlled fake/real children: stalled reviewer and terminating cron do not 
block startup/15min maintenance; renew30s/deadline90s/lease120s; child restart and SIGTERM30s 
leave stale generations unable to commit; preserve ON_FAILURE/100 retries and daily cron. Assert 
no indefinite join.
2. Run python -m pytest tests/test_lifecycle_supervisor.py tests/test_reviewer_worker.py 
-q; expected missing supervisor failure.
3. Implement <=5s scheduler checks with monotonic process deadlines, database lease fencing, 
separate child termination/restart, bounded shutdown. Update reviewer startCommand only; 
measure test CPU/memory/connections rather than claim cost neutrality.
4. Repeat tests and DB lease recovery tests; commit feat: supervise maintenance independently 
of review progress.
Task 6 Fair source reconciliation across all six ATS families
Files: Create job_discovery/lifecycle/reconcile.py, tests/test_lifecycle_reconcile.py; 
modify job_discovery/run.py, job_discovery/db.py, 
job_discovery/adapters/{completeness,__init__,greenhouse,lever,ashby,workable,smartrecru
iters,workday}.py, existing source-completeness/adapter tests.
Interfaces: claim_due_source(conn)->tuple[dict,ClaimRef]|None; 
begin_enumeration(conn,source_id:UUID,claim:ClaimRef)->EnumerationRef; 
commit_sightings(conn,enumeration:EnumerationRef,observations:list[Observation])->None; 
complete_enumeration(conn,enumeration:EnumerationRef,verdict:SourceStatus)->None; 
reconcile_chunk(conn,enumeration:EnumerationRef,limit:int=500)->bool. Every adapter returns 
SourceResult whose completion is explicit after exhaustion.
1. Write fixtures for each ATS: healthy multi-page, duplicate/page wrap, changed totals, cap, failed final 
page, complete empty and suspicious >20 empty, direct-link Ashby isListed=false and republished 
publishedAt. Assert two misses exactly24h close; partial misses never close; newer sightings win 
older absence; enumeration replay increments once; partial committed positives survive later source 
failure. Missing/unlisted != closed.
2. Run harness tests/test_lifecycle_reconcile.py and all six adapter/source-completeness tests; 
confirm absent fenced reconciliation fails.
3. Replace whole-company transaction/set assumptions with bounded staging and atomic <=500-row 
checkpoints. Renew while progressing, fence stale completions/reconnects, fair 
oldest-verification/cursor scheduling, bounded board budgets; unsafe resumed pagination restarts 
enumeration. Retry failure-disabled sources24h..7d, preserve deliberate exclusions, verify above 
guard with no detail/enrichment/growth; record attempted/success/partial health independently of 
user matching. Explicit removed evidence closes only exact source identity. Existing APIs/models 
remain compatible behind flags.
<PARSED TEXT FOR PAGE: 10 / 15>
Page 10
4. Repeat tests; commit feat: reconcile complete source evidence with fair fenced 
scheduling. Checkpoint B: independent source/lifecycle adversarial review, including partial-feed 
and old-ID reappearance cases.
Task 7 Lean admission and meaningful public versions
Files: Modify job_discovery/lifecycle/identity.py, job_discovery/db.py, job_discovery/run.py;
create tests/test_lifecycle_admission.py, tests/test_lifecycle_relations.py.
Interfaces:
admit_metadata(conn,source_id:UUID,postings:list[Posting],claim:ClaimRef,reservation:Res
ervationRef)->int; set_identity_assertion(conn,assertion:dict,claim:ClaimRef)->UUID. Both 
use Task3 safety; public changes join Task10 outbox contract once enabled.
1. Write tests asserting stable Job/source external IDs, <=500 chunks/per-chunk capacity, no same-ID 
age reset/refill, no automatic title/name merge or transitive weak links, invalid/conflicting/cyclic 
accepted identity rejection, private history unchanged, content-hash normalization and <=10 
superseded versions with archive prerequisite. Test edge validity unknown remains NULL and no 
private provenance/skill extraction.
2. Run harness admission/relations tests; observe missing behavior failures.
3. Implement lean metadata-only admission and typed public evidence relations; use source listing 
revision for versions, preserving Job anchor/private FKs. Source payload may be received but must 
not persist all descriptions. Current+superseded bounds cannot discard unarchived evidence; pause 
growth. Respect actual physical guard/reservations even when reused pages exist. Remove routine 
Greenhouse backfill invocation and automatic detail fetches used only to persist unused payload; 
retain reusable parsers/details for demand.
4. Repeat tests plus tests/test_run_question_fetch.py; commit feat: admit lean listings 
without passive payload refill.
Task 8 Demand hydration and immutable private snapshots
Files: Create job_discovery/lifecycle/demand.py, tests/test_lifecycle_demand.py, 
dashboard/lib/jobLifecycle.test.ts; modify reviewer/{db,run,worker}.py, 
job_discovery/http.py, dashboard/lib/jobLifecycle.ts, 
dashboard/lib/{queries,generationJobs,reviewRequests}.ts, 
dashboard/app/api/{application/prepare,review/request,jobs/[id],cover-letter}/route.ts, 
dashboard/app/actions/{jobs,corrections,applications,resumeScores,coverLetterEdits}.ts
and their existing tests.
Interfaces: hydrate_demand(conn,demand:DemandRef,fetch:Callable)->str returns 
pending/ready/deferred, never success without version; 
hydrate_candidates(conn,job_ids:list[str],user_id:str)->list[str] returns ready subset. TS 
requestJobPayload(userId,jobId,kind):Promise<DemandResult> and 
consumeJobVersion(tx,jobId,versionId,kind):Promise<void> establish owner-scoped pending 
demand/version lease and actual-use stamp.
1. Write tests: deterministic candidate filtering before hydration/model; JD absent/fetch failure defers 
with zero model calls; direct older-live demand permitted, automatic expired match excluded; 
coalesced requests/stale completion/cancel cannot overwrite; ready requires exact durable version. 
Captured/used TTL30d/7d stamps only successful consumption; protected snapshots survive 
version change/retirement. Authenticated users cannot write shared cache/service claims or another 
<PARSED TEXT FOR PAGE: 11 / 15>
Page 11
user's demand. HTTP tests cover private redirect, rebinding validation, max3 redirects/20s/10MiB, 
credential stripping/type limits.
2. Run harness demand tests, existing reviewer tests and targeted route Vitest tests; confirm missing 
lease/hydration contract fails.
3. Implement service worker hydration using validated stored ATS coordinates; direct detail endpoint 
where supported, bounded matching within current source feed where no exact-detail GET exists. 
No application/form submissions. Renew fenced demand, reserve capacity before cache/snapshot 
growth, release gate during network, retry under gate/version check; persist public question schema 
separately from owner answers. Prepare can expose protective pending status until ready, never 
produce JD-blind package. Consume Task2's existing additive version/snapshot columns; 
migrations/2026-10-03-03-lifecycle-snapshots.sql is a guarded writer-readiness/validation 
migration, not prerequisite-column creation. Preserve protected shared payload this rollout. 
Dashboard reads JSON as unknown with total parsers.
4. Repeat DB/two-user and route tests; commit feat: hydrate demanded job versions before 
review and preparation. Checkpoint C: fresh reviewer checks snapshot/protection races, 
entitlements and no new privileged shared writes.
Task 9 Feed semantics and complete consumer cutover
Files: Modify dashboard/lib/{filters,jobsQuery,queries,types}.ts, 
dashboard/lib/rolefit/{boardFilters,filter}.ts, dashboard/app/board/page.tsx, 
dashboard/components/rolefit/RolefitBoard.tsx, dashboard/app/api/jobs/[id]/route.ts, 
dashboard/lib/jobLifecycle.ts, reviewer/db.py; create 
dashboard/lib/jobLifecycleConsumers.test.ts, extend existing board/filter/query/UI tests.
Interfaces: parseJobLifecycle(raw:unknown):JobLifecycle|null; 
discoveryPredicate(includeOlderLive:boolean):SqlFragment, reused by counts/rows/page 
boundaries and reviewer semantics. Existing private history queries remain owner scoped and 
independent of discovery horizon.
1. Write tests: exact UTC30d expiry, explicit Include older live jobs, source unknown/closed distinct, 
open+expired+retired legitimate, protected approved/corrected/prepared/applied history visible, 
counts/pagination agree, double-encoded/malformed legacy JSON never crashes. Assert flag 
rollback cannot reset dates/refill caches/reopen proven closures.
2. Run targeted Vitest query/filter/consumer tests and pytest reviewer candidate tests; expected missing
lifecycle fields/predicate failure.
3. Audit with rg 'first_seen|last_seen|closed_at|description_pruned' reviewer dashboard 
job_discovery; inventory every returned consumer in runbook and update relevant 
detail/application/analytics/count/sort predicates. New semantics behind flags, total parsers; no 
favorites feature. Label expiry without claiming employer closure. Keep legacy timestamps readable 
and document safe coexisting consumer versions.
4. Run dashboard test/typecheck/lint and public board browser verification against local fake data, no 
production auth; commit feat: separate discovery expiry from availability and history.
<PARSED TEXT FOR PAGE: 12 / 15>
Page 12
Task 10 Transactional public outbox deterministic seal and exact acknowledgement
Files: Create migrations/2026-10-03-04-public-outbox.sql, 
job_discovery/archive/{__init__,types,schema,outbox,batches,codec}.py, 
tests/test_archive_outbox.py, tests/test_archive_batches.py, tests/test_archive_codec.py; 
modify schema.sql, pyproject.toml, lifecycle identity/reconcile/capacity modules.
Interfaces: record_public_change(tx,change:PublicChange,claim:ClaimRef)->EventRef; 
claim_batch(tx,limits:BatchLimits,claim:ClaimRef)->BatchRef; 
seal_batch(batch_ref:BatchRef,serializer_version:int)->SealedBatch; 
ack_batch(tx,verified_batch:VerifiedBatch,claim:ClaimRef)->AckResult. 
EventRef=(event_id,aggregate_type,aggregate_id,revision); 
BatchRef=(batch_id,claim,ordered_event_ids,serializer_version); SealedBatch additionally immutable 
keys/sealed_at/eligible_until/canonical+compressed+manifest hashes/counts/bytes; VerifiedBatch binds
same seal plus verification receipts; AckResult=(exact_event_ids,archived_revision_markers). 
Enums/total validators define <=8KiB PublicChange schema; UUID namespace constant produces 
kind/ID/revision IDs.
1. Write multi-session tests asserting state/outbox rollback together, direct eventful DML without 
matching event rejected at commit, revision/predecessor consistency, lower-sequence late commit 
left pending, exact partial membership, contiguous per-aggregate ordering, unchanged poll no event 
growth. Assert ordinary87,500/112MiB pause, critical12,500/16MiB reserve, hard100,000/128MiB, 
warning thresholds and no TTL deletion.
2. Run harness outbox/batch tests and codec tests; observe missing paired contract failures.
3. Add outbox/batch/items and compact archive markers with no pending cascades/client access; 
immutable sealed_at/eligible_until, manifest digest and prior-batch recovery reference are explicit 
columns. Service-owned DB flag controls enabled commit validation, not caller-set session bypass. 
Connect all meaningful public mutators under same gate; initial baseline is bounded/reserved and 
anchors replay, never historical reconstruction. Batch exact committed IDs, stable membership 
before deterministic UTF-8 sorted JSONL/gzip mtime0; <=2000/8MiB/5min. Serialize outside locks; 
seal exact data/manifest bytes before upload. Ack requires current fence, matching 
seal/membership, eligible unsuppressed data+manifest and DB time strictly before deadline; delete 
only exact ack IDs after durable receipt. Compact cleanup7d never evicts unverified state.
4. Repeat tests; commit feat: record bounded public events with exact batch acknowledgement.
Checkpoint D: fresh DB/archive/security review before exporter connects; include direct-DML 
enforcement and protection/capacity integration.
Task 11 Bounded S3 exporter and expired seal recovery
Files: Create job_discovery/archive/{s3,export}.py, reviewer/archive_worker.py, 
tests/test_archive_export.py, tests/test_archive_privacy.py, 
tests/test_archive_retention_recovery.py; modify reviewer/supervisor.py, requirements.txt, 
pyproject.toml to add boto3 with compatible tested version, archive configuration.
Interfaces: put_verify_batch(sealed_batch:SealedBatch,archive_client:ArchiveClient)-
>VerifiedBatch; ArchiveClient supplies conditional put/bounded read, fixed service destination only. 
export_once(dsn:str|None,client:ArchiveClient)->AckResult|None; 
replace_expired_batch(tx,batch_id:UUID,claim:ClaimRef,authorization:RecoveryAuthorizatio
n)->BatchRef preserves exact events and fences old batch. No exporter DeleteObject interface.
<PARSED TEXT FOR PAGE: 13 / 15>
Page 13
1. Write offline SDK-stub/fault tests for every crash boundary, exact retry keys/bytes, 412/ambiguous 
timeout, matching data/missing manifest, checksum/manifest/event digest mismatch, oversize/bomb,
wrong region/prefix, unexpected private fields/path injection, stale lease. Assert no 
secrets/body/signed URLs logged and no IAM/bucket mutations. Disable IMDS in tests and inject 
client; never ambient AWS credentials.
2. Run python -m pytest tests/test_archive_export.py tests/test_archive_privacy.py -q and 
harness retention recovery; observe absent exporter failures.
3. Implement reused explicit-timeout/retry boto3 client, conditional PutObject If-None-Match, bounded 
streaming Get/checksum/read-close and sealed manifest; no HEAD-then-overwrite/ETag 
assumption. Separate supervisor child60s/deadline120s/lease180s with bounded shutdown. 
Destination validation (private/encrypted/configured policy) is required before enabling flags; do not 
provision or access real bucket now. SDK doubles verify request contract; real approved destination 
read/write validation awaits authorization. Retention-expired pending batches stop expired-key 
retries/ack, retain pending rows and expose action-needed; ONLY authorized replacement 
atomically transfers identical IDs/bodies/revisions into new opaque seal/key window, preserves 
observed/recorded times, marks old fenced/superseded, rejects stale callbacks. Old partial uploads 
are never deleted by worker. Enforce outbox backpressure and unknown/degraded availability at 
exhausted reserve, fresh recovery checks no invented gaps.
4. Repeat export/fault/multi-session recovery/supervisor tests; commit feat: export verified 
immutable public event batches to S3. Checkpoint E: fresh security/failure review; real 
destination activation remains blocked until configuration authorization.
Task 12 Bounded optional replay and expiry and suppression semantics
Files: Create job_discovery/archive/replay.py, tests/test_archive_replay.py; no user-facing 
graph/analytics product or production restore path.
Interfaces:
project_archive(manifests:Iterable[Manifest],policy:ProjectionPolicy,limits:ReplayLimits
)->ProjectionResult; result=(facts,coverage,gaps,retained_revision_ranges,errors), bounded 
max_events/max_bytes/deadline/depth. Inputs read-only approved public archive; output isolated 
file/test projection, not application DB mutation.
1. Write tests: ID+hash dedup/conflict, unknown schema, stale revision, missing predecessor bounded￾run unresolved gap; baseline expires while later event stays eligible -> terminal retention_gap and 
only schema-defined independent unsuppressed facts, no lifespan/derived relationships requiring 
prefix. Removed scopes never reconstruct; eligible-until enforced even if object physically exists. 
Assert zero review/generation/notification/paid/production-state calls.
2. Run python -m pytest tests/test_archive_replay.py -q; expected missing projector failure.
3. Implement bounded admin-only pure projection with explicit incomplete provenance, schema 
interpretable-fact allowlist and suppression/epoch precedence. Optional current-PG bootstrap is not 
implemented/required. Unknown coverage remains unknown; no automatic endless missing-prefix 
retries, automatic merges or current-state reopening. Projection excludes expired/removed inputs 
and invalidates derived facts; test current/noncurrent duplicate objects under authorized-removal 
markers. Parquet/graph engine not added.
4. Repeat tests; commit feat: project public archive with terminal retention gaps. Isolated 
PostgreSQL suppression/epoch markers are service-only and created with Task10 migration; 
<PARSED TEXT FOR PAGE: 14 / 15>
Page 14
removal command/lifecycle provisioning remains unimplemented until separately authorized. Tests 
seed authorized suppression records without performing object deletion.
Task 13 Integrated acceptance rollout evidence and final independent review
Files: Create tests/test_lifecycle_end_to_end.py, docs/runbooks/job-lifecycle-outbox.md; 
modify .github/workflows/ci.yml, README.md, lifecycle/archive config and dashboard lifecycle flags. 
No production activation.
Interfaces: Reuse Task2's service-owned feature flags and durable activation state; Task13 verifies 
rollout/rollback combinations rather than first introducing them. Defaults remain off/dry-run. Never￾activated archive permits ordinary lifecycle writes; after activation, pausing public_events stops paired 
eventful writes, while export-only pause retains events and admits producers only within backpressure. 
No client-supplied/session flag bypass or reset of activation history.
1. Write end-to-end isolated test: seed protected/private and unprotected corpus across six ATS 
fixtures, poll twice across24h, block size, run stalled reviewer+maintenance, hydrate demand, retire 
eligible cache, reobserve same ID, export using fake S3, replay after baseline expiry and expired￾seal recovery. Assert protected rows/snapshots unchanged, maintenance-before-addition, identity 
retained, no same-ID passive refill, complete misses only, exact event ack, rows/budgets bounded. 
Populate exact acceptance-to-test mapping for every approved spec clause.
2. Run harness end-to-end plus ALL pytest with integration required; ruff check .; dashboard npm 
test, npm run typecheck, npm run lint, npm run build using local test placeholders, no live 
API/auth calls. Changed feed controls get local browser/public visual verification with mocked data; 
existing approved auth harness only if already available/authorized. Record command 
exit/tests/skips and runtime metrics; do not call mock-only security tests sufficient.
3. Write runbook: additive migration order01..04, bounded identity/cache activation backfill, service 
grants inventory, collect-only->source->maintenance/capacity->demand->feed->dry-run retirement, 
separately validated approved archive path->event producers/export->archived version retirement, 
production authorization at each mutation/activation boundary. Audit flag combinations and 
incompatible legacy consumers; rollback never resumes destructive prune/unconditional refill, drops 
user snapshots or discards outbox. Health covers last sweep/guard/reusable allocation, source 
coverage/lag/fairness, demand/deferred/version, pending bytes/rows/age, export seal/ack/errors, 
retention-blocked/suppression gaps. No notifications/new infrastructure. Forecast lean/payload/event
bytes from scrubbed local fixtures; describe uncertainty, no invented deleted-population savings or 
provisioned-bill promise.
4. Independent whole-branch requirements, security/tenant/protection and adversarial reviewers 
compare implementation/test evidence to approved spec and plan. Fix blocking findings with 
regression tests/new commits; rerun affected checks. Commit test: verify lifecycle archive 
rollout and recovery contracts and return immutable final SHA/diff/evidence/blockers. Creating 
a reviewed branch/PR does not authorize publication, merge/deploy or production migrations; 
publication requires separate authorization.
<PARSED TEXT FOR PAGE: 15 / 15>
Page 15
Execution handoff
Recommended execution: subagent-driven, preserving the owner's request for independent reviewer 
agents. A fresh implementer and fresh reviewer handle each task; gate/RLS/identity/outbox checkpoints
add focused review before dependent tasks consume them, and whole-branch review closes the work. 
The owner confirms the concrete task plan and this execution method after independent plan review; 
architecture approval is already complete and independent review remains required. After that review, 
execute locally until tests/evidence are complete, then stop only at concrete production/configuration 
authorization gates.
Plan self review
Spec sections1–2 map to Tasks2/6/7; section3 to Tasks3–5; section4 to Tasks3/8; section5 to 
Tasks9/13; section6 to Tasks3/4/10/13; section7 to Tasks2/7; section8 to Tasks10–12. Retention-gap 
follow-up maps to Tasks11–12. Review Focus1..5 maps to explicit owning-task tests. Interfaces use the
same ClaimRef/reservation/revision/manifest definitions across tasks; execution implements types first 
and compiles consumers before commit. Only outstanding environmental prerequisite is creation of 
owned local test databases: Docker28.4.0 is available, TEST_DATABASE_URL currently absent.
PostgreSQL17 migration/RLS/concurrency verification is required alongside existing CI16; record tested
server versions and any unavailable-version gap explicitly. No production connectivity is needed for 
implementation readiness.
