# R11-1 Fix1 exact commands and phases

Worktree: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`; `/bin/bash`, login:false. Reviewed FixBASE `a4c4693bcfb614e3d9e0699096b7c0b0ffb18dd9`; actual start HEAD `8b6638c` includes controller documentation only. Source correction `4ff6d7061ed2414ede66f9e6c878cfd717cd1ff4`.

Read full task-11-fix1-dispatch.md and task-11-requirements-review.md before changes. Read receiving-code-review skill and checked the finding against migration07/recovery.py. inventory.md predates executions. No helper agents or additional review were requested.

## RED before migration08

```
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_archive_recovery_authorization.py::test_fresh_explicit_approval_after_unused_approval_expires -q
```

Result: PostgreSQL17.11,1 failed in0.83s,exit1. Failure is the second explicit grant's `UniqueViolation` on `public_archive_recovery_authorizations_batch_id_key`, after expired-grant rejection/no-mutation assertions passed. red-source-hashes.json captures the exact pre-fix schema, historical migration07, unchanged recovery API and new regression test. red-pg17.raw.txt.gz retains exact stdout/stderr bytes (deterministic gzip); raw-red-sha256.txt hashes the uncompressed original. red-pg17.txt differs only by removed trailing line whitespace for readable repository evidence.

## GREEN after migration08, unchanged final sources

```
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_archive_recovery_authorization.py::test_fresh_explicit_approval_after_unused_approval_expires tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations -q
.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_archive_recovery_authorization.py::test_fresh_explicit_approval_after_unused_approval_expires tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations -q
```

Results: PostgreSQL17.11,2 passed in1.94s,exit0; PostgreSQL16.15,2 passed in2.46s,exit0. No skips/deselections. Each command selects exactly the new ordinary approval-lifecycle regression plus the controller-approved existing catalog-parity node. No other historical migration node, transport/supervisor/deferred suite or security probe ran. Each harness owns its separately generated random-loopback database/container, using cached images.

```
.venv/bin/python -m ruff format tests/test_archive_recovery_authorization.py
.venv/bin/python -m ruff check tests/test_archive_recovery_authorization.py
.venv/bin/python -m pytest tests/test_archive_recovery_authorization.py::test_fresh_explicit_approval_after_unused_approval_expires tests/test_lifecycle_migrations.py::test_clean_schema_matches_frozen_baseline_plus_all_new_migrations --collect-only -q
git diff --cached --check
```

Ruff passes (ruff.txt), collected.txt lists the2 nodes, source staged whitespace check passes. Candidate and final source hash maps are identical. Migration08 occurs verbatim in schema.sql. Byte comparisons against FixBASE confirm historical migration07 and runtime recovery.py are unchanged. Final test content is identical to RED test content; only migration08/schema changed between RED and GREEN. versions.json records Python3.12.14, psycopg3.3.6, pytest9.1.1, Ruff0.15.20 and cached image IDs.

No source changed after the GREEN runs. Reporting did not rerun completed tests. No safeguard or execution failure occurred beyond the intended RED unique-constraint failure.
