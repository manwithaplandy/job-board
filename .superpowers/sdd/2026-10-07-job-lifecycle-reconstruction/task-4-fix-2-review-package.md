# Full pinned review package

BASE: 7825265abac2c2e32a61ace1caebd45563128faa

HEAD: e67d4f4b62c1e2f8ab096e76cd8638856b5124a8

## Commits

e67d4f4b62c1e2f8ab096e76cd8638856b5124a8 fix: commit maintenance progress through slow lock prefixes


## Files

 .../task-4-evidence/fix2-final16.txt               |   4 +
 .../task-4-evidence/fix2-final17.txt               |   4 +
 .../task-4-evidence/fix2-green-attempt17.txt       |   3 +
 .../task-4-evidence/fix2-green2-17.txt             |   4 +
 .../task-4-evidence/fix2-red17.txt                 | 196 +++++++++++++++++++++
 .../task-4-evidence/fix2-ruff.txt                  |   1 +
 .../task-4-report.md                               |  91 ++++++++++
 job_discovery/lifecycle/maintenance.py             |  37 +++-
 tests/test_lifecycle_maintenance.py                |  19 +-
 tests/test_maintenance_controlflow.py              |  69 +++++++-
 10 files changed, 412 insertions(+), 16 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-final16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-final16.txt
new file mode 100644
index 0000000..4296ca7
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-final16.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [ 71%]
+.............................                                            [100%]
+101 passed in 69.19s (0:01:09)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-final17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-final17.txt
new file mode 100644
index 0000000..f64a8ab
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-final17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 71%]
+.............................                                            [100%]
+101 passed in 55.99s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-green-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-green-attempt17.txt
new file mode 100644
index 0000000..2cad863
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-green-attempt17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+.........................................                                [100%]
+41 passed in 20.81s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-green2-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-green2-17.txt
new file mode 100644
index 0000000..0002080
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-green2-17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 84%]
+.............                                                            [100%]
+85 passed in 44.06s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-red17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-red17.txt
new file mode 100644
index 0000000..17df8e6
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-red17.txt
@@ -0,0 +1,196 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..F...FF                                                                 [100%]
+=================================== FAILURES ===================================
+_______ test_actual_payload_loop_yields_commits_renews_and_resumes[0.11] _______
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fb327b18350>
+lock_cost = 0.11
+
+    @pytest.mark.parametrize('lock_cost', [0, 0.02, 0.11])
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
+        assert clock[0] <= 90 + 1e-8
+>       assert mutations and all(start < 90 for start,_ in mutations)
+E       assert ([])
+
+tests/test_maintenance_controlflow.py:79: AssertionError
+_ test_slow_candidate_locks_commit_smaller_version_and_demand_chunks[version] __
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fb328736de0>
+phase = 'version'
+
+    @pytest.mark.parametrize('phase', ['version','terminal-demand'])
+    def test_slow_candidate_locks_commit_smaller_version_and_demand_chunks(monkeypatch, phase):
+        clock = [0.0]
+        remaining = {f'job:{i:03d}' for i in range(250)}
+        locked, commits = [], []
+        class Connection:
+            def execute(self,query,params=None):
+                if query.startswith('SHOW transaction_isolation'):
+                    return Result({'transaction_isolation':'read committed'})
+                if query.startswith('SELECT v.id') or query.startswith('SELECT d.id'):
+                    return Result(rows=[{'id':key,'job_id':key,'bytes':2} for key in sorted(remaining)])
+                if query.startswith('SELECT pg_advisory_xact_lock(hashtextextended'):
+                    locked.append(params[0].removeprefix('lifecycle:job:'))
+                    clock[0] += 0.11
+                if query.startswith('DELETE FROM job_versions') or query.startswith('DELETE FROM job_payload_demands'):
+                    assert set(params[0]) <= set(locked)
+                    remaining.difference_update(params[0])
+                    result = Result()
+                    result.rowcount = len(params[0])
+                    return result
+                return Result()
+            def commit(self):
+                commits.append(clock[0])
+        monkeypatch.setattr(m,'monotonic',lambda: clock[0])
+        raw = Connection()
+        for _ in range(4):
+            if not remaining:
+                break
+            before = len(remaining)
+            locked.clear()
+            start = clock[0]
+            timed = m._TimedConnection(raw,start+25,start+20)
+            if phase == 'version':
+>               m._version_batch(timed,2000,False)
+
+tests/test_maintenance_controlflow.py:199:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+job_discovery/lifecycle/maintenance.py:181: in _version_batch
+    lock_jobs(conn, [r['job_id'] for r in selected])
+job_discovery/lifecycle/locks.py:20: in lock_jobs
+    conn.execute(
+job_discovery/lifecycle/maintenance.py:73: in execute
+    self._timeout()
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <job_discovery.lifecycle.maintenance._TimedConnection object at 0x7fb3270d83b0>
+
+    def _timeout(self):
+        remaining_ms = int((self.end - monotonic()) * 1000)
+        if remaining_ms <= 0:
+>           raise _PhaseEnded()
+E           job_discovery.lifecycle.maintenance._PhaseEnded
+
+job_discovery/lifecycle/maintenance.py:66: _PhaseEnded
+_ test_slow_candidate_locks_commit_smaller_version_and_demand_chunks[terminal-demand] _
+
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fb3270db2c0>
+phase = 'terminal-demand'
+
+    @pytest.mark.parametrize('phase', ['version','terminal-demand'])
+    def test_slow_candidate_locks_commit_smaller_version_and_demand_chunks(monkeypatch, phase):
+        clock = [0.0]
+        remaining = {f'job:{i:03d}' for i in range(250)}
+        locked, commits = [], []
+        class Connection:
+            def execute(self,query,params=None):
+                if query.startswith('SHOW transaction_isolation'):
+                    return Result({'transaction_isolation':'read committed'})
+                if query.startswith('SELECT v.id') or query.startswith('SELECT d.id'):
+                    return Result(rows=[{'id':key,'job_id':key,'bytes':2} for key in sorted(remaining)])
+                if query.startswith('SELECT pg_advisory_xact_lock(hashtextextended'):
+                    locked.append(params[0].removeprefix('lifecycle:job:'))
+                    clock[0] += 0.11
+                if query.startswith('DELETE FROM job_versions') or query.startswith('DELETE FROM job_payload_demands'):
+                    assert set(params[0]) <= set(locked)
+                    remaining.difference_update(params[0])
+                    result = Result()
+                    result.rowcount = len(params[0])
+                    return result
+                return Result()
+            def commit(self):
+                commits.append(clock[0])
+        monkeypatch.setattr(m,'monotonic',lambda: clock[0])
+        raw = Connection()
+        for _ in range(4):
+            if not remaining:
+                break
+            before = len(remaining)
+            locked.clear()
+            start = clock[0]
+            timed = m._TimedConnection(raw,start+25,start+20)
+            if phase == 'version':
+                m._version_batch(timed,2000,False)
+            else:
+>               m._terminal_batch(timed,2000,4)
+
+tests/test_maintenance_controlflow.py:201:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+job_discovery/lifecycle/maintenance.py:253: in _terminal_batch
+    lock_jobs(conn, [r['job_id'] for r in rows])
+job_discovery/lifecycle/locks.py:20: in lock_jobs
+    conn.execute(
+job_discovery/lifecycle/maintenance.py:73: in execute
+    self._timeout()
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+self = <job_discovery.lifecycle.maintenance._TimedConnection object at 0x7fb32717a330>
+
+    def _timeout(self):
+        remaining_ms = int((self.end - monotonic()) * 1000)
+        if remaining_ms <= 0:
+>           raise _PhaseEnded()
+E           job_discovery.lifecycle.maintenance._PhaseEnded
+
+job_discovery/lifecycle/maintenance.py:66: _PhaseEnded
+=========================== short test summary info ============================
+FAILED tests/test_maintenance_controlflow.py::test_actual_payload_loop_yields_commits_renews_and_resumes[0.11]
+FAILED tests/test_maintenance_controlflow.py::test_slow_candidate_locks_commit_smaller_version_and_demand_chunks[version]
+FAILED tests/test_maintenance_controlflow.py::test_slow_candidate_locks_commit_smaller_version_and_demand_chunks[terminal-demand]
+3 failed, 5 passed in 0.37s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-ruff.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-evidence/fix2-ruff.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-report.md
index f4d2b9d..0b364f0 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-report.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-4-report.md
@@ -275,10 +275,101 @@ Fix Round 1 final unchanged-source results:
   (Debian 16.15-1.pgdg13+2)**, **64.45 seconds**.
 - `fix1-ruff.txt`: repository Ruff passed. Working and staged whitespace checks
   passed after normalizing only pytest-generated trailing log whitespace.
 
 No product/test edit occurred after either final lane started. The selected six
 files are the new control-flow regressions, maintenance, run, guard, existing
 prune and question-fetch tests, as listed in the exact commands above. No DB test
 was skipped. The unchanged migration/security source was not redundantly tested
 or re-reviewed. No new safeguard rejection occurred. Both findings are addressed
 in author implementation/tests; independent scoped re-review remains pending.
+
+## Fix Round 2 — resumable slow candidate-lock acquisition
+
+FIX_BASE: `7825265abac2c2e32a61ace1caebd45563128faa`. Read the complete
+`task-4-fix-1-requirements-rereview.md` and exact saved
+`reviewer_fix1_lock_progress.py` / `.txt`. The review kept **Spec FAIL / Quality
+CHANGES_REQUIRED**, accepted R4-2, and identified R4-1a: acquiring every candidate
+key before processing could exhaust the timed phase and repeatedly roll back the
+same prefix. This was a valid ordinary progress defect introduced by Fix 1.
+
+A shared `_lock_candidate_prefix` now allocates half the remaining phase work
+interval to acquiring a **sorted prefix** of candidate Job keys. It reuses the
+existing gate/key helper, taking no row/FK locks during acquisition. The other
+half remains available for queries and mutations. Payload work selects/locks rows
+only for the acquired prefix, processes what fits, and persists its existing
+completed-Job cursor; neither unacquired keys nor an unfinished paired payload
+are skipped. The same helper bounds key acquisition before archived-version and
+terminal-demand deletion. Their candidate rows are filtered to acquired keys;
+unprocessed rows remain available to subsequent committed chunks. Source gate,
+claim, reservation and security contracts are unchanged.
+
+The exact 2,000/20,000-row, 64 MiB, 90/120/30-second and lock/statement timeout
+values remain unchanged. This is adaptive transaction sizing based on worker
+elapsed time, not a change to DB lease clocks or lock enforcement. It addresses
+successful moderately slow acquisition; actual statement/connection failures
+still follow the existing rollback/block path.
+
+Tests-first evidence:
+
+- `fix2-red17.txt`: **3 failed / 5 passed** before the product fix. The new
+  0.11-second Job-lock fixture failed in the actual payload loop, and equivalent
+  version/terminal-demand fixtures exhausted the phase during upfront locking.
+- `fix2-green-attempt17.txt`: **41 passed, zero skips**, covering control flow
+  and maintenance after the shared-prefix fix.
+- `fix2-green2-17.txt`: **85 passed, zero skips**, including actual owned-DB
+  slow-lock/payload statements plus affected run/guard behavior.
+
+The deterministic fixture has 250 paired caches, 0.11 seconds per successful
+Job-lock statement and 0.2 seconds per successful payload mutation. It drains all
+500 payloads within **at most four fresh sweep invocations**, with nonzero
+committed retirement on each invocation, no blocked result, no skipped payloads
+behind the persisted cursor, and progress through all later maintenance phases.
+It retains the deadline/renewal assertions. The matching owned-DB test executes
+normal SQL and advances only the worker's monotonic scheduler clock, then proves
+persisted cursor progression and complete retirement within the same four-sweep
+fixture bound. No SQL clock, lease or security mechanism is changed.
+
+Separate ordinary version and terminal-demand fixtures use 250 distinct Job
+keys at the same 0.11-second lock cost. Each commits a smaller nonempty chunk,
+checks sorted acquisition and deletion only for acquired keys, and drains its
+fixture within **four committed chunks**. These are explicit finite fixture
+bounds, not a claim about arbitrary database/network latency or the future
+Task 6 source scheduler.
+
+Exact commands, same worktree and `/bin/bash`, `login:false`:
+
+```sh
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_run_question_fetch.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_maintenance_controlflow.py tests/test_lifecycle_maintenance.py tests/test_run.py tests/test_size_guard.py tests/test_prune.py tests/test_run_question_fetch.py -q
+.venv/bin/ruff check .
+git diff --check
+git diff --cached --check
+```
+
+This fix changes only maintenance candidate acquisition and its ordinary tests,
+plus the author appendix/evidence. R4-2 remains covered without a new run.py edit.
+No migration, SQL policy, claim/capacity/gate source, controller ledger, reviewer
+artifact or release authorization is included. No excluded expiry/capacity/
+cross-user/adversarial probe or security re-review was attempted; all previously
+recorded independent security gaps persist. No new safeguard rejection occurred.
+Scoped re-review and Library 04 remain controller tasks. Completed-upgrade release
+authorization remains as recorded after all 13 tasks and permitted verification;
+this author has performed only local Task 4 work.
+
+Fix Round 2 final unchanged-source results:
+
+- `fix2-final17.txt`: **101 passed, zero skipped**, actual PostgreSQL **17.11
+  (Debian 17.11-1.pgdg13+2)**, **55.99 seconds**.
+- `fix2-final16.txt`: **101 passed, zero skipped**, actual PostgreSQL **16.15
+  (Debian 16.15-1.pgdg13+2)**, **69.19 seconds**.
+- `fix2-ruff.txt`: repository Ruff passed. Working and staged whitespace checks
+  passed after normalizing only pytest-generated trailing log whitespace.
+
+No product/test edits occurred after these final covering lanes started. The
+selection is exactly the six files shown above; unchanged migration/security
+lanes were not rerun. Author evidence addresses R4-1a's concrete slow-prefix
+fixture and related version/demand prework; independent scoped re-review remains
+pending. Controller and reviewer artifacts are excluded from the forward commit.
diff --git a/job_discovery/lifecycle/maintenance.py b/job_discovery/lifecycle/maintenance.py
index 014178c..1234b4c 100644
--- a/job_discovery/lifecycle/maintenance.py
+++ b/job_discovery/lifecycle/maintenance.py
@@ -91,29 +91,55 @@ class _TimedConnection:
     def commit(self):
         self._timeout()
         self.conn.commit()
 
 def legacy_prune_disabled(conn) -> bool:
     enter_gate(conn)
     return read_control(conn).maintenance_enabled or read_control(conn).safety_stage == 'enforced' or bool(
         conn.execute('SELECT cutover_at FROM lifecycle_maintenance_state WHERE singleton').fetchone()['cutover_at'])
 
 
+def _lock_candidate_prefix(conn, job_ids):
+    """Acquire a sorted prefix, reserving half the available work time for DML.
+
+    All selected Job keys precede row/FK work. Unacquired keys stay eligible for
+    a later committed chunk; callers must only process the returned prefix.
+    """
+    keys = sorted(set(job_ids))
+    if not isinstance(conn, _TimedConnection):
+        lock_jobs(conn, keys)
+        return keys
+    started = monotonic()
+    acquire_until = started + max(0, conn.yield_at - started) / 2
+    acquired = []
+    for key in keys:
+        if monotonic() >= acquire_until:
+            if not acquired:
+                conn.yielded = True
+            break
+        # Reuse the common gate/key protocol. Each singleton follows the same
+        # sorted order, and no row or FK lock is acquired until this loop ends.
+        lock_jobs(conn, [key])
+        acquired.append(key)
+    return acquired
+
+
 def _payload_batch(conn, cursor, limit, dry_run, byte_limit=MAX_RETIRE_BYTES):
     # Scan IDs, including protected/NULL rows, so a permanent prefix cannot starve
     # later jobs. <=250 jobs keeps description/question mutations within 500.
     rows = conn.execute('SELECT id FROM jobs WHERE (%s::text IS NULL OR id COLLATE "C">%s COLLATE "C") ORDER BY id COLLATE "C" LIMIT %s',
                         (cursor, cursor, min(250, limit))).fetchall()
     if not rows:
         return 0, 0, 0, 0, None
-    ids = [r['id'] for r in rows]
-    lock_jobs(conn, ids)
+    ids = _lock_candidate_prefix(conn, [r['id'] for r in rows])
+    if not ids:
+        return 0, 0, 0, 0, cursor
     conn.execute('SELECT id FROM jobs WHERE id=ANY(%s) ORDER BY id COLLATE "C" FOR UPDATE', (ids,)).fetchall()
     # Fresh statement snapshot after the gate and job locks, not candidate data.
     eligible = conn.execute(f'''SELECT j.id, ({_DESCRIPTION_DUE}) AS description_due,
       ({_QUESTIONS_DUE}) AS questions_due,
       CASE WHEN {_DESCRIPTION_DUE} THEN octet_length(j.description) ELSE 0 END AS description_bytes,
       CASE WHEN {_QUESTIONS_DUE} THEN octet_length(q.questions::text) ELSE 0 END AS question_bytes
       FROM jobs j LEFT JOIN job_questions q ON q.job_id=j.id
       WHERE j.id=ANY(%s) AND {_UNPROTECTED} ORDER BY j.id COLLATE "C"''', (ids,)).fetchall()
     retired = size = candidates = visited = 0
     completed_cursor = cursor
@@ -171,21 +197,23 @@ def _version_batch(conn, limit, dry_run, byte_limit=MAX_RETIRE_BYTES):
       AND NOT EXISTS(SELECT FROM job_payload_demands WHERE job_version_id=v.id)
       AND NOT EXISTS(SELECT FROM job_locations WHERE job_version_id=v.id)
       AND NOT EXISTS(SELECT FROM job_skills WHERE job_version_id=v.id)
       ORDER BY v.recorded_at,v.id LIMIT %s''', (limit,)).fetchall()
     selected = []
     size = 0
     for row in rows:
         if size + row['bytes'] <= byte_limit:
             selected.append(row)
             size += row['bytes']
-    lock_jobs(conn, [r['job_id'] for r in selected])
+    acquired = set(_lock_candidate_prefix(conn, [r['job_id'] for r in selected]))
+    selected = [r for r in selected if r['job_id'] in acquired]
+    size = sum(r['bytes'] for r in selected)
     if not dry_run and selected:
         conn.execute('DELETE FROM job_versions WHERE id=ANY(%s)', ([r['id'] for r in selected],))
     return len(rows), 0 if dry_run else len(selected), 0 if dry_run else size
 
 
 def _staging_batch(conn, limit):
     # Select just one enumeration: a huge member set is drained over bounded
     # commits. Its compact source/claim floors are advanced BEFORE any deletion.
     row = conn.execute('''SELECT e.*,p.reason FROM source_enumerations e
       LEFT JOIN lifecycle_staging_cleanup p ON p.enumeration_id=e.id
@@ -243,21 +271,22 @@ def _terminal_batch(conn, limit, phase):
            AND c.replay_floor>=r.generation AND c.generation>r.generation
            ORDER BY r.terminal_at,r.id LIMIT %s)''', (limit,)).rowcount
     if phase == 4:
         rows = conn.execute('''SELECT d.id,d.job_id FROM job_payload_demands d
           WHERE d.status IN ('ready','deferred','failed','cancelled')
           AND d.description_snapshot IS NULL AND d.questions_snapshot IS NULL
           AND d.settled_at<=clock_timestamp()-interval '168 hours'
           AND NOT EXISTS(SELECT FROM lifecycle_claims c WHERE c.kind='demand' AND c.work_id=d.id::text
             AND (c.state='active' OR c.generation<=d.claim_generation OR c.replay_floor<GREATEST(d.claim_generation,1)))
           ORDER BY d.settled_at,d.id LIMIT %s''', (limit,)).fetchall()
-        lock_jobs(conn, [r['job_id'] for r in rows])
+        acquired = set(_lock_candidate_prefix(conn, [r['job_id'] for r in rows]))
+        rows = [r for r in rows if r['job_id'] in acquired]
         return conn.execute('DELETE FROM job_payload_demands WHERE id=ANY(%s)', ([r['id'] for r in rows],)).rowcount if rows else 0
     return conn.execute('''DELETE FROM lifecycle_write_checks WHERE id IN
       (SELECT id FROM lifecycle_write_checks WHERE created_at<=clock_timestamp()-interval '168 hours'
        ORDER BY created_at,id LIMIT %s)''', (limit,)).rowcount
 
 
 def _metrics(conn, scheduled):
     metrics = conn.execute('''SELECT pg_database_size(current_database()) AS physical,
       (SELECT COALESCE(sum(bytes),0) FROM capacity_reservations WHERE state='held') AS held,
       (SELECT COALESCE(sum(n_live_tup),0) FROM pg_stat_user_tables) AS live,
diff --git a/tests/test_lifecycle_maintenance.py b/tests/test_lifecycle_maintenance.py
index 07cfecc..3b7eede 100644
--- a/tests/test_lifecycle_maintenance.py
+++ b/tests/test_lifecycle_maintenance.py
@@ -347,53 +347,64 @@ def test_retirement_byte_budget_defers_remaining_payload(conn):
     conn.execute("INSERT INTO job_questions(job_id,questions,captured_at) VALUES(%s,'[]',clock_timestamp()-interval '8 days')",(jid,))
     conn.commit()
     enter_gate(conn)
     _,rows,size,_,_ = m._payload_batch(conn,None,2000,False,byte_limit=2)
     conn.commit()
     assert rows == 1 and size == 2
     assert conn.execute('SELECT questions FROM job_questions').fetchone()['questions'] == []
 
 
 @requires_db
-def test_slow_successful_payload_statements_commit_resumable_progress(conn, monkeypatch):
+@pytest.mark.parametrize('lock_cost', [0,0.11])
+def test_slow_successful_payload_statements_commit_resumable_progress(conn, monkeypatch, lock_cost):
     """Virtual worker elapsed time; DB lease clocks and guards stay real/unmodified."""
     from dataclasses import replace
     m = module()
     cid = _company(conn,'slow')
     conn.execute("""INSERT INTO jobs(id,company_id,external_id,title,url,description,description_captured_at)
       SELECT 'lever:slow:'||lpad(n::text,3,'0'),%s,n::text,'Eng','u','jd',clock_timestamp()-interval '31 days'
       FROM generate_series(1,250) n""",(cid,))
     conn.execute("INSERT INTO job_questions(job_id,questions,captured_at) SELECT id,'[]',clock_timestamp()-interval '8 days' FROM jobs")
     conn.commit()
     enable(conn)
     c = claim(conn)
     clock = [0.0]
     starts, renewals, commits = [], [], []
     class SlowStatements:
         def execute(self, query, params=None):
             result = conn.execute(query,params)
+            if query.startswith('SELECT pg_advisory_xact_lock(hashtextextended'):
+                clock[0] += lock_cost
             if query.startswith('UPDATE jobs SET description') or query.startswith('DELETE FROM job_questions'):
                 starts.append(clock[0])
                 clock[0] += 0.2
             return result
         def commit(self):
             conn.commit()
             commits.append(clock[0])
         def __getattr__(self,name):
             return getattr(conn,name)
     actual_control, actual_renew = m.read_control, m.renew_claim
     monkeypatch.setattr(m,'read_control',lambda db: replace(actual_control(db),safety_stage='enforced',retirement_enabled=True,retirement_dry_run=False))
     monkeypatch.setattr(m,'monotonic',lambda: clock[0])
     def renew(db,ref,seconds):
         assert commits[-1] == clock[0]
         renewals.append(clock[0])
         return actual_renew(db,ref,seconds)
     monkeypatch.setattr(m,'renew_claim',renew)
     first = m.sweep(SlowStatements(),c,dry_run=False)
     assert clock[0] <= 90 and all(t < 90 for t in starts)
     assert renewals and max(b-a for a,b in zip([0,*renewals],[*renewals,clock[0]])) <= 30
-    assert 0 < first.retired_rows < 500
+    assert 0 < first.retired_rows < 500 and not first.blocked
     assert conn.execute('SELECT cursor FROM lifecycle_maintenance_state').fetchone()['cursor'] == first.cursor
-    second = m.sweep(SlowStatements(),c,dry_run=False)
-    assert first.retired_rows + second.retired_rows == 500
+    total = first.retired_rows
+    for _ in range(3):  # <=4 fresh invocations retire all 250 paired fixtures.
+        if total == 500:
+            break
+        before = clock[0]
+        resumed = m.sweep(SlowStatements(),c,dry_run=False)
+        assert resumed.retired_rows > 0 and not resumed.blocked
+        assert clock[0] - before <= 90
+        total += resumed.retired_rows
+    assert total == 500
     assert conn.execute('SELECT count(*) AS n FROM jobs WHERE description IS NULL').fetchone()['n'] == 250
     assert conn.execute('SELECT count(*) AS n FROM job_questions').fetchone()['n'] == 0
diff --git a/tests/test_maintenance_controlflow.py b/tests/test_maintenance_controlflow.py
index d541b09..95f0a27 100644
--- a/tests/test_maintenance_controlflow.py
+++ b/tests/test_maintenance_controlflow.py
@@ -10,24 +10,24 @@ import job_discovery.run as run
 
 class Result:
     def __init__(self, one=None, rows=None):
         self.one, self.rows = one, rows
     def fetchone(self):
         return self.one
     def fetchall(self):
         return self.rows
 
 
-@pytest.mark.parametrize('lock_cost', [0, 0.02])
+@pytest.mark.parametrize('lock_cost', [0, 0.02, 0.11])
 def test_actual_payload_loop_yields_commits_renews_and_resumes(monkeypatch, lock_cost):
     clock = [0.0]
-    renewal_times, commits, mutations = [], [], []
+    renewal_times, commits, mutations, visited_phases = [], [], [], []
     payloads = {f'job:{i:03d}': [True, True] for i in range(250)}
     state = {'cursor': None, 'next_phase': 0}
     class Connection:
         timeout = 5000
         def execute(self, query, params=None):
             if query.startswith('SHOW transaction_isolation'):
                 return Result({'transaction_isolation': 'read committed'})
             if query.startswith('SELECT 1 FROM lifecycle_claims'):
                 return Result({'exists': 1})
             if query.startswith('SELECT cursor,next_phase'):
@@ -62,35 +62,46 @@ def test_actual_payload_loop_yields_commits_renews_and_resumes(monkeypatch, lock
     monkeypatch.setattr(m,'monotonic',lambda: clock[0])
     monkeypatch.setattr(m,'validate_claim',lambda *a: None)
     monkeypatch.setattr(m,'read_control',lambda c: ctl)
     def renew(c, claim, seconds):
         assert commits and commits[-1] == clock[0]
         assert seconds == 120
         renewal_times.append(clock[0])
         return claim
     monkeypatch.setattr(m,'renew_claim',renew)
     monkeypatch.setattr(m,'_metrics',lambda *a: False)
-    monkeypatch.setattr(m,'_version_batch',lambda *a: (0,0,0))
-    monkeypatch.setattr(m,'_staging_batch',lambda *a: 0)
-    monkeypatch.setattr(m,'_terminal_batch',lambda *a: 0)
+    monkeypatch.setattr(m,'_version_batch',lambda *a: visited_phases.append(1) or (0,0,0))
+    monkeypatch.setattr(m,'_staging_batch',lambda *a: visited_phases.append(2) or 0)
+    monkeypatch.setattr(m,'_terminal_batch',lambda *a: visited_phases.append(a[-1]) or 0)
     conn = Connection()
     claim = SimpleNamespace(owner_token='ordinary-timing',generation=1)
     result = m.sweep(conn,claim,dry_run=False)
     assert clock[0] <= 90 + 1e-8
     assert mutations and all(start < 90 for start,_ in mutations)
     assert all(timeout <= min(5000,int((90-start)*1000)+1) for start,timeout in mutations)
     assert renewal_times
     assert max(b-a for a,b in zip([0,*renewal_times],[*renewal_times,clock[0]])) <= 30
-    assert 0 < result.retired_rows < 500
+    assert 0 < result.retired_rows < 500 and not result.blocked
+    assert {1,2,3,4,5} <= set(visited_phases)
     # Fresh invocation resumes persisted Job cursor, including any half-done pair.
-    result2 = m.sweep(conn,claim,dry_run=False)
-    assert result.retired_rows + result2.retired_rows == 500
+    total = result.retired_rows
+    for _ in range(3):  # Finite fixture bound: <=4 fresh sweeps for every lock cost.
+        if total == 500:
+            break
+        assert state['cursor'] is not None
+        assert all(pair == [False,False] for key,pair in payloads.items() if key <= state['cursor'])
+        start = clock[0]
+        result = m.sweep(conn,claim,dry_run=False)
+        assert 0 < result.retired_rows and not result.blocked
+        assert clock[0] - start <= 90 + 1e-8
+        total += result.retired_rows
+    assert total == 500
     assert all(pair == [False,False] for pair in payloads.values())
 
 
 @pytest.mark.parametrize('accounting_fails', [False, True])
 def test_denied_reconnect_lock_aborts_before_all_optional_phases(monkeypatch, accounting_fails):
     finished, closes = [], []
     class Connection:
         def __init__(self, locked, broken=False):
             self.locked, self.broken = locked, broken
         def execute(self, *args):
@@ -144,10 +155,52 @@ def test_remaining_timeout_is_reapplied_after_lock_helpers(monkeypatch):
     monkeypatch.setattr(m,'monotonic',lambda: clock[0])
     raw = Connection()
     timed = m._TimedConnection(raw,2)
     m.lock_jobs(timed,['job'])
     clock[0] = 1.9
     timed.execute('SELECT 1')
     assert 0 < raw.timeout <= 101
     clock[0] = 2
     with pytest.raises(m._PhaseEnded):
         timed.execute('SELECT 1')
+
+
+@pytest.mark.parametrize('phase', ['version','terminal-demand'])
+def test_slow_candidate_locks_commit_smaller_version_and_demand_chunks(monkeypatch, phase):
+    clock = [0.0]
+    remaining = {f'job:{i:03d}' for i in range(250)}
+    locked, commits = [], []
+    class Connection:
+        def execute(self,query,params=None):
+            if query.startswith('SHOW transaction_isolation'):
+                return Result({'transaction_isolation':'read committed'})
+            if query.startswith('SELECT v.id') or query.startswith('SELECT d.id'):
+                return Result(rows=[{'id':key,'job_id':key,'bytes':2} for key in sorted(remaining)])
+            if query.startswith('SELECT pg_advisory_xact_lock(hashtextextended'):
+                locked.append(params[0].removeprefix('lifecycle:job:'))
+                clock[0] += 0.11
+            if query.startswith('DELETE FROM job_versions') or query.startswith('DELETE FROM job_payload_demands'):
+                assert set(params[0]) <= set(locked)
+                remaining.difference_update(params[0])
+                result = Result()
+                result.rowcount = len(params[0])
+                return result
+            return Result()
+        def commit(self):
+            commits.append(clock[0])
+    monkeypatch.setattr(m,'monotonic',lambda: clock[0])
+    raw = Connection()
+    for _ in range(4):
+        if not remaining:
+            break
+        before = len(remaining)
+        locked.clear()
+        start = clock[0]
+        timed = m._TimedConnection(raw,start+25,start+20)
+        if phase == 'version':
+            m._version_batch(timed,2000,False)
+        else:
+            m._terminal_batch(timed,2000,4)
+        timed.commit()
+        assert clock[0] - start <= 25 and len(remaining) < before
+        assert locked == sorted(locked)
+    assert not remaining and commits  # <=4 committed chunks drain 250 slow keys.
