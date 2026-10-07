# Task 9 independent requirements and code-quality review

**Spec: FAIL. Quality: CHANGES_REQUIRED.** Two Important functional findings remain. No Critical finding is asserted within this permitted review scope.

Reviewed 2026-10-07 against BASE `5a319253169cd03e1821e7c3d02df82249e6ce8b` through HEAD `7d9216d6c3a2a0ad8f28350e0f7992afbb725410`. Product commit is `ba00e50153f948ebe8726db1a445e201ebce5901`; the subsequent commit is report-only. This review does not approve release or activation.

## Important findings

### R9-1 — Discovery rows contaminate independently paginated saved history

**Locations:** `dashboard/components/rolefit/RolefitBoard.tsx:589`, `:598`, `:609`, `:1415`; caller `dashboard/app/page.tsx:46` and `:79`.

`historyJobs` merges `initialHistory` with every approved/corrected/package-bearing job in `boardJobs`. The server independently fetches the selected discovery page and selected history page. Consequently, navigating to history page 2 still adds eligible rows from discovery page 1 to that history page. The history controls continue to show the server history total and a 500-row page calculation.

For example, with 1,000 approved saved jobs and disjoint 500-row server pages, history page 2 renders its 500 rows plus the 500 discovery-page-1 rows. The first page repeats and the claimed independent 500-row page becomes 1,000 rows. The applied view uses the same pool, so applied jobs from the discovery page can likewise recur across history pages. This contradicts Task9 counts/pagination agreement and the runbook's independent `page`/`historyPage` contract at `docs/runbooks/2026-10-07-lifecycle-consumers.md:35`.

**Evidence:** source call-chain inspection plus one new narrow, DB-free diagnostic importing the actual `mergeRejectedPool` and `filterByView` helpers. It created 500 approved discovery rows and 500 distinct approved history-page-2 rows and evaluated the exact merge/filter composition. Exit 0 output:

```json
{"diagnostic":"actual pure history merge helper with disjoint server pages","serverHistoryPageRows":500,"clientHistoryPageRows":1000,"repeatedDiscoveryPageRows":500}
```

This was an ordinary uncovered UI pagination diagnostic, not a React browser test, database test, capacity test, or enforcement/security probe. No existing covered suite was rerun.

**Narrow fix:** render paginated history from the selected server history page. Keep any union needed for selected-detail lookup separate from the displayed page. Handle genuinely new in-session saved work through an explicit bounded refresh/update mechanism rather than merging the entire independent discovery page. Add a focused component regression using disjoint discovery/history pages and verify visible IDs, page size, and lack of repeats, including applied rows.

### R9-2 — Saved application work remains hidden for history jobs without a review score

**Locations:** new history membership at `dashboard/lib/jobsQuery.ts:55`; retained reviewed-only gates at `dashboard/components/rolefit/JobDetail.tsx:161`, `:396`, `:516`, `:640`; fixture at `dashboard/lib/jobLifecycleConsumers.db.test.ts:42`.

The new history query correctly admits an owner application package independently of review existence or fit score. However, `JobDetail` defines `hasReview` solely as `job.fit_score != null`, and the entire `ApplicationPanel` remains inside the `hasReview` fragment. The applied-status action row is also gated by `hasReview`. A prepared/applied saved job without a score therefore opens into "Not yet reviewed" while its saved application answers, generated documents, preparation status and applied status remain inaccessible through this panel.

This is a previously existing rendering assumption exposed by the new Task9 history population, not a request to implement Task8's deferred universal recapture. The Task9 owned DB fixture itself creates prepared `unknown` and applied `unmapped` packages without review rows, establishing that this is an intended history shape. The query tests establish that those rows are selectable, but the UI evidence does not establish that their saved content is readable. The new requirement is protected prepared/applied history visible, and the runbook expressly promises an actual card-to-detail path with retained work readable.

**Evidence:** direct conditional-rendering inspection. `ApplicationPanel` receives the saved `pkg` answers/status/applied timestamp at lines 682–684 only inside the scored-review branch. No additional test or database operation was needed to establish that branch behavior. The existing browser fixture and history component coverage do not cover an unscored retained package with saved content.

**Narrow fix:** make retained application contents and persisted applied/preparation status readable independently of the score. Keep review analysis controls conditional on a review, preserve existing generation readiness rules, and preserve the saved JD/Q/version/receipt contract. Add a focused detail/history component case for an unscored prepared or applied historical job with retained answers/artifacts. Do not substitute current questions for missing historical questions or enable deferred real-artifact recapture as part of this fix.

## Minor findings and carried integration limits

1. `dashboard/components/analytics/FunnelSection.tsx:116` and `:177` still label percentages of `j.open` as "of open" after the population was changed and its primary label became "In discovery". That denominator may include source-unknown discoverable jobs. Change the suffix to "of discovery" for consistent source/discovery wording.
2. The new `dashboard/lib/jobLifecycleConsumers.db.test.ts:10` deliberately throws at collection without `TEST_DATABASE_URL` and `LIFECYCLE_REQUIRE_DB_TESTS=1`. Default `dashboard/vitest.config.ts:16` includes that file, while `.github/workflows/ci.yml:75` supplies neither owned-harness variable and runs plain `npm test` at line 99. Thus ordinary CI collection will also fail on this new file. **The underlying lane-selection defect is inherited:** both `jobLifecycle.db.test.ts` and `jobLifecycle.flow.db.test.ts` already have equivalent guards at BASE. This is not presented as a previously green CI regression or a third Task9 functional blocker. Carry explicit owned-DB/default-lane selection into Task13, retaining all strict target guards; the author's `--exclude '**/*.db.test.ts'` broad command does not prove plain CI green. Never fix this by pointing the destructive owned fixture at a shared database.
3. No explicit Task9 author React-checklist record was identified. This review inspected the changed client/server boundary, hook dependencies, pool selection and rendering paths directly. Task8's checklist is not Task9 verification.

## Requirements and source-quality assessment

The central lifecycle query contract is substantially implemented. The important UI composition defects above prevent an overall Spec PASS.

- The additive fixed read-only functions in `migrations/2026-10-07-04-lifecycle-feed.sql` provide the narrow derived public lifecycle projection and discovery/source-closure predicates. Source/control tables remain service-only; existing anonymous and owner SQL wrappers remain in use. Source inspection found fixed SELECT bodies, fixed search paths and explicit object references, with no new underlying table grants, private data/control-internal/claim/capacity/credential projection, DML, dynamic bypass or board `serviceSql` escape in this delta. This is a source-contract assessment, **not an independent mechanism/security assurance**.
- Migration text is byte-identical to the appended `schema.sql` suffix. The supplied ordinary DB evidence covers applying the additive migration twice and exercising the existing wrapper paths on PostgreSQL 17.11 and 16.15. No migration was run by this reviewer.
- Rows, totals and pagination reuse the shared discovery predicate. `getJobsPage` obtains count and rows in one SQL statement; reviewer count/page selection likewise shares membership and statement-time evaluation. Frozen UTC elapsed 30-day expiry is separate from open/unknown/closed and payload retirement. Explicit older-live includes expired confirmed-open sources; unknown and closed remain distinct. Flag rollback excludes proven closed mappings; unmapped rows honestly fall back to legacy state without inventing anchors/source state.
- The owner history query bypasses discovery/profile exclusions and admits persisted approval, corrections and application packages independently of horizon and review errors. The SQL contract is sound for the ordinary shapes reviewed. R9-1 and R9-2 concern how those returned rows are composed and displayed.
- The new client-safe lifecycle state module removes the earlier server-DB import from the browser dependency path. Nullable total parsing handles malformed/double-encoded values without trusting a TypeScript assertion; date anchors require zoned input and consistent elapsed duration. Detail/review/application projections distinguish current payload availability and retained inputs.
- The timestamp/cache-consumer inventory and runbook were read and checked against relevant actual callers: filters/jobs queries, board/detail/API, review feed/reviewer candidate selection, analytics/metrics, history/application paths, and the documented unchanged observation/maintenance consumers. Existing first-seen ordering remains readable without claiming employer publication age. Legacy observed closure-duration metrics are explicitly distinguished from expiry.
- Disabling public 120-second ISR in favor of per-request reads addresses cached expiry-boundary staleness. It increases anonymous read frequency; per-row predicate cost and traffic/load cost remain unmeasured. This change is not cost-neutral by evidence. Existing cached review statistics can still lag; no universal instantaneous-statistics claim is made.

## Evidence read and verification limits

Read the brief first, then reviewer dispatch, `REVIEW-SCOPE-AMENDMENT.md` and `RELEASE-AUTHORIZATION.md`; full Task9 report, chronology, complete review package and actual final outputs; browser script/entry/result and all three screenshots; relevant current Task8 fix-2 report and requirements review for preserved limitations. The complete-diff section in `task-9-review-package.md` was compared mechanically with the exact pinned `git diff --no-ext-diff --unified=10 BASE..HEAD` and matched. HEAD was checked locally. No product file was changed.

The actual evidence supports these bounded claims:

| Evidence | Actual result and scope |
| --- | --- |
| `task9-selected-release.txt` | 193 passed in 13 selected TypeScript files; no final declared skips in that selection. |
| `task9-db17-complete.txt`, `task9-db16-complete.txt` | 6 ordinary consumer tests passed on each of PostgreSQL 17.11 and 16.15. |
| `task9-reviewer17-release.txt`, `task9-reviewer16-release.txt` | 9 reviewer tests passed, 30 deselected on each server. Deselection is not a passed broader suite. |
| Final typecheck, Ruff, lint and diff artifacts | Typecheck exit 0; Ruff passed; lint 0 errors and 9 inherited warnings; final diff check clean per recorded output/exit evidence. |
| `browser/result.json`, `task9-browser-release.txt`, screenshots | 9 assertions; Chromium 151.0.7922.173; desktop 1280×800 and mobile 390×844; `errors: []`, `blocked: []`. Actual components with loopback fake props/actions/navigation/API. |

The two broad non-DB runs were **not green**: 1706/1708 passed respectively, each with four failures and two genuine missing-PDF fixture skips. Their Task9 UI/UTC failures were subsequently covered by the final selected green run. Three inherited fixture failures remain carried to Task13: two tombstone-action mocks missing Task8 exports and the workflow DATABASE_URL-count expectation. Name-filtered exclusions in intermediate runs are not genuine declared skips. Wrong-cwd attempts, a concurrent timeout, initial DB fixture failures, initial client bundle/server import failure, UTC RED, browser harness errors and the Chromium download 403 remain visible in the chronology; none was silently promoted to a successful result.

The browser evidence validates local component behavior only. It does not establish Next SSR, real authentication, real providers, production rollout, pipeline completion, comprehensive browser behavior, traffic capacity or cost. No full test matrix, live environment, remote ancestry or production claim follows. The two Important findings are uncovered combinations beyond those recorded passing cases.

## Scope boundaries and handoff

This was a fresh ordinary Task9 requirements/code-quality review only. No omitted/refused Task3 expiry-enforcement, capacity-accounting, cross-user or adversarial security review/probe was retried, reproduced, split, substituted or disguised. Functional feed expiry/count/query evidence supplies no independent mechanism-security assurance. R6-5 shared transport was not re-reviewed or rerun. R6-4 durable above-guard progress remains mandatory for Tasks10/13 and is not waived.

Task8 immutable private JD/Q/version and exact actual consumption receipt behavior remains the contract. Genuine old artifacts with unknown original inputs still terminal-defer; full recapture is unimplemented. There is no universal preparation-availability claim.

No network, provider, paid, production, deployment, migration, activation, shared-port-55432 or reserved-fixture action was performed. No covered test suite was rerun. The only new executable diagnostic was R9-1's pure local helper composition. Only this review report was written; no product edits or Git commits were made. Resolve R9-1 and R9-2 with narrow component coverage before seeking Task9 approval; retain the listed integration and rollout limits in the controller handoff.
