# Reconstruction Task 13

Read this first; exact approved values and binding amendments apply. Spec: docs/superpowers/specs/2026-10-03-job-lifecycle-design.md. Old reviews/results are historical only.

## Global Constraints

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

## Shared interfaces

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

## Binding amendments

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

## Task requirements

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
