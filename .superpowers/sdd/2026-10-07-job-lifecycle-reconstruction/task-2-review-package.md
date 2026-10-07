# Full pinned review package

BASE: 8d1e98424b08f076df736f962ec94f2bf5bd30b8

HEAD: b0fc09a0012b06bc6e16262b641a08a37ccc3ca1

## Commits

b0fc09a0012b06bc6e16262b641a08a37ccc3ca1 feat: add additive source listing lifecycle identities


## Files

 .../task-2-evidence/accepted-full17.txt            |  15 +
 .../task-2-evidence/accepted16.txt                 |   4 +
 .../task-2-evidence/accepted17.txt                 |   4 +
 .../task-2-evidence/account-inventory-green.txt    |  18 +
 .../task-2-evidence/final16-fixed-fixture.txt      |   4 +
 .../task-2-evidence/final16.txt                    |  63 +++
 .../task-2-evidence/full17.txt                     |  74 +++
 .../task-2-evidence/green16.txt                    |  45 ++
 .../task-2-evidence/green17-attempt1.txt           |   3 +
 .../task-2-evidence/green17.txt                    |  45 ++
 .../task-2-evidence/red-account-inventory.txt      |  63 +++
 .../task-2-evidence/red-collect17.txt              |  91 ++++
 .../task-2-evidence/red-legacy-prune17.txt         |  80 +++
 .../task-2-evidence/red17.txt                      | 364 +++++++++++++
 .../task-2-evidence/ruff.txt                       |   1 +
 .../task-2-evidence/task2-final16.txt              |   4 +
 .../task-2-evidence/task2-final17.txt              |   4 +
 .../task-2-evidence/typecheck.txt                  |   9 +
 .../task-2-report.md                               | 206 ++++++++
 dashboard/lib/accountExport.test.ts                |   8 +
 dashboard/lib/accountExport.ts                     |  27 +-
 dashboard/lib/userScopedTables.ts                  |   3 +
 job_discovery/lifecycle/__init__.py                |   1 +
 job_discovery/lifecycle/config.py                  |  37 ++
 job_discovery/lifecycle/identity.py                | 179 +++++++
 job_discovery/lifecycle/types.py                   |  52 ++
 migrations/2026-10-03-01-lifecycle-core.sql        | 430 +++++++++++++++
 pyproject.toml                                     |   2 +-
 schema.sql                                         | 430 +++++++++++++++
 tests/test_lifecycle_identity.py                   | 585 +++++++++++++++++++++
 tests/test_lifecycle_migrations.py                 |  33 ++
 tests/test_rls_isolation.py                        |   2 +
 32 files changed, 2883 insertions(+), 3 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/accepted-full17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/accepted-full17.txt
new file mode 100644
index 0000000..981c262
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/accepted-full17.txt
@@ -0,0 +1,15 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [  7%]
+........................................................................ [ 15%]
+........................................................................ [ 23%]
+........................................................................ [ 30%]
+........................................................................ [ 38%]
+........................................................................ [ 46%]
+........................................................................ [ 54%]
+........................................................................ [ 61%]
+........................................................................ [ 69%]
+........................................................................ [ 77%]
+........................................................................ [ 85%]
+........................................................................ [ 92%]
+...................................................................      [100%]
+931 passed in 173.16s (0:02:53)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/accepted16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/accepted16.txt
new file mode 100644
index 0000000..bd44020
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/accepted16.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [ 80%]
+.................                                                        [100%]
+89 passed in 37.58s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/accepted17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/accepted17.txt
new file mode 100644
index 0000000..d879f1e
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/accepted17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 80%]
+.................                                                        [100%]
+89 passed in 30.53s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/account-inventory-green.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/account-inventory-green.txt
new file mode 100644
index 0000000..e6febd4
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/account-inventory-green.txt
@@ -0,0 +1,18 @@
+
+> job-board-dashboard@0.1.0 test
+> NODE_OPTIONS=--no-experimental-webstorage vitest run lib/accountDeletion.test.ts lib/accountExport.test.ts lib/serviceRoleAllowlist.test.ts
+
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+
+ Test Files  3 passed (3)
+      Tests  36 passed (36)
+   Start at  06:12:19
+   Duration  777ms (transform 611ms, setup 0ms, import 772ms, tests 109ms, environment 0ms)
+
+npm notice
+npm notice New major version of npm available! 11.9.0 -> 12.2.0
+npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
+npm notice To update run: npm install -g npm@12.2.0
+npm notice
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/final16-fixed-fixture.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/final16-fixed-fixture.txt
new file mode 100644
index 0000000..08eca03
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/final16-fixed-fixture.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [ 80%]
+.................                                                        [100%]
+89 passed in 38.24s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/final16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/final16.txt
new file mode 100644
index 0000000..d95a410
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/final16.txt
@@ -0,0 +1,63 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+..................................F..................................... [ 80%]
+.................                                                        [100%]
+=================================== FAILURES ===================================
+______ test_service_account_erasure_inventory_deletes_only_target_demands ______
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32844 user=postgres database=poller_lifecycle_test) at 0x7f3cda94b8f0>
+
+    @requires_db
+    def test_service_account_erasure_inventory_deletes_only_target_demands(conn):
+        """Exercise the actual registry's bounded account erasure statements locally.
+
+        The existing accountDeletion.ts serviceSql loop is privileged, derives its
+        user from the verified caller and filters each DELETE by that user_id.
+        No authenticated demand DELETE privilege is added for this path.
+        """
+        import re
+        from pathlib import Path
+
+        seed(conn)
+        users = [uuid4(), uuid4()]
+        for user in users:
+>           conn.execute("INSERT INTO profiles(user_id) VALUES (%s)",(user,))
+
+tests/test_lifecycle_identity.py:503:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32844 user=postgres database=poller_lifecycle_test) at 0x7f3cda94b8f0>
+query = 'INSERT INTO profiles(user_id) VALUES (%s)'
+params = (UUID('4c483fd4-b742-4d7e-8ad7-d6a94074721f'),), prepare = None
+binary = False
+
+    def execute(
+        self,
+        query: Query,
+        params: Params | None = None,
+        *,
+        prepare: bool | None = None,
+        binary: bool = False,
+    ) -> Cursor[Row]:
+        """Execute a query and return a cursor to read its results."""
+        try:
+            cur = self.cursor()
+            if binary:
+                cur.format = BINARY
+
+            if isinstance(query, Template):
+                if params is not None:
+                    raise TypeError(
+                        "'execute()' with string template query doesn't support parameters"
+                    )
+                return cur.execute(query, prepare=prepare)
+            else:
+                return cur.execute(query, params, prepare=prepare)
+        except e._NO_TRACEBACK as ex:
+>           raise ex.with_traceback(None)
+E           psycopg.errors.NotNullViolation: null value in column "profile_version" of relation "profiles" violates not-null constraint
+E           DETAIL:  Failing row contains (4c483fd4-b742-4d7e-8ad7-d6a94074721f, null, null, null, null, null, {}, null, null, null, null, null, null, null, null, null, {}, null, null, null, null, null, null, null, {}, null, null, null, null, null, null, 2026-10-07 06:12:51.202911+00, null).
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: NotNullViolation
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_identity.py::test_service_account_erasure_inventory_deletes_only_target_demands
+1 failed, 88 passed in 50.68s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/full17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/full17.txt
new file mode 100644
index 0000000..1a55b2d
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/full17.txt
@@ -0,0 +1,74 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [  7%]
+........................................................................ [ 15%]
+........................................................................ [ 23%]
+........................................................................ [ 30%]
+......................F................................................. [ 38%]
+........................................................................ [ 46%]
+........................................................................ [ 54%]
+........................................................................ [ 61%]
+........................................................................ [ 69%]
+........................................................................ [ 77%]
+........................................................................ [ 85%]
+........................................................................ [ 92%]
+...................................................................      [100%]
+=================================== FAILURES ===================================
+______ test_service_account_erasure_inventory_deletes_only_target_demands ______
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32843 user=postgres database=poller_lifecycle_test) at 0x7f39d1bcff80>
+
+    @requires_db
+    def test_service_account_erasure_inventory_deletes_only_target_demands(conn):
+        """Exercise the actual registry's bounded account erasure statements locally.
+
+        The existing accountDeletion.ts serviceSql loop is privileged, derives its
+        user from the verified caller and filters each DELETE by that user_id.
+        No authenticated demand DELETE privilege is added for this path.
+        """
+        import re
+        from pathlib import Path
+
+        seed(conn)
+        users = [uuid4(), uuid4()]
+        for user in users:
+>           conn.execute("INSERT INTO profiles(user_id) VALUES (%s)",(user,))
+
+tests/test_lifecycle_identity.py:503:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32843 user=postgres database=poller_lifecycle_test) at 0x7f39d1bcff80>
+query = 'INSERT INTO profiles(user_id) VALUES (%s)'
+params = (UUID('1815e737-0fb0-47e9-96fa-95e60a9ff19a'),), prepare = None
+binary = False
+
+    def execute(
+        self,
+        query: Query,
+        params: Params | None = None,
+        *,
+        prepare: bool | None = None,
+        binary: bool = False,
+    ) -> Cursor[Row]:
+        """Execute a query and return a cursor to read its results."""
+        try:
+            cur = self.cursor()
+            if binary:
+                cur.format = BINARY
+
+            if isinstance(query, Template):
+                if params is not None:
+                    raise TypeError(
+                        "'execute()' with string template query doesn't support parameters"
+                    )
+                return cur.execute(query, prepare=prepare)
+            else:
+                return cur.execute(query, params, prepare=prepare)
+        except e._NO_TRACEBACK as ex:
+>           raise ex.with_traceback(None)
+E           psycopg.errors.NotNullViolation: null value in column "profile_version" of relation "profiles" violates not-null constraint
+E           DETAIL:  Failing row contains (1815e737-0fb0-47e9-96fa-95e60a9ff19a, null, null, null, null, null, {}, null, null, null, null, null, null, null, null, null, {}, null, null, null, null, null, null, null, {}, null, null, null, null, null, null, 2026-10-07 06:13:08.256712+00, null).
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: NotNullViolation
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_identity.py::test_service_account_erasure_inventory_deletes_only_target_demands
+1 failed, 930 passed in 203.29s (0:03:23)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/green16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/green16.txt
new file mode 100644
index 0000000..66362e0
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/green16.txt
@@ -0,0 +1,45 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+......................................................................F. [ 81%]
+................                                                         [100%]
+=================================== FAILURES ===================================
+_____ test_every_user_scoped_table_has_rls_enabled_and_expected_policy_set _____
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32842 user=postgres database=poller_lifecycle_test) at 0x7fee1c7bfd40>
+
+    @requires_db
+    def test_every_user_scoped_table_has_rls_enabled_and_expected_policy_set(conn):
+        with conn.cursor() as cur:
+            # Discover every base table storing a user_id, with its RLS flag.
+            cur.execute(
+                """
+                SELECT c.relname AS tbl, c.relrowsecurity AS rls
+                FROM pg_class c
+                JOIN pg_namespace n ON n.oid = c.relnamespace
+                WHERE n.nspname = 'public' AND c.relkind = 'r'
+                  AND EXISTS (
+                    SELECT 1 FROM pg_attribute a
+                    WHERE a.attrelid = c.oid AND a.attname = 'user_id'
+                      AND a.attnum > 0 AND NOT a.attisdropped
+                  )
+                ORDER BY c.relname
+                """
+            )
+            user_tables = {r["tbl"]: r["rls"] for r in cur.fetchall()}
+
+        assert user_tables, "no user-scoped tables discovered — schema.sql failed to load?"
+
+        # (1) Systemic: every user_id table has RLS ON and a declared contract. A new one
+        # that slips in RLS-off or unclassified fails one of these — before it can leak.
+        for tbl, rls in sorted(user_tables.items()):
+            assert rls is True, f"{tbl} stores user_id but RLS is DISABLED"
+>           assert tbl in EXPECTED_RLS, (
+                f"{tbl} stores user_id but has no declared RLS contract — add it to "
+                f"EXPECTED_RLS (and the deletion/export lists) before shipping"
+            )
+E           AssertionError: job_payload_demands stores user_id but has no declared RLS contract — add it to EXPECTED_RLS (and the deletion/export lists) before shipping
+E           assert 'job_payload_demands' in {'matching_activity': {'owner_read': ('SELECT', frozenset({'authenticated'}))}, 'feedback': {'feedback_owner_read': ('...views': {'no_anon_access': ('ALL', frozenset({'public'})), 'owner_access': ('ALL', frozenset({'authenticated'}))}, ...}
+
+tests/test_rls_isolation.py:498: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_rls_isolation.py::test_every_user_scoped_table_has_rls_enabled_and_expected_policy_set
+1 failed, 87 passed in 36.34s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/green17-attempt1.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/green17-attempt1.txt
new file mode 100644
index 0000000..6196759
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/green17-attempt1.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+.............................                                            [100%]
+29 passed in 12.53s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/green17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/green17.txt
new file mode 100644
index 0000000..253a234
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/green17.txt
@@ -0,0 +1,45 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+......................................................................F. [ 81%]
+................                                                         [100%]
+=================================== FAILURES ===================================
+_____ test_every_user_scoped_table_has_rls_enabled_and_expected_policy_set _____
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32841 user=postgres database=poller_lifecycle_test) at 0x7f0bedbc6390>
+
+    @requires_db
+    def test_every_user_scoped_table_has_rls_enabled_and_expected_policy_set(conn):
+        with conn.cursor() as cur:
+            # Discover every base table storing a user_id, with its RLS flag.
+            cur.execute(
+                """
+                SELECT c.relname AS tbl, c.relrowsecurity AS rls
+                FROM pg_class c
+                JOIN pg_namespace n ON n.oid = c.relnamespace
+                WHERE n.nspname = 'public' AND c.relkind = 'r'
+                  AND EXISTS (
+                    SELECT 1 FROM pg_attribute a
+                    WHERE a.attrelid = c.oid AND a.attname = 'user_id'
+                      AND a.attnum > 0 AND NOT a.attisdropped
+                  )
+                ORDER BY c.relname
+                """
+            )
+            user_tables = {r["tbl"]: r["rls"] for r in cur.fetchall()}
+
+        assert user_tables, "no user-scoped tables discovered — schema.sql failed to load?"
+
+        # (1) Systemic: every user_id table has RLS ON and a declared contract. A new one
+        # that slips in RLS-off or unclassified fails one of these — before it can leak.
+        for tbl, rls in sorted(user_tables.items()):
+            assert rls is True, f"{tbl} stores user_id but RLS is DISABLED"
+>           assert tbl in EXPECTED_RLS, (
+                f"{tbl} stores user_id but has no declared RLS contract — add it to "
+                f"EXPECTED_RLS (and the deletion/export lists) before shipping"
+            )
+E           AssertionError: job_payload_demands stores user_id but has no declared RLS contract — add it to EXPECTED_RLS (and the deletion/export lists) before shipping
+E           assert 'job_payload_demands' in {'matching_activity': {'owner_read': ('SELECT', frozenset({'authenticated'}))}, 'feedback': {'feedback_owner_read': ('...views': {'no_anon_access': ('ALL', frozenset({'public'})), 'owner_access': ('ALL', frozenset({'authenticated'}))}, ...}
+
+tests/test_rls_isolation.py:498: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_rls_isolation.py::test_every_user_scoped_table_has_rls_enabled_and_expected_policy_set
+1 failed, 87 passed in 22.22s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/red-account-inventory.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/red-account-inventory.txt
new file mode 100644
index 0000000..b2f7ef9
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/red-account-inventory.txt
@@ -0,0 +1,63 @@
+
+> job-board-dashboard@0.1.0 test
+> NODE_OPTIONS=--no-experimental-webstorage vitest run lib/accountDeletion.test.ts lib/accountExport.test.ts
+
+
+ RUN  v4.1.9 /workspace/job-board/.claude/worktrees/lifecycle-recovery/dashboard
+
+ ❯ lib/accountExport.test.ts (7 tests | 1 failed) 22ms
+   × reports inaccessible lifecycle demands without claiming a complete empty export 7ms
+ ❯ lib/accountDeletion.test.ts (28 tests | 1 failed) 32ms
+     × every CREATE TABLE with a user_id column is classified (delete/anonymize/excluded) 13ms
+
+⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
+
+ FAIL  lib/accountDeletion.test.ts > user_id table drift guard > every CREATE TABLE with a user_id column is classified (delete/anonymize/excluded)
+AssertionError: job_payload_demands has a user_id column but is not in USER_DELETE_TABLES / USER_ANONYMIZE_TABLES / USER_EXCLUDED_TABLES: expected false to be true // Object.is equality
+
+- Expected
++ Received
+
+- true
++ false
+
+ ❯ lib/accountDeletion.test.ts:135:9
+    133|         ALL_CLASSIFIED_TABLES.has(t),
+    134|         `${t} has a user_id column but is not in USER_DELETE_TABLES / …
+    135|       ).toBe(true);
+       |         ^
+    136|     }
+    137|   });
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
+
+ FAIL  lib/accountExport.test.ts > reports inaccessible lifecycle demands without claiming a complete empty export
+AssertionError: expected { …(24) } to have property "job_payload_demands" with value null
+
+- Expected:
+null
+
++ Received:
+undefined
+
+ ❯ lib/accountExport.test.ts:158:18
+    156| test("reports inaccessible lifecycle demands without claiming a comple…
+    157|   const result = await buildAccountExport("user-a", "a@x.com", noFiles…
+    158|   expect(result).toHaveProperty("job_payload_demands", null);
+       |                  ^
+    159|   expect(result).toHaveProperty("job_payload_demands_error", "lifecycl…
+    160|   expect(JSON.stringify(result)).not.toContain("permission denied");
+
+⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
+
+
+ Test Files  2 failed (2)
+      Tests  2 failed | 33 passed (35)
+   Start at  06:11:25
+   Duration  448ms (transform 234ms, setup 0ms, import 293ms, tests 54ms, environment 0ms)
+
+npm notice
+npm notice New major version of npm available! 11.9.0 -> 12.2.0
+npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
+npm notice To update run: npm install -g npm@12.2.0
+npm notice
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/red-collect17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/red-collect17.txt
new file mode 100644
index 0000000..08cec00
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/red-collect17.txt
@@ -0,0 +1,91 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FF...                                                                    [100%]
+=================================== FAILURES ===================================
+_________________ test_control_history_and_activation_barrier __________________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32859 user=postgres database=poller_lifecycle_test) at 0x7f030416dc40>
+
+    @requires_db
+    def test_control_history_and_activation_barrier(conn):
+        from job_discovery.lifecycle.config import read_control
+
+        initial = read_control(conn)
+        for statement in [
+            "DELETE FROM lifecycle_control",
+            "TRUNCATE lifecycle_control",
+            "UPDATE lifecycle_control SET feed_enabled=true",
+            "UPDATE lifecycle_control SET archive_ever_activated=true,archive_stage='active',activation_generation=1",
+            "UPDATE lifecycle_control SET safety_stage='enforced',activation_generation=1",
+        ]:
+            with pytest.raises(psycopg.errors.RaiseException), conn.transaction():
+                conn.execute(statement)
+        conn.execute(
+            "UPDATE lifecycle_control SET safety_stage='collect',activation_generation=1"
+        )
+        assert read_control(conn).activation_generation == initial.activation_generation + 1
+>       assert identity().migrate_identity_batch(conn) == 0
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_identity.py:435:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32859 user=postgres database=poller_lifecycle_test) at 0x7f030416dc40>
+limit = 500
+
+    def migrate_identity_batch(conn, limit: int = 500) -> int:
+        """Map <=500 legacy jobs (or remaining empty source accounts) atomically.
+
+        The stable listing existence is the checkpoint. A rolled back batch has no
+        checkpoint; a committed batch cannot reset its anchor or cache capture. The
+        migration activation clock is set once by the first explicit batch, not DDL.
+        Inactive boards preserve their old status without guessing why disabled.
+        """
+        if type(limit) is not int or not 1 <= limit <= 500:
+            raise ValueError("identity batch limit must be an integer between 1 and 500")
+        with conn.cursor(row_factory=dict_row) as cur:
+            cur.execute("SELECT pg_advisory_xact_lock(%s)", (LIFECYCLE_GATE_KEY,))
+            control = read_control(conn)
+            if control.safety_stage != "legacy" or control.archive_ever_activated:
+>               raise RuntimeError("legacy mapping requires pre-cutover control state")
+E               RuntimeError: legacy mapping requires pre-cutover control state
+
+job_discovery/lifecycle/identity.py:50: RuntimeError
+_____ test_collect_mapping_is_bounded_restartable_and_preserves_frozen_age _____
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32859 user=postgres database=poller_lifecycle_test) at 0x7f0304172d80>
+
+    @requires_db
+    def test_collect_mapping_is_bounded_restartable_and_preserves_frozen_age(conn):
+        seed(conn, 3)
+        conn.execute("UPDATE lifecycle_control SET safety_stage='collect',activation_generation=1")
+>       assert identity().migrate_identity_batch(conn, 1) == 1
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_identity.py:533:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32859 user=postgres database=poller_lifecycle_test) at 0x7f0304172d80>
+limit = 1
+
+    def migrate_identity_batch(conn, limit: int = 500) -> int:
+        """Map <=500 legacy jobs (or remaining empty source accounts) atomically.
+
+        The stable listing existence is the checkpoint. A rolled back batch has no
+        checkpoint; a committed batch cannot reset its anchor or cache capture. The
+        migration activation clock is set once by the first explicit batch, not DDL.
+        Inactive boards preserve their old status without guessing why disabled.
+        """
+        if type(limit) is not int or not 1 <= limit <= 500:
+            raise ValueError("identity batch limit must be an integer between 1 and 500")
+        with conn.cursor(row_factory=dict_row) as cur:
+            cur.execute("SELECT pg_advisory_xact_lock(%s)", (LIFECYCLE_GATE_KEY,))
+            control = read_control(conn)
+            if control.safety_stage != "legacy" or control.archive_ever_activated:
+>               raise RuntimeError("legacy mapping requires pre-cutover control state")
+E               RuntimeError: legacy mapping requires pre-cutover control state
+
+job_discovery/lifecycle/identity.py:50: RuntimeError
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_identity.py::test_control_history_and_activation_barrier
+FAILED tests/test_lifecycle_identity.py::test_collect_mapping_is_bounded_restartable_and_preserves_frozen_age
+2 failed, 3 passed, 14 deselected in 1.55s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/red-legacy-prune17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/red-legacy-prune17.txt
new file mode 100644
index 0000000..d97ddaf
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/red-legacy-prune17.txt
@@ -0,0 +1,80 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+.........FF...                                                           [100%]
+=================================== FAILURES ===================================
+_ test_mapped_flag_off_legacy_prune_and_direct_delete_preserve_protected_rows __
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32840 user=postgres database=poller_lifecycle_test) at 0x7f2a5d362c00>
+
+    @requires_db
+    def test_mapped_flag_off_legacy_prune_and_direct_delete_preserve_protected_rows(conn):
+        from job_discovery.prune import prune_jobs
+        seed(conn,5)
+        conn.execute("UPDATE jobs SET closed_at=now()-interval '40 days'")
+        user = uuid4()
+        conn.execute("INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (%s,'lever:x:1','v','approve')",(user,))
+        conn.execute("INSERT INTO review_corrections(user_id,job_id,description_snapshot) VALUES (%s,'lever:x:2','protected')",(user,))
+        conn.execute("INSERT INTO application_packages(user_id,job_id) VALUES (%s,'lever:x:3')",(user,))
+        identity().migrate_identity_batch(conn)
+        conn.commit()
+        # Staged compatibility: unmigrated legacy callers may delete pre-cutover
+        # unprotected Jobs. Later gate/cutover must prohibit these identity deletes.
+>       conn.execute("DELETE FROM jobs WHERE id='lever:x:4'")
+
+tests/test_lifecycle_identity.py:212:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32840 user=postgres database=poller_lifecycle_test) at 0x7f2a5d362c00>
+query = "DELETE FROM jobs WHERE id='lever:x:4'", params = None, prepare = None
+binary = False
+
+    def execute(
+        self,
+        query: Query,
+        params: Params | None = None,
+        *,
+        prepare: bool | None = None,
+        binary: bool = False,
+    ) -> Cursor[Row]:
+        """Execute a query and return a cursor to read its results."""
+        try:
+            cur = self.cursor()
+            if binary:
+                cur.format = BINARY
+
+            if isinstance(query, Template):
+                if params is not None:
+                    raise TypeError(
+                        "'execute()' with string template query doesn't support parameters"
+                    )
+                return cur.execute(query, prepare=prepare)
+            else:
+                return cur.execute(query, params, prepare=prepare)
+        except e._NO_TRACEBACK as ex:
+>           raise ex.with_traceback(None)
+E           psycopg.errors.ForeignKeyViolation: update or delete on table "jobs" violates foreign key constraint "source_listings_job_id_fkey" on table "source_listings"
+E           DETAIL:  Key (id)=(lever:x:4) is still referenced from table "source_listings".
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: ForeignKeyViolation
+_ test_mapping_defaults_to_500_and_maps_empty_boards_without_invented_evidence _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32840 user=postgres database=poller_lifecycle_test) at 0x7f2a5d363620>
+
+    @requires_db
+    def test_mapping_defaults_to_500_and_maps_empty_boards_without_invented_evidence(conn):
+        seed(conn,501)
+        conn.execute("INSERT INTO companies(name,ats,token,active) VALUES ('Empty','ashby','empty',false)")
+        assert identity().migrate_identity_batch(conn) == 500
+        assert conn.execute('SELECT count(*) n FROM source_listings').fetchone()['n'] == 500
+        conn.commit()
+        assert identity().migrate_identity_batch(conn) == 1
+        conn.commit()
+        assert identity().migrate_identity_batch(conn) == 1  # Remaining empty board.
+        assert identity().migrate_identity_batch(conn) == 0
+>       assert conn.execute('SELECT count(*) n FROM company_sources').fetchone()['n'] == 2
+E       assert 0 == 2
+
+tests/test_lifecycle_identity.py:233: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_identity.py::test_mapped_flag_off_legacy_prune_and_direct_delete_preserve_protected_rows
+FAILED tests/test_lifecycle_identity.py::test_mapping_defaults_to_500_and_maps_empty_boards_without_invented_evidence
+2 failed, 12 passed in 4.68s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/red17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/red17.txt
new file mode 100644
index 0000000..53c3101
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/red17.txt
@@ -0,0 +1,364 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+...................FFFFFFFFFF                                            [100%]
+=================================== FAILURES ===================================
+__________ test_lifecycle_ddl_does_not_backfill_or_reset_legacy_rows ___________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32838 user=postgres database=poller_lifecycle_test) at 0x7f3553b66030>
+
+    @requires_db
+    def test_lifecycle_ddl_does_not_backfill_or_reset_legacy_rows(conn):
+        module = helpers()
+        module.bootstrap_schema(conn, FROZEN.read_text())
+        cid = conn.execute("INSERT INTO companies(name,ats,token) VALUES ('Legacy','lever','legacy') RETURNING id").fetchone()['id']
+        conn.execute("INSERT INTO jobs(id,company_id,external_id,title,url,description,first_seen_at) VALUES ('legacy',%s,'1','Engineer','u','retained','2020-01-01Z')",(cid,))
+        conn.commit()
+        migration = ROOT / 'migrations/2026-10-03-01-lifecycle-core.sql'
+>       assert migration.exists(), 'additive lifecycle migration absent'
+E       AssertionError: additive lifecycle migration absent
+E       assert False
+E        +  where False = exists()
+E        +    where exists = PosixPath('/workspace/job-board/.claude/worktrees/lifecycle-recovery/migrations/2026-10-03-01-lifecycle-core.sql').exists
+
+tests/test_lifecycle_migrations.py:171: AssertionError
+___________ test_anchor_uses_trustworthy_publication_and_elapsed_utc ___________
+
+    def test_anchor_uses_trustworthy_publication_and_elapsed_utc():
+        now = datetime(2026, 10, 7, tzinfo=UTC)
+        discovered = now - timedelta(days=10)
+        published = now - timedelta(days=30)
+>       anchor, provenance = identity().choose_anchor(published, discovered, now)
+                             ^^^^^^^^^^
+
+tests/test_lifecycle_identity.py:30:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_identity.py:14: in identity
+    return importlib.import_module('job_discovery.lifecycle.identity')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+<frozen importlib._bootstrap>:1310: in _find_and_load_unlocked
+    ???
+<frozen importlib._bootstrap>:488: in _call_with_frames_removed
+    ???
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'job_discovery.lifecycle'
+import_ = <function _gcd_import at 0x7f35565100e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'job_discovery.lifecycle'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+_ test_bounded_mapping_restart_preserves_identity_history_and_cache_provenance _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32838 user=postgres database=poller_lifecycle_test) at 0x7f3553bb56d0>
+
+    @requires_db
+    def test_bounded_mapping_restart_preserves_identity_history_and_cache_provenance(conn):
+        seed(conn, 5)
+        user = uuid4()
+        conn.execute("INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (%s,'lever:x:0','v','approve')", (user,))
+        conn.commit()
+        before = conn.execute('SELECT id,first_seen_at,last_seen_at FROM jobs ORDER BY id').fetchall()
+>       assert identity().migrate_identity_batch(conn, 2) == 2
+               ^^^^^^^^^^
+
+tests/test_lifecycle_identity.py:47:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_identity.py:14: in identity
+    return importlib.import_module('job_discovery.lifecycle.identity')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+<frozen importlib._bootstrap>:1310: in _find_and_load_unlocked
+    ???
+<frozen importlib._bootstrap>:488: in _call_with_frames_removed
+    ???
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'job_discovery.lifecycle'
+import_ = <function _gcd_import at 0x7f35565100e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'job_discovery.lifecycle'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+________________ test_batch_rollback_retry_and_limit_validation ________________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32838 user=postgres database=poller_lifecycle_test) at 0x7f3553bb5400>
+
+    @requires_db
+    def test_batch_rollback_retry_and_limit_validation(conn):
+        seed(conn, 3)
+        conn.commit()
+        for limit in [0, -1, 501, True, 1.5]:
+            with pytest.raises(ValueError):
+>               identity().migrate_identity_batch(conn, limit)
+                ^^^^^^^^^^
+
+tests/test_lifecycle_identity.py:86:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_identity.py:14: in identity
+    return importlib.import_module('job_discovery.lifecycle.identity')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+<frozen importlib._bootstrap>:1310: in _find_and_load_unlocked
+    ???
+<frozen importlib._bootstrap>:488: in _call_with_frames_removed
+    ???
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'job_discovery.lifecycle'
+import_ = <function _gcd_import at 0x7f35565100e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'job_discovery.lifecycle'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+_____________ test_same_id_legacy_upsert_does_not_reset_frozen_age _____________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32838 user=postgres database=poller_lifecycle_test) at 0x7f3553b69b80>
+
+    @requires_db
+    def test_same_id_legacy_upsert_does_not_reset_frozen_age(conn):
+        from job_discovery.db import upsert_job
+        from job_discovery.models import Posting
+        cid = seed(conn)
+>       identity().migrate_identity_batch(conn)
+        ^^^^^^^^^^
+
+tests/test_lifecycle_identity.py:99:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_identity.py:14: in identity
+    return importlib.import_module('job_discovery.lifecycle.identity')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+<frozen importlib._bootstrap>:1310: in _find_and_load_unlocked
+    ???
+<frozen importlib._bootstrap>:488: in _call_with_frames_removed
+    ???
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'job_discovery.lifecycle'
+import_ = <function _gcd_import at 0x7f35565100e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'job_discovery.lifecycle'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+_____ test_capture_version_is_write_disabled_until_safety_and_outbox_exist _____
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32838 user=postgres database=poller_lifecycle_test) at 0x7f3553b6f9b0>
+
+    @requires_db
+    def test_capture_version_is_write_disabled_until_safety_and_outbox_exist(conn):
+>       from job_discovery.lifecycle.types import ClaimRef
+E       ModuleNotFoundError: No module named 'job_discovery.lifecycle'
+
+tests/test_lifecycle_identity.py:108: ModuleNotFoundError
+_______ test_defaults_are_service_owned_and_gucs_do_not_enable_controls ________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32838 user=postgres database=poller_lifecycle_test) at 0x7f3553b6e360>
+
+    @requires_db
+    def test_defaults_are_service_owned_and_gucs_do_not_enable_controls(conn):
+>       from job_discovery.lifecycle.config import read_control
+E       ModuleNotFoundError: No module named 'job_discovery.lifecycle'
+
+tests/test_lifecycle_identity.py:120: ModuleNotFoundError
+______________ test_new_tables_have_rls_and_no_client_privileges _______________
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32838 user=postgres database=poller_lifecycle_test) at 0x7f3553b6c680>
+
+    @requires_db
+    def test_new_tables_have_rls_and_no_client_privileges(conn):
+        tables = ['lifecycle_control','source_accounts','source_listings','job_versions','brands','skills',
+                  'company_brands','company_sources','job_locations','job_skills','identity_assertions','job_payload_demands']
+        for table in tables:
+>           assert conn.execute('SELECT relrowsecurity FROM pg_class WHERE oid=%s::regclass',(table,)).fetchone()['relrowsecurity']
+                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_identity.py:141:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32838 user=postgres database=poller_lifecycle_test) at 0x7f3553b6c680>
+query = 'SELECT relrowsecurity FROM pg_class WHERE oid=%s::regclass'
+params = ('lifecycle_control',), prepare = None, binary = False
+
+    def execute(
+        self,
+        query: Query,
+        params: Params | None = None,
+        *,
+        prepare: bool | None = None,
+        binary: bool = False,
+    ) -> Cursor[Row]:
+        """Execute a query and return a cursor to read its results."""
+        try:
+            cur = self.cursor()
+            if binary:
+                cur.format = BINARY
+
+            if isinstance(query, Template):
+                if params is not None:
+                    raise TypeError(
+                        "'execute()' with string template query doesn't support parameters"
+                    )
+                return cur.execute(query, prepare=prepare)
+            else:
+                return cur.execute(query, params, prepare=prepare)
+        except e._NO_TRACEBACK as ex:
+>           raise ex.with_traceback(None)
+E           psycopg.errors.UndefinedTable: relation "lifecycle_control" does not exist
+E           CONTEXT:  unnamed portal parameter $1 = '...'
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedTable
+________ test_nullable_private_prerequisites_and_flag_off_owner_writes _________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32838 user=postgres database=poller_lifecycle_test) at 0x7f3553bb6d80>
+
+    @requires_db
+    def test_nullable_private_prerequisites_and_flag_off_owner_writes(conn):
+        seed(conn)
+        user, other = uuid4(), uuid4()
+        conn.commit()
+        statements = [
+            "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (%s,'lever:x:0','v','approve')",
+            "INSERT INTO review_corrections(user_id,job_id,verdict) VALUES (%s,'lever:x:0','approve')",
+            "INSERT INTO application_packages(user_id,job_id) VALUES (%s,'lever:x:0')",
+            "INSERT INTO generation_jobs(user_id,job_id,kind) VALUES (%s,'lever:x:0','prepare')",
+            "INSERT INTO resume_scores(user_id,job_id) VALUES (%s,'lever:x:0')",
+            "INSERT INTO cover_letter_edits(user_id,job_id,edited_text) VALUES (%s,'lever:x:0','edit')",
+        ]
+        with as_user(conn,user):
+            for query in statements:
+                conn.execute(query,(user,))
+            for table in ['job_reviews','review_corrections','application_packages','generation_jobs','resume_scores','cover_letter_edits']:
+>               row = conn.execute(f'SELECT job_version_id,description_snapshot,questions_snapshot FROM {table}').fetchone()
+                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_identity.py:170:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32838 user=postgres database=poller_lifecycle_test) at 0x7f3553bb6d80>
+query = 'SELECT job_version_id,description_snapshot,questions_snapshot FROM job_reviews'
+params = None, prepare = None, binary = False
+
+    def execute(
+        self,
+        query: Query,
+        params: Params | None = None,
+        *,
+        prepare: bool | None = None,
+        binary: bool = False,
+    ) -> Cursor[Row]:
+        """Execute a query and return a cursor to read its results."""
+        try:
+            cur = self.cursor()
+            if binary:
+                cur.format = BINARY
+
+            if isinstance(query, Template):
+                if params is not None:
+                    raise TypeError(
+                        "'execute()' with string template query doesn't support parameters"
+                    )
+                return cur.execute(query, prepare=prepare)
+            else:
+                return cur.execute(query, params, prepare=prepare)
+        except e._NO_TRACEBACK as ex:
+>           raise ex.with_traceback(None)
+E           psycopg.errors.UndefinedColumn: column "job_version_id" does not exist
+E           LINE 1: SELECT job_version_id,description_snapshot,questions_snapsho...
+E                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedColumn
+________ test_typed_locations_and_cross_job_version_reference_rejected _________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32838 user=postgres database=poller_lifecycle_test) at 0x7f3553bb5700>
+
+    @requires_db
+    def test_typed_locations_and_cross_job_version_reference_rejected(conn):
+        seed(conn,2)
+>       identity().migrate_identity_batch(conn)
+        ^^^^^^^^^^
+
+tests/test_lifecycle_identity.py:188:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_identity.py:14: in identity
+    return importlib.import_module('job_discovery.lifecycle.identity')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+<frozen importlib._bootstrap>:1310: in _find_and_load_unlocked
+    ???
+<frozen importlib._bootstrap>:488: in _call_with_frames_removed
+    ???
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'job_discovery.lifecycle'
+import_ = <function _gcd_import at 0x7f35565100e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'job_discovery.lifecycle'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_migrations.py::test_lifecycle_ddl_does_not_backfill_or_reset_legacy_rows
+FAILED tests/test_lifecycle_identity.py::test_anchor_uses_trustworthy_publication_and_elapsed_utc
+FAILED tests/test_lifecycle_identity.py::test_bounded_mapping_restart_preserves_identity_history_and_cache_provenance
+FAILED tests/test_lifecycle_identity.py::test_batch_rollback_retry_and_limit_validation
+FAILED tests/test_lifecycle_identity.py::test_same_id_legacy_upsert_does_not_reset_frozen_age
+FAILED tests/test_lifecycle_identity.py::test_capture_version_is_write_disabled_until_safety_and_outbox_exist
+FAILED tests/test_lifecycle_identity.py::test_defaults_are_service_owned_and_gucs_do_not_enable_controls
+FAILED tests/test_lifecycle_identity.py::test_new_tables_have_rls_and_no_client_privileges
+FAILED tests/test_lifecycle_identity.py::test_nullable_private_prerequisites_and_flag_off_owner_writes
+FAILED tests/test_lifecycle_identity.py::test_typed_locations_and_cross_job_version_reference_rejected
+10 failed, 19 passed in 4.38s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/ruff.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/ruff.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/task2-final16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/task2-final16.txt
new file mode 100644
index 0000000..fb3ba22
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/task2-final16.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [ 77%]
+.....................                                                    [100%]
+93 passed in 45.57s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/task2-final17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/task2-final17.txt
new file mode 100644
index 0000000..29f8961
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/task2-final17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 77%]
+.....................                                                    [100%]
+93 passed in 32.88s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/typecheck.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/typecheck.txt
new file mode 100644
index 0000000..b030527
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-evidence/typecheck.txt
@@ -0,0 +1,9 @@
+
+> job-board-dashboard@0.1.0 typecheck
+> tsc --noEmit
+
+npm notice
+npm notice New major version of npm available! 11.9.0 -> 12.2.0
+npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
+npm notice To update run: npm install -g npm@12.2.0
+npm notice
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-report.md
new file mode 100644
index 0000000..156c241
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-2-report.md
@@ -0,0 +1,206 @@
+# Task 2 — additive lifecycle identities and prerequisites
+
+Author scope: Task 2 only, reconstruction from the approved recovered documents.
+Dispatch BASE: `8d1e98424b08f076df736f962ec94f2bf5bd30b8`.
+Worktree: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`.
+Branch: `feature/lifecycle-recovery`. Sole implementation author; independent
+requirements/security reviews belong to the controller after this handoff.
+
+## Delivered behavior
+
+- Ordered additive migration `2026-10-03-01-lifecycle-core.sql` and identical
+  lifecycle definitions appended to `schema.sql`. No corpus UPDATE in the DDL.
+  Frozen-baseline-plus-migrations versus clean-schema catalog parity includes
+  tables, columns, constraints, indexes, RLS, grants, functions and triggers.
+- Service-owned singleton controls with versioned flags, legacy/collect/enforced
+  safety stages, durable archive activation history, archive stages, export flag
+  and activation generation. All behavior flags default false, retirement dry-run
+  defaults true. `read_control` has no environment/GUC override or missing-row
+  default. The invoker-only control-history guard denies deletion/truncation,
+  generation regression and history reset. It blocks enforced/archive activation
+  until later reviewed migrations install their contracts. It is not the Task 3
+  global DML gate or transition API.
+- UUID source accounts/listings/versions, brands/skills, typed company-brand,
+  company-source, job-location and job-skill relationships, reviewed identity
+  assertions. Existing company INT and Job TEXT IDs/private FKs stay intact.
+  `job_locations.location_id` references existing `locations(raw TEXT)`; no new
+  canonical-location resolver or speculative brand/skill evidence.
+- `migrate_identity_batch(conn, limit=500)` explicitly maps at most 500 Jobs per
+  transaction in legacy or collect stage, followed by bounded remaining
+  source-only boards. Enforced or ever-activated archive states fail closed until
+  later reservation/claim/outbox integration exists. Its return count
+  includes source-only identities when a batch has no remaining Jobs. Zero means
+  no pending legacy identity mapping. Callers own commit/rollback and must start
+  their short transaction with this helper. It enters the shared advisory gate
+  (`0x4A4F424C494645`), acquires sorted `hashtextextended('lifecycle:job:' || id,0)`
+  keys, then row/FK locks. Task 3 must reuse these namespaces.
+- Persisted listing existence is the restart checkpoint. Rollback/reconnect/retry
+  and migration reapplication do not duplicate records or reset frozen age.
+  Legacy discovery anchors use original `first_seen_at` with explicitly local
+  legacy provenance. Expiry uses 720 elapsed hours. Source publication and actual
+  observation fields remain NULL, counters start at zero. Historical closures
+  are retained as legacy evidence, not invented complete-source observations.
+- One database-clock migration activation time is recorded by the first explicit
+  mapping batch, not by schema installation. Existing populated caches receive
+  that capture timestamp/provenance; absent descriptions remain NULL. No last-use
+  timestamp is fabricated, and existing capture/use or observation evidence is
+  not overwritten. Legacy timestamps and private records remain unchanged.
+- `choose_anchor` uses aware trustworthy nonfuture publication or local discovery,
+  normalizes UTC and rejects naive discovery/now inputs. `capture_version` is an
+  intentionally write-disabled reserved interface: identical AND changed content
+  return None. Task 2 does not claim real hash dedup/version allocation, readiness,
+  capacity fencing or outbox pairing; those depend on Tasks 3/7/10.
+- Nullable version/snapshot prerequisites exist on reviews, corrections, packages,
+  generation, scores, edits and the early service-only demand queue. Composite FKs
+  reject cross-Job version references; question snapshots reject scalar JSON;
+  ready demands require a version. Existing legacy snapshots are not replaced or
+  relabeled. Shared cache version references also enforce Job identity.
+- Every new table has RLS and explicit revocation from PUBLIC/anon/authenticated.
+  No client grants or SECURITY DEFINER function were added. Catalog and attempted
+  client access/helper-call tests accompany real two-user legacy/private checks.
+
+## Staged legacy compatibility
+
+New listing-to-Job mapping FK uses ON DELETE CASCADE so existing legacy prune and
+service DELETE can still remove pre-cutover unprotected Jobs after mapping. This
+is a provisional mapping while the legacy path remains active, not a claim that
+indefinite lean-identity retention is already enabled. Tests run the actual legacy
+pruner on mapped rows and retain approved/corrected/package records and snapshots.
+No existing private FK was weakened. No version producer is enabled.
+
+Tasks 3/4 must reject identity DELETE at the reviewed cutover and atomically stop
+legacy destructive prune before enabling identity-preserving maintenance. They
+must not enable retention merely because Task 2 mapping has completed. The Task 2
+activation barrier prevents premature enforced/archive activation. Earlier
+unprotected deletions cannot be reconstructed; this implementation does not claim
+to recover that history.
+
+## Necessary compatibility files beyond the initial Task 2 list
+
+The early `job_payload_demands` prerequisite stores user_id, so existing systemic
+RLS and dashboard deletion/export inventories correctly failed when it first
+appeared. Fixed those contracts minimally:
+
+- `tests/test_rls_isolation.py`: explicitly declares the current service-only,
+  no-policy demand contract. The existing catalog inventory remains strict.
+- `dashboard/lib/userScopedTables.ts`: demands join the existing erasure registry.
+  The existing `accountDeletion.ts` service transaction already performs each
+  DELETE with the verified target user parameter. No new privileged importer or
+  authenticated DELETE grant. Real owned-PG SQL tests use that actual registry,
+  retain another user's demand and retain the shared mapped Job.
+- `dashboard/lib/accountExport.ts` and its test: demand projection uses only the
+  existing owner-scoped wrapper in its own transaction, excluding claim tokens.
+  Since Task 2 grants no client read, export explicitly returns
+  `job_payload_demands: null` and a generic `job_payload_demands_error`. Other export
+  data remains available. It never claims an inaccessible table is empty, leaks
+  raw permission/connection details or uses a privileged export bypass. Later
+  reviewed owner access is required for complete demand export.
+
+## Verification chronology
+
+All database commands use `tools/lifecycle_test_db.py` and newly owned Docker
+containers on random loopback ports. No shared setup service/port 55432 was used.
+The harness strips ambient provider/DB credentials; all application data is
+synthetic. Evidence filenames containing `green` or `final` are historical run
+labels, not success assertions; their actual outcomes are listed here.
+
+1. `red17.txt`: PostgreSQL 17.11; new missing module/schema contracts failed as
+   intended: **10 failed, 19 passed**, no skips.
+2. `green17-attempt1.txt`: first implementation **29 passed**, no skips.
+3. `red-legacy-prune17.txt`: mapped legacy DELETE FK restriction and missing typed
+   company-source evidence: **2 failed, 12 passed**, no skips. Fixed with the staged
+   mapping cascade and explicit legacy association mapping, never private FK edits.
+4. `green17.txt` / `green16.txt`: **87 passed, 1 failed**, no skips, on 17.11/16.15:
+   existing systemic RLS guard correctly identified undeclared demand inventory.
+5. `red-account-inventory.txt`: existing account table classification and new honest
+   unavailable-export contract: **2 failed, 33 passed**. Minimal inventory/export
+   fixes followed.
+6. `final16.txt`: **88 passed, 1 failed**, no skips: new erasure fixture omitted the
+   pre-existing required profiles.profile_version value. Corrected the fixture;
+   no production behavior change was needed.
+7. `final16-fixed-fixture.txt`: **89 passed**, zero skipped on PostgreSQL 16.15.
+8. Strengthened mapped-row evidence before the final collect-stage adjustment: `accepted17.txt`, `accepted16.txt`.
+   **89 passed, zero skipped** on each server. Actual versions:
+   PostgreSQL **17.11 (Debian 17.11-1.pgdg13+2)** and PostgreSQL
+   **16.15 (Debian 16.15-1.pgdg13+2)**. Durations: 30.53s / 37.58s.
+9. `account-inventory-green.txt`: **36 passed** in the account deletion/export and
+   service-role allowlist Vitest files. `typecheck.txt`: TypeScript exit 0.
+   `ruff.txt`: repository-wide `ruff check .` exit 0. `git diff --check` passed.
+10. `full17.txt` started before the erasure fixture correction: **930 passed,
+    1 failed, zero skipped** (203.29s). The sole failure was
+    `test_service_account_erasure_inventory_deletes_only_target_demands`, the
+    omitted profile_version fixture value described above. After fixing it, both
+    targeted lanes pass. The complete rerun, justified by that observed fixture
+    failure, is recorded in `accepted-full17.txt`: **931 passed, zero skipped**
+    on PostgreSQL 17.11 in 173.16s. This is explicitly **before** the final focused
+    collect-stage guard adjustment below, not a claim about a full run at final SHA.
+11. Controller staging clarification: explicit mapping must support legacy AND
+    collect, while refusing enforced or sticky archive state. After the full run
+    finished, focused `red-collect17.txt` proved the overly restrictive collect
+    guard: **2 failed, 3 passed, 14 deselected**. Changed only the mapper stage
+    allowance and focused tests; no new claim/capacity bypass or consumer enable.
+    Final complete targeted 17/16 lanes are in `task2-final17.txt` and
+    `task2-final16.txt`: **93 passed, zero skipped on each server**,
+    PostgreSQL 17.11 / 16.15, respectively 32.88s / 45.57s. Both harness
+    commands exited 0, and owned containers were cleaned up. This is the final
+    source/test state verified for Task 2. No third broad suite was needed for
+    the focused guard allowance; Task 13 retains the final whole-branch lanes.
+
+### Exact verification commands
+
+From the worktree, `/bin/bash`, `login:false`:
+
+```sh
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_migrations.py tests/test_lifecycle_identity.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_identity.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_migrations.py tests/test_lifecycle_identity.py tests/test_schema.py tests/test_company_schema.py tests/test_locations_schema.py tests/test_rls_isolation.py tests/test_prune.py tests/test_review_corrections_schema.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_migrations.py tests/test_lifecycle_identity.py tests/test_schema.py tests/test_company_schema.py tests/test_locations_schema.py tests/test_rls_isolation.py tests/test_prune.py tests/test_review_corrections_schema.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_identity.py -k 'collect_mapping or mapping_refuses or control_history' -q
+npm --prefix dashboard test -- lib/accountDeletion.test.ts lib/accountExport.test.ts
+npm --prefix dashboard test -- lib/accountDeletion.test.ts lib/accountExport.test.ts lib/serviceRoleAllowlist.test.ts
+npm --prefix dashboard run typecheck
+.venv/bin/ruff check .
+git diff --check
+```
+
+Each stdout/stderr log is in sibling `task-2-evidence/`; trailing whitespace was
+normalized for Git hygiene without changing results. Reruns use the identical
+commands shown above. Actual server versions are recorded by the harness header.
+
+## Boundaries and remaining gates
+
+- Task 2 only. No Task 3 implementation, subagents, independent author-self-review
+  substitute, production mutation, activation, migration application to Supabase,
+  provider API/paid calls, infrastructure/IAM changes, push/merge or deployment.
+  No Railway files were changed.
+- The mapper has no capacity reservation/claim protocol yet. Legacy/collect
+  mapping is explicit and bounded; enforced or archive-active/ever-activated
+  mapping is refused. Task 3 must integrate the later safety protocol.
+- Version allocation/normalization, all-writer gate/fencing/readiness/capacity,
+  automatic maintenance, hydration, feed consumers and outbox/export are future
+  tasks. Task 2 nullable columns intentionally do not enforce new requirements on
+  flag-off legacy private writes.
+- Demand export remains explicitly unavailable until reviewed owner access exists.
+  The queue has no application producer in this task.
+- Did not run the special dashboard feedback/account-deletion DB suites whose
+  destructive fixture guards target reserved port 55432/specific database names.
+  They require safe harness adaptation in later scope. No skipped DB test is
+  counted as acceptance here. Current account proof is owned-PG representative SQL
+  plus existing nondestructive TS unit/inventory/type checks.
+- Supabase/Postgres security guidance was read; official RLS docs confirmed the
+  separate RLS/grant requirements. The web changelog Markdown fetch was unsupported.
+  Supabase CLI was absent; the approved task's exact ordered migration filename
+  takes precedence over the skill's CLI-generated naming workflow. Real PostgreSQL
+  catalog/role tests were used locally; no linked-project advisor/API was called.
+- Controller must independently review the complete dispatch BASE..HEAD diff for
+  requirements and security before Task 3 begins. The final commit SHA is provided
+  in the author handoff; no history rewriting was performed.
+
+## Final author handoff
+
+Implementation and evidence are committed together using the prescribed forward
+commit message. The full immutable SHA is in the handoff response. Only Task 2
+source/tests/migration/schema/report/evidence were staged; controller ledger,
+dispatch and independent-review artifacts were excluded. No outstanding Task 2
+test failure remains; independent review and later rollout gates remain required.
diff --git a/dashboard/lib/accountExport.test.ts b/dashboard/lib/accountExport.test.ts
index ed89549..a34e2a3 100644
--- a/dashboard/lib/accountExport.test.ts
+++ b/dashboard/lib/accountExport.test.ts
@@ -45,20 +45,21 @@ const DB: Record<string, Record<string, unknown[]>> = {
     profiles: [{ user_id: "empty-user", resume_text: null }],
     job_reviews: [], review_corrections: [], company_reviews: [], company_overrides: [],
     application_packages: [], resume_scores: [], cover_letter_edits: [], usage_counters: [],
     subscriptions: [], review_requests: [], review_runs: [], invite_redemptions: [],
   },
 };
 
 function makeTx(userId: string) {
   const rows = DB[userId] ?? {};
   const pick = (sql: string): unknown[] => {
+    if (/FROM job_payload_demands/.test(sql)) throw new Error("permission denied for table job_payload_demands");
     if (/FROM feedback/.test(sql)) return rows.feedback ?? [];
     if (/FROM matching_activity/.test(sql)) return rows.matching_activity ?? [];
     if (/FROM profiles/.test(sql)) return rows.profiles ?? [];
     if (/FROM job_reviews/.test(sql)) return rows.job_reviews ?? [];
     if (/FROM review_corrections/.test(sql)) return rows.review_corrections ?? [];
     if (/FROM company_reviews/.test(sql)) return rows.company_reviews ?? [];
     if (/FROM company_overrides/.test(sql)) return rows.company_overrides ?? [];
     if (/FROM application_packages/.test(sql)) return rows.application_packages ?? [];
     if (/FROM resume_scores/.test(sql)) return rows.resume_scores ?? [];
     if (/FROM cover_letter_edits/.test(sql)) return rows.cover_letter_edits ?? [];
@@ -144,10 +145,17 @@ describe("buildAccountExport", () => {
     expect(errSpy).toHaveBeenCalled();
     errSpy.mockRestore();
   });
 });
 
 test("exports feedback and activity owned by the account", async () => {
   const result = await buildAccountExport("user-a", "a@x.com", noFiles);
   expect(result).toHaveProperty("feedback", DB["user-a"].feedback);
   expect(result).toHaveProperty("matching_activity", DB["user-a"].matching_activity);
 });
+
+test("reports inaccessible lifecycle demands without claiming a complete empty export", async () => {
+  const result = await buildAccountExport("user-a", "a@x.com", noFiles);
+  expect(result).toHaveProperty("job_payload_demands", null);
+  expect(result).toHaveProperty("job_payload_demands_error", "lifecycle demand export unavailable");
+  expect(JSON.stringify(result)).not.toContain("permission denied");
+});
diff --git a/dashboard/lib/accountExport.ts b/dashboard/lib/accountExport.ts
index 24f192c..b5d8067 100644
--- a/dashboard/lib/accountExport.ts
+++ b/dashboard/lib/accountExport.ts
@@ -37,20 +37,22 @@ export interface AccountExport {
   resume_scores: unknown[];
   cover_letter_edits: unknown[];
   usage_counters: unknown[];
   subscriptions: unknown;
   review_requests: unknown[];
   feedback: unknown[];
   matching_activity: unknown[];
   invite_redemptions: unknown[];
   created_invite_codes: unknown[];
   generation_jobs: unknown[];
+  job_payload_demands: unknown[] | null;
+  job_payload_demands_error: string | null;
   invite_allowances: unknown;
   plan_overrides: unknown;
   review_runs: unknown[];
   resume_files: ResumeFileRef[];
   // Non-null when the résumé-object listing FAILED (storage error / down). Distinguishes
   // "this account has no archived files" (error null, resume_files []) from "we could not
   // read them" (error set) so a swallowed storage fault can't masquerade as an empty,
   // complete export. The user can retry or contact us instead of silently losing files.
   resume_files_error: string | null;
 }
@@ -85,21 +87,21 @@ export async function listResumeFiles(userId: string, expiresIn = 300): Promise<
   const files = data.filter((o) => o.name && o.id !== null); // drop folder placeholders
   const refs: ResumeFileRef[] = [];
   for (const f of files) {
     const path = `${userId}/${f.name}`;
     const { data: signed } = await supabase.storage.from("resumes").createSignedUrl(path, expiresIn);
     refs.push({ path, signedUrl: signed?.signedUrl ?? null });
   }
   return refs;
 }
 
-async function collectUserRows(userId: string): Promise<Omit<AccountExport, "exported_at" | "user_id" | "email" | "resume_files" | "resume_files_error" | "invite_redemptions" | "created_invite_codes">> {
+async function collectUserRows(userId: string): Promise<Omit<AccountExport, "exported_at" | "user_id" | "email" | "resume_files" | "resume_files_error" | "invite_redemptions" | "created_invite_codes" | "job_payload_demands" | "job_payload_demands_error">> {
   return withUserSql(userId, async (tx) => {
     const [
       profiles, jobReviews, reviewCorrections, companyReviews, companyOverrides,
       applicationPackages, resumeScores, coverLetterEdits, usageCounters, subscriptions,
       reviewRequests, generationJobs, inviteAllowances, planOverrides, reviewRuns, feedback, matchingActivity,
     ] = await Promise.all([
       tx`SELECT * FROM profiles WHERE user_id = ${userId}::uuid`,
       tx`SELECT r.*, j.title AS job_title, COALESCE(c.display_name, c.name) AS company_name, j.url AS job_url
          FROM job_reviews r JOIN jobs j ON j.id = r.job_id JOIN companies c ON c.id = j.company_id
          WHERE r.user_id = ${userId}::uuid ORDER BY r.reviewed_at DESC`,
@@ -146,20 +148,39 @@ async function collectUserRows(userId: string): Promise<Omit<AccountExport, "exp
       feedback: feedback as unknown[],
       matching_activity: matchingActivity as unknown[],
       generation_jobs: generationJobs as unknown[],
       invite_allowances: (inviteAllowances[0] as unknown) ?? null,
       plan_overrides: (planOverrides[0] as unknown) ?? null,
       review_runs: reviewRuns as unknown[],
     };
   });
 }
 
+/**
+ * Task2 installs demand prerequisites with no client privileges. Keep the normal
+ * owner-scoped wrapper and report unavailable data explicitly, without inventing
+ * an empty export or broadening service privileges. A later reviewed owner-read
+ * contract can make this same projection available. Never export claim tokens.
+ */
+async function collectLifecycleDemands(userId: string): Promise<Pick<AccountExport, "job_payload_demands" | "job_payload_demands_error">> {
+  try {
+    const rows = await withUserSql(userId, async (tx) =>
+      tx`SELECT id, job_id, kind, status, created_at, settled_at, job_version_id,
+                description_snapshot, questions_snapshot, snapshot_captured_at
+         FROM job_payload_demands WHERE user_id = ${userId}::uuid ORDER BY created_at DESC`,
+    );
+    return { job_payload_demands: Array.from(rows), job_payload_demands_error: null };
+  } catch {
+    return { job_payload_demands: null, job_payload_demands_error: "lifecycle demand export unavailable" };
+  }
+}
+
 /**
  * invite_redemptions is service-role-only under RLS (no authenticated grant), so read
  * it in its OWN withUserSql transaction guarded against a permission error — a blocked
  * read yields an empty array rather than poisoning the main export transaction. The row
  * only holds the user's own email + invite code, so an empty result is harmless.
  */
 async function collectInviteRedemptions(userId: string): Promise<unknown[]> {
   try {
     return await withUserSql(userId, async (tx) => {
       const rows = await tx`SELECT * FROM invite_redemptions WHERE user_id = ${userId}::uuid`;
@@ -183,36 +204,38 @@ async function collectCreatedInviteCodes(userId: string): Promise<unknown[]> {
 /**
  * Build the full export payload for `userId`. `resumeFiles` is injectable so the lib
  * test can supply a stub without a storage backend; the route uses the default
  * (listResumeFiles → the caller's own résumé prefix).
  */
 export async function buildAccountExport(
   userId: string,
   email: string | null,
   resumeFiles: (uid: string) => Promise<ResumeFileRef[]> = listResumeFiles,
 ): Promise<AccountExport> {
-  const [rows, invites, createdCodes, filesResult] = await Promise.all([
+  const [rows, invites, createdCodes, filesResult, lifecycleDemands] = await Promise.all([
     collectUserRows(userId),
     collectInviteRedemptions(userId),
     collectCreatedInviteCodes(userId),
     // Capture a storage failure as a GENERIC marker rather than swallowing it to [] — an
     // empty list must mean "no files", not "we couldn't read them". The full error is
     // logged server-side; the marker shipped in the export is a fixed string, never the
     // raw storage message (minor 7 / T5).
     resumeFiles(userId)
       .then((files) => ({ files, error: null as string | null }))
       .catch((e) => {
         console.error("account export: résumé files could not be listed", e);
         return { files: [] as ResumeFileRef[], error: "résumé files could not be listed" };
       }),
+    collectLifecycleDemands(userId),
   ]);
   return {
     exported_at: new Date().toISOString(),
     user_id: userId,
     email,
     ...rows,
+    ...lifecycleDemands,
     invite_redemptions: invites,
     created_invite_codes: createdCodes,
     resume_files: filesResult.files,
     resume_files_error: filesResult.error,
   };
 }
diff --git a/dashboard/lib/userScopedTables.ts b/dashboard/lib/userScopedTables.ts
index 1b81496..d27b306 100644
--- a/dashboard/lib/userScopedTables.ts
+++ b/dashboard/lib/userScopedTables.ts
@@ -25,20 +25,23 @@ export const USER_DELETE_TABLES = [
   // Cover-letter edit overlay (owner data; the golden push is a separate LangFuse copy).
   "cover_letter_edits",
   "usage_counters",
   "subscriptions",
   "review_requests",
   "feedback",
   "matching_activity",
   "invite_redemptions",
   // Async-generation status rows (transient; most are pruned within a day anyway).
   "generation_jobs",
+  // Service-only lifecycle demand/snapshot prerequisite; the existing privileged
+  // account-erasure loop deletes only the verified caller's rows.
+  "job_payload_demands",
   // Per-user invite budget (user-sent invites). The codes a user MINTED are handled
   // separately in accountDeletion.ts (anonymized, never deleted).
   "invite_allowances",
   // Operator-pinned effective tier. Deleting the row with the account is correct:
   // a pin for an erased user is meaningless, and absence is the well-defined state.
   "plan_overrides",
 ] as const;
 
 /** Tables whose rows are kept but de-identified (user_id → NULL) on deletion. */
 export const USER_ANONYMIZE_TABLES = ["review_runs"] as const;
diff --git a/job_discovery/lifecycle/__init__.py b/job_discovery/lifecycle/__init__.py
new file mode 100644
index 0000000..33363b5
--- /dev/null
+++ b/job_discovery/lifecycle/__init__.py
@@ -0,0 +1 @@
+"""Additive lifecycle infrastructure; consumers remain disabled by default."""
diff --git a/job_discovery/lifecycle/config.py b/job_discovery/lifecycle/config.py
new file mode 100644
index 0000000..42e9fb6
--- /dev/null
+++ b/job_discovery/lifecycle/config.py
@@ -0,0 +1,37 @@
+"""Service-owned persisted controls; no environment or caller-GUC overrides."""
+
+from dataclasses import dataclass
+from datetime import datetime
+
+from psycopg.rows import dict_row
+
+# Shared transaction gate identity for subsequent safety/claims/capacity modules.
+LIFECYCLE_GATE_KEY = 0x4A4F424C494645
+
+
+@dataclass(frozen=True)
+class LifecycleControl:
+    flags_version: int
+    safety_stage: str
+    identity_enabled: bool
+    source_enabled: bool
+    maintenance_enabled: bool
+    hydration_enabled: bool
+    feed_enabled: bool
+    retirement_enabled: bool
+    retirement_dry_run: bool
+    archive_ever_activated: bool
+    archive_stage: str
+    export_enabled: bool
+    activation_generation: int
+    identity_migration_activated_at: datetime | None
+
+
+def read_control(conn) -> LifecycleControl:
+    with conn.cursor(row_factory=dict_row) as cur:
+        cur.execute("SELECT * FROM lifecycle_control WHERE singleton")
+        row = cur.fetchone()
+    if row is None:
+        raise RuntimeError("lifecycle control is missing; refusing implicit defaults")
+    row.pop("singleton")
+    return LifecycleControl(**row)
diff --git a/job_discovery/lifecycle/identity.py b/job_discovery/lifecycle/identity.py
new file mode 100644
index 0000000..acf4b0b
--- /dev/null
+++ b/job_discovery/lifecycle/identity.py
@@ -0,0 +1,179 @@
+"""Explicit, bounded legacy compatibility mapping. Never reconstruct history.
+
+The caller owns commit/rollback and must invoke mapping as the first operation of
+its short transaction. Runtime polling does not call this migration helper.
+"""
+
+from datetime import UTC, datetime, timedelta
+from uuid import UUID
+
+from psycopg.rows import dict_row
+
+from .config import LIFECYCLE_GATE_KEY, read_control
+from .types import ClaimRef
+
+
+def choose_anchor(
+    published_at: datetime | None, discovered_at: datetime, now: datetime
+) -> tuple[datetime, str]:
+    for value in (discovered_at, now):
+        if (
+            not isinstance(value, datetime)
+            or value.tzinfo is None
+            or value.utcoffset() is None
+        ):
+            raise ValueError("discovery and now require timezone-aware datetimes")
+    if (
+        isinstance(published_at, datetime)
+        and published_at.tzinfo is not None
+        and published_at.utcoffset() is not None
+        and published_at <= now
+    ):
+        return published_at.astimezone(UTC), "source_published"
+    return discovered_at.astimezone(UTC), "local_observation"
+
+
+def migrate_identity_batch(conn, limit: int = 500) -> int:
+    """Map <=500 legacy jobs (or remaining empty source accounts) atomically.
+
+    The stable listing existence is the checkpoint. A rolled back batch has no
+    checkpoint; a committed batch cannot reset its anchor or cache capture. The
+    migration activation clock is set once by the first explicit batch, not DDL.
+    Inactive boards preserve their old status without guessing why disabled.
+    Legacy/collect mapping has no reservation or claim protocol yet: enforced or
+    ever-activated archive states are rejected until later safety integration.
+    """
+    if type(limit) is not int or not 1 <= limit <= 500:
+        raise ValueError("identity batch limit must be an integer between 1 and 500")
+    with conn.cursor(row_factory=dict_row) as cur:
+        cur.execute("SELECT pg_advisory_xact_lock(%s)", (LIFECYCLE_GATE_KEY,))
+        control = read_control(conn)
+        if (
+            control.safety_stage not in {"legacy", "collect"}
+            or control.archive_ever_activated
+        ):
+            raise RuntimeError("legacy mapping requires pre-cutover control state")
+        cur.execute(
+            """SELECT j.*, c.ats, c.token, c.active, c.poll_failures
+            FROM jobs j JOIN companies c ON c.id=j.company_id
+            WHERE NOT EXISTS (SELECT 1 FROM source_listings l WHERE l.job_id=j.id)
+            ORDER BY j.id LIMIT %s""",
+            (limit,),
+        )
+        rows = cur.fetchall()
+        # Reserve sorted namespaced Job keys before taking any Job/FK locks.
+        # Task3's global BEFORE STATEMENT gate will extend this order to callers.
+        for job in rows:
+            cur.execute(
+                "SELECT pg_advisory_xact_lock(hashtextextended(%s,0))",
+                ("lifecycle:job:" + job["id"],),
+            )
+        cur.execute("""UPDATE lifecycle_control
+            SET identity_migration_activated_at = clock_timestamp()
+            WHERE singleton AND identity_migration_activated_at IS NULL
+            RETURNING identity_migration_activated_at""")
+        activation = read_control(conn).identity_migration_activated_at
+        if rows:
+            cur.execute(
+                "SELECT id FROM jobs WHERE id=ANY(%s) ORDER BY id FOR UPDATE",
+                ([job["id"] for job in rows],),
+            )
+        for job in rows:
+            cur.execute(
+                """INSERT INTO source_accounts
+                (legacy_company_id,ats,public_board_ref,legacy_active,exclusion_state,failure_streak)
+                VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (ats,public_board_ref) DO NOTHING""",
+                (
+                    job["company_id"],
+                    job["ats"],
+                    job["token"],
+                    job["active"],
+                    "enabled" if job["active"] else "unknown",
+                    job["poll_failures"],
+                ),
+            )
+            cur.execute(
+                "SELECT id FROM source_accounts WHERE ats=%s AND public_board_ref=%s",
+                (job["ats"], job["token"]),
+            )
+            source_id = cur.fetchone()["id"]
+            _map_company_source(
+                cur, job["company_id"], source_id, job["ats"], job["token"]
+            )
+            cur.execute(
+                """INSERT INTO source_listings(source_account_id,external_id,job_id,
+                original_discovered_at,discovery_anchor_at,discovery_anchor_provenance,
+                discovery_expires_at,legacy_closed_at)
+                VALUES (%s,%s,%s,%s,%s,'legacy_local_observation',%s,%s)""",
+                (
+                    source_id,
+                    job["external_id"],
+                    job["id"],
+                    job["first_seen_at"],
+                    job["first_seen_at"],
+                    job["first_seen_at"].astimezone(UTC) + timedelta(days=30),
+                    job["closed_at"],
+                ),
+            )
+            # No actual use or source publication/observation is inferred.
+            cur.execute(
+                """UPDATE jobs SET description_captured_at=%s,
+                description_capture_provenance='migration_activation'
+                WHERE id=%s AND description IS NOT NULL AND description_captured_at IS NULL
+                  AND description_last_used_at IS NULL""",
+                (activation, job["id"]),
+            )
+            cur.execute(
+                """UPDATE job_questions SET captured_at=%s,
+                capture_provenance='migration_activation'
+                WHERE job_id=%s AND captured_at IS NULL AND last_used_at IS NULL""",
+                (activation, job["id"]),
+            )
+        if rows:
+            return len(rows)
+        # Source-only boards also need a stable coordinate. Count these only in
+        # batches with no jobs so a zero return means the whole mapping is done.
+        cur.execute(
+            """INSERT INTO source_accounts
+            (legacy_company_id,ats,public_board_ref,legacy_active,exclusion_state,failure_streak)
+            SELECT c.id,c.ats,c.token,c.active,CASE WHEN c.active THEN 'enabled' ELSE 'unknown' END,c.poll_failures
+            FROM companies c WHERE NOT EXISTS
+              (SELECT 1 FROM source_accounts s WHERE s.ats=c.ats AND s.public_board_ref=c.token)
+            ORDER BY c.id LIMIT %s ON CONFLICT (ats,public_board_ref) DO NOTHING
+            RETURNING id,legacy_company_id,ats,public_board_ref""",
+            (limit,),
+        )
+        accounts = cur.fetchall()
+        for account in accounts:
+            _map_company_source(
+                cur,
+                account["legacy_company_id"],
+                account["id"],
+                account["ats"],
+                account["public_board_ref"],
+            )
+        return len(accounts)
+
+
+def _map_company_source(cur, company_id, source_id, ats, board_ref):
+    # This records the existing typed legacy board association, not inferred
+    # employer identity or a manufactured source-observation timestamp.
+    cur.execute(
+        """INSERT INTO company_sources
+        (company_id,source_account_id,evidence_kind,public_evidence_ref,status)
+        VALUES (%s,%s,'legacy_mapping',%s,'accepted')
+        ON CONFLICT (company_id,source_account_id) DO NOTHING""",
+        (company_id, source_id, f"{ats}:{board_ref}"),
+    )
+
+
+def capture_version(
+    conn, listing_id: UUID, metadata: dict, observed_at: datetime, claim: ClaimRef
+) -> UUID | None:
+    """Reserved interface: no version writes until gated writers/outbox exist.
+
+    Identical and changed content both return None at this intermediate stage.
+    No flag/GUC enables an unfenced write implementation.
+    """
+    read_control(conn)  # Missing/unreadable control must fail closed.
+    return None
diff --git a/job_discovery/lifecycle/types.py b/job_discovery/lifecycle/types.py
new file mode 100644
index 0000000..68bbc32
--- /dev/null
+++ b/job_discovery/lifecycle/types.py
@@ -0,0 +1,52 @@
+"""Stable shared references. Lease decisions always use database time."""
+
+from dataclasses import dataclass
+from datetime import datetime
+from uuid import UUID
+
+
+@dataclass(frozen=True)
+class ClaimRef:
+    owner_token: str
+    generation: int
+    lease_until: datetime
+
+
+@dataclass(frozen=True)
+class ReservationRef:
+    id: UUID
+    claim: ClaimRef
+    bytes: int
+
+
+@dataclass(frozen=True)
+class EnumerationRef:
+    id: UUID
+    source_id: UUID
+    sequence: int
+    claim: ClaimRef
+
+
+@dataclass(frozen=True)
+class Observation:
+    id: str
+    listing_id: UUID
+    kind: str
+    observed_at: datetime
+
+
+@dataclass(frozen=True)
+class DemandRef:
+    id: UUID
+    job_id: str
+    kind: str
+    claim: ClaimRef | None
+    status: str
+
+
+@dataclass(frozen=True)
+class SweepResult:
+    retired_rows: int
+    retired_bytes: int
+    blocked: bool
+    cursor: str | None
diff --git a/migrations/2026-10-03-01-lifecycle-core.sql b/migrations/2026-10-03-01-lifecycle-core.sql
new file mode 100644
index 0000000..e8aeea8
--- /dev/null
+++ b/migrations/2026-10-03-01-lifecycle-core.sql
@@ -0,0 +1,430 @@
+BEGIN;
+-- Additive prerequisites only. No corpus UPDATE, version capture or consumer cutover.
+-- Explicit bounded mapping is job_discovery.lifecycle.identity.migrate_identity_batch.
+CREATE TABLE IF NOT EXISTS lifecycle_control (
+  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
+  flags_version INTEGER NOT NULL DEFAULT 1 CHECK (flags_version > 0),
+  safety_stage TEXT NOT NULL DEFAULT 'legacy' CHECK (safety_stage IN ('legacy','collect','enforced')),
+  identity_enabled BOOLEAN NOT NULL DEFAULT false,
+  source_enabled BOOLEAN NOT NULL DEFAULT false,
+  maintenance_enabled BOOLEAN NOT NULL DEFAULT false,
+  hydration_enabled BOOLEAN NOT NULL DEFAULT false,
+  feed_enabled BOOLEAN NOT NULL DEFAULT false,
+  retirement_enabled BOOLEAN NOT NULL DEFAULT false,
+  retirement_dry_run BOOLEAN NOT NULL DEFAULT true,
+  archive_ever_activated BOOLEAN NOT NULL DEFAULT false,
+  archive_stage TEXT NOT NULL DEFAULT 'never_activated'
+    CHECK (archive_stage IN ('never_activated','active','producer_paused')),
+  export_enabled BOOLEAN NOT NULL DEFAULT false,
+  activation_generation BIGINT NOT NULL DEFAULT 0 CHECK (activation_generation >= 0),
+  identity_migration_activated_at TIMESTAMPTZ,
+  CHECK (archive_ever_activated = (archive_stage <> 'never_activated')),
+  CHECK (NOT export_enabled OR archive_ever_activated)
+);
+INSERT INTO lifecycle_control(singleton) VALUES (true) ON CONFLICT DO NOTHING;
+
+-- A small invoker-only guard protects durable control history. Task 3 owns the
+-- gated transition API/readiness validation; no producer can be activated here.
+CREATE OR REPLACE FUNCTION preserve_lifecycle_control() RETURNS trigger
+LANGUAGE plpgsql SET search_path = pg_catalog AS $$
+BEGIN
+  IF TG_OP IN ('DELETE','TRUNCATE') THEN
+    RAISE EXCEPTION 'lifecycle control history cannot be removed';
+  END IF;
+  IF OLD.archive_ever_activated AND NOT NEW.archive_ever_activated THEN
+    RAISE EXCEPTION 'archive activation history is monotonic';
+  END IF;
+  IF OLD.identity_migration_activated_at IS NOT NULL AND
+     NEW.identity_migration_activated_at IS DISTINCT FROM OLD.identity_migration_activated_at THEN
+    RAISE EXCEPTION 'identity migration activation is immutable';
+  END IF;
+  IF NEW.activation_generation < OLD.activation_generation OR NEW.flags_version < OLD.flags_version THEN
+    RAISE EXCEPTION 'control generation and schema version are monotonic';
+  END IF;
+  IF (to_jsonb(NEW) - 'identity_migration_activated_at') IS DISTINCT FROM
+     (to_jsonb(OLD) - 'identity_migration_activated_at') AND
+     NEW.activation_generation <= OLD.activation_generation THEN
+    RAISE EXCEPTION 'control changes require a newer activation generation';
+  END IF;
+  -- No active safety/outbox contract exists at this schema stage. Later ordered
+  -- safety/outbox migrations replace this activation barrier after review.
+  IF NEW.safety_stage = 'enforced' OR NEW.archive_stage <> 'never_activated' OR NEW.export_enabled THEN
+    RAISE EXCEPTION 'lifecycle activation requires installed safety and outbox contracts';
+  END IF;
+  RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION preserve_lifecycle_control() FROM PUBLIC, anon, authenticated;
+DROP TRIGGER IF EXISTS lifecycle_control_history ON lifecycle_control;
+CREATE TRIGGER lifecycle_control_history BEFORE UPDATE OR DELETE ON lifecycle_control
+FOR EACH ROW EXECUTE FUNCTION preserve_lifecycle_control();
+DROP TRIGGER IF EXISTS lifecycle_control_no_truncate ON lifecycle_control;
+CREATE TRIGGER lifecycle_control_no_truncate BEFORE TRUNCATE ON lifecycle_control
+FOR EACH STATEMENT EXECUTE FUNCTION preserve_lifecycle_control();
+
+CREATE TABLE IF NOT EXISTS source_accounts (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  legacy_company_id INTEGER REFERENCES companies(id),
+  ats TEXT NOT NULL CHECK (ats IN ('greenhouse','lever','ashby','workable','smartrecruiters','workday')),
+  public_board_ref TEXT NOT NULL,
+  public_url TEXT,
+  legacy_active BOOLEAN,
+  exclusion_state TEXT NOT NULL DEFAULT 'unknown' CHECK (exclusion_state IN ('unknown','enabled','failure_disabled','deliberate')),
+  last_attempt_at TIMESTAMPTZ,
+  last_complete_success_at TIMESTAMPTZ,
+  last_outcome TEXT,
+  next_due_at TIMESTAMPTZ,
+  suspicious_empty_streak INTEGER NOT NULL DEFAULT 0 CHECK (suspicious_empty_streak >= 0),
+  failure_streak INTEGER NOT NULL DEFAULT 0 CHECK (failure_streak >= 0),
+  claim_owner_token TEXT,
+  claim_generation BIGINT NOT NULL DEFAULT 0 CHECK (claim_generation >= 0),
+  lease_until TIMESTAMPTZ,
+  current_revision BIGINT NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
+  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND current_revision),
+  enumeration_sequence BIGINT NOT NULL DEFAULT 0 CHECK (enumeration_sequence >= 0),
+  replay_floor BIGINT NOT NULL DEFAULT 0 CHECK (replay_floor >= 0),
+  reconciliation_cursor TEXT,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  UNIQUE (ats, public_board_ref),
+  CHECK ((claim_owner_token IS NULL) = (lease_until IS NULL))
+);
+CREATE INDEX IF NOT EXISTS idx_source_accounts_legacy ON source_accounts(legacy_company_id);
+CREATE INDEX IF NOT EXISTS idx_source_accounts_due ON source_accounts(next_due_at,last_complete_success_at,id);
+
+CREATE TABLE IF NOT EXISTS source_listings (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  source_account_id UUID NOT NULL REFERENCES source_accounts(id),
+  external_id TEXT NOT NULL,
+  -- Pre-cutover mapping follows legacy deletion. Task3/4 must reject Job
+  -- DELETE at identity-preserving cutover; never weaken existing private FKs.
+  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
+  current_version_id UUID,
+  current_revision BIGINT NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
+  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND current_revision),
+  original_discovered_at TIMESTAMPTZ NOT NULL,
+  source_published_at TIMESTAMPTZ,
+  source_published_provenance TEXT,
+  discovery_anchor_at TIMESTAMPTZ NOT NULL,
+  discovery_anchor_provenance TEXT NOT NULL
+    CHECK (discovery_anchor_provenance IN ('legacy_local_observation','local_observation','source_published')),
+  discovery_expires_at TIMESTAMPTZ NOT NULL,
+  successful_last_observed_at TIMESTAMPTZ,
+  successful_sighting_count BIGINT NOT NULL DEFAULT 0 CHECK (successful_sighting_count >= 0),
+  content_changed_at TIMESTAMPTZ,
+  content_hash TEXT CHECK (content_hash ~ '^[0-9a-f]{64}$'),
+  consecutive_complete_misses INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_complete_misses >= 0),
+  first_complete_miss_at TIMESTAMPTZ,
+  last_miss_enumeration_id UUID,
+  last_membership_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_membership_sequence >= 0),
+  last_complete_miss_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_complete_miss_sequence >= 0),
+  last_direct_verification_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_direct_verification_sequence >= 0),
+  source_availability TEXT NOT NULL DEFAULT 'unknown' CHECK (source_availability IN ('open','unknown','closed')),
+  legacy_closed_at TIMESTAMPTZ,
+  payload_retired_at TIMESTAMPTZ,
+  suspected_id_reuse BOOLEAN NOT NULL DEFAULT false,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  UNIQUE (source_account_id,external_id),
+  UNIQUE (id,job_id),
+  CHECK (discovery_expires_at = discovery_anchor_at + interval '720 hours'),
+  CHECK ((source_published_at IS NULL) = (source_published_provenance IS NULL))
+);
+CREATE INDEX IF NOT EXISTS idx_source_listings_job ON source_listings(job_id);
+CREATE INDEX IF NOT EXISTS idx_source_listings_expiry ON source_listings(discovery_expires_at,id);
+CREATE INDEX IF NOT EXISTS idx_source_listings_source_availability ON source_listings(source_account_id,source_availability,id);
+
+CREATE TABLE IF NOT EXISTS job_versions (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  job_id TEXT NOT NULL REFERENCES jobs(id),
+  source_listing_id UUID NOT NULL,
+  revision BIGINT NOT NULL CHECK (revision > 0),
+  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
+  public_metadata JSONB NOT NULL CHECK (jsonb_typeof(public_metadata) = 'object'),
+  observed_at TIMESTAMPTZ NOT NULL,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  payload_ref TEXT,
+  payload_expires_at TIMESTAMPTZ,
+  UNIQUE (source_listing_id,revision),
+  UNIQUE (id,job_id),
+  UNIQUE (id,source_listing_id),
+  FOREIGN KEY (source_listing_id,job_id) REFERENCES source_listings(id,job_id),
+  CHECK ((payload_ref IS NULL) = (payload_expires_at IS NULL))
+);
+CREATE INDEX IF NOT EXISTS idx_job_versions_job ON job_versions(job_id);
+CREATE INDEX IF NOT EXISTS idx_job_versions_recorded ON job_versions(recorded_at,id);
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='source_listings'::regclass AND conname='source_listings_current_version_fk') THEN
+    ALTER TABLE source_listings ADD CONSTRAINT source_listings_current_version_fk
+      FOREIGN KEY (current_version_id,id) REFERENCES job_versions(id,source_listing_id);
+  END IF;
+END $$;
+
+CREATE TABLE IF NOT EXISTS brands (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL
+);
+CREATE TABLE IF NOT EXISTS skills (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), canonical_name TEXT NOT NULL UNIQUE
+);
+
+CREATE TABLE IF NOT EXISTS company_brands (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  company_id INTEGER NOT NULL REFERENCES companies(id),
+  brand_id UUID NOT NULL REFERENCES brands(id),
+  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('structured_source','reviewed_public','legacy_mapping')),
+  public_evidence_ref TEXT NOT NULL,
+  observed_at TIMESTAMPTZ,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  valid_from TIMESTAMPTZ,
+  valid_to TIMESTAMPTZ,
+  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retracted')),
+  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
+  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
+  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND revision),
+  UNIQUE (company_id,brand_id),
+  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
+);
+CREATE INDEX IF NOT EXISTS idx_company_brands_right ON company_brands(brand_id);
+
+CREATE TABLE IF NOT EXISTS company_sources (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  company_id INTEGER NOT NULL REFERENCES companies(id),
+  source_account_id UUID NOT NULL REFERENCES source_accounts(id),
+  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('structured_source','reviewed_public','legacy_mapping')),
+  public_evidence_ref TEXT NOT NULL,
+  observed_at TIMESTAMPTZ,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  valid_from TIMESTAMPTZ,
+  valid_to TIMESTAMPTZ,
+  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retracted')),
+  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
+  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
+  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND revision),
+  UNIQUE (company_id,source_account_id),
+  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
+);
+CREATE INDEX IF NOT EXISTS idx_company_sources_right ON company_sources(source_account_id);
+
+CREATE TABLE IF NOT EXISTS job_locations (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  job_version_id UUID NOT NULL REFERENCES job_versions(id),
+  location_id TEXT NOT NULL REFERENCES locations(raw),
+  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('structured_source','reviewed_public','legacy_mapping')),
+  public_evidence_ref TEXT NOT NULL,
+  observed_at TIMESTAMPTZ,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  valid_from TIMESTAMPTZ,
+  valid_to TIMESTAMPTZ,
+  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retracted')),
+  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
+  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
+  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND revision),
+  UNIQUE (job_version_id,location_id),
+  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
+);
+CREATE INDEX IF NOT EXISTS idx_job_locations_right ON job_locations(location_id);
+
+CREATE TABLE IF NOT EXISTS job_skills (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  job_version_id UUID NOT NULL REFERENCES job_versions(id),
+  skill_id UUID NOT NULL REFERENCES skills(id),
+  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('structured_source','reviewed_public','legacy_mapping')),
+  public_evidence_ref TEXT NOT NULL,
+  observed_at TIMESTAMPTZ,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  valid_from TIMESTAMPTZ,
+  valid_to TIMESTAMPTZ,
+  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retracted')),
+  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
+  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
+  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND revision),
+  UNIQUE (job_version_id,skill_id),
+  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
+);
+CREATE INDEX IF NOT EXISTS idx_job_skills_right ON job_skills(skill_id);
+
+CREATE TABLE IF NOT EXISTS identity_assertions (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  left_listing_id UUID NOT NULL REFERENCES source_listings(id),
+  right_listing_id UUID NOT NULL REFERENCES source_listings(id),
+  relation TEXT NOT NULL CHECK (relation IN ('same_job','repost_of','source_migration')),
+  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('structured_source','reviewed_public')),
+  public_evidence_ref TEXT NOT NULL,
+  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retracted')),
+  observed_at TIMESTAMPTZ,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  reviewed_at TIMESTAMPTZ,
+  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
+  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND revision),
+  CHECK (left_listing_id <> right_listing_id),
+  CHECK (status <> 'accepted' OR (evidence_kind = 'reviewed_public' AND reviewed_at IS NOT NULL)),
+  UNIQUE (left_listing_id,right_listing_id,relation)
+);
+CREATE INDEX IF NOT EXISTS idx_identity_assertions_right ON identity_assertions(right_listing_id);
+
+ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_captured_at TIMESTAMPTZ;
+ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_last_used_at TIMESTAMPTZ;
+ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_capture_provenance TEXT;
+ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_version_id UUID;
+ALTER TABLE job_questions ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;
+ALTER TABLE job_questions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
+ALTER TABLE job_questions ADD COLUMN IF NOT EXISTS capture_provenance TEXT;
+ALTER TABLE job_questions ADD COLUMN IF NOT EXISTS job_version_id UUID;
+
+-- Prerequisite queue, kept service-only until Task 3 adds its owner access API.
+CREATE TABLE IF NOT EXISTS job_payload_demands (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  user_id UUID NOT NULL,
+  job_id TEXT NOT NULL REFERENCES jobs(id),
+  kind TEXT NOT NULL CHECK (kind IN ('description','questions','review','prepare','generation')),
+  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','ready','deferred','failed','cancelled')),
+  claim_owner_token TEXT,
+  claim_generation BIGINT NOT NULL DEFAULT 0 CHECK (claim_generation >= 0),
+  lease_until TIMESTAMPTZ,
+  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  settled_at TIMESTAMPTZ,
+  CHECK ((claim_owner_token IS NULL) = (lease_until IS NULL))
+);
+CREATE INDEX IF NOT EXISTS idx_job_payload_demands_job ON job_payload_demands(job_id,status);
+CREATE INDEX IF NOT EXISTS idx_job_payload_demands_owner ON job_payload_demands(user_id,status);
+CREATE INDEX IF NOT EXISTS idx_job_payload_demands_terminal ON job_payload_demands(settled_at) WHERE settled_at IS NOT NULL;
+CREATE UNIQUE INDEX IF NOT EXISTS one_active_payload_demand ON job_payload_demands(user_id,job_id,kind) WHERE status IN ('pending','running');
+
+ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS job_version_id UUID;
+ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
+ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
+ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='job_reviews'::regclass AND conname='job_reviews_version_job_fk') THEN
+    ALTER TABLE job_reviews ADD CONSTRAINT job_reviews_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+    ALTER TABLE job_reviews ADD CONSTRAINT job_reviews_questions_shape
+      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_job_reviews_version ON job_reviews(job_version_id) WHERE job_version_id IS NOT NULL;
+
+ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS job_version_id UUID;
+ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
+ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
+ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='review_corrections'::regclass AND conname='review_corrections_version_job_fk') THEN
+    ALTER TABLE review_corrections ADD CONSTRAINT review_corrections_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+    ALTER TABLE review_corrections ADD CONSTRAINT review_corrections_questions_shape
+      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_review_corrections_version ON review_corrections(job_version_id) WHERE job_version_id IS NOT NULL;
+
+ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS job_version_id UUID;
+ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
+ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
+ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='application_packages'::regclass AND conname='application_packages_version_job_fk') THEN
+    ALTER TABLE application_packages ADD CONSTRAINT application_packages_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+    ALTER TABLE application_packages ADD CONSTRAINT application_packages_questions_shape
+      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_application_packages_version ON application_packages(job_version_id) WHERE job_version_id IS NOT NULL;
+
+ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS job_version_id UUID;
+ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
+ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
+ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='generation_jobs'::regclass AND conname='generation_jobs_version_job_fk') THEN
+    ALTER TABLE generation_jobs ADD CONSTRAINT generation_jobs_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+    ALTER TABLE generation_jobs ADD CONSTRAINT generation_jobs_questions_shape
+      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_generation_jobs_version ON generation_jobs(job_version_id) WHERE job_version_id IS NOT NULL;
+
+ALTER TABLE resume_scores ADD COLUMN IF NOT EXISTS job_version_id UUID;
+ALTER TABLE resume_scores ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
+ALTER TABLE resume_scores ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
+ALTER TABLE resume_scores ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='resume_scores'::regclass AND conname='resume_scores_version_job_fk') THEN
+    ALTER TABLE resume_scores ADD CONSTRAINT resume_scores_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+    ALTER TABLE resume_scores ADD CONSTRAINT resume_scores_questions_shape
+      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_resume_scores_version ON resume_scores(job_version_id) WHERE job_version_id IS NOT NULL;
+
+ALTER TABLE cover_letter_edits ADD COLUMN IF NOT EXISTS job_version_id UUID;
+ALTER TABLE cover_letter_edits ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
+ALTER TABLE cover_letter_edits ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
+ALTER TABLE cover_letter_edits ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='cover_letter_edits'::regclass AND conname='cover_letter_edits_version_job_fk') THEN
+    ALTER TABLE cover_letter_edits ADD CONSTRAINT cover_letter_edits_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+    ALTER TABLE cover_letter_edits ADD CONSTRAINT cover_letter_edits_questions_shape
+      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_cover_letter_edits_version ON cover_letter_edits(job_version_id) WHERE job_version_id IS NOT NULL;
+
+ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS job_version_id UUID;
+ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
+ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
+ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='job_payload_demands'::regclass AND conname='job_payload_demands_version_job_fk') THEN
+    ALTER TABLE job_payload_demands ADD CONSTRAINT job_payload_demands_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+    ALTER TABLE job_payload_demands ADD CONSTRAINT job_payload_demands_questions_shape
+      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_job_payload_demands_version ON job_payload_demands(job_version_id) WHERE job_version_id IS NOT NULL;
+
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='job_payload_demands'::regclass AND conname='job_payload_demands_ready_version') THEN
+    ALTER TABLE job_payload_demands ADD CONSTRAINT job_payload_demands_ready_version
+      CHECK (status <> 'ready' OR job_version_id IS NOT NULL);
+  END IF;
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='jobs'::regclass AND conname='jobs_description_version_fk') THEN
+    ALTER TABLE jobs ADD CONSTRAINT jobs_description_version_fk
+      FOREIGN KEY (description_version_id,id) REFERENCES job_versions(id,job_id);
+  END IF;
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='job_questions'::regclass AND conname='job_questions_version_job_fk') THEN
+    ALTER TABLE job_questions ADD CONSTRAINT job_questions_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_jobs_description_version ON jobs(description_version_id) WHERE description_version_id IS NOT NULL;
+CREATE INDEX IF NOT EXISTS idx_job_questions_version ON job_questions(job_version_id) WHERE job_version_id IS NOT NULL;
+ALTER TABLE lifecycle_control ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON lifecycle_control FROM PUBLIC, anon, authenticated;
+ALTER TABLE source_accounts ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON source_accounts FROM PUBLIC, anon, authenticated;
+ALTER TABLE source_listings ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON source_listings FROM PUBLIC, anon, authenticated;
+ALTER TABLE job_versions ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON job_versions FROM PUBLIC, anon, authenticated;
+ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON brands FROM PUBLIC, anon, authenticated;
+ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON skills FROM PUBLIC, anon, authenticated;
+ALTER TABLE company_brands ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON company_brands FROM PUBLIC, anon, authenticated;
+ALTER TABLE company_sources ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON company_sources FROM PUBLIC, anon, authenticated;
+ALTER TABLE job_locations ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON job_locations FROM PUBLIC, anon, authenticated;
+ALTER TABLE job_skills ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON job_skills FROM PUBLIC, anon, authenticated;
+ALTER TABLE identity_assertions ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON identity_assertions FROM PUBLIC, anon, authenticated;
+ALTER TABLE job_payload_demands ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON job_payload_demands FROM PUBLIC, anon, authenticated;
+
+INSERT INTO schema_migrations(filename) VALUES ('2026-10-03-01-lifecycle-core.sql') ON CONFLICT DO NOTHING;
+COMMIT;
diff --git a/pyproject.toml b/pyproject.toml
index f7a7ac1..bd8b760 100644
--- a/pyproject.toml
+++ b/pyproject.toml
@@ -19,15 +19,15 @@ dev = ["pytest>=8.0", "ruff==0.15.20"]
 testpaths = ["tests"]
 markers = [
     "integration: tests that require TEST_DATABASE_URL (a throwaway Postgres)",
 ]
 
 [build-system]
 requires = ["setuptools>=68"]
 build-backend = "setuptools.build_meta"
 
 [tool.setuptools]
-packages = ["job_discovery", "job_discovery.adapters", "reviewer", "company_discovery", "observability"]
+packages = ["job_discovery", "job_discovery.adapters", "job_discovery.lifecycle", "reviewer", "company_discovery", "observability"]
 
 [tool.ruff.lint.per-file-ignores]
 # Tests intentionally import after module-level env/stub setup.
 "tests/*" = ["E402"]
diff --git a/schema.sql b/schema.sql
index 1436275..01dffbf 100644
--- a/schema.sql
+++ b/schema.sql
@@ -1022,10 +1022,440 @@ BEGIN
       AND created_at > clock_timestamp() - interval '1 hour') >= 5 THEN
     RAISE EXCEPTION 'feedback rate limit' USING ERRCODE = 'P0001';
   END IF;
   INSERT INTO public.feedback(user_id, kind, message) VALUES (caller, p_kind, btrim(p_message));
 END;
 $$;
 REVOKE ALL ON FUNCTION public.submit_feedback(text, text) FROM PUBLIC, anon, authenticated;
 GRANT EXECUTE ON FUNCTION public.submit_feedback(text, text) TO authenticated;
 INSERT INTO schema_migrations (filename) VALUES ('2026-10-02-feedback.sql') ON CONFLICT DO NOTHING;
 -- END mirrored 2026-10-02-feedback.sql
+
+-- Lifecycle core (2026-10-03-01).
+-- Additive prerequisites only. No corpus UPDATE, version capture or consumer cutover.
+-- Explicit bounded mapping is job_discovery.lifecycle.identity.migrate_identity_batch.
+CREATE TABLE IF NOT EXISTS lifecycle_control (
+  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
+  flags_version INTEGER NOT NULL DEFAULT 1 CHECK (flags_version > 0),
+  safety_stage TEXT NOT NULL DEFAULT 'legacy' CHECK (safety_stage IN ('legacy','collect','enforced')),
+  identity_enabled BOOLEAN NOT NULL DEFAULT false,
+  source_enabled BOOLEAN NOT NULL DEFAULT false,
+  maintenance_enabled BOOLEAN NOT NULL DEFAULT false,
+  hydration_enabled BOOLEAN NOT NULL DEFAULT false,
+  feed_enabled BOOLEAN NOT NULL DEFAULT false,
+  retirement_enabled BOOLEAN NOT NULL DEFAULT false,
+  retirement_dry_run BOOLEAN NOT NULL DEFAULT true,
+  archive_ever_activated BOOLEAN NOT NULL DEFAULT false,
+  archive_stage TEXT NOT NULL DEFAULT 'never_activated'
+    CHECK (archive_stage IN ('never_activated','active','producer_paused')),
+  export_enabled BOOLEAN NOT NULL DEFAULT false,
+  activation_generation BIGINT NOT NULL DEFAULT 0 CHECK (activation_generation >= 0),
+  identity_migration_activated_at TIMESTAMPTZ,
+  CHECK (archive_ever_activated = (archive_stage <> 'never_activated')),
+  CHECK (NOT export_enabled OR archive_ever_activated)
+);
+INSERT INTO lifecycle_control(singleton) VALUES (true) ON CONFLICT DO NOTHING;
+
+-- A small invoker-only guard protects durable control history. Task 3 owns the
+-- gated transition API/readiness validation; no producer can be activated here.
+CREATE OR REPLACE FUNCTION preserve_lifecycle_control() RETURNS trigger
+LANGUAGE plpgsql SET search_path = pg_catalog AS $$
+BEGIN
+  IF TG_OP IN ('DELETE','TRUNCATE') THEN
+    RAISE EXCEPTION 'lifecycle control history cannot be removed';
+  END IF;
+  IF OLD.archive_ever_activated AND NOT NEW.archive_ever_activated THEN
+    RAISE EXCEPTION 'archive activation history is monotonic';
+  END IF;
+  IF OLD.identity_migration_activated_at IS NOT NULL AND
+     NEW.identity_migration_activated_at IS DISTINCT FROM OLD.identity_migration_activated_at THEN
+    RAISE EXCEPTION 'identity migration activation is immutable';
+  END IF;
+  IF NEW.activation_generation < OLD.activation_generation OR NEW.flags_version < OLD.flags_version THEN
+    RAISE EXCEPTION 'control generation and schema version are monotonic';
+  END IF;
+  IF (to_jsonb(NEW) - 'identity_migration_activated_at') IS DISTINCT FROM
+     (to_jsonb(OLD) - 'identity_migration_activated_at') AND
+     NEW.activation_generation <= OLD.activation_generation THEN
+    RAISE EXCEPTION 'control changes require a newer activation generation';
+  END IF;
+  -- No active safety/outbox contract exists at this schema stage. Later ordered
+  -- safety/outbox migrations replace this activation barrier after review.
+  IF NEW.safety_stage = 'enforced' OR NEW.archive_stage <> 'never_activated' OR NEW.export_enabled THEN
+    RAISE EXCEPTION 'lifecycle activation requires installed safety and outbox contracts';
+  END IF;
+  RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION preserve_lifecycle_control() FROM PUBLIC, anon, authenticated;
+DROP TRIGGER IF EXISTS lifecycle_control_history ON lifecycle_control;
+CREATE TRIGGER lifecycle_control_history BEFORE UPDATE OR DELETE ON lifecycle_control
+FOR EACH ROW EXECUTE FUNCTION preserve_lifecycle_control();
+DROP TRIGGER IF EXISTS lifecycle_control_no_truncate ON lifecycle_control;
+CREATE TRIGGER lifecycle_control_no_truncate BEFORE TRUNCATE ON lifecycle_control
+FOR EACH STATEMENT EXECUTE FUNCTION preserve_lifecycle_control();
+
+CREATE TABLE IF NOT EXISTS source_accounts (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  legacy_company_id INTEGER REFERENCES companies(id),
+  ats TEXT NOT NULL CHECK (ats IN ('greenhouse','lever','ashby','workable','smartrecruiters','workday')),
+  public_board_ref TEXT NOT NULL,
+  public_url TEXT,
+  legacy_active BOOLEAN,
+  exclusion_state TEXT NOT NULL DEFAULT 'unknown' CHECK (exclusion_state IN ('unknown','enabled','failure_disabled','deliberate')),
+  last_attempt_at TIMESTAMPTZ,
+  last_complete_success_at TIMESTAMPTZ,
+  last_outcome TEXT,
+  next_due_at TIMESTAMPTZ,
+  suspicious_empty_streak INTEGER NOT NULL DEFAULT 0 CHECK (suspicious_empty_streak >= 0),
+  failure_streak INTEGER NOT NULL DEFAULT 0 CHECK (failure_streak >= 0),
+  claim_owner_token TEXT,
+  claim_generation BIGINT NOT NULL DEFAULT 0 CHECK (claim_generation >= 0),
+  lease_until TIMESTAMPTZ,
+  current_revision BIGINT NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
+  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND current_revision),
+  enumeration_sequence BIGINT NOT NULL DEFAULT 0 CHECK (enumeration_sequence >= 0),
+  replay_floor BIGINT NOT NULL DEFAULT 0 CHECK (replay_floor >= 0),
+  reconciliation_cursor TEXT,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  UNIQUE (ats, public_board_ref),
+  CHECK ((claim_owner_token IS NULL) = (lease_until IS NULL))
+);
+CREATE INDEX IF NOT EXISTS idx_source_accounts_legacy ON source_accounts(legacy_company_id);
+CREATE INDEX IF NOT EXISTS idx_source_accounts_due ON source_accounts(next_due_at,last_complete_success_at,id);
+
+CREATE TABLE IF NOT EXISTS source_listings (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  source_account_id UUID NOT NULL REFERENCES source_accounts(id),
+  external_id TEXT NOT NULL,
+  -- Pre-cutover mapping follows legacy deletion. Task3/4 must reject Job
+  -- DELETE at identity-preserving cutover; never weaken existing private FKs.
+  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
+  current_version_id UUID,
+  current_revision BIGINT NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
+  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND current_revision),
+  original_discovered_at TIMESTAMPTZ NOT NULL,
+  source_published_at TIMESTAMPTZ,
+  source_published_provenance TEXT,
+  discovery_anchor_at TIMESTAMPTZ NOT NULL,
+  discovery_anchor_provenance TEXT NOT NULL
+    CHECK (discovery_anchor_provenance IN ('legacy_local_observation','local_observation','source_published')),
+  discovery_expires_at TIMESTAMPTZ NOT NULL,
+  successful_last_observed_at TIMESTAMPTZ,
+  successful_sighting_count BIGINT NOT NULL DEFAULT 0 CHECK (successful_sighting_count >= 0),
+  content_changed_at TIMESTAMPTZ,
+  content_hash TEXT CHECK (content_hash ~ '^[0-9a-f]{64}$'),
+  consecutive_complete_misses INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_complete_misses >= 0),
+  first_complete_miss_at TIMESTAMPTZ,
+  last_miss_enumeration_id UUID,
+  last_membership_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_membership_sequence >= 0),
+  last_complete_miss_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_complete_miss_sequence >= 0),
+  last_direct_verification_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_direct_verification_sequence >= 0),
+  source_availability TEXT NOT NULL DEFAULT 'unknown' CHECK (source_availability IN ('open','unknown','closed')),
+  legacy_closed_at TIMESTAMPTZ,
+  payload_retired_at TIMESTAMPTZ,
+  suspected_id_reuse BOOLEAN NOT NULL DEFAULT false,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  UNIQUE (source_account_id,external_id),
+  UNIQUE (id,job_id),
+  CHECK (discovery_expires_at = discovery_anchor_at + interval '720 hours'),
+  CHECK ((source_published_at IS NULL) = (source_published_provenance IS NULL))
+);
+CREATE INDEX IF NOT EXISTS idx_source_listings_job ON source_listings(job_id);
+CREATE INDEX IF NOT EXISTS idx_source_listings_expiry ON source_listings(discovery_expires_at,id);
+CREATE INDEX IF NOT EXISTS idx_source_listings_source_availability ON source_listings(source_account_id,source_availability,id);
+
+CREATE TABLE IF NOT EXISTS job_versions (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  job_id TEXT NOT NULL REFERENCES jobs(id),
+  source_listing_id UUID NOT NULL,
+  revision BIGINT NOT NULL CHECK (revision > 0),
+  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
+  public_metadata JSONB NOT NULL CHECK (jsonb_typeof(public_metadata) = 'object'),
+  observed_at TIMESTAMPTZ NOT NULL,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  payload_ref TEXT,
+  payload_expires_at TIMESTAMPTZ,
+  UNIQUE (source_listing_id,revision),
+  UNIQUE (id,job_id),
+  UNIQUE (id,source_listing_id),
+  FOREIGN KEY (source_listing_id,job_id) REFERENCES source_listings(id,job_id),
+  CHECK ((payload_ref IS NULL) = (payload_expires_at IS NULL))
+);
+CREATE INDEX IF NOT EXISTS idx_job_versions_job ON job_versions(job_id);
+CREATE INDEX IF NOT EXISTS idx_job_versions_recorded ON job_versions(recorded_at,id);
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='source_listings'::regclass AND conname='source_listings_current_version_fk') THEN
+    ALTER TABLE source_listings ADD CONSTRAINT source_listings_current_version_fk
+      FOREIGN KEY (current_version_id,id) REFERENCES job_versions(id,source_listing_id);
+  END IF;
+END $$;
+
+CREATE TABLE IF NOT EXISTS brands (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL
+);
+CREATE TABLE IF NOT EXISTS skills (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), canonical_name TEXT NOT NULL UNIQUE
+);
+
+CREATE TABLE IF NOT EXISTS company_brands (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  company_id INTEGER NOT NULL REFERENCES companies(id),
+  brand_id UUID NOT NULL REFERENCES brands(id),
+  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('structured_source','reviewed_public','legacy_mapping')),
+  public_evidence_ref TEXT NOT NULL,
+  observed_at TIMESTAMPTZ,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  valid_from TIMESTAMPTZ,
+  valid_to TIMESTAMPTZ,
+  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retracted')),
+  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
+  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
+  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND revision),
+  UNIQUE (company_id,brand_id),
+  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
+);
+CREATE INDEX IF NOT EXISTS idx_company_brands_right ON company_brands(brand_id);
+
+CREATE TABLE IF NOT EXISTS company_sources (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  company_id INTEGER NOT NULL REFERENCES companies(id),
+  source_account_id UUID NOT NULL REFERENCES source_accounts(id),
+  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('structured_source','reviewed_public','legacy_mapping')),
+  public_evidence_ref TEXT NOT NULL,
+  observed_at TIMESTAMPTZ,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  valid_from TIMESTAMPTZ,
+  valid_to TIMESTAMPTZ,
+  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retracted')),
+  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
+  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
+  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND revision),
+  UNIQUE (company_id,source_account_id),
+  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
+);
+CREATE INDEX IF NOT EXISTS idx_company_sources_right ON company_sources(source_account_id);
+
+CREATE TABLE IF NOT EXISTS job_locations (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  job_version_id UUID NOT NULL REFERENCES job_versions(id),
+  location_id TEXT NOT NULL REFERENCES locations(raw),
+  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('structured_source','reviewed_public','legacy_mapping')),
+  public_evidence_ref TEXT NOT NULL,
+  observed_at TIMESTAMPTZ,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  valid_from TIMESTAMPTZ,
+  valid_to TIMESTAMPTZ,
+  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retracted')),
+  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
+  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
+  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND revision),
+  UNIQUE (job_version_id,location_id),
+  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
+);
+CREATE INDEX IF NOT EXISTS idx_job_locations_right ON job_locations(location_id);
+
+CREATE TABLE IF NOT EXISTS job_skills (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  job_version_id UUID NOT NULL REFERENCES job_versions(id),
+  skill_id UUID NOT NULL REFERENCES skills(id),
+  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('structured_source','reviewed_public','legacy_mapping')),
+  public_evidence_ref TEXT NOT NULL,
+  observed_at TIMESTAMPTZ,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  valid_from TIMESTAMPTZ,
+  valid_to TIMESTAMPTZ,
+  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retracted')),
+  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
+  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
+  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND revision),
+  UNIQUE (job_version_id,skill_id),
+  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
+);
+CREATE INDEX IF NOT EXISTS idx_job_skills_right ON job_skills(skill_id);
+
+CREATE TABLE IF NOT EXISTS identity_assertions (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  left_listing_id UUID NOT NULL REFERENCES source_listings(id),
+  right_listing_id UUID NOT NULL REFERENCES source_listings(id),
+  relation TEXT NOT NULL CHECK (relation IN ('same_job','repost_of','source_migration')),
+  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('structured_source','reviewed_public')),
+  public_evidence_ref TEXT NOT NULL,
+  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','retracted')),
+  observed_at TIMESTAMPTZ,
+  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  reviewed_at TIMESTAMPTZ,
+  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
+  archived_revision BIGINT NOT NULL DEFAULT 0 CHECK (archived_revision BETWEEN 0 AND revision),
+  CHECK (left_listing_id <> right_listing_id),
+  CHECK (status <> 'accepted' OR (evidence_kind = 'reviewed_public' AND reviewed_at IS NOT NULL)),
+  UNIQUE (left_listing_id,right_listing_id,relation)
+);
+CREATE INDEX IF NOT EXISTS idx_identity_assertions_right ON identity_assertions(right_listing_id);
+
+ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_captured_at TIMESTAMPTZ;
+ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_last_used_at TIMESTAMPTZ;
+ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_capture_provenance TEXT;
+ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_version_id UUID;
+ALTER TABLE job_questions ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;
+ALTER TABLE job_questions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
+ALTER TABLE job_questions ADD COLUMN IF NOT EXISTS capture_provenance TEXT;
+ALTER TABLE job_questions ADD COLUMN IF NOT EXISTS job_version_id UUID;
+
+-- Prerequisite queue, kept service-only until Task 3 adds its owner access API.
+CREATE TABLE IF NOT EXISTS job_payload_demands (
+  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+  user_id UUID NOT NULL,
+  job_id TEXT NOT NULL REFERENCES jobs(id),
+  kind TEXT NOT NULL CHECK (kind IN ('description','questions','review','prepare','generation')),
+  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','ready','deferred','failed','cancelled')),
+  claim_owner_token TEXT,
+  claim_generation BIGINT NOT NULL DEFAULT 0 CHECK (claim_generation >= 0),
+  lease_until TIMESTAMPTZ,
+  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
+  settled_at TIMESTAMPTZ,
+  CHECK ((claim_owner_token IS NULL) = (lease_until IS NULL))
+);
+CREATE INDEX IF NOT EXISTS idx_job_payload_demands_job ON job_payload_demands(job_id,status);
+CREATE INDEX IF NOT EXISTS idx_job_payload_demands_owner ON job_payload_demands(user_id,status);
+CREATE INDEX IF NOT EXISTS idx_job_payload_demands_terminal ON job_payload_demands(settled_at) WHERE settled_at IS NOT NULL;
+CREATE UNIQUE INDEX IF NOT EXISTS one_active_payload_demand ON job_payload_demands(user_id,job_id,kind) WHERE status IN ('pending','running');
+
+ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS job_version_id UUID;
+ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
+ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
+ALTER TABLE job_reviews ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='job_reviews'::regclass AND conname='job_reviews_version_job_fk') THEN
+    ALTER TABLE job_reviews ADD CONSTRAINT job_reviews_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+    ALTER TABLE job_reviews ADD CONSTRAINT job_reviews_questions_shape
+      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_job_reviews_version ON job_reviews(job_version_id) WHERE job_version_id IS NOT NULL;
+
+ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS job_version_id UUID;
+ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
+ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
+ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='review_corrections'::regclass AND conname='review_corrections_version_job_fk') THEN
+    ALTER TABLE review_corrections ADD CONSTRAINT review_corrections_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+    ALTER TABLE review_corrections ADD CONSTRAINT review_corrections_questions_shape
+      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_review_corrections_version ON review_corrections(job_version_id) WHERE job_version_id IS NOT NULL;
+
+ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS job_version_id UUID;
+ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
+ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
+ALTER TABLE application_packages ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='application_packages'::regclass AND conname='application_packages_version_job_fk') THEN
+    ALTER TABLE application_packages ADD CONSTRAINT application_packages_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+    ALTER TABLE application_packages ADD CONSTRAINT application_packages_questions_shape
+      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_application_packages_version ON application_packages(job_version_id) WHERE job_version_id IS NOT NULL;
+
+ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS job_version_id UUID;
+ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
+ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
+ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='generation_jobs'::regclass AND conname='generation_jobs_version_job_fk') THEN
+    ALTER TABLE generation_jobs ADD CONSTRAINT generation_jobs_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+    ALTER TABLE generation_jobs ADD CONSTRAINT generation_jobs_questions_shape
+      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_generation_jobs_version ON generation_jobs(job_version_id) WHERE job_version_id IS NOT NULL;
+
+ALTER TABLE resume_scores ADD COLUMN IF NOT EXISTS job_version_id UUID;
+ALTER TABLE resume_scores ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
+ALTER TABLE resume_scores ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
+ALTER TABLE resume_scores ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='resume_scores'::regclass AND conname='resume_scores_version_job_fk') THEN
+    ALTER TABLE resume_scores ADD CONSTRAINT resume_scores_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+    ALTER TABLE resume_scores ADD CONSTRAINT resume_scores_questions_shape
+      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_resume_scores_version ON resume_scores(job_version_id) WHERE job_version_id IS NOT NULL;
+
+ALTER TABLE cover_letter_edits ADD COLUMN IF NOT EXISTS job_version_id UUID;
+ALTER TABLE cover_letter_edits ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
+ALTER TABLE cover_letter_edits ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
+ALTER TABLE cover_letter_edits ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='cover_letter_edits'::regclass AND conname='cover_letter_edits_version_job_fk') THEN
+    ALTER TABLE cover_letter_edits ADD CONSTRAINT cover_letter_edits_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+    ALTER TABLE cover_letter_edits ADD CONSTRAINT cover_letter_edits_questions_shape
+      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_cover_letter_edits_version ON cover_letter_edits(job_version_id) WHERE job_version_id IS NOT NULL;
+
+ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS job_version_id UUID;
+ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS description_snapshot TEXT;
+ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS questions_snapshot JSONB;
+ALTER TABLE job_payload_demands ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ;
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='job_payload_demands'::regclass AND conname='job_payload_demands_version_job_fk') THEN
+    ALTER TABLE job_payload_demands ADD CONSTRAINT job_payload_demands_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+    ALTER TABLE job_payload_demands ADD CONSTRAINT job_payload_demands_questions_shape
+      CHECK (questions_snapshot IS NULL OR jsonb_typeof(questions_snapshot) IN ('object','array'));
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_job_payload_demands_version ON job_payload_demands(job_version_id) WHERE job_version_id IS NOT NULL;
+
+DO $$ BEGIN
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='job_payload_demands'::regclass AND conname='job_payload_demands_ready_version') THEN
+    ALTER TABLE job_payload_demands ADD CONSTRAINT job_payload_demands_ready_version
+      CHECK (status <> 'ready' OR job_version_id IS NOT NULL);
+  END IF;
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='jobs'::regclass AND conname='jobs_description_version_fk') THEN
+    ALTER TABLE jobs ADD CONSTRAINT jobs_description_version_fk
+      FOREIGN KEY (description_version_id,id) REFERENCES job_versions(id,job_id);
+  END IF;
+  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='job_questions'::regclass AND conname='job_questions_version_job_fk') THEN
+    ALTER TABLE job_questions ADD CONSTRAINT job_questions_version_job_fk
+      FOREIGN KEY (job_version_id,job_id) REFERENCES job_versions(id,job_id);
+  END IF;
+END $$;
+CREATE INDEX IF NOT EXISTS idx_jobs_description_version ON jobs(description_version_id) WHERE description_version_id IS NOT NULL;
+CREATE INDEX IF NOT EXISTS idx_job_questions_version ON job_questions(job_version_id) WHERE job_version_id IS NOT NULL;
+ALTER TABLE lifecycle_control ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON lifecycle_control FROM PUBLIC, anon, authenticated;
+ALTER TABLE source_accounts ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON source_accounts FROM PUBLIC, anon, authenticated;
+ALTER TABLE source_listings ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON source_listings FROM PUBLIC, anon, authenticated;
+ALTER TABLE job_versions ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON job_versions FROM PUBLIC, anon, authenticated;
+ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON brands FROM PUBLIC, anon, authenticated;
+ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON skills FROM PUBLIC, anon, authenticated;
+ALTER TABLE company_brands ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON company_brands FROM PUBLIC, anon, authenticated;
+ALTER TABLE company_sources ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON company_sources FROM PUBLIC, anon, authenticated;
+ALTER TABLE job_locations ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON job_locations FROM PUBLIC, anon, authenticated;
+ALTER TABLE job_skills ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON job_skills FROM PUBLIC, anon, authenticated;
+ALTER TABLE identity_assertions ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON identity_assertions FROM PUBLIC, anon, authenticated;
+ALTER TABLE job_payload_demands ENABLE ROW LEVEL SECURITY;
+REVOKE ALL ON job_payload_demands FROM PUBLIC, anon, authenticated;
+
+INSERT INTO schema_migrations(filename) VALUES ('2026-10-03-01-lifecycle-core.sql') ON CONFLICT DO NOTHING;
diff --git a/tests/test_lifecycle_identity.py b/tests/test_lifecycle_identity.py
new file mode 100644
index 0000000..5f3c1f5
--- /dev/null
+++ b/tests/test_lifecycle_identity.py
@@ -0,0 +1,585 @@
+"""Task 2 contracts; all mutable behavior runs in the owned database harness."""
+
+from datetime import UTC, datetime, timedelta
+import importlib
+from uuid import uuid4
+
+import psycopg
+import pytest
+from psycopg.rows import dict_row
+
+from tests.conftest import TEST_DSN, as_user, requires_db
+
+
+def identity():
+    return importlib.import_module("job_discovery.lifecycle.identity")
+
+
+def seed(conn, count=1):
+    cid = conn.execute(
+        "INSERT INTO companies(name,ats,token,poll_failures) VALUES ('X','lever','x',3) RETURNING id"
+    ).fetchone()["id"]
+    for n in range(count):
+        conn.execute(
+            "INSERT INTO jobs(id,company_id,external_id,title,url,first_seen_at,last_seen_at,description) VALUES (%s,%s,%s,'Engineer','https://example.test/job','2025-01-01Z','2025-02-01Z',%s)",
+            (f"lever:x:{n}", cid, str(n), "legacy description" if n % 2 == 0 else None),
+        )
+    conn.execute(
+        "INSERT INTO job_questions(job_id,questions) VALUES ('lever:x:0','{}')"
+    )
+    return cid
+
+
+def test_anchor_uses_trustworthy_publication_and_elapsed_utc():
+    now = datetime(2026, 10, 7, tzinfo=UTC)
+    discovered = now - timedelta(days=10)
+    published = now - timedelta(days=30)
+    anchor, provenance = identity().choose_anchor(published, discovered, now)
+    assert (anchor, provenance) == (published, "source_published")
+    assert now >= anchor + timedelta(days=30)
+    assert now - timedelta(microseconds=1) < anchor + timedelta(days=30)
+    for invalid in [None, now + timedelta(microseconds=1), "not a date"]:
+        assert identity().choose_anchor(invalid, discovered, now) == (
+            discovered,
+            "local_observation",
+        )
+    with pytest.raises(ValueError, match="timezone"):
+        identity().choose_anchor(None, discovered.replace(tzinfo=None), now)
+
+
+@requires_db
+def test_bounded_mapping_restart_preserves_identity_history_and_cache_provenance(conn):
+    seed(conn, 5)
+    user = uuid4()
+    conn.execute(
+        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (%s,'lever:x:0','v','approve')",
+        (user,),
+    )
+    conn.commit()
+    before = conn.execute(
+        "SELECT id,first_seen_at,last_seen_at FROM jobs ORDER BY id"
+    ).fetchall()
+    assert identity().migrate_identity_batch(conn, 2) == 2
+    conn.commit()
+    activation = conn.execute(
+        "SELECT identity_migration_activated_at FROM lifecycle_control"
+    ).fetchone()["identity_migration_activated_at"]
+    assert activation is not None
+    # Discard the connection used by the worker; only persisted progress is reused.
+    with psycopg.connect(TEST_DSN, row_factory=dict_row) as restarted:
+        assert identity().migrate_identity_batch(restarted, 2) == 2
+    assert identity().migrate_identity_batch(conn, 2) == 1
+    conn.commit()
+    rows = conn.execute("SELECT * FROM source_listings ORDER BY job_id").fetchall()
+    assert len(rows) == 5
+    assert all(
+        r["successful_sighting_count"] == 0 and r["successful_last_observed_at"] is None
+        for r in rows
+    )
+    assert all(
+        r["source_published_at"] is None and r["current_version_id"] is None
+        for r in rows
+    )
+    assert all(
+        r["original_discovered_at"]
+        == before[0]["first_seen_at"]
+        == r["discovery_anchor_at"]
+        for r in rows
+    )
+    assert all(
+        r["discovery_anchor_provenance"] == "legacy_local_observation" for r in rows
+    )
+    assert all(
+        r["discovery_expires_at"] == r["discovery_anchor_at"] + timedelta(days=30)
+        for r in rows
+    )
+    cache = conn.execute(
+        "SELECT description,description_captured_at,description_last_used_at,description_capture_provenance FROM jobs ORDER BY id"
+    ).fetchall()
+    for r in cache:
+        assert r["description_captured_at"] == (
+            activation if r["description"] is not None else None
+        )
+        assert r["description_last_used_at"] is None
+        assert r["description_capture_provenance"] == (
+            "migration_activation" if r["description"] is not None else None
+        )
+    question = conn.execute(
+        "SELECT captured_at,last_used_at,capture_provenance FROM job_questions"
+    ).fetchone()
+    assert question == dict(
+        captured_at=activation,
+        last_used_at=None,
+        capture_provenance="migration_activation",
+    )
+    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 0
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM job_reviews WHERE user_id=%s AND job_version_id IS NULL",
+            (user,),
+        ).fetchone()["n"]
+        == 1
+    )
+    assert (
+        conn.execute(
+            "SELECT id,first_seen_at,last_seen_at FROM jobs ORDER BY id"
+        ).fetchall()
+        == before
+    )
+    assert identity().migrate_identity_batch(conn, 2) == 0
+    assert (
+        conn.execute("SELECT * FROM source_listings ORDER BY job_id").fetchall() == rows
+    )
+    source = conn.execute("SELECT * FROM source_accounts").fetchone()
+    assert source["failure_streak"] == 3
+    assert source["last_complete_success_at"] is None
+
+
+@requires_db
+def test_batch_rollback_retry_and_limit_validation(conn):
+    seed(conn, 3)
+    conn.commit()
+    for limit in [0, -1, 501, True, 1.5]:
+        with pytest.raises(ValueError):
+            identity().migrate_identity_batch(conn, limit)
+    assert identity().migrate_identity_batch(conn, 1) == 1
+    conn.rollback()
+    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 0
+    assert identity().migrate_identity_batch(conn, 500) == 3
+    assert identity().migrate_identity_batch(conn) == 0
+
+
+@requires_db
+def test_same_id_legacy_upsert_does_not_reset_frozen_age(conn):
+    from job_discovery.db import upsert_job
+    from job_discovery.models import Posting
+
+    cid = seed(conn)
+    identity().migrate_identity_batch(conn)
+    before = conn.execute("SELECT * FROM source_listings").fetchone()
+    assert not upsert_job(
+        conn, cid, "lever", "x", Posting("0", "Changed", "https://example.test/new")
+    )
+    assert identity().migrate_identity_batch(conn) == 0
+    assert conn.execute("SELECT * FROM source_listings").fetchone() == before
+
+
+@requires_db
+def test_capture_version_is_write_disabled_until_safety_and_outbox_exist(conn):
+    from job_discovery.lifecycle.types import ClaimRef
+
+    seed(conn)
+    identity().migrate_identity_batch(conn)
+    listing = conn.execute("SELECT id FROM source_listings").fetchone()["id"]
+    claim = ClaimRef("opaque", 1, datetime.now(UTC) + timedelta(seconds=180))
+    for metadata in [
+        {"title": "Engineer"},
+        {"title": "Engineer"},
+        {"title": "Changed"},
+    ]:
+        assert (
+            identity().capture_version(
+                conn, listing, metadata, datetime.now(UTC), claim
+            )
+            is None
+        )
+    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 0
+
+
+@requires_db
+def test_defaults_are_service_owned_and_gucs_do_not_enable_controls(conn):
+    from job_discovery.lifecycle.config import read_control
+
+    control = read_control(conn)
+    assert control.safety_stage == "legacy"
+    assert control.archive_stage == "never_activated"
+    assert not control.archive_ever_activated and not control.export_enabled
+    assert control.activation_generation == 0 and control.flags_version == 1
+    assert control.retirement_dry_run
+    assert not any(
+        [
+            control.identity_enabled,
+            control.source_enabled,
+            control.maintenance_enabled,
+            control.hydration_enabled,
+            control.feed_enabled,
+            control.retirement_enabled,
+        ]
+    )
+    conn.execute("SELECT set_config('lifecycle.safety_stage','enforced',true)")
+    assert read_control(conn) == control
+    with as_user(conn, uuid4()):
+        with pytest.raises(psycopg.errors.InsufficientPrivilege):
+            conn.execute("UPDATE lifecycle_control SET safety_stage='enforced'")
+
+
+@requires_db
+def test_new_tables_have_rls_and_no_client_privileges(conn):
+    tables = [
+        "lifecycle_control",
+        "source_accounts",
+        "source_listings",
+        "job_versions",
+        "brands",
+        "skills",
+        "company_brands",
+        "company_sources",
+        "job_locations",
+        "job_skills",
+        "identity_assertions",
+        "job_payload_demands",
+    ]
+    for table in tables:
+        assert conn.execute(
+            "SELECT relrowsecurity FROM pg_class WHERE oid=%s::regclass", (table,)
+        ).fetchone()["relrowsecurity"]
+        for role in ["anon", "authenticated"]:
+            assert not conn.execute(
+                "SELECT has_table_privilege(%s,%s,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') p",
+                (role, table),
+            ).fetchone()["p"]
+            with conn.transaction():
+                conn.execute(f"SET LOCAL ROLE {role}")
+                with (
+                    pytest.raises(psycopg.errors.InsufficientPrivilege),
+                    conn.transaction(),
+                ):
+                    conn.execute(f"SELECT * FROM {table}")
+                with (
+                    pytest.raises(psycopg.errors.InsufficientPrivilege),
+                    conn.transaction(),
+                ):
+                    conn.execute(f"DELETE FROM {table}")
+                conn.execute("RESET ROLE")
+
+
+@requires_db
+def test_nullable_private_prerequisites_and_flag_off_owner_writes(conn):
+    seed(conn)
+    identity().migrate_identity_batch(conn)
+    user, other = uuid4(), uuid4()
+    conn.commit()
+    statements = [
+        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (%s,'lever:x:0','v','approve')",
+        "INSERT INTO review_corrections(user_id,job_id,verdict) VALUES (%s,'lever:x:0','approve')",
+        "INSERT INTO application_packages(user_id,job_id) VALUES (%s,'lever:x:0')",
+        "INSERT INTO generation_jobs(user_id,job_id,kind) VALUES (%s,'lever:x:0','prepare')",
+        "INSERT INTO resume_scores(user_id,job_id) VALUES (%s,'lever:x:0')",
+        "INSERT INTO cover_letter_edits(user_id,job_id,edited_text) VALUES (%s,'lever:x:0','edit')",
+    ]
+    with as_user(conn, user):
+        for query in statements:
+            conn.execute(query, (user,))
+        for table in [
+            "job_reviews",
+            "review_corrections",
+            "application_packages",
+            "generation_jobs",
+            "resume_scores",
+            "cover_letter_edits",
+        ]:
+            row = conn.execute(
+                f"SELECT job_version_id,description_snapshot,questions_snapshot FROM {table}"
+            ).fetchone()
+            assert row == dict(
+                job_version_id=None, description_snapshot=None, questions_snapshot=None
+            )
+        conn.commit()
+    with as_user(conn, other):
+        for table in [
+            "job_reviews",
+            "review_corrections",
+            "application_packages",
+            "generation_jobs",
+            "resume_scores",
+            "cover_letter_edits",
+        ]:
+            assert conn.execute(f"SELECT count(*) n FROM {table}").fetchone()["n"] == 0
+    with as_user(conn, other):
+        with pytest.raises(psycopg.errors.InsufficientPrivilege):
+            conn.execute(statements[2], (user,))
+    # Existing account cleanup statements continue to work without a version.
+    with as_user(conn, user):
+        for table in [
+            "job_reviews",
+            "review_corrections",
+            "application_packages",
+            "generation_jobs",
+            "resume_scores",
+            "cover_letter_edits",
+        ]:
+            conn.execute(f"DELETE FROM {table} WHERE user_id=%s", (user,))
+
+
+@requires_db
+def test_typed_locations_and_cross_job_version_reference_rejected(conn):
+    seed(conn, 2)
+    identity().migrate_identity_batch(conn)
+    listing = conn.execute(
+        "SELECT id FROM source_listings WHERE job_id='lever:x:0'"
+    ).fetchone()["id"]
+    version = conn.execute(
+        "INSERT INTO job_versions(job_id,source_listing_id,revision,content_hash,public_metadata,observed_at) VALUES ('lever:x:0',%s,1,%s,'{}',now()) RETURNING id",
+        (listing, "a" * 64),
+    ).fetchone()["id"]
+    conn.execute(
+        "INSERT INTO locations(raw,canonicals,components,source) VALUES ('Remote','{Remote}','{}','rule')"
+    )
+    conn.execute(
+        "INSERT INTO job_locations(job_version_id,location_id,evidence_kind,public_evidence_ref) VALUES (%s,'Remote','structured_source','https://example.test/location')",
+        (version,),
+    )
+    with pytest.raises(psycopg.errors.ForeignKeyViolation), conn.transaction():
+        conn.execute(
+            "INSERT INTO job_reviews(user_id,job_id,profile_version,job_version_id) VALUES (%s,'lever:x:1','v',%s)",
+            (uuid4(), version),
+        )
+    with pytest.raises(psycopg.errors.CheckViolation), conn.transaction():
+        conn.execute(
+            "INSERT INTO job_payload_demands(user_id,job_id,kind,status) VALUES (%s,'lever:x:0','description','ready')",
+            (uuid4(),),
+        )
+
+
+@requires_db
+def test_mapped_flag_off_legacy_prune_and_direct_delete_preserve_protected_rows(conn):
+    from job_discovery.prune import prune_jobs
+
+    seed(conn, 5)
+    conn.execute("UPDATE jobs SET closed_at=now()-interval '40 days'")
+    user = uuid4()
+    conn.execute(
+        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (%s,'lever:x:1','v','approve')",
+        (user,),
+    )
+    conn.execute(
+        "INSERT INTO review_corrections(user_id,job_id,description_snapshot) VALUES (%s,'lever:x:2','protected')",
+        (user,),
+    )
+    conn.execute(
+        "INSERT INTO application_packages(user_id,job_id) VALUES (%s,'lever:x:3')",
+        (user,),
+    )
+    identity().migrate_identity_batch(conn)
+    conn.commit()
+    # Staged compatibility: unmigrated legacy callers may delete pre-cutover
+    # unprotected Jobs. Later gate/cutover must prohibit these identity deletes.
+    conn.execute("DELETE FROM jobs WHERE id='lever:x:4'")
+    conn.commit()
+    assert prune_jobs(conn)["closed_deleted"] == 1
+    assert {r["id"] for r in conn.execute("SELECT id FROM jobs")} == {
+        "lever:x:1",
+        "lever:x:2",
+        "lever:x:3",
+    }
+    assert {
+        r["job_id"] for r in conn.execute("SELECT job_id FROM source_listings")
+    } == {"lever:x:1", "lever:x:2", "lever:x:3"}
+    assert (
+        conn.execute("SELECT description_snapshot FROM review_corrections").fetchone()[
+            "description_snapshot"
+        ]
+        == "protected"
+    )
+    assert conn.execute("SELECT count(*) n FROM job_reviews").fetchone()["n"] == 1
+    assert (
+        conn.execute("SELECT count(*) n FROM application_packages").fetchone()["n"] == 1
+    )
+
+
+@requires_db
+def test_mapping_defaults_to_500_and_maps_empty_boards_without_invented_evidence(conn):
+    seed(conn, 501)
+    conn.execute(
+        "INSERT INTO companies(name,ats,token,active) VALUES ('Empty','ashby','empty',false)"
+    )
+    assert identity().migrate_identity_batch(conn) == 500
+    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 500
+    conn.commit()
+    assert identity().migrate_identity_batch(conn) == 1
+    conn.commit()
+    assert identity().migrate_identity_batch(conn) == 1  # Remaining empty board.
+    assert identity().migrate_identity_batch(conn) == 0
+    assert conn.execute("SELECT count(*) n FROM company_sources").fetchone()["n"] == 2
+    rows = conn.execute(
+        "SELECT observed_at,valid_from,valid_to,confidence FROM company_sources"
+    ).fetchall()
+    assert all(all(value is None for value in row.values()) for row in rows)
+    assert conn.execute("SELECT count(*) n FROM brands").fetchone()["n"] == 0
+    assert conn.execute("SELECT count(*) n FROM skills").fetchone()["n"] == 0
+    empty = conn.execute(
+        "SELECT * FROM source_accounts WHERE public_board_ref='empty'"
+    ).fetchone()
+    assert empty["legacy_active"] is False and empty["exclusion_state"] == "unknown"
+    assert empty["last_complete_success_at"] is None
+
+
+@requires_db
+def test_control_history_and_activation_barrier(conn):
+    from job_discovery.lifecycle.config import read_control
+
+    initial = read_control(conn)
+    for statement in [
+        "DELETE FROM lifecycle_control",
+        "TRUNCATE lifecycle_control",
+        "UPDATE lifecycle_control SET feed_enabled=true",
+        "UPDATE lifecycle_control SET archive_ever_activated=true,archive_stage='active',activation_generation=1",
+        "UPDATE lifecycle_control SET safety_stage='enforced',activation_generation=1",
+    ]:
+        with pytest.raises(psycopg.errors.RaiseException), conn.transaction():
+            conn.execute(statement)
+    conn.execute(
+        "UPDATE lifecycle_control SET safety_stage='collect',activation_generation=1"
+    )
+    assert read_control(conn).activation_generation == initial.activation_generation + 1
+    assert identity().migrate_identity_batch(conn) == 0
+    conn.rollback()
+    # Future activated state fixture: Task2 deliberately has no activation API.
+    conn.execute(
+        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
+    )
+    conn.execute(
+        "UPDATE lifecycle_control SET archive_ever_activated=true,archive_stage='producer_paused',activation_generation=5"
+    )
+    conn.execute(
+        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
+    )
+    with (
+        pytest.raises(psycopg.errors.RaiseException, match="monotonic"),
+        conn.transaction(),
+    ):
+        conn.execute(
+            "UPDATE lifecycle_control SET archive_ever_activated=false,archive_stage='never_activated',activation_generation=6"
+        )
+
+
+@requires_db
+def test_control_helper_not_callable_by_client_roles(conn):
+    for role in ["anon", "authenticated"]:
+        assert not conn.execute(
+            "SELECT has_function_privilege(%s,'preserve_lifecycle_control()','EXECUTE') p",
+            (role,),
+        ).fetchone()["p"]
+        with conn.transaction():
+            conn.execute(f"SET LOCAL ROLE {role}")
+            with (
+                pytest.raises(psycopg.errors.InsufficientPrivilege),
+                conn.transaction(),
+            ):
+                conn.execute("SELECT preserve_lifecycle_control()")
+            conn.execute("RESET ROLE")
+
+
+@requires_db
+def test_mapping_never_overwrites_existing_cache_use_or_observation_evidence(conn):
+    seed(conn)
+    identity().migrate_identity_batch(conn)
+    conn.execute("UPDATE jobs SET description_last_used_at='2026-01-01Z'")
+    conn.execute(
+        "UPDATE source_listings SET successful_sighting_count=5,successful_last_observed_at='2026-01-01Z',source_published_at='2025-06-01Z',source_published_provenance='new_source_response'"
+    )
+    before = conn.execute("SELECT * FROM source_listings").fetchone()
+    assert identity().migrate_identity_batch(conn) == 0
+    assert conn.execute("SELECT * FROM source_listings").fetchone() == before
+    assert conn.execute("SELECT description_last_used_at FROM jobs").fetchone()[
+        "description_last_used_at"
+    ] == datetime(2026, 1, 1, tzinfo=UTC)
+
+
+@requires_db
+def test_service_account_erasure_inventory_deletes_only_target_demands(conn):
+    """Exercise the actual registry's bounded account erasure statements locally.
+
+    The existing accountDeletion.ts serviceSql loop is privileged, derives its
+    user from the verified caller and filters each DELETE by that user_id.
+    No authenticated demand DELETE privilege is added for this path.
+    """
+    import re
+    from pathlib import Path
+
+    seed(conn)
+    identity().migrate_identity_batch(conn)
+    users = [uuid4(), uuid4()]
+    for user in users:
+        conn.execute(
+            "INSERT INTO profiles(user_id,profile_version) VALUES (%s,'v')", (user,)
+        )
+        conn.execute(
+            "INSERT INTO job_payload_demands(user_id,job_id,kind) VALUES (%s,'lever:x:0','description')",
+            (user,),
+        )
+    conn.commit()
+    registry = (
+        Path(__file__).resolve().parents[1] / "dashboard/lib/userScopedTables.ts"
+    ).read_text()
+    table_list = registry.split("export const USER_DELETE_TABLES = [", 1)[1].split(
+        "] as const;", 1
+    )[0]
+    tables = re.findall(r'^  "([a-z_]+)",', table_list, re.MULTILINE)
+    assert "job_payload_demands" in tables
+    for table in tables:
+        # Registry identifiers only; target user remains a bound parameter.
+        conn.execute(f"DELETE FROM {table} WHERE user_id=%s", (users[0],))
+    assert conn.execute("SELECT user_id FROM job_payload_demands").fetchall() == [
+        {"user_id": users[1]}
+    ]
+    assert conn.execute("SELECT count(*) n FROM jobs").fetchone()["n"] == 1
+
+
+@requires_db
+def test_collect_mapping_is_bounded_restartable_and_preserves_frozen_age(conn):
+    seed(conn, 3)
+    conn.execute(
+        "UPDATE lifecycle_control SET safety_stage='collect',activation_generation=1"
+    )
+    assert identity().migrate_identity_batch(conn, 1) == 1
+    conn.commit()
+    original = conn.execute(
+        "SELECT * FROM source_listings WHERE job_id='lever:x:0'"
+    ).fetchone()
+    with psycopg.connect(TEST_DSN, row_factory=dict_row) as restarted:
+        assert identity().migrate_identity_batch(restarted, 1) == 1
+    assert identity().migrate_identity_batch(conn, 1) == 1
+    assert identity().migrate_identity_batch(conn, 1) == 0
+    assert (
+        conn.execute(
+            "SELECT * FROM source_listings WHERE job_id='lever:x:0'"
+        ).fetchone()
+        == original
+    )
+    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 0
+
+
+@requires_db
+@pytest.mark.parametrize(
+    "stage,ever,archive",
+    [
+        ("enforced", False, "never_activated"),
+        ("legacy", True, "active"),
+        ("collect", True, "producer_paused"),
+    ],
+)
+def test_mapping_refuses_enforced_or_sticky_archive_state(conn, stage, ever, archive):
+    seed(conn)
+    # Test fixture for later schema stages; no production activation API exists.
+    conn.execute(
+        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
+    )
+    conn.execute(
+        "UPDATE lifecycle_control SET safety_stage=%s,archive_ever_activated=%s,archive_stage=%s,activation_generation=1",
+        (stage, ever, archive),
+    )
+    conn.execute(
+        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
+    )
+    before = conn.execute("SELECT * FROM lifecycle_control").fetchone()
+    with pytest.raises(RuntimeError, match="pre-cutover"):
+        identity().migrate_identity_batch(conn)
+    assert conn.execute("SELECT * FROM lifecycle_control").fetchone() == before
+    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 0
+    assert (
+        conn.execute("SELECT description_captured_at FROM jobs").fetchone()[
+            "description_captured_at"
+        ]
+        is None
+    )
diff --git a/tests/test_lifecycle_migrations.py b/tests/test_lifecycle_migrations.py
index c42af03..0d41faf 100644
--- a/tests/test_lifecycle_migrations.py
+++ b/tests/test_lifecycle_migrations.py
@@ -151,10 +151,43 @@ def test_bootstrap_rejects_inherited_global_defaults_before_drop(conn):
 ])
 def test_catalog_detects_implicit_owner_privilege_changes_with_null_acls(conn, setup, acl_query, mutation):
     module = helpers()
     conn.execute(setup)
     assert conn.execute(acl_query).fetchone()["acl"] is None
     before = module.schema_catalog(conn)
     conn.execute(mutation)
     assert conn.execute(acl_query).fetchone()["acl"] is None
     assert module.schema_catalog(conn) != before
     conn.rollback()
+
+
+@requires_db
+def test_lifecycle_ddl_does_not_backfill_or_reset_legacy_rows(conn):
+    module = helpers()
+    module.bootstrap_schema(conn, FROZEN.read_text())
+    cid = conn.execute(
+        "INSERT INTO companies(name,ats,token) VALUES ('Legacy','lever','legacy') RETURNING id"
+    ).fetchone()["id"]
+    conn.execute(
+        "INSERT INTO jobs(id,company_id,external_id,title,url,description,first_seen_at) VALUES ('legacy',%s,'1','Engineer','u','retained','2020-01-01Z')",
+        (cid,),
+    )
+    conn.commit()
+    migration = ROOT / "migrations/2026-10-03-01-lifecycle-core.sql"
+    assert migration.exists(), "additive lifecycle migration absent"
+    module.apply_migrations(conn, [migration])
+    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 0
+    assert (
+        conn.execute("SELECT description_captured_at FROM jobs").fetchone()[
+            "description_captured_at"
+        ]
+        is None
+    )
+    identity = importlib.import_module("job_discovery.lifecycle.identity")
+    assert identity.migrate_identity_batch(conn, 1) == 1
+    conn.commit()
+    before = conn.execute("SELECT * FROM source_listings").fetchall()
+    control = conn.execute("SELECT * FROM lifecycle_control").fetchone()
+    module.apply_migrations(conn, [migration])
+    assert conn.execute("SELECT * FROM source_listings").fetchall() == before
+    assert conn.execute("SELECT * FROM lifecycle_control").fetchone() == control
+    assert identity.migrate_identity_batch(conn) == 0
diff --git a/tests/test_rls_isolation.py b/tests/test_rls_isolation.py
index fbbb158..34a1c9f 100644
--- a/tests/test_rls_isolation.py
+++ b/tests/test_rls_isolation.py
@@ -403,20 +403,22 @@ def test_local_config_does_not_bleed_after_transaction(conn):
 # permissive deny-all `no_anon_access` (FOR ALL, role {public}) PLUS its owner/shared
 # policies scoped to `authenticated`. Permissive policies OR together, so for anon the
 # effective set is just the deny-all; for authenticated it is deny-all OR the owner rule.
 # policyname -> (cmd, frozenset(roles)).
 _DENY = ("ALL", frozenset({"public"}))
 _OWNER_ALL = {
     "no_anon_access": _DENY,
     "owner_access": ("ALL", frozenset({"authenticated"})),
 }
 EXPECTED_RLS = {
+    # Early lifecycle prerequisite: service-only until reviewed demand access cutover.
+    "job_payload_demands": {},
     "matching_activity": {"owner_read": ("SELECT", frozenset({"authenticated"}))},
     "feedback": {"feedback_owner_read": ("SELECT", frozenset({"authenticated"}))},
     # Full owner CRUD (owner_access FOR ALL, USING/WITH CHECK = app_user_id()).
     "profiles": _OWNER_ALL,
     "job_reviews": _OWNER_ALL,
     "review_corrections": _OWNER_ALL,
     "company_reviews": _OWNER_ALL,
     "application_packages": _OWNER_ALL,
     "resume_scores": _OWNER_ALL,
     # Cover-letter edit overlay (2026-07-07-cover-letter-edits): owner CRUD; the
