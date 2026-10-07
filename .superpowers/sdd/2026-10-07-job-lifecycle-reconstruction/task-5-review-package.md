# Full pinned review package

BASE: ee9cef2849b966835807c6c84d00cf2a8ed62788

HEAD: a6131a02282174078e34ecdd28d967294a524a90

## Commits

a6131a02282174078e34ecdd28d967294a524a90 feat: supervise maintenance independently of review progress


## Files

 .../task-5-evidence/commands.txt                   |  38 ++
 .../task-5-evidence/final16.txt                    |   7 +
 .../task-5-evidence/final17.txt                    |   7 +
 .../task-5-evidence/green-attempt17.txt            | 141 +++++++
 .../task-5-evidence/green-expanded17.txt           |  84 ++++
 .../task-5-evidence/green-measured17.txt           |   7 +
 .../task-5-evidence/green-process.txt              |   2 +
 .../task-5-evidence/measure_tests.py               |  66 +++
 .../task-5-evidence/red-drain-deadline.txt         |  25 ++
 .../task-5-evidence/red17.txt                      | 452 +++++++++++++++++++++
 .../task-5-evidence/ruff.txt                       |   1 +
 .../task-5-report.md                               | 178 ++++++++
 job_discovery/lifecycle/worker.py                  |  67 +++
 railway.reviewer-worker.json                       |   2 +-
 reviewer/supervisor.py                             | 131 ++++++
 reviewer/worker.py                                 |  67 +--
 tests/test_lifecycle_supervisor.py                 | 410 +++++++++++++++++++
 tests/test_reviewer_worker.py                      |  29 +-
 18 files changed, 1681 insertions(+), 33 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/commands.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/commands.txt
new file mode 100644
index 0000000..ee41705
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/commands.txt
@@ -0,0 +1,38 @@
+Workdir: /workspace/job-board/.claude/worktrees/lifecycle-recovery
+Shell: /bin/bash, login:false
+BASE: ee9cef2849b966835807c6c84d00cf2a8ed62788
+All PostgreSQL invocations use the existing owned random-port harness.
+Each > destination captures stdout and stderr; pytest-generated trailing whitespace
+was normalized afterward, without changing results or traceback content.
+
+RED (red17.txt):
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_supervisor.py tests/test_reviewer_worker.py -q
+
+Initial GREEN attempt (green-attempt17.txt), same command:
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_supervisor.py tests/test_reviewer_worker.py -q
+
+Expanded attempt (green-expanded17.txt):
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_lifecycle_supervisor.py tests/test_reviewer_worker.py tests/test_lifecycle_maintenance.py tests/test_maintenance_controlflow.py -q
+
+Additional deadline RED (red-drain-deadline.txt):
+.venv/bin/python -m pytest tests/test_lifecycle_supervisor.py::test_shutdown_does_not_extend_maintenance_90_second_deadline -q
+
+Process-only GREEN after drain fixes (green-process.txt):
+.venv/bin/python -m pytest tests/test_lifecycle_supervisor.py -q -k 'not worker_flag and not worker_scheduled and not worker_contended and not worker_failure'
+
+Measured GREEN before final maintenance SIGTERM integration test (green-measured17.txt):
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/measure_tests.py tests/test_lifecycle_supervisor.py tests/test_reviewer_worker.py tests/test_lifecycle_maintenance.py tests/test_maintenance_controlflow.py -q
+
+Final unchanged-source coverage (final17.txt, final16.txt):
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/measure_tests.py tests/test_lifecycle_supervisor.py tests/test_reviewer_worker.py tests/test_lifecycle_maintenance.py tests/test_maintenance_controlflow.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python .superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/measure_tests.py tests/test_lifecycle_supervisor.py tests/test_reviewer_worker.py tests/test_lifecycle_maintenance.py tests/test_maintenance_controlflow.py -q
+
+Static verification:
+.venv/bin/ruff check .
+git diff --check
+git diff --cached --check
+
+Scope verification:
+git diff --name-only ee9cef2849b966835807c6c84d00cf2a8ed62788 -- railway.json railway.discovery.json job_discovery/__main__.py
+git merge-base --is-ancestor 114cce96cb244546864a6bddc5476b5630bc024a HEAD
+git log -1 --format='%H %s' origin/main
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/final16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/final16.txt
new file mode 100644
index 0000000..710f8fd
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/final16.txt
@@ -0,0 +1,7 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+RESOURCE server: 16.15 (Debian 16.15-1.pgdg13+2)
+RESOURCE Python: 3.12.14
+........................................................................ [ 85%]
+............                                                             [100%]
+84 passed in 56.95s
+RESOURCE {"wall_seconds": 57.951, "child_user_cpu_seconds": 6.034, "child_system_cpu_seconds": 1.379, "waited_child_max_rss_kib": 56144, "sampled_peak_test_process_tree_rss_bytes": 90021888, "sampled_peak_test_database_connections": 4, "database_connections_before": 0, "database_connections_after": 0, "monitor_extra_connections": 1, "samples": 872, "sampling_interval_seconds": 0.05, "scope": "test client processes; excludes DB server CPU/memory and harness/container overhead"}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/final17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/final17.txt
new file mode 100644
index 0000000..3951bc4
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/final17.txt
@@ -0,0 +1,7 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+RESOURCE server: 17.11 (Debian 17.11-1.pgdg13+2)
+RESOURCE Python: 3.12.14
+........................................................................ [ 85%]
+............                                                             [100%]
+84 passed in 49.03s
+RESOURCE {"wall_seconds": 49.773, "child_user_cpu_seconds": 6.914, "child_system_cpu_seconds": 1.583, "waited_child_max_rss_kib": 56528, "sampled_peak_test_process_tree_rss_bytes": 90390528, "sampled_peak_test_database_connections": 4, "database_connections_before": 0, "database_connections_after": 0, "monitor_extra_connections": 1, "samples": 713, "sampling_interval_seconds": 0.05, "scope": "test client processes; excludes DB server CPU/memory and harness/container overhead"}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/green-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/green-attempt17.txt
new file mode 100644
index 0000000..71fc189
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/green-attempt17.txt
@@ -0,0 +1,141 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+......F.......FF.....................                                    [100%]
+=================================== FAILURES ===================================
+___________ test_real_children_deadline_and_terminated_external_cron ___________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f77e0d8b110>
+
+    def test_real_children_deadline_and_terminated_external_cron(monkeypatch):
+        s = supervisor()
+        monkeypatch.setattr(s, 'CHECK_SECONDS', 0.02)
+        monkeypatch.setattr(s, 'MAINTENANCE_INTERVAL_SECONDS', 0.30)
+        monkeypatch.setattr(s, 'MAINTENANCE_DEADLINE_SECONDS', 0.12)
+        monkeypatch.setattr(s, 'DRAIN_SECONDS', 0.08)
+        stop = threading.Event()
+        children = []
+        cron = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])
+        timer = threading.Timer(0.75, stop.set)
+
+        def spawn(name):
+            p = subprocess.Popen([sys.executable, '-c',
+                'import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(60)'])
+            children.append((name, p))
+            return p
+
+        began = time.monotonic()
+        try:
+            cron.terminate()
+            cron.wait(timeout=2)
+            timer.start()
+            assert s.supervise(stop, spawn, time.monotonic) == 0
+            assert time.monotonic() - began < 3
+            assert sum(n == 'maintenance' for n, _ in children) >= 2
+>           assert all(p.poll() is not None for _, p in children)
+E           assert False
+E            +  where False = all(<generator object test_real_children_deadline_and_terminated_external_cron.<locals>.<genexpr> at 0x7f77e0da0930>)
+
+tests/test_lifecycle_supervisor.py:187: AssertionError
+------------------------------ Captured log call -------------------------------
+WARNING  reviewer.supervisor:supervisor.py:76 maintenance process deadline reached
+WARNING  reviewer.supervisor:supervisor.py:76 maintenance process deadline reached
+WARNING  reviewer.supervisor:supervisor.py:76 maintenance process deadline reached
+__________________ test_two_claimers_never_take_the_same_row ___________________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32951 user=postgres database=poller_lifecycle_test) at 0x7f77e0e41670>
+
+    @requires_db
+    def test_two_claimers_never_take_the_same_row(conn):
+        # Two pending rows (distinct users — the partial unique index forbids two active
+        # per user). Two concurrent connections must claim DIFFERENT rows (SKIP LOCKED).
+        _enqueue(conn, UA)
+        _enqueue(conn, UB)
+        conn2 = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            c1 = rdb.claim_next_review_request(conn)   # locks row 1 (uncommitted)
+>           c2 = rdb.claim_next_review_request(conn2)  # must skip the locked row → row 2
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_reviewer_worker.py:72:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+reviewer/db.py:395: in claim_next_review_request
+    cur.execute(
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f77e0dc8ad0>
+query = "\n            UPDATE review_requests SET status = 'running', started_at = now(),\n                   claim_version = ...         FOR UPDATE SKIP LOCKED LIMIT 1\n            )\n            RETURNING id, user_id, claim_version\n            "
+params = None, prepare = None, binary = None
+
+    def execute(
+        self,
+        query: Query,
+        params: Params | None = None,
+        *,
+        prepare: bool | None = None,
+        binary: bool | None = None,
+    ) -> Self:
+        """
+        Execute a query or command to the database.
+        """
+        try:
+            with self._conn.lock:
+                self._conn.wait(
+                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+                )
+        except e._NO_TRACEBACK as ex:
+>           raise ex.with_traceback(None)
+E           psycopg.errors.LockNotAvailable: canceling statement due to lock timeout
+E           CONTEXT:  SQL statement "SELECT pg_advisory_xact_lock(20916294442894917)"
+E           PL/pgSQL function public.lifecycle_gate() line 6 at PERFORM
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: LockNotAvailable
+___________ test_second_claimer_gets_nothing_when_only_row_is_locked ___________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32951 user=postgres database=poller_lifecycle_test) at 0x7f77e0e40b60>
+
+    @requires_db
+    def test_second_claimer_gets_nothing_when_only_row_is_locked(conn):
+        _enqueue(conn, UA)
+        conn2 = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            c1 = rdb.claim_next_review_request(conn)   # locks the only pending row
+>           c2 = rdb.claim_next_review_request(conn2)  # SKIP LOCKED → nothing
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_reviewer_worker.py:87:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+reviewer/db.py:395: in claim_next_review_request
+    cur.execute(
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f77e0dc9b50>
+query = "\n            UPDATE review_requests SET status = 'running', started_at = now(),\n                   claim_version = ...         FOR UPDATE SKIP LOCKED LIMIT 1\n            )\n            RETURNING id, user_id, claim_version\n            "
+params = None, prepare = None, binary = None
+
+    def execute(
+        self,
+        query: Query,
+        params: Params | None = None,
+        *,
+        prepare: bool | None = None,
+        binary: bool | None = None,
+    ) -> Self:
+        """
+        Execute a query or command to the database.
+        """
+        try:
+            with self._conn.lock:
+                self._conn.wait(
+                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+                )
+        except e._NO_TRACEBACK as ex:
+>           raise ex.with_traceback(None)
+E           psycopg.errors.LockNotAvailable: canceling statement due to lock timeout
+E           CONTEXT:  SQL statement "SELECT pg_advisory_xact_lock(20916294442894917)"
+E           PL/pgSQL function public.lifecycle_gate() line 6 at PERFORM
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: LockNotAvailable
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_supervisor.py::test_real_children_deadline_and_terminated_external_cron
+FAILED tests/test_reviewer_worker.py::test_two_claimers_never_take_the_same_row
+FAILED tests/test_reviewer_worker.py::test_second_claimer_gets_nothing_when_only_row_is_locked
+3 failed, 34 passed in 27.02s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/green-expanded17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/green-expanded17.txt
new file mode 100644
index 0000000..4e266da
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/green-expanded17.txt
@@ -0,0 +1,84 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..............F......................................................... [ 87%]
+..........                                                               [100%]
+=================================== FAILURES ===================================
+_____________ test_real_reviewer_sigterm_bounds_stalled_request[3] _____________
+
+parallelism = 3
+tmp_path = PosixPath('/tmp/pytest-of-agent/pytest-59/test_real_reviewer_sigterm_bou1')
+
+    @pytest.mark.parametrize('parallelism', [1, 3])
+    def test_real_reviewer_sigterm_bounds_stalled_request(parallelism, tmp_path):
+        marker = tmp_path / 'ready'
+        code = '''
+    import pathlib, sys, time
+    from reviewer import worker
+    worker.DRAIN_SECONDS = 0.1
+    worker.config.REVIEW_WORKER_PARALLELISM = int(sys.argv[2])
+    worker.config.has_api_key = lambda: True
+    class Conn:
+        def close(self): pass
+    worker.jdb.connect = Conn
+    def stalled(conn):
+        pathlib.Path(sys.argv[1]).touch()
+        time.sleep(60)
+    worker.process_one = stalled
+    worker.main()
+    '''
+        process = subprocess.Popen([sys.executable, '-c', code, str(marker), str(parallelism)])
+        try:
+            deadline = time.monotonic() + 5
+            while not marker.exists() and process.poll() is None and time.monotonic() < deadline:
+                time.sleep(0.01)
+            assert marker.exists()
+            process.terminate()
+>           assert process.wait(timeout=3) == 0
+                   ^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_supervisor.py:321:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/subprocess.py:1264: in wait
+    return self._wait(timeout=timeout)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <Popen: returncode: -9 args: ['/workspace/job-board/.claude/worktrees/lifecy...>
+timeout = 3
+
+    def _wait(self, timeout):
+        """Internal implementation of wait() on POSIX."""
+        if self.returncode is not None:
+            return self.returncode
+
+        if timeout is not None:
+            endtime = _time() + timeout
+            # Enter a busy loop if we have a timeout.  This busy loop was
+            # cribbed from Lib/threading.py in Thread.wait() at r71065.
+            delay = 0.0005 # 500 us -> initial delay of 1 ms
+            while True:
+                if self._waitpid_lock.acquire(False):
+                    try:
+                        if self.returncode is not None:
+                            break  # Another thread waited.
+                        (pid, sts) = self._try_wait(os.WNOHANG)
+                        assert pid == self.pid or pid == 0
+                        if pid == self.pid:
+                            self._handle_exitstatus(sts)
+                            break
+                    finally:
+                        self._waitpid_lock.release()
+                remaining = self._remaining_time(endtime)
+                if remaining <= 0:
+>                   raise TimeoutExpired(self.args, timeout)
+E                   subprocess.TimeoutExpired: Command '['/workspace/job-board/.claude/worktrees/lifecycle-recovery/.venv/bin/python', '-c', '\nimport pathlib, sys, time\nfrom reviewer import worker\nworker.DRAIN_SECONDS = 0.1\nworker.config.REVIEW_WORKER_PARALLELISM = int(sys.argv[2])\nworker.config.has_api_key = lambda: True\nclass Conn:\n    def close(self): pass\nworker.jdb.connect = Conn\ndef stalled(conn):\n    pathlib.Path(sys.argv[1]).touch()\n    time.sleep(60)\nworker.process_one = stalled\nworker.main()\n', '/tmp/pytest-of-agent/pytest-59/test_real_reviewer_sigterm_bou1/ready', '3']' timed out after 3 seconds
+
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/subprocess.py:2045: TimeoutExpired
+----------------------------- Captured stderr call -----------------------------
+2026-10-07 15:03:00,612 INFO reviewer.worker review worker started (parallelism=3, poll=15s, stale=30min)
+2026-10-07 15:03:00,613 INFO reviewer.worker review loop 0 started (poll=15s, stale=30min)
+2026-10-07 15:03:00,613 INFO reviewer.worker review loop 1 started (poll=15s, stale=30min)
+2026-10-07 15:03:00,618 INFO reviewer.worker review loop 2 started (poll=15s, stale=30min)
+2026-10-07 15:03:00,621 INFO reviewer.worker shutdown signal received; finishing in-flight work then exiting
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_supervisor.py::test_real_reviewer_sigterm_bounds_stalled_request[3]
+1 failed, 81 passed in 36.84s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/green-measured17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/green-measured17.txt
new file mode 100644
index 0000000..4dcad3f
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/green-measured17.txt
@@ -0,0 +1,7 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+RESOURCE server: 17.11 (Debian 17.11-1.pgdg13+2)
+RESOURCE Python: 3.12.14
+........................................................................ [ 86%]
+...........                                                              [100%]
+83 passed in 37.53s
+RESOURCE {"wall_seconds": 38.193, "child_user_cpu_seconds": 4.195, "child_system_cpu_seconds": 1.053, "waited_child_max_rss_kib": 56276, "sampled_peak_test_process_tree_rss_bytes": 90001408, "sampled_peak_test_database_connections": 4, "database_connections_before": 0, "database_connections_after": 0, "monitor_extra_connections": 1, "samples": 632, "sampling_interval_seconds": 0.05, "scope": "test client processes; excludes DB server CPU/memory and harness/container overhead"}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/green-process.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/green-process.txt
new file mode 100644
index 0000000..dff3ce4
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/green-process.txt
@@ -0,0 +1,2 @@
+.............                                                            [100%]
+13 passed, 4 deselected in 4.17s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/measure_tests.py b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/measure_tests.py
new file mode 100644
index 0000000..283cfeb
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/measure_tests.py
@@ -0,0 +1,66 @@
+"""Local test resource measurement; reads only the harness-owned PostgreSQL."""
+import json
+import os
+from pathlib import Path
+import resource
+import subprocess
+import sys
+import time
+
+import psycopg
+
+
+def tree_rss(root):
+    rows = {}
+    for path in Path('/proc').iterdir():
+        if not path.name.isdigit():
+            continue
+        try:
+            stat = (path / 'stat').read_text().rsplit(')', 1)[1].split()
+            rows[int(path.name)] = (int(stat[1]), int(stat[21]) * os.sysconf('SC_PAGE_SIZE'))
+        except (OSError, ValueError, IndexError):
+            continue
+    owned = {root}
+    while True:
+        expanded = owned | {pid for pid, (parent, _) in rows.items() if parent in owned}
+        if expanded == owned:
+            break
+        owned = expanded
+    return sum(rss for pid, (_, rss) in rows.items() if pid in owned)
+
+
+with psycopg.connect(os.environ['TEST_DATABASE_URL'], autocommit=True) as monitor:
+    print('RESOURCE server:', monitor.execute('SHOW server_version').fetchone()[0], flush=True)
+    print('RESOURCE Python:', sys.version.split()[0], flush=True)
+    baseline = monitor.execute("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid()").fetchone()[0]
+    started = time.monotonic()
+    child = subprocess.Popen([sys.executable, '-m', 'pytest', *sys.argv[1:]])
+    peak_rss = peak_connections = samples = 0
+    try:
+        while child.poll() is None:
+            peak_rss = max(peak_rss, tree_rss(child.pid))
+            count = monitor.execute("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid()").fetchone()[0]
+            peak_connections = max(peak_connections, count)
+            samples += 1
+            time.sleep(0.05)
+        code = child.wait(timeout=1)
+    finally:
+        if child.poll() is None:
+            child.kill()
+            child.wait(timeout=5)
+    usage = resource.getrusage(resource.RUSAGE_CHILDREN)
+    remaining = monitor.execute("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid()").fetchone()[0]
+    print('RESOURCE ' + json.dumps({
+        'wall_seconds': round(time.monotonic() - started, 3),
+        'child_user_cpu_seconds': round(usage.ru_utime, 3),
+        'child_system_cpu_seconds': round(usage.ru_stime, 3),
+        'waited_child_max_rss_kib': usage.ru_maxrss,
+        'sampled_peak_test_process_tree_rss_bytes': peak_rss,
+        'sampled_peak_test_database_connections': peak_connections,
+        'database_connections_before': baseline,
+        'database_connections_after': remaining,
+        'monitor_extra_connections': 1, 'samples': samples,
+        'sampling_interval_seconds': 0.05,
+        'scope': 'test client processes; excludes DB server CPU/memory and harness/container overhead',
+    }), flush=True)
+    sys.exit(code)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/red-drain-deadline.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/red-drain-deadline.txt
new file mode 100644
index 0000000..0bc112a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/red-drain-deadline.txt
@@ -0,0 +1,25 @@
+F                                                                        [100%]
+=================================== FAILURES ===================================
+_________ test_shutdown_does_not_extend_maintenance_90_second_deadline _________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fcddd352e10>
+
+    def test_shutdown_does_not_extend_maintenance_90_second_deadline(monkeypatch):
+        s = supervisor()
+        clock = Clock()
+        monkeypatch.setattr(s.time, 'sleep', lambda delay: setattr(clock, 'now', clock.now + delay))
+        children = {}
+
+        def spawn(name):
+            children[name] = Child(clock, ignores_term=True)
+            return children[name]
+
+        assert s.supervise(Stop(clock, 85), spawn, clock) == 0
+>       assert children['maintenance'].killed == 90
+E       assert 115.0 == 90
+E        +  where 115.0 = <tests.test_lifecycle_supervisor.Child object at 0x7fcddd3533b0>.killed
+
+tests/test_lifecycle_supervisor.py:374: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_supervisor.py::test_shutdown_does_not_extend_maintenance_90_second_deadline
+1 failed in 0.10s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/red17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/red17.txt
new file mode 100644
index 0000000..97660f1
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/red17.txt
@@ -0,0 +1,452 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FFFFFFFFFFFFF.FF.....................                                    [100%]
+=================================== FAILURES ===================================
+_____ test_stalled_reviewer_does_not_block_startup_or_quarter_hour_sweeps ______
+
+    def test_stalled_reviewer_does_not_block_startup_or_quarter_hour_sweeps():
+>       s = supervisor()
+            ^^^^^^^^^^^^
+
+tests/test_lifecycle_supervisor.py:76:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_supervisor.py:17: in supervisor
+    return importlib.import_module('reviewer.supervisor')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'reviewer.supervisor', import_ = <function _gcd_import at 0x7f8eccd200e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'reviewer.supervisor'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+___ test_maintenance_deadline_and_crash_wait_for_next_tick_reviewer_restarts ___
+
+    def test_maintenance_deadline_and_crash_wait_for_next_tick_reviewer_restarts():
+>       s = supervisor()
+            ^^^^^^^^^^^^
+
+tests/test_lifecycle_supervisor.py:93:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_supervisor.py:17: in supervisor
+    return importlib.import_module('reviewer.supervisor')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'reviewer.supervisor', import_ = <function _gcd_import at 0x7f8eccd200e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'reviewer.supervisor'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+_______ test_shutdown_has_one_global_30_second_drain_and_no_new_children _______
+
+    def test_shutdown_has_one_global_30_second_drain_and_no_new_children():
+>       s = supervisor()
+            ^^^^^^^^^^^^
+
+tests/test_lifecycle_supervisor.py:116:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_supervisor.py:17: in supervisor
+    return importlib.import_module('reviewer.supervisor')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'reviewer.supervisor', import_ = <function _gcd_import at 0x7f8eccd200e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'reviewer.supervisor'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+________ test_spawn_failure_returns_nonzero_and_drains_started_sibling _________
+
+    def test_spawn_failure_returns_nonzero_and_drains_started_sibling():
+>       s = supervisor()
+            ^^^^^^^^^^^^
+
+tests/test_lifecycle_supervisor.py:133:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_supervisor.py:17: in supervisor
+    return importlib.import_module('reviewer.supervisor')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'reviewer.supervisor', import_ = <function _gcd_import at 0x7f8eccd200e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'reviewer.supervisor'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+_____________________ test_already_stopped_starts_nothing ______________________
+
+    def test_already_stopped_starts_nothing():
+>       s = supervisor()
+            ^^^^^^^^^^^^
+
+tests/test_lifecycle_supervisor.py:147:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_supervisor.py:17: in supervisor
+    return importlib.import_module('reviewer.supervisor')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'reviewer.supervisor', import_ = <function _gcd_import at 0x7f8eccd200e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'reviewer.supervisor'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+________________ test_deployment_only_changes_reviewer_command _________________
+
+    def test_deployment_only_changes_reviewer_command():
+        cfg = json.loads(Path('railway.reviewer-worker.json').read_text())['deploy']
+>       assert cfg == {'startCommand': 'python -m reviewer.supervisor',
+                       'restartPolicyType': 'ON_FAILURE', 'restartPolicyMaxRetries': 100}
+E       AssertionError: assert {'startComman...Retries': 100} == {'startComman...Retries': 100}
+E
+E         Omitting 2 identical items, use -vv to show
+E         Differing items:
+E         {'startCommand': 'python -m reviewer.worker'} != {'startCommand': 'python -m reviewer.supervisor'}
+E         Use -v to get more diff
+
+tests/test_lifecycle_supervisor.py:153: AssertionError
+___________ test_real_children_deadline_and_terminated_external_cron ___________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f8ec8acab40>
+
+    def test_real_children_deadline_and_terminated_external_cron(monkeypatch):
+>       s = supervisor()
+            ^^^^^^^^^^^^
+
+tests/test_lifecycle_supervisor.py:161:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_supervisor.py:17: in supervisor
+    return importlib.import_module('reviewer.supervisor')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'reviewer.supervisor', import_ = <function _gcd_import at 0x7f8eccd200e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'reviewer.supervisor'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+_________________ test_worker_flag_off_closes_owned_connection _________________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32950 user=postgres database=poller_lifecycle_test) at 0x7f8ec8a9a5a0>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f8ec8a9aae0>
+
+    @requires_db
+    def test_worker_flag_off_closes_owned_connection(conn, monkeypatch):
+>       w = maintenance_worker()
+            ^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_supervisor.py:196:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_supervisor.py:21: in maintenance_worker
+    return importlib.import_module('job_discovery.lifecycle.worker')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'job_discovery.lifecycle.worker'
+import_ = <function _gcd_import at 0x7f8eccd200e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'job_discovery.lifecycle.worker'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+__________ test_worker_scheduled_sweep_and_normal_restart_generations __________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32950 user=postgres database=poller_lifecycle_test) at 0x7f8ec8acb110>
+
+    @requires_db
+    def test_worker_scheduled_sweep_and_normal_restart_generations(conn):
+>       w = maintenance_worker()
+            ^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_supervisor.py:214:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_supervisor.py:21: in maintenance_worker
+    return importlib.import_module('job_discovery.lifecycle.worker')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'job_discovery.lifecycle.worker'
+import_ = <function _gcd_import at 0x7f8eccd200e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'job_discovery.lifecycle.worker'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+______ test_worker_contended_claim_is_blocked_then_recovers_after_release ______
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32950 user=postgres database=poller_lifecycle_test) at 0x7f8ec8acbda0>
+
+    @requires_db
+    def test_worker_contended_claim_is_blocked_then_recovers_after_release(conn):
+>       w = maintenance_worker()
+            ^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_supervisor.py:230:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_supervisor.py:21: in maintenance_worker
+    return importlib.import_module('job_discovery.lifecycle.worker')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'job_discovery.lifecycle.worker'
+import_ = <function _gcd_import at 0x7f8eccd200e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'job_discovery.lifecycle.worker'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+______ test_worker_failure_rolls_back_cancels_claim_and_next_worker_runs _______
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32950 user=postgres database=poller_lifecycle_test) at 0x7f8ec8b35c70>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f8ec8b34530>
+
+    @requires_db
+    def test_worker_failure_rolls_back_cancels_claim_and_next_worker_runs(conn, monkeypatch):
+>       w = maintenance_worker()
+            ^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_supervisor.py:243:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_supervisor.py:21: in maintenance_worker
+    return importlib.import_module('job_discovery.lifecycle.worker')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'job_discovery.lifecycle.worker'
+import_ = <function _gcd_import at 0x7f8eccd200e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'job_discovery.lifecycle.worker'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+________________________ test_approved_timing_constants ________________________
+
+    def test_approved_timing_constants():
+>       s = supervisor()
+            ^^^^^^^^^^^^
+
+tests/test_lifecycle_supervisor.py:263:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+tests/test_lifecycle_supervisor.py:17: in supervisor
+    return importlib.import_module('reviewer.supervisor')
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+<frozen importlib._bootstrap>:1387: in _gcd_import
+    ???
+<frozen importlib._bootstrap>:1360: in _find_and_load
+    ???
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+name = 'reviewer.supervisor', import_ = <function _gcd_import at 0x7f8eccd200e0>
+
+>   ???
+E   ModuleNotFoundError: No module named 'reviewer.supervisor'
+
+<frozen importlib._bootstrap>:1324: ModuleNotFoundError
+______________ test_reviewer_drain_returns_when_review_is_stalled ______________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f8ec8b36240>
+
+    def test_reviewer_drain_returns_when_review_is_stalled(monkeypatch):
+        from reviewer import worker
+        stop = worker._Stop()
+        stop.request()
+        release = threading.Event()
+        thread = threading.Thread(target=release.wait, daemon=True)
+        thread.start()
+        clock = Clock()
+        monkeypatch.setattr(worker.time, 'monotonic', clock)
+>       monkeypatch.setattr(worker, 'DRAIN_SECONDS', 0.01)
+E       AttributeError: <module 'reviewer.worker' from '/workspace/job-board/.claude/worktrees/lifecycle-recovery/reviewer/worker.py'> has no attribute 'DRAIN_SECONDS'
+
+tests/test_lifecycle_supervisor.py:278: AttributeError
+__________________ test_two_claimers_never_take_the_same_row ___________________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32950 user=postgres database=poller_lifecycle_test) at 0x7f8ec8acb290>
+
+    @requires_db
+    def test_two_claimers_never_take_the_same_row(conn):
+        # Two pending rows (distinct users — the partial unique index forbids two active
+        # per user). Two concurrent connections must claim DIFFERENT rows (SKIP LOCKED).
+        _enqueue(conn, UA)
+        _enqueue(conn, UB)
+        conn2 = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            c1 = rdb.claim_next_review_request(conn)   # locks row 1 (uncommitted)
+>           c2 = rdb.claim_next_review_request(conn2)  # must skip the locked row → row 2
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_reviewer_worker.py:72:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+reviewer/db.py:395: in claim_next_review_request
+    cur.execute(
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f8ec8aecdd0>
+query = "\n            UPDATE review_requests SET status = 'running', started_at = now(),\n                   claim_version = ...         FOR UPDATE SKIP LOCKED LIMIT 1\n            )\n            RETURNING id, user_id, claim_version\n            "
+params = None, prepare = None, binary = None
+
+    def execute(
+        self,
+        query: Query,
+        params: Params | None = None,
+        *,
+        prepare: bool | None = None,
+        binary: bool | None = None,
+    ) -> Self:
+        """
+        Execute a query or command to the database.
+        """
+        try:
+            with self._conn.lock:
+                self._conn.wait(
+                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+                )
+        except e._NO_TRACEBACK as ex:
+>           raise ex.with_traceback(None)
+E           psycopg.errors.LockNotAvailable: canceling statement due to lock timeout
+E           CONTEXT:  SQL statement "SELECT pg_advisory_xact_lock(20916294442894917)"
+E           PL/pgSQL function public.lifecycle_gate() line 6 at PERFORM
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: LockNotAvailable
+___________ test_second_claimer_gets_nothing_when_only_row_is_locked ___________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32950 user=postgres database=poller_lifecycle_test) at 0x7f8ec8b369c0>
+
+    @requires_db
+    def test_second_claimer_gets_nothing_when_only_row_is_locked(conn):
+        _enqueue(conn, UA)
+        conn2 = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            c1 = rdb.claim_next_review_request(conn)   # locks the only pending row
+>           c2 = rdb.claim_next_review_request(conn2)  # SKIP LOCKED → nothing
+                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_reviewer_worker.py:87:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+reviewer/db.py:395: in claim_next_review_request
+    cur.execute(
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f8eca76f710>
+query = "\n            UPDATE review_requests SET status = 'running', started_at = now(),\n                   claim_version = ...         FOR UPDATE SKIP LOCKED LIMIT 1\n            )\n            RETURNING id, user_id, claim_version\n            "
+params = None, prepare = None, binary = None
+
+    def execute(
+        self,
+        query: Query,
+        params: Params | None = None,
+        *,
+        prepare: bool | None = None,
+        binary: bool | None = None,
+    ) -> Self:
+        """
+        Execute a query or command to the database.
+        """
+        try:
+            with self._conn.lock:
+                self._conn.wait(
+                    self._execute_gen(query, params, prepare=prepare, binary=binary)
+                )
+        except e._NO_TRACEBACK as ex:
+>           raise ex.with_traceback(None)
+E           psycopg.errors.LockNotAvailable: canceling statement due to lock timeout
+E           CONTEXT:  SQL statement "SELECT pg_advisory_xact_lock(20916294442894917)"
+E           PL/pgSQL function public.lifecycle_gate() line 6 at PERFORM
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: LockNotAvailable
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_supervisor.py::test_stalled_reviewer_does_not_block_startup_or_quarter_hour_sweeps
+FAILED tests/test_lifecycle_supervisor.py::test_maintenance_deadline_and_crash_wait_for_next_tick_reviewer_restarts
+FAILED tests/test_lifecycle_supervisor.py::test_shutdown_has_one_global_30_second_drain_and_no_new_children
+FAILED tests/test_lifecycle_supervisor.py::test_spawn_failure_returns_nonzero_and_drains_started_sibling
+FAILED tests/test_lifecycle_supervisor.py::test_already_stopped_starts_nothing
+FAILED tests/test_lifecycle_supervisor.py::test_deployment_only_changes_reviewer_command
+FAILED tests/test_lifecycle_supervisor.py::test_real_children_deadline_and_terminated_external_cron
+FAILED tests/test_lifecycle_supervisor.py::test_worker_flag_off_closes_owned_connection
+FAILED tests/test_lifecycle_supervisor.py::test_worker_scheduled_sweep_and_normal_restart_generations
+FAILED tests/test_lifecycle_supervisor.py::test_worker_contended_claim_is_blocked_then_recovers_after_release
+FAILED tests/test_lifecycle_supervisor.py::test_worker_failure_rolls_back_cancels_claim_and_next_worker_runs
+FAILED tests/test_lifecycle_supervisor.py::test_approved_timing_constants - M...
+FAILED tests/test_lifecycle_supervisor.py::test_reviewer_drain_returns_when_review_is_stalled
+FAILED tests/test_reviewer_worker.py::test_two_claimers_never_take_the_same_row
+FAILED tests/test_reviewer_worker.py::test_second_claimer_gets_nothing_when_only_row_is_locked
+15 failed, 22 passed in 13.80s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/ruff.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/ruff.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-report.md
new file mode 100644
index 0000000..cd1dd5c
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-report.md
@@ -0,0 +1,178 @@
+# Task 5 — independent maintenance supervisor
+
+BASE: `ee9cef2849b966835807c6c84d00cf2a8ed62788`. Sole fresh author in
+`/workspace/job-board/.claude/worktrees/lifecycle-recovery`, bash/login:false.
+Read `REVIEW-SCOPE-AMENDMENT.md` and `RELEASE-AUTHORIZATION.md` first, followed
+by the exact Task 5 brief/dispatch, repository instructions and accepted Task 4
+interfaces/report. No author subagents or reviewers were used.
+
+Task 3 is a usable development basis, **not fully security-approved**. Independent
+expiry-enforcement, capacity-accounting, cross-user-isolation and related
+adversarial review gaps remain open. This is author implementation and ordinary
+verification, not an independent requirements, quality or security verdict.
+
+The provided production reference `114cce96cb244546864a6bddc5476b5630bc024a`
+is an ancestor of HEAD. The local `origin/main` reference remains
+`73ce118205bfdbb56c18207acc0c1c4e3708c860`; no newer local upstream delta was
+found. The author did not fetch external upstream state. Controller release
+preflight and eventual completed-upgrade release are separate work.
+
+## Implemented behavior
+
+`reviewer.supervisor.supervise(stop, spawn, clock)` starts the reviewer and a
+separate one-shot maintenance process at startup. Maintenance runs every 900
+monotonic seconds regardless of reviewer progress or the discovery cron's
+lifetime. Checks occur at most five seconds apart, clipped to maintenance's
+90-second process deadline. At that deadline the process is killed, including
+when shutdown is already in progress. Successful, failed and timed-out sweeps
+wait for the next scheduled tick; missed ticks are skipped instead of replayed
+in a burst. Reviewer exit restarts just that child on the next check.
+
+SIGTERM/SIGINT stops new children and signals both existing children to drain.
+One shared 30-second deadline bounds cooperative drain; remaining children are
+killed at that deadline. There is one further shared second solely for bounded
+kernel-exit reaping, not an extension of cooperative work. No child wait/join is
+unbounded. Failure to spawn/manage/reap exits nonzero for the service restart
+policy. Child stdout/stderr are inherited, avoiding unconsumed subprocess pipes.
+The supervisor owns no DB connections. Only reviewer and maintenance children
+are registered; Task 11 export registration remains absent/disabled.
+
+`job_discovery.lifecycle.worker.run_maintenance_once(dsn)` owns one connection,
+reads the existing service control under the existing gate, acquires the existing
+maintenance singleton claim, and calls the accepted sweep with `scheduled=True`.
+Flag-off performs no sweep and closes the connection. Claim contention returns a
+blocked result. Normal completion, ordinary failure and cooperative SIGTERM
+roll back unfinished work and cancel the owned claim before closing. Failed
+release retains the persisted lease for recovery and reports blocked. A hard
+process kill can leave a claim active until expiry; the next ordinary acquisition
+uses existing DB-time validation and generation fencing before recovery. No
+client clock bypass, SQL change, gate change or claim-policy change was added.
+
+The accepted sweep retains its 120-second lease, renewal at most 30 seconds apart,
+90-second cooperative deadline, two-second lock and five-second statement bounds,
+2,000/20,000 cleanup limits, checkpoint commits and readiness-enforced dry-run.
+The new parent adds a process deadline around connection/startup/sweep/cleanup.
+No HTTP/model/S3 work is introduced into this worker or its transactions.
+
+Reviewer changes are limited to bounded drain integration: all loop counts use
+connection-owning daemon threads, including K=1, so a permanently stalled
+request cannot prevent process exit. Signal delivery records the drain deadline;
+thread joins recheck it individually. The single-loop SystemExit contract and
+parallel fatal/nonzero behavior are preserved. Normal loops still finish their
+request and close their connection; forced process exit relies on existing queue
+recovery, not invented successful completion.
+
+Only `railway.reviewer-worker.json`'s startCommand changes, to
+`python -m reviewer.supervisor`. ON_FAILURE and 100 retries are preserved.
+`railway.json`, `railway.discovery.json`, and `job_discovery/__main__.py` have no
+diff from BASE. The separately configured daily `0 0 * * *` UTC cron and one-shot
+entry point are untouched. No provider configuration was written or activated.
+
+## Verification chronology and scope
+
+Exact commands and complete sanitized output are in `task-5-evidence/`.
+Every DB run uses the accepted harness with its own random loopback port and
+owned disposable PostgreSQL container. No shared 55432 instance, destructive
+feedback fixture, production endpoint, paid/model/provider call or external
+storage was used. Existing `.venv` was reused; no dependency installation.
+
+- `red17.txt`: **15 failed, 22 passed**. Thirteen expected new-task failures
+  demonstrate the missing supervisor/worker/drain/configuration interfaces.
+  Two pre-existing reviewer tests fail because they sequentially attempt a
+  second write while the first connection holds the now-global statement gate:
+  `test_two_claimers_never_take_the_same_row` and
+  `test_second_claimer_gets_nothing_when_only_row_is_locked`.
+- `green-attempt17.txt`: **3 failed, 34 passed**. The first implementation exposed
+  a real subprocess reaping race, plus those two inherited fixture failures.
+  Reaping now has the explicit shared bound described above. The first queue
+  fixture now runs its second claimant on a controlled sibling thread and commits
+  the first before joining. The second uses a plain row lock to isolate SKIP
+  LOCKED behavior. Exactly-once/distinct-row and no-row assertions remain; no
+  database gate or policy was weakened. Controller confirmed this ordinary
+  fixture adaptation is in scope.
+- `green-expanded17.txt`: **1 failed, 81 passed**. A real K=3 stalled reviewer
+  exposed deadline observation delayed across three joins. The signal now records
+  the deadline and every individual join checks it.
+- `red-drain-deadline.txt`: **1 failed**. Shutdown initially extended maintenance
+  past its original process deadline. The drain loop now independently enforces
+  that original deadline; the regression expects maintenance killed at 90 seconds
+  and a reviewer stopped at its separate 30-second drain deadline.
+- `green-process.txt`: **13 passed, 4 deselected**. An intentionally process-only
+  selection excluded DB tests by name; this is not the required DB covering lane.
+- `green-measured17.txt`: **83 passed, zero skips**, before adding the final real
+  maintenance SIGTERM integration case. Final covering runs supersede it.
+
+Final covering scope includes the entire `test_lifecycle_supervisor.py`,
+`test_reviewer_worker.py`, `test_lifecycle_maintenance.py`, and
+`test_maintenance_controlflow.py` modules. Controlled fake clocks prove startup,
+900-second recurrence, restart isolation, 90-second kill, shared drain, spawn
+failure and already-stopped behavior. Real children prove stalled-reviewer
+independence from a terminated external cron, bounded SIGTERM with K=1/K=3,
+supervisor signal handling and repeated startup. A real maintenance subprocess
+acquires its persisted claim, receives SIGTERM, releases normally, and a fresh
+worker/connection completes the next sweep. Ordinary DB tests cover flag-off,
+claim contention/release, failure rollback, scheduled health, increasing normal
+restart generations and connection closure. Existing accepted sweep timing tests
+exercise actual bounded transaction flow and renewal on both server versions.
+
+No excluded lifecycle security modules or refused probes were run, reconstructed,
+split or delegated. In particular this work does not independently establish
+expired/stale callback rejection at commit time, adversarial capacity accounting
+or tenant isolation. Existing reviewer queue claim-version/recovery tests are
+ordinary queue regressions, not substitutes for that missing lifecycle security
+review. Normal generation/replay-floor observations are not an adversarial verdict.
+A repository-wide pytest run would enter the explicitly excluded review scope;
+the dispatch's selected covering suite takes precedence over generic skill advice.
+
+## Final results and resource measurements
+
+Python: **3.12.14**. Final lane versions, results and resource figures follow.
+The measurement helper is included in evidence for reproducibility; it samples
+only test subprocesses and the harness-owned database, never credentials.
+
+| Metric | PostgreSQL 17 lane | PostgreSQL 16 lane |
+| --- | --- | --- |
+| Server | 17.11 (Debian 17.11-1.pgdg13+2) | 16.15 (Debian 16.15-1.pgdg13+2) |
+| Result | **84 passed, zero skipped** | **84 passed, zero skipped** |
+| Pytest wall time | 49.03 s | 56.95 s |
+| Measured command wall time | 49.773 s | 57.951 s |
+| Waited child user CPU | 6.914 s | 6.034 s |
+| Waited child system CPU | 1.583 s | 1.379 s |
+| Waited child maximum RSS | 56,528 KiB | 56,144 KiB |
+| Sampled peak test-process tree RSS | 90,390,528 bytes | 90,021,888 bytes |
+| Sampled peak test DB connections | 4 | 4 |
+| Test DB connections before / after | 0 / 0 | 0 / 0 |
+| Sampling iterations | 713 | 872 |
+
+The observer adds one separate DB connection, excluded from the test-connection
+counts. Nominal sample interval is 50 ms plus sampling/query overhead; peaks
+between samples may be missed. CPU and RSS cover test client processes (and
+waited children), not PostgreSQL server CPU/memory, Docker/harness overhead or
+production load. Shared pages can be counted more than once in the summed
+process-tree RSS. These are actual test measurements, **not cost neutrality or a
+production resource forecast**. The supervisor adds one process and no DB
+connection; a scheduled worker temporarily adds one connection alongside the
+reviewer's configured per-loop connections.
+
+Repository Ruff passed (`ruff.txt`). Working/staged whitespace checks passed.
+The final product/test source is identical across the two covering runs. The
+only edits after these runs are this report and evidence formatting/staging.
+
+Deliverables: `reviewer/supervisor.py`, `job_discovery/lifecycle/worker.py`,
+reviewer bounded drain changes, the single reviewer startCommand change,
+`tests/test_lifecycle_supervisor.py`, the two reviewer queue fixture adaptations,
+this report, and `task-5-evidence/` (commands, measurement helper, RED/GREEN logs).
+Controller ledgers, briefs, dispatch, amendment, release-preflight and reviewer
+files are explicitly excluded from author staging.
+
+No new safeguard refusal occurred. No production write, activation, external
+publication, merge, push, deployment, credential/IAM change or unrelated Railway
+mutation was performed. Default flags/dry-run/archive settings are unchanged;
+local fixture enablement is confined to disposable DBs. Completed-upgrade release
+is authorized for the controller after all 13 tasks and permitted verification;
+Task 5 alone is not the upgrade release. Safety-floor confirmation exceptions
+and the reduced independent-review gaps persist.
+
+Remaining handoff: controller's fresh permitted Task 5 requirements/code-quality
+gate and Library 05 checkpoint, then Task 6. Author verification does not replace
+that gate or imply any missing security approval.
diff --git a/job_discovery/lifecycle/worker.py b/job_discovery/lifecycle/worker.py
new file mode 100644
index 0000000..2d36ea2
--- /dev/null
+++ b/job_discovery/lifecycle/worker.py
@@ -0,0 +1,67 @@
+"""One DB-only scheduled maintenance sweep, bounded by its parent supervisor."""
+import logging
+import signal
+import sys
+
+from job_discovery import db
+from .claims import cancel_claim, claim_work
+from .config import read_control
+from .locks import enter_gate
+from .maintenance import LEASE_SECONDS, sweep
+from .types import SweepResult
+
+log = logging.getLogger(__name__)
+
+
+def run_maintenance_once(dsn: str | None) -> SweepResult:
+    conn = claim = None
+    result = SweepResult(0, 0, True, None)
+    try:
+        conn = db.connect(dsn)
+        enter_gate(conn)
+        control = read_control(conn)
+        if not control.maintenance_enabled:
+            conn.commit()
+            return SweepResult(0, 0, False, None)
+        # claim_work fences the previous expired/cancelled generation under the
+        # global gate before recovery; no worker-supplied clock or lease bypass.
+        claim = claim_work(conn, 'maintenance', 'singleton', LEASE_SECONDS)
+        conn.commit()
+        if claim is not None:
+            result = sweep(conn, claim, dry_run=control.retirement_dry_run, scheduled=True)
+    except Exception:
+        log.exception('scheduled maintenance failed')
+    finally:
+        if conn is not None:
+            try:
+                conn.rollback()
+                if claim is not None:
+                    cancel_claim(conn, claim)
+                    conn.commit()
+            except Exception:
+                log.exception('maintenance release failed; retained lease requires recovery')
+                result = SweepResult(result.retired_rows, result.retired_bytes, True, result.cursor)
+            finally:
+                conn.close()
+    return result
+
+
+def main() -> int:
+    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')
+
+    def terminate(signum, _frame):
+        # Allow finally to roll back and release normally; the parent kills a
+        # blocked connection/process at its shared 30-second shutdown deadline.
+        signal.signal(signal.SIGTERM, signal.SIG_IGN)
+        signal.signal(signal.SIGINT, signal.SIG_IGN)
+        raise SystemExit(128 + signum)
+
+    signal.signal(signal.SIGTERM, terminate)
+    signal.signal(signal.SIGINT, terminate)
+    result = run_maintenance_once(None)
+    log.info('scheduled maintenance result: %s', result)
+    return int(result.blocked)
+
+
+if __name__ == '__main__':
+    sys.exit(main())
diff --git a/railway.reviewer-worker.json b/railway.reviewer-worker.json
index 9a2dd49..bdc48f7 100644
--- a/railway.reviewer-worker.json
+++ b/railway.reviewer-worker.json
@@ -5,15 +5,15 @@
       "reviewer/**",
       "job_discovery/**",
       "observability/**",
       "requirements.txt",
       "pyproject.toml",
       "railway.reviewer-worker.json",
       "schema.sql"
     ]
   },
   "deploy": {
-    "startCommand": "python -m reviewer.worker",
+    "startCommand": "python -m reviewer.supervisor",
     "restartPolicyType": "ON_FAILURE",
     "restartPolicyMaxRetries": 100
   }
 }
diff --git a/reviewer/supervisor.py b/reviewer/supervisor.py
new file mode 100644
index 0000000..93b9295
--- /dev/null
+++ b/reviewer/supervisor.py
@@ -0,0 +1,131 @@
+"""Independent reviewer and bounded, scheduled maintenance child processes.
+
+No database connections, discovery scheduling or archive registration live here.
+The maintenance child owns its existing database lease and transactions.
+"""
+import logging
+import signal
+import subprocess
+import sys
+import threading
+import time
+from dataclasses import dataclass
+from typing import Callable
+
+log = logging.getLogger(__name__)
+CHECK_SECONDS = 5
+MAINTENANCE_INTERVAL_SECONDS = 15 * 60
+MAINTENANCE_DEADLINE_SECONDS = 90
+DRAIN_SECONDS = 30
+
+
+@dataclass
+class Child:
+    process: subprocess.Popen
+    started: float
+    killed: bool = False
+
+
+def spawn_child(name: str) -> subprocess.Popen:
+    modules = {'reviewer': 'reviewer.worker', 'maintenance': 'job_discovery.lifecycle.worker'}
+    # Inherit stdout/stderr: no pipe can fill and stall a child or the supervisor.
+    return subprocess.Popen([sys.executable, '-m', modules[name]])
+
+
+def _signal(child: Child, *, kill: bool = False) -> None:
+    try:
+        if kill:
+            child.process.kill()
+            child.killed = True
+        else:
+            child.process.terminate()
+    except ProcessLookupError:
+        pass
+
+
+def _drain(children: dict[str, Child], clock: Callable) -> bool:
+    # One global deadline, independent of child count. Never an unbounded wait.
+    deadline = clock() + DRAIN_SECONDS
+    for child in children.values():
+        if child.process.poll() is None:
+            _signal(child)
+    while any(c.process.poll() is None for c in children.values()) and clock() < deadline:
+        wake = min(deadline, clock() + CHECK_SECONDS)
+        maintenance = children.get('maintenance')
+        if maintenance is not None and maintenance.process.poll() is None and not maintenance.killed:
+            expires = maintenance.started + MAINTENANCE_DEADLINE_SECONDS
+            if clock() >= expires:
+                _signal(maintenance, kill=True)
+            else:
+                wake = min(wake, expires)
+        time.sleep(max(0, wake - clock()))
+    for child in children.values():
+        if child.process.poll() is None:
+            _signal(child, kill=True)
+    # Signals are sent by the 30-second deadline. Allow one further shared
+    # second only to reap kernel exits, never to continue cooperative work.
+    reap_deadline = clock() + 1
+    reaped = True
+    for child in children.values():
+        try:
+            child.process.wait(timeout=max(0, reap_deadline - clock()))
+        except subprocess.TimeoutExpired:
+            log.error('child did not exit after kill')
+            reaped = False
+    return reaped
+
+
+def supervise(stop: threading.Event, spawn: Callable, clock: Callable) -> int:
+    children: dict[str, Child] = {}
+    next_maintenance = clock()
+    failed = False
+    try:
+        while not stop.is_set():
+            now = clock()
+            for name, child in list(children.items()):
+                code = child.process.poll()
+                if code is not None:
+                    log.info('%s child exited status=%s', name, code)
+                    del children[name]
+                elif name == 'maintenance' and not child.killed and now >= child.started + MAINTENANCE_DEADLINE_SECONDS:
+                    log.warning('maintenance process deadline reached')
+                    # At 90 seconds no further cooperative grace is permitted.
+                    # The next claim acquisition uses the existing DB-time fence.
+                    _signal(child, kill=True)
+            if stop.is_set():
+                break
+            if 'reviewer' not in children:
+                children['reviewer'] = Child(spawn('reviewer'), clock())
+            if stop.is_set():
+                break
+            if now >= next_maintenance and 'maintenance' not in children:
+                started = clock()
+                children['maintenance'] = Child(spawn('maintenance'), started)
+                # Skip missed ticks rather than burst-replaying them after delay.
+                next_maintenance = started + MAINTENANCE_INTERVAL_SECONDS
+            wake = clock() + CHECK_SECONDS
+            child = children.get('maintenance')
+            if child is not None and not child.killed:
+                wake = min(wake, child.started + MAINTENANCE_DEADLINE_SECONDS)
+            if next_maintenance > clock():
+                wake = min(wake, next_maintenance)
+            stop.wait(max(0.001, wake - clock()))
+    except Exception:
+        log.exception('supervisor failed; draining children before service restart')
+        failed = True
+    finally:
+        if not _drain(children, clock):
+            failed = True
+    return int(failed)
+
+
+def main() -> int:
+    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')
+    stop = threading.Event()
+    for sig in (signal.SIGTERM, signal.SIGINT):
+        signal.signal(sig, lambda *_: stop.set())
+    return supervise(stop, spawn_child, time.monotonic)
+
+
+if __name__ == '__main__':
+    sys.exit(main())
diff --git a/reviewer/worker.py b/reviewer/worker.py
index 69e39eb..ddfccba 100644
--- a/reviewer/worker.py
+++ b/reviewer/worker.py
@@ -16,20 +16,21 @@ import threading
 import time
 
 from job_discovery import db as jdb
 from reviewer import config, db, run
 
 log = logging.getLogger("reviewer.worker")
 
 # 'running' requests older than this are presumed orphaned by a crashed worker and
 # failed so the user's single active slot is freed.
 STALE_MINUTES = 30
+DRAIN_SECONDS = 30
 
 # In-flight registry: request ids THIS process is actively working right now, so a
 # parallel sibling loop's recovery sweep (Task 3) never reaps a healthy long-running
 # review it doesn't own. Module-global and shared across loops, so guard it with a lock.
 _in_flight_lock = threading.Lock()
 _in_flight_ids: set[int] = set()
 
 
 def _mark_in_flight(req_id: int) -> None:
     with _in_flight_lock:
@@ -42,28 +43,30 @@ def _clear_in_flight(req_id: int) -> None:
 
 
 def _in_flight_snapshot() -> set[int]:
     """A copy of the current in-flight ids, taken under the lock, so the caller can
     iterate/pass it without racing concurrent mark/clear on another loop."""
     with _in_flight_lock:
         return set(_in_flight_ids)
 
 
 class _Stop:
-    """Cooperative shutdown flag set by SIGTERM/SIGINT so the loop exits cleanly
-    AFTER the in-flight request finishes (never mid-review)."""
+    """Request cooperative shutdown with a bounded in-flight drain window."""
 
     def __init__(self) -> None:
         self.stop = False
+        self.deadline = None
 
     def request(self, *_a) -> None:
-        log.info("shutdown signal received; finishing in-flight work then exiting")
+        log.info("shutdown signal received; draining in-flight work for at most 30 seconds")
+        if self.deadline is None:
+            self.deadline = time.monotonic() + DRAIN_SECONDS
         self.stop = True
 
 
 def process_one(conn) -> bool:
     """Recover stale claims, then claim + process one pending request. Returns True if
     a request was handled (caller should poll again immediately), False if the queue
     was empty (caller should sleep). Per-request isolation: any failure is recorded on
     the request row and never propagates out of this function."""
     recovered = db.recover_stale_review_requests(
         conn, STALE_MINUTES, exclude_ids=_in_flight_snapshot()
@@ -150,24 +153,23 @@ def reconnect(conn):
 def _run_loop(stop, fatal, idx) -> None:
     """One worker loop: claim + process requests until a shutdown (`stop`) or a sibling
     loop's fatal event (`fatal`) fires.
 
     Owns its OWN connection: threads must NEVER share a psycopg connection — per-request
     transactions and the session-level advisory locks _review_user takes are all
     connection-scoped — so each loop opens one via jdb.connect() and closes it in a
     finally. The claim path (FOR UPDATE SKIP LOCKED) lets K loops on separate connections
     poll the same queue without ever double-claiming.
 
-    A SystemExit from reconnect (DB genuinely down) propagates OUT of here UNCAUGHT: the
-    caller decides what it means — K=1 runs this on the main thread so it exits the
-    process exactly as the historical single-loop worker did; K>1 runs it in a thread
-    whose wrapper converts the SystemExit into `fatal` so the whole process restarts.
+    A SystemExit from reconnect propagates to the thread wrapper, which requests
+    bounded sibling drain. main() preserves the single-loop exit code and exits
+    nonzero on parallel-loop failure so the supervisor restarts this child.
     """
     poll = config.REVIEW_WORKER_POLL_SECONDS
     conn = jdb.connect()
     log.info("review loop %s started (poll=%ss, stale=%smin)", idx, poll, STALE_MINUTES)
     try:
         while not stop.stop and not fatal.is_set():
             try:
                 handled = process_one(conn)
             except Exception:
                 # A failure in claim/recover itself (e.g. a dropped connection) must not
@@ -182,78 +184,89 @@ def _run_loop(stop, fatal, idx) -> None:
                 # is honored promptly.
                 for _ in range(poll):
                     if stop.stop or fatal.is_set():
                         break
                     time.sleep(1)
     finally:
         conn.close()
         log.info("review loop %s stopped", idx)
 
 
+def _drain_threads(threads, stop, fatal) -> bool:
+    """Wait for loops, allowing at most 30 seconds after stop/fatal is observed.
+
+    Daemon threads allow process exit even when a provider call never returns.
+    The supervisor independently enforces the same bound from signal delivery.
+    """
+    deadline = None
+    while any(t.is_alive() for t in threads):
+        for thread in threads:
+            if stop.stop:
+                deadline = stop.deadline if deadline is None else min(deadline, stop.deadline)
+            elif deadline is None and fatal.is_set():
+                deadline = time.monotonic() + DRAIN_SECONDS
+            remaining = 1.0 if deadline is None else min(1.0, deadline - time.monotonic())
+            if remaining <= 0:
+                return False
+            thread.join(timeout=remaining)
+    return True
+
+
 def main() -> None:
     logging.basicConfig(
         level=logging.INFO,
         format="%(asctime)s %(levelname)s %(name)s %(message)s",
     )
     if not config.has_api_key():
         log.warning("OPENROUTER_API_KEY not set; requests will fail until it is configured")
 
     stop = _Stop()
-    # Signal handlers must be installed on the main thread (signal.signal only works
-    # there); a set stop.stop then drains every loop, and fatal drains them the same way.
+    # Keep signals on the main thread while each review loop owns its connection.
+    # Both a stop signal and a fatal sibling start a bounded drain.
     signal.signal(signal.SIGTERM, stop.request)
     signal.signal(signal.SIGINT, stop.request)
 
     fatal = threading.Event()
     k = config.REVIEW_WORKER_PARALLELISM  # read at call time so tests can monkeypatch it
     log.info(
         "review worker started (parallelism=%s, poll=%ss, stale=%smin)",
         k, config.REVIEW_WORKER_POLL_SECONDS, STALE_MINUTES,
     )
 
-    if k <= 1:
-        # Single loop on the main thread: a SystemExit from reconnect propagates out
-        # exactly as it did historically (preserves Railway restart semantics and the
-        # existing reconnect tests). No thread wrapper, no fatal conversion. On a clean
-        # shutdown (stop set) _run_loop returns and we log the same stop line the K>1 path
-        # and the historical single-loop worker emit; a SystemExit skips it (as does the
-        # K>1 path's sys.exit), keeping behavior otherwise identical.
-        _run_loop(stop, fatal, 0)
-        log.info("review worker stopped")
-        return
+    exits = []
 
     def _thread_body(idx):
         # Fail CLOSED: ANY exception escaping _run_loop must set `fatal` so main() exits
         # nonzero for a Railway restart — otherwise a thread that dies silently (e.g. the
         # initial jdb.connect() at loop entry raising when the DB is down at startup, which
         # is NOT routed through reconnect) would leave `fatal` unset and the process exit 0,
         # staying down. Keep the arms separate: SystemExit is a BaseException (from
         # reconnect, already logged there); the Exception arm needs its own log.exception.
         try:
             _run_loop(stop, fatal, idx)
-        except SystemExit:
+        except SystemExit as exc:
+            exits.append(exc)
             fatal.set()  # a loop's reconnect gave up → whole process must restart
         except Exception:
             log.exception("review loop %s crashed; draining siblings for a restart", idx)
             fatal.set()
 
     threads = [
-        threading.Thread(target=_thread_body, args=(i,), name=f"review-loop-{i}", daemon=False)
+        threading.Thread(target=_thread_body, args=(i,), name=f"review-loop-{i}", daemon=True)
         for i in range(k)
     ]
     for t in threads:
         t.start()
-    # Join in 1s slices so the main thread stays responsive: signal handlers only run on
-    # the main thread and only get scheduled between its bytecode ops, so a bare
-    # (untimed) join would starve the SIGTERM handler and defeat graceful drain.
-    while any(t.is_alive() for t in threads):
-        for t in threads:
-            t.join(timeout=1.0)
+    drained = _drain_threads(threads, stop, fatal)
+    if not drained:
+        log.warning("review drain deadline reached; process exiting with unfinished work")
+    if k <= 1 and exits:
+        raise exits[0]  # Retain the single-loop SystemExit contract.
 
     if fatal.is_set():
         # A loop hit an unrecoverable DB error → exit nonzero so Railway restarts us.
         sys.exit(1)
     log.info("review worker stopped")
 
 
 if __name__ == "__main__":
     main()
diff --git a/tests/test_lifecycle_supervisor.py b/tests/test_lifecycle_supervisor.py
new file mode 100644
index 0000000..f3c1095
--- /dev/null
+++ b/tests/test_lifecycle_supervisor.py
@@ -0,0 +1,410 @@
+"""Ordinary process/worker tests; no excluded lifecycle security probes."""
+import importlib
+import json
+from pathlib import Path
+import subprocess
+import sys
+import threading
+import time
+
+import pytest
+
+from tests.conftest import TEST_DSN, requires_db
+
+
+def supervisor():
+    return importlib.import_module('reviewer.supervisor')
+
+
+def maintenance_worker():
+    return importlib.import_module('job_discovery.lifecycle.worker')
+
+
+class Clock:
+    now = 0.0
+
+    def __call__(self):
+        return self.now
+
+
+class Stop:
+    def __init__(self, clock, at):
+        self.clock, self.at = clock, at
+        self.waits = []
+
+    def is_set(self):
+        return self.clock.now >= self.at
+
+    def wait(self, delay):
+        assert 0 < delay <= 5
+        self.waits.append(delay)
+        self.clock.now += delay
+        return self.is_set()
+
+
+class Child:
+    def __init__(self, clock, duration=None, code=0, ignores_term=False):
+        self.clock = clock
+        self.started = clock()
+        self.duration, self.code = duration, code
+        self.returncode = None
+        self.ignores_term = ignores_term
+        self.terminated = self.killed = None
+
+    def poll(self):
+        if self.returncode is None and self.duration is not None and self.clock() >= self.started + self.duration:
+            self.returncode = self.code
+        return self.returncode
+
+    def terminate(self):
+        self.terminated = self.clock()
+        if not self.ignores_term:
+            self.returncode = -15
+
+    def kill(self):
+        self.killed = self.clock()
+        self.returncode = -9
+
+    def wait(self, timeout=None):
+        assert timeout is not None and timeout <= 1, 'no unbounded child join'
+        assert self.poll() is not None
+        return self.returncode
+
+
+def test_stalled_reviewer_does_not_block_startup_or_quarter_hour_sweeps():
+    s = supervisor()
+    clock = Clock()
+    stop = Stop(clock, 1805)
+    children = []
+
+    def spawn(name):
+        child = Child(clock, duration=1 if name == 'maintenance' else None)
+        children.append((name, child))
+        return child
+
+    assert s.supervise(stop, spawn, clock) == 0
+    assert [c.started for name, c in children if name == 'maintenance'] == [0, 900, 1800]
+    assert len([1 for name, _ in children if name == 'reviewer']) == 1
+    assert max(stop.waits) <= 5
+
+
+def test_maintenance_deadline_and_crash_wait_for_next_tick_reviewer_restarts(monkeypatch):
+    s = supervisor()
+    clock = Clock()
+    monkeypatch.setattr(s.time, 'sleep', lambda delay: setattr(clock, 'now', clock.now + delay))
+    stop = Stop(clock, 1810)
+    children = []
+
+    def spawn(name):
+        prior = sum(n == name for n, _ in children)
+        child = Child(clock, duration=1 if prior == 0 and name == 'reviewer' else None,
+                      code=1, ignores_term=True)
+        if name == 'maintenance' and prior == 1:
+            child.duration = 1  # crash second maintenance attempt
+        children.append((name, child))
+        return child
+
+    assert s.supervise(stop, spawn, clock) == 0
+    maint = [c for n, c in children if n == 'maintenance']
+    assert [c.started for c in maint] == [0, 900, 1800]
+    assert maint[0].killed == 90
+    assert [c.started for n, c in children if n == 'reviewer'] == [0, 5]
+    assert clock() <= 1840
+
+
+def test_shutdown_has_one_global_30_second_drain_and_no_new_children(monkeypatch):
+    s = supervisor()
+    clock = Clock()
+    monkeypatch.setattr(s.time, 'sleep', lambda delay: setattr(clock, 'now', clock.now + delay))
+    children = []
+
+    def spawn(name):
+        child = Child(clock, ignores_term=True)
+        children.append(child)
+        return child
+
+    assert s.supervise(Stop(clock, 10), spawn, clock) == 0
+    assert len(children) == 2
+    assert [c.terminated for c in children] == [10, 10]
+    assert [c.killed for c in children] == [40, 40]
+    assert clock() == 40
+
+
+def test_spawn_failure_returns_nonzero_and_drains_started_sibling(monkeypatch):
+    s = supervisor()
+    clock = Clock()
+    monkeypatch.setattr(s.time, 'sleep', lambda delay: setattr(clock, 'now', clock.now + delay))
+    reviewer = Child(clock, ignores_term=True)
+
+    def spawn(name):
+        if name == 'maintenance':
+            raise OSError('cannot spawn')
+        return reviewer
+
+    assert s.supervise(Stop(clock, 9999), spawn, clock) == 1
+    assert reviewer.killed == 30
+
+
+def test_already_stopped_starts_nothing():
+    s = supervisor()
+    assert s.supervise(Stop(Clock(), 0), lambda name: pytest.fail(name), Clock()) == 0
+
+
+def test_deployment_only_changes_reviewer_command():
+    cfg = json.loads(Path('railway.reviewer-worker.json').read_text())['deploy']
+    assert cfg == {'startCommand': 'python -m reviewer.supervisor',
+                   'restartPolicyType': 'ON_FAILURE', 'restartPolicyMaxRetries': 100}
+    assert json.loads(Path('railway.json').read_text())['deploy'] == {'startCommand': 'python -m job_discovery'}
+    # Cron is configured outside railway.json; the command remains one-shot.
+    assert 'supervisor' not in Path('job_discovery/__main__.py').read_text()
+
+
+def test_real_children_deadline_and_terminated_external_cron(monkeypatch):
+    s = supervisor()
+    monkeypatch.setattr(s, 'CHECK_SECONDS', 0.02)
+    monkeypatch.setattr(s, 'MAINTENANCE_INTERVAL_SECONDS', 0.30)
+    monkeypatch.setattr(s, 'MAINTENANCE_DEADLINE_SECONDS', 0.12)
+    monkeypatch.setattr(s, 'DRAIN_SECONDS', 0.08)
+    stop = threading.Event()
+    children = []
+    cron = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])
+    timer = threading.Timer(0.75, stop.set)
+
+    def spawn(name):
+        p = subprocess.Popen([sys.executable, '-c',
+            'import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(60)'])
+        children.append((name, p))
+        return p
+
+    began = time.monotonic()
+    try:
+        cron.terminate()
+        cron.wait(timeout=2)
+        timer.start()
+        assert s.supervise(stop, spawn, time.monotonic) == 0
+        assert time.monotonic() - began < 3
+        assert sum(n == 'maintenance' for n, _ in children) >= 2
+        assert all(p.poll() is not None for _, p in children)
+    finally:
+        timer.cancel()
+        for p in [cron, *(p for _, p in children)]:
+            if p.poll() is None:
+                p.kill()
+            p.wait(timeout=2)
+
+
+@requires_db
+def test_worker_flag_off_closes_owned_connection(conn, monkeypatch):
+    w = maintenance_worker()
+    from job_discovery import db
+    opened = []
+    original = db.connect
+
+    def connect(dsn):
+        fresh = original(dsn)
+        opened.append(fresh)
+        return fresh
+
+    monkeypatch.setattr(w.db, 'connect', connect)
+    assert not w.run_maintenance_once(TEST_DSN).blocked
+    assert len(opened) == 1 and opened[0].closed
+    assert conn.execute("SELECT count(*) AS n FROM lifecycle_claims WHERE kind='maintenance'").fetchone()['n'] == 0
+
+
+@requires_db
+def test_worker_scheduled_sweep_and_normal_restart_generations(conn):
+    w = maintenance_worker()
+    conn.execute('UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1')
+    conn.commit()
+    generations = []
+    for _ in range(2):
+        assert not w.run_maintenance_once(TEST_DSN).blocked
+        row = conn.execute("SELECT generation,replay_floor,state FROM lifecycle_claims WHERE kind='maintenance'").fetchone()
+        assert row['state'] == 'cancelled' and row['replay_floor'] == row['generation'] - 1
+        generations.append(row['generation'])
+        assert conn.execute('SELECT last_success_at FROM lifecycle_maintenance_state').fetchone()['last_success_at'] is not None
+        conn.commit()
+    assert generations[1] > generations[0]
+
+
+@requires_db
+def test_worker_contended_claim_is_blocked_then_recovers_after_release(conn):
+    w = maintenance_worker()
+    from job_discovery.lifecycle.claims import claim_work, cancel_claim
+    conn.execute('UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1')
+    claim = claim_work(conn, 'maintenance', 'singleton', 120)
+    conn.commit()
+    assert w.run_maintenance_once(TEST_DSN).blocked
+    cancel_claim(conn, claim)
+    conn.commit()
+    assert not w.run_maintenance_once(TEST_DSN).blocked
+
+
+@requires_db
+def test_worker_failure_rolls_back_cancels_claim_and_next_worker_runs(conn, monkeypatch):
+    w = maintenance_worker()
+    conn.execute('UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1')
+    conn.commit()
+    original = w.sweep
+
+    def fail(connection, claim, **kwargs):
+        assert kwargs['scheduled'] is True
+        connection.execute('UPDATE lifecycle_maintenance_state SET eligible_rows=999')
+        raise RuntimeError('ordinary worker failure')
+
+    monkeypatch.setattr(w, 'sweep', fail)
+    assert w.run_maintenance_once(TEST_DSN).blocked
+    assert conn.execute('SELECT eligible_rows FROM lifecycle_maintenance_state').fetchone()['eligible_rows'] == 0
+    assert conn.execute("SELECT state FROM lifecycle_claims WHERE kind='maintenance'").fetchone()['state'] == 'cancelled'
+    conn.commit()
+    monkeypatch.setattr(w, 'sweep', original)
+    assert not w.run_maintenance_once(TEST_DSN).blocked
+
+
+def test_approved_timing_constants():
+    s = supervisor()
+    from job_discovery.lifecycle import maintenance as m
+    assert (s.CHECK_SECONDS, s.MAINTENANCE_INTERVAL_SECONDS, s.MAINTENANCE_DEADLINE_SECONDS, s.DRAIN_SECONDS) == (5, 900, 90, 30)
+    assert (m.LEASE_SECONDS, m.RENEW_SECONDS, m.DEADLINE_SECONDS) == (120, 30, 90)
+
+
+def test_reviewer_drain_returns_when_review_is_stalled(monkeypatch):
+    from reviewer import worker
+    stop = worker._Stop()
+    release = threading.Event()
+    thread = threading.Thread(target=release.wait, daemon=True)
+    thread.start()
+    clock = Clock()
+    monkeypatch.setattr(worker.time, 'monotonic', clock)
+    monkeypatch.setattr(worker, 'DRAIN_SECONDS', 0.01)
+    stop.request()
+    original_join = thread.join
+
+    def join(timeout=None):
+        assert timeout is not None and timeout <= 1
+        clock.now += timeout
+
+    monkeypatch.setattr(thread, 'join', join)
+    try:
+        assert worker._drain_threads([thread], stop, threading.Event()) is False
+        assert clock.now <= 1.01
+    finally:
+        release.set()
+        original_join(timeout=2)
+
+
+@pytest.mark.parametrize('parallelism', [1, 3])
+def test_real_reviewer_sigterm_bounds_stalled_request(parallelism, tmp_path):
+    marker = tmp_path / 'ready'
+    code = '''
+import pathlib, sys, time
+from reviewer import worker
+worker.DRAIN_SECONDS = 0.1
+worker.config.REVIEW_WORKER_PARALLELISM = int(sys.argv[2])
+worker.config.has_api_key = lambda: True
+class Conn:
+    def close(self): pass
+worker.jdb.connect = Conn
+def stalled(conn):
+    pathlib.Path(sys.argv[1]).touch()
+    time.sleep(60)
+worker.process_one = stalled
+worker.main()
+'''
+    process = subprocess.Popen([sys.executable, '-c', code, str(marker), str(parallelism)])
+    try:
+        deadline = time.monotonic() + 5
+        while not marker.exists() and process.poll() is None and time.monotonic() < deadline:
+            time.sleep(0.01)
+        assert marker.exists()
+        process.terminate()
+        assert process.wait(timeout=3) == 0
+    finally:
+        if process.poll() is None:
+            process.kill()
+        process.wait(timeout=2)
+
+
+def test_main_signal_stops_children_and_restart_runs_startup_again(tmp_path):
+    marker = tmp_path / 'children'
+    code = '''
+import pathlib, subprocess, sys
+from reviewer import supervisor as s
+s.CHECK_SECONDS = 0.02
+s.DRAIN_SECONDS = 0.1
+def spawn(name):
+    child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])
+    with pathlib.Path(sys.argv[1]).open('a') as f:
+        f.write(name + ':' + str(child.pid) + '\\n')
+    return child
+s.spawn_child = spawn
+sys.exit(s.main())
+'''
+    for cycle in (1, 2):
+        process = subprocess.Popen([sys.executable, '-c', code, str(marker)])
+        try:
+            deadline = time.monotonic() + 5
+            while time.monotonic() < deadline:
+                lines = marker.read_text().splitlines() if marker.exists() else []
+                if len(lines) == cycle * 2:
+                    break
+                time.sleep(0.01)
+            assert len(lines) == cycle * 2
+            process.terminate()
+            assert process.wait(timeout=3) == 0
+            assert [line.split(':')[0] for line in lines[-2:]] == ['reviewer', 'maintenance']
+            assert all(not Path('/proc', line.split(':')[1]).exists() for line in lines[-2:])
+        finally:
+            if process.poll() is None:
+                process.kill()
+            process.wait(timeout=2)
+
+
+def test_shutdown_does_not_extend_maintenance_90_second_deadline(monkeypatch):
+    s = supervisor()
+    clock = Clock()
+    monkeypatch.setattr(s.time, 'sleep', lambda delay: setattr(clock, 'now', clock.now + delay))
+    children = {}
+
+    def spawn(name):
+        children[name] = Child(clock, ignores_term=True)
+        return children[name]
+
+    assert s.supervise(Stop(clock, 85), spawn, clock) == 0
+    assert children['maintenance'].killed == 90
+    assert children['reviewer'].killed == 115
+
+
+@requires_db
+def test_real_maintenance_sigterm_releases_connection_and_next_worker_recovers(conn, tmp_path):
+    w = maintenance_worker()
+    conn.execute('UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1')
+    conn.commit()
+    marker = tmp_path / 'maintenance-claimed'
+    code = '''
+import pathlib, sys, time
+from job_discovery.lifecycle import worker
+
+def paused_sweep(conn, claim, **kwargs):
+    pathlib.Path(sys.argv[1]).write_text(str(claim.generation))
+    time.sleep(60)
+worker.sweep = paused_sweep
+sys.exit(worker.main())
+'''
+    process = subprocess.Popen([sys.executable, '-c', code, str(marker)])
+    try:
+        deadline = time.monotonic() + 5
+        while not marker.exists() and process.poll() is None and time.monotonic() < deadline:
+            time.sleep(0.01)
+        assert marker.exists()
+        generation = int(marker.read_text())
+        process.terminate()
+        assert process.wait(timeout=3) == 143
+        row = conn.execute("SELECT generation,replay_floor,state FROM lifecycle_claims WHERE kind='maintenance'").fetchone()
+        assert row == {'generation': generation + 1, 'replay_floor': generation, 'state': 'cancelled'}
+        conn.commit()
+        assert not w.run_maintenance_once(TEST_DSN).blocked
+    finally:
+        if process.poll() is None:
+            process.kill()
+        process.wait(timeout=2)
diff --git a/tests/test_reviewer_worker.py b/tests/test_reviewer_worker.py
index d1ce43c..eaa3896 100644
--- a/tests/test_reviewer_worker.py
+++ b/tests/test_reviewer_worker.py
@@ -61,36 +61,55 @@ def test_claim_marks_running(conn):
 
 
 @requires_db
 def test_two_claimers_never_take_the_same_row(conn):
     # Two pending rows (distinct users — the partial unique index forbids two active
     # per user). Two concurrent connections must claim DIFFERENT rows (SKIP LOCKED).
     _enqueue(conn, UA)
     _enqueue(conn, UB)
     conn2 = psycopg.connect(TEST_DSN, row_factory=dict_row)
     try:
-        c1 = rdb.claim_next_review_request(conn)   # locks row 1 (uncommitted)
-        c2 = rdb.claim_next_review_request(conn2)  # must skip the locked row → row 2
+        c1 = rdb.claim_next_review_request(conn)
+        # Lifecycle's BEFORE STATEMENT gate serializes these write transactions.
+        # Run the second attempt concurrently and commit the first before waiting.
+        started = threading.Event()
+        results, errors = [], []
+
+        def second_claim():
+            started.set()
+            try:
+                results.append(rdb.claim_next_review_request(conn2))
+                conn2.commit()
+            except Exception as exc:
+                errors.append(exc)
+
+        sibling = threading.Thread(target=second_claim, daemon=True)
+        sibling.start()
+        assert started.wait(timeout=2)
+        conn.commit()
+        sibling.join(timeout=5)
+        assert not sibling.is_alive() and not errors
+        c2 = results[0]
         assert c1 is not None and c2 is not None
         assert c1["id"] != c2["id"]
-        conn.commit()
-        conn2.commit()
     finally:
         conn2.close()
 
 
 @requires_db
 def test_second_claimer_gets_nothing_when_only_row_is_locked(conn):
     _enqueue(conn, UA)
     conn2 = psycopg.connect(TEST_DSN, row_factory=dict_row)
     try:
-        c1 = rdb.claim_next_review_request(conn)   # locks the only pending row
+        # A plain row lock isolates SKIP LOCKED behavior without holding the
+        # separate global BEFORE STATEMENT write gate across the second call.
+        c1 = conn.execute("SELECT id FROM review_requests WHERE status='pending' FOR UPDATE").fetchone()
         c2 = rdb.claim_next_review_request(conn2)  # SKIP LOCKED → nothing
         assert c1 is not None
         assert c2 is None
         conn.commit()
         conn2.commit()
     finally:
         conn2.close()
 
 
 @requires_db
