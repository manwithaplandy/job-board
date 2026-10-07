# Task8 Fix2 selected verification chronology

Exact reviewed baseline: 29d34ec9a3de95c3a1bd86e5ce215e07b5bc7743. Original
Important findings are copied verbatim into task-8-fix2-report.md. No whole-task,
transport or refused independent mechanism review/probes were run. Trailing
whitespace is trimmed from retained logs; result text is unchanged.

1. Actual Board/JobDetail RED: 3 new failures / 6 existing passes
   (ui-red.txt). Stale or missing shared descriptions hid the ready current JD;
   the historical-context case likewise lacked the current description display.
2. Owned PG17 first-output RED: 1 new failure / 6 existing passes
   (first-output-red.txt). Saving instructions produced a contentless marker;
   prepare returned deferred where a genuine first demand should be pending.
3. UI attempt1: 3 failures / 6 passes (ui-attempt1.txt). Current JDs displayed,
   but new question assertions used a schema with no text fields and did not
   open the application's existing collapsed question disclosure. Fixtures now
   have realistic input_text fields and click the actual disclosure. An initial
   TypeScript check also caught repeated indexed-state access not narrowing the
   loading/done union (tsc-attempt1.txt); a single derived selectedDetail fixes it.
4. The first affected TS lane passed 69 in 7 files (ts-attempt1.txt).
   Updated owned PG17 flow passed 7 (flow17-attempt1.txt), including actual
   instruction saving → owner demand → Python process_pending in the same DB
   with an outside-transaction offline fetch assertion → first output persistence.
5. Demand-only regressions passed 14 on PostgreSQL 17.11 in 6.69s and 14 on
   PostgreSQL 16.15 in 9.20s (demand17.txt, demand16.txt). The retained-artifact
   fixture now includes a real persisted résumé payload, consistent with its
   intent; snapshot-only instruction rows are the newly distinguished case.
6. Expanded final selected UI/DTO/route/helper tests passed 80 in 9 files
   (ts-final.txt). This includes an unreviewed missing-cache UI case, saved answer
   schema separation, package DTO parsing and malformed current-field parsing.
   TypeScript passed with empty success output (tsc-final.txt).
7. Final seven dashboard DB flows passed on PostgreSQL 17.11 in 2.95s and
   PostgreSQL 16.15 in 2.29s (flow17-final.txt, flow16-final.txt). The final new
   flow additionally reloads the actual package DTO and checks its saved inputs,
   while retaining applied time/status and the unused cover instruction draft.
8. After the 80-test lane, one detail DTO assertion was added and only that query
   file rerun: 4 passed (detail-query.txt). The contentless prepare route fixture
   was parameterized for both legacy compatibility values; only that affected
   file reran: 32 passed (prepare-final.txt). No product implementation changed
   after the 80-test lane. Final tsc-complete.txt is empty output with exit 0.
9. Changed Python lint and git diff checks passed. React skill checklist applied
   to the two edited components. No live browser/network/provider or calibration
   sync run is implied by these jsdom/SQL/offline-worker results.

The real unknown legacy-artifact terminal/full-recapture limitation remains
explicit in the report and covered by existing route assertions. Passing ordinary
feature tests does not supply missing independent security review or release
approval. All DB targets are disposable owned random-port instances.
