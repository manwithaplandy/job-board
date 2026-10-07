# Full pinned review package

BASE: 241ba32c1b5a815659c215b017b3d3afc304a6e0

HEAD: a288a9ad290d45d557953c9133bc61482d571f08

## Commits

a288a9ad290d45d557953c9133bc61482d571f08 test: harden lifecycle harness cleanup and catalog parity


## Files

 .../task-1-evidence/fix-round1-postgres16.txt      |   4 +
 .../task-1-evidence/fix-round1-postgres17.txt      |   4 +
 .../task-1-evidence/fix-round1-red-chronology.json |  39 +++++
 .../task-1-evidence/verification.json              |  32 +++-
 .../task-1-report.md                               | 122 ++++++++++++++-
 tests/lifecycle_helpers.py                         |  20 ++-
 tests/test_lifecycle_migrations.py                 |  51 ++++++
 tests/test_lifecycle_test_db.py                    | 137 ++++++++++++++++
 tools/lifecycle_test_db.py                         | 173 +++++++++++++++++----
 9 files changed, 542 insertions(+), 40 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round1-postgres16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round1-postgres16.txt
new file mode 100644
index 0000000..599d9dc
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round1-postgres16.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [ 87%]
+..........                                                               [100%]
+82 passed in 46.68s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round1-postgres17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round1-postgres17.txt
new file mode 100644
index 0000000..b1983d7
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round1-postgres17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 87%]
+..........                                                               [100%]
+82 passed in 39.85s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round1-red-chronology.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round1-red-chronology.json
new file mode 100644
index 0000000..3c35d97
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round1-red-chronology.json
@@ -0,0 +1,39 @@
+{
+  "fix_base": "241ba32c1b5a815659c215b017b3d3afc304a6e0",
+  "regressions": [
+    {
+      "command": "python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest tests/test_lifecycle_test_db.py tests/test_lifecycle_migrations.py -k 'creation_cleanup or sigterm_ignoring or outer_timeout or global_default or inherited_global or implicit_owner' -q",
+      "result": "11 failed, 53 deselected in 9.91s",
+      "exit_code": 1,
+      "failures": [
+        "unowned name conflict removal",
+        "ambiguous create cleanup did not use immutable ID",
+        "successful create cleanup did not use immutable ID",
+        "SIGTERM-ignoring descendant survived timeout",
+        "nested container survived outer timeout",
+        "global default migration drift missed",
+        "inherited global defaults not rejected before bootstrap",
+        "NULL-ACL table owner drift missed",
+        "NULL-ACL sequence owner drift missed",
+        "NULL-ACL SECURITY DEFINER owner drift missed",
+        "NULL-ACL schema owner drift missed"
+      ]
+    },
+    {
+      "command": "python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest tests/test_lifecycle_test_db.py -k outer_timeout -q",
+      "result": "1 failed, 44 deselected in 18.58s",
+      "exit_code": 1,
+      "failure": "equal grace windows bypassed nested finally with a SIGTERM-ignoring command"
+    }
+  ],
+  "focused_green": [
+    {
+      "result": "11 passed, 53 deselected in 10.76s",
+      "note": "first fix before strengthened nested SIGTERM-ignore case"
+    },
+    {
+      "result": "3 passed, 43 deselected in 16.08s",
+      "note": "real conflict, forced descendant, stronger nested cleanup after cancellation grace fix"
+    }
+  ]
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/verification.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/verification.json
index c58ec5c..579c10e 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/verification.json
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/verification.json
@@ -38,12 +38,42 @@
   ],
   "offline_baseline": {
     "passed": 530,
     "expected_database_skips": 369,
     "seconds": 11.29,
     "integration_acceptance": false
   },
   "lint": "passed",
   "diff_check": "passed",
   "independent_review": "controller-owned, pending",
-  "library_checkpoint": "controller-owned, pending"
+  "library_checkpoint": "controller-owned, pending",
+  "initial_verified_head": "241ba32c1b5a815659c215b017b3d3afc304a6e0",
+  "fix_round1": {
+    "recorded_utc": "2026-10-07T05:33:57.305287+00:00",
+    "fix_base": "241ba32c1b5a815659c215b017b3d3afc304a6e0",
+    "covered_files": [
+      "tests/test_lifecycle_test_db.py",
+      "tests/test_lifecycle_migrations.py",
+      "tests/test_rls_isolation.py"
+    ],
+    "required_lanes": [
+      {
+        "postgres_version": "17.11 (Debian 17.11-1.pgdg13+2)",
+        "passed": 82,
+        "skipped": 0,
+        "exit_code": 0,
+        "seconds": 39.85
+      },
+      {
+        "postgres_version": "16.15 (Debian 16.15-1.pgdg13+2)",
+        "passed": 82,
+        "skipped": 0,
+        "exit_code": 0,
+        "seconds": 46.68
+      }
+    ],
+    "lint": "passed",
+    "diff_check": "passed",
+    "full_suite_repeated": false,
+    "independent_scoped_rereview": "controller-owned, pending"
+  }
 }
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-report.md
index 7334f9b..09e2dff 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-report.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-report.md
@@ -13,21 +13,23 @@ Added `tools/lifecycle_test_db.py`, `tests/lifecycle_helpers.py`,
 frozen pre-change schema and migration inventory under `tests/fixtures/lifecycle/`.
 Updated only the database safety/mandatory-skip hooks in `tests/conftest.py` and
 the required database entries in `.github/workflows/ci.yml`.
 
 The default runner creates a fresh `postgres:17` or `postgres:16` container on
 the explicitly selected local Docker socket, with a generated password and a
 random port published only on `127.0.0.1`. It never falls back to ambient
 `DATABASE_URL` or reuses the existing local port 55432 service. Readiness is
 bounded to 60 seconds, individual probes to 5 seconds, Docker creation to 180
 seconds and child execution to 1,800 seconds. A `finally` removes only its unique
-owned container and that container's anonymous volumes. Child failure and
+owned container and that container's anonymous volumes. Fix Round 1 below
+adds invocation-marker verification and immutable-ID cleanup for failure paths.
+Child failure and
 timeout are exercised with real Docker, alongside unchanged-container and
 unchanged-volume assertions.
 
 Both child database variables point to the same isolated DSN. The child
 environment uses an allowlist, removing ambient production/provider/model,
 tracing, proxy and AWS credentials. It supplies a nonfunctional OpenAI test
 placeholder, disables AWS instance metadata and redirects AWS credential/config
 files to the null device; existing SDK tests use their offline doubles. The
 existing CI PostgreSQL 16 service and port/database configuration are preserved
 through `--existing-service`, which accepts only explicit `TEST_DATABASE_URL`,
@@ -119,21 +121,21 @@ dependency symlink. No old review/test results are reported as current proof.
    failed with **1 failed, 1 passed, 38 deselected in 0.93s**. The hook now handles
    both collection and runtime skip reports; final lanes include both cases.
 
 During local development, 11 anonymous test volumes from the earlier cleanup
 implementation were removed only after recorded Docker event metadata proved
 every observed mount belonged to our uniquely named, labeled owned test
 containers and a fresh per-volume check proved none remained mounted. Cleanup
 used those exact volume IDs, with no prune and no unrelated/shared deletion.
 The current runner cleans its own volumes in `finally`.
 
-## Current verification
+## Initial verification at 241ba32 (before Fix Round 1)
 
 Shell setup for the commands below:
 
 ```bash
 export PATH="$PWD/.venv/bin:$PATH"
 ```
 
 | Actual command | Actual result |
 | --- | --- |
 | `python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest tests/test_lifecycle_migrations.py tests/test_lifecycle_test_db.py tests/test_rls_isolation.py -q` | PostgreSQL **17.11** (Debian 17.11-1.pgdg13+2); **70 passed, zero skipped**, fresh final run 21.83s |
@@ -160,14 +162,128 @@ parity plus major-16 compatibility, not a claim of testing the historical 17.6
 production patch version. Docker/local socket is required; unavailable Docker,
 server-major mismatch, readiness timeout or failed cleanup fails closed.
 
 The multi-task binding command naming lifecycle safety/activation and archive
 files is not runnable at Task 1 because those later-task files do not exist yet.
 This task's real migration/RLS/concurrency harness tests are mandatory on both
 majors. No placeholder tests or fabricated skips were added for future work.
 Task 13 must run that final prescribed file set and dashboard DB tests on 17.
 
 All commits are forward-only; no amend/reset/rebase is used. Final SHA is the
-commit adding this report and is returned in the implementer handoff; retrieve
+latest implementation commit returned in the implementer handoff; retrieve
 it with `git log -1 --format=%H -- .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-report.md`.
 Independent spec/security/code review and Library checkpoint are pending the
 controller's fresh review. Stop before Task 2.
+
+## Fix Round 1 — four reviewed blockers
+
+Fix base: `241ba32c1b5a815659c215b017b3d3afc304a6e0`. Read both fresh pinned
+reviews in full before changing code. Their unique in-scope findings were:
+
+- Security: **[P2] Failed creation can remove a container this invocation never owned**.
+- Security: **[P2] Command timeout does not bound descendants or their owned resources**.
+- Both reviews: **[P2] Catalog parity omits global default privileges** /
+  **Global default privileges are invisible to the parity comparison**.
+- Requirements: **[P2] Object ownership changes can evade effective security parity**.
+
+### Tests-first failure evidence
+
+Added regressions before fixes and ran on owned PostgreSQL 17.11:
+
+```bash
+python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest \
+  tests/test_lifecycle_test_db.py tests/test_lifecycle_migrations.py \
+  -k 'creation_cleanup or sigterm_ignoring or outer_timeout or global_default or inherited_global or implicit_owner' -q
+```
+
+Result: **11 failed, 53 deselected in 9.91s**, exit 1. The failures reproduced:
+unowned conflict cleanup; immutable-ID requirements for ambiguous/successful
+creation; a real SIGTERM-ignoring descendant remaining alive; nested container
+cleanup bypass; invisible global defaults; unnoticed inherited global defaults
+during bootstrap; and NULL-ACL owner changes for a table, sequence, SECURITY
+DEFINER function, and public schema. Negative Docker-boundary doubles performed
+no actual Docker mutation. Real RED timeout probes adopted/reaped only their
+acknowledged descendant PIDs and removed only their acknowledged nested container
+IDs, so the regression runs did not leave resources behind.
+
+After the initial fixes this same 11-test selection passed in 10.76s. A stronger
+nested timeout case then installed SIGTERM-ignore in the nested command. It
+reproduced a timing defect before correction:
+
+```bash
+python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest \
+  tests/test_lifecycle_test_db.py -k outer_timeout -q
+```
+
+Result: **1 failed, 44 deselected in 18.58s**, exit 1. Equal outer/inner grace
+windows allowed the outer forced termination to interrupt the nested runner's
+container `finally`. Shortening signal-interrupted nested child grace fixed the
+case. A further real, stopped-container name-conflict proof was added to verify
+the Docker-boundary negative probe against actual Docker. The real conflict,
+forced descendant and stronger nested timeout selection passed **3 tests,
+43 deselected in 16.08s**.
+
+### Resulting behavior
+
+Each creation includes an invocation-specific owner marker. The runner retains
+the immutable container ID returned by successful `docker run`. Cleanup inspects
+only ID and marker, never the container environment/password, and removes by
+immutable ID only after the marker matches this invocation. Failed or timed-out
+creation can recover its own container by name only when the marker proves
+ownership; an unrelated conflicting name is preserved. A missing/unverifiable
+failed-create target is never deleted. Real conflicting-container and ordinary
+failure/timeout tests verify cleanup remains scoped to owned resources.
+
+Commands now run in their own session/process group. Timeout sends SIGTERM to
+that group, allows a bounded 10-second grace, then uses SIGKILL for remaining
+live members and bounded forced-exit checks. The direct child is reaped; real
+descendant tests temporarily adopt/reap their own child PIDs. Linux `/proc`
+membership/state checks exclude already-dead zombies. Normal command completion
+also cleans any surviving members of its group. SIGTERM/SIGINT handlers unwind
+nested harness cleanup instead of bypassing `finally`, and restore caller
+handlers afterward. A signal-interrupted nested runner limits its child's grace
+to one second, reserving the outer grace window for its own container cleanup.
+The real nested proof uses a SIGTERM-ignoring command and asserts both its
+container and process disappear. Forced cleanup failure fails the lane.
+
+Catalog defaults now include both `defaclnamespace=0` global scope and
+public-specific scope, with stable role names, object type, scope and full ACL
+text retaining grantee/grantor/grant-option information. Bootstrap refuses any
+inherited global defaults before `DROP SCHEMA`, because global defaults survive
+that drop and could contaminate both comparison builds. The real migration
+probe changes only a global default grant and must change parity; its cleanup
+restores defaults before subsequent fixtures.
+
+Relation/sequence, function and public schema owners are compared as stable
+role names, alongside existing ACL comparisons. Independent real DB probes
+assert ACLs are NULL before and after each owner change and prove table,
+sequence, SECURITY DEFINER function and schema ownership changes affect parity.
+The frozen schema bytes/hash and 47-file inventory remain unchanged.
+
+### Fresh covering verification
+
+```bash
+python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest \
+  tests/test_lifecycle_test_db.py tests/test_lifecycle_migrations.py \
+  tests/test_rls_isolation.py -q
+# Same command with --postgres-major 16.
+```
+
+| Fresh lane | Result |
+| --- | --- |
+| Owned PostgreSQL **17.11** (Debian 17.11-1.pgdg13+2) | **82 passed, zero skipped**, 39.85s, exit 0 |
+| Owned PostgreSQL **16.15** (Debian 16.15-1.pgdg13+2) | **82 passed, zero skipped**, 46.68s, exit 0 |
+| `ruff check .` | Passed |
+| `git diff --check` | Passed |
+
+This fix refreshes all affected harness/migration/RLS tests on both required
+majors. The initial 899-test full-suite results remain prior initial-commit
+evidence, not a claim that the full suite was rerun after these fixes. No broader
+baseline repeat was needed: the focused lane covers the changed process/resource
+paths and catalog comparison plus existing RLS compatibility, and exposes no
+unresolved failure. Fix output/chronology is tracked in `task-1-evidence/`.
+
+Only Task 1 tooling, its tests, this report and sanitized evidence are changed.
+No fixture/schema/application/CI change, broad Docker cleanup, cloud/provider
+call, or commit rewrite is made in this fix. Controller progress, review package
+and review artifacts are excluded from the forward commit. Fresh independent
+scoped rereview and Library checkpoint remain controller-owned and pending.
diff --git a/tests/lifecycle_helpers.py b/tests/lifecycle_helpers.py
index 63b18f1..adc616e 100644
--- a/tests/lifecycle_helpers.py
+++ b/tests/lifecycle_helpers.py
@@ -21,20 +21,24 @@ def open_sessions(dsn: str, count: int) -> list[psycopg.Connection]:
             validate_test_connection(session)
         return sessions
     except BaseException:
         for session in sessions:
             session.close()
         raise
 
 
 def bootstrap_schema(conn: psycopg.Connection, schema_sql: str) -> None:
     validate_test_connection(conn)
+    # DROP SCHEMA removes schema-scoped defaults, but global defaults survive
+    # and would affect both comparison builds. Require a clean global baseline.
+    if conn.execute("SELECT EXISTS(SELECT 1 FROM pg_default_acl WHERE defaclnamespace=0) AS dirty").fetchone()["dirty"]:
+        raise ValueError("global default privileges must be reset before bootstrap")
     try:
         conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
         conn.execute(schema_sql)
         conn.commit()
     except BaseException:
         conn.rollback()
         raise
 
 
 def apply_migrations(conn: psycopg.Connection, paths: list[Path]) -> None:
@@ -52,21 +56,21 @@ migrations behind a ledger skip. Existing BEGIN/COMMIT files are supported.
             )
             conn.commit()
         except BaseException:
             conn.rollback()
             raise
 
 
 _CATALOG_QUERIES = {
     "tables": """
         SELECT c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
-               c.relreplident,c.reloptions,c.relacl::text
+               c.relreplident,c.reloptions,c.relacl::text,pg_get_userbyid(c.relowner) AS owner
         FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S') ORDER BY c.relname
     """,
     "columns": """
         SELECT c.relname,a.attname,a.attnum,format_type(a.atttypid,a.atttypmod) AS type,
                a.attnotnull,a.attidentity,a.attgenerated,a.attacl::text,
                pg_get_expr(d.adbin,d.adrelid) AS default_expr
         FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
         JOIN pg_namespace n ON n.oid=c.relnamespace
         LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
@@ -86,39 +90,43 @@ _CATALOG_QUERIES = {
         FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid
         JOIN pg_class t ON t.oid=x.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
         WHERE n.nspname='public' ORDER BY t.relname,i.relname
     """,
     "policies": """
         SELECT tablename,policyname,permissive,roles,cmd,qual,with_check
         FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname
     """,
     "functions": """
         SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
-               pg_get_functiondef(p.oid) AS definition,p.proconfig,p.prosecdef,p.proacl::text
+               pg_get_functiondef(p.oid) AS definition,p.proconfig,p.prosecdef,p.proacl::text,
+               pg_get_userbyid(p.proowner) AS owner
         FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' ORDER BY p.proname,arguments
     """,
     "triggers": """
         SELECT c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,true) AS definition
         FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
         JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname
     """,
     "sequences": """
         SELECT sequencename,data_type,start_value,min_value,max_value,increment_by,cycle,cache_size
         FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename
     """,
     "schema_grants": """
-        SELECT nspacl::text FROM pg_namespace WHERE nspname='public'
+        SELECT nspacl::text,pg_get_userbyid(nspowner) AS owner
+        FROM pg_namespace WHERE nspname='public'
     """,
     "default_grants": """
-        SELECT r.rolname,d.defaclobjtype,d.defaclacl::text FROM pg_default_acl d
-        JOIN pg_roles r ON r.oid=d.defaclrole JOIN pg_namespace n ON n.oid=d.defaclnamespace
-        WHERE n.nspname='public' ORDER BY r.rolname,d.defaclobjtype
+        SELECT r.rolname,COALESCE(n.nspname,'global') AS scope,d.defaclobjtype,d.defaclacl::text
+        FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole
+        LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
+        WHERE d.defaclnamespace=0 OR n.nspname='public'
+        ORDER BY r.rolname,scope,d.defaclobjtype
     """,
 }
 
 
 def schema_catalog(conn: psycopg.Connection) -> dict[str, list[dict]]:
     """OID-free comparison including grants, RLS and function proconfig."""
     validate_test_connection(conn)
     return {name: conn.execute(sql).fetchall() for name, sql in _CATALOG_QUERIES.items()}
diff --git a/tests/test_lifecycle_migrations.py b/tests/test_lifecycle_migrations.py
index 7940e8e..c42af03 100644
--- a/tests/test_lifecycle_migrations.py
+++ b/tests/test_lifecycle_migrations.py
@@ -100,10 +100,61 @@ def test_catalog_parity_detects_real_drift(conn, mutation):
     conn.rollback()
 
 
 @requires_db
 def test_bootstrap_accepts_clean_schema_and_same_cluster_roles(conn):
     module = helpers()
     module.bootstrap_schema(conn, SCHEMA_SQL)
     rows = conn.execute("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('anon','authenticated') ORDER BY rolname").fetchall()
     assert len(rows) == 2
     assert all(not row["rolsuper"] and not row["rolbypassrls"] for row in rows)
+
+
+@requires_db
+def test_global_default_grant_migration_changes_catalog_parity(conn, tmp_path):
+    module = helpers()
+    before = module.schema_catalog(conn)
+    migration = tmp_path / "global-default-grant.sql"
+    migration.write_text("ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO authenticated;")
+    try:
+        module.apply_migrations(conn, [migration])
+        assert module.schema_catalog(conn) != before
+        rows = module.schema_catalog(conn)["default_grants"]
+        assert any(row["scope"] == "global" for row in rows)
+    finally:
+        conn.rollback()
+        conn.execute("ALTER DEFAULT PRIVILEGES REVOKE SELECT ON TABLES FROM authenticated")
+        conn.commit()
+
+
+@requires_db
+def test_bootstrap_rejects_inherited_global_defaults_before_drop(conn):
+    module = helpers()
+    conn.execute("ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon")
+    conn.commit()
+    before = conn.execute("SELECT 'jobs'::regclass::oid AS id").fetchone()["id"]
+    try:
+        with pytest.raises(ValueError, match="global default"):
+            module.bootstrap_schema(conn, SCHEMA_SQL)
+        assert conn.execute("SELECT 'jobs'::regclass::oid AS id").fetchone()["id"] == before
+    finally:
+        conn.rollback()
+        conn.execute("ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM anon")
+        conn.commit()
+
+
+@requires_db
+@pytest.mark.parametrize("setup,acl_query,mutation", [
+    ("CREATE TABLE owner_probe(id integer)", "SELECT relacl AS acl FROM pg_class WHERE oid='owner_probe'::regclass", "ALTER TABLE owner_probe OWNER TO authenticated"),
+    ("CREATE SEQUENCE owner_probe", "SELECT relacl AS acl FROM pg_class WHERE oid='owner_probe'::regclass", "ALTER SEQUENCE owner_probe OWNER TO authenticated"),
+    ("CREATE FUNCTION owner_probe() RETURNS integer LANGUAGE sql SECURITY DEFINER AS 'SELECT 1'", "SELECT proacl AS acl FROM pg_proc WHERE oid='owner_probe()'::regprocedure", "ALTER FUNCTION owner_probe() OWNER TO authenticated"),
+    ("DROP SCHEMA public CASCADE; CREATE SCHEMA public", "SELECT nspacl AS acl FROM pg_namespace WHERE nspname='public'", "ALTER SCHEMA public OWNER TO authenticated"),
+])
+def test_catalog_detects_implicit_owner_privilege_changes_with_null_acls(conn, setup, acl_query, mutation):
+    module = helpers()
+    conn.execute(setup)
+    assert conn.execute(acl_query).fetchone()["acl"] is None
+    before = module.schema_catalog(conn)
+    conn.execute(mutation)
+    assert conn.execute(acl_query).fetchone()["acl"] is None
+    assert module.schema_catalog(conn) != before
+    conn.rollback()
diff --git a/tests/test_lifecycle_test_db.py b/tests/test_lifecycle_test_db.py
index b575a95..f6e69fc 100644
--- a/tests/test_lifecycle_test_db.py
+++ b/tests/test_lifecycle_test_db.py
@@ -1,16 +1,20 @@
 """Safety and real session proofs for the isolated lifecycle test database."""
 
 import importlib
+import ctypes
+from contextlib import contextmanager
+import json
 import os
 from pathlib import Path
 import subprocess
+import signal
 import sys
 import threading
 from types import SimpleNamespace
 
 import psycopg
 import pytest
 
 from tests.conftest import TEST_DSN, as_user, requires_db
 
 ROOT = Path(__file__).resolve().parents[1]
@@ -90,20 +94,112 @@ def test_child_environment_scrubs_ambient_secrets_and_database(monkeypatch):
 
 def test_invalid_major_is_rejected_before_docker(monkeypatch):
     module = harness()
     calls = []
     monkeypatch.setattr(subprocess, "run", lambda *a, **kw: calls.append(a))
     with pytest.raises(ValueError):
         module.isolated_database([sys.executable, "-c", "pass"], postgres_major=15)
     assert calls == []
 
 
+@pytest.mark.parametrize("creation", ["conflict", "ambiguous-owned", "successful"])
+def test_creation_cleanup_requires_this_invocations_owner_and_immutable_id(monkeypatch, creation):
+    module = harness()
+    calls = []
+    token, cid = "fix-round-one-owner", "a" * 64
+    monkeypatch.setattr(module.secrets, "token_hex", lambda *args: token)
+
+    def docker(args, **kwargs):
+        calls.append(args)
+        if args[0] == "run":
+            if creation == "conflict":
+                raise subprocess.CalledProcessError(125, ["docker", "run"])
+            if creation == "ambiguous-owned":
+                raise subprocess.TimeoutExpired(["docker", "run"], 180)
+            return cid
+        if args[0] == "inspect":
+            return json.dumps({"id": cid, "owner": token if creation != "conflict" else "someone-else"})
+        if args[0] == "port":
+            raise RuntimeError("stop after successful creation")
+        return ""
+
+    monkeypatch.setattr(module, "_docker", docker)
+    assert module.isolated_database([sys.executable, "-c", "pass"]) == 2
+    removals = [args for args in calls if args[0] == "rm"]
+    if creation == "conflict":
+        assert removals == [], "failed creation must not remove an unowned name conflict"
+    else:
+        assert removals == [["rm", "--force", "--volumes", cid]]
+
+
+@requires_db
+def test_real_name_conflict_preserves_the_other_invocations_container(monkeypatch):
+    module = harness()
+    token = module.secrets.token_hex(12)
+    name = "poller-lifecycle-test-" + token
+    # This test owns the sentinel, but the invoked harness does not. Never start
+    # it or contact it as a DB; its immutable ID is the only test cleanup target.
+    sentinel = module._docker([
+        "create", "--name", name, "--label", "poller.lifecycle-test.owner=sentinel-" + token,
+        "postgres:17",
+    ])
+    monkeypatch.setattr(module.secrets, "token_hex", lambda *args: token)
+    try:
+        assert module.isolated_database([sys.executable, "-c", "pass"]) == 2
+        assert module._docker(["inspect", "--format", "{{.Id}}", sentinel]) == sentinel
+    finally:
+        if module._docker(["ps", "-aq", "--filter", "id=" + sentinel]):
+            module._docker(["rm", "--force", "--volumes", sentinel])
+
+
+@contextmanager
+def adopt_own_descendants():
+    # Reap only the descendant PID created by each test, including the RED probe.
+    libc = ctypes.CDLL(None, use_errno=True)
+    original = ctypes.c_int()
+    assert libc.prctl(37, ctypes.byref(original), 0, 0, 0) == 0  # PR_GET_CHILD_SUBREAPER
+    assert libc.prctl(36, 1, 0, 0, 0) == 0  # PR_SET_CHILD_SUBREAPER
+    try:
+        yield
+    finally:
+        assert libc.prctl(36, original.value, 0, 0, 0) == 0
+
+
+def test_timeout_terminates_and_reaps_a_real_sigterm_ignoring_descendant(monkeypatch, tmp_path):
+    module = harness()
+    pidfile = tmp_path / "descendant.pid"
+    worker = "import signal,threading; signal.signal(signal.SIGTERM,signal.SIG_IGN); print('ready',flush=True); threading.Event().wait(30)"
+    parent = (
+        "import subprocess,sys,threading; from pathlib import Path; "
+        f"p=subprocess.Popen([sys.executable,'-c',{worker!r}],stdout=subprocess.PIPE,text=True); "
+        "assert p.stdout.readline().strip()=='ready'; "
+        f"Path({str(pidfile)!r}).write_text(str(p.pid)); threading.Event().wait(30)"
+    )
+    monkeypatch.setattr(module, "COMMAND_TIMEOUT_SECONDS", 0.5)
+    monkeypatch.setattr(module, "COMMAND_TERMINATION_GRACE_SECONDS", 0.5, raising=False)
+    with adopt_own_descendants():
+        pid = None
+        try:
+            assert module.run_existing_database([sys.executable, "-c", parent], LOCAL) == 124
+            assert pidfile.exists(), "descendant readiness was not acknowledged"
+            pid = int(pidfile.read_text())
+            reaped, status = os.waitpid(pid, os.WNOHANG)
+            assert reaped == pid, "owned descendant remained alive after command timeout"
+            pid = None
+            assert os.WIFSIGNALED(status)
+            assert os.WTERMSIG(status) == signal.SIGKILL
+        finally:
+            if pid is not None:
+                os.kill(pid, signal.SIGKILL)
+                os.waitpid(pid, 0)
+
+
 def test_helper_rechecks_connected_target_before_any_ddl():
     harness()
     helpers = importlib.import_module("tests.lifecycle_helpers")
     calls = []
     connection = SimpleNamespace(
         info=SimpleNamespace(host="production.example", hostaddr="192.0.2.1", dbname="postgres", port=5432),
         execute=lambda *a, **kw: calls.append(a),
     )
     with pytest.raises(ValueError):
         helpers.bootstrap_schema(connection, "DROP TABLE jobs")
@@ -274,10 +370,51 @@ def test_owned_docker_child_failure_and_timeout_cleanup(monkeypatch, capsys):
     assert module.isolated_database(
         [sys.executable, "-c", "import threading; threading.Event().wait(30)"], 17,
     ) == 124
     after = subprocess.check_output(module.DOCKER + ["ps", "-aq"], text=True).splitlines()
     volumes_after = subprocess.check_output(module.DOCKER + ["volume", "ls", "-q"], text=True).splitlines()
     assert sorted(after) == sorted(before)
     assert sorted(volumes_after) == sorted(volumes_before)
     output = capsys.readouterr().out
     assert "PostgreSQL 17." in output
     assert "postgresql://" not in output
+
+
+@requires_db
+def test_outer_timeout_allows_nested_harness_container_and_process_cleanup(monkeypatch, tmp_path):
+    module = harness()
+    marker = tmp_path / "nested.json"
+    script = (
+        "import os,json,signal,subprocess,threading; from pathlib import Path; from urllib.parse import urlsplit; "
+        "signal.signal(signal.SIGTERM,signal.SIG_IGN); "
+        "port=str(urlsplit(os.environ['TEST_DATABASE_URL']).port); "
+        f"ids=subprocess.check_output({module.DOCKER!r}+['ps','--no-trunc','-q','--filter','publish='+port],text=True).splitlines(); "
+        "assert len(ids)==1; "
+        f"Path({str(marker)!r}).write_text(json.dumps(dict(cid=ids[0],pid=os.getpid()))); threading.Event().wait(30)"
+    )
+    monkeypatch.setattr(module, "COMMAND_TIMEOUT_SECONDS", 8)
+    monkeypatch.setattr(module, "COMMAND_TERMINATION_GRACE_SECONDS", 10, raising=False)
+    command = [sys.executable, str(ROOT / "tools/lifecycle_test_db.py"), "--postgres-major", "17", "--", sys.executable, "-c", script]
+    with adopt_own_descendants():
+        data = None
+        try:
+            assert module.run_existing_database(command, TEST_DSN) == 124
+            assert marker.exists(), "nested owned database command never started"
+            data = json.loads(marker.read_text())
+            remaining = module._docker(["ps", "--all", "--quiet", "--filter", "id=" + data["cid"]])
+            assert remaining == "", "outer timeout bypassed nested container cleanup"
+            assert not Path(f"/proc/{data['pid']}").exists(), "nested command descendant survived"
+        finally:
+            # Exact IDs/PIDs acknowledged by this test's owned nested child only.
+            if data is None and marker.exists():
+                data = json.loads(marker.read_text())
+            if data:
+                try:
+                    os.kill(data["pid"], signal.SIGKILL)
+                except ProcessLookupError:
+                    pass
+                try:
+                    os.waitpid(data["pid"], 0)
+                except ChildProcessError:
+                    pass
+                if module._docker(["ps", "-aq", "--filter", "id=" + data["cid"]]):
+                    module._docker(["rm", "--force", "--volumes", data["cid"]])
diff --git a/tools/lifecycle_test_db.py b/tools/lifecycle_test_db.py
index 6390550..9f4adbb 100644
--- a/tools/lifecycle_test_db.py
+++ b/tools/lifecycle_test_db.py
@@ -1,29 +1,34 @@
 """Run tests in a local, owned, throwaway PostgreSQL 17 (or 16) container.
 
 Never consult ambient DATABASE_URL. The default launcher owns a new database;
 --existing-service reuses CI's explicitly supplied, validated TEST_DATABASE_URL.
 """
 
 import argparse
+from contextlib import contextmanager
+import json
 import os
+from pathlib import Path
 import secrets
+import signal
 import subprocess
 import sys
 import threading
 import time
 from urllib.parse import unquote, urlsplit
 
 import psycopg
 
 DOCKER = ["docker", "--host", "unix:///var/run/docker.sock"]
 COMMAND_TIMEOUT_SECONDS = 1800
+COMMAND_TERMINATION_GRACE_SECONDS = 10
 READINESS_TIMEOUT_SECONDS = 60
 _HOSTS = {"localhost", "127.0.0.1", "::1"}
 _DATABASES = {"poller_test", "poller_lifecycle_test"}
 _SAFE_ENV = {"PATH", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "TERM", "TMPDIR", "VIRTUAL_ENV"}
 
 
 def validate_test_dsn(dsn: str) -> None:
     """Reject ambiguous/remote DSNs without including credentials in errors.
 
 Only explicit URI loopback hosts, ports and test database names are supported.
@@ -83,55 +88,172 @@ lets constructors work; AWS credential files and instance metadata are disabled.
 
 def _docker(args: list[str], *, timeout: int = 30) -> str:
     # Force the local socket; never inherit a remote Docker host or context.
     result = subprocess.run(
         DOCKER + args, env={k: v for k, v in os.environ.items() if k in _SAFE_ENV},
         capture_output=True, text=True, timeout=timeout, check=True,
     )
     return result.stdout.strip()
 
 
+class _HarnessTermination(BaseException):
+    def __init__(self, signum: int):
+        self.signum = signum
+
+
+@contextmanager
+def _termination_handlers():
+    # SIGTERM must unwind nested runners' finally blocks instead of bypassing
+    # their owned container and command-group cleanup. Restore caller handlers.
+    if threading.current_thread() is not threading.main_thread():
+        yield
+        return
+    previous = {sig: signal.getsignal(sig) for sig in (signal.SIGTERM, signal.SIGINT)}
+
+    def interrupted(signum, frame):
+        raise _HarnessTermination(signum)
+
+    try:
+        for sig in previous:
+            signal.signal(sig, interrupted)
+        yield
+    finally:
+        for sig, handler in previous.items():
+            signal.signal(sig, handler)
+
+
+def _group_has_live_processes(pgid: int) -> bool:
+    # The selected Linux Docker environment exposes /proc. Zombies cannot run
+    # work; the direct child is reaped by Popen, other parents reap their children.
+    try:
+        os.killpg(pgid, 0)
+    except ProcessLookupError:
+        return False
+    for directory in Path("/proc").iterdir():
+        if not directory.name.isdigit():
+            continue
+        try:
+            fields = (directory / "stat").read_text().rsplit(")", 1)[1].split()
+            if int(fields[2]) == pgid and fields[0] != "Z":
+                return True
+        except (FileNotFoundError, ProcessLookupError, PermissionError):
+            continue
+    return False
+
+
+def _stop_command_group(process: subprocess.Popen, grace_seconds: float | None = None) -> None:
+    pgid = process.pid  # start_new_session makes the child's PID its owned PGID.
+    try:
+        os.killpg(pgid, signal.SIGTERM)
+    except ProcessLookupError:
+        pass
+    deadline = time.monotonic() + (COMMAND_TERMINATION_GRACE_SECONDS if grace_seconds is None else grace_seconds)
+    while _group_has_live_processes(pgid) and time.monotonic() < deadline:
+        process.poll()
+        threading.Event().wait(0.05)
+    if _group_has_live_processes(pgid):
+        try:
+            os.killpg(pgid, signal.SIGKILL)
+        except ProcessLookupError:
+            pass
+    process.wait(timeout=5)
+    deadline = time.monotonic() + 5
+    while _group_has_live_processes(pgid) and time.monotonic() < deadline:
+        threading.Event().wait(0.05)
+    if _group_has_live_processes(pgid):
+        raise RuntimeError("owned command process group cleanup failed")
+
+
+def _cleanup_owned_container(name: str, owner: str, created_id: str | None) -> None:
+    candidate = created_id or name
+    # Inspect only immutable identity and invocation marker; never read env/password.
+    template = '{"id":{{json .Id}},"owner":{{json (index .Config.Labels "poller.lifecycle-test.owner")}}}'
+    try:
+        metadata = json.loads(_docker(["inspect", "--type", "container", "--format", template, candidate]))
+    except (subprocess.SubprocessError, OSError):
+        if created_id is None:
+            # Failed/ambiguous creation with no verifiable object: never remove
+            # an arbitrary name. Provisioning has already failed the lane.
+            return
+        remains = _docker(["ps", "--all", "--quiet", "--filter", f"id={created_id}"])
+        if remains:
+            raise RuntimeError("owned lifecycle container identity could not be verified") from None
+        return
+    cid = metadata.get("id", "")
+    if metadata.get("owner") != owner:
+        if created_id is not None:
+            raise RuntimeError("owned lifecycle container marker mismatch")
+        return  # An unowned conflicting name is never a cleanup target.
+    if len(cid) != 64 or any(c not in "0123456789abcdef" for c in cid) or (created_id and cid != created_id):
+        raise RuntimeError("invalid owned lifecycle container identity")
+    try:
+        _docker(["rm", "--force", "--volumes", cid])
+    except (subprocess.SubprocessError, OSError):
+        if _docker(["ps", "--all", "--quiet", "--filter", f"id={cid}"]):
+            raise RuntimeError("owned lifecycle container cleanup failed") from None
+
+
 def run_existing_database(command: list[str], dsn: str) -> int:
     """Required CI entry for its already-owned local PostgreSQL service.
 
 The caller must provide TEST_DATABASE_URL explicitly; DATABASE_URL is ignored.
 This entry never creates, drops, stops or cleans up a service/container.
 """
     if not command:
         raise ValueError("a test command is required")
     env = child_environment(dsn)
-    try:
-        return subprocess.run(command, env=env, timeout=COMMAND_TIMEOUT_SECONDS, check=False).returncode
-    except subprocess.TimeoutExpired:
-        print("Lifecycle test command timed out", file=sys.stderr)
-        return 124
-    except OSError:
-        print("Lifecycle test command failed to start", file=sys.stderr)
-        return 2
+    with _termination_handlers():
+        try:
+            process = subprocess.Popen(command, env=env, start_new_session=True)
+        except OSError:
+            print("Lifecycle test command failed to start", file=sys.stderr)
+            return 2
+        try:
+            result = process.wait(timeout=COMMAND_TIMEOUT_SECONDS)
+            if _group_has_live_processes(process.pid):
+                _stop_command_group(process)
+            return result
+        except subprocess.TimeoutExpired:
+            _stop_command_group(process)
+            print("Lifecycle test command timed out", file=sys.stderr)
+            return 124
+        except BaseException as error:
+            # An outer deadline already sent SIGTERM. Shorten the nested child's
+            # grace to reserve the outer grace window for our container finally.
+            _stop_command_group(process, grace_seconds=1 if isinstance(error, _HarnessTermination) else None)
+            raise
 
 
 def isolated_database(command: list[str], postgres_major: int = 17) -> int:
     """Provision a new owned container, run a bounded child, and clean only it."""
     if postgres_major not in {16, 17}:
         raise ValueError("postgres-major must be 17 or 16")
     if not command:
         raise ValueError("a test command is required")
-    name = "poller-lifecycle-test-" + secrets.token_hex(12)
+    with _termination_handlers():
+        return _isolated_database(command, postgres_major)
+
+
+def _isolated_database(command: list[str], postgres_major: int) -> int:
+    owner = secrets.token_hex(12)
+    name = "poller-lifecycle-test-" + owner
     password = secrets.token_urlsafe(32)
+    created_id = None
     try:
-        _docker([
+        created_id = _docker([
             "run", "--detach", "--name", name, "--label", "poller.lifecycle-test=owned",
+            "--label", "poller.lifecycle-test.owner=" + owner,
             "--publish", "127.0.0.1::5432",
             "--env", "POSTGRES_PASSWORD=" + password,
             "--env", "POSTGRES_DB=poller_lifecycle_test", f"postgres:{postgres_major}",
         ], timeout=180)
-        address = _docker(["port", name, "5432/tcp"])
+        address = _docker(["port", created_id, "5432/tcp"])
         host, separator, port = address.partition(":")
         if host != "127.0.0.1" or not separator or not port.isdigit():
             raise RuntimeError("Docker did not publish an isolated loopback port")
         dsn = f"postgresql://postgres:{password}@127.0.0.1:{port}/poller_lifecycle_test"
         env = child_environment(dsn)
         deadline = time.monotonic() + READINESS_TIMEOUT_SECONDS
         while True:
             try:
                 # The driver probe needs the same clean environment as the tests;
                 # libpq otherwise reads ambient PGHOSTADDR/PGSERVICE defaults.
@@ -149,44 +271,35 @@ def isolated_database(command: list[str], postgres_major: int = 17) -> int:
             except subprocess.SubprocessError:
                 if time.monotonic() >= deadline:
                     raise RuntimeError("owned PostgreSQL readiness timed out") from None
                 threading.Event().wait(0.2)
         return run_existing_database(command, dsn)
     except (subprocess.SubprocessError, OSError, RuntimeError, ValueError):
         # Never print CalledProcessError: its argv contains the generated password.
         print("Lifecycle test database launch failed", file=sys.stderr)
         return 2
     finally:
-        # Unique name chosen by this invocation only. No prune, drop, or cleanup
-        # of caller-provided ports, services, volumes, or other containers.
-        try:
-            _docker(["rm", "--force", "--volumes", name])
-        except (subprocess.SubprocessError, OSError):
-            # A nonexistent container is expected after a failed docker run.
-            # An existing container that cannot be removed must fail the lane.
-            try:
-                remains = _docker(["ps", "--all", "--quiet", "--filter", f"name=^/{name}$"])
-            except (subprocess.SubprocessError, OSError):
-                remains = "unknown"
-            if remains:
-                raise RuntimeError("owned lifecycle container cleanup failed") from None
+        _cleanup_owned_container(name, owner, created_id)
 
 
 def main() -> int:
     parser = argparse.ArgumentParser(description=__doc__)
     parser.add_argument("--postgres-major", type=int, choices=(17, 16), default=17)
     parser.add_argument("--existing-service", action="store_true", help="reuse CI's explicit local TEST_DATABASE_URL")
     parser.add_argument("command", nargs=argparse.REMAINDER)
     args = parser.parse_args()
     command = args.command[1:] if args.command[:1] == ["--"] else args.command
     if not command:
         parser.error("provide a command after --")
-    if args.existing_service:
-        try:
-            return run_existing_database(command, os.environ.get("TEST_DATABASE_URL", ""))
-        except ValueError as error:
-            parser.error(str(error))
-    return isolated_database(command, args.postgres_major)
+    try:
+        if args.existing_service:
+            try:
+                return run_existing_database(command, os.environ.get("TEST_DATABASE_URL", ""))
+            except ValueError as error:
+                parser.error(str(error))
+        return isolated_database(command, args.postgres_major)
+    except _HarnessTermination as interrupted:
+        return 128 + interrupted.signum
 
 
 if __name__ == "__main__":
     raise SystemExit(main())
