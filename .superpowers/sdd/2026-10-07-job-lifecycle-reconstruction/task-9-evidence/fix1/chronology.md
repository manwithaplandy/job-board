# Task9 Fix1 evidence chronology

Same original author, ONE correction pass for the complete two Important findings
R9-1/R9-2 and related minor Funnel denominator copy. Original three dirty component
test changes were preserved and used; no duplicate task/author/helper was started.
Full review read before changes. All exec calls used /bin/bash, login:false.
Only loopback browser fake props/actions/navigation/API; no real auth/provider/model.
No database/Python/API/helper/schema/transport source change or DB/Python rerun.

1. `task9-fix1-red.txt`: five focused new cases fail,24 name-filtered tests printed
   skipped by Vitest; exit1. History server500 renders1000; no refresh on save;
   unscored prepared/applied artifacts hidden; caption still "of open".
2. Initial implementation: selected server history rows only (correction overlay
   for those rows), global applied IDs for discovery hiding but page-local Applied
   label/list count. Successful saved mutations trigger explicit server refresh,
   never discovery-pool insertion into a history page. Application contents/status
   move outside scored-review gate, generation/readiness controls stay gated.
3. `task9-fix1-green.txt`:27passed/2failed in3files. Duplicate saved application JD
   introduced by moving its disclosure was corrected by moving the original block
   outside the full-JD branch once; caption fixture expected100.0%, while existing
   formatter produces100%, corrected only fixture expectation. All result text kept.
4. `task9-fix1-typecheck.txt`:TS2353 for preexisting dirty test fixture's unsupported
   UI DTO `jobVersionId`; removed that fixture field, no DTO/provenance changes.
   The first typecheck/lint commands were in one shell sequence: typecheck emitted
   the error; last lint exit made combined shell0. Do not call that typecheck green.
   `task9-fix1-lint.txt` passed with9 retained warnings/0errors.
5. `task9-fix1-selected.txt`:60passed/8files, no skips. `typecheck-final.txt` and
   `lint-final.txt` show no TS diagnostics /0lint errors and9 inherited warnings;
   standalone `typecheck-checked.txt` exit0. jsdom prints its existing scrollTo
   unimplemented notice for the narrow detail-open case.
6. Narrow browser passes17 assertions using installed Chromium151.0.7922.173,
   disjoint fake discovery/history pages, prepared/applied unscored saved artifacts,
   orphan answers, separate current questions, immutable saved JD and absent
   generation controls. Initial and screenshot-enhanced repetitions retain same
   scope, not34/51 unique assertions. Final log `task9-fix1-browser-source.txt`.
   Added prepared-status screenshot before scrolling; saved-input screenshot after
   scrolling to disclosure. No browser errors/blocked/external requests.
7. Final small composition check: unscored retained panel already has Apply link;
   excluded duplicate legacy fallback via hasApplication, added one-link assertion
   in both unscored detail cases. Scored/unscored generation behavior unchanged.
8. `task9-fix1-selected-final.txt`:59passed/1failed,8files; existing quota-message
   test timed out5000ms, during concurrent lint/tsc/browser+Vitest. Total39.45s
   versus earlier13.20s. Treat load attribution as inference, retain actual timeout.
   No timeout/test/source relaxation. Final identical affected selection uses two
   workers without concurrent checks (`task9-fix1-selected-source.txt`).
9. Final standalone `task9-fix1-typecheck-source.txt` exit0; standalone lint-source
   exit0/0errors/9inherited warnings; final browser-source exit0/17assertions.
   Final `task9-fix1-selected-source.txt`:60passed/8files, no skips, exit0.
   Final source pin in the fix report.

Evidence copies remove ANSI color/trailing terminal whitespace only; original
/tmp logs retained unchanged. No failed attempts deleted or overwritten.
No broad/default dashboard, DB, Python, transport, old safety/reserved fixtures or
Task3 deliberately omitted mechanism/security probes ran in this phase.
Inherited CI/default owned-lane collection defect and three broader old fixtures
remain Task13 handoff, without weakening owned target guards.
