# Full pinned review package

BASE: a288a9ad290d45d557953c9133bc61482d571f08

HEAD: 204eea6ac9be1e1fd3263708577d1483f26969fb

## Commits

204eea6ac9be1e1fd3263708577d1483f26969fb test: finish lifecycle harness cancellation and ownership guards


## Files

 .../task-1-evidence/fix-round2-phase-probe.json    |  80 +++++++++
 .../task-1-evidence/fix-round2-phase-probe.py.txt  |  41 +++++
 .../task-1-evidence/fix-round2-postgres16.txt      |   4 +
 .../task-1-evidence/fix-round2-postgres17.txt      |   4 +
 .../task-1-evidence/fix-round2-red-chronology.json |  46 +++++
 .../task-1-evidence/verification.json              |  31 ++++
 .../task-1-report.md                               | 118 ++++++++++++
 tests/test_lifecycle_test_db.py                    | 198 ++++++++++++++++++++-
 tools/lifecycle_test_db.py                         |  75 ++++++--
 9 files changed, 577 insertions(+), 20 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round2-phase-probe.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round2-phase-probe.json
new file mode 100644
index 0000000..3210895
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round2-phase-probe.json
@@ -0,0 +1,80 @@
+{
+  "command": "python tools/lifecycle_test_db.py --postgres-major 17 -- python /tmp/lifecycle-task1-fix2-phase-probe.py",
+  "note": "Diagnostic observed only real Docker/readiness phase names and elapsed monotonic seconds; no environment, arguments, credentials or DB contents recorded. Temporary instrumentation does not alter product code.",
+  "outer_returncode": 124,
+  "nested_command_started": true,
+  "phases": [
+    {
+      "event": "docker_run_begin",
+      "elapsed": 0.0
+    },
+    {
+      "event": "docker_run_end",
+      "elapsed": 4.777
+    },
+    {
+      "event": "docker_port_begin",
+      "elapsed": 4.777
+    },
+    {
+      "event": "docker_port_end",
+      "elapsed": 4.827
+    },
+    {
+      "event": "readiness_probe_begin",
+      "elapsed": 4.828
+    },
+    {
+      "event": "readiness_probe_not_success",
+      "elapsed": 5.03
+    },
+    {
+      "event": "readiness_probe_begin",
+      "elapsed": 5.23
+    },
+    {
+      "event": "readiness_probe_not_success",
+      "elapsed": 5.411
+    },
+    {
+      "event": "readiness_probe_begin",
+      "elapsed": 5.612
+    },
+    {
+      "event": "readiness_probe_not_success",
+      "elapsed": 6.011
+    },
+    {
+      "event": "readiness_probe_begin",
+      "elapsed": 6.212
+    },
+    {
+      "event": "readiness_probe_not_success",
+      "elapsed": 6.549
+    },
+    {
+      "event": "readiness_probe_begin",
+      "elapsed": 6.75
+    },
+    {
+      "event": "readiness_probe_success",
+      "elapsed": 6.943
+    },
+    {
+      "event": "docker_inspect_begin",
+      "elapsed": 8.883
+    },
+    {
+      "event": "docker_inspect_end",
+      "elapsed": 8.915
+    },
+    {
+      "event": "docker_rm_begin",
+      "elapsed": 8.915
+    },
+    {
+      "event": "docker_rm_end",
+      "elapsed": 9.413
+    }
+  ]
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round2-phase-probe.py.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round2-phase-probe.py.txt
new file mode 100644
index 0000000..9094a52
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round2-phase-probe.py.txt
@@ -0,0 +1,41 @@
+import json,os,sys,tempfile,time
+from pathlib import Path
+sys.path.insert(0,os.getcwd())
+from tools import lifecycle_test_db as module
+root=Path(tempfile.mkdtemp(prefix='lifecycle-owned-phase-'))
+phase=root/'phases.jsonl'
+marker=root/'started'
+worker=f"import signal,threading; from pathlib import Path; signal.signal(signal.SIGTERM,signal.SIG_IGN); Path({str(marker)!r}).touch(); threading.Event().wait(30)"
+driver=f'''
+import json,time,sys
+from pathlib import Path
+from tools import lifecycle_test_db as module
+phase=Path({str(phase)!r})
+start=time.monotonic()
+def record(event):
+    with phase.open('a') as f:f.write(json.dumps(dict(event=event,elapsed=round(time.monotonic()-start,3)))+'\\n')
+real_docker=module._docker
+def observed_docker(args,**kwargs):
+    record('docker_'+args[0]+'_begin')
+    try:return real_docker(args,**kwargs)
+    finally:record('docker_'+args[0]+'_end')
+module._docker=observed_docker
+real_run=module.subprocess.run
+def observed_run(args,**kwargs):
+    probe= isinstance(args,list) and len(args)>2 and args[1]=='-c' and 'SHOW server_version' in args[2]
+    if probe:record('readiness_probe_begin')
+    try:
+        result=real_run(args,**kwargs)
+        if probe:record('readiness_probe_success')
+        return result
+    except BaseException:
+        if probe:record('readiness_probe_not_success')
+        raise
+module.subprocess.run=observed_run
+raise SystemExit(module.isolated_database([sys.executable,'-c',{worker!r}],17))
+'''
+module.COMMAND_TIMEOUT_SECONDS=8
+module.COMMAND_TERMINATION_GRACE_SECONDS=10
+code=module.run_existing_database([sys.executable,'-c',driver],os.environ['TEST_DATABASE_URL'])
+print('outer_returncode',code,'nested_command_started',marker.exists())
+print(phase.read_text())
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round2-postgres16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round2-postgres16.txt
new file mode 100644
index 0000000..20baaee
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round2-postgres16.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [ 83%]
+..............                                                           [100%]
+86 passed in 63.40s (0:01:03)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round2-postgres17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round2-postgres17.txt
new file mode 100644
index 0000000..363f17d
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round2-postgres17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 83%]
+..............                                                           [100%]
+86 passed in 53.97s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round2-red-chronology.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round2-red-chronology.json
new file mode 100644
index 0000000..3af3a9c
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/fix-round2-red-chronology.json
@@ -0,0 +1,46 @@
+{
+  "fix_base": "a288a9ad290d45d557953c9133bc61482d571f08",
+  "regressions": [
+    {
+      "command": "python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest tests/test_lifecycle_test_db.py -k 'prior_harness_name or during_inner_timeout or two_real_harness' -q",
+      "postgres_version": "17.11 (Debian 17.11-1.pgdg13+2)",
+      "result": "3 failed, 46 deselected in 5.15s",
+      "exit_code": 1,
+      "failures": [
+        "prior harness owner marker accepted from failed colliding creation",
+        "outer cancellation interrupted active inner timeout cleanup and worker survived",
+        "real prior harness with colliding generated name was deleted"
+      ]
+    }
+  ],
+  "focused_green": [
+    {
+      "command": "python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest tests/test_lifecycle_test_db.py -k 'prior_harness_name or during_inner_timeout or two_real_harness' -q",
+      "result": "3 passed, 46 deselected in 10.30s",
+      "exit_code": 0
+    }
+  ],
+  "first_covering_run": {
+    "command": "python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest tests/test_lifecycle_test_db.py tests/test_lifecycle_migrations.py tests/test_rls_isolation.py -q",
+    "result": "1 failed, 84 passed in 56.21s",
+    "skipped": 0,
+    "exit_code": 1,
+    "failure": "ordinary nested timeout fixture canceled before nested command acknowledged startup"
+  },
+  "phase_diagnosis": {
+    "original_outer_deadline_seconds": 8,
+    "failed_run_nested_ready_output": false,
+    "failed_run_nested_command_marker": false,
+    "failed_run_owned_container_started_utc": "2026-10-07T05:49:01.621Z",
+    "failed_run_owned_container_destroyed_utc": "2026-10-07T05:49:04.786Z",
+    "separate_real_phase_probe": {
+      "outer_returncode": 124,
+      "nested_command_started": true,
+      "docker_run_seconds": 4.777,
+      "ready_elapsed_seconds": 6.943,
+      "owned_cleanup_finished_elapsed_seconds": 9.413
+    },
+    "correction": "test-only bounded acknowledgement before real outer cancellation; production timers unchanged; independent real owned-startup cancellation test added"
+  },
+  "safety": "Real RED survivors were killed/reaped by exact acknowledged PID; exact owned container IDs only. No broad cleanup, DSN/environment/dump output, or production/provider calls."
+}
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/verification.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/verification.json
index 579c10e..2cfb2da 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/verification.json
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-evidence/verification.json
@@ -68,12 +68,43 @@
         "passed": 82,
         "skipped": 0,
         "exit_code": 0,
         "seconds": 46.68
       }
     ],
     "lint": "passed",
     "diff_check": "passed",
     "full_suite_repeated": false,
     "independent_scoped_rereview": "controller-owned, pending"
+  },
+  "fix_round2": {
+    "recorded_utc": "2026-10-07T05:58:30.524170+00:00",
+    "fix_base": "a288a9ad290d45d557953c9133bc61482d571f08",
+    "covered_files": [
+      "tests/test_lifecycle_test_db.py",
+      "tests/test_lifecycle_migrations.py",
+      "tests/test_rls_isolation.py"
+    ],
+    "required_lanes": [
+      {
+        "postgres_version": "17.11 (Debian 17.11-1.pgdg13+2)",
+        "passed": 86,
+        "skipped": 0,
+        "exit_code": 0,
+        "seconds": 53.97
+      },
+      {
+        "postgres_version": "16.15 (Debian 16.15-1.pgdg13+2)",
+        "passed": 86,
+        "skipped": 0,
+        "exit_code": 0,
+        "seconds": 63.4
+      }
+    ],
+    "lint": "passed",
+    "diff_check": "passed",
+    "frozen_schema_unchanged": true,
+    "full_suite_repeated": false,
+    "independent_scoped_rereview": "controller-owned, pending",
+    "scope": "two original security resource-lifetime findings; approved catalog fixes unchanged"
   }
 }
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-report.md
index 09e2dff..33567e0 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-report.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-1-report.md
@@ -280,10 +280,128 @@ majors. The initial 899-test full-suite results remain prior initial-commit
 evidence, not a claim that the full suite was rerun after these fixes. No broader
 baseline repeat was needed: the focused lane covers the changed process/resource
 paths and catalog comparison plus existing RLS compatibility, and exposes no
 unresolved failure. Fix output/chronology is tracked in `task-1-evidence/`.
 
 Only Task 1 tooling, its tests, this report and sanitized evidence are changed.
 No fixture/schema/application/CI change, broad Docker cleanup, cloud/provider
 call, or commit rewrite is made in this fix. Controller progress, review package
 and review artifacts are excluded from the forward commit. Fresh independent
 scoped rereview and Library checkpoint remain controller-owned and pending.
+
+## Fix Round 2: nested cancellation and prior-harness collision
+
+Forward fix base: `a288a9ad290d45d557953c9133bc61482d571f08`. This round
+addresses only the two residual original security findings in
+`task-1-fix-1-security-rereview.md`: “Outer cancellation can interrupt an inner
+timeout cleanup” and “A prior harness name collision also collides with its
+marker.” The reviewed global-default and NULL-ACL owner parity fixes are
+unchanged, as are the frozen schema, migration inventory, application and CI.
+The final forward commit SHA is returned with completion; this report and
+evidence are included in that commit.
+
+### Tests-first chronology and phase diagnosis
+
+Before changing the runner, added the review's failed-creation/prior-harness
+marker reproduction, a real nested process reproduction, and a real collision
+between two invocations of this harness. The nested process probe acknowledges
+entry into the inner runner's actual timeout cleanup before outer cancellation;
+the worker ignores SIGTERM, and a second real SIGTERM is delivered while the
+first handler is returning. It requires that the worker be terminated and
+reaped. Cleanup behavior is not mocked. The collision proof creates a real
+owned database through the first harness, forces the second harness to request
+the same name, and verifies that the first immutable ID survives.
+
+```bash
+PATH="$PWD/.venv/bin:$PATH" python tools/lifecycle_test_db.py --postgres-major 17 -- \
+  python -m pytest tests/test_lifecycle_test_db.py \
+  -k 'prior_harness_name or during_inner_timeout or two_real_harness' -q
+```
+
+On PostgreSQL **17.11**, RED was **3 failed, 46 deselected in 5.15s**, exit 1.
+The failures proved prior marker acceptance, a surviving inner worker, and
+deletion of the prior real harness container. The RED probes removed/reaped
+only their exact acknowledged IDs/PIDs and left no owned resource behind.
+After the runner fixes, the same selection was **3 passed, 46 deselected in
+10.30s**, exit 0.
+
+The first covering PostgreSQL 17 run then produced **1 failed, 84 passed,
+zero skipped in 56.21s**, exit 1. The existing ordinary nested timeout test
+never created `nested.json` or printed the nested database version: its
+eight-second outer deadline expired before the nested command acknowledged
+startup. Read-only Docker events showed that nested container started at
+05:49:01.621 UTC and was destroyed at 05:49:04.786 UTC. These timestamps alone
+do not measure individual readiness probes.
+
+A separate real phase observation kept the same eight-second outer deadline:
+
+```bash
+PATH="$PWD/.venv/bin:$PATH" python tools/lifecycle_test_db.py --postgres-major 17 -- \
+  python /tmp/lifecycle-task1-fix2-phase-probe.py
+```
+
+It measured Docker creation at **4.777s** and successful database readiness at
+**6.943s** after nested creation began. The command started in that probe,
+outer return was 124, and exact owned cleanup completed at 9.413s. Combined
+with the missing readiness/command acknowledgement in the failed run, this
+established that the old fixed deadline could target startup rather than the
+intended command-cleanup phase. Sanitized phase rows and the exact diagnostic
+script are preserved in `task-1-evidence/fix-round2-phase-probe.json` and
+`fix-round2-phase-probe.py.txt`; no Docker arguments, environment or credentials
+were recorded.
+
+The ordinary nested regression now acknowledges the actual running child with
+an Event before invoking real outer cancellation. Its observation wrapper has
+a bounded wait and always runs actual cleanup before asserting phase success.
+The production execution/readiness/grace constants are unchanged. A separate
+real Docker regression acknowledges the owned immutable ID after creation and
+port publication, then cancels before readiness or command execution; it
+asserts the command never started and the container disappeared. Thus both
+startup cancellation and cancellation of the running SIGTERM-ignoring child
+retain explicit coverage.
+
+### Resulting behavior
+
+An independent 192-bit random invocation marker replaces the marker derived
+from the generated container name. A failed name collision cannot authorize
+cleanup of a prior invocation, including another invocation of this harness.
+Successful and ambiguous creation still require the same exact marker and
+immutable-ID checks before removal.
+
+Process-group cleanup temporarily defers SIGTERM/SIGINT, including repeated
+signals, until termination and reaping finish. Cancellation during an existing
+timeout cleanup shortens the remaining grace to immediate escalation, then
+propagates after bounded cleanup. This closes the sibling-exception-handler
+gap without restarting the grace window. Owned container cleanup also defers
+handler exceptions until its bounded cleanup completes and restores the
+caller's handlers. The real repeated-signal test proves the worker disappears
+before the outer runner returns.
+
+### Fresh covering verification
+
+```bash
+PATH="$PWD/.venv/bin:$PATH" python tools/lifecycle_test_db.py --postgres-major 17 -- \
+  python -m pytest tests/test_lifecycle_test_db.py tests/test_lifecycle_migrations.py \
+  tests/test_rls_isolation.py -q
+# Same command with --postgres-major 16.
+PATH="$PWD/.venv/bin:$PATH" ruff check .
+git diff --check
+sha256sum tests/fixtures/lifecycle/schema-before-lifecycle.sql
+```
+
+| Fresh lane | Result |
+| --- | --- |
+| Owned PostgreSQL **17.11** (Debian 17.11-1.pgdg13+2) | **86 passed, zero skipped**, 53.97s, exit 0 |
+| Owned PostgreSQL **16.15** (Debian 16.15-1.pgdg13+2) | **86 passed, zero skipped**, 63.40s, exit 0 |
+| `ruff check .` | Passed |
+| `git diff --check` | Passed |
+| Frozen schema SHA-256 | Unchanged: `fb9b20f4708e7f60d15fb36e0174aa3de4de5254ea6aedf8b27df10bb7e3b0d6` |
+
+These affected lanes include the complete migration/catalog parity and RLS
+compatibility checks. Initial full-suite results and Fix Round 1 results above
+remain evidence for their respective earlier commits; the full suite was not
+repeated for this scoped fix. There is no outstanding failure in either fresh
+lane. Only Task 1 runner/tests, this report and sanitized evidence are included;
+controller progress and review artifacts remain excluded. No shared Docker
+cleanup, production/cloud/provider calls, schema changes or history rewrite
+occurred. Fresh independent scoped security review and the verified checkpoint
+remain controller-owned before Task 2.
diff --git a/tests/test_lifecycle_test_db.py b/tests/test_lifecycle_test_db.py
index f6e69fc..1b52497 100644
--- a/tests/test_lifecycle_test_db.py
+++ b/tests/test_lifecycle_test_db.py
@@ -100,20 +100,21 @@ def test_invalid_major_is_rejected_before_docker(monkeypatch):
         module.isolated_database([sys.executable, "-c", "pass"], postgres_major=15)
     assert calls == []
 
 
 @pytest.mark.parametrize("creation", ["conflict", "ambiguous-owned", "successful"])
 def test_creation_cleanup_requires_this_invocations_owner_and_immutable_id(monkeypatch, creation):
     module = harness()
     calls = []
     token, cid = "fix-round-one-owner", "a" * 64
     monkeypatch.setattr(module.secrets, "token_hex", lambda *args: token)
+    monkeypatch.setattr(module.secrets, "token_urlsafe", lambda *args: token)
 
     def docker(args, **kwargs):
         calls.append(args)
         if args[0] == "run":
             if creation == "conflict":
                 raise subprocess.CalledProcessError(125, ["docker", "run"])
             if creation == "ambiguous-owned":
                 raise subprocess.TimeoutExpired(["docker", "run"], 180)
             return cid
         if args[0] == "inspect":
@@ -124,20 +125,41 @@ def test_creation_cleanup_requires_this_invocations_owner_and_immutable_id(monke
 
     monkeypatch.setattr(module, "_docker", docker)
     assert module.isolated_database([sys.executable, "-c", "pass"]) == 2
     removals = [args for args in calls if args[0] == "rm"]
     if creation == "conflict":
         assert removals == [], "failed creation must not remove an unowned name conflict"
     else:
         assert removals == [["rm", "--force", "--volumes", cid]]
 
 
+def test_prior_harness_name_collision_does_not_reuse_the_prior_owner_marker(monkeypatch):
+    module = harness()
+    suffix, cid, calls = "prior-harness-name-suffix", "b" * 64, []
+    monkeypatch.setattr(module.secrets, "token_hex", lambda *args: suffix)
+    monkeypatch.setattr(module.secrets, "token_urlsafe", lambda *args: "fresh-invocation-marker")
+
+    def docker(args, **kwargs):
+        calls.append(args)
+        if args[0] == "run":
+            raise subprocess.CalledProcessError(125, ["docker", "run"])
+        if args[0] == "inspect":
+            # Exact prior-harness representation at FIX_BASE: marker=name suffix.
+            return json.dumps({"id": cid, "owner": suffix})
+        return ""
+
+    monkeypatch.setattr(module, "_docker", docker)
+    assert module.isolated_database([sys.executable, "-c", "pass"]) == 2
+    assert not any(args[0] == "rm" for args in calls), "prior harness invocation was accepted as this invocation"
+    assert "poller.lifecycle-test.owner=fresh-invocation-marker" in calls[0]
+
+
 @requires_db
 def test_real_name_conflict_preserves_the_other_invocations_container(monkeypatch):
     module = harness()
     token = module.secrets.token_hex(12)
     name = "poller-lifecycle-test-" + token
     # This test owns the sentinel, but the invoked harness does not. Never start
     # it or contact it as a DB; its immutable ID is the only test cleanup target.
     sentinel = module._docker([
         "create", "--name", name, "--label", "poller.lifecycle-test.owner=sentinel-" + token,
         "postgres:17",
@@ -186,20 +208,95 @@ def test_timeout_terminates_and_reaps_a_real_sigterm_ignoring_descendant(monkeyp
             assert reaped == pid, "owned descendant remained alive after command timeout"
             pid = None
             assert os.WIFSIGNALED(status)
             assert os.WTERMSIG(status) == signal.SIGKILL
         finally:
             if pid is not None:
                 os.kill(pid, signal.SIGKILL)
                 os.waitpid(pid, 0)
 
 
+def test_outer_cancellation_during_inner_timeout_cleanup_survives_a_second_signal(monkeypatch, tmp_path):
+    module = harness()
+    pidfile = tmp_path / "inner-worker.pid"
+    second_signal = tmp_path / "second-signal"
+    cleanup_started = threading.Event()
+    previous_usr1 = signal.getsignal(signal.SIGUSR1)
+    signal.signal(signal.SIGUSR1, lambda *args: cleanup_started.set())
+    worker = (
+        "import os,signal,threading; from pathlib import Path; "
+        "signal.signal(signal.SIGTERM,signal.SIG_IGN); "
+        f"Path({str(pidfile)!r}).write_text(str(os.getpid())); threading.Event().wait(30)"
+    )
+    inner = f"""
+import os,signal,sys
+from pathlib import Path
+from tools import lifecycle_test_db as module
+module.COMMAND_TIMEOUT_SECONDS=0.2
+module.COMMAND_TERMINATION_GRACE_SECONDS=20
+real_group=module._group_has_live_processes
+announced=False
+def observed_group(pgid):
+    global announced
+    if not announced:
+        announced=True
+        os.kill({os.getpid()},signal.SIGUSR1)
+    return real_group(pgid)
+module._group_has_live_processes=observed_group
+real_signal=signal.signal
+signal_seen=False
+def observing_signal(sig,handler):
+    if sig==signal.SIGTERM and callable(handler):
+        def repeat(signum,frame):
+            global signal_seen
+            first=not signal_seen
+            signal_seen=True
+            if not first:
+                Path({str(second_signal)!r}).touch()
+            result=handler(signum,frame)
+            if first:
+                os.kill(os.getpid(),signal.SIGTERM)
+            return result
+        return real_signal(sig,repeat)
+    return real_signal(sig,handler)
+signal.signal=observing_signal
+module.run_existing_database([sys.executable,'-c',{worker!r}],{LOCAL!r})
+"""
+    real_stop = module._stop_command_group
+
+    def after_inner_cleanup_started(process, *args, **kwargs):
+        assert cleanup_started.wait(5), "real inner timeout cleanup did not begin"
+        return real_stop(process, *args, **kwargs)
+
+    monkeypatch.setattr(module, "_stop_command_group", after_inner_cleanup_started)
+    monkeypatch.setattr(module, "COMMAND_TIMEOUT_SECONDS", 1)
+    monkeypatch.setattr(module, "COMMAND_TERMINATION_GRACE_SECONDS", 0.5)
+    with adopt_own_descendants():
+        pid = None
+        try:
+            assert module.run_existing_database([sys.executable, "-c", inner], LOCAL) == 124
+            assert cleanup_started.is_set()
+            assert second_signal.exists(), "second termination signal was not exercised"
+            assert pidfile.exists(), "inner worker never acknowledged its PID"
+            pid = int(pidfile.read_text())
+            assert not Path(f"/proc/{pid}").exists(), "inner timeout cleanup was interrupted and its worker survived"
+            pid = None  # The inner Popen has reaped its own worker.
+        finally:
+            signal.signal(signal.SIGUSR1, previous_usr1)
+            if pid is not None:
+                try:
+                    os.kill(pid, signal.SIGKILL)
+                    os.waitpid(pid, 0)
+                except (ProcessLookupError, ChildProcessError):
+                    pass
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
@@ -376,45 +473,144 @@ def test_owned_docker_child_failure_and_timeout_cleanup(monkeypatch, capsys):
     assert sorted(volumes_after) == sorted(volumes_before)
     output = capsys.readouterr().out
     assert "PostgreSQL 17." in output
     assert "postgresql://" not in output
 
 
 @requires_db
 def test_outer_timeout_allows_nested_harness_container_and_process_cleanup(monkeypatch, tmp_path):
     module = harness()
     marker = tmp_path / "nested.json"
+    command_started = threading.Event()
+    previous_usr1 = signal.getsignal(signal.SIGUSR1)
+    signal.signal(signal.SIGUSR1, lambda *args: command_started.set())
     script = (
         "import os,json,signal,subprocess,threading; from pathlib import Path; from urllib.parse import urlsplit; "
         "signal.signal(signal.SIGTERM,signal.SIG_IGN); "
         "port=str(urlsplit(os.environ['TEST_DATABASE_URL']).port); "
         f"ids=subprocess.check_output({module.DOCKER!r}+['ps','--no-trunc','-q','--filter','publish='+port],text=True).splitlines(); "
         "assert len(ids)==1; "
-        f"Path({str(marker)!r}).write_text(json.dumps(dict(cid=ids[0],pid=os.getpid()))); threading.Event().wait(30)"
+        f"Path({str(marker)!r}).write_text(json.dumps(dict(cid=ids[0],pid=os.getpid()))); "
+        f"os.kill({os.getpid()},signal.SIGUSR1); threading.Event().wait(30)"
     )
+    real_stop = module._stop_command_group
+
+    def after_command_started(process, *args, **kwargs):
+        # Exercise cancellation of a running child. Docker startup can consume
+        # the outer deadline; a separate test below covers that startup phase.
+        acknowledged = command_started.wait(module.READINESS_TIMEOUT_SECONDS)
+        result = real_stop(process, *args, **kwargs)
+        assert acknowledged, "nested owned database command never acknowledged startup"
+        return result
+
+    monkeypatch.setattr(module, "_stop_command_group", after_command_started)
     monkeypatch.setattr(module, "COMMAND_TIMEOUT_SECONDS", 8)
     monkeypatch.setattr(module, "COMMAND_TERMINATION_GRACE_SECONDS", 10, raising=False)
     command = [sys.executable, str(ROOT / "tools/lifecycle_test_db.py"), "--postgres-major", "17", "--", sys.executable, "-c", script]
     with adopt_own_descendants():
         data = None
         try:
             assert module.run_existing_database(command, TEST_DSN) == 124
             assert marker.exists(), "nested owned database command never started"
             data = json.loads(marker.read_text())
             remaining = module._docker(["ps", "--all", "--quiet", "--filter", "id=" + data["cid"]])
             assert remaining == "", "outer timeout bypassed nested container cleanup"
             assert not Path(f"/proc/{data['pid']}").exists(), "nested command descendant survived"
         finally:
+            signal.signal(signal.SIGUSR1, previous_usr1)
             # Exact IDs/PIDs acknowledged by this test's owned nested child only.
             if data is None and marker.exists():
                 data = json.loads(marker.read_text())
             if data:
                 try:
                     os.kill(data["pid"], signal.SIGKILL)
                 except ProcessLookupError:
                     pass
                 try:
                     os.waitpid(data["pid"], 0)
                 except ChildProcessError:
                     pass
                 if module._docker(["ps", "-aq", "--filter", "id=" + data["cid"]]):
                     module._docker(["rm", "--force", "--volumes", data["cid"]])
+
+
+@requires_db
+def test_outer_timeout_during_owned_database_startup_cleans_its_container(monkeypatch, tmp_path):
+    module = harness()
+    marker = tmp_path / "startup-container-id"
+    command_marker = tmp_path / "command-started"
+    port_known = threading.Event()
+    previous_usr1 = signal.getsignal(signal.SIGUSR1)
+    signal.signal(signal.SIGUSR1, lambda *args: port_known.set())
+    worker = f"from pathlib import Path; Path({str(command_marker)!r}).touch()"
+    driver = f"""
+import os,signal,sys,threading
+from pathlib import Path
+from tools import lifecycle_test_db as module
+real_docker=module._docker
+created_id=None
+def observed_docker(args,**kwargs):
+    global created_id
+    result=real_docker(args,**kwargs)
+    if args[0]=='run':
+        created_id=result
+    if args[0]=='port':
+        Path({str(marker)!r}).write_text(created_id)
+        os.kill({os.getpid()},signal.SIGUSR1)
+        threading.Event().wait(30)
+    return result
+module._docker=observed_docker
+raise SystemExit(module.isolated_database([sys.executable,'-c',{worker!r}],17))
+"""
+    real_stop = module._stop_command_group
+
+    def after_owned_startup(process, *args, **kwargs):
+        acknowledged = port_known.wait(module.READINESS_TIMEOUT_SECONDS)
+        result = real_stop(process, *args, **kwargs)
+        assert acknowledged, "owned container startup never acknowledged its identity"
+        return result
+
+    monkeypatch.setattr(module, "_stop_command_group", after_owned_startup)
+    monkeypatch.setattr(module, "COMMAND_TIMEOUT_SECONDS", 1)
+    monkeypatch.setattr(module, "COMMAND_TERMINATION_GRACE_SECONDS", 10)
+    try:
+        assert module.run_existing_database([sys.executable, "-c", driver], TEST_DSN) == 124
+        assert marker.exists()
+        assert not command_marker.exists(), "test cancellation missed the database startup phase"
+        assert module._docker(["ps", "-aq", "--filter", "id=" + marker.read_text()]) == ""
+    finally:
+        signal.signal(signal.SIGUSR1, previous_usr1)
+        if marker.exists() and module._docker(["ps", "-aq", "--filter", "id=" + marker.read_text()]):
+            module._docker(["rm", "--force", "--volumes", marker.read_text()])
+
+
+@requires_db
+def test_two_real_harness_invocations_with_one_name_preserve_the_first(monkeypatch, tmp_path):
+    module = harness()
+    suffix = module.secrets.token_hex(12)
+    marker = tmp_path / "first-harness.json"
+    first_ready = threading.Event()
+    previous_usr1 = signal.getsignal(signal.SIGUSR1)
+    signal.signal(signal.SIGUSR1, lambda *args: first_ready.set())
+    worker = (
+        "import os,json,signal,subprocess,threading; from pathlib import Path; from urllib.parse import urlsplit; "
+        "port=str(urlsplit(os.environ['TEST_DATABASE_URL']).port); "
+        f"ids=subprocess.check_output({module.DOCKER!r}+['ps','--no-trunc','-q','--filter','publish='+port],text=True).splitlines(); "
+        "assert len(ids)==1; "
+        f"Path({str(marker)!r}).write_text(json.dumps(dict(cid=ids[0],pid=os.getpid()))); "
+        f"os.kill({os.getpid()},signal.SIGUSR1); threading.Event().wait(30)"
+    )
+    driver = (
+        "import sys; from tools import lifecycle_test_db as module; "
+        f"module.secrets.token_hex=lambda *args:{suffix!r}; "
+        f"raise SystemExit(module.isolated_database([sys.executable,'-c',{worker!r}],17))"
+    )
+    first = subprocess.Popen([sys.executable, "-c", driver], env=module.child_environment(TEST_DSN), start_new_session=True)
+    try:
+        assert first_ready.wait(15), "first real harness did not acknowledge its owned container"
+        first_id = json.loads(marker.read_text())["cid"]
+        monkeypatch.setattr(module.secrets, "token_hex", lambda *args: suffix)
+        assert module.isolated_database([sys.executable, "-c", "pass"], 17) == 2
+        assert module._docker(["inspect", "--format", "{{.Id}}", first_id]) == first_id
+    finally:
+        signal.signal(signal.SIGUSR1, previous_usr1)
+        module._stop_command_group(first)
diff --git a/tools/lifecycle_test_db.py b/tools/lifecycle_test_db.py
index 9f4adbb..04af343 100644
--- a/tools/lifecycle_test_db.py
+++ b/tools/lifecycle_test_db.py
@@ -114,20 +114,47 @@ def _termination_handlers():
 
     try:
         for sig in previous:
             signal.signal(sig, interrupted)
         yield
     finally:
         for sig, handler in previous.items():
             signal.signal(sig, handler)
 
 
+@contextmanager
+def _defer_termination(on_signal=None):
+    """Finish bounded cleanup before propagating cancellation, including repeats."""
+    if threading.current_thread() is not threading.main_thread():
+        yield
+        return
+    previous = {sig: signal.getsignal(sig) for sig in (signal.SIGTERM, signal.SIGINT)}
+    pending = None
+
+    def deferred(signum, frame):
+        nonlocal pending
+        if pending is None:
+            pending = signum
+        if on_signal is not None:
+            on_signal()
+
+    try:
+        for sig in previous:
+            signal.signal(sig, deferred)
+        yield
+    finally:
+        for sig, handler in previous.items():
+            signal.signal(sig, handler)
+    if pending is not None:
+        raise _HarnessTermination(pending)
+
+
 def _group_has_live_processes(pgid: int) -> bool:
     # The selected Linux Docker environment exposes /proc. Zombies cannot run
     # work; the direct child is reaped by Popen, other parents reap their children.
     try:
         os.killpg(pgid, 0)
     except ProcessLookupError:
         return False
     for directory in Path("/proc").iterdir():
         if not directory.name.isdigit():
             continue
@@ -135,39 +162,48 @@ def _group_has_live_processes(pgid: int) -> bool:
             fields = (directory / "stat").read_text().rsplit(")", 1)[1].split()
             if int(fields[2]) == pgid and fields[0] != "Z":
                 return True
         except (FileNotFoundError, ProcessLookupError, PermissionError):
             continue
     return False
 
 
 def _stop_command_group(process: subprocess.Popen, grace_seconds: float | None = None) -> None:
     pgid = process.pid  # start_new_session makes the child's PID its owned PGID.
-    try:
-        os.killpg(pgid, signal.SIGTERM)
-    except ProcessLookupError:
-        pass
-    deadline = time.monotonic() + (COMMAND_TERMINATION_GRACE_SECONDS if grace_seconds is None else grace_seconds)
-    while _group_has_live_processes(pgid) and time.monotonic() < deadline:
-        process.poll()
-        threading.Event().wait(0.05)
-    if _group_has_live_processes(pgid):
+    grace_deadline = time.monotonic() + (COMMAND_TERMINATION_GRACE_SECONDS if grace_seconds is None else grace_seconds)
+
+    def escalate():
+        nonlocal grace_deadline
+        grace_deadline = min(grace_deadline, time.monotonic())
+
+    # Signals can arrive inside the timeout exception handler itself. A sibling
+    # except cannot catch them there; defer them until this group's cleanup is
+    # complete and immediately shorten grace so outer cancellation stays bounded.
+    with _defer_termination(escalate):
         try:
-            os.killpg(pgid, signal.SIGKILL)
+            os.killpg(pgid, signal.SIGTERM)
         except ProcessLookupError:
             pass
-    process.wait(timeout=5)
-    deadline = time.monotonic() + 5
-    while _group_has_live_processes(pgid) and time.monotonic() < deadline:
-        threading.Event().wait(0.05)
-    if _group_has_live_processes(pgid):
-        raise RuntimeError("owned command process group cleanup failed")
+        while _group_has_live_processes(pgid) and time.monotonic() < grace_deadline:
+            process.poll()
+            threading.Event().wait(0.05)
+        if _group_has_live_processes(pgid):
+            try:
+                os.killpg(pgid, signal.SIGKILL)
+            except ProcessLookupError:
+                pass
+        process.wait(timeout=5)
+        deadline = time.monotonic() + 5
+        while _group_has_live_processes(pgid) and time.monotonic() < deadline:
+            threading.Event().wait(0.05)
+        if _group_has_live_processes(pgid):
+            raise RuntimeError("owned command process group cleanup failed")
 
 
 def _cleanup_owned_container(name: str, owner: str, created_id: str | None) -> None:
     candidate = created_id or name
     # Inspect only immutable identity and invocation marker; never read env/password.
     template = '{"id":{{json .Id}},"owner":{{json (index .Config.Labels "poller.lifecycle-test.owner")}}}'
     try:
         metadata = json.loads(_docker(["inspect", "--type", "container", "--format", template, candidate]))
     except (subprocess.SubprocessError, OSError):
         if created_id is None:
@@ -227,22 +263,22 @@ def isolated_database(command: list[str], postgres_major: int = 17) -> int:
     """Provision a new owned container, run a bounded child, and clean only it."""
     if postgres_major not in {16, 17}:
         raise ValueError("postgres-major must be 17 or 16")
     if not command:
         raise ValueError("a test command is required")
     with _termination_handlers():
         return _isolated_database(command, postgres_major)
 
 
 def _isolated_database(command: list[str], postgres_major: int) -> int:
-    owner = secrets.token_hex(12)
-    name = "poller-lifecycle-test-" + owner
+    name = "poller-lifecycle-test-" + secrets.token_hex(12)
+    owner = secrets.token_urlsafe(24)  # Invocation identity is independent of name collision.
     password = secrets.token_urlsafe(32)
     created_id = None
     try:
         created_id = _docker([
             "run", "--detach", "--name", name, "--label", "poller.lifecycle-test=owned",
             "--label", "poller.lifecycle-test.owner=" + owner,
             "--publish", "127.0.0.1::5432",
             "--env", "POSTGRES_PASSWORD=" + password,
             "--env", "POSTGRES_DB=poller_lifecycle_test", f"postgres:{postgres_major}",
         ], timeout=180)
@@ -271,21 +307,22 @@ def _isolated_database(command: list[str], postgres_major: int) -> int:
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
-        _cleanup_owned_container(name, owner, created_id)
+        with _defer_termination():
+            _cleanup_owned_container(name, owner, created_id)
 
 
 def main() -> int:
     parser = argparse.ArgumentParser(description=__doc__)
     parser.add_argument("--postgres-major", type=int, choices=(17, 16), default=17)
     parser.add_argument("--existing-service", action="store_true", help="reuse CI's explicit local TEST_DATABASE_URL")
     parser.add_argument("command", nargs=argparse.REMAINDER)
     args = parser.parse_args()
     command = args.command[1:] if args.command[:1] == ["--"] else args.command
     if not command:
