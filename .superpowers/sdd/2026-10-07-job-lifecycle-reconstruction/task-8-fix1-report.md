# Task 8 Fix1 author report

FixBASE: `4d48602947b84983acc54738bd21e45a52862725`. This is the same original
Task8 author responding to the six Important findings in
`task-8-requirements-review.md` and its actual-function diagnostics. Controller
forward documentation commits, including `d8ad8f7`, are preserved. Product commit
`e547270461cc218ec24619ca87bb341945d18efe` also includes three controller-authored
documentation updates (controller-resume, progress and task-13-author-dispatch):
they became staged in the shared index after the author verified them unstaged.
The author did not edit or stage those paths. The controller was informed; history
was preserved and this provenance note was added forward. Fresh scoped re-review
is pending; this report is not a
review verdict or security approval.

## Changes against the six findings

**R8-1:** Operation readiness now distinguishes a usable JD from usable prepare
questions. A known-input résumé-first package with no questions enqueues an actual
owner prepare demand. The service reads the saved package and fetches questions
outside the transaction, rechecks the saved package, and captures its original
JD/version plus the first Q schema. The package remains unchanged until successful
artifact persistence. Pending returns before allowance/provider calls. Later
preparation uses the exact saved complete input bundle.

There is an explicit availability limitation: a legacy package with unknown
historical input and no usable saved/cached questions returns **deferred**, not a
false “being prepared” message. Its artifacts remain available. The message says
full input recapture is required and is not yet supported. No recovery/reset
button is advertised. Existing prepare replaces only successful/requested legs,
so it is not an atomic full-package recapture operation; using it to backfill
historical provenance would be dishonest. The controller explicitly approved
this terminal alternative. Pre-cutover cached legacy preparation remains usable,
retains unknown version provenance, and uses an independent saved JD when present.
Post-cutover disabled hydration remains paused; no fallback is restored.

**R8-2:** Package selection uses the saved version/JD/Q tuple as authority, not
latest demand metadata sharing a public version. The selected real demand retains
its own ID and kind. Persistence holds the normal job/transaction locks and checks
the saved tuple before artifact writes, permitting only NULL→first Q acquisition
for a real prepare capture. Known mismatches roll back atomically. Existing JD,
version and capture timestamp—including an unknown NULL timestamp—are preserved.
The consumption update requires exact demand ID, owner, job, version, actual kind,
and JD/Q tuple and stamps only that row. Reviewer result metadata also carries the
exact source demand ID into its successful persistence receipt.

If the original demand no longer exists, the owner request queues a genuine new
service capture of the retained package's exact known tuple. This uses the normal
claim/reservation flow and needs no network. It creates a new ID and capture time,
not reconstructed original history. It does not mutate package capture time,
public version, discovery anchors, source availability or source verification.
First-Q capture time lives on its actual new demand; it is not represented as a
question capture or consumption by the earlier résumé. Use stamps wait for a
successful actual consumer. No new schema, grants or guard behavior was required.

**R8-3:** Both reviewer hydration and snapshot attachment now consult the existing
pre-cutover legacy policy. Initial flag-off cached review remains compatible;
hydration disabled after cutover yields no model candidates. The two helpers
cannot independently restore an unversioned cached input after cutover.

**R8-4:** The lifecycle-enabled candidate path no longer treats
`description_pruned` as user eligibility. Existing explicit deny, company,
location, budget and discovery predicates remain. The actual successful
filter→hydrate→model→persist fixture now begins with an eligible retired/missing
shared JD and verifies hydration precedes model use.

**R8-5:** Existing private rows with unknown provenance return their honest nullable
fields without falling back to later demands. Independent non-null snapshots
survive even when their version is unknown. New action/absent-row handling remains
separate. Actual score/edit/correction action tests execute the real helper at a
recorded SQL boundary and preserve NULL provenance after unrelated later input;
they do not invoke dataset/provider services.

**R8-6:** Detail preserves the review/correction description returned by its private
query; ready current public data is exposed separately as `currentDescription`
and `currentQuestions`. Résumé-score and cover-edit calibration/sync queries read
their saved description snapshots first, with explicit shared-JD fallback only for
legacy NULL snapshots. Tests extract and execute only each script's static SELECT
against an owned DB with saved and shared JDs that differ. No script, sync,
provider or dataset operation is executed by this verification.

## Verification scope and exact commands

All database runs used the accepted owned random-port harness, `/bin/bash` without
login startup, existing ignored dependencies and offline providers. No shared
55432 DB or reserved destructive feedback fixture was used. Fixture demand removal
uses existing service claim cancellation before deleting its own terminal row;
there was no guard/grant/clock bypass. No Task3 independent expiry/capacity/cross-user
or related adversarial review/probes were retried or substituted.

Evidence lives in `task-8-evidence/fix1/`. Commands from the worktree unless noted:

- Python selected affected lane, MAJOR=17 and 16:
  `.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_lifecycle_demand.py tests/test_reviewer_db.py tests/test_reviewer_run.py -q`
  → **98 passed on PostgreSQL 17.11**, **98 passed on PostgreSQL 16.15**.
  Includes 14 demand tests and the directly affected reviewer regressions. No
  transport/source-adapter/identity/security broad matrix was rerun.
- Dashboard affected lane from `dashboard/`:
  `./node_modules/.bin/vitest run lib/jobLifecycle.fix.test.ts lib/jobLifecycle.test.ts lib/queries.upsertApplicationPackage.test.ts lib/resumeScore.action.test.ts lib/coverLetterEdits.action.test.ts lib/corrections.action.test.ts 'app/api/jobs/[id]/route.test.ts' app/api/application/prepare/route.test.ts app/api/resume/route.test.ts app/api/cover-letter/route.test.ts`
  → **116 passed / 10 files** before the final NULL-capture-time preservation and
  malformed-Q readiness adjustment. Those last changes were verified by the final
  narrower command below; this count is not misrepresented as a final rerun.
- Final affected package/parser/prepare lane from `dashboard/`:
  `./node_modules/.bin/vitest run lib/jobLifecycle.fix.test.ts lib/jobLifecycle.test.ts lib/queries.upsertApplicationPackage.test.ts app/api/application/prepare/route.test.ts`
  → **40 passed / 4 files** (`dashboard-complete.txt`).
- Actual dashboard owner/package/readers lane, both majors:
  `.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- /bin/bash -c 'cd dashboard && ./node_modules/.bin/vitest run lib/jobLifecycle.flow.db.test.ts'`
  → **6 passed on PostgreSQL 17.11** and **6 passed on PostgreSQL 16.15**
  (`dashboard-db17-complete.txt`, `dashboard-db16-complete.txt`). Six ordinary flows include actual package persistence and exact
  receipt assertions; the service-completion boundary in TS remains synthetic.
  Python separately executes actual service capture/worker orchestration.
- `./node_modules/.bin/tsc --noEmit` from dashboard and changed-Python `ruff check`
  complete outputs are retained. `git diff --check` passed.

These are selected ordinary feature checks, not a whole-repository zero-skip or
full release matrix. Initial reviewer diagnostic evidence is preserved unchanged.
Every Fix1 failed attempt is retained and described in `fix1/chronology.md`.

## Remaining limits

Unknown legacy package full-input recapture is **unimplemented** as described
above; this author does not claim universal preparation availability. Fresh
permitted Task8 re-review and Library08 remain controller-owned gates. R6-4
durable progress remains mandatory in Tasks10/13; deliberate Task3 independent
review gaps remain. R6-5 shared transport was not modified or retested here; prior
ordinary offline evidence is not live compatibility, strict real-time, throughput
or independent security proof. No production/network/paid call, migration,
activation, publish, push, merge or deployment occurred. Controls remain off by
default, retirement dry-run and archive inactive.

## Original findings, verbatim

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
