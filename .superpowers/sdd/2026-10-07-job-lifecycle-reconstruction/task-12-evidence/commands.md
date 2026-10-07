# Exact verification commands and outputs

Working directory: /workspace/job-board/.claude/worktrees/lifecycle-recovery. Shell /bin/bash, login:false. Commands below used .venv/bin/python explicitly. Each pytest stdout/stderr was redirected to its named .txt and `$?` written to its matching .exit. Readable outputs normalize trailing whitespace only; deterministic .raw.txt.gz preserves each exact original output.

- red.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py -q`
- dev1.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py -q`
- dev2.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py -q`
- dev3.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py -q`
- dev4.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py -q`
- utc-red.txt and utc-red2.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py::test_retention_window_requires_730_elapsed_utc_days -q`
- green.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py -q`
- collection.txt: `.venv/bin/python -m pytest tests/test_archive_replay.py tests/test_archive_codec.py --collect-only -q`
- formatting before GREEN: `.venv/bin/python -m ruff format job_discovery/archive/replay.py tests/test_archive_replay.py`
- ruff.txt: `.venv/bin/python -m ruff check job_discovery/archive/replay.py job_discovery/archive/schema.py job_discovery/archive/types.py tests/test_archive_replay.py`
- final-before.sha256: `sha256sum job_discovery/archive/replay.py job_discovery/archive/schema.py job_discovery/archive/types.py tests/test_archive_replay.py job_discovery/archive/batches.py job_discovery/archive/codec.py job_discovery/archive/s3.py pyproject.toml`
- final-hash-verification.txt: `sha256sum -c .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-12-evidence/final-before.sha256`
- versions.txt: `.venv/bin/python` printing sys.version and importlib.metadata.version for pytest, ruff, psycopg; explicitly records no PostgreSQL run.
- source whitespace: `git diff --cached --check` after staging exactly the four owned files; exit0/no output.
- upstream: `git ls-remote origin refs/heads/main` -> a8c4b82d95b35c0259600c19c1506faae807c3fc; `git merge-base --is-ancestor a8c4b82d95b35c0259600c19c1506faae807c3fc HEAD` -> exit0.

Source forward commit: `git add job_discovery/archive/replay.py job_discovery/archive/schema.py job_discovery/archive/types.py tests/test_archive_replay.py`; `git commit -m "feat: project public archive with terminal retention gaps"` -> a6dd9193076dad21017bf53b49965c7df168452d. No source changes after final GREEN. Report/evidence have a separate forward documentation commit.
