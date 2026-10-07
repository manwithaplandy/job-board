# Task9 Fix1 — saved history pagination and unscored retained content

ONE complete correction pass by the same original Task9 author. Implementation
complete pending the SAME original reviewer's scoped follow-up; no independent
PASS or release/activation claim. Full reviewed FixBASE:
`7d9216d6c3a2a0ad8f28350e0f7992afbb725410`. Final product source pin:
`6bd1099b4338cd154e8f1360db1e87fbe6fc2dae`. Report-only follow-up leaves source
unchanged. Intervening controller-only commits14c07a5/25e4a2e/08922f4 preserved;
actual source-commit parent `08922f4775dd5be62bd770383b21c96c3abd0a0f`.
Read the FULL `task-9-requirements-review.md`, both Important findings and narrow
fixes, review-scope amendment/release authorization and dashboard instructions.
Preserved the three already-dirty component test edits on resume. No helper,
subagent, duplicate author or reviewer was started.

## R9-1 correction

`RolefitBoard.historyJobs` displays only the selected server `initialHistory`
page, with corrections overlaid on those rows. It never appends approved,
corrected or package-bearing rows from the independently selected discovery page.
Selected-detail lookup separately retains its discovery/rejected/history union.
The Applied view filters that history page; its label and page-local N-of-M count
refer to that page. Global persisted/optimistic applied IDs still hide applied
jobs from the discovery list, without injecting them into another history page.
Server history total/pagination remain explicitly labelled saved jobs; Applied
is a page-local subset, not a new full-corpus Applied query/count claim.

Successful new application marks/unmarks, saved instruction drafts, saved
corrections and settled generated package updates explicitly call router.refresh.
That re-fetches the existing bounded selected history query/count. Review
settlement already refreshes. New saved work is admitted only when delivered by
that server page; no optimistic whole-discovery-pool history merge. Failure
rollbacks/error feedback remain. Refresh may place the newly saved row on a
different history page according to the existing stable sort; it does not promise
that every newly saved row appears on the currently selected page.

Actual component regression uses500 approved discovery-page-1 rows plus500
DISJOINT selected history-page-2 rows, with applied packages on all1000. History
and Applied each render exactly the selected500 unique IDs,500-of-500 counts,
Applied label500 and server1000 saved jobs/Page2, with no discovery repeats.
A separate successful mark test proves one refresh, no local history insertion,
and admission when refreshed selected history props arrive.

## R9-2 correction and related minor copy

`JobDetail` renders retained ApplicationPanel content and persisted preparation/
applied status independently of `fit_score`. Review analysis/requirements and
review controls retain the scored-review branch. `allowGeneration` flows to
ApplicationPanel/ResumePanel, defaulting true for their existing callers; unscored
retained detail passes false. Stored résumé/letter/answers and copy/download
remain readable; generation/regeneration/re-prefill/instructions/retry/score
controls remain behind the existing review prerequisite. Existing human cover
letter edits remain available. Persisted prepared status is labelled Prepared
application; applied status/date and existing Undo are readable without a score.
This displays persisted status, not universal generation or recapture readiness.

Moved the existing saved-application JD disclosure outside the full-current-JD
branch once, so saved JD is readable even when current JD is missing. Saved/current
contexts stay distinct; NULL historical questions retain orphan answers and
honest unavailable-schema copy without borrowing current questions. Removed the
duplicate legacy Apply fallback when a retained unscored panel already has its
Apply link; both unscored cases assert exactly one link.

Prepared/applied unscored actual JobDetail cases exercise saved résumé summary,
cover letter, orphan question/answer, saved JD, persisted status, one Apply link,
and absence of generation/instruction controls. The fake browser also opens the
actual Board→JobDetail path for both states. No private JD/Q/version/receipt
storage, parsing or demand contract was changed. The unsupported jobVersionId
property in the resumed UI test fixture was removed to match the existing UI DTO;
backend saved versions were untouched. Genuine historical generated artifacts
with unknown actual inputs still terminal-defer; full recapture remains
UNIMPLEMENTED. No current-schema substitution or readiness expansion.

Minor FunnelSection's two denominator captions now say "of discovery", covered
by the actual caption test. Existing percentage formatter remains unchanged.

## Exact verification and failures

Evidence: [fix1/chronology.md](task-9-evidence/fix1/chronology.md), retained outputs,
browser source/result and four screenshots. All shell commands `/bin/bash`,
login:false. TS commands ran from dashboard, browser/diff from repository root.
Final selected command, no concurrent checks:

```sh
./node_modules/.bin/vitest run --maxWorkers=2 components/rolefit/RolefitBoard.test.tsx components/rolefit/RolefitBoard.liveMatches.test.tsx components/rolefit/RolefitBoard.rejectAffordance.test.tsx components/rolefit/JobDetail.test.tsx components/rolefit/ApplicationPanel.test.tsx components/rolefit/ApplicationPanel.edited.test.tsx components/analytics/SecondarySurfaceFixes.test.tsx app/ui-contract.test.ts
npm run typecheck
npm run lint
```

- `task9-fix1-selected-source.txt`: **60 passed/8 files**, no skips, exit0.
- `task9-fix1-typecheck-source.txt`: standalone exit0.
- `task9-fix1-lint-source.txt`: standalone exit0, **0errors/9 inherited warnings**;
  unchanged TrendCharts/TanStack Virtual/config/parseProfile/theme warnings.
- `git diff --check` (`task9-fix1-diff-source.txt`) and staged check: clean.

Initial focused RED command:

```sh
./node_modules/.bin/vitest run components/rolefit/RolefitBoard.test.tsx components/rolefit/JobDetail.test.tsx components/analytics/SecondarySurfaceFixes.test.tsx -t 'selected history page|newly saved application|unscored retained|discovery totals'
```

`task9-fix1-red.txt`:5failed/24 name-filtered (Vitest prints skipped), exit1.
First full three-file attempt `task9-fix1-green.txt`:27passed/2failed, duplicate
saved-description display plus caption fixture100.0% expectation versus existing
100% formatter; both corrected. First tsc emitted TS2353 for the fixture-only
unsupported DTO property; combined tsc→lint shell exited0 due the later lint,
**not a green typecheck**. Later standalone typechecks passed.
A pre-resume retained caption RED file (`task9-fix1-caption-red.txt`) records
1failed/9 name-filtered; exact earlier shell invocation is unavailable in this
resumed context, so it is retained without inventing its command/source pin.

First affected eight-file selection passed60; a subsequent final-source selection
run concurrently with lint/tsc/browser was59passed/1failed: existing quota-message
case timed out5000ms. Load attribution is an inference from concurrent checks and
39.45s overall versus12.14s final uncrowded run. No timeout/test/source relaxation;
identical affected selection with two workers passed60. No overlapping result
counts summed. Existing jsdom scrollTo notice retained. No broad dashboard/old
pytest/DB/transport suite rerun to manufacture a matrix.

```sh
node .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-9-evidence/fix1/browser/run.cjs
```

Final `task9-fix1-browser-source.txt` and `browser/result.json`: **17 assertions**,
exit0, installed Chromium**151.0.7922.173**, desktop1280x800/mobile390x844;
errors[]/blocked[]. Only five local GETs (page, bundle assets, two fake details).
Owned random loopback; fake authenticated props/actions/navigation/API, actual
RolefitBoard/JobDetail/ApplicationPanel/ResumePanel. No write action clicked.
Disjoint two-row browser history page, page-local History/Applied totals, prepared
and applied unscored status, saved artifacts/answers/JD and absent generation
controls checked. The500-row bounds/no-repeat proof is the component test above,
not a500-row browser benchmark. Screenshots: `history.png`,
`prepared-status.png`, `prepared.png`, `applied-mobile.png`. Repeated screenshot
capture runs retain the same17 assertions, not cumulative new cases.
This is local actual-component coverage, not Next SSR/real auth/provider/pipeline/
production/load verification. No browser download/network call in this fix phase.

## Actual Task9 Fix1 React checklist

Applied `c12/react-best-practices` (read this phase) and code-review reception
workflow to these actual changes; this is not Task8's checklist.

| Check | Actual assessment/evidence |
| --- | --- |
| Component structure/conditional rendering | Separate scored analysis from retained application; boolean hasApplication avoids duplicate fallback. Generation gate defaults preserve existing callers. Actual prepared/applied tests and browser check the new branch. |
| Hooks/dependencies/state | History derives from selected props+corrections; applied ID set derives from packages. New refresh callbacks include router in dependencies. Successful event/settlement writes trigger refresh, no history-merging effect or render-time request. Existing optimistic rollback retained. Lint reports no new hook warnings. |
| Client/server boundaries/bundle | Changed components import no DB/service helper. Same client-safe lifecycle parsing and typed prop boundary retained. Actual offline browser bundle succeeds; backend/query/API/transport diff from FixBASE is empty. |
| Performance/rendering | Selected history overlay stays bounded to server500 rows; page-local counts share that pool. No new per-row network requests or eager fetching. Explicit mutation refresh reuses existing bounded queries; load cost is unmeasured. Existing virtualization unchanged. |
| Accessibility/interactions | Shared Buttons/Chip and native saved-description disclosure retained; unavailable generation controls absent. Applied radio names/counts and actual card→detail/status/disclosure interactions tested. UI source-contract test passes; no separate comprehensive accessibility audit claimed. |
| TypeScript/data/provenance | Optional boolean props default true; no boundary cast/parser/schema change. Existing owner packages/snapshots and total parsers retained. tsc passes; saved/current/orphan-answer tests and browser cover actual rendering. |

## Preserved limits and handoff

Only eight product/test files changed, all components; DB/Python/API/helpers,
source transport, schema/grants/flags/guard/enforcement are unchanged. No DB/Python
rerun was justified; prior Task9 ordinary17/16 evidence remains historical source
contract evidence, not newly executed Fix1 results.

Inherited default Vitest owned-DB lane-selection defect and three legacy dashboard
fixtures remain explicit Task13 carry, along with earlier genuine missing-PDF
fixture skips. Plain default CI is not claimed green; strict owned-env/target
guards are untouched. Original Task9 feed/public projection/per-row cost,
mapping/readiness and dynamic-board traffic limits remain. R6-4 durable above-
guard closure/health progress mandatory Task10/13, unwaived; R6-5 resolved shared
transport reused without duplicate probes. Omitted Task3 independent expiry-
enforcement/capacity/cross-user/adversarial security review/probes remain absent.
No claimed independent mechanism assurance, security acceptance or all13 release.

Flags remain off, retirement dry-run, archive inactive. No production/auth/
provider/model/paid calls, migrations/grant activation, shared55432/reserved
fixtures, infrastructure/provisioning, push/PR/merge/deployment, safeguard bypass
or history rewrite. No current concrete blocker. Only own source/tests/report/
evidence staged; controller files left untouched/uncommitted by the author.
