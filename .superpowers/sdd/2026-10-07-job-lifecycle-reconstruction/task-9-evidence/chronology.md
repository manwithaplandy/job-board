# Task9 verification chronology and selection

All shell commands used `/bin/bash` with login startup disabled. All DB commands
used owned random loopback targets via `tools/lifecycle_test_db.py`, never55432.
Ordinary feature tests only. No Task3 omitted mechanism probes, transport suite,
reserved feedback/destructive fixtures, real ATS/provider/model/auth or production
write/activation was invoked. Fixture DDL resets only its harness-owned database.

- Unit RED (`task9-red.txt`): 5 new cases failed for missing lifecycle parser,
  predicate/count builder and history owner guard. Unit GREEN followed.
- Reviewer RED on owned17.11 (`task9-reviewer-red.txt`): flag-off candidate
  incorrectly absent due to the old unconditional expiry check. Shared SQL
  predicate fixed this ordinary candidate feature regression.
- First DB RED (`task9-db-red.txt`): fixture violated existing applied timestamp
  constraint; fixed only fixture applied_at. Corrected RED (`task9-db-red2.txt`):
  4 cases failed on missing read-only projection. First GREEN `task9-db17.txt`:
  4 passed,17.11.
- UI RED (`task9-ui-red.txt`): absent older/history controls. First GREEN attempt
  (`task9-ui-green.txt`) uncovered deep-link fixture and zero-width jsdom
  virtual-list effects. Corrected test navigation/viewport fixture, preserving
  actual components: `task9-ui-green2.txt` 2 passed /9 tests filtered out by `-t`
  (Vitest prints skipped for these name-filtered tests).
- Actual history open plus total HTTP boundary RED (`task9-detail-red.txt`):
  selected history row was absent from detail lookup and parser missing. GREEN
  (`task9-detail-green.txt`): 2 passed /15 name-filtered tests. The jsdom narrow
  open prints its ordinary unimplemented `window.scrollTo` notice.
- Route RED (`task9-route-red.txt`): closed sources lacked deferred current
  hydration response. Route now retains saved detail and queues no new current
  demand for proven closure; included in subsequent selected GREEN.
- First selected broad feature pass: `task9-selected-green.txt` 165/11files.
  Previous `task9-selected.txt` was 161passed/3failed because new filter defaults
  and new query predicate needed corresponding old expectations updated.
- First broader dashboard non-DB run (`task9-dashboard-full.txt`):
  1706passed/4failed/2skipped,217files. Task9 source UI contract failure had five
  raw-control/geometry/link issues, fixed with shared Buttons/ButtonLinks and
  labelled checkbox/CSS. An 18px explicit input-size contract failure followed
  (`task9-ui-contract-green.txt`); removed explicit input dimensions, leaving
  labelled 44px target. `task9-ui-contract-final.txt`:32passed/3files.
- Three broader dashboard failures predate Task9: two live-action cases in
  `app/actions/tombstoneGuard.test.ts` mock db without Task8 demand/mutation
  exports; workflow contract expects two DATABASE_URL entries while BASE CI has
  three. BASE source inspection confirms those conditions; these files unchanged.
- Browser dependency download failed HTTP403 `Domain forbidden` from the normal
  Playwright CDN (`task9-browser-install.txt`). No alternate host or bypass.
  Readable installed `/usr/bin/chromium`151.0.7922.173 supplied local browser.
- Fake browser initial bundle (`task9-browser.txt`) exposed transitive DB imports
  from new client lifecycle consumers. Fixed by client-safe `jobLifecycleState`
  and server-facing reexports. The next harness needed a normal process.env
  placeholder (`task9-browser2.txt`,`task9-browser3.txt`), then an actual
  disclosure-button locator (`task9-browser4.txt`). Those are harness attempts,
  not product/browser successes. Success logs are `task9-browser-final.txt`,
  `task9-browser-complete.txt` and final `task9-browser-release.txt`; screenshot
  and actual nine-assertion result in `browser/`. Same browser scope, not summed.
- DB actual getJobsPage profile fixture initially lacked required profile_version:
  `task9-db17-final.txt` and `task9-db16-final.txt`:4passed/1failed. Corrected
  fixture and added actual closed-status case; final `task9-db17-complete.txt`
  and `task9-db16-complete.txt`:6passed each,17.11/16.15, no skipped DB tests.
  They install the additive migration twice against pre-Task9 schema and verify
  schema.sql suffix parity. No unrelated DB suites rerun.
- Closed filter RED `task9-closed-red.txt`, timezone-free parser RED
  `task9-utc-red.txt`; fixed respective source-closure predicate and zoned ISO
  validation. Covered in final selected GREEN.
- Some author editing commands failed before editing due to wrong cwd-relative
  paths and one unterminated Python string. No product edits occurred on those
  failed commands. Tests chained afterward did execute; their logs are retained:
  `task9-selected-final.txt` and `task9-selected-complete.txt` were launched at
  repo root and hit UI-contract fixture paths (11 failures), with one additionally
  retaining the timezone RED before its patch. Correct dashboard cwd run
  `task9-selected-cwd-final.txt`:182passed/1UI-audit timeout under concurrent
  broader test load. Subsequent uncrowded `task9-selected-final-pin.txt`:
  183passed/12files. These intermediate filenames are chronology, not source pins.
- Second broader non-DB run `task9-dashboard-final.txt`:
  1708passed/4failed/2skipped,217files. It started before UTC parser correction:
  includes that Task9 RED plus the same three inherited fixture gaps. Do not call
  the broad suite green or sum overlapping runs. All new feature failures are
  covered by the final scoped passing selection; inherited three remain for13.
- Analytics actual caption RED `task9-analytics-red.txt`:1failed/9name-filtered;
  corrected discovery/retained-history scope labels without implying closure.
- FINAL scoped TS selection `task9-selected-release.txt`:193passed/13files,
  no skips. Reviewer selection before final count fix `task9-reviewer17-complete.txt` and
  `task9-reviewer16-complete.txt`:8passed/30deselected each,17.11/16.15. Earlier
  repeated runs are not additional unique cases.
- Final typecheck `task9-typecheck-source.txt` (`npm run typecheck`):exit0; prior empty-output `task9-typecheck-verified.txt`:exit0; final lint
  `task9-lint-release.txt`:exit0,9warnings/0errors, all retained older warnings
  (TanStack compiler warning, existing other modules/config). Earlier lint had
  new missing isAuthed dependency, fixed. Final Ruff `task9-ruff-final.txt`:pass (prior `task9-ruff-release.txt` also passed).
  `task9-diff-final.txt`:exit0. Exact final source pin is in the report.
- One ordinary exec_command failed create-process with
  `exec-server transport disconnected`. Immediate read retry succeeded in the
  same environment. No executor replacement/reinitialization, capacity workaround
  or completed-stage restart. This is distinct from refused Task3 security work.

- Final reviewer count/page ordinary feature regression RED
  `task9-reviewer-count-red.txt`:1failed/1deselected on17.11, recording two actual
  candidate SELECTs. Replaced the two reads with count/page subqueries in ONE
  statement, stable first-seen/job-ID order and unchanged candidate DTO. Final
  `task9-reviewer17-release.txt` and `task9-reviewer16-release.txt`:9passed and
  30deselected each,17.11/16.15. This checks actual query use/results; it is not a
  two-session adversarial/expiry-enforcement mechanism probe.

Final TS command from dashboard:

```
./node_modules/.bin/vitest run lib/jobLifecycleConsumers.test.ts lib/jobsQuery.test.ts lib/filters.test.ts lib/rolefit/boardFilters.test.ts lib/rolefit/filter.test.ts lib/queries.jobDetail.test.ts lib/queries.reviewFeed.test.ts components/rolefit/RolefitBoard.test.tsx components/rolefit/JobDetail.test.tsx components/rolefit/JobCard.test.tsx 'app/api/jobs/[id]/route.test.ts' components/analytics/SecondarySurfaceFixes.test.tsx app/ui-contract.test.ts
```

Final DB command from repo (MAJOR17 then16; each invocation owns its own DB):

```
.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- /bin/bash -c 'cd dashboard && ./node_modules/.bin/vitest run lib/jobLifecycleConsumers.db.test.ts'
.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_reviewer_lifecycle_feed.py tests/test_reviewer_db.py -k 'candidate or stale or feed_flags' -q
```

Broader non-DB selection from dashboard:
`npm test -- --exclude '**/*.db.test.ts'`. Two genuine skipped non-DB cases are
preexisting missing-binary-PDF cases:
`lib/rolefit/fileToResumeMarkdown.test.ts` — "converts the real PDF to parseable markdown";
`lib/rolefit/parseProfile.test.ts` — "parses the binary via the PDF path".
Do not confuse them with the name-filtered `-t` attempts. No broad
old pytest, feedback/safety fixture or reserved shared service was used.
