# Full pinned review package

BASE: 8731cd32adb67755dfbbdd7ee53e09ec03d239c5

HEAD: 7825265abac2c2e32a61ace1caebd45563128faa

## Commits

7825265abac2c2e32a61ace1caebd45563128faa fix: bound maintenance phase timing and abort unlocked reconnects


## Files

 .../task-4-evidence/fix1-final16.txt               |   4 +
 .../task-4-evidence/fix1-final17.txt               |   4 +
 .../task-4-evidence/fix1-green-attempt17.txt       |   4 +
 .../task-4-evidence/fix1-green2-17.txt             |   4 +
 .../task-4-evidence/fix1-red17.txt                 | 236 +++++++++++++++++++++
 .../task-4-evidence/fix1-ruff.txt                  |   1 +
 .../task-4-report.md                               |  95 +++++++++
 job_discovery/lifecycle/maintenance.py             | 192 ++++++++++++-----
 job_discovery/run.py                               |  16 ++
 tests/test_lifecycle_maintenance.py                |  70 +++---
 tests/test_maintenance_controlflow.py              | 153 +++++++++++++
 tests/test_run.py                                  |  49 +++++
 12 files changed, 751 insertions(+), 77 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-final16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-final16.txt
new file mode 100644
index 0000000..0ee11e0
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-final16.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [ 74%]
+.........................                                                [100%]
+97 passed in 64.45s (0:01:04)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-final17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-final17.txt
new file mode 100644
index 0000000..64f2c99
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-final17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 74%]
+.........................                                                [100%]
+97 passed in 51.77s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-green-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-green-attempt17.txt
new file mode 100644
index 0000000..af813fe
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-green-attempt17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 93%]
+.....                                                                    [100%]
+77 passed in 39.09s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-green2-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-green2-17.txt
new file mode 100644
index 0000000..6ed72e9
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-green2-17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 91%]
+.......                                                                  [100%]
+79 passed in 37.90s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-red17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-red17.txt
new file mode 100644
index 0000000..dee168b
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-red17.txt
@@ -0,0 +1,236 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FFF                                                                      [100%]
+=================================== FAILURES ===================================
+________ test_actual_payload_loop_yields_commits_renews_and_resumes[0] _________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f1dc3deac90>
+lock_cost = 0
+
+    @pytest.mark.parametrize('lock_cost', [0, 0.02])
+    def test_actual_payload_loop_yields_commits_renews_and_resumes(monkeypatch, lock_cost):
+        clock = [0.0]
+        renewal_times, commits, mutations = [], [], []
+        payloads = {f'job:{i:03d}': [True, True] for i in range(250)}
+        state = {'cursor': None, 'next_phase': 0}
+        class Connection:
+            timeout = 5000
+            def execute(self, query, params=None):
+                if query.startswith('SHOW transaction_isolation'):
+                    return Result({'transaction_isolation': 'read committed'})
+                if query.startswith('SELECT 1 FROM lifecycle_claims'):
+                    return Result({'exists': 1})
+                if query.startswith('SELECT cursor,next_phase'):
+                    return Result(state.copy())
+                if query.startswith('SELECT id FROM jobs WHERE ('):
+                    return Result(rows=[{'id': key} for key in payloads if params[0] is None or key > params[0]][:params[2]])
+                if query.startswith('SELECT j.id,'):
+                    return Result(rows=[{'id': key,'description_due': payloads[key][0],
+                        'questions_due': payloads[key][1],'description_bytes': 2,'question_bytes': 2}
+                        for key in params[0]])
+                if query.startswith('SELECT id FROM jobs'):
+                    return Result(rows=[])
+                if query.startswith('SELECT pg_advisory_xact_lock(hashtextextended'):
+                    clock[0] += lock_cost
+                if query.startswith('SET LOCAL statement_timeout'):
+                    self.timeout = 5000  # Actual enter_gate resets this during lock_jobs.
+                if "set_config('statement_timeout'" in query:
+                    self.timeout = int(params[0])
+                if query.startswith('UPDATE lifecycle_maintenance_state SET cursor'):
+                    state.update(cursor=params[0], next_phase=params[1])
+                if query.startswith('UPDATE jobs SET description') or query.startswith('DELETE FROM job_questions'):
+                    mutations.append((clock[0], self.timeout))
+                    payloads[params[0]][0 if query.startswith('UPDATE jobs') else 1] = False
+                    clock[0] += 0.2
+                return Result()
+            def commit(self):
+                commits.append(clock[0])
+            def rollback(self):
+                pass
+        ctl = SimpleNamespace(maintenance_enabled=True,retirement_enabled=True,
+                              retirement_dry_run=False,safety_stage='enforced')
+        monkeypatch.setattr(m,'monotonic',lambda: clock[0])
+        monkeypatch.setattr(m,'validate_claim',lambda *a: None)
+        monkeypatch.setattr(m,'read_control',lambda c: ctl)
+        def renew(c, claim, seconds):
+            assert commits and commits[-1] == clock[0]
+            assert seconds == 120
+            renewal_times.append(clock[0])
+            return claim
+        monkeypatch.setattr(m,'renew_claim',renew)
+        monkeypatch.setattr(m,'_metrics',lambda *a: False)
+        monkeypatch.setattr(m,'_version_batch',lambda *a: (0,0,0))
+        monkeypatch.setattr(m,'_staging_batch',lambda *a: 0)
+        monkeypatch.setattr(m,'_terminal_batch',lambda *a: 0)
+        conn = Connection()
+        claim = SimpleNamespace(owner_token='ordinary-timing',generation=1)
+        result = m.sweep(conn,claim,dry_run=False)
+>       assert clock[0] <= 90 + 1e-8
+E       assert 100.00000000000088 <= (90 + 1e-08)
+
+tests/test_maintenance_controlflow.py:78: AssertionError
+_______ test_actual_payload_loop_yields_commits_renews_and_resumes[0.02] _______
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f1dc31fedb0>
+lock_cost = 0.02
+
+    @pytest.mark.parametrize('lock_cost', [0, 0.02])
+    def test_actual_payload_loop_yields_commits_renews_and_resumes(monkeypatch, lock_cost):
+        clock = [0.0]
+        renewal_times, commits, mutations = [], [], []
+        payloads = {f'job:{i:03d}': [True, True] for i in range(250)}
+        state = {'cursor': None, 'next_phase': 0}
+        class Connection:
+            timeout = 5000
+            def execute(self, query, params=None):
+                if query.startswith('SHOW transaction_isolation'):
+                    return Result({'transaction_isolation': 'read committed'})
+                if query.startswith('SELECT 1 FROM lifecycle_claims'):
+                    return Result({'exists': 1})
+                if query.startswith('SELECT cursor,next_phase'):
+                    return Result(state.copy())
+                if query.startswith('SELECT id FROM jobs WHERE ('):
+                    return Result(rows=[{'id': key} for key in payloads if params[0] is None or key > params[0]][:params[2]])
+                if query.startswith('SELECT j.id,'):
+                    return Result(rows=[{'id': key,'description_due': payloads[key][0],
+                        'questions_due': payloads[key][1],'description_bytes': 2,'question_bytes': 2}
+                        for key in params[0]])
+                if query.startswith('SELECT id FROM jobs'):
+                    return Result(rows=[])
+                if query.startswith('SELECT pg_advisory_xact_lock(hashtextextended'):
+                    clock[0] += lock_cost
+                if query.startswith('SET LOCAL statement_timeout'):
+                    self.timeout = 5000  # Actual enter_gate resets this during lock_jobs.
+                if "set_config('statement_timeout'" in query:
+                    self.timeout = int(params[0])
+                if query.startswith('UPDATE lifecycle_maintenance_state SET cursor'):
+                    state.update(cursor=params[0], next_phase=params[1])
+                if query.startswith('UPDATE jobs SET description') or query.startswith('DELETE FROM job_questions'):
+                    mutations.append((clock[0], self.timeout))
+                    payloads[params[0]][0 if query.startswith('UPDATE jobs') else 1] = False
+                    clock[0] += 0.2
+                return Result()
+            def commit(self):
+                commits.append(clock[0])
+            def rollback(self):
+                pass
+        ctl = SimpleNamespace(maintenance_enabled=True,retirement_enabled=True,
+                              retirement_dry_run=False,safety_stage='enforced')
+        monkeypatch.setattr(m,'monotonic',lambda: clock[0])
+        monkeypatch.setattr(m,'validate_claim',lambda *a: None)
+        monkeypatch.setattr(m,'read_control',lambda c: ctl)
+        def renew(c, claim, seconds):
+            assert commits and commits[-1] == clock[0]
+            assert seconds == 120
+            renewal_times.append(clock[0])
+            return claim
+        monkeypatch.setattr(m,'renew_claim',renew)
+        monkeypatch.setattr(m,'_metrics',lambda *a: False)
+        monkeypatch.setattr(m,'_version_batch',lambda *a: (0,0,0))
+        monkeypatch.setattr(m,'_staging_batch',lambda *a: 0)
+        monkeypatch.setattr(m,'_terminal_batch',lambda *a: 0)
+        conn = Connection()
+        claim = SimpleNamespace(owner_token='ordinary-timing',generation=1)
+        result = m.sweep(conn,claim,dry_run=False)
+>       assert clock[0] <= 90 + 1e-8
+E       assert 105.00000000000094 <= (90 + 1e-08)
+
+tests/test_maintenance_controlflow.py:78: AssertionError
+_________ test_denied_reconnect_lock_aborts_before_all_optional_phases _________
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7f1dc3932750>
+
+    def test_denied_reconnect_lock_aborts_before_all_optional_phases(monkeypatch):
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
+        monkeypatch.setattr(run.db,'finish_run',lambda *a,**kw: finished.append(kw))
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
+tests/test_maintenance_controlflow.py:121:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+job_discovery/run.py:243: in run
+    resolve_new_locations(conn)
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+args = (<tests.test_maintenance_controlflow.test_denied_reconnect_lock_aborts_before_all_optional_phases.<locals>.Connection object at 0x7f1dc39325a0>,)
+kwargs = {}
+
+    def forbidden(*args,**kwargs):
+>       pytest.fail('aborted poll entered an optional phase')
+E       Failed: aborted poll entered an optional phase
+
+tests/test_maintenance_controlflow.py:117: Failed
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery:run.py:172 rollback failed for X; attempting reconnect
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/run.py", line 121, in run
+    else ADAPTERS[ats](token))
+         ^^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_maintenance_controlflow.py", line 114, in source
+    raise RuntimeError('source unavailable')
+RuntimeError: source unavailable
+
+During handling of the above exception, another exception occurred:
+
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/run.py", line 170, in run
+    conn.rollback()
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_maintenance_controlflow.py", line 101, in rollback
+    raise RuntimeError('broken rollback')
+RuntimeError: broken rollback
+ERROR    job_discovery:run.py:196 reconnect failed; aborting poll
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/run.py", line 121, in run
+    else ADAPTERS[ats](token))
+         ^^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_maintenance_controlflow.py", line 114, in source
+    raise RuntimeError('source unavailable')
+RuntimeError: source unavailable
+
+During handling of the above exception, another exception occurred:
+
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/run.py", line 170, in run
+    conn.rollback()
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_maintenance_controlflow.py", line 101, in rollback
+    raise RuntimeError('broken rollback')
+RuntimeError: broken rollback
+
+During handling of the above exception, another exception occurred:
+
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/run.py", line 188, in run
+    raise RuntimeError("poll lock unavailable after reconnect")
+RuntimeError: poll lock unavailable after reconnect
+=========================== short test summary info ============================
+FAILED tests/test_maintenance_controlflow.py::test_actual_payload_loop_yields_commits_renews_and_resumes[0]
+FAILED tests/test_maintenance_controlflow.py::test_actual_payload_loop_yields_commits_renews_and_resumes[0.02]
+FAILED tests/test_maintenance_controlflow.py::test_denied_reconnect_lock_aborts_before_all_optional_phases
+3 failed in 0.30s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-ruff.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix1-ruff.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-report.md
index b56dfcf..f4d2b9d 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-report.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-report.md
@@ -180,10 +180,105 @@ Product/test inventory: new `job_discovery/lifecycle/maintenance.py`, additive
 `tests/test_lifecycle_maintenance.py`, `tests/test_run.py`, and
 `tests/test_size_guard.py`. Existing `tests/test_prune.py` was exercised unchanged.
 Only those files plus this report and its sanitized evidence are author-staged;
 controller ledgers, amendment, dispatch and review files are excluded.
 
 Artifact-only forward correction: the initial staged pytest failure logs contained
 pytest-generated trailing whitespace. It was detected during staging, then
 normalized without altering results or traceback content. The source/test commit
 is `9608f7c`; the forward evidence-normalization commit contains no product or
 test changes. Final source verification above remains applicable.
+
+## Fix Round 1 — ordinary timing and reconnect-abort corrections
+
+FIX_BASE: `8731cd32adb67755dfbbdd7ee53e09ec03d239c5`. Read the full independent
+`task-4-requirements-review.md` and its exact saved offline diagnostics/output.
+The permitted review verdict was **Spec FAIL / Quality CHANGES_REQUIRED**.
+Both findings were valid; the earlier passing tests did not cover their actual
+inner control flow. This forward fix addresses R4-1 and R4-2 only.
+
+R4-1: the worker now applies a remaining-time wrapper to every phase statement,
+including statements issued through a cursor and those after `enter_gate` resets
+its timeout. The 5-second per-statement maximum is clipped to the remaining
+transaction window. Each phase reserves five seconds to persist/commit progress
+and a further five seconds for renewal or final health. Payload work checks its
+yield point between Jobs **and between the two payload mutations**. A half-finished
+pair retains the previous cursor so the next transaction/invocation revisits that
+Job and sees the already-cleared field. Protected/empty rows still advance the
+cursor. Only committed counts/cursors are published in the result; an exhausted
+window rolls back its unfinished batch and returns blocked with earlier progress
+intact. Renewal occurs in a separate transaction after progress has committed,
+with its own remaining deadline. The 90/120/30-second approved values are unchanged;
+renewal is scheduled early enough to fit within 30 seconds. No lease-clock,
+commit-time validation or security-policy change was made.
+
+The previous whole-batch replacement test accepted renewal at 31 seconds and was
+removed. New deterministic regressions execute the **actual** payload loop over
+250 paired caches, charging 0.2 seconds per successful mutation, with both zero
+and 0.02-second per-Job lock costs. They check no new mutations after 90 seconds,
+renewal intervals <=30 seconds, commit-before-renewal, timeout clipping after lock
+helpers, and complete retirement across resumed invocations without skipped pairs.
+A real owned-DB version executes normal SQL mutations and existing valid-claim
+operations while advancing only the worker's monotonic scheduler clock; database
+lease clocks and guards remain real and unmodified. This is ordinary timing
+verification, not an expiry-enforcement probe.
+
+R4-2: a reconnect or reacquisition failure now sets an explicit aborted state.
+The abort path records available counts/diagnostics on a best-effort basis, then
+returns before enrichment, model review or prune. Accounting failure is contained
+and does not reactivate optional phases. Offline tests use raising hooks for all
+three optional capabilities and cover both successful/failed abort accounting.
+An owned-DB regression releases the broken poll session, lets a separate owned
+session take the real poll lock, and proves denied reacquisition records the
+aborted run and invokes no optional phase. Successful reconnect coverage remains.
+
+Fix evidence (all under `task-4-evidence/`):
+
+- `fix1-red17.txt`: **3 failed**, reproducing both findings before product edits
+  (two ordinary timing variants and denied-lock fallthrough).
+- `fix1-green-attempt17.txt`: **77 passed, zero skips** after the first fix.
+- `fix1-green2-17.txt`: **79 passed, zero skips**, adding real-DB timing and
+  contention regressions.
+- Final unchanged-source results and actual versions are recorded below.
+
+Exact fix commands, same owned worktree and bash/login:false:
+
+```sh
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_run_question_fetch.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_run_question_fetch.py -q
+.venv/bin/ruff check .
+git diff --check
+git diff --cached --check
+```
+
+Only maintenance/run implementation, their ordinary tests and author report/fix
+logs are included in this fix. No SQL migration, policy, gate, claim or capacity
+enforcement module changed. Prior migration parity evidence therefore remains
+applicable; no excluded security suite/probe was rerun. Reviewer diagnostics,
+review report, controller ledgers and authorization files remain controller-owned.
+The same independent expiry/capacity/cross-user/adversarial review gaps persist.
+Author verification does not supply independent re-review or security approval.
+
+Release authorization chronology: the report's earlier deployment-hold statements
+are historical. `RELEASE-AUTHORIZATION.md` records Andrew's later authorization to
+publish/merge/deploy the **completed upgrade after all 13 tasks and permitted
+verification**, with applicable safety-floor confirmations retained. This author
+remains local-only and has not released Task 4. The controller owns scoped
+re-review, Library checkpoint, continued implementation and final release.
+
+Fix Round 1 final unchanged-source results:
+
+- `fix1-final17.txt`: **97 passed, zero skipped**, actual PostgreSQL **17.11
+  (Debian 17.11-1.pgdg13+2)**, **51.77 seconds**.
+- `fix1-final16.txt`: **97 passed, zero skipped**, actual PostgreSQL **16.15
+  (Debian 16.15-1.pgdg13+2)**, **64.45 seconds**.
+- `fix1-ruff.txt`: repository Ruff passed. Working and staged whitespace checks
+  passed after normalizing only pytest-generated trailing log whitespace.
+
+No product/test edit occurred after either final lane started. The selected six
+files are the new control-flow regressions, maintenance, run, guard, existing
+prune and question-fetch tests, as listed in the exact commands above. No DB test
+was skipped. The unchanged migration/security source was not redundantly tested
+or re-reviewed. No new safeguard rejection occurred. Both findings are addressed
+in author implementation/tests; independent scoped re-review remains pending.
diff --git a/job_discovery/lifecycle/maintenance.py b/job_discovery/lifecycle/maintenance.py
index f492885..014178c 100644
--- a/job_discovery/lifecycle/maintenance.py
+++ b/job_discovery/lifecycle/maintenance.py
@@ -32,20 +32,73 @@ AND NOT EXISTS(SELECT FROM generation_jobs WHERE job_id=j.id AND status IN ('pen
 AND NOT EXISTS(SELECT FROM job_payload_demands WHERE job_id=j.id AND
  (status IN ('pending','running') AND COALESCE(lease_until,protection_until)>clock_timestamp()
   OR description_snapshot IS NOT NULL OR questions_snapshot IS NOT NULL))
 """
 _DESCRIPTION_DUE = """j.description IS NOT NULL AND
  COALESCE(j.description_last_used_at,j.description_captured_at)<=clock_timestamp()-interval '720 hours'"""
 _QUESTIONS_DUE = """q.questions IS NOT NULL AND q.questions<>'null'::jsonb AND
  COALESCE(q.last_used_at,q.captured_at)<=clock_timestamp()-interval '168 hours'"""
 
 
+
+class _PhaseEnded(Exception):
+    """No more statements may start in this transaction's time window."""
+
+
+class _TimedConnection:
+    """Clip EVERY statement, including statements after enter_gate resets 5s.
+
+    Keep five seconds for persisting/committing progress and another five for
+    renewal/final health. A spent window rolls back only its unfinished batch.
+    This is worker scheduling, independent of the DB-clock enforcement contract.
+    """
+    def __init__(self, conn, end, yield_at=None):
+        self.conn, self.end = conn, end
+        self.yield_at = end if yield_at is None else yield_at
+        self.yielded = False
+
+    def should_yield(self):
+        self.yielded = monotonic() >= self.yield_at
+        return self.yielded
+
+    def _timeout(self):
+        remaining_ms = int((self.end - monotonic()) * 1000)
+        if remaining_ms <= 0:
+            raise _PhaseEnded()
+        self.conn.execute("SELECT set_config('statement_timeout',%s,true)",
+                          (str(min(5000, remaining_ms)),))
+        if monotonic() >= self.end:
+            raise _PhaseEnded()
+
+    def execute(self, query, params=None):
+        self._timeout()
+        return self.conn.execute(query, params)
+
+    def cursor(self, **kwargs):
+        owner = self
+        class Cursor:
+            def __enter__(self):
+                self.real = owner.conn.cursor(**kwargs).__enter__()
+                return self
+            def __exit__(self, *args):
+                return self.real.__exit__(*args)
+            def execute(self, *args, **kw):
+                owner._timeout()
+                return self.real.execute(*args, **kw)
+            def __getattr__(self, name):
+                return getattr(self.real, name)
+        return Cursor()
+
+    def commit(self):
+        self._timeout()
+        self.conn.commit()
+
 def legacy_prune_disabled(conn) -> bool:
     enter_gate(conn)
     return read_control(conn).maintenance_enabled or read_control(conn).safety_stage == 'enforced' or bool(
         conn.execute('SELECT cutover_at FROM lifecycle_maintenance_state WHERE singleton').fetchone()['cutover_at'])
 
 
 def _payload_batch(conn, cursor, limit, dry_run, byte_limit=MAX_RETIRE_BYTES):
     # Scan IDs, including protected/NULL rows, so a permanent prefix cannot starve
     # later jobs. <=250 jobs keeps description/question mutations within 500.
     rows = conn.execute('SELECT id FROM jobs WHERE (%s::text IS NULL OR id COLLATE "C">%s COLLATE "C") ORDER BY id COLLATE "C" LIMIT %s',
@@ -55,37 +108,54 @@ def _payload_batch(conn, cursor, limit, dry_run, byte_limit=MAX_RETIRE_BYTES):
     ids = [r['id'] for r in rows]
     lock_jobs(conn, ids)
     conn.execute('SELECT id FROM jobs WHERE id=ANY(%s) ORDER BY id COLLATE "C" FOR UPDATE', (ids,)).fetchall()
     # Fresh statement snapshot after the gate and job locks, not candidate data.
     eligible = conn.execute(f'''SELECT j.id, ({_DESCRIPTION_DUE}) AS description_due,
       ({_QUESTIONS_DUE}) AS questions_due,
       CASE WHEN {_DESCRIPTION_DUE} THEN octet_length(j.description) ELSE 0 END AS description_bytes,
       CASE WHEN {_QUESTIONS_DUE} THEN octet_length(q.questions::text) ELSE 0 END AS question_bytes
       FROM jobs j LEFT JOIN job_questions q ON q.job_id=j.id
       WHERE j.id=ANY(%s) AND {_UNPROTECTED} ORDER BY j.id COLLATE "C"''', (ids,)).fetchall()
-    retired = size = candidates = 0
-    for row in eligible:
+    retired = size = candidates = visited = 0
+    completed_cursor = cursor
+    eligible_by_id = {row['id']: row for row in eligible}
+    for job_id in ids:
+        if isinstance(conn, _TimedConnection) and conn.should_yield():
+            break
+        row = eligible_by_id.get(job_id)
+        if row is None:
+            visited += 1
+            completed_cursor = job_id
+            continue
+        complete = True
         for field in ('description', 'questions'):
+            if isinstance(conn, _TimedConnection) and conn.should_yield():
+                complete = False
+                break
             if not row[field + '_due']:
                 continue
             candidates += 1
             row_bytes = row['description_bytes' if field == 'description' else 'question_bytes']
             if dry_run or retired >= limit or size + row_bytes > byte_limit:
                 continue
             if field == 'description':
                 conn.execute('UPDATE jobs SET description=NULL,description_pruned=true WHERE id=%s', (row['id'],))
                 size += row['description_bytes']
             else:
                 conn.execute('DELETE FROM job_questions WHERE job_id=%s', (row['id'],))
                 size += row['question_bytes']
             retired += 1
-    return max(len(rows), retired), retired, size, candidates, ids[-1]
+        visited += 1
+        if not complete:
+            break  # Resume this Job; an already-cleared field is simply absent.
+        completed_cursor = job_id
+    return max(visited, retired), retired, size, candidates, completed_cursor
 
 
 def _version_batch(conn, limit, dry_run, byte_limit=MAX_RETIRE_BYTES):
     # A public version may be removed only once its listing revision is archived.
     # FK references are deliberately retained, including terminal private work.
     rows = conn.execute('''SELECT v.id,v.job_id,octet_length(v.public_metadata::text) AS bytes
       FROM job_versions v JOIN source_listings s ON s.id=v.source_listing_id
       WHERE v.id IS DISTINCT FROM s.current_version_id AND v.revision<=s.archived_revision
       AND (v.recorded_at<=clock_timestamp()-interval '720 hours' OR
         (SELECT count(*) FROM job_versions newer WHERE newer.source_listing_id=v.source_listing_id
@@ -206,72 +276,88 @@ def _metrics(conn, scheduled):
     log.info('maintenance metrics: %s guard_active=%s reusable_bytes=unknown action_needed=%s', metrics, guard, row['action_needed'])
     if row['action_needed']:
         log.warning('maintenance action needed: physical guard persists; separately authorized compaction/capacity action may be required')
     return guard or metrics['unresolved']
 
 
 def sweep(conn, claim: ClaimRef, dry_run: bool = True, max_rows: int = MAX_ROWS, *, scheduled: bool = False) -> SweepResult:
     if type(max_rows) is not int or not 1 <= max_rows <= MAX_ROWS:
         raise ValueError('max_rows must be in 1..20000')
     started = renewed = monotonic()
+    deadline = started + DEADLINE_SECONDS
     used = retired = size = eligible = 0
-    validate_claim(conn, claim)
-    if not conn.execute("SELECT 1 FROM lifecycle_claims WHERE kind='maintenance' AND work_id='singleton' AND owner_token=%s AND generation=%s", (claim.owner_token, claim.generation)).fetchone():
-        raise RuntimeError('maintenance singleton claim required')
-    state = conn.execute('SELECT cursor,next_phase FROM lifecycle_maintenance_state WHERE singleton').fetchone()
-    cursor, phase = state['cursor'], state['next_phase']
-    conn.commit()
-    idle = 0
-    payload_finished = versions_finished = False
-    while used < max_rows and size < MAX_RETIRE_BYTES and monotonic() - started < DEADLINE_SECONDS and idle < 6:
-        validate_claim(conn, claim)
-        if monotonic() - renewed >= RENEW_SECONDS:
-            claim = renew_claim(conn, claim, LEASE_SECONDS)
-            renewed = monotonic()
-        remaining_ms = max(1, int((DEADLINE_SECONDS - (monotonic() - started)) * 1000))
-        conn.execute("SELECT set_config('statement_timeout',%s,true)", (str(min(5000, remaining_ms)),))
-        ctl = read_control(conn)
-        if not ctl.maintenance_enabled:
-            conn.commit()
-            break
-        effective_dry = dry_run or ctl.retirement_dry_run or not ctl.retirement_enabled or ctl.safety_stage != 'enforced'
-        limit = min(BATCH_ROWS, max_rows - used)
-        if phase == 0:
-            if payload_finished:
-                n = 0
-            else:
-                n, r, b, e, cursor = _payload_batch(conn, cursor, limit, effective_dry, MAX_RETIRE_BYTES - size)
-                retired += r
-                size += b
-                eligible += e
-                payload_finished = not n
-        elif phase == 1:
-            if versions_finished:
-                n = 0
+    cursor = None
+    phase = 0
+    try:
+        setup = _TimedConnection(conn, min(deadline, renewed + RENEW_SECONDS - 5))
+        validate_claim(setup, claim)
+        if not setup.execute("SELECT 1 FROM lifecycle_claims WHERE kind='maintenance' AND work_id='singleton' AND owner_token=%s AND generation=%s", (claim.owner_token, claim.generation)).fetchone():
+            raise RuntimeError('maintenance singleton claim required')
+        state = setup.execute('SELECT cursor,next_phase FROM lifecycle_maintenance_state WHERE singleton').fetchone()
+        cursor, phase = state['cursor'], state['next_phase']
+        setup.commit()
+        idle = 0
+        payload_finished = versions_finished = False
+        while used < max_rows and size < MAX_RETIRE_BYTES and monotonic() < deadline - 10 and idle < 6:
+            if monotonic() >= renewed + RENEW_SECONDS - 10:
+                # The preceding progress transaction has already committed.
+                renewal = _TimedConnection(conn, min(deadline, renewed + RENEW_SECONDS))
+                renewing_at = monotonic()
+                claim = renew_claim(renewal, claim, LEASE_SECONDS)
+                renewal.commit()
+                renewed = renewing_at
+            end = min(deadline, renewed + RENEW_SECONDS) - 5
+            batch = _TimedConnection(conn, end, end - 5)
+            validate_claim(batch, claim)
+            ctl = read_control(batch)
+            if not ctl.maintenance_enabled:
+                batch.commit()
+                break
+            effective_dry = dry_run or ctl.retirement_dry_run or not ctl.retirement_enabled or ctl.safety_stage != 'enforced'
+            limit = min(BATCH_ROWS, max_rows - used)
+            next_cursor = cursor
+            r = b = e = 0
+            if phase == 0:
+                if payload_finished:
+                    n = 0
+                else:
+                    n, r, b, e, next_cursor = _payload_batch(batch, cursor, limit, effective_dry, MAX_RETIRE_BYTES - size)
+                    payload_finished = not n and not batch.yielded
+            elif phase == 1:
+                if versions_finished:
+                    n = 0
+                else:
+                    n, r, b = _version_batch(batch, limit, effective_dry, MAX_RETIRE_BYTES - size)
+                    versions_finished = effective_dry or not n
+            elif phase == 2:
+                n = _staging_batch(batch, limit)
             else:
-                n, r, b = _version_batch(conn, limit, effective_dry, MAX_RETIRE_BYTES - size)
-                retired += r
-                size += b
-                versions_finished = effective_dry or not n
-        elif phase == 2:
-            n = _staging_batch(conn, limit)
-        else:
-            n = _terminal_batch(conn, limit, phase)
-        idle = idle + 1 if not n else 0
-        used += n
-        phase = (phase + 1) % 6
-        conn.execute('UPDATE lifecycle_maintenance_state SET cursor=%s,next_phase=%s,eligible_rows=%s,retired_rows=%s,retired_bytes=%s WHERE singleton', (cursor, phase, eligible, retired, size))
-        conn.commit()
-    validate_claim(conn, claim)
-    blocked = _metrics(conn, scheduled)
-    conn.commit()
-    return SweepResult(retired, size, blocked, cursor)
+                n = _terminal_batch(batch, limit, phase)
+            next_phase = (phase + 1) % 6
+            batch.execute('UPDATE lifecycle_maintenance_state SET cursor=%s,next_phase=%s,eligible_rows=%s,retired_rows=%s,retired_bytes=%s WHERE singleton', (next_cursor, next_phase, eligible + e, retired + r, size + b))
+            batch.commit()
+            # Report only durable work, including when a later phase times out.
+            used += n
+            retired += r
+            size += b
+            eligible += e
+            cursor, phase = next_cursor, next_phase
+            idle = idle + 1 if not n and not batch.yielded else 0
+        health = _TimedConnection(conn, min(deadline, renewed + RENEW_SECONDS))
+        validate_claim(health, claim)
+        blocked = _metrics(health, scheduled)
+        health.commit()
+        return SweepResult(retired, size, blocked, cursor)
+    except _PhaseEnded:
+        conn.rollback()
+        log.info('maintenance time window exhausted; committed progress retained')
+        return SweepResult(retired, size, True, cursor)
 
 
 def pre_admission_maintenance(dsn: str | None) -> SweepResult:
     conn = None
     try:
         conn = db.connect(dsn)
         enter_gate(conn)
         ctl = read_control(conn)
         if not ctl.maintenance_enabled:
             conn.commit()
diff --git a/job_discovery/run.py b/job_discovery/run.py
index 1763473..9e97aef 100644
--- a/job_discovery/run.py
+++ b/job_discovery/run.py
@@ -103,20 +103,21 @@ def run(dsn: str | None = None) -> dict:
             log.warning("%s; checking closures without ingestion or enrichment", guard_note)
 
         run_id = db.start_run(conn)
         if not over:
             db.sync_seed(conn, targets)
         conn.commit()
         companies = db.active_companies(conn)
         conn.commit()  # No read transaction spans adapter HTTP.
 
         ok = failed = new_jobs = closed_jobs = 0
+        aborted = False
         failures: list[str] = []
 
         for co in companies:
             ats, token, company_id = co["ats"], co["token"], co["id"]
             try:
                 company_closed = 0
                 postings = (ADAPTERS[ats](token, fetch_details=False)
                             if over and ats in {"workday", "smartrecruiters"}
                             else ADAPTERS[ats](token))
                 admissible_ids = set()
@@ -186,20 +187,21 @@ def run(dsn: str | None = None) -> dict:
                         ).fetchone()["locked"]
                         if not locked:
                             raise RuntimeError("poll lock unavailable after reconnect")
                         try:
                             reconnect_over, _, _ = db.over_size_ceiling(conn)
                         except Exception:
                             conn.rollback()
                             reconnect_over = True
                         over = over or maintenance.blocked or reconnect_over
                     except Exception:
+                        aborted = True
                         log.exception("reconnect failed; aborting poll")
                         failures.append(f"{co['name']}: {type(exc).__name__}: {exc}")
                         failed += 1
                         break
                 failed += 1
                 failures.append(f"{co['name']}: {type(exc).__name__}: {exc}")
                 log.exception("poll failed for %s (%s:%s)", co["name"], ats, token)
                 # Track the failure so a persistently dead board is eventually
                 # deactivated. The company's poll work was rolled back, so this
                 # write needs its own commit; isolate it so a hiccup here never
@@ -212,20 +214,34 @@ def run(dsn: str | None = None) -> dict:
                             "deactivating dead board %s (%s:%s) after %d consecutive failures",
                             co["name"], ats, token, db.POLL_FAILURE_DEACTIVATE)
                 except Exception:
                     try:
                         conn.rollback()
                     except Exception:
                         log.exception("rollback after failure-record error failed for %s",
                                       co["name"])
                     log.exception("recording poll failure for %s failed", co["name"])
 
+        if aborted:
+            # Reconnect/lock acquisition failed: accounting is best effort, and
+            # this invocation must never enter any optional post-poll phase.
+            try:
+                db.finish_run(
+                    conn, run_id, companies_ok=ok, companies_failed=failed,
+                    new_jobs=new_jobs, closed_jobs=closed_jobs,
+                    notes="; ".join(["poll aborted after reconnect failure", *failures]),
+                )
+                conn.commit()
+            except Exception:
+                log.exception("could not finalize aborted poll accounting")
+            return {"ok": ok, "failed": failed, "new_jobs": new_jobs, "closed_jobs": closed_jobs}
+
         db.finish_run(
             conn, run_id,
             companies_ok=ok, companies_failed=failed,
             new_jobs=new_jobs, closed_jobs=closed_jobs,
             notes="; ".join(([guard_note] if guard_note else []) + failures) or None,
         )
         conn.commit()
         log.info("run complete: ok=%s failed=%s new=%s closed=%s",
                  ok, failed, new_jobs, closed_jobs)
 
diff --git a/tests/test_lifecycle_maintenance.py b/tests/test_lifecycle_maintenance.py
index b9df872..07cfecc 100644
--- a/tests/test_lifecycle_maintenance.py
+++ b/tests/test_lifecycle_maintenance.py
@@ -260,44 +260,20 @@ def test_only_scheduled_guarded_sweeps_increment_action_streak(conn, monkeypatch
     assert m.sweep(conn,c).blocked
     assert conn.execute('SELECT guard_scheduled_streak FROM lifecycle_maintenance_state').fetchone()['guard_scheduled_streak'] == 0
     m.sweep(conn,c,scheduled=True)
     assert not conn.execute('SELECT action_needed FROM lifecycle_maintenance_state').fetchone()['action_needed']
     m.sweep(conn,c,scheduled=True)
     metrics = conn.execute('SELECT * FROM lifecycle_maintenance_state').fetchone()
     assert metrics['action_needed'] and metrics['physical_bytes'] > 0
     assert metrics['reusable_bytes'] is None and metrics['live_tuples'] >= 0
 
 
-@requires_db
-def test_cooperative_deadline_and_renewal_between_short_transactions(conn, monkeypatch):
-    m = module()
-    enable(conn)
-    c = claim(conn)
-    clock = [0]
-    calls = []
-    renewals = []
-    monkeypatch.setattr(m,'monotonic',lambda: clock[0])
-    original_renew = m.renew_claim
-    def renew(*args):
-        renewals.append(clock[0])
-        return original_renew(*args)
-    monkeypatch.setattr(m,'renew_claim',renew)
-    def batch(*args):
-        assert clock[0] < 90
-        calls.append(clock[0])
-        clock[0] += 31
-        return 250,0,0,0,'progress'
-    monkeypatch.setattr(m,'_payload_batch',batch)
-    m.sweep(conn,c)
-    assert calls == [0,31,62] and renewals == [31,62]
-
-
 @requires_db
 def test_deleted_reservation_detail_requires_persisted_claim_floor(conn):
     # Ordinary settled/fenced-record retention. No forged-token/expiry probes.
     from job_discovery.lifecycle.claims import claim_work, cancel_claim
     from job_discovery.lifecycle.capacity import reserve_capacity
     m = module()
     c = claim_work(conn,'test-retention','one',180)
     reservation = reserve_capacity(conn,c,10)
     conn.commit()
     cancel_claim(conn,c)
@@ -368,10 +344,56 @@ def test_retirement_byte_budget_defers_remaining_payload(conn):
     cid = _company(conn,'bytes')
     jid = _job(conn,cid,'1')
     conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-interval '31 days'")
     conn.execute("INSERT INTO job_questions(job_id,questions,captured_at) VALUES(%s,'[]',clock_timestamp()-interval '8 days')",(jid,))
     conn.commit()
     enter_gate(conn)
     _,rows,size,_,_ = m._payload_batch(conn,None,2000,False,byte_limit=2)
     conn.commit()
     assert rows == 1 and size == 2
     assert conn.execute('SELECT questions FROM job_questions').fetchone()['questions'] == []
+
+
+@requires_db
+def test_slow_successful_payload_statements_commit_resumable_progress(conn, monkeypatch):
+    """Virtual worker elapsed time; DB lease clocks and guards stay real/unmodified."""
+    from dataclasses import replace
+    m = module()
+    cid = _company(conn,'slow')
+    conn.execute("""INSERT INTO jobs(id,company_id,external_id,title,url,description,description_captured_at)
+      SELECT 'lever:slow:'||lpad(n::text,3,'0'),%s,n::text,'Eng','u','jd',clock_timestamp()-interval '31 days'
+      FROM generate_series(1,250) n""",(cid,))
+    conn.execute("INSERT INTO job_questions(job_id,questions,captured_at) SELECT id,'[]',clock_timestamp()-interval '8 days' FROM jobs")
+    conn.commit()
+    enable(conn)
+    c = claim(conn)
+    clock = [0.0]
+    starts, renewals, commits = [], [], []
+    class SlowStatements:
+        def execute(self, query, params=None):
+            result = conn.execute(query,params)
+            if query.startswith('UPDATE jobs SET description') or query.startswith('DELETE FROM job_questions'):
+                starts.append(clock[0])
+                clock[0] += 0.2
+            return result
+        def commit(self):
+            conn.commit()
+            commits.append(clock[0])
+        def __getattr__(self,name):
+            return getattr(conn,name)
+    actual_control, actual_renew = m.read_control, m.renew_claim
+    monkeypatch.setattr(m,'read_control',lambda db: replace(actual_control(db),safety_stage='enforced',retirement_enabled=True,retirement_dry_run=False))
+    monkeypatch.setattr(m,'monotonic',lambda: clock[0])
+    def renew(db,ref,seconds):
+        assert commits[-1] == clock[0]
+        renewals.append(clock[0])
+        return actual_renew(db,ref,seconds)
+    monkeypatch.setattr(m,'renew_claim',renew)
+    first = m.sweep(SlowStatements(),c,dry_run=False)
+    assert clock[0] <= 90 and all(t < 90 for t in starts)
+    assert renewals and max(b-a for a,b in zip([0,*renewals],[*renewals,clock[0]])) <= 30
+    assert 0 < first.retired_rows < 500
+    assert conn.execute('SELECT cursor FROM lifecycle_maintenance_state').fetchone()['cursor'] == first.cursor
+    second = m.sweep(SlowStatements(),c,dry_run=False)
+    assert first.retired_rows + second.retired_rows == 500
+    assert conn.execute('SELECT count(*) AS n FROM jobs WHERE description IS NULL').fetchone()['n'] == 250
+    assert conn.execute('SELECT count(*) AS n FROM job_questions').fetchone()['n'] == 0
diff --git a/tests/test_maintenance_controlflow.py b/tests/test_maintenance_controlflow.py
new file mode 100644
index 0000000..d541b09
--- /dev/null
+++ b/tests/test_maintenance_controlflow.py
@@ -0,0 +1,153 @@
+"""Ordinary worker timing and reconnect flow; no DB security enforcement probes."""
+from types import SimpleNamespace
+
+import pytest
+
+from job_discovery.lifecycle import maintenance as m
+from job_discovery.lifecycle.types import SweepResult
+import job_discovery.run as run
+
+
+class Result:
+    def __init__(self, one=None, rows=None):
+        self.one, self.rows = one, rows
+    def fetchone(self):
+        return self.one
+    def fetchall(self):
+        return self.rows
+
+
+@pytest.mark.parametrize('lock_cost', [0, 0.02])
+def test_actual_payload_loop_yields_commits_renews_and_resumes(monkeypatch, lock_cost):
+    clock = [0.0]
+    renewal_times, commits, mutations = [], [], []
+    payloads = {f'job:{i:03d}': [True, True] for i in range(250)}
+    state = {'cursor': None, 'next_phase': 0}
+    class Connection:
+        timeout = 5000
+        def execute(self, query, params=None):
+            if query.startswith('SHOW transaction_isolation'):
+                return Result({'transaction_isolation': 'read committed'})
+            if query.startswith('SELECT 1 FROM lifecycle_claims'):
+                return Result({'exists': 1})
+            if query.startswith('SELECT cursor,next_phase'):
+                return Result(state.copy())
+            if query.startswith('SELECT id FROM jobs WHERE ('):
+                return Result(rows=[{'id': key} for key in payloads if params[0] is None or key > params[0]][:params[2]])
+            if query.startswith('SELECT j.id,'):
+                return Result(rows=[{'id': key,'description_due': payloads[key][0],
+                    'questions_due': payloads[key][1],'description_bytes': 2,'question_bytes': 2}
+                    for key in params[0]])
+            if query.startswith('SELECT id FROM jobs'):
+                return Result(rows=[])
+            if query.startswith('SELECT pg_advisory_xact_lock(hashtextextended'):
+                clock[0] += lock_cost
+            if query.startswith('SET LOCAL statement_timeout'):
+                self.timeout = 5000  # Actual enter_gate resets this during lock_jobs.
+            if "set_config('statement_timeout'" in query:
+                self.timeout = int(params[0])
+            if query.startswith('UPDATE lifecycle_maintenance_state SET cursor'):
+                state.update(cursor=params[0], next_phase=params[1])
+            if query.startswith('UPDATE jobs SET description') or query.startswith('DELETE FROM job_questions'):
+                mutations.append((clock[0], self.timeout))
+                payloads[params[0]][0 if query.startswith('UPDATE jobs') else 1] = False
+                clock[0] += 0.2
+            return Result()
+        def commit(self):
+            commits.append(clock[0])
+        def rollback(self):
+            pass
+    ctl = SimpleNamespace(maintenance_enabled=True,retirement_enabled=True,
+                          retirement_dry_run=False,safety_stage='enforced')
+    monkeypatch.setattr(m,'monotonic',lambda: clock[0])
+    monkeypatch.setattr(m,'validate_claim',lambda *a: None)
+    monkeypatch.setattr(m,'read_control',lambda c: ctl)
+    def renew(c, claim, seconds):
+        assert commits and commits[-1] == clock[0]
+        assert seconds == 120
+        renewal_times.append(clock[0])
+        return claim
+    monkeypatch.setattr(m,'renew_claim',renew)
+    monkeypatch.setattr(m,'_metrics',lambda *a: False)
+    monkeypatch.setattr(m,'_version_batch',lambda *a: (0,0,0))
+    monkeypatch.setattr(m,'_staging_batch',lambda *a: 0)
+    monkeypatch.setattr(m,'_terminal_batch',lambda *a: 0)
+    conn = Connection()
+    claim = SimpleNamespace(owner_token='ordinary-timing',generation=1)
+    result = m.sweep(conn,claim,dry_run=False)
+    assert clock[0] <= 90 + 1e-8
+    assert mutations and all(start < 90 for start,_ in mutations)
+    assert all(timeout <= min(5000,int((90-start)*1000)+1) for start,timeout in mutations)
+    assert renewal_times
+    assert max(b-a for a,b in zip([0,*renewal_times],[*renewal_times,clock[0]])) <= 30
+    assert 0 < result.retired_rows < 500
+    # Fresh invocation resumes persisted Job cursor, including any half-done pair.
+    result2 = m.sweep(conn,claim,dry_run=False)
+    assert result.retired_rows + result2.retired_rows == 500
+    assert all(pair == [False,False] for pair in payloads.values())
+
+
+@pytest.mark.parametrize('accounting_fails', [False, True])
+def test_denied_reconnect_lock_aborts_before_all_optional_phases(monkeypatch, accounting_fails):
+    finished, closes = [], []
+    class Connection:
+        def __init__(self, locked, broken=False):
+            self.locked, self.broken = locked, broken
+        def execute(self, *args):
+            return Result({'locked':self.locked})
+        def commit(self):
+            pass
+        def rollback(self):
+            if self.broken:
+                raise RuntimeError('broken rollback')
+        def close(self):
+            closes.append(self.locked)
+    connections = iter([Connection(True,True),Connection(False)])
+    monkeypatch.setattr(run,'pre_admission_maintenance',lambda dsn: SweepResult(0,0,False,None))
+    monkeypatch.setattr(run,'load_targets',lambda: [])
+    monkeypatch.setattr(run.db,'connect',lambda dsn: next(connections))
+    monkeypatch.setattr(run.db,'over_size_ceiling',lambda c: (False,20,6000))
+    monkeypatch.setattr(run.db,'start_run',lambda c: 1)
+    monkeypatch.setattr(run.db,'sync_seed',lambda *a: None)
+    monkeypatch.setattr(run.db,'active_companies',lambda c: [{'id':1,'ats':'lever','token':'x','name':'X'}])
+    def finish(*args, **kw):
+        finished.append(kw)
+        if accounting_fails:
+            raise RuntimeError('accounting unavailable')
+    monkeypatch.setattr(run.db,'finish_run',finish)
+    def source(token):
+        raise RuntimeError('source unavailable')
+    monkeypatch.setitem(run.ADAPTERS,'lever',source)
+    def forbidden(*args,**kwargs):
+        pytest.fail('aborted poll entered an optional phase')
+    monkeypatch.setattr(run,'_run_prune',forbidden)
+    monkeypatch.setattr('job_discovery.locations.resolve_new_locations',forbidden)
+    monkeypatch.setattr('reviewer.run.review_all',forbidden)
+    assert run.run() == {'ok':0,'failed':1,'new_jobs':0,'closed_jobs':0}
+    assert finished[0]['companies_failed'] == 1
+    assert 'source unavailable' in finished[0]['notes']
+    assert closes == [True,False]
+
+
+def test_remaining_timeout_is_reapplied_after_lock_helpers(monkeypatch):
+    clock = [0.0]
+    class Connection:
+        timeout = None
+        def execute(self, query, params=None):
+            if "set_config('statement_timeout'" in query:
+                self.timeout = int(params[0])
+            elif query.startswith('SET LOCAL statement_timeout'):
+                self.timeout = 5000
+            elif query.startswith('SHOW transaction_isolation'):
+                return Result({'transaction_isolation':'read committed'})
+            return Result()
+    monkeypatch.setattr(m,'monotonic',lambda: clock[0])
+    raw = Connection()
+    timed = m._TimedConnection(raw,2)
+    m.lock_jobs(timed,['job'])
+    clock[0] = 1.9
+    timed.execute('SELECT 1')
+    assert 0 < raw.timeout <= 101
+    clock[0] = 2
+    with pytest.raises(m._PhaseEnded):
+        timed.execute('SELECT 1')
diff --git a/tests/test_run.py b/tests/test_run.py
index d9d74f4..99dd116 100644
--- a/tests/test_run.py
+++ b/tests/test_run.py
@@ -695,10 +695,59 @@ def test_chunk_guard_preserves_committed_admissions_and_completes_verification(c
     monkeypatch.setitem(ADAPTERS,'lever',lambda token: [Posting(external_id=str(i),title='Engineer',url='u') for i in range(1001)])
     def forbidden(*args,**kw):
         raise AssertionError('guarded cycle invoked model work')
     monkeypatch.setattr('reviewer.run.review_all',forbidden)
     monkeypatch.setattr('job_discovery.locations.resolve_new_locations',forbidden)
     result = run_module.run()
     assert result['new_jobs'] == 500 and result['closed_jobs'] == 1
     assert conn.execute('SELECT count(*) AS n FROM jobs').fetchone()['n'] == 501
     assert conn.execute('SELECT closed_at FROM jobs WHERE id=%s',(old,)).fetchone()['closed_at'] is not None
     assert len(calls) == 3
+
+
+@requires_db
+def test_real_reconnect_lock_denial_records_abort_and_skips_optional_work(conn, monkeypatch):
+    from tests.test_prune import _company, _job
+    from tests.conftest import TEST_DSN
+    monkeypatch.setenv('DATABASE_URL',TEST_DSN)
+    cid = _company(conn,'reconnect-denied')
+    _job(conn,cid,'existing')
+    monkeypatch.setattr(run_module,'load_targets',lambda: [])
+    original_connect = run_module.db.connect
+    connections = [0]
+    contender = []
+    class BrokenPoll:
+        def __init__(self,real):
+            self.real = real
+        def rollback(self):
+            raise OSError('broken poll rollback')
+        def close(self):
+            self.real.close()
+            other = original_connect(TEST_DSN)
+            contender.append(other)
+            assert other.execute("SELECT pg_try_advisory_lock(hashtext('job_discovery_poll')) AS locked").fetchone()['locked']
+            other.commit()
+        def __getattr__(self,name):
+            return getattr(self.real,name)
+    def connect(dsn=None):
+        connections[0] += 1
+        real = original_connect(dsn)
+        return BrokenPoll(real) if connections[0] == 2 else real
+    monkeypatch.setattr(run_module.db,'connect',connect)
+    def source(token):
+        raise RuntimeError('source unavailable')
+    monkeypatch.setitem(ADAPTERS,'lever',source)
+    def forbidden(*args,**kw):
+        pytest.fail('aborted run performed optional work without poll lock')
+    monkeypatch.setattr(run_module,'_run_prune',forbidden)
+    monkeypatch.setattr('job_discovery.locations.resolve_new_locations',forbidden)
+    monkeypatch.setattr('reviewer.run.review_all',forbidden)
+    try:
+        result = run_module.run()
+    finally:
+        for other in contender:
+            other.close()
+    assert result == {'ok':0,'failed':1,'new_jobs':0,'closed_jobs':0}
+    row = conn.execute('SELECT companies_failed,finished_at,notes FROM poll_runs').fetchone()
+    assert row['companies_failed'] == 1 and row['finished_at'] is not None
+    assert 'aborted' in row['notes']
+    assert connections[0] == 4  # Initial maintenance/poll plus maintenance/reconnect.
