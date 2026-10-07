# Actual Fix1 command chronology

All shell execution used `/bin/bash`, `login:false`, worktree `/workspace/job-board/.claude/worktrees/lifecycle-recovery`. The owned harness created random loopback PG containers from existing local images and cleaned up only its own containers. No shared 55432, provider/production connection, credentials, activation, external object write, or excluded Task3 probe.

The seven initial regression tests were written and inventoried before running them against the reviewed Task10 behavior. Command: `.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_archive_fix1.py -q`, redirected to `red17.txt`: **7 failed**, each matching its corresponding Important finding. This was the pre-fix RED evidence, not a passing phase.

The same scoped file command produced these development logs as source/tests evolved:

- `development17.txt`: collection error, missing pytest import after initial lint removed the then-unused import; restored before running expanded cases.
- `development17b.txt`: 15 passed, 1 failed; fixture classification_source='fixture' violated existing allowed values; corrected to 'job'.
- `selection17.txt`: the 56-case then-current affected selection (exact original node list in `selection.txt`) gave 55 passed, 1 failed; fixture size='small' violated existing size values; corrected to '11-50'.
- `development17c.txt`: 1 passed, 19 setup errors. New PL/pgSQL comparison with unparenthesized CASE was invalid; replaced with an explicit oldraw JSON value. Complete failure output retained.
- `development17d.txt`: 21 passed on PG17.11. Subsequent ordinary pair-failure and UTC-day tests and persisted schema/date validation are covered by the final runs, not retroactively credited to this phase.

Development source snapshots were evolving and are not final source pins. The final source SHA256 inventory is `source-files.sha256`, captured after final formatting and before either final run, and checked again before the source commit. No source edits occurred during final verification. Final exact test argv are `final17.command.txt` and `final16.command.txt`; `final-selection.json` and `selection-final.txt` contain the complete enumerated selection. Harness/server versions and actual results are in `final17.txt`/`final16.txt`; exit codes in the adjacent `.exit.txt` files.

Final lint command:
```
.venv/bin/ruff check job_discovery/archive job_discovery/lifecycle/errors.py job_discovery/lifecycle/operational.py job_discovery/lifecycle/reconcile.py job_discovery/lifecycle/identity.py company_discovery/db.py company_discovery/enrich_apply.py company_discovery/jobs_db.py company_discovery/name_backfill.py company_discovery/run.py company_discovery/worker.py job_discovery/db.py job_discovery/locations.py job_discovery/run.py tests/test_archive_fix1.py tests/test_archive_batches.py tests/test_archive_outbox.py tests/test_lifecycle_operational.py tests/archive_helpers.py
```
`lint-final.txt` records all checks passed. Initial lint output (one import-placement error, three unused imports fixed) and formatting outputs are retained. Migration parity checked that each complete Task10 migration appears verbatim in schema.sql. `git diff --check` completed with no output. `versions.json` records the local runtime versions; image pins below are harmless local Docker inspect output.
