# Task 11 Fix1 — same-reviewer scoped reassessment

DONE / STOP. **Spec/requirements: PASS. Code quality: APPROVED.** R11-1 is closed. No fix-introduced Important or Critical findings. R11-2 remains a deferred nonblocking Minor finding for final triage; it was not reopened or represented as fixed by this correction. These are permitted ordinary development-review verdicts, not security, destination, activation or release approval.

## Exact pins and review boundary

- Previously reviewed FixBASE: `a4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9`.
- Original Task 11 source: `7411eb34187bf2b7956472c186670660611e2f26`.
- Actual author start, including controller review/dispatch documentation: `8b6638c8d14a707c2a6110cba3c36244e76c2586`.
- Fix1 source: `4ff6d7061ed2414ede66f9e6c878cfd717cd1ff4`.
- Fix1 report/evidence HEAD: `c91efc60b12cfa599c8c6d409a117fd23c02e6ad`.
- Worktree: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`.

Same original reviewer assessed only R11-1 and fix-introduced Important/Critical issues. Read the full Fix1 report, fix dispatch, original R11-1 finding, relevant original brief/binding requirements, repository AGENTS, review-scope and release amendments, recorded commands/inventory/outputs/versions/hashes, and focused source/test delta. Reconciled the full 6,116-line FixBASE-to-HEAD package: its diff exactly matches `git diff --no-ext-diff --unified=10` at the pins above, and its embedded 5,204-line original review package is byte-for-byte identical to the complete original package read in the first review. Controller documentation additions retain original findings and downstream limits. No whole-task source review or completed-suite rerun was performed.

Independent read-only checks confirm all five candidate/final SHA-256 entries match current files and both inventories are identical. Migration 08 occurs verbatim in schema.sql. Historical migration 07 and recovery.py are byte-identical to FixBASE. The new test has the same hash in RED and GREEN inventories. The compressed original RED output matches its recorded uncompressed SHA-256; the readable copy differs only by trailing line whitespace normalization. HEAD was the pinned report/evidence commit during inspection.

## R11-1 disposition — closed

The original failure was the unconditional unique `batch_id` constraint on immutable recovery authorizations. Once an unused authorization expired, neither renewing/removing that row nor inserting another explicit authorization for the retained batch was possible.

`migrations/2026-10-03-08-archive-recovery-approval-history.sql:3` drops only that unconditional constraint. Lines 7–8 add `idx_public_archive_recovery_one_consumption`, unique on batch_id where consumed_at IS NOT NULL. New, separately granted unconsumed approvals can therefore coexist with expired historical approvals. Once an approval is consumed, the partial unique index prevents another committed consumption for the same old batch. The old-batch primary key in supersessions and the existing terminal superseded state continue to retain one replacement and its fence.

This is a sufficient narrow correction. The existing runtime still selects the caller's exact authorization ID plus batch ID, requires it unused and within the ordinary DB-time approval window, and matches event-ID digest and original manifest hash (`job_discovery/archive/recovery.py:42`). It does not select an arbitrary available approval or create one. The unchanged authorization trigger still rejects changes to old approval fields, deletion, truncation, and repeated consumption; the fix grants no silent approval extension or history reset. Existing batch-state validation, exact pending membership/suppression checks, admission interfaces and atomic replacement transaction are unchanged. No old claim, gate, role or physical mechanism change was introduced.

The new regression (`tests/test_archive_recovery_authorization.py:32`) covers the concrete ordinary sequence requested:

1. Persist an already-expired unused explicit approval for an expired retained sealed archive batch, using real DB time for approval validity and only the existing owned fixture clock for archive eligibility.
2. Reject the old approval while preserving its complete row, canonical pending data/times/revisions, sealed batch and zero supersessions.
3. Persist a separate fresh explicit approval for the same batch, without updating the old row.
4. Intentionally roll back replacement, then confirm both approval rows, the original batch count, exact pending data and zero committed supersessions survive.
5. Retry through a fresh connection, commit replacement and close that connection. Assert exact event IDs and bytes, unchanged original pending data, a new opaque batch ID, prior-batch reference and a new 730-day archive window.
6. Assert only the new approval has consumption/replacement fields set, all its other approval fields and the complete old approval row are unchanged, and exactly one supersession retains old owner/generation/manifest identity. Reject a repeated replacement callback without changing approvals, pending data or that fence.

The test uses the established active claim across the rollback and fresh-connection retry. It is a focused authorization-lifecycle regression, not a new worker crash matrix, concurrent adversarial test or OS-kill test. There is no upload or acknowledgement in this fixture: the transferred exact events intentionally remain pending. The source's partial unique index plus existing state/fence contract supports the single-committed-replacement conclusion; the recorded regression demonstrates an ordinary retry, not all concurrency interleavings. No stronger assurance is inferred or required to close this scoped finding.

## Recorded verification, read without rerunning

The exact final command was run once per major, substituting 17 then 16:

```text
.venv/bin/python tools/lifecycle_test_db.py --postgres-major <major> -- .venv/bin/python -m pytest tests/test_archive_recovery_authorization.py::test_fresh_explicit_approval_after_unused_approval_expires tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations -q
```

| Phase | Actual server | Recorded result |
| --- | --- | --- |
| New regression before migration 08 | PostgreSQL 17.11 | 1 failed, 0.83 s, exit 1 |
| New regression plus exact catalog-parity node | PostgreSQL 17.11 | 2 passed, 1.94 s, exit 0 |
| New regression plus exact catalog-parity node | PostgreSQL 16.15 | 2 passed, 2.46 s, exit 0 |

RED fails precisely at insertion of the second explicit grant with `UniqueViolation` on `public_archive_recovery_authorizations_batch_id_key`, after old-approval rejection and preservation assertions. This is ordinary regression evidence, not a safeguard refusal. Final commands select only the two listed nodes, with no skips/deselections. The authorized catalog node provides clean/frozen-plus-additive catalog and reapplication evidence for the new migration; no sibling migration/security/activation node ran. Final Ruff reports “All checks passed!” and the command record reports successful staged whitespace validation.

Recorded versions are Python 3.12.14, psycopg 3.3.6, pytest 9.1.1 and Ruff 0.15.20, with cached PostgreSQL image IDs 17 `327daa8fae71` and 16 `275447c94b11`. PostgreSQL 17.11 is major-version parity, not the historical production 17.6 patch release; 16.15 is compatibility evidence. Original Task 11 transport/persisted-export/supervisor evidence retains its earlier scope and chronology; none was rerun or recounted as new Fix1 verification.

## Remaining scope, costs and limits

The implemented, tested and independently reviewed correction is the new archive approval-history uniqueness rule and ordinary explicit replacement retry. Multiple unconsumed explicit approvals can now exist, and historical approval rows remain retained. This adds history/storage sizing responsibility; the new partial index has rollout and storage cost. The migration was exercised only in owned fixtures. No live schema change, real operator grant, zero-cost migration or physical headroom claim follows.

R11-2 remains deferred Minor: the named bomb case proves declared compressed-length rejection with a two-byte limit and body closure, not exporter decompression coverage. Superseded-shell seven-day cleanup still lacks a dedicated recorded Task 11 fixture. Combined reviewer/maintenance/archive runtime measurement remains a downstream integration prerequisite; the earlier import-only measurement is not a combined production resource or cost result. These were not changed or re-tested in Fix1.

Real approved destination/privacy/encryption/policy/retention/credential validation and live provider validation remain unperformed. Default-off controls, retirement dry-run and archive inactivity are preserved by this delta. Existing Task 10 logical escrow/finite critical slots/physical deferral interfaces remain accepted interfaces, not independently certified mechanisms. Physical admission can still defer recovery; no deletion or index change establishes physical reuse.

Task 3 independent expiry enforcement, physical-capacity accounting, cross-user isolation and related adversarial reviews/probes remain deliberately omitted. The new archive authorization validity scenario is not a substitute for those reviews. No old mechanism/security probes, test reruns, helper/subagent, network/provider/production/S3/IAM/credential/configuration/activation/release action, source/test edit, Git staging or commit occurred during this review. Only this review document was written. No safeguard rejection occurred.

Controller owns forward documentation/checkpointing, remaining tasks and final permitted review/release under RELEASE-AUTHORIZATION. This closes the original Important Task 11 blocker and introduces none; it does not assert completion of downstream integration prerequisites or security approval.

DONE. R11-1 CLOSED; Spec PASS; Code quality APPROVED; zero open Important/Critical findings in the scoped correction. R11-2 Minor remains deferred. STOP.
