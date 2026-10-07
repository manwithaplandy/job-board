# Task 8 Fix2 author report

Reviewed FixBASE: `29d34ec9a3de95c3a1bd86e5ce215e07b5bc7743`.
Intervening controller documentation commit `bbc64bb` is preserved. This report
addresses only R8-F1-1 and R8-F1-2 from the complete Fix1 scoped review. Original
Task8 and Fix1 reports remain historical; phase reports and actual scoped reviews
are authoritative. Fresh scoped re-review is pending, not implied by author tests.
Product source and covering evidence commit: `eaef2fb43199771d3d18a3ed876cc62fb240a6ac`.
This subsequent report-only commit records that immutable source pin; no product
implementation changed after the final selected verification described below.

## R8-F1-1 — actual current and saved detail consumers

The board now reads and total-parses `currentDescription` and `currentQuestions`.
The detail query exposes whether its JD is an actual saved review/correction
snapshot. When no private snapshot exists, a ready current description replaces
stale/missing shared content in the board's displayed job. JobDetail renders the
current posting JD and separately labels a differing saved review JD or saved
application JD. Existing reasoning/correction context retains its saved input.

Package read DTOs now carry their saved description and total-parsed question
schema through initial reads, a single-package refresh and successful persistence.
If saved answers exist, the application panel uses that package's saved schema,
including honest NULL for unknown legacy schema. It never merges answers with a
newer question capture. Current questions have a separate labelled read-only
section in that case; unreviewed jobs can also see current questions. Without
saved answers, the existing question panel receives the ready current schema.

Tests execute the actual board/detail components for a stale shared JD, missing
shared JD on an unreviewed job, and saved review/application inputs differing
from the current posting. They open the actual disclosures and verify saved
answers remain in their own panel without the current question being merged.
Package codec and detail-query tests cover the actual new server DTO fields.

Applied `c12/react-best-practices` because both RolefitBoard and JobDetail changed.
The focused checklist covered native accessible disclosures, stable list keys,
derived state instead of extra effects, complete package/detail dependencies,
existing fetch deduplication, and client-only total parsers without server imports.
No helper agent or independent reviewer was used by the author.

## R8-F1-2 — first output after instructions or application markers

Readiness, service hydration and transactional persistence now distinguish a row
with retained generated output from a contentless row. Any non-NULL résumé,
cover-letter or prefilled-answer payload counts conservatively as generated work
(including a completed empty answer list). Instructions, status and apply markers
alone do not establish a historical generated input.

An artifact-free row follows ordinary demand readiness, including first Prepare
with missing questions. The worker ignores unused draft input as historical
artifact provenance and captures the genuine demanded input. Persistence checks
output presence under the existing job/transaction lock. The first successful
output can establish its actual version/JD/Q/capture fields; subsequent output
continues to require the immutable saved tuple. Existing applied status/time and
other instruction drafts remain intact. Instructions used by the generated leg
move into its existing applied-instruction field under the preexisting semantics.

The new owned-DB flow calls the actual `upsertInstructionDraft` producer twice,
retains an application marker, enqueues with `requestJobPayload`, invokes actual
Python `process_pending` against the **same database**, then persists/reloads the
first artifact through the real package helper. Only the public fetch boundary is
an offline double, with an assertion that the DB connection is idle during fetch.
The worker uses the real pre-cutover missing-listing mapper and snapshot/claim/
reservation paths. No provider or model is invoked. Route tests execute the actual
readiness helper with recording SQL boundaries and prove pending before allowance
or provider calls both in and outside legacy compatibility.

Real unknown legacy artifacts retain the Fix1 terminal alternative and its explicit
message: full input recapture is not supported. Their provenance is not retrofitted
and their contents remain available. The existing tests now explicitly include a
persisted output when claiming to represent an old artifact; a snapshot-only row
is deliberately not classified as generated work.

No schema, guard, grant, reset, deletion or production activation change was made.

## Exact verification

All commands used the existing ignored dependencies, `/bin/bash` without login
startup, offline doubles and the owned random-port DB harness. No shared 55432
instance or reserved destructive fixture was used. Evidence is in
`task-8-evidence/fix2/`; initial failures are retained in `chronology.md`.

- Demand-only affected regressions, both majors:
  `.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_lifecycle_demand.py -q`
  → **14 passed on PostgreSQL 17.11**, **14 passed on PostgreSQL 16.15**.
- Actual cross-language owner/worker/first-output flow plus existing directly
  affected package flows, both majors:
  `.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- /bin/bash -c 'cd dashboard && ./node_modules/.bin/vitest run lib/jobLifecycle.flow.db.test.ts'`
  → **7 passed on PostgreSQL 17.11**, **7 passed on PostgreSQL 16.15**.
  The new first-output fixture runs the real Python worker in this same DB; the
  older synthetic completion fixtures retain their previously documented scope.
- Final selected UI/TS command from dashboard:
  `./node_modules/.bin/vitest run components/rolefit/RolefitBoard.test.tsx lib/queries.applicationPackages.test.ts lib/queries.coverLetterEdits.test.ts lib/queries.upsertApplicationPackage.test.ts lib/jobLifecycle.fix.test.ts lib/jobLifecycle.test.ts app/api/application/prepare/route.test.ts 'app/api/jobs/[id]/route.test.ts' lib/generationInstructions.action.test.ts`
  → **80 passed / 9 files**. Subsequently adding the second compatibility-mode
  fixture and detail DTO assertion required only the two narrower commands below.
- `./dashboard/node_modules/.bin/vitest run --root dashboard lib/queries.jobDetail.test.ts`
  → **4 passed**.
- `./dashboard/node_modules/.bin/vitest run --root dashboard app/api/application/prepare/route.test.ts`
  → **32 passed** (`prepare-final.txt`); covers both contentless compatibility
  modes and the genuine unknown-artifact terminal branch. This extra fixture
  postdates the 80-test run; product implementation did not change afterward.
- `./dashboard/node_modules/.bin/tsc --noEmit --project dashboard/tsconfig.json`
  exited 0; changed-Python ruff and `git diff --check` passed.

No whole-Task8, 98/214/215-test reviewer/source matrix, transport suite or refused
mechanism suite was rerun. These are selected ordinary feature tests, not a full
release matrix or independent security assurance.

## Remaining limits

The genuine unknown legacy-artifact full-recapture flow remains unimplemented,
including the non-legacy terminal boundary documented by Fix1 review. Saved
artifacts are retained; this report does not claim universal preparation
availability. Task3 independent expiry/capacity/cross-user/adversarial review gaps
remain deliberate. R6-4 remains mandatory Task10/13 work. Shared transport is
unchanged and its prior offline evidence is not a live timing/load proof. Defaults
remain off, retirement dry-run and archive inactive. No production/network/paid
provider call, deployment, push, merge, PR, activation or infrastructure operation
occurred. Controller owns the next scoped review and Library08 gate.

## Complete Fix1-introduced findings, verbatim

## Important regressions introduced by Fix1

### R8-F1-1 — Ready hydrated detail is moved into fields the actual UI never reads

Changed path: `dashboard/app/api/jobs/[id]/route.ts:42`. Actual consumers: `dashboard/components/rolefit/RolefitBoard.tsx:41`, `699`–`700`, `720`–`741`; `dashboard/components/rolefit/JobDetail.tsx:194`, `686`–`711`.

Preserving historical review input is correct, but Fix1 moves every ready demand's JD and questions to `currentDescription`/`currentQuestions`. The actual board response type still contains only the original detail fields; it merges `detail.description` into the job, reads only `detail.questions` for the question panel, and JobDetail renders only `job.description`. Repository search finds the new fields only in the route and its test, not a UI consumer.

For an ordinary job with **no private snapshot**, the detail query falls back to the shared cache. Hydration intentionally retains an existing non-null shared JD. Thus a ready demand can contain the new JD/questions while the user continues to see the old shared JD and no questions. With a missing shared description, the ready response's new JD can be entirely absent from the displayed description slot. This is a regression from the reviewed initial route, which put the ready data in the fields used by the UI. The historical-snapshot test does not cover this non-historical caller case.

A narrow new in-memory diagnostic transpiled and executed the actual GET route with ordinary read boundaries: no private review, a ready current demand, and either an old or null shared JD. No server, database, or network request was used. Exact outputs:

```json
{"noPrivateSnapshot":true,"ready":"ready","displayFieldUsedByJobDetail":"Older shared JD","currentDescription":"Hydrated current JD","questionsFieldUsedByBoard":null,"currentQuestions":{"questions":[{"label":"Hydrated Q","fields":[],"required":false}]}}
{"noPrivateSnapshot":true,"ready":"ready","displayFieldUsedByJobDetail":null,"currentDescription":"Hydrated current JD","questionsFieldUsedByBoard":null,"currentQuestions":{"questions":[{"label":"Hydrated Q","fields":[],"required":false}]}}
```

These outputs establish route behavior at a synthetic read boundary; UI impact follows from the actual field references above, not a claimed browser run.

**Required narrow fix:** integrate the new current fields into the actual detail contract/rendering, or expose whether the original description is a saved private input and supply ready current content to the existing display fields when no private input exists. Preserve historical review/correction context explicitly. Ensure ready question schema reaches the intended question UI without substituting a newer schema for saved package answers. Add targeted UI/consumer coverage for both a private saved JD and a job without private input whose shared JD is stale/missing. No transport or whole-repository rerun is needed for this fix.

### R8-F1-2 — Saving instructions before generation can falsely classify an empty row as an unrecoverable legacy artifact

Changed paths: `dashboard/lib/jobLifecycle.ts:92`–`114`, `174`–`190`; `dashboard/lib/queries.ts:658`–`662`. Normal existing producer: `dashboard/lib/queries.ts:711`–`745`, called by `dashboard/app/actions/generationInstructions.ts:32`–`35`.

Fix1 treats **any** `application_packages` row with a null version/description as an existing unknown-input artifact. Its SELECT does not read the generated artifact columns, so it cannot distinguish a historical résumé/letter from a row containing only saved instructions. `upsertInstructionDraft` explicitly creates such a contentless `prepared` row before the first generation. Under initial legacy controls, a usable shared JD permits saving the instruction; absent ready demand provenance makes that row's version/JD/Q null.

The next Greenhouse Prepare click, with no cached questions, now enters the new terminal-deferred branch: “saved artifacts remain available” and full recapture is unsupported. There are no generated artifacts to preserve or recapture. Without saving the instruction first, the same owner/job state takes the no-package path and queues normal question hydration. After leaving legacy compatibility, the same contentless null-input row also blocks generation at line 104 regardless of question availability. This is ordinary first-use functionality, distinct from the accepted limitation for genuine historical artifact legs.

The new persistence assertion and unconditional preservation of existing null version/JD additionally mean that fixing only the enqueue branch is insufficient: first output for a contentless row must be allowed to establish its real input under the normal mutation transaction. Otherwise it will be rejected after provider work or remain falsely unversioned.

Evidence is a direct source composition of the real instruction-save producer and the newly changed package/readiness/persistence branches. I did not rerun the author's unknown-legacy fixture under a different name; that covered fixture does not distinguish rows with generated work from contentless rows.

**Required narrow fix:** distinguish saved user artifacts from contentless instruction/application marker rows when choosing input readiness and asserting first output persistence. Preserve the draft/status/user work, but let an artifact-free row obtain a genuine first input and generate normally; only real unknown historical output legs need the unsupported full-recapture deferral. Keep saved artifact provenance immutable. Add the ordinary Save instructions → first Prepare missing Q → worker ready → successful first artifact flow, including the before-charge pending behavior, plus a genuine legacy-artifact case retaining the terminal alternative. No guard/grant change or deletion/reset workflow is required.
