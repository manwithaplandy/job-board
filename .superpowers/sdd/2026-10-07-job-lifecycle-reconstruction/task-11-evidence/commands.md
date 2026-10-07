# Task11 commands and phase record

Working directory for every command: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`; shell `/bin/bash`, `login:false`. Only owned random-loopback cached PostgreSQL containers were used. `.venv/bin/python` is Python3.12.14. No broad pytest command occurred.

## Preparation

- Read repository AGENTS, REVIEW-SCOPE-AMENDMENT, RELEASE-AUTHORIZATION, task-11-brief, task-11-author-dispatch, task-10-fix2-report, relevant binding spec archive sections and accepted interfaces.
- Read AWS SDK Python skill, references/s3.md and references/configuration.md. Read verification-before-completion skill for final evidence gate.
- `git ls-remote origin refs/heads/main` -> `a8c4b82d95b35c0259600c19c1506faae807c3fc`.
- `git merge-base --is-ancestor a8c4b82 HEAD` -> exit0. Reviewed that upstream merge's pricing/review-model delta; no affected setting changed.
- `uv pip install --python .venv/bin/python 'boto3==1.42.74'` initially failed because the default `/home/agent/.cache/uv` is read-only. `uv --cache-dir /tmp/lifecycle-task11-uv pip install --python .venv/bin/python 'boto3==1.42.74'` succeeded within allowed paths. Pinned installed compatible botocore1.42.97 too. No credentials read.

## Development phases

`python` in each command below means `.venv/bin/python`, exactly as run. Every database command prefixed `.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 --` and the inner executable was also `.venv/bin/python`.

1. `python -m pytest tests/test_archive_export.py tests/test_archive_privacy.py -q` -> red-offline.txt; exit2; two collection errors: absent job_discovery.archive.s3. These tests were created before transport. No initial source hash snapshot was captured; final source snapshots below are exact and are not attributed to RED.
2. Same command -> green-offline-initial.txt; exit0;13 passed.
3. `python -m pytest tests/test_archive_retention_recovery.py -q` under PG17 -> db17-initial.txt; exit1;10 failures from fixture cancelling a claim in its write transaction. Corrected fixture to commit first; existing guard unchanged.
4. Same DB command -> db17-development.txt; exit1;1 passed/9 failures because the pending view does not expose observed_at. Corrected snapshot assertion to read observed_at from the authoritative immutable canonical envelope.
5. Same DB command -> db17-development2.txt; exit0;10 passed,8.43s.
6. `python -m pytest tests/test_archive_export.py tests/test_archive_privacy.py tests/test_lifecycle_supervisor.py -q -k 'not worker_flag_off and not worker_scheduled and not worker_contended and not worker_failure and not real_maintenance_sigterm'` -> offline-supervisor-development.txt; exit1;40 passed/1 failed/5 deselected. Existing supervisor shutdown assertion still expected two children.
7. `python -m pytest tests/test_archive_retention_recovery.py tests/test_archive_export.py tests/test_archive_privacy.py tests/test_lifecycle_supervisor.py -q` under PG17 -> db17-expanded.txt; exit1;58 passed/1 failed,21.04s. A second existing shutdown timestamp assertion still expected two children; corrected it to three. All archive cases in that phase passed.
8. Initial Ruff output (ruff-initial.txt) reported style violations before Ruff formatting. Formatting completed; final Ruff is clean. No implementation logic depends on lint fixes.

## Final commands, unchanged source hashes

```
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_archive_retention_recovery.py tests/test_archive_export.py tests/test_archive_privacy.py tests/test_lifecycle_supervisor.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_archive_retention_recovery.py tests/test_archive_export.py tests/test_archive_privacy.py tests/test_lifecycle_supervisor.py -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations -q
```

Outputs: pg17-final.txt, pg16-final.txt, pg17-migration-parity.txt, pg16-migration-parity.txt. Their .exit files each contain0. The selected four files collect61 cases (final-collected.txt); the separately authorized migration node adds one per major. No skips/deselections in these final executions. No other migration-file node ran.

```
.venv/bin/python -m pytest tests/test_archive_retention_recovery.py tests/test_archive_export.py tests/test_archive_privacy.py tests/test_lifecycle_supervisor.py --collect-only -q
.venv/bin/python -m ruff check job_discovery/archive/s3.py job_discovery/archive/export.py job_discovery/archive/recovery.py reviewer/archive_worker.py tests/test_archive_export.py tests/test_archive_privacy.py tests/test_archive_retention_recovery.py reviewer/supervisor.py tests/test_lifecycle_supervisor.py job_discovery/archive/batches.py
git diff --check
git diff --cached --check
```

Ruff output is ruff-final.txt. All checks exit0. A Python hashlib comparison checked all14 owned source/test/dependency files against candidate-source-hashes.json after all final runs; final-source-hashes.json is identical. Migration07 text occurs verbatim in schema.sql. No source changed during final verification.

`/usr/bin/time` was unavailable (import-resources-tool-error.txt). A Python process then measured one offline `import reviewer.archive_worker` with time.monotonic/process_time and resource.getrusage(RUSAGE_SELF): import-resources.txt. This is import overhead only, not production total runtime load or cost evidence.
