# Full pinned review package

BASE: 255909ec819f4908a8701a42ae5122fe121b0935

HEAD: 8731cd32adb67755dfbbdd7ee53e09ec03d239c5

## Commits

8731cd32adb67755dfbbdd7ee53e09ec03d239c5 docs: normalize Task 4 verification evidence whitespace
9608f7c0ca6d409e2d694ec2dadc70f4a6b70629 feat: run bounded identity-preserving maintenance before admission


## Files

 .../task-4-evidence/commands.txt                   |  37 ++
 .../task-4-evidence/expanded-attempt17.txt         | 387 +++++++++++++++++++++
 .../task-4-evidence/expanded2-17.txt               | 319 +++++++++++++++++
 .../task-4-evidence/final16.txt                    |   4 +
 .../task-4-evidence/final17.txt                    |   4 +
 .../task-4-evidence/green-attempt17.txt            |   3 +
 .../task-4-evidence/green-cover-attempt17.txt      | 333 ++++++++++++++++++
 .../task-4-evidence/green-expanded3-17.txt         |  89 +++++
 .../task-4-evidence/green-expanded4-17.txt         |   3 +
 .../task-4-evidence/green-expanded5-17.txt         |  40 +++
 .../task-4-evidence/pre-byte-final17.txt           |   4 +
 .../task-4-evidence/red17.txt                      | 144 ++++++++
 .../task-4-evidence/ruff.txt                       |   1 +
 .../task-4-report.md                               | 189 ++++++++++
 job_discovery/lifecycle/maintenance.py             | 300 ++++++++++++++++
 job_discovery/prune.py                             |   7 +-
 job_discovery/run.py                               |  60 +++-
 migrations/2026-10-03-02-maintenance.sql           | 104 ++++++
 schema.sql                                         | 104 ++++++
 tests/test_lifecycle_maintenance.py                | 377 ++++++++++++++++++++
 tests/test_run.py                                  |  78 +++++
 tests/test_size_guard.py                           |   6 +-
 22 files changed, 2581 insertions(+), 12 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/commands.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/commands.txt
new file mode 100644
index 0000000..24f3ac7
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/commands.txt
@@ -0,0 +1,37 @@
+Workdir: /workspace/job-board/.claude/worktrees/lifecycle-recovery
+Shell: /bin/bash, login:false
+All logs redirected to .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/<named log> with > ... 2>&1.
+
+red17.txt:
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_maintenance.py tests/test_prune.py tests/test_size_guard.py tests/test_run.py -q
+
+green-attempt17.txt:
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_maintenance.py -q
+
+green-cover-attempt17.txt:
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_maintenance.py tests/test_prune.py tests/test_size_guard.py tests/test_run.py tests/test_lifecycle_migrations.py -q
+
+expanded-attempt17.txt / expanded2-17.txt (successive source/fixture states):
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_maintenance.py -q
+
+green-expanded3-17.txt / green-expanded5-17.txt (successive source/fixture states):
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_lifecycle_migrations.py -q
+
+green-expanded4-17.txt:
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_maintenance.py tests/test_lifecycle_migrations.py -q
+
+pre-byte-final17.txt (110 tests, before final byte-bound addition):
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_lifecycle_migrations.py tests/test_run_question_fetch.py -q
+
+final17.txt:
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_lifecycle_migrations.py tests/test_run_question_fetch.py -q
+
+final16.txt:
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_lifecycle_migrations.py tests/test_run_question_fetch.py -q
+
+ruff.txt:
+.venv/bin/ruff check .
+
+Working/staged whitespace:
+git diff --check
+git diff --cached --check
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/expanded-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/expanded-attempt17.txt
new file mode 100644
index 0000000..4c63e44
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/expanded-attempt17.txt
@@ -0,0 +1,387 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+.................FFFFFFF..                                               [100%]
+=================================== FAILURES ===================================
+__________ test_persisted_work_excludes_payload_retirement[snapshot] ___________
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32932 user=postgres database=poller_lifecycle_test) at 0x7fc7fb727620>
+kind = 'snapshot'
+
+    @requires_db
+    @pytest.mark.parametrize('kind', ['approve', 'correction', 'package', 'score', 'edit', 'generation', 'demand', 'snapshot'])
+    def test_persisted_work_excludes_payload_retirement(conn, kind):
+        m = module()
+        cid = _company(conn, 'work')
+        jid = _job(conn, cid, '1')
+        conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-interval '31 days'")
+        uid = '33333333-3333-3333-3333-333333333333'
+        queries = {
+            'approve': "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES(%s,%s,'v','approve')",
+            'correction': "INSERT INTO review_corrections(user_id,job_id,verdict) VALUES(%s,%s,'approve')",
+            'package': "INSERT INTO application_packages(user_id,job_id) VALUES(%s,%s)",
+            'score': "INSERT INTO resume_scores(user_id,job_id) VALUES(%s,%s)",
+            'edit': "INSERT INTO cover_letter_edits(user_id,job_id,edited_text) VALUES(%s,%s,'edit')",
+            'generation': "INSERT INTO generation_jobs(user_id,job_id,kind) VALUES(%s,%s,'prepare')",
+            'demand': "INSERT INTO job_payload_demands(user_id,job_id,kind) VALUES(%s,%s,'review')",
+            'snapshot': "INSERT INTO job_payload_demands(user_id,job_id,kind,status,description_snapshot,snapshot_captured_at) VALUES(%s,%s,'review','ready','used',clock_timestamp())",
+        }
+>       conn.execute(queries[kind], (uid, jid))
+
+tests/test_lifecycle_maintenance.py:134:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32932 user=postgres database=poller_lifecycle_test) at 0x7fc7fb727620>
+query = "INSERT INTO job_payload_demands(user_id,job_id,kind,status,description_snapshot,snapshot_captured_at) VALUES(%s,%s,'review','ready','used',clock_timestamp())"
+params = ('33333333-3333-3333-3333-333333333333', 'lever:work:1')
+prepare = None, binary = False
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
+E           psycopg.errors.CheckViolation: new row for relation "job_payload_demands" violates check constraint "job_payload_demands_ready_version"
+E           DETAIL:  Failing row contains (9f5af3fa-6165-4188-89fd-48c0696fec93, 33333333-3333-3333-3333-333333333333, lever:work:1, review, ready, null, 0, null, 2026-10-07 14:04:46.456086+00, null, null, used, null, 2026-10-07 14:04:46.461069+00, 2026-10-07 14:07:46.461069+00).
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: CheckViolation
+______ test_completed_and_abandoned_staging_cleanup_windows[True-25-True] ______
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32932 user=postgres database=poller_lifecycle_test) at 0x7fc7fb725a30>
+completed = True, hours = 25, cleaned = True
+
+    @requires_db
+    @pytest.mark.parametrize('completed,hours,cleaned', [(True,25,True),(True,23,False),(False,169,True),(False,167,False)])
+    def test_completed_and_abandoned_staging_cleanup_windows(conn, completed, hours, cleaned):
+        m = module()
+>       source, eid, old = enumeration(conn, completed=completed, hours=hours)
+                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_maintenance.py:163:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_maintenance.py:152: in enumeration
+    conn.execute("INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s,%s) n", (eid, start, min(start+499,members)))
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32932 user=postgres database=poller_lifecycle_test) at 0x7fc7fb725a30>
+query = "INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s,%s) n"
+params = (UUID('29854a78-1d99-47fa-b1cc-f8cdee67df37'), 1, 4), prepare = None
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
+E           psycopg.errors.AmbiguousFunction: function generate_series(smallint, smallint) is not unique
+E           LINE 1: ...ration_members SELECT $1,n::text,'{}'::jsonb FROM generate_s...
+E                                                                        ^
+E           HINT:  Could not choose a best candidate function. You might need to add explicit type casts.
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: AmbiguousFunction
+_____ test_completed_and_abandoned_staging_cleanup_windows[True-23-False] ______
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32932 user=postgres database=poller_lifecycle_test) at 0x7fc7fb725bb0>
+completed = True, hours = 23, cleaned = False
+
+    @requires_db
+    @pytest.mark.parametrize('completed,hours,cleaned', [(True,25,True),(True,23,False),(False,169,True),(False,167,False)])
+    def test_completed_and_abandoned_staging_cleanup_windows(conn, completed, hours, cleaned):
+        m = module()
+>       source, eid, old = enumeration(conn, completed=completed, hours=hours)
+                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_maintenance.py:163:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_maintenance.py:152: in enumeration
+    conn.execute("INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s,%s) n", (eid, start, min(start+499,members)))
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32932 user=postgres database=poller_lifecycle_test) at 0x7fc7fb725bb0>
+query = "INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s,%s) n"
+params = (UUID('dde75aca-9b0e-4e72-8aa5-795346623a4a'), 1, 4), prepare = None
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
+E           psycopg.errors.AmbiguousFunction: function generate_series(smallint, smallint) is not unique
+E           LINE 1: ...ration_members SELECT $1,n::text,'{}'::jsonb FROM generate_s...
+E                                                                        ^
+E           HINT:  Could not choose a best candidate function. You might need to add explicit type casts.
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: AmbiguousFunction
+_____ test_completed_and_abandoned_staging_cleanup_windows[False-169-True] _____
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32932 user=postgres database=poller_lifecycle_test) at 0x7fc7fb748a70>
+completed = False, hours = 169, cleaned = True
+
+    @requires_db
+    @pytest.mark.parametrize('completed,hours,cleaned', [(True,25,True),(True,23,False),(False,169,True),(False,167,False)])
+    def test_completed_and_abandoned_staging_cleanup_windows(conn, completed, hours, cleaned):
+        m = module()
+>       source, eid, old = enumeration(conn, completed=completed, hours=hours)
+                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_maintenance.py:163:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_maintenance.py:152: in enumeration
+    conn.execute("INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s,%s) n", (eid, start, min(start+499,members)))
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32932 user=postgres database=poller_lifecycle_test) at 0x7fc7fb748a70>
+query = "INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s,%s) n"
+params = (UUID('a8113d4f-5522-4dcb-9e16-fb9365602bb2'), 1, 4), prepare = None
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
+E           psycopg.errors.AmbiguousFunction: function generate_series(smallint, smallint) is not unique
+E           LINE 1: ...ration_members SELECT $1,n::text,'{}'::jsonb FROM generate_s...
+E                                                                        ^
+E           HINT:  Could not choose a best candidate function. You might need to add explicit type casts.
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: AmbiguousFunction
+____ test_completed_and_abandoned_staging_cleanup_windows[False-167-False] _____
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32932 user=postgres database=poller_lifecycle_test) at 0x7fc7fb726fc0>
+completed = False, hours = 167, cleaned = False
+
+    @requires_db
+    @pytest.mark.parametrize('completed,hours,cleaned', [(True,25,True),(True,23,False),(False,169,True),(False,167,False)])
+    def test_completed_and_abandoned_staging_cleanup_windows(conn, completed, hours, cleaned):
+        m = module()
+>       source, eid, old = enumeration(conn, completed=completed, hours=hours)
+                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_maintenance.py:163:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_maintenance.py:152: in enumeration
+    conn.execute("INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s,%s) n", (eid, start, min(start+499,members)))
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32932 user=postgres database=poller_lifecycle_test) at 0x7fc7fb726fc0>
+query = "INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s,%s) n"
+params = (UUID('06797b16-4b35-4de4-ab87-352f0b1ae485'), 1, 4), prepare = None
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
+E           psycopg.errors.AmbiguousFunction: function generate_series(smallint, smallint) is not unique
+E           LINE 1: ...ration_members SELECT $1,n::text,'{}'::jsonb FROM generate_s...
+E                                                                        ^
+E           HINT:  Could not choose a best candidate function. You might need to add explicit type casts.
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: AmbiguousFunction
+_______ test_staging_cleanup_is_capped_and_resumes_from_committed_fence ________
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32932 user=postgres database=poller_lifecycle_test) at 0x7fc7fb725d30>
+
+    @requires_db
+    def test_staging_cleanup_is_capped_and_resumes_from_committed_fence(conn):
+        m = module()
+>       source, eid, old = enumeration(conn, members=21005)
+                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_maintenance.py:176:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_maintenance.py:152: in enumeration
+    conn.execute("INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s,%s) n", (eid, start, min(start+499,members)))
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32932 user=postgres database=poller_lifecycle_test) at 0x7fc7fb725d30>
+query = "INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s,%s) n"
+params = (UUID('b03f6669-269d-46c6-8f98-204ddd7d45ed'), 1, 500), prepare = None
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
+E           psycopg.errors.AmbiguousFunction: function generate_series(smallint, smallint) is not unique
+E           LINE 1: ...ration_members SELECT $1,n::text,'{}'::jsonb FROM generate_s...
+E                                                                        ^
+E           HINT:  Could not choose a best candidate function. You might need to add explicit type casts.
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: AmbiguousFunction
+_________ test_completed_requires_committed_reconciliation_checkpoint __________
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32932 user=postgres database=poller_lifecycle_test) at 0x7fc7fb748da0>
+
+    @requires_db
+    def test_completed_requires_committed_reconciliation_checkpoint(conn):
+        m = module()
+>       _, eid, _ = enumeration(conn, completed=True, hours=25)
+                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_maintenance.py:193:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_maintenance.py:152: in enumeration
+    conn.execute("INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s,%s) n", (eid, start, min(start+499,members)))
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32932 user=postgres database=poller_lifecycle_test) at 0x7fc7fb748da0>
+query = "INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s,%s) n"
+params = (UUID('451a527c-33ab-473d-b718-38cb0758d6b6'), 1, 4), prepare = None
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
+E           psycopg.errors.AmbiguousFunction: function generate_series(smallint, smallint) is not unique
+E           LINE 1: ...ration_members SELECT $1,n::text,'{}'::jsonb FROM generate_s...
+E                                                                        ^
+E           HINT:  Could not choose a best candidate function. You might need to add explicit type casts.
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: AmbiguousFunction
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_maintenance.py::test_persisted_work_excludes_payload_retirement[snapshot]
+FAILED tests/test_lifecycle_maintenance.py::test_completed_and_abandoned_staging_cleanup_windows[True-25-True]
+FAILED tests/test_lifecycle_maintenance.py::test_completed_and_abandoned_staging_cleanup_windows[True-23-False]
+FAILED tests/test_lifecycle_maintenance.py::test_completed_and_abandoned_staging_cleanup_windows[False-169-True]
+FAILED tests/test_lifecycle_maintenance.py::test_completed_and_abandoned_staging_cleanup_windows[False-167-False]
+FAILED tests/test_lifecycle_maintenance.py::test_staging_cleanup_is_capped_and_resumes_from_committed_fence
+FAILED tests/test_lifecycle_maintenance.py::test_completed_requires_committed_reconciliation_checkpoint
+7 failed, 19 passed in 11.62s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/expanded2-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/expanded2-17.txt
new file mode 100644
index 0000000..13eef5e
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/expanded2-17.txt
@@ -0,0 +1,319 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..................FFFFFF..                                               [100%]
+=================================== FAILURES ===================================
+______ test_completed_and_abandoned_staging_cleanup_windows[True-25-True] ______
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32933 user=postgres database=poller_lifecycle_test) at 0x7fce9012ac60>
+completed = True, hours = 25, cleaned = True
+
+    @requires_db
+    @pytest.mark.parametrize('completed,hours,cleaned', [(True,25,True),(True,23,False),(False,169,True),(False,167,False)])
+    def test_completed_and_abandoned_staging_cleanup_windows(conn, completed, hours, cleaned):
+        m = module()
+>       source, eid, old = enumeration(conn, completed=completed, hours=hours)
+                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_maintenance.py:163:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_maintenance.py:152: in enumeration
+    conn.execute("INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s::int,%s::int) n", (eid, start, min(start+499,members)))
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32933 user=postgres database=poller_lifecycle_test) at 0x7fce9012ac60>
+query = "INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s::int,%s::int) n"
+params = (UUID('1eab22fe-7b56-4376-a9f9-00bd1a2b9d28'), 1, 4), prepare = None
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
+E           psycopg.errors.UndefinedColumn: record "new" has no field "generation"
+E           CONTEXT:  SQL expression "TG_TABLE_NAME='reconciliation_checkpoints' AND NEW.generation<>e.generation"
+E           PL/pgSQL function public.lifecycle_staging_fence() line 19 at IF
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedColumn
+_____ test_completed_and_abandoned_staging_cleanup_windows[True-23-False] ______
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32933 user=postgres database=poller_lifecycle_test) at 0x7fce90129010>
+completed = True, hours = 23, cleaned = False
+
+    @requires_db
+    @pytest.mark.parametrize('completed,hours,cleaned', [(True,25,True),(True,23,False),(False,169,True),(False,167,False)])
+    def test_completed_and_abandoned_staging_cleanup_windows(conn, completed, hours, cleaned):
+        m = module()
+>       source, eid, old = enumeration(conn, completed=completed, hours=hours)
+                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_maintenance.py:163:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_maintenance.py:152: in enumeration
+    conn.execute("INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s::int,%s::int) n", (eid, start, min(start+499,members)))
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32933 user=postgres database=poller_lifecycle_test) at 0x7fce90129010>
+query = "INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s::int,%s::int) n"
+params = (UUID('6a2a36e0-1704-4cb7-b5df-1107177a7c8d'), 1, 4), prepare = None
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
+E           psycopg.errors.UndefinedColumn: record "new" has no field "generation"
+E           CONTEXT:  SQL expression "TG_TABLE_NAME='reconciliation_checkpoints' AND NEW.generation<>e.generation"
+E           PL/pgSQL function public.lifecycle_staging_fence() line 19 at IF
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedColumn
+_____ test_completed_and_abandoned_staging_cleanup_windows[False-169-True] _____
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32933 user=postgres database=poller_lifecycle_test) at 0x7fce9012b0e0>
+completed = False, hours = 169, cleaned = True
+
+    @requires_db
+    @pytest.mark.parametrize('completed,hours,cleaned', [(True,25,True),(True,23,False),(False,169,True),(False,167,False)])
+    def test_completed_and_abandoned_staging_cleanup_windows(conn, completed, hours, cleaned):
+        m = module()
+>       source, eid, old = enumeration(conn, completed=completed, hours=hours)
+                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_maintenance.py:163:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_maintenance.py:152: in enumeration
+    conn.execute("INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s::int,%s::int) n", (eid, start, min(start+499,members)))
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32933 user=postgres database=poller_lifecycle_test) at 0x7fce9012b0e0>
+query = "INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s::int,%s::int) n"
+params = (UUID('ad107416-2573-4fdf-a1e5-f6b5b1c9184f'), 1, 4), prepare = None
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
+E           psycopg.errors.UndefinedColumn: record "new" has no field "generation"
+E           CONTEXT:  SQL expression "TG_TABLE_NAME='reconciliation_checkpoints' AND NEW.generation<>e.generation"
+E           PL/pgSQL function public.lifecycle_staging_fence() line 19 at IF
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedColumn
+____ test_completed_and_abandoned_staging_cleanup_windows[False-167-False] _____
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32933 user=postgres database=poller_lifecycle_test) at 0x7fce9012b6e0>
+completed = False, hours = 167, cleaned = False
+
+    @requires_db
+    @pytest.mark.parametrize('completed,hours,cleaned', [(True,25,True),(True,23,False),(False,169,True),(False,167,False)])
+    def test_completed_and_abandoned_staging_cleanup_windows(conn, completed, hours, cleaned):
+        m = module()
+>       source, eid, old = enumeration(conn, completed=completed, hours=hours)
+                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_maintenance.py:163:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_maintenance.py:152: in enumeration
+    conn.execute("INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s::int,%s::int) n", (eid, start, min(start+499,members)))
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32933 user=postgres database=poller_lifecycle_test) at 0x7fce9012b6e0>
+query = "INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s::int,%s::int) n"
+params = (UUID('8bda0399-a6c5-4347-a056-5e5d37d129ed'), 1, 4), prepare = None
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
+E           psycopg.errors.UndefinedColumn: record "new" has no field "generation"
+E           CONTEXT:  SQL expression "TG_TABLE_NAME='reconciliation_checkpoints' AND NEW.generation<>e.generation"
+E           PL/pgSQL function public.lifecycle_staging_fence() line 19 at IF
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedColumn
+_______ test_staging_cleanup_is_capped_and_resumes_from_committed_fence ________
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32933 user=postgres database=poller_lifecycle_test) at 0x7fce9012ab70>
+
+    @requires_db
+    def test_staging_cleanup_is_capped_and_resumes_from_committed_fence(conn):
+        m = module()
+>       source, eid, old = enumeration(conn, members=21005)
+                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_maintenance.py:176:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_maintenance.py:152: in enumeration
+    conn.execute("INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s::int,%s::int) n", (eid, start, min(start+499,members)))
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32933 user=postgres database=poller_lifecycle_test) at 0x7fce9012ab70>
+query = "INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s::int,%s::int) n"
+params = (UUID('5929e65c-28cf-4507-91af-56d30ee3d24e'), 1, 500), prepare = None
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
+E           psycopg.errors.UndefinedColumn: record "new" has no field "generation"
+E           CONTEXT:  SQL expression "TG_TABLE_NAME='reconciliation_checkpoints' AND NEW.generation<>e.generation"
+E           PL/pgSQL function public.lifecycle_staging_fence() line 19 at IF
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedColumn
+_________ test_completed_requires_committed_reconciliation_checkpoint __________
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32933 user=postgres database=poller_lifecycle_test) at 0x7fce901292b0>
+
+    @requires_db
+    def test_completed_requires_committed_reconciliation_checkpoint(conn):
+        m = module()
+>       _, eid, _ = enumeration(conn, completed=True, hours=25)
+                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_maintenance.py:193:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_maintenance.py:152: in enumeration
+    conn.execute("INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s::int,%s::int) n", (eid, start, min(start+499,members)))
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32933 user=postgres database=poller_lifecycle_test) at 0x7fce901292b0>
+query = "INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s::int,%s::int) n"
+params = (UUID('22892446-c7df-456d-b22c-08234ba6e4ac'), 1, 4), prepare = None
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
+E           psycopg.errors.UndefinedColumn: record "new" has no field "generation"
+E           CONTEXT:  SQL expression "TG_TABLE_NAME='reconciliation_checkpoints' AND NEW.generation<>e.generation"
+E           PL/pgSQL function public.lifecycle_staging_fence() line 19 at IF
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedColumn
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_maintenance.py::test_completed_and_abandoned_staging_cleanup_windows[True-25-True]
+FAILED tests/test_lifecycle_maintenance.py::test_completed_and_abandoned_staging_cleanup_windows[True-23-False]
+FAILED tests/test_lifecycle_maintenance.py::test_completed_and_abandoned_staging_cleanup_windows[False-169-True]
+FAILED tests/test_lifecycle_maintenance.py::test_completed_and_abandoned_staging_cleanup_windows[False-167-False]
+FAILED tests/test_lifecycle_maintenance.py::test_staging_cleanup_is_capped_and_resumes_from_committed_fence
+FAILED tests/test_lifecycle_maintenance.py::test_completed_requires_committed_reconciliation_checkpoint
+6 failed, 20 passed in 10.43s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/final16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/final16.txt
new file mode 100644
index 0000000..f2b7e7b
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/final16.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [ 64%]
+.......................................                                  [100%]
+111 passed in 106.50s (0:01:46)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/final17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/final17.txt
new file mode 100644
index 0000000..8592753
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/final17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 64%]
+.......................................                                  [100%]
+111 passed in 80.40s (0:01:20)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/green-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/green-attempt17.txt
new file mode 100644
index 0000000..4828249
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/green-attempt17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+.....                                                                    [100%]
+5 passed in 2.17s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/green-cover-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/green-cover-attempt17.txt
new file mode 100644
index 0000000..20d428d
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/green-cover-attempt17.txt
@@ -0,0 +1,333 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..........................FFFF.......................................... [100%]
+=================================== FAILURES ===================================
+___ test_guard_reconciles_only_complete_sources_without_ingestion[complete] ____
+
+conn = <psycopg.Connection [BAD] at 0x7fbb00cefe60>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fbb00ceea20>
+source_result = 'complete'
+
+    @requires_db
+    @pytest.mark.parametrize("source_result", ["complete", "failed", "partial", "incomplete"])
+    def test_guard_reconciles_only_complete_sources_without_ingestion(conn, monkeypatch, source_result):
+        from job_discovery.models import Posting
+        from tests.test_prune import _company, _job
+        cid = _company(conn, "guarded")
+        _job(conn, cid, "live", closed_days=40 if source_result == "complete" else 1)
+        _job(conn, cid, "missing")
+        monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
+        monkeypatch.setattr(db, "connect", lambda dsn=None: conn)
+        monkeypatch.setattr(db, "over_size_ceiling", lambda c: (True, 6500, 6000))
+        def forbidden(*args, **kwargs):
+            pytest.fail("guard allowed ingestion or enrichment")
+        monkeypatch.setattr(db, "sync_seed", forbidden)
+        monkeypatch.setattr(db, "upsert_jobs", forbidden)
+        monkeypatch.setattr(job_discovery_run, "backfill_greenhouse_questions", forbidden)
+        monkeypatch.setattr("job_discovery.locations.resolve_new_locations", forbidden)
+        monkeypatch.setattr("reviewer.run.review_all", forbidden)
+        def source(token):
+            if source_result == "failed":
+                raise ValueError("source unavailable")
+            yield Posting(external_id="live", title="Updated", url="u")
+            yield Posting(external_id="new", title="New", url="u")
+            if source_result != "complete":
+                raise ValueError("source unavailable or incomplete")
+        if source_result == "incomplete":
+            class Incomplete(list):
+                complete = False
+            def source(token):
+                return Incomplete([Posting(external_id="live", title="A", url="u")])
+        monkeypatch.setitem(job_discovery_run.ADAPTERS, "lever", source)
+        # run owns its connection; query persisted results on a separate connection.
+        import psycopg
+        from psycopg.rows import dict_row
+        from tests.conftest import TEST_DSN
+>       counts = job_discovery_run.run()
+                 ^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_size_guard.py:261:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+job_discovery/run.py:60: in run
+    locked = conn.execute(
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [BAD] at 0x7fbb00cefe60>
+query = "SELECT pg_try_advisory_lock(hashtext('job_discovery_poll')) AS locked"
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
+E           psycopg.OperationalError: the connection is closed
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: OperationalError
+____ test_guard_reconciles_only_complete_sources_without_ingestion[failed] _____
+
+conn = <psycopg.Connection [BAD] at 0x7fbb00ccdcd0>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fbb00ccf0e0>
+source_result = 'failed'
+
+    @requires_db
+    @pytest.mark.parametrize("source_result", ["complete", "failed", "partial", "incomplete"])
+    def test_guard_reconciles_only_complete_sources_without_ingestion(conn, monkeypatch, source_result):
+        from job_discovery.models import Posting
+        from tests.test_prune import _company, _job
+        cid = _company(conn, "guarded")
+        _job(conn, cid, "live", closed_days=40 if source_result == "complete" else 1)
+        _job(conn, cid, "missing")
+        monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
+        monkeypatch.setattr(db, "connect", lambda dsn=None: conn)
+        monkeypatch.setattr(db, "over_size_ceiling", lambda c: (True, 6500, 6000))
+        def forbidden(*args, **kwargs):
+            pytest.fail("guard allowed ingestion or enrichment")
+        monkeypatch.setattr(db, "sync_seed", forbidden)
+        monkeypatch.setattr(db, "upsert_jobs", forbidden)
+        monkeypatch.setattr(job_discovery_run, "backfill_greenhouse_questions", forbidden)
+        monkeypatch.setattr("job_discovery.locations.resolve_new_locations", forbidden)
+        monkeypatch.setattr("reviewer.run.review_all", forbidden)
+        def source(token):
+            if source_result == "failed":
+                raise ValueError("source unavailable")
+            yield Posting(external_id="live", title="Updated", url="u")
+            yield Posting(external_id="new", title="New", url="u")
+            if source_result != "complete":
+                raise ValueError("source unavailable or incomplete")
+        if source_result == "incomplete":
+            class Incomplete(list):
+                complete = False
+            def source(token):
+                return Incomplete([Posting(external_id="live", title="A", url="u")])
+        monkeypatch.setitem(job_discovery_run.ADAPTERS, "lever", source)
+        # run owns its connection; query persisted results on a separate connection.
+        import psycopg
+        from psycopg.rows import dict_row
+        from tests.conftest import TEST_DSN
+>       counts = job_discovery_run.run()
+                 ^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_size_guard.py:261:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+job_discovery/run.py:60: in run
+    locked = conn.execute(
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [BAD] at 0x7fbb00ccdcd0>
+query = "SELECT pg_try_advisory_lock(hashtext('job_discovery_poll')) AS locked"
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
+E           psycopg.OperationalError: the connection is closed
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: OperationalError
+____ test_guard_reconciles_only_complete_sources_without_ingestion[partial] ____
+
+conn = <psycopg.Connection [BAD] at 0x7fbb00d46390>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fbb00d476e0>
+source_result = 'partial'
+
+    @requires_db
+    @pytest.mark.parametrize("source_result", ["complete", "failed", "partial", "incomplete"])
+    def test_guard_reconciles_only_complete_sources_without_ingestion(conn, monkeypatch, source_result):
+        from job_discovery.models import Posting
+        from tests.test_prune import _company, _job
+        cid = _company(conn, "guarded")
+        _job(conn, cid, "live", closed_days=40 if source_result == "complete" else 1)
+        _job(conn, cid, "missing")
+        monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
+        monkeypatch.setattr(db, "connect", lambda dsn=None: conn)
+        monkeypatch.setattr(db, "over_size_ceiling", lambda c: (True, 6500, 6000))
+        def forbidden(*args, **kwargs):
+            pytest.fail("guard allowed ingestion or enrichment")
+        monkeypatch.setattr(db, "sync_seed", forbidden)
+        monkeypatch.setattr(db, "upsert_jobs", forbidden)
+        monkeypatch.setattr(job_discovery_run, "backfill_greenhouse_questions", forbidden)
+        monkeypatch.setattr("job_discovery.locations.resolve_new_locations", forbidden)
+        monkeypatch.setattr("reviewer.run.review_all", forbidden)
+        def source(token):
+            if source_result == "failed":
+                raise ValueError("source unavailable")
+            yield Posting(external_id="live", title="Updated", url="u")
+            yield Posting(external_id="new", title="New", url="u")
+            if source_result != "complete":
+                raise ValueError("source unavailable or incomplete")
+        if source_result == "incomplete":
+            class Incomplete(list):
+                complete = False
+            def source(token):
+                return Incomplete([Posting(external_id="live", title="A", url="u")])
+        monkeypatch.setitem(job_discovery_run.ADAPTERS, "lever", source)
+        # run owns its connection; query persisted results on a separate connection.
+        import psycopg
+        from psycopg.rows import dict_row
+        from tests.conftest import TEST_DSN
+>       counts = job_discovery_run.run()
+                 ^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_size_guard.py:261:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+job_discovery/run.py:60: in run
+    locked = conn.execute(
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [BAD] at 0x7fbb00d46390>
+query = "SELECT pg_try_advisory_lock(hashtext('job_discovery_poll')) AS locked"
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
+E           psycopg.OperationalError: the connection is closed
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: OperationalError
+__ test_guard_reconciles_only_complete_sources_without_ingestion[incomplete] ___
+
+conn = <psycopg.Connection [BAD] at 0x7fbb00d47980>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fbb00d464e0>
+source_result = 'incomplete'
+
+    @requires_db
+    @pytest.mark.parametrize("source_result", ["complete", "failed", "partial", "incomplete"])
+    def test_guard_reconciles_only_complete_sources_without_ingestion(conn, monkeypatch, source_result):
+        from job_discovery.models import Posting
+        from tests.test_prune import _company, _job
+        cid = _company(conn, "guarded")
+        _job(conn, cid, "live", closed_days=40 if source_result == "complete" else 1)
+        _job(conn, cid, "missing")
+        monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
+        monkeypatch.setattr(db, "connect", lambda dsn=None: conn)
+        monkeypatch.setattr(db, "over_size_ceiling", lambda c: (True, 6500, 6000))
+        def forbidden(*args, **kwargs):
+            pytest.fail("guard allowed ingestion or enrichment")
+        monkeypatch.setattr(db, "sync_seed", forbidden)
+        monkeypatch.setattr(db, "upsert_jobs", forbidden)
+        monkeypatch.setattr(job_discovery_run, "backfill_greenhouse_questions", forbidden)
+        monkeypatch.setattr("job_discovery.locations.resolve_new_locations", forbidden)
+        monkeypatch.setattr("reviewer.run.review_all", forbidden)
+        def source(token):
+            if source_result == "failed":
+                raise ValueError("source unavailable")
+            yield Posting(external_id="live", title="Updated", url="u")
+            yield Posting(external_id="new", title="New", url="u")
+            if source_result != "complete":
+                raise ValueError("source unavailable or incomplete")
+        if source_result == "incomplete":
+            class Incomplete(list):
+                complete = False
+            def source(token):
+                return Incomplete([Posting(external_id="live", title="A", url="u")])
+        monkeypatch.setitem(job_discovery_run.ADAPTERS, "lever", source)
+        # run owns its connection; query persisted results on a separate connection.
+        import psycopg
+        from psycopg.rows import dict_row
+        from tests.conftest import TEST_DSN
+>       counts = job_discovery_run.run()
+                 ^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_size_guard.py:261:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+job_discovery/run.py:60: in run
+    locked = conn.execute(
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [BAD] at 0x7fbb00d47980>
+query = "SELECT pg_try_advisory_lock(hashtext('job_discovery_poll')) AS locked"
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
+E           psycopg.OperationalError: the connection is closed
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: OperationalError
+=========================== short test summary info ============================
+FAILED tests/test_size_guard.py::test_guard_reconciles_only_complete_sources_without_ingestion[complete]
+FAILED tests/test_size_guard.py::test_guard_reconciles_only_complete_sources_without_ingestion[failed]
+FAILED tests/test_size_guard.py::test_guard_reconciles_only_complete_sources_without_ingestion[partial]
+FAILED tests/test_size_guard.py::test_guard_reconciles_only_complete_sources_without_ingestion[incomplete]
+4 failed, 68 passed in 33.47s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/green-expanded3-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/green-expanded3-17.txt
new file mode 100644
index 0000000..afc6ba4
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/green-expanded3-17.txt
@@ -0,0 +1,89 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..................F.F.F................................................. [ 69%]
+..............F.................                                         [100%]
+=================================== FAILURES ===================================
+______ test_completed_and_abandoned_staging_cleanup_windows[True-25-True] ______
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32934 user=postgres database=poller_lifecycle_test) at 0x7fbd712f2c00>
+completed = True, hours = 25, cleaned = True
+
+    @requires_db
+    @pytest.mark.parametrize('completed,hours,cleaned', [(True,25,True),(True,23,False),(False,169,True),(False,167,False)])
+    def test_completed_and_abandoned_staging_cleanup_windows(conn, completed, hours, cleaned):
+        m = module()
+        source, eid, old = enumeration(conn, completed=completed, hours=hours)
+        enable(conn)
+        m.sweep(conn, claim(conn), max_rows=50)
+>       assert (conn.execute('SELECT id FROM source_enumerations WHERE id=%s', (eid,)).fetchone() is None) == cleaned
+E       AssertionError: assert ({'id': UUID('392e922f-5189-416d-932d-f6f8f96a376d')} is None) == True
+E        +  where {'id': UUID('392e922f-5189-416d-932d-f6f8f96a376d')} = fetchone()
+E        +    where fetchone = <psycopg.Cursor [TUPLES_OK] [INTRANS] (host=127.0.0.1 port=32934 user=postgres database=poller_lifecycle_test) at 0x7fbd712f9f10>.fetchone
+E        +      where <psycopg.Cursor [TUPLES_OK] [INTRANS] (host=127.0.0.1 port=32934 user=postgres database=poller_lifecycle_test) at 0x7fbd712f9f10> = execute('SELECT id FROM source_enumerations WHERE id=%s', (UUID('392e922f-5189-416d-932d-f6f8f96a376d'),))
+E        +        where execute = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32934 user=postgres database=poller_lifecycle_test) at 0x7fbd712f2c00>.execute
+
+tests/test_lifecycle_maintenance.py:166: AssertionError
+_____ test_completed_and_abandoned_staging_cleanup_windows[False-169-True] _____
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32934 user=postgres database=poller_lifecycle_test) at 0x7fbd713179e0>
+completed = False, hours = 169, cleaned = True
+
+    @requires_db
+    @pytest.mark.parametrize('completed,hours,cleaned', [(True,25,True),(True,23,False),(False,169,True),(False,167,False)])
+    def test_completed_and_abandoned_staging_cleanup_windows(conn, completed, hours, cleaned):
+        m = module()
+        source, eid, old = enumeration(conn, completed=completed, hours=hours)
+        enable(conn)
+        m.sweep(conn, claim(conn), max_rows=50)
+>       assert (conn.execute('SELECT id FROM source_enumerations WHERE id=%s', (eid,)).fetchone() is None) == cleaned
+E       AssertionError: assert ({'id': UUID('c8009145-6581-4787-8bf6-06dcb5965102')} is None) == True
+E        +  where {'id': UUID('c8009145-6581-4787-8bf6-06dcb5965102')} = fetchone()
+E        +    where fetchone = <psycopg.Cursor [TUPLES_OK] [INTRANS] (host=127.0.0.1 port=32934 user=postgres database=poller_lifecycle_test) at 0x7fbd712fa510>.fetchone
+E        +      where <psycopg.Cursor [TUPLES_OK] [INTRANS] (host=127.0.0.1 port=32934 user=postgres database=poller_lifecycle_test) at 0x7fbd712fa510> = execute('SELECT id FROM source_enumerations WHERE id=%s', (UUID('c8009145-6581-4787-8bf6-06dcb5965102'),))
+E        +        where execute = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32934 user=postgres database=poller_lifecycle_test) at 0x7fbd713179e0>.execute
+
+tests/test_lifecycle_maintenance.py:166: AssertionError
+_______ test_staging_cleanup_is_capped_and_resumes_from_committed_fence ________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32934 user=postgres database=poller_lifecycle_test) at 0x7fbd71316d80>
+
+    @requires_db
+    def test_staging_cleanup_is_capped_and_resumes_from_committed_fence(conn):
+        m = module()
+        source, eid, old = enumeration(conn, members=21005)
+        enable(conn)
+        c = claim(conn)
+        result = m.sweep(conn, c)
+        remaining = conn.execute('SELECT count(*) AS n FROM enumeration_members').fetchone()['n']
+>       assert remaining == 1008  # 20,000 total units includes the 3-row fence.
+        ^^^^^^^^^^^^^^^^^^^^^^^^
+E       assert 21005 == 1008
+
+tests/test_lifecycle_maintenance.py:181: AssertionError
+__ test_existing_recorded_migrations_reapply_without_catalog_or_ledger_drift ___
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32934 user=postgres database=poller_lifecycle_test) at 0x7fbd712f2240>
+
+    @requires_db
+    def test_existing_recorded_migrations_reapply_without_catalog_or_ledger_drift(conn):
+        module = helpers()
+        before = module.schema_catalog(conn)
+        ledger = conn.execute("SELECT filename,applied_at FROM schema_migrations ORDER BY filename").fetchall()
+        paths = [ROOT / "migrations" / row["filename"] for row in ledger]
+        assert paths, "schema.sql must record mirrored migrations"
+        module.apply_migrations(conn, paths)
+        module.apply_migrations(conn, paths)
+>       assert module.schema_catalog(conn) == before
+E       assert {'tables': [{....}, ...], ...} == {'tables': [{....}, ...], ...}
+E
+E         Omitting 9 identical items, use -vv to show
+E         Differing items:
+E         {'functions': [{'nspname': 'lifecycle_private', 'proname': 'protect_demand_claim', 'arguments': '', 'definition': "CRE...AND state<>'held';\n DELETE FROM public.lifecycle_write_checks WHERE subject_id=target;\nEND $function$\n", ...}, ...]} != {'functions': [{'nspname': 'lifecycle_private', 'proname': 'protect_demand_claim', 'arguments': '', 'definition': "CRE...AND state<>'held';\n DELETE FROM public.lifecycle_write_checks WHERE subject_id=target;\nEND $function$\n", ...}, ...]}
+E         Use -v to get more diff
+
+tests/test_lifecycle_migrations.py:61: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_maintenance.py::test_completed_and_abandoned_staging_cleanup_windows[True-25-True]
+FAILED tests/test_lifecycle_maintenance.py::test_completed_and_abandoned_staging_cleanup_windows[False-169-True]
+FAILED tests/test_lifecycle_maintenance.py::test_staging_cleanup_is_capped_and_resumes_from_committed_fence
+FAILED tests/test_lifecycle_migrations.py::test_existing_recorded_migrations_reapply_without_catalog_or_ledger_drift
+4 failed, 100 passed in 55.87s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/green-expanded4-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/green-expanded4-17.txt
new file mode 100644
index 0000000..2139393
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/green-expanded4-17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..................................................                       [100%]
+50 passed in 30.43s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/green-expanded5-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/green-expanded5-17.txt
new file mode 100644
index 0000000..e5987d6
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/green-expanded5-17.txt
@@ -0,0 +1,40 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..............................F......................................... [ 67%]
+..................................                                       [100%]
+=================================== FAILURES ===================================
+______ test_only_safely_archived_unreferenced_superseded_versions_retire _______
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32936 user=postgres database=poller_lifecycle_test) at 0x7fe95a165400>
+
+    @requires_db
+    def test_only_safely_archived_unreferenced_superseded_versions_retire(conn):
+        from job_discovery.lifecycle.identity import migrate_identity_batch
+        from job_discovery.lifecycle.locks import enter_gate
+        m = module()
+        cid = _company(conn,'versions')
+        jid = _job(conn,cid,'1')
+        migrate_identity_batch(conn)
+        listing = conn.execute('SELECT id FROM source_listings WHERE job_id=%s',(jid,)).fetchone()['id']
+        for revision in range(2,16):
+            conn.execute("""INSERT INTO job_versions(job_id,source_listing_id,revision,content_hash,public_metadata,observed_at,recorded_at)
+              VALUES(%s,%s,%s,repeat('a',64),'{}',clock_timestamp(),clock_timestamp()-make_interval(hours=>%s))""",
+              (jid,listing,revision,745 if revision in (5,6) else 1))
+        conn.execute('UPDATE source_listings SET current_revision=15,archived_revision=5,current_version_id=(SELECT id FROM job_versions WHERE revision=15)')
+        conn.commit()
+        enter_gate(conn)
+        n,retired,_ = m._version_batch(conn,2000,False)
+        conn.commit()
+        assert n == retired == 4  # 2/3/4 exceed ten superseded; 5 is >30d.
+        remaining = [r['revision'] for r in conn.execute('SELECT revision FROM job_versions ORDER BY revision')]
+>       assert remaining == [1,*range(6,16)]  # 1 referenced, 6 unarchived, 15 current.
+        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       assert [6, 7, 8, 9, 10, 11, ...] == [1, 6, 7, 8, 9, 10, ...]
+E
+E         At index 0 diff: 6 != 1
+E         Right contains one more item: 15
+E         Use -v to get more diff
+
+tests/test_lifecycle_maintenance.py:326: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_maintenance.py::test_only_safely_archived_unreferenced_superseded_versions_retire
+1 failed, 105 passed in 69.43s (0:01:09)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/pre-byte-final17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/pre-byte-final17.txt
new file mode 100644
index 0000000..033e417
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/pre-byte-final17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 65%]
+......................................                                   [100%]
+110 passed in 72.32s (0:01:12)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/red17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/red17.txt
new file mode 100644
index 0000000..9e2ecf2
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/red17.txt
@@ -0,0 +1,144 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FFFFF...............................................                     [100%]
+=================================== FAILURES ===================================
+_______________ test_dry_run_global_expiry_and_persisted_cursor ________________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32929 user=postgres database=poller_lifecycle_test) at 0x7f52323f34d0>
+
+    @requires_db
+    def test_dry_run_global_expiry_and_persisted_cursor(conn):
+>       m = module()
+            ^^^^^^^^
+
+tests/test_lifecycle_maintenance.py:28:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_maintenance.py:11: in module
+    return importlib.import_module('job_discovery.lifecycle.maintenance')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'job_discovery.lifecycle.maintenance'
+import_ = <function _gcd_import at 0x7f5234b500e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'job_discovery.lifecycle.maintenance'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+______ test_readiness_forces_dry_run_even_when_caller_requests_retirement ______
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32929 user=postgres database=poller_lifecycle_test) at 0x7f52308c3b90>
+
+    @requires_db
+    def test_readiness_forces_dry_run_even_when_caller_requests_retirement(conn):
+>       m = module()
+            ^^^^^^^^
+
+tests/test_lifecycle_maintenance.py:45:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_maintenance.py:11: in module
+    return importlib.import_module('job_discovery.lifecycle.maintenance')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'job_discovery.lifecycle.maintenance'
+import_ = <function _gcd_import at 0x7f5234b500e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'job_discovery.lifecycle.maintenance'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+__________ test_maintenance_cutover_permanently_disables_legacy_prune __________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32929 user=postgres database=poller_lifecycle_test) at 0x7f52308c3ec0>
+
+    @requires_db
+    def test_maintenance_cutover_permanently_disables_legacy_prune(conn):
+        from job_discovery.prune import prune_jobs
+        cid = _company(conn, 'cutover')
+        jid = _job(conn, cid, '1', closed_days=40)
+        enable(conn)
+>       assert prune_jobs(conn)['closed_deleted'] == 0
+E       assert 1 == 0
+
+tests/test_lifecycle_maintenance.py:61: AssertionError
+____________________ test_pre_admission_failure_is_blocked _____________________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f52308a6a20>
+
+    def test_pre_admission_failure_is_blocked(monkeypatch):
+>       m = module()
+            ^^^^^^^^
+
+tests/test_lifecycle_maintenance.py:69:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_maintenance.py:11: in module
+    return importlib.import_module('job_discovery.lifecycle.maintenance')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'job_discovery.lifecycle.maintenance'
+import_ = <function _gcd_import at 0x7f5234b500e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'job_discovery.lifecycle.maintenance'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+____________ test_maintenance_precedes_empty_targets_and_poll_lock _____________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f52308c1c40>
+
+    def test_maintenance_precedes_empty_targets_and_poll_lock(monkeypatch):
+        import job_discovery.run as run
+        from job_discovery.lifecycle.types import SweepResult
+        order = []
+        class Result:
+            def fetchone(self):
+                return {'locked': False}
+        class Conn:
+            def execute(self, *a):
+                order.append('lock')
+                return Result()
+            def close(self):
+                pass
+        monkeypatch.setattr(run, 'pre_admission_maintenance', lambda d: order.append('maintenance') or SweepResult(0, 0, False, None), raising=False)
+        monkeypatch.setattr(run, 'load_targets', lambda: order.append('targets') or [])
+        monkeypatch.setattr(run.db, 'connect', lambda d: Conn())
+        run.run()
+>       assert order == ['maintenance', 'targets', 'lock']
+E       AssertionError: assert ['targets', 'lock'] == ['maintenance...gets', 'lock']
+E
+E         At index 0 diff: 'targets' != 'maintenance'
+E         Right contains one more item: 'lock'
+E         Use -v to get more diff
+
+tests/test_lifecycle_maintenance.py:93: AssertionError
+------------------------------ Captured log call -------------------------------
+WARNING  job_discovery:run.py:62 another poll run holds the lock; exiting
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_maintenance.py::test_dry_run_global_expiry_and_persisted_cursor
+FAILED tests/test_lifecycle_maintenance.py::test_readiness_forces_dry_run_even_when_caller_requests_retirement
+FAILED tests/test_lifecycle_maintenance.py::test_maintenance_cutover_permanently_disables_legacy_prune
+FAILED tests/test_lifecycle_maintenance.py::test_pre_admission_failure_is_blocked
+FAILED tests/test_lifecycle_maintenance.py::test_maintenance_precedes_empty_targets_and_poll_lock
+5 failed, 47 passed in 19.49s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/ruff.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/ruff.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-report.md
new file mode 100644
index 0000000..b56dfcf
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-report.md
@@ -0,0 +1,189 @@
+# Task 4 — bounded maintenance before admission
+
+BASE: `255909ec819f4908a8701a42ae5122fe121b0935`. Sole fresh author, working in
+`/workspace/job-board/.claude/worktrees/lifecycle-recovery`, bash/login:false.
+Read `REVIEW-SCOPE-AMENDMENT.md` before the brief/dispatch. Task 3 source
+`a17b6427ea06c60e801836e56114890441166842` is the approved development basis,
+**not fully security-approved**. This report describes author implementation and
+ordinary business verification, not an independent requirements or security verdict.
+
+The local `origin/main` reference is `73ce118205bfdbb56c18207acc0c1c4e3708c860`,
+an ancestor of HEAD and of the supplied production/main reference
+`114cce96cb244546864a6bddc5476b5630bc024a`. There is no newer local upstream delta.
+No remote fetch was performed under the dispatch's no-network scope; remote
+freshness is therefore unverified. Existing pricing/main changes were preserved.
+
+## Implementation
+
+`pre_admission_maintenance(dsn)` runs on its own connection before loading targets
+or obtaining the poll session lock. It also runs before reconnecting a broken poll
+session; the poll lock and capacity measurement are reacquired. A failed sweep,
+contended maintenance claim or failed capacity measurement blocks admission while
+complete-source verification/closure handling continues. Empty/inactive runs and a
+held poll lock cannot skip the initial maintenance call. Existing flag-off behavior
+remains available before cutover. Poll admission checks the physical guard again
+under the common gate for each <=500-job chunk, including all held reservations
+and a conservative payload/index/WAL forecast (16 KiB plus four times serialized
+posting field bytes per row). This is no byte-perfect volume guarantee. A later
+chunk stop preserves the count of already committed admissions and completes
+verification. The original above-guard closure path remains intact.
+
+The DB-only sweep uses a maintenance singleton claim, a 120-second lease renewed
+at most 30 seconds apart, a 90-second cooperative deadline, 2-second lock and
+5-second statement timeouts, 2,000-row maximum cleanup statements, and 20,000
+work units per sweep. Description/question work locks at most 250 Job keys per
+transaction, keeping paired cache mutations within the existing 500-mutation
+contract. A separate **64 MiB logical payload retirement budget** supplies the
+spec's byte bound (the spec does not prescribe its numeric value). Oversized or
+remaining payloads are deferred; this budget never becomes physical credit.
+The deadline is checked between bounded transactions; PostgreSQL statement/lock
+timeouts bound in-flight DB waits. This is cooperative, not process preemption.
+
+A persisted Job cursor advances across protected and NULL rows, with a persisted
+round-robin phase for payloads, public versions, staging, reservations, terminal
+demands and old write receipts. Short committed batches survive interruption.
+Descriptions expire after 720 elapsed hours and questions after 168 hours from
+actual last use or capture. Unknown capture remains unknown; sightings do not
+extend TTL. NULL payloads are not counted as retirement. All existing approvals,
+corrections, packages, scores, edits, pending generation, active demand leases,
+and demand snapshots exclude shared payload retirement. Queries are under the
+common gate and candidate Job keys are sorted before row locks and a fresh
+protection read. Jobs and private work are never deleted by the new sweep.
+
+Caller `dry_run=False` cannot override readiness: safety must be enforced,
+retirement enabled and persisted dry-run disabled. Installed activation barriers
+still prevent that transition. Default calls and all actual controls remain off /
+dry-run. A narrowly scoped worker readiness double exercises live retirement
+without disabling SQL triggers or changing real controls. Independently archived
+superseded versions are removable only after 30 days or beyond ten superseded
+versions, and only without any current/shared/private/edge FK reference. Pending
+or unarchived versions remain. This uses persisted `archived_revision`; the
+archive producer/exporter remains disabled and is future work.
+
+The additive `2026-10-03-02-maintenance.sql`, mirrored in `schema.sql`, adds only
+compact maintenance health/cursor and temporary staging-cleanup progress. Enabling
+maintenance atomically records a permanent cutover timestamp. Legacy `prune_jobs`
+then becomes a no-op, including after disabling maintenance. A separate statement
+guard prevents stale direct Job DELETE/TRUNCATE after that cutover. No historical
+Task 3 safety policy or activation barrier was relaxed. Service-only progress
+retains RLS; authenticated invoker guards can read only the cutover timestamp.
+
+Completed staging needs both committed reconciliation markers older than 24
+hours. Unfinished staging needs 168 hours. Before deletion, maintenance fences the
+matching old source claim, advances the persistent source replay floor, and
+records completed/abandoned cleanup. It never fences a newer claim generation.
+Held reservations for the fenced generation are recovered with measured physical
+usage in bounded batches before draining members. Checkpoints/marker/parent are
+removed only after members are gone; there is no unbounded cascading cleanup.
+Source observations/counters/miss evidence are not updated or removed. Terminal
+reservation details need a retained newer claim generation and replay floor;
+held reservations never age out. Unresolved held accounting makes maintenance
+block admission. Terminal demand snapshots remain; compact claim fences survive.
+Write receipts and eligible terminal details use a seven-day retention cutoff.
+
+Health persists allocated bytes, all held bytes, estimated live/dead tuple counts,
+server-wide cumulative WAL bytes, guard state and last successful sweep. Reusable
+bytes are explicitly NULL/unknown because pg_stat counters do not measure them;
+retired bytes are logical content only. Two **scheduled** guard-active sweeps
+record/log action-needed. Pre-admission calls do not inflate that scheduled streak.
+There is no VACUUM FULL, compaction, notification or external write capability.
+
+## Latent Task 3 functional defect and narrow repair
+
+Normal `enumeration_members` insertion failed in the inherited staging trigger:
+`psycopg.errors.UndefinedColumn: record "new" has no field "generation"`.
+PL/pgSQL resolved a table-specific field in a combined AND expression even though
+the current table was a membership table. The controller explicitly authorized
+an ordinary SQL correctness repair. The additive migration nests the existing
+checkpoint-generation and source-enumeration-identity checks inside table-name
+branches. Every comparison and existing fencing policy is retained. Ordinary
+member insertion and matching-generation checkpoint insertion now run through
+the actual trigger. No fence was disabled, and no excluded security re-review
+was attempted.
+
+## Evidence and limits
+
+All DB execution used `tools/lifecycle_test_db.py` on owned disposable random
+loopback PostgreSQL instances. No shared port 55432, reserved dashboard fixtures,
+production/provider/cloud/paid endpoint or infrastructure was accessed.
+Existing ignored `.venv` was used; no dependencies were installed.
+
+Evidence is in `task-4-evidence/`:
+
+- `red17.txt`: 5 failed / 47 passed; missing maintenance module, call order and
+  cutover behavior reproduced before implementation.
+- `green-attempt17.txt`: initial five regressions pass.
+- `green-cover-attempt17.txt`: 68 passed / 4 fixture failures because legacy tests
+  reused a connection now independently owned/closed by maintenance. Fixtures
+  now supply separate owned connections.
+- `expanded-attempt17.txt`: 19 passed / 7 fixture errors (ambiguous smallint
+  generate_series and ready demand without a version). Fixture types/state fixed.
+- `expanded2-17.txt`: 20 passed / 6 failures exposing the inherited trigger error.
+- `green-expanded3-17.txt`: 100 passed / 4 failures. Fixed early sweep termination
+  that stranded staging after its fence and a migration filename ordering issue
+  under database collation; the new filename sorts after safety in both orders.
+- `green-expanded4-17.txt`: 50 passed / zero skips, including bounded staging
+  resumption and full migration reapplication/catalog parity.
+- `green-expanded5-17.txt`: 105 passed / 1 fixture assertion error. The identity
+  mapper intentionally creates no synthetic version; the archived-version test
+  now explicitly inserts and references version 1.
+
+Final commands and results are recorded below. Tests cover TTL
+business boundaries, never-used and unknown caches, protected work, actual poll
+order/guard/failure/reconnect/inactivity, interrupted 21,005-member staging,
+2,000/20,000 bounds, deadlines/renewal, archived-version retention, fenced detail
+retention, logical-byte caps, physical metrics and forbidden external hooks.
+A fresh connection resumes the persisted large cleanup. Catalog comparison covers
+schema, grants, RLS policies, private functions and their definitions; that is
+schema compatibility evidence, not tenant/adversarial validation.
+
+Deliberately unrun: `tests/test_lifecycle_review_security.py`,
+`tests/test_lifecycle_safety.py`, `tests/test_lifecycle_activation.py`,
+`tests/test_rls_isolation.py`, and dashboard lifecycle DB security tests. No new
+forged/stale-token, cross-user, expiry-enforcement or adversarial capacity probe
+was executed. Cleanup tests inspect retained generations/replay floors and normal
+writes; they do **not** supply the missing independent late-callback/security
+verdict. A test-only retention cutoff exercises terminal-detail deletion while
+leaving real lease clocks, production queries and SQL guards unchanged.
+
+Independent expiry enforcement, capacity accounting, cross-user isolation and
+related adversarial review gaps remain explicitly open under the amendment.
+Task 3 is not fully security-approved; passing Task 4 ordinary tests cannot change
+that. Permitted independent Task 4 requirements/code-quality review remains for
+the controller. No deployment, activation, merge, push, Library publication or
+Task 5 work was performed by this author. Production rollout remains blocked.
+
+Exact final covering commands (all earlier RED/GREEN commands are also preserved
+in `task-4-evidence/commands.txt`):
+
+```sh
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_lifecycle_migrations.py tests/test_run_question_fetch.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_lifecycle_migrations.py tests/test_run_question_fetch.py -q
+.venv/bin/ruff check .
+git diff --check
+git diff --cached --check
+```
+
+Final unchanged-source results:
+
+- `final17.txt`: **111 passed, zero skipped**, PostgreSQL **17.11 (Debian
+  17.11-1.pgdg13+2)**, 80.40 seconds.
+- `final16.txt`: **111 passed, zero skipped**, PostgreSQL **16.15 (Debian
+  16.15-1.pgdg13+2)**, 106.50 seconds.
+- `ruff.txt`: repository Ruff passed. Working and staged whitespace checks passed.
+- `pre-byte-final17.txt`: 110 passed before the final separate byte bound/test;
+  the two final runs supersede that intermediate verification.
+
+Product/test inventory: new `job_discovery/lifecycle/maintenance.py`, additive
+`migrations/2026-10-03-02-maintenance.sql` and matching `schema.sql` suffix,
+`job_discovery/prune.py`, `job_discovery/run.py`, new
+`tests/test_lifecycle_maintenance.py`, `tests/test_run.py`, and
+`tests/test_size_guard.py`. Existing `tests/test_prune.py` was exercised unchanged.
+Only those files plus this report and its sanitized evidence are author-staged;
+controller ledgers, amendment, dispatch and review files are excluded.
+
+Artifact-only forward correction: the initial staged pytest failure logs contained
+pytest-generated trailing whitespace. It was detected during staging, then
+normalized without altering results or traceback content. The source/test commit
+is `9608f7c`; the forward evidence-normalization commit contains no product or
+test changes. Final source verification above remains applicable.
diff --git a/job_discovery/lifecycle/maintenance.py b/job_discovery/lifecycle/maintenance.py
new file mode 100644
index 0000000..f492885
--- /dev/null
+++ b/job_discovery/lifecycle/maintenance.py
@@ -0,0 +1,300 @@
+"""Bounded, DB-only maintenance. Payload retirement defaults to a dry run.
+
+Callers give sweep an otherwise idle connection: each batch commits progress.
+The compact cursor/fences survive worker restart. No external capabilities are
+imported here; reported logical bytes never reduce the physical capacity guard.
+"""
+import logging
+from time import monotonic
+
+from job_discovery import db
+from .capacity import CEILING_BYTES
+from .claims import claim_work, renew_claim, validate_claim, cancel_claim
+from .config import read_control
+from .locks import enter_gate, lock_jobs
+from .types import ClaimRef, SweepResult
+
+log = logging.getLogger(__name__)
+BATCH_ROWS = 2000
+MAX_ROWS = 20000
+MAX_RETIRE_BYTES = 64 * 1024**2
+DEADLINE_SECONDS = 90
+LEASE_SECONDS = 120
+RENEW_SECONDS = 30
+
+_UNPROTECTED = """
+NOT EXISTS(SELECT FROM job_reviews WHERE job_id=j.id AND verdict='approve')
+AND NOT EXISTS(SELECT FROM review_corrections WHERE job_id=j.id)
+AND NOT EXISTS(SELECT FROM application_packages WHERE job_id=j.id)
+AND NOT EXISTS(SELECT FROM resume_scores WHERE job_id=j.id)
+AND NOT EXISTS(SELECT FROM cover_letter_edits WHERE job_id=j.id)
+AND NOT EXISTS(SELECT FROM generation_jobs WHERE job_id=j.id AND status IN ('pending','running'))
+AND NOT EXISTS(SELECT FROM job_payload_demands WHERE job_id=j.id AND
+ (status IN ('pending','running') AND COALESCE(lease_until,protection_until)>clock_timestamp()
+  OR description_snapshot IS NOT NULL OR questions_snapshot IS NOT NULL))
+"""
+_DESCRIPTION_DUE = """j.description IS NOT NULL AND
+ COALESCE(j.description_last_used_at,j.description_captured_at)<=clock_timestamp()-interval '720 hours'"""
+_QUESTIONS_DUE = """q.questions IS NOT NULL AND q.questions<>'null'::jsonb AND
+ COALESCE(q.last_used_at,q.captured_at)<=clock_timestamp()-interval '168 hours'"""
+
+
+def legacy_prune_disabled(conn) -> bool:
+    enter_gate(conn)
+    return read_control(conn).maintenance_enabled or read_control(conn).safety_stage == 'enforced' or bool(
+        conn.execute('SELECT cutover_at FROM lifecycle_maintenance_state WHERE singleton').fetchone()['cutover_at'])
+
+
+def _payload_batch(conn, cursor, limit, dry_run, byte_limit=MAX_RETIRE_BYTES):
+    # Scan IDs, including protected/NULL rows, so a permanent prefix cannot starve
+    # later jobs. <=250 jobs keeps description/question mutations within 500.
+    rows = conn.execute('SELECT id FROM jobs WHERE (%s::text IS NULL OR id COLLATE "C">%s COLLATE "C") ORDER BY id COLLATE "C" LIMIT %s',
+                        (cursor, cursor, min(250, limit))).fetchall()
+    if not rows:
+        return 0, 0, 0, 0, None
+    ids = [r['id'] for r in rows]
+    lock_jobs(conn, ids)
+    conn.execute('SELECT id FROM jobs WHERE id=ANY(%s) ORDER BY id COLLATE "C" FOR UPDATE', (ids,)).fetchall()
+    # Fresh statement snapshot after the gate and job locks, not candidate data.
+    eligible = conn.execute(f'''SELECT j.id, ({_DESCRIPTION_DUE}) AS description_due,
+      ({_QUESTIONS_DUE}) AS questions_due,
+      CASE WHEN {_DESCRIPTION_DUE} THEN octet_length(j.description) ELSE 0 END AS description_bytes,
+      CASE WHEN {_QUESTIONS_DUE} THEN octet_length(q.questions::text) ELSE 0 END AS question_bytes
+      FROM jobs j LEFT JOIN job_questions q ON q.job_id=j.id
+      WHERE j.id=ANY(%s) AND {_UNPROTECTED} ORDER BY j.id COLLATE "C"''', (ids,)).fetchall()
+    retired = size = candidates = 0
+    for row in eligible:
+        for field in ('description', 'questions'):
+            if not row[field + '_due']:
+                continue
+            candidates += 1
+            row_bytes = row['description_bytes' if field == 'description' else 'question_bytes']
+            if dry_run or retired >= limit or size + row_bytes > byte_limit:
+                continue
+            if field == 'description':
+                conn.execute('UPDATE jobs SET description=NULL,description_pruned=true WHERE id=%s', (row['id'],))
+                size += row['description_bytes']
+            else:
+                conn.execute('DELETE FROM job_questions WHERE job_id=%s', (row['id'],))
+                size += row['question_bytes']
+            retired += 1
+    return max(len(rows), retired), retired, size, candidates, ids[-1]
+
+
+def _version_batch(conn, limit, dry_run, byte_limit=MAX_RETIRE_BYTES):
+    # A public version may be removed only once its listing revision is archived.
+    # FK references are deliberately retained, including terminal private work.
+    rows = conn.execute('''SELECT v.id,v.job_id,octet_length(v.public_metadata::text) AS bytes
+      FROM job_versions v JOIN source_listings s ON s.id=v.source_listing_id
+      WHERE v.id IS DISTINCT FROM s.current_version_id AND v.revision<=s.archived_revision
+      AND (v.recorded_at<=clock_timestamp()-interval '720 hours' OR
+        (SELECT count(*) FROM job_versions newer WHERE newer.source_listing_id=v.source_listing_id
+         AND newer.id IS DISTINCT FROM s.current_version_id AND newer.revision>v.revision)>=10)
+      AND NOT EXISTS(SELECT FROM jobs WHERE description_version_id=v.id)
+      AND NOT EXISTS(SELECT FROM job_questions WHERE job_version_id=v.id)
+      AND NOT EXISTS(SELECT FROM job_reviews WHERE job_version_id=v.id)
+      AND NOT EXISTS(SELECT FROM review_corrections WHERE job_version_id=v.id)
+      AND NOT EXISTS(SELECT FROM application_packages WHERE job_version_id=v.id)
+      AND NOT EXISTS(SELECT FROM resume_scores WHERE job_version_id=v.id)
+      AND NOT EXISTS(SELECT FROM cover_letter_edits WHERE job_version_id=v.id)
+      AND NOT EXISTS(SELECT FROM generation_jobs WHERE job_version_id=v.id)
+      AND NOT EXISTS(SELECT FROM job_payload_demands WHERE job_version_id=v.id)
+      AND NOT EXISTS(SELECT FROM job_locations WHERE job_version_id=v.id)
+      AND NOT EXISTS(SELECT FROM job_skills WHERE job_version_id=v.id)
+      ORDER BY v.recorded_at,v.id LIMIT %s''', (limit,)).fetchall()
+    selected = []
+    size = 0
+    for row in rows:
+        if size + row['bytes'] <= byte_limit:
+            selected.append(row)
+            size += row['bytes']
+    lock_jobs(conn, [r['job_id'] for r in selected])
+    if not dry_run and selected:
+        conn.execute('DELETE FROM job_versions WHERE id=ANY(%s)', ([r['id'] for r in selected],))
+    return len(rows), 0 if dry_run else len(selected), 0 if dry_run else size
+
+
+def _staging_batch(conn, limit):
+    # Select just one enumeration: a huge member set is drained over bounded
+    # commits. Its compact source/claim floors are advanced BEFORE any deletion.
+    row = conn.execute('''SELECT e.*,p.reason FROM source_enumerations e
+      LEFT JOIN lifecycle_staging_cleanup p ON p.enumeration_id=e.id
+      WHERE p.enumeration_id IS NOT NULL OR
+       (e.status='complete' AND e.reconciled_at<=clock_timestamp()-interval '24 hours'
+        AND EXISTS(SELECT FROM reconciliation_checkpoints c WHERE c.enumeration_id=e.id
+          AND c.completed_at<=clock_timestamp()-interval '24 hours'))
+       OR (e.started_at<=clock_timestamp()-interval '168 hours' AND
+           (e.reconciled_at IS NULL OR e.status<>'complete'))
+      ORDER BY e.started_at,e.id LIMIT 1''').fetchone()
+    if not row:
+        return 0
+    if row['reason'] is None:
+        if limit < 3:
+            return 0
+        # Do not invalidate a newer enumeration's claim. An old sequence still
+        # receives its replay floor even when the source has since been reclaimed.
+        conn.execute('''UPDATE lifecycle_claims SET replay_floor=generation,generation=generation+1,
+          state='cancelled',terminal_at=clock_timestamp() WHERE kind='source' AND work_id=%s
+          AND generation=%s AND owner_token=%s''', (str(row['source_id']), row['generation'], row['owner_token']))
+        conn.execute('UPDATE source_accounts SET replay_floor=GREATEST(replay_floor,%s) WHERE id=%s', (row['sequence'], row['source_id']))
+        conn.execute('INSERT INTO lifecycle_staging_cleanup(enumeration_id,reason) VALUES(%s,%s)',
+                     (row['id'], 'completed' if row['status'] == 'complete' and row['reconciled_at'] else 'abandoned'))
+        return 3  # Claim, source floor, and cleanup checkpoint are durable.
+    n = conn.execute('''UPDATE capacity_reservations SET state='fenced',terminal_at=clock_timestamp(),
+      measured_database_bytes=pg_database_size(current_database()) WHERE id IN
+      (SELECT r.id FROM capacity_reservations r JOIN lifecycle_claims c
+       ON c.kind=r.claim_kind AND c.work_id=r.claim_id WHERE c.kind='source' AND c.work_id=%s
+       AND r.state='held' AND r.generation<c.generation AND r.generation<=c.replay_floor
+       ORDER BY r.id LIMIT %s)''', (str(row['source_id']), limit)).rowcount
+    if n:
+        return n
+    n = conn.execute('''DELETE FROM enumeration_members WHERE (enumeration_id,external_id) IN
+      (SELECT enumeration_id,external_id FROM enumeration_members WHERE enumeration_id=%s ORDER BY external_id LIMIT %s)''', (row['id'], limit)).rowcount
+    if n:
+        return n
+    # No cascading unbounded deletion: consume checkpoint/marker/parent one at a
+    # time when the remaining run budget allows all three.
+    if limit < 3:
+        return 0
+    n = conn.execute('DELETE FROM reconciliation_checkpoints WHERE enumeration_id=%s', (row['id'],)).rowcount
+    n += conn.execute('DELETE FROM lifecycle_staging_cleanup WHERE enumeration_id=%s', (row['id'],)).rowcount
+    n += conn.execute('DELETE FROM source_enumerations WHERE id=%s', (row['id'],)).rowcount
+    return n
+
+
+def _terminal_batch(conn, limit, phase):
+    if phase == 3:
+        # Settled callbacks also need a retained generation fence before removing
+        # the row. A current generation is left intact, however old its timestamp.
+        return conn.execute('''DELETE FROM capacity_reservations WHERE id IN
+          (SELECT r.id FROM capacity_reservations r JOIN lifecycle_claims c
+           ON c.kind=r.claim_kind AND c.work_id=r.claim_id WHERE r.state<>'held'
+           AND r.terminal_at<=clock_timestamp()-interval '168 hours'
+           AND c.replay_floor>=r.generation AND c.generation>r.generation
+           ORDER BY r.terminal_at,r.id LIMIT %s)''', (limit,)).rowcount
+    if phase == 4:
+        rows = conn.execute('''SELECT d.id,d.job_id FROM job_payload_demands d
+          WHERE d.status IN ('ready','deferred','failed','cancelled')
+          AND d.description_snapshot IS NULL AND d.questions_snapshot IS NULL
+          AND d.settled_at<=clock_timestamp()-interval '168 hours'
+          AND NOT EXISTS(SELECT FROM lifecycle_claims c WHERE c.kind='demand' AND c.work_id=d.id::text
+            AND (c.state='active' OR c.generation<=d.claim_generation OR c.replay_floor<GREATEST(d.claim_generation,1)))
+          ORDER BY d.settled_at,d.id LIMIT %s''', (limit,)).fetchall()
+        lock_jobs(conn, [r['job_id'] for r in rows])
+        return conn.execute('DELETE FROM job_payload_demands WHERE id=ANY(%s)', ([r['id'] for r in rows],)).rowcount if rows else 0
+    return conn.execute('''DELETE FROM lifecycle_write_checks WHERE id IN
+      (SELECT id FROM lifecycle_write_checks WHERE created_at<=clock_timestamp()-interval '168 hours'
+       ORDER BY created_at,id LIMIT %s)''', (limit,)).rowcount
+
+
+def _metrics(conn, scheduled):
+    metrics = conn.execute('''SELECT pg_database_size(current_database()) AS physical,
+      (SELECT COALESCE(sum(bytes),0) FROM capacity_reservations WHERE state='held') AS held,
+      (SELECT COALESCE(sum(n_live_tup),0) FROM pg_stat_user_tables) AS live,
+      (SELECT COALESCE(sum(n_dead_tup),0) FROM pg_stat_user_tables) AS dead,
+      (SELECT wal_bytes FROM pg_stat_wal) AS wal,
+      EXISTS(SELECT FROM capacity_reservations r LEFT JOIN lifecycle_claims c
+       ON c.kind=r.claim_kind AND c.work_id=r.claim_id WHERE r.state='held'
+       AND (c.lease_until<=clock_timestamp() OR c.state<>'active' OR c.generation<>r.generation)) AS unresolved''').fetchone()
+    guard = metrics['physical'] + metrics['held'] >= CEILING_BYTES
+    conn.execute('''UPDATE lifecycle_maintenance_state SET last_success_at=clock_timestamp(),
+      physical_bytes=%s,held_bytes=%s,live_tuples=%s,dead_tuples=%s,reusable_bytes=NULL,wal_bytes=%s,
+      guard_active=%s,guard_scheduled_streak=CASE WHEN %s THEN
+        CASE WHEN %s THEN guard_scheduled_streak+1 ELSE 0 END ELSE guard_scheduled_streak END
+      WHERE singleton''', (metrics['physical'], metrics['held'], metrics['live'], metrics['dead'], metrics['wal'], guard, scheduled, guard))
+    row = conn.execute('UPDATE lifecycle_maintenance_state SET action_needed=guard_scheduled_streak>=2 WHERE singleton RETURNING action_needed').fetchone()
+    log.info('maintenance metrics: %s guard_active=%s reusable_bytes=unknown action_needed=%s', metrics, guard, row['action_needed'])
+    if row['action_needed']:
+        log.warning('maintenance action needed: physical guard persists; separately authorized compaction/capacity action may be required')
+    return guard or metrics['unresolved']
+
+
+def sweep(conn, claim: ClaimRef, dry_run: bool = True, max_rows: int = MAX_ROWS, *, scheduled: bool = False) -> SweepResult:
+    if type(max_rows) is not int or not 1 <= max_rows <= MAX_ROWS:
+        raise ValueError('max_rows must be in 1..20000')
+    started = renewed = monotonic()
+    used = retired = size = eligible = 0
+    validate_claim(conn, claim)
+    if not conn.execute("SELECT 1 FROM lifecycle_claims WHERE kind='maintenance' AND work_id='singleton' AND owner_token=%s AND generation=%s", (claim.owner_token, claim.generation)).fetchone():
+        raise RuntimeError('maintenance singleton claim required')
+    state = conn.execute('SELECT cursor,next_phase FROM lifecycle_maintenance_state WHERE singleton').fetchone()
+    cursor, phase = state['cursor'], state['next_phase']
+    conn.commit()
+    idle = 0
+    payload_finished = versions_finished = False
+    while used < max_rows and size < MAX_RETIRE_BYTES and monotonic() - started < DEADLINE_SECONDS and idle < 6:
+        validate_claim(conn, claim)
+        if monotonic() - renewed >= RENEW_SECONDS:
+            claim = renew_claim(conn, claim, LEASE_SECONDS)
+            renewed = monotonic()
+        remaining_ms = max(1, int((DEADLINE_SECONDS - (monotonic() - started)) * 1000))
+        conn.execute("SELECT set_config('statement_timeout',%s,true)", (str(min(5000, remaining_ms)),))
+        ctl = read_control(conn)
+        if not ctl.maintenance_enabled:
+            conn.commit()
+            break
+        effective_dry = dry_run or ctl.retirement_dry_run or not ctl.retirement_enabled or ctl.safety_stage != 'enforced'
+        limit = min(BATCH_ROWS, max_rows - used)
+        if phase == 0:
+            if payload_finished:
+                n = 0
+            else:
+                n, r, b, e, cursor = _payload_batch(conn, cursor, limit, effective_dry, MAX_RETIRE_BYTES - size)
+                retired += r
+                size += b
+                eligible += e
+                payload_finished = not n
+        elif phase == 1:
+            if versions_finished:
+                n = 0
+            else:
+                n, r, b = _version_batch(conn, limit, effective_dry, MAX_RETIRE_BYTES - size)
+                retired += r
+                size += b
+                versions_finished = effective_dry or not n
+        elif phase == 2:
+            n = _staging_batch(conn, limit)
+        else:
+            n = _terminal_batch(conn, limit, phase)
+        idle = idle + 1 if not n else 0
+        used += n
+        phase = (phase + 1) % 6
+        conn.execute('UPDATE lifecycle_maintenance_state SET cursor=%s,next_phase=%s,eligible_rows=%s,retired_rows=%s,retired_bytes=%s WHERE singleton', (cursor, phase, eligible, retired, size))
+        conn.commit()
+    validate_claim(conn, claim)
+    blocked = _metrics(conn, scheduled)
+    conn.commit()
+    return SweepResult(retired, size, blocked, cursor)
+
+
+def pre_admission_maintenance(dsn: str | None) -> SweepResult:
+    conn = None
+    try:
+        conn = db.connect(dsn)
+        enter_gate(conn)
+        ctl = read_control(conn)
+        if not ctl.maintenance_enabled:
+            conn.commit()
+            return SweepResult(0, 0, False, None)
+        claim = claim_work(conn, 'maintenance', 'singleton', LEASE_SECONDS)
+        conn.commit()
+        if claim is None:
+            return SweepResult(0, 0, True, None)
+        result = sweep(conn, claim, dry_run=ctl.retirement_dry_run)
+        cancel_claim(conn, claim)
+        conn.commit()
+        return result
+    except Exception:
+        if conn is not None:
+            try:
+                conn.rollback()
+            except Exception:
+                log.exception('maintenance rollback failed')
+        log.exception('pre-admission maintenance failed; additions blocked, verification permitted')
+        return SweepResult(0, 0, True, None)
+    finally:
+        if conn is not None:
+            try:
+                conn.close()
+            except Exception:
+                log.exception('maintenance connection close failed')
diff --git a/job_discovery/prune.py b/job_discovery/prune.py
index 51ded85..e922352 100644
--- a/job_discovery/prune.py
+++ b/job_discovery/prune.py
@@ -1,12 +1,12 @@
 from job_discovery.lifecycle.locks import enter_gate, lock_jobs
-from job_discovery.lifecycle.config import read_control
+from job_discovery.lifecycle.maintenance import legacy_prune_disabled
 import logging
 import os
 
 from psycopg.errors import LockNotAvailable
 
 log = logging.getLogger("job_discovery.prune")
 
 
 def _int_env(name: str, default: int) -> int:
     raw = os.environ.get(name)
@@ -45,22 +45,23 @@ def _run_batched(conn, days: int, batch: int, cap: int) -> int:
 
     Parent locks exclude concurrent history inserts through their foreign keys.
     Existing reviews also need locks: changing deny to approve does not change
     their FK, so a parent lock alone cannot protect an approval in progress.
     NOWAIT yields the sweep to that writer rather than blocking maintenance.
     """
     done = 0
     while done < cap:
         try:
             enter_gate(conn)
-            if read_control(conn).safety_stage == "enforced":
-                raise RuntimeError("legacy destructive prune disabled after lifecycle cutover")
+            if legacy_prune_disabled(conn):
+                conn.commit()
+                break
             with conn.cursor() as cur:
                 cur.execute(_SELECT_CLOSED.replace("FOR UPDATE OF j SKIP LOCKED", ""), (days, min(batch, cap - done)))
                 lock_jobs(conn, [row["id"] for row in cur.fetchall()])
                 cur.execute(_SELECT_CLOSED, (days, min(batch, cap - done)))
                 ids = [row["id"] for row in cur.fetchall()]
                 if not ids:
                     conn.commit()
                     break
                 cur.execute(
                     "SELECT job_id FROM job_reviews WHERE job_id = ANY(%s) FOR UPDATE NOWAIT",
diff --git a/job_discovery/run.py b/job_discovery/run.py
index 5167985..1763473 100644
--- a/job_discovery/run.py
+++ b/job_discovery/run.py
@@ -1,11 +1,14 @@
 from contextlib import nullcontext
+from job_discovery.lifecycle.maintenance import pre_admission_maintenance
+from job_discovery.lifecycle.locks import enter_gate
+from job_discovery.lifecycle.capacity import CEILING_BYTES
 from job_discovery.lifecycle.legacy_spool import spool_feed, spool_questions
 import logging
 
 from job_discovery import db
 from job_discovery.adapters import ADAPTERS
 from job_discovery.adapters.greenhouse import parse_greenhouse_questions
 from job_discovery.http import get_json as _get_json
 from job_discovery.targets import load_targets
 
 log = logging.getLogger("job_discovery")
@@ -36,43 +39,74 @@ UPSERT_CHUNK_SIZE = 500
 
 def _run_prune(conn) -> None:
     try:
         from job_discovery.prune import prune_jobs
         prune_jobs(conn)
     except Exception:
         conn.rollback()
         log.exception("prune phase failed; poll results unaffected")
 
 
+def _admit_chunk(conn, company_id, ats, token, chunk):
+    """Measure again under the gate before each bounded admission transaction."""
+    try:
+        enter_gate(conn)
+        over, _, _ = db.over_size_ceiling(conn)
+        held = conn.execute("SELECT COALESCE(sum(bytes),0) AS bytes FROM capacity_reservations WHERE state='held'").fetchone()['bytes']
+        # Conservative local forecast includes payload expansion/index/WAL room.
+        # Enforced compatible writers still require their Task 3 reservations.
+        forecast = sum(16384 + 4 * sum(len(str(value).encode('utf-8')) for value in db._posting_row(ats, token, company_id, p) if value is not None) for p in chunk)
+        allocated = conn.execute('SELECT pg_database_size(current_database()) AS bytes').fetchone()['bytes']
+        if over or allocated + held + forecast >= CEILING_BYTES:
+            log.warning('admission paused at chunk boundary; source verification continues')
+            conn.commit()
+            return 0, True
+    except Exception:
+        conn.rollback()
+        log.exception('admission capacity measurement failed; verification only')
+        return 0, True
+    admitted = db.upsert_jobs(conn, company_id, ats, token, chunk)
+    conn.commit()
+    return admitted, False
+
+
 def run(dsn: str | None = None) -> dict:
     """Execute one poll cycle.
 
     Returns a counts dict with keys ``ok``, ``failed``, ``new_jobs``,
     ``closed_jobs``.  Callers (e.g. ``__main__``) use this to decide the
     process exit code.
     """
+    maintenance = pre_admission_maintenance(dsn)
     targets = load_targets()
     conn = db.connect(dsn)
     try:
         # Advisory lock: only one poll run at a time per DB. pg_try_advisory_lock
         # returns TRUE if we acquired it, FALSE if another session holds it.
         locked = conn.execute(
             "SELECT pg_try_advisory_lock(hashtext('job_discovery_poll')) AS locked"
         ).fetchone()["locked"]
         if not locked:
             log.warning("another poll run holds the lock; exiting")
             return {"ok": 0, "failed": 0, "new_jobs": 0, "closed_jobs": 0}
 
-        over, size_mb, ceiling_mb = db.over_size_ceiling(conn)
+        try:
+            over, size_mb, ceiling_mb = db.over_size_ceiling(conn)
+        except Exception:
+            conn.rollback()
+            log.exception("capacity check failed; verification only")
+            over, size_mb, ceiling_mb = True, 0, 6000
+        over = over or maintenance.blocked
         guard_note = None
         if over:
-            guard_note = f"maintenance only: db at {size_mb:.0f} MB >= ceiling {ceiling_mb:.0f} MB"
+            guard_note = ("maintenance only: safety maintenance blocked admission" if maintenance.blocked
+                          else f"maintenance only: capacity unavailable or db at {size_mb:.0f} MiB; ceiling {ceiling_mb:.0f} MiB")
             log.warning("%s; checking closures without ingestion or enrichment", guard_note)
 
         run_id = db.start_run(conn)
         if not over:
             db.sync_seed(conn, targets)
         conn.commit()
         companies = db.active_companies(conn)
         conn.commit()  # No read transaction spans adapter HTTP.
 
         ok = failed = new_jobs = closed_jobs = 0
@@ -91,29 +125,29 @@ def run(dsn: str | None = None) -> dict:
                         conn, company_id, token, _get_json, parse_greenhouse_questions,
                         db.greenhouse_jobs_missing_questions, admissible_ids, log,
                     ) if not over and ats == "greenhouse" else nullcontext(iter(())))
                     with questions_context as questions:
                         chunk: list = []
                         for p in buffered:
                             if over or not p.url or not p.title:
                                 continue
                             chunk.append(p)
                             if len(chunk) >= UPSERT_CHUNK_SIZE:
-                                admitted = db.upsert_jobs(conn, company_id, ats, token, chunk)
-                                conn.commit()
+                                admitted, over = _admit_chunk(conn, company_id, ats, token, chunk)
                                 new_jobs += admitted
                                 chunk = []
                         if chunk:
-                            admitted = db.upsert_jobs(conn, company_id, ats, token, chunk)
-                            conn.commit()
+                            admitted, over = _admit_chunk(conn, company_id, ats, token, chunk)
                             new_jobs += admitted
                         for question_index, (external_id, data) in enumerate(questions, 1):
+                            if over:
+                                break
                             # Malformed feed entries were never admitted; retain the
                             # old FK behavior by writing only existing shared Jobs.
                             if conn.execute("SELECT 1 FROM jobs WHERE id=%s", (f"greenhouse:{token}:{external_id}",)).fetchone():
                                 db.insert_job_questions(conn, f"greenhouse:{token}:{external_id}", data, overwrite=False)
                             if question_index % UPSERT_CHUNK_SIZE == 0:
                                 conn.commit()
                         conn.commit()
                 if over:
                     db.reopen_jobs(conn, company_id, seen)
                 open_ids = db.get_open_external_ids(conn, company_id)
@@ -138,21 +172,33 @@ def run(dsn: str | None = None) -> dict:
                     log.exception("rollback failed for %s; attempting reconnect",
                                   co["name"])
                     # The old connection is unusable. Close it first — that releases
                     # its session advisory lock and frees the socket — so we don't
                     # leak the connection (and its lock) when we open a fresh one.
                     try:
                         conn.close()
                     except Exception:
                         log.exception("closing the broken connection failed")
                     try:
+                        maintenance = pre_admission_maintenance(dsn)
                         conn = db.connect(dsn)
+                        locked = conn.execute(
+                            "SELECT pg_try_advisory_lock(hashtext('job_discovery_poll')) AS locked"
+                        ).fetchone()["locked"]
+                        if not locked:
+                            raise RuntimeError("poll lock unavailable after reconnect")
+                        try:
+                            reconnect_over, _, _ = db.over_size_ceiling(conn)
+                        except Exception:
+                            conn.rollback()
+                            reconnect_over = True
+                        over = over or maintenance.blocked or reconnect_over
                     except Exception:
                         log.exception("reconnect failed; aborting poll")
                         failures.append(f"{co['name']}: {type(exc).__name__}: {exc}")
                         failed += 1
                         break
                 failed += 1
                 failures.append(f"{co['name']}: {type(exc).__name__}: {exc}")
                 log.exception("poll failed for %s (%s:%s)", co["name"], ats, token)
                 # Track the failure so a persistently dead board is eventually
                 # deactivated. The company's poll work was rolled back, so this
@@ -178,21 +224,21 @@ def run(dsn: str | None = None) -> dict:
             companies_ok=ok, companies_failed=failed,
             new_jobs=new_jobs, closed_jobs=closed_jobs,
             notes="; ".join(([guard_note] if guard_note else []) + failures) or None,
         )
         conn.commit()
         log.info("run complete: ok=%s failed=%s new=%s closed=%s",
                  ok, failed, new_jobs, closed_jobs)
 
         if over:
             _run_prune(conn)
-            return {"ok": ok, "failed": failed, "new_jobs": 0, "closed_jobs": closed_jobs}
+            return {"ok": ok, "failed": failed, "new_jobs": new_jobs, "closed_jobs": closed_jobs}
 
         # Location canonicalization: resolve any raw location strings first
         # seen this poll, then re-stamp jobs.location_canonicals (also
         # propagates manual corrections). Runs before the review phase so
         # tonight's reviews filter on fresh canonicals. Failure is isolated —
         # unresolved raws just retry tomorrow.
         try:
             from job_discovery.locations import resolve_new_locations
             resolve_new_locations(conn)
             conn.commit()
diff --git a/migrations/2026-10-03-02-maintenance.sql b/migrations/2026-10-03-02-maintenance.sql
new file mode 100644
index 0000000..c79d131
--- /dev/null
+++ b/migrations/2026-10-03-02-maintenance.sql
@@ -0,0 +1,104 @@
+-- Task 4 operational progress and permanent legacy-prune cutover. No activation.
+CREATE TABLE IF NOT EXISTS lifecycle_maintenance_state (
+ singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
+ cutover_at timestamptz,
+ cursor text,
+ next_phase integer NOT NULL DEFAULT 0,
+ last_success_at timestamptz,
+ eligible_rows bigint NOT NULL DEFAULT 0,
+ retired_rows bigint NOT NULL DEFAULT 0,
+ retired_bytes bigint NOT NULL DEFAULT 0,
+ physical_bytes bigint,
+ held_bytes bigint,
+ live_tuples bigint,
+ dead_tuples bigint,
+ reusable_bytes bigint, -- NULL: pg_stat_all_tables does not measure free bytes.
+ wal_bytes numeric, -- server-wide cumulative pg_stat_wal, not per-sweep WAL.
+ guard_active boolean NOT NULL DEFAULT false,
+ guard_scheduled_streak integer NOT NULL DEFAULT 0,
+ action_needed boolean NOT NULL DEFAULT false
+);
+INSERT INTO lifecycle_maintenance_state(singleton,cutover_at)
+ SELECT true,CASE WHEN maintenance_enabled THEN clock_timestamp() END FROM lifecycle_control
+ ON CONFLICT DO NOTHING;
+CREATE TABLE IF NOT EXISTS lifecycle_staging_cleanup (
+ enumeration_id uuid PRIMARY KEY REFERENCES source_enumerations(id),
+ reason text NOT NULL CHECK(reason IN ('completed','abandoned')),
+ started_at timestamptz NOT NULL DEFAULT clock_timestamp()
+);
+DO $$ DECLARE t text; BEGIN
+ FOREACH t IN ARRAY ARRAY['lifecycle_maintenance_state','lifecycle_staging_cleanup'] LOOP
+  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
+  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
+  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_pre_dml ON public.%I',t);
+  EXECUTE format('CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
+ END LOOP;
+END $$;
+-- Invoker deletion guards need only the non-sensitive permanent cutover bit.
+GRANT SELECT(cutover_at) ON lifecycle_maintenance_state TO authenticated;
+DROP POLICY IF EXISTS maintenance_cutover_read ON lifecycle_maintenance_state;
+CREATE POLICY maintenance_cutover_read ON lifecycle_maintenance_state FOR SELECT TO authenticated USING(true);
+CREATE OR REPLACE FUNCTION lifecycle_maintenance_cutover() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+BEGIN
+ IF TG_TABLE_NAME='lifecycle_control' THEN
+  IF NEW.maintenance_enabled THEN
+   UPDATE public.lifecycle_maintenance_state SET cutover_at=COALESCE(cutover_at,clock_timestamp()) WHERE singleton;
+  END IF;
+  RETURN NEW;
+ END IF;
+ IF TG_TABLE_NAME='lifecycle_maintenance_state' THEN
+  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'maintenance cutover history must survive'; END IF;
+  IF OLD.cutover_at IS NOT NULL AND NEW.cutover_at IS DISTINCT FROM OLD.cutover_at THEN
+   RAISE EXCEPTION 'maintenance cutover is permanent'; END IF;
+  RETURN NEW;
+ END IF;
+ IF EXISTS(SELECT FROM public.lifecycle_maintenance_state WHERE cutover_at IS NOT NULL) THEN
+  RAISE EXCEPTION 'legacy destructive prune disabled after maintenance cutover';
+ END IF;
+ RETURN NULL;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_maintenance_cutover() FROM PUBLIC,anon,authenticated;
+DROP TRIGGER IF EXISTS maintenance_cutover ON lifecycle_control;
+CREATE TRIGGER maintenance_cutover AFTER UPDATE ON lifecycle_control FOR EACH ROW EXECUTE FUNCTION lifecycle_maintenance_cutover();
+DROP TRIGGER IF EXISTS maintenance_history ON lifecycle_maintenance_state;
+CREATE TRIGGER maintenance_history BEFORE UPDATE OR DELETE ON lifecycle_maintenance_state FOR EACH ROW EXECUTE FUNCTION lifecycle_maintenance_cutover();
+DROP TRIGGER IF EXISTS maintenance_history_truncate ON lifecycle_maintenance_state;
+CREATE TRIGGER maintenance_history_truncate BEFORE TRUNCATE ON lifecycle_maintenance_state FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_maintenance_cutover();
+DROP TRIGGER IF EXISTS maintenance_no_job_delete ON jobs;
+CREATE TRIGGER maintenance_no_job_delete BEFORE DELETE OR TRUNCATE ON jobs FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_maintenance_cutover();
+-- Normal membership rows have no generation/source_id fields. Nest table-specific
+-- checks before resolving NEW fields; the existing validation comparisons remain.
+CREATE OR REPLACE FUNCTION lifecycle_staging_fence() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE e public.source_enumerations; c public.lifecycle_claims; floor bigint;
+BEGIN
+ IF TG_TABLE_NAME='source_accounts' THEN
+  IF NEW.replay_floor<OLD.replay_floor OR NEW.enumeration_sequence<OLD.enumeration_sequence OR NEW.claim_generation<OLD.claim_generation THEN
+   RAISE EXCEPTION 'source generation and replay floor are monotonic'; END IF;
+  RETURN NEW;
+ END IF;
+ IF TG_TABLE_NAME='source_enumerations' THEN e:=NEW;
+ ELSE SELECT * INTO STRICT e FROM public.source_enumerations WHERE id=NEW.enumeration_id;
+ END IF;
+ SELECT replay_floor INTO STRICT floor FROM public.source_accounts WHERE id=e.source_id;
+ IF e.sequence<=floor THEN RAISE EXCEPTION 'enumeration sequence rejected by replay floor'; END IF;
+ SELECT * INTO c FROM public.lifecycle_claims WHERE kind='source' AND work_id=e.source_id::text
+ AND owner_token=e.owner_token AND generation=e.generation AND generation>replay_floor
+ AND state='active' AND lease_until>clock_timestamp() AND invoking_role=current_user
+ AND subject_id IS NOT DISTINCT FROM public.app_user_id();
+ IF NOT FOUND THEN RAISE EXCEPTION 'stale, foreign or fenced enumeration claim'; END IF;
+ IF TG_TABLE_NAME='reconciliation_checkpoints' THEN
+  IF NEW.generation<>e.generation THEN RAISE EXCEPTION 'stale checkpoint claim'; END IF;
+ END IF;
+ IF TG_TABLE_NAME='source_enumerations' THEN
+  IF TG_OP='UPDATE' AND (NEW.source_id<>OLD.source_id OR NEW.sequence<>OLD.sequence OR NEW.owner_token<>OLD.owner_token OR NEW.generation<>OLD.generation) THEN
+   RAISE EXCEPTION 'enumeration identity is immutable';
+  END IF;
+ END IF;
+ INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,owner_token,generation)
+ VALUES(current_user,public.app_user_id(),e.owner_token,e.generation);
+ RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_staging_fence() FROM PUBLIC,anon,authenticated;
+INSERT INTO schema_migrations(filename) VALUES('2026-10-03-02-maintenance.sql') ON CONFLICT DO NOTHING;
diff --git a/schema.sql b/schema.sql
index 5387b48..557c11a 100644
--- a/schema.sql
+++ b/schema.sql
@@ -1985,10 +1985,114 @@ BEGIN
  -- claim. The service must fence the claim first (account erasure does so).
  IF EXISTS(SELECT FROM public.lifecycle_claims WHERE kind='demand' AND work_id=OLD.id::text
  AND state='active' AND generation>replay_floor) THEN
   RAISE EXCEPTION 'demand removal requires fenced service claim'; END IF;
  RETURN OLD;
 END $$;
 REVOKE ALL ON FUNCTION lifecycle_private.protect_demand_claim() FROM PUBLIC,anon,authenticated;
 DROP TRIGGER IF EXISTS lifecycle_demand_removal ON job_payload_demands;
 CREATE TRIGGER lifecycle_demand_removal BEFORE DELETE ON job_payload_demands
  FOR EACH ROW EXECUTE FUNCTION lifecycle_private.protect_demand_claim();
+-- Task 4 operational progress and permanent legacy-prune cutover. No activation.
+CREATE TABLE IF NOT EXISTS lifecycle_maintenance_state (
+ singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
+ cutover_at timestamptz,
+ cursor text,
+ next_phase integer NOT NULL DEFAULT 0,
+ last_success_at timestamptz,
+ eligible_rows bigint NOT NULL DEFAULT 0,
+ retired_rows bigint NOT NULL DEFAULT 0,
+ retired_bytes bigint NOT NULL DEFAULT 0,
+ physical_bytes bigint,
+ held_bytes bigint,
+ live_tuples bigint,
+ dead_tuples bigint,
+ reusable_bytes bigint, -- NULL: pg_stat_all_tables does not measure free bytes.
+ wal_bytes numeric, -- server-wide cumulative pg_stat_wal, not per-sweep WAL.
+ guard_active boolean NOT NULL DEFAULT false,
+ guard_scheduled_streak integer NOT NULL DEFAULT 0,
+ action_needed boolean NOT NULL DEFAULT false
+);
+INSERT INTO lifecycle_maintenance_state(singleton,cutover_at)
+ SELECT true,CASE WHEN maintenance_enabled THEN clock_timestamp() END FROM lifecycle_control
+ ON CONFLICT DO NOTHING;
+CREATE TABLE IF NOT EXISTS lifecycle_staging_cleanup (
+ enumeration_id uuid PRIMARY KEY REFERENCES source_enumerations(id),
+ reason text NOT NULL CHECK(reason IN ('completed','abandoned')),
+ started_at timestamptz NOT NULL DEFAULT clock_timestamp()
+);
+DO $$ DECLARE t text; BEGIN
+ FOREACH t IN ARRAY ARRAY['lifecycle_maintenance_state','lifecycle_staging_cleanup'] LOOP
+  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
+  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
+  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_pre_dml ON public.%I',t);
+  EXECUTE format('CREATE TRIGGER lifecycle_pre_dml BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
+ END LOOP;
+END $$;
+-- Invoker deletion guards need only the non-sensitive permanent cutover bit.
+GRANT SELECT(cutover_at) ON lifecycle_maintenance_state TO authenticated;
+DROP POLICY IF EXISTS maintenance_cutover_read ON lifecycle_maintenance_state;
+CREATE POLICY maintenance_cutover_read ON lifecycle_maintenance_state FOR SELECT TO authenticated USING(true);
+CREATE OR REPLACE FUNCTION lifecycle_maintenance_cutover() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+BEGIN
+ IF TG_TABLE_NAME='lifecycle_control' THEN
+  IF NEW.maintenance_enabled THEN
+   UPDATE public.lifecycle_maintenance_state SET cutover_at=COALESCE(cutover_at,clock_timestamp()) WHERE singleton;
+  END IF;
+  RETURN NEW;
+ END IF;
+ IF TG_TABLE_NAME='lifecycle_maintenance_state' THEN
+  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'maintenance cutover history must survive'; END IF;
+  IF OLD.cutover_at IS NOT NULL AND NEW.cutover_at IS DISTINCT FROM OLD.cutover_at THEN
+   RAISE EXCEPTION 'maintenance cutover is permanent'; END IF;
+  RETURN NEW;
+ END IF;
+ IF EXISTS(SELECT FROM public.lifecycle_maintenance_state WHERE cutover_at IS NOT NULL) THEN
+  RAISE EXCEPTION 'legacy destructive prune disabled after maintenance cutover';
+ END IF;
+ RETURN NULL;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_maintenance_cutover() FROM PUBLIC,anon,authenticated;
+DROP TRIGGER IF EXISTS maintenance_cutover ON lifecycle_control;
+CREATE TRIGGER maintenance_cutover AFTER UPDATE ON lifecycle_control FOR EACH ROW EXECUTE FUNCTION lifecycle_maintenance_cutover();
+DROP TRIGGER IF EXISTS maintenance_history ON lifecycle_maintenance_state;
+CREATE TRIGGER maintenance_history BEFORE UPDATE OR DELETE ON lifecycle_maintenance_state FOR EACH ROW EXECUTE FUNCTION lifecycle_maintenance_cutover();
+DROP TRIGGER IF EXISTS maintenance_history_truncate ON lifecycle_maintenance_state;
+CREATE TRIGGER maintenance_history_truncate BEFORE TRUNCATE ON lifecycle_maintenance_state FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_maintenance_cutover();
+DROP TRIGGER IF EXISTS maintenance_no_job_delete ON jobs;
+CREATE TRIGGER maintenance_no_job_delete BEFORE DELETE OR TRUNCATE ON jobs FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_maintenance_cutover();
+-- Normal membership rows have no generation/source_id fields. Nest table-specific
+-- checks before resolving NEW fields; the existing validation comparisons remain.
+CREATE OR REPLACE FUNCTION lifecycle_staging_fence() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE e public.source_enumerations; c public.lifecycle_claims; floor bigint;
+BEGIN
+ IF TG_TABLE_NAME='source_accounts' THEN
+  IF NEW.replay_floor<OLD.replay_floor OR NEW.enumeration_sequence<OLD.enumeration_sequence OR NEW.claim_generation<OLD.claim_generation THEN
+   RAISE EXCEPTION 'source generation and replay floor are monotonic'; END IF;
+  RETURN NEW;
+ END IF;
+ IF TG_TABLE_NAME='source_enumerations' THEN e:=NEW;
+ ELSE SELECT * INTO STRICT e FROM public.source_enumerations WHERE id=NEW.enumeration_id;
+ END IF;
+ SELECT replay_floor INTO STRICT floor FROM public.source_accounts WHERE id=e.source_id;
+ IF e.sequence<=floor THEN RAISE EXCEPTION 'enumeration sequence rejected by replay floor'; END IF;
+ SELECT * INTO c FROM public.lifecycle_claims WHERE kind='source' AND work_id=e.source_id::text
+ AND owner_token=e.owner_token AND generation=e.generation AND generation>replay_floor
+ AND state='active' AND lease_until>clock_timestamp() AND invoking_role=current_user
+ AND subject_id IS NOT DISTINCT FROM public.app_user_id();
+ IF NOT FOUND THEN RAISE EXCEPTION 'stale, foreign or fenced enumeration claim'; END IF;
+ IF TG_TABLE_NAME='reconciliation_checkpoints' THEN
+  IF NEW.generation<>e.generation THEN RAISE EXCEPTION 'stale checkpoint claim'; END IF;
+ END IF;
+ IF TG_TABLE_NAME='source_enumerations' THEN
+  IF TG_OP='UPDATE' AND (NEW.source_id<>OLD.source_id OR NEW.sequence<>OLD.sequence OR NEW.owner_token<>OLD.owner_token OR NEW.generation<>OLD.generation) THEN
+   RAISE EXCEPTION 'enumeration identity is immutable';
+  END IF;
+ END IF;
+ INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,owner_token,generation)
+ VALUES(current_user,public.app_user_id(),e.owner_token,e.generation);
+ RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_staging_fence() FROM PUBLIC,anon,authenticated;
+INSERT INTO schema_migrations(filename) VALUES('2026-10-03-02-maintenance.sql') ON CONFLICT DO NOTHING;
diff --git a/tests/test_lifecycle_maintenance.py b/tests/test_lifecycle_maintenance.py
new file mode 100644
index 0000000..b9df872
--- /dev/null
+++ b/tests/test_lifecycle_maintenance.py
@@ -0,0 +1,377 @@
+"""Ordinary maintenance business behavior; no adversarial/tenant review probes."""
+import importlib
+
+import pytest
+
+from tests.conftest import requires_db
+from tests.test_prune import _company, _job
+
+
+def module():
+    return importlib.import_module('job_discovery.lifecycle.maintenance')
+
+
+def enable(conn):
+    conn.execute("UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1")
+    conn.commit()
+
+
+def claim(conn):
+    from job_discovery.lifecycle.claims import claim_work
+    value = claim_work(conn, 'maintenance', 'singleton', 120)
+    conn.commit()
+    return value
+
+
+@requires_db
+def test_dry_run_global_expiry_and_persisted_cursor(conn):
+    m = module()
+    cid = _company(conn, 'inactive', active=False)
+    ids = [_job(conn, cid, str(i)) for i in range(3)]
+    conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-interval '721 hours'")
+    conn.commit()
+    enable(conn)
+    c = claim(conn)
+    first = m.sweep(conn, c, max_rows=1)
+    second = m.sweep(conn, c, max_rows=1)
+    assert first.cursor == ids[0] and second.cursor == ids[1]
+    assert first.retired_rows == second.retired_rows == 0
+    assert conn.execute('SELECT count(*) AS n FROM jobs WHERE description IS NOT NULL').fetchone()['n'] == 3
+    assert conn.execute('SELECT eligible_rows FROM lifecycle_maintenance_state').fetchone()['eligible_rows'] == 1
+
+
+@requires_db
+def test_readiness_forces_dry_run_even_when_caller_requests_retirement(conn):
+    m = module()
+    cid = _company(conn, 'dry')
+    _job(conn, cid, '1')
+    conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-interval '31 days'")
+    conn.commit()
+    enable(conn)
+    assert m.sweep(conn, claim(conn), dry_run=False).retired_rows == 0
+    assert conn.execute('SELECT description FROM jobs').fetchone()['description'] == 'jd'
+
+
+@requires_db
+def test_maintenance_cutover_permanently_disables_legacy_prune(conn):
+    from job_discovery.prune import prune_jobs
+    cid = _company(conn, 'cutover')
+    jid = _job(conn, cid, '1', closed_days=40)
+    enable(conn)
+    assert prune_jobs(conn)['closed_deleted'] == 0
+    conn.execute('UPDATE lifecycle_control SET maintenance_enabled=false,activation_generation=activation_generation+1')
+    conn.commit()
+    assert prune_jobs(conn)['closed_deleted'] == 0
+    assert conn.execute('SELECT id FROM jobs').fetchone()['id'] == jid
+
+
+def test_pre_admission_failure_is_blocked(monkeypatch):
+    m = module()
+    def fail(*a, **kw):
+        raise RuntimeError('unavailable')
+    monkeypatch.setattr(m.db, 'connect', fail)
+    assert m.pre_admission_maintenance(None).blocked
+
+
+def test_maintenance_precedes_empty_targets_and_poll_lock(monkeypatch):
+    import job_discovery.run as run
+    from job_discovery.lifecycle.types import SweepResult
+    order = []
+    class Result:
+        def fetchone(self):
+            return {'locked': False}
+    class Conn:
+        def execute(self, *a):
+            order.append('lock')
+            return Result()
+        def close(self):
+            pass
+    monkeypatch.setattr(run, 'pre_admission_maintenance', lambda d: order.append('maintenance') or SweepResult(0, 0, False, None), raising=False)
+    monkeypatch.setattr(run, 'load_targets', lambda: order.append('targets') or [])
+    monkeypatch.setattr(run.db, 'connect', lambda d: Conn())
+    run.run()
+    assert order == ['maintenance', 'targets', 'lock']
+
+
+@pytest.mark.parametrize('description_age,question_age,last_use,expected', [
+    (721, 169, None, 2), (719, 169, None, 1), (721, 167, None, 1),
+    (721, 169, 1, 0), (None, None, None, 0),
+])
+@requires_db
+def test_payload_ttl_uses_capture_or_actual_use_not_sightings(conn, description_age, question_age, last_use, expected):
+    m = module()
+    cid = _company(conn, 'ttl', active=False)
+    jid = _job(conn, cid, '1')
+    conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-make_interval(hours=>%s),description_last_used_at=clock_timestamp()-make_interval(hours=>%s),last_seen_at=clock_timestamp()", (description_age, last_use))
+    conn.execute("INSERT INTO job_questions(job_id,questions,captured_at,last_used_at) VALUES(%s,'[]',clock_timestamp()-make_interval(hours=>%s),clock_timestamp()-make_interval(hours=>%s))", (jid, question_age, last_use))
+    conn.commit()
+    from job_discovery.lifecycle.locks import enter_gate
+    enter_gate(conn)
+    result = m._payload_batch(conn, None, 2000, False)
+    conn.commit()
+    assert result[1] == expected
+    assert conn.execute('SELECT id FROM jobs').fetchone()['id'] == jid
+
+
+@requires_db
+@pytest.mark.parametrize('kind', ['approve', 'correction', 'package', 'score', 'edit', 'generation', 'demand', 'snapshot'])
+def test_persisted_work_excludes_payload_retirement(conn, kind):
+    m = module()
+    cid = _company(conn, 'work')
+    jid = _job(conn, cid, '1')
+    conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-interval '31 days'")
+    uid = '33333333-3333-3333-3333-333333333333'
+    queries = {
+        'approve': "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES(%s,%s,'v','approve')",
+        'correction': "INSERT INTO review_corrections(user_id,job_id,verdict) VALUES(%s,%s,'approve')",
+        'package': "INSERT INTO application_packages(user_id,job_id) VALUES(%s,%s)",
+        'score': "INSERT INTO resume_scores(user_id,job_id) VALUES(%s,%s)",
+        'edit': "INSERT INTO cover_letter_edits(user_id,job_id,edited_text) VALUES(%s,%s,'edit')",
+        'generation': "INSERT INTO generation_jobs(user_id,job_id,kind) VALUES(%s,%s,'prepare')",
+        'demand': "INSERT INTO job_payload_demands(user_id,job_id,kind) VALUES(%s,%s,'review')",
+        'snapshot': "INSERT INTO job_payload_demands(user_id,job_id,kind,status,description_snapshot,snapshot_captured_at) VALUES(%s,%s,'review','failed','used',clock_timestamp())",
+    }
+    conn.execute(queries[kind], (uid, jid))
+    conn.commit()
+    enable(conn)
+    result = m.sweep(conn, claim(conn), max_rows=10)
+    assert result.retired_rows == 0
+    assert conn.execute('SELECT eligible_rows FROM lifecycle_maintenance_state').fetchone()['eligible_rows'] == 0
+    assert conn.execute('SELECT description FROM jobs').fetchone()['description'] == 'jd'
+
+
+def enumeration(conn, *, completed=False, hours=169, members=4):
+    from job_discovery.lifecycle.claims import claim_work
+    source = conn.execute("INSERT INTO source_accounts(ats,public_board_ref,enumeration_sequence) VALUES('lever','cleanup',1) RETURNING id").fetchone()['id']
+    c = claim_work(conn, 'source', str(source), 180)
+    eid = conn.execute("""INSERT INTO source_enumerations(source_id,sequence,owner_token,generation,status,started_at,reconciled_at)
+      VALUES(%s,1,%s,%s,%s,clock_timestamp()-make_interval(hours=>%s),CASE WHEN %s THEN clock_timestamp()-make_interval(hours=>%s) END) RETURNING id""",
+      (source, c.owner_token, c.generation, 'complete' if completed else 'running', hours, completed, hours)).fetchone()['id']
+    conn.commit()
+    for start in range(1, members+1, 500):
+        conn.execute("INSERT INTO enumeration_members SELECT %s,n::text,'{}'::jsonb FROM generate_series(%s::int,%s::int) n", (eid, start, min(start+499,members)))
+        conn.commit()
+    conn.execute("INSERT INTO reconciliation_checkpoints(enumeration_id,generation,reconciled_count,completed_at) VALUES(%s,%s,23,CASE WHEN %s THEN clock_timestamp()-make_interval(hours=>%s) END)", (eid, c.generation, completed, hours))
+    conn.commit()
+    return source, eid, c
+
+
+@requires_db
+@pytest.mark.parametrize('completed,hours,cleaned', [(True,25,True),(True,23,False),(False,169,True),(False,167,False)])
+def test_completed_and_abandoned_staging_cleanup_windows(conn, completed, hours, cleaned):
+    m = module()
+    source, eid, old = enumeration(conn, completed=completed, hours=hours)
+    enable(conn)
+    m.sweep(conn, claim(conn), max_rows=50)
+    assert (conn.execute('SELECT id FROM source_enumerations WHERE id=%s', (eid,)).fetchone() is None) == cleaned
+    floor = conn.execute('SELECT replay_floor FROM source_accounts WHERE id=%s', (source,)).fetchone()['replay_floor']
+    assert floor == (1 if cleaned else 0)
+    persisted = conn.execute("SELECT generation,replay_floor FROM lifecycle_claims WHERE kind='source'").fetchone()
+    assert (persisted['generation'] > old.generation) == cleaned
+
+
+@requires_db
+def test_staging_cleanup_is_capped_and_resumes_from_committed_fence(conn):
+    m = module()
+    source, eid, old = enumeration(conn, members=21005)
+    enable(conn)
+    c = claim(conn)
+    result = m.sweep(conn, c)
+    remaining = conn.execute('SELECT count(*) AS n FROM enumeration_members').fetchone()['n']
+    assert remaining == 1008  # 20,000 total units includes the 3-row fence.
+    assert result.retired_rows == 0
+    assert conn.execute('SELECT reason FROM lifecycle_staging_cleanup').fetchone()['reason'] == 'abandoned'
+    from tests.lifecycle_helpers import open_sessions
+    from tests.conftest import TEST_DSN
+    restarted = open_sessions(TEST_DSN,1)[0]
+    try:
+        m.sweep(restarted, c)
+    finally:
+        restarted.close()
+    assert conn.execute('SELECT count(*) AS n FROM enumeration_members').fetchone()['n'] == 0
+    assert conn.execute('SELECT count(*) AS n FROM source_enumerations').fetchone()['n'] == 0
+    assert conn.execute('SELECT replay_floor FROM source_accounts WHERE id=%s',(source,)).fetchone()['replay_floor'] == 1
+
+
+@requires_db
+def test_completed_requires_committed_reconciliation_checkpoint(conn):
+    m = module()
+    _, eid, _ = enumeration(conn, completed=True, hours=25)
+    conn.execute('UPDATE reconciliation_checkpoints SET completed_at=NULL WHERE enumeration_id=%s', (eid,))
+    conn.commit()
+    enable(conn)
+    m.sweep(conn, claim(conn))
+    assert conn.execute('SELECT count(*) AS n FROM enumeration_members').fetchone()['n'] == 4
+
+
+@requires_db
+def test_null_payloads_and_unknown_capture_never_invent_expiry(conn):
+    m = module()
+    cid = _company(conn, 'null')
+    jid = _job(conn, cid, '1', description=None)
+    conn.execute("INSERT INTO job_questions(job_id,questions,captured_at) VALUES(%s,'null',clock_timestamp()-interval '8 days')", (jid,))
+    conn.commit()
+    enable(conn)
+    m.sweep(conn, claim(conn))
+    assert conn.execute('SELECT eligible_rows FROM lifecycle_maintenance_state').fetchone()['eligible_rows'] == 0
+
+
+def test_budgets_and_deadline_are_explicit():
+    m = module()
+    assert (m.BATCH_ROWS, m.MAX_ROWS, m.DEADLINE_SECONDS, m.LEASE_SECONDS, m.RENEW_SECONDS) == (2000,20000,90,120,30)
+    for cap in (0,20001,-1,True):
+        with pytest.raises(ValueError):
+            m.sweep(None,None,max_rows=cap)
+
+
+@requires_db
+def test_retirement_worker_with_future_readiness_keeps_identity_and_has_no_external_effects(conn, monkeypatch):
+    # Worker-only readiness double exercises future live behavior without changing
+    # the installed SQL activation barrier or enabling the real control row.
+    from dataclasses import replace
+    m = module()
+    cid = _company(conn, 'retire')
+    jid = _job(conn, cid, '1')
+    conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-interval '31 days'")
+    conn.execute("INSERT INTO job_questions(job_id,questions,captured_at) VALUES(%s,'[]',clock_timestamp()-interval '8 days')", (jid,))
+    conn.commit()
+    enable(conn)
+    actual = m.read_control
+    monkeypatch.setattr(m, 'read_control', lambda c: replace(actual(c),safety_stage='enforced',retirement_enabled=True,retirement_dry_run=False))
+    def forbidden(*a, **kw):
+        raise AssertionError('maintenance attempted external side effect')
+    monkeypatch.setattr('reviewer.run.review_all', forbidden)
+    monkeypatch.setattr('job_discovery.http.get_json', forbidden)
+    monkeypatch.setattr('job_discovery.locations.resolve_new_locations', forbidden)
+    monkeypatch.setattr('socket.create_connection', forbidden)
+    result = m.sweep(conn, claim(conn), dry_run=False)
+    assert result.retired_rows == 2 and result.retired_bytes == 4
+    assert conn.execute('SELECT id,description,description_pruned FROM jobs').fetchone() == {'id':jid,'description':None,'description_pruned':True}
+    assert conn.execute('SELECT count(*) AS n FROM job_questions').fetchone()['n'] == 0
+    assert conn.execute('SELECT retirement_dry_run FROM lifecycle_control').fetchone()['retirement_dry_run']
+
+
+@requires_db
+def test_only_scheduled_guarded_sweeps_increment_action_streak(conn, monkeypatch):
+    m = module()
+    enable(conn)
+    c = claim(conn)
+    monkeypatch.setattr(m, 'CEILING_BYTES', 1)  # Metric branch only, no capacity mechanism changes.
+    assert m.sweep(conn,c).blocked
+    assert conn.execute('SELECT guard_scheduled_streak FROM lifecycle_maintenance_state').fetchone()['guard_scheduled_streak'] == 0
+    m.sweep(conn,c,scheduled=True)
+    assert not conn.execute('SELECT action_needed FROM lifecycle_maintenance_state').fetchone()['action_needed']
+    m.sweep(conn,c,scheduled=True)
+    metrics = conn.execute('SELECT * FROM lifecycle_maintenance_state').fetchone()
+    assert metrics['action_needed'] and metrics['physical_bytes'] > 0
+    assert metrics['reusable_bytes'] is None and metrics['live_tuples'] >= 0
+
+
+@requires_db
+def test_cooperative_deadline_and_renewal_between_short_transactions(conn, monkeypatch):
+    m = module()
+    enable(conn)
+    c = claim(conn)
+    clock = [0]
+    calls = []
+    renewals = []
+    monkeypatch.setattr(m,'monotonic',lambda: clock[0])
+    original_renew = m.renew_claim
+    def renew(*args):
+        renewals.append(clock[0])
+        return original_renew(*args)
+    monkeypatch.setattr(m,'renew_claim',renew)
+    def batch(*args):
+        assert clock[0] < 90
+        calls.append(clock[0])
+        clock[0] += 31
+        return 250,0,0,0,'progress'
+    monkeypatch.setattr(m,'_payload_batch',batch)
+    m.sweep(conn,c)
+    assert calls == [0,31,62] and renewals == [31,62]
+
+
+@requires_db
+def test_deleted_reservation_detail_requires_persisted_claim_floor(conn):
+    # Ordinary settled/fenced-record retention. No forged-token/expiry probes.
+    from job_discovery.lifecycle.claims import claim_work, cancel_claim
+    from job_discovery.lifecycle.capacity import reserve_capacity
+    m = module()
+    c = claim_work(conn,'test-retention','one',180)
+    reservation = reserve_capacity(conn,c,10)
+    conn.commit()
+    cancel_claim(conn,c)
+    conn.commit()
+    # Terminal timestamps are immutable; verify recent fenced details remain.
+    assert m._terminal_batch(conn,2000,3) == 0
+    conn.commit()
+    assert conn.execute('SELECT state FROM capacity_reservations WHERE id=%s',(reservation.id,)).fetchone()['state'] == 'fenced'
+    assert conn.execute("SELECT replay_floor FROM lifecycle_claims WHERE kind='test-retention'").fetchone()['replay_floor'] == c.generation
+
+
+@requires_db
+def test_only_safely_archived_unreferenced_superseded_versions_retire(conn):
+    from job_discovery.lifecycle.identity import migrate_identity_batch
+    from job_discovery.lifecycle.locks import enter_gate
+    m = module()
+    cid = _company(conn,'versions')
+    jid = _job(conn,cid,'1')
+    migrate_identity_batch(conn)
+    listing = conn.execute('SELECT id FROM source_listings WHERE job_id=%s',(jid,)).fetchone()['id']
+    for revision in range(1,16):
+        conn.execute("""INSERT INTO job_versions(job_id,source_listing_id,revision,content_hash,public_metadata,observed_at,recorded_at)
+          VALUES(%s,%s,%s,repeat('a',64),'{}',clock_timestamp(),clock_timestamp()-make_interval(hours=>%s))""",
+          (jid,listing,revision,745 if revision in (5,6) else 1))
+    conn.execute('UPDATE jobs SET description_version_id=(SELECT id FROM job_versions WHERE revision=1)')
+    conn.execute('UPDATE source_listings SET current_revision=15,archived_revision=5,current_version_id=(SELECT id FROM job_versions WHERE revision=15)')
+    conn.commit()
+    enter_gate(conn)
+    n,retired,_ = m._version_batch(conn,2000,False)
+    conn.commit()
+    assert n == retired == 4  # 2/3/4 exceed ten superseded; 5 is >30d.
+    remaining = [r['revision'] for r in conn.execute('SELECT revision FROM job_versions ORDER BY revision')]
+    assert remaining == [1,*range(6,16)]  # 1 referenced, 6 unarchived, 15 current.
+    assert conn.execute('SELECT id FROM jobs').fetchone()['id'] == jid
+
+
+@requires_db
+def test_terminal_retention_deletes_only_fenced_details_and_preserves_held(conn):
+    from job_discovery.lifecycle.claims import claim_work, cancel_claim
+    from job_discovery.lifecycle.capacity import reserve_capacity
+    m = module()
+    settled = claim_work(conn,'retention','terminal',180)
+    first = reserve_capacity(conn,settled,10)
+    reserve_capacity(conn,settled,10)
+    conn.commit()
+    cancel_claim(conn,settled)
+    conn.commit()
+    active = claim_work(conn,'retention','held',180)
+    held = reserve_capacity(conn,active,10)
+    conn.commit()
+    class RetentionClock:
+        """Test-only future retention cutoff; no lease/trigger clock is replaced."""
+        def execute(self, query, params=None):
+            return conn.execute(query.replace("clock_timestamp()-interval '168 hours'", "clock_timestamp()+interval '1 hour'"), params)
+    assert m._terminal_batch(RetentionClock(),1,3) == 1
+    conn.commit()
+    assert m._terminal_batch(RetentionClock(),2000,3) == 1
+    conn.commit()
+    assert conn.execute('SELECT id,state FROM capacity_reservations').fetchall() == [{'id':held.id,'state':'held'}]
+    assert not conn.execute('SELECT id FROM capacity_reservations WHERE id=%s',(first.id,)).fetchone()
+    assert conn.execute("SELECT replay_floor FROM lifecycle_claims WHERE kind='retention' AND work_id='terminal'").fetchone()['replay_floor'] == settled.generation
+
+
+@requires_db
+def test_retirement_byte_budget_defers_remaining_payload(conn):
+    from job_discovery.lifecycle.locks import enter_gate
+    m = module()
+    cid = _company(conn,'bytes')
+    jid = _job(conn,cid,'1')
+    conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-interval '31 days'")
+    conn.execute("INSERT INTO job_questions(job_id,questions,captured_at) VALUES(%s,'[]',clock_timestamp()-interval '8 days')",(jid,))
+    conn.commit()
+    enter_gate(conn)
+    _,rows,size,_,_ = m._payload_batch(conn,None,2000,False,byte_limit=2)
+    conn.commit()
+    assert rows == 1 and size == 2
+    assert conn.execute('SELECT questions FROM job_questions').fetchone()['questions'] == []
diff --git a/tests/test_run.py b/tests/test_run.py
index 8242873..d9d74f4 100644
--- a/tests/test_run.py
+++ b/tests/test_run.py
@@ -393,20 +393,26 @@ def test_rollback_failure_does_not_escape_company_handler(conn, monkeypatch):
         run_module, "load_targets",
         lambda: [
             {"name": "Bad", "ats": "lever", "token": "bad"},
             {"name": "Good", "ats": "greenhouse", "token": "good"},
         ],
     )
     monkeypatch.setitem(ADAPTERS, "lever", lambda token: (_ for _ in ()).throw(RuntimeError("api down")))
     monkeypatch.setitem(ADAPTERS, "greenhouse",
                         lambda token: [Posting(external_id="1", title="Eng", url="u")])
 
+    maintenance_calls = []
+    original_maintenance = run_module.pre_admission_maintenance
+    def maintain(dsn):
+        maintenance_calls.append('maintenance')
+        return original_maintenance(dsn)
+    monkeypatch.setattr(run_module, 'pre_admission_maintenance', maintain)
     rollback_calls = {"n": 0}
     original_connect = run_module.db.connect
 
     class _BrokenRollbackConn:
         """Proxy that lets all calls through but makes rollback raise once."""
         def __init__(self, real):
             self._real = real
         def rollback(self):
             rollback_calls["n"] += 1
             if rollback_calls["n"] == 1:
@@ -416,20 +422,22 @@ def test_rollback_failure_does_not_escape_company_handler(conn, monkeypatch):
             return getattr(self._real, name)
 
     def patched_connect(dsn=None):
         real = original_connect(dsn)
         return _BrokenRollbackConn(real)
 
     monkeypatch.setattr(run_module.db, "connect", patched_connect)
 
     run_module.run()  # must not raise
 
+    assert maintenance_calls == ["maintenance", "maintenance"]
+
     with conn.cursor() as cur:
         cur.execute("SELECT count(*) AS n FROM jobs")
         assert cur.fetchone()["n"] == 1  # Good's job was still polled
 
 
 @requires_db
 def test_review_phase_exception_rolls_back(conn, monkeypatch):
     """When review_all raises AFTER dirtying the connection (mid-transaction),
     the connection must be rolled back so prune can still run cleanly (not left
     in a failed-transaction state that makes every subsequent SQL fail)."""
@@ -617,10 +625,80 @@ def test_partial_stream_rolls_back_ingestion_and_counts(conn, monkeypatch):
     monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
     monkeypatch.setattr(run_module, "load_targets", lambda: [{"name":"A", "ats":"lever", "token":"a"}])
     monkeypatch.setattr(run_module, "UPSERT_CHUNK_SIZE", 1)
     def partial(token):
         yield Posting(external_id="1", title="A", url="u")
         raise ValueError("page failed")
     monkeypatch.setitem(ADAPTERS, "lever", partial)
     result = run_module.run()
     assert conn.execute("SELECT count(*) AS n FROM jobs").fetchone()["n"] == 0
     assert result["new_jobs"] == 0
+
+
+@requires_db
+@pytest.mark.parametrize('mode', ['normal','blocked','guard_failed','above','poll_failed','inactive','empty'])
+def test_pre_admission_control_order_on_actual_database(conn, monkeypatch, mode):
+    from job_discovery.lifecycle.types import SweepResult
+    from tests.test_prune import _company, _job
+    monkeypatch.setenv('DATABASE_URL', os.environ['TEST_DATABASE_URL'])
+    order = []
+    if mode != 'empty':
+        cid = _company(conn, 'order', active=mode != 'inactive')
+        _job(conn,cid,'existing')
+    maintenance = run_module.pre_admission_maintenance
+    def maintain(dsn):
+        order.append('maintenance')
+        result = maintenance(dsn)
+        return SweepResult(0,0,True,None) if mode == 'blocked' else result
+    monkeypatch.setattr(run_module,'pre_admission_maintenance',maintain)
+    monkeypatch.setattr(run_module,'load_targets',lambda: order.append('targets') or [])
+    def guard(c):
+        order.append('capacity')
+        if mode == 'guard_failed':
+            raise RuntimeError('measurement failed')
+        return mode == 'above',6500 if mode == 'above' else 20,6000
+    monkeypatch.setattr(run_module.db,'over_size_ceiling',guard)
+    upsert = run_module.db.upsert_jobs
+    def write(*args):
+        order.append('upsert')
+        return upsert(*args)
+    monkeypatch.setattr(run_module.db,'upsert_jobs',write)
+    def source(token):
+        order.append('verify')
+        if mode == 'poll_failed':
+            raise RuntimeError('source unavailable')
+        return [Posting(external_id='new',title='New',url='u')]
+    monkeypatch.setitem(ADAPTERS,'lever',source)
+    monkeypatch.setattr('reviewer.run.review_all',lambda c: None)
+    monkeypatch.setattr('job_discovery.locations.resolve_new_locations',lambda c: None)
+    run_module.run()
+    assert order[:3] == ['maintenance','targets','capacity']
+    if mode == 'normal':
+        assert order.index('capacity') < order.index('upsert')
+    else:
+        assert 'upsert' not in order
+    if mode not in {'inactive','empty'}:
+        assert 'verify' in order
+
+
+@requires_db
+def test_chunk_guard_preserves_committed_admissions_and_completes_verification(conn, monkeypatch):
+    from tests.test_prune import _company, _job
+    monkeypatch.setenv('DATABASE_URL', os.environ['TEST_DATABASE_URL'])
+    cid = _company(conn,'chunks')
+    old = _job(conn,cid,'missing')
+    monkeypatch.setattr(run_module,'load_targets',lambda: [])
+    calls = []
+    def guard(c):
+        calls.append('capacity')
+        return len(calls) >= 3,20,6000
+    monkeypatch.setattr(run_module.db,'over_size_ceiling',guard)
+    monkeypatch.setitem(ADAPTERS,'lever',lambda token: [Posting(external_id=str(i),title='Engineer',url='u') for i in range(1001)])
+    def forbidden(*args,**kw):
+        raise AssertionError('guarded cycle invoked model work')
+    monkeypatch.setattr('reviewer.run.review_all',forbidden)
+    monkeypatch.setattr('job_discovery.locations.resolve_new_locations',forbidden)
+    result = run_module.run()
+    assert result['new_jobs'] == 500 and result['closed_jobs'] == 1
+    assert conn.execute('SELECT count(*) AS n FROM jobs').fetchone()['n'] == 501
+    assert conn.execute('SELECT closed_at FROM jobs WHERE id=%s',(old,)).fetchone()['closed_at'] is not None
+    assert len(calls) == 3
diff --git a/tests/test_size_guard.py b/tests/test_size_guard.py
index f627b72..93f9d52 100644
--- a/tests/test_size_guard.py
+++ b/tests/test_size_guard.py
@@ -225,21 +225,24 @@ import pytest
 
 @requires_db
 @pytest.mark.parametrize("source_result", ["complete", "failed", "partial", "incomplete"])
 def test_guard_reconciles_only_complete_sources_without_ingestion(conn, monkeypatch, source_result):
     from job_discovery.models import Posting
     from tests.test_prune import _company, _job
     cid = _company(conn, "guarded")
     _job(conn, cid, "live", closed_days=40 if source_result == "complete" else 1)
     _job(conn, cid, "missing")
     monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
-    monkeypatch.setattr(db, "connect", lambda dsn=None: conn)
+    # Each phase owns its connection; maintenance closes its session before poll.
+    original_connect = db.connect
+    from tests.conftest import TEST_DSN
+    monkeypatch.setattr(db, "connect", lambda dsn=None: original_connect(TEST_DSN))
     monkeypatch.setattr(db, "over_size_ceiling", lambda c: (True, 6500, 6000))
     def forbidden(*args, **kwargs):
         pytest.fail("guard allowed ingestion or enrichment")
     monkeypatch.setattr(db, "sync_seed", forbidden)
     monkeypatch.setattr(db, "upsert_jobs", forbidden)
     monkeypatch.setattr(job_discovery_run, "backfill_greenhouse_questions", forbidden)
     monkeypatch.setattr("job_discovery.locations.resolve_new_locations", forbidden)
     monkeypatch.setattr("reviewer.run.review_all", forbidden)
     def source(token):
         if source_result == "failed":
@@ -250,21 +253,20 @@ def test_guard_reconciles_only_complete_sources_without_ingestion(conn, monkeypa
             raise ValueError("source unavailable or incomplete")
     if source_result == "incomplete":
         class Incomplete(list):
             complete = False
         def source(token):
             return Incomplete([Posting(external_id="live", title="A", url="u")])
     monkeypatch.setitem(job_discovery_run.ADAPTERS, "lever", source)
     # run owns its connection; query persisted results on a separate connection.
     import psycopg
     from psycopg.rows import dict_row
-    from tests.conftest import TEST_DSN
     counts = job_discovery_run.run()
     with psycopg.connect(TEST_DSN, row_factory=dict_row) as check:
         rows = check.execute("SELECT external_id, title, closed_at FROM jobs ORDER BY external_id").fetchall()
     assert [r["external_id"] for r in rows] == ["live", "missing"]
     assert rows[0]["title"] == "Eng"
     assert (rows[0]["closed_at"] is None) == (source_result == "complete")
     assert (rows[1]["closed_at"] is not None) == (source_result == "complete")
     assert counts["new_jobs"] == 0
     assert counts["closed_jobs"] == (1 if source_result == "complete" else 0)
     assert counts["failed"] == (0 if source_result == "complete" else 1)
