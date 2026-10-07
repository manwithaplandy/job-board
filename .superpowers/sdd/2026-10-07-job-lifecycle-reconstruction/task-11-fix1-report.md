# Task11 Fix1 — R11-1 renewed explicit recovery authorization

Status: focused correction implemented and locally verified. Same reviewer reassessment of R11-1 and fix-introduced Important/Critical issues remains pending. This report does not supersede the reduced security-review scope or claim acceptance/readiness.

Reviewed FixBASE: `a4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9`, original source `7411eb34187bf2b7956472c186670660611e2f26`. Actual starting HEAD `8b6638c` also contains controller review/dispatch documentation. Fix1 source: **`4ff6d7061ed2414ede66f9e6c878cfd717cd1ff4`**. Only three owned source/test files changed; root documentation remains unstaged.

## Finding and narrow correction

R11-1 correctly identified that migration07 made batch_id unconditionally unique in the authorization table. An expired unused immutable approval could neither be consumed nor changed/deleted, while inserting a fresh explicit approval for the retained batch failed uniqueness. This ordinary deferral sequence stranded pending recovery.

New additive `migrations/2026-10-03-08-archive-recovery-approval-history.sql` drops only `public_archive_recovery_authorizations_batch_id_key`. It adds partial unique index `idx_public_archive_recovery_one_consumption` on batch_id **where consumed_at IS NOT NULL**. Thus separately granted explicit approval rows can coexist with old unused approval history, while at most one approval can be committed as consumed for the old batch. The established immutable supersession old_batch_id primary key and terminal batch state continue to retain one committed replacement/fence.

The8-line migration is mirrored verbatim in schema.sql with its ledger entry. Historical migration07 and runtime recovery.py are byte-identical to FixBASE. No trigger, claim, role, gate, physical accounting, reservation or transport implementation changed. No API expansion was needed: the existing API still requires the caller's exact separately persisted approval ID, validates its current real DB-time window and expected manifest/event membership, and atomically consumes it with replacement. The worker cannot create a grant, extend an old grant or erase history/fences. Old expired approvals stay rejected and unchanged.

This permits multiple explicit unconsumed operator grants; the consumed-only unique index and existing fenced state prevent more than one committed replacement. Each extra approval remains durable history and therefore needs storage/operational sizing. The migration adds an index; it does not promise zero rollout cost, physical reuse or admission headroom. No live migration or approval was performed.

## Evidence and exact scope

`task-11-evidence/fix1/inventory.md` was written before execution. Full commands, raw/readable RED output, GREEN output/exit files, collection inventory, versions and RED/candidate/final hashes are present in that directory.

| Phase | Owned server | Actual result |
| --- | --- | --- |
| New approval-lifecycle regression before migration08 | PostgreSQL17.11 |1 failed,0.83s,exit1|
| Same regression plus exact approved catalog-parity node | PostgreSQL17.11 |2 passed,1.94s,exit0|
| Same regression plus exact approved catalog-parity node | PostgreSQL16.15 |2 passed,2.46s,exit0|

RED reproduced the precise defect: `UniqueViolation: duplicate key value violates unique constraint "public_archive_recovery_authorizations_batch_id_key"` when inserting the newly granted approval. The preceding old-approval rejection and unchanged-history/pending assertions passed. This is an intentional ordinary regression failure, not a platform safeguard rejection or an omitted Task3 mechanism test.

The regression seeds a retained expired batch and an already-expired unused operator approval in the owned fixture. Archive eligibility uses the existing fixture-only archive_clock replacement; authorization windows continue to use the real database clock. It verifies old approval rejection without changing its row, pending canonical bytes/times/revisions, old sealed state or supersession count. A separately inserted new approval succeeds after migration08. A replacement transaction intentionally rolls back; both approval rows, original batch count and exact pending data survive, and no supersession commits. Retrying through a fresh connection consumes only the new approval and retains the old row byte-for-field. Replacement IDs differ while event IDs, canonical bodies/hashes, revisions and occurrence/observation/recorded timestamps stay identical. The new730-day window and prior batch reference are asserted. One retained supersession holds the old owner/generation/manifest fence. A repeated replacement callback is rejected and leaves the authorization rows, pending membership and sole fence unchanged. No S3 upload or acknowledgement is needed for this narrow approval-lifecycle regression; pending data intentionally remains pending after replacement.

The separately authorized catalog node bootstraps the owned frozen schema, applies all additive migrations in order, compares the catalog to clean schema, reapplies and checks unchanged catalog/ledger. Only that exact existing migration node ran. Both final two-node commands have zero skips/deselections. No completed transport/supervisor/crash suites were rerun.

Python3.12.14, psycopg3.3.6, pytest9.1.1 and Ruff0.15.20 are recorded; cached images17 `327daa8fae71`,16 `275447c94b11`. PostgreSQL17.11 supplies major-version parity, not historical production17.6;16.15 supplies compatibility. Ruff and staged whitespace checks pass. RED and GREEN used the identical new test file. Candidate/final hashes match and no source changed during or after GREEN verification. Exact raw RED output is retained in deterministic gzip; its readable copy normalizes trailing whitespace only.

## Remaining limits and handoff

R11-2 remains a deferred nonblocking Minor finding. The preexisting case named “bomb” exercises declared compressed-length rejection/closed-body behavior through bounded_read with a two-byte limit; it does **not** exercise exporter decompression or establish a new bomb-test result. Fix1 does not change that test or repeat transport checks. The existing source's exact-byte comparison and bounded decompression behavior remain source claims under the earlier review.

Superseded-shell aging still lacks a dedicated recorded Task11 fixture; combined reviewer/maintenance/archive production resource sizing remains a downstream integration prerequisite. The earlier single import measurement is not a production load/cost claim. Real approved destination/credentials/private-encrypted-policy-retention validation and live provider access remain unperformed. Physical admission can still defer archive operations; retained approval/quarantine/supersession history needs sizing; no cleanup supplies physical delete credit.

Flags remain off, retirement dry-run, destination empty, archive inactive/readiness unvalidated. No production/provider/network/S3/configuration/IAM/credential/security-setting or release action, permanent data deletion, push/PR/merge/deploy, helper/subagent or independent review occurred. Omitted Task3 expiry/physical/cross-user/adversarial probes remain omitted; no security approval is inferred. No safeguard rejection occurred. Controller owns the same-reviewer reassessment, checkpoint and remaining all13/final release work.
