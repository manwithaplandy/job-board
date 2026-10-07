# Task 12 Fix1 — same-reviewer scoped reassessment

Requirements verdict: **PASS** within the permitted Task 12 scope.

Code-quality verdict: **APPROVED** within the permitted Task 12 scope.

Original Important findings **R12-1 and R12-2 are CLOSED**. No fix-introduced Important or Critical findings were identified. Together with the original review, this resolves the Task 12 requirements/code-quality blockers; it supplies no omitted security verdict or production-readiness assurance.

## Exact pins and scope

- Original task BASE: `0f87454e965f3ef8d06b18ce93d23ea621d53b6f`.
- Original source: `a6dd9193076dad21017bf53b49965c7df168452d`.
- FixBASE / original reviewed report HEAD: `5ac3beebffcc2d37eb506610015e40ce5f3c7b99`.
- Fix1 source: `ecba747343369c26041ef5655ed56b044d7098a0`.
- Fix1 reviewed HEAD/report: `cc553e934e7caa50876b57bd4d370bce7dca53b7`.
- Review package: `task-12-fix1-review-package.md`, complete pinned BASE..HEAD package, 2,754 lines including controller documentation and the previously reviewed original package.

This is the SAME original reviewer. Review was limited to R12-1/R12-2 closure and fix-introduced Important/Critical issues. I read the full Fix1 report, dispatch, complete product/test diff, changed reader in context, new fixture source, focused inventory/commands/collection/exits, raw recorded test outputs, versions, Ruff output and eight recorded hash entries/verification results. The package's controller documentation and original review/package do not expand this reassessment into a new whole-task or whole-branch review.

## R12-1 — CLOSED

`job_discovery/archive/replay.py:353` now classifies revisions below the declared coverage floor as `outside_declared_coverage` before insertion into retained events. Those events remain ignored and cannot supply a baseline, enter applied IDs or retained ranges, or contribute prefix-dependent fields. The predecessor walk therefore cannot accept a physically present below-floor baseline. A baseline at the floor remains usable with explicitly limited history.

The adjacent empty-retained correction at `replay.py:411` uses recorded per-scope exclusion reasons rather than incorrectly labeling every fully excluded scope as expired. Reasons are deduplicated and sorted, preserving deterministic output without a repeated full-input scan. Direct whole-scope suppression retains first precedence, and exact-byte/hash conflict validation still precedes eligibility filtering.

The four new ordinary coverage fixtures establish: present baseline1 plus revisions2/3 cannot expand floor3; the corresponding relationship supplies no full relationship fact; baseline3 plus revision4 remains usable while earlier revisions are excluded; entirely below-floor input reports a truthful terminal reason. Assertions include incomplete provenance, independent-only fields, retained ranges, applied/ignored IDs and continued absence of a complete pre-activation history claim. Recorded intended RED shows the original failures; final GREEN covers all four.

## R12-2 — CLOSED

`job_discovery/archive/replay.py:277` now checks both tuple containers and obtains built-in O(1) cardinalities before any membership traversal. It enforces 1..2,000 membership IDs, equality with event-byte count, strict integer declared event_count agreement and cumulative remaining event budget. Only accepted descriptors reach UUID iteration, event parsing or the unchanged seal builder. The former late duplicate event-count check was removed without losing event accounting.

Five small malformed-count cases exercise 2/1/1, 1/2/2, 2001/1/1, 0/1/1 and 1/1/2 ID/event/declared counts. Their tuple fixture fails if iteration occurs and their seal-builder guard fails if reconstruction occurs, so the evidence establishes early validation order rather than eventual rejection. A sixth case accepts one event, then rejects a two-event descriptor against the one-event remaining budget before traversal/reconstruction. Errors remain sanitized and facts empty. The largest fixture has 2,001 UUID references; no stress or resource experiment is involved.

No accepted codec/seal interface or implementation changed. The correction remains local to the new pure reader; no old capacity, lease, role or database behavior was modified or independently reviewed.

## Actual evidence and quality assessment

The saved final selection is the ten new Fix1 cases plus ten directly affected existing reader cases. Its command, fully recorded in `task-12-fix1-evidence/commands.md` and the author report, names the Fix1 file plus outside-coverage, unknown predecessor, expired baseline, projection expiry, dedup/stale ordering, finite budget and strict serializer nodes. Recorded result: **20 passed in 0.19s, exit 0, no skips/deselections**. Collection lists those same 20 cases.

I read the decompressed raw outputs. Chronology is preserved: initial test-helper import collection error (exit 2); corrected intended RED with all ten new cases failing against the original reader (exit 1); final 20-case GREEN (exit 0). The import error is a fixture setup error, not the product RED. Ruff reports `All checks passed!`; the author records a passing staged whitespace check. Versions remain Python 3.12.14, pytest 9.1.1, Ruff 0.15.20 and psycopg 3.3.6.

Eight hashes were recorded before GREEN and the saved verification lists eight OK results; the controller independently confirmed all eight against current files. This reviewer read that evidence and does not relabel it as a newly executed test/hash verification. The record explicitly notes that no separate pre-RED hash file was captured. That chronology limitation is retained and does not contradict the observed RED traces or the pinned final-source evidence.

Source changes are focused: replay.py eligibility/count-validation/diagnostics and a new 148-line focused test file. Result constructors, policy/limits interfaces, schema allowlist, original tests, accepted seal/codec and dependency manifest remain unchanged. The corrected ordering and per-scope reason tracking are clear and bounded. No fix-introduced Important/Critical regression was identified in the changed paths. No further test execution or corrective work is requested by this scoped review.

## Remaining limits and deliberate exclusions

Implemented and author-tested: both reader corrections and their ten new ordinary fixtures, with ten directly affected regressions. Original 48-case evidence remains the earlier phase's evidence; the counts are incremental phases, not a claim of an unrestricted full-suite rerun. Independently reviewed here: the two fixes and their directly affected code/evidence only. No reviewer test, collection, Ruff or author-covered command was rerun.

The accepted defaults/interface ruling and permanent whole-aggregate suppression remain unchanged. Snapshot epoch remains provenance only. A future trusted adapter must establish authorized archive access, current time and a complete fresh service-owned suppression snapshot; `admin_authorized=True` is an internal contract, not external authentication. Consumers must discard/recompute at eligibility and suppression changes. The deadline is cooperative and assumes a local nonblocking iterator. Current-PG bootstrap, archive loading, marker retrieval, persisted projection serving and removal/provisioning remain unimplemented. Synthetic offline inputs do not establish production readiness.

Task 3 independent expiry enforcement, physical-capacity accounting, cross-user isolation and related adversarial reviews/probes remain deliberately unreviewed. Nothing here retries, reproduces, disguises or substitutes those omitted scopes. No helpers/subagents, source/test edits, Git mutation, database/cloud/provider/production call, stress experiment, activation, removal or release action occurred. The sole write is this requested review report. The binding review-scope/release amendments and all original integration limits remain in force.

DONE — requirements PASS; code quality APPROVED — STOP.
