# Task8 local verification chronology

These are exact recorded outcome summaries from tool output, not reconstructed full logs.
Some initial dashboard output files were overwritten while iterating; their outcomes
are retained here explicitly. Only final complete passing outputs support GREEN.

1. `python -m pytest tests/test_lifecycle_demand.py -q`: collection failed with
   `ModuleNotFoundError: No module named 'job_discovery.lifecycle.demand'`.
   Original full output retained as red.txt.
2. First isolated PG17 demand run: server 17.11, 1 failed / 4 passed. Deferred
   demand bound Jsonb(None), rejected by `job_payload_demands_questions_shape`.
   Fixed by binding SQL NULL for absent public schema.
3. First selected PG17 Python lane: 2 failed / 132 passed, 29.16s. Original output
   retained as python17.txt. Missing JD test still expected stage1='pass'; an overly
   broad expectation edit had also changed the valid-JD stage2 error test to expect
   no stage1 result. Corrected only those expectations: no-JD => no stage1; valid-JD
   stage2 error => preserve stage1='pass'.
4. First dashboard owned PG17 flow lane: setup failed with
   `UNSAFE_TRANSACTION: Only use sql.begin, sql.reserved or max: 1`; 2 tests skipped,
   742ms. Cause: migration BEGIN/COMMIT copied into fresh schema.sql. Removed only
   fresh-schema wrappers; migration retains its transaction. No guard changes.
5. Next dashboard PG17 lane: 1 passed / 1 failed, 816ms. Enforced owner reservation
   flow passed. Generation snapshot insert failed `generation_jobs_questions_shape`.
   Fixed JSON text binding (`::text::jsonb`) and SQL NULL for absent schema.
6. Dashboard PG17 flow then passed 2/2, 1.29s. Server 17.11. No skipped tests.
7. First targeted routes/parser lane: 4 failed / 80 passed, 2.06s. Three detail
   responses gained unwanted legacy/null metadata; kept legacy response shape.
   Prepare fallback test expected browser-side question fetch; changed expectation
   to protective pending with zero fetch/charge/provider calls.
8. Targeted routes/parser lane then passed 84/84, 1.35s.
9. Additional older-live fixture initially tried editing an immutable frozen
   listing expiry; replaced with a job originally discovered 31 days earlier,
   mapped through the normal identity mapper. This is fixture construction, not
   a change to enforcement.
10. Broader selected Python runs passed 214 on PostgreSQL 17.11 (40.39s), then
    215 on PostgreSQL 16.15 (66.51s), with the newly added legacy worker case.
    Full outputs remain python17-green.txt and python16-green.txt. These precede
    the final legacy missing-listing mapping correction and are not a final-source
    broad matrix claim.
11. The controller identified an ordinary default-off legacy prepare sequencing
    gap. Service processing now accepts explicit pre-cutover owner demands. The
    final fixture starts with actual db.upsert_jobs and no source listing; the
    targeted existing mapper supplies identity without moving global cursors.
    Final affected demand+identity runs passed 30 each on PostgreSQL 17.11
    (12.84s) and 16.15 (20.35s); full outputs retained.
12. Dashboard selected actions/routes/parsers/UI lane passed 135 in 13 files
    (6.56s). This preceded the final package JSON binding correction. The final
    affected package/instruction/parser lane passed 13 in 3 files (1.02s), and
    TypeScript noEmit exited 0 (empty success output retained).
13. Offline transport initially passed 17 tests, then 18 (0.33s) after adding
    non-JSON HTTP error-status handling. Final 18-test output retained. Earlier
    passing final-named output was overwritten; this is the final test count.
14. Dashboard DB lane passed 3 tests per major after legacy readiness work.
    After adding actual package persistence/JSON/consumption coverage, final
    outputs passed 4 each on PostgreSQL 17.11 (1.66s) and 16.15 (1.43s).
    The final-named three-test outputs were overwritten by these four-test runs.
    Original historical two-test PG17 success remains dashboard-db17.txt.

No production/provider/network calls were used. Missing independent Task3 reviews
remain deliberately unperformed. These tests are ordinary new feature contracts.
