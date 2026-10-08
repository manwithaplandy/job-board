# Task 13 independent permitted requirements and code-quality review

Status: DONE. Requirements verdict: **FAIL**. Code-quality verdict: **CHANGES_REQUIRED**.

Findings: **0 Critical, 3 Important, 0 Minor**. The three Important findings below block Task 13 acceptance. This is the fresh Task 13 integration review, not the later whole-branch review and not independent security approval.

## Immutable review pins

- Task 13 BASE: `41c9d179d4d273d707a994467ce9c8031df50a91`.
- Reviewed HEAD: `a97f9e7b95aa60fa774529352cfaec066225ffe0` (also actual worktree HEAD during review).
- Final source/test/harness pin: `ce256702f85b5e42fecb99002d7c2f36f009e405`.
- Product checkpoint before test housekeeping: `2858d42b3171964cc3363bf9e09ae0ddb6babf2d`.
- Author report/evidence pin: `eca7f6c438a29cc3ae93b615b7cad236453a2ad9`.
- Complete raw package: `task-13-review-package.md`, 74,390 lines; independently computed SHA-256 `45ae830f1f586c2519cab43c21561f391f59310f802615f5c6c2893e4ae90057`.

The complete 30 product/config/test/runbook diff blocks were read in `task-13-product-review-entrypoint.md`. A read-only path-set comparison against actual BASE..HEAD confirmed those are all non-`.superpowers` changed paths. The supplement's complete report, acceptance mapping, checklist, exclusions and result summary were read. I did **not** semantically read all 74,390 raw-package lines or all historical/unchanged test bodies. Repetitive diagnostic telemetry was not treated as additional independent evidence. Source context was read where necessary to trace the new callers and readiness workflow, especially `source_worker`, scheduler/staging, maintenance entrypoint, identity mapper, baseline producer, export entrypoint, CI runner and both owned dashboard suites.

Read first: reviewer dispatch, then Task 13 brief, binding review-scope amendment and release authorization; also author dispatch, current rulings, final-review carry-forward, binding design spec and repository/dashboard conventions. The source/claim/role/physical interfaces predating Task 13 were treated as accepted contract context, not reopened as replacement independent mechanism assurance.

## Important findings

### R13-1 — Failed or blocked maintenance does not stop admission in the new source child

**Location:** `job_discovery/lifecycle/source_worker.py:31`–32; caller contract in `job_discovery/lifecycle/maintenance.py:386`; actual downstream admission in `job_discovery/lifecycle/reconcile.py:177`–188.

`run_source_once` discards the `SweepResult` returned by `pre_admission_maintenance` and unconditionally invokes `verify_due_sources`. That verifier is also an ingestion path: `stage_postings` calls `admit_metadata` for returned postings. It has no input carrying the failed-maintenance admission restriction. If the sweep fails, times out, or cannot acquire its maintenance turn while ordinary storage is otherwise available, the next source response can still create a new Job/listing/version. Calling maintenance first is insufficient when its result explicitly says additions must be blocked.

This contradicts the binding cycle contract that a failed capacity/maintenance check permits verification but blocks additions. It is an ordinary caller/result-propagation defect, not a finding about the correctness of the existing physical guard. The new supervisor starts maintenance and source siblings together, so an unavailable maintenance turn is also a normal composition case.

The new test `test_source_worker_flag_off_and_maintenance_before_verification` replaces maintenance with a list-append callback and the verifier with a stub; it proves order/arguments but cannot establish blocked-result behavior. The selected pre-admission failure test proves the helper returns `blocked`, not that this caller honors it. The daily source-enabled path likewise calculates `maintenance.blocked` but does not pass it to the shared verifier (`job_discovery/run.py:127` and 166–179); the shared repair should reconcile that real caller too.

**Required correction:** carry the actual maintenance admission decision through the shared source path and its callers. Continue permitted verification/committed existing-identity progress while deferring additions when maintenance is blocked; do not substitute a total verification shutdown or weaken existing guards. Add an ordinary blocked-result caller regression with a novel posting and existing-source progress, using the permitted local/offline scope. No physical-capacity challenge or omitted mechanism probe is needed.

### R13-2 — New full-corpus baseline prerequisite can prevent archive bootstrap from completing

**Location:** `migrations/2026-10-07-09-lifecycle-readiness.sql:72`–73 and its schema mirror; `docs/runbooks/job-lifecycle-outbox.md`, rollout step 6. Supporting existing interfaces: `job_discovery/archive/outbox.py:167`–195 and `job_discovery/archive/export.py:87`–89.

The new export transition requires every current row across all 13 public aggregate tables to have an archive head. The documented sequence keeps export off until that entire baseline is built. However, each bounded `baseline_batch` creates ordinary pending events through `flush_public_changes`; these consume the accepted finite ordinary backlog budget. The actual exporter returns while `export_enabled` is false. Consequently, when the corpus baseline exceeds the amount that can be pending at once, baseline creation stops before all heads exist, export cannot be enabled, and the normal exporter cannot acknowledge pending events to make room. Smaller batches only postpone this circular dependency.

This follows from the ordinary bootstrap call graph and the already accepted finite logical backlog contract; I did not inspect/reproduce the omitted physical-capacity mechanisms or run a capacity probe. The Task 13 report itself carries the accepted `6*C+128000` logical processing forecast and approximately 506–865 ordinary-event fixture runway. No corpus-size restriction in the product contract makes a complete application corpus fit in that pending window. Exact production counts are unnecessary to identify the unsupported ordinary case, and no production count was queried.

The new positive readiness test uses a tiny mapped source and completes every baseline before enabling export. It proves that small case only. The runbook acknowledges full-corpus scan timeouts but does not provide a supported bounded bootstrap drain/progress protocol when the baseline is larger than one backlog window. Seeded attestations cannot resolve this functional availability problem.

**Required correction:** have the controller adjudicate the sequencing conflict, then implement/document a supported bounded baseline-and-delivery progression that can complete a larger corpus while preserving destination validation, writer readiness, exact acknowledgement, fixed backlog limits and all existing physical/claim interfaces. Do not resolve it by deleting pending history, inflating budgets or requiring an undocumented bypass of the export-off control. Ordinary small multi-page bootstrap evidence with an intervening exact acknowledgement can establish the repaired progression without a physical stress test or omitted probe.

### R13-3 — Newly enabled owned-dashboard CI assumes a virtualenv absent from its workflow

**Location:** `.github/workflows/ci.yml:38`–51 and `dashboard/lib/jobLifecycle.flow.db.test.ts:177`.

The new CI matrix installs Python dependencies into the `actions/setup-python` interpreter with `python -m pip`, then invokes the owned dashboard lane. That selected suite's real demand-worker case executes `../.venv/bin/python` relative to `dashboard`. The workflow never creates that virtualenv, and `.venv` is not tracked. On a fresh checkout, this case cannot launch its Python worker and will fail with an absent executable. Both matrix majors select the same case.

The local 7+6 owned results are valid for the worktree, which has `.venv/bin/python`; they do not establish this fresh-runner prerequisite. This is a static CI integration finding, not a newly observed CI run or a reason to discard the local evidence. The hard-coded path predates Task 13, but Task 13 now explicitly adds this fixture to automatic owned acceptance and must supply its runtime dependency.

**Required correction:** select the installed interpreter explicitly and consistently through the acceptance runner/test boundary, or create/use the required virtualenv in the workflow. Preserve the strict owned target guards and actual Python hydration assertion. Verify the affected permitted owned lane in a layout that does not rely on an incidental worktree `.venv`; no broad suite or omitted test is required.

## Requirements and evidence assessment

| Task 13 integration area | Assessment |
| --- | --- |
| New periodic source scheduling | Implemented independent nonoverlapping 60-second scheduling and 330-second process deadline, with existing 300-second verifier parameter and daily one-shot discovery retained. It removes the former sole-caller 100-board/day ceiling. R13-1 prevents acceptance of its maintenance/admission composition. Actual 24-hour production coverage remains unmeasured. |
| Truthful closure summaries | Normal and operational private result tuples increment only for Jobs newly changed from open to closed; scheduler counts are added after successful commit. Public boolean APIs remain. New normal/fallback replay-zero assertions support this change. No concrete count defect found in reviewed changes. |
| Six-family ordinary composition | New test exercises source polling, qualifying miss/closure/reopen, retained IDs/anchors/private packages, demanded input, retirement, fake-S3 exact ack and replay. Its maintenance readiness is a local function double and archive setup is a fixture; it does not prove a complete deployed control/writer transition. Separate new positive readiness fixture exercises actual control API with explicit seeded attestations. |
| Bounded readiness and actual callers | New mapping certification visits at most 500 identities per batch and pins generation/source revision; component attestations are explicit, not auto-generated. Actual runbook caller inventory and known limitations are present. R13-2 is a remaining ordinary availability defect in the newly enabled archive startup sequence. Attestation rows do not prove deployed writer compatibility. |
| Additive schema/ledger | Migration 09 is mirrored verbatim in schema.sql; 05/06 ledger repair records already-mirrored definitions. Saved ordinary catalog/reapplication evidence belongs to the explicit selection. No old role/claim/physical mechanism verdict is supplied. |
| Archive aging and replay | New superseded-shell fixture preserves pending replacement membership and authorization/compact history during bounded seven-day cleanup. The misleading “bomb” fixture is correctly relabelled compressed-length; it does not claim exporter decompression-bomb coverage. Accepted Task 11/12 evidence remains phase-specific. |
| Local and automatic test selection | Explicit Python allowlist, mixed-file node selectors, separate default/owned Vitest configurations and sequential owned files are implemented. Excluded mechanism files are not broadly discovered by these entrypoints. Both owned test bodies and new Task 13 tests were read. R13-3 prevents declaring the new CI lane runnable as written. This review does not recertify every unchanged selected Python or default unit-test body. |
| Fixture repair and reset housekeeping | Actual fixture assertions and strict owned DSN checks remain; single-connection raw SQL fixture repair fits the existing transaction wrappers. New CHECKPOINT helper checks exact container ID/label/published random loopback port and receives ownership markers only through isolated harness plumbing; current ordinary positive evidence passed. This is a test-isolation source assessment, not production ownership/capacity assurance. |
| Billing/build corrections | Helper/card bodies are moved with import updates; no pricing/model-copy or server/client boundary change in the reviewed diff. Saved 23 affected tests and offline build support the repair. No live billing evidence is claimed. |
| Runtime/storage/cost evidence | Four actual child processes were sampled, but source was disabled, reviewer work inert and export used fake S3; supervisor/parent/PostgreSQL memory and CPU are excluded. The report accurately labels the sample. Actual source-active total service sizing, sustained latency, allocation runway and cost neutrality remain unproved. |
| Runbook/rollout/rollback | Migrations, component/cascade inventory, controls, finite preallocation, logical versus physical storage, authorization boundaries and safe retained-data rollback are documented. Baseline bootstrap procedure needs R13-2 correction. No production activation or new destination is inferred. |
| Final independent review/release | This review is Task 13 only. Same-author fixes and scoped rereview are needed before its acceptance/checkpoint, then the separately required fresh whole-branch permitted review. Completed-upgrade release authorization does not turn this failed integration review into acceptance. |

## Saved evidence actually checked

Read-only SHA checks matched all **110** entries in `task-13-evidence/sha256.json`. All **31** `final-source-sha256.json` entries matched the pinned `ce256...` Git objects. Against current worktree files, the sole mismatch was the explicitly documented subsequently expanded `task-13-evidence/inventory.md`; all product/test/harness hashes matched. No source drift was inferred from that metadata-only inventory change.

The command inventory and current Python orchestration/observer scripts were read. Raw final Python log version headers, result rows/summary and exit files establish **381 PASSED markers, zero SKIPPED markers and exit 0 on each PostgreSQL 17.11 and 16.15 lane**. Durations: 148.36s and 190.95s pytest, respectively. This is the selected lane, not unrestricted ALLpytest. No test was rerun by this reviewer.

Both complete owned dashboard result files show flow **7** plus Consumers **6**, zero skips on each major. Default dashboard saved summary is **1,717 passed, 2 PDF skips**, 217 files; affected billing is **23 passed**. Saved typecheck, Ruff, lint and offline webpack build exit 0; lint has **9 warnings**, not zero warnings. Local build explicitly uses a DejaVu font stand-in and webpack after preserved symlink/font/export failures; it is not proof of local Turbopack/original-font availability or a completed GitHub CI build. Local Node 24 and CI Node 22 remain distinct.

Read the browser result JSON and saved success output: **17** actual-component synthetic assertions, Chromium 151, loopback requests only, no recorded page errors/blocked external requests. This reviewer did not independently rerender or visually inspect the screenshots; the author's visual-inspection claim remains author evidence. These results do not establish authenticated Next SSR/provider/live pipeline behavior.

Read current focused seven-case output: **7 passed in 20.09s**, E2E 10.318s, 12 Jobs, five retired payloads/80 logical bytes, 1,744 Job row bytes, 28,497,587 allocated database bytes, 6,340 canonical/925 gzip/2,671 manifest bytes. Four-child sample: 2.353s, 112,779,264 sampled RSS bytes, 2.99 sampled child CPU seconds, two observed DB sessions including observer. Sampling exclusions in the author checklist apply; these tiny fixtures are not production forecasts or reclaimed physical storage.

Earlier interrupted 185-case phases, the 380-pass/one-timeout PostgreSQL 17 phase, prior successful PostgreSQL 16 phase and current successful post-housekeeping phases remain separate chronology. Hash verification preserved their raw artifacts; I did not semantically inspect every repetitive diagnostic line or attribute a proven production cause to the reset-file observations.

## Explicit limits and carry-forward

No tests, helpers, DB/cloud/provider calls, migrations, production actions, activation, deletion, staging, commits, release actions or subagents were run by this reviewer. Only this review report was written. Source/evidence reading and read-only file/Git hash checks were performed.

The independent Task 3 expiry-enforcement, physical-capacity, cross-user isolation and related adversarial reviews/probes remain deliberately omitted under the binding amendment. They were not retried, split, disguised or substituted. No security approval follows from the source observations, selected tests or this review.

Known unknown-input legacy package full recapture remains an unimplemented availability path with terminal deferral and retained artifacts; cached legacy/known-input flows remain separately supported. Task 12 remains a pure optional reader without runtime loading/current-time/suppression adapters. Actual production writer deployment, source population/24-hour lag, baseline duration, finite operational runway, public per-request load, production 17.6/TLS and approved archive destination/IAM/retention remain explicit operational gates. They are not silently marked complete by the readiness fixture. This Task 13 review does not adjudicate away those whole-branch carry-forwards.

**DONE — Requirements FAIL; Code quality CHANGES_REQUIRED. STOP.**
