# Exact verification commands and chronology

All shell invocations: `/bin/bash`, `login:false`. Working directory: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`. Every database run used `tools/lifecycle_test_db.py` with its owned, random loopback PostgreSQL container and sanitized child environment; no existing-service/shared 55432 option.

Initial RED:
```
.venv/bin/python -m pytest tests/test_archive_codec.py tests/test_archive_outbox.py tests/test_archive_batches.py -q
```
Actual output: `red.txt`, three collection errors for missing archive modules. No DB tests executed in this RED collection.

Final complete affected selection, run once for each MAJOR=17 and16:
```
.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_archive_codec.py tests/test_archive_outbox.py tests/test_archive_batches.py tests/test_lifecycle_operational.py tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings tests/test_lifecycle_reconcile.py::test_two_distinct_complete_misses_exact_24h_and_replay tests/test_lifecycle_reconcile.py::test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset tests/test_lifecycle_reconcile.py::test_empty_threshold tests/test_lifecycle_relations.py -q -s
```
Actual outputs: `final-pinned17.txt`, `final-pinned16.txt`:36passed each, no skips/deselections. Previous intermediate run outputs are retained under descriptive attempt/final names; latest pinned runs supersede them.

Subsequent UTC-midnight scheduler alignment changed only operational.py and its existing assertion; rerun the affected file only on both majors:
```
.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_lifecycle_operational.py -q -s
```
Actual outputs: `final-operational17.txt`, `final-operational16.txt`:7passed each, no skips/deselections.

Subsequent committed-membership correction excluded the selector's own uncommitted ordinary/critical events; added one batch test and reran the affected file only on both majors:
```
.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_archive_batches.py -q
```
Actual outputs: `final-batches17.txt`, `final-batches16.txt`. Identity.py's last change only updates two stale explanatory comments about the now-implemented outbox and exact version retention.

Lint:
```
.venv/bin/ruff check job_discovery/archive job_discovery/lifecycle/operational.py tests/test_archive_codec.py tests/test_archive_outbox.py tests/test_archive_batches.py tests/test_lifecycle_operational.py tests/archive_helpers.py
```
`lint-final.txt`: All checks passed. `git diff --check` completed with no output.

`versions.txt` records Python, psycopg, pytest, ruff and locally cached Docker image IDs/repository digests. Harness outputs record actual server versions. No network pulls, provider/model calls or production actions were performed.
