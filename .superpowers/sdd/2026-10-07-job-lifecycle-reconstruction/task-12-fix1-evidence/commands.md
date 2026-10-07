# Fix1 commands and evidence

Working directory /workspace/job-board/.claude/worktrees/lifecycle-recovery; bash login:false. Every pytest output was redirected with `> <evidence>/<name>.txt 2>&1`, then its exit status was saved to the corresponding .exit. Exact raw bytes are preserved in .raw.txt.gz; readable .txt strips trailing whitespace only.

Initial fixture-import failure (red.txt) and intended RED after correcting the import (red2.txt):

```text
.venv/bin/python -m pytest tests/test_archive_replay_fix1.py -q
```

Final GREEN (green.txt):

```text
.venv/bin/python -m pytest tests/test_archive_replay_fix1.py tests/test_archive_replay.py::test_outside_declared_coverage_is_terminal tests/test_archive_replay.py::test_missing_predecessor_unknown_cause_is_terminal_without_retries tests/test_archive_replay.py::test_expired_baseline_terminal_gap_independent_facts_only tests/test_archive_replay.py::test_projection_expiry_recomputes_no_retained_facts_after_horizon tests/test_archive_replay.py::test_exact_id_hash_dedup_and_stale_order_preserve_latest_and_times tests/test_archive_replay.py::test_finite_input_budgets_fail_closed tests/test_archive_replay.py::test_total_manifest_rejects_unknown_or_boolean_serializer -q
```

collection.txt uses exactly that selection with `--collect-only -q` replacing `-q`;20 cases. No other test selection executed.

```text
.venv/bin/python -m ruff format job_discovery/archive/replay.py tests/test_archive_replay_fix1.py
.venv/bin/python -m ruff check job_discovery/archive/replay.py tests/test_archive_replay_fix1.py
sha256sum job_discovery/archive/replay.py tests/test_archive_replay_fix1.py tests/test_archive_replay.py job_discovery/archive/schema.py job_discovery/archive/types.py job_discovery/archive/batches.py job_discovery/archive/codec.py pyproject.toml
sha256sum -c .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-fix1-evidence/final-before.sha256
```

Hashes captured before GREEN and checked afterward. versions.txt comes from .venv/bin/python printing sys.version and importlib.metadata.version('pytest'/'ruff'/'psycopg'); no PostgreSQL server used.

Source: `git add job_discovery/archive/replay.py tests/test_archive_replay_fix1.py`; `git diff --cached --check` exit0; `git commit -m "fix: enforce replay coverage and bound membership before traversal"` -> ecba747343369c26041ef5655ed56b044d7098a0. Report/evidence are committed separately. No source changes after final GREEN.
