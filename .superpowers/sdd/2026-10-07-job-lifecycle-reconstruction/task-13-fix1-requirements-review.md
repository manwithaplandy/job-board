# Task 13 Fix1 — same-reviewer scoped rereview

Status: **DONE**. Requirements verdict: **PASS**. Code-quality verdict: **APPROVED**.

All three original Important findings are closed. No new Important or Critical defect caused by these fixes was found. These verdicts apply to the permitted Task 13 correction scope; they are not whole-branch acceptance, independent security approval or production readiness.

## Pins and actual scope

- Fix BASE: `03a7f8921e23726c29cb0a7e14fb36906d50b2b3`.
- Reviewed package HEAD: `500aeacbd55050f7384de66291d3a4112a1f7f49`.
- Fix source/test/runbook pin: `efc4c67869d65261b80e189175b318118837566b`.
- Fix report/evidence pin: `74808a484ba55e7061f483213d62592dced4cc18`.
- Original review: `task-13-requirements-review.md`, source `ce256702f85b5e42fecb99002d7c2f36f009e405`, reviewed HEAD `a97f9e7b95aa60fa774529352cfaec066225ffe0`.

Read the scoped reviewer dispatch first, then the full original review, full Fix1 dispatch and full Fix1 report. Read the complete 1,864-line `task-13-fix1-review-package.md`, including all product/test/runbook changes and saved command/result/evidence diffs. Read current affected source context for daily admission decisions, staging, source-worker propagation and the installed-interpreter runner. Separately opened the actual four GREEN output files and their exit files. Source/evidence hash manifests, source-equivalence record, independent-layout record and phase commands were inspected; this rereview did not independently recompute those manifests or run Git commands.

Scope was only R13-1, R13-2 and R13-3 plus fix-introduced Important/Critical defects. Unchanged tasks, old omitted mechanisms and unrelated findings were not reopened. No tests, project helpers, DB/network/provider/cloud actions, subagents, Git operations or production actions were run. Only this rereview report was written.

## Original finding dispositions

### R13-1 — CLOSED

The source child now stores the actual maintenance result and passes `admission_allowed=not maintenance.blocked`. The daily caller passes its combined maintenance/capacity decision, `admission_allowed=not over`, and skips source-catalog registration when that decision blocks admission. Its existing seed guard remains before that branch.

The shared verifier carries the new backward-compatible keyword through both the full-chunk and tail staging calls. Staging skips `admit_metadata` when admission is disallowed while continuing exact external-ID membership and existing-listing observations. Existing reconciliation/count commit placement and operational fallback are unchanged. A novel member therefore remains part of the feed's completeness evidence without becoming a new Job/listing/version. This addresses the original missing caller decision without shutting down verification.

The new four-case regression invokes each actual caller in allowed and blocked modes. It supplies an ordinary `SweepResult`, replaces public HTTP only, and verifies committed reopening/sighting, a complete miss on another existing identity, completed enumeration and exact membership containing the novel external ID. Blocked cases assert no novel Job, unchanged version count/title, and no daily novel source registration. Allowed cases retain admission and registration. Daily persisted run counts are checked after the worker closes its connection.

Saved RED shows the two blocked caller variants wrongly admitting one job. Saved GREEN shows all four variants passing on PostgreSQL 17.11 and 16.15. The ordering, ordinary admission, six-family and existing finite scheduler cases also pass in that targeted lane. This is ordinary result-propagation evidence; maintenance failure mechanisms and physical-capacity enforcement were not independently reprobed.

### R13-2 — CLOSED under the explicit Fix1 sequencing ruling

The migration09/schema diff removes only the new two-line requirement that global baseline completion precede export enablement. Destination validation, writer/backfill generation readiness, producer state and the surrounding control conditions remain. `archive_baseline_ready()` remains available as a completion predicate.

The revised runbook separates export permission from corpus completeness: quiesce ordinary public writers, create/commit a bounded baseline page, recertify and enable validated export, interleave further bounded pages with normal exact acknowledgement, and retain quiescence until every current aggregate has a head and baseline delivery is complete. It explicitly retains fixed budgets, ordinary flush timing, pending history, completion evidence and existing retirement proof. A completion-query timeout leaves cutover unverified rather than allowing a bypass. This resolves the original finite-backlog circular prerequisite within the controller-approved scope.

The changed positive readiness fixture proves global completion is false after one baseline page, enables export through the existing claim/CAS API, invokes actual `export_once` with fake S3, and checks that the acknowledged event ID exactly matches that page and pending membership is empty. It then commits and delivers further one-row pages, visits the aggregate-type enumeration and verifies the final completion predicate. The preexisting export/producer pause-and-resume pending-history assertion is retained using a genuine paired public company update.

The fixture changes only the exporter flush threshold to one event to stay small; it does not change backlog budgets or physical interfaces. Saved RED reproduces the old global-baseline rejection; GREEN passes the revised progression and the two ordinary catalog/reapplication nodes on both majors. Empty aggregate tables in the fixture are visited but do not constitute populated evidence for every aggregate type. This proves the small ordinary bootstrap progression, not production corpus throughput, physical runway, destination ownership or deployed writer compatibility. Seeded attestations remain local assertions.

### R13-3 — CLOSED

The acceptance runner now supplies its actual `sys.executable` in `LIFECYCLE_TEST_PYTHON` to each owned Vitest subprocess. The flow fixture requires and executes that explicit interpreter instead of resolving a repository-relative `.venv`. Existing owned DSN guards, sequential file execution and the actual Python `demand.process_pending`/ready-snapshot assertions remain intact.

The saved command scripts copy source into `/tmp/task13-fix1-layout` and assert that it has no `.venv`. The independent executable is `/tmp/task13-fix1-python/bin/python`; both GREEN owned outputs print that path. The original fresh-layout RED captures the expected missing `.venv/bin/python` ENOENT, whereas GREEN passes flow 7 plus Consumers 6 on each major, including the real worker case. The source-equivalence record reports copied source matching the final pin after these runs.

This closes the missing-interpreter prerequisite in the CI workflow, whose setup-python interpreter already invokes this runner. The layout uses existing dashboard node_modules and an independently populated offline Python environment; it is not a full GitHub runner/dependency-resolution reproduction. Local Node 24 versus CI Node 22 remains explicit. No hosted CI success is claimed.

## Current-source evidence and limits

| Saved phase | Actual result |
| --- | --- |
| Python RED17 | 3 failed, 2 passed; exit 1; 5.84s pytest. Both original admission failures and the original baseline transition failure are present. |
| Fresh-layout dashboard RED17 | Flow 6 passed, 1 ENOENT failure; exit 1. Consumers did not run after the runner stopped. |
| Python GREEN17 | 12 passed, zero skips; exit 0; PostgreSQL 17.11; 46.87s pytest / 58.888s harness. |
| Python GREEN16 | 12 passed, zero skips; exit 0; PostgreSQL 16.15; 38.50s pytest / 50.537s harness. |
| Fresh-layout dashboard GREEN17 | Flow 7 and Consumers 6 passed, zero skips; exit 0; 22.201s harness. |
| Fresh-layout dashboard GREEN16 | Flow 7 and Consumers 6 passed, zero skips; exit 0; 15.369s harness. |
| Ruff / dashboard typecheck | Saved commands and outputs report exit 0; 0.040s / 14.387s. |

The eight committed targeted Python selectors expand to the recorded 12 cases. The new four-case ordinary caller file is the only addition to the automatic Python allowlist; existing default/owned Vitest separation and explicit exclusions are retained. The complete added regression body and changed readiness test were read. No sibling omitted security or adversarial node was introduced by this fix.

The original 381-per-major Python, 1,717 default dashboard tests/two PDF skips, browser, build, billing and combined-process results remain **prior-source phase evidence**. They were not rerun on `efc4c678...` and are not relabelled current Fix1 results. The targeted six-family metrics likewise remain their own small-fixture phase; they do not establish savings, sustained resource sizing or production capacity.

The deliberately omitted independent Task 3 expiry-enforcement, physical-capacity, cross-user and related adversarial assurance remains absent. No claim of security approval follows from these verdicts. Unknown legacy generated-input full recapture, Task 12 runtime loader/current-time/suppression adapters, actual deployed writer readiness, source coverage, finite operational/physical runway, public feed load/cost and production version/TLS/archive destination/IAM/lifecycle checks retain their prior explicit limits. This scoped rereview does not adjudicate those away.

There is no remaining blocker within the three-finding Fix1 scope. The controller still owns Task 13 checkpointing and the subsequent fresh permitted whole-branch review and release workflow.

**DONE — Requirements PASS; Code quality APPROVED. STOP.**
