# Task 8 Fix1 scoped independent requirements and quality review

**ScopedSpec: FAIL. Quality: CHANGES_REQUIRED.** Original findings R8-1 through R8-6 are addressed in their specified cases, subject to the explicit legacy availability limitation below. Two Important Fix1-introduced caller regressions remain; no Critical finding in this scope.

Exact reviewed range: `4d48602947b84983acc54738bd21e45a52862725` → `29d34ec9a3de95c3a1bd86e5ce215e07b5bc7743`. Product correction is `e547270461cc218ec24619ca87bb341945d18efe`; the final commit records documentation provenance. The three controller-authored documents included in the product commit are not treated as author product changes or a correctness issue. No history rewrite is requested.

This is the same original reviewer's scoped rereview: original six findings plus Important/Critical regressions introduced by Fix1 only. I read the original review/diagnostics, Task 8 brief, original report as historical, current Fix1 report, pinned package, actual Fix1 evidence/chronology, scope amendment and release authorization, and traced affected callers. No new whole-task review or security/mechanism review was performed.

## Original finding verdicts

| Finding | Verdict | Source and actual supporting evidence |
| --- | --- | --- |
| R8-1, résumé-first missing questions falsely ready/no queue | **ADDRESSED**, with legacy limit | `jobLifecycle.ts:116`–`155` now requires preparation questions and queues actual owner work. `demand.py:273`–`287` obtains first questions while retaining the saved JD/version and rechecking the package. The real-helper prepare route test proves pending before allowance/provider work; Python executes the real worker with a changed fetched JD and verifies the original saved JD survives; dashboard DB flow persists the first question schema. Unknown legacy artifacts have an honest deferred response, rather than fictitious pending work. See the accepted availability limit and new contentless-row regression F1-2 below. |
| R8-2, latest same-version demand substitutes package input/wrong receipt | **ADDRESSED** | `jobLifecycle.ts:117`–`126` compares saved version/JD/Q and preserves actual demand kind; `159`–`190` checks exact receipt ID/kind/input and saved package agreement. `queries.ts:632`, `658`–`662`, `704`–`705` validates before output mutation, retains original input/capture fields and consumes only the actual receipt. DB evidence covers different questions on the same public version, rejected mismatches, unchanged unrelated receipt, and original-demand disappearance. `demand.py:225`–`247` makes a genuine new private copy with a new demand/capture time, not old-history reconstruction. Reviewer `demand_id` now survives result serialization and scopes its consumption. |
| R8-3, disabled hydration restores legacy reviewer input after cutover | **ADDRESSED** | `demand.py:336`–`343` and `reviewer/db.py:526`–`529` both consult existing pre-cutover compatibility. The final ordinary fixture explicitly establishes initial flag-off compatibility, then sticky cutover and no model calls. No inference about underlying enforcement mechanisms is made. |
| R8-4, retired-cache marker prevents candidate hydration | **ADDRESSED** | `reviewer/db.py:299`–`307` gates the old cache predicate on hydration being disabled, retaining the other deterministic predicates. The real selected-candidate → hydration → model → persist fixture now starts with a missing/pruned JD and passes in the final 98-test lanes. |
| R8-5, legacy private rows borrow unrelated later provenance | **ADDRESSED** | `jobLifecycle.ts:204`–`218` returns an existing row's honest nullable fields and falls back only for an absent row. Score/edit/correction actions preserve the difference between an existing unknown snapshot and no snapshot. Actual-helper boundary tests cover all three actions and an independent legacy JD without a fabricated version. |
| R8-6, historical readers override/ignore saved JD | **ADDRESSED** for the original historical-input defect | Detail retains the saved JD and exposes current data separately at `app/api/jobs/[id]/route.ts:40`–`42`; the new historical-input route test checks both fields. Both calibration SELECTs prefer their score/edit saved description and have explicit legacy-null fallback. The owned DB test extracts and executes only these SELECTs. However, the changed detail response is not integrated into its existing UI consumer; see F1-1. |

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

## Availability limitation retained, not presented as solved functionality

For actual legacy artifacts whose historical input is unknown, the response honestly says that full recapture is not yet supported and retains their contents. There is no implemented recovery button or atomic full-package replacement. Existing preparation can preserve failed/unrequested older legs, so declaring that operation a full recapture would misrepresent provenance. The controller explicitly accepted terminal deferral as the scoped alternative; I accept the removal of false pending for that case, **not** universal preparation availability or a functioning recovery path.

The implementation also terminal-defers an existing unknown-input package whenever `legacyAllowed` is false (`jobLifecycle.ts:104`), including lifecycle-enabled operation, rather than only the initial missing-question scenario. Pre-cutover cached legacy work remains usable and an independent saved legacy JD is used when available. This actual availability boundary must stay visible in Task13/final review and release communication. R8-F1-2 must not be hidden inside this limitation, because its ordinary draft-only row has no unknown generated artifact to preserve.

## Evidence, scope and remaining limits

Read the actual final affected logs: **98 passed each** on PostgreSQL **17.11** (37.13s) and **16.15** (47.50s), **6 dashboard DB flows each** on both majors, and **40 final affected TS tests in 4 files**. The earlier 116/10-file TS run predates the last NULL-capture-time/question-usability edits; it is not a final-source full matrix. `tsc-complete.txt` is empty success output per the recorded command outcome; lint prints “All checks passed!”. The initial REDs, 94/3 and 97/1 Python attempts, TS mock/type failures, and misleading `reviewer-green.txt` filename are preserved and explained in chronology. No failing attempt is treated as GREEN.

The dashboard service-completion boundary remains synthetic; Python separately exercises the actual worker. Terminal-origin removal uses normal cancellation of its own completed service claim in the author fixture; no guard/grant/clock bypass was introduced. I assessed only the ordinary feature flow, not that mechanism's independent security properties.

No covered suite was rerun. The only new executable diagnostic was the narrow actual-route in-memory read composition for R8-F1-1. No product edits, commits, subagents, DB startup, production/network/provider/paid calls, sync execution, migration or activation occurred. The report is the only new deliverable. Scope did not expand into refused Task3 expiry enforcement, capacity accounting, cross-user isolation or adversarial review/probes, and no safeguard rejection occurred.

R6-5 shared transport is unchanged: the previous ordinary source/offline assessment stands within its stated limits, without live compatibility, load or strict timing proof. R6-4 remains mandatory Task10/13 work. Task3's deliberate independent-review gaps remain. Untouched historical issues/minor formatting are deferred; this is not a fresh whole-task findings list. No security, activation, or release approval is granted. Controller owns the two-finding fix dispatch, subsequent scoped review and Library08 gate.
