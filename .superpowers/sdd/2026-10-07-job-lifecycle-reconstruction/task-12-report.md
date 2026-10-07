# Task12 author report — bounded optional public archive projection

Status: implemented and locally verified; controller-dispatched independent permitted requirements/code-quality review is pending. This is not security approval, production restoration, archive activation or release readiness.

Base: `0f87454e965f3ef8d06b18ce93d23ea621d53b6f`. Source commit: **`a6dd9193076dad21017bf53b49965c7df168452d`**. Accepted Task11 source `4ff6d7061ed2414ede66f9e6c878cfd717cd1ff4`, report `c91efc6`, review through `7c43e19` and checkpoint `11libfile_c221028586448191a44b35e1b8baee42` were preserved. Sole author; no helpers/subagents/reviewers were spawned.

## Implemented behavior and compatibility ruling

`job_discovery/archive/replay.py` adds `project_archive(manifests, policy, limits) -> ProjectionResult`, a synchronous pure optional admin projection. `Manifest` wraps an in-memory accepted immutable `SealedBatch` and opaque current/noncurrent object-version label. No loader, destination discovery, S3 access, SQL connection, bootstrap or runtime invocation is added. Only synthetic local test projections were executed.

Before editing established interfaces, the author reported that Task10's `ProjectionResult` had only `applied_event_ids` and `ignored_event_ids`, and that Manifest/policy/limits types did not exist. The controller explicitly approved replay-local wrapper/policy/limits and additive defaulted result metadata following the two existing fields. Existing positional constructors remain compatible. Added metadata: facts, coverage, gaps, exact disjoint retained revision ranges, sanitized errors and suppression snapshot epoch. New fact/coverage/gap records remain in accepted archive/types.py. Existing producer/codec/seal/export behavior is unchanged.

The total reader checks exact version1 envelope fields, exact deterministic event identity and predecessor, strict integer revisions/schema/serializer fields, typed allowlisted public bodies, aware occurrence/observation/record times, and accepted public provenance. It validates canonical JSON and reconstructs the complete accepted immutable seal to compare manifest/content/keys/counts/digests/membership. Unknown schema, malformed inputs, content/seal changes, conflicting event hashes or exhausted work budgets fail the whole run closed with no facts; diagnostics contain fixed error codes, never input bodies or URLs. This reuses `seal_batch` without changing accepted batching or serialization.

Exact same-ID/same-hash objects deduplicate, including current/noncurrent copies. A conflicting hash fails closed regardless of ordering. Duplicates, expired objects and rejected input bytes consume the bounded input budget. An eligible explicitly resealed copy can contribute the unchanged event when an older copy has expired; suppression still overrides both. Supersession/reseal authorization itself belongs to accepted Task11; this pure reader does not grant it.

Per-aggregate revisions are interpreted independently of object order and global timestamps. The latest retained event supplies projected fields, so stale arrivals cannot overwrite it. A retained baseline anchors coverage from that revision only, including activation baselines above revision1; `complete_history` is always false because pre-activation history is not established. `history_complete` on a fact means contiguous history **from its declared baseline**, not all posting history. Retained ranges are disjoint and never bridge missing revisions. Output applied IDs represent eligible interpreted events; duplicate/excluded IDs appear in ignored IDs and these can overlap when the same ID has both an excluded/duplicate copy and an eligible contributing copy.

A missing predecessor is considered only within this finite run. The result reports terminal `retention_gap` with known cause `expired`, `removed`, `outside_declared_coverage` or `depth_limit`; absent evidence remains `unknown`. There is no automatic prefix fetch/retry. With an unavailable prefix, only version1 `INDEPENDENT_FACT_FIELDS` in schema.py can contribute: public descriptive identity/metadata fields, no closure/discovery/lifespan fields, foreign endpoints, inferred identity or relationships. Relationship schemas have no independent-field allowance. A complete explicit assertion can retain or retract its stated status and provenance, without inference or transitive merging. No lifespan calculation or inferred/derived relationship engine exists.

Every fact includes source event ID/hash, revision, distinct occurrence/observation/recorded times, public provenance, incomplete-history flag and eligibility boundary. A prefix-dependent fact expires at the earliest seal expiry among its dependencies. Recomputing after that boundary removes expired input and changes remaining later events to independent-only facts. Pure output is not stored or maintained automatically: consumers must discard/recompute at eligibility and suppression snapshot changes. All seal windows require exactly730 elapsed UTC days, not wall-clock arithmetic across daylight-saving offsets.

## Suppression precedence and trusted boundary

The actual accepted service-only `public_archive_suppressions` table contains `(aggregate_type, aggregate_id, suppressed_at, reason)` and has a whole-scope primary key. It has no event epoch column. The controller approved preserving permanent whole-scope precedence across all revisions/timestamps/object versions; no schema or enforcement mechanism changed. `Suppression` fixtures mirror that snapshot. A policy `suppression_epoch` labels the trusted snapshot used; it cannot lift suppression, reinterpret an event epoch or authorize reopening. The reader does not fabricate a persisted epoch mechanism.

Supplied markers win regardless of whether object copies are current/noncurrent, whether events are newer, or whether the snapshot label increases. Explicit endpoint references propagate suppression conservatively, within the depth bound, so dependent facts cannot retain removed endpoints; unfinished suppression closure fails closed. No object deletion/removal command, database marker mutation or lifecycle provisioning exists. Tests use authorized **in-memory** suppression fixtures only; no PostgreSQL tests were needed because no DB behavior changed.

`ProjectionPolicy(admin_authorized=True, as_of=<aware current snapshot>, suppressions=<complete service snapshot>, ...)` is a trusted internal caller contract, not authentication infrastructure. The caller must obtain authorized read access, supply a complete current service-owned suppression snapshot and current time, and enforce output disposal. There is no end-user endpoint or current-PG bootstrap. Historical arbitrary-time access, authentication, marker retrieval, cloud object loading and serving/persisting projections are not implemented. Suppression snapshot freshness cannot be independently proved by a pure function; a future adapter must establish it before calling. This is an explicit integration limit, not a claim that a caller boolean secures external access.

## Exact finite limits

| Limit | Default | Maximum accepted |
| --- | --- | --- |
| Event occurrences, including duplicates/expired copies |10,000|100,000|
| Input byte accounting |64MiB|128MiB|
| Deadline |30seconds|120seconds|
| JSON/prefix/suppression depth |64|256|
| Input manifests |2,000|10,000|
| Suppression/coverage snapshot entries |bounded tuple|100,000 each|

Byte accounting charges canonical, compressed, manifest and member-event byte representations, including duplicate copies; it is deliberately stricter than expanded-only accounting. Every individual seal retains accepted caps of2,000 events,16MiB compressed,8MiB canonical/expanded and1MiB manifest. Each event envelope is capped at16KiB before JSON parsing; accepted body validation remains8KiB. Positive finite values only; boolean integer ambiguity and NaN/infinity are rejected. JSON nesting is scanned before recursive decoding. Predecessor traversal and suppression propagation terminate at the depth cap. Deadline checks surround bounded CPU units and occur during event/scope walks; the caller-supplied iterable must be local and nonblocking. A cooperative deadline cannot interrupt an arbitrary blocking Python iterator, OS suspension or an already-running bounded codec unit; no hard process sandbox is claimed.

## Actual verification and chronology

Pre-execution ordinary-case inventory is `task-12-evidence/inventory.md`, including subsequent test extensions before each execution. Final source/dependency hashes were recorded **before** final verification and verified unchanged afterward. Full output, exits, collection inventory, versions and commands are retained. No broad pytest or old security/activation suite ran.

| Phase | Exact selection | Result |
| --- | --- | --- |
| Initial RED |new replay file|missing replay module,1 collection error,exit2,0.35s|
| First implementation |new replay file|36 passed,exit0,0.19s|
| Extended interpretation RED |new replay file|1 failed/42 passed,exit1,0.35s; boolean serializer accepted as integer1|
| Corrected integration |replay + four codec cases|47 passed,exit0,0.26s|
| Stronger side-effect assertion |same files|47 passed,exit0,0.23s|
| UTC arithmetic RED |exact new elapsed-UTC node|1 failed,exit1,0.20s|
| Corrected valid-local-time UTC RED fixture |same node|1 failed,exit1,0.20s|
| **Final GREEN** |**44 replay +4 codec cases**|**48 passed,exit0,1.11s; no skips/deselections**|

Final command:

```text
.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py -q
```

The initial malformed aggregate-ID fixture changed from an unhashable list to None so the existing synthetic seal builder could construct the envelope and the new reader could reject it. This happened before the first implementation run. The first UTC RED used01:30 at a DST transition; it was refined to valid00:30 local times and failed identically before correcting production UTC arithmetic. Both outputs are preserved. The admin/time test was renamed to describe its actual assertions; bootstrap absence is an implementation/integration fact, not claimed as a dedicated test.

Final ordinary coverage includes exact-ID/hash duplicates/conflicts; stale/shuffled ordering; malformed/unknown schema/envelope fields; baseline expiry with eligible later event; terminal unknown/outside-coverage gaps; non-reconstructed lifespan/relationship fields; activation baseline revision5; current/noncurrent removed copies; snapshot labels unable to unsuppress; dependent endpoint suppression; eligible reseal after old-copy expiry; projection expiry and earliest-prefix eligibility; seal-byte corruption; finite infinite-iterator input stopping on event/byte/manifest budgets; cooperative deterministic deadline; JSON and predecessor depth; invalid finite limits; explicit admin/time contract; complete identity assertion retraction without inference; exact disjoint revision ranges; strict serializer types; elapsed UTC seal horizon.

The side-effect test installs socket/psycopg/subprocess fail guards and traces Python calls at reviewer, provider, lifecycle and current-state database module boundaries: zero calls during actual projection. Dashboard generation/notification code has no import or process/network bridge. This establishes ordinary pure execution; no production system was contacted to prove a negative. It is not a substitute security test.

Python3.12.14, pytest9.1.1, Ruff0.15.20 and psycopg3.3.6 recorded. Ruff passes for all four owned source/test files. Scoped staged whitespace check passes. No PostgreSQL server ran: existing PG17/16 evidence remains historical Task11 evidence, not re-attributed to Task12. No DB/RLS/claim/capacity behavior changes require a DB rerun here. No source changed after final GREEN and source commit.

## Integration inventory and deliberately omitted work

Owned implementation: new replay.py and test_archive_replay.py; additive result records/default fields in archive/types.py; additive independent-field constant in archive/schema.py. Existing schema validator code is unchanged. Accepted seal/codec/export/S3 modules, migration/schema.sql, dependency registration and runtime entrypoints are unchanged. No dashboard, reviewer/model/pricing settings, identity/private FKs, legacy timestamps or RLS changes. Four controller ledger files remain unstaged and excluded from author commits.

Live read-only `git ls-remote origin refs/heads/main` returned `a8c4b82d95b35c0259600c19c1506faae807c3fc`, matching Task11's accepted upstream; `git merge-base --is-ancestor` verified it is already in the base. The local origin/main cache is stale (`73ce118`); it was not mistaken for live main. No upstream delta needed integration. No fetch/reset/rewrite/push/PR/merge/deploy/activation occurred.

Flags remain default off, retirement dry-run, archive producer/export inactive without approved destination/readiness. No real archive objects, destination coordinates, credentials/IAM/provider/S3/production access, paid/model calls, app DB restore, current-state reopening, automatic merges, graph product or Parquet engine were used/added. No permanent deletion/removal/lifecycle-provisioning command exists. Optional current-PG bootstrap is explicitly unimplemented.

Task3 expiry/physical-capacity/cross-user/adversarial reviews/probes remain deliberately omitted under the amendment. New expiry checks concern only Task12's archive-replay retention horizon, not old claims or physical accounting. No independent security verdict is inferred from these passes. Independent permitted Task12 review, all13 completion, final review and any release remain the controller's responsibility. Combined production resource sizing, approved destination validation and fresh suppression snapshot integration remain prerequisites for future use. Existing Task11/Task3 limitations are not resolved by this pure feature.

No platform safeguard rejection occurred. A skill ancillary-resource read returned `failed to read skill resource`; no bypass or missing task requirement followed. The TDD skill's generic broad-suite recommendation was superseded by explicit task/review-scope restrictions. All implementation was completed within the permitted ordinary offline scope.
