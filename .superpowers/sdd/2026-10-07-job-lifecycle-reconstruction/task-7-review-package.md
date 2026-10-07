# Full pinned review package

BASE: 8f9a195e8bed49e0002d7b152b1d4b8983d96f04

HEAD: 1f897475023a50fa029def5a5e9e016ded794a8b

## Commits

1f897475023a50fa029def5a5e9e016ded794a8b feat: admit lean listings without passive payload refill


## Files

 .../task-7-evidence/01-red.txt                     |   4 +
 .../task-7-evidence/02-red.txt                     | 203 ++++++++++
 .../task-7-evidence/03-implementation.txt          |  20 +
 .../task-7-evidence/04-red-legacy.txt              |  32 ++
 .../task-7-evidence/05-integration.txt             |  22 ++
 .../task-7-evidence/06-red-publication.txt         |  11 +
 .../task-7-evidence/07-final-pg17.txt              |   4 +
 .../task-7-evidence/08-final-pg16.txt              |   4 +
 .../task-7-evidence/09-red-bulk.txt                |   3 +
 .../task-7-evidence/10-red-bulk-relations.txt      |  24 ++
 .../task-7-evidence/11-final-integration-pg17.txt  |  21 +
 .../task-7-evidence/12-final-integration-pg16.txt  |  11 +
 .../task-7-evidence/13-corrected-fixtures-pg17.txt |   3 +
 .../14-corrected-admission-recovery-pg16.txt       |   3 +
 .../15-corrected-admission-recovery-pg17.txt       |   3 +
 .../16-red-publication-observation.txt             |  11 +
 .../task-7-evidence/17-final-pg17.txt              |   3 +
 .../task-7-evidence/18-final-pg16.txt              |   3 +
 .../task-7-evidence/19-static-checks.txt           |   1 +
 .../task-7-evidence/20-red-retention-boundary.txt  |  10 +
 .../task-7-evidence/21-final-verified-pg17.txt     |   3 +
 .../task-7-evidence/22-final-verified-pg16.txt     |   3 +
 .../task-7-evidence/23-final-static-checks.txt     |   1 +
 .../task-7-evidence/commands.json                  |  94 +++++
 .../task-7-report.md                               |  61 +++
 job_discovery/adapters/completeness.py             |   1 +
 job_discovery/db.py                                |  14 +-
 job_discovery/lifecycle/identity.py                | 428 +++++++++++++++++++-
 job_discovery/lifecycle/reconcile.py               |  22 +-
 job_discovery/models.py                            |   2 +
 job_discovery/run.py                               |  41 +-
 tests/test_db_jobs.py                              |  10 +-
 tests/test_lifecycle_admission.py                  | 439 +++++++++++++++++++++
 tests/test_lifecycle_identity.py                   |  19 +-
 tests/test_lifecycle_reconcile.py                  |  10 +-
 tests/test_lifecycle_relations.py                  |  83 ++++
 36 files changed, 1558 insertions(+), 69 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/01-red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/01-red.txt
new file mode 100644
index 0000000..de60552
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/01-red.txt
@@ -0,0 +1,4 @@
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/tools/lifecycle_test_db.py", line 20, in <module>
+    import psycopg
+ModuleNotFoundError: No module named 'psycopg'
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/02-red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/02-red.txt
new file mode 100644
index 0000000..c5233af
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/02-red.txt
@@ -0,0 +1,203 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FFFFFFFF                                                                 [100%]
+=================================== FAILURES ===================================
+________________ test_stable_lean_admission_and_private_history ________________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32980 user=postgres database=poller_lifecycle_test) at 0x7fd4e5f37d70>
+
+    @requires_db
+    def test_stable_lean_admission_and_private_history(conn):
+        source = setup_source(conn)
+        before = conn.execute('SELECT * FROM source_listings').fetchone()
+        conn.execute("INSERT INTO application_packages(user_id,job_id) VALUES (%s,%s)", (uuid4(), before['job_id']))
+        private = conn.execute('SELECT * FROM application_packages').fetchall()
+        postings = [Posting('0', 'Role', 'https://example.test/job', raw={'descriptionPlain':'Public JD'}),
+                    Posting('new', 'Role', 'https://example.test/new', raw={'descriptionPlain':'Public JD'})]
+>       count, claim = admit(conn, source, postings)
+                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_admission.py:30:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32980 user=postgres database=poller_lifecycle_test) at 0x7fd4e5f37d70>
+source = {'id': UUID('ecf63d08-d015-4330-ab1e-8df03c78a3b9'), 'legacy_company_id': 1, 'ats': 'lever', 'public_board_ref': 'fixture', ...}
+postings = [Posting(external_id='0', title='Role', url='https://example.test/job', location=None, department=None, remote=None, r...', url='https://example.test/new', location=None, department=None, remote=None, raw={'descriptionPlain': 'Public JD'})]
+claim = ClaimRef(owner_token='[REDACTED_TEST_TOKEN]', generation=1, lease_until=datetime.datetime(2026, 10, 7, 16, 25, 37, 651582, tzinfo=zoneinfo.ZoneInfo(key='Etc/UTC')))
+
+    def admit(conn, source, postings, claim=None):
+        claim = claim or claim_work(conn, 'source', str(source['id']), 180)
+        reservation = reserve_capacity(conn, claim, 65536 * max(1, len(postings)))
+>       count = identity.admit_metadata(conn, source['id'], postings, claim, reservation)
+                ^^^^^^^^^^^^^^^^^^^^^^^
+E       AttributeError: module 'job_discovery.lifecycle.identity' has no attribute 'admit_metadata'
+
+tests/test_lifecycle_admission.py:17: AttributeError
+___ test_normalized_content_and_missing_payload_do_not_manufacture_versions ____
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32980 user=postgres database=poller_lifecycle_test) at 0x7fd4e5f77500>
+
+    @requires_db
+    def test_normalized_content_and_missing_payload_do_not_manufacture_versions(conn):
+        source = setup_source(conn)
+>       _, claim = admit(conn, source, [Posting('0',' Role  ','https://example.test/job', raw={'descriptionPlain':'Hello   world'})])
+                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_admission.py:45:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32980 user=postgres database=poller_lifecycle_test) at 0x7fd4e5f77500>
+source = {'id': UUID('7c3b56c7-f328-4087-a74a-70627f76bba8'), 'legacy_company_id': 1, 'ats': 'lever', 'public_board_ref': 'fixture', ...}
+postings = [Posting(external_id='0', title=' Role  ', url='https://example.test/job', location=None, department=None, remote=None, raw={'descriptionPlain': 'Hello   world'})]
+claim = ClaimRef(owner_token='[REDACTED_TEST_TOKEN]', generation=1, lease_until=datetime.datetime(2026, 10, 7, 16, 25, 37, 950139, tzinfo=zoneinfo.ZoneInfo(key='Etc/UTC')))
+
+    def admit(conn, source, postings, claim=None):
+        claim = claim or claim_work(conn, 'source', str(source['id']), 180)
+        reservation = reserve_capacity(conn, claim, 65536 * max(1, len(postings)))
+>       count = identity.admit_metadata(conn, source['id'], postings, claim, reservation)
+                ^^^^^^^^^^^^^^^^^^^^^^^
+E       AttributeError: module 'job_discovery.lifecycle.identity' has no attribute 'admit_metadata'
+
+tests/test_lifecycle_admission.py:17: AttributeError
+__________________ test_partial_display_is_availability_only ___________________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32980 user=postgres database=poller_lifecycle_test) at 0x7fd4e5fba240>
+
+    @requires_db
+    def test_partial_display_is_availability_only(conn):
+        from job_discovery.adapters.completeness import SourceResult, SourceStatus, iter_identified_postings
+        from job_discovery.lifecycle.reconcile import verify_due_sources
+        from job_discovery.adapters import ADAPTERS
+        source = setup_source(conn)
+        before = conn.execute('SELECT title,url FROM jobs').fetchone()
+        # A parser failure may still produce nonempty fallback display values.
+        status = SourceStatus()
+        def broken(_):
+            raise ValueError('bad optional display')
+        rows = iter_identified_postings([{'id':'0','title':'Fallback','url':'https://example.test/fallback'}], broken, status, title_key='title',url_keys=['url'])
+        posting = next(rows)
+>       assert posting.metadata_complete is False
+               ^^^^^^^^^^^^^^^^^^^^^^^^^
+E       AttributeError: 'Posting' object has no attribute 'metadata_complete'
+
+tests/test_lifecycle_admission.py:67: AttributeError
+______ test_version_growth_pauses_without_discarding_unarchived_evidence _______
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32980 user=postgres database=poller_lifecycle_test) at 0x7fd4e5fbadb0>
+
+    @requires_db
+    def test_version_growth_pauses_without_discarding_unarchived_evidence(conn):
+        source = setup_source(conn)
+        claim = None
+        for i in range(12):
+>           _, claim = admit(conn, source, [Posting('0',f'Role {i}','https://example.test/job')], claim)
+                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_admission.py:78:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32980 user=postgres database=poller_lifecycle_test) at 0x7fd4e5fbadb0>
+source = {'id': UUID('dd9f9be3-d2dd-4693-aa8a-94c61fa586cf'), 'legacy_company_id': 1, 'ats': 'lever', 'public_board_ref': 'fixture', ...}
+postings = [Posting(external_id='0', title='Role 0', url='https://example.test/job', location=None, department=None, remote=None, raw={})]
+claim = ClaimRef(owner_token='[REDACTED_TEST_TOKEN]', generation=1, lease_until=datetime.datetime(2026, 10, 7, 16, 25, 39, 167406, tzinfo=zoneinfo.ZoneInfo(key='Etc/UTC')))
+
+    def admit(conn, source, postings, claim=None):
+        claim = claim or claim_work(conn, 'source', str(source['id']), 180)
+        reservation = reserve_capacity(conn, claim, 65536 * max(1, len(postings)))
+>       count = identity.admit_metadata(conn, source['id'], postings, claim, reservation)
+                ^^^^^^^^^^^^^^^^^^^^^^^
+E       AttributeError: module 'job_discovery.lifecycle.identity' has no attribute 'admit_metadata'
+
+tests/test_lifecycle_admission.py:17: AttributeError
+_______________ test_chunk_limit_and_each_chunk_uses_reservation _______________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32980 user=postgres database=poller_lifecycle_test) at 0x7fd4e5fbbbc0>
+
+    @requires_db
+    def test_chunk_limit_and_each_chunk_uses_reservation(conn):
+        source = setup_source(conn, count=0)
+        claim = claim_work(conn,'source',str(source['id']),180)
+        reservation = reserve_capacity(conn,claim,1000000)
+        with pytest.raises(ValueError, match='500'):
+>           identity.admit_metadata(conn,source['id'],[Posting(str(i),'Role','https://example.test/job') for i in range(501)],claim,reservation)
+            ^^^^^^^^^^^^^^^^^^^^^^^
+E           AttributeError: module 'job_discovery.lifecycle.identity' has no attribute 'admit_metadata'
+
+tests/test_lifecycle_admission.py:90: AttributeError
+________ test_actual_source_orchestration_admits_and_records_sightings _________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32980 user=postgres database=poller_lifecycle_test) at 0x7fd4e5fbab10>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7fd4e5fb94c0>
+
+    @requires_db
+    def test_actual_source_orchestration_admits_and_records_sightings(conn, monkeypatch):
+        from job_discovery.lifecycle.reconcile import verify_due_sources
+        from job_discovery.adapters import ADAPTERS
+        from job_discovery.adapters.completeness import SourceResult, SourceStatus
+        setup_source(conn, count=0)
+        monkeypatch.setitem(ADAPTERS,'lever',lambda *a,**kw: SourceResult(iter([Posting('new','Engineer','https://example.test/job',raw={'descriptionPlain':'unused'})]),SourceStatus()))
+        result = verify_due_sources(conn, max_boards=1)
+>       assert result['new_jobs'] == 1
+E       assert 0 == 1
+
+tests/test_lifecycle_admission.py:106: AssertionError
+_______ test_typed_location_has_unknown_validity_and_no_invented_skills ________
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32980 user=postgres database=poller_lifecycle_test) at 0x7fd4e5fbcb60>
+
+    @requires_db
+    def test_typed_location_has_unknown_validity_and_no_invented_skills(conn):
+        source = setup_source(conn)
+>       admit(conn,source,[Posting('0','Role','https://example.test/job',location='Remote',raw={'descriptionPlain':'Python expert'})])
+
+tests/test_lifecycle_relations.py:13:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32980 user=postgres database=poller_lifecycle_test) at 0x7fd4e5fbcb60>
+source = {'id': UUID('c29a6db3-b2e3-4765-a1e0-27c350a140ae'), 'legacy_company_id': 1, 'ats': 'lever', 'public_board_ref': 'fixture', ...}
+postings = [Posting(external_id='0', title='Role', url='https://example.test/job', location='Remote', department=None, remote=None, raw={'descriptionPlain': 'Python expert'})]
+claim = ClaimRef(owner_token='[REDACTED_TEST_TOKEN]', generation=1, lease_until=datetime.datetime(2026, 10, 7, 16, 25, 40, 258487, tzinfo=zoneinfo.ZoneInfo(key='Etc/UTC')))
+
+    def admit(conn, source, postings, claim=None):
+        claim = claim or claim_work(conn, 'source', str(source['id']), 180)
+        reservation = reserve_capacity(conn, claim, 65536 * max(1, len(postings)))
+>       count = identity.admit_metadata(conn, source['id'], postings, claim, reservation)
+                ^^^^^^^^^^^^^^^^^^^^^^^
+E       AttributeError: module 'job_discovery.lifecycle.identity' has no attribute 'admit_metadata'
+
+tests/test_lifecycle_admission.py:17: AttributeError
+_____ test_identity_assertions_require_review_and_reject_conflicts_cycles ______
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32980 user=postgres database=poller_lifecycle_test) at 0x7fd4e5fbdd30>
+
+    @requires_db
+    def test_identity_assertions_require_review_and_reject_conflicts_cycles(conn):
+        source = setup_source(conn, count=3)
+>       _, claim = admit(conn,source,[])
+                   ^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_lifecycle_relations.py:25:
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _
+
+conn = <psycopg.Connection [INTRANS] (host=127.0.0.1 port=32980 user=postgres database=poller_lifecycle_test) at 0x7fd4e5fbdd30>
+source = {'id': UUID('fa6c32ed-1b22-48ec-ac91-c1a15a9c8e5e'), 'legacy_company_id': 1, 'ats': 'lever', 'public_board_ref': 'fixture', ...}
+postings = []
+claim = ClaimRef(owner_token='[REDACTED_TEST_TOKEN]', generation=1, lease_until=datetime.datetime(2026, 10, 7, 16, 25, 40, 553945, tzinfo=zoneinfo.ZoneInfo(key='Etc/UTC')))
+
+    def admit(conn, source, postings, claim=None):
+        claim = claim or claim_work(conn, 'source', str(source['id']), 180)
+        reservation = reserve_capacity(conn, claim, 65536 * max(1, len(postings)))
+>       count = identity.admit_metadata(conn, source['id'], postings, claim, reservation)
+                ^^^^^^^^^^^^^^^^^^^^^^^
+E       AttributeError: module 'job_discovery.lifecycle.identity' has no attribute 'admit_metadata'
+
+tests/test_lifecycle_admission.py:17: AttributeError
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_admission.py::test_stable_lean_admission_and_private_history
+FAILED tests/test_lifecycle_admission.py::test_normalized_content_and_missing_payload_do_not_manufacture_versions
+FAILED tests/test_lifecycle_admission.py::test_partial_display_is_availability_only
+FAILED tests/test_lifecycle_admission.py::test_version_growth_pauses_without_discarding_unarchived_evidence
+FAILED tests/test_lifecycle_admission.py::test_chunk_limit_and_each_chunk_uses_reservation
+FAILED tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings
+FAILED tests/test_lifecycle_relations.py::test_typed_location_has_unknown_validity_and_no_invented_skills
+FAILED tests/test_lifecycle_relations.py::test_identity_assertions_require_review_and_reject_conflicts_cycles
+8 failed in 3.22s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/03-implementation.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/03-implementation.txt
new file mode 100644
index 0000000..8438c7c
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/03-implementation.txt
@@ -0,0 +1,20 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+......F.                                                                 [100%]
+=================================== FAILURES ===================================
+_______ test_typed_location_has_unknown_validity_and_no_invented_skills ________
+tests/test_lifecycle_relations.py:13: in test_typed_location_has_unknown_validity_and_no_invented_skills
+    admit(conn,source,[Posting('0','Role','https://example.test/job',location='Remote',raw={'descriptionPlain':'Python expert'})])
+tests/test_lifecycle_admission.py:17: in admit
+    count = identity.admit_metadata(conn, source['id'], postings, claim, reservation)
+            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+job_discovery/lifecycle/identity.py:366: in admit_metadata
+    capture_version(conn,listing['id'],metadata,now,claim)
+job_discovery/lifecycle/identity.py:301: in capture_version
+    conn.execute("INSERT INTO locations(raw,canonicals,components,source) VALUES(%s,'{}','{}','pending') ON CONFLICT DO NOTHING",(location,))
+../../../.venv/lib/python3.12/site-packages/psycopg/connection.py:304: in execute
+    raise ex.with_traceback(None)
+E   psycopg.errors.CheckViolation: new row for relation "locations" violates check constraint "locations_source_check"
+E   DETAIL:  Failing row contains (Remote, {}, {}, pending, 2026-10-07 16:24:20.986868+00).
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_relations.py::test_typed_location_has_unknown_validity_and_no_invented_skills
+1 failed, 7 passed in 5.29s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/04-red-legacy.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/04-red-legacy.txt
new file mode 100644
index 0000000..d7c19db
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/04-red-legacy.txt
@@ -0,0 +1,32 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+......F.F                                                                [100%]
+=================================== FAILURES ===================================
+________________ test_legacy_writer_is_lean_and_does_not_refill ________________
+tests/test_lifecycle_admission.py:118: in test_legacy_writer_is_lean_and_does_not_refill
+    assert conn.execute('SELECT description FROM jobs').fetchone()['description'] is None
+E   AssertionError: assert 'Unused body' is None
+_________ test_legacy_poll_does_not_fetch_questions_or_unused_details __________
+tests/test_lifecycle_admission.py:151: in test_legacy_poll_does_not_fetch_questions_or_unused_details
+    assert result['ok'] == 2 and result['new_jobs'] == 2
+E   assert (0 == 2)
+------------------------------ Captured log call -------------------------------
+ERROR    job_discovery:run.py:221 poll failed for X (greenhouse:g)
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/run.py", line 142, in run
+    questions_context = (spool_questions(
+                         ^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_lifecycle_admission.py", line 140, in no_question
+    raise AssertionError('routine question fetch forbidden')
+AssertionError: routine question fetch forbidden
+ERROR    job_discovery:run.py:221 poll failed for W (workday:w)
+Traceback (most recent call last):
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/job_discovery/run.py", line 139, in run
+    else ADAPTERS[ats](token))
+         ^^^^^^^^^^^^^^^^^^^^
+  File "/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_lifecycle_admission.py", line 144, in workday
+    assert fetch_details is False
+AssertionError: assert True is False
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_admission.py::test_legacy_writer_is_lean_and_does_not_refill
+FAILED tests/test_lifecycle_admission.py::test_legacy_poll_does_not_fetch_questions_or_unused_details
+2 failed, 7 passed in 12.84s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/05-integration.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/05-integration.txt
new file mode 100644
index 0000000..8d17293
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/05-integration.txt
@@ -0,0 +1,22 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+.......................................................................F [ 79%]
+............FF.....                                                      [100%]
+=================================== FAILURES ===================================
+__ test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives ___
+tests/test_lifecycle_reconcile.py:302: in test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives
+    with pytest.raises(KeyboardInterrupt):
+         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E   Failed: DID NOT RAISE KeyboardInterrupt
+_ test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart[deadline] _
+tests/test_lifecycle_reconcile.py:529: in test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart
+    assert conn.execute('SELECT min(consecutive_complete_misses) n FROM source_listings').fetchone()['n']==1
+E   assert 0 == 1
+_ test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart[after_complete] _
+tests/test_lifecycle_reconcile.py:529: in test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart
+    assert conn.execute('SELECT min(consecutive_complete_misses) n FROM source_listings').fetchone()['n']==1
+E   assert 0 == 1
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_reconcile.py::test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart[deadline]
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart[after_complete]
+3 failed, 88 passed in 596.52s (0:09:56)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/06-red-publication.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/06-red-publication.txt
new file mode 100644
index 0000000..d82f341
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/06-red-publication.txt
@@ -0,0 +1,11 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+F                                                                        [100%]
+=================================== FAILURES ===================================
+________ test_new_ashby_listing_freezes_trustworthy_source_publication _________
+tests/test_lifecycle_admission.py:331: in test_new_ashby_listing_freezes_trustworthy_source_publication
+    assert listing['discovery_anchor_at'] == datetime(2025,1,1,tzinfo=UTC)
+E   AssertionError: assert datetime.datetime(2026, 10, 7, 16, 28, 36, 757293, tzinfo=zoneinfo.ZoneInfo(key='Etc/UTC')) == datetime.datetime(2025, 1, 1, 0, 0, tzinfo=datetime.timezone.utc)
+E    +  where datetime.datetime(2025, 1, 1, 0, 0, tzinfo=datetime.timezone.utc) = <class 'datetime.datetime'>(2025, 1, 1, tzinfo=datetime.timezone.utc)
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_admission.py::test_new_ashby_listing_freezes_trustworthy_source_publication
+1 failed in 0.59s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/07-final-pg17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/07-final-pg17.txt
new file mode 100644
index 0000000..4cdce65
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/07-final-pg17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 71%]
+.............................                                            [100%]
+101 passed in 14.79s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/08-final-pg16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/08-final-pg16.txt
new file mode 100644
index 0000000..a83cb01
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/08-final-pg16.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [ 71%]
+.............................                                            [100%]
+101 passed in 44.11s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/09-red-bulk.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/09-red-bulk.txt
new file mode 100644
index 0000000..67dbcf5
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/09-red-bulk.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+.                                                                        [100%]
+1 passed in 28.75s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/10-red-bulk-relations.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/10-red-bulk-relations.txt
new file mode 100644
index 0000000..9376a51
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/10-red-bulk-relations.txt
@@ -0,0 +1,24 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+F                                                                        [100%]
+=================================== FAILURES ===================================
+_______ test_enforced_source_orchestration_chunks_metadata_and_sightings _______
+tests/test_lifecycle_admission.py:378: in test_enforced_source_orchestration_chunks_metadata_and_sightings
+    result = verify_due_sources(conn,max_boards=1)
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+job_discovery/lifecycle/reconcile.py:362: in verify_due_sources
+    admitted = stage_postings(conn,enum,chunk)
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+job_discovery/lifecycle/reconcile.py:194: in stage_postings
+    commit_sightings(conn,enum,observations)
+job_discovery/lifecycle/reconcile.py:168: in commit_sightings
+    inserted = conn.execute("""INSERT INTO enumeration_members(enumeration_id,external_id,public_metadata)
+../../../.venv/lib/python3.12/site-packages/psycopg/connection.py:304: in execute
+    raise ex.with_traceback(None)
+E   psycopg.errors.RaiseException: lifecycle admission chunk exceeds 500 rows
+E   CONTEXT:  PL/pgSQL function lifecycle_private.validate_write() line 19 at RAISE
+E   SQL statement "INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,reservation_id,job_id,scope,bytes,row_count)
+E    VALUES(current_user,public.app_user_id(),rid,jid,TG_TABLE_NAME,growth,1)"
+E   PL/pgSQL function public.lifecycle_validate_row() line 88 at SQL statement
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_admission.py::test_enforced_source_orchestration_chunks_metadata_and_sightings
+1 failed in 17.57s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/11-final-integration-pg17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/11-final-integration-pg17.txt
new file mode 100644
index 0000000..88305ad
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/11-final-integration-pg17.txt
@@ -0,0 +1,21 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..............................................................F......FF  [100%]
+=================================== FAILURES ===================================
+__ test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives ___
+tests/test_lifecycle_reconcile.py:302: in test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives
+    with pytest.raises(KeyboardInterrupt):
+         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E   Failed: DID NOT RAISE KeyboardInterrupt
+_ test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart[deadline] _
+tests/test_lifecycle_reconcile.py:529: in test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart
+    conn.commit()
+E   assert 0 == 1
+_ test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart[after_complete] _
+tests/test_lifecycle_reconcile.py:529: in test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart
+    conn.commit()
+E   assert 0 == 1
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_reconcile.py::test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart[deadline]
+FAILED tests/test_lifecycle_reconcile.py::test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart[after_complete]
+3 failed, 68 passed in 473.68s (0:07:53)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/12-final-integration-pg16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/12-final-integration-pg16.txt
new file mode 100644
index 0000000..90ca3a1
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/12-final-integration-pg16.txt
@@ -0,0 +1,11 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+..............................................................F........  [100%]
+=================================== FAILURES ===================================
+__ test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives ___
+tests/test_lifecycle_reconcile.py:302: in test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives
+    def interrupted(url,**kw):
+         ^^^^^^^^^^^^^^^^^^^^^^
+E   Failed: DID NOT RAISE KeyboardInterrupt
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_reconcile.py::test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives
+1 failed, 70 passed in 493.50s (0:08:13)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/13-corrected-fixtures-pg17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/13-corrected-fixtures-pg17.txt
new file mode 100644
index 0000000..f7587ef
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/13-corrected-fixtures-pg17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+...                                                                      [100%]
+3 passed in 39.40s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/14-corrected-admission-recovery-pg16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/14-corrected-admission-recovery-pg16.txt
new file mode 100644
index 0000000..aa9e677
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/14-corrected-admission-recovery-pg16.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+.................                                                        [100%]
+17 passed in 220.81s (0:03:40)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/15-corrected-admission-recovery-pg17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/15-corrected-admission-recovery-pg17.txt
new file mode 100644
index 0000000..e24f53e
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/15-corrected-admission-recovery-pg17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+.................                                                        [100%]
+17 passed in 203.59s (0:03:23)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/16-red-publication-observation.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/16-red-publication-observation.txt
new file mode 100644
index 0000000..7df7164
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/16-red-publication-observation.txt
@@ -0,0 +1,11 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+F                                                                        [100%]
+=================================== FAILURES ===================================
+________ test_new_ashby_listing_freezes_trustworthy_source_publication _________
+tests/test_lifecycle_admission.py:368: in test_new_ashby_listing_freezes_trustworthy_source_publication
+    assert conn.execute('SELECT source_published_at FROM source_listings').fetchone()['source_published_at'] == datetime(2026,1,1,tzinfo=UTC)
+E   AssertionError: assert datetime.datetime(2025, 1, 1, 0, 0, tzinfo=zoneinfo.ZoneInfo(key='Etc/UTC')) == datetime.datetime(2026, 1, 1, 0, 0, tzinfo=datetime.timezone.utc)
+E    +  where datetime.datetime(2026, 1, 1, 0, 0, tzinfo=datetime.timezone.utc) = <class 'datetime.datetime'>(2026, 1, 1, tzinfo=datetime.timezone.utc)
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_admission.py::test_new_ashby_listing_freezes_trustworthy_source_publication
+1 failed in 3.25s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/17-final-pg17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/17-final-pg17.txt
new file mode 100644
index 0000000..b616729
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/17-final-pg17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+.......................................................................  [100%]
+71 passed in 570.35s (0:09:30)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/18-final-pg16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/18-final-pg16.txt
new file mode 100644
index 0000000..40ce4d6
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/18-final-pg16.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+.......................................................................  [100%]
+71 passed in 579.26s (0:09:39)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/19-static-checks.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/19-static-checks.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/19-static-checks.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/20-red-retention-boundary.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/20-red-retention-boundary.txt
new file mode 100644
index 0000000..7eba075
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/20-red-retention-boundary.txt
@@ -0,0 +1,10 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+F                                                                        [100%]
+=================================== FAILURES ===================================
+_____ test_old_current_cannot_become_expired_unarchived_superseded_version _____
+tests/test_lifecycle_admission.py:438: in test_old_current_cannot_become_expired_unarchived_superseded_version
+    assert conn.execute('SELECT count(*) n FROM job_versions').fetchone()['n'] == 1
+E   assert 2 == 1
+=========================== short test summary info ============================
+FAILED tests/test_lifecycle_admission.py::test_old_current_cannot_become_expired_unarchived_superseded_version
+1 failed in 1.16s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/21-final-verified-pg17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/21-final-verified-pg17.txt
new file mode 100644
index 0000000..40584af
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/21-final-verified-pg17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [100%]
+72 passed in 526.08s (0:08:46)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/22-final-verified-pg16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/22-final-verified-pg16.txt
new file mode 100644
index 0000000..f659d8a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/22-final-verified-pg16.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [100%]
+72 passed in 552.95s (0:09:12)
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/23-final-static-checks.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/23-final-static-checks.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/23-final-static-checks.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/commands.json b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/commands.json
new file mode 100644
index 0000000..d7ccef6
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-evidence/commands.json
@@ -0,0 +1,94 @@
+[
+  {
+    "output": "01-red.txt",
+    "command": "python tools/lifecycle_test_db.py --postgres-major 17 -- python -m pytest tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py -q"
+  },
+  {
+    "output": "02-red.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py -q"
+  },
+  {
+    "output": "03-implementation.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py -q --tb=short"
+  },
+  {
+    "output": "04-red-legacy.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py -q --tb=short"
+  },
+  {
+    "output": "05-integration.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py tests/test_run_question_fetch.py tests/test_db_jobs.py tests/test_run.py tests/test_lifecycle_reconcile.py -q --tb=short"
+  },
+  {
+    "output": "06-red-publication.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py::test_new_ashby_listing_freezes_trustworthy_source_publication -q --tb=short"
+  },
+  {
+    "output": "07-final-pg17.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py tests/test_run_question_fetch.py tests/test_db_jobs.py tests/test_lifecycle_identity.py::test_same_id_legacy_upsert_does_not_reset_frozen_age tests/test_lifecycle_identity.py::test_capture_version_requires_complete_typed_public_metadata tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py -q --tb=short"
+  },
+  {
+    "output": "08-final-pg16.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py tests/test_run_question_fetch.py tests/test_db_jobs.py tests/test_lifecycle_identity.py::test_same_id_legacy_upsert_does_not_reset_frozen_age tests/test_lifecycle_identity.py::test_capture_version_requires_complete_typed_public_metadata tests/test_greenhouse.py tests/test_lever.py tests/test_ashby.py tests/test_workable.py tests/test_smartrecruiters.py tests/test_workday.py -q --tb=short"
+  },
+  {
+    "output": "09-red-bulk.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py::test_enforced_source_orchestration_chunks_metadata_and_sightings -q --tb=short"
+  },
+  {
+    "output": "10-red-bulk-relations.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py::test_enforced_source_orchestration_chunks_metadata_and_sightings -q --tb=short"
+  },
+  {
+    "output": "11-final-integration-pg17.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py tests/test_run.py tests/test_run_question_fetch.py tests/test_db_jobs.py tests/test_lifecycle_identity.py::test_same_id_legacy_upsert_does_not_reset_frozen_age tests/test_lifecycle_identity.py::test_capture_version_requires_complete_typed_public_metadata tests/test_lifecycle_reconcile.py::test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives tests/test_lifecycle_reconcile.py::test_fix1_single_response_good_positives_commit_despite_later_bad_item tests/test_lifecycle_reconcile.py::test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart -q --tb=short"
+  },
+  {
+    "output": "12-final-integration-pg16.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py tests/test_run.py tests/test_run_question_fetch.py tests/test_db_jobs.py tests/test_lifecycle_identity.py::test_same_id_legacy_upsert_does_not_reset_frozen_age tests/test_lifecycle_identity.py::test_capture_version_requires_complete_typed_public_metadata tests/test_lifecycle_reconcile.py::test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives tests/test_lifecycle_reconcile.py::test_fix1_single_response_good_positives_commit_despite_later_bad_item tests/test_lifecycle_reconcile.py::test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart -q --tb=short"
+  },
+  {
+    "output": "13-corrected-fixtures-pg17.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_reconcile.py::test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives tests/test_lifecycle_reconcile.py::test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart -q --tb=short"
+  },
+  {
+    "output": "14-corrected-admission-recovery-pg16.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py tests/test_lifecycle_reconcile.py::test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives tests/test_lifecycle_reconcile.py::test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart -q --tb=short"
+  },
+  {
+    "output": "15-corrected-admission-recovery-pg17.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py tests/test_lifecycle_reconcile.py::test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives tests/test_lifecycle_reconcile.py::test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart -q --tb=short"
+  },
+  {
+    "output": "16-red-publication-observation.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py::test_new_ashby_listing_freezes_trustworthy_source_publication -q --tb=short"
+  },
+  {
+    "output": "17-final-pg17.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py tests/test_run.py tests/test_run_question_fetch.py tests/test_db_jobs.py tests/test_lifecycle_identity.py::test_same_id_legacy_upsert_does_not_reset_frozen_age tests/test_lifecycle_identity.py::test_capture_version_requires_complete_typed_public_metadata tests/test_lifecycle_reconcile.py::test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives tests/test_lifecycle_reconcile.py::test_fix1_single_response_good_positives_commit_despite_later_bad_item tests/test_lifecycle_reconcile.py::test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart -q --tb=short"
+  },
+  {
+    "output": "18-final-pg16.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py tests/test_run.py tests/test_run_question_fetch.py tests/test_db_jobs.py tests/test_lifecycle_identity.py::test_same_id_legacy_upsert_does_not_reset_frozen_age tests/test_lifecycle_identity.py::test_capture_version_requires_complete_typed_public_metadata tests/test_lifecycle_reconcile.py::test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives tests/test_lifecycle_reconcile.py::test_fix1_single_response_good_positives_commit_despite_later_bad_item tests/test_lifecycle_reconcile.py::test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart -q --tb=short"
+  },
+  {
+    "output": "19-static-checks.txt",
+    "command": "/workspace/job-board/.venv/bin/ruff check job_discovery/models.py job_discovery/adapters/completeness.py job_discovery/db.py job_discovery/run.py job_discovery/lifecycle/identity.py job_discovery/lifecycle/reconcile.py tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py tests/test_db_jobs.py tests/test_lifecycle_identity.py tests/test_lifecycle_reconcile.py --output-format concise; git diff --check"
+  },
+  {
+    "output": "20-red-retention-boundary.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py::test_old_current_cannot_become_expired_unarchived_superseded_version -q --tb=short"
+  },
+  {
+    "output": "21-final-verified-pg17.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py tests/test_run.py tests/test_run_question_fetch.py tests/test_db_jobs.py tests/test_lifecycle_identity.py::test_same_id_legacy_upsert_does_not_reset_frozen_age tests/test_lifecycle_identity.py::test_capture_version_requires_complete_typed_public_metadata tests/test_lifecycle_reconcile.py::test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives tests/test_lifecycle_reconcile.py::test_fix1_single_response_good_positives_commit_despite_later_bad_item tests/test_lifecycle_reconcile.py::test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart -q --tb=short"
+  },
+  {
+    "output": "22-final-verified-pg16.txt",
+    "command": "/workspace/job-board/.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- /workspace/job-board/.venv/bin/python -m pytest tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py tests/test_run.py tests/test_run_question_fetch.py tests/test_db_jobs.py tests/test_lifecycle_identity.py::test_same_id_legacy_upsert_does_not_reset_frozen_age tests/test_lifecycle_identity.py::test_capture_version_requires_complete_typed_public_metadata tests/test_lifecycle_reconcile.py::test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives tests/test_lifecycle_reconcile.py::test_fix1_single_response_good_positives_commit_despite_later_bad_item tests/test_lifecycle_reconcile.py::test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart -q --tb=short"
+  },
+  {
+    "output": "23-final-static-checks.txt",
+    "command": "/workspace/job-board/.venv/bin/ruff check job_discovery/models.py job_discovery/adapters/completeness.py job_discovery/db.py job_discovery/run.py job_discovery/lifecycle/identity.py job_discovery/lifecycle/reconcile.py tests/test_lifecycle_admission.py tests/test_lifecycle_relations.py tests/test_db_jobs.py tests/test_lifecycle_identity.py tests/test_lifecycle_reconcile.py --output-format concise; git diff --check"
+  }
+]
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-report.md
new file mode 100644
index 0000000..8afad53
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-7-report.md
@@ -0,0 +1,61 @@
+# Task 7 — lean admission and public versions
+
+Base: `8f9a195e8bed49e0002d7b152b1d4b8983d96f04`, `feature/lifecycle-recovery` worktree. The supplied production reference `114cce96cb244546864a6bddc5476b5630bc024a` is an ancestor. The local `origin/main` ref is stale (`73ce118`, August 23); it was not treated as newer upstream evidence or used to reset anything. Local implementation only. Controller documents are excluded from this author's commit. No activation, production writes, remote publishing, infrastructure, provider/model or paid calls occurred.
+
+## Behavior and integration
+
+- `admit_metadata` preserves source/external coordinates, existing Job IDs, first-seen timestamps, frozen anchors and private foreign keys. New Jobs contain metadata only. Neither legacy upsert nor lifecycle admission passively fills descriptions. Existing populated caches and private packages stay unchanged; no legacy version/use history is invented.
+- The actual `verify_due_sources -> stage_postings` path now admits metadata before recording the same enumeration's positive sightings. Its returned new-job count increments only after committed chunks. Minimal identifiable fallback postings have `metadata_complete=False`: they can reopen/confirm availability but cannot overwrite good metadata or manufacture versions.
+- Admission/staging accepts at most **25 postings per transaction**. Each posting has at most five metadata effects (Job, listing insert OR later publication update, version, listing version pointer, one existing-location edge) plus three membership/sighting effects: **25 × 8 = 200**, below the established 500-row ceiling. Reconciliation retains its independent 100-row cursor. No unbounded multi-location or skill expansion exists. Oversized admission batches are rejected before writing; callers split them. A caller-held chunk forecast accompanies separate existing scoped reservations for row effects, conservatively holding extra headroom rather than rebinding one reservation across jobs/tables. This is functional use of Task 3, not independent capacity/security approval.
+- Public versions use the source listing revision and a deterministic UTF-8/NFC/whitespace-normalized hash of allowlisted metadata. Received descriptions contribute only a normalized digest, never persistent body text. Absent optional fields/body are unknown and preserve prior facts. Unchanged metadata creates no new version; availability alone creates none. Public metadata is bounded to 6 KiB; Task 10 still owns complete event-envelope validation.
+- Current plus ten superseded versions is the maximum. History older than 30 days also pauses growth before a new version could supersede an old current row. All unarchived evidence is retained; version-limit pauses leave known Job metadata intact while sightings continue. No version deletion/compaction is implemented here: safe archive/reference-aware retirement is a later integration prerequisite. The archive producer remains unavailable and activated public writes remain blocked by existing triggers until Task 10 supplies the outbox contract.
+- On an Ashby listing's first capture, valid timezone-aware, nonfuture `publishedAt` can supply the frozen anchor, with `ashby.publishedAt` provenance. This is Ashby's last-publication timestamp at capture, **not** original requisition/publication history. Later valid publication observations update the source publication field, including on legacy listings, while never moving an existing anchor or creating a content version solely for republication. Invalid/future/naive publication values fall back through the existing `choose_anchor` contract; other source publication fields remain unknown rather than guessed.
+- Typed location evidence links only to an existing location dictionary entry. Unknown raw locations remain metadata without invented canonical facts. Valid-from/to and confidence remain NULL. No public skills, brands or employer equivalences are extracted from private data or guessed from titles/descriptions.
+- `set_identity_assertion` accepts only typed public fields, requires reviewed evidence for acceptance, rejects self-links, accepted same-job cycles and conflicting representatives, and never rewrites Job/private anchors. Proposed edges do not imply accepted/transitive merges.
+- Routine Greenhouse question backfill is removed from polling. Workday/SmartRecruiters poll with detail fetch disabled. Existing explicit question helper, parsers and detail functions remain reusable for later demand hydration; their ordinary helper tests pass.
+
+## Caller inventory
+
+- `run.run` flag-off path -> `_admit_chunk` -> `db.upsert_jobs`; `db.upsert_job` is the retained one-item legacy wrapper. Both now keep source descriptions transient and ignore availability-only fallback metadata.
+- `run.run` source-enabled path -> `verify_due_sources` -> `stage_postings` -> `admit_metadata` -> `capture_version`. Source staging uses `ADMISSION_CHUNK_SIZE`; source absence reconciliation keeps `CHUNK=100`.
+- `capture_version` is an explicit typed API used by admission; its former reserved/no-op test is replaced by the new complete-metadata requirement.
+- `set_identity_assertion` is an explicit service API with no automatic poll caller. Existing `migrate_identity_batch`/`company_sources` legacy mapping remains unchanged.
+- `backfill_greenhouse_questions` has no production call site after this change; only its explicit helper tests invoke it. `insert_job_questions` remains for later demand callers.
+- `Posting.metadata_complete` survives the existing dataclass spool serialization. The common identified-posting parser marks parser fallbacks false.
+
+## Verification chronology
+
+Exact command strings are in `task-7-evidence/commands.json`; each corresponding numbered log preserves its actual result. Labels containing “final” describe the command's intent at that time, not a claim that later edits had already been verified.
+
+1. System `python` could not import `psycopg`; no tests ran. Switched to the existing repository venv without changing dependencies.
+2. PostgreSQL 17 initial RED: eight failures for missing admission/API/completeness behavior and zero actual source admission.
+3. First implementation: seven passed, one failed because the existing location dictionary rejects an invented `pending` provenance. Corrected to reuse existing dictionary entries and made the test's known-location fixture explicit; no schema relaxation.
+4. Legacy RED: seven passed, two failed showing passive description refill and routine question/detail fetching.
+5. Broader PG17 snapshot: 88 passed, three failed. The old 100-posting producer did not reach the simulated next-page interruption within its budget. Two completed-membership handoff assertions incorrectly included the newly admitted observed `extra` listing among absent identities. Those assertions now check the 205 prior identities' misses and the observed listing's zero misses separately.
+6. Ashby initial-anchor RED: one failure, then frozen initial capture implemented.
+7–8. Historical affected lanes before the final batching correction: **101 passed each**, PostgreSQL **17.11** and **16.15**, zero skips.
+9. Initial 70-posting bulk fixture without location edges passed (490 maximum effects); it did not exercise the over-limit case.
+10. Bulk fixture with existing typed location edges reproduced **`lifecycle admission chunk exceeds 500 rows`**. Reduced only the producer/admission batch to 25, preserving reconciliation's 100-row cursor.
+11. Bounded-product PG17 snapshot: **68 passed, 3 failed**, using the older collected interruption and handoff fixtures.
+12. Bounded-product PG16 snapshot: **70 passed, 1 failed**, using the corrected handoff assertions but older interruption fixture. The network-interruption test now fixes only the public scheduler clock to isolate its intended next-page interruption from CPU/database admission time; DB lease time remains real. Source time-budget behavior is independently covered by existing scheduler tests. This fixture correction does not remove the production 60-second board budget; slower initial admission may produce a safe partial enumeration.
+13. Corrected PG17 recovery fixtures: **3 passed**. Fresh-worker committed-positive recovery and both completed-membership cursor handoff cases pass, including the observed-extra/old-misses distinction.
+14–15. Admission plus corrected recovery snapshots before the final publication-field correction: **17 passed each**, PostgreSQL 16.15 and 17.11; zero skips.
+16. Final exact-spec RED: later Ashby publication remained at the initial value. Implemented recording valid new publication observations independently of frozen anchor and content hash; added an assertion that publication-only changes create no content version.
+17–18. Product lanes after publication correction, before the final retention predicate correction: **71 passed each**, PostgreSQL 17.11 and 16.15, zero skips.
+19. Changed-file lint and whitespace checks passed.
+20. RED at the prospective retention boundary: a 31-day-old current version was incorrectly allowed to become superseded (`2` versions versus expected `1`). The room check now includes the current row's age because a changed version would supersede it.
+21. Final PostgreSQL **17.11** lane after all corrections: **72 passed**, zero skips (526.08 seconds).
+22. Final PostgreSQL **16.15** lane after all corrections: **72 passed**, zero skips (552.95 seconds).
+23. Final changed-file Ruff and `git diff --check`: passed. The first staged check found trailing whitespace in pytest's original traceback formatting; evidence sanitization removed that whitespace along with synthetic claim tokens, then the staged check passed.
+
+Final formatting/lint checks cover changed Python modules and tests; `git diff --check` passed before the author's commit. Testing is scoped to permitted ordinary admission, adapter, relation, source orchestration, legacy and question-helper behavior. No blanket whole-suite/security verdict is claimed.
+
+## Outstanding requirements and review boundaries
+
+- Task 6 FULL specification remains FAIL: R6-4 durable reconciliation above 6000 MiB and R6-5 shared bounded public transport remain required for later Tasks 8/10/13. This change uses the existing below-guard core; it does not repair or waive those requirements. Above-guard fallback is still read-only and does not claim durable reconciliation.
+- Independent Task 3 expiry/capacity/cross-user/adversarial review gaps remain deliberately unreviewed. No refused probes or replacement security review were attempted. Ordinary enforced-mode tests demonstrate this writer's integration only.
+- Archive/reference-aware version compaction, paired outbox writes and demand hydration remain later-task work. Flags retain their off defaults, retirement remains dry-run, and archive activation is unavailable.
+- An optional local process diagnostic encountered `PermissionError: [Errno 13] Permission denied: '/proc/77856/environ'`. It was abandoned without retry/escalation; independently permitted tests continued.
+- Stop after this local author commit for independent permitted requirements/quality review and Library checkpoint 07, before Task 8. Controller owns any final release after all tasks and verification.
+
+Author outcome: implementation and permitted affected verification complete. Independent requirements/quality review and Library 07 remain the next gate; this is not a security or release approval.
diff --git a/job_discovery/adapters/completeness.py b/job_discovery/adapters/completeness.py
index c553397..2617c01 100644
--- a/job_discovery/adapters/completeness.py
+++ b/job_discovery/adapters/completeness.py
@@ -121,11 +121,12 @@ def iter_identified_postings(items, parse_one, status, *, title_key, url_keys,
         except (KeyError, TypeError, AttributeError, ValueError, IndexError) as exc:
             status.complete = False
             title = item.get(title_key)
             url = next((item.get(key) for key in url_keys
                         if isinstance(item.get(key), str) and item[key].strip()), None)
             posting = minimal_posting(item, exc) if minimal_posting else None
             if posting is None:
                 posting = Posting(external_id=external_id,
                                   title=title if isinstance(title, str) else None,
                                   url=url, raw=item)
+            posting.metadata_complete = False
         yield posting
diff --git a/job_discovery/db.py b/job_discovery/db.py
index 7ec322e..97a8940 100644
--- a/job_discovery/db.py
+++ b/job_discovery/db.py
@@ -1,37 +1,35 @@
 from job_discovery.lifecycle.locks import enter_gate, lock_jobs
 import json
 import os
 
 import psycopg
 from psycopg.rows import dict_row
 
-from job_discovery.jd import extract_description
 from job_discovery.models import Posting
 
 
 def connect(dsn: str | None = None) -> psycopg.Connection:
     dsn = dsn or os.environ["DATABASE_URL"]
     return psycopg.connect(
         dsn,
         row_factory=dict_row,
         connect_timeout=10,
         keepalives=1,
         keepalives_idle=30,
         keepalives_interval=10,
         keepalives_count=3,
     )
 
 
-# The Supabase Pro volume is 8 GB. A poll now stores only the distilled JD text
-# (jobs.description), so per-poll growth is modest, but we still halt well below
-# the hard limit as a backstop. Override via DB_SIZE_CEILING_MB.
+# Discovery stores lean metadata; payload hydration is demand-driven. The
+# physical backstop remains below the 8 GB volume. Override via DB_SIZE_CEILING_MB.
 DB_SIZE_CEILING_MB_DEFAULT = 6000.0
 
 
 def db_size_ceiling_mb() -> float:
     raw = os.environ.get("DB_SIZE_CEILING_MB")
     if raw is None or raw.strip() == "":
         return DB_SIZE_CEILING_MB_DEFAULT
     try:
         return float(raw)
     except ValueError:
@@ -125,38 +123,42 @@ _UPSERT_SQL = """
        OR COALESCE(EXCLUDED.department, jobs.department) IS DISTINCT FROM jobs.department
        OR COALESCE(EXCLUDED.remote,     jobs.remote)     IS DISTINCT FROM jobs.remote
        OR (jobs.description IS NULL AND NOT jobs.description_pruned
            AND EXCLUDED.description IS NOT NULL)
     RETURNING (xmax = 0) AS is_new
 """
 
 
 def _posting_row(ats: str, token: str, company_id: int, p: Posting) -> tuple:
     job_id = f"{ats}:{token}:{p.external_id}"
-    description = extract_description(ats, p.raw or {})
+    description = None  # Discovery never fills or refreshes a payload cache.
     return (job_id, company_id, p.external_id, p.title, p.url,
             p.location, p.department, p.remote, description)
 
 
 def upsert_jobs(
     conn, company_id: int, ats: str, token: str, postings: list[Posting]
 ) -> int:
     """Batch-upsert a list of postings using psycopg3 pipelined executemany.
 
     Returns the count of rows that were newly inserted (is_new=TRUE). A conditional
     DO UPDATE skips no-op rows entirely (returns no RETURNING row for those), so a
     skipped update is counted as not new. Note: last_seen_at does not advance for
     unchanged rows.
     """
     if not postings:
         return 0
-    rows = [_posting_row(ats, token, company_id, p) for p in postings]
+    rows = [_posting_row(ats, token, company_id, p) for p in postings
+            if p.metadata_complete and isinstance(p.title,str) and p.title.strip()
+            and isinstance(p.url,str) and p.url.strip()]
+    if not rows:
+        return 0
     new = 0
     lock_jobs(conn, [row[0] for row in rows])
     with conn.cursor() as cur:
         cur.executemany(_UPSERT_SQL, rows, returning=True)
         while True:
             row = cur.fetchone()
             if row and row["is_new"]:
                 new += 1
             if not cur.nextset():
                 break
diff --git a/job_discovery/lifecycle/identity.py b/job_discovery/lifecycle/identity.py
index ee5dcfc..51b1b61 100644
--- a/job_discovery/lifecycle/identity.py
+++ b/job_discovery/lifecycle/identity.py
@@ -1,24 +1,33 @@
-"""Explicit, bounded legacy compatibility mapping. Never reconstruct history.
+"""Stable lean identity, bounded public revisions, and explicit typed evidence.
 
-The caller owns commit/rollback and must invoke mapping as the first operation of
-its short transaction. Runtime polling does not call this migration helper.
+Callers own short transactions. Legacy mapping is an explicit migration helper;
+runtime discovery uses metadata admission and never reconstructs private history.
 """
 
+import hashlib
+import json
+import unicodedata
 from datetime import UTC, datetime, timedelta
+from urllib.parse import urlsplit
 from uuid import UUID
 
 from psycopg.rows import dict_row
+from psycopg.types.json import Jsonb
 
 from .config import read_control
-from .locks import enter_gate
-from .types import ClaimRef
+from job_discovery.models import Posting
+from job_discovery.jd import extract_description
+from .capacity import bind_reservation, settle_capacity
+from .claims import validate_claim
+from .locks import enter_gate, lock_jobs
+from .types import ClaimRef, ReservationRef
 
 
 def choose_anchor(
     published_at: datetime | None, discovered_at: datetime, now: datetime
 ) -> tuple[datetime, str]:
     for value in (discovered_at, now):
         if (
             not isinstance(value, datetime)
             or value.tzinfo is None
             or value.utcoffset() is None
@@ -162,20 +171,419 @@ def _map_company_source(cur, company_id, source_id, ats, board_ref):
     # employer identity or a manufactured source-observation timestamp.
     cur.execute(
         """INSERT INTO company_sources
         (company_id,source_account_id,evidence_kind,public_evidence_ref,status)
         VALUES (%s,%s,'legacy_mapping',%s,'accepted')
         ON CONFLICT (company_id,source_account_id) DO NOTHING""",
         (company_id, source_id, f"{ats}:{board_ref}"),
     )
 
 
+def _text(value):
+    return (
+        " ".join(unicodedata.normalize("NFC", value).split())
+        if isinstance(value, str)
+        else None
+    )
+
+
+def _public_ref(value):
+    if not isinstance(value, str) or len(value.encode()) > 2048:
+        raise ValueError("bounded public evidence URL required")
+    try:
+        url = urlsplit(value)
+        if (
+            url.scheme not in {"http", "https"}
+            or not url.hostname
+            or url.username
+            or url.password
+        ):
+            raise ValueError("public evidence URL required")
+    except ValueError:
+        raise ValueError("public evidence URL required") from None
+    return value
+
+
+def posting_metadata(
+    ats: str, posting: Posting, previous: dict | None = None
+) -> dict | None:
+    """Allowlist source facts; never serialize raw or private applicant content.
+
+    Missing optional fields and absent bodies are unknown, not a source assertion
+    that a previously observed fact disappeared. A minimal fallback is only a
+    positive sighting and cannot overwrite any known metadata.
+    """
+    if (
+        not posting.metadata_complete
+        or not _text(posting.title)
+        or not _text(posting.url)
+    ):
+        return None
+    try:
+        url = _public_ref(posting.url.strip())
+    except ValueError:
+        return None
+    metadata = dict(previous or {})
+    metadata.update(title=_text(posting.title), url=url)
+    for field in ("location", "department"):
+        value = _text(getattr(posting, field))
+        if value:
+            metadata[field] = value
+    if type(posting.remote) is bool:
+        metadata["remote"] = posting.remote
+    try:
+        body = extract_description(ats, posting.raw or {})
+    except (TypeError, ValueError, AttributeError, KeyError):
+        body = None
+    body = _text(body)
+    if body:
+        metadata["description_hash"] = hashlib.sha256(body.encode()).hexdigest()
+    if len(json.dumps(metadata, ensure_ascii=False).encode()) > 6144:
+        return None
+    return metadata
+
+
+def _source_publication(ats, raw, now):
+    # Ashby documents last publication, not original requisition creation.
+    # Unknown source fields and invalid/future/naive values remain unknown.
+    if ats != "ashby" or not isinstance(raw, dict):
+        return None
+    value = raw.get("publishedAt")
+    if not isinstance(value, str):
+        return None
+    try:
+        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
+    except ValueError:
+        return None
+    anchor, provenance = choose_anchor(value, now, now)
+    return anchor if provenance == "source_published" else None
+
+
+def _version_room(conn, listing):
+    # No archive producer exists yet. Retain all evidence and pause rather than
+    # delete to satisfy a cap, including archived rows still referenced privately.
+    # A changed version would supersede the current row too, so include its age.
+    row = conn.execute(
+        """SELECT count(*) n,
+        bool_or(recorded_at<clock_timestamp()-interval '30 days') old
+        FROM job_versions WHERE source_listing_id=%s""",
+        (listing["id"],),
+    ).fetchone()
+    return row["n"] < 11 and not row["old"]
+
+
 def capture_version(
     conn, listing_id: UUID, metadata: dict, observed_at: datetime, claim: ClaimRef
 ) -> UUID | None:
-    """Reserved interface: no version writes until gated writers/outbox exist.
+    """Capture one meaningful public revision, or pause at the retention bound.
+
+    The caller owns the transaction. Archive activation still fails closed in
+    database triggers until Task 10 pairs every eventful write with its outbox.
+    """
+    from .reconcile import _write
+
+    allowed = {"title", "url", "location", "department", "remote", "description_hash"}
+    if not isinstance(metadata, dict) or set(metadata) - allowed:
+        raise ValueError("only typed public metadata is accepted")
+    if not isinstance(observed_at, datetime) or observed_at.tzinfo is None:
+        raise ValueError("aware observation timestamp required")
+    normalized = {}
+    for key, value in metadata.items():
+        if key == "remote":
+            if type(value) is not bool:
+                raise ValueError("remote requires boolean")
+            normalized[key] = value
+        else:
+            if not isinstance(value, str) or not value.strip():
+                raise ValueError("metadata requires nonempty strings")
+            normalized[key] = _text(value)
+    if not normalized.get("title") or not normalized.get("url"):
+        raise ValueError("title and public URL required")
+    _public_ref(normalized["url"])
+    if "description_hash" in normalized and (
+        len(normalized["description_hash"]) != 64
+        or any(c not in "0123456789abcdef" for c in normalized["description_hash"])
+    ):
+        raise ValueError("invalid public content hash")
+    encoded = json.dumps(
+        normalized, sort_keys=True, separators=(",", ":"), ensure_ascii=False
+    ).encode()
+    if len(encoded) > 6144:
+        raise ValueError("public metadata exceeds bounded size")
+    enter_gate(conn)
+    listing = conn.execute(
+        "SELECT * FROM source_listings WHERE id=%s", (listing_id,)
+    ).fetchone()
+    if listing is None:
+        raise ValueError("unknown source listing")
+    lock_jobs(conn, [listing["job_id"]])
+    validate_claim(conn, claim)
+    digest = hashlib.sha256(encoded).hexdigest()
+    if digest == listing["content_hash"]:
+        return listing["current_version_id"]
+    if not _version_room(conn, listing):
+        return None
+    revision = listing["current_revision"] + 1
+    with _write(conn, claim, "job_versions", listing["job_id"], size=65536):
+        version = conn.execute(
+            """INSERT INTO job_versions
+            (job_id,source_listing_id,revision,content_hash,public_metadata,observed_at)
+            VALUES(%s,%s,%s,%s,%s,%s) RETURNING id""",
+            (
+                listing["job_id"],
+                listing_id,
+                revision,
+                digest,
+                Jsonb(normalized),
+                observed_at,
+            ),
+        ).fetchone()["id"]
+    with _write(conn, claim, "source_listings", listing["job_id"]):
+        conn.execute(
+            """UPDATE source_listings SET current_version_id=%s,current_revision=%s,
+            content_hash=%s,content_changed_at=%s WHERE id=%s""",
+            (version, revision, digest, observed_at, listing_id),
+        )
+    location = normalized.get("location")
+    # Reuse the established dictionary; never invent canonical location facts.
+    if (
+        location
+        and conn.execute("SELECT 1 FROM locations WHERE raw=%s", (location,)).fetchone()
+    ):
+        with _write(conn, claim, "job_locations"):
+            conn.execute(
+                """INSERT INTO job_locations(job_version_id,location_id,evidence_kind,
+                public_evidence_ref,observed_at,status) VALUES(%s,%s,'structured_source',%s,%s,'accepted')""",
+                (version, location, normalized["url"], observed_at),
+            )
+    return version
 
-    Identical and changed content both return None at this intermediate stage.
-    No flag/GUC enables an unfenced write implementation.
+
+# At most five metadata row effects per posting (one known location edge;
+# listing creation and a later publication update are mutually exclusive).
+# Source staging adds at most three more: 25 * 8 = 200, below the 500-row cap.
+ADMISSION_CHUNK_SIZE = 25
+
+
+def admit_metadata(
+    conn,
+    source_id: UUID,
+    postings: list[Posting],
+    claim: ClaimRef,
+    reservation: ReservationRef,
+) -> int:
+    """Admit <=25 lean identities (within the 500-row transaction bound); stable legacy Job keys/private FKs never move.
+
+    A held chunk forecast accompanies separate scoped reservations for each row
+    effect. This conservatively double-counts temporary headroom rather than
+    reusing a reservation across incompatible deferred-validation scopes.
     """
-    read_control(conn)  # Missing/unreadable control must fail closed.
-    return None
+    from .reconcile import _write
+
+    if len(postings) > ADMISSION_CHUNK_SIZE:
+        raise ValueError(
+            "admission chunk exceeds 25 postings (500 row-effects ceiling)"
+        )
+    if reservation is None or reservation.claim != claim:
+        raise ValueError("matching chunk reservation required")
+    enter_gate(conn)
+    source = conn.execute(
+        "SELECT * FROM source_accounts WHERE id=%s", (source_id,)
+    ).fetchone()
+    if source is None or source["legacy_company_id"] is None:
+        raise ValueError("source requires an explicit existing company mapping")
+    keys = []
+    for posting in postings:
+        if (
+            not isinstance(posting.external_id, str)
+            or not posting.external_id.strip()
+            or len(posting.external_id.encode()) > 2048
+        ):
+            raise ValueError("bounded source external ID required")
+        keys.append(
+            f"{source['ats']}:{source['public_board_ref']}:{posting.external_id}"
+        )
+    existing = conn.execute(
+        "SELECT job_id FROM source_listings WHERE source_account_id=%s AND external_id=ANY(%s)",
+        (source_id, [p.external_id for p in postings]),
+    ).fetchall()
+    lock_jobs(conn, keys + [r["job_id"] for r in existing])
+    validate_claim(conn, claim)
+    bind_reservation(conn, reservation, job_id=None, scope="source_listings")
+    now = conn.execute("SELECT clock_timestamp() t").fetchone()["t"]
+    admitted = 0
+    for posting, key in zip(postings, keys):
+        listing = conn.execute(
+            "SELECT * FROM source_listings WHERE source_account_id=%s AND external_id=%s",
+            (source_id, posting.external_id),
+        ).fetchone()
+        old = (
+            conn.execute(
+                "SELECT public_metadata FROM job_versions WHERE id=%s",
+                (listing["current_version_id"],),
+            ).fetchone()
+            if listing
+            else None
+        )
+        job_id = listing["job_id"] if listing else key
+        job = conn.execute("SELECT * FROM jobs WHERE id=%s", (job_id,)).fetchone()
+        previous = (
+            old["public_metadata"]
+            if old
+            else (
+                {
+                    k: job[k]
+                    for k in ("title", "url", "location", "department", "remote")
+                    if job[k] is not None
+                }
+                if job
+                else {}
+            )
+        )
+        metadata = posting_metadata(source["ats"], posting, previous)
+        if metadata is None:
+            continue
+        published = _source_publication(source["ats"], posting.raw, now)
+        if listing and published and listing["source_published_at"] != published:
+            with _write(conn, claim, "source_listings", job_id):
+                conn.execute(
+                    """UPDATE source_listings SET source_published_at=%s,
+                    source_published_provenance='ashby.publishedAt' WHERE id=%s""",
+                    (published, listing["id"]),
+                )
+        digest = hashlib.sha256(
+            json.dumps(
+                metadata, sort_keys=True, separators=(",", ":"), ensure_ascii=False
+            ).encode()
+        ).hexdigest()
+        if listing and (
+            listing["content_hash"] == digest or not _version_room(conn, listing)
+        ):
+            continue
+        with _write(conn, claim, "jobs", job_id, size=65536):
+            row = conn.execute(
+                """INSERT INTO jobs(id,company_id,external_id,title,url,location,department,remote)
+                VALUES(%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO UPDATE SET
+                title=EXCLUDED.title,url=EXCLUDED.url,location=EXCLUDED.location,
+                department=EXCLUDED.department,remote=EXCLUDED.remote
+                WHERE (jobs.title,jobs.url,jobs.location,jobs.department,jobs.remote)
+                  IS DISTINCT FROM (EXCLUDED.title,EXCLUDED.url,EXCLUDED.location,EXCLUDED.department,EXCLUDED.remote)
+                RETURNING (xmax=0) AS is_new""",
+                (
+                    job_id,
+                    source["legacy_company_id"],
+                    posting.external_id,
+                    metadata["title"],
+                    metadata["url"],
+                    metadata.get("location"),
+                    metadata.get("department"),
+                    metadata.get("remote"),
+                ),
+            ).fetchone()
+            admitted += bool(row and row["is_new"])
+        if not listing:
+            discovered = job["first_seen_at"] if job else now
+            anchor, provenance = choose_anchor(
+                None if job else published, discovered, now
+            )
+            if job:
+                provenance = "legacy_local_observation"
+            with _write(conn, claim, "source_listings", job_id):
+                listing = conn.execute(
+                    """INSERT INTO source_listings(source_account_id,external_id,job_id,
+                    original_discovered_at,discovery_anchor_at,discovery_anchor_provenance,discovery_expires_at,
+                    source_published_at,source_published_provenance,legacy_closed_at)
+                    VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
+                    (
+                        source_id,
+                        posting.external_id,
+                        job_id,
+                        discovered,
+                        anchor,
+                        provenance,
+                        anchor + timedelta(days=30),
+                        published,
+                        "ashby.publishedAt" if published else None,
+                        job["closed_at"] if job else None,
+                    ),
+                ).fetchone()
+        capture_version(conn, listing["id"], metadata, now, claim)
+    settle_capacity(conn, reservation)
+    return admitted
+
+
+def set_identity_assertion(conn, assertion: dict, claim: ClaimRef) -> UUID:
+    """Record reviewed public evidence without merging Jobs or private history.
+
+    Accepted same-job edges point toward one representative. Proposals do not
+    participate in conflict/cycle checks and never imply transitive acceptance.
+    """
+    from .reconcile import _write
+
+    allowed = {
+        "left_listing_id",
+        "right_listing_id",
+        "relation",
+        "evidence_kind",
+        "public_evidence_ref",
+        "status",
+        "observed_at",
+        "reviewed_at",
+    }
+    if not isinstance(assertion, dict) or set(assertion) - allowed:
+        raise ValueError("only typed public assertion fields accepted")
+    data = {key: assertion.get(key) for key in allowed}
+    if (
+        data["relation"] not in {"same_job", "repost_of", "source_migration"}
+        or data["evidence_kind"] not in {"structured_source", "reviewed_public"}
+        or data["status"] not in {"proposed", "accepted", "retracted"}
+    ):
+        raise ValueError("invalid identity assertion type")
+    _public_ref(data["public_evidence_ref"])
+    left, right = data["left_listing_id"], data["right_listing_id"]
+    if left == right or not isinstance(left, UUID) or not isinstance(right, UUID):
+        raise ValueError("distinct listing UUIDs required")
+    for key in ("observed_at", "reviewed_at"):
+        if data[key] is not None and (
+            not isinstance(data[key], datetime) or data[key].tzinfo is None
+        ):
+            raise ValueError("aware public evidence timestamps required")
+    if data["status"] == "accepted" and (
+        data["evidence_kind"] != "reviewed_public" or data["reviewed_at"] is None
+    ):
+        raise ValueError("accepted assertion requires reviewed public evidence")
+    enter_gate(conn)
+    rows = conn.execute(
+        "SELECT job_id FROM source_listings WHERE id=ANY(%s)", ([left, right],)
+    ).fetchall()
+    if len(rows) != 2:
+        raise ValueError("unknown listing")
+    lock_jobs(conn, [r["job_id"] for r in rows])
+    validate_claim(conn, claim)
+    if data["status"] == "accepted" and data["relation"] == "same_job":
+        conflict = conn.execute(
+            "SELECT 1 FROM identity_assertions WHERE left_listing_id=%s AND right_listing_id<>%s AND relation='same_job' AND status='accepted'",
+            (left, right),
+        ).fetchone()
+        cycle = conn.execute(
+            """WITH RECURSIVE paths(id) AS (
+            SELECT %s::uuid UNION SELECT a.right_listing_id FROM identity_assertions a JOIN paths p ON a.left_listing_id=p.id
+            WHERE a.relation='same_job' AND a.status='accepted') SELECT 1 FROM paths WHERE id=%s""",
+            (right, left),
+        ).fetchone()
+        if conflict or cycle:
+            raise ValueError("conflicting representative or accepted same-job cycle")
+    old = conn.execute(
+        "SELECT * FROM identity_assertions WHERE left_listing_id=%s AND right_listing_id=%s AND relation=%s",
+        (left, right, data["relation"]),
+    ).fetchone()
+    if old and all(old[k] == v for k, v in data.items()):
+        return old["id"]
+    with _write(conn, claim, "identity_assertions"):
+        return conn.execute(
+            """INSERT INTO identity_assertions(left_listing_id,right_listing_id,relation,evidence_kind,public_evidence_ref,status,observed_at,reviewed_at)
+            VALUES(%(left_listing_id)s,%(right_listing_id)s,%(relation)s,%(evidence_kind)s,%(public_evidence_ref)s,%(status)s,%(observed_at)s,%(reviewed_at)s)
+            ON CONFLICT(left_listing_id,right_listing_id,relation) DO UPDATE SET evidence_kind=EXCLUDED.evidence_kind,
+            public_evidence_ref=EXCLUDED.public_evidence_ref,status=EXCLUDED.status,observed_at=EXCLUDED.observed_at,
+            reviewed_at=EXCLUDED.reviewed_at,revision=identity_assertions.revision+1 RETURNING id""",
+            data,
+        ).fetchone()["id"]
diff --git a/job_discovery/lifecycle/reconcile.py b/job_discovery/lifecycle/reconcile.py
index 2c5c420..64789a2 100644
--- a/job_discovery/lifecycle/reconcile.py
+++ b/job_discovery/lifecycle/reconcile.py
@@ -10,20 +10,21 @@ from datetime import datetime
 import logging
 from time import monotonic
 from uuid import UUID
 
 from psycopg.types.json import Jsonb
 
 from job_discovery.adapters.completeness import SourceStatus, SourceBudgetExceeded
 from .capacity import reserve_capacity, bind_reservation, settle_capacity
 from .claims import claim_work, validate_claim, renew_claim, cancel_claim
 from .config import read_control
+from .identity import ADMISSION_CHUNK_SIZE
 from .locks import enter_gate, lock_jobs
 from .types import ClaimRef, EnumerationRef, Observation
 
 log = logging.getLogger(__name__)
 CHUNK = 100  # Multiple row effects per identity stay below 500 per transaction.
 BOARD_SECONDS = 60
 BOARD_REQUESTS = 50
 BOARD_ROWS = 10000
 
 
@@ -167,39 +168,48 @@ def commit_sightings(conn, enumeration: EnumerationRef, observations: list[Obser
         with _write(conn, enumeration.claim, 'enumeration_members'):
             inserted = conn.execute("""INSERT INTO enumeration_members(enumeration_id,external_id,public_metadata)
                 VALUES(%s,%s,%s) ON CONFLICT DO NOTHING RETURNING external_id""",
                 (enumeration.id,o.id,Jsonb({'kind':o.kind}))).fetchone()
         if inserted:
             _positive(conn, enumeration, listing, o.kind, o.observed_at)
 
 
 def stage_postings(conn, enum, postings):
     """Retain IDs and tiny evidence only; no unused detail/raw payload persistence."""
-    if len(postings) > CHUNK:
+    if len(postings) > ADMISSION_CHUNK_SIZE:
         raise ValueError('posting checkpoint too large')
+    from .identity import admit_metadata
     ids = [p.external_id for p in postings]
+    admitted = 0
+    if postings:
+        reservation = reserve_capacity(conn, enum.claim, 65536 * len(postings))
+        if reservation is None:
+            raise StorageBlocked('metadata admission capacity unavailable')
+        admitted = admit_metadata(conn, enum.source_id, postings, enum.claim, reservation)
     enter_gate(conn)
     listings = conn.execute('SELECT * FROM source_listings WHERE source_account_id=%s AND external_id=ANY(%s)', (enum.source_id,ids)).fetchall()
     by_id = {row['external_id']:row for row in listings}
     now = conn.execute('SELECT clock_timestamp() t').fetchone()['t']
     observations = [Observation(p.external_id,by_id[p.external_id]['id'],
                      'unlisted' if (p.raw or {}).get('isListed') is False else 'seen',now)
                     for p in postings if p.external_id in by_id]
     commit_sightings(conn,enum,observations)
-    # Unknown IDs participate in exact membership, but Task 7 owns lean admission.
+    # Availability-only identities still participate in exact membership.
     for external_id in ids:
         if len(external_id.encode()) > 2048:
             raise ValueError('source identity exceeds bounded staging limit')
         if external_id not in by_id:
             with _write(conn,enum.claim,'enumeration_members'):
                 conn.execute("INSERT INTO enumeration_members VALUES(%s,%s,'{}') ON CONFLICT DO NOTHING", (enum.id,external_id))
 
+    return admitted
+
 
 def complete_enumeration(conn, enumeration: EnumerationRef, verdict: SourceStatus) -> None:
     e = _check(conn,enumeration)
     if e['status'] in {'complete','partial','failed'}:
         return
     if e['status'] != 'running':
         raise RuntimeError('enumeration is not running')
     empty = not conn.execute('SELECT 1 FROM enumeration_members WHERE enumeration_id=%s LIMIT 1', (enumeration.id,)).fetchone()
     prior_open = conn.execute("""SELECT count(*) n FROM source_listings l JOIN jobs j ON j.id=l.job_id
        WHERE l.source_account_id=%s AND j.closed_at IS NULL""", (enumeration.source_id,)).fetchone()['n']
@@ -317,23 +327,24 @@ def verify_due_sources(conn, *, max_boards=100, seconds=300):
                     renew_claim(conn,claim)
                     conn.commit()
                 with source_budget(min(BOARD_SECONDS,max(0,deadline-monotonic())),BOARD_REQUESTS,pulse):
                     postings = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
                     count = 0
                     for posting in postings:
                         count += 1
                         if count > BOARD_ROWS:
                             break
                         chunk.append(posting)
-                        if len(chunk) >= CHUNK or monotonic()-renewed >= 20:
-                            stage_postings(conn,enum,chunk)
+                        if len(chunk) >= ADMISSION_CHUNK_SIZE or monotonic()-renewed >= 20:
+                            admitted = stage_postings(conn,enum,chunk)
                             conn.commit()
+                            result['new_jobs'] += admitted
                             chunk = []
                             claim = renew_claim(conn,claim)
                             conn.commit()
                             enum = replace(enum,claim=claim)
                             renewed = monotonic()
                     verdict = SourceStatus(complete=postings.complete)
             except StorageBlocked:
                 conn.rollback()
                 log.warning("source evidence storage blocked; reconciliation deferred")
                 cancel_claim(conn,claim)
@@ -342,22 +353,23 @@ def verify_due_sources(conn, *, max_boards=100, seconds=300):
                 break
             except SourceBudgetExceeded:
                 verdict = SourceStatus(complete=False)
                 conn.rollback()
             except Exception:
                 log.exception('source enumeration failed or interrupted: %s',source['id'])
                 verdict = SourceStatus(complete=False,failed=True)
                 conn.rollback()
         try:
             if chunk:
-                stage_postings(conn,enum,chunk)
+                admitted = stage_postings(conn,enum,chunk)
                 conn.commit()
+                result['new_jobs'] += admitted
             complete_enumeration(conn,enum,verdict)
             conn.commit()
             while True:
                 done = reconcile_chunk(conn,enum)
                 conn.commit()
                 if done or monotonic() >= deadline:
                     break
                 claim = renew_claim(conn,claim)
                 conn.commit()
                 enum = replace(enum,claim=claim)
diff --git a/job_discovery/models.py b/job_discovery/models.py
index 524427d..9a210da 100644
--- a/job_discovery/models.py
+++ b/job_discovery/models.py
@@ -3,10 +3,12 @@ from dataclasses import dataclass, field
 
 @dataclass
 class Posting:
     external_id: str
     title: str
     url: str
     location: str | None = None
     department: str | None = None
     remote: bool | None = None
     raw: dict = field(default_factory=dict)
+    # False means positive availability only: fallback display is not source truth.
+    metadata_complete: bool = True
diff --git a/job_discovery/run.py b/job_discovery/run.py
index 8c2eee3..55248b7 100644
--- a/job_discovery/run.py
+++ b/job_discovery/run.py
@@ -1,11 +1,10 @@
-from contextlib import nullcontext
 from job_discovery.lifecycle.config import read_control
 from job_discovery.lifecycle.maintenance import pre_admission_maintenance
 from job_discovery.lifecycle.locks import enter_gate
 from job_discovery.lifecycle.capacity import CEILING_BYTES
 from job_discovery.lifecycle.legacy_spool import spool_feed, spool_questions
 import logging
 
 from job_discovery import db
 from job_discovery.adapters import ADAPTERS
 from job_discovery.adapters.greenhouse import parse_greenhouse_questions
@@ -113,66 +112,52 @@ def run(dsn: str | None = None) -> dict:
         if source_enabled:
             try:
                 db.sync_source_accounts(conn)
                 conn.commit()
             except StorageBlocked:
                 conn.rollback()
                 log.warning('source catalog storage blocked; verifying registered corpus')
             counts = verify_due_sources(conn)
             db.finish_run(conn,run_id,companies_ok=counts['ok'],companies_failed=counts['failed'],
                           new_jobs=counts['new_jobs'],closed_jobs=counts['closed_jobs'],
-                          notes='full-corpus source verification; payload admission deferred')
+                          notes='full-corpus source verification and lean metadata admission')
             conn.commit()
             return counts
         companies = db.active_companies(conn)
         conn.commit()  # No read transaction spans adapter HTTP.
 
         ok = failed = new_jobs = closed_jobs = 0
         aborted = False
         failures: list[str] = []
 
         for co in companies:
             ats, token, company_id = co["ats"], co["token"], co["id"]
             try:
                 company_closed = 0
                 postings = (ADAPTERS[ats](token, fetch_details=False)
-                            if over and ats in {"workday", "smartrecruiters"}
+                            if ats in {"workday", "smartrecruiters"}
                             else ADAPTERS[ats](token))
                 admissible_ids = set()
                 with spool_feed(postings, admissible_ids=admissible_ids) as (buffered, seen):
-                    questions_context = (spool_questions(
-                        conn, company_id, token, _get_json, parse_greenhouse_questions,
-                        db.greenhouse_jobs_missing_questions, admissible_ids, log,
-                    ) if not over and ats == "greenhouse" else nullcontext(iter(())))
-                    with questions_context as questions:
-                        chunk: list = []
-                        for p in buffered:
-                            if over or not p.url or not p.title:
-                                continue
-                            chunk.append(p)
-                            if len(chunk) >= UPSERT_CHUNK_SIZE:
-                                admitted, over = _admit_chunk(conn, company_id, ats, token, chunk)
-                                new_jobs += admitted
-                                chunk = []
-                        if chunk:
+                    chunk: list = []
+                    for p in buffered:
+                        if over or not p.metadata_complete or not p.url or not p.title:
+                            continue
+                        chunk.append(p)
+                        if len(chunk) >= UPSERT_CHUNK_SIZE:
                             admitted, over = _admit_chunk(conn, company_id, ats, token, chunk)
                             new_jobs += admitted
-                        for question_index, (external_id, data) in enumerate(questions, 1):
-                            if over:
-                                break
-                            # Malformed feed entries were never admitted; retain the
-                            # old FK behavior by writing only existing shared Jobs.
-                            if conn.execute("SELECT 1 FROM jobs WHERE id=%s", (f"greenhouse:{token}:{external_id}",)).fetchone():
-                                db.insert_job_questions(conn, f"greenhouse:{token}:{external_id}", data, overwrite=False)
-                            if question_index % UPSERT_CHUNK_SIZE == 0:
-                                conn.commit()
-                        conn.commit()
+                            chunk = []
+                    if chunk:
+                        admitted, over = _admit_chunk(conn, company_id, ats, token, chunk)
+                        new_jobs += admitted
+                    conn.commit()
                 if over:
                     db.reopen_jobs(conn, company_id, seen)
                 open_ids = db.get_open_external_ids(conn, company_id)
                 if not seen and len(open_ids) > 20:
                     log.error(
                         "%s returned zero postings but has %d open jobs; skipping close-detection",
                         co["name"], len(open_ids),
                     )
                 else:
                     company_closed += db.close_jobs(
diff --git a/tests/test_db_jobs.py b/tests/test_db_jobs.py
index df68c27..267fd00 100644
--- a/tests/test_db_jobs.py
+++ b/tests/test_db_jobs.py
@@ -104,29 +104,29 @@ def test_resighting_clears_closed_at(conn):
         cur.execute("UPDATE jobs SET closed_at = now() WHERE id = 'lever:acme:1'")
     conn.commit()
 
     db.upsert_job(conn, cid, "lever", "acme", p)  # reopened
     with conn.cursor() as cur:
         cur.execute("SELECT closed_at FROM jobs WHERE id = 'lever:acme:1'")
         assert cur.fetchone()["closed_at"] is None
 
 
 @requires_db
-def test_upsert_stores_extracted_description(conn):
+def test_upsert_keeps_source_description_transient(conn):
     cid = _seed_company(conn)
     p = Posting(external_id="1", title="Eng", url="https://x",
                 raw={"descriptionPlain": "Hello JD"})
     db.upsert_job(conn, cid, "lever", "acme", p)
     conn.commit()
     with conn.cursor() as cur:
         cur.execute("SELECT description FROM jobs WHERE id='lever:acme:1'")
-        assert cur.fetchone()["description"] == "Hello JD"
+        assert cur.fetchone()["description"] is None
 
 
 @requires_db
 def test_resight_does_not_overwrite_pruned_description(conn):
     cid = _seed_company(conn)
     db.upsert_job(conn, cid, "lever", "acme",
                   Posting(external_id="1", title="Eng", url="https://x",
                           raw={"descriptionPlain": "Original"}))
     conn.commit()
     # Simulate the JD being pruned to NULL after a deny (A1 sets description_pruned=TRUE).
@@ -158,41 +158,41 @@ def test_minimal_posting_does_not_null_enriched_fields(conn):
     # Second upsert: same id but location=None (minimal posting).
     db.upsert_job(conn, cid, "lever", "acme",
                   Posting(external_id="1", title="Eng", url="https://x", location=None))
     conn.commit()
     with conn.cursor() as cur:
         cur.execute("SELECT location FROM jobs WHERE id='lever:acme:1'")
         assert cur.fetchone()["location"] == "NYC"
 
 
 @requires_db
-def test_description_refills_when_never_captured(conn):
+def test_description_stays_absent_when_never_captured(conn):
     """If description was never captured (NULL, description_pruned=FALSE), a re-poll
-    that provides a description must fill it in."""
+    that provides a description must leave it absent."""
     cid = _seed_company(conn)
     # First upsert: no description in raw.
     db.upsert_job(conn, cid, "lever", "acme",
                   Posting(external_id="1", title="Eng", url="https://x", raw={}))
     conn.commit()
     with conn.cursor() as cur:
         cur.execute("SELECT description, description_pruned FROM jobs WHERE id='lever:acme:1'")
         row = cur.fetchone()
         assert row["description"] is None
         assert row["description_pruned"] is False  # not pruned, just never captured
     # Second upsert: now has a description.
     db.upsert_job(conn, cid, "lever", "acme",
                   Posting(external_id="1", title="Eng", url="https://x",
                           raw={"descriptionPlain": "JD text"}))
     conn.commit()
     with conn.cursor() as cur:
         cur.execute("SELECT description FROM jobs WHERE id='lever:acme:1'")
-        assert cur.fetchone()["description"] == "JD text"
+        assert cur.fetchone()["description"] is None
 
 
 @requires_db
 def test_description_stays_null_when_pruned(conn):
     """If description_pruned=TRUE, a re-poll must NOT refill the description."""
     cid = _seed_company(conn)
     db.upsert_job(conn, cid, "lever", "acme",
                   Posting(external_id="1", title="Eng", url="https://x",
                           raw={"descriptionPlain": "Original JD"}))
     conn.commit()
diff --git a/tests/test_lifecycle_admission.py b/tests/test_lifecycle_admission.py
new file mode 100644
index 0000000..760500d
--- /dev/null
+++ b/tests/test_lifecycle_admission.py
@@ -0,0 +1,439 @@
+"""Ordinary lean-admission contracts on the owned throwaway database."""
+
+from uuid import uuid4
+
+import pytest
+
+from job_discovery.lifecycle import identity
+from job_discovery.lifecycle.capacity import reserve_capacity
+from job_discovery.lifecycle.claims import claim_work
+from job_discovery.models import Posting
+from tests.conftest import requires_db
+from tests.test_lifecycle_reconcile import setup_source
+
+
+def admit(conn, source, postings, claim=None):
+    claim = claim or claim_work(conn, "source", str(source["id"]), 180)
+    reservation = reserve_capacity(conn, claim, 65536 * max(1, len(postings)))
+    count = identity.admit_metadata(conn, source["id"], postings, claim, reservation)
+    conn.commit()
+    return count, claim
+
+
+@requires_db
+def test_stable_lean_admission_and_private_history(conn):
+    source = setup_source(conn)
+    before = conn.execute("SELECT * FROM source_listings").fetchone()
+    conn.execute(
+        "INSERT INTO application_packages(user_id,job_id) VALUES (%s,%s)",
+        (uuid4(), before["job_id"]),
+    )
+    private = conn.execute("SELECT * FROM application_packages").fetchall()
+    postings = [
+        Posting(
+            "0",
+            "Role",
+            "https://example.test/job",
+            raw={"descriptionPlain": "Public JD"},
+        ),
+        Posting(
+            "new",
+            "Role",
+            "https://example.test/new",
+            raw={"descriptionPlain": "Public JD"},
+        ),
+    ]
+    count, claim = admit(conn, source, postings)
+    assert count == 1
+    assert admit(conn, source, postings, claim)[0] == 0
+    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 2
+    assert all(
+        r["description"] is None for r in conn.execute("SELECT description FROM jobs")
+    )
+    after = conn.execute(
+        "SELECT * FROM source_listings WHERE id=%s", (before["id"],)
+    ).fetchone()
+    assert after["job_id"] == before["job_id"]
+    assert after["discovery_anchor_at"] == before["discovery_anchor_at"]
+    assert conn.execute("SELECT * FROM application_packages").fetchall() == private
+    assert (
+        conn.execute("SELECT count(*) n FROM identity_assertions").fetchone()["n"] == 0
+    )
+
+
+@requires_db
+def test_normalized_content_and_missing_payload_do_not_manufacture_versions(conn):
+    source = setup_source(conn)
+    _, claim = admit(
+        conn,
+        source,
+        [
+            Posting(
+                "0",
+                " Role  ",
+                "https://example.test/job",
+                raw={"descriptionPlain": "Hello   world"},
+            )
+        ],
+    )
+    for raw in [{"descriptionPlain": "Hello\nworld"}, {}]:
+        admit(
+            conn,
+            source,
+            [Posting("0", "Role", "https://example.test/job", raw=raw)],
+            claim,
+        )
+    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 1
+    admit(
+        conn,
+        source,
+        [
+            Posting(
+                "0",
+                "Role",
+                "https://example.test/job",
+                raw={"descriptionPlain": "Changed content"},
+            )
+        ],
+        claim,
+    )
+    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 2
+    assert (
+        conn.execute("SELECT description FROM jobs").fetchone()["description"] is None
+    )
+
+
+@requires_db
+def test_partial_display_is_availability_only(conn):
+    from job_discovery.adapters.completeness import (
+        SourceStatus,
+        iter_identified_postings,
+    )
+
+    source = setup_source(conn)
+    before = conn.execute("SELECT title,url FROM jobs").fetchone()
+    # A parser failure may still produce nonempty fallback display values.
+    status = SourceStatus()
+
+    def broken(_):
+        raise ValueError("bad optional display")
+
+    rows = iter_identified_postings(
+        [{"id": "0", "title": "Fallback", "url": "https://example.test/fallback"}],
+        broken,
+        status,
+        title_key="title",
+        url_keys=["url"],
+    )
+    posting = next(rows)
+    assert posting.metadata_complete is False
+    admit(conn, source, [posting])
+    assert conn.execute("SELECT title,url FROM jobs").fetchone() == before
+    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 0
+
+
+@requires_db
+def test_version_growth_pauses_without_discarding_unarchived_evidence(conn):
+    source = setup_source(conn)
+    claim = None
+    for i in range(12):
+        _, claim = admit(
+            conn, source, [Posting("0", f"Role {i}", "https://example.test/job")], claim
+        )
+    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 11
+    assert conn.execute("SELECT title FROM jobs").fetchone()["title"] == "Role 10"
+    assert (
+        conn.execute("SELECT current_revision FROM source_listings").fetchone()[
+            "current_revision"
+        ]
+        == 11
+    )
+
+
+@requires_db
+def test_chunk_limit_and_each_chunk_uses_reservation(conn):
+    source = setup_source(conn, count=0)
+    claim = claim_work(conn, "source", str(source["id"]), 180)
+    reservation = reserve_capacity(conn, claim, 1000000)
+    for count in (26, 501):
+        with pytest.raises(ValueError, match="500"):
+            identity.admit_metadata(
+                conn,
+                source["id"],
+                [
+                    Posting(str(i), "Role", "https://example.test/job")
+                    for i in range(count)
+                ],
+                claim,
+                reservation,
+            )
+    assert conn.execute("SELECT count(*) n FROM jobs").fetchone()["n"] == 0
+    for start in [0, 3]:
+        admit(
+            conn,
+            source,
+            [
+                Posting(str(i), "Same title", "https://example.test/job")
+                for i in range(start, start + 3)
+            ],
+            claim,
+        )
+    assert conn.execute("SELECT count(*) n FROM jobs").fetchone()["n"] == 6
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM capacity_reservations WHERE state='settled'"
+        ).fetchone()["n"]
+        >= 2
+    )
+
+
+@requires_db
+def test_actual_source_orchestration_admits_and_records_sightings(conn, monkeypatch):
+    from job_discovery.lifecycle.reconcile import verify_due_sources
+    from job_discovery.adapters import ADAPTERS
+    from job_discovery.adapters.completeness import SourceResult, SourceStatus
+
+    setup_source(conn, count=0)
+    monkeypatch.setitem(
+        ADAPTERS,
+        "lever",
+        lambda *a, **kw: SourceResult(
+            iter(
+                [
+                    Posting(
+                        "new",
+                        "Engineer",
+                        "https://example.test/job",
+                        raw={"descriptionPlain": "unused"},
+                    )
+                ]
+            ),
+            SourceStatus(),
+        ),
+    )
+    result = verify_due_sources(conn, max_boards=1)
+    assert result["new_jobs"] == 1
+    row = conn.execute("SELECT * FROM source_listings").fetchone()
+    assert (
+        row["successful_sighting_count"] == 1 and row["source_availability"] == "open"
+    )
+    assert (
+        conn.execute("SELECT description FROM jobs").fetchone()["description"] is None
+    )
+
+
+@requires_db
+def test_legacy_writer_is_lean_and_does_not_refill(conn):
+    from job_discovery.db import upsert_jobs
+
+    source = setup_source(conn)
+    posting = Posting(
+        "0", "Role", "https://example.test/job", raw={"descriptionPlain": "Unused body"}
+    )
+    upsert_jobs(conn, source["legacy_company_id"], "lever", "fixture", [posting])
+    assert (
+        conn.execute("SELECT description FROM jobs").fetchone()["description"] is None
+    )
+
+
+@requires_db
+def test_ordinary_enforced_admission_uses_existing_writer_contract(conn):
+    source = setup_source(conn, count=0)
+    # Fixture readiness only: no activation/security guarantees are evaluated.
+    conn.execute(
+        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
+    )
+    conn.execute("UPDATE lifecycle_control SET safety_stage='enforced'")
+    conn.execute(
+        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
+    )
+    conn.commit()
+    assert (
+        admit(conn, source, [Posting("new", "Role", "https://example.test/job")])[0]
+        == 1
+    )
+
+
+@requires_db
+def test_legacy_poll_does_not_fetch_questions_or_unused_details(conn, monkeypatch):
+    import os
+    from job_discovery import run as runner
+    from job_discovery.adapters import ADAPTERS
+
+    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
+    monkeypatch.setattr(
+        runner,
+        "load_targets",
+        lambda: [
+            {"name": "X", "ats": "greenhouse", "token": "g"},
+            {"name": "W", "ats": "workday", "token": "w"},
+        ],
+    )
+
+    def no_question(*a, **k):
+        raise AssertionError("routine question fetch forbidden")
+
+    monkeypatch.setattr(runner, "spool_questions", no_question)
+    monkeypatch.setitem(
+        ADAPTERS,
+        "greenhouse",
+        lambda token: [Posting("0", "Role", "https://example.test/job")],
+    )
+
+    def workday(token, *, fetch_details=True):
+        assert fetch_details is False
+        return [Posting("1", "Role", "https://example.test/job")]
+
+    monkeypatch.setitem(ADAPTERS, "workday", workday)
+    monkeypatch.setattr(runner, "_run_prune", lambda conn: None)
+    monkeypatch.setattr("reviewer.run.review_all", lambda conn: None)
+    monkeypatch.setattr(
+        "job_discovery.locations.resolve_new_locations", lambda conn: None
+    )
+    result = runner.run()
+    assert result["ok"] == 2 and result["new_jobs"] == 2
+    assert conn.execute("SELECT count(*) n FROM job_questions").fetchone()["n"] == 0
+
+
+@requires_db
+def test_old_unarchived_history_pauses_growth_and_preserves_populated_cache(conn):
+    source = setup_source(conn)
+    conn.execute(
+        "UPDATE jobs SET description='protected original',description_captured_at='2026-01-01Z'"
+    )
+    _, claim = admit(conn, source, [Posting("0", "First", "https://example.test/job")])
+    admit(conn, source, [Posting("0", "Second", "https://example.test/job")], claim)
+    conn.execute(
+        "UPDATE job_versions SET recorded_at=now()-interval '31 days' WHERE revision=1"
+    )
+    admit(
+        conn,
+        source,
+        [
+            Posting(
+                "0",
+                "Third",
+                "https://example.test/job",
+                raw={"descriptionPlain": "replacement"},
+            )
+        ],
+        claim,
+    )
+    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 2
+    assert conn.execute("SELECT title,description FROM jobs").fetchone() == {
+        "title": "Second",
+        "description": "protected original",
+    }
+
+
+@requires_db
+def test_new_ashby_listing_freezes_trustworthy_source_publication(conn):
+    from datetime import UTC, datetime
+
+    source = setup_source(conn, count=0, ats="ashby")
+    _, claim = admit(
+        conn,
+        source,
+        [
+            Posting(
+                "new",
+                "Role",
+                "https://example.test/job",
+                raw={"publishedAt": "2025-01-01T00:00:00Z"},
+            )
+        ],
+    )
+    listing = conn.execute("SELECT * FROM source_listings").fetchone()
+    assert listing["discovery_anchor_at"] == datetime(2025, 1, 1, tzinfo=UTC)
+    assert listing["discovery_anchor_provenance"] == "source_published"
+    admit(
+        conn,
+        source,
+        [
+            Posting(
+                "new",
+                "Role changed",
+                "https://example.test/job",
+                raw={"publishedAt": "2026-01-01T00:00:00Z"},
+            )
+        ],
+        claim,
+    )
+    assert (
+        conn.execute("SELECT discovery_anchor_at FROM source_listings").fetchone()[
+            "discovery_anchor_at"
+        ]
+        == listing["discovery_anchor_at"]
+    )
+    assert conn.execute("SELECT source_published_at FROM source_listings").fetchone()[
+        "source_published_at"
+    ] == datetime(2026, 1, 1, tzinfo=UTC)
+
+    admit(
+        conn,
+        source,
+        [
+            Posting(
+                "new",
+                "Role changed",
+                "https://example.test/job",
+                raw={"publishedAt": "2026-02-01T00:00:00Z"},
+            )
+        ],
+        claim,
+    )
+    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 2
+    row = conn.execute(
+        "SELECT source_published_at,discovery_anchor_at FROM source_listings"
+    ).fetchone()
+    assert row["source_published_at"] == datetime(2026, 2, 1, tzinfo=UTC)
+    assert row["discovery_anchor_at"] == listing["discovery_anchor_at"]
+
+
+@requires_db
+def test_enforced_source_orchestration_chunks_metadata_and_sightings(conn, monkeypatch):
+    from job_discovery.lifecycle.reconcile import verify_due_sources
+    from job_discovery.adapters import ADAPTERS
+    from job_discovery.adapters.completeness import SourceResult, SourceStatus
+
+    setup_source(conn, count=0)
+    conn.execute(
+        "INSERT INTO locations(raw,canonicals,components,source) VALUES('Remote','{Remote}','{}','rule')"
+    )
+    conn.execute(
+        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
+    )
+    conn.execute("UPDATE lifecycle_control SET safety_stage='enforced'")
+    conn.execute(
+        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
+    )
+    conn.commit()
+    monkeypatch.setitem(
+        ADAPTERS,
+        "lever",
+        lambda *a, **kw: SourceResult(
+            iter(
+                Posting(str(i), "Role", "https://example.test/job", location="Remote")
+                for i in range(70)
+            ),
+            SourceStatus(),
+        ),
+    )
+    result = verify_due_sources(conn, max_boards=1)
+    assert result["new_jobs"] == 70 and result["ok"] == 1
+    assert (
+        conn.execute(
+            "SELECT min(successful_sighting_count) n FROM source_listings"
+        ).fetchone()["n"]
+        == 1
+    )
+
+
+@requires_db
+def test_old_current_cannot_become_expired_unarchived_superseded_version(conn):
+    source = setup_source(conn)
+    _, claim = admit(conn, source, [Posting("0", "First", "https://example.test/job")])
+    conn.execute("UPDATE job_versions SET recorded_at=now()-interval '31 days'")
+    admit(conn, source, [Posting("0", "Changed", "https://example.test/job")], claim)
+    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 1
+    assert conn.execute("SELECT title FROM jobs").fetchone()["title"] == "First"
diff --git a/tests/test_lifecycle_identity.py b/tests/test_lifecycle_identity.py
index c69f770..5b41824 100644
--- a/tests/test_lifecycle_identity.py
+++ b/tests/test_lifecycle_identity.py
@@ -158,38 +158,29 @@ def test_same_id_legacy_upsert_does_not_reset_frozen_age(conn):
     identity().migrate_identity_batch(conn)
     before = conn.execute("SELECT * FROM source_listings").fetchone()
     assert not upsert_job(
         conn, cid, "lever", "x", Posting("0", "Changed", "https://example.test/new")
     )
     assert identity().migrate_identity_batch(conn) == 0
     assert conn.execute("SELECT * FROM source_listings").fetchone() == before
 
 
 @requires_db
-def test_capture_version_is_write_disabled_until_safety_and_outbox_exist(conn):
-    from job_discovery.lifecycle.types import ClaimRef
+def test_capture_version_requires_complete_typed_public_metadata(conn):
+    from job_discovery.lifecycle.claims import claim_work
 
     seed(conn)
     identity().migrate_identity_batch(conn)
     listing = conn.execute("SELECT id FROM source_listings").fetchone()["id"]
-    claim = ClaimRef("opaque", 1, datetime.now(UTC) + timedelta(seconds=180))
-    for metadata in [
-        {"title": "Engineer"},
-        {"title": "Engineer"},
-        {"title": "Changed"},
-    ]:
-        assert (
-            identity().capture_version(
-                conn, listing, metadata, datetime.now(UTC), claim
-            )
-            is None
-        )
+    claim = claim_work(conn, 'source', 'fixture', 180)
+    with pytest.raises(ValueError, match='title and public URL'):
+        identity().capture_version(conn, listing, {"title": "Engineer"}, datetime.now(UTC), claim)
     assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 0
 
 
 @requires_db
 def test_defaults_are_service_owned_and_gucs_do_not_enable_controls(conn):
     from job_discovery.lifecycle.config import read_control
 
     control = read_control(conn)
     assert control.safety_stage == "legacy"
     assert control.archive_stage == "never_activated"
diff --git a/tests/test_lifecycle_reconcile.py b/tests/test_lifecycle_reconcile.py
index fc716e3..4036ec3 100644
--- a/tests/test_lifecycle_reconcile.py
+++ b/tests/test_lifecycle_reconcile.py
@@ -285,20 +285,26 @@ def test_ashby_republication_and_unlisted_keep_frozen_age(conn,monkeypatch):
 
 
 @requires_db
 def test_interrupted_page_worker_restarts_fresh_and_keeps_committed_positives(conn,monkeypatch):
     import psycopg
     from psycopg.rows import dict_row
     from tests.conftest import TEST_DSN
     from job_discovery import http
     from job_discovery.lifecycle.types import ClaimRef
     setup_source(conn,100,'smartrecruiters')
+    # Exercise the intentional next-page worker interruption, independently of
+    # CPU time spent admitting new metadata. Budget exhaustion has separate tests.
+    # Only the public source scheduler clock is fixed; DB lease time is unchanged.
+    from job_discovery.adapters import completeness
+    monkeypatch.setattr(r,'monotonic',lambda:0.0)
+    monkeypatch.setattr(completeness,'monotonic',lambda:0.0)
     calls=[]
     def interrupted(url,**kw):
         calls.append(url)
         if len(calls)>1:
             raise KeyboardInterrupt('ordinary simulated worker interruption')
         return {'content':[{'id':str(i),'name':'Role'} for i in range(100)],'totalFound':101}
     monkeypatch.setattr(http,'get_json',interrupted)
     with pytest.raises(KeyboardInterrupt):
         r.verify_due_sources(conn,max_boards=1)
     conn.rollback()
@@ -519,21 +525,23 @@ def test_fix1_entrypoint_resumes_complete_membership_tail_after_worker_restart(c
         if saved is None:
             saved=identity
         assert identity==saved
         progress.append(conn.execute('SELECT sum(consecutive_complete_misses) n FROM source_listings').fetchone()['n'])
         conn.commit()
         if enum['reconciled_at']:
             break
     assert progress==([100,200,205] if interruption=='deadline' else [0,100,200,205])
     assert len(calls)==1
     assert conn.execute('SELECT enumeration_sequence FROM source_accounts').fetchone()['enumeration_sequence']==1
-    assert conn.execute('SELECT min(consecutive_complete_misses) n FROM source_listings').fetchone()['n']==1
+    # Task7 admits the actually observed 'extra' identity; it has no miss.
+    assert conn.execute("SELECT min(consecutive_complete_misses) n FROM source_listings WHERE external_id<>'extra'").fetchone()['n']==1
+    assert conn.execute("SELECT consecutive_complete_misses FROM source_listings WHERE external_id='extra'").fetchone()['consecutive_complete_misses']==0
 
 
 @requires_db
 @pytest.mark.parametrize('defect',['missing_title','duplicate','missing_id'])
 def test_fix1_workable_mixed_response_retains_good_positive(conn,monkeypatch,defect):
     from job_discovery import http
     setup_source(conn,3,'workable')
     conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
     conn.commit()
     good={'shortcode':'0','title':'Role'}
diff --git a/tests/test_lifecycle_relations.py b/tests/test_lifecycle_relations.py
new file mode 100644
index 0000000..f3d8f4b
--- /dev/null
+++ b/tests/test_lifecycle_relations.py
@@ -0,0 +1,83 @@
+"""Typed public relationships never rewrite private Job anchors."""
+
+import pytest
+from job_discovery.lifecycle import identity
+from job_discovery.models import Posting
+from tests.conftest import requires_db
+from tests.test_lifecycle_admission import admit
+from tests.test_lifecycle_reconcile import setup_source
+
+
+@requires_db
+def test_typed_location_has_unknown_validity_and_no_invented_skills(conn):
+    source = setup_source(conn)
+    conn.execute(
+        "INSERT INTO locations(raw,canonicals,components,source) VALUES('Remote','{Remote}','{}','rule')"
+    )
+    admit(
+        conn,
+        source,
+        [
+            Posting(
+                "0",
+                "Role",
+                "https://example.test/job",
+                location="Remote",
+                raw={"descriptionPlain": "Python expert"},
+            )
+        ],
+    )
+    edge = conn.execute("SELECT * FROM job_locations").fetchone()
+    assert edge["evidence_kind"] == "structured_source"
+    assert edge["public_evidence_ref"] == "https://example.test/job"
+    assert edge["valid_from"] is None and edge["valid_to"] is None
+    assert edge["confidence"] is None
+    assert conn.execute("SELECT count(*) n FROM skills").fetchone()["n"] == 0
+
+
+@requires_db
+def test_identity_assertions_require_review_and_reject_conflicts_cycles(conn):
+    source = setup_source(conn, count=3)
+    _, claim = admit(conn, source, [])
+    ids = [
+        r["id"]
+        for r in conn.execute("SELECT id FROM source_listings ORDER BY external_id")
+    ]
+    now = conn.execute("SELECT clock_timestamp() t").fetchone()["t"]
+
+    def assertion(left, right, **extra):
+        return dict(
+            left_listing_id=left,
+            right_listing_id=right,
+            relation="same_job",
+            evidence_kind="reviewed_public",
+            public_evidence_ref="https://example.test/evidence",
+            status="accepted",
+            reviewed_at=now,
+            **extra,
+        )
+
+    a = assertion(ids[0], ids[1])
+    first = identity.set_identity_assertion(conn, a, claim)
+    assert identity.set_identity_assertion(conn, a, claim) == first
+    for bad in [
+        assertion(ids[0], ids[0]),
+        assertion(ids[0], ids[2]),
+        assertion(ids[1], ids[0]),
+        dict(a, evidence_kind="structured_source"),
+        dict(a, private_notes="secret"),
+    ]:
+        with pytest.raises(ValueError), conn.transaction():
+            identity.set_identity_assertion(conn, bad, claim)
+    identity.set_identity_assertion(
+        conn,
+        dict(assertion(ids[1], ids[2]), status="proposed", reviewed_at=None),
+        claim,
+    )
+    assert conn.execute("SELECT count(*) n FROM jobs").fetchone()["n"] == 3
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM identity_assertions WHERE status='accepted'"
+        ).fetchone()["n"]
+        == 1
+    )
