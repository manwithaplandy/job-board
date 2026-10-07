# Full pinned review package

BASE: ec588ac87f1dc0a3bbf685d9c8dfee0b79e1b409

HEAD: db73ad7365790419c4a1a82ec38ae21e4c7233c3

## Commits

db73ad7365790419c4a1a82ec38ae21e4c7233c3 feat: reconcile complete source evidence with fair fenced scheduling


## Files

 .../task-6-evidence/bounded-17.txt                 |   3 +
 .../task-6-evidence/callers-17.txt                 |   3 +
 .../task-6-evidence/commands.txt                   |  51 +++
 .../task-6-evidence/final-16.txt                   |   6 +
 .../task-6-evidence/final-17.txt                   |   6 +
 .../task-6-evidence/final-source-16.txt            |   3 +
 .../task-6-evidence/final-source-17.txt            |   3 +
 .../task-6-evidence/first-green-17.txt             | 322 +++++++++++++++++
 .../task-6-evidence/fourth-green-17.txt            |   5 +
 .../task-6-evidence/qualifying-completion-16.txt   |   3 +
 .../task-6-evidence/qualifying-completion-17.txt   |   3 +
 .../task-6-evidence/red.txt                        |  16 +
 .../task-6-evidence/ruff.txt                       |   1 +
 .../task-6-evidence/second-green-17.txt            | 235 ++++++++++++
 .../task-6-evidence/third-green-17.txt             | 122 +++++++
 .../task-6-evidence/whitespace.txt                 |   0
 .../task-6-report.md                               | 173 +++++++++
 job_discovery/adapters/__init__.py                 |   8 +-
 job_discovery/adapters/ashby.py                    |   8 +-
 job_discovery/adapters/completeness.py             |  51 +++
 job_discovery/adapters/greenhouse.py               |  10 +-
 job_discovery/adapters/lever.py                    |   8 +-
 job_discovery/adapters/smartrecruiters.py          |  23 +-
 job_discovery/adapters/workable.py                 |  10 +-
 job_discovery/adapters/workday.py                  |   8 +-
 job_discovery/db.py                                |  33 ++
 job_discovery/lifecycle/reconcile.py               | 371 +++++++++++++++++++
 job_discovery/run.py                               |  17 +
 tests/test_lifecycle_reconcile.py                  | 398 +++++++++++++++++++++
 tests/test_maintenance_controlflow.py              |   1 +
 tests/test_size_guard.py                           |   6 +
 tests/test_smartrecruiters.py                      |  14 +-
 tests/test_source_completeness.py                  |  79 ++++
 tests/test_workable.py                             |   4 +-
 34 files changed, 1966 insertions(+), 38 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/bounded-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/bounded-17.txt
new file mode 100644
index 0000000..6ffe217
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/bounded-17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+......................................                                   [100%]
+38 passed in 38.90s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/callers-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/callers-17.txt
new file mode 100644
index 0000000..af26022
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/callers-17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+....................................                                     [100%]
+36 passed in 4.33s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/commands.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/commands.txt
new file mode 100644
index 0000000..dde24c9
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/commands.txt
@@ -0,0 +1,51 @@
+Working directory: /workspace/job-board/.claude/worktrees/lifecycle-recovery
+
+Shell: /bin/bash; login=false
+
+BASE: ec588ac87f1dc0a3bbf685d9c8dfee0b79e1b409
+
+No ambient DSNs used; harness provisions a distinct owned random-loopback-port container per call.
+
+
+
+red.txt: .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py -q
+
+first-green-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py tests/test_source_completeness.py -q
+
+second-green-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py tests/test_source_completeness.py tests/test_run.py tests/test_size_guard.py tests/test_maintenance_controlflow.py -q
+
+third-green-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py tests/test_source_completeness.py tests/test_run.py tests/test_size_guard.py tests/test_maintenance_controlflow.py -q
+
+fourth-green-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py tests/test_source_completeness.py tests/test_run.py tests/test_size_guard.py tests/test_maintenance_controlflow.py -q
+
+bounded-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_source_completeness.py -q
+
+final-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py tests/test_source_completeness.py tests/test_run.py tests/test_size_guard.py tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_lifecycle_supervisor.py tests/test_lifecycle_legacy_spool.py tests/test_lifecycle_service_order.py tests/test_run_question_fetch.py -q
+
+final-16.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py tests/test_source_completeness.py tests/test_run.py tests/test_size_guard.py tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_lifecycle_supervisor.py tests/test_lifecycle_legacy_spool.py tests/test_lifecycle_service_order.py tests/test_run_question_fetch.py -q
+
+final-source-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_source_completeness.py -q
+
+final-source-16.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_source_completeness.py -q
+
+callers-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py::test_readonly_fallback_day_rotation_attempts_all_six_with_one_turn_budget tests/test_company_enrich.py -q
+
+qualifying-completion-17.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_source_completeness.py -q
+
+qualifying-completion-16.txt: .venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_lifecycle_reconcile.py tests/test_source_completeness.py -q
+
+
+
+ruff.txt: .venv/bin/python -m ruff check job_discovery tests/test_lifecycle_reconcile.py tests/test_source_completeness.py tests/test_smartrecruiters.py tests/test_workable.py tests/test_size_guard.py tests/test_maintenance_controlflow.py --output-format concise
+
+git diff --check
+
+git diff --cached --check
+
+Python 3.12.14; pytest 9.1.1; Ruff 0.15.20
+
+Owned server versions: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2); PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2)
+
+Read-only cached origin/main: 73ce118205bfdbb56c18207acc0c1c4e3708c860. No network fetch or production access.
+
+Evidence sanitization: trailing whitespace removed; ephemeral fixture owner tokens redacted where present. No outcomes or test messages changed.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-16.txt
new file mode 100644
index 0000000..358fb67
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-16.txt
@@ -0,0 +1,6 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [ 31%]
+........................................................................ [ 62%]
+........................................................................ [ 93%]
+...............                                                          [100%]
+231 passed in 167.87s (0:02:47)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-17.txt
new file mode 100644
index 0000000..34b989b
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-17.txt
@@ -0,0 +1,6 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 31%]
+........................................................................ [ 62%]
+........................................................................ [ 93%]
+...............                                                          [100%]
+231 passed in 134.78s (0:02:14)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-source-16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-source-16.txt
new file mode 100644
index 0000000..d25f7f9
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-source-16.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+...........................................                              [100%]
+43 passed in 64.90s (0:01:04)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-source-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-source-17.txt
new file mode 100644
index 0000000..8a5eabe
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/final-source-17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..........................................                               [100%]
+42 passed in 74.56s (0:01:14)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/first-green-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/first-green-17.txt
new file mode 100644
index 0000000..bd07409
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/first-green-17.txt
@@ -0,0 +1,322 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FFFFFF.................................FF............................... [ 83%]
+..............                                                           [100%]
+=================================== FAILURES ===================================
+____________ test_two_distinct_complete_misses_exact_24h_and_replay ____________
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777bbe3e00>
+
+    @requires_db
+    def test_two_distinct_complete_misses_exact_24h_and_replay(conn):
+>       source = setup_source(conn)
+                 ^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_reconcile.py:48:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_reconcile.py:21: in setup_source
+    conn.execute('UPDATE lifecycle_control SET source_enabled=true WHERE singleton')
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777bbe3e00>
+query = 'UPDATE lifecycle_control SET source_enabled=true WHERE singleton'
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
+E           psycopg.errors.RaiseException: control changes require a newer activation generation
+E           CONTEXT:  PL/pgSQL function public.preserve_lifecycle_control() line 7 at RAISE
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: RaiseException
+_ test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset __
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b76c140>
+
+    @requires_db
+    def test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset(conn):
+>       source = setup_source(conn)
+                 ^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_reconcile.py:69:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_reconcile.py:21: in setup_source
+    conn.execute('UPDATE lifecycle_control SET source_enabled=true WHERE singleton')
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b76c140>
+query = 'UPDATE lifecycle_control SET source_enabled=true WHERE singleton'
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
+E           psycopg.errors.RaiseException: control changes require a newer activation generation
+E           CONTEXT:  PL/pgSQL function public.preserve_lifecycle_control() line 7 at RAISE
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: RaiseException
+______________________ test_empty_threshold[20-complete] _______________________
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b7685c0>
+count = 20, expected = 'complete'
+
+    @requires_db
+    @pytest.mark.parametrize('count,expected', [(20,'complete'), (21,'partial')])
+    def test_empty_threshold(conn, count, expected):
+>       source = setup_source(conn, count)
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_reconcile.py:90:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_reconcile.py:21: in setup_source
+    conn.execute('UPDATE lifecycle_control SET source_enabled=true WHERE singleton')
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b7685c0>
+query = 'UPDATE lifecycle_control SET source_enabled=true WHERE singleton'
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
+E           psycopg.errors.RaiseException: control changes require a newer activation generation
+E           CONTEXT:  PL/pgSQL function public.preserve_lifecycle_control() line 7 at RAISE
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: RaiseException
+_______________________ test_empty_threshold[21-partial] _______________________
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b76bbc0>
+count = 21, expected = 'partial'
+
+    @requires_db
+    @pytest.mark.parametrize('count,expected', [(20,'complete'), (21,'partial')])
+    def test_empty_threshold(conn, count, expected):
+>       source = setup_source(conn, count)
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_reconcile.py:90:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_reconcile.py:21: in setup_source
+    conn.execute('UPDATE lifecycle_control SET source_enabled=true WHERE singleton')
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b76bbc0>
+query = 'UPDATE lifecycle_control SET source_enabled=true WHERE singleton'
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
+E           psycopg.errors.RaiseException: control changes require a newer activation generation
+E           CONTEXT:  PL/pgSQL function public.preserve_lifecycle_control() line 7 at RAISE
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: RaiseException
+________ test_unknown_or_missing_never_closes_and_partial_never_counts _________
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b768860>
+
+    @requires_db
+    def test_unknown_or_missing_never_closes_and_partial_never_counts(conn):
+>       source = setup_source(conn)
+                 ^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_reconcile.py:99:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_reconcile.py:21: in setup_source
+    conn.execute('UPDATE lifecycle_control SET source_enabled=true WHERE singleton')
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b768860>
+query = 'UPDATE lifecycle_control SET source_enabled=true WHERE singleton'
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
+E           psycopg.errors.RaiseException: control changes require a newer activation generation
+E           CONTEXT:  PL/pgSQL function public.preserve_lifecycle_control() line 7 at RAISE
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: RaiseException
+__________________ test_cancelled_enumeration_cannot_complete __________________
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b745070>
+
+    @requires_db
+    def test_cancelled_enumeration_cannot_complete(conn):
+>       source = setup_source(conn)
+                 ^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_reconcile.py:110:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_reconcile.py:21: in setup_source
+    conn.execute('UPDATE lifecycle_control SET source_enabled=true WHERE singleton')
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=32956 user=postgres database=poller_lifecycle_test) at 0x7f777b745070>
+query = 'UPDATE lifecycle_control SET source_enabled=true WHERE singleton'
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
+E           psycopg.errors.RaiseException: control changes require a newer activation generation
+E           CONTEXT:  PL/pgSQL function public.preserve_lifecycle_control() line 7 at RAISE
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: RaiseException
+_______________________ test_missing_content_key_raises ________________________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f777b7473e0>
+
+    def test_missing_content_key_raises(monkeypatch):
+        monkeypatch.setattr(smartrecruiters, "get_json", lambda url: {"error": "gone"})
+>       with pytest.raises(ValueError, match="missing 'content'"):
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE ValueError
+
+tests/test_smartrecruiters.py:205: Failed
+__________ test_short_page_below_reported_total_is_not_authoritative ___________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f777b7281a0>
+
+    def test_short_page_below_reported_total_is_not_authoritative(monkeypatch):
+        monkeypatch.setattr(smartrecruiters, "get_json", lambda *a: {"totalFound": 50, "content": []})
+>       with pytest.raises(ValueError, match="incomplete"):
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE ValueError
+
+tests/test_smartrecruiters.py:211: Failed
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_reconcile.py::test_two_distinct_complete_misses_exact_24h_and_replay
+FAILED tests/test_lifecycle_reconcile.py::test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset
+FAILED tests/test_lifecycle_reconcile.py::test_empty_threshold[20-complete]
+FAILED tests/test_lifecycle_reconcile.py::test_empty_threshold[21-partial] - ...
+FAILED tests/test_lifecycle_reconcile.py::test_unknown_or_missing_never_closes_and_partial_never_counts
+FAILED tests/test_lifecycle_reconcile.py::test_cancelled_enumeration_cannot_complete
+FAILED tests/test_smartrecruiters.py::test_missing_content_key_raises - Faile...
+FAILED tests/test_smartrecruiters.py::test_short_page_below_reported_total_is_not_authoritative
+8 failed, 78 passed in 2.41s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fourth-green-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fourth-green-17.txt
new file mode 100644
index 0000000..d4388b5
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/fourth-green-17.txt
@@ -0,0 +1,5 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 45%]
+........................................................................ [ 90%]
+...............                                                          [100%]
+159 passed in 27.26s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/qualifying-completion-16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/qualifying-completion-16.txt
new file mode 100644
index 0000000..125e00e
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/qualifying-completion-16.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+...........................................                              [100%]
+43 passed in 54.97s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/qualifying-completion-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/qualifying-completion-17.txt
new file mode 100644
index 0000000..5a2aa84
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/qualifying-completion-17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+...........................................                              [100%]
+43 passed in 67.68s (0:01:07)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/red.txt
new file mode 100644
index 0000000..103f58b
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/red.txt
@@ -0,0 +1,16 @@
+
+==================================== ERRORS ====================================
+______________ ERROR collecting tests/test_lifecycle_reconcile.py ______________
+ImportError while importing test module '/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_lifecycle_reconcile.py'.
+Hint: make sure your test modules/packages have valid Python names.
+Traceback:
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+tests/test_lifecycle_reconcile.py:8: in <module>
+    from job_discovery.lifecycle import reconcile as r
+E   ImportError: cannot import name 'reconcile' from 'job_discovery.lifecycle' (/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/__init__.py)
+=========================== short test summary info ============================
+ERROR tests/test_lifecycle_reconcile.py
+!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
+1 error in 0.14s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/ruff.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/ruff.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/second-green-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/second-green-17.txt
new file mode 100644
index 0000000..f54c269
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/second-green-17.txt
@@ -0,0 +1,235 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+.......................................F................................ [ 52%]
+..................................................FF........FF...        [100%]
+=================================== FAILURES ===================================
+_______________________ test_missing_content_key_raises ________________________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f784a954cb0>
+
+    def test_missing_content_key_raises(monkeypatch):
+        monkeypatch.setattr(smartrecruiters, "get_json", lambda url: {"error": "gone"})
+>       with pytest.raises(ValueError, match="missing 'content'"):
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE ValueError
+
+tests/test_smartrecruiters.py:205: Failed
+________________ test_job_discovery_run_skips_when_over_ceiling ________________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f784a6e26f0>
+
+    def test_job_discovery_run_skips_when_over_ceiling(monkeypatch):
+        conn = _GuardConn()
+        monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
+        monkeypatch.setattr(job_discovery_run.db, "connect", lambda dsn=None: conn)
+        monkeypatch.setattr(job_discovery_run.db, "over_size_ceiling", lambda c: (True, 6500.0, 6000.0))
+        _forbid_poll_body(monkeypatch)
+        started = {"called": False}
+        monkeypatch.setattr(job_discovery_run.db, "start_run",
+                            lambda c: started.__setitem__("called", True) or 1)
+
+>       job_discovery_run.run()
+
+tests/test_size_guard.py:166:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+job_discovery/run.py:111: in run
+    source_enabled = read_control(conn).source_enabled
+                     ^^^^^^^^^^^^^^^^^^
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <tests.test_size_guard._GuardConn object at 0x7f784a6e3620>
+
+    def read_control(conn) -> LifecycleControl:
+>       with conn.cursor(row_factory=dict_row) as cur:
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       TypeError: _GuardConn.cursor() got an unexpected keyword argument 'row_factory'
+
+job_discovery/lifecycle/config.py:31: TypeError
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery.lifecycle.maintenance:maintenance.py:408 pre-admission maintenance failed; additions blocked, verification permitted
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/maintenance.py", line 389, in pre_admission_maintenance
+    enter_gate(conn)
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/locks.py", line 8, in enter_gate
+    conn.execute("SHOW transaction_isolation").fetchone()["transaction_isolation"]
+    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^
+KeyError: 'transaction_isolation'
+WARNING  job_discovery:run.py:103 maintenance only: safety maintenance blocked admission; checking closures without ingestion or enrichment
+_______________ test_job_discovery_run_prunes_when_over_ceiling ________________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f784a6e00e0>
+
+    def test_job_discovery_run_prunes_when_over_ceiling(monkeypatch):
+        """prune_jobs must still run when the size guard short-circuits the poll.
+
+        Prune is the only mechanism that can shrink the DB; skipping it on the
+        over-ceiling path would stall recovery.
+        """
+        conn = _GuardConn()
+        monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
+        monkeypatch.setattr(job_discovery_run.db, "connect", lambda dsn=None: conn)
+        monkeypatch.setattr(job_discovery_run.db, "over_size_ceiling", lambda c: (True, 6500.0, 6000.0))
+        _forbid_poll_body(monkeypatch)
+        started = {"called": False}
+        monkeypatch.setattr(job_discovery_run.db, "start_run",
+                            lambda c: started.__setitem__("called", True) or 1)
+
+        prune_calls = {"n": 0}
+
+        def fake_prune(c):
+            prune_calls["n"] += 1
+
+        import job_discovery.prune as prune_module
+        monkeypatch.setattr(prune_module, "prune_jobs", fake_prune)
+
+>       job_discovery_run.run()
+
+tests/test_size_guard.py:200:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+job_discovery/run.py:111: in run
+    source_enabled = read_control(conn).source_enabled
+                     ^^^^^^^^^^^^^^^^^^
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <tests.test_size_guard._GuardConn object at 0x7f784a6e3050>
+
+    def read_control(conn) -> LifecycleControl:
+>       with conn.cursor(row_factory=dict_row) as cur:
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       TypeError: _GuardConn.cursor() got an unexpected keyword argument 'row_factory'
+
+job_discovery/lifecycle/config.py:31: TypeError
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery.lifecycle.maintenance:maintenance.py:408 pre-admission maintenance failed; additions blocked, verification permitted
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/maintenance.py", line 389, in pre_admission_maintenance
+    enter_gate(conn)
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/locks.py", line 8, in enter_gate
+    conn.execute("SHOW transaction_isolation").fetchone()["transaction_isolation"]
+    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^
+KeyError: 'transaction_isolation'
+WARNING  job_discovery:run.py:103 maintenance only: safety maintenance blocked admission; checking closures without ingestion or enrichment
+_____ test_denied_reconnect_lock_aborts_before_all_optional_phases[False] ______
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f784a78dbe0>
+accounting_fails = False
+
+    @pytest.mark.parametrize('accounting_fails', [False, True])
+    def test_denied_reconnect_lock_aborts_before_all_optional_phases(monkeypatch, accounting_fails):
+        finished, closes = [], []
+        class Connection:
+            def __init__(self, locked, broken=False):
+                self.locked, self.broken = locked, broken
+            def execute(self, *args):
+                return Result({'locked':self.locked})
+            def commit(self):
+                pass
+            def rollback(self):
+                if self.broken:
+                    raise RuntimeError('broken rollback')
+            def close(self):
+                closes.append(self.locked)
+        connections = iter([Connection(True,True),Connection(False)])
+        monkeypatch.setattr(run,'pre_admission_maintenance',lambda dsn: SweepResult(0,0,False,None))
+        monkeypatch.setattr(run,'load_targets',lambda: [])
+        monkeypatch.setattr(run.db,'connect',lambda dsn: next(connections))
+        monkeypatch.setattr(run.db,'over_size_ceiling',lambda c: (False,20,6000))
+        monkeypatch.setattr(run.db,'start_run',lambda c: 1)
+        monkeypatch.setattr(run.db,'sync_seed',lambda *a: None)
+        monkeypatch.setattr(run.db,'active_companies',lambda c: [{'id':1,'ats':'lever','token':'x','name':'X'}])
+        def finish(*args, **kw):
+            finished.append(kw)
+            if accounting_fails:
+                raise RuntimeError('accounting unavailable')
+        monkeypatch.setattr(run.db,'finish_run',finish)
+        def source(token):
+            raise RuntimeError('source unavailable')
+        monkeypatch.setitem(run.ADAPTERS,'lever',source)
+        def forbidden(*args,**kwargs):
+            pytest.fail('aborted poll entered an optional phase')
+        monkeypatch.setattr(run,'_run_prune',forbidden)
+        monkeypatch.setattr('job_discovery.locations.resolve_new_locations',forbidden)
+        monkeypatch.setattr('reviewer.run.review_all',forbidden)
+>       assert run.run() == {'ok':0,'failed':1,'new_jobs':0,'closed_jobs':0}
+               ^^^^^^^^^
+
+tests/test_maintenance_controlflow.py:137:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+job_discovery/run.py:111: in run
+    source_enabled = read_control(conn).source_enabled
+                     ^^^^^^^^^^^^^^^^^^
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <tests.test_maintenance_controlflow.test_denied_reconnect_lock_aborts_before_all_optional_phases.<locals>.Connection object at 0x7f784a84a9f0>
+
+    def read_control(conn) -> LifecycleControl:
+>       with conn.cursor(row_factory=dict_row) as cur:
+             ^^^^^^^^^^^
+E       AttributeError: 'Connection' object has no attribute 'cursor'
+
+job_discovery/lifecycle/config.py:31: AttributeError
+______ test_denied_reconnect_lock_aborts_before_all_optional_phases[True] ______
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f784a8494c0>
+accounting_fails = True
+
+    @pytest.mark.parametrize('accounting_fails', [False, True])
+    def test_denied_reconnect_lock_aborts_before_all_optional_phases(monkeypatch, accounting_fails):
+        finished, closes = [], []
+        class Connection:
+            def __init__(self, locked, broken=False):
+                self.locked, self.broken = locked, broken
+            def execute(self, *args):
+                return Result({'locked':self.locked})
+            def commit(self):
+                pass
+            def rollback(self):
+                if self.broken:
+                    raise RuntimeError('broken rollback')
+            def close(self):
+                closes.append(self.locked)
+        connections = iter([Connection(True,True),Connection(False)])
+        monkeypatch.setattr(run,'pre_admission_maintenance',lambda dsn: SweepResult(0,0,False,None))
+        monkeypatch.setattr(run,'load_targets',lambda: [])
+        monkeypatch.setattr(run.db,'connect',lambda dsn: next(connections))
+        monkeypatch.setattr(run.db,'over_size_ceiling',lambda c: (False,20,6000))
+        monkeypatch.setattr(run.db,'start_run',lambda c: 1)
+        monkeypatch.setattr(run.db,'sync_seed',lambda *a: None)
+        monkeypatch.setattr(run.db,'active_companies',lambda c: [{'id':1,'ats':'lever','token':'x','name':'X'}])
+        def finish(*args, **kw):
+            finished.append(kw)
+            if accounting_fails:
+                raise RuntimeError('accounting unavailable')
+        monkeypatch.setattr(run.db,'finish_run',finish)
+        def source(token):
+            raise RuntimeError('source unavailable')
+        monkeypatch.setitem(run.ADAPTERS,'lever',source)
+        def forbidden(*args,**kwargs):
+            pytest.fail('aborted poll entered an optional phase')
+        monkeypatch.setattr(run,'_run_prune',forbidden)
+        monkeypatch.setattr('job_discovery.locations.resolve_new_locations',forbidden)
+        monkeypatch.setattr('reviewer.run.review_all',forbidden)
+>       assert run.run() == {'ok':0,'failed':1,'new_jobs':0,'closed_jobs':0}
+               ^^^^^^^^^
+
+tests/test_maintenance_controlflow.py:137:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+job_discovery/run.py:111: in run
+    source_enabled = read_control(conn).source_enabled
+                     ^^^^^^^^^^^^^^^^^^
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <tests.test_maintenance_controlflow.test_denied_reconnect_lock_aborts_before_all_optional_phases.<locals>.Connection object at 0x7f784a84a0f0>
+
+    def read_control(conn) -> LifecycleControl:
+>       with conn.cursor(row_factory=dict_row) as cur:
+             ^^^^^^^^^^^
+E       AttributeError: 'Connection' object has no attribute 'cursor'
+
+job_discovery/lifecycle/config.py:31: AttributeError
+=========================== short test summary info ============================
+FAILED tests/test_smartrecruiters.py::test_missing_content_key_raises - Faile...
+FAILED tests/test_size_guard.py::test_job_discovery_run_skips_when_over_ceiling
+FAILED tests/test_size_guard.py::test_job_discovery_run_prunes_when_over_ceiling
+FAILED tests/test_maintenance_controlflow.py::test_denied_reconnect_lock_aborts_before_all_optional_phases[False]
+FAILED tests/test_maintenance_controlflow.py::test_denied_reconnect_lock_aborts_before_all_optional_phases[True]
+5 failed, 132 passed in 19.37s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/third-green-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/third-green-17.txt
new file mode 100644
index 0000000..6e97511
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/third-green-17.txt
@@ -0,0 +1,122 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+......F................................................................. [ 50%]
+.........................................................FF............. [100%]
+=================================== FAILURES ===================================
+_ test_checkpoint_survives_fresh_connection_and_newer_positive_beats_old_absence _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32958 user=postgres database=poller_lifecycle_test) at 0x7fcd1ac5d010>
+
+    @requires_db
+    def test_checkpoint_survives_fresh_connection_and_newer_positive_beats_old_absence(conn):
+        import psycopg
+        from psycopg.rows import dict_row
+        from tests.conftest import TEST_DSN
+        source = setup_source(conn, 105)
+        enum = begin(conn,source)
+        r.complete_enumeration(conn,enum,SourceStatus())
+>       assert not r.reconcile_chunk(conn,enum,100)
+E       AssertionError: assert not True
+E        +  where True = <function reconcile_chunk at 0x7fcd1c563880>(<psycopg.Connection [INTRANS] (host=127.0.0.1 port=32958 user=postgres database=poller_lifecycle_test) at 0x7fcd1ac5d010>, EnumerationRef(id=UUID('d6fe9769-0383-42b8-bcbc-d8b402c4b795'), source_id=UUID('98459879-8db4-41b8-a278-5d6e2838393f')...generation=1, lease_until=datetime.datetime(2026, 10, 7, 15, 33, 51, 838743, tzinfo=zoneinfo.ZoneInfo(key='Etc/UTC')))), 100)
+E        +    where <function reconcile_chunk at 0x7fcd1c563880> = r.reconcile_chunk
+
+tests/test_lifecycle_reconcile.py:126: AssertionError
+________________ test_job_discovery_run_skips_when_over_ceiling ________________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fcd1aa2c140>
+
+    def test_job_discovery_run_skips_when_over_ceiling(monkeypatch):
+        conn = _GuardConn()
+        monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
+        monkeypatch.setattr(job_discovery_run.db, "connect", lambda dsn=None: conn)
+        monkeypatch.setattr(job_discovery_run.db, "over_size_ceiling", lambda c: (True, 6500.0, 6000.0))
+        _forbid_poll_body(monkeypatch)
+        started = {"called": False}
+        monkeypatch.setattr(job_discovery_run.db, "start_run",
+                            lambda c: started.__setitem__("called", True) or 1)
+
+>       job_discovery_run.run()
+
+tests/test_size_guard.py:166:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+job_discovery/run.py:111: in run
+    source_enabled = read_control(conn).source_enabled
+                     ^^^^^^^^^^^^^^^^^^
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <tests.test_size_guard._GuardConn object at 0x7fcd1aa2ec90>
+
+    def read_control(conn) -> LifecycleControl:
+>       with conn.cursor(row_factory=dict_row) as cur:
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       TypeError: _GuardConn.cursor() got an unexpected keyword argument 'row_factory'
+
+job_discovery/lifecycle/config.py:31: TypeError
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery.lifecycle.maintenance:maintenance.py:408 pre-admission maintenance failed; additions blocked, verification permitted
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/maintenance.py", line 389, in pre_admission_maintenance
+    enter_gate(conn)
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/locks.py", line 8, in enter_gate
+    conn.execute("SHOW transaction_isolation").fetchone()["transaction_isolation"]
+    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^
+KeyError: 'transaction_isolation'
+WARNING  job_discovery:run.py:104 maintenance only: safety maintenance blocked admission; checking closures without ingestion or enrichment
+_______________ test_job_discovery_run_prunes_when_over_ceiling ________________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fcd1aa2ff50>
+
+    def test_job_discovery_run_prunes_when_over_ceiling(monkeypatch):
+        """prune_jobs must still run when the size guard short-circuits the poll.
+
+        Prune is the only mechanism that can shrink the DB; skipping it on the
+        over-ceiling path would stall recovery.
+        """
+        conn = _GuardConn()
+        monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
+        monkeypatch.setattr(job_discovery_run.db, "connect", lambda dsn=None: conn)
+        monkeypatch.setattr(job_discovery_run.db, "over_size_ceiling", lambda c: (True, 6500.0, 6000.0))
+        _forbid_poll_body(monkeypatch)
+        started = {"called": False}
+        monkeypatch.setattr(job_discovery_run.db, "start_run",
+                            lambda c: started.__setitem__("called", True) or 1)
+
+        prune_calls = {"n": 0}
+
+        def fake_prune(c):
+            prune_calls["n"] += 1
+
+        import job_discovery.prune as prune_module
+        monkeypatch.setattr(prune_module, "prune_jobs", fake_prune)
+
+>       job_discovery_run.run()
+
+tests/test_size_guard.py:200:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+job_discovery/run.py:111: in run
+    source_enabled = read_control(conn).source_enabled
+                     ^^^^^^^^^^^^^^^^^^
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <tests.test_size_guard._GuardConn object at 0x7fcd1aa2c500>
+
+    def read_control(conn) -> LifecycleControl:
+>       with conn.cursor(row_factory=dict_row) as cur:
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       TypeError: _GuardConn.cursor() got an unexpected keyword argument 'row_factory'
+
+job_discovery/lifecycle/config.py:31: TypeError
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery.lifecycle.maintenance:maintenance.py:408 pre-admission maintenance failed; additions blocked, verification permitted
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/maintenance.py", line 389, in pre_admission_maintenance
+    enter_gate(conn)
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/lifecycle/locks.py", line 8, in enter_gate
+    conn.execute("SHOW transaction_isolation").fetchone()["transaction_isolation"]
+    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^
+KeyError: 'transaction_isolation'
+WARNING  job_discovery:run.py:104 maintenance only: safety maintenance blocked admission; checking closures without ingestion or enrichment
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_reconcile.py::test_checkpoint_survives_fresh_connection_and_newer_positive_beats_old_absence
+FAILED tests/test_size_guard.py::test_job_discovery_run_skips_when_over_ceiling
+FAILED tests/test_size_guard.py::test_job_discovery_run_prunes_when_over_ceiling
+3 failed, 141 passed in 32.09s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/whitespace.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-evidence/whitespace.txt
new file mode 100644
index 0000000..e69de29
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-report.md
new file mode 100644
index 0000000..35f0676
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-6-report.md
@@ -0,0 +1,173 @@
+# Task 6 — full-corpus source reconciliation
+
+Author BASE: `ec588ac87f1dc0a3bbf685d9c8dfee0b79e1b409`. Fresh sole author;
+no author subagents or reviewer substitutions. Read the review-scope amendment,
+release authorization, Task 6 brief/dispatch and repository instructions before
+implementation. Task 5's accepted interfaces were used without replaying its
+history. The cached upstream reference is recorded in the evidence; no remote
+fetch, production access, provider crawl, paid/model call, deployment, activation,
+merge, push, infrastructure/IAM or unrelated Railway change occurred.
+
+## Implemented
+
+All six adapters return `SourceResult`. Its `complete` property is false until
+iterator exhaustion and remains false after errors, caps or unsafe pagination.
+The four single-response public listing endpoints retain their established
+response shape and request behavior; SmartRecruiters now streams pages instead
+of losing earlier positives when a final page fails. Workday and SmartRecruiters
+reject changed totals as absence evidence. Existing Workday partition/cap/wrap
+handling remains conservative. `fetch_details=False` is accepted across all six;
+Greenhouse/Workable request listing-only bodies, and Workday/SmartRecruiters do
+not fetch per-job details. Legacy consumers still iterate the same Posting API.
+Tests that indexed previous eager lists now explicitly materialize iterators.
+
+`lifecycle/reconcile.py` supplies the five requested interfaces, plus bounded
+posting staging and scheduled orchestration. It consumes the existing canonical
+source/claim/staging/checkpoint schema and reservation interfaces; no migration,
+SQL safety function, trigger, capacity guard, or RLS change was made. Every new
+source write uses the established reservation/binding/settlement protocol even
+before enforced cutover. Global gate and sorted Job locks precede Job mutation.
+Network work starts after commits; request hooks renew and commit before HTTP.
+
+Membership and positive sightings commit in at most 100-identity batches, keeping
+multiple listing/member/Job effects under the 500-row business-write ceiling.
+Staging retains the source ID and a small evidence-kind object (or an empty
+object for an unadmitted ID); raw descriptions, questions and unused detail
+payloads are not persisted. Existing Job IDs, private FK targets, first_seen,
+frozen discovery anchors and expiration dates are retained. Positive observations
+reopen the existing Job and clear misses. Unlisted means positive availability;
+missing is unknown. Explicit removed/expired observations affect only the exact
+validated source/listing identity.
+
+Only complete successful enumerations supply misses. Two distinct successful
+misses whose **completion timestamps** are at least 24 elapsed UTC hours apart
+can close a listing; replay does not add a miss or sighting. The enumeration start
+cutoff and listing membership/direct-verification sequence prevent older absence
+from defeating a later positive. Empty with more than 20 prior open mapped jobs
+is partial/suspicious, regardless of repeated emptiness. Failed/partial sources
+retain previously committed positives but supply no absence.
+
+Source attempts, complete-success timestamps, outcome, failure streak,
+suspicious-empty streak and next-due times are separate from user matching.
+Enabled boards are due after 24 hours. Failure-disabled retries back off through
+1, 2, 4, 7, 7 days; a successful verification clears the streak without changing
+exclusion state. Deliberate exclusions remain excluded. New legacy companies are
+registered in bounded slices; inactive companies with unknown disable reasons
+remain unknown rather than being guessed back into service.
+
+The ordinary one-shot `run()` now branches on the persisted source flag before
+legacy company ingestion, regardless of the capacity/admission outcome. The
+source-enabled branch verifies the registered corpus and registers up to 100
+new source accounts per cycle. It does not consult active matching users. It is
+metadata-only pending Task 7 lean admission. With the flag off, existing legacy
+cache admission, closure-above-guard, reviewer and pruning behavior remain on
+the tested existing path. Source/retirement/archive flags remain at their defaults;
+retirement stays dry-run. Supervisor/maintenance timings were not modified.
+
+## Cursor, recovery and caller inventory
+
+- `source_accounts.last_attempt_at`, complete-success time and deterministic ID
+  order choose due sources. A large interrupted board moves behind untouched
+  sources. Per-board budgets are 50 listing requests, 60 seconds of cooperative
+  work, and 10,000 identities; a poll cycle is bounded to 100 boards/300 seconds
+  of cooperative work. Inherited HTTP caveats below qualify wall-clock bounds.
+- `source_enumerations`: immutable source/sequence/owner/generation; running,
+  complete, partial and failed states; database start/completion/reconciliation
+  times. Each interrupted mutable feed starts a fresh sequence at page zero.
+  Old committed positives survive; partial pages are never concatenated into a
+  supposedly complete membership snapshot.
+- `enumeration_members`: exact external-ID primary key makes same-enumeration
+  staging/sighting replay idempotent. No lifetime per-poll observation log added.
+- `reconciliation_checkpoints`: lexicographic last external ID, committed count,
+  generation and completion marker advance in the same transaction as effects.
+  A fresh connection with the same current claim resumes committed reconciliation.
+  A cancelled/reassigned feed must start a fresh enumeration; existing replay
+  floors and Task 4 cleanup retain their established responsibilities.
+- `source_accounts.reconciliation_cursor` mirrors chunk progress; the completed
+  enumeration marker is written only after the last chunk. Partial/failed runs
+  receive an empty completed reconciliation checkpoint without absence effects.
+- Production call sites are `run()` -> `verify_due_sources()` -> adapter ->
+  staging/completion/reconciliation; legacy `run()` -> `spool_feed()`; and
+  `company_discovery.enrich.enrich_from_jd()`'s existing iterable consumer. The latter
+  received an additional focused compatibility run. No source HTTP was added
+  to the DB-only maintenance worker or reviewer supervisor.
+
+Finite fixture bound: one huge source plus five small sources across all six ATS
+families, repeatedly exhausting request **or** time budgets, gives every source
+one turn in six fresh invocations, repeated for two cycles. The read-only storage
+fallback rotates first position by database UTC day; for a fixed six-source due
+set and one allowed turn, all six get an attempt within six fixture days without
+changing source rows. A local test-only expression substitution exercises these
+days; no production clock override exists. Worker-interruption fixtures verify
+100 committed positives survive and the next worker starts at offset zero.
+
+## Verification and chronology
+
+Exact commands and server/tool versions are in `task-6-evidence/commands.txt`.
+Every DB run used the accepted harness, newly owned loopback random-port
+containers and the allowlisted test environment, never shared port 55432.
+All successful lanes below had **zero skips**. All HTTP was replaced by local
+fixture functions; no public-company or provider call was used.
+
+- RED: missing reconciliation module produced the expected collection failure.
+- First integration attempt: 78 passed/8 failed (fixture control activation
+  generation and eager-to-lazy test expectations). Next: 132 passed/5 failed
+  (remaining eager expectation and legacy connection doubles needing explicit
+  source-off control). Next: 141 passed/3 failed (a checkpoint fixture accidentally
+  triggered the >20 suspicious-empty rule plus two remaining control doubles).
+- Corrected expanded lane: **159 passed** on PostgreSQL 17.11. Later reservation
+  and time-budget-focused lane: **38 passed** on 17.11.
+- Broad affected adapter/source/run/maintenance/supervisor/spool/service-order/
+  question compatibility suite: **231 passed on PostgreSQL 17.11**, 134.78s;
+  **231 passed on PostgreSQL 16.15**, 167.87s.
+- Final ordinary refinements after the broad run: read-only exhausted request
+  budgets report partial rather than failed; 24-hour qualification is based on
+  successful completion time rather than enumeration start; added a read-only
+  daily-rotation fixture. Narrow final source/completeness rechecks are recorded
+  in `qualifying-completion-17.txt`: **43 passed on 17.11**, 67.68s;
+  and `qualifying-completion-16.txt`: **43 passed on 16.15**, 54.97s. These
+  final runs cover the current product source. The broad compatibility results
+  above precede these two narrow refinements; no broad rerun is implied.
+- Additional caller/rotation run: **36 passed on 17.11**, 4.33s.
+- Ruff and working/staged whitespace checks are recorded separately. No new
+  independent approval is inferred from any passing author test.
+
+## Explicit limitations and downstream handoff
+
+**Above-ceiling durable reconciliation is unresolved.** Existing
+`claim_work()` rejects a first claim without headroom; `reserve_capacity()`
+rejects forecasts above 6000 MiB; the existing enforced `lifecycle_validate_row`
+charges changed source_accounts/source_listings/source_enumerations/staging rows
+as growth even for operational counters/closure metadata. Task 6 does not weaken
+those contracts. A bounded read-only full-feed attempt still runs, logs truthful
+healthy/partial/failed plus storage-blocked/reconciliation-deferred, and never
+certifies absence or calls a healthy source failed because persistence failed.
+It cannot promise durable above-guard health/positive/closure progress, and new
+unregistered accounts also require storage. The controller explicitly accepted
+this as a functional/rollout limitation for later Task 10/13 integration review.
+The six-day fallback fairness proof applies to a fixed registered due corpus.
+
+**The shared HTTP transport contract is inherited, not repaired here.** The new
+context applies no retries, a request-count budget, cooperative elapsed checks,
+and a request timeout capped at 20 seconds. Existing `job_discovery.http` still
+follows redirects and does not establish the global redirect/address revalidation,
+10 MiB decompressed-byte, or strict whole-response wall-clock guarantees. Thus
+cooperative budget tests are not proof of those transport guarantees. The
+controller carried this explicit limitation to Task 9/13.
+
+**Intermediate activation remains unsuitable.** Source-enabled polling defers
+payload/admission growth until Task 7; existing cache growth stays on the legacy
+flag-off path. Unknown legacy exclusion reasons remain excluded pending explicit
+classification. Adapters with single-response endpoints have no fictional
+multi-page fixture; pagination/final-page/cap fixtures apply to the two paged
+families and single-response identity/malformed/empty fixtures to the other four.
+Ashby latest-publication/unlisted fixtures establish frozen age behavior, not a
+new source-publication history backfill.
+
+This is author implementation and ordinary functional evidence only. Independent
+source-correctness and requirements/quality review is pending controller action
+under amended Checkpoint B, followed by Library 06. Task 3 is **not fully
+security-approved**: independent expiry/capacity/cross-user/adversarial review
+gaps remain deliberately unreviewed. No refused probe was reconstructed or
+retried. No new safeguard rejection occurred. Controller owns final all-task
+release; this author stops after the Task 6 forward commit.
diff --git a/job_discovery/adapters/__init__.py b/job_discovery/adapters/__init__.py
index 9eba8c8..240e2bb 100644
--- a/job_discovery/adapters/__init__.py
+++ b/job_discovery/adapters/__init__.py
@@ -1,19 +1,19 @@
-from collections.abc import Callable, Iterable
+from collections.abc import Callable
 
 from job_discovery.adapters.ashby import fetch_ashby
 from job_discovery.adapters.greenhouse import fetch_greenhouse
 from job_discovery.adapters.lever import fetch_lever
 from job_discovery.adapters.smartrecruiters import fetch_smartrecruiters
 from job_discovery.adapters.workable import fetch_workable
 from job_discovery.adapters.workday import fetch_workday
-from job_discovery.models import Posting
+from job_discovery.adapters.completeness import SourceResult
 
-# Adapters return an Iterable (list or generator); run.py iterates with `for`.
-ADAPTERS: dict[str, Callable[[str], Iterable[Posting]]] = {
+# Every adapter exposes completeness only after exhaustion.
+ADAPTERS: dict[str, Callable[..., SourceResult]] = {
     "greenhouse": fetch_greenhouse,
     "lever": fetch_lever,
     "ashby": fetch_ashby,
     "workable": fetch_workable,
     "smartrecruiters": fetch_smartrecruiters,
     "workday": fetch_workday,
 }
diff --git a/job_discovery/adapters/ashby.py b/job_discovery/adapters/ashby.py
index e2d32e0..85d439d 100644
--- a/job_discovery/adapters/ashby.py
+++ b/job_discovery/adapters/ashby.py
@@ -1,12 +1,12 @@
-from job_discovery.adapters.completeness import validate_ids
-from job_discovery.http import get_json
+from job_discovery.adapters.completeness import SourceResult, SourceStatus, validate_ids
+from job_discovery.adapters.completeness import get_json
 from job_discovery.models import Posting
 from job_discovery.normalize import detect_remote
 
 
 def parse_ashby(data: dict) -> list[Posting]:
     postings: list[Posting] = []
     for j in data.get("jobs", []):
         loc = j.get("location")
         postings.append(
             Posting(
@@ -15,17 +15,17 @@ def parse_ashby(data: dict) -> list[Posting]:
                 url=j.get("jobUrl") or j.get("applyUrl"),
                 location=loc,
                 department=j.get("department"),
                 remote=detect_remote(loc, j.get("isRemote")),
                 raw=j,
             )
         )
     return postings
 
 
-def fetch_ashby(token: str) -> list[Posting]:
+def fetch_ashby(token: str, *, fetch_details: bool = True) -> SourceResult:
     url = f"https://api.ashbyhq.com/posting-api/job-board/{token}"
     data = get_json(url)
     if not isinstance(data, dict) or not isinstance(data.get("jobs"), list):
         raise ValueError("ashby response missing 'jobs' key")
     validate_ids(data["jobs"], "id")
-    return parse_ashby(data)
+    return SourceResult(iter(parse_ashby(data)), SourceStatus(fetch_details=fetch_details))
diff --git a/job_discovery/adapters/completeness.py b/job_discovery/adapters/completeness.py
index c5c5a98..a032de1 100644
--- a/job_discovery/adapters/completeness.py
+++ b/job_discovery/adapters/completeness.py
@@ -1,41 +1,92 @@
 """Explicit completeness for sources that can return a bounded partial crawl."""
 from collections.abc import Iterator
 from dataclasses import dataclass
+from contextlib import contextmanager
+from contextvars import ContextVar
+from time import monotonic
 
 from job_discovery.models import Posting
 
 
 @dataclass
 class SourceStatus:
     complete: bool = True
     fetch_details: bool = True
+    failed: bool = False
 
 
 class SourceResult(Iterator[Posting]):
     """Keep lazy ingestion while exposing completeness only after exhaustion."""
 
     def __init__(self, postings: Iterator[Posting], status: SourceStatus):
         self.postings = postings
         self.status = status
         self.exhausted = False
 
     @property
     def complete(self) -> bool:
         return self.exhausted and self.status.complete
 
     def __next__(self) -> Posting:
         try:
+            budget = _budget.get()
+            if budget is not None and monotonic() >= budget[0]:
+                raise SourceBudgetExceeded('source time budget exhausted; incomplete')
             return next(self.postings)
         except StopIteration:
             self.exhausted = True
             raise
+        except Exception:
+            self.status.complete = False
+            self.status.failed = True
+            raise
 
 
 def validate_ids(items: list, key: str) -> None:
     """An unreadable or duplicate source ID makes absence unsafe to interpret."""
     ids = set()
     for item in items:
         value = item.get(key) if isinstance(item, dict) else None
         if value is None or str(value).strip() == "" or str(value) in ids:
             raise ValueError(f"source listing has missing or duplicate {key}")
         ids.add(str(value))
+
+
+# A board budget is scoped to this worker context; ordinary legacy calls retain
+# their retry policy. Checks run before every page, including pages with no new
+# identities (duplicate/facet walks cannot escape the request ceiling).
+class SourceBudgetExceeded(ValueError):
+    pass
+
+
+_budget = ContextVar('source_budget', default=None)
+
+
+@contextmanager
+def source_budget(seconds, requests, pulse=None):
+    token = _budget.set([monotonic()+seconds,requests,pulse])
+    try:
+        yield
+    finally:
+        _budget.reset(token)
+
+
+def _request(method, url, **kwargs):
+    from job_discovery import http
+    budget = _budget.get()
+    if budget is not None:
+        if budget[1] <= 0 or monotonic() >= budget[0]:
+            raise SourceBudgetExceeded('source request/time budget exhausted; incomplete')
+        budget[1] -= 1
+        if budget[2]:
+            budget[2]()
+        kwargs.update(retries=0,timeout=min(20,max(0.001,budget[0]-monotonic())))
+    return getattr(http, method)(url, **kwargs)
+
+
+def get_json(url, **kwargs):
+    return _request('get_json',url,**kwargs)
+
+
+def post_json(url, **kwargs):
+    return _request('post_json',url,**kwargs)
diff --git a/job_discovery/adapters/greenhouse.py b/job_discovery/adapters/greenhouse.py
index 509f9ed..404278e 100644
--- a/job_discovery/adapters/greenhouse.py
+++ b/job_discovery/adapters/greenhouse.py
@@ -1,12 +1,12 @@
-from job_discovery.adapters.completeness import validate_ids
-from job_discovery.http import get_json
+from job_discovery.adapters.completeness import SourceResult, SourceStatus, validate_ids
+from job_discovery.adapters.completeness import get_json
 from job_discovery.models import Posting
 from job_discovery.normalize import detect_remote
 
 
 def parse_greenhouse(data: dict) -> list[Posting]:
     postings: list[Posting] = []
     for j in data.get("jobs") or []:
         loc = (j.get("location") or {}).get("name")
         depts = j.get("departments") or []
         dept = depts[0].get("name") if depts else None
@@ -17,30 +17,30 @@ def parse_greenhouse(data: dict) -> list[Posting]:
                 url=j["absolute_url"],
                 location=loc,
                 department=dept,
                 remote=detect_remote(loc, None),
                 raw=j,
             )
         )
     return postings
 
 
-def fetch_greenhouse(token: str) -> list[Posting]:
-    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"
+def fetch_greenhouse(token: str, *, fetch_details: bool = True) -> SourceResult:
+    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content={str(fetch_details).lower()}"
     data = get_json(url)
     if not isinstance(data, dict) or not isinstance(data.get("jobs"), list):
         raise ValueError("greenhouse response missing 'jobs' key")
     validate_ids(data["jobs"], "id")
     total = (data.get("meta") or {}).get("total")
     if isinstance(total, int) and total != len(data["jobs"]):
         raise ValueError("greenhouse incomplete listing below reported total")
-    return parse_greenhouse(data)
+    return SourceResult(iter(parse_greenhouse(data)), SourceStatus(fetch_details=fetch_details))
 
 
 def _as_string(v) -> str:
     if isinstance(v, str):
         return v
     if isinstance(v, bool) or isinstance(v, (int, float)):
         return str(v)
     return ""
 
 
diff --git a/job_discovery/adapters/lever.py b/job_discovery/adapters/lever.py
index 1c1ae5f..e2f2704 100644
--- a/job_discovery/adapters/lever.py
+++ b/job_discovery/adapters/lever.py
@@ -1,12 +1,12 @@
-from job_discovery.adapters.completeness import validate_ids
-from job_discovery.http import get_json
+from job_discovery.adapters.completeness import SourceResult, SourceStatus, validate_ids
+from job_discovery.adapters.completeness import get_json
 from job_discovery.models import Posting
 from job_discovery.normalize import detect_remote
 
 
 def _explicit_remote(workplace_type: str | None) -> bool | None:
     if workplace_type == "remote":
         return True
     if workplace_type in ("on-site", "hybrid"):
         return False
     return None
@@ -24,17 +24,17 @@ def parse_lever(data: list) -> list[Posting]:
                 url=j["hostedUrl"],
                 location=loc,
                 department=cats.get("team") or cats.get("department"),
                 remote=detect_remote(loc, _explicit_remote(j.get("workplaceType"))),
                 raw=j,
             )
         )
     return postings
 
 
-def fetch_lever(token: str) -> list[Posting]:
+def fetch_lever(token: str, *, fetch_details: bool = True) -> SourceResult:
     url = f"https://api.lever.co/v0/postings/{token}?mode=json"
     data = get_json(url)
     if not isinstance(data, list):
         raise ValueError(f"lever response expected a list, got {type(data).__name__}")
     validate_ids(data, "id")
-    return parse_lever(data)
+    return SourceResult(iter(parse_lever(data)), SourceStatus(fetch_details=fetch_details))
diff --git a/job_discovery/adapters/smartrecruiters.py b/job_discovery/adapters/smartrecruiters.py
index 5e9323d..94716c0 100644
--- a/job_discovery/adapters/smartrecruiters.py
+++ b/job_discovery/adapters/smartrecruiters.py
@@ -1,13 +1,13 @@
 import logging
 
-from job_discovery.http import get_json
+from job_discovery.adapters.completeness import SourceResult, SourceStatus, get_json
 from job_discovery.models import Posting
 from job_discovery.normalize import detect_remote
 
 log = logging.getLogger("job_discovery")
 
 # Postings are paged with offset/limit against `totalFound`; 100 is the API max.
 # The full JD lives on the per-posting detail endpoint, not the listing.
 _PAGE_LIMIT = 100
 
 
@@ -78,58 +78,69 @@ def _minimal_posting(token: str, item: dict) -> Posting | None:
     if not pid:
         return None
     return Posting(
         external_id=str(pid),
         title=item.get("name"),
         url=f"https://jobs.smartrecruiters.com/{token}/{pid}",
         raw=item,
     )
 
 
-def fetch_smartrecruiters(token: str, *, fetch_details: bool = True) -> list[Posting]:
+def fetch_smartrecruiters(token: str, *, fetch_details: bool = True) -> SourceResult:
+    status = SourceStatus(fetch_details=fetch_details)
+    return SourceResult(_fetch_smartrecruiters(token, status),status)
+
+
+def _fetch_smartrecruiters(token, status):
+    fetch_details = status.fetch_details
     base = f"https://api.smartrecruiters.com/v1/companies/{token}/postings"
-    postings: list[Posting] = []
     offset = 0
     seen = set()
     expected_total = 0
+    previous_total = None
     while True:
         page = get_json(f"{base}?limit={_PAGE_LIMIT}&offset={offset}")
         if not isinstance(page, dict) or not isinstance(page.get("content"), list):
             raise ValueError("smartrecruiters response missing 'content' key")
         content = page.get("content") or []
+        if any(not isinstance(item,dict) for item in content):
+            raise ValueError('invalid listing item')
         total = page.get("totalFound")
+        if previous_total is not None and isinstance(total,int) and total != previous_total:
+            status.complete = False
+        if isinstance(total,int):
+            previous_total = total
         if isinstance(total, int) and total > 0:
             expected_total = max(expected_total, total)
         for item in content:
             pid = item.get("id")
             if not pid or pid in seen:
                 raise ValueError("smartrecruiters incomplete listing: missing or repeated id")
             seen.add(pid)
             if not fetch_details:
-                postings.append(_minimal_posting(token, item))
+                yield _minimal_posting(token, item)
                 continue
             try:
                 # Both the fetch and the parse live inside the try: a malformed
                 # HTTP-200 detail body must not abort the whole company fetch.
                 detail = get_json(f"{base}/{pid}")
                 posting = parse_smartrecruiters_posting(detail)
             except Exception as exc:  # detail unavailable/unparseable: keep, don't drop
                 log.warning(
                     "smartrecruiters: detail unavailable for %s/%s; keeping minimal posting: %s: %s",
                     token, pid, type(exc).__name__, exc,
                 )
                 posting = _minimal_posting(token, item)
             if posting is not None:
-                postings.append(posting)
+                yield posting
         # Page while a FULL page comes back and stop on a short/empty one. The
         # `totalFound` count is only an *additional* stop signal when it is a
         # positive number — a missing/null/zero total must NOT end paging, which
         # previously truncated after page 1 and triggered false closures.
         offset += _PAGE_LIMIT
         total = page.get("totalFound")
         full_page = len(content) == _PAGE_LIMIT
         reached_total = isinstance(total, int) and total > 0 and offset >= total
         if not full_page or reached_total:
             if len(seen) < expected_total:
                 raise ValueError("smartrecruiters incomplete listing below reported total")
             break
-    return postings
diff --git a/job_discovery/adapters/workable.py b/job_discovery/adapters/workable.py
index ddbacd2..ffb8c12 100644
--- a/job_discovery/adapters/workable.py
+++ b/job_discovery/adapters/workable.py
@@ -1,14 +1,14 @@
-from job_discovery.adapters.completeness import validate_ids
+from job_discovery.adapters.completeness import SourceResult, SourceStatus, validate_ids
 import logging
 
-from job_discovery.http import get_json
+from job_discovery.adapters.completeness import get_json
 from job_discovery.models import Posting
 from job_discovery.normalize import detect_remote
 
 log = logging.getLogger("job_discovery")
 
 # Workable's PUBLIC, no-auth widget endpoint returns the FULL published job list
 # for an account in a SINGLE GET, with the full HTML job description inline
 # (the widget merges description + requirements + benefits into one `description`
 # field). There is no pagination and no per-job detail call — `?details=true`
 # returns everything:
@@ -79,33 +79,33 @@ def _minimal_posting(account: str, job: dict) -> Posting | None:
     if not shortcode:
         return None
     return Posting(
         external_id=str(shortcode),
         title=job.get("title"),
         url=f"https://apply.workable.com/{account}/j/{shortcode}/",
         raw=job,
     )
 
 
-def fetch_workable(token: str) -> list[Posting]:
+def fetch_workable(token: str, *, fetch_details: bool = True) -> SourceResult:
     # ONE no-auth GET returns every published job with its full description
     # inline. Parse each entry inside a try/except so a single malformed job
     # entry yields a minimal posting instead of being dropped or crashing the
     # whole company fetch (a dropped job would let run.py's close-detection
     # falsely close a still-open posting).
-    payload = get_json(_WIDGET_URL.format(account=token))
+    payload = get_json(_WIDGET_URL.format(account=token).replace("details=true", f"details={str(fetch_details).lower()}"))
     if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list):
         raise ValueError("workable response missing 'jobs' key")
     validate_ids(payload["jobs"], "shortcode")
     postings: list[Posting] = []
     for job in payload.get("jobs") or []:
         try:
             posting = parse_workable_job(job, token)
         except Exception as exc:  # malformed entry: keep a minimal posting, don't drop
             log.warning(
                 "workable: malformed job entry for %s/%s; keeping minimal posting: %s: %s",
                 token, job.get("shortcode"), type(exc).__name__, exc,
             )
             posting = _minimal_posting(token, job)
         if posting is not None:
             postings.append(posting)
-    return postings
+    return SourceResult(iter(postings), SourceStatus(fetch_details=fetch_details))
diff --git a/job_discovery/adapters/workday.py b/job_discovery/adapters/workday.py
index da24e47..1e37d9b 100644
--- a/job_discovery/adapters/workday.py
+++ b/job_discovery/adapters/workday.py
@@ -1,15 +1,15 @@
 from job_discovery.adapters.completeness import SourceResult, SourceStatus
 import logging
 from collections.abc import Iterator
 
-from job_discovery.http import get_json, post_json
+from job_discovery.adapters.completeness import get_json, post_json
 from job_discovery.models import Posting
 from job_discovery.normalize import detect_remote
 
 log = logging.getLogger("job_discovery")
 
 # Workday's cxs `/jobs` is a POST search paged with offset/limit; 20 is the page
 # size the public career-site UI uses AND the hard ceiling — a `limit` above 20
 # returns HTTP 400, so this is fixed, not just a default.
 _PAGE_LIMIT = 20
 
@@ -299,20 +299,22 @@ def _page_walk(
     offset = 0
     expected = first_page.get("total") or 0
     received = 0
     query_ids = set()
     first_path: str | None = None
     while True:
         if not isinstance(page, dict) or not isinstance(page.get("jobPostings"), list):
             raise ValueError("workday response missing 'jobPostings' list")
         page_total = page.get("total")
         if isinstance(page_total, int):
+            if page_total != expected:
+                status.complete = False
             expected = max(expected, page_total)
         items = page["jobPostings"]
         if not items:
             if received < expected:
                 status.complete = False
             break  # genuinely empty page -> end of results
         # Wrap guard: past the 2000 hard cap Workday wraps back to page 1 rather
         # than returning empty, so if a later page repeats page 1's first posting
         # we've wrapped — stop BEFORE re-ingesting duplicates.
         this_first = items[0].get("externalPath")
@@ -377,24 +379,28 @@ def _crawl(
         yield from _yield_items(first.get("jobPostings") or [], seen,
                                 cxs=cxs, host=host, site=site, status=status)
         expected = total
         offset = _PAGE_LIMIT
         while offset < total:
             page = _post_jobs(cxs, applied_facets, offset)
             if not isinstance(page, dict) or not isinstance(page.get("jobPostings"), list):
                 raise ValueError("workday response missing 'jobPostings' key")
             page_total = page.get("total")
             if isinstance(page_total, int):
+                if page_total != expected:
+                    status.complete = False
                 expected = max(expected, page_total)
             items = page.get("jobPostings") or []
             if not items:
                 break
+            if any(i.get("externalPath") in partition_ids for i in items):
+                status.complete = False
             partition_ids.update(i.get("externalPath") for i in items)
             yield from _yield_items(items, seen, cxs=cxs, host=host, site=site, status=status)
             offset += _PAGE_LIMIT
         if len(partition_ids - {None}) < expected:
             status.complete = False
         return
 
     subdivider = (
         _choose_subdivider(first.get("facets"), set(applied_facets))
         if depth < _MAX_FACET_DEPTH
diff --git a/job_discovery/db.py b/job_discovery/db.py
index 3a9f55e..7ec322e 100644
--- a/job_discovery/db.py
+++ b/job_discovery/db.py
@@ -272,10 +272,43 @@ def greenhouse_jobs_missing_questions(conn, company_id: int, *, limit: int | Non
             """
             SELECT j.external_id
             FROM jobs j
             LEFT JOIN job_questions q ON q.job_id = j.id
             WHERE j.company_id = %s AND j.closed_at IS NULL AND q.job_id IS NULL
             ORDER BY j.external_id LIMIT %s
             """,
             (company_id, limit),
         )
         return [r["external_id"] for r in cur.fetchall()]
+
+
+def sync_source_accounts(conn, limit: int = 100) -> int:
+    """Register a bounded slice of the whole company corpus for verification.
+
+    Existing source exclusions are authoritative. An inactive legacy company
+    whose reason is unknown remains unknown; only the recorded failure threshold
+    supplies failure-disabled provenance. No user preferences participate.
+    Caller commits before enumeration/network work.
+    """
+    from job_discovery.lifecycle.claims import claim_work
+    from job_discovery.lifecycle.config import read_control
+    from job_discovery.lifecycle.reconcile import _write, StorageBlocked
+    if type(limit) is not int or not 1 <= limit <= 500:
+        raise ValueError('source registration limit must be 1..500')
+    enter_gate(conn)
+    if not read_control(conn).source_enabled:
+        return 0
+    companies = conn.execute("""SELECT c.* FROM companies c WHERE NOT EXISTS
+        (SELECT FROM source_accounts s WHERE s.ats=c.ats AND s.public_board_ref=c.token)
+        ORDER BY c.id LIMIT %s""", (limit,)).fetchall()
+    if not companies:
+        return 0
+    claim = claim_work(conn,'source_catalog','singleton',180)
+    if claim is None:
+        raise StorageBlocked('source catalog registration deferred')
+    for co in companies:
+        exclusion = 'enabled' if co['active'] else ('failure_disabled' if co['poll_failures']>=POLL_FAILURE_DEACTIVATE else 'unknown')
+        with _write(conn,claim,'source_accounts'):
+            conn.execute("""INSERT INTO source_accounts(legacy_company_id,ats,public_board_ref,legacy_active,exclusion_state,failure_streak)
+                VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(ats,public_board_ref) DO NOTHING""",
+                (co['id'],co['ats'],co['token'],co['active'],exclusion,co['poll_failures']))
+    return len(companies)
diff --git a/job_discovery/lifecycle/reconcile.py b/job_discovery/lifecycle/reconcile.py
new file mode 100644
index 0000000..5af0b6e
--- /dev/null
+++ b/job_discovery/lifecycle/reconcile.py
@@ -0,0 +1,371 @@
+"""Full-corpus, bounded source evidence. Callers own short transactions.
+
+Enumeration pagination never resumes from an offset: interruptions retain positive
+receipts, then a fresh sequence starts at page zero. Only complete membership may
+supply absence. Public payload admission remains a separate caller responsibility.
+"""
+from contextlib import contextmanager
+from dataclasses import replace
+from datetime import datetime
+import logging
+from time import monotonic
+from uuid import UUID
+
+from psycopg.types.json import Jsonb
+
+from job_discovery.adapters.completeness import SourceStatus, SourceBudgetExceeded
+from .capacity import reserve_capacity, bind_reservation, settle_capacity
+from .claims import claim_work, validate_claim, renew_claim, cancel_claim
+from .config import read_control
+from .locks import enter_gate, lock_jobs
+from .types import ClaimRef, EnumerationRef, Observation
+
+log = logging.getLogger(__name__)
+CHUNK = 100  # Multiple row effects per identity stay below 500 per transaction.
+BOARD_SECONDS = 60
+BOARD_REQUESTS = 50
+BOARD_ROWS = 10000
+
+
+class StorageBlocked(RuntimeError):
+    pass
+
+
+@contextmanager
+def _write(conn, claim, scope, job_id=None, size=32768):
+    """Use the established reservation contract; never bypass enforced charging."""
+    reservation = reserve_capacity(conn, claim, size)
+    if reservation is None:
+        raise StorageBlocked('source evidence storage blocked; reconciliation deferred')
+    bind_reservation(conn, reservation, job_id=job_id, scope=scope)
+    yield
+    settle_capacity(conn, reservation)
+
+
+def claim_due_source(conn) -> tuple[dict, ClaimRef] | None:
+    enter_gate(conn)
+    if not read_control(conn).source_enabled:
+        return None
+    # Last-attempt ordering is essential: an interrupted huge board goes behind
+    # untouched small boards even if neither has ever completed successfully.
+    source = conn.execute("""SELECT s.* FROM source_accounts s
+        WHERE exclusion_state IN ('enabled','failure_disabled')
+          AND (next_due_at IS NULL OR next_due_at<=clock_timestamp())
+          AND NOT EXISTS (SELECT FROM lifecycle_claims c WHERE c.kind='source'
+            AND c.work_id=s.id::text AND c.state='active' AND c.lease_until>clock_timestamp())
+        ORDER BY last_attempt_at NULLS FIRST,last_complete_success_at NULLS FIRST,id
+        LIMIT 1""").fetchone()
+    if not source:
+        return None
+    claim = claim_work(conn, 'source', str(source['id']), 180)
+    if claim is None:
+        raise StorageBlocked('source claim storage blocked; reconciliation deferred')
+    with _write(conn, claim, 'source_accounts'):
+        conn.execute("""UPDATE source_accounts SET last_attempt_at=clock_timestamp(),
+            last_outcome='attempting',claim_owner_token=%s,claim_generation=%s,
+            lease_until=%s WHERE id=%s""", (claim.owner_token,claim.generation,claim.lease_until,source['id']))
+    return source, claim
+
+
+def _check(conn, enum):
+    validate_claim(conn, enum.claim)
+    row = conn.execute("""SELECT e.* FROM source_enumerations e JOIN source_accounts s ON s.id=e.source_id
+      WHERE e.id=%s AND e.source_id=%s AND e.sequence=%s AND e.sequence>s.replay_floor
+       AND e.owner_token=%s AND e.generation=%s FOR UPDATE OF e""",
+      (enum.id,enum.source_id,enum.sequence,enum.claim.owner_token,enum.claim.generation)).fetchone()
+    if row is None:
+        raise RuntimeError('stale or fenced source enumeration')
+    return row
+
+
+def begin_enumeration(conn, source_id: UUID, claim: ClaimRef) -> EnumerationRef:
+    validate_claim(conn, claim)
+    if not conn.execute("SELECT 1 FROM lifecycle_claims WHERE kind='source' AND work_id=%s AND owner_token=%s AND generation=%s", (str(source_id),claim.owner_token,claim.generation)).fetchone():
+        raise RuntimeError('source claim mismatch')
+    with _write(conn, claim, 'source_accounts'):
+        row = conn.execute("""UPDATE source_accounts SET enumeration_sequence=enumeration_sequence+1
+            WHERE id=%s RETURNING enumeration_sequence""", (source_id,)).fetchone()
+    with _write(conn, claim, 'source_enumerations'):
+        enum = conn.execute("""INSERT INTO source_enumerations(source_id,sequence,owner_token,generation,status)
+            VALUES(%s,%s,%s,%s,'running') RETURNING id""",
+            (source_id,row['enumeration_sequence'],claim.owner_token,claim.generation)).fetchone()
+    return EnumerationRef(enum['id'],source_id,row['enumeration_sequence'],claim)
+
+
+def _positive(conn, enum, listing, kind, observed_at):
+    if kind not in {'seen','unlisted','removed','expired'}:
+        return  # Missing URLs or failed direct checks are unknown, never closure.
+    if enum.sequence < max(listing['last_membership_sequence'],listing['last_direct_verification_sequence']):
+        return
+    if listing['successful_last_observed_at'] and observed_at < listing['successful_last_observed_at']:
+        return
+    removed = kind in {'removed','expired'}
+    with _write(conn, enum.claim, 'source_listings', listing['job_id']):
+        conn.execute("""UPDATE source_listings SET successful_last_observed_at=%s,
+           successful_sighting_count=successful_sighting_count+%s,
+           last_membership_sequence=GREATEST(last_membership_sequence,%s),
+           last_direct_verification_sequence=CASE WHEN %s THEN %s ELSE last_direct_verification_sequence END,
+           source_availability=%s,consecutive_complete_misses=0,first_complete_miss_at=NULL
+           WHERE id=%s""", (observed_at,0 if removed else 1,enum.sequence,removed,enum.sequence,
+                           'closed' if removed else 'open',listing['id']))
+    with _write(conn, enum.claim, 'jobs', listing['job_id']):
+        conn.execute("UPDATE jobs SET closed_at=CASE WHEN %s THEN COALESCE(closed_at,%s) ELSE NULL END WHERE id=%s",
+                     (removed,observed_at,listing['job_id']))
+
+
+def commit_sightings(conn, enumeration: EnumerationRef, observations: list[Observation]) -> None:
+    if len(observations) > CHUNK:
+        raise ValueError(f'sighting chunk exceeds {CHUNK}')
+    enter_gate(conn)
+    listings = conn.execute("""SELECT * FROM source_listings WHERE source_account_id=%s
+        AND id=ANY(%s)""", (enumeration.source_id,[o.listing_id for o in observations])).fetchall()
+    lock_jobs(conn, [r['job_id'] for r in listings])
+    e = _check(conn, enumeration)
+    if e['status'] != 'running':
+        raise RuntimeError('enumeration is not running')
+    by_id = {r['id']:r for r in listings}
+    for o in observations:
+        if not isinstance(o.observed_at,datetime) or o.observed_at.tzinfo is None:
+            raise ValueError('observation requires aware database timestamp')
+        listing = by_id.get(o.listing_id)
+        if listing is None or listing['external_id'] != o.id:
+            raise ValueError('observation must match exact source listing')
+        if o.kind not in {'seen','unlisted','removed','expired'}:
+            continue
+        with _write(conn, enumeration.claim, 'enumeration_members'):
+            inserted = conn.execute("""INSERT INTO enumeration_members(enumeration_id,external_id,public_metadata)
+                VALUES(%s,%s,%s) ON CONFLICT DO NOTHING RETURNING external_id""",
+                (enumeration.id,o.id,Jsonb({'kind':o.kind}))).fetchone()
+        if inserted:
+            _positive(conn, enumeration, listing, o.kind, o.observed_at)
+
+
+def stage_postings(conn, enum, postings):
+    """Retain IDs and tiny evidence only; no unused detail/raw payload persistence."""
+    if len(postings) > CHUNK:
+        raise ValueError('posting checkpoint too large')
+    ids = [p.external_id for p in postings]
+    enter_gate(conn)
+    listings = conn.execute('SELECT * FROM source_listings WHERE source_account_id=%s AND external_id=ANY(%s)', (enum.source_id,ids)).fetchall()
+    by_id = {row['external_id']:row for row in listings}
+    now = conn.execute('SELECT clock_timestamp() t').fetchone()['t']
+    observations = [Observation(p.external_id,by_id[p.external_id]['id'],
+                     'unlisted' if (p.raw or {}).get('isListed') is False else 'seen',now)
+                    for p in postings if p.external_id in by_id]
+    commit_sightings(conn,enum,observations)
+    # Unknown IDs participate in exact membership, but Task 7 owns lean admission.
+    for external_id in ids:
+        if len(external_id.encode()) > 2048:
+            raise ValueError('source identity exceeds bounded staging limit')
+        if external_id not in by_id:
+            with _write(conn,enum.claim,'enumeration_members'):
+                conn.execute("INSERT INTO enumeration_members VALUES(%s,%s,'{}') ON CONFLICT DO NOTHING", (enum.id,external_id))
+
+
+def complete_enumeration(conn, enumeration: EnumerationRef, verdict: SourceStatus) -> None:
+    e = _check(conn,enumeration)
+    if e['status'] in {'complete','partial','failed'}:
+        return
+    if e['status'] != 'running':
+        raise RuntimeError('enumeration is not running')
+    empty = not conn.execute('SELECT 1 FROM enumeration_members WHERE enumeration_id=%s LIMIT 1', (enumeration.id,)).fetchone()
+    prior_open = conn.execute("""SELECT count(*) n FROM source_listings l JOIN jobs j ON j.id=l.job_id
+       WHERE l.source_account_id=%s AND j.closed_at IS NULL""", (enumeration.source_id,)).fetchone()['n']
+    suspicious = empty and prior_open > 20
+    status = 'complete' if verdict.complete and not suspicious else ('failed' if verdict.failed else 'partial')
+    outcome = 'suspicious_empty' if suspicious else status
+    with _write(conn,enumeration.claim,'source_enumerations'):
+        conn.execute('UPDATE source_enumerations SET status=%s,completed_at=clock_timestamp(),terminal_at=clock_timestamp() WHERE id=%s', (status,enumeration.id))
+    with _write(conn,enumeration.claim,'source_accounts'):
+        conn.execute("""UPDATE source_accounts SET last_outcome=%s,
+          last_complete_success_at=CASE WHEN %s='complete' THEN clock_timestamp() ELSE last_complete_success_at END,
+          failure_streak=CASE WHEN %s='complete' THEN 0 ELSE failure_streak+1 END,
+          suspicious_empty_streak=CASE WHEN %s THEN suspicious_empty_streak+1 ELSE 0 END,
+          next_due_at=clock_timestamp()+interval '24 hours' *
+             CASE WHEN exclusion_state='failure_disabled' AND %s<>'complete'
+                  THEN LEAST(7,power(2,LEAST(failure_streak,3))) ELSE 1 END
+          WHERE id=%s""", (outcome,status,status,suspicious,status,enumeration.source_id))
+
+
+def reconcile_chunk(conn, enumeration: EnumerationRef, limit: int = 500) -> bool:
+    if type(limit) is not int or not 1 <= limit <= 500:
+        raise ValueError('reconciliation limit must be 1..500')
+    enter_gate(conn)
+    e = conn.execute('SELECT * FROM source_enumerations WHERE id=%s',(enumeration.id,)).fetchone()
+    if e is None:
+        raise RuntimeError('stale or fenced source enumeration')
+    if e['status'] not in {'complete','partial','failed'}:
+        raise RuntimeError('cannot reconcile unfinished enumeration')
+    checkpoint = conn.execute('SELECT * FROM reconciliation_checkpoints WHERE enumeration_id=%s', (enumeration.id,)).fetchone()
+    if checkpoint and checkpoint['completed_at']:
+        _check(conn,enumeration)
+        return True
+    cursor = checkpoint['last_external_id'] if checkpoint else None
+    rows = []
+    if e['status'] == 'complete':
+        rows = conn.execute("""SELECT l.* FROM source_listings l WHERE source_account_id=%s
+            AND (%s::text IS NULL OR external_id>%s) ORDER BY external_id LIMIT %s""",
+            (enumeration.source_id,cursor,cursor,min(limit,CHUNK))).fetchall()
+    lock_jobs(conn,[r['job_id'] for r in rows])
+    e = _check(conn,enumeration)
+    for row in rows:
+        if (row['last_membership_sequence'] >= enumeration.sequence
+            or row['last_direct_verification_sequence'] >= enumeration.sequence
+            or row['last_complete_miss_sequence'] >= enumeration.sequence
+            or (row['successful_last_observed_at'] and row['successful_last_observed_at'] >= e['started_at'])):
+            continue
+        if conn.execute('SELECT 1 FROM enumeration_members WHERE enumeration_id=%s AND external_id=%s', (enumeration.id,row['external_id'])).fetchone():
+            continue
+        with _write(conn,enumeration.claim,'source_listings',row['job_id']):
+            conn.execute("""UPDATE source_listings SET
+               consecutive_complete_misses=LEAST(2,consecutive_complete_misses+1),
+               first_complete_miss_at=COALESCE(first_complete_miss_at,%s),
+               last_complete_miss_sequence=%s,last_miss_enumeration_id=%s,
+               source_availability=CASE WHEN first_complete_miss_at IS NOT NULL
+                 AND %s>=first_complete_miss_at+interval '24 hours' THEN 'closed' ELSE source_availability END
+               WHERE id=%s""", (e['completed_at'],enumeration.sequence,enumeration.id,e['completed_at'],row['id']))
+        with _write(conn,enumeration.claim,'jobs',row['job_id']):
+            conn.execute("""UPDATE jobs SET closed_at=COALESCE(closed_at,%s) WHERE id=%s
+                AND EXISTS(SELECT FROM source_listings WHERE id=%s AND source_availability='closed')""", (e['completed_at'],row['job_id'],row['id']))
+    cursor = rows[-1]['external_id'] if rows else cursor
+    done = len(rows) < min(limit,CHUNK)
+    with _write(conn,enumeration.claim,'reconciliation_checkpoints'):
+        conn.execute("""INSERT INTO reconciliation_checkpoints(enumeration_id,generation,last_external_id,reconciled_count,completed_at)
+            VALUES(%s,%s,%s,%s,CASE WHEN %s THEN clock_timestamp() END)
+            ON CONFLICT(enumeration_id) DO UPDATE SET last_external_id=EXCLUDED.last_external_id,
+            reconciled_count=reconciliation_checkpoints.reconciled_count+EXCLUDED.reconciled_count,
+            completed_at=EXCLUDED.completed_at""", (enumeration.id,enumeration.claim.generation,cursor,len(rows),done))
+    with _write(conn,enumeration.claim,'source_accounts'):
+        conn.execute('UPDATE source_accounts SET reconciliation_cursor=%s WHERE id=%s', (cursor,enumeration.source_id))
+    if done:
+        with _write(conn,enumeration.claim,'source_enumerations'):
+            conn.execute('UPDATE source_enumerations SET reconciled_at=clock_timestamp() WHERE id=%s', (enumeration.id,))
+    return done
+
+
+def verify_due_sources(conn, *, max_boards=100, seconds=300):
+    """Scheduled verification precedes admission and ignores all user matching."""
+    from job_discovery.adapters import ADAPTERS
+    from job_discovery.adapters.completeness import source_budget
+    result = {'ok':0,'failed':0,'new_jobs':0,'closed_jobs':0}
+    deadline = monotonic()+seconds
+    for _ in range(max_boards):
+        if monotonic() >= deadline:
+            break
+        try:
+            pair = claim_due_source(conn)
+            conn.commit()
+        except StorageBlocked:
+            conn.rollback()
+            verify_storage_blocked(conn, max_boards=max_boards, deadline=deadline)
+            break
+        if pair is None:
+            break
+        source, claim = pair
+        try:
+            enum = begin_enumeration(conn,source['id'],claim)
+            conn.commit()
+        except StorageBlocked:
+            conn.rollback()
+            cancel_claim(conn,claim)
+            conn.commit()
+            verify_storage_blocked(conn,max_boards=max_boards,deadline=deadline)
+            break
+        chunk = []
+        verdict = SourceStatus(complete=False)
+        renewed = monotonic()
+        try:
+            def pulse():
+                # No SQL transaction spans network, and each bounded request
+                # starts with a renewed lease (including empty duplicate pages).
+                renew_claim(conn,claim)
+                conn.commit()
+            with source_budget(min(BOARD_SECONDS,max(0,deadline-monotonic())),BOARD_REQUESTS,pulse):
+                postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
+                count = 0
+                for posting in postings:
+                    count += 1
+                    if count > BOARD_ROWS:
+                        break
+                    chunk.append(posting)
+                    if len(chunk) >= CHUNK or monotonic()-renewed >= 20:
+                        stage_postings(conn,enum,chunk)
+                        conn.commit()
+                        chunk = []
+                        claim = renew_claim(conn,claim)
+                        conn.commit()
+                        enum = replace(enum,claim=claim)
+                        renewed = monotonic()
+                verdict = SourceStatus(complete=postings.complete)
+        except StorageBlocked:
+            conn.rollback()
+            log.warning("source evidence storage blocked; reconciliation deferred")
+            cancel_claim(conn,claim)
+            conn.commit()
+            verify_storage_blocked(conn,max_boards=max_boards,deadline=deadline)
+            break
+        except SourceBudgetExceeded:
+            verdict = SourceStatus(complete=False)
+            conn.rollback()
+        except Exception:
+            log.exception('source enumeration failed or interrupted: %s',source['id'])
+            verdict = SourceStatus(complete=False,failed=True)
+            conn.rollback()
+        try:
+            if chunk:
+                stage_postings(conn,enum,chunk)
+                conn.commit()
+            complete_enumeration(conn,enum,verdict)
+            conn.commit()
+            while True:
+                done = reconcile_chunk(conn,enum)
+                conn.commit()
+                if done or monotonic() >= deadline:
+                    break
+                claim = renew_claim(conn,claim)
+                conn.commit()
+                enum = replace(enum,claim=claim)
+            status = conn.execute('SELECT status FROM source_enumerations WHERE id=%s',(enum.id,)).fetchone()['status']
+            result['ok' if status == 'complete' else 'failed'] += 1
+            conn.commit()
+        except StorageBlocked:
+            conn.rollback()
+            health = 'healthy' if verdict.complete else ('failed' if verdict.failed else 'partial')
+            log.warning('source %s %s-but-storage-blocked; reconciliation-deferred',source['id'],health)
+        finally:
+            conn.rollback()
+            cancel_claim(conn,claim)
+            conn.commit()
+    return result
+
+
+def verify_storage_blocked(conn, *, max_boards, deadline):
+    """Read-only fallback: healthy feeds are storage-deferred, never source-failed.
+
+    Existing enforced source metadata writes require physical reservations. Do
+    not weaken that contract: report health in logs until persistence can resume.
+    """
+    from job_discovery.adapters import ADAPTERS
+    from job_discovery.adapters.completeness import source_budget
+    sources = conn.execute("""WITH due AS (SELECT *,row_number() OVER(ORDER BY last_attempt_at NULLS FIRST,id)-1 AS position,
+         count(*) OVER() AS total FROM source_accounts
+         WHERE exclusion_state IN ('enabled','failure_disabled')
+         AND (next_due_at IS NULL OR next_due_at<=clock_timestamp()))
+       SELECT * FROM due ORDER BY mod(position-mod(floor(extract(epoch FROM clock_timestamp())/86400)::bigint,total)+total,total)
+       LIMIT %s""", (max_boards,)).fetchall()
+    conn.commit()
+    for source in sources:
+        if monotonic() >= deadline:
+            break
+        try:
+            with source_budget(min(BOARD_SECONDS,deadline-monotonic()),BOARD_REQUESTS):
+                feed = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
+                for count, _ in enumerate(feed,1):
+                    if count >= BOARD_ROWS:
+                        break
+                health = 'healthy' if feed.complete else 'partial'
+        except SourceBudgetExceeded:
+            health = 'partial'
+        except Exception:
+            health = 'failed'
+        log.warning('source %s attempted: %s; storage-blocked, reconciliation-deferred',source['id'],health)
diff --git a/job_discovery/run.py b/job_discovery/run.py
index 9e97aef..8c2eee3 100644
--- a/job_discovery/run.py
+++ b/job_discovery/run.py
@@ -1,11 +1,12 @@
 from contextlib import nullcontext
+from job_discovery.lifecycle.config import read_control
 from job_discovery.lifecycle.maintenance import pre_admission_maintenance
 from job_discovery.lifecycle.locks import enter_gate
 from job_discovery.lifecycle.capacity import CEILING_BYTES
 from job_discovery.lifecycle.legacy_spool import spool_feed, spool_questions
 import logging
 
 from job_discovery import db
 from job_discovery.adapters import ADAPTERS
 from job_discovery.adapters.greenhouse import parse_greenhouse_questions
 from job_discovery.http import get_json as _get_json
@@ -99,20 +100,36 @@ def run(dsn: str | None = None) -> dict:
         guard_note = None
         if over:
             guard_note = ("maintenance only: safety maintenance blocked admission" if maintenance.blocked
                           else f"maintenance only: capacity unavailable or db at {size_mb:.0f} MiB; ceiling {ceiling_mb:.0f} MiB")
             log.warning("%s; checking closures without ingestion or enrichment", guard_note)
 
         run_id = db.start_run(conn)
         if not over:
             db.sync_seed(conn, targets)
         conn.commit()
+        from job_discovery.lifecycle.reconcile import verify_due_sources, StorageBlocked
+        source_enabled = read_control(conn).source_enabled
+        conn.commit()
+        if source_enabled:
+            try:
+                db.sync_source_accounts(conn)
+                conn.commit()
+            except StorageBlocked:
+                conn.rollback()
+                log.warning('source catalog storage blocked; verifying registered corpus')
+            counts = verify_due_sources(conn)
+            db.finish_run(conn,run_id,companies_ok=counts['ok'],companies_failed=counts['failed'],
+                          new_jobs=counts['new_jobs'],closed_jobs=counts['closed_jobs'],
+                          notes='full-corpus source verification; payload admission deferred')
+            conn.commit()
+            return counts
         companies = db.active_companies(conn)
         conn.commit()  # No read transaction spans adapter HTTP.
 
         ok = failed = new_jobs = closed_jobs = 0
         aborted = False
         failures: list[str] = []
 
         for co in companies:
             ats, token, company_id = co["ats"], co["token"], co["id"]
             try:
diff --git a/tests/test_lifecycle_reconcile.py b/tests/test_lifecycle_reconcile.py
new file mode 100644
index 0000000..9365395
--- /dev/null
+++ b/tests/test_lifecycle_reconcile.py
@@ -0,0 +1,398 @@
+"""Ordinary source evidence, pagination and persisted scheduling contracts."""
+from datetime import timedelta
+
+import pytest
+
+from tests.conftest import requires_db
+from job_discovery.lifecycle import reconcile as r
+from job_discovery.lifecycle.identity import migrate_identity_batch
+from job_discovery.lifecycle.claims import cancel_claim
+from job_discovery.adapters.completeness import SourceStatus
+from job_discovery.lifecycle.types import Observation
+
+
+def setup_source(conn, count=1, ats='lever', token='fixture'):
+    cid = conn.execute("INSERT INTO companies(name,ats,token) VALUES ('Fixture',%s,%s) RETURNING id", (ats, token)).fetchone()['id']
+    for i in range(count):
+        conn.execute("INSERT INTO jobs(id,company_id,external_id,title,url) VALUES (%s,%s,%s,'Role','https://example.test/job')", (f'{ats}:{token}:{i}', cid, str(i)))
+    while migrate_identity_batch(conn):
+        pass
+    conn.execute('UPDATE lifecycle_control SET source_enabled=true,activation_generation=activation_generation+1 WHERE singleton')
+    conn.commit()
+    return conn.execute('SELECT * FROM source_accounts WHERE legacy_company_id=%s', (cid,)).fetchone()
+
+
+def begin(conn, source):
+    conn.execute('UPDATE source_accounts SET next_due_at=NULL WHERE id=%s', (source['id'],))
+    pair = r.claim_due_source(conn)
+    assert pair
+    co, claim = pair
+    enum = r.begin_enumeration(conn, co['id'], claim)
+    conn.commit()
+    return enum
+
+
+def finish(conn, enum, complete=True):
+    r.complete_enumeration(conn, enum, SourceStatus(complete=complete))
+    conn.commit()
+    while not r.reconcile_chunk(conn, enum):
+        conn.commit()
+    conn.commit()
+    cancel_claim(conn, enum.claim)
+    conn.commit()
+
+
+@requires_db
+def test_two_distinct_complete_misses_exact_24h_and_replay(conn):
+    source = setup_source(conn)
+    first = begin(conn, source)
+    finish(conn, first)
+    row = conn.execute('SELECT * FROM source_listings').fetchone()
+    assert row['consecutive_complete_misses'] == 1
+    assert row['source_availability'] != 'closed'
+    second = begin(conn, source)
+    # Fixture timestamps, not an application clock override.
+    r.complete_enumeration(conn, second, SourceStatus())
+    conn.execute("UPDATE source_enumerations SET completed_at=%s WHERE id=%s", (row['first_complete_miss_at']+timedelta(hours=24), second.id))
+    assert r.reconcile_chunk(conn, second)
+    assert r.reconcile_chunk(conn, second)
+    row = conn.execute('SELECT * FROM source_listings').fetchone()
+    assert row['consecutive_complete_misses'] == 2
+    assert row['source_availability'] == 'closed'
+    assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at']
+    conn.commit()
+
+
+@requires_db
+def test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset(conn):
+    source = setup_source(conn)
+    before = conn.execute('SELECT * FROM source_listings').fetchone()
+    conn.execute("UPDATE jobs SET closed_at=clock_timestamp()")
+    enum = begin(conn, source)
+    now = conn.execute('SELECT clock_timestamp() t').fetchone()['t']
+    sight = Observation('0', before['id'], 'unlisted', now)
+    r.commit_sightings(conn, enum, [sight])
+    conn.commit()
+    r.commit_sightings(conn, enum, [sight])
+    finish(conn, enum, False)
+    after = conn.execute('SELECT * FROM source_listings').fetchone()
+    assert after['successful_sighting_count'] == 1
+    assert after['source_availability'] == 'open'
+    assert after['discovery_anchor_at'] == before['discovery_anchor_at']
+    assert after['job_id'] == before['job_id']
+    assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at'] is None
+
+
+@requires_db
+@pytest.mark.parametrize('count,expected', [(20,'complete'), (21,'partial')])
+def test_empty_threshold(conn, count, expected):
+    source = setup_source(conn, count)
+    enum = begin(conn, source)
+    finish(conn, enum)
+    assert conn.execute('SELECT status FROM source_enumerations').fetchone()['status'] == expected
+    assert conn.execute('SELECT max(consecutive_complete_misses) n FROM source_listings').fetchone()['n'] == (expected == 'complete')
+
+
+@requires_db
+def test_unknown_or_missing_never_closes_and_partial_never_counts(conn):
+    source = setup_source(conn)
+    enum = begin(conn, source)
+    listing = conn.execute('SELECT * FROM source_listings').fetchone()
+    now = conn.execute('SELECT clock_timestamp() t').fetchone()['t']
+    r.commit_sightings(conn, enum, [Observation('0',listing['id'],'missing',now)])
+    finish(conn, enum, False)
+    assert conn.execute('SELECT consecutive_complete_misses FROM source_listings').fetchone()['consecutive_complete_misses'] == 0
+
+
+@requires_db
+def test_cancelled_enumeration_cannot_complete(conn):
+    source = setup_source(conn)
+    enum = begin(conn, source)
+    cancel_claim(conn, enum.claim)
+    conn.commit()
+    with pytest.raises(RuntimeError, match='fenced|stale'):
+        r.complete_enumeration(conn, enum, SourceStatus())
+    conn.rollback()
+
+
+@requires_db
+def test_checkpoint_survives_fresh_connection_and_newer_positive_beats_old_absence(conn):
+    import psycopg
+    from psycopg.rows import dict_row
+    from tests.conftest import TEST_DSN
+    source = setup_source(conn, 105)
+    enum = begin(conn,source)
+    from job_discovery.models import Posting
+    r.stage_postings(conn,enum,[Posting('extra','Role','u')])
+    r.complete_enumeration(conn,enum,SourceStatus())
+    assert not r.reconcile_chunk(conn,enum,100)
+    conn.commit()
+    # Fresh worker/connection reads the committed checkpoint without replaying
+    # the first 100 effects. Its existing lease remains bound to this run.
+    with psycopg.connect(TEST_DSN,row_factory=dict_row) as fresh:
+        assert r.reconcile_chunk(fresh,enum,100)
+        fresh.commit()
+    assert conn.execute('SELECT sum(consecutive_complete_misses) n FROM source_listings').fetchone()['n'] == 105
+    cancel_claim(conn,enum.claim)
+    conn.commit()
+    newer = begin(conn,source)
+    listing = conn.execute('SELECT * FROM source_listings ORDER BY external_id LIMIT 1').fetchone()
+    now = conn.execute('SELECT clock_timestamp() t').fetchone()['t']
+    r.commit_sightings(conn,newer,[Observation(listing['external_id'],listing['id'],'seen',now)])
+    # A completion can represent a feed started before a newer direct sighting.
+    conn.execute('UPDATE source_enumerations SET started_at=%s WHERE id=%s',(now-timedelta(hours=25),newer.id))
+    finish(conn,newer)
+    row = conn.execute('SELECT * FROM source_listings WHERE id=%s',(listing['id'],)).fetchone()
+    assert row['consecutive_complete_misses'] == 0
+    assert row['source_availability'] == 'open'
+
+
+@requires_db
+def test_less_than_24_hours_is_not_a_qualifying_second_miss(conn):
+    source = setup_source(conn)
+    first = begin(conn,source)
+    finish(conn,first)
+    miss = conn.execute('SELECT first_complete_miss_at FROM source_listings').fetchone()['first_complete_miss_at']
+    second = begin(conn,source)
+    r.complete_enumeration(conn,second,SourceStatus())
+    conn.execute('UPDATE source_enumerations SET completed_at=%s WHERE id=%s',(miss+timedelta(hours=24,microseconds=-1),second.id))
+    assert r.reconcile_chunk(conn,second)
+    conn.commit()
+    assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at'] is None
+
+
+@requires_db
+@pytest.mark.parametrize('budget_kind',['requests','time'])
+def test_scheduler_finite_six_cycle_bound_across_families_and_request_budget(conn,monkeypatch,budget_kind):
+    from job_discovery import http
+    from job_discovery.adapters import smartrecruiters
+    families = ['greenhouse','lever','ashby','workable','smartrecruiters','workday']
+    for family in families:
+        setup_source(conn,1,family,'fixture:wd5:External' if family=='workday' else 'fixture')
+    # Force the enormous source first; it exhausts every fresh request budget.
+    conn.execute("UPDATE source_accounts SET last_attempt_at=clock_timestamp()-interval '1 day' WHERE ats<>'smartrecruiters'")
+    conn.commit()
+    monkeypatch.setattr(r,'BOARD_REQUESTS',2)
+    clock=[0.0]
+    if budget_kind=='time':
+        from job_discovery.adapters import completeness
+        monkeypatch.setattr(r,'monotonic',lambda:clock[0])
+        monkeypatch.setattr(completeness,'monotonic',lambda:clock[0])
+        monkeypatch.setattr(r,'BOARD_SECONDS',1)
+    monkeypatch.setattr(smartrecruiters,'_PAGE_LIMIT',1)
+    calls = []
+    def get(url,**kwargs):
+        assert conn.info.transaction_status.name == 'IDLE'
+        calls.append(url)
+        if 'smartrecruiters' in url:
+            if budget_kind=='time':
+                clock[0]+=2
+            offset = url.split('offset=')[-1]
+            return {'content':[{'id':offset,'name':'Role'}]}
+        if 'lever' in url:
+            return [{'id':'0','text':'Role','hostedUrl':'https://example.test/job'}]
+        if 'greenhouse' in url:
+            return {'jobs':[{'id':'0','title':'Role','absolute_url':'https://example.test/job'}]}
+        if 'ashby' in url:
+            return {'jobs':[{'id':'0','title':'Role','jobUrl':'https://example.test/job','isListed':False,'publishedAt':'2026-10-01T00:00:00Z'}]}
+        return {'jobs':[{'shortcode':'0','title':'Role'}]}
+    def post(url,**kwargs):
+        assert conn.info.transaction_status.name == 'IDLE'
+        calls.append(url)
+        return {'jobPostings':[{'externalPath':'0','title':'Role'}],'total':1}
+    monkeypatch.setattr(http,'get_json',get)
+    monkeypatch.setattr(http,'post_json',post)
+    for _ in range(6):
+        r.verify_due_sources(conn,max_boards=1)
+    rows = conn.execute('SELECT ats,last_attempt_at,last_outcome FROM source_accounts').fetchall()
+    assert all(row['last_attempt_at'] for row in rows)
+    assert sum(row['last_outcome']=='complete' for row in rows)==5
+    assert len(calls)==(7 if budget_kind=='requests' else 6)
+    assert conn.execute('SELECT max(consecutive_complete_misses) n FROM source_listings').fetchone()['n']==0
+    # Another fixture day: huge source again exhausts; every small source still
+    # receives a turn within the same six fresh invocations.
+    conn.execute('UPDATE source_accounts SET next_due_at=NULL')
+    conn.commit()
+    for _ in range(6):
+        r.verify_due_sources(conn,max_boards=1)
+    assert conn.execute('SELECT min(enumeration_sequence) n FROM source_accounts').fetchone()['n']==2
+    assert len(calls)==(14 if budget_kind=='requests' else 12)
+
+
+@requires_db
+def test_failure_disabled_backoff_and_deliberate_exclusion(conn):
+    source = setup_source(conn)
+    conn.execute("UPDATE source_accounts SET exclusion_state='failure_disabled'")
+    for days in [1,2,4,7,7]:
+        enum = begin(conn,source)
+        finish(conn,enum,False)
+        row = conn.execute('SELECT next_due_at-clock_timestamp() delay FROM source_accounts').fetchone()
+        assert timedelta(days=days,seconds=-5) < row['delay'] <= timedelta(days=days)
+    conn.execute("UPDATE source_accounts SET exclusion_state='deliberate',next_due_at=NULL")
+    assert r.claim_due_source(conn) is None
+
+
+@requires_db
+def test_ordinary_poll_calls_full_corpus_path_above_guard_without_users(conn,monkeypatch):
+    import os
+    from job_discovery import run, http
+    source = setup_source(conn)
+    monkeypatch.setenv('DATABASE_URL',os.environ['TEST_DATABASE_URL'])
+    monkeypatch.setattr(run,'load_targets',lambda: [])
+    monkeypatch.setattr(run.db,'over_size_ceiling',lambda c:(True,6001,6000))
+    calls=[]
+    monkeypatch.setattr(http,'get_json',lambda url,**kw:calls.append(url) or [])
+    assert run.run()['ok']==1
+    assert len(calls)==1
+    assert conn.execute('SELECT last_complete_success_at FROM source_accounts WHERE id=%s',(source['id'],)).fetchone()['last_complete_success_at']
+    assert conn.execute('SELECT closed_at FROM jobs').fetchone()['closed_at'] is None
+
+
+@requires_db
+def test_storage_blocked_attempt_is_truthful_and_does_not_certify_absence(conn,monkeypatch,caplog):
+    from job_discovery import http
+    setup_source(conn)
+    monkeypatch.setattr(r,'claim_work',lambda *args:None)  # Ordinary integration boundary double; no capacity probes.
+    calls=[]
+    def healthy(url,**kw):
+        assert conn.info.transaction_status.name=='IDLE'
+        calls.append(url)
+        return []
+    monkeypatch.setattr(http,'get_json',healthy)
+    result=r.verify_due_sources(conn,max_boards=1)
+    assert result['failed']==0 and len(calls)==1
+    assert 'healthy; storage-blocked, reconciliation-deferred' in caplog.text
+    assert conn.execute('SELECT count(*) n FROM source_enumerations').fetchone()['n']==0
+    assert conn.execute('SELECT consecutive_complete_misses FROM source_listings').fetchone()['consecutive_complete_misses']==0
+
+
+@requires_db
+def test_ashby_republication_and_unlisted_keep_frozen_age(conn,monkeypatch):
+    from job_discovery import http
+    setup_source(conn,1,'ashby')
+    before=conn.execute('SELECT * FROM source_listings').fetchone()
+    for published in ['2026-01-01T00:00:00Z','2026-10-06T00:00:00Z']:
+        monkeypatch.setattr(http,'get_json',lambda *a,**kw:{'jobs':[{'id':'0','title':'Role','jobUrl':'https://example.test/job','isListed':False,'publishedAt':published}]})
+        conn.execute('UPDATE source_accounts SET next_due_at=NULL')
+        conn.commit()
+        r.verify_due_sources(conn,max_boards=1)
+    after=conn.execute('SELECT * FROM source_listings').fetchone()
+    assert after['discovery_anchor_at']==before['discovery_anchor_at']
+    assert after['discovery_expires_at']==before['discovery_expires_at']
+    assert after['successful_sighting_count']==2
+    assert after['source_availability']=='open'
+    assert conn.execute('SELECT bool_and(public_metadata=\'{"kind":"unlisted"}\') ok FROM enumeration_members').fetchone()['ok']
+
+
+@requires_db
+def test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives(conn,monkeypatch):
+    import psycopg
+    from psycopg.rows import dict_row
+    from tests.conftest import TEST_DSN
+    from job_discovery import http
+    from job_discovery.lifecycle.types import ClaimRef
+    setup_source(conn,100,'smartrecruiters')
+    calls=[]
+    def interrupted(url,**kw):
+        calls.append(url)
+        if len(calls)>1:
+            raise KeyboardInterrupt('ordinary simulated worker interruption')
+        return {'content':[{'id':str(i),'name':'Role'} for i in range(100)],'totalFound':101}
+    monkeypatch.setattr(http,'get_json',interrupted)
+    with pytest.raises(KeyboardInterrupt):
+        r.verify_due_sources(conn,max_boards=1)
+    conn.rollback()
+    # Discard the caller connection; a new worker sees both membership and
+    # source attempt ordering, and restarts mutable pagination from page zero.
+    with psycopg.connect(TEST_DSN,row_factory=dict_row) as fresh:
+        assert fresh.execute('SELECT count(*) n FROM enumeration_members').fetchone()['n']==100
+        assert fresh.execute('SELECT min(successful_sighting_count) n FROM source_listings').fetchone()['n']==1
+        claim=fresh.execute("SELECT * FROM lifecycle_claims WHERE kind='source'").fetchone()
+        cancel_claim(fresh,ClaimRef(claim['owner_token'],claim['generation'],claim['lease_until']))
+        fresh.commit()
+        requested=[]
+        def restarted(url,**kw):
+            requested.append(url)
+            return {'content':[{'id':'0','name':'Role'}],'totalFound':1}
+        monkeypatch.setattr(http,'get_json',restarted)
+        r.verify_due_sources(fresh,max_boards=1)
+        assert requested and 'offset=0' in requested[0]
+        assert fresh.execute('SELECT enumeration_sequence FROM source_accounts').fetchone()['enumeration_sequence']==2
+        assert fresh.execute('SELECT max(consecutive_complete_misses) n FROM source_listings').fetchone()['n']==1
+
+
+@requires_db
+def test_new_corpus_sources_registered_in_bounded_slices_without_reactivating_exclusions(conn):
+    from job_discovery import db
+    source=setup_source(conn)
+    conn.execute("UPDATE source_accounts SET exclusion_state='deliberate'")
+    conn.execute("INSERT INTO companies(name,ats,token,active,poll_failures) VALUES ('Failed','lever','failed',false,%s),('Unknown','ashby','unknown',false,0),('New','greenhouse','new',true,0)", (db.POLL_FAILURE_DEACTIVATE,))
+    assert db.sync_source_accounts(conn,2)==2
+    conn.commit()
+    rows=conn.execute('SELECT public_board_ref,exclusion_state FROM source_accounts ORDER BY public_board_ref').fetchall()
+    assert {'public_board_ref':'fixture','exclusion_state':'deliberate'} in rows
+    assert {'public_board_ref':'failed','exclusion_state':'failure_disabled'} in rows
+    assert {'public_board_ref':'unknown','exclusion_state':'unknown'} in rows
+    assert conn.execute('SELECT legacy_company_id FROM source_accounts WHERE id=%s',(source['id'],)).fetchone()
+
+
+@requires_db
+def test_explicit_removed_evidence_only_closes_exact_identity(conn):
+    source=setup_source(conn,2)
+    enum=begin(conn,source)
+    listing=conn.execute("SELECT * FROM source_listings WHERE external_id='0'").fetchone()
+    now=conn.execute('SELECT clock_timestamp() t').fetchone()['t']
+    r.commit_sightings(conn,enum,[Observation('0',listing['id'],'removed',now)])
+    finish(conn,enum,False)
+    rows=conn.execute('SELECT external_id,closed_at FROM jobs ORDER BY external_id').fetchall()
+    assert rows[0]['closed_at'] and rows[1]['closed_at'] is None
+
+
+@requires_db
+def test_storage_deferred_request_budget_is_partial_not_a_source_failure(conn,monkeypatch,caplog):
+    from job_discovery import http
+    from job_discovery.adapters import smartrecruiters
+    setup_source(conn,1,'smartrecruiters')
+    monkeypatch.setattr(r,'claim_work',lambda *a:None)
+    monkeypatch.setattr(r,'BOARD_REQUESTS',1)
+    monkeypatch.setattr(smartrecruiters,'_PAGE_LIMIT',1)
+    monkeypatch.setattr(http,'get_json',lambda *a,**kw:{'content':[{'id':'0','name':'Role'}],'totalFound':2})
+    r.verify_due_sources(conn,max_boards=1)
+    assert 'partial; storage-blocked, reconciliation-deferred' in caplog.text
+    assert 'attempted: failed' not in caplog.text
+
+
+@requires_db
+def test_readonly_fallback_day_rotation_attempts_all_six_with_one_turn_budget(conn,monkeypatch,caplog):
+    from job_discovery import http
+    families=['greenhouse','lever','ashby','workable','smartrecruiters','workday']
+    for family in families:
+        setup_source(conn,1,family,'fixture:wd5:External' if family=='workday' else 'fixture')
+    before=conn.execute('SELECT * FROM source_accounts ORDER BY id').fetchall()
+    conn.commit()
+    calls=[]
+    def get(url,**kw):
+        calls.append(url)
+        if 'lever' in url:
+            return []
+        return {'content':[],'totalFound':0} if 'smartrecruiters' in url else {'jobs':[]}
+    def post(url,**kw):
+        calls.append(url)
+        return {'jobPostings':[],'total':0}
+    monkeypatch.setattr(http,'get_json',get)
+    monkeypatch.setattr(http,'post_json',post)
+    class FixtureDay:
+        # Test-local replacement of this scheduler's UTC day expression only;
+        # no production clock override or claim/lease/capacity behavior changes.
+        def __init__(self,day):
+            self.day=day
+        def execute(self,query,params):
+            query=query.replace('floor(extract(epoch FROM clock_timestamp())/86400)::bigint','%s::bigint')
+            return conn.execute(query,(self.day,*params))
+        def commit(self):
+            conn.commit()
+    for day in range(6):
+        r.verify_storage_blocked(FixtureDay(day),max_boards=1,deadline=r.monotonic()+60)
+    assert len(calls)==6 and len(set(calls))==6
+    assert all(str(row['id']) in caplog.text for row in before)
+    assert conn.execute('SELECT * FROM source_accounts ORDER BY id').fetchall()==before
diff --git a/tests/test_maintenance_controlflow.py b/tests/test_maintenance_controlflow.py
index 95f0a27..5af3c6b 100644
--- a/tests/test_maintenance_controlflow.py
+++ b/tests/test_maintenance_controlflow.py
@@ -109,20 +109,21 @@ def test_denied_reconnect_lock_aborts_before_all_optional_phases(monkeypatch, ac
         def commit(self):
             pass
         def rollback(self):
             if self.broken:
                 raise RuntimeError('broken rollback')
         def close(self):
             closes.append(self.locked)
     connections = iter([Connection(True,True),Connection(False)])
     monkeypatch.setattr(run,'pre_admission_maintenance',lambda dsn: SweepResult(0,0,False,None))
     monkeypatch.setattr(run,'load_targets',lambda: [])
+    monkeypatch.setattr(run,'read_control',lambda c: SimpleNamespace(source_enabled=False))
     monkeypatch.setattr(run.db,'connect',lambda dsn: next(connections))
     monkeypatch.setattr(run.db,'over_size_ceiling',lambda c: (False,20,6000))
     monkeypatch.setattr(run.db,'start_run',lambda c: 1)
     monkeypatch.setattr(run.db,'sync_seed',lambda *a: None)
     monkeypatch.setattr(run.db,'active_companies',lambda c: [{'id':1,'ats':'lever','token':'x','name':'X'}])
     def finish(*args, **kw):
         finished.append(kw)
         if accounting_fails:
             raise RuntimeError('accounting unavailable')
     monkeypatch.setattr(run.db,'finish_run',finish)
diff --git a/tests/test_size_guard.py b/tests/test_size_guard.py
index 93f9d52..9f37325 100644
--- a/tests/test_size_guard.py
+++ b/tests/test_size_guard.py
@@ -263,10 +263,16 @@ def test_guard_reconciles_only_complete_sources_without_ingestion(conn, monkeypa
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
+
+
+@pytest.fixture(autouse=True)
+def legacy_source_control(monkeypatch):
+    from types import SimpleNamespace
+    monkeypatch.setattr(job_discovery_run, 'read_control', lambda c: SimpleNamespace(source_enabled=False))
diff --git a/tests/test_smartrecruiters.py b/tests/test_smartrecruiters.py
index dbf9ff2..6b9980b 100644
--- a/tests/test_smartrecruiters.py
+++ b/tests/test_smartrecruiters.py
@@ -89,21 +89,21 @@ def test_fetch_pages_by_offset_and_fetches_details(monkeypatch):
     requested: list[str] = []
 
     def fake_get_json(url):
         requested.append(url)
         if "/postings/" in url:  # detail call
             return DETAILS[url.rsplit("/", 1)[1]]
         page_index = 0 if "offset=0" in url else 1
         return FIXTURE["list_pages"][page_index]
 
     monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
-    postings = fetch_smartrecruiters("BoschGroup")
+    postings = list(fetch_smartrecruiters("BoschGroup"))
 
     assert [p.external_id for p in postings] == [BOSCH, NIELSEN, ARCHITECT]
     assert requested[0] == (
         "https://api.smartrecruiters.com/v1/companies/BoschGroup/postings"
         "?limit=2&offset=0"
     )
     assert any("offset=2" in u for u in requested)  # second page was walked
 
 
 def test_fetch_stops_on_short_last_page_with_positive_total(monkeypatch):
@@ -113,21 +113,21 @@ def test_fetch_stops_on_short_last_page_with_positive_total(monkeypatch):
     offsets: list[int] = []
 
     def fake_get_json(url):
         if "/postings/" in url:  # detail call
             return DETAILS[url.rsplit("/", 1)[1]]
         offset = int(url.split("offset=")[1])
         offsets.append(offset)
         return FIXTURE["list_pages"][0 if offset == 0 else 1]
 
     monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
-    postings = fetch_smartrecruiters("BoschGroup")
+    postings = list(fetch_smartrecruiters("BoschGroup"))
     assert [p.external_id for p in postings] == [BOSCH, NIELSEN, ARCHITECT]
     assert offsets == [0, 2]  # stopped after the short page; no wrap/extra fetch
 
 
 def test_fetch_keeps_minimal_posting_when_detail_fails(monkeypatch):
     # A failed detail fetch must NOT drop the posting (dropping it would let
     # run.py's close-detection falsely close a still-open job). A minimal posting
     # is built from the listing item so the job stays in `seen`.
     page = {"totalFound": 2, "content": [
         {"id": "744000135080134", "name": "Facilities Soft Services Engineer"},
@@ -140,41 +140,41 @@ def test_fetch_keeps_minimal_posting_when_detail_fails(monkeypatch):
         if "/postings/" in url:
             pid = url.rsplit("/", 1)[1]
             return {
                 "id": pid,
                 "name": "Facilities Soft Services Engineer",
                 "postingUrl": f"https://jobs.smartrecruiters.com/BoschGroup/{pid}",
             }
         return page
 
     monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
-    postings = fetch_smartrecruiters("BoschGroup")
+    postings = list(fetch_smartrecruiters("BoschGroup"))
     assert [p.external_id for p in postings] == ["744000135080134", "BAD"]
     bad = postings[1]
     assert bad.title == "Broken Posting"  # carried over from the listing item
     assert bad.url == "https://jobs.smartrecruiters.com/BoschGroup/BAD"  # token+id
 
 
 def test_fetch_keeps_minimal_posting_when_detail_malformed(monkeypatch):
     # A malformed HTTP-200 detail body (here: missing `id`, which the parser
     # dereferences) must not abort the whole company fetch.
     page = {"totalFound": 1, "content": [
         {"id": "744000135080134", "name": "Facilities Soft Services Engineer"},
     ]}
 
     def fake_get_json(url):
         if "/postings/" in url:
             return {"name": "Facilities Soft Services Engineer"}  # no id key
         return page
 
     monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
-    postings = fetch_smartrecruiters("BoschGroup")
+    postings = list(fetch_smartrecruiters("BoschGroup"))
     assert [p.external_id for p in postings] == ["744000135080134"]
     assert postings[0].url == (
         "https://jobs.smartrecruiters.com/BoschGroup/744000135080134"
     )
 
 
 def test_fetch_pages_until_short_page_when_total_missing(monkeypatch):
     # When the listing omits `totalFound`, paging must continue while a full page
     # comes back and stop on the short page — not truncate after page 1 (which
     # would drop later postings and trigger false closures).
@@ -187,34 +187,34 @@ def test_fetch_pages_until_short_page_when_total_missing(monkeypatch):
 
     def fake_get_json(url):
         if "/postings/" in url:  # detail call
             pid = url.rsplit("/", 1)[1]
             return {"id": pid, "name": f"Job {pid}",
                     "postingUrl": f"https://jobs.smartrecruiters.com/acme/{pid}"}
         offset = int(url.split("offset=")[1])
         return pages[offset]
 
     monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
-    postings = fetch_smartrecruiters("acme")
+    postings = list(fetch_smartrecruiters("acme"))
     assert [p.external_id for p in postings] == ["1", "2", "3", "4", "5"]
 
 
 # ── A3: missing top-level key ─────────────────────────────────────────────────
 
 def test_missing_content_key_raises(monkeypatch):
     monkeypatch.setattr(smartrecruiters, "get_json", lambda url: {"error": "gone"})
     with pytest.raises(ValueError, match="missing 'content'"):
-        fetch_smartrecruiters("BoschGroup")
+        list(fetch_smartrecruiters("BoschGroup"))
 
 
 def test_short_page_below_reported_total_is_not_authoritative(monkeypatch):
     monkeypatch.setattr(smartrecruiters, "get_json", lambda *a: {"totalFound": 50, "content": []})
     with pytest.raises(ValueError, match="incomplete"):
-        fetch_smartrecruiters("acme")
+        list(fetch_smartrecruiters("acme"))
 
 
 def test_smartrecruiters_listing_only_never_fetches_details(monkeypatch):
     def listing(url):
         assert "/postings/" not in url
         return {"totalFound": 1, "content": [{"id": "1", "name": "A"}]}
     monkeypatch.setattr(smartrecruiters, "get_json", listing)
     assert [p.external_id for p in fetch_smartrecruiters("acme", fetch_details=False)] == ["1"]
diff --git a/tests/test_source_completeness.py b/tests/test_source_completeness.py
index e659490..818cc11 100644
--- a/tests/test_source_completeness.py
+++ b/tests/test_source_completeness.py
@@ -16,10 +16,89 @@ def test_unidentifiable_entry_cannot_authorize_closure(monkeypatch, module, key,
     monkeypatch.setattr(module, "get_json", lambda *a: {key: [{id_key: None, "title": "A", "absolute_url": "u"}]})
     fetch = getattr(module, "fetch_" + module.__name__.rsplit(".", 1)[1])
     with pytest.raises(ValueError):
         fetch("a")
 
 
 def test_greenhouse_reported_total_cannot_exceed_collection(monkeypatch):
     monkeypatch.setattr(greenhouse, "get_json", lambda *a: {"jobs": [], "meta": {"total": 7}})
     with pytest.raises(ValueError):
         greenhouse.fetch_greenhouse("a")
+
+
+@pytest.mark.parametrize('name', ['greenhouse','lever','ashby','workable','smartrecruiters','workday'])
+def test_every_family_requires_exhaustion_for_empty_success(monkeypatch,name):
+    from job_discovery import http
+    from job_discovery.adapters import ADAPTERS
+    from job_discovery.adapters.completeness import SourceResult
+    bodies={'greenhouse':{'jobs':[]},'lever':[],'ashby':{'jobs':[]},
+            'workable':{'jobs':[]},'smartrecruiters':{'content':[],'totalFound':0},
+            'workday':{'jobPostings':[],'total':0}}
+    monkeypatch.setattr(http,'get_json',lambda *a,**kw:bodies[name])
+    monkeypatch.setattr(http,'post_json',lambda *a,**kw:bodies[name])
+    result=ADAPTERS[name]('fixture:wd5:External' if name=='workday' else 'fixture',fetch_details=False)
+    assert isinstance(result,SourceResult) and not result.complete
+    assert list(result)==[] and result.complete
+
+
+@pytest.mark.parametrize('name,key,id_key', [('greenhouse','jobs','id'),('lever',None,'id'),('ashby','jobs','id'),('workable','jobs','shortcode')])
+def test_single_response_duplicate_identity_never_complete(monkeypatch,name,key,id_key):
+    from job_discovery import http
+    from job_discovery.adapters import ADAPTERS
+    items=[{id_key:'same'},{id_key:'same'}]
+    monkeypatch.setattr(http,'get_json',lambda *a,**kw:{key:items} if key else items)
+    with pytest.raises(ValueError,match='duplicate'):
+        list(ADAPTERS[name]('fixture'))
+
+
+@pytest.mark.parametrize('family',['smartrecruiters','workday'])
+def test_final_page_failure_preserves_yielded_positive_but_never_completes(monkeypatch,family):
+    from job_discovery import http
+    from job_discovery.adapters import ADAPTERS
+    module=smartrecruiters if family=='smartrecruiters' else workday
+    monkeypatch.setattr(module,'_PAGE_LIMIT',1)
+    calls=[]
+    def page(*a,**kw):
+        calls.append(1)
+        if len(calls)>1:
+            raise ValueError('fixture final page failed')
+        return {'content':[{'id':'one','name':'Role'}],'totalFound':2} if family=='smartrecruiters' else {'jobPostings':[{'externalPath':'one','title':'Role'}],'total':2}
+    monkeypatch.setattr(http,'get_json',page)
+    monkeypatch.setattr(http,'post_json',page)
+    feed=ADAPTERS[family]('fixture:wd5:External' if family=='workday' else 'fixture',fetch_details=False)
+    assert next(feed).external_id=='one'
+    with pytest.raises(ValueError,match='final page'):
+        list(feed)
+    assert not feed.complete
+
+
+@pytest.mark.parametrize('family',['smartrecruiters','workday'])
+def test_changed_total_cannot_certify_absence(monkeypatch,family):
+    from job_discovery import http
+    from job_discovery.adapters import ADAPTERS
+    module=smartrecruiters if family=='smartrecruiters' else workday
+    monkeypatch.setattr(module,'_PAGE_LIMIT',1)
+    if family=='smartrecruiters':
+        pages=iter([{'content':[{'id':'one','name':'Role'}],'totalFound':2},
+                    {'content':[{'id':'two','name':'Role'}],'totalFound':1}])
+    else:
+        pages=iter([{'jobPostings':[{'externalPath':'one','title':'Role'}],'total':2},
+                    {'jobPostings':[],'total':0}])
+    monkeypatch.setattr(http,'get_json',lambda *a,**kw:next(pages))
+    monkeypatch.setattr(http,'post_json',lambda *a,**kw:next(pages))
+    feed=ADAPTERS[family]('fixture:wd5:External' if family=='workday' else 'fixture',fetch_details=False)
+    list(feed)
+    assert not feed.complete
+
+
+def test_board_time_budget_checked_between_postings_without_another_request(monkeypatch):
+    from job_discovery.adapters import completeness as c
+    from job_discovery.models import Posting
+    clock=[0.0]
+    monkeypatch.setattr(c,'monotonic',lambda:clock[0])
+    with c.source_budget(10,2):
+        feed=c.SourceResult(iter([Posting('one','Role','u'),Posting('two','Role','u')]),c.SourceStatus())
+        next(feed)
+        clock[0]=10
+        with pytest.raises(c.SourceBudgetExceeded):
+            next(feed)
+        assert not feed.complete
diff --git a/tests/test_workable.py b/tests/test_workable.py
index 656a53f..382b71c 100644
--- a/tests/test_workable.py
+++ b/tests/test_workable.py
@@ -55,21 +55,21 @@ def test_extract_description_none_when_empty():
 
 
 def test_fetch_is_a_single_widget_call_with_no_pagination(monkeypatch):
     requested: list[str] = []
 
     def fake_get_json(url):
         requested.append(url)
         return WIDGET
 
     monkeypatch.setattr(workable, "get_json", fake_get_json)
-    postings = fetch_workable("acme")
+    postings = list(fetch_workable("acme"))
 
     assert [p.external_id for p in postings] == ["ENG123", "OPS456", "DS789"]
     # exactly ONE call: the widget endpoint — no per-job detail fetch, no paging
     assert requested == [WIDGET_URL]
     assert postings[0].url == "https://apply.workable.com/acme/j/ENG123/"
 
 
 def test_fetch_keeps_minimal_posting_when_job_malformed(monkeypatch):
     # A malformed entry (here: missing `title`, which the parser dereferences)
     # must not abort the company fetch nor be dropped — dropping it would let
@@ -78,21 +78,21 @@ def test_fetch_keeps_minimal_posting_when_job_malformed(monkeypatch):
     payload = {"name": "Acme", "jobs": [
         {"shortcode": "ENG123", "title": "Good", "telecommuting": False,
          "city": "SF", "department": "Eng", "description": "<p>x</p>"},
         {"shortcode": "BAD"},  # no title -> parse raises -> minimal posting kept
     ]}
 
     def fake_get_json(url):
         return payload
 
     monkeypatch.setattr(workable, "get_json", fake_get_json)
-    postings = fetch_workable("acme")
+    postings = list(fetch_workable("acme"))
     assert [p.external_id for p in postings] == ["ENG123", "BAD"]
     bad = postings[1]
     assert bad.title is None  # no title available in the listing entry
     assert bad.url == "https://apply.workable.com/acme/j/BAD/"  # token+shortcode
 
 
 def test_fetch_rejects_entries_without_a_shortcode(monkeypatch):
     # An entry with no stable ID makes the listing unsafe for closure detection.
     payload = {"jobs": [
         {"title": "No Shortcode", "telecommuting": True},  # no shortcode -> dropped
