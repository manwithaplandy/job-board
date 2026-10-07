# Task12 Fix1 — declared coverage and early membership bounds

Status: both original Important findings corrected and focused ordinary verification passed. Same-reviewer reassessment of R12-1/R12-2 and fix-introduced Important/Critical issues remains pending. No independent acceptance or security approval is inferred.

FixBASE: `5ac3beebffcc2d37eb506610015e40ce5f3c7b99`; actual starting HEAD `7291e2b` contained controller documentation only since that pin. Original source `a6dd9193076dad21017bf53b49965c7df168452d`. Fix1 source: **`ecba747343369c26041ef5655ed56b044d7098a0`**. Sole original author; no helpers, subagents or reviewers spawned. Only replay.py and new test_archive_replay_fix1.py are in the source commit.

## R12-1 correction

The review correctly identified that the old floor check ran only after a predecessor lookup failed. Present older events could therefore expand declared coverage. Input classification now excludes every revision below that scope's declared floor before insertion into the retained map. Those IDs remain ignored, cannot appear in applied IDs or retained ranges, cannot supply a baseline or prefix-dependent fields, and retain explicit `outside_declared_coverage` gap provenance. Existing exact-byte/conflict validation still applies to input copies; the floor does not allow conflicting archives to evade validation.

Whole-scope suppression retains first precedence; outside-declared-coverage follows, then archive expiry. Since all retained candidates satisfy the floor, a predecessor walk cannot accept a present below-floor baseline. A baseline at the floor remains usable and anchors only its stated history. A per-scope set of known exclusion reasons also replaces the old hardcoded `expired` reason when nothing remains eligible: entirely outside-coverage input is reported truthfully. Multiple known exclusion reasons can be reported without inventing one cause or rescanning the full event map for every scope.

Four new ordinary fixtures verify present eligible baseline1 plus contiguous revisions2/3 under floor3; the same case for a public relationship with no independent facts; a usable baseline3 and revision4 with earlier1/2 excluded; and a scope whose inputs are all below floor. Assertions cover terminal reason, incomplete provenance, independent-only fields, unavailable relationship facts, retained ranges, applied/ignored IDs and no invented complete posting history.

## R12-2 correction

Before any membership ID traversal or call to the unchanged accepted seal builder, the reader now verifies both descriptor containers are tuples, obtains cardinalities with the built-in O(1) `tuple.__len__`, enforces1..2,000 members, requires exact equality with event-byte count and strict integer declared event_count, and checks cumulative remaining max_events. Only then does the existing member-type/envelope/byte/seal validation proceed. The former late duplicate event-count check was removed. Invalid count descriptors return sanitized `invalid_membership_count` with no facts; an exhausted remaining event budget returns `event_limit` with no facts. Accepted codec/seal interfaces and implementations are unchanged.

Five small malformed descriptor fixtures use ID/event/declared counts2/1/1,1/2/2,2001/1/1,0/1/1 and1/1/2. A tuple subclass fails if its iterator is invoked, and a guard fails if rejected input reaches seal reconstruction. GREEN therefore establishes rejection order, not merely eventual rejection. A sixth fixture first accepts one ordinary event, then rejects a two-event descriptor when only one event remains in the run budget, before traversing that descriptor or rebuilding its seal. The largest descriptor contains2,001 UUID references; no large allocation, stress, timing/resource experiment, DB or old capacity probe was used.

## Actual evidence and phases

`task-12-fix1-evidence/inventory.md` was written before execution and names every new fixture and directly affected existing node. The first run failed collection because the new test used an incorrect unqualified helper import; it was corrected to `tests.test_archive_replay`. No product change occurred before intended RED. The corrected RED executed all10 new cases against the original reader and all10 failed as expected: four coverage/range/fact failures and six membership-before-bound guard failures. The only subsequent fixture edit was Ruff formatting. All failures and exits are retained, including the initial fixture import error.

| Phase | Exact scope | Actual result |
| --- | --- | --- |
| Initial fixture setup |new Fix1 test file|1 collection error,0.26s,exit2|
| Intended RED |10 new Fix1 cases|10 failed,0.73s,exit1|
| Final GREEN |10 new +10 directly affected existing cases|**20 passed,0.19s,exit0; no skips/deselections**|

Final exact command:

```text
.venv/bin/python -m pytest tests/test_archive_replay_fix1.py tests/test_archive_replay.py::test_outside_declared_coverage_is_terminal tests/test_archive_replay.py::test_missing_predecessor_unknown_cause_is_terminal_without_retries tests/test_archive_replay.py::test_expired_baseline_terminal_gap_independent_facts_only tests/test_archive_replay.py::test_projection_expiry_recomputes_no_retained_facts_after_horizon tests/test_archive_replay.py::test_exact_id_hash_dedup_and_stale_order_preserve_latest_and_times tests/test_archive_replay.py::test_finite_input_budgets_fail_closed tests/test_archive_replay.py::test_total_manifest_rejects_unknown_or_boolean_serializer -q
```

The existing nodes specifically cover absent-prefix unknown/coverage/expiry reasons, all-expired empty-retained handling, bounded valid membership and duplicates, finite input budgets, and strict manifest serializer types in the changed validation path. No whole original44/48 run, codec file, unaffected feature flow, DB suite, activation suite or omitted security test ran. Collection of this exact20-case selection is retained separately; it did not execute tests.

Python3.12.14, pytest9.1.1, Ruff0.15.20, psycopg3.3.6. Ruff and staged source whitespace checks pass. Eight final hashes were captured before GREEN and verified unchanged afterward: reader, new tests, unchanged original tests/schema/types/seal/codec/dependency manifest. No source changed during or after GREEN; source commit is the tested content. RED was executed against the original pinned reader; no separate pre-RED hash file was captured. Exact raw test outputs are preserved as deterministic gzip, and readable copies normalize trailing whitespace only. Full commands, exit files, collection, hashes and versions are in the evidence directory.

## Integration scope and remaining limits

The change is limited to new pure reader eligibility/diagnostics and validation order. Result constructors, policy/limit contracts, permanent whole-scope suppression and snapshot-provenance-only epoch remain as approved. No accepted producer, codec/seal, S3/export, DB/schema/migration, RLS/identity/private FK, current-state writer, reviewer/model/pricing setting, runtime invocation or dependency changes. No DB behavior changed, so no PostgreSQL17/16 rerun was needed or attributed to this fix. Current-PG bootstrap remains explicitly unimplemented.

Original integration limits remain: a future trusted adapter must establish authorized archive access, current time and a complete fresh service-owned suppression snapshot; the admin policy boolean is not external authentication. Output consumers must discard/recompute on retention/suppression changes. The deadline is cooperative for bounded work and assumes a local nonblocking iterator, not a process sandbox. No real archive/cloud/provider/S3/production access, configuration, credential/IAM work, deletion, activation, push/PR/merge/deploy or release action occurred. Flags stay default off, retirement dry-run, archive inactive pending approved destination/readiness. Task3 expiry/physical-capacity/cross-user/adversarial reviews/probes remain deliberately omitted; no substitute review or probe occurred.

No safeguard rejection occurred. The corrected fixture import failure was an ordinary local test setup error. Controller owns same-reviewer reassessment, remaining tasks/final review and release. Original verdicts remain CHANGES REQUIRED until that reassessment; this report claims implementation plus focused author verification only.
