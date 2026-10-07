# Recovered approved lifecycle requirements

Recovered 2026-10-07 through supported Library full read. Original source Git objects are unavailable; this is document text, not byte-identical original Markdown. Historical pending-approval labels are superseded by explicit owner implementation/reconstruction authorization in the conversation. No old implementation or test result is current evidence.

<PARSED TEXT FOR PAGE: 1 / 20>
Page 1
Job board retention and analytics design
Revised written specification for Andrew’s review
Keep current job state and protected user history in PostgreSQL, and archive meaningful public 
changes in S3. This revision adds a typed relational model and a bounded event archive to the 
earlier retention design. Implementation has not started; production activation and destination 
configuration remain separately authorized.
Decision summary
 Relational core. Use stable typed entities, foreign keys, indexed joins and evidence-backed 
relationships in PostgreSQL. No graph engine or full event-sourced application is proposed. 
Current-state APIs do not depend on archive replay or S3 availability.
 Public event archive. A meaningful public state change and its small immutable outbox event 
commit together. A separate child in the existing reviewer runtime exports compressed 
immutable S3 batches. Private history, applicant data and protected snapshots stay in 
PostgreSQL.
 Proposed archive horizon. Retain public events and manifests for 730 days from batch 
sealing. Raw public content archival starts disabled; a 90-day default applies only if later 
explicitly approved. Superseded public versions and relationships are bounded after safe 
archival.
 Existing retention defaults. Keep the 30-day discovery horizon; infer closure after two distinct 
complete successful misses at least 24 UTC elapsed hours apart; cache demanded questions 
for seven days and descriptions for 30 days from actual use, or capture when never used. 
Retain lean identity indefinitely and protected history independently of expiry. Production 
payload retirement starts in dry run.
Changes since the prior version
 Exact acknowledgement and safe retries. Persist exact batch membership and immutable 
seals before upload. Verify both data and manifest, then acknowledge only those exact event 
IDs under the current fenced claim. Conditional creation, checksums and stable retry bytes 
prevent silent replacement or broad deletion.
 Bounded backlog with backpressure. Warn at 64 MiB, 50,000 events or 15 minutes; pause 
ordinary eventful writes at 112 MiB or 87,500 events; stop at 128 MiB or 100,000 events. 
Reserve the final 16 MiB and 12,500 slots for critical closure/reopen transitions. Unarchived 
events never age out.
 Explicit retention gaps. Expired or removed baselines produce a terminal incomplete 
projection, with only independently interpretable unsuppressed facts retained. A pending batch 
at its 730-day deadline cannot be acknowledged or silently reset; replacement requires 
separate authorization and preserves its events and original times.
These defaults need written-spec approval. Destination, account, region, encryption and retention 
configuration remain unresolved. No new paid infrastructure, production mutation or lower 
Supabase bill is assumed. The full specification and acceptance gates follow.
<PARSED TEXT FOR PAGE: 2 / 20>
Page 2
Technical specification
V4 proposed written specification. Documentation only; no implementation or production changes.
Revises V3 07240bb229815806008c6a977a735f4bb420e2e2 to the agreed graph-ready relational
core and S3 meaningful-event archive. Earlier retention, capacity, protection and runtime 
contracts remain except where sections 7 and 8 explicitly extend them.
Source commit: badd19b5f85eb693673a770e93b5a4f97d086e2e
Verified base SHA: 114cce96cb244546864a6bddc5476b5630bc024a
Base: upstream main verified through GitHub on 2026-10-03.
Intent and success criteria
Implement the approved investigation recommendations: maintenance precedes additions and 
runs independently of long polls/reviews; verify sources above the storage guard; retain 
lightweight identity broadly; hydrate descriptions for matching and explicit demand and questions 
for application preparation; distinguish source availability from discovery age; preserve user work 
and tenant isolation. No production mutations, deployment, merge, new paid infrastructure, 
credentials, client security grants or irreversible schema drops are authorized.
Success means an interrupted or capacity-blocked poll cannot indefinitely postpone bounded 
maintenance; complete source verification cannot falsely close partial feeds; same-ID sightings 
cannot reset age or refill expired payload; the default discovery view expires after 30 days while 
protected history and older live access remain available. Evidence, not a promise of zero bugs, 
determines readiness.
Approach and alternatives
Recommended: additive PostgreSQL lifecycle state plus typed graph-ready relational 
entities/current relationships, with a small transactional outbox exporting meaningful public 
changes into compressed immutable S3 batches. Postgres remains the transactional source of 
truth and the app works from current state without replay. Reuse existing Python runtimes, 
dashboard demand hydration and private user-history flows. Keep jobs as lean stable Job 
identities after payload retirement; separate SourceListing identity and compact 
JobVersion/provenance rather than inventing a graph engine or full event-sourced application.
Alternative: a dedicated graph engine or permanent PostgreSQL event ledger adds 
infrastructure/storage/operational cost without demonstrated query need. Alternative: reorder 
prune plus date cutoff only does not support provenance-aware analytics or fix 
refill/source/fairness gaps. Neither is recommended. S3 cost benefit is conditional on data volume,
requests and actual Supabase allocation; archiving rows does not by itself reduce provisioned￾storage or base-compute charges.
<PARSED TEXT FOR PAGE: 3 / 20>
Page 3
1 Identity age and states
Stable identity and observations
Keep existing stable ATS/board/external-ID key and first_seen unchanged for surviving rows. Add
immutable original_discovered_at, source_published_at with documented provenance/semantics, 
successful_last_observed_at, successful_sighting_count, content_changed_at/content hash, 
consecutive complete-miss count/first-miss time/last-miss enumeration, payload-retired-at and 
discovery-expiry fields. First_seen remains compatibility data; no migration can reconstruct 
deleted historical age. For reset rows, flag age as locally observed, not source creation.
Successful sighting counts one identifiable positive membership observation per distinct persisted 
enumeration ID, including unchanged postings and positive members of partial enumerations. An 
explicit validated live detail response counts one distinct demand-verification ID; payload 
reads/cache hits do not count. Store observation kind and deduplication key. Duplicate pages, 
retries and replay of either ID count once; failed responses count zero. Newly observed jobs start 
at one; legacy counters initialize to zero and last-observed remains NULL until an actual 
observation. Observation time, publication and content-change time are separate.
Independent lifecycle states
Source availability is open/unknown/closed. Discovery visibility is independently current/expired. 
Payload is independently absent/cached/retired/protected. A posting can be open + expired + 
retired. Legacy closed_at remains compatible and is written only after the new closure evidence 
threshold. Ashby publishedAt means last publication; direct-link-only isListed=false never implies 
closed. Source-specific parsers must preserve semantic provenance.
Frozen discovery age
Discovery expiry: choose a trustworthy source publication timestamp at first capture, otherwise 
immutable original discovery; persist this chosen anchor and its provenance. Expired means 
now() >= anchor + interval '30 days', using UTC timestamptz (30 elapsed 24-hour days). 
Same-ID sightings, title changes, republication or hydration never reset it. Future/unparseable 
dates cannot postpone expiry and fall back to original discovery. Newly reported publication 
changes are recorded but do not automatically extend existing expiry; deliberate older-live access 
remains available. This avoids treating employer republication as proof of a new requisition.
A materially new source ID is a separate identity unless an administrator verifies 
migration/linkage. Same-ID reappearance resets closure evidence and may change content, but 
retains original age; suspected ID reuse is flagged for operator review rather than silently 
becoming new.
Legacy migration
Legacy migration initializes original discovery and a frozen expiry anchor from existing first_seen 
with local-observation provenance; later fetched publication dates do not replace this anchor. 
successful_last_observed_at and source-published fields remain NULL unless an actual new 
source response establishes them. Never backfill checked-at from last_seen or manufacture 
historical source success. Refilled first_seen remains explicitly uncertain.
<PARSED TEXT FOR PAGE: 4 / 20>
Page 4
Identity and protected history
Retain lean identities indefinitely in this first version. Retire unprotected payload rather than 
physically delete its identity, including old confirmed closures. This prevents same-ID full reimport.
Monitor identity growth; finite identity retention is a separate future decision. 
Approved/corrected/application history retains full payload and durable snapshots. Per-user denial
never strips shared content.
2 Source reconciliation and scheduling
Board state and retry scheduling
Add service-owned per-board attempt time, complete-success time, outcome, next due time, 
suspicious-empty streak, failure streak, coverage counters and fenced claim/lease. Distinguish 
deliberate exclusion from failure-disabled sources. Verify enabled boards every 24 hours; failure￾disabled boards receive backoff retry from 24 hours up to seven days. Deliberately excluded 
boards remain excluded unless explicit job demand warrants verification. Do not reactivate 
excluded companies from a retry result.
Fenced claims and leases
Every board and hydration demand claim has an opaque owner token, monotonically increasing 
version and expiry. Initial lease is 180 seconds, renewed every <=30 seconds while work is 
progressing. Each committed observation, payload, reconciliation batch and completion 
transaction locks and checks the current token/version and unexpired lease using database time. 
Reassignment increments version; cancellation also increments version. Expired/cancelled/stale 
workers cannot publish even if HTTP/model work completes later. Do not renew on a hung 
request; time-bounded network work finishes or expires.
Recovery fences a prior worker before reassigning its claim; cancellation releases pending 
work/reservations only through the fenced protocol.
Completeness and closure evidence
A source enumeration commits a completeness verdict only after every expected page/partition 
passes identity, duplicate, cap/wrap and total checks. Positive partial-feed sightings may update 
observation but cannot increment absence misses or certify completeness. Same enumeration ID 
is idempotent. Two distinct complete successful misses with UTC elapsed time >=24 hours 
between first and qualifying miss infer closure; positive sightings clear misses and reopen. A 
validated complete empty board can count; a suspicious empty, failed or partial result cannot. 
Stage bounded identity membership batches under enumeration ID, then mark enumeration 
complete; reconcile <=500 jobs per short transaction with a fenced token and per-job enumeration
marker.
Each batch atomically commits its effects and checkpoint; advance the board's completed￾reconciliation checkpoint only after all batches finish. A newer positive observation wins over an 
older enumeration's inferred absence. No whole-board transaction holds job locks during network 
enumeration or thousands of reconciliations. These are proposed conservative defaults, not 
statistically calibrated.
<PARSED TEXT FOR PAGE: 5 / 20>
Page 5
Suspicious empty feeds and migrations
Suspicious empty feed with >20 existing open jobs is degraded/unknown, not success. Repetition 
alerts and schedules bounded verification of representative exact URLs and migration review; it 
never authorizes mass closure by itself. Explicit removed/expired evidence can close that exact 
posting. Source errors and inactivity do not close jobs. Known migration mapping is operator￾reviewed; do not guess or auto-merge title matches.
Fair scheduling
Choose due boards oldest-verification-first, with deterministic tie-breaking and persisted board 
checkpoints. Start each bounded cycle after the prior cursor rather than always at lowest ID. Per￾board request/time budgets yield partial status and retry; mutable pagination cannot authorize 
closure from concatenated unvalidated snapshots. Prefer a fresh complete enumeration when 
resuming cannot establish safe completeness. Fair scheduling must prevent repeatedly huge 
boards from starving other ATS families.
3 Maintenance and capacity
Discovery cron
Preserve Job Discovery's daily one-shot cron (0 0 * * * UTC): railway.json continues starting
python -m job_discovery, and job_discovery/__main__.py still exits after bounded poll 
work. README's older every-two-hours schedule is not authoritative and must be corrected in 
implementation documentation. No cron-to-always-on conversion is proposed.
Independent maintenance supervisor
Independent maintenance is owned by the EXISTING always-on reviewer-worker runtime. Add 
reviewer/supervisor.py; change only railway.reviewer-worker.json startCommand from 
python -m reviewer.worker to python -m reviewer.supervisor, preserving ON_FAILURE 
restart and 100 retries. The supervisor launches the existing reviewer.worker as one child and 
independent maintenance as another. It starts maintenance immediately at startup and every 15 
minutes regardless of reviewer progress, checking children every <=5 seconds. Maintenance has 
a 90-second process deadline and 120-second fenced database lease renewed every <=30 
seconds; transactions have 2-second lock and 5-second statement limits.
Timeout/crash terminates and fences that child before the next scheduled retry; reviewer crashes 
restart its child without cancelling maintenance. Supervisor failure exits nonzero for Railway 
restart; startup fences expired claims before recovery. SIGTERM stops new children, requests 
reviewer drain, then terminates remaining children after a 30-second deadline; fenced stale work 
cannot commit. The supervisor never waits indefinitely for a stalled reviewer. Maintenance also 
continues when the separate discovery cron ends or is terminated. This adds measured 
CPU/memory/connection use within the existing runtime; no cost-neutrality claim or new service is
implied.
Configuration is proposed, not deployed. Test stalled reviewer, stalled/terminated cron, child 
crash, supervisor restart and graceful/forced shutdown.
<PARSED TEXT FOR PAGE: 6 / 20>
Page 6
Pre addition maintenance
Also run a bounded pre-addition sweep in every ingestion cycle. Maintenance takes its own short 
transaction/claim locks, not the long-lived poll-wide lock. Acquire the pre-DML gate and job￾scoped lock protocol described below, then lock each candidate job and recheck protection/active 
demands before retiring payload. Active ingestion must honor these locks and stable identity; 
retries must reacquire locks after reconnect. Maintenance never invokes LLM review, generation, 
notifications, application submission or any external write; tests install fail-on-call hooks for those 
capabilities.
Cycle order and capacity ceiling
Cycle order: bounded maintenance -> measure capacity -> claim due source -> 
enumerate/reconcile -> check capacity before every <=500-row admission chunk -> admit eligible 
metadata -> enqueue bounded demand hydration -> persist phase progress. Above the 6000 MiB 
ceiling, permit source verification and bounded maintenance, but block additions and payload 
growth. Check source-state writes/WAL headroom; the ceiling is not a physical-volume guarantee.
Do not increase the ceiling or credit DELETE bytes as physical reclamation.
Maintain separate limits for rows/bytes and runtime per sweep; initial maintenance batch/cap 
remain 2,000/20,000. Guard metric remains pg_database_size divided by 1024^2, checked before
each <=500-row chunk and each hydration reservation. Admission forecasts include 
payload/index/WAL headroom and shrink chunks or refuse reservations when remaining budget is
insufficient. Crossing the threshold during a chunk stops further growth at its next safe transaction 
boundary while source verification continues; a byte-perfect physical-volume guarantee is 
impossible and must not be claimed. At/above the ceiling, no extra metadata identities are 
admitted.
Capacity checks are serialized with admission reservation; all payload writers, including 
dashboard demand, must obey the same budget so concurrent writes cannot bypass it. A failed 
capacity/maintenance check permits verification but blocks additions. Physical allocation, 
live/dead tuples, reusable space and WAL are reported separately; compaction remains a 
separately authorized operation.
Capacity reservations
Reservations are service-owned rows keyed by writer claim token/version with conservative byte 
amount, expiry and state. The capacity lock is the SAME global pre-DML gate defined below, 
never a second mutex. Under that short gate, eligibility subtracts all outstanding reservations from
measured headroom; consuming writers reacquire it, validate their fenced claim and reservation, 
perform bounded writes, measure post-write allocation and settle actual usage before releasing 
the reservation. Resizing and cancellation use the same gate. A rolled-back write releases its 
reservation in recovery; a crash reservation expires only after atomically fencing its writer, which 
must revalidate before any later write.
Expiry alone never grants a stale writer permission. Ingestion, shared hydration/cache and user 
snapshot/package payload writers follow this contract; no network or model call runs under the 
gate. Actual physical usage can differ from forecasts; report overshoot and immediately stop new 
reservations.
<PARSED TEXT FOR PAGE: 7 / 20>
Page 7
Physical storage and operator action
Logical payload retirement may leave pg_database_size above the ceiling despite reusable free 
pages. Keep additions blocked in that case; do not override the guard using an estimated freed￾byte credit. Persist/emit guard-active, measured size, retired bytes/rows, reusable-space evidence
and last successful sweep. If guard remains active after two scheduled sweeps, emit an operator 
action-needed event in existing logs/admin status explaining that separately authorized 
compaction/capacity action may be required. No automatic compaction, volume increase or 
notifications are added.
4 Description and question demand and protections
On demand question capture
Stop unconditional Greenhouse question backfill (job_discovery/run.py:131). Reuse 
authenticated application preparation's existing stored-question/on-demand fallback 
(dashboard/app/api/application/prepare/route.ts:96) and snapshot the question version 
with the package. Cache questions for seven days when explicitly demanded; discard unprotected
unused cache after that horizon. Existing package snapshots remain immutable across source 
changes.
Cache expiry and timestamp provenance
For each shared description/question cache record persist captured_at and last_used_at 
separately. Global unprotected expiry is now() >= COALESCE(last_used_at, captured_at) +
TTL, with TTL 30 days for descriptions and seven days for questions. Never-used/new caches 
expire from capture; each actual authorized matching/detail/application consumption stamps last 
use after acquiring the shared lock/demand lease. Source sightings and failed demands never 
refresh it. Re-capture may refresh capture time only for authorized demand or a meaningful 
version change; passive same-ID polling cannot rehydrate or extend a retired cache.
Legacy non-NULL payloads get captured_at equal to migration activation time with migration￾provenance and NULL last_used_at, granting one conservative full TTL without inventing 
historical use. Absent payload remains absent with NULL capture/use; malformed NULL￾timestamp populated payloads are quarantined and retained until normalized under this 
conservative rule. Feed expiry is not global cache expiry. Retirement rechecks every protected 
consumer/snapshot and active lease; protected legacy payload remains retained, not retroactively
expired.
Demand driven hydration
Persist lightweight listings without per-job details where possible; full single-response ATS 
payloads may still be received but descriptions need not all be stored. Hydrate a bounded 
reviewer candidate batch after deterministic user filters and before model spend. Explicit older￾live/detail/application demand may request hydration through a service-only queue, not client 
shared-table write privileges. Successful demand caches unprotected descriptions for 30 days 
from last actual use. Automatic source sightings do not count as use. Expired discovery jobs are 
excluded from automatic matching but may be explicitly reviewed/accessed.
<PARSED TEXT FOR PAGE: 8 / 20>
Page 8
Protected work and active demand
Missing/failed hydration defers review/application; never generate JD-blind content or report 
successful preparation. Bound network requests, coalesce concurrent same-job hydration and 
record source/version. Pending/running generation, package preparation and review demand 
establish a lease before hydration or payload use. Maintenance locks/rechecks approvals, 
corrections, packages and these active leases. Also preserve dependent resume_scores and 
cover_letter_edits as persisted user work; generation_jobs pending/running protect through 
leases and terminal records are retained with lean identity. Audit all seven current job-linked 
cascading foreign keys; no cleanup may cascade-delete dependent user work.
Durable approved review, correction and package description/question snapshots preserve the 
exact version used; retain existing shared payload for protected jobs in this rollout. A race may 
defer cleanup, never cascade-delete user work. Feed expiry alone never retires global payload; 
the separate global cache policy checks all users/consumers and snapshots.
Global gate before row locks
Protection/capacity DML uses ONE transaction-scoped global admission/protection advisory gate,
acquired BEFORE PostgreSQL takes relevant row/FK locks. Database BEFORE STATEMENT 
triggers acquire it on INSERT/UPDATE/DELETE for jobs, all seven job-linked children, 
demand/board claims, reservations and staging/checkpoint state. Application/ORM/service 
transactions acquire it as their first lock before SELECT FOR UPDATE or mutation; row triggers 
alone are not the pre-lock mechanism. Inventory every cascade-initiating parent and install the 
gate at its root statement before child cascades, including account-deletion paths; prohibit any 
new mutation path that takes a relevant row lock before this gate.
Operations that never touch these tables cannot wait for the gate while holding locks later needed 
by lifecycle work. This gate deliberately serializes short bounded write transactions; performance 
is measured, not assumed.
Lock ordering
After the global gate, service multi-job operations acquire namespaced job-scoped advisory keys 
in sorted order, then row/FK locks and child validation. Direct authenticated multi-row DML may 
reach row triggers in arbitrary order, but already owns the global gate before any rows are locked: 
no competing lifecycle transaction can hold another job/child lock and wait in the opposite order. 
Row validation acquires the same job key reentrantly. Maintenance uses the identical gate -> job 
keys -> rows order; never job gate -> already-locked child in competition with a child-first writer.
Capacity uses this SAME first gate, not a separately ordered mutex; completions validate fenced 
claim/reservation before job/row work. Renewal/cancellation/recovery and protection removals 
also enter through the gate. Network/LLM calls and sleeps occur outside every gate/transaction. 
Bounded lock waits may defer work but are not the deadlock-prevention proof.
Atomic protection and reservation validation
Under the gate, all writers/removers recheck required version/snapshot and active demand; 
approval/correction/package/usable-demand acquisition cannot report success before required 
payload or a durable snapshot exists. Pending hydration may commit a protective pending lease 
<PARSED TEXT FOR PAGE: 9 / 20>
Page 9
while payload is absent; it reports pending, not usable/successful, and completion atomically 
grants a validated version. Retired payload requires releasing locks, bounded hydration and retry. 
Snapshot/protection changes commit atomically; retirement rechecks committed protections and 
active leases before payload changes. Database row validation rejects direct payload-growth 
writes lacking a valid owner-bound fenced capacity reservation; direct protection writes without 
growth remain supported.
Where validation must inspect service-only reservation state, a narrowly scoped private trigger 
helper may read ONLY capacity/claim records and return validation, with fixed search_path, 
explicit invoker identity checks and no PUBLIC/anon/authenticated EXECUTE grant. It may not 
perform privileged job/user DML or bypass the original statement's RLS. Any such privileged 
helper needs independent security review; otherwise keep it invoker-only. Existing grants may be 
narrowed but never silently broadened. Tests must establish this pre-DML ordering for direct 
authenticated statements, ORM/service paths, cascades, opposite-order multi-job updates, 
cancellations and concurrent completions.
Public question schema and private user data
Shared question caches contain PUBLIC employer schema only: no applicant answers, uploads, 
resumes, personal state or authenticated employer data. Applicant answers and package 
snapshots remain owner-scoped; logs contain IDs/status/byte counts, not user payloads or 
credentials.
Bounded public fetching
Public fetches use validated stored ATS references and fixed allowed public endpoint hosts. 
Revalidate every redirect destination and resolved address against authorized host/private-local￾address rules; allow <=3 redirects, a 20-second overall request deadline and <=10 MiB 
decompressed JSON/HTML response, with expected content types and bounded streaming. 
Larger listing endpoints must use supported pagination or yield incomplete—not silently truncate 
and close jobs. Never forward authorization/cookies across redirects; public requests carry no 
employer/user credentials. No arbitrary user URL fetch, credential disclosure, application 
submission or new external paid calls.
Shared payload service workers preserve current RLS; all user queues/snapshots are owner￾scoped, server-derived user identity and existing entitlements enforced. JSON reads use total 
parsers as required by the dashboard implementation guidelines.
5 User experience and rollout
Default discovery and automatic match selection use the 30-day horizon; explicit “Include older 
live jobs” allows access. Approved, corrected and prepared/applied jobs remain visible in the 
viewer's history independent of expiry. There is no existing generic bookmark table: “saved” 
means current persisted approved/corrected/package work in this scope, not a new favorites 
feature. Source unknown and source closed are labelled distinctly; expiry never says employer 
closed the role.
<PARSED TEXT FOR PAGE: 10 / 20>
Page 10
Rollout and authorization
Additive migrations only, service-owned state, no broader grants. Rollout sequence: collect-only 
lifecycle state/compatible relational identity mapping -> verified source reconciliation/fair 
scheduling -> independent maintenance/pre-addition capacity -> demand description/question 
hydration -> feed expiry -> dry-run global payload retirement. Separately validate the approved 
archive destination/export path, schemas and outbox pressure behavior before enabling 
meaningful-event producers; safely archived version/edge retirement follows. Retirement and 
production enabling remain separately authorized. Separate feature flags allow each behavior to 
be disabled; disabling export never discards pending events, and disabling a required event 
producer also pauses its corresponding state changes.
Rollback disables flags/consumers and retains additive state/snapshots; never drops user data or 
restores an unsafe old consumer.
Consumer compatibility and rollback
Audit every existing first_seen/last_seen/closed_at/description_pruned consumer in reviewer 
selection, dashboard filters/sorts/counts/pagination, job detail/application flows, analytics and 
cleanup before enabling new semantics. Keep legacy timestamps readable and introduce explicit 
lifecycle readers with flag-off compatibility. Rollback of feed/source flags must not fabricate dates 
or reopen proven closures; rollback of hydration/retirement pauses writes and retains existing 
snapshots/lean identities, rather than restarting old consumers that unconditionally refill caches. 
Runbook documents which consumer versions may safely coexist.
6 Bounded operational state
Keep durable job counters and only compact monotonic markers: last membership enumeration 
sequence, last complete-miss sequence/time, last direct-verification sequence and the successful 
sighting total. Per-source/demand compact claim generations and replay floors survive temporary￾row cleanup. Never append a lifetime event row for every unchanged job/poll. Duplicate identity 
sightings within an enumeration use its temporary unique membership set; committing a job 
marker and counter atomically makes replay idempotent after that set is removed.
Temporary enumeration membership and batch checkpoints have a seven-day maximum age. 
Completed enumeration staging is eligible for deletion 24 hours after fully committed 
reconciliation. Terminal demand/claim/reservation rows and bounded phase summaries retain 
seven days after settlement/cancellation; completed maintenance details likewise expire after 
seven days, while compact last-run health survives. Use existing runtime logging, not a new 
unbounded DB event log. Cleanup remains batched/capped and runs in independent 
maintenance above the guard.
Fencing before operational cleanup
Before removing unfinished staging older than seven days, acquire the global gate, increment its 
claim version, cancel/fence the old enumeration, raise the source replay floor past its sequence 
and mark it abandoned; preserve already committed observations/counters, then delete 
recoverable staging in bounded batches. A later attempt uses a fresh enumeration. Before retiring
terminal claims/reservations, settle actual usage or explicitly abandon under a fenced generation, 
<PARSED TEXT FOR PAGE: 11 / 20>
Page 11
preserve compact last-generation/replay rejection state, then delete the row. Expired reservations 
are never reusable IDs. Late callbacks/replays older than a retained floor are rejected before 
counter/miss/payload/reservation writes.
Unresolved financial/capacity accounting cannot silently age out: fence the writer, reconcile 
measured usage under the gate, conservatively block growth and surface recovery failure if 
settlement is unavailable. Test many unchanged polls, interrupted staging cleanup, stale replay 
after cleanup and attempted reservation resurrection; retained operational row counts must stay 
bounded by active work plus these windows.
7 Graph ready relational core
Postgres owns stable entities, current availability/source health/feed and PRIVATE user history. 
Current-state APIs never require archive replay or S3 availability. No graph engine, generic EAV 
edge table, new paid skill extraction or full event-sourced application is introduced. Typed foreign 
keys and indexed joins serve current queries; bounded recursive SQL with explicit depth/cycle 
limits is available when justified by relationship queries.
Additive schema contracts (identifiers are opaque stable IDs unless noted):
 companies: existing IDs remain stable employer records. Do not collapse legacy board-derived 
company rows based on name. brands(id, name) exists only for explicit public 
employer/brand evidence; no speculative backfill.
 source_accounts(id, legacy_company_id, ats, public_board_ref, public_url, 
claim_generation, current_revision), unique (ats, public_board_ref): source 
coordinate, not employer identity. Existing polling/health fields migrate by compatibility 
mapping, without invented past successes.
 source_listings(id, source_account_id, external_id, job_id, 
current_version_id, current_revision, archived_revision), unique 
(source_account_id, external_id): stable source-specific posting with section 1 lifecycle 
fields. Existing job keys map one-to-one initially. A source listing is NOT a canonical Job.
 jobs: existing stable Job IDs remain lean application/history anchors. A canonical Job may 
have multiple listings only through reviewed evidence. Private job-linked FKs/snapshots are not
rewritten or cascaded by public identity corrections.
 job_versions(id, job_id, source_listing_id, revision, content_hash, 
public_metadata, observed_at, recorded_at, payload_ref, payload_expires_at), 
unique (source_listing_id, revision): typed/validated public metadata and hash, not a 
full body snapshot per poll. Create only on meaningful source content change; normalize 
volatile formatting deterministically. Availability events do not create redundant content 
versions. Keep current plus <=10 superseded versions/listing within 30 days once safely 
archived and no active reference needs them; protected private snapshots are independent. If 
these bounds cannot be met without discarding unarchived evidence, pause version growth 
rather than delete evidence.
 skills(id, canonical_name) and existing canonical locations: shared dictionaries. 
Populate Skill only from explicit public structured source data or reviewed public evidence, not 
private applicant reviews or a new LLM pipeline. An empty supported dictionary is preferable to 
invented facts.
<PARSED TEXT FOR PAGE: 12 / 20>
Page 12
 Typed relationships: company_brands(company_id, brand_id, ...), 
company_sources(company_id, source_account_id, ...), 
job_locations(job_version_id, location_id, ...), job_skills(job_version_id, 
skill_id, ...). Each has concrete FKs, evidence kind/public evidence reference, 
observation/recording times, optional valid-from/to, status and constrained confidence. 
Unknown valid time is NULL, not inferred from ingestion. Job-Version and Source-Listing links 
are direct FKs. Keep current relations and superseded public relations <=30 days after safe 
archival; relevant private snapshots remain.
 identity_assertions(id, left_listing_id, right_listing_id, relation, 
evidence_kind, public_evidence_ref, status, observed_at, recorded_at, 
revision): relations limited to same_job, repost_of, source_migration; statuses 
proposed/accepted/retracted. Only reviewed evidence can accept an assertion. Weak links are 
not transitively promoted into merges. Reject accepted same-job cycles/conflicting 
representatives. Preserve stable Job/history anchors; analytics may group accepted same-job 
links without mutating private history.
Temporal provenance
Temporal revisions distinguish source-observed time from database-recorded time, and asserted 
valid time from observed validity. Public provenance contains no reviewer/user/tenant identifiers 
or private notes. Brand/source migration and Skill relationships are created only when evidence 
supports the relevant use case. This typed schema supports employer/source coverage, posting 
lifespan, source migration and explicit skill/location trends; projections must expose 
provenance/confidence rather than count guesses as truth.
Compatibility and revision ownership
Section 1's ATS/board/external key remains the compatibility Job lookup while SourceListing 
becomes the source-specific lifecycle owner through additive mapping; migrate readers/writers 
together behind flags, never maintain two independently writable lifecycle truths. Content versions
use their listing's event revision (gaps are allowed when intervening events only change 
availability); all meaningful listing changes share that aggregate's revision stream.
8 Meaningful event archive and contracts
Event production and schema
State change and its small immutable outbox event commit in ONE Postgres transaction under 
the existing pre-DML gate. A failed outbox insert rolls back the corresponding eventful state 
change. Once event production is enabled, all eventful mutators, including direct DML paths, must
either use this paired contract or be rejected; commit-time validation must prevent 
missing/mismatched aggregate revision events. No external object write occurs inside that 
transaction. Plain multi-statement transaction plus validated revision allocation is preferred; data￾modifying CTEs communicate through RETURNING and must not assume textual execution order
or reread their own sibling writes.
<PARSED TEXT FOR PAGE: 13 / 20>
Page 13
Outbox and batch state
Concrete service-owned tables: archive_outbox(event_id UUID PK, aggregate_type, 
aggregate_id, revision, previous_revision, event_type, schema_version, 
observed_at, recorded_at, data_class, body_json, body_sha256, serialized_bytes,
batch_id NULL), unique (aggregate_type, aggregate_id, revision); 
archive_batches(batch_id UUID PK, status, serializer_version, ingestion_date, 
object_key, manifest_key, content_sha256, compressed_sha256, event_ids_sha256, 
event_count, byte_counts, claim_generation, lease_until, verified_at); 
archive_batch_items(batch_id, event_id, ordinal, event_sha256), unique event 
membership. Pending event bodies never change. Aggregate revision/fencing/last-contiguous￾archived-revision markers remain compact with current entities after outbox cleanup. No cascade 
may delete pending outbox or unverified batch membership.
Allowed events and activation baselines
Allowlisted event types: source_listing_discovered, job_version_changed, 
listing_closed, listing_reopened, identity_assertion_changed, 
public_relation_changed, plus explicitly labelled baseline records at archive activation. Each 
envelope has stable event UUID derived from a fixed namespace plus aggregate kind/ID/revision, 
typed aggregate ID, monotonically increasing per-aggregate revision and predecessor, 
event/schema version, observed/recorded UTC times and sanitized public provenance. Body is a 
typed allowlisted delta or initial compact public record, <=8 KiB UTF-8; no unrestricted row/JSON 
serialization. Oversized/invalid events fail before the paired state change; never silently truncate 
meaningful facts.
Safe hashes may reference omitted payload. Unchanged sightings only update compact 
counts/markers and cheap run summaries; they do not emit historical events. Source-health 
attempts/cache hits/private reviews do not generate shared public history. Legacy baseline is not 
fabricated historical discovery/closure. Baselines are bounded/reserved like ordinary growth; their 
activation revision anchors replay without asserting a predecessor exists in the archive.
Per aggregate commit ordering
An entity revision is allocated while holding its state lock and commits with its event, preserving 
that entity's order. Global SQL sequence values, observed time and recorded time do NOT certify 
cross-entity commit order. Batch selection may see a higher sequence while a lower transaction is
uncommitted; acknowledgement never deletes sequence <= max. Tests deliberately create such 
late lower-sequence commits.
Seal upload verify acknowledge
Extend the existing reviewer supervisor with a SEPARATE archive-export child, never call 
external S3 writes from maintenance. Export ticks every 60 seconds, one bounded export worker, 
<=120-second process deadline and 180-second renewable fenced lease. Apply section 3's 
supervisor crash/restart and bounded SIGTERM drain/fence semantics to this child; stopping it 
preserves pending membership/seals for retry. Independent maintenance keeps its 15-minute 
schedule and cannot wait behind network export. Existing runtime CPU/memory/connection use 
must be measured; no new service or cost-neutrality promise.
<PARSED TEXT FOR PAGE: 14 / 20>
Page 14
Service interfaces
Service interfaces for later planning: record_public_change(tx, change, claim)->EventRef;
claim_batch(tx, limits, claim)->BatchRef; seal_batch(batch_ref, 
serializer_version)->SealedBatch; put_verify_batch(sealed_batch, 
archive_client)->VerifiedBatch; ack_batch(tx, verified_batch, claim)->AckResult; 
project_archive(manifests, policy, limits)->ProjectionResult. EventRef identifies 
exact aggregate revision/event; BatchRef identifies durable membership and fenced claim; 
VerifiedBatch binds immutable keys, exact manifest/event digest and content checksums; 
AckResult returns exact acknowledged IDs. No interface accepts arbitrary source-controlled 
bucket/key or changes private history.
Exact selection and deterministic serialization
Selection claims exact committed event IDs and persists stable membership/serializer 
version/batch ID before serialization. For each aggregate, select a contiguous pending revision 
prefix; do not claim newer revisions while an earlier batch for that aggregate is unacknowledged. 
Other aggregates may progress. Serialize/compress outside all database locks: canonical UTF-8 
JSONL (sorted keys, fixed separators, no NaN), stable record order and deterministic gzip 
(mtime=0). Flush at <=2,000 events or 8 MiB uncompressed, or when oldest pending is >=5 
minutes; no one-object-per-event. Local files are reconstructable from immutable 
outbox/membership, not the durable handoff.
Durable seals and immutable keys
In a short fenced seal transaction persist immutable key, exact event-ID digest, 
content/compressed SHA-256, byte counts and serializer version BEFORE upload. Key: fixed 
configured prefix plus ingestion_date=YYYY-MM-DD/<opaque-batch-id>-<compressed￾sha>.jsonl.gz; use seal/ingestion UTC day, not employer publication date. Manifest is adjacent 
with its own immutable key. Canonical manifest bytes/digest are durably sealed before its upload; 
keep optional returned S3 version IDs in verification receipts rather than alter sealed manifest 
bytes. Bucket/prefix are service configuration validated against an approved destination; malicious
source/entity IDs never form object paths.
Conditional upload and integrity verification
Use S3 conditional creation (If-None-Match: *), not HEAD-then-overwrite. Retry reuses the 
sealed batch, keys, membership and exact bytes. On existing-key response or ambiguous 
timeout, retrieve bounded data and manifest and compare intended batch/serializer/event IDs and
checksums; exact match is recoverable success, mismatch is a fail-closed corruption/conflict 
requiring operator review. A matching data object with a missing manifest remains 
unacknowledged; conditionally create the original sealed manifest and finish verification. Do not 
treat ETag as a universal content checksum. Manifest binds event IDs/digests, aggregate revision
ranges, schema/serializer versions, object key, byte sizes, compressed and canonical content 
hashes.
Verification permits <=16 MiB compressed, <=8 MiB expanded data and <=1 MiB manifest, 
bounded by declared counts/deadline; reject oversize/decompression bombs. Returned version 
IDs, if present, identify the verified object in receipts.
<PARSED TEXT FOR PAGE: 15 / 20>
Page 15
Exact acknowledgement and fenced completion
After BOTH object and manifest are confirmed, stream-read the bounded object, verify 
SHA-256/decompression/count/event-ID digest and manifest, then acquire the pre-DML gate and 
revalidate the current lease/generation, persisted seal and exact pending membership. 
Acknowledge only those exact IDs and advance contiguous archived revision markers; 
mismatch/stale claim aborts. Remove acknowledged outbox/membership in bounded transactions
after acknowledgement is durable. Upload-success/ack-failure retries verification/ack of the SAME
batch; partial selection, late commits and orphan uploads do not authorize other deletions. Stale 
exporters may leave a matching immutable object, but cannot acknowledge after reassignment.
Corrupt/poison event stays quarantined and unarchived; unaffected aggregates may continue.
Eligibility deadline and authorized recovery
Acknowledgement also requires archive eligibility at verification AND the final acknowledgement 
transaction: database time must be strictly before persisted sealed_at + interval '730 
days', with the manifest/data still eligible and unsuppressed under the approved policy. Upload 
success alone is insufficient. A sealed but unacknowledged batch at/past this deadline enters 
retention-blocked recovery; preserve every pending event and its exact membership, stop 
retries/acknowledgement of expired keys, and expose operator action-needed status. Old data￾only or data+manifest uploads remain expired/untrusted for acknowledgement and cannot be 
deleted by the exporter.
No automatic retention-clock reset or silent discard is permitted. If separately authorized, recovery
fences the old claim and atomically transfers the SAME pending event IDs/bodies/revisions into a 
replacement batch with new batch ID/keys, current seal time and an explicit prior-batch reference;
the old batch is marked superseded with a compact fence marker, never used to acknowledge. 
Preserve original observed/recorded times and discovery age. Verify/ack the replacement under 
the normal contract before cleaning pending rows. Any old upload/ack callback is rejected; 
duplicate archived event IDs retain normal hash deduplication and removal/suppression still wins.
Old partial objects await separately authorized lifecycle/removal. Without this recovery 
authorization, remain fail-closed and retain pending events within existing backpressure bounds.
Outage capacity and bounded retention
Outbox is a temporary durable handoff, not a permanent PG history table. Proposed defaults: 
warning at 64 MiB live pending/sealed event+membership bytes, 50,000 events or oldest age 15 
minutes; pause new discovery/content/relationship writes at 112 MiB or 87,500 events; total hard 
stop at 128 MiB or 100,000 unacknowledged events. Byte accounting includes live 
row/membership/seal/index-overhead forecasts; reusable allocated pages are distinct from live 
budget. Index/WAL/physical space also remains subject to the 6000 MiB guard and existing 
conservative reservations; forecast remaining event budget under the same gate before eventful 
writes.
The final 16 MiB AND 12,500 event slots are reserved for critical closure/reopen transitions, not 
ordinary ingestion. Warning/pressure/status use existing logs/admin health, no unsolicited 
notifications.
<PARSED TEXT FOR PAGE: 16 / 20>
Page 16
Outage behavior and degraded coverage
Never TTL-delete unarchived events, even during indefinite S3 outage. Export/ack and bounded 
maintenance retain priority; unrelated private protected-history operations follow their existing 
capacity gates. Read-only source enumeration and compact unchanged-positive counters/health 
can continue, but once even the critical event reserve is exhausted, archive-dependent availability
transitions must pause rather than commit without their event. Mark coverage degraded/archive￾blocked; display current availability as unknown when verification cannot be durably reconciled. 
Resume by fresh complete checks and record observed changes/recovery coverage gaps—do 
not invent intermediate transitions.
It is impossible to guarantee infinite durable history, bounded outbox AND uninterrupted eventful 
writes during unlimited archive failure. Hard physical read-only failure may also stop counters; 
report it honestly. Production must not enable eventful archive mode before a destination/export 
path has passed validation.
Retention classes
Retention classes are separate: current lean identities/counters indefinite; active/protected 
payloads and private snapshots per sections 1–6; unprotected description cache 30 days/question
cache seven days; compact superseded public versions/edges <=30 days and version count 
bounds only after archival; temporary enumeration/dedup state per section 6. Unverified 
outbox/seals never age out; acknowledgement receipts/terminal exporter leases retain seven 
days, then expire after compact replay/fence markers are safe. Batch manifest stays in S3 with its 
data, not an indefinite duplicate PG catalogue. Sealed pending state cannot be 
abandoned/deleted merely because its lease expired.
Event horizon and optional raw content
Proposed event+manifest retention is 730 days FROM batch sealing; this is a reviewable analytics
horizon, not permanent retention. Optional raw public content-version objects are DISABLED 
initially; if later explicitly approved, default 90 days, separate keys/policy/classification, 
hash/version refs and explicit expiry. Raw descriptions may contain contact/personal data, so they
are not automatically eligible for the public archive. Payload expiry prevents full historical content 
replay; archive retains only allowed facts/deltas/hashes. No promise of complete original 
HTML/JD reconstruction.
Logical eligibility and lifecycle alignment
Persist immutable sealed_at and archive_eligible_until in batch state and canonical 
manifest, derived from the approved horizon; they are not event occurrence time or 
acknowledgement time. Replay and acknowledgement enforce this logical deadline even if 
physical objects have not yet been removed. The separately approved object lifecycle must not 
remove eligible data/manifests earlier than this deadline. Recovery replacement gets a new 
explicit archive eligibility window only through the authorization above; it does not rewrite historical
event time or claim continuous coverage.
<PARSED TEXT FOR PAGE: 17 / 20>
Page 17
Versioned objects and separate permissions
Current/noncurrent S3 object versions, manifests and abandoned objects require a separately 
approved lifecycle/removal policy covering all versions; no automatic Object Lock or bucket 
versioning/encryption/IAM changes are authorized. Export authority is Put/Get on the approved 
prefix, without deletion; bounded admin replay read authority and separately authorized removal 
capability remain distinct. Application append-only/conditional writes are not Object Lock. Existing 
unrelated backup buckets are not assumed suitable.
Archive privacy and destination controls
Archive schemas exclude applicant answers/uploads/resumes, user activity, private history/review
decisions/packages, tenant/user identifiers, credentials and private provenance. S3 destination 
must be private, encrypted and minimally accessible before activation; 
destination/account/region/encryption/retention choices are future owner-reviewed configuration, 
not authorization to create buckets or IAM. No secrets are read or embedded by this spec work. 
Sanitization must reject unexpected fields; public-source free text containing personal/contact 
data is omitted or redacted under explicit schema rules, never exported wholesale. Diagnostics 
log opaque IDs/counts/errors, not event bodies or signed URLs.
Replay and analytics
Replay is an explicit bounded admin operation into a separate public analytics projection, not a 
production-state restore. Validate manifest/content/schema; identical event ID+hash deduplicates,
conflicting duplicate fails closed; stale revisions do not overwrite newer projection state. Missing 
predecessors within eligible coverage may be deferred only for the bounded replay run; report 
unresolved gaps rather than retry forever. If activation baseline/predecessor is expired, removed 
or outside declared coverage, return a terminal retention_gap/incomplete-projection result for 
that aggregate, including known reason and retained revision range (unknown cause remains 
unknown).
Later retained events may contribute only schema-defined independently interpretable facts with 
explicit incomplete-history provenance; delta-only state, posting lifespan, inferred identity or 
derived relationships needing the missing prefix remain unavailable. Never invent baseline/history,
promote weak links or reconstruct a suppressed scope. A later retained event does not restart 
indefinite waiting for an expired baseline. Optional authorized current-PG bootstrap may provide a
separately labelled present-state baseline, never missing historical facts; it is not required. Reject 
unknown schema versions until an explicit reader is supplied.
Preserve observed versus recorded time. Identity corrections retract/replace assertions with 
provenance; weak edges do not become transitive identity. Traversal depth/cycle limits and 
indexed typed joins avoid unbounded graph queries.
Replay restrictions and suppression
Replay cannot reopen current jobs, mutate private history, invoke 
reviews/generation/applications/notifications or make paid calls. Required payloads may have 
expired; output is partial fact history with declared coverage, not full application replay. Authorized
archive removal records compact suppression/epoch markers before removal; replay/projection 
readers consult them so old files/noncurrent versions cannot resurrect removed records. 
<PARSED TEXT FOR PAGE: 18 / 20>
Page 18
Projection retention cannot exceed eligible archive retention; expired/removed event partitions are
excluded and derived rows invalidated. No removal occurs without separate authorization.
Analytics formats and cost reporting
Start with compressed JSONL and coarse ingestion-day partitions. Parquet compaction or a 
graph projection is a future measured-query optimization, not additional paid infrastructure in this 
rollout. Cost reporting distinguishes live row/TOAST/index/WAL footprint, reusable space and 
provisioned Supabase allocation, S3 byte/request costs and optional analytics scan costs. Do not 
claim a lower Supabase bill merely because rows were archived.
Additional acceptance contracts and sources
Real multi-session DB tests: atomic state/outbox rollback; per-entity revisions; lower-sequence 
late commit; exact partial batch membership/ack; cross-batch order; 
gate/fence/capacity/protection races; no unchanged-per-poll events; compact versions/edges and 
PG row bounds; pending data never TTL-deleted. Fault tests: crash before/after 
seal/upload/manifest/verify/ack, ambiguous upload, existing-key mismatch, wrong 
checksum/count/event digest, stale exporter, poison schemas, outage thresholds/critical 
reserve/full guard, recovery gaps and maintenance independence. Privacy tests: malicious 
IDs/URLs/path separators, unexpected fields/tenant IDs/resumes/answers/private review data, 
unknown schemas, controlled destination, separate capabilities and no replay side effects. 
Removal/expiry tests cover current/noncurrent objects, manifest/projection expiry and suppression
preventing resurrection.
Preserve the full section 6/V3 acceptance matrix.
Primary sources
Primary-source basis (checked 2026-10-03): same-transaction outbox and idempotent consumers
follow AWS transactional outbox guidance. Compression/coarse partitions/batching avoid 
premature small-file analytics costs, consistent with Athena data optimization. CTE 
dependency/snapshot cautions and bounded relational recursion follow PostgreSQL WITH 
documentation. Allocation/reclamation must be assessed separately under Supabase disk-size 
guidance. Conditional creation/integrity/immutability distinctions follow S3 conditional writes, 
object integrity and Object Lock. Batch sizes/thresholds/retention horizons here are proposed 
design defaults, not claims calibrated by those sources.
Review gates and product decisions
Review this written spec first. After approval, write the executable task-by-task implementation 
plan and obtain plan/execution-method review. Independent review covers 
requirements/architecture, security/tenant isolation/protection races, adversarial lifecycle/capacity 
tests, and the final whole branch. Reviewers do not approve code they authored. Blocking findings
require fixes and regression evidence before readiness.
Defaults for review: 30-day feed horizon; two complete misses >=24 hours; seven-day demanded 
question cache; 30-day demanded description cache; lean identity retained indefinitely; automatic 
matching excludes expired jobs; protected history remains available; no automatic migration 
<PARSED TEXT FOR PAGE: 19 / 20>
Page 19
merge. V4 adds current plus <=10 superseded public versions within 30 days after archival, 730-
day public event/manifest horizon, disabled optional raw content (90 days only if later approved), 
128 MiB/100,000-event outbox hard budget with a critical reserve, compressed JSONL and a 
separate exporter child. These are proposed choices requiring renewed independent and owner 
written-spec review; they are not calibrated by the five-company sample.
Destination/account/region/encryption/retention configuration remains unresolved and separately 
authorized. No additional favorites product is proposed.
Acceptance matrix
 normal/guarded maintenance-before-admission
 blocked/failed/interrupted sweeps
 reviewer-runtime supervisor with stalled reviewer, terminating discovery cron, child 
timeout/crash/restart/lease recovery
 maintenance forbidden side effects
 outstanding/expired/crashed/resized capacity reservations, rollback reconciliation and mid￾chunk crossings
 failed/partial/empty/moved sources
 idempotent miss runs/reopen and successful-sighting counts
 stale board/demand completion after renewal/expiry/cancellation/reassignment
 same-ID retirement/resurrection
 publication semantics/frozen legacy anchors/reset ages
 never-used/new/legacy/NULL cache expiry
 old-live access
 no routine question requests in any ingestion path
 public-only question cache/schema changes
 demand hydration failure and matching lean jobs
 real two-user RLS/protection acquisition/removal versus retirement, approval-versus-prune and 
in-flight generation races
 pre-DML gate versus implicit row/FK locks, opposite-order direct multi-job DML, cascades and 
concurrent capacity completions
 privileged validation-helper permissions/identity
 forbidden private redirects/decompression limits/credential forwarding
 starvation under budget/interruption, bounded reconciliation/checkpoint ordering and phase 
progress
 bounded operational retention and stale replay after cleanup
 all legacy consumers and flag rollback
 additive migration and guard remaining blocked after logical reclamation
All concurrency/tenant contracts require multi-session database-backed tests, not mocks alone.
<PARSED TEXT FOR PAGE: 20 / 20>
Page 20
Retention gap acceptance tests
Retention-gap tests: expire the activation baseline while retaining a later event; replay terminates 
incomplete, admits only independently interpretable unsuppressed facts and creates no guessed 
historical state/derived relationships. Repeat with authorized removal/suppression, unknown 
predecessor cause and bounded unresolved in-window gaps; no production writes, reviews, 
notifications or paid calls occur. Simulate an unacknowledged seal surviving >730 days with no 
uploads, data-only upload and both uploads; verification/ack at or crossing the exact deadline fails
closed, pending events survive and pressure limits hold. Authorized replacement tests cover 
atomic transfer/fencing, original event IDs/hashes/times, stale old callbacks, replacement 
upload/ack crashes, duplicate old objects, suppression precedence and separately authorized old￾object cleanup; no replacement/reset occurs without authorization.
