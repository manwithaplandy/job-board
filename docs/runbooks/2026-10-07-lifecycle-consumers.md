# Lifecycle consumer cutover and rollback

Task9 adds read-only feed consumers; existing flags default off, retirement is
still dry-run and archive inactive. Install the additive feed migration before
this dashboard/reviewer version. Do not enable feed semantics until source
mapping/readiness and the separately required rollout checks are complete.

The public read interface is `lifecycle_job_state(job_id)` (nullable JSON with
only feed/source booleans, availability, frozen anchor/expiry and public payload
availability), `lifecycle_discovery_visible(job_id, legacy_closed_at, older_live)`
and `lifecycle_source_closed(job_id, legacy_closed_at)`. These fixed, schema-
qualified read-only functions run with a fixed search path. They preserve the
service-only table grants; dashboard reads retain `withAnonSql`/`withUserSql`.
They expose no user, private snapshot, claim, capacity or source credential data.
The narrow read capability needs normal release review; ordinary feature tests
are not independent security approval.

A mapped listing is discoverable before its persisted expiry (strictly greater
than the statement timestamp); expiry is exactly anchor + 720 hours. Sightings,
private use and flag toggles do not establish a new anchor. Current unknown
availability can appear, labelled Source unknown. Expired unknown and closed
listings do not pass the older-live option; expired confirmed open listings do.
Any eligible source listing can keep a Job discoverable. The displayed listing
prefers a nonclosed current source, then open state, then latest frozen expiry,
with stable listing-ID ties. All proven-closed mappings remain excluded on
flag rollback. Unmapped rows return NULL lifecycle data and use legacy
`closed_at`; no source state or anchor is invented. Mapping completeness is a
rollout prerequisite, since unmapped legacy rows have no new horizon proof.

The public board evaluates discovery per request; its previous 120-second ISR
cache is disabled so cached pages cannot cross the exact expiry boundary. This
increases anonymous read traffic; no throughput/load performance claim is made.

`older=1` is the explicit navigation option; saved filter JSON cannot silently
activate it. `page` and `historyPage` independently page at 500 rows, with stable
first-seen/job-ID order. One statement returns the matching total and page under
the same membership/time snapshot. Client facets, filtered rows and N-of-M count
use the same loaded view pool; these are page-local filters, not full-corpus
search/count claims. Pagination and total are shown separately. Existing newest
sort remains the original discovered date, readable independently of the frozen
feed anchor and source publication time; it does not claim an employer posting
age. Direct detail reads are not restricted by discovery expiry.

History reads are owner scoped and select persisted approval, correction, or
application package work independently of expiry, source closure, review errors,
profile location/company exclusions and discovery filters. History has its own
count/page and actual card-to-detail path. Existing application package snapshot
JD/Q/version and demand receipt rules remain authoritative. Saved answers with
NULL historical questions are retained as orphan answers and labelled unavailable
history; no current question schema is borrowed. Ready current detail remains
separate from saved review/application inputs. A proven-closed detail does not
queue new current hydration; retained work stays readable. Real old generated
artifacts whose original inputs cannot be recovered still terminal-defer: full
atomic input recapture is UNIMPLEMENTED. Contentless instruction/application
markers can establish a first actual input under the existing Task8 contract.

## Actual timestamp/payload consumer inventory

Executed before edits and after cutover:
`rg -n 'first_seen|last_seen|closed_at|description_pruned' reviewer dashboard job_discovery`.
Every returned line is retained in Task9 evidence (`task9-consumers.txt` and
`task9-consumers-final.txt`), including test fixtures. This table accounts for all
returned production modules; the fixture groups below account for all returned
test-only modules. Line numbers are historical evidence, not stable interfaces.

| Consumer | Final purpose / disposition |
| --- | --- |
| `reviewer/db.py` | Candidate count and bounded newest-first rows share one statement/snapshot and the DB discovery predicate; no automatic older opt-in. Payload-pruned gate remains hydration-dependent. Private persistence/snapshots unchanged. |
| `dashboard/lib/jobsQuery.ts` | Discovery rows/counts/page share the predicate; closed status uses source closure separately. Owner history bypasses discovery/profile predicates. Lean rows include parsed lifecycle projection; first-seen sort remains legacy readable. |
| `dashboard/lib/queries.ts` | List mapper retains original timestamps and total-parses lifecycle/skill gaps. Actual page/count uses one statement. Review pool statistics and distinct locations use discovery. Saved detail/private package reads remain owner scoped and horizon independent; detail JSON arrays validated. Review-feed arrivals use the same builder. |
| Analytics captions/KPI/glossary | Discovery totals are labelled discovery rather than employer open. Saved review distributions and applied totals identify retained history. Legacy closure-duration bins are labelled observed closure duration. |
| `dashboard/lib/metrics.ts` | Discovery pools/distributions use discovery; closed counts use actual closure, not expiration. Applied and approval/private aggregates retain their owner-scoped history. Lifespan bins explicitly retain historical `closed_at - first_seen_at`; they are legacy observed closure durations, not expiry durations. |
| `dashboard/lib/types.ts` | Legacy timestamps remain readable; lifecycle DTO is separate and nullable. |
| `dashboard/lib/rolefit/filter.ts` | Newest sort retains first observed date; filtering/facets/row totals share the selected loaded discovery/history pool. |
| `dashboard/components/rolefit/JobDetail.tsx` | Labels original date Discovered, plus distinct source/expiry/payload labels. Current and immutable saved contexts remain separate; honest NULL-question copy. |
| `dashboard/components/rolefit/VisualBoardState.tsx` | Test/demo fixture date only, no production filtering or mutation. |
| `job_discovery/db.py` | Existing compatibility ingestion timestamps/open-ID enumeration, legacy close/reopen, missing-question selector. Unchanged writers: permitted only in their existing bounded/gated legacy path; postcutover capture predicate disables unconditional refill. Do not restart old writer binaries during rollback. |
| `job_discovery/prune.py` | Existing legacy closure cleanup selector, bounded gate, durable cutover exclusion. Never run alongside new identity-preserving maintenance; last-seen is never a deletion cutoff. Unchanged. |
| `job_discovery/lifecycle/identity.py` | Existing first-observed identity migration and frozen 720-hour anchor; preserves legacy closure provenance, no invented use dates. Unchanged. |
| `job_discovery/lifecycle/reconcile.py` | Existing verified sightings/miss reconciliation updates legacy closure mirror; suspicious/partial feed handling unchanged. Feed rollback is not a new source observation and does not reopen mappings. |
| `job_discovery/lifecycle/demand.py` | Existing source coordinates plus no-refill/private-snapshot hydration contract. Current saved package data and real receipts retained; no blanket consumer rollback to cache backfill. |
| `job_discovery/lifecycle/maintenance.py` | Existing retirement stamps payload pruning, keeps lean identity and protected history; durable cutover marker prevents restarting destructive legacy prune. Unchanged enforcement/dry-run. |

Returned test/demo consumer groups: `queries.reviewFeed`, `queries.locationScoping.db`,
`queries.boardLocationScoping.db`, `queries.boardInclude.db`, `jobsQuery`,
`rolefit/filter`, `rolefit/JobDetail`, `ReviewNowPanel`, `JobCard`,
`ApplicationPanel`, `RolefitBoard.liveMatches`, `RolefitBoard`,
`RolefitBoard.rejectAffordance`, and the new `jobLifecycleConsumers` unit/DB tests.
Those fixture timestamps remain legitimate legacy representations; new tests
cover lifecycle display and owner history without changing old observations.

## Safe coexistence and rollback

The new read-only dashboard/reviewer can coexist with Task8 source/demand/private
snapshot writers and service-only lifecycle state. Before activation, flag-off
legacy reads remain compatible with mapped and unmapped rows. Legacy timestamp
fields remain populated/readable; they are not source completeness evidence.
After mapping/feed cutover, compatible source reconciliation stays authoritative.
Do not use old dashboard/reviewer builds that equate pruning/expiry with closure
or hide retained private history. Roll back to this compatible read version and
pause relevant flags/workers, retaining every additive row, immutable snapshot,
anchor, use/capture provenance, pending event and durable cutover marker. Never
reset first-seen/anchors, refill retired caches, clear source closure proof, resume
unconditional backfill or restart destructive legacy prune to make a rollback
look healthy. If a compatible writer cannot progress, report degradation and
preserve state; do not switch to old bypass paths.

R6-4 physical-guard closure/health progress remains mandatory Task10/13 work.
R6-5 shared public transport is reused unchanged; prior offline results are not
live-provider/load proof. Task3's omitted independent expiry-enforcement,
capacity-accounting, cross-user/adversarial review remains deliberately absent.
This runbook and Task9 functional feed tests do not supply that assurance.
