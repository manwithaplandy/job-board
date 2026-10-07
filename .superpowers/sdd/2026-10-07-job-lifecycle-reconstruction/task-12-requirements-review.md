# Task 12 independent permitted requirements and code-quality review

Requirements verdict: **CHANGES REQUIRED**.

Code-quality verdict: **CHANGES REQUIRED**.

Two Important findings below prevent acceptance. No Critical or separate Minor findings. These are ordinary correctness/bounded-reader findings in the NEW optional archive projector; this is not an independent security verdict or an old-mechanism review.

## Exact review pins and authority

- BASE: `0f87454e965f3ef8d06b18ce93d23ea621d53b6f`.
- Reviewed HEAD/report: `5ac3beebffcc2d37eb506610015e40ce5f3c7b99`.
- Source commit: `a6dd9193076dad21017bf53b49965c7df168452d`.
- Package: `task-12-review-package.md`, all 1,546 lines, full BASE..HEAD.
- During review the working HEAD was `80f61fdb7ae8972778429c96ff5c7b0d5083e8a3`; read-only diff inspection showed only controller documentation/package/dispatch additions after reviewed HEAD. Product review remains pinned above.

Read the reviewer dispatch first, Task 12 brief, REVIEW-SCOPE-AMENDMENT.md, RELEASE-AUTHORIZATION.md, full author report and review package, CURRENT/rulings Task 12 compatibility ruling, relevant binding specification archive contracts/replay/retention sections, all changed product/test source, and the recorded ordinary evidence. The accepted codec/seal definitions were read to assess the new reader's calls and compatibility. A narrow producer-envelope/baseline lookup supplied integration context only; no old enforcement assurance follows.

Compatible defaulted ProjectionResult metadata appended after its original two fields is authorized. Permanent whole-aggregate suppression remains authoritative across all revisions/object versions; the snapshot epoch supplies provenance only. Neither choice is a finding. Release authorization does not expand this review into production operations or the expressly omitted Task 3 reviews.

## Important R12-1 — present input can override declared coverage

Location: `job_discovery/archive/replay.py:340`, `:415`, `:425`, `:446`; existing test at `tests/test_archive_replay.py:289`.

The coverage floor is consulted only inside `if candidate is None`. Input retention excludes removed/expired events but does not exclude revisions below `coverage_starts`. Consequently, with the ordinary existing fixture shapes, declare `coverage_starts=(("jobs", "job-1", 3),)` and supply eligible baseline revision 1 plus revisions 2 and 3. Source tracing shows all three retained, traversal reaches baseline 1, and the result reports `complete_from_baseline`, `baseline_revision=1`, and a fact with `history_complete=True` and full body fields such as `company_id` and `closed_at`. There is no terminal outside-coverage gap. This outcome is determined directly from the code; I did not execute it.

The binding replay contract requires a terminal incomplete result when the needed baseline/predecessor is outside declared coverage, with only independent facts from later eligible events. A physically available older object must not silently expand the policy's declared coverage. The current test omits revisions 1 and 2, so it exercises only an absent predecessor and cannot detect this case.

Required correction: apply the declared coverage floor to input eligibility and/or traversal before accepting a present candidate or baseline; keep coverage, ranges, applied IDs and gap provenance consistent with that policy. A later baseline at or above the floor can still anchor its explicitly declared coverage, and pre-activation history must remain unknown.

Necessary narrow evidence: ordinary offline fixtures for a present below-floor baseline with a contiguous later chain, a relationship whose full fields must remain unavailable in that case, and an at-floor baseline that remains usable. Verify terminal `outside_declared_coverage`, incomplete provenance, independent-only eligible fields and no falsely retained below-floor range. No database, provider, old enforcement suite or broad rerun is needed.

## Important R12-2 — membership tuple traversal precedes any cardinality bound

Location: `job_discovery/archive/replay.py:280`–`:281`, `:303`–`:327`; unchanged callee `job_discovery/archive/batches.py:225`–`:229`.

The total reader iterates every `ref.ordered_event_ids` entry with `any(...)` before checking the bounded member-event tuple or any event/byte budget. It verifies only that the ID container is a tuple, without an O(1) length cap or equality check against the bounded event bytes. A malformed membership descriptor containing N valid UUID entries alongside one ordinary event therefore causes an N-entry scan; `max_events` still charges just one event, and the serialized byte budget does not account for those excess descriptor entries. If the ordinary bytes fit, reconstruction subsequently materializes another N-entry tuple of UUID strings in `seal_batch` before detecting membership mismatch. N has no reader-enforced limit and no deadline check occurs within either traversal.

This is a bounded-input validation defect even though the final result eventually rejects the malformed seal. The stated cooperative deadline exception is for already bounded CPU units; here the unit itself is not bounded by ReplayLimits or the 2,000-event seal cap. Valid accepted seals naturally have bounded membership, but a total reader must establish that invariant before iterating an input descriptor it is validating. This finding is static inspection of the new parser's ordinary count-validation ordering, not a resource-stress execution or an old physical-capacity probe.

Required correction: validate tuple types and O(1) cardinalities, the per-seal cap, membership/event-count agreement, and applicable remaining event budget before iterating membership IDs or invoking the accepted seal builder. Preserve existing codec/seal interfaces.

Necessary narrow evidence: small ordinary mismatched-count descriptors plus a 2,001-ID descriptor are enough; establish early rejection before codec reconstruction/type traversal as appropriate, with sanitized error/no facts. Do not allocate huge inputs or run timing/resource/adversarial experiments. Focused new unit cases and relevant directly affected reader cases suffice.

## Evidence read and requirements assessment

Recorded final command was `.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py -q`: **48 passed in 1.11s**, exit 0, no skips/deselections. Collection lists 44 replay cases and four codec cases. I read the actual saved outputs, including decompressed raw gzip outputs; no pytest, collection, Ruff or other author-covered verification command was rerun.

Recorded chronology: missing-module RED (exit 2); first 36-pass development run; serializer boolean RED (1 failed/42 passed, exit 1); two 47-pass runs; two elapsed-UTC RED outputs with the fixture clarification preserved; final 48-pass GREEN. Ruff output is `All checks passed!`. Versions are Python 3.12.14, pytest 9.1.1, Ruff 0.15.20, psycopg 3.3.6. Commands, inventory, collection, exits, versions, all eight source/dependency digests and the saved eight-OK hash verification were read. The controller separately confirmed those eight hashes against current files; this reviewer does not relabel that controller action as a new independent test execution.

| Requirement | Permitted review assessment |
| --- | --- |
| Pure optional admin projection; no app restore or side effects | Implemented as an in-memory internal API. Imports/call path and recorded socket/DB/subprocess guards plus application/provider call tracing support ordinary purity. No runtime adapter or authenticated endpoint is supplied. |
| Finite events/bytes/deadline/depth | Limits, byte accounting, JSON-depth scan and bounded predecessor/suppression walks are present. Membership cardinality ordering remains incomplete under R12-2. Cooperative deadline and local nonblocking iterable limits are honestly documented. |
| Total envelope/schema interpretation and seal compatibility | Exact envelope/schema/revision/identity/predecessor checks, canonical JSON, fixed diagnostics and accepted seal reconstruction are present. Existing codec/seal functions are unchanged. R12-2 concerns work performed before malformed membership rejection. |
| ID/hash deduplication, conflicts and stale ordering | All copies are inspected for conflicts; exact duplicates deduplicate; latest retained per-aggregate revision wins. Recorded ordinary tests support these behaviors. Eligible reseals may extend the same event's retained eligibility; this reader grants no reseal authorization. |
| Missing prefix, explicit incomplete provenance and terminal gaps | Finite walks, known/unknown gap reasons, exact disjoint revision ranges and independent-fact allowlist are implemented. R12-1 prevents full approval of outside-declared-coverage behavior. |
| Archive eligibility and projection retention | Elapsed UTC 730-day seal validation, expired-copy exclusion, earliest prefix-dependency expiry and recomputation behavior are implemented and represented in recorded tests. This concerns archive retention only. |
| Suppression and current/noncurrent objects | Supplied whole-scope markers dominate all copies and later snapshot labels; direct endpoint dependency suppression is conservative and bounded. In-memory fixtures match the approved pure snapshot contract. No DB marker mechanism changed. |
| Public-only facts, corrections and no graph inference | Existing public validator is reused; independent fields exclude prefix-dependent relationships/lifespan. Explicit assertion status replacement/retraction is covered. No automatic merge, traversal product or graph engine was added. |
| Interface compatibility and scope | Existing result positional fields remain first; added fields default. No codec/seal/export/S3/migration/runtime entrypoint modifications appear in the pinned diff. |

## Implemented, tested, independently reviewed and deliberately unreviewed limits

Implemented: the pure Task 12 projection module, replay-local policy/limits/input wrapper, additive output records/defaults, independent-fact fields, and ordinary offline tests. R12-1/R12-2 remain implementation gaps.

Tested by author: the recorded 48 selected offline cases and stated development RED/GREEN sequence. Neither finding has a reviewer execution result; both have explicit source-based reasoning and narrowly requested author evidence. No new tests were executed here.

Independently reviewed here: only new Task 12 ordinary feature requirements, input/output interpretation, bounded parsing structure, maintainability/compatibility and supplied evidence. The source is generally focused and preserves accepted shared interfaces, but coverage eligibility and validation ordering require correction before either verdict can pass.

Deliberately unreviewed: Task 3 independent lease-expiry enforcement, physical-capacity accounting, cross-user isolation and related adversarial review/probes. No retry, reproduction, substitute reviewer/tool/probe or old mechanism assurance was attempted. No database, cloud, S3, IAM, provider, production, paid, deployment, activation, removal or release action occurred. No source/test edits, helper agents, Git mutation or author-covered test reruns occurred; the sole write is this requested review report.

Integration limits remain explicit: a future trusted adapter must establish approved archive access, current time and a complete fresh service-owned suppression snapshot; the Boolean policy field is not external authentication. Consumers must discard/recompute output at eligibility/snapshot changes. Optional current-PG bootstrap, marker fetching, object loading, persisted projection serving, removal/provisioning and production use are absent. Synthetic sealed inputs cannot establish production readiness or any omitted security verdict.

Next step: same author corrects R12-1/R12-2 and records focused ordinary evidence, then this same reviewer assesses those findings and fix-introduced Important/Critical issues only. No whole-task or old-suite rerun is requested.

DONE — requirements CHANGES REQUIRED; code quality CHANGES REQUIRED — STOP.
