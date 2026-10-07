# Full pinned review package

BASE: e1bdc5f840406c4bbc5c7b85976944d7f70f9c3d

HEAD: 241ba32c1b5a815659c215b017b3d3afc304a6e0

## Commits

241ba32c1b5a815659c215b017b3d3afc304a6e0 test: add isolated lifecycle database harness


## Files

 .github/workflows/ci.yml                           |   24 +-
 .../task-1-evidence/offline-full.txt               |   14 +
 .../task-1-evidence/postgres16-full.txt            |   15 +
 .../task-1-evidence/postgres16-task1.txt           |    3 +
 .../task-1-evidence/postgres17-full.txt            |   15 +
 .../task-1-evidence/postgres17-task1.txt           |    3 +
 .../task-1-evidence/red-chronology.json            |   27 +
 .../task-1-evidence/verification.json              |   49 +
 .../task-1-report.md                               |  173 ++++
 tests/conftest.py                                  |   43 +
 .../lifecycle/schema-before-lifecycle.json         |   53 +
 .../fixtures/lifecycle/schema-before-lifecycle.sql | 1031 ++++++++++++++++++++
 tests/lifecycle_helpers.py                         |  124 +++
 tests/test_lifecycle_migrations.py                 |  109 +++
 tests/test_lifecycle_test_db.py                    |  283 ++++++
 tools/lifecycle_test_db.py                         |  192 ++++
 16 files changed, 2157 insertions(+), 1 deletion(-)


## Complete diff

diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index b9dab06..2d5be0e 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -41,21 +41,43 @@ jobs:
             pyproject.toml
       - name: Install dependencies
         run: python -m pip install -r requirements.txt "pytest>=8.0"
       - name: Ruff lint
         run: |
           python -m pip install "ruff==0.15.20"
           ruff check .
       - name: Run tests
         env:
           TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:55432/poller_test
-        run: python -m pytest tests/ -q
+          DATABASE_URL: postgresql://postgres:postgres@localhost:55432/poller_test
+          LIFECYCLE_REQUIRE_DB_TESTS: "1"
+        run: python tools/lifecycle_test_db.py --existing-service -- python -m pytest tests/ -q
+
+  lifecycle-postgres17:
+    name: Lifecycle PostgreSQL 17 migration, RLS and concurrency
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v7
+      - uses: actions/setup-python@v6
+        with:
+          python-version: "3.12"
+          cache: pip
+          cache-dependency-path: |
+            requirements.txt
+            pyproject.toml
+      - name: Install dependencies
+        run: python -m pip install -r requirements.txt "pytest>=8.0"
+      - name: Required PostgreSQL 17 database tests
+        run: >-
+          python tools/lifecycle_test_db.py --postgres-major 17 --
+          python -m pytest tests/test_lifecycle_test_db.py
+          tests/test_lifecycle_migrations.py tests/test_rls_isolation.py -q
 
   dashboard:
     name: Dashboard tests
     runs-on: ubuntu-latest
     env:
       DATABASE_URL: postgresql://test:test@127.0.0.1:1/test
       NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:1
       NEXT_PUBLIC_SUPABASE_ANON_KEY: test
     defaults:
       run:
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/offline-full.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/offline-full.txt
new file mode 100644
index 0000000..9030c00
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/offline-full.txt
@@ -0,0 +1,14 @@
+...ssssssssssssssssssssss.sssssssssssssss..sssss..........ssssssss...... [  8%]
+.............................................s.......................... [ 16%]
+............sss.ssss.ssssssssssssssssss................................s [ 24%]
+........................................................................ [ 32%]
+.sss.....ssssssssssss.................................sssssss........... [ 40%]
+........................ssssssssssssssssssssssssssssssssssssssssssssssss [ 48%]
+ssssssssssssssssssssssssssssssssssssssssssss....ss.........s..ssssssssss [ 56%]
+sss.................ssssss......ssssssssssssssssssssssssssssssssssss.... [ 64%]
+..........................................................ssssssssssssss [ 72%]
+ssssssssssssssssssssssss..sss....sssssssssssssssssssssssssssssssssssssss [ 80%]
+sssssssssssssssssssss.............................ss........ssss........ [ 88%]
+.........................sssssssssssss.................................. [ 96%]
+...................................                                      [100%]
+530 passed, 369 skipped in 11.29s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/postgres16-full.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/postgres16-full.txt
new file mode 100644
index 0000000..8887347
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/postgres16-full.txt
@@ -0,0 +1,15 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [  8%]
+........................................................................ [ 16%]
+........................................................................ [ 24%]
+........................................................................ [ 32%]
+........................................................................ [ 40%]
+........................................................................ [ 48%]
+........................................................................ [ 56%]
+........................................................................ [ 64%]
+........................................................................ [ 72%]
+........................................................................ [ 80%]
+........................................................................ [ 88%]
+........................................................................ [ 96%]
+...................................                                      [100%]
+899 passed in 121.14s (0:02:01)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/postgres16-task1.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/postgres16-task1.txt
new file mode 100644
index 0000000..d0ea990
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/postgres16-task1.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+......................................................................   [100%]
+70 passed in 26.68s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/postgres17-full.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/postgres17-full.txt
new file mode 100644
index 0000000..bb5904b
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/postgres17-full.txt
@@ -0,0 +1,15 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [  8%]
+........................................................................ [ 16%]
+........................................................................ [ 24%]
+........................................................................ [ 32%]
+........................................................................ [ 40%]
+........................................................................ [ 48%]
+........................................................................ [ 56%]
+........................................................................ [ 64%]
+........................................................................ [ 72%]
+........................................................................ [ 80%]
+........................................................................ [ 88%]
+........................................................................ [ 96%]
+...................................                                      [100%]
+899 passed in 92.45s (0:01:32)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/postgres17-task1.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/postgres17-task1.txt
new file mode 100644
index 0000000..fbfd513
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/postgres17-task1.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+......................................................................   [100%]
+70 passed in 21.83s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/red-chronology.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/red-chronology.json
new file mode 100644
index 0000000..07d6093
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/red-chronology.json
@@ -0,0 +1,27 @@
+[
+  {
+    "command": "python -m pytest tests/test_lifecycle_test_db.py -q",
+    "result": "31 failed, 4 skipped in 0.25s",
+    "expected_failure": "isolated harness is absent"
+  },
+  {
+    "command": "python -m pytest tests/test_lifecycle_migrations.py -q",
+    "result": "1 failed, 12 skipped in 0.05s",
+    "expected_failure": "pre-change schema fixture is absent"
+  },
+  {
+    "command": "python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest tests/test_lifecycle_test_db.py -k \"direct_pytest_scrubs or existing_ci_service\" -q",
+    "result": "2 failed, 37 deselected in 0.50s",
+    "expected_failure": "ambient libpq override survived direct entry; existing CI entry was absent"
+  },
+  {
+    "command": "python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest tests/test_lifecycle_test_db.py -k owned_docker -q",
+    "result": "1 failed, 38 deselected in 12.28s",
+    "expected_failure": "two newly owned anonymous volumes remained after child failure and timeout"
+  },
+  {
+    "command": "python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest tests/test_lifecycle_test_db.py -k required_database_entry -q",
+    "result": "1 failed, 1 passed, 38 deselected in 0.93s",
+    "expected_failure": "collection skip with a passing test incorrectly returned exit 0"
+  }
+]
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/verification.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/verification.json
new file mode 100644
index 0000000..c58ec5c
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/verification.json
@@ -0,0 +1,49 @@
+{
+  "recorded_utc": "2026-10-07T05:14:47.357255+00:00",
+  "base_commit": "e1bdc5f840406c4bbc5c7b85976944d7f70f9c3d",
+  "frozen_schema_sha256": "fb9b20f4708e7f60d15fb36e0174aa3de4de5254ea6aedf8b27df10bb7e3b0d6",
+  "required_lanes": [
+    {
+      "postgres_version": "17.11 (Debian 17.11-1.pgdg13+2)",
+      "suite": "Task1 migration/harness/RLS",
+      "passed": 70,
+      "skipped": 0,
+      "exit_code": 0,
+      "seconds": 21.83
+    },
+    {
+      "postgres_version": "16.15 (Debian 16.15-1.pgdg13+2)",
+      "suite": "Task1 migration/harness/RLS",
+      "passed": 70,
+      "skipped": 0,
+      "exit_code": 0,
+      "seconds": 26.68
+    },
+    {
+      "postgres_version": "17.11 (Debian 17.11-1.pgdg13+2)",
+      "suite": "full Python suite",
+      "passed": 899,
+      "skipped": 0,
+      "exit_code": 0,
+      "seconds": 92.45
+    },
+    {
+      "postgres_version": "16.15 (Debian 16.15-1.pgdg13+2)",
+      "suite": "full Python suite",
+      "passed": 899,
+      "skipped": 0,
+      "exit_code": 0,
+      "seconds": 121.14
+    }
+  ],
+  "offline_baseline": {
+    "passed": 530,
+    "expected_database_skips": 369,
+    "seconds": 11.29,
+    "integration_acceptance": false
+  },
+  "lint": "passed",
+  "diff_check": "passed",
+  "independent_review": "controller-owned, pending",
+  "library_checkpoint": "controller-owned, pending"
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-report.md
new file mode 100644
index 0000000..7334f9b
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-report.md
@@ -0,0 +1,173 @@
+# Reconstructed Task 1: isolated migration and concurrency harness
+
+This report covers the current reconstruction only. Historical implementations,
+tests and reviews are not evidence for this work. The implementation began on
+`feature/lifecycle-recovery` at clean base
+`e1bdc5f840406c4bbc5c7b85976944d7f70f9c3d` in
+`/workspace/job-board/.claude/worktrees/lifecycle-recovery`.
+
+## Scope and safety
+
+Added `tools/lifecycle_test_db.py`, `tests/lifecycle_helpers.py`,
+`tests/test_lifecycle_test_db.py`, `tests/test_lifecycle_migrations.py`, and the
+frozen pre-change schema and migration inventory under `tests/fixtures/lifecycle/`.
+Updated only the database safety/mandatory-skip hooks in `tests/conftest.py` and
+the required database entries in `.github/workflows/ci.yml`.
+
+The default runner creates a fresh `postgres:17` or `postgres:16` container on
+the explicitly selected local Docker socket, with a generated password and a
+random port published only on `127.0.0.1`. It never falls back to ambient
+`DATABASE_URL` or reuses the existing local port 55432 service. Readiness is
+bounded to 60 seconds, individual probes to 5 seconds, Docker creation to 180
+seconds and child execution to 1,800 seconds. A `finally` removes only its unique
+owned container and that container's anonymous volumes. Child failure and
+timeout are exercised with real Docker, alongside unchanged-container and
+unchanged-volume assertions.
+
+Both child database variables point to the same isolated DSN. The child
+environment uses an allowlist, removing ambient production/provider/model,
+tracing, proxy and AWS credentials. It supplies a nonfunctional OpenAI test
+placeholder, disables AWS instance metadata and redirects AWS credential/config
+files to the null device; existing SDK tests use their offline doubles. The
+existing CI PostgreSQL 16 service and port/database configuration are preserved
+through `--existing-service`, which accepts only explicit `TEST_DATABASE_URL`,
+sanitizes the child environment and performs no service cleanup. A new required
+PostgreSQL 17 migration/RLS/concurrency job uses the owned Docker runner. Required
+pytest lanes fail for skipped tests, including collection-time module skips.
+
+DSN validation occurs before connections/helper DDL and before any pytest
+fixture, including older fixtures with direct `DROP SCHEMA`. It permits only
+`localhost`, `127.0.0.1`, or `::1`, an explicit port and credentials, and database
+`poller_test` or `poller_lifecycle_test`. It rejects provider/production hosts,
+remote/private/wildcard hosts, other databases, missing credentials/port,
+multi-host targets, keyword DSNs, query overrides (`host`, `hostaddr`, `service`,
+`options`), fragments and malformed targets. Errors omit credentials. Direct
+pytest entry also clears ambient libpq `PG*` defaults before collection so
+`PGHOSTADDR` and service files cannot override an otherwise safe URI. Helpers
+recheck the established host, resolved loopback address and test database before
+DDL. Tests prove rejection before connection/DDL, including a Supabase project
+host and unsafe direct pytest startup.
+
+Independent connections share the same database/public schema and committed
+seeded rows; two distinct backend PIDs are asserted. Authenticated foreign-user
+reads return zero rows, valid owner reads work and anon access is denied.
+The concurrent visibility proof coordinates writer/reader using Events with
+bounded waits; it does not guess races with sleeps.
+
+No lifecycle business schema, lifecycle flags, migrations 1–4, production/cloud
+writes, provider/paid calls, deployment, merge, push or activation were introduced.
+`schema.sql` and dashboard files remain unchanged. Controller `progress.md`
+edits are excluded from the implementation commit. No agents/reviewers were
+spawned; independent review and Library checkpoint remain controller-owned.
+
+## Frozen baseline and migration parity
+
+Frozen file: `tests/fixtures/lifecycle/schema-before-lifecycle.sql`, copied
+byte-for-byte from this reconstruction's pre-change canonical schema.
+
+SHA-256: `fb9b20f4708e7f60d15fb36e0174aa3de4de5254ea6aedf8b27df10bb7e3b0d6`.
+
+The adjacent JSON records the base SHA, immutable schema hash and all 47 existing
+migration filenames. The test pins the frozen hash and retains the existing
+`app_user_id()` search path. Future migration parity always starts with this
+fixture, selects all migrations absent from the frozen inventory in filename
+order, applies them, and compares against clean current `schema.sql`.
+
+Catalog comparison includes tables, columns/types/defaults/nullability/identity,
+constraints, indexes, RLS enabled/forced state and policy predicates, table and
+column ACLs, schema/default grants, functions including definitions/security
+mode/ACLs/**proconfig**, triggers, and sequence definitions. Eight real mutations
+prove the comparison detects column, constraint, index, table grant, column grant,
+function search-path, RLS-enable and RLS-policy drift. Existing recorded mirrored
+migrations are actually re-executed twice rather than skipped by a ledger check;
+catalog and `schema_migrations` filename/timestamp entries remain unchanged.
+Ordered fixture migrations prove shared rows and filename recording; a real SQL
+failure proves rollback and no ledger entry. Every helper validates its target.
+
+At Task 1 there are zero new lifecycle migrations, intentionally. Baseline plus
+future-migration selection and complete clean-schema parity are established now;
+later tasks supply their additive SQL and matching canonical schema definitions.
+
+## Tests-first chronology
+
+All commands used `/bin/bash` with `login:false` and the ignored local `.venv`
+dependency symlink. No old review/test results are reported as current proof.
+
+1. Wrote the harness/session safety tests before implementation.
+   `python -m pytest tests/test_lifecycle_test_db.py -q` failed with
+   **31 failed, 4 skipped in 0.25s**, asserting the isolated harness was absent.
+2. Wrote frozen-schema/parity tests before helper/fixture implementation.
+   `python -m pytest tests/test_lifecycle_migrations.py -q` failed with
+   **1 failed, 12 skipped in 0.05s**, asserting the pre-change fixture was absent.
+3. Implemented the runner/helpers/fixture and safety hooks. One intermediate run
+   exposed a test import-location error (`open_sessions` belongs to
+   `tests/lifecycle_helpers.py`); corrected the test. An initial real launch
+   exposed libpq treating `service=''` as a service lookup; replaced readiness
+   with a driver probe in the sanitized child environment. That failed launch
+   was cleaned up and is not acceptance evidence.
+4. Added direct-entry libpq-override and existing-CI-entry regressions before
+   implementing their behavior. On owned PostgreSQL 17, the filtered run failed
+   with **2 failed, 37 deselected in 0.50s**: ambient PG defaults survived direct
+   pytest entry and the explicit CI entry was absent. Implemented both paths.
+5. Added anonymous-volume cleanup proof before changing cleanup. Real child
+   failure and timeout then failed with **1 failed, 38 deselected in 12.28s**:
+   containers were removed but their two anonymous volumes remained. Added
+   `--volumes` to exact-container removal; the same proof passed with
+   **1 passed, 38 deselected in 11.08s**.
+6. Added a collection-skip regression before extending the mandatory-skip hook.
+   A module skip plus a passing test incorrectly returned success; the outer run
+   failed with **1 failed, 1 passed, 38 deselected in 0.93s**. The hook now handles
+   both collection and runtime skip reports; final lanes include both cases.
+
+During local development, 11 anonymous test volumes from the earlier cleanup
+implementation were removed only after recorded Docker event metadata proved
+every observed mount belonged to our uniquely named, labeled owned test
+containers and a fresh per-volume check proved none remained mounted. Cleanup
+used those exact volume IDs, with no prune and no unrelated/shared deletion.
+The current runner cleans its own volumes in `finally`.
+
+## Current verification
+
+Shell setup for the commands below:
+
+```bash
+export PATH="$PWD/.venv/bin:$PATH"
+```
+
+| Actual command | Actual result |
+| --- | --- |
+| `python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest tests/test_lifecycle_migrations.py tests/test_lifecycle_test_db.py tests/test_rls_isolation.py -q` | PostgreSQL **17.11** (Debian 17.11-1.pgdg13+2); **70 passed, zero skipped**, fresh final run 21.83s |
+| Same command with `--postgres-major 16` | PostgreSQL **16.15** (Debian 16.15-1.pgdg13+2); **70 passed, zero skipped**, 26.68s |
+| `python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest -q` | PostgreSQL **17.11**; **899 passed, zero skipped**, 92.45s |
+| `python tools/lifecycle_test_db.py --postgres-major 16 -- python -m pytest -q` | PostgreSQL **16.15**; **899 passed, zero skipped**, 121.14s |
+| `python -m pytest -q` without a test DSN | **530 passed, 369 expected database skips**, 11.29s; exploratory offline baseline, **not integration acceptance** |
+| `.venv/bin/ruff check .` | Passed |
+| `git diff --check` | Passed |
+
+The full suite contains the controller's original 846 tests plus 53 new Task 1
+tests. The dedicated lane contains 34 non-DB checks and 36 actual DB checks;
+all tests execute in required mode. Required-lane negative subprocess probes
+deliberately return a failing exit status for unsafe/missing DSNs and skipped
+required tests; their outer tests assert those failures and pass.
+
+Sanitized current output and RED chronology are tracked in `task-1-evidence/`.
+No environment secrets or database data/dumps are included.
+
+## Limits and handoff
+
+The actual Docker servers are 17.11 and 16.15; this establishes current major-17
+parity plus major-16 compatibility, not a claim of testing the historical 17.6
+production patch version. Docker/local socket is required; unavailable Docker,
+server-major mismatch, readiness timeout or failed cleanup fails closed.
+
+The multi-task binding command naming lifecycle safety/activation and archive
+files is not runnable at Task 1 because those later-task files do not exist yet.
+This task's real migration/RLS/concurrency harness tests are mandatory on both
+majors. No placeholder tests or fabricated skips were added for future work.
+Task 13 must run that final prescribed file set and dashboard DB tests on 17.
+
+All commits are forward-only; no amend/reset/rebase is used. Final SHA is the
+commit adding this report and is returned in the implementer handoff; retrieve
+it with `git log -1 --format=%H -- .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-report.md`.
+Independent spec/security/code review and Library checkpoint are pending the
+controller's fresh review. Stop before Task 2.
diff --git a/tests/conftest.py b/tests/conftest.py
index 75f31e6..12735cf 100644
--- a/tests/conftest.py
+++ b/tests/conftest.py
@@ -1,20 +1,22 @@
 import json
 import os
 from contextlib import contextmanager
 from pathlib import Path
 
 import pytest
 
 import psycopg
 from psycopg.rows import dict_row
 
+from tools.lifecycle_test_db import validate_test_dsn
+
 SCHEMA_SQL = (Path(__file__).resolve().parent.parent / "schema.sql").read_text()
 TEST_DSN = os.environ.get("TEST_DATABASE_URL")
 
 # DDL additions from C-lane that may not yet be in schema.sql (applied idempotently).
 _CLANE_DDL = """
 ALTER TABLE jobs ADD COLUMN IF NOT EXISTS
   description_pruned BOOLEAN NOT NULL DEFAULT FALSE;
 ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS
   description_snapshot TEXT;
 ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS
@@ -26,20 +28,60 @@ ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS
 
 def apply_clane_ddl(conn) -> None:
     """Apply C-lane schema additions idempotently. Call from tests that need them."""
     with conn.cursor() as cur:
         cur.execute(_CLANE_DDL)
     conn.commit()
 
 requires_db = pytest.mark.skipif(TEST_DSN is None, reason="TEST_DATABASE_URL not set")
 
 
+def pytest_sessionstart(session):
+    # Runs before any fixture (including old direct DROP SCHEMA fixtures).
+    if TEST_DSN is not None:
+        try:
+            validate_test_dsn(TEST_DSN)
+        except ValueError as error:
+            raise pytest.UsageError(str(error)) from None
+    if os.environ.get("LIFECYCLE_REQUIRE_DB_TESTS") == "1" and not TEST_DSN:
+        raise pytest.UsageError("required database lane needs TEST_DATABASE_URL")
+    # URI validation alone is insufficient: libpq can take PGHOSTADDR or a
+    # service file from the caller's environment and connect elsewhere. All test
+    # credentials/targets are explicit in the validated URI, so discard defaults
+    # before collection or any legacy fixture's direct psycopg.connect/DDL.
+    for name in list(os.environ):
+        if name.startswith("PG"):
+            os.environ.pop(name)
+    _REQUIRED_SKIPS.clear()
+
+
+def pytest_runtest_logreport(report):
+    if report.skipped and os.environ.get("LIFECYCLE_REQUIRE_DB_TESTS") == "1":
+        _REQUIRED_SKIPS.append(report.nodeid)
+
+
+def pytest_collectreport(report):
+    if report.skipped and os.environ.get("LIFECYCLE_REQUIRE_DB_TESTS") == "1":
+        _REQUIRED_SKIPS.append(report.nodeid)
+
+
+_REQUIRED_SKIPS = []
+
+
+def pytest_sessionfinish(session, exitstatus):
+    if _REQUIRED_SKIPS and os.environ.get("LIFECYCLE_REQUIRE_DB_TESTS") == "1":
+        terminal = session.config.pluginmanager.getplugin("terminalreporter")
+        if terminal:
+            terminal.write_line(f"required database tests skipped: {len(_REQUIRED_SKIPS)}", red=True)
+        session.exitstatus = pytest.ExitCode.TESTS_FAILED
+
+
 @contextmanager
 def as_user(conn, user_id):
     """Run the enclosed queries as the `authenticated` Postgres role scoped to
     `user_id`, exactly mirroring the dashboard's withUserSql: inside a transaction
     it does `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', …,
     is_local=true)` so public.app_user_id() resolves to this user and RLS policies
     apply (the role is non-owner, so it does NOT bypass RLS).
 
     Both settings are transaction-LOCAL, so the `conn.rollback()` on exit resets the
     role + GUC back to the session default — nothing bleeds onto the pooled
@@ -62,20 +104,21 @@ def _no_real_langfuse(monkeypatch):
     """Ambient LANGFUSE_* keys (shell, CI) must never let a test send real
     traces into the production Langfuse project. Tests that want tracing
     behavior opt in by stubbing observability.tracing.get_langfuse directly."""
     monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
     monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)
 
 
 @pytest.fixture
 def conn():
     assert TEST_DSN, "TEST_DATABASE_URL required"
+    validate_test_dsn(TEST_DSN)
     connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
     try:
         with connection.cursor() as cur:
             cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
             cur.execute(SCHEMA_SQL)
             # Apply C-lane DDL additions that may not yet be in schema.sql.
             # These are idempotent (IF NOT EXISTS) and safe to run every time.
             cur.execute(_CLANE_DDL)
         connection.commit()
         yield connection
diff --git a/tests/fixtures/lifecycle/schema-before-lifecycle.json b/tests/fixtures/lifecycle/schema-before-lifecycle.json
new file mode 100644
index 0000000..44da97c
--- /dev/null
+++ b/tests/fixtures/lifecycle/schema-before-lifecycle.json
@@ -0,0 +1,53 @@
+{
+  "base_commit": "e1bdc5f840406c4bbc5c7b85976944d7f70f9c3d",
+  "sha256": "fb9b20f4708e7f60d15fb36e0174aa3de4de5254ea6aedf8b27df10bb7e3b0d6",
+  "existing_migrations": [
+    "2026-06-24-reviews.sql",
+    "2026-06-25-model-selection.sql",
+    "2026-06-25-preferred-locations.sql",
+    "2026-06-26-company-discovery.sql",
+    "2026-06-26-rls-deny-all-policies.sql",
+    "2026-06-26-rolefit-fields.sql",
+    "2026-06-28-job-data-pruning.sql",
+    "2026-06-28-job-human-override.sql",
+    "2026-06-29-analytics-jobs-closed-at-index.sql",
+    "2026-06-29-board-filters.sql",
+    "2026-06-30-additional-ats-providers.sql",
+    "2026-06-30-application-details.sql",
+    "2026-06-30-application-packages.sql",
+    "2026-06-30-review-corrections.sql",
+    "2026-07-01-board-owner.sql",
+    "2026-07-01-check-constraints.sql",
+    "2026-07-01-correction-snapshots.sql",
+    "2026-07-01-indexes-and-pruned-flag.sql",
+    "2026-07-01-schema-migrations-and-fk-drift.sql",
+    "2026-07-02-application-packages-profile-version.sql",
+    "2026-07-02-resume-scores.sql",
+    "2026-07-03-billing-review-requests.sql",
+    "2026-07-03-multitenant-foundation.sql",
+    "2026-07-03-rls-tenant-isolation.sql",
+    "2026-07-04-account-deletions.sql",
+    "2026-07-04-cost-cap-hardening.sql",
+    "2026-07-04-openrouter-usage-snapshots.sql",
+    "2026-07-04-resume-bucket-storage-policies.sql",
+    "2026-07-04-subscription-event-ordering.sql",
+    "2026-07-04-tier-settings.sql",
+    "2026-07-05-app-user-id-search-path.sql",
+    "2026-07-05-company-enrichment.sql",
+    "2026-07-05-default-privileges-revoke.sql",
+    "2026-07-05-generation-jobs.sql",
+    "2026-07-07-cover-letter-edits.sql",
+    "2026-07-07-job-questions.sql",
+    "2026-07-08-instruction-drafts.sql",
+    "2026-07-08-profile-generation-instructions.sql",
+    "2026-07-08-reasoning-effort-grants.sql",
+    "2026-07-08-reasoning-effort.sql",
+    "2026-07-13-user-invites.sql",
+    "2026-07-16-locations-canonical.sql",
+    "2026-07-16-plan-overrides.sql",
+    "2026-07-21-company-classification.sql",
+    "2026-08-23-classification-all-mode.sql",
+    "2026-10-02-feedback.sql",
+    "2026-10-02-matching-activity.sql"
+  ]
+}
diff --git a/tests/fixtures/lifecycle/schema-before-lifecycle.sql b/tests/fixtures/lifecycle/schema-before-lifecycle.sql
new file mode 100644
index 0000000..1436275
--- /dev/null
+++ b/tests/fixtures/lifecycle/schema-before-lifecycle.sql
@@ -0,0 +1,1031 @@
+CREATE TABLE companies (
+  id      SERIAL PRIMARY KEY,
+  name    TEXT NOT NULL,
+  ats     TEXT NOT NULL CHECK (ats IN ('greenhouse','lever','ashby',
+                                        'workable','smartrecruiters','workday')),
+  token   TEXT NOT NULL,
+  active           BOOLEAN NOT NULL DEFAULT TRUE,
+  discovery_source TEXT NOT NULL DEFAULT 'manual'
+                     CHECK (discovery_source IN ('manual','seed','dataset','expansion')),
+  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
+  -- Company-enrichment substrate (see migrations/2026-07-05-company-enrichment.sql).
+  -- Raw `name` (slug) stays the stable join/display fallback; these are populated by
+  -- later enrichment tasks. enriched_at > company_reviews.reviewed_at re-triggers a screen.
+  display_name     TEXT,
+  about            TEXT,
+  about_source     TEXT CHECK (about_source IN ('ats_board','jd_probe','serp')),
+  web_description  TEXT,
+  web_searched_at  TIMESTAMPTZ,
+  enriched_at      TIMESTAMPTZ,
+  -- Global company classification (migrations/2026-07-21-company-classification.sql).
+  -- Written once, globally, by the admin-launched classification_jobs worker; per-user
+  -- judgment now lives in profiles.company_exclusions + company_overrides.
+  industry                  TEXT,
+  industry_subcategory      TEXT,
+  size                      TEXT
+    CHECK (size IN ('1-10','11-50','51-200','201-1000','1001-5000','5000+','unknown')),
+  hq_country                TEXT,   -- ISO-3166 alpha-2 (uppercase) or 'unknown'
+  tech_tags                 JSONB,
+  red_flags                 JSONB,  -- [{category, note}] — company_discovery taxonomy
+  classification_confidence TEXT
+    CHECK (classification_confidence IN ('low','medium','high')),
+  classified_at             TIMESTAMPTZ,
+  classification_model      TEXT,
+  classification_source     TEXT
+    CHECK (classification_source IN ('seeded_from_user_review','job','job_serp')),
+  poll_failures             INT NOT NULL DEFAULT 0,
+  UNIQUE (ats, token)
+);
+
+CREATE TABLE jobs (
+  id            TEXT PRIMARY KEY,             -- '{ats}:{token}:{external_id}'
+  company_id    INT NOT NULL REFERENCES companies(id),
+  external_id   TEXT NOT NULL,
+  title         TEXT NOT NULL,
+  url           TEXT NOT NULL,
+  location      TEXT,
+  department    TEXT,
+  remote        BOOLEAN,
+  location_canonicals TEXT[],                 -- stamped from locations.canonicals; NULL = not yet resolved
+  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
+  closed_at     TIMESTAMPTZ,                  -- set when role drops out of feed
+  description   TEXT,                         -- cached full JD plaintext (from the ATS payload)
+  description_pruned BOOLEAN NOT NULL DEFAULT FALSE  -- legacy pruning marker; current maintenance never strips shared descriptions
+);
+CREATE INDEX idx_jobs_first_seen ON jobs (first_seen_at DESC);
+CREATE INDEX idx_jobs_open ON jobs (closed_at) WHERE closed_at IS NULL;
+-- Lets the analytics "job lifespan" query (WHERE closed_at IS NOT NULL — a small
+-- minority of rows) use a bitmap index scan instead of a full seq scan of the large
+-- jobs table. (The whole-table funnel count still seq-scans, which is correct for a
+-- full count.) The durable fix for the /analytics load is the request-level caching.
+CREATE INDEX idx_jobs_closed_at ON jobs (closed_at);
+-- Poller: get_open_external_ids / close_jobs filter WHERE company_id = $1 AND closed_at IS NULL.
+CREATE INDEX idx_jobs_company_open ON jobs (company_id) WHERE closed_at IS NULL;
+CREATE INDEX idx_jobs_location_canonicals ON jobs USING GIN (location_canonicals);
+
+-- Raw->canonical location cache, poller-owned (service-only: RLS on, no policies,
+-- no grants). See docs/superpowers/specs/2026-07-16-location-dedupe-design.md.
+CREATE TABLE locations (
+  raw         TEXT PRIMARY KEY,
+  canonicals  TEXT[] NOT NULL,
+  components  JSONB NOT NULL,
+  source      TEXT NOT NULL CHECK (source IN ('rule','llm','manual')),
+  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
+);
+ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
+
+-- Per-job application question schema, fetched once at poll time (Greenhouse only
+-- today). GLOBAL/shared job data — no user_id; keyed by jobs.id. Populated by the
+-- poller; the dashboard reads it job-level (shared_read) and the Prefill route uses
+-- it to draft answers + decide whether the posting asks for a cover letter.
+CREATE TABLE job_questions (
+  job_id     TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
+  questions  JSONB NOT NULL,
+  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
+);
+
+CREATE TABLE poll_runs (
+  id               SERIAL PRIMARY KEY,
+  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
+  finished_at      TIMESTAMPTZ,
+  companies_ok     INT,
+  companies_failed INT,
+  new_jobs         INT,
+  closed_jobs      INT,
+  notes            TEXT
+);
+-- Dashboard getLatestPollRun / pipeline health sort on started_at.
+CREATE INDEX idx_poll_runs_started_at ON poll_runs (started_at DESC);
+
+-- one row per user (the operator). user_id mirrors auth.users(id) in production,
+-- but no FK: auth.users is Supabase-managed and absent in the throwaway test DB.
+CREATE TABLE profiles (
+  user_id          UUID PRIMARY KEY,
+  resume_text      TEXT,
+  resume_file_path TEXT,
+  instructions     TEXT,
+  model_stage1     TEXT,                     -- OpenRouter model id; NULL = default
+  model_stage2     TEXT,                     -- OpenRouter model id; NULL = default
+  preferred_locations TEXT[] NOT NULL DEFAULT '{}',  -- location include-list; empty = no pre-filter
+  model_resume     TEXT,                     -- OpenRouter model id; NULL = default
+  company_instructions    TEXT,
+  company_profile_version TEXT,
+  model_company           TEXT,
+  board_filters    JSONB,                     -- remembered board filter state; NULL = defaults
+  -- Structured company facet exclusions: {industries[], countries[], sizes[],
+  -- redFlagCategories[]}. Deterministic per-user gate (no LLM); enforced in the
+  -- reviewer + board. See migrations/2026-07-21-company-classification.sql.
+  company_exclusions JSONB,
+  -- Reusable application answers (do not affect review verdicts).
+  full_name         TEXT,
+  email             TEXT,
+  phone             TEXT,
+  links             JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { linkedin, github, portfolio }
+  location          TEXT,
+  work_authorized   BOOLEAN,                  -- tri-state; NULL = unspecified
+  needs_sponsorship BOOLEAN,                  -- tri-state; NULL = unspecified
+  eeo_gender        TEXT,                     -- voluntary EEO; NULL = declined
+  eeo_race          TEXT,
+  eeo_veteran       TEXT,
+  eeo_disability    TEXT,
+  screening_answers JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { notice_period, salary_expectation, relocation, … }
+  model_cover       TEXT,                     -- OpenRouter model id; NULL = default
+  -- Reasoning effort for generation ('low'|'medium'|'high'); NULL = off (default).
+  -- medium/high are Pro-gated (dashboard/lib/entitlements.ts, TS-only).
+  reasoning_effort_resume TEXT CHECK (reasoning_effort_resume IN ('low', 'medium', 'high')),
+  reasoning_effort_cover  TEXT CHECK (reasoning_effort_cover  IN ('low', 'medium', 'high')),
+  -- Standing generation guidance, layered UNDER the per-job instruction boxes at
+  -- generate time. Reviewer-independent: NOT part of profile_version.
+  resume_generation_instructions       TEXT,
+  cover_letter_generation_instructions TEXT,
+  profile_version  TEXT NOT NULL,            -- sha256(resume_text || '\0' || instructions)
+  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
+  -- Optional per-user override of the env daily review cap (reviewer/config.py
+  -- DAILY_REVIEW_CAP_DEFAULT). NULL = use the env default.
+  daily_review_cap INT
+);
+
+-- one current verdict per (user, job); re-review upserts in place
+CREATE TABLE job_reviews (
+  user_id              UUID NOT NULL,
+  job_id               TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
+  profile_version      TEXT NOT NULL,
+  stage1_decision      TEXT CHECK (stage1_decision IN ('pass','reject')),
+  stage1_reason        TEXT,
+  verdict              TEXT CHECK (verdict IN ('approve','deny')),
+  human_override       BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE = operator set this verdict by hand
+  experience_match     TEXT CHECK (experience_match IN
+                         ('step_down','match','reach','far_reach')),
+  industry             TEXT,
+  industry_subcategory TEXT,
+  confidence           TEXT CHECK (confidence IN ('low','medium','high')),
+  reasoning            TEXT,
+  role_category        TEXT,
+  seniority            TEXT,
+  work_arrangement     TEXT CHECK (work_arrangement IN ('remote','hybrid','onsite','unknown')),
+  about                TEXT,
+  pay_min              INT,
+  pay_max              INT,
+  pay_currency         TEXT,
+  pay_period           TEXT CHECK (pay_period IN ('year','hour','month')),
+  headcount            TEXT,
+  skills_score         INT,
+  experience_score     INT,
+  comp_score           INT,
+  fit_score            INT,
+  red_flags            JSONB NOT NULL DEFAULT '[]'::jsonb,
+  skill_gaps           JSONB NOT NULL DEFAULT '[]'::jsonb,
+  benefits             JSONB NOT NULL DEFAULT '[]'::jsonb,
+  requirements         JSONB NOT NULL DEFAULT '[]'::jsonb,
+  model_stage1         TEXT,
+  model_stage2         TEXT,
+  error                TEXT,
+  reviewed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
+  CONSTRAINT job_reviews_scores_range CHECK (
+    (skills_score     IS NULL OR skills_score     BETWEEN 0 AND 100) AND
+    (experience_score IS NULL OR experience_score BETWEEN 0 AND 100) AND
+    (comp_score       IS NULL OR comp_score       BETWEEN 0 AND 100) AND
+    (fit_score        IS NULL OR fit_score        BETWEEN 0 AND 100)),
+  PRIMARY KEY (user_id, job_id)
+);
+CREATE INDEX idx_job_reviews_user_verdict ON job_reviews (user_id, verdict);
+CREATE INDEX idx_job_reviews_user_profile_version ON job_reviews (user_id, profile_version);
+-- FK-cascade lookup: jobs DELETE cascades require job_id-leading index on child tables.
+CREATE INDEX idx_job_reviews_job ON job_reviews (job_id);
+
+-- Human corrections to model reviews — a golden-dataset OVERLAY. Never mutates
+-- job_reviews or the reviewer pipeline; read-time COALESCE lets it drive display.
+-- model_snapshot preserves the model's job_reviews values at correction time so
+-- the model-vs-human diff survives later re-reviews.
+CREATE TABLE review_corrections (
+  user_id              UUID NOT NULL,
+  job_id               TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
+  verdict              TEXT CHECK (verdict IN ('approve','deny')),
+  experience_match     TEXT CHECK (experience_match IN
+                         ('step_down','match','reach','far_reach')),
+  industry             TEXT,
+  industry_subcategory TEXT,
+  confidence           TEXT CHECK (confidence IN ('low','medium','high')),
+  role_category        TEXT,
+  seniority            TEXT,
+  work_arrangement     TEXT CHECK (work_arrangement IN
+                         ('remote','hybrid','onsite','unknown')),
+  skills_score         INT,
+  experience_score     INT,
+  comp_score           INT,
+  fit_score            INT,        -- recomputed from corrected sub-scores at save time
+  reasoning            TEXT,
+  about                TEXT,
+  pay_min              INT,
+  pay_max              INT,
+  pay_currency         TEXT,
+  pay_period           TEXT CHECK (pay_period IN ('year','hour','month')),
+  headcount            TEXT,
+  red_flags            JSONB NOT NULL DEFAULT '[]'::jsonb,
+  skill_gaps           JSONB NOT NULL DEFAULT '[]'::jsonb,
+  benefits             JSONB NOT NULL DEFAULT '[]'::jsonb,
+  requirements         JSONB NOT NULL DEFAULT '[]'::jsonb,
+  model_snapshot       JSONB NOT NULL DEFAULT '{}'::jsonb,
+  note                 TEXT,
+  -- Frozen at correction time so golden-dataset eval inputs survive JD pruning and profile drift.
+  description_snapshot  TEXT,
+  resume_text_snapshot  TEXT,
+  instructions_snapshot TEXT,
+  corrected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
+  CONSTRAINT review_corrections_scores_range CHECK (
+    (skills_score     IS NULL OR skills_score     BETWEEN 0 AND 100) AND
+    (experience_score IS NULL OR experience_score BETWEEN 0 AND 100) AND
+    (comp_score       IS NULL OR comp_score       BETWEEN 0 AND 100) AND
+    (fit_score        IS NULL OR fit_score        BETWEEN 0 AND 100)),
+  PRIMARY KEY (user_id, job_id)
+);
+-- Redundant idx_review_corrections_user removed: PK (user_id, job_id) already serves user_id-leading lookups.
+-- FK-cascade lookup index (job_id-leading) for cascade deletes from jobs.
+CREATE INDEX idx_review_corrections_job ON review_corrections (job_id);
+
+-- accounting, mirrors poll_runs. user_id attributes a run to the user it reviewed
+-- (multi-tenant); NULL for legacy rows written before the column existed.
+CREATE TABLE review_runs (
+  id            SERIAL PRIMARY KEY,
+  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
+  finished_at   TIMESTAMPTZ,
+  reviewed      INT,
+  gate_rejected INT,
+  approved      INT,
+  denied        INT,
+  errors        INT,
+  notes         TEXT,
+  user_id       UUID
+);
+CREATE INDEX idx_review_runs_started_at ON review_runs (started_at DESC);
+
+-- one current verdict per (user, company); re-review upserts in place
+CREATE TABLE company_reviews (
+  user_id                 UUID NOT NULL,
+  company_id              INT  NOT NULL REFERENCES companies(id),
+  company_profile_version TEXT NOT NULL,
+  verdict                 TEXT CHECK (verdict IN ('include','exclude','unknown')),
+  confidence              TEXT CHECK (confidence IN ('low','medium','high')),
+  reasoning               TEXT,
+  industry                TEXT,
+  industry_subcategory    TEXT,
+  tech_tags               JSONB NOT NULL DEFAULT '[]'::jsonb,
+  -- Array of {category, note}: category is one of RED_FLAG_CATEGORIES
+  -- (company_discovery/schemas.py); note is optional free text (required for
+  -- category='other'). Backfilled by company_discovery/reclassify.py.
+  red_flags               JSONB NOT NULL DEFAULT '[]'::jsonb,
+  human_override          BOOLEAN NOT NULL DEFAULT FALSE,
+  override_verdict        TEXT CHECK (override_verdict IN ('include','exclude')),
+  model                   TEXT,
+  error                   TEXT,
+  reviewed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
+  PRIMARY KEY (user_id, company_id)
+);
+CREATE INDEX idx_company_reviews_user_verdict ON company_reviews (user_id, verdict);
+CREATE INDEX idx_company_reviews_user_version ON company_reviews (user_id, company_profile_version);
+
+-- Admin-triggered LLM classification runs (migrations/2026-07-21-company-classification.sql).
+-- Service/admin only: RLS deny-all, NO grants — the dashboard admin UI reads/writes via
+-- serviceSql (postgres role bypasses RLS). RLS enable/policy sit in the RLS section below.
+CREATE TABLE classification_jobs (
+  id             SERIAL PRIMARY KEY,
+  status         TEXT NOT NULL DEFAULT 'pending'
+                   CHECK (status IN ('pending','running','done','canceled','error')),
+  model          TEXT NOT NULL,
+  company_cap    INT NOT NULL CHECK (company_cap > 0),
+  selection_mode TEXT NOT NULL CHECK (selection_mode IN ('unclassified','unknown_repass','all')),
+  use_serp       BOOLEAN NOT NULL DEFAULT FALSE,
+  est_cost       NUMERIC(10,4),
+  processed      INT NOT NULL DEFAULT 0,
+  errored        INT NOT NULL DEFAULT 0,
+  serp_queries   INT NOT NULL DEFAULT 0,
+  actual_prompt_tokens     BIGINT NOT NULL DEFAULT 0,
+  actual_completion_tokens BIGINT NOT NULL DEFAULT 0,
+  actual_cost    NUMERIC(10,4),
+  error          TEXT,
+  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
+  started_at     TIMESTAMPTZ,
+  last_progress_at TIMESTAMPTZ,   -- progress heartbeat; stale-job recovery gate (worker.py)
+  finished_at    TIMESTAMPTZ
+);
+
+-- Per-user manual include/exclude (migrations/2026-07-21-company-classification.sql).
+-- Replaces company_reviews.human_override/override_verdict. Owner-scoped RLS + grant sit
+-- in the RLS/grants sections below (owner_access references public.app_user_id(), which is
+-- defined further down, so the policy cannot live inline here).
+CREATE TABLE company_overrides (
+  user_id    UUID NOT NULL,          -- mirrors auth.users; deliberately no FK (house convention)
+  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
+  verdict    TEXT NOT NULL CHECK (verdict IN ('include','exclude')),
+  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  PRIMARY KEY (user_id, company_id)
+);
+CREATE INDEX idx_company_overrides_company ON company_overrides (company_id);
+
+-- accounting for discovery pipeline runs
+CREATE TABLE discovery_runs (
+  id          SERIAL PRIMARY KEY,
+  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
+  finished_at TIMESTAMPTZ,
+  status      TEXT NOT NULL DEFAULT 'running'
+                CHECK (status IN ('running','completed','halted_no_credits','error')),
+  ingested    INT, reviewed INT, included INT, excluded INT, unknown INT,
+  errors      INT, backlog  INT,
+  notes       TEXT
+);
+CREATE INDEX idx_discovery_runs_started_at ON discovery_runs (started_at DESC);
+
+-- singleton row tracking global discovery state (e.g. credit exhaustion)
+CREATE TABLE discovery_state (
+  id                  BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
+  halted_no_credits   BOOLEAN NOT NULL DEFAULT FALSE,
+  resume_requested_at TIMESTAMPTZ,
+  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
+);
+INSERT INTO discovery_state (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;
+
+-- one prepared application package per (user, job); re-preparing upserts in place.
+-- Persists the tailored résumé/cover letter so the board stops regenerating on every
+-- click, plus (Greenhouse only) the fetched question schema and the LLM-prefilled
+-- answers for the posting. user_id mirrors auth.users(id) with no FK (see profiles).
+CREATE TABLE application_packages (
+  id                   SERIAL PRIMARY KEY,
+  user_id              UUID NOT NULL,
+  job_id               TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
+  resume_json          JSONB,                 -- TailoredResume (NULL until generated)
+  cover_letter_json    JSONB,                 -- TailoredCoverLetter (NULL until generated)
+  answers_snapshot     JSONB,                 -- reusable profile answers at prepare time
+  greenhouse_questions JSONB,                 -- parsed GH question schema (NULL = not GH / fetch failed)
+  prefilled_answers    JSONB,                 -- [{ question, answer }] mapped by the LLM (NULL = none)
+  apply_url            TEXT,
+  resume_trace_id      TEXT,
+  cover_letter_trace_id TEXT,
+  resume_instructions             TEXT,  -- per-job "Generation instructions" (résumé leg)
+  cover_letter_instructions       TEXT,  -- per-job "Generation instructions" (cover-letter leg)
+  resume_instructions_draft       TEXT,  -- saved draft of the résumé instructions box (survives reload; NULL = mirror generated-with)
+  cover_letter_instructions_draft TEXT,  -- saved draft of the cover-letter instructions box
+  profile_version      TEXT,                  -- profiles.profile_version at generation time (NULL = pre-column row)
+  status               TEXT NOT NULL DEFAULT 'prepared'
+                         CHECK (status IN ('prepared','applied')),
+  prepared_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
+  applied_at           TIMESTAMPTZ,
+  CONSTRAINT applied_iff_timestamp CHECK ((status = 'applied') = (applied_at IS NOT NULL)),
+  UNIQUE (user_id, job_id)
+);
+-- FK-cascade lookup index (job_id-leading) for cascade deletes from jobs.
+CREATE INDEX idx_application_packages_job ON application_packages (job_id);
+
+-- Résumé-generation eval golden dataset (see migrations/2026-07-02-resume-scores.sql).
+CREATE TABLE resume_scores (
+  user_id          UUID NOT NULL,
+  job_id           TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
+  grounding        INT  CHECK (grounding    BETWEEN 1 AND 5),
+  jd_relevance     INT  CHECK (jd_relevance BETWEEN 1 AND 5),
+  comment          TEXT,
+  resume_trace_id  TEXT,
+  resume_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,
+  model            TEXT,
+  scored_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
+  PRIMARY KEY (user_id, job_id)
+);
+CREATE INDEX idx_resume_scores_user ON resume_scores (user_id);
+
+-- Cover-letter edit overlay (see migrations/2026-07-07-cover-letter-edits.sql).
+CREATE TABLE cover_letter_edits (
+  user_id               UUID NOT NULL,
+  job_id                TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
+  edited_text           TEXT NOT NULL,
+  original_text         TEXT,
+  cover_letter_trace_id TEXT,
+  model                 TEXT,
+  comment               TEXT,
+  superseded_at         TIMESTAMPTZ,
+  edited_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
+  PRIMARY KEY (user_id, job_id)
+);
+CREATE INDEX idx_cover_letter_edits_user ON cover_letter_edits (user_id);
+CREATE INDEX idx_cover_letter_edits_job ON cover_letter_edits (job_id);
+
+-- Multi-tenant foundation (see migrations/2026-07-03-multitenant-foundation.sql).
+-- Invite-gated signup: invite_codes + invite_redemptions are the server-side source
+-- of truth for "this account was invited" (user_metadata is client-settable and must
+-- NOT be trusted).
+CREATE TABLE invite_codes (
+  code       TEXT PRIMARY KEY,
+  note       TEXT,
+  max_uses   INT NOT NULL DEFAULT 1,
+  uses       INT NOT NULL DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses),
+  expires_at TIMESTAMPTZ,
+  -- NULL = operator/admin-minted. Named created_by, NOT the account-id column the erasure
+  -- drift guards + deletion loop key on, deliberately: erasure here is a custom ANONYMIZE
+  -- (see 2026-07-13-user-invites.sql), never that per-account DELETE. (This comment avoids
+  -- the literal column-name token on purpose: the drift guard scans CREATE TABLE bodies
+  -- for it, and this table has no such column — mentioning it here would false-positive.)
+  created_by      UUID,
+  -- Recorded for emailed invites (bookkeeping only — redemption does not enforce it).
+  recipient_email TEXT,
+  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
+);
+
+-- One redemption per email — the trusted proof an account was invited.
+CREATE TABLE invite_redemptions (
+  email       TEXT NOT NULL,
+  code        TEXT NOT NULL REFERENCES invite_codes(code),
+  user_id     UUID,
+  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  PRIMARY KEY (email)
+);
+
+-- Per-user, per-day usage counters. kind='review' backs the reviewer's rolling
+-- daily budget; generation kinds arrive in Phase 1. "Reset at midnight" falls out
+-- of the (user_id, day) key — no cron.
+CREATE TABLE usage_counters (
+  user_id UUID NOT NULL,
+  day     DATE NOT NULL,
+  kind    TEXT NOT NULL,
+  n       INT  NOT NULL DEFAULT 0,
+  PRIMARY KEY (user_id, day, kind)
+);
+
+-- Billing (see migrations/2026-07-03-billing-review-requests.sql). Local mirror of
+-- Stripe truth, keyed by user_id; the Stripe webhook (service role) is the sole
+-- writer. No FK to auth.users (house convention, see profiles).
+CREATE TABLE subscriptions (
+  user_id                UUID PRIMARY KEY,
+  stripe_customer_id     TEXT UNIQUE,
+  stripe_subscription_id TEXT,
+  plan                   TEXT CHECK (plan IN ('standard','pro')),
+  status                 TEXT NOT NULL,             -- raw Stripe status string
+  current_period_end     TIMESTAMPTZ,
+  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT FALSE,
+  last_event_at          TIMESTAMPTZ,               -- Stripe event.created watermark (M-WEBHOOK-ORDER)
+  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
+  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
+);
+
+-- On-demand "review my board now" queue, shared by the dashboard (enqueue) and the
+-- reviewer worker (claim + status transition). One active request per user.
+CREATE TABLE review_requests (
+  id           BIGSERIAL PRIMARY KEY,
+  user_id      UUID NOT NULL,
+  status       TEXT NOT NULL DEFAULT 'pending'
+                 CHECK (status IN ('pending','running','done','failed')),
+  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  started_at   TIMESTAMPTZ,
+  finished_at  TIMESTAMPTZ,
+  notes        TEXT
+);
+CREATE UNIQUE INDEX one_active_review_request
+  ON review_requests (user_id) WHERE status IN ('pending','running');
+CREATE INDEX idx_review_requests_pending
+  ON review_requests (requested_at) WHERE status = 'pending';
+
+-- DB-overridable tier settings (see migrations/2026-07-04-tier-settings.sql). ONE
+-- jsonb config row per plan that OVERLAYS the compiled entitlement/price defaults
+-- field-by-field (dashboard/lib/tierConfig.ts, reviewer.db.load_tier_settings) so
+-- caps/allowances/prices are tunable WITHOUT a redeploy. Shared operator policy (not
+-- per-user); empty by default = use the compiled defaults everywhere.
+CREATE TABLE tier_settings (
+  plan       TEXT PRIMARY KEY CHECK (plan IN ('standard','pro')),
+  config     JSONB NOT NULL DEFAULT '{}'::jsonb,
+  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
+);
+
+-- User-sent invites (see migrations/2026-07-13-user-invites.sql). The invite_codes
+-- attribution columns (created_by, recipient_email) live in that table above; the RLS
+-- enable/policies/GRANTs for the two tables below sit in the RLS section further down
+-- (they reference public.app_user_id()/the anon+authenticated roles, which are only
+-- defined there — schema.sql builds top-to-bottom on a DROP SCHEMA'd DB).
+
+-- Sender-scoped lookups (deletion scrub, export of "codes I minted").
+CREATE INDEX idx_invite_codes_created_by
+  ON invite_codes (created_by) WHERE created_by IS NOT NULL;
+
+-- Per-user invite budget. Rows are lazy-created on first invite action with the
+-- then-current default (app_settings.invite_default_allowance); `granted` records the
+-- initial grant. Service-write-only (dashboard/lib/invites.ts); the owner may only
+-- SELECT their own count.
+CREATE TABLE invite_allowances (
+  user_id    UUID PRIMARY KEY,
+  remaining  INT NOT NULL CHECK (remaining >= 0),
+  granted    INT NOT NULL,
+  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
+);
+
+-- Operator-pinned effective tier (see migrations/2026-07-16-plan-overrides.sql).
+-- An ACTIVE row (expires_at NULL or future) wins over subscription + invite comp in
+-- resolvePlan/resolve_plan. Service-write-only; owner may SELECT their own pin.
+CREATE TABLE plan_overrides (
+  user_id    UUID PRIMARY KEY,
+  plan       TEXT NOT NULL CHECK (plan IN ('standard','pro')),
+  expires_at TIMESTAMPTZ,          -- NULL = pinned until cleared
+  note       TEXT,                 -- operator memo ("comped for feedback")
+  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
+);
+
+-- Generic operator key-value config (deliberately separate from tier_settings, whose PK
+-- is CHECK-constrained to plan names). Shared operator RLS like tier_settings; ALL writes
+-- are service-role (admin-gated dashboard/lib/appSettings.ts).
+CREATE TABLE app_settings (
+  key        TEXT PRIMARY KEY,
+  value      JSONB NOT NULL,
+  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
+);
+
+-- Account-deletion erasure ledger (see migrations/2026-07-04-account-deletions.sql).
+-- One row per deleted account, keyed by user_id, with a HASH of the email (never
+-- plaintext) as tamper-evident proof of erasure. Written by the deletion cascade
+-- (dashboard/lib/accountDeletion.ts) via the service role; users never read it.
+CREATE TABLE account_deletions (
+  user_id    UUID PRIMARY KEY,
+  email_hash TEXT,
+  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
+);
+
+-- OpenRouter spend-alert snapshots (see migrations/2026-07-04-openrouter-usage-snapshots.sql).
+-- observability.spend_alert (Railway cron) records total_usage/total_credits here and
+-- differences the trailing-24h window to compute burn. Service-role only.
+CREATE TABLE openrouter_usage_snapshots (
+  taken_at      TIMESTAMPTZ PRIMARY KEY DEFAULT now(),
+  total_usage   NUMERIC NOT NULL,
+  total_credits NUMERIC
+);
+
+-- Async generation tracking (see migrations/2026-07-05-generation-jobs.sql). The
+-- generate routes 202 immediately and settle the row from a background `after()`
+-- callback; the dashboard polls GET /api/generations for completion toasts.
+-- `error` holds the USER-SAFE failure/partial-failure message. kind='prepare' is
+-- the multi-leg prepare tracked as one row.
+CREATE TABLE generation_jobs (
+  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  user_id    UUID NOT NULL,
+  job_id     TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
+  -- kind='prepare' backs the Greenhouse "Prefill application" action (user-facing
+  -- label is "Prefill"; the internal identifier stays 'prepare' to avoid a
+  -- kind-constraint migration + dual-value transition). See the /api/application/prepare route.
+  kind       TEXT NOT NULL CHECK (kind IN ('resume','cover','prepare')),
+  status     TEXT NOT NULL DEFAULT 'pending'
+               CHECK (status IN ('pending','ready','failed')),
+  error      TEXT,
+  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
+);
+-- FK-cascade lookup index (job_id-leading) for cascade deletes from jobs.
+CREATE INDEX idx_generation_jobs_job ON generation_jobs (job_id);
+-- Poll query: the viewer's pending rows + recently-settled rows.
+CREATE INDEX idx_generation_jobs_user ON generation_jobs (user_id, status);
+-- One in-flight generation per (user, job, kind); settled rows don't block a rerun.
+CREATE UNIQUE INDEX one_pending_generation
+  ON generation_jobs (user_id, job_id, kind) WHERE status = 'pending';
+
+-- Applied-migrations ledger. Record each migration with:
+--   INSERT INTO schema_migrations (filename) VALUES ('<file>');
+-- when applied. Every new migration must be idempotent, transactional where
+-- possible, and recorded here so the applied set is auditable.
+CREATE TABLE IF NOT EXISTS schema_migrations (
+  filename   TEXT PRIMARY KEY,
+  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
+);
+
+-- Row-level security. The app and reviewer connect via a privileged DIRECT connection
+-- (DATABASE_URL) that bypasses RLS; nothing is served through the anon/PostgREST API.
+-- Each table gets RLS enabled plus one explicit permissive deny-all policy so the
+-- "no API access; served server-side" intent is declarative and Supabase's
+-- rls_enabled_no_policy advisor (lint 0008) stays clear. Portable to plain Postgres:
+-- no Supabase-specific roles or auth.* functions, and test queries run as a superuser
+-- that bypasses RLS. Mirrors migrations/2026-06-26-rls-deny-all-policies.sql.
+ALTER TABLE companies    ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON companies   FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE jobs         ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON jobs        FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE poll_runs    ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON poll_runs   FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON profiles    FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE job_reviews  ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON job_reviews FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE review_runs      ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON review_runs      FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE company_reviews  ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON company_reviews  FOR ALL USING (false) WITH CHECK (false);
+-- See migrations/2026-07-21-company-classification.sql. classification_jobs is service-only
+-- (deny-all is its whole contract); company_overrides also gets owner_access further down.
+ALTER TABLE classification_jobs ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON classification_jobs FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE company_overrides   ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON company_overrides   FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE discovery_runs   ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON discovery_runs   FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE discovery_state  ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON discovery_state  FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE application_packages ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON application_packages FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE resume_scores        ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON resume_scores        FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE cover_letter_edits   ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON cover_letter_edits   FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE review_corrections   ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON review_corrections   FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE schema_migrations    ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON schema_migrations    FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE invite_codes         ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON invite_codes         FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE invite_redemptions   ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON invite_redemptions   FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE usage_counters       ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON usage_counters       FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE subscriptions        ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON subscriptions        FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE review_requests      ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON review_requests      FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE tier_settings        ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON tier_settings        FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE account_deletions    ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON account_deletions    FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE openrouter_usage_snapshots ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON openrouter_usage_snapshots FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE generation_jobs      ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON generation_jobs      FOR ALL USING (false) WITH CHECK (false);
+-- See migrations/2026-07-13-user-invites.sql.
+ALTER TABLE invite_allowances    ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON invite_allowances    FOR ALL USING (false) WITH CHECK (false);
+-- See migrations/2026-07-16-plan-overrides.sql.
+ALTER TABLE plan_overrides       ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON plan_overrides       FOR ALL USING (false) WITH CHECK (false);
+ALTER TABLE app_settings         ENABLE ROW LEVEL SECURITY;
+CREATE POLICY no_anon_access ON app_settings         FOR ALL USING (false) WITH CHECK (false);
+
+-- ── Phase-1 tenant isolation (mirrors migrations/2026-07-03-rls-tenant-isolation.sql
+-- + the per-user policies of 2026-07-03-billing-review-requests.sql) ────────────
+-- Real per-user RLS with teeth. The dashboard drops into the `authenticated` role
+-- per-transaction (SET LOCAL ROLE + request.jwt.claims); public.app_user_id() reads
+-- the JWT `sub` out of that GUC. The privileged `postgres`/service role OWNS these
+-- tables and bypasses RLS, so the reviewer, pollers, discovery, the Stripe webhook,
+-- and the invite path are unaffected. The deny-all policies above OR harmlessly with
+-- these permissive ones. Roles are DO-guarded so schema.sql loads on plain Postgres
+-- (the test DB), where the roles survive DROP SCHEMA public CASCADE (cluster-level).
+DO $$
+BEGIN
+  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
+    CREATE ROLE anon NOLOGIN;
+  END IF;
+  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
+    CREATE ROLE authenticated NOLOGIN;
+  END IF;
+END
+$$;
+GRANT USAGE ON SCHEMA public TO anon, authenticated;
+
+-- search_path pinned (mirrors migrations/2026-07-05-app-user-id-search-path.sql): this
+-- SECURITY-critical RLS resolver touches only pg_catalog built-ins, so pinning it to
+-- pg_catalog fixes the function_search_path_mutable advisor while leaving behaviour
+-- identical.
+CREATE OR REPLACE FUNCTION public.app_user_id() RETURNS uuid
+LANGUAGE plpgsql STABLE SET search_path = pg_catalog AS $$
+DECLARE
+  claims text;
+  sub    text;
+BEGIN
+  claims := current_setting('request.jwt.claims', true);
+  IF claims IS NULL OR claims = '' THEN
+    RETURN NULL;
+  END IF;
+  sub := (claims::json ->> 'sub');
+  IF sub IS NULL OR sub = '' THEN
+    RETURN NULL;
+  END IF;
+  RETURN sub::uuid;
+EXCEPTION WHEN others THEN
+  RETURN NULL;
+END;
+$$;
+
+-- Owner policies (SELECT/INSERT/UPDATE/DELETE own rows only).
+CREATE POLICY owner_access ON profiles FOR ALL TO authenticated
+  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
+CREATE POLICY owner_access ON job_reviews FOR ALL TO authenticated
+  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
+CREATE POLICY owner_access ON review_corrections FOR ALL TO authenticated
+  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
+CREATE POLICY owner_access ON company_reviews FOR ALL TO authenticated
+  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
+CREATE POLICY owner_access ON application_packages FOR ALL TO authenticated
+  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
+CREATE POLICY owner_access ON resume_scores FOR ALL TO authenticated
+  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
+CREATE POLICY owner_access ON cover_letter_edits FOR ALL TO authenticated
+  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
+CREATE POLICY owner_access ON usage_counters FOR ALL TO authenticated
+  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
+CREATE POLICY owner_access ON generation_jobs FOR ALL TO authenticated
+  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
+-- Per-user company include/exclude (2026-07-21-company-classification): owner CRUD.
+CREATE POLICY owner_access ON company_overrides FOR ALL TO authenticated
+  USING (user_id = (SELECT public.app_user_id())) WITH CHECK (user_id = (SELECT public.app_user_id()));
+-- Per-user invite budget: owner may READ their own count; writes are service-role
+-- (dashboard/lib/invites.ts). See migrations/2026-07-13-user-invites.sql.
+CREATE POLICY owner_read ON invite_allowances FOR SELECT TO authenticated
+  USING (user_id = (SELECT public.app_user_id()));
+-- Operator-pinned effective tier: owner may READ their own pin; writes are service-role
+-- (dashboard/lib/planOverrides.ts). See migrations/2026-07-16-plan-overrides.sql.
+CREATE POLICY owner_read ON plan_overrides FOR SELECT TO authenticated
+  USING (user_id = (SELECT public.app_user_id()));
+
+-- Shared-read policies (global corpus + pipeline accounting).
+CREATE POLICY shared_read ON jobs      FOR SELECT TO anon, authenticated USING (true);
+CREATE POLICY shared_read ON companies FOR SELECT TO anon, authenticated USING (true);
+-- job_questions: shared like jobs/companies (poll-time Greenhouse question schema);
+-- writes are poller/service-role only (no anon/authenticated write grant below).
+ALTER TABLE job_questions ENABLE ROW LEVEL SECURITY;
+CREATE POLICY shared_read ON job_questions FOR SELECT TO anon, authenticated USING (true);
+CREATE POLICY shared_read ON poll_runs       FOR SELECT TO authenticated USING (true);
+CREATE POLICY shared_read ON discovery_runs  FOR SELECT TO authenticated USING (true);
+CREATE POLICY shared_read ON discovery_state FOR SELECT TO authenticated USING (true);
+CREATE POLICY owner_or_legacy_read ON review_runs FOR SELECT TO authenticated
+  USING (user_id = (SELECT public.app_user_id()) OR user_id IS NULL);
+
+-- Billing per-user policies (webhook/worker keep the service role).
+CREATE POLICY owner_read ON subscriptions FOR SELECT TO authenticated
+  USING (user_id = (SELECT public.app_user_id()));
+CREATE POLICY owner_read ON review_requests FOR SELECT TO authenticated
+  USING (user_id = (SELECT public.app_user_id()));
+CREATE POLICY owner_insert ON review_requests FOR INSERT TO authenticated
+  WITH CHECK (user_id = (SELECT public.app_user_id()));
+
+-- Tier settings: shared operator policy (not per-user). Writes are service-role only.
+CREATE POLICY shared_read ON tier_settings FOR SELECT TO anon, authenticated USING (true);
+-- app_settings: shared operator config, same shape as tier_settings (values non-secret).
+-- Writes are service-role only. See migrations/2026-07-13-user-invites.sql.
+CREATE POLICY shared_read ON app_settings FOR SELECT TO anon, authenticated USING (true);
+
+-- Grants (table privilege is the outer gate; RLS filters within — a granted table
+-- with no matching policy returns zero rows, not permission-denied). This block is a
+-- positive ALLOWLIST: it first strips every default anon/authenticated privilege
+-- (Supabase grants full arwdDxt by default) so a slipped RLS policy is not the only
+-- gate, then re-grants exactly what each role needs. Mirrors
+-- migrations/2026-07-04-cost-cap-hardening.sql (finding B-COST).
+REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
+REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
+
+GRANT SELECT ON jobs, companies, poll_runs, discovery_runs, discovery_state, review_runs
+  TO authenticated;
+-- Owner-scoped CRUD (usage_counters excluded — SELECT-only for users; writes are
+-- service-role only, so a user cannot zero their own review/generation counters).
+GRANT SELECT, INSERT, UPDATE, DELETE ON
+  job_reviews, review_corrections, company_reviews, application_packages, resume_scores,
+  cover_letter_edits, company_overrides
+  TO authenticated;
+-- generation_jobs: owner-scoped CRUD (DELETE backs the per-user housekeeping prune of
+-- old settled rows). Cost integrity is unaffected: allowance charges live in
+-- usage_counters (SELECT-only above) and status rows never drive refunds server-side.
+GRANT SELECT, INSERT, UPDATE, DELETE ON generation_jobs TO authenticated;
+GRANT SELECT ON usage_counters TO authenticated;
+-- profiles: full user control EXCEPT the operator-only cost lever daily_review_cap.
+-- INSERT/UPDATE are column-level over every column but daily_review_cap. (A bare
+-- REVOKE UPDATE (daily_review_cap) would NOT work: a table-level UPDATE grant is not
+-- affected by a column-level revoke — the column stays writable. So we grant only the
+-- allowed columns.) Keep this list in sync with the profiles table when a column is
+-- ADDED (new columns default to non-user-writable — the safe direction).
+GRANT SELECT, DELETE ON profiles TO authenticated;
+GRANT INSERT (user_id, resume_text, resume_file_path, instructions, model_stage1,
+              model_stage2, preferred_locations, model_resume, company_instructions,
+              company_profile_version, model_company, board_filters, company_exclusions,
+              full_name, email,
+              phone, links, location, work_authorized, needs_sponsorship, eeo_gender,
+              eeo_race, eeo_veteran, eeo_disability, screening_answers, model_cover,
+              reasoning_effort_resume, reasoning_effort_cover,
+              resume_generation_instructions, cover_letter_generation_instructions,
+              profile_version, updated_at)
+  ON profiles TO authenticated;
+GRANT UPDATE (resume_text, resume_file_path, instructions, model_stage1,
+              model_stage2, preferred_locations, model_resume, company_instructions,
+              company_profile_version, model_company, board_filters, company_exclusions,
+              full_name, email,
+              phone, location, links, work_authorized, needs_sponsorship, eeo_gender,
+              eeo_race, eeo_veteran, eeo_disability, screening_answers, model_cover,
+              reasoning_effort_resume, reasoning_effort_cover,
+              resume_generation_instructions, cover_letter_generation_instructions,
+              profile_version, updated_at)
+  ON profiles TO authenticated;
+GRANT SELECT ON subscriptions TO authenticated;
+GRANT SELECT, INSERT ON review_requests TO authenticated;
+GRANT USAGE ON SEQUENCE application_packages_id_seq TO authenticated;
+GRANT USAGE ON SEQUENCE review_requests_id_seq TO authenticated;
+-- anon reads the public board + gets SELECT (no policy → zero rows) on the two
+-- review tables getJobReviewDetail LEFT JOINs so its anon query isn't denied.
+GRANT SELECT ON jobs, companies, job_reviews, review_corrections TO anon;
+-- Tier settings: shared operator config read by the dashboard (withAnonSql) + reviewer.
+GRANT SELECT ON tier_settings TO anon, authenticated;
+-- job_questions: shared read for the board/Prefill route; writes are poller/service-role only.
+GRANT SELECT ON job_questions TO anon, authenticated;
+-- invite_allowances: owner reads own count (writes service-role). app_settings: shared
+-- operator config read (writes service-role). See migrations/2026-07-13-user-invites.sql.
+GRANT SELECT ON invite_allowances TO authenticated;
+-- plan_overrides: owner reads own pin (writes service-role). See
+-- migrations/2026-07-16-plan-overrides.sql.
+GRANT SELECT ON plan_overrides TO authenticated;
+GRANT SELECT ON app_settings TO anon, authenticated;
+
+-- Default-privilege deny (mirrors migrations/2026-07-05-default-privileges-revoke.sql,
+-- finding minor 6): the REVOKE above only touches tables that exist NOW. Strip the
+-- default anon/authenticated grant for FUTURE tables + sequences too, so a new table
+-- starts deny-by-default and its creating migration must explicitly grant the intended
+-- subset (the safe direction). Owner (postgres/service role) bypasses grants + RLS.
+ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
+ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
+
+-- Storage RLS (résumé bucket) is NOT represented here: the `storage` schema is
+-- Supabase-managed and does not exist in the plain-Postgres test DB this file
+-- builds. Per-prefix tenant isolation for `storage.objects` (bucket `resumes`,
+-- finding B-STORAGE) lives in migrations/2026-07-04-resume-bucket-storage-policies.sql
+-- and MUST be applied to the live Supabase project + live cross-account verified
+-- (see that file's header). tests/test_resume_storage_policies.py proves the policy
+-- predicate against a faithful in-DB mock of the storage/auth schema.
+
+
+-- BEGIN mirrored 2026-10-02-matching-activity.sql
+-- Existing users receive a seven-day rollout grace period. No historical GET,
+-- last login, profile updated_at or background job is treated as meaningful activity.
+CREATE TABLE IF NOT EXISTS matching_activity (
+  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
+  last_meaningful_at timestamptz NOT NULL DEFAULT now(),
+  paused_at timestamptz
+);
+ALTER TABLE matching_activity ENABLE ROW LEVEL SECURITY;
+DROP POLICY IF EXISTS owner_read ON matching_activity;
+CREATE POLICY owner_read ON matching_activity FOR SELECT TO authenticated
+  USING (user_id = public.app_user_id());
+REVOKE ALL ON matching_activity FROM PUBLIC, anon, authenticated;
+GRANT SELECT ON matching_activity TO authenticated;
+INSERT INTO matching_activity(user_id) SELECT user_id FROM profiles ON CONFLICT DO NOTHING;
+ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS resume_requested boolean NOT NULL DEFAULT false;
+-- Fences late completions after stale recovery/reclaim across worker processes.
+ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS claim_version bigint NOT NULL DEFAULT 0;
+
+-- Only the actual, non-trial paid subscription mirror qualifies. Align expiry's
+-- three-day grace with the existing entitlement resolver, ignoring comp/override tiers.
+CREATE OR REPLACE FUNCTION matching_paused(uid uuid) RETURNS boolean
+LANGUAGE sql VOLATILE SET search_path = public, pg_temp AS $$
+ SELECT NOT EXISTS (
+   SELECT 1 FROM subscriptions s WHERE s.user_id=uid AND s.plan IN ('standard','pro')
+     AND s.status='active' AND nullif(s.stripe_subscription_id,'') IS NOT NULL
+     AND s.current_period_end + interval '3 days' > clock_timestamp()
+ ) AND EXISTS (
+   SELECT 1 FROM matching_activity a WHERE a.user_id=uid
+     AND (a.paused_at IS NOT NULL OR a.last_meaningful_at <= clock_timestamp()-interval '7 days')
+ )
+$$;
+-- Supabase defaults grant EXECUTE directly to anon/authenticated as well as
+-- PUBLIC. Reset all client grants; retain existing service_role backend access.
+REVOKE ALL ON FUNCTION matching_paused(uuid) FROM PUBLIC, anon, authenticated;
+GRANT EXECUTE ON FUNCTION matching_paused(uuid) TO authenticated;
+
+CREATE OR REPLACE FUNCTION track_matching_activity() RETURNS trigger
+LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
+DECLARE actor uuid := CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
+BEGIN
+ IF TG_TABLE_NAME='profiles' AND TG_OP='INSERT' THEN
+   INSERT INTO matching_activity(user_id) VALUES(NEW.user_id) ON CONFLICT DO NOTHING;
+ ELSIF current_setting('role',true)='authenticated' AND actor=public.app_user_id()
+       AND NOT EXISTS(SELECT 1 FROM account_deletions WHERE user_id=actor) THEN
+   -- Preserve the expiry BEFORE advancing activity. Only explicit resume clears it.
+   UPDATE matching_activity SET
+     paused_at=CASE WHEN public.matching_paused(actor) THEN coalesce(paused_at,clock_timestamp()) ELSE paused_at END,
+     last_meaningful_at=clock_timestamp() WHERE user_id=actor;
+ END IF;
+ RETURN NEW;
+END
+$$;
+-- Trigger execution needs no caller EXECUTE grant; this is not a client RPC.
+REVOKE ALL ON FUNCTION track_matching_activity() FROM PUBLIC, anon, authenticated;
+DROP TRIGGER IF EXISTS initialize_matching_activity ON profiles;
+CREATE TRIGGER initialize_matching_activity AFTER INSERT ON profiles
+ FOR EACH ROW EXECUTE FUNCTION track_matching_activity();
+-- Deliberate saved profile/preferences changes; no generic updated_at trigger.
+-- board_filters is excluded: pagehide beacons can persist it without a user edit.
+DROP TRIGGER IF EXISTS profile_matching_activity ON profiles;
+CREATE TRIGGER profile_matching_activity AFTER UPDATE OF resume_text,instructions,
+ preferred_locations,company_exclusions,company_instructions,
+ full_name,email,phone,links,location,screening_answers,
+ resume_generation_instructions,cover_letter_generation_instructions ON profiles
+ FOR EACH ROW WHEN (OLD IS DISTINCT FROM NEW) EXECUTE FUNCTION track_matching_activity();
+DROP TRIGGER IF EXISTS correction_matching_activity ON review_corrections;
+CREATE TRIGGER correction_matching_activity AFTER INSERT ON review_corrections
+ FOR EACH ROW EXECUTE FUNCTION track_matching_activity();
+DROP TRIGGER IF EXISTS company_override_matching_activity ON company_overrides;
+CREATE TRIGGER company_override_matching_activity AFTER INSERT OR UPDATE ON company_overrides
+ FOR EACH ROW EXECUTE FUNCTION track_matching_activity();
+
+-- Only manual verdict changes and applied-state transitions count; generated
+-- package content and automatic AI reviews never advance the activity clock.
+DROP TRIGGER IF EXISTS reject_insert_matching_activity ON job_reviews;
+CREATE TRIGGER reject_insert_matching_activity AFTER INSERT ON job_reviews
+ FOR EACH ROW WHEN (NEW.human_override) EXECUTE FUNCTION track_matching_activity();
+DROP TRIGGER IF EXISTS reject_update_matching_activity ON job_reviews;
+CREATE TRIGGER reject_update_matching_activity AFTER UPDATE OF human_override,verdict ON job_reviews
+ FOR EACH ROW WHEN ((OLD.human_override OR NEW.human_override) AND OLD IS DISTINCT FROM NEW)
+ EXECUTE FUNCTION track_matching_activity();
+DROP TRIGGER IF EXISTS applied_insert_matching_activity ON application_packages;
+CREATE TRIGGER applied_insert_matching_activity AFTER INSERT ON application_packages
+ FOR EACH ROW WHEN (NEW.status='applied') EXECUTE FUNCTION track_matching_activity();
+DROP TRIGGER IF EXISTS applied_update_matching_activity ON application_packages;
+CREATE TRIGGER applied_update_matching_activity AFTER UPDATE OF status ON application_packages
+ FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND (OLD.status='applied' OR NEW.status='applied'))
+ EXECUTE FUNCTION track_matching_activity();
+DROP TRIGGER IF EXISTS applied_delete_matching_activity ON application_packages;
+CREATE TRIGGER applied_delete_matching_activity AFTER DELETE ON application_packages
+ FOR EACH ROW WHEN (OLD.status='applied') EXECUTE FUNCTION track_matching_activity();
+
+-- Serialize resume calls on this user's activity row. Queue insertion and state
+-- change commit together; RLS is supplemented with a checked server JWT identity.
+CREATE OR REPLACE FUNCTION resume_matching() RETURNS TABLE(status text, existing boolean)
+LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
+DECLARE uid uuid := public.app_user_id(); was_paused boolean; req review_requests%ROWTYPE;
+BEGIN
+ IF uid IS NULL OR EXISTS(SELECT 1 FROM account_deletions WHERE user_id=uid) THEN
+   RAISE EXCEPTION 'sign in' USING ERRCODE='42501';
+ END IF;
+ PERFORM 1 FROM matching_activity WHERE user_id=uid FOR UPDATE;
+ IF NOT FOUND THEN RAISE EXCEPTION 'profile required' USING ERRCODE='42501'; END IF;
+ -- Inspect stored pause/expiry, not the paid exemption: billing may have
+ -- activated after the running worker already skipped this paused account.
+ SELECT paused_at IS NOT NULL OR last_meaningful_at <= clock_timestamp()-interval '7 days'
+ INTO was_paused FROM matching_activity WHERE user_id=uid;
+ UPDATE matching_activity SET last_meaningful_at=clock_timestamp(),paused_at=NULL WHERE user_id=uid;
+ INSERT INTO review_requests(user_id) VALUES(uid)
+ ON CONFLICT (user_id) WHERE review_requests.status IN ('pending','running') DO NOTHING
+ RETURNING * INTO req;
+ IF FOUND THEN RETURN QUERY SELECT req.status,false; RETURN; END IF;
+ -- The worker might finish between conflict detection and this row lock. Retry
+ -- insertion if so; never return a synthetic pending success without durable work.
+ SELECT * INTO req FROM review_requests WHERE user_id=uid AND review_requests.status IN ('pending','running') FOR UPDATE;
+ IF NOT FOUND THEN
+   INSERT INTO review_requests(user_id) VALUES(uid) RETURNING * INTO req;
+   RETURN QUERY SELECT req.status,false; RETURN;
+ END IF;
+ IF was_paused AND req.status='running' THEN
+   UPDATE review_requests SET resume_requested=true WHERE id=req.id;
+ END IF;
+ RETURN QUERY SELECT req.status,true;
+END
+$$;
+REVOKE ALL ON FUNCTION resume_matching() FROM PUBLIC, anon, authenticated;
+GRANT EXECUTE ON FUNCTION resume_matching() TO authenticated;
+
+INSERT INTO schema_migrations(filename) VALUES ('2026-10-02-matching-activity.sql') ON CONFLICT DO NOTHING;
+-- END mirrored 2026-10-02-matching-activity.sql
+
+
+-- BEGIN mirrored 2026-10-02-feedback.sql
+-- Authenticated feedback: owner export reads; all writes go through the bounded RPC.
+-- Requires tenant-isolation identity helper and account-deletions migration.
+CREATE TABLE IF NOT EXISTS public.feedback (
+  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+  user_id uuid NOT NULL,
+  kind text NOT NULL CHECK (kind IN ('issue', 'criticism', 'feature_request')),
+  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 4000),
+  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
+);
+CREATE INDEX IF NOT EXISTS feedback_user_created_idx ON public.feedback (user_id, created_at DESC);
+ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON public.feedback FROM PUBLIC, anon, authenticated;
+REVOKE ALL ON SEQUENCE public.feedback_id_seq FROM PUBLIC, anon, authenticated;
+GRANT SELECT ON public.feedback TO authenticated;
+DROP POLICY IF EXISTS feedback_owner_read ON public.feedback;
+CREATE POLICY feedback_owner_read ON public.feedback FOR SELECT TO authenticated
+  USING (user_id = (SELECT public.app_user_id()));
+CREATE OR REPLACE FUNCTION public.submit_feedback(p_kind text, p_message text)
+RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
+SET search_path = pg_catalog, public
+AS $$
+DECLARE caller uuid := public.app_user_id();
+BEGIN
+  IF caller IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
+  -- A fresh post-lock snapshot prevents stale-snapshot rate bypasses.
+  IF current_setting('transaction_isolation') <> 'read committed' THEN
+    RAISE EXCEPTION 'read committed required' USING ERRCODE = '25000';
+  END IF;
+  IF p_kind IS NULL OR p_kind NOT IN ('issue','criticism','feature_request')
+     OR p_message IS NULL OR char_length(p_message) > 4000
+     OR p_message !~ '[^[:space:]]' THEN
+    RAISE EXCEPTION 'invalid feedback' USING ERRCODE = '22023';
+  END IF;
+  PERFORM pg_advisory_xact_lock(hashtextextended('feedback:' || caller::text, 0));
+  IF EXISTS (SELECT 1 FROM public.account_deletions WHERE user_id = caller) THEN
+    RAISE EXCEPTION 'account deleted' USING ERRCODE = '42501';
+  END IF;
+  IF (SELECT count(*) FROM public.feedback WHERE user_id = caller
+      AND created_at > clock_timestamp() - interval '1 hour') >= 5 THEN
+    RAISE EXCEPTION 'feedback rate limit' USING ERRCODE = 'P0001';
+  END IF;
+  INSERT INTO public.feedback(user_id, kind, message) VALUES (caller, p_kind, btrim(p_message));
+END;
+$$;
+REVOKE ALL ON FUNCTION public.submit_feedback(text, text) FROM PUBLIC, anon, authenticated;
+GRANT EXECUTE ON FUNCTION public.submit_feedback(text, text) TO authenticated;
+INSERT INTO schema_migrations (filename) VALUES ('2026-10-02-feedback.sql') ON CONFLICT DO NOTHING;
+-- END mirrored 2026-10-02-feedback.sql
diff --git a/tests/lifecycle_helpers.py b/tests/lifecycle_helpers.py
new file mode 100644
index 0000000..63b18f1
--- /dev/null
+++ b/tests/lifecycle_helpers.py
@@ -0,0 +1,124 @@
+"""Test-only session, migration and complete public catalog parity helpers."""
+
+from pathlib import Path
+
+import psycopg
+from psycopg.rows import dict_row
+
+from tools.lifecycle_test_db import validate_test_connection, validate_test_dsn
+
+
+def open_sessions(dsn: str, count: int) -> list[psycopg.Connection]:
+    """Independent connections to the exact same throwaway public schema."""
+    validate_test_dsn(dsn)
+    if count < 1:
+        raise ValueError("session count must be positive")
+    sessions = []
+    try:
+        for _ in range(count):
+            session = psycopg.connect(dsn, row_factory=dict_row, connect_timeout=5)
+            sessions.append(session)
+            validate_test_connection(session)
+        return sessions
+    except BaseException:
+        for session in sessions:
+            session.close()
+        raise
+
+
+def bootstrap_schema(conn: psycopg.Connection, schema_sql: str) -> None:
+    validate_test_connection(conn)
+    try:
+        conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
+        conn.execute(schema_sql)
+        conn.commit()
+    except BaseException:
+        conn.rollback()
+        raise
+
+
+def apply_migrations(conn: psycopg.Connection, paths: list[Path]) -> None:
+    """Execute ordered additive SQL, including repeat runs; keep the repo ledger.
+
+Reapplication deliberately exercises SQL idempotence, rather than hiding unsafe
+migrations behind a ledger skip. Existing BEGIN/COMMIT files are supported.
+"""
+    validate_test_connection(conn)
+    for path in paths:
+        try:
+            conn.execute(path.read_text())
+            conn.execute(
+                "INSERT INTO schema_migrations(filename) VALUES (%s) ON CONFLICT DO NOTHING", (path.name,),
+            )
+            conn.commit()
+        except BaseException:
+            conn.rollback()
+            raise
+
+
+_CATALOG_QUERIES = {
+    "tables": """
+        SELECT c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
+               c.relreplident,c.reloptions,c.relacl::text
+        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
+        WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S') ORDER BY c.relname
+    """,
+    "columns": """
+        SELECT c.relname,a.attname,a.attnum,format_type(a.atttypid,a.atttypmod) AS type,
+               a.attnotnull,a.attidentity,a.attgenerated,a.attacl::text,
+               pg_get_expr(d.adbin,d.adrelid) AS default_expr
+        FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
+        JOIN pg_namespace n ON n.oid=c.relnamespace
+        LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
+        WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped
+          AND c.relkind IN ('r','p','v','m') ORDER BY c.relname,a.attnum
+    """,
+    "constraints": """
+        SELECT c.relname,k.conname,k.contype,k.convalidated,k.condeferrable,k.condeferred,
+               pg_get_constraintdef(k.oid,true) AS definition
+        FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
+        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
+        ORDER BY c.relname,k.conname
+    """,
+    "indexes": """
+        SELECT t.relname,i.relname AS index_name,x.indisvalid,x.indisready,
+               pg_get_indexdef(i.oid) AS definition
+        FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid
+        JOIN pg_class t ON t.oid=x.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
+        WHERE n.nspname='public' ORDER BY t.relname,i.relname
+    """,
+    "policies": """
+        SELECT tablename,policyname,permissive,roles,cmd,qual,with_check
+        FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname
+    """,
+    "functions": """
+        SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
+               pg_get_functiondef(p.oid) AS definition,p.proconfig,p.prosecdef,p.proacl::text
+        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
+        WHERE n.nspname='public' ORDER BY p.proname,arguments
+    """,
+    "triggers": """
+        SELECT c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,true) AS definition
+        FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
+        JOIN pg_namespace n ON n.oid=c.relnamespace
+        WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname
+    """,
+    "sequences": """
+        SELECT sequencename,data_type,start_value,min_value,max_value,increment_by,cycle,cache_size
+        FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename
+    """,
+    "schema_grants": """
+        SELECT nspacl::text FROM pg_namespace WHERE nspname='public'
+    """,
+    "default_grants": """
+        SELECT r.rolname,d.defaclobjtype,d.defaclacl::text FROM pg_default_acl d
+        JOIN pg_roles r ON r.oid=d.defaclrole JOIN pg_namespace n ON n.oid=d.defaclnamespace
+        WHERE n.nspname='public' ORDER BY r.rolname,d.defaclobjtype
+    """,
+}
+
+
+def schema_catalog(conn: psycopg.Connection) -> dict[str, list[dict]]:
+    """OID-free comparison including grants, RLS and function proconfig."""
+    validate_test_connection(conn)
+    return {name: conn.execute(sql).fetchall() for name, sql in _CATALOG_QUERIES.items()}
diff --git a/tests/test_lifecycle_migrations.py b/tests/test_lifecycle_migrations.py
new file mode 100644
index 0000000..7940e8e
--- /dev/null
+++ b/tests/test_lifecycle_migrations.py
@@ -0,0 +1,109 @@
+"""Freeze today's schema; rehearse all future additive migrations against it."""
+
+import hashlib
+import importlib
+import json
+from pathlib import Path
+
+import psycopg
+import pytest
+
+from tests.conftest import SCHEMA_SQL, requires_db
+
+ROOT = Path(__file__).resolve().parents[1]
+FROZEN = ROOT / "tests/fixtures/lifecycle/schema-before-lifecycle.sql"
+MANIFEST = FROZEN.with_suffix(".json")
+
+
+def helpers():
+    assert (ROOT / "tests/lifecycle_helpers.py").exists(), "migration helpers are absent"
+    return importlib.import_module("tests.lifecycle_helpers")
+
+
+def test_prechange_schema_is_frozen_with_complete_migration_manifest():
+    assert FROZEN.exists(), "pre-change schema fixture is absent"
+    manifest = json.loads(MANIFEST.read_text())
+    assert manifest["sha256"] == "fb9b20f4708e7f60d15fb36e0174aa3de4de5254ea6aedf8b27df10bb7e3b0d6"
+    assert hashlib.sha256(FROZEN.read_bytes()).hexdigest() == manifest["sha256"]
+    assert manifest["base_commit"] == "e1bdc5f840406c4bbc5c7b85976944d7f70f9c3d"
+    assert "2026-10-02-feedback.sql" in manifest["existing_migrations"]
+    assert "SET search_path = pg_catalog" in FROZEN.read_text()
+
+
+@requires_db
+def test_clean_schema_matches_frozen_baseline_plus_all_new_migrations(conn):
+    module = helpers()
+    clean = module.schema_catalog(conn)
+    manifest = json.loads(MANIFEST.read_text())
+    paths = sorted(
+        p for p in (ROOT / "migrations").glob("*.sql")
+        if p.name not in manifest["existing_migrations"]
+    )
+    module.bootstrap_schema(conn, FROZEN.read_text())
+    module.apply_migrations(conn, paths)
+    migrated = module.schema_catalog(conn)
+    assert migrated == clean
+    first_ledger = conn.execute("SELECT filename,applied_at FROM schema_migrations ORDER BY filename").fetchall()
+    module.apply_migrations(conn, paths)
+    assert module.schema_catalog(conn) == clean
+    assert conn.execute("SELECT filename,applied_at FROM schema_migrations ORDER BY filename").fetchall() == first_ledger
+
+
+@requires_db
+def test_existing_recorded_migrations_reapply_without_catalog_or_ledger_drift(conn):
+    module = helpers()
+    before = module.schema_catalog(conn)
+    ledger = conn.execute("SELECT filename,applied_at FROM schema_migrations ORDER BY filename").fetchall()
+    paths = [ROOT / "migrations" / row["filename"] for row in ledger]
+    assert paths, "schema.sql must record mirrored migrations"
+    module.apply_migrations(conn, paths)
+    module.apply_migrations(conn, paths)
+    assert module.schema_catalog(conn) == before
+    assert conn.execute("SELECT filename,applied_at FROM schema_migrations ORDER BY filename").fetchall() == ledger
+
+
+@requires_db
+def test_apply_migrations_is_ordered_recorded_and_rollback_safe(conn, tmp_path):
+    module = helpers()
+    first = tmp_path / "01-probe.sql"
+    first.write_text("BEGIN; CREATE TABLE IF NOT EXISTS lifecycle_probe(id integer PRIMARY KEY); COMMIT;")
+    second = tmp_path / "02-probe.sql"
+    second.write_text("INSERT INTO lifecycle_probe VALUES (1) ON CONFLICT DO NOTHING;")
+    module.apply_migrations(conn, [first, second])
+    module.apply_migrations(conn, [first, second])
+    assert conn.execute("SELECT id FROM lifecycle_probe").fetchall() == [{"id": 1}]
+    assert conn.execute("SELECT count(*) AS n FROM schema_migrations WHERE filename LIKE '%probe.sql'").fetchone()["n"] == 2
+    bad = tmp_path / "03-bad.sql"
+    bad.write_text("CREATE TABLE should_rollback(id integer); SELECT missing_column;")
+    with pytest.raises(psycopg.errors.UndefinedColumn):
+        module.apply_migrations(conn, [bad])
+    assert conn.execute("SELECT to_regclass('should_rollback') AS tbl").fetchone()["tbl"] is None
+    assert conn.execute("SELECT count(*) AS n FROM schema_migrations WHERE filename=%s", (bad.name,)).fetchone()["n"] == 0
+
+
+@requires_db
+@pytest.mark.parametrize("mutation", [
+    "ALTER TABLE jobs ADD COLUMN parity_probe integer",
+    "ALTER TABLE jobs DROP CONSTRAINT jobs_pkey CASCADE",
+    "CREATE INDEX parity_probe ON jobs(title)",
+    "GRANT INSERT ON jobs TO authenticated",
+    "GRANT UPDATE(title) ON jobs TO authenticated",
+    "ALTER FUNCTION app_user_id() RESET search_path",
+    "ALTER TABLE profiles DISABLE ROW LEVEL SECURITY",
+    "DROP POLICY owner_access ON profiles",
+])
+def test_catalog_parity_detects_real_drift(conn, mutation):
+    module = helpers()
+    before = module.schema_catalog(conn)
+    conn.execute(mutation)
+    assert module.schema_catalog(conn) != before
+    conn.rollback()
+
+
+@requires_db
+def test_bootstrap_accepts_clean_schema_and_same_cluster_roles(conn):
+    module = helpers()
+    module.bootstrap_schema(conn, SCHEMA_SQL)
+    rows = conn.execute("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('anon','authenticated') ORDER BY rolname").fetchall()
+    assert len(rows) == 2
+    assert all(not row["rolsuper"] and not row["rolbypassrls"] for row in rows)
diff --git a/tests/test_lifecycle_test_db.py b/tests/test_lifecycle_test_db.py
new file mode 100644
index 0000000..b575a95
--- /dev/null
+++ b/tests/test_lifecycle_test_db.py
@@ -0,0 +1,283 @@
+"""Safety and real session proofs for the isolated lifecycle test database."""
+
+import importlib
+import os
+from pathlib import Path
+import subprocess
+import sys
+import threading
+from types import SimpleNamespace
+
+import psycopg
+import pytest
+
+from tests.conftest import TEST_DSN, as_user, requires_db
+
+ROOT = Path(__file__).resolve().parents[1]
+LOCAL = "postgresql://postgres:test-only@127.0.0.1:55432/poller_lifecycle_test"
+
+
+def harness():
+    # The reconstruction RED is an assertion, rather than an import error.
+    assert (ROOT / "tools/lifecycle_test_db.py").exists(), "isolated harness is absent"
+    return importlib.import_module("tools.lifecycle_test_db")
+
+
+@pytest.mark.parametrize("dsn", [
+    "postgresql://postgres:secret@db.project.supabase.co:5432/postgres",
+    "postgresql://postgres:secret@aws-0.pooler.supabase.com:6543/poller_test",
+    "postgresql://postgres:secret@production.example:5432/poller_test",
+    "postgresql://postgres:secret@127.0.0.1:5432/postgres",
+    "postgresql://postgres:secret@localhost:5432/production",
+    "postgresql://postgres:secret@192.168.1.2:5432/poller_test",
+    "postgresql://postgres:secret@0.0.0.0:5432/poller_test",
+    "postgresql:///poller_test",
+    "postgresql://postgres@localhost:5432/poller_test",
+    "postgresql://postgres:secret@localhost/poller_test",
+    "postgresql://postgres:secret@localhost:0/poller_test",
+    "postgresql://postgres:secret@localhost:65536/poller_test",
+    "postgresql://postgres:secret@localhost:5432/poller_test?host=production.example",
+    "postgresql://postgres:secret@localhost:5432/poller_test?hostaddr=8.8.8.8",
+    "postgresql://postgres:secret@localhost:5432/poller_test?service=production",
+    "postgresql://postgres:secret@localhost:5432/poller_test?options=-csearch_path=other",
+    "postgresql://postgres:secret@localhost:5432/poller_test#fragment",
+    "postgresql://postgres:secret@localhost,production.example:5432/poller_test",
+    "postgresql://postgres:secret@localhost%2cproduction.example:5432/poller_test",
+    "host=localhost port=5432 dbname=poller_test user=postgres password=secret",
+    "mysql://postgres:secret@localhost:5432/poller_test",
+    "", " postgresql://postgres:secret@localhost:5432/poller_test",
+])
+def test_unsafe_dsn_is_rejected_before_connection_or_ddl(dsn, monkeypatch):
+    harness()
+    module = importlib.import_module("tests.lifecycle_helpers")
+    calls = []
+    monkeypatch.setattr(psycopg, "connect", lambda *a, **kw: calls.append(a))
+    with pytest.raises(ValueError) as error:
+        module.open_sessions(dsn, 2)
+    assert calls == []
+    assert "secret" not in str(error.value)
+
+
+@pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "[::1]"])
+@pytest.mark.parametrize("database", ["poller_test", "poller_lifecycle_test"])
+def test_only_explicit_loopback_test_databases_are_allowed(host, database):
+    harness().validate_test_dsn(f"postgresql://postgres:test@{host}:55432/{database}")
+
+
+def test_child_environment_scrubs_ambient_secrets_and_database(monkeypatch):
+    module = harness()
+    ambient = {
+        "DATABASE_URL": "production-do-not-use", "TEST_DATABASE_URL": "production-do-not-use",
+        "OPENAI_API_KEY": "live", "OPENROUTER_API_KEY": "live", "ANTHROPIC_API_KEY": "live",
+        "AWS_ACCESS_KEY_ID": "live", "AWS_SECRET_ACCESS_KEY": "live", "AWS_PROFILE": "prod",
+        "LANGFUSE_PUBLIC_KEY": "live", "LANGFUSE_SECRET_KEY": "live",
+        "OTEL_EXPORTER_OTLP_HEADERS": "live", "SUPABASE_SERVICE_ROLE_KEY": "live",
+        "PGHOSTADDR": "8.8.8.8", "PGSERVICE": "production", "PGOPTIONS": "live",
+        "HTTP_PROXY": "production", "CUSTOM_PROVIDER_TOKEN": "live", "DOCKER_HOST": "remote",
+    }
+    for name, value in ambient.items():
+        monkeypatch.setenv(name, value)
+    env = module.child_environment(LOCAL)
+    assert env["DATABASE_URL"] == env["TEST_DATABASE_URL"] == LOCAL
+    assert env["LIFECYCLE_REQUIRE_DB_TESTS"] == "1"
+    assert env["OPENAI_API_KEY"] == "test-disabled"
+    assert env["AWS_EC2_METADATA_DISABLED"] == "true"
+    assert env["AWS_SHARED_CREDENTIALS_FILE"] == env["AWS_CONFIG_FILE"] == os.devnull
+    assert not any(value == "live" or value == "production" for value in env.values())
+    for name in ambient.keys() - {"DATABASE_URL", "TEST_DATABASE_URL", "OPENAI_API_KEY"}:
+        assert name not in env
+
+
+def test_invalid_major_is_rejected_before_docker(monkeypatch):
+    module = harness()
+    calls = []
+    monkeypatch.setattr(subprocess, "run", lambda *a, **kw: calls.append(a))
+    with pytest.raises(ValueError):
+        module.isolated_database([sys.executable, "-c", "pass"], postgres_major=15)
+    assert calls == []
+
+
+def test_helper_rechecks_connected_target_before_any_ddl():
+    harness()
+    helpers = importlib.import_module("tests.lifecycle_helpers")
+    calls = []
+    connection = SimpleNamespace(
+        info=SimpleNamespace(host="production.example", hostaddr="192.0.2.1", dbname="postgres", port=5432),
+        execute=lambda *a, **kw: calls.append(a),
+    )
+    with pytest.raises(ValueError):
+        helpers.bootstrap_schema(connection, "DROP TABLE jobs")
+    with pytest.raises(ValueError):
+        helpers.apply_migrations(connection, [])
+    assert calls == []
+
+
+def test_direct_pytest_refuses_unsafe_dsn_before_fixtures(tmp_path):
+    module = harness()
+    marker = tmp_path / "ddl-ran"
+    test = tmp_path / "test_before_ddl.py"
+    test.write_text(f"def test_before_ddl():\n    from pathlib import Path\n    Path({str(marker)!r}).touch()\n")
+    env = module.child_environment(LOCAL)
+    env["TEST_DATABASE_URL"] = "postgresql://postgres:do-not-log-this@db.project.supabase.co:5432/postgres"
+    result = subprocess.run(
+        [sys.executable, "-m", "pytest", "-p", "tests.conftest", str(test), "-q"],
+        env=env, capture_output=True, text=True, timeout=30,
+    )
+    assert result.returncode == 4
+    assert "unsafe test DSN" in result.stdout + result.stderr
+    assert "do-not-log-this" not in result.stdout + result.stderr
+    assert not marker.exists()
+    env.pop("TEST_DATABASE_URL")
+    result = subprocess.run(
+        [sys.executable, "-m", "pytest", "-p", "tests.conftest", str(test), "-q"],
+        env=env, capture_output=True, text=True, timeout=30,
+    )
+    assert result.returncode == 4
+    assert "needs TEST_DATABASE_URL" in result.stdout + result.stderr
+    assert not marker.exists()
+
+
+@requires_db
+def test_direct_pytest_scrubs_ambient_libpq_target_overrides(tmp_path):
+    module = harness()
+    test = tmp_path / "test_pg_environment.py"
+    test.write_text(
+        "def test_safe_target():\n"
+        "    import os,psycopg\n"
+        "    assert 'PGSERVICE' not in os.environ\n"
+        "    assert 'PGHOSTADDR' not in os.environ\n"
+        "    with psycopg.connect(os.environ['TEST_DATABASE_URL'],connect_timeout=1) as conn:\n"
+        "        assert conn.info.hostaddr in ('127.0.0.1','::1')\n"
+    )
+    env = module.child_environment(TEST_DSN)
+    env.update(PGSERVICE="nonexistent-production-service", PGHOSTADDR="192.0.2.1")
+    result = subprocess.run(
+        [sys.executable, "-m", "pytest", "-p", "tests.conftest", str(test), "-q"],
+        env=env, capture_output=True, text=True, timeout=30,
+    )
+    assert result.returncode == 0, result.stdout + result.stderr
+
+
+@requires_db
+def test_existing_ci_service_entry_runs_with_scrubbed_environment(monkeypatch):
+    module = harness()
+    monkeypatch.setenv("DATABASE_URL", "production-do-not-use")
+    monkeypatch.setenv("PGSERVICE", "nonexistent-production-service")
+    assert module.run_existing_database([
+        sys.executable, "-c",
+        "import os,psycopg; assert os.environ['DATABASE_URL']==os.environ['TEST_DATABASE_URL']; "
+        "assert 'PGSERVICE' not in os.environ; "
+        "c=psycopg.connect(os.environ['DATABASE_URL']); "
+        "assert c.info.hostaddr in ('127.0.0.1','::1'); c.close()",
+    ], TEST_DSN) == 0
+
+
+@requires_db
+def test_independent_sessions_share_committed_rows_and_enforce_rls(conn):
+    module = harness()
+    helpers = importlib.import_module("tests.lifecycle_helpers")
+    owner = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
+    foreign = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
+    conn.execute("INSERT INTO profiles(user_id,profile_version) VALUES (%s,'v1')", (foreign,))
+    conn.commit()
+    sessions = helpers.open_sessions(TEST_DSN, 2)
+    assert len(sessions) == 2
+    try:
+        pids = [c.execute("SELECT pg_backend_pid() AS pid").fetchone()["pid"] for c in sessions]
+        assert len(set(pids)) == 2
+        for session in sessions:
+            assert session.execute("SELECT count(*) AS n FROM profiles").fetchone()["n"] == 1
+            session.rollback()
+            with as_user(session, owner):
+                assert session.execute("SELECT count(*) AS n FROM profiles").fetchone()["n"] == 0
+            with as_user(session, foreign):
+                assert session.execute("SELECT count(*) AS n FROM profiles").fetchone()["n"] == 1
+            session.execute("SET LOCAL ROLE anon")
+            with pytest.raises(psycopg.errors.InsufficientPrivilege):
+                session.execute("SELECT * FROM profiles")
+            session.rollback()
+        module.validate_test_dsn(TEST_DSN)
+    finally:
+        for session in sessions:
+            session.close()
+
+
+@requires_db
+def test_event_synchronized_sessions_see_only_committed_changes(conn):
+    harness()
+    helpers = importlib.import_module("tests.lifecycle_helpers")
+    owner = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
+    conn.execute("INSERT INTO profiles(user_id,profile_version) VALUES (%s,'v1')", (owner,))
+    conn.commit()
+    writer, reader = helpers.open_sessions(TEST_DSN, 2)
+    updated, inspected, committed = threading.Event(), threading.Event(), threading.Event()
+    failures = []
+
+    def write():
+        try:
+            writer.execute("UPDATE profiles SET profile_version='v2' WHERE user_id=%s", (owner,))
+            updated.set()
+            assert inspected.wait(5), "reader did not inspect uncommitted state"
+            writer.commit()
+            committed.set()
+        except BaseException as error:
+            failures.append(error)
+            updated.set()
+            committed.set()
+
+    thread = threading.Thread(target=write)
+    thread.start()
+    try:
+        assert updated.wait(5)
+        assert reader.execute("SELECT profile_version FROM profiles").fetchone()["profile_version"] == "v1"
+        inspected.set()
+        assert committed.wait(5)
+        assert reader.execute("SELECT profile_version FROM profiles").fetchone()["profile_version"] == "v2"
+    finally:
+        inspected.set()
+        thread.join(6)
+        for session in (writer, reader):
+            session.close()
+    assert not thread.is_alive()
+    assert failures == []
+
+
+@requires_db
+@pytest.mark.parametrize("skip_kind", ["runtest", "collection"])
+def test_required_database_entry_refuses_skipped_tests(tmp_path, skip_kind):
+    module = harness()
+    test = tmp_path / "test_skip.py"
+    if skip_kind == "runtest":
+        test.write_text("import pytest\n@pytest.mark.integration\n@pytest.mark.skip(reason='required')\ndef test_required(): pass\n")
+    else:
+        test.write_text("import pytest\npytest.skip('required',allow_module_level=True)\n")
+        (tmp_path / "test_pass.py").write_text("def test_pass(): pass\n")
+    result = subprocess.run(
+        [sys.executable, "-m", "pytest", "-p", "tests.conftest", str(tmp_path), "-q"],
+        env=module.child_environment(TEST_DSN), capture_output=True, text=True, timeout=30,
+    )
+    assert result.returncode != 0, result.stdout
+    assert "required database tests skipped" in result.stdout + result.stderr
+
+
+@requires_db
+def test_owned_docker_child_failure_and_timeout_cleanup(monkeypatch, capsys):
+    module = harness()
+    # Nested real Docker run proves cleanup on a failed child and timeout. No ambient DSN reuse.
+    monkeypatch.setenv("PGSERVICE", "nonexistent-production-service")
+    monkeypatch.setenv("PGHOSTADDR", "192.0.2.1")
+    monkeypatch.setenv("DATABASE_URL", "production-do-not-use")
+    monkeypatch.setattr(module, "COMMAND_TIMEOUT_SECONDS", 1)
+    before = subprocess.check_output(module.DOCKER + ["ps", "-aq"], text=True).splitlines()
+    volumes_before = subprocess.check_output(module.DOCKER + ["volume", "ls", "-q"], text=True).splitlines()
+    assert module.isolated_database([sys.executable, "-c", "raise SystemExit(7)"], 17) == 7
+    assert module.isolated_database(
+        [sys.executable, "-c", "import threading; threading.Event().wait(30)"], 17,
+    ) == 124
+    after = subprocess.check_output(module.DOCKER + ["ps", "-aq"], text=True).splitlines()
+    volumes_after = subprocess.check_output(module.DOCKER + ["volume", "ls", "-q"], text=True).splitlines()
+    assert sorted(after) == sorted(before)
+    assert sorted(volumes_after) == sorted(volumes_before)
+    output = capsys.readouterr().out
+    assert "PostgreSQL 17." in output
+    assert "postgresql://" not in output
diff --git a/tools/lifecycle_test_db.py b/tools/lifecycle_test_db.py
new file mode 100644
index 0000000..6390550
--- /dev/null
+++ b/tools/lifecycle_test_db.py
@@ -0,0 +1,192 @@
+"""Run tests in a local, owned, throwaway PostgreSQL 17 (or 16) container.
+
+Never consult ambient DATABASE_URL. The default launcher owns a new database;
+--existing-service reuses CI's explicitly supplied, validated TEST_DATABASE_URL.
+"""
+
+import argparse
+import os
+import secrets
+import subprocess
+import sys
+import threading
+import time
+from urllib.parse import unquote, urlsplit
+
+import psycopg
+
+DOCKER = ["docker", "--host", "unix:///var/run/docker.sock"]
+COMMAND_TIMEOUT_SECONDS = 1800
+READINESS_TIMEOUT_SECONDS = 60
+_HOSTS = {"localhost", "127.0.0.1", "::1"}
+_DATABASES = {"poller_test", "poller_lifecycle_test"}
+_SAFE_ENV = {"PATH", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "TERM", "TMPDIR", "VIRTUAL_ENV"}
+
+
+def validate_test_dsn(dsn: str) -> None:
+    """Reject ambiguous/remote DSNs without including credentials in errors.
+
+Only explicit URI loopback hosts, ports and test database names are supported.
+No query options: hostaddr/service/passfile/options can bypass the URI target.
+"""
+    try:
+        if not isinstance(dsn, str) or any(char.isspace() for char in dsn):
+            raise ValueError
+        parsed = urlsplit(dsn)
+        if (
+            parsed.scheme not in {"postgres", "postgresql"}
+            or parsed.hostname not in _HOSTS
+            or parsed.port is None or not 1 <= parsed.port <= 65535
+            or not parsed.username or not parsed.password
+            or unquote(parsed.path) not in {f"/{name}" for name in _DATABASES}
+            or parsed.query or parsed.fragment or "?" in dsn or "#" in dsn
+        ):
+            raise ValueError
+        parameters = psycopg.conninfo.conninfo_to_dict(dsn)
+        if parameters.get("host") not in _HOSTS or parameters.get("dbname") not in _DATABASES:
+            raise ValueError
+    except (ValueError, psycopg.ProgrammingError):
+        raise ValueError("unsafe test DSN: explicit loopback test database required") from None
+
+
+def validate_test_connection(conn: psycopg.Connection) -> None:
+    """Recheck an established target before any helper DDL."""
+    if (
+        conn.info.host not in _HOSTS
+        or conn.info.hostaddr not in {"127.0.0.1", "::1"}
+        or conn.info.dbname not in _DATABASES
+        or not 1 <= conn.info.port <= 65535
+    ):
+        raise ValueError("unsafe test connection: loopback test database required")
+
+
+def child_environment(dsn: str) -> dict[str, str]:
+    """An allowlist prevents inherited provider/production/PG credentials.
+
+Existing tests supply offline SDK doubles themselves. Placeholder OpenAI auth
+lets constructors work; AWS credential files and instance metadata are disabled.
+"""
+    validate_test_dsn(dsn)
+    env = {name: value for name, value in os.environ.items() if name in _SAFE_ENV}
+    env.update({
+        "TEST_DATABASE_URL": dsn,
+        "DATABASE_URL": dsn,
+        "LIFECYCLE_REQUIRE_DB_TESTS": "1",
+        "OPENAI_API_KEY": "test-disabled",
+        "AWS_EC2_METADATA_DISABLED": "true",
+        "AWS_SHARED_CREDENTIALS_FILE": os.devnull,
+        "AWS_CONFIG_FILE": os.devnull,
+        "PYTHONUNBUFFERED": "1",
+    })
+    return env
+
+
+def _docker(args: list[str], *, timeout: int = 30) -> str:
+    # Force the local socket; never inherit a remote Docker host or context.
+    result = subprocess.run(
+        DOCKER + args, env={k: v for k, v in os.environ.items() if k in _SAFE_ENV},
+        capture_output=True, text=True, timeout=timeout, check=True,
+    )
+    return result.stdout.strip()
+
+
+def run_existing_database(command: list[str], dsn: str) -> int:
+    """Required CI entry for its already-owned local PostgreSQL service.
+
+The caller must provide TEST_DATABASE_URL explicitly; DATABASE_URL is ignored.
+This entry never creates, drops, stops or cleans up a service/container.
+"""
+    if not command:
+        raise ValueError("a test command is required")
+    env = child_environment(dsn)
+    try:
+        return subprocess.run(command, env=env, timeout=COMMAND_TIMEOUT_SECONDS, check=False).returncode
+    except subprocess.TimeoutExpired:
+        print("Lifecycle test command timed out", file=sys.stderr)
+        return 124
+    except OSError:
+        print("Lifecycle test command failed to start", file=sys.stderr)
+        return 2
+
+
+def isolated_database(command: list[str], postgres_major: int = 17) -> int:
+    """Provision a new owned container, run a bounded child, and clean only it."""
+    if postgres_major not in {16, 17}:
+        raise ValueError("postgres-major must be 17 or 16")
+    if not command:
+        raise ValueError("a test command is required")
+    name = "poller-lifecycle-test-" + secrets.token_hex(12)
+    password = secrets.token_urlsafe(32)
+    try:
+        _docker([
+            "run", "--detach", "--name", name, "--label", "poller.lifecycle-test=owned",
+            "--publish", "127.0.0.1::5432",
+            "--env", "POSTGRES_PASSWORD=" + password,
+            "--env", "POSTGRES_DB=poller_lifecycle_test", f"postgres:{postgres_major}",
+        ], timeout=180)
+        address = _docker(["port", name, "5432/tcp"])
+        host, separator, port = address.partition(":")
+        if host != "127.0.0.1" or not separator or not port.isdigit():
+            raise RuntimeError("Docker did not publish an isolated loopback port")
+        dsn = f"postgresql://postgres:{password}@127.0.0.1:{port}/poller_lifecycle_test"
+        env = child_environment(dsn)
+        deadline = time.monotonic() + READINESS_TIMEOUT_SECONDS
+        while True:
+            try:
+                # The driver probe needs the same clean environment as the tests;
+                # libpq otherwise reads ambient PGHOSTADDR/PGSERVICE defaults.
+                probe = subprocess.run([
+                    sys.executable, "-c",
+                    "import os,psycopg; "
+                    "c=psycopg.connect(os.environ['TEST_DATABASE_URL'],connect_timeout=1); "
+                    "print(c.execute('SHOW server_version').fetchone()[0]); c.close()",
+                ], env=env, capture_output=True, text=True, timeout=5, check=True)
+                version = probe.stdout.strip()
+                if version.split('.', 1)[0] != str(postgres_major):
+                    raise RuntimeError("unexpected PostgreSQL server major")
+                print(f"Owned lifecycle database: PostgreSQL {version} (required {postgres_major})", flush=True)
+                break
+            except subprocess.SubprocessError:
+                if time.monotonic() >= deadline:
+                    raise RuntimeError("owned PostgreSQL readiness timed out") from None
+                threading.Event().wait(0.2)
+        return run_existing_database(command, dsn)
+    except (subprocess.SubprocessError, OSError, RuntimeError, ValueError):
+        # Never print CalledProcessError: its argv contains the generated password.
+        print("Lifecycle test database launch failed", file=sys.stderr)
+        return 2
+    finally:
+        # Unique name chosen by this invocation only. No prune, drop, or cleanup
+        # of caller-provided ports, services, volumes, or other containers.
+        try:
+            _docker(["rm", "--force", "--volumes", name])
+        except (subprocess.SubprocessError, OSError):
+            # A nonexistent container is expected after a failed docker run.
+            # An existing container that cannot be removed must fail the lane.
+            try:
+                remains = _docker(["ps", "--all", "--quiet", "--filter", f"name=^/{name}$"])
+            except (subprocess.SubprocessError, OSError):
+                remains = "unknown"
+            if remains:
+                raise RuntimeError("owned lifecycle container cleanup failed") from None
+
+
+def main() -> int:
+    parser = argparse.ArgumentParser(description=__doc__)
+    parser.add_argument("--postgres-major", type=int, choices=(17, 16), default=17)
+    parser.add_argument("--existing-service", action="store_true", help="reuse CI's explicit local TEST_DATABASE_URL")
+    parser.add_argument("command", nargs=argparse.REMAINDER)
+    args = parser.parse_args()
+    command = args.command[1:] if args.command[:1] == ["--"] else args.command
+    if not command:
+        parser.error("provide a command after --")
+    if args.existing_service:
+        try:
+            return run_existing_database(command, os.environ.get("TEST_DATABASE_URL", ""))
+        except ValueError as error:
+            parser.error(str(error))
+    return isolated_database(command, args.postgres_major)
+
+
+if __name__ == "__main__":
+    raise SystemExit(main())
