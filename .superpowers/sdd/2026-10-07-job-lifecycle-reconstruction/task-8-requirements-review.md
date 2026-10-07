# Task 8 independent ordinary requirements and code-quality review

**Spec: FAIL. Quality: CHANGES_REQUIRED.** Six Important findings; no Critical finding in the permitted review scope.

Reviewed product range: `0df584068c98cce161f354a50a7ad75ec01a0484` → `4d48602947b84983acc54738bd21e45a52862725`. The later controller HEAD `c293fbd0a89abb2323895acc0975ac147f8545bd` changes only checkpoint/progress/resume documentation and the pinned review package; product/test source remains the reviewed target.

Read the reviewer dispatch, scope amendment, release authorization, full Task 8 brief, full author report, full pinned package, actual sanitized evidence/chronology, repository/dashboard instructions, and relevant actual callers and design requirements. This is the new Task 8 ordinary functionality review authorized by the scope amendment. It is **not** a replacement Task 3 security/mechanism review. Expiry enforcement, capacity accounting, cross-user isolation, and related adversarial independent review/probes remain deliberately unperformed. No such review was retried or inferred from feature tests. No safeguard rejection occurred during this review.

## Important findings

### R8-1 — Existing package can make question preparation permanently pending without queued work

Paths: `dashboard/lib/jobLifecycle.ts:71`–`79`; `dashboard/app/api/application/prepare/route.ts:86`–`100`; `job_discovery/lifecycle/demand.py:237`–`242`.

A Greenhouse `generation` demand can legitimately become ready with a description and null questions: only `questions`/`prepare` demands require a question schema. After résumé generation creates a package, `requestJobPayload(..., "prepare")` finds that package's ready generation demand and returns immediately, even when its questions are null. The prepare route then returns “Application questions are being prepared” with 202. No prepare demand was inserted. Repeated clicks return the same result, so a normal description-only generation can prevent subsequent application preparation indefinitely.

An uncovered, narrow in-memory diagnostic executed the actual transpiled `requestJobPayload` with a recording database boundary. It returned `status=ready, questions=null, kind=generation` after exactly one SELECT and no enqueue. This is function-level evidence, not a real-database reproduction; the downstream route's null-schema branch is explicit in source. Existing route tests mock payload readiness and do not cover this composition.

Required narrow fix: determine readiness for the requested operation. A package without usable question inputs must enqueue real owner preparation work or return an honest terminal/deferred state with a recovery path; do not claim work is being prepared without queueing it. Preserve its existing description/artifact provenance while acquiring missing questions. Add the ordinary résumé-first → prepare-missing-questions caller case with zero allowance/provider calls until complete inputs exist.

### R8-2 — Package regeneration uses a different demand snapshot and can record the wrong consumption

Paths: `dashboard/lib/jobLifecycle.ts:72`–`79`, `109`–`113`; `dashboard/lib/queries.ts:648`–`664`, `703`–`704`; `job_discovery/lifecycle/demand.py:243`–`259`; `job_discovery/lifecycle/identity.py:287`, `323`–`325`.

The package lookup selects `d.*`, ordered by latest demand settlement, rather than the package's immutable description/question snapshots. A public version is not an exact question-snapshot identity: hydration hashes the description into public metadata, and public version capture does not include questions. Thus two successful same-owner demands can have the same public version and different question schemas. A package generated from schema Q1 can subsequently be prepared with Q2 selected from a newer demand, while `upsertApplicationPackage` preserves Q1 via COALESCE and replaces the generated answers. Stored inputs no longer describe the output.

The lookup also rewrites a selected `description`/`questions`/`review` demand's kind to the requested generation/prepare kind. The final receipt update targets every ready demand of that rewritten kind/public version, rather than the actual selected demand. It can stamp another snapshot, or throw after provider work if no matching ready demand of that kind exists. The in-memory actual-function diagnostic returned a `description` demand's newer schema with `kind=generation`, confirming this selection/receipt mismatch. No mechanism tests were used.

Required narrow fix: use the saved package input as the authority for regeneration and carry an exact source/receipt identity through generation and persistence. Do not infer immutable question equality solely from the public version UUID or relabel a demand kind. Ensure an ordinary same-version question change cannot change generation inputs while retaining an older package snapshot, and successful consumption stamps only the input actually consumed. Also reject/resolve input mismatches atomically when an output meets an already-existing package.

### R8-3 — Reviewer rollback path resumes unversioned shared-cache input after cutover

Paths: `job_discovery/lifecycle/demand.py:291`–`302`; `reviewer/db.py:522`–`525`; caller `reviewer/run.py:461`–`470`, model execution at `reviewer/run.py:560`.

`hydrate_candidates` treats every `hydration_enabled=false` state as the legacy cached-JD path, without consulting `legacy_description_capture_allowed`. `attach_demand_snapshots` independently returns the original candidates whenever that flag is false. After sticky cutover, disabling hydration therefore still sends cached shared descriptions into both model stages with no durable demand/version snapshot. This differs from `process_pending` and dashboard demand handling, which correctly distinguish pre-cutover legacy compatibility from a paused post-cutover worker. It violates the ordinary ready-before-model/input contract even before considering any downstream write enforcement.

Required narrow fix: restrict the legacy shortcut to the existing pre-cutover compatibility policy. After cutover with hydration disabled, consume an already valid durable input under the intended paused policy or defer before model calls. Keep initial flag-off cached legacy operation working. Verify the ordinary disabled-after-cutover caller branch without probing the underlying Task 3 mechanisms.

### R8-4 — Cache retirement marker still excludes otherwise eligible jobs before demand hydration

Path: `reviewer/db.py:293`–`299`; caller `reviewer/run.py:461`–`468`.

Candidate selection retains the old unconditional `NOT COALESCE(j.description_pruned, FALSE)` filter. That field describes a shared payload cache state, not the current user's deterministic job eligibility. Even with hydration enabled, an otherwise eligible live, discovery-eligible job with a retired JD is removed before `hydrate_candidates` can request its description. The per-user deny predicate is already separate. The new flow works for missing descriptions without that marker, but cannot recover the normal retired-cache case it is meant to hydrate.

Required narrow fix: separate deterministic eligibility from cache availability in the lifecycle-enabled candidate path, retaining the explicit user/company/location/budget/discovery predicates and intentional legacy compatibility. Add one ordinary eligible job with a retired/missing payload and no personal denial, proving it reaches hydration before any model call. This finding concerns caller filtering only; it does not review or test expiry enforcement.

### R8-5 — Legacy private artifacts are assigned unrelated later version provenance

Paths: `dashboard/lib/jobLifecycle.ts:127`–`135`; consumers `dashboard/app/actions/resumeScores.ts:33`–`60`, `dashboard/app/actions/coverLetterEdits.ts:43`–`44`, `80`–`84`, and `dashboard/app/actions/corrections.ts:33`–`34`, `74`–`75`.

`readPrivateSnapshot` falls back to the latest ready job demand both when the private row is absent and when an existing legacy row has null version/snapshot fields. These situations have different meanings. For an existing résumé or cover letter generated from an old, unversioned JD, a later detail hydration does not establish the input used to generate that artifact. Scoring/editing it now copies the later demand's version and description into the dependent private record. A legacy review correction has the same problem. This fabricates exact provenance for old work, contrary to the explicit nullable-prerequisite/no-fabricated-history contract.

A second narrow in-memory diagnostic executed the actual `readPrivateSnapshot` with an existing null-provenance package followed by a later ready demand. It returned that later version/description after two queries. This is actual helper behavior at a synthetic boundary, not evidence about database isolation or enforcement.

Required narrow fix: distinguish an absent private row/new action from an existing artifact whose provenance is unknown. Preserve honest nullable legacy provenance and any existing independent snapshot. Only assign a version to work actually created using that version; require a deliberate generation/capture transition if new provenance is needed. Cover ordinary legacy résumé scoring, cover editing, and review correction after an unrelated later hydration.

### R8-6 — Remaining private readers replace or ignore retained snapshot inputs

Paths: `dashboard/app/api/jobs/[id]/route.ts:40`–`42`; `dashboard/lib/queries.ts:198`–`204`; `dashboard/scripts/calibrate-resume-judge.ts:21`–`41`; `dashboard/scripts/calibrate-cover-letter-judge.ts:63`–`92`.

The detail query now correctly selects the correction/review description snapshot, but the route unconditionally replaces it with a ready current description demand. After a source description changes, the returned review/correction reasoning is accompanied by a different input JD, concealing the preserved historical input. If current public detail is also desired, it needs a distinct field/contract rather than silently overriding the private snapshot.

The actual résumé-score and cover-edit calibration/sync readers still select `j.description`, ignoring the new `s.description_snapshot`/`e.description_snapshot`. An initially correct golden item created by the action can be overwritten by `--sync` using a later shared JD, or calibrated against the wrong JD after cache changes. These are existing real consumers of the private work whose snapshot support this task adds; no sync/provider operation was executed during review.

Required narrow fix: preserve the authoritative private input in the detail response and both offline replay/sync readers, with an explicit honest fallback for legacy null snapshots. Keep current public detail separate where needed. Add local pure/SQL-boundary fixtures with a saved JD different from the shared/latest JD; do not call external services.

## What the source and existing evidence establish

- Real reviewer entitlement/location/company selection precedes hydration/model work. Missing/blank descriptions are excluded before both stages. The ordinary successful hydrated-review fixture checks the consumed JD and persisted version. R8-3/R8-4 are specific remaining caller branches.
- Demand service commits before the public fetch, uses stored ATS coordinates, requires a durable version before ready, and writes separate description/question snapshots. Existing non-null shared descriptions are retained. Actual legacy `db.upsert_jobs` → absent listing → targeted existing mapper → pending owner demand → worker ready is covered in the final Python fixture. The mapper's exact-ID subset returns without advancing the global completion/cursor path; existing IDs and migration-activation provenance are preserved. Sticky-cutover-disabled `process_pending` is covered, but does not establish the separate reviewer branch in R8-3.
- At the ordinary caller-contract level, `db.ts:117`–`155` uses the existing service connection for claim/reservation metadata, then runs private DML with authenticated role/JWT on the same transaction/backend, restoring service role only for settlement metadata. No new authenticated SQL helper grant or guard change is in the product diff. This is source/normal-flow assessment, **not** independent capacity, privilege-isolation, or adversarial assurance. The 96 MiB forecast is conservative and its near-ceiling availability limitation is honestly documented.
- Prepare/résumé/cover routes generally check payload readiness before allowance/provider work. The owner UI recognizes hydration 202 notices and returns to a retryable state. Generation tracking copies input snapshots; successful package persistence records consumption in its artifact transaction. R8-1/R8-2 identify incomplete readiness and receipt selection, not a blanket rejection of those paths. No passive sighting/capture was found newly stamped as use in the changed path.
- All six real adapters use `adapters.completeness` → `job_discovery.http`; Workday readonly search POST and Workday/SmartRecruiters detail GET use the same facade. Legacy question spool and `company_discovery/enrich.py` JSON/text also reach it. Demand's Greenhouse/Lever/SmartRecruiters/Workday direct details and bounded Ashby/Workable current feeds use it. Thus R6-5 integration is shared, not a demand-only wrapper.
- The actual transport implements a bounded subprocess around DNS, pinned numeric connection/original-host TLS, headers/body, decompression, and JSON parsing; manually follows at most three redirects with revalidation; omits ambient credentials; checks wire/expanded 10 MiB; restricts POST to readonly Workday CXS search; and applies an overall retry deadline. The inspected ordinary offline evidence supports configured behavior. There is no live-network, provider-compatibility, subprocess-load/throughput, or strict real-time scheduling performance proof. The deadline test mocks the subprocess timeout; it is not an elapsed-time benchmark. No further transport blocker found in this scope.
- Migration03 validates Task2's existing columns/FKs/question constraints before adding receipts/readiness. It does not first-create snapshot prerequisites. A read-only textual comparison confirmed exact parity with the fresh-schema suffix after excluding the migration's outer BEGIN/COMMIT. Writer `validated_at` remains null, with no activation claim.

## Verification evidence and review limits

Read actual `task-8-evidence/*.txt` plus `chronology.md`. Final affected evidence is 30 demand/identity tests each on PostgreSQL **17.11**/**16.15**, four actual dashboard DB flows each on those versions, 18 offline HTTP/fetch tests, and 13 affected TS tests. Lint output says all checks passed; the author records successful final `tsc --noEmit` with an empty output file. Earlier 214/215 Python and 135 TS results precede final corrections and are not a final-source full matrix. Initial retained RED/failing logs and overwritten-output summaries are explicitly distinguished. The dashboard flow's service completion is synthetic; the Python legacy worker flow executes actual orchestration. These selected runs report no skips; this is not whole-repository zero-skip evidence.

No author-covered suite was rerun. New diagnostics were limited to actual TS helper execution with in-memory ordinary owner inputs for uncovered R8-1/R8-2/R8-5 concerns, plus a read-only schema parity comparison. No database was started; no production/network/paid operation, product edit, commit, delegation, or external write occurred. Diagnostic outputs are preserved in `task-8-reviewer-diagnostics.txt`.

Minor quality observations: several new TS/SQL orchestration functions are densely compressed, making input/receipt selection harder to audit; formatting them conventionally would aid the fixes. The report's blanket “existing package regeneration remains pinned” and “successful consumers write exact-version receipts” claims need narrowing until R8-1/R8-2/R8-5 are fixed. No extra broad test matrix is requested just to repeat counts; verify the concrete corrected paths and affected regressions.

Task 6's above-guard durable-maintenance finding **R6-4 remains mandatory in Tasks 10/13**; this review does not waive its full-spec failure. Archive-active event pairing, completed readiness/backfill, whole-branch permitted review, and final release verification remain downstream work. Task 3's deliberate independent-review gaps remain even after ordinary findings are fixed. This report grants no activation, full security, or release approval. Controller owns fix dispatch and Library08 before Task9.
