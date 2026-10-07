# Full pinned review package

BASE: a6131a02282174078e34ecdd28d967294a524a90

HEAD: ed9788105f98fd0d8f7438636d6e6c50ac3c919a

## Commits

ed9788105f98fd0d8f7438636d6e6c50ac3c919a fix: preserve reviewer single-loop parallelism fallback


## Files

 .../task-5-evidence/commands.txt                   | 11 +++
 .../task-5-evidence/fix1-focused.txt               |  2 +
 .../task-5-evidence/fix1-green.txt                 |  2 +
 .../task-5-evidence/fix1-red.txt                   | 90 ++++++++++++++++++++++
 .../task-5-evidence/fix1-ruff.txt                  |  1 +
 .../task-5-report.md                               | 51 ++++++++++++
 reviewer/worker.py                                 |  3 +-
 tests/test_reviewer_worker.py                      | 41 ++++++++++
 8 files changed, 200 insertions(+), 1 deletion(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/commands.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/commands.txt
index ee41705..07fa50a 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/commands.txt
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/commands.txt
@@ -29,10 +29,21 @@ Final unchanged-source coverage (final17.txt, final16.txt):
 
 Static verification:
 .venv/bin/ruff check .
 git diff --check
 git diff --cached --check
 
 Scope verification:
 git diff --name-only ee9cef2849b966835807c6c84d00cf2a8ed62788 -- railway.json railway.discovery.json job_discovery/__main__.py
 git merge-base --is-ancestor 114cce96cb244546864a6bddc5476b5630bc024a HEAD
 git log -1 --format='%H %s' origin/main
+
+Fix Round 1, FIX_BASE a6131a02282174078e34ecdd28d967294a524a90:
+New offline regression RED (fix1-red.txt), then same command GREEN (fix1-green.txt):
+.venv/bin/python -m pytest tests/test_reviewer_worker.py::test_nonpositive_parallelism_preserves_single_loop_processing -q
+
+Focused unchanged-fix-source ordinary process/reviewer verification (fix1-focused.txt):
+.venv/bin/python -m pytest tests/test_lifecycle_supervisor.py tests/test_reviewer_worker.py -q -k 'not worker_flag_off and not worker_scheduled and not worker_contended and not worker_failure and not real_maintenance and not claim_marks_running and not two_claimers and not second_claimer and not k_parallel_loops and not finish_transitions and not stale_running_recovery and not stale_recovery and not process_one_exhausted and not process_one_empty and not reconnect_closes_old and not process_one_skips and not process_one_clears and not old_worker_completion and not delayed_worker_rechecks'
+
+.venv/bin/ruff check .
+git diff --check
+git diff --cached --check
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/fix1-focused.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/fix1-focused.txt
new file mode 100644
index 0000000..7039e83
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/fix1-focused.txt
@@ -0,0 +1,2 @@
+.......................                                                  [100%]
+23 passed, 23 deselected in 4.54s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/fix1-green.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/fix1-green.txt
new file mode 100644
index 0000000..63a32cd
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/fix1-green.txt
@@ -0,0 +1,2 @@
+....                                                                     [100%]
+4 passed in 0.24s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/fix1-red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/fix1-red.txt
new file mode 100644
index 0000000..c6addfc
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/fix1-red.txt
@@ -0,0 +1,90 @@
+FF..                                                                     [100%]
+=================================== FAILURES ===================================
+______ test_nonpositive_parallelism_preserves_single_loop_processing[-1] _______
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f56cfed50d0>
+parallelism = -1
+
+    @pytest.mark.parametrize('parallelism', [-1, 0, 1, 3])
+    def test_nonpositive_parallelism_preserves_single_loop_processing(monkeypatch, parallelism):
+        """Each effective loop reaches request processing and closes its connection."""
+        effective = max(1, parallelism)
+        rendezvous = threading.Barrier(effective)
+        connections, processed = [], []
+        lock = threading.Lock()
+
+        class Connection:
+            closed = False
+
+            def close(self):
+                self.closed = True
+
+        def connect():
+            connection = Connection()
+            with lock:
+                connections.append(connection)
+            return connection
+
+        def process(connection):
+            with lock:
+                processed.append(connection)
+            # All parallel loops must reach the request path before one signals fatal.
+            rendezvous.wait(timeout=2)
+            raise SystemExit(7)
+
+        monkeypatch.setattr(worker.config, 'REVIEW_WORKER_PARALLELISM', parallelism)
+        monkeypatch.setattr(worker.config, 'has_api_key', lambda: True)
+        monkeypatch.setattr(worker.signal, 'signal', lambda *_: None)
+        monkeypatch.setattr(worker.jdb, 'connect', connect)
+        monkeypatch.setattr(worker, 'process_one', process)
+>       with pytest.raises(SystemExit) as exited:
+             ^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE SystemExit
+
+tests/test_reviewer_worker.py:627: Failed
+_______ test_nonpositive_parallelism_preserves_single_loop_processing[0] _______
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f56cfeb2cf0>
+parallelism = 0
+
+    @pytest.mark.parametrize('parallelism', [-1, 0, 1, 3])
+    def test_nonpositive_parallelism_preserves_single_loop_processing(monkeypatch, parallelism):
+        """Each effective loop reaches request processing and closes its connection."""
+        effective = max(1, parallelism)
+        rendezvous = threading.Barrier(effective)
+        connections, processed = [], []
+        lock = threading.Lock()
+
+        class Connection:
+            closed = False
+
+            def close(self):
+                self.closed = True
+
+        def connect():
+            connection = Connection()
+            with lock:
+                connections.append(connection)
+            return connection
+
+        def process(connection):
+            with lock:
+                processed.append(connection)
+            # All parallel loops must reach the request path before one signals fatal.
+            rendezvous.wait(timeout=2)
+            raise SystemExit(7)
+
+        monkeypatch.setattr(worker.config, 'REVIEW_WORKER_PARALLELISM', parallelism)
+        monkeypatch.setattr(worker.config, 'has_api_key', lambda: True)
+        monkeypatch.setattr(worker.signal, 'signal', lambda *_: None)
+        monkeypatch.setattr(worker.jdb, 'connect', connect)
+        monkeypatch.setattr(worker, 'process_one', process)
+>       with pytest.raises(SystemExit) as exited:
+             ^^^^^^^^^^^^^^^^^^^^^^^^^
+E       Failed: DID NOT RAISE SystemExit
+
+tests/test_reviewer_worker.py:627: Failed
+=========================== short test summary info ============================
+FAILED tests/test_reviewer_worker.py::test_nonpositive_parallelism_preserves_single_loop_processing[-1]
+FAILED tests/test_reviewer_worker.py::test_nonpositive_parallelism_preserves_single_loop_processing[0]
+2 failed, 2 passed in 0.27s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/fix1-ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/fix1-ruff.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-evidence/fix1-ruff.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-report.md
index cd1dd5c..d69aecc 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-report.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-5-report.md
@@ -169,10 +169,61 @@ No new safeguard refusal occurred. No production write, activation, external
 publication, merge, push, deployment, credential/IAM change or unrelated Railway
 mutation was performed. Default flags/dry-run/archive settings are unchanged;
 local fixture enablement is confined to disposable DBs. Completed-upgrade release
 is authorized for the controller after all 13 tasks and permitted verification;
 Task 5 alone is not the upgrade release. Safety-floor confirmation exceptions
 and the reduced independent-review gaps persist.
 
 Remaining handoff: controller's fresh permitted Task 5 requirements/code-quality
 gate and Library 05 checkpoint, then Task 6. Author verification does not replace
 that gate or imply any missing security approval.
+
+## Fix Round 1 — nonpositive reviewer parallelism compatibility
+
+FIX_BASE: `a6131a02282174078e34ecdd28d967294a524a90`. Read the full
+`task-5-requirements-review.md` and its complete saved ordinary diagnostic,
+`task-5-review-evidence/nonpositive-parallelism.txt`. The permitted review verdict
+was **Spec FAIL / Quality CHANGES_REQUIRED**, with one P2 finding: the new daemon
+thread construction used `range(k)`, silently starting no reviewer loops when
+configured parallelism was zero or negative. The pre-Task-5 `k <= 1` branch ran
+one loop for those values. Configuration accepts them, so the finding is valid.
+
+The narrow correction normalizes effective parallelism to at least one before
+thread construction. The supervisor, process deadlines, signal-time drain,
+single-loop SystemExit forwarding, parallel failure behavior, SQL/DB interfaces,
+Railway config and all existing test fixtures are unchanged by this fix.
+
+Added an offline parameterized regression for configured values **-1, 0, 1, 3**.
+It runs actual `main()` and `_run_loop`, with only connection/API-key/signal and
+request-handler boundaries stubbed. A bounded barrier ensures all three parallel
+loops reach the handler before a simulated exit can stop siblings. Assertions
+verify the effective loop count, request-handler invocation for every connection,
+connection closure, no surviving loop thread, single-loop exit code 7 and parallel
+fatal exit code 1. No real DB or provider is contacted.
+
+Exact commands are appended to `task-5-evidence/commands.txt`:
+
+- `fix1-red.txt`: **2 failed, 2 passed**, reproducing the missing processing path
+  at -1/0 before changing product code; 1/3 already worked.
+- `fix1-green.txt`: **4 passed** after normalization.
+- `fix1-focused.txt`: **23 passed, 23 deliberately deselected, zero skips**,
+  4.54 seconds. This covers offline supervisor scheduling/termination/restart,
+  real controlled child processes and reviewer drain/failure/configuration paths.
+  DB cases were excluded by explicit name selection.
+- `fix1-ruff.txt`: repository Ruff passed. Working and staged whitespace checks
+  passed. Source/tests were unchanged after those runs.
+
+This fix changes no DB test, DB protocol or maintenance code. Per the narrow fix
+scope, the full 84-test resource lanes were not repeated. The earlier PostgreSQL
+17.11/16.15 results and measurements remain pinned to the original Task 5 source
+`a6131a0`; they are historical evidence, not fresh executions of the correction.
+The correction has the fresh focused offline verification listed above. No new
+resource/cost claim is made.
+
+No excluded security review or probes, external/provider calls, release actions,
+new safeguards, subagents or reviewer substitutions occurred. Task 3 remains
+not fully security-approved, with its expiry/capacity/cross-user/adversarial
+review gaps unchanged. The configuration finding is author-fixed and tested;
+independent scoped re-review of the original package plus correction remains
+for the controller before Library 05 and Task 6. Only this worker line change,
+the new offline test, author report and author evidence are committed forward;
+controller/reviewer files remain excluded.
diff --git a/reviewer/worker.py b/reviewer/worker.py
index ddfccba..6b6f490 100644
--- a/reviewer/worker.py
+++ b/reviewer/worker.py
@@ -219,21 +219,22 @@ def main() -> None:
     if not config.has_api_key():
         log.warning("OPENROUTER_API_KEY not set; requests will fail until it is configured")
 
     stop = _Stop()
     # Keep signals on the main thread while each review loop owns its connection.
     # Both a stop signal and a fatal sibling start a bounded drain.
     signal.signal(signal.SIGTERM, stop.request)
     signal.signal(signal.SIGINT, stop.request)
 
     fatal = threading.Event()
-    k = config.REVIEW_WORKER_PARALLELISM  # read at call time so tests can monkeypatch it
+    # Preserve the historical k <= 1 fallback while keeping every loop drainable.
+    k = max(1, config.REVIEW_WORKER_PARALLELISM)
     log.info(
         "review worker started (parallelism=%s, poll=%ss, stale=%smin)",
         k, config.REVIEW_WORKER_POLL_SECONDS, STALE_MINUTES,
     )
 
     exits = []
 
     def _thread_body(idx):
         # Fail CLOSED: ANY exception escaping _run_loop must set `fatal` so main() exits
         # nonzero for a Railway restart — otherwise a thread that dies silently (e.g. the
diff --git a/tests/test_reviewer_worker.py b/tests/test_reviewer_worker.py
index eaa3896..4a12353 100644
--- a/tests/test_reviewer_worker.py
+++ b/tests/test_reviewer_worker.py
@@ -583,10 +583,51 @@ def test_delayed_worker_rechecks_claim_after_acquiring_user_lock(conn, monkeypat
         with psycopg.connect(TEST_DSN, row_factory=dict_row) as sibling:
             assert rdb.recover_stale_review_requests(sibling) == 1
             assert rdb.claim_next_review_request(sibling)['id'] == rid
         return 'standard'
 
     monkeypatch.setattr(rdb, 'load_invite_comp_plan', delayed_config)
     assert worker.process_one(conn)
     note = conn.execute('SELECT notes FROM review_runs ORDER BY id DESC LIMIT 1').fetchone()['notes']
     assert note == 'review request claim superseded; skipped'
     assert conn.execute('SELECT status FROM review_requests WHERE id=%s', (rid,)).fetchone()['status'] == 'running'
+
+
+@pytest.mark.parametrize('parallelism', [-1, 0, 1, 3])
+def test_nonpositive_parallelism_preserves_single_loop_processing(monkeypatch, parallelism):
+    """Each effective loop reaches request processing and closes its connection."""
+    effective = max(1, parallelism)
+    rendezvous = threading.Barrier(effective)
+    connections, processed = [], []
+    lock = threading.Lock()
+
+    class Connection:
+        closed = False
+
+        def close(self):
+            self.closed = True
+
+    def connect():
+        connection = Connection()
+        with lock:
+            connections.append(connection)
+        return connection
+
+    def process(connection):
+        with lock:
+            processed.append(connection)
+        # All parallel loops must reach the request path before one signals fatal.
+        rendezvous.wait(timeout=2)
+        raise SystemExit(7)
+
+    monkeypatch.setattr(worker.config, 'REVIEW_WORKER_PARALLELISM', parallelism)
+    monkeypatch.setattr(worker.config, 'has_api_key', lambda: True)
+    monkeypatch.setattr(worker.signal, 'signal', lambda *_: None)
+    monkeypatch.setattr(worker.jdb, 'connect', connect)
+    monkeypatch.setattr(worker, 'process_one', process)
+    with pytest.raises(SystemExit) as exited:
+        worker.main()
+    assert exited.value.code == (7 if parallelism <= 1 else 1)
+    assert len(connections) == len(processed) == effective
+    assert set(connections) == set(processed)
+    assert all(connection.closed for connection in connections)
+    assert _review_loop_threads() == []
