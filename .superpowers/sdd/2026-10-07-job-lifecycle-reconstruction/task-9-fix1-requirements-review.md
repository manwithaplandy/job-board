# Task9 Fix1 — scoped requirements and code-quality rereview

**Scoped Spec: PASS. Quality: APPROVED.** R9-1 and R9-2 are **ADDRESSED**. No new Important or Critical breakage was found in this fix diff within the permitted scope. This is Task9 requirements/code-quality acceptance after the original review and this correction review, not independent security approval, activation approval, a whole-branch verdict, or completed release verification.

## Exact pins and scope

- Original Task9 BASE: `5a319253169cd03e1821e7c3d02df82249e6ce8b`.
- FixBASE/original reviewed HEAD: `7d9216d6c3a2a0ad8f28350e0f7992afbb725410`.
- Fix1 product source: `6bd1099b4338cd154e8f1360db1e87fbe6fc2dae`.
- Fix1 reviewed HEAD: `fd0422fb8e5dab1ee006d87dcb992bcb13c4e9e2` (report-only follow-up).
- Source commit parent: `08922f4775dd5be62bd770383b21c96c3abd0a0f`; intervening controller documentation commits remain preserved.
- During review the controller advanced local HEAD to `5c8deac851fb89166dad57404cc6268c3a78f6d6`. Its five changed paths are controller documents/the review package only; no product change from the reviewed Fix1 HEAD. This report's review range remains the exact FixBASE..`fd0422fb` range above.

Same original Task9 reviewer, one scoped Fix1 rereview: R9-1 history pagination, R9-2 unscored retained application visibility, related Funnel copy/React evidence, and new Important/Critical issues introduced by the fix. The Task9 brief, original complete findings, review-scope amendment and release authorization remain binding. Unchanged earlier Task9 areas were not reopened or retested.

Read the complete Fix1 author report, review-package material, actual source delta and affected callers, chronology, final and intermediate outputs, browser entry/script/result, and all four screenshots. The full package's complete-diff section was mechanically compared to `git diff --no-ext-diff --unified=10 FixBASE..HEAD` and matched exactly. Its 6,920-line embedded original Task9 package was also verified byte-for-byte against the complete package already read in the original review; it introduces no new source to rereview. Local HEAD matched the pin above. Eight product/test files changed, all under dashboard components; backend/query/API/helpers, Python, transport, migrations, schema and controls are unchanged.

## Finding dispositions

### R9-1 — Paginated history contamination: ADDRESSED

`dashboard/components/rolefit/RolefitBoard.tsx:591` now derives `historyJobs` only from the selected `initialHistory` page, with corrections overlaid on those same rows. It no longer appends approved, corrected or packaged discovery rows. History and Applied render through that bounded pool at line 601; the N-of-M denominator at line 676 uses the same view partition. The Applied badge at line 1446 counts applied jobs within the selected history page. The global applied-ID set still excludes applied discovery jobs without inserting them into another history page.

Selected detail lookup remains a separate discovery/rejected/history lookup at line 692. Successful instruction saves, corrections, settled generation packages, application marks and unmarks explicitly refresh the server props/counts (`:408`, `:425`, `:927`, `:965`, `:1200`, `:1314`, `:1353`). New callbacks include `router` in their dependency arrays. Existing failure feedback and relevant rollback paths remain; the fix does not restore the original optimistic whole-page union.

`dashboard/components/rolefit/RolefitBoard.test.tsx:255` exercises the actual component with 500 discovery jobs and 500 disjoint selected history jobs, all with applied packages. Both History and Applied assert exactly the selected 500 unique titles, 500-of-500 counts, Applied 500, and the separate server 1,000-saved-jobs/Page-2 label. The focused case at line 275 confirms a successful mark triggers one refresh, does not insert discovery into local history, and admits the row when refreshed selected-page props arrive. Its original RED evidence shows 1,000 displayed rows and absent refresh; the final selected evidence is green.

The browser separately checks disjoint two-row history, a one-row Applied subset, page-local counts and the server pagination label. It is not a 500-row browser performance test. Applied remains an explicitly documented subset of the selected saved-history page, not an independent full-corpus Applied query/count. A newly saved item may sort onto another server history page; this is an honest limitation of the bounded page contract.

### R9-2 — Unscored saved application visibility: ADDRESSED

`dashboard/components/rolefit/JobDetail.tsx:162` distinguishes application availability from scored-review availability. The retained ApplicationPanel is outside the reviewed-content branch at line 643, while `allowGeneration={hasReview}` at line 645 preserves the generation prerequisite. The applied badge/Undo path at line 396 no longer requires a score. `ApplicationPanel.tsx:268` displays persisted prepared status, and its existing applied date/status remains readable.

The new optional generation flag defaults to true for existing ApplicationPanel/ResumePanel callers. The unscored retained branch passes false through to ResumePanel (`ApplicationPanel.tsx:348`). Generation, regeneration, prefilling, instruction, retry and score controls are gated; stored résumé/cover content, copy/download and existing human cover edits remain available. Review analysis remains in its scored branch. This displays retained content and persisted status; it does not claim new generation or recapture readiness.

The saved application JD disclosure at `JobDetail.tsx:693` is now independent of the current full-JD branch, without duplicate rendering. Current questions remain separate, and null historical question schemas retain the existing orphan-answer behavior and honest unavailable-schema copy. The Apply fallback checks `hasApplication` at lines 710/761 so the retained panel does not gain a second Apply link. No storage parser, private snapshot, saved version, demand or actual-receipt code was changed.

`dashboard/components/rolefit/JobDetail.test.tsx:156` covers both unscored prepared and applied packages with retained résumé, cover letter, orphan question/answer, saved JD, status, exactly one Apply link, and absent generation/instruction controls. The browser uses actual Board → JobDetail → ApplicationPanel/ResumePanel rendering with fake authenticated server boundaries and verifies the saved content/status on desktop and mobile. These tests close the missing combinations identified in the original review.

## Related minor dispositions

- **Funnel denominator copy: ADDRESSED.** `dashboard/components/analytics/FunnelSection.tsx:116` and `:177` now say "of discovery". The actual caption test at `SecondarySurfaceFixes.test.tsx:120` checks both suffixes and absence of "of open". The formatter remains unchanged.
- **Actual Task9 React checklist: ADDRESSED.** The Fix1 report records application of `c12/react-best-practices` to this phase, with concrete component-structure, hooks/state, client/server-boundary, rendering, interaction and TypeScript/provenance observations. These observations are consistent with the inspected source and actual affected-component/browser evidence; this is not borrowed Task8 checklist evidence. It is not a comprehensive accessibility or performance audit.
- **Inherited default/owned DB lane selection and three fixture failures: CARRIED TO TASK13, unchanged.** Preserve strict owned target guards and explicitly separate ordinary default and owned DB lanes. Plain default CI is not established green. The two older lifecycle DB suites already shared the selection issue at original BASE; it remains an inherited integration problem, not a newly asserted Task9 functional blocker. The two tombstone-action mock failures, workflow DSN-count fixture drift, and two genuine historical missing-PDF skips remain documented.

## Actual evidence and chronology

Evidence paths below are under `task-9-evidence/fix1/`. No author test, browser run or original reviewer diagnostic was rerun by this reviewer.

| Artifact | What it establishes |
| --- | --- |
| `task9-fix1-selected-source.txt` | Final affected selection: 60 tests passed in 8 files, no skipped tests, 12.14 seconds. Command and exit 0 are recorded in the author report/chronology; actual output confirms the totals. The existing jsdom `scrollTo` notice remains. |
| `task9-fix1-typecheck-source.txt` | Standalone `tsc --noEmit` has no diagnostics; standalone exit 0 recorded. |
| `task9-fix1-lint-source.txt` | 0 errors, 9 inherited warnings, standalone exit 0 recorded; no new hook warning in changed components. |
| `task9-fix1-diff-source.txt` | Empty clean diff-check output, with successful check recorded in the report. |
| `task9-fix1-browser-source.txt`, `browser/result.json` | 17 assertions using installed Chromium 151.0.7922.173; five local GET requests, `errors: []`, `blocked: []`. Actual components, fake authenticated props/actions/navigation/API, owned random loopback target. |
| `browser/history.png`, `prepared-status.png`, `prepared.png`, `applied-mobile.png` | Inspected desktop 1280×800 and mobile 390×844 views: bounded history/subset counts, prepared/applied status, saved content and saved-description disclosure. |

The failed/intermediate results remain part of the evidence. Focused RED was five failures with 24 name-filtered cases printed as skipped. The first three-file run was 27 passed/two failed (duplicate saved JD and an incorrect `100.0%` fixture expectation); both were corrected. Initial typecheck emitted TS2353 for the test-only unsupported `jobVersionId`; the combined typecheck→lint shell's exit 0 was not a successful typecheck. Later standalone typechecks passed. The earlier caption RED file remains recorded without inventing its unavailable invocation/source pin.

An initial eight-file selection passed 60. The later concurrent run was 59 passed/one timeout in the existing quota-message case. Load attribution remains an inference, not a proven root cause. The final identical affected selection with two workers and no concurrent checks passed all 60 without changing that test's timeout/assertions. Counts from overlapping selections and repeated browser screenshots are not summed into a larger matrix.

## Limits and handoff

No new Important/Critical issue was found within this scoped fix. The component and browser evidence does not prove Next SSR, actual `router.refresh` server integration under live auth, providers, production, end-to-end generation, load, comprehensive accessibility or costs. The successful-mutation refresh regression mocks navigation and supplies refreshed props; the browser clicks no write action. Unchanged prior PostgreSQL 17.11/16.15 consumer/reviewer evidence remains historical Task9 evidence, not a fresh Fix1 run. No broad/default suite or full matrix is claimed green.

Original Task9 public derived projection, mapping/readiness, per-row query cost and per-request public-board traffic limitations remain. Extra mutation refreshes reuse existing queries but their traffic cost is unmeasured. Public 120-second ISR removal is not claimed cost-neutral.

Task8 immutable private JD/Q/version and exact actual consumption receipts remain authoritative. Genuine old generated artifacts whose actual original inputs are unknown still terminal-defer; full recapture remains UNIMPLEMENTED and universal preparation availability is not claimed. R6-4 durable above-guard closure/health progress remains mandatory for Tasks10/13, unwaived. R6-5 shared transport was not duplicated or retested.

No omitted/refused Task3 expiry-enforcement, capacity-accounting, cross-user or related adversarial security review/probe was retried, reproduced, split, substituted or disguised. This scoped PASS supplies no missing independent mechanism-security assurance. Existing review/release amendments apply unchanged; all-task completion and final permitted release verification remain controller work.

Reviewer actions were read-only source/evidence inspection and package-integrity comparison, plus writing only this report. No product edits, Git mutation, subagents, covered reruns, new executable behavior diagnostics, database use, shared 55432/reserved fixtures, network/provider/model/paid calls, production, migration, infrastructure, release or activation action occurred.
