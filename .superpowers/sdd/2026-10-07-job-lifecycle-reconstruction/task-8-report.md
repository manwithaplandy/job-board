# Task 8 author report

**Phase report pointer:** this original report is historical. `task-8-fix2-report.md`
records the current-detail UI and contentless first-output corrections from Fix2;
Fix1/Fix2 reports and their scoped review verdicts are authoritative for their
respective phases. No author report implies independent review acceptance.

**Historical initial-author report:** independent review found R8-1 through R8-6.
The package pinning, consumption and legacy compatibility claims below describe
the original intended behavior and were incomplete. See `task-8-fix1-report.md`
for the corrections, exact final checks and the remaining unknown-legacy
full-recapture availability limitation. Fresh re-review remains pending.

Implemented demand hydration and immutable private inputs. Author verification is
complete; fresh permitted requirements/quality review and Library08 are pending.
This is not independent security approval or approval to activate the rollout.

Baseline: `0df584068c98cce161f354a50a7ad75ec01a0484`. The controller's intervening
documentation commit `7f49ff8` is preserved. No history was rewritten. Controller
progress/resume/checkpoint edits are excluded from the product commit.

## Result and ordinary caller contracts

* `job_discovery/lifecycle/demand.py` coalesces explicit demands, obtains a fenced
  180-second claim, commits before public fetch, renews after the bounded fetch,
  checks the source version again, reserves growth, and commits an exact public
  version with the owner's description/question snapshot before returning ready.
  Empty/failing/malformed descriptions defer. Existing shared payload is retained;
  a separate completion transaction can fill an empty shared description only.
* `reviewer/run.py` selects deterministic eligible candidates before hydration and
  model calls. Missing descriptions skip both model stages. `reviewer/db.py`
  attaches durable review inputs and persists their version/snapshots with results;
  valid-JD stage2 failures still preserve the existing stage1/error-isolation
  behavior. `reviewer/worker.py` processes queued hydration on the existing loop.
* `dashboard/lib/jobLifecycle.ts` owns total demand/request/context parsing,
  owner demand enqueue/read, private input selection and consumption receipts.
  `lib/db.ts` performs service-owned capability bootstrap on the same transaction,
  then changes to the authenticated role for private writes. Only claim/reservation
  metadata is written with service capability; no authenticated helper grant or
  privileged user/job DML was introduced. Existing guards remain authoritative.
  The bootstrap uses a conservative 96 MiB forecast and may reject early near the
  physical ceiling. It settles on the same backend and transaction.
* Prepare, resume and cover-letter routes require ready input before credit/provider
  work. Pending/deferred returns 202 without charging or invoking providers.
  `generationJobs.ts` pins generation input; `queries.ts` pins package input,
  preserves it across subsequent output updates and records consumption in the
  successful artifact transaction. Package JSON binds explicitly as text→jsonb.
  Instruction drafts also require a ready or compatible cached legacy input.
* Application approval, unreject, corrections, scores and cover-letter edits use
  the same scoped private mutation wrapper and preserve their relevant snapshots.
  Job detail requests explicit owner hydration but never stamp mere reads as use.
  Review-request row parsing is total. `RolefitBoard` handles protective 202 status
  by restoring a retryable state and showing the pending notice; its lightweight
  parser does not import server database code into the client.
* Successful consumers write exact-version receipts. Service receipt application
  stamps shared description/question use only when its version matches. Captures,
  discovery sightings, reads and pending requests do not invent use. Demand reuse
  uses description 30-day/question 7-day captured-or-consumed freshness. Existing
  package regeneration remains pinned to its immutable original input.

## Default-off producer through consumer compatibility

Cached legacy workflows remain available under the existing
`legacy_description_capture_allowed` policy. An explicit owner prepare request
with a legacy JD but missing Greenhouse questions queues service work even when
hydration is off, provided sticky cutover has not occurred. The service worker
uses the same policy; this is explicit demand, not passive cache refill.

The final Python integration fixture starts with the actual `db.upsert_jobs`
producer, verifies no listing and no question cache exist, queues prepare, runs
`process_pending`, and observes exact stored-coordinate fetch outside any DB
transaction followed by a durable ready version/schema. To make this ordinary
path work, `identity.migrate_identity_batch` accepts an optional bounded exact
`job_ids` subset, using the existing mapper/provenance. Default behavior is
unchanged; the subset does not advance/reset the global backfill cursor or mark
identity readiness complete. Sticky cutover with hydration disabled stays paused.
No new activation flag, passive fallback, unsafe prune restoration or guard
relaxation was added. The dashboard DB fixture separately exercises owner queue
and ready consumption; its service-completion step is synthetic, whereas the
Python fixture executes the actual worker orchestration.

## Shared transport and source/detail inventory

`job_discovery.http` now routes real requests through `public_fetch.py` for all
callers. The bounded subprocess includes DNS, socket/TLS, headers, wire body,
decompression and JSON parsing in its deadline; the retry facade shares an overall
20-second budget. Connections pin validated public addresses, verify the peer,
retain original-host TLS verification, manually follow at most three redirects
with fresh address validation, strip URL credentials and send no inherited
cookies/auth/proxy credentials. Wire and expanded bodies are capped at 10 MiB;
unexpected content types/encodings or malformed payloads fail closed. Parsing is
performed in the bounded child; its local result envelope is not network pickle.

| Caller | Shared request path / allowed operation |
| --- | --- |
| Greenhouse adapter | completeness→http GET board enumeration |
| Lever adapter | completeness→http GET board enumeration |
| Ashby adapter | completeness→http GET board feed |
| Workable adapter | completeness→http GET widget feed |
| SmartRecruiters adapter | completeness→http GET pages and supported details |
| Workday adapter | completeness→http allowlisted readonly CXS search POST and detail GET |
| Legacy Greenhouse question spool via `run.py` | injected shared get_json; existing compatibility controls retained |
| `company_discovery/enrich.py` | shared JSON and bounded text GET |
| Demand Greenhouse / Lever / SmartRecruiters | exact stored board + external ID detail GET |
| Demand Workday | validated stored tenant/datacenter/site + exact `/job/…` detail GET |
| Demand Ashby / Workable | one current bounded feed, at most 10,000 entries, unique exact ID match |

Demand never fetches an application URL or submits an application/form. The
browser-side prepare question fallback was removed. The inherited R6-5 transport
gap is addressed at the shared transport, not only for demand. No live provider
endpoint was exercised; offline doubles establish the selected behavior. Source
worker scheduling/durable above-guard progress R6-4 remains Tasks 10/13 work.

## SQL and rollout state

Migration03 validates Task2's existing snapshot columns and constraints; it does
not first-create those prerequisites. It adds consumption receipts with an invoker
stamp trigger and a service-only installed-writer readiness record. `validated_at`
remains NULL pending release verification. Matching fresh-schema definitions have
no embedded transaction wrapper. Production control defaults remain off,
retirement dry-run and archive inactive. No production migration, provider/model
request, activation, S3/IAM work, deployment, publishing, merge or push occurred.

## Verification and chronology

Evidence files are in `task-8-evidence/`. `chronology.md` retains initial failures,
including which early logs were overwritten and are represented only by exact
outcome summaries. `red.txt` retains the original missing-module RED output;
`python17.txt` retains the initial 132-pass/2-fail output. Initial failed outputs
are not labelled successful verification.

All commands below ran from this worktree using the ignored existing environment
and `/bin/bash` without login startup. Harness databases were owned, disposable,
random-port instances, never shared port 55432.

1. Initial RED: `.venv/bin/python -m pytest tests/test_lifecycle_demand.py -q` →
   collection failed because the demand module did not yet exist.
2. Earlier broad Python command, on PostgreSQL **17.11** then **16.15**:
   `.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_lifecycle_demand.py tests/test_public_fetch.py tests/test_http.py tests/test_reviewer_run.py tests/test_reviewer_worker.py tests/test_reviewer_db.py tests/test_greenhouse_questions.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_workday.py tests/test_smartrecruiters.py -q`
   → **214 passed** on 17 / **215 passed** on 16. These are earlier revision
   results, before the final legacy mapper/package corrections; the additional
   legacy worker test accounts for the count difference. They are not represented
   as a full broad rerun of final source.
3. Final affected Python command, both majors:
   `.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_lifecycle_demand.py tests/test_lifecycle_identity.py -q`
   → **30 passed** on 17.11 and **30 passed** on 16.15. Includes all 11 demand
   tests, actual legacy upsert→mapping→worker flow and the existing mapper cases.
4. Final offline transport: `.venv/bin/python -m pytest tests/test_public_fetch.py tests/test_http.py -q`
   → **18 passed**. Normal bounded transport tests include redirects, address
   validation/pinning configuration, deadline process boundary, size/type limits,
   readonly POST selection and error-status handling; no live network was used.
5. Dashboard selected lane (run within dashboard):
   `./node_modules/.bin/vitest run lib/jobLifecycle.test.ts lib/reviewRequests.test.ts lib/queries.upsertApplicationPackage.test.ts lib/applicationActions.test.ts lib/corrections.action.test.ts lib/coverLetterEdits.action.test.ts lib/jobsReject.action.test.ts lib/resumeScore.action.test.ts app/api/application/prepare/route.test.ts app/api/cover-letter/route.test.ts app/api/resume/route.test.ts 'app/api/jobs/[id]/route.test.ts' components/rolefit/RolefitBoard.test.tsx`
   → **135 passed / 13 files** before the final package-binding correction.
6. Final affected dashboard command:
   `./node_modules/.bin/vitest run lib/queries.upsertApplicationPackage.test.ts lib/generationInstructions.action.test.ts lib/jobLifecycle.test.ts`
   → **13 passed / 3 files**. Final `./node_modules/.bin/tsc --noEmit` exited 0.
7. Final actual dashboard owner DB command, both majors:
   `.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- /bin/bash -c 'cd dashboard && ./node_modules/.bin/vitest run lib/jobLifecycle.flow.db.test.ts'`
   → **4 passed** each on 17.11 and 16.15. Covers owner coalescing/generation
   snapshot/receipt, flag-off question demand readiness, actual package snapshot
   and JSON persistence with receipt, and an ordinary authenticated write using
   service capability bootstrap. The last fixture selects enforced state locally;
   it does not claim to validate production activation transitions. Existing row
   and reservation guards remain installed and unchanged.
8. Changed Python lint and `git diff --check` passed. Only one TSX component was
   edited, so the multiple-component React skill trigger did not apply.

Selected final DB runs contain no skipped tests. This is not a whole-repository
zero-skip/full-matrix claim. Tests cover ordinary new feature contracts, not the
refused independent expiry/capacity/cross-user/adversarial mechanism review.

## Remaining limits and handoff

Independent Task3 expiry enforcement, capacity accounting, cross-user isolation
and related adversarial review remain deliberately unperformed under the review
scope amendment. No replacement probes/reviewer were introduced. The controller
owns fresh permitted Task8 review, Library08 and subsequent tasks. Archive-active
event pairing, R6-4 above-guard progress, completed readiness/backfill and final
release checks remain later tasks; this commit does not activate them. Transport
verification uses offline fixtures and owned DBs only. Private snapshots and
protected shared content are retained conservatively in this rollout.
