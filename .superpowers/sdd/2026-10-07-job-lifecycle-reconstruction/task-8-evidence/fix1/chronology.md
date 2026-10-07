# Fix1 exact verification chronology

FixBASE is 4d48602947b84983acc54738bd21e45a52862725. No refused mechanism review
was rerun. All failures below are retained as actual outputs, not reconstructed
logs. Log sanitation trims trailing whitespace only. This is ordinary caller/feature verification only.

1. Read all six reviewer findings and actual-function diagnostic output. Original
   findings are retained verbatim in findings-verbatim.md and the Fix1 report.
2. `vitest run lib/jobLifecycle.fix.test.ts` reproduced 3 failing private helper
   cases (private-red.txt): existing NULL provenance fell through to a later
   demand; an independent legacy snapshot also fell through, reaching an absent
   second mock response. Corrected helper distinguishes existing from absent rows.
3. Owned PG17 `pytest tests/test_lifecycle_demand.py -k 'filtered_candidates or reviewer_disabled' -q`
   reproduced 2 failures, 10 deselected (reviewer-red.txt). The eligible retired
   cache was filtered before hydration, and the post-cutover reviewer still
   returned the cached job. The later corrected helper also exposed that the
   test's initial legacy fixture had source_enabled=true from setup_source;
   final fixture explicitly selects the initial flag-off state before testing
   sticky cutover. No control guard was weakened.
4. Private helper/actions/detail lane: 35 passed / 5 files
   (private-green-attempt1.txt). Its TypeScript follow-up found test-only type
   errors: imported TransactionSql from the wrong module and accessed a zero-arg
   mock tuple. Changed to the postgres type and call matcher assertions. The
   initial temporary tsc output is retained as tsc-attempt1.txt.
5. Focused reviewer correction command had 1 passed / 1 failed / 10 deselected
   (reviewer-green.txt): the misleading provisional filename is not a GREEN claim.
   The remaining failure was the initial fixture source_enabled flag described
   above, before its explicit flag-off setup correction.
6. Owned PG17 `pytest tests/test_lifecycle_demand.py -k resume_first -q` failed
   1 / 12 deselected (package-worker-red.txt): ready preparation used the current
   fetched JD instead of the saved résumé JD. The service now deliberately
   captures first questions while retaining the original package JD/version.
7. Selected Python attempt1: 94 passed / 3 failed on PG17.11
   (python17-attempt1.txt). Exact demand_id was not yet carried through
   ReviewResult.as_row; two fixture paths also assumed setup_source left flags
   off. Fixed transient result metadata and explicit ordinary fixture controls.
8. TS selected attempt1: 114 passed / 10 files (dashboard-attempt1.txt).
   First updated dashboard owned PG17: 6 passed (dashboard-db17-attempt1.txt).
9. Selected Python attempt2: 97 passed / 1 failed on PG17.11
   (python17-attempt2.txt). Retention fixture deleted its completed demand while
   its service claim remained active. Existing guard raised exactly:
   `demand removal requires fenced service claim`.
   Reported to controller. The accepted fixture now calls existing cancel_claim
   for its own completed claim before deleting its own terminal demand. No
   guard/grant/clock bypass or independent claim/expiry probe was added.
10. Selected Python final: 98 passed on PG17.11 in 37.13s and 98 passed on
    PG16.15 in 47.50s (python17-final.txt, python16-final.txt). Ruff formatting
    afterward changed whitespace only.
11. TS attempt2 added real-helper legacy route cases and had 114 passed / 2
    failed (dashboard-attempt2.txt): the route's old Greenhouse module mock did
    not export parseGreenhouseQuestions. Retained the actual parser in a partial
    mock, while provider boundaries remain mocked.
12. Corrected TS lane: 116 passed / 10 files in 2.07s (dashboard-final.txt).
    Dashboard owner/package/readers flows: 6 passed each PG17.11 and PG16.15
    (dashboard-db17-final.txt, dashboard-db16-final.txt). TypeScript passed.
13. Final small correction preserves even an existing NULL package capture time
    and checks parsed question usability before returning prepare-ready. Only
    directly affected package/parser/prepare cases were repeated: 40 passed /
    4 files (dashboard-complete.txt). Final TypeScript exited 0 with empty output
    (tsc-complete.txt). The six ordinary dashboard DB flows were repeated on
    PG17/16 against this final source; complete files hold exact outputs.

No test output was silently overwritten as a success. Earlier `*-final` files
are distinguished from `*-complete` source checks after the final small change.
Lint and diff checks passed. No transport or old 214/215 broad matrix was rerun.
No calibration script, provider, sync, network, production or activation action
was executed. The calibration fixture executes extracted static SELECTs only.
