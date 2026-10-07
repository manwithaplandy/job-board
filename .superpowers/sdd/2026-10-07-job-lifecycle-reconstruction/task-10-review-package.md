# Full pinned review package

BASE: 6075983bd63dced95ec94dc61b9b112a79f4564d

HEAD: e3f889421fa1ad30206e128cb292b101bc3a58e0

## Commits

e3f889421fa1ad30206e128cb292b101bc3a58e0 docs: record Task 10 ordinary verification and operational limits
293e413dc452a4e9b230dcef87e23d11fa2798ed feat: record bounded public events with exact batch acknowledgement


## Files

 .../task-10-evidence/affected-attempt17.txt        |   4 +
 .../task-10-evidence/commands.md                   |  35 ++
 .../task-10-evidence/final-attempt17.txt           |   4 +
 .../task-10-evidence/final-batches16.txt           |   3 +
 .../task-10-evidence/final-batches17.txt           |   3 +
 .../task-10-evidence/final-operational16.txt       |   4 +
 .../task-10-evidence/final-operational17.txt       |   4 +
 .../task-10-evidence/final-pinned16.txt            |   4 +
 .../task-10-evidence/final-pinned17.txt            |   4 +
 .../task-10-evidence/final16.txt                   |   4 +
 .../task-10-evidence/final17.txt                   |   4 +
 .../task-10-evidence/green-attempt17.txt           | 268 ++++++++
 .../task-10-evidence/green-attempt2-17.txt         |   3 +
 .../task-10-evidence/lint-attempt.txt              |  14 +
 .../task-10-evidence/lint-final.txt                |   1 +
 .../task-10-evidence/operational-attempt17.txt     | 693 +++++++++++++++++++++
 .../task-10-evidence/operational-attempt2-17.txt   |   4 +
 .../task-10-evidence/red.txt                       |  38 ++
 .../task-10-evidence/source-files.sha256           |  18 +
 .../task-10-evidence/test-inventory.md             |  21 +
 .../task-10-evidence/versions.txt                  |   6 +
 .../task-10-report.md                              |  87 +++
 job_discovery/archive/__init__.py                  |   1 +
 job_discovery/archive/batches.py                   | 417 +++++++++++++
 job_discovery/archive/codec.py                     |  37 ++
 job_discovery/archive/outbox.py                    | 188 ++++++
 job_discovery/archive/schema.py                    | 259 ++++++++
 job_discovery/archive/types.py                     | 110 ++++
 job_discovery/lifecycle/identity.py                |   8 +-
 job_discovery/lifecycle/maintenance.py             |   5 +-
 job_discovery/lifecycle/operational.py             | 424 +++++++++++++
 job_discovery/lifecycle/reconcile.py               |  38 +-
 migrations/2026-10-03-04-public-outbox.sql         | 622 ++++++++++++++++++
 pyproject.toml                                     |   2 +-
 schema.sql                                         | 623 ++++++++++++++++++
 tests/archive_helpers.py                           |  29 +
 tests/test_archive_batches.py                      | 242 +++++++
 tests/test_archive_codec.py                        |  84 +++
 tests/test_archive_outbox.py                       | 249 ++++++++
 tests/test_lifecycle_operational.py                | 294 +++++++++
 40 files changed, 4822 insertions(+), 36 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/affected-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/affected-attempt17.txt
new file mode 100644
index 0000000..b59d87a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/affected-attempt17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..................ordinary operational resource evidence {"after": {"allocated": 34789043, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 34789043, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+............
+30 passed in 24.85s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/commands.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/commands.md
new file mode 100644
index 0000000..777ed21
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/commands.md
@@ -0,0 +1,35 @@
+# Exact verification commands and chronology
+
+All shell invocations: `/bin/bash`, `login:false`. Working directory: `/workspace/job-board/.claude/worktrees/lifecycle-recovery`. Every database run used `tools/lifecycle_test_db.py` with its owned, random loopback PostgreSQL container and sanitized child environment; no existing-service/shared 55432 option.
+
+Initial RED:
+```
+.venv/bin/python -m pytest tests/test_archive_codec.py tests/test_archive_outbox.py tests/test_archive_batches.py -q
+```
+Actual output: `red.txt`, three collection errors for missing archive modules. No DB tests executed in this RED collection.
+
+Final complete affected selection, run once for each MAJOR=17 and16:
+```
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_archive_codec.py tests/test_archive_outbox.py tests/test_archive_batches.py tests/test_lifecycle_operational.py tests/test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings tests/test_lifecycle_reconcile.py::test_two_distinct_complete_misses_exact_24h_and_replay tests/test_lifecycle_reconcile.py::test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset tests/test_lifecycle_reconcile.py::test_empty_threshold tests/test_lifecycle_relations.py -q -s
+```
+Actual outputs: `final-pinned17.txt`, `final-pinned16.txt`:36passed each, no skips/deselections. Previous intermediate run outputs are retained under descriptive attempt/final names; latest pinned runs supersede them.
+
+Subsequent UTC-midnight scheduler alignment changed only operational.py and its existing assertion; rerun the affected file only on both majors:
+```
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_lifecycle_operational.py -q -s
+```
+Actual outputs: `final-operational17.txt`, `final-operational16.txt`:7passed each, no skips/deselections.
+
+Subsequent committed-membership correction excluded the selector's own uncommitted ordinary/critical events; added one batch test and reran the affected file only on both majors:
+```
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major MAJOR -- .venv/bin/python -m pytest tests/test_archive_batches.py -q
+```
+Actual outputs: `final-batches17.txt`, `final-batches16.txt`. Identity.py's last change only updates two stale explanatory comments about the now-implemented outbox and exact version retention.
+
+Lint:
+```
+.venv/bin/ruff check job_discovery/archive job_discovery/lifecycle/operational.py tests/test_archive_codec.py tests/test_archive_outbox.py tests/test_archive_batches.py tests/test_lifecycle_operational.py tests/archive_helpers.py
+```
+`lint-final.txt`: All checks passed. `git diff --check` completed with no output.
+
+`versions.txt` records Python, psycopg, pytest, ruff and locally cached Docker image IDs/repository digests. Harness outputs record actual server versions. No network pulls, provider/model calls or production actions were performed.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-attempt17.txt
new file mode 100644
index 0000000..abfaa94
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-attempt17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+......................ordinary operational resource evidence {"after": {"allocated": 37926579, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 37926579, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+..............
+36 passed in 26.01s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-batches16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-batches16.txt
new file mode 100644
index 0000000..4c8857d
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-batches16.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+.........                                                                [100%]
+9 passed in 7.37s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-batches17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-batches17.txt
new file mode 100644
index 0000000..e723ac1
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-batches17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+.........                                                                [100%]
+9 passed in 5.93s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-operational16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-operational16.txt
new file mode 100644
index 0000000..bb6d21a
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-operational16.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+ordinary operational resource evidence {"after": {"allocated": 12295191, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 12295191, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+.......
+7 passed in 6.18s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-operational17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-operational17.txt
new file mode 100644
index 0000000..ef56852
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-operational17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+ordinary operational resource evidence {"after": {"allocated": 12236467, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 12236467, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+.......
+7 passed in 4.90s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-pinned16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-pinned16.txt
new file mode 100644
index 0000000..9d94278
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-pinned16.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+......................ordinary operational resource evidence {"after": {"allocated": 38362135, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 38362135, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+..............
+36 passed in 35.55s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-pinned17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-pinned17.txt
new file mode 100644
index 0000000..11ee2a7
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final-pinned17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+......................ordinary operational resource evidence {"after": {"allocated": 37926579, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 37926579, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+..............
+36 passed in 28.30s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final16.txt
new file mode 100644
index 0000000..56e2626
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final16.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+......................ordinary operational resource evidence {"after": {"allocated": 38419479, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 38419479, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+..............
+36 passed in 37.22s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final17.txt
new file mode 100644
index 0000000..c4918a6
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/final17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+......................ordinary operational resource evidence {"after": {"allocated": 37992115, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 37992115, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+..............
+36 passed in 31.30s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/green-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/green-attempt17.txt
new file mode 100644
index 0000000..1209794
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/green-attempt17.txt
@@ -0,0 +1,268 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+....F..FF.F.F.F                                                          [100%]
+=================================== FAILURES ===================================
+_________ test_direct_mutation_requires_pair_and_revision_predecessor __________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff74436fdd0>
+
+    @requires_db
+    def test_direct_mutation_requires_pair_and_revision_predecessor(conn):
+        from tests.archive_helpers import seeded_events
+        from job_discovery.archive.schema import event_id
+        claim,refs=seeded_events(conn,1)
+>       with pytest.raises(Exception,match='requires exact transactional'), conn.transaction():
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       AssertionError: Regex pattern did not match.
+E         Expected regex: 'requires exact transactional'
+E         Actual message: 'record "old" has no field "content_hash"\nCONTEXT:  SQL expression "TG_TABLE_NAME=\'job_versions\' AND TG_OP=\'DELETE\' AND EXISTS(\n  SELECT FROM public.public_archive_version_coverage c WHERE c.version_id=OLD.id AND c.content_hash=OLD.content_hash\n   AND c.source_listing_id=OLD.source_listing_id AND c.version_revision=OLD.revision)"\nPL/pgSQL function lifecycle_private.require_public_change() line 10 at IF'
+
+tests/test_archive_outbox.py:34: AssertionError
+______________ test_pending_events_have_no_ttl_or_cascade_cleanup ______________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff7443b7d10>
+
+    @requires_db
+    def test_pending_events_have_no_ttl_or_cascade_cleanup(conn):
+        from tests.archive_helpers import seeded_events
+        seeded_events(conn)
+>       with pytest.raises(Exception,match='immutable pending'),conn.transaction():
+             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+E       AssertionError: Regex pattern did not match.
+E         Expected regex: 'immutable pending'
+E         Actual message: 'record "old" has no field "id"\nCONTEXT:  SQL expression "TG_TABLE_NAME=\'public_change_requirements\' AND NOT EXISTS(SELECT FROM public.public_outbox WHERE requirement_id=OLD.id)\n   AND EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id)\n     WHERE c.aggregate_type=OLD.aggregate_type AND c.aggregate_id=OLD.aggregate_id AND c.revision=OLD.revision)"\nPL/pgSQL function lifecycle_private.preserve_archive_row() line 16 at IF'
+
+tests/test_archive_outbox.py:79: AssertionError
+__________ test_identity_and_reconcile_mutators_pair_transactionally ___________
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff7443b6720>
+
+    @requires_db
+    def test_identity_and_reconcile_mutators_pair_transactionally(conn):
+        from tests.test_lifecycle_reconcile import setup_source
+        from tests.archive_helpers import activate_fixture
+        from tests.test_lifecycle_admission import admit
+        from job_discovery.models import Posting
+        from job_discovery.lifecycle import reconcile
+        from job_discovery.lifecycle.types import Observation
+        source=setup_source(conn)
+        conn.commit()
+        activate_fixture(conn)
+>       _,claim=admit(conn,source,[Posting('0','Updated','https://example.test/job',raw={'descriptionPlain':'Public content'})])
+                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_archive_outbox.py:95: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+tests/test_lifecycle_admission.py:18: in admit
+    count = identity.admit_metadata(conn, source["id"], postings, claim, reservation)
+            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+job_discovery/lifecycle/identity.py:466: in admit_metadata
+    row = conn.execute(
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff7443b6720>
+query = 'INSERT INTO jobs(id,company_id,external_id,title,url,location,department,remote)\n                VALUES(%s,%s,%s,%s,...itle,EXCLUDED.url,EXCLUDED.location,EXCLUDED.department,EXCLUDED.remote)\n                RETURNING (xmax=0) AS is_new'
+params = ('lever:fixture:0', 1, '0', 'Updated', 'https://example.test/job', None, ...)
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
+E           psycopg.errors.UndefinedFunction: operator does not exist: uuid = text
+E           LINE 2: ...blic_archive_version_coverage c WHERE c.version_id=OLD.id AN...
+E                                                                        ^
+E           HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.
+E           QUERY:  TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
+E             SELECT FROM public.public_archive_version_coverage c WHERE c.version_id=OLD.id AND c.content_hash=OLD.content_hash
+E              AND c.source_listing_id=OLD.source_listing_id AND c.version_revision=OLD.revision)
+E           CONTEXT:  PL/pgSQL function lifecycle_private.require_public_change() line 10 at IF
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedFunction
+_______________ test_persisted_exact_partial_membership_and_ack ________________
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff744366ed0>
+
+    @requires_db
+    def test_persisted_exact_partial_membership_and_ack(conn):
+        claim,refs=seeded_events(conn)
+        batch=claim_batch(conn,BatchLimits(max_events=2),claim)
+        conn.commit()
+        seal=seal_batch(batch,1)
+        assert seal==seal_batch(batch,1)
+        persist_seal(conn,seal)
+        conn.commit()
+>       result=ack_batch(conn,verified(seal),claim)
+               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+
+tests/test_archive_batches.py:34: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+job_discovery/archive/batches.py:165: in ack_batch
+    tx.execute('DELETE FROM public_change_requirements WHERE id=ANY(%s)',([r['requirement_id'] for r in reqs],))
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff744366ed0>
+query = 'DELETE FROM public_change_requirements WHERE id=ANY(%s)'
+params = ([1, 2],), prepare = None, binary = False
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
+E           psycopg.errors.UndefinedColumn: record "old" has no field "event_id"
+E           CONTEXT:  SQL expression "TG_TABLE_NAME='public_outbox' AND EXISTS(SELECT FROM public.public_archive_coverage c
+E               JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id)"
+E           PL/pgSQL function lifecycle_private.preserve_archive_row() line 14 at IF
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedColumn
+_____________ test_ack_rollback_retains_every_exact_pending_event ______________
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff7443688f0>
+
+    @requires_db
+    def test_ack_rollback_retains_every_exact_pending_event(conn):
+        claim,refs=seeded_events(conn)
+        batch=claim_batch(conn,BatchLimits(),claim)
+        conn.commit()
+        seal=seal_batch(batch)
+        persist_seal(conn,seal)
+        conn.commit()
+        with pytest.raises(RuntimeError),conn.transaction():
+>           ack_batch(conn,verified(seal),claim)
+
+tests/test_archive_batches.py:65: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+job_discovery/archive/batches.py:165: in ack_batch
+    tx.execute('DELETE FROM public_change_requirements WHERE id=ANY(%s)',([r['requirement_id'] for r in reqs],))
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Connection [IDLE] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff7443688f0>
+query = 'DELETE FROM public_change_requirements WHERE id=ANY(%s)'
+params = ([1, 2, 3],), prepare = None, binary = False
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
+E           psycopg.errors.UndefinedColumn: record "old" has no field "event_id"
+E           CONTEXT:  SQL expression "TG_TABLE_NAME='public_outbox' AND EXISTS(SELECT FROM public.public_archive_coverage c
+E               JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id)"
+E           PL/pgSQL function lifecycle_private.preserve_archive_row() line 14 at IF
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedColumn
+______________ test_per_aggregate_ordering_survives_small_batches ______________
+
+conn = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff7443b6c90>
+
+    @requires_db
+    def test_per_aggregate_ordering_survives_small_batches(conn):
+        from job_discovery.archive.outbox import flush_public_changes
+        claim,_=seeded_events(conn,1)
+        for i in range(2):
+>           conn.execute('UPDATE brands SET name=%s',(f'Changed {i}',))
+
+tests/test_archive_batches.py:94: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Connection [INERROR] (host=127.0.0.1 port=33055 user=postgres database=poller_lifecycle_test) at 0x7ff7443b6c90>
+query = 'UPDATE brands SET name=%s', params = ('Changed 0',), prepare = None
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
+E           psycopg.errors.UndefinedColumn: record "old" has no field "content_hash"
+E           CONTEXT:  SQL expression "TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
+E             SELECT FROM public.public_archive_version_coverage c WHERE c.version_id=OLD.id AND c.content_hash=OLD.content_hash
+E              AND c.source_listing_id=OLD.source_listing_id AND c.version_revision=OLD.revision)"
+E           PL/pgSQL function lifecycle_private.require_public_change() line 10 at IF
+
+.venv/lib/python3.12/site-packages/psycopg/connection.py:304: UndefinedColumn
+=========================== short test summary info ============================
+FAILED tests/test_archive_outbox.py::test_direct_mutation_requires_pair_and_revision_predecessor
+FAILED tests/test_archive_outbox.py::test_pending_events_have_no_ttl_or_cascade_cleanup
+FAILED tests/test_archive_outbox.py::test_identity_and_reconcile_mutators_pair_transactionally
+FAILED tests/test_archive_batches.py::test_persisted_exact_partial_membership_and_ack
+FAILED tests/test_archive_batches.py::test_ack_rollback_retains_every_exact_pending_event
+FAILED tests/test_archive_batches.py::test_per_aggregate_ordering_survives_small_batches
+6 failed, 9 passed in 4.99s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/green-attempt2-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/green-attempt2-17.txt
new file mode 100644
index 0000000..b0d8362
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/green-attempt2-17.txt
@@ -0,0 +1,3 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+...............                                                          [100%]
+15 passed in 7.43s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/lint-attempt.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/lint-attempt.txt
new file mode 100644
index 0000000..2c2fffe
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/lint-attempt.txt
@@ -0,0 +1,14 @@
+F841 Local variable `source` is assigned to but never used
+  --> tests/test_archive_outbox.py:49:5
+   |
+47 |     from tests.test_lifecycle_reconcile import setup_source
+48 |     from tests.archive_helpers import activate_fixture
+49 |     source=setup_source(conn)
+   |     ^^^^^^
+50 |     conn.commit()
+51 |     activate_fixture(conn)
+   |
+help: Remove assignment to unused variable `source`
+
+Found 8 errors (7 fixed, 1 remaining).
+No fixes available (1 hidden fix can be enabled with the `--unsafe-fixes` option).
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/lint-final.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/lint-final.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/lint-final.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/operational-attempt17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/operational-attempt17.txt
new file mode 100644
index 0000000..c163f9e
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/operational-attempt17.txt
@@ -0,0 +1,693 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+..EEEE.EE.EEEEEEEEEE
+==================================== ERRORS ====================================
+__________ ERROR at setup of test_flag_off_legacy_write_has_no_event ___________
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82090>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+________ ERROR at setup of test_bounded_current_baseline_pairs_rollback ________
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82750>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+_ ERROR at setup of test_direct_mutation_requires_pair_and_revision_predecessor _
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82a50>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+_____ ERROR at setup of test_unchanged_poll_and_private_cache_do_not_emit ______
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b831d0>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+_____ ERROR at setup of test_pending_events_have_no_ttl_or_cascade_cleanup _____
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82f90>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+_ ERROR at setup of test_identity_and_reconcile_mutators_pair_transactionally __
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82690>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+______ ERROR at setup of test_persisted_exact_partial_membership_and_ack _______
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82990>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+________ ERROR at setup of test_seal_membership_and_clock_are_immutable ________
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b83590>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+____ ERROR at setup of test_ack_rollback_retains_every_exact_pending_event _____
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b83a10>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+_ ERROR at setup of test_exact_receipts_and_suppressed_membership_fail_closed __
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201760110>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+_____ ERROR at setup of test_per_aggregate_ordering_survives_small_batches _____
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b837d0>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+_ ERROR at setup of test_preallocated_health_membership_and_two_complete_misses _
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82c90>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+_ ERROR at setup of test_partial_positive_survives_restart_and_never_certifies_absence _
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82990>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+___ ERROR at setup of test_complete_checkpoint_resumes_with_fresh_connection ___
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b82d50>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+________ ERROR at setup of test_active_archive_critical_slots_exact_ack ________
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201b83110>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+________ ERROR at setup of test_missing_preallocation_reports_deferred _________
+
+    @pytest.fixture
+    def conn():
+        assert TEST_DSN, "TEST_DATABASE_URL required"
+        validate_test_dsn(TEST_DSN)
+        connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
+        try:
+            with connection.cursor() as cur:
+                cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
+>               cur.execute(SCHEMA_SQL)
+
+tests/conftest.py:119: 
+_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ 
+
+self = <psycopg.Cursor [closed] [BAD] at 0x7f2201760950>
+query = 'CREATE TABLE companies (\n  id      SERIAL PRIMARY KEY,\n  name    TEXT NOT NULL,\n  ats     TEXT NOT NULL CHECK (ats...TE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();\n'
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
+E           psycopg.errors.SyntaxError: syntax error at end of input
+E           LINE 2805:  IF usage_count+1>CASE WHEN critical THEN 100000 ELSE 87500 ...
+E                                                          ^
+
+.venv/lib/python3.12/site-packages/psycopg/cursor.py:117: SyntaxError
+=========================== short test summary info ============================
+ERROR tests/test_archive_outbox.py::test_flag_off_legacy_write_has_no_event
+ERROR tests/test_archive_outbox.py::test_bounded_current_baseline_pairs_rollback
+ERROR tests/test_archive_outbox.py::test_direct_mutation_requires_pair_and_revision_predecessor
+ERROR tests/test_archive_outbox.py::test_unchanged_poll_and_private_cache_do_not_emit
+ERROR tests/test_archive_outbox.py::test_pending_events_have_no_ttl_or_cascade_cleanup
+ERROR tests/test_archive_outbox.py::test_identity_and_reconcile_mutators_pair_transactionally
+ERROR tests/test_archive_batches.py::test_persisted_exact_partial_membership_and_ack
+ERROR tests/test_archive_batches.py::test_seal_membership_and_clock_are_immutable
+ERROR tests/test_archive_batches.py::test_ack_rollback_retains_every_exact_pending_event
+ERROR tests/test_archive_batches.py::test_exact_receipts_and_suppressed_membership_fail_closed
+ERROR tests/test_archive_batches.py::test_per_aggregate_ordering_survives_small_batches
+ERROR tests/test_lifecycle_operational.py::test_preallocated_health_membership_and_two_complete_misses
+ERROR tests/test_lifecycle_operational.py::test_partial_positive_survives_restart_and_never_certifies_absence
+ERROR tests/test_lifecycle_operational.py::test_complete_checkpoint_resumes_with_fresh_connection
+ERROR tests/test_lifecycle_operational.py::test_active_archive_critical_slots_exact_ack
+ERROR tests/test_lifecycle_operational.py::test_missing_preallocation_reports_deferred
+4 passed, 16 errors in 7.37s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/operational-attempt2-17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/operational-attempt2-17.txt
new file mode 100644
index 0000000..ef5b0df
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/operational-attempt2-17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+...............ordinary operational resource evidence {"after": {"allocated": 29890227, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "before": {"allocated": 29890227, "index_bytes": 1605632, "table_toast_bytes": 1097728}, "delta": {"allocated": 0, "index_bytes": 0, "table_toast_bytes": 0}}
+.....
+20 passed in 12.69s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/red.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/red.txt
new file mode 100644
index 0000000..7b2a419
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/red.txt
@@ -0,0 +1,38 @@
+
+==================================== ERRORS ====================================
+_________________ ERROR collecting tests/test_archive_codec.py _________________
+ImportError while importing test module '/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_archive_codec.py'.
+Hint: make sure your test modules/packages have valid Python names.
+Traceback:
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+tests/test_archive_codec.py:6: in <module>
+    from job_discovery.archive.schema import PublicChange, AggregateType, ChangeKind, validate_change
+E   ModuleNotFoundError: No module named 'job_discovery.archive.schema'
+________________ ERROR collecting tests/test_archive_outbox.py _________________
+ImportError while importing test module '/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_archive_outbox.py'.
+Hint: make sure your test modules/packages have valid Python names.
+Traceback:
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+tests/test_archive_outbox.py:3: in <module>
+    from job_discovery.archive import outbox
+E   ImportError: cannot import name 'outbox' from 'job_discovery.archive' (unknown location)
+________________ ERROR collecting tests/test_archive_batches.py ________________
+ImportError while importing test module '/workspace/job-board/.claude/worktrees/lifecycle-recovery/tests/test_archive_batches.py'.
+Hint: make sure your test modules/packages have valid Python names.
+Traceback:
+/opt/codex/runtimes/codex-primary-runtime/dependencies/python/lib/python3.12/importlib/__init__.py:90: in import_module
+    return _bootstrap._gcd_import(name[level:], package, level)
+           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
+tests/test_archive_batches.py:2: in <module>
+    from job_discovery.archive.batches import claim_batch, seal_batch, persist_seal, ack_batch
+E   ModuleNotFoundError: No module named 'job_discovery.archive.batches'
+=========================== short test summary info ============================
+ERROR tests/test_archive_codec.py
+ERROR tests/test_archive_outbox.py
+ERROR tests/test_archive_batches.py
+!!!!!!!!!!!!!!!!!!! Interrupted: 3 errors during collection !!!!!!!!!!!!!!!!!!!!
+3 errors in 0.23s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/source-files.sha256 b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/source-files.sha256
new file mode 100644
index 0000000..47bd93d
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/source-files.sha256
@@ -0,0 +1,18 @@
+a0e169d541fe1c7732c2f7c13544d0f23e369664191b2ec2ff83f6a5f1f2872f job_discovery/archive/__init__.py
+10be82ea8393812bf0048f216d5a2329dd249c2d16ac073bf69a4fa69926e294 job_discovery/archive/batches.py
+4c9075ec074c2b8896a8c575ee61f4cf1401bfb0e0335dc9e69ad0218403230b job_discovery/archive/codec.py
+1ec0a902d53330f3241e32273408692713df40128c8d6fb03f145fae57f8dfe7 job_discovery/archive/outbox.py
+a8bfb5903bc6df65981af50bf8275d114a66584ec5efd682aa594fa4c99d5d64 job_discovery/archive/schema.py
+259210b47e6b0e2d00f1f0ca807e8842f3933b68db49e6e9021c5af1ed007f43 job_discovery/archive/types.py
+387ad730da43e5f4d6b55de3d1edb9b37f671b3c3e3fb265000a76514fbedc6b job_discovery/lifecycle/identity.py
+2b4c0cd3a6633bfd7e9c421c5bfca8f33618e7582ce9ee44a06503a49b5f1b25 job_discovery/lifecycle/maintenance.py
+1f4cc35e7b7ed814c12a099af906028e79a79014ddfb07f28544f4aae24928c6 job_discovery/lifecycle/operational.py
+24a76d559bcdbc69b0c54346a545e81e700712c5e5ea6e60c4ca237ff41db24d job_discovery/lifecycle/reconcile.py
+b31aa721636069d8095a378324c80efd6a1cd398a397cd72637c34f6979ce22b migrations/2026-10-03-04-public-outbox.sql
+2ccf9a6310b2320109ed6f712647ee34e83eadf905bfd5a12540482dc2656d54 pyproject.toml
+702c4d465c7205de26c82c3974ca55abbbdc0673fa6ae64e54d9ada06cc57be4 schema.sql
+6282ea5b8e8a3da8afb4eb75a9478a1d8324dd65bb3661dce33b25eb15454e5a tests/archive_helpers.py
+b7cc5c581f7c96822036866d91de612eb5d8a0179a1751e5138adcfb32c19dba tests/test_archive_batches.py
+a03a9326e9d3231df37a7a94e94cd8c9bcc7c438785205a3bf50e901ad569913 tests/test_archive_codec.py
+18f14ead314c3ec014b4bb811c47e88868d8654f91693006705973f4d38cff60 tests/test_archive_outbox.py
+990a7fb2451f192302faff3cb186dca605869e0e3df374bb172c38820935e414 tests/test_lifecycle_operational.py
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/test-inventory.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/test-inventory.md
new file mode 100644
index 0000000..1c6c210
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/test-inventory.md
@@ -0,0 +1,21 @@
+# Explicit affected test contents inventory before database runs
+
+Only tests/test_archive_codec.py, tests/test_archive_outbox.py, tests/test_archive_batches.py are selected initially. New ordinary contracts: UTF8 canonical JSONL, reproducible gzip, total public schema, exact endpoint ID; flags-off legacy brands write; baseline rollback; paired brand update/predecessor and ordinary missing-pair commit failure; unchanged polling/private cache timestamps; pure numeric outbox budget thresholds (no physical/capacity fixture probes); pending retention; metadata admission+closure event integration; exact partial batch acknowledgement; immutable seal/membership; ack transaction rollback; offline receipt/suppression matching; contiguous per-aggregate batching. All DB fixtures are owned random-loopback harness databases. Isolated control state fixture permits ordinary producer behavior only and supplies no activation/readiness/security assurance.
+
+No tests/test_lifecycle_safety.py, test_lifecycle_activation.py, test_lifecycle_review_security.py, cross-user/expiry/capacity/adversarial suites selected. No broad tests/ invocation. Initial RED selected these three new files and failed collection on missing archive modules (3 errors). No database tests executed in that RED collection.
+
+Added tests/test_lifecycle_operational.py before execution: provisioned existing-source health/exact known membership/two successful misses at >=24h; new ID not admitted; PostgreSQL allocated/table+toast/index deltas printed; partial positive commit survives fresh DB connection without absence; complete checkpoint resumes via fresh connection; active archive closure consumes fixed critical exact events subsequently exact-acked; missing preallocation returns deferred. Uses real owned DB with ordinary physical size; does NOT simulate/exceed physical guard or rerun existing capacity/expiry/isolation/adversarial probes. Fixture completion timestamp adjustment establishes ordinary 24h evidence interval only.
+
+Final selected additions before runs: exact archived version coverage (listing watermark alone yields no retirement candidates; exact version event ack does); migration reapplication retains existing event IDs; two-session allocated-lower-sequence later commit remains pending after exact ack. Existing affected tests selected by exact node IDs: test_lifecycle_admission.py::test_actual_source_orchestration_admits_and_records_sightings (offline SourceResult normal admission); test_lifecycle_reconcile.py::test_two_distinct_complete_misses_exact_24h_and_replay; ::test_partial_positive_survives_failure_and_old_id_reopens_without_age_reset; ::test_empty_threshold (20/21); tests/test_lifecycle_relations.py (two ordinary typed location/assertion evidence tests). Contents inspected before selection; no omitted mechanism suite is indirectly collected/executed. Existing helper imports do not select their test functions.
+
+Additional final ordinary tests before final runs: explicit flags-off legacy Job upsert + approval + application prepare + generation + same-owner account cleanup statements (service statements, no cross-user/role probe); complete typed relation endpoints/private unknown-field rejection; event body/count size limits; seven-day acknowledged-only byte compaction preserving exact coverage markers. Local terminal-age fixture does not change production clock/claim enforcement. Seal and acknowledgement now reserve physical growth through the unchanged ordinary capacity API; no physical guard simulation/test was added.
+
+Operational final additions before final runs: real verify_storage_blocked entrypoint with offline full feed persists successful health and complete membership while counts of preallocated operational state, receipt, event slots and legacy write-check rows stay constant; insufficient preallocated critical slots rolls back closure atomically. These are ordinary new lane slot/readiness contracts, with the unchanged physical guard running against a small actual owned database; no physical/cross-user/claim-expiry attack fixture or omitted Task3 probe.
+
+Final compatibility refinement: restrict nested private operational helper invocation to the three public service mutation tables before private-helper lookup. The legacy statement test additionally updates its own single already-seeded job_review using the ordinary authenticated owner wrapper; this verifies the new trigger dispatch does not break existing flag-off owner updates. It does not create a second user, attempt unauthorized calls, or exercise omitted Task3 mechanisms.
+
+Final critical-slot retention check extends active-archive exact-ack test with acknowledged-only seven-day byte compaction. Slots retain UUIDs, revisions, timestamps and terminal state forever; they never become free again. Combined item/slot compaction obeys the same <=2000 operation limit. The closure-kind projection now reserves critical budget only for pure closed_at/source_availability changes; simultaneous other public metadata changes remain ordinary upserts.
+
+Operational scheduling assertion added to the existing two-miss integration fixture: next_due_at is the next UTC day boundary (or established failure-disabled day multiplier), matching the existing one-shot 00:00 UTC cron and avoiding elapsed-feed-duration drift. This is ordinary scheduler integration, not a database expiry probe.
+
+Final exact-commit check: test_batch_claim_excludes_own_uncommitted_public_events verifies that same-connection uncommitted events cannot enter claimed membership. The selector excludes both ordinary requirement transaction IDs and critical slot transaction IDs equal to its current transaction; after commit the same event becomes eligible. This adds one ordinary batch test; final incremental batch-file runs are recorded separately from the previous 36-test broad affected selection.
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/versions.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/versions.txt
new file mode 100644
index 0000000..c609661
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-evidence/versions.txt
@@ -0,0 +1,6 @@
+3.12.14 (main, Aug 25 2026, 14:00:49) [Clang 22.1.3 ]
+psycopg 3.3.6
+pytest 9.1.1
+ruff 0.15.20
+sha256:327daa8fae7178d61f93142f146b098467b345e10997b9eb79f63bd58e5c8f3c ["postgres@sha256:ae69c452f483507a6b99fb654cf93aad7fe156ffd2c56247707eef4e36d3c12b"]
+sha256:275447c94b11b151decd1f29877965301d5a77032037c46de93d990f739f00a9 ["postgres@sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65"]
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-report.md
new file mode 100644
index 0000000..64b2f20
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-10-report.md
@@ -0,0 +1,87 @@
+# Task 10 implementation report
+
+Status: DONE for local author implementation and permitted ordinary verification. Independent permitted requirements/code-quality review is pending controller dispatch. This is not a security approval, archive activation, exporter connection, or release decision.
+
+Source commit: `293e413dc452a4e9b230dcef87e23d11fa2798ed`.
+Base: `6075983bd63dced95ec94dc61b9b112a79f4564d`.
+Branch/worktree: `feature/lifecycle-recovery`, `/workspace/job-board/.claude/worktrees/lifecycle-recovery`.
+The controller supplied the approved base and prior-task pins. Locally cached `origin/main` was `73ce118205bfdbb56c18207acc0c1c4e3708c860`; the author did not contact a remote or independently refresh upstream. Existing pricing and Pro stage-2 GPT6-Luna/16000 configuration was not changed.
+
+## Binding scope
+
+Read task-10-brief.md, task-10-author-dispatch.md, repository AGENTS.md, REVIEW-SCOPE-AMENDMENT.md and RELEASE-AUTHORIZATION.md. Read the controller's full task-10-operational-ruling.md before operational guard changes. No whole-plan read, subagents, helper agents, reviewer substitution, production/provider/model/network calls, IAM/credential changes, permanent production deletion, push, PR, merge or deploy.
+
+The author made only forward local commits and staged exact owned paths. Controller CURRENT/progress/resume/release/task13 documents were left unstaged. Root handles independent permitted review and eventual complete-upgrade release.
+
+## Implemented public outbox
+
+Added additive migration `2026-10-03-04-public-outbox.sql` and identical appended schema definitions, the archive package, package registration and tests.
+
+* Typed `PublicChange`, aggregate/change enums, total validation, bounded body (8192 bytes), explicit required relation endpoints, public field allowlists and version identity/hash fields. Raw description/question content and private applicant fields are absent. UUID namespace `fb2201d3-79ac-5801-923c-471b7823cb15` deterministically produces aggregate-kind/ID/revision event IDs and predecessor IDs.
+* After-row public projections create exact current-transaction requirements and monotonically ordered aggregate revisions. Deferred pairing requires the event's exact aggregate, revision, kind, body and occurred_at. Rollback removes state and event together. The old unconditional archive-placeholder rejection was replaced; established ordinary capacity/protection logic is otherwise retained. Paused producers reject eventful public changes; non-eventful private/cache-use and unchanged polling updates do not emit events.
+* Projection coverage: jobs, source_accounts, source_listings, job_versions, companies, locations, brands, skills, company_brands, company_sources, job_locations, job_skills, identity_assertions. Source operational attempt/lease/counter timestamps are not public facts. Source exclusion identity, listing availability/version/anchor, exact version metadata, and typed relation endpoints are public facts.
+* `_write` now flushes matching projections in the same transaction, connecting existing metadata admission, version capture/location edges, assertions, source catalog registration, positive/direct observations and complete-miss closure. `identity.py` explanatory comments reflect this shared integration. New source/listing/job rows retain their existing IDs and private FKs.
+* Bounded baseline snapshots current existing rows only, max100 per call; missing heads are the durable checkpoint. They do not fabricate historic observations or public versions. Production destination/producer readiness remains unvalidated and activation guards remain closed.
+* Ordinary budget112MiB/87500, critical hard budget128MiB/100000, reserving16MiB AND12500 slots; warning64MiB/50000/15minutes. Critical classification requires a pure closure/reopen field change; simultaneous other metadata changes remain ordinary. No per-unchanged-poll event growth. New budget SQL checks and API forecast use the same existing gate/capacity interfaces.
+* No pending event/batch cascade or TTL cleanup. Service-only tables have RLS and client privileges revoked; no new client grants or privileged user/job-DML helper was introduced. This is implementation description, not independent security assurance.
+
+Legacy direct writers remain compatible with flags off. Once archive-active, an eventful stale/direct writer without the paired contract fails closed. Old company/legacy Job writer entrypoints were not silently granted producer compatibility; their deployment readiness remains an activation prerequisite.
+
+## Exact batches, deterministic seals and acknowledgement
+
+`claim_batch(tx, limits, claim)` selects only committed, unassigned exact event IDs, excluding its own transaction's ordinary and critical-slot events. No sequence watermark determines membership/deletion. Earlier per-aggregate revisions must be in the same ordered batch or already covered; unacknowledged prior aggregate batches block later revisions. Maximum2000 events/8MiB expanded. Claiming is eager; no caller must wait five minutes. Task11 still owns the scheduled exporter tick/oldest-flush orchestration.
+
+The caller commits the claim before invoking pure `seal_batch(batch_ref, serializer_version=1)`. BatchRef includes immutable event-byte snapshots and persisted DB seal clock/horizon in addition to the specified identity/claim/membership/version fields. SealedBatch exposes batch identity/claim/membership/version properties, fixed object keys, persisted seal time and730-day eligible_until, SHA256 canonical/compressed/manifest digests and all counts/byte sizes. VerifiedBatch binds that seal to exact data and manifest receipts. ProjectionResult is defined for later replay integration; no replay executor is implemented here.
+
+Canonical UTF-8 sorted JSONL and deterministic gzip use mtime0 and no filename. Compression/serialization has no DB connection and runs outside SQL locks/transactions. `persist_seal` validates bytes, digests, membership, manifest identity, keys and sizes before writing immutable seal columns. `recover_batch` can adopt persisted work only after the prior owner is no longer active; its original membership and seal time survive. Expired seals fail closed and require future explicit authorized replacement; no replacement authorization or transport is invented in Task10.
+
+`ack_batch` requires a current claim/fence, exact persisted seal and membership, unsuppressed aggregate membership, both matching verification receipts, and DB time strictly before eligible_until. It persists receipt/coverage and deletes ONLY exact ordinary IDs (or terminally marks exact critical slots) in the same transaction. Late-committing lower sequence events remain pending. Rollback preserves pending membership/receipts together. Seal/ack growth uses the ordinary physical reservation API, so missing physical headroom defers it.
+
+`public_archive_version_coverage` binds version UUID + listing UUID + version revision + content hash + event/batch. Maintenance's version eligibility now requires that exact coverage; a listing archived_revision watermark cannot certify unknown versions. No unknown or privately referenced version is silently retired.
+
+`compact_terminal_batches` compacts only verified, acknowledged bytes after7days, max2000 combined item/critical-slot operations. Exact IDs/revisions, receipt/seal references, suppression and coverage/fence markers survive. Pending state never ages out. This helper is ready for Task11/13 scheduled orchestration; no exporter/maintenance archive scheduling activation is added here. A compacted terminal byte history cannot be reconstituted through a fake pending replay.
+
+## R6-4 operational closure and health contract
+
+Concrete prior issue: claim_due_source→fresh claim/_write(source_accounts)→new source enumeration/membership/checkpoint rows reserved growth, and every source/listing update was charged as growth. The old fallback fetched/logged feeds without durable closure/health. A zero-byte reservation would not solve staging, receipt or archive event storage. The controller approved an additive preallocated lane; ordinary growth admission/6000MiB/all-held forecasts were not weakened.
+
+New `lifecycle/operational.py` and tables provide:
+
+* One `lifecycle_operational_sources` row per source: sequence, terminal/running status, started/completed/last-turn clocks, fixed UUID cursor, completion bit and membership count.
+* One `lifecycle_operational_listings` row per existing listing: fixed source/listing IDs, positive sequence/time/kind, distinct miss sequence/count bounded0..2 and first-miss time.
+* One reusable `lifecycle_operational_receipts` row per source with backend/transaction, actual invoking role/subject, current owner/generation and <=500 counted row effects. Receipt updates defer current claim/DB-time validation to standalone commit. No caller GUC enables this lane; it does not insert the old lifecycle_write_checks per operation.
+* Existing source claim rows are reused. Fresh missing claims, operational rows, incomplete known-listing coverage or missing archive baseline produce explicit deferral. The same gate precedes sorted Job keys before affected Job/listing locks; source-only progress is gated. Each bounded operational transaction renews the existing claim; network requests follow committed transactions.
+* Global fixed critical-event slots, integer IDs1..12500, with free→allocated→pending→acked transitions. Default provisioning adds16 slots per ordinary source turn; explicit provisioning allows0..100 per chunk. Slots are never automatically recycled. Above-guard closure/reopen in an archive-active fixture retains exact body/UUID/revision/predecessor/time in these slots and uses the same pending-event view/batching/ack. Missing slots or baseline rolls back closure; it cannot report success while dropping its event.
+
+Below-guard `provision` uses the unchanged positive capacity API; at most100 listings and100 slots per call. Default forecast is65536*(100+16+3)=7798784 bytes, including existing ordinary claims/reservations. Each free critical slot carries24576 external-storage padding bytes (16 slots=393216 bytes; all12500=307200000 bytes before row/index overhead). A populated slot bounds body<=8192 and canonical event<=12288 bytes plus fixed metadata, and drops padding. These are logical/preallocation bounds, not physical credit or a promise of MVCC page reuse.
+
+The operational reader streams existing IDs only; new IDs are not admitted or stored. Positive evidence commits in <=100-item chunks and survives partial feeds/restart. Only full successful, unsuspicious completion can supply absence. Empty feeds with >20 prior open jobs remain suspicious. Reconciliation uses per-listing sequence marks, two distinct successful misses>=24h apart, and durable cursor commits. An interrupted running feed restarts a new sequence; a complete unreconciled checkpoint resumes. No payload is hydrated, no identity is inserted. Successful/partial/failed health and next-due scheduling persist; the latter retains the established UTC day-boundary rule. Per-source last-turn ordering prevents resumed tails always retaining the oldest selection key, but large-board operational fairness is not independently load-proven here.
+
+`verify_storage_blocked` now invokes this durable lane. Ordinary source turns proactively provision bounded state before regular staging. Full initial coverage of large/existing corpora requires repeated bounded provisioning BEFORE the guard binds; missing readiness yields a deferred result. No actual database was filled past6000MiB for this task, and no omitted Task3 physical-capacity/expiry/isolation probes were run.
+
+## Verification evidence and limits
+
+See `task-10-evidence/test-inventory.md` for explicit test contents recorded before each selection, `commands.md` for actual commands/chronology, `versions.txt` for exact runtime/image pins, and `source-files.sha256` for final owned source/test hashes.
+
+Initial RED:3 collection errors from missing archive modules. Intermediate PostgreSQL failures are retained: heterogeneous-trigger OLD field access, then a PL/pgSQL CASE syntax mistake, were corrected before GREEN. No failed result is presented as a pass.
+
+Complete affected selection:36 passed on actual PostgreSQL17.11 and36 passed on16.15, no skipped DB tests (`final-pinned17.txt`, `final-pinned16.txt`). After the final UTC-midnight scheduler adjustment, only the affected operational file was rerun:7 passed on each major (`final-operational17.txt`, `final-operational16.txt`). After the own-uncommitted-membership correction/additional test, only the affected batch file was rerun:9 passed on each major (`final-batches17.txt`, `final-batches16.txt`). Together these cover37 unique selected tests per major at the final state; there is no claim that a single final command executed all37. Identity's subsequent edits are comments only.
+
+The selected tests cover paired rollback/direct unpaired commit rejection, revision/predecessor consistency, second-session lower-sequence late commit, exact partial membership, contiguous aggregate ordering, unchanged polling, pure outbox threshold arithmetic, canonical gzip/JSON, typed relation endpoints, exact version coverage, immutable seal/membership, receipt/suppression checks, transaction rollback at ack, terminal compaction, idempotent migration reapplication, active metadata/closure integration, flags-off legacy upsert/approval/prepare/generation/same-owner cleanup, a normal single-owner authenticated update, source misses/reopen/empty threshold, and the operational lane including durable restart/cursor/critical slots.
+
+The owned small operational fixture measured allocated database bytes, table+TOAST bytes and index bytes before/after two successful enumerations/closure. Final operational17: allocated12236467 before/after; table+TOAST1097728 and indexes1605632 before/after. Operational16: allocated12295191 before/after; same table/index values. All three deltas were0 in those fixtures. The real operational entrypoint separately proved constant counts of operational state/receipt/critical slot and legacy write-check rows. These limited observations are NOT a general physical-growth or production headroom guarantee.
+
+Python3.12.14, psycopg3.3.6, pytest9.1.1, ruff0.15.20. PostgreSQL17 proves major-version parity;17.11 is not a claim of having run historical production17.6. PostgreSQL16 evidence is compatibility evidence. Lint passed and git diff --check was clean.
+
+No broad pytest tests/ run, no test_lifecycle_safety.py, test_lifecycle_activation.py, test_lifecycle_review_security.py or deferred cross-user/expiry/capacity/adversarial suites. Tests that import old setup helpers do not select their test functions. Numeric outbox threshold unit tests are not a claim of having loaded100000 events or proved the old physical accounting mechanism.
+
+## Remaining integration and release concerns
+
+1. Task11 transport/export loop, persisted fake-S3 crash matrix, authorized expired replacement and Task12 replay remain downstream work. No external archive destination, exporter or live archive was connected.
+2. All production defaults remain off; retirement remains dry-run. Destination validation, compatible writer inventory/readiness, complete bounded baseline and operational preallocation must precede activation. Stale legacy eventful writers intentionally fail closed when active. Existing activation guard still rejects enabling; fixtures seed active state only in owned test databases.
+3. Finite critical slots do not refill automatically even after acknowledgement. This preserves exact history/fences but creates an operational runway limit. Fresh lifecycle receipt/event/marker infrastructure above the guard cannot be assumed available; batching/seal/ack use ordinary capacity and may defer if there is no physical headroom. Reuse requires a separately correct exact-ack/fence/marker design, not ad hoc slot reset.
+4. Physical MVCC allocation is unknown beyond the measured ordinary fixtures. This task neither lowers the6000MiB ceiling nor awards physical credit for DELETE/compaction. R6-4 has a concrete durable bounded implementation and ordinary DB evidence; it has no independent physical/security assurance. Missing slots/readiness/backlog remains truthful deferral.
+5. Archive terminal compaction is implemented/tested as a bounded callable helper; its periodic exporter/maintenance integration belongs to the later orchestration task. Unverified state is retained if orchestration is inactive.
+6. Existing deliberately omitted Task3 expiry-enforcement/capacity-accounting/cross-user/adversarial review gaps remain. No refused work was retried or substituted, no new security approval is claimed, and independent permitted Task10 review has not yet happened.
+
+No safeguard rejection occurred in this author session. No remaining ordinary selected test failure. Author work is local-only and ready for the controller's fresh permitted review.
diff --git a/job_discovery/archive/__init__.py b/job_discovery/archive/__init__.py
new file mode 100644
index 0000000..8ee8417
--- /dev/null
+++ b/job_discovery/archive/__init__.py
@@ -0,0 +1 @@
+"""Transactional public metadata archive; activation and transport are separate gates."""
diff --git a/job_discovery/archive/batches.py b/job_discovery/archive/batches.py
new file mode 100644
index 0000000..856a292
--- /dev/null
+++ b/job_discovery/archive/batches.py
@@ -0,0 +1,417 @@
+"""Persist exact committed membership; serialize without a connection or transaction."""
+
+from dataclasses import asdict, replace
+from datetime import UTC
+import hashlib
+import json
+from uuid import uuid4
+from psycopg.types.json import Jsonb
+from job_discovery.lifecycle.claims import validate_claim
+from job_discovery.lifecycle.capacity import (
+    reserve_capacity,
+    bind_reservation,
+    settle_capacity,
+)
+from .codec import canonical_json, encode_events, MAX_MANIFEST
+from .outbox import ArchiveBlocked
+from .types import BatchRef, BatchLimits, SealedBatch, VerifiedBatch, AckResult
+
+
+def _hash(value):
+    return hashlib.sha256(value).hexdigest()
+
+
+def _ref(tx, row, claim):
+    items = tx.execute(
+        "SELECT * FROM public_archive_items WHERE batch_id=%s ORDER BY position",
+        (row["batch_id"],),
+    ).fetchall()
+    return BatchRef(
+        row["batch_id"],
+        claim,
+        tuple(i["event_id"] for i in items),
+        row["serializer_version"],
+        row["sealed_at"],
+        row["eligible_until"],
+        tuple(bytes(i["canonical_event"]) for i in items),
+        row["prior_batch_id"],
+    )
+
+
+def claim_batch(tx, limits: BatchLimits, claim) -> BatchRef | None:
+    if not isinstance(limits, BatchLimits):
+        raise ValueError("BatchLimits required")
+    validate_claim(tx, claim)
+    # No watermark: only committed, unassigned exact IDs visible under the gate.
+    rows = tx.execute(
+        """SELECT e.* FROM public_pending_events e
+      WHERE NOT EXISTS(SELECT FROM public_change_requirements r WHERE r.id=e.requirement_id AND r.transaction_id=pg_current_xact_id())
+      AND NOT EXISTS(SELECT FROM public_critical_event_slots s WHERE s.event_id=e.event_id AND s.transaction_id=pg_current_xact_id())
+      AND NOT EXISTS(SELECT FROM public_archive_items i WHERE i.event_id=e.event_id)
+      AND NOT EXISTS(SELECT FROM public_archive_items i JOIN public_archive_batches b USING(batch_id)
+        WHERE i.aggregate_type=e.aggregate_type AND i.aggregate_id=e.aggregate_id AND b.state<>'acked')
+      ORDER BY e.recorded_at,e.aggregate_type,e.aggregate_id,e.revision,e.event_id LIMIT %s""",
+        (limits.max_events,),
+    ).fetchall()
+    selected = []
+    total = 0
+    for row in rows:
+        size = len(row["canonical_event"]) + 1
+        if total + size > limits.max_expanded_bytes:
+            break
+        # A prior pending predecessor must be included earlier in this same batch.
+        if (
+            row["revision"] > 1
+            and not any(r["event_id"] == row["predecessor_id"] for r in selected)
+            and not tx.execute(
+                "SELECT 1 FROM public_archive_coverage WHERE event_id=%s",
+                (row["predecessor_id"],),
+            ).fetchone()
+        ):
+            continue
+        selected.append(row)
+        total += size
+    if not selected:
+        return None
+    reservation = reserve_capacity(tx, claim, total * 4 + 65536)
+    if reservation is None:
+        raise ArchiveBlocked("physical batch capacity unavailable")
+    bind_reservation(tx, reservation, job_id=None, scope="public_archive_batches")
+    batch_id = uuid4()
+    row = tx.execute(
+        """INSERT INTO public_archive_batches(batch_id,owner_token,generation,serializer_version,sealed_at,eligible_until,event_count,expanded_bytes)
+      SELECT %s,%s,%s,1,t,t+interval '17520 hours',%s,%s FROM (SELECT clock_timestamp() t) clock RETURNING *""",
+        (batch_id, claim.owner_token, claim.generation, len(selected), total),
+    ).fetchone()
+    for position, event in enumerate(selected):
+        tx.execute(
+            """INSERT INTO public_archive_items(batch_id,position,event_id,aggregate_type,aggregate_id,revision,canonical_event)
+         VALUES(%s,%s,%s,%s,%s,%s,%s)""",
+            (
+                batch_id,
+                position,
+                event["event_id"],
+                event["aggregate_type"],
+                event["aggregate_id"],
+                event["revision"],
+                event["canonical_event"],
+            ),
+        )
+    settle_capacity(tx, reservation)
+    return _ref(tx, row, claim)
+
+
+def seal_batch(batch_ref: BatchRef, serializer_version: int = 1) -> SealedBatch:
+    if serializer_version != 1 or batch_ref.serializer_version != 1:
+        raise ValueError("unsupported serializer version")
+    events = [json.loads(value) for value in batch_ref.event_bytes]
+    if tuple(e["event_id"] for e in events) != tuple(
+        str(e) for e in batch_ref.ordered_event_ids
+    ):
+        raise ValueError("membership differs from event bytes")
+    canonical, compressed = encode_events(events)
+    prefix = f"public/v1/{batch_ref.batch_id}"
+    data_key = f"{prefix}/events.jsonl.gz"
+    manifest_key = f"{prefix}/manifest.json"
+    manifest = canonical_json(
+        dict(
+            schema_version=1,
+            serializer_version=1,
+            batch_id=str(batch_ref.batch_id),
+            ordered_event_ids=[str(e) for e in batch_ref.ordered_event_ids],
+            sealed_at=batch_ref.sealed_at.astimezone(UTC).isoformat(),
+            eligible_until=batch_ref.eligible_until.astimezone(UTC).isoformat(),
+            prior_batch_id=str(batch_ref.prior_batch_id)
+            if batch_ref.prior_batch_id
+            else None,
+            data_key=data_key,
+            manifest_key=manifest_key,
+            canonical_hash=_hash(canonical),
+            compressed_hash=_hash(compressed),
+            event_count=len(events),
+            expanded_bytes=len(canonical),
+            compressed_bytes=len(compressed),
+        )
+    )
+    if len(manifest) > MAX_MANIFEST:
+        raise ValueError("manifest exceeds 1MiB")
+    return SealedBatch(
+        batch_ref,
+        data_key,
+        manifest_key,
+        _hash(canonical),
+        _hash(compressed),
+        _hash(manifest),
+        len(events),
+        len(canonical),
+        len(compressed),
+        len(manifest),
+        canonical,
+        compressed,
+        manifest,
+    )
+
+
+def _owned(tx, batch_id, claim):
+    validate_claim(tx, claim)
+    row = tx.execute(
+        "SELECT * FROM public_archive_batches WHERE batch_id=%s FOR UPDATE", (batch_id,)
+    ).fetchone()
+    if not row or (row["owner_token"], row["generation"]) != (
+        claim.owner_token,
+        claim.generation,
+    ):
+        raise ArchiveBlocked("stale batch owner")
+    if not tx.execute(
+        "SELECT clock_timestamp()<%s eligible", (row["eligible_until"],)
+    ).fetchone()["eligible"]:
+        raise ArchiveBlocked(
+            "archive seal expired; explicit replacement authorization required"
+        )
+    return row
+
+
+def recover_batch(tx, batch_id, claim) -> BatchRef:
+    """Fence an expired/cancelled prior worker, preserving exact membership and seal."""
+    validate_claim(tx, claim)
+    row = tx.execute(
+        "SELECT * FROM public_archive_batches WHERE batch_id=%s FOR UPDATE", (batch_id,)
+    ).fetchone()
+    if not row or row["state"] == "acked":
+        raise ArchiveBlocked("batch unavailable")
+    if (row["owner_token"], row["generation"]) != (claim.owner_token, claim.generation):
+        if tx.execute(
+            "SELECT 1 FROM lifecycle_claims WHERE owner_token=%s AND generation=%s AND state='active' AND lease_until>clock_timestamp()",
+            (row["owner_token"], row["generation"]),
+        ).fetchone():
+            raise ArchiveBlocked("batch still owned")
+        tx.execute(
+            "UPDATE public_archive_batches SET owner_token=%s,generation=%s WHERE batch_id=%s",
+            (claim.owner_token, claim.generation, batch_id),
+        )
+    _owned(tx, batch_id, claim)
+    return _ref(tx, row, claim)
+
+
+def persist_seal(tx, seal: SealedBatch) -> None:
+    row = _owned(tx, seal.batch.batch_id, seal.batch.claim)
+    ref = _ref(tx, row, seal.batch.claim)
+    if ref != seal.batch:
+        raise ArchiveBlocked("persisted membership differs from seal")
+    # Validate already-serialized bytes and hashes; never compress under the gate.
+    if seal.canonical_data != b"".join(e + b"\n" for e in ref.event_bytes) or any(
+        _hash(data) != digest
+        for data, digest in [
+            (seal.canonical_data, seal.canonical_hash),
+            (seal.compressed_data, seal.compressed_hash),
+            (seal.manifest_data, seal.manifest_hash),
+        ]
+    ):
+        raise ValueError("seal bytes or hashes differ")
+    if (
+        seal.event_count,
+        seal.expanded_bytes,
+        seal.compressed_bytes,
+        seal.manifest_bytes,
+    ) != (
+        len(ref.ordered_event_ids),
+        len(seal.canonical_data),
+        len(seal.compressed_data),
+        len(seal.manifest_data),
+    ):
+        raise ValueError("seal counts or sizes differ")
+    prefix = f"public/v1/{ref.batch_id}"
+    if (seal.data_key, seal.manifest_key) != (
+        f"{prefix}/events.jsonl.gz",
+        f"{prefix}/manifest.json",
+    ):
+        raise ValueError("seal object keys differ")
+    manifest = json.loads(seal.manifest_data)
+    for key in (
+        "data_key",
+        "manifest_key",
+        "canonical_hash",
+        "compressed_hash",
+        "event_count",
+        "expanded_bytes",
+        "compressed_bytes",
+    ):
+        if manifest.get(key) != getattr(seal, key):
+            raise ValueError("manifest differs from seal")
+    if (
+        manifest.get("ordered_event_ids") != [str(e) for e in ref.ordered_event_ids]
+        or manifest.get("sealed_at") != ref.sealed_at.astimezone(UTC).isoformat()
+        or manifest.get("eligible_until")
+        != ref.eligible_until.astimezone(UTC).isoformat()
+    ):
+        raise ValueError("manifest identity or horizon differs")
+    values = {
+        k: getattr(seal, k)
+        for k in (
+            "data_key",
+            "manifest_key",
+            "canonical_hash",
+            "compressed_hash",
+            "manifest_hash",
+            "event_count",
+            "expanded_bytes",
+            "compressed_bytes",
+            "manifest_bytes",
+        )
+    }
+    if row["state"] != "claimed":
+        if any(row[k] != v for k, v in values.items()):
+            raise ArchiveBlocked("immutable seal differs")
+        return
+    reservation = reserve_capacity(tx, seal.batch.claim, 65536)
+    if reservation is None:
+        raise ArchiveBlocked("physical seal capacity unavailable")
+    bind_reservation(tx, reservation, job_id=None, scope="public_archive_batches")
+    tx.execute(
+        """UPDATE public_archive_batches SET state='sealed',data_key=%(data_key)s,manifest_key=%(manifest_key)s,
+      canonical_hash=%(canonical_hash)s,compressed_hash=%(compressed_hash)s,manifest_hash=%(manifest_hash)s,
+      compressed_bytes=%(compressed_bytes)s,manifest_bytes=%(manifest_bytes)s WHERE batch_id=%(batch_id)s""",
+        dict(values, batch_id=ref.batch_id),
+    )
+
+    settle_capacity(tx, reservation)
+
+
+def ack_batch(tx, verified_batch: VerifiedBatch, claim) -> AckResult:
+    if not isinstance(verified_batch, VerifiedBatch):
+        raise ValueError("VerifiedBatch required")
+    seal = verified_batch.seal
+    row = _owned(tx, seal.batch.batch_id, claim)
+    current = _ref(tx, row, claim)
+    if replace(seal.batch, claim=claim) != current:
+        raise ArchiveBlocked("ack membership differs")
+    for key in (
+        "data_key",
+        "manifest_key",
+        "canonical_hash",
+        "compressed_hash",
+        "manifest_hash",
+        "event_count",
+        "expanded_bytes",
+        "compressed_bytes",
+        "manifest_bytes",
+    ):
+        if row[key] != getattr(seal, key):
+            raise ArchiveBlocked("ack seal differs")
+    if row["state"] not in {"sealed", "acked"}:
+        raise ArchiveBlocked("batch is not sealed")
+    for receipt, key, digest, size in [
+        (
+            verified_batch.data_receipt,
+            seal.data_key,
+            seal.compressed_hash,
+            seal.compressed_bytes,
+        ),
+        (
+            verified_batch.manifest_receipt,
+            seal.manifest_key,
+            seal.manifest_hash,
+            seal.manifest_bytes,
+        ),
+    ]:
+        if (
+            (receipt.key, receipt.sha256, receipt.byte_count) != (key, digest, size)
+            or not isinstance(receipt.receipt, str)
+            or not 1 <= len(receipt.receipt) <= 2048
+        ):
+            raise ValueError("exact data and manifest verification receipts required")
+    if tx.execute(
+        """SELECT 1 FROM public_archive_items i JOIN public_archive_suppressions s USING(aggregate_type,aggregate_id)
+        WHERE i.batch_id=%s LIMIT 1""",
+        (current.batch_id,),
+    ).fetchone():
+        raise ArchiveBlocked("batch contains suppressed aggregate")
+    items = tx.execute(
+        "SELECT * FROM public_archive_items WHERE batch_id=%s ORDER BY position",
+        (current.batch_id,),
+    ).fetchall()
+    markers = tuple(
+        (i["aggregate_type"], i["aggregate_id"], i["revision"]) for i in items
+    )
+    if row["state"] == "acked":
+        return AckResult(current.ordered_event_ids, markers)
+    reservation = reserve_capacity(tx, claim, 65536 + len(items) * 16384)
+    if reservation is None:
+        raise ArchiveBlocked("physical exact acknowledgement capacity unavailable")
+    bind_reservation(tx, reservation, job_id=None, scope="public_archive_coverage")
+    tx.execute(
+        "INSERT INTO public_archive_receipts(batch_id,data_receipt,manifest_receipt) VALUES(%s,%s,%s)",
+        (
+            current.batch_id,
+            Jsonb(asdict(verified_batch.data_receipt)),
+            Jsonb(asdict(verified_batch.manifest_receipt)),
+        ),
+    )
+    for item in items:
+        tx.execute(
+            "INSERT INTO public_archive_coverage(aggregate_type,aggregate_id,revision,event_id,batch_id) VALUES(%s,%s,%s,%s,%s)",
+            (
+                item["aggregate_type"],
+                item["aggregate_id"],
+                item["revision"],
+                item["event_id"],
+                current.batch_id,
+            ),
+        )
+        if item["aggregate_type"] == "job_versions":
+            body = json.loads(bytes(item["canonical_event"]))["body"]
+            tx.execute(
+                """INSERT INTO public_archive_version_coverage(version_id,source_listing_id,version_revision,content_hash,event_id,batch_id)
+             VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
+                (
+                    body["id"],
+                    body["source_listing_id"],
+                    body["revision"],
+                    body["content_hash"],
+                    item["event_id"],
+                    current.batch_id,
+                ),
+            )
+    # Exact IDs only, even when a lower sequence commits after selection.
+    reqs = tx.execute(
+        "DELETE FROM public_outbox WHERE event_id=ANY(%s) RETURNING requirement_id",
+        (list(current.ordered_event_ids),),
+    ).fetchall()
+    slots = tx.execute(
+        "UPDATE public_critical_event_slots SET state='acked' WHERE state='pending' AND event_id=ANY(%s) RETURNING event_id",
+        (list(current.ordered_event_ids),),
+    ).fetchall()
+    if len(reqs) + len(slots) != len(items):
+        raise ArchiveBlocked("exact pending acknowledgement membership missing")
+    tx.execute(
+        "DELETE FROM public_change_requirements WHERE id=ANY(%s)",
+        ([r["requirement_id"] for r in reqs],),
+    )
+    tx.execute(
+        "UPDATE public_archive_batches SET state='acked',acked_at=clock_timestamp() WHERE batch_id=%s",
+        (current.batch_id,),
+    )
+    settle_capacity(tx, reservation)
+    return AckResult(current.ordered_event_ids, markers)
+
+
+def compact_terminal_batches(tx, claim, *, limit=2000) -> int:
+    """Seven-day terminal byte compaction retains exact IDs, receipts and fences."""
+    if type(limit) is not int or not 1 <= limit <= 2000:
+        raise ValueError("terminal compaction limit must be 1..2000")
+    validate_claim(tx, claim)
+    rows = tx.execute(
+        """UPDATE public_archive_items SET canonical_event=''::bytea WHERE (batch_id,position) IN
+      (SELECT i.batch_id,i.position FROM public_archive_items i JOIN public_archive_batches b USING(batch_id)
+       WHERE b.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days' AND octet_length(i.canonical_event)>0
+       ORDER BY b.acked_at,i.position LIMIT %s) RETURNING event_id""",
+        (limit,),
+    ).fetchall()
+    slots = tx.execute(
+        """UPDATE public_critical_event_slots SET body='{}'::jsonb,canonical_event=''::bytea WHERE slot IN
+      (SELECT s.slot FROM public_critical_event_slots s JOIN public_archive_coverage c USING(event_id)
+       JOIN public_archive_batches b USING(batch_id) WHERE s.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days'
+       AND octet_length(s.canonical_event)>0 ORDER BY s.slot LIMIT %s) RETURNING slot""",
+        (limit - len(rows),),
+    ).fetchall()
+    return len(rows) + len(slots)
diff --git a/job_discovery/archive/codec.py b/job_discovery/archive/codec.py
new file mode 100644
index 0000000..9c5a972
--- /dev/null
+++ b/job_discovery/archive/codec.py
@@ -0,0 +1,37 @@
+"""Version 1 canonical UTF-8 JSONL and reproducible gzip, without external I/O."""
+
+import gzip
+import io
+import json
+
+MAX_EXPANDED = 8 * 1024**2
+MAX_COMPRESSED = 16 * 1024**2
+MAX_MANIFEST = 1024**2
+
+
+def canonical_json(value) -> bytes:
+    return json.dumps(
+        value,
+        ensure_ascii=False,
+        sort_keys=True,
+        separators=(",", ":"),
+        allow_nan=False,
+    ).encode("utf-8")
+
+
+def encode_events(events) -> tuple[bytes, bytes]:
+    chunks = []
+    total = 0
+    for event in events:
+        chunk = canonical_json(event) + b"\n"
+        total += len(chunk)
+        if len(chunks) >= 2000 or total > MAX_EXPANDED:
+            raise ValueError("batch exceeds 2000 events or 8MiB expanded")
+        chunks.append(chunk)
+    data = b"".join(chunks)
+    output = io.BytesIO()
+    with gzip.GzipFile(
+        filename="", fileobj=output, mode="wb", mtime=0, compresslevel=9
+    ) as stream:
+        stream.write(data)
+    return data, output.getvalue()
diff --git a/job_discovery/archive/outbox.py b/job_discovery/archive/outbox.py
new file mode 100644
index 0000000..c2fefba
--- /dev/null
+++ b/job_discovery/archive/outbox.py
@@ -0,0 +1,188 @@
+"""Public transaction pairing; no transport, credentials, or activation side effects."""
+
+from datetime import UTC
+from psycopg import sql
+from psycopg.types.json import Jsonb
+from job_discovery.lifecycle.claims import validate_claim
+from job_discovery.lifecycle.config import read_control
+from job_discovery.lifecycle.capacity import (
+    reserve_capacity,
+    bind_reservation,
+    settle_capacity,
+)
+from .codec import canonical_json
+from .schema import AggregateType, ChangeKind, PublicChange, event_id, validate_change
+from .types import EventRef
+
+WARNING_BYTES, WARNING_EVENTS, WARNING_AGE = 64 * 1024**2, 50000, 900
+ORDINARY_BYTES, ORDINARY_EVENTS = 112 * 1024**2, 87500
+HARD_BYTES, HARD_EVENTS = 128 * 1024**2, 100000
+CRITICAL_BYTES, CRITICAL_EVENTS = 16 * 1024**2, 12500
+
+
+class ArchiveBlocked(RuntimeError):
+    pass
+
+
+def budget_allows(count: int, size: int, next_size: int, critical: bool) -> bool:
+    return count + 1 <= (
+        HARD_EVENTS if critical else ORDINARY_EVENTS
+    ) and size + next_size <= (HARD_BYTES if critical else ORDINARY_BYTES)
+
+
+def outbox_health(conn) -> dict:
+    row = conn.execute("""SELECT count(*) events,COALESCE(sum(octet_length(canonical_event)),0) bytes,
+      COALESCE(extract(epoch FROM clock_timestamp()-min(recorded_at)),0) age_seconds FROM public_pending_events""").fetchone()
+    row["warning"] = (
+        row["events"] >= WARNING_EVENTS
+        or row["bytes"] >= WARNING_BYTES
+        or row["age_seconds"] >= WARNING_AGE
+    )
+    row["ordinary_paused"] = (
+        row["events"] >= ORDINARY_EVENTS or row["bytes"] >= ORDINARY_BYTES
+    )
+    return row
+
+
+def _envelope(row):
+    eid = event_id(row["aggregate_type"], row["aggregate_id"], row["revision"])
+    previous = (
+        event_id(row["aggregate_type"], row["aggregate_id"], row["revision"] - 1)
+        if row["revision"] > 1
+        else None
+    )
+    return dict(
+        event_id=str(eid),
+        aggregate_type=row["aggregate_type"],
+        aggregate_id=row["aggregate_id"],
+        revision=row["revision"],
+        predecessor_id=str(previous) if previous else None,
+        kind=row["kind"],
+        body=row["body"],
+        occurred_at=row["occurred_at"].astimezone(UTC).isoformat(),
+        schema_version=1,
+    )
+
+
+def record_public_change(tx, change: PublicChange, claim) -> EventRef:
+    validate_change(change)
+    validate_claim(tx, claim)
+    ctl = read_control(tx)
+    if ctl.archive_stage != "active":
+        raise ArchiveBlocked("archive producer inactive or paused")
+    row = tx.execute(
+        """SELECT r.* FROM public_change_requirements r
+      WHERE transaction_id=pg_current_xact_id() AND aggregate_type=%s AND aggregate_id=%s
+       AND kind=%s AND body=%s AND occurred_at=%s
+       AND NOT EXISTS(SELECT FROM public_outbox e WHERE e.requirement_id=r.id) ORDER BY revision LIMIT 1""",
+        (
+            change.aggregate_type,
+            change.aggregate_id,
+            change.kind,
+            Jsonb(change.body),
+            change.occurred_at,
+        ),
+    ).fetchone()
+    if not row:
+        raise ValueError("no exact unpaired public mutation in this transaction")
+    envelope = _envelope(row)
+    encoded = canonical_json(envelope)
+    health = outbox_health(tx)
+    critical = change.kind in {ChangeKind.CLOSED, ChangeKind.REOPENED}
+    if not budget_allows(health["events"], health["bytes"], len(encoded), critical):
+        raise ArchiveBlocked("public outbox budget exhausted; mutation must roll back")
+    reservation = reserve_capacity(
+        tx, claim, max(65536, len(encoded) * 16 + 32768), critical=critical
+    )
+    if reservation is None:
+        raise ArchiveBlocked(
+            "physical archive capacity unavailable; mutation must roll back"
+        )
+    bind_reservation(tx, reservation, job_id=None, scope="public_outbox")
+    tx.execute(
+        """INSERT INTO public_outbox(event_id,requirement_id,aggregate_type,aggregate_id,revision,
+       predecessor_id,kind,body,occurred_at,canonical_event,body_bytes)
+       VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
+        (
+            envelope["event_id"],
+            row["id"],
+            change.aggregate_type,
+            change.aggregate_id,
+            row["revision"],
+            envelope["predecessor_id"],
+            change.kind,
+            Jsonb(change.body),
+            change.occurred_at,
+            encoded,
+            len(canonical_json(change.body)),
+        ),
+    )
+    settle_capacity(tx, reservation)
+    return EventRef(
+        event_id(change.aggregate_type, change.aggregate_id, row["revision"]),
+        change.aggregate_type,
+        change.aggregate_id,
+        row["revision"],
+    )
+
+
+def flush_public_changes(tx, claim) -> tuple[EventRef, ...]:
+    if not read_control(tx).archive_ever_activated:
+        return ()
+    rows = tx.execute("""SELECT r.* FROM public_change_requirements r WHERE transaction_id=pg_current_xact_id()
+      AND NOT EXISTS(SELECT FROM public_outbox e WHERE e.requirement_id=r.id) ORDER BY r.id""").fetchall()
+    return tuple(
+        record_public_change(
+            tx,
+            PublicChange(
+                AggregateType(r["aggregate_type"]),
+                r["aggregate_id"],
+                ChangeKind(r["kind"]),
+                r["body"],
+                r["occurred_at"],
+            ),
+            claim,
+        )
+        for r in rows
+    )
+
+
+def baseline_batch(
+    tx, aggregate_type: str, claim, *, limit: int = 100
+) -> tuple[EventRef, ...]:
+    """Snapshot current rows only; persisted head existence is the bounded checkpoint."""
+    table = AggregateType(aggregate_type)
+    if type(limit) is not int or not 1 <= limit <= 100:
+        raise ValueError("baseline limit must be 1..100")
+    validate_claim(tx, claim)
+    if read_control(tx).archive_stage != "active":
+        raise ArchiveBlocked("baseline requires validated active producer")
+    identity = "raw" if table == AggregateType.LOCATION else "id"
+    rows = tx.execute(
+        sql.SQL("""SELECT t.{identity}::text aid,lifecycle_private.public_projection(%s,to_jsonb(t)) body
+       FROM {table} t WHERE NOT EXISTS(SELECT FROM public_archive_heads h WHERE h.aggregate_type=%s
+       AND h.aggregate_id=t.{identity}::text) ORDER BY t.{identity} LIMIT %s""").format(
+            identity=sql.Identifier(identity), table=sql.Identifier(table)
+        ),
+        (table, table, limit),
+    ).fetchall()
+    for row in rows:
+        tx.execute(
+            "INSERT INTO public_archive_heads VALUES(%s,%s,1)", (table, row["aid"])
+        )
+        tx.execute(
+            """INSERT INTO public_change_requirements(aggregate_type,aggregate_id,revision,kind,body)
+          VALUES(%s,%s,1,'baseline',%s)""",
+            (table, row["aid"], Jsonb(row["body"])),
+        )
+    return flush_public_changes(tx, claim)
+
+
+def event_rows(tx, event_ids):
+    rows = tx.execute(
+        "SELECT * FROM public_outbox WHERE event_id=ANY(%s)", (list(event_ids),)
+    ).fetchall()
+    by_id = {r["event_id"]: r for r in rows}
+    if set(by_id) != set(event_ids):
+        raise ArchiveBlocked("exact pending membership missing")
+    return [by_id[eid] for eid in event_ids]
diff --git a/job_discovery/archive/schema.py b/job_discovery/archive/schema.py
new file mode 100644
index 0000000..e8a40a9
--- /dev/null
+++ b/job_discovery/archive/schema.py
@@ -0,0 +1,259 @@
+"""Total typed public-change validator. Raw content and private fields are absent."""
+
+from dataclasses import dataclass
+from datetime import datetime
+from enum import StrEnum
+from uuid import UUID, uuid5
+from urllib.parse import urlsplit
+from .codec import canonical_json
+
+EVENT_NAMESPACE = UUID("fb2201d3-79ac-5801-923c-471b7823cb15")
+
+
+class AggregateType(StrEnum):
+    JOB = "jobs"
+    SOURCE = "source_accounts"
+    LISTING = "source_listings"
+    VERSION = "job_versions"
+    COMPANY = "companies"
+    LOCATION = "locations"
+    BRAND = "brands"
+    SKILL = "skills"
+    COMPANY_BRAND = "company_brands"
+    COMPANY_SOURCE = "company_sources"
+    JOB_LOCATION = "job_locations"
+    JOB_SKILL = "job_skills"
+    IDENTITY = "identity_assertions"
+
+
+class ChangeKind(StrEnum):
+    BASELINE = "baseline"
+    UPSERT = "upsert"
+    CLOSED = "closed"
+    REOPENED = "reopened"
+    REMOVED = "removed"
+
+
+# SQL owns the persisted projections; this boundary rejects unknown fields/types.
+FIELDS = {
+    "jobs": "id company_id external_id title url location department remote closed_at",
+    "source_accounts": "id legacy_company_id ats public_board_ref public_url exclusion_state",
+    "source_listings": "id source_account_id external_id job_id current_version_id current_revision original_discovered_at source_published_at source_published_provenance discovery_anchor_at discovery_anchor_provenance discovery_expires_at source_availability suspected_id_reuse",
+    "job_versions": "id job_id source_listing_id revision content_hash public_metadata observed_at",
+    "companies": "id name ats token display_name industry industry_subcategory size hq_country",
+    "locations": "raw canonicals components source",
+    "brands": "id name",
+    "skills": "id canonical_name",
+}
+RELATION_FIELDS = "id evidence_kind public_evidence_ref observed_at valid_from valid_to status confidence revision"
+for _kind, _ends in {
+    "company_brands": "company_id brand_id",
+    "company_sources": "company_id source_account_id",
+    "job_locations": "job_version_id location_id",
+    "job_skills": "job_version_id skill_id",
+    "identity_assertions": "left_listing_id right_listing_id relation reviewed_at",
+}.items():
+    FIELDS[_kind] = RELATION_FIELDS + " " + _ends
+UUID_FIELDS = {
+    "source_account_id",
+    "current_version_id",
+    "source_listing_id",
+    "job_version_id",
+    "brand_id",
+    "skill_id",
+    "left_listing_id",
+    "right_listing_id",
+}
+INT_FIELDS = {"company_id", "legacy_company_id", "revision", "current_revision"}
+
+
+@dataclass(frozen=True)
+class PublicChange:
+    aggregate_type: AggregateType
+    aggregate_id: str
+    kind: ChangeKind
+    body: dict
+    occurred_at: datetime
+
+
+def event_id(kind: str, aggregate_id: str, revision: int) -> UUID:
+    return uuid5(
+        EVENT_NAMESPACE, canonical_json([str(kind), aggregate_id, revision]).decode()
+    )
+
+
+def validate_change(value) -> PublicChange:
+    if not isinstance(value, PublicChange):
+        raise ValueError("PublicChange required")
+    if not isinstance(value.aggregate_type, AggregateType) or not isinstance(
+        value.kind, ChangeKind
+    ):
+        raise ValueError("typed aggregate and change enums required")
+    if (
+        not isinstance(value.aggregate_id, str)
+        or not value.aggregate_id
+        or len(value.aggregate_id.encode()) > 2048
+    ):
+        raise ValueError("bounded aggregate ID required")
+    if (
+        not isinstance(value.occurred_at, datetime)
+        or value.occurred_at.tzinfo is None
+        or value.occurred_at.utcoffset() is None
+    ):
+        raise ValueError("aware public observation time required")
+    body = value.body
+    if not isinstance(body, dict) or set(body) - set(
+        FIELDS[value.aggregate_type].split()
+    ):
+        raise ValueError("unknown public fields")
+    identity = "raw" if value.aggregate_type == AggregateType.LOCATION else "id"
+    if str(body.get(identity)) != value.aggregate_id:
+        raise ValueError("aggregate endpoint identity mismatch")
+    required = {
+        "jobs": {"id", "company_id", "external_id", "title", "url"},
+        "source_accounts": {"id", "ats", "public_board_ref"},
+        "source_listings": {
+            "id",
+            "source_account_id",
+            "external_id",
+            "job_id",
+            "current_revision",
+            "discovery_anchor_at",
+            "discovery_expires_at",
+        },
+        "job_versions": {
+            "id",
+            "job_id",
+            "source_listing_id",
+            "revision",
+            "content_hash",
+            "public_metadata",
+            "observed_at",
+        },
+        "companies": {"id", "name", "ats", "token"},
+        "locations": {"raw", "canonicals", "components", "source"},
+        "brands": {"id", "name"},
+        "skills": {"id", "canonical_name"},
+        "company_brands": {
+            "id",
+            "company_id",
+            "brand_id",
+            "revision",
+            "status",
+            "evidence_kind",
+            "public_evidence_ref",
+        },
+        "company_sources": {
+            "id",
+            "company_id",
+            "source_account_id",
+            "revision",
+            "status",
+            "evidence_kind",
+            "public_evidence_ref",
+        },
+        "job_locations": {
+            "id",
+            "job_version_id",
+            "location_id",
+            "revision",
+            "status",
+            "evidence_kind",
+            "public_evidence_ref",
+        },
+        "job_skills": {
+            "id",
+            "job_version_id",
+            "skill_id",
+            "revision",
+            "status",
+            "evidence_kind",
+            "public_evidence_ref",
+        },
+        "identity_assertions": {
+            "id",
+            "left_listing_id",
+            "right_listing_id",
+            "relation",
+            "revision",
+            "status",
+            "evidence_kind",
+            "public_evidence_ref",
+        },
+    }[value.aggregate_type]
+    if not required <= set(body) or any(body[k] is None for k in required):
+        raise ValueError("required typed public endpoint fields missing")
+    try:
+        for key, item in body.items():
+            if item is None:
+                continue
+            if (
+                key in UUID_FIELDS
+                or key == "id"
+                and value.aggregate_type
+                not in {AggregateType.JOB, AggregateType.COMPANY}
+            ):
+                if not isinstance(item, str):
+                    raise ValueError("UUID string required")
+                UUID(item)
+            elif (
+                key in INT_FIELDS
+                or key == "id"
+                and value.aggregate_type == AggregateType.COMPANY
+            ):
+                if type(item) is not int or item < 0:
+                    raise ValueError("nonnegative integer required")
+            elif key in {"remote", "suspected_id_reuse"}:
+                if type(item) is not bool:
+                    raise ValueError("boolean required")
+            elif key == "public_metadata":
+                if not isinstance(item, dict) or set(item) - {
+                    "title",
+                    "url",
+                    "location",
+                    "department",
+                    "remote",
+                    "description_hash",
+                }:
+                    raise ValueError("invalid version metadata")
+                for k, v in item.items():
+                    if type(v) is not bool if k == "remote" else not isinstance(v, str):
+                        raise ValueError("invalid metadata value")
+            elif key in {"canonicals", "components"}:
+                if not isinstance(item, (list, dict)):
+                    raise ValueError("structured location field required")
+            elif key == "confidence":
+                if type(item) not in {int, float} or not 0 <= item <= 1:
+                    raise ValueError("confidence outside 0..1")
+            elif not isinstance(item, str):
+                raise ValueError("public string required")
+            if isinstance(item, str) and (
+                key.endswith("_at") or key in {"valid_from", "valid_to"}
+            ):
+                parsed = datetime.fromisoformat(item.replace("Z", "+00:00"))
+                if parsed.tzinfo is None:
+                    raise ValueError("aware public timestamp required")
+            if key in {"url", "public_url", "public_evidence_ref"} and item is not None:
+                # Legacy mapping evidence is an explicit typed board coordinate.
+                if (
+                    key == "public_evidence_ref"
+                    and body.get("evidence_kind") == "legacy_mapping"
+                ):
+                    continue
+                parsed = urlsplit(item)
+                if (
+                    parsed.scheme not in {"http", "https"}
+                    or not parsed.hostname
+                    or parsed.username
+                    or parsed.password
+                ):
+                    raise ValueError("public URL required")
+            if key == "content_hash" and (
+                len(item) != 64 or any(c not in "0123456789abcdef" for c in item)
+            ):
+                raise ValueError("content hash requires sha256 hex")
+        if len(canonical_json(body)) > 8192:
+            raise ValueError("public event body exceeds 8KiB")
+    except (TypeError, OverflowError) as exc:
+        raise ValueError("invalid public body") from exc
+    return value
diff --git a/job_discovery/archive/types.py b/job_discovery/archive/types.py
new file mode 100644
index 0000000..878930e
--- /dev/null
+++ b/job_discovery/archive/types.py
@@ -0,0 +1,110 @@
+"""Immutable service contracts shared by producer, offline codec and later exporter."""
+
+from dataclasses import dataclass, field
+from datetime import datetime
+from uuid import UUID
+from job_discovery.lifecycle.types import ClaimRef
+
+
+@dataclass(frozen=True)
+class EventRef:
+    event_id: UUID
+    aggregate_type: str
+    aggregate_id: str
+    revision: int
+
+
+@dataclass(frozen=True)
+class BatchLimits:
+    max_events: int = 2000
+    max_expanded_bytes: int = 8 * 1024**2
+    flush_after_seconds: int = 300
+
+    def __post_init__(self):
+        for value, maximum in [
+            (self.max_events, 2000),
+            (self.max_expanded_bytes, 8 * 1024**2),
+            (self.flush_after_seconds, 300),
+        ]:
+            if type(value) is not int or not 1 <= value <= maximum:
+                raise ValueError("batch limits exceed approved bounds")
+
+
+@dataclass(frozen=True)
+class BatchRef:
+    batch_id: UUID
+    claim: ClaimRef
+    ordered_event_ids: tuple[UUID, ...]
+    serializer_version: int
+    sealed_at: datetime
+    eligible_until: datetime
+    event_bytes: tuple[bytes, ...] = field(repr=False)
+    prior_batch_id: UUID | None = None
+
+
+@dataclass(frozen=True)
+class SealedBatch:
+    batch: BatchRef
+    data_key: str
+    manifest_key: str
+    canonical_hash: str
+    compressed_hash: str
+    manifest_hash: str
+    event_count: int
+    expanded_bytes: int
+    compressed_bytes: int
+    manifest_bytes: int
+    canonical_data: bytes = field(repr=False)
+    compressed_data: bytes = field(repr=False)
+    manifest_data: bytes = field(repr=False)
+
+    @property
+    def batch_id(self):
+        return self.batch.batch_id
+
+    @property
+    def claim(self):
+        return self.batch.claim
+
+    @property
+    def ordered_event_ids(self):
+        return self.batch.ordered_event_ids
+
+    @property
+    def serializer_version(self):
+        return self.batch.serializer_version
+
+    @property
+    def sealed_at(self):
+        return self.batch.sealed_at
+
+    @property
+    def eligible_until(self):
+        return self.batch.eligible_until
+
+
+@dataclass(frozen=True)
+class VerificationReceipt:
+    key: str
+    sha256: str
+    byte_count: int
+    receipt: str
+
+
+@dataclass(frozen=True)
+class VerifiedBatch:
+    seal: SealedBatch
+    data_receipt: VerificationReceipt
+    manifest_receipt: VerificationReceipt
+
+
+@dataclass(frozen=True)
+class AckResult:
+    exact_event_ids: tuple[UUID, ...]
+    archived_revision_markers: tuple[tuple[str, str, int], ...]
+
+
+@dataclass(frozen=True)
+class ProjectionResult:
+    applied_event_ids: tuple[UUID, ...]
+    ignored_event_ids: tuple[UUID, ...]
diff --git a/job_discovery/lifecycle/identity.py b/job_discovery/lifecycle/identity.py
index ccb4fde..92cfa19 100644
--- a/job_discovery/lifecycle/identity.py
+++ b/job_discovery/lifecycle/identity.py
@@ -255,39 +255,39 @@ def _source_publication(ats, raw, now):
         return None
     try:
         value = datetime.fromisoformat(value.replace("Z", "+00:00"))
     except ValueError:
         return None
     anchor, provenance = choose_anchor(value, now, now)
     return anchor if provenance == "source_published" else None
 
 
 def _version_room(conn, listing):
-    # No archive producer exists yet. Retain all evidence and pause rather than
-    # delete to satisfy a cap, including archived rows still referenced privately.
+    # Retain evidence until maintenance can retire exact archived, unreferenced
+    # versions. Private references may continue to prevent retirement.
     # A changed version would supersede the current row too, so include its age.
     row = conn.execute(
         """SELECT count(*) n,
         bool_or(recorded_at<clock_timestamp()-interval '30 days') old
         FROM job_versions WHERE source_listing_id=%s""",
         (listing["id"],),
     ).fetchone()
     return row["n"] < 11 and not row["old"]
 
 
 def capture_version(
     conn, listing_id: UUID, metadata: dict, observed_at: datetime, claim: ClaimRef
 ) -> UUID | None:
     """Capture one meaningful public revision, or pause at the retention bound.
 
-    The caller owns the transaction. Archive activation still fails closed in
-    database triggers until Task 10 pairs every eventful write with its outbox.
+    The caller owns the transaction. Shared _write pairs meaningful public
+    projections with the transactional outbox whenever the producer is active.
     """
     from .reconcile import _write
 
     allowed = {"title", "url", "location", "department", "remote", "description_hash"}
     if not isinstance(metadata, dict) or set(metadata) - allowed:
         raise ValueError("only typed public metadata is accepted")
     if not isinstance(observed_at, datetime) or observed_at.tzinfo is None:
         raise ValueError("aware observation timestamp required")
     normalized = {}
     for key, value in metadata.items():
diff --git a/job_discovery/lifecycle/maintenance.py b/job_discovery/lifecycle/maintenance.py
index 1234b4c..51f6a8a 100644
--- a/job_discovery/lifecycle/maintenance.py
+++ b/job_discovery/lifecycle/maintenance.py
@@ -171,25 +171,26 @@ def _payload_batch(conn, cursor, limit, dry_run, byte_limit=MAX_RETIRE_BYTES):
                 size += row['question_bytes']
             retired += 1
         visited += 1
         if not complete:
             break  # Resume this Job; an already-cleared field is simply absent.
         completed_cursor = job_id
     return max(visited, retired), retired, size, candidates, completed_cursor
 
 
 def _version_batch(conn, limit, dry_run, byte_limit=MAX_RETIRE_BYTES):
-    # A public version may be removed only once its listing revision is archived.
+    # Exact version/hash coverage is required; a listing watermark cannot certify unknown versions.
     # FK references are deliberately retained, including terminal private work.
     rows = conn.execute('''SELECT v.id,v.job_id,octet_length(v.public_metadata::text) AS bytes
       FROM job_versions v JOIN source_listings s ON s.id=v.source_listing_id
-      WHERE v.id IS DISTINCT FROM s.current_version_id AND v.revision<=s.archived_revision
+      WHERE v.id IS DISTINCT FROM s.current_version_id AND EXISTS(SELECT FROM public_archive_version_coverage c WHERE c.version_id=v.id
+        AND c.source_listing_id=v.source_listing_id AND c.version_revision=v.revision AND c.content_hash=v.content_hash)
       AND (v.recorded_at<=clock_timestamp()-interval '720 hours' OR
         (SELECT count(*) FROM job_versions newer WHERE newer.source_listing_id=v.source_listing_id
          AND newer.id IS DISTINCT FROM s.current_version_id AND newer.revision>v.revision)>=10)
       AND NOT EXISTS(SELECT FROM jobs WHERE description_version_id=v.id)
       AND NOT EXISTS(SELECT FROM job_questions WHERE job_version_id=v.id)
       AND NOT EXISTS(SELECT FROM job_reviews WHERE job_version_id=v.id)
       AND NOT EXISTS(SELECT FROM review_corrections WHERE job_version_id=v.id)
       AND NOT EXISTS(SELECT FROM application_packages WHERE job_version_id=v.id)
       AND NOT EXISTS(SELECT FROM resume_scores WHERE job_version_id=v.id)
       AND NOT EXISTS(SELECT FROM cover_letter_edits WHERE job_version_id=v.id)
diff --git a/job_discovery/lifecycle/operational.py b/job_discovery/lifecycle/operational.py
new file mode 100644
index 0000000..d01dc47
--- /dev/null
+++ b/job_discovery/lifecycle/operational.py
@@ -0,0 +1,424 @@
+"""Bounded preallocated verification lane; physical MVCC reuse is not guaranteed.
+
+Provision only with ordinary positive capacity reservations. Above the guard,
+reuse existing source claims, listing marks, a per-source transaction receipt and
+fixed critical event slots. New identities and payloads are never admitted here.
+"""
+
+from time import monotonic
+import logging
+import psycopg
+
+from .claims import claim_work, cancel_claim
+from .capacity import reserve_capacity, bind_reservation, settle_capacity
+from .locks import enter_gate, lock_jobs
+
+log = logging.getLogger(__name__)
+
+
+class OperationalDeferred(RuntimeError):
+    pass
+
+
+def provision(conn, source_id, claim, *, limit=100, critical_slots=16):
+    if (
+        type(limit) is not int
+        or not 1 <= limit <= 100
+        or type(critical_slots) is not int
+        or not 0 <= critical_slots <= 100
+    ):
+        raise ValueError("preallocation chunk is limited to 100 listings/slots")
+    reservation = reserve_capacity(conn, claim, 65536 * (limit + critical_slots + 3))
+    if reservation is None:
+        return False
+    bind_reservation(
+        conn, reservation, job_id=None, scope="lifecycle_operational_sources"
+    )
+    conn.execute(
+        "INSERT INTO lifecycle_operational_sources(source_id) VALUES(%s) ON CONFLICT DO NOTHING",
+        (source_id,),
+    )
+    conn.execute(
+        "INSERT INTO lifecycle_operational_receipts(source_id) VALUES(%s) ON CONFLICT DO NOTHING",
+        (source_id,),
+    )
+    conn.execute(
+        """INSERT INTO lifecycle_operational_listings(listing_id,source_id)
+      SELECT id,source_account_id FROM source_listings l WHERE source_account_id=%s
+      AND NOT EXISTS(SELECT FROM lifecycle_operational_listings p WHERE p.listing_id=l.id)
+      ORDER BY id LIMIT %s ON CONFLICT DO NOTHING""",
+        (source_id, limit),
+    )
+    # Slots are global. Never recycle pending/acked history or infer delete credit.
+    conn.execute(
+        """INSERT INTO public_critical_event_slots(slot)
+      SELECT n FROM generate_series(1,12500) n WHERE NOT EXISTS(SELECT FROM public_critical_event_slots s WHERE s.slot=n)
+      ORDER BY n LIMIT %s""",
+        (critical_slots,),
+    )
+    settle_capacity(conn, reservation)
+    return True
+
+
+def _receipt(conn, source_id, claim):
+    enter_gate(conn)
+    if conn.execute(
+        "SELECT 1 FROM lifecycle_operational_receipts WHERE transaction_id=pg_current_xact_id() AND backend_pid=pg_backend_pid() AND source_id<>%s",
+        (source_id,),
+    ).fetchone():
+        raise OperationalDeferred(
+            "one source operational receipt per transaction required"
+        )
+    valid = conn.execute(
+        """SELECT 1 FROM lifecycle_claims WHERE kind='source' AND work_id=%s AND owner_token=%s
+       AND generation=%s AND generation>replay_floor AND state='active' AND lease_until>clock_timestamp()
+       AND invoking_role=current_user AND subject_id IS NOT DISTINCT FROM app_user_id() FOR UPDATE""",
+        (str(source_id), claim.owner_token, claim.generation),
+    ).fetchone()
+    if not valid:
+        raise OperationalDeferred("existing source claim unavailable or fenced")
+    conn.execute(
+        "UPDATE lifecycle_claims SET lease_until=clock_timestamp()+interval '180 seconds' WHERE kind='source' AND work_id=%s",
+        (str(source_id),),
+    )
+    row = conn.execute(
+        """UPDATE lifecycle_operational_receipts SET backend_pid=pg_backend_pid(),transaction_id=pg_current_xact_id(),
+      owner_token=%s,generation=%s,invoking_role=current_user,subject_id=app_user_id(),row_count=CASE WHEN transaction_id=pg_current_xact_id() THEN row_count ELSE 0 END WHERE source_id=%s RETURNING source_id""",
+        (claim.owner_token, claim.generation, source_id),
+    ).fetchone()
+    if not row:
+        raise OperationalDeferred("source receipt not preallocated")
+
+
+def start(conn, source_id, claim):
+    _receipt(conn, source_id, claim)
+    if conn.execute(
+        """SELECT 1 FROM source_listings l WHERE source_account_id=%s AND NOT EXISTS(
+       SELECT FROM lifecycle_operational_listings p WHERE p.listing_id=l.id) LIMIT 1""",
+        (source_id,),
+    ).fetchone():
+        raise OperationalDeferred("full existing membership not preallocated")
+    old = conn.execute(
+        "SELECT * FROM lifecycle_operational_sources WHERE source_id=%s FOR UPDATE",
+        (source_id,),
+    ).fetchone()
+    if old is None:
+        raise OperationalDeferred("source operational state not preallocated")
+    conn.execute(
+        "UPDATE lifecycle_operational_sources SET last_turn_at=clock_timestamp() WHERE source_id=%s",
+        (source_id,),
+    )
+    if old["status"] == "complete" and not old["reconciled"]:
+        return old["sequence"], True
+    row = conn.execute(
+        """UPDATE lifecycle_operational_sources SET sequence=sequence+1,status='running',started_at=clock_timestamp(),
+       completed_at=NULL,cursor=NULL,reconciled=false,members_seen=0 WHERE source_id=%s RETURNING sequence""",
+        (source_id,),
+    ).fetchone()
+    conn.execute(
+        "UPDATE source_accounts SET last_attempt_at=clock_timestamp(),last_outcome='attempting' WHERE id=%s",
+        (source_id,),
+    )
+    return row["sequence"], False
+
+
+def _state(conn, source_id, sequence):
+    row = conn.execute(
+        "SELECT * FROM lifecycle_operational_sources WHERE source_id=%s AND sequence=%s",
+        (source_id, sequence),
+    ).fetchone()
+    if not row:
+        raise OperationalDeferred("operational sequence replaced")
+    return row
+
+
+def _flush(conn):
+    from job_discovery.archive.outbox import budget_allows, outbox_health, _envelope
+    from job_discovery.archive.codec import canonical_json
+    from job_discovery.archive.schema import (
+        PublicChange,
+        AggregateType,
+        ChangeKind,
+        validate_change,
+    )
+
+    rows = conn.execute(
+        "SELECT * FROM public_critical_event_slots WHERE transaction_id=pg_current_xact_id() AND state='allocated' ORDER BY slot"
+    ).fetchall()
+    for row in rows:
+        validate_change(
+            PublicChange(
+                AggregateType(row["aggregate_type"]),
+                row["aggregate_id"],
+                ChangeKind(row["kind"]),
+                row["body"],
+                row["occurred_at"],
+            )
+        )
+        envelope = _envelope(row)
+        encoded = canonical_json(envelope)
+        health = outbox_health(conn)
+        if not budget_allows(health["events"], health["bytes"], len(encoded), True):
+            raise OperationalDeferred("critical outbox budget exhausted")
+        conn.execute(
+            """UPDATE public_critical_event_slots SET state='pending',event_id=%s,predecessor_id=%s,
+          canonical_event=%s,padding=''::bytea WHERE slot=%s""",
+            (envelope["event_id"], envelope["predecessor_id"], encoded, row["slot"]),
+        )
+
+
+def sightings(conn, source_id, sequence, claim, observations):
+    if len(observations) > 100:
+        raise ValueError("operational sighting chunk exceeds 100")
+    enter_gate(conn)
+    if _state(conn, source_id, sequence)["status"] != "running":
+        raise OperationalDeferred("operational enumeration not running")
+    rows = conn.execute(
+        """SELECT l.*,p.seen_sequence FROM source_listings l JOIN lifecycle_operational_listings p ON p.listing_id=l.id
+      WHERE l.source_account_id=%s AND l.external_id=ANY(%s)""",
+        (source_id, [o[0] for o in observations]),
+    ).fetchall()
+    lock_jobs(conn, [r["job_id"] for r in rows])
+    _receipt(conn, source_id, claim)
+    by_id = {r["external_id"]: r for r in rows}
+    for external_id, kind in observations:
+        if kind not in {"seen", "unlisted", "removed", "expired"}:
+            continue
+        row = by_id.get(external_id)
+        if not row or row["seen_sequence"] >= sequence:
+            continue
+        conn.execute(
+            """UPDATE lifecycle_operational_listings SET seen_sequence=%s,seen_at=clock_timestamp(),seen_kind=%s,
+          miss_count=0,first_miss_at=NULL WHERE listing_id=%s""",
+            (sequence, kind, row["id"]),
+        )
+        removed = kind in {"removed", "expired"}
+        conn.execute(
+            """UPDATE source_listings SET successful_last_observed_at=clock_timestamp(),
+          successful_sighting_count=successful_sighting_count+%s,source_availability=CASE WHEN %s THEN 'closed'
+          WHEN source_availability='closed' THEN 'open' ELSE source_availability END,
+          consecutive_complete_misses=0,first_complete_miss_at=NULL WHERE id=%s""",
+            (0 if removed else 1, removed, row["id"]),
+        )
+        conn.execute(
+            "UPDATE jobs SET closed_at=CASE WHEN %s THEN COALESCE(closed_at,clock_timestamp()) ELSE NULL END WHERE id=%s",
+            (removed, row["job_id"]),
+        )
+        _flush(conn)
+        row["seen_sequence"] = sequence
+    conn.execute(
+        "UPDATE lifecycle_operational_sources SET members_seen=members_seen+%s WHERE source_id=%s",
+        (len(observations), source_id),
+    )
+
+
+def complete(conn, source_id, sequence, claim, *, successful, failed=False):
+    _receipt(conn, source_id, claim)
+    state = _state(conn, source_id, sequence)
+    if state["status"] != "running":
+        raise OperationalDeferred("operational enumeration already terminal")
+    open_count = conn.execute(
+        """SELECT count(*) n FROM source_listings l JOIN jobs j ON j.id=l.job_id
+      WHERE l.source_account_id=%s AND j.closed_at IS NULL""",
+        (source_id,),
+    ).fetchone()["n"]
+    suspicious = state["members_seen"] == 0 and open_count > 20
+    status = (
+        "complete"
+        if successful and not suspicious
+        else ("failed" if failed else "partial")
+    )
+    conn.execute(
+        """UPDATE lifecycle_operational_sources SET status=%s,completed_at=clock_timestamp(),reconciled=%s WHERE source_id=%s""",
+        (status, status != "complete", source_id),
+    )
+    conn.execute(
+        """UPDATE source_accounts SET last_outcome=%s,last_complete_success_at=CASE WHEN %s THEN clock_timestamp() ELSE last_complete_success_at END,
+      failure_streak=CASE WHEN %s THEN 0 ELSE failure_streak+1 END,suspicious_empty_streak=CASE WHEN %s THEN suspicious_empty_streak+1 ELSE 0 END,
+      next_due_at=(date_trunc('day',last_attempt_at AT TIME ZONE 'UTC')+interval '24 hours' * CASE WHEN exclusion_state='failure_disabled' AND NOT %s
+       THEN LEAST(7,power(2,LEAST(failure_streak,3))) ELSE 1 END) AT TIME ZONE 'UTC' WHERE id=%s""",
+        (
+            "suspicious_empty" if suspicious else status,
+            status == "complete",
+            status == "complete",
+            suspicious,
+            status == "complete",
+            source_id,
+        ),
+    )
+    return status
+
+
+def reconcile(conn, source_id, sequence, claim, *, limit=100):
+    if type(limit) is not int or not 1 <= limit <= 100:
+        raise ValueError("operational reconcile chunk exceeds 100")
+    enter_gate(conn)
+    state = _state(conn, source_id, sequence)
+    if state["status"] != "complete":
+        return True
+    if state["reconciled"]:
+        return True
+    rows = conn.execute(
+        """SELECT p.*,l.job_id,l.successful_last_observed_at FROM lifecycle_operational_listings p
+       JOIN source_listings l ON l.id=p.listing_id WHERE p.source_id=%s
+       AND (%s::uuid IS NULL OR p.listing_id>%s) ORDER BY p.listing_id LIMIT %s""",
+        (source_id, state["cursor"], state["cursor"], limit),
+    ).fetchall()
+    lock_jobs(conn, [r["job_id"] for r in rows])
+    _receipt(conn, source_id, claim)
+    for row in rows:
+        if (
+            row["seen_sequence"] >= sequence
+            or row["miss_sequence"] >= sequence
+            or row["successful_last_observed_at"]
+            and row["successful_last_observed_at"] >= state["started_at"]
+        ):
+            continue
+        result = conn.execute(
+            """UPDATE lifecycle_operational_listings SET miss_sequence=%s,miss_count=LEAST(2,miss_count+1),
+           first_miss_at=COALESCE(first_miss_at,%s) WHERE listing_id=%s
+           RETURNING miss_count>=2 AND %s>=first_miss_at+interval '24 hours' closed,miss_count,first_miss_at""",
+            (sequence, state["completed_at"], row["listing_id"], state["completed_at"]),
+        ).fetchone()
+        conn.execute(
+            """UPDATE source_listings SET consecutive_complete_misses=%s,first_complete_miss_at=%s,
+          source_availability=CASE WHEN %s THEN 'closed' ELSE source_availability END WHERE id=%s""",
+            (
+                result["miss_count"],
+                result["first_miss_at"],
+                result["closed"],
+                row["listing_id"],
+            ),
+        )
+        if result["closed"]:
+            conn.execute(
+                "UPDATE jobs SET closed_at=COALESCE(closed_at,%s) WHERE id=%s",
+                (state["completed_at"], row["job_id"]),
+            )
+        _flush(conn)
+    done = len(rows) < limit
+    conn.execute(
+        "UPDATE lifecycle_operational_sources SET cursor=%s,reconciled=%s WHERE source_id=%s",
+        (rows[-1]["listing_id"] if rows else state["cursor"], done, source_id),
+    )
+    return done
+
+
+def run_due(conn, *, max_boards, deadline):
+    """Stream complete existing-ID membership; every commit is independently fenced."""
+    from job_discovery.adapters import ADAPTERS
+    from job_discovery.adapters.completeness import source_budget, SourceBudgetExceeded
+
+    sources = conn.execute(
+        """SELECT s.* FROM source_accounts s JOIN lifecycle_operational_sources p ON p.source_id=s.id
+      WHERE s.exclusion_state IN ('enabled','failure_disabled') AND (s.next_due_at IS NULL OR s.next_due_at<=clock_timestamp()
+       OR p.status='complete' AND NOT p.reconciled)
+      ORDER BY GREATEST(s.last_attempt_at,p.last_turn_at) NULLS FIRST,s.id LIMIT %s""",
+        (max_boards,),
+    ).fetchall()
+    conn.commit()
+    missing = conn.execute(
+        "SELECT count(*) n FROM source_accounts s WHERE exclusion_state IN ('enabled','failure_disabled') AND (next_due_at IS NULL OR next_due_at<=clock_timestamp()) AND NOT EXISTS(SELECT FROM lifecycle_operational_sources p WHERE p.source_id=s.id)"
+    ).fetchone()["n"]
+    conn.commit()
+    progress = {"complete": 0, "deferred": missing}
+    for source in sources:
+        if monotonic() >= deadline:
+            break
+        claim = None
+        try:
+            # This lane can only reuse a claim row provisioned by ordinary admission.
+            enter_gate(conn)
+            if not conn.execute(
+                "SELECT 1 FROM lifecycle_claims WHERE kind='source' AND work_id=%s",
+                (str(source["id"]),),
+            ).fetchone():
+                raise OperationalDeferred("source claim not preallocated")
+            claim = claim_work(conn, "source", str(source["id"]), 180)
+            if claim is None:
+                conn.rollback()
+                continue
+            sequence, resuming = start(conn, source["id"], claim)
+            conn.commit()
+            if not resuming:
+                success = False
+                failed = False
+                pending = []
+                try:
+
+                    def pulse():
+                        _receipt(conn, source["id"], claim)
+                        conn.execute(
+                            "UPDATE lifecycle_claims SET lease_until=clock_timestamp()+interval '180 seconds' WHERE owner_token=%s AND generation=%s",
+                            (claim.owner_token, claim.generation),
+                        )
+                        conn.commit()
+
+                    with source_budget(
+                        min(60, max(0, deadline - monotonic())), 50, pulse
+                    ):
+                        feed = ADAPTERS[source["ats"]](
+                            source["public_board_ref"], fetch_details=False
+                        )
+                        for count, posting in enumerate(feed, 1):
+                            if count > 10000:
+                                break
+                            pending.append(
+                                (
+                                    posting.external_id,
+                                    "unlisted"
+                                    if (posting.raw or {}).get("isListed") is False
+                                    else "seen",
+                                )
+                            )
+                            if len(pending) >= 100:
+                                sightings(conn, source["id"], sequence, claim, pending)
+                                conn.commit()
+                                pending = []
+                        else:
+                            success = feed.complete
+                except OperationalDeferred:
+                    raise
+                except psycopg.Error as exc:
+                    raise OperationalDeferred(
+                        "operational storage transaction deferred"
+                    ) from exc
+                except SourceBudgetExceeded:
+                    conn.rollback()
+                except Exception:
+                    conn.rollback()
+                    failed = True
+                if pending:
+                    sightings(conn, source["id"], sequence, claim, pending)
+                    conn.commit()
+                status = complete(
+                    conn,
+                    source["id"],
+                    sequence,
+                    claim,
+                    successful=success,
+                    failed=failed,
+                )
+                conn.commit()
+                if status != "complete":
+                    continue
+            while monotonic() < deadline:
+                done = reconcile(conn, source["id"], sequence, claim)
+                conn.commit()
+                if done:
+                    progress["complete"] += 1
+                    break
+        except Exception as error:
+            conn.rollback()
+            log.warning(
+                "source %s operational progress storage-deferred (%s)",
+                source["id"],
+                type(error).__name__,
+            )
+            progress["deferred"] += 1
+        finally:
+            if claim:
+                conn.rollback()
+                cancel_claim(conn, claim)
+                conn.commit()
+    return progress
diff --git a/job_discovery/lifecycle/reconcile.py b/job_discovery/lifecycle/reconcile.py
index 64789a2..402bf07 100644
--- a/job_discovery/lifecycle/reconcile.py
+++ b/job_discovery/lifecycle/reconcile.py
@@ -33,20 +33,22 @@ class StorageBlocked(RuntimeError):
 
 
 @contextmanager
 def _write(conn, claim, scope, job_id=None, size=32768):
     """Use the established reservation contract; never bypass enforced charging."""
     reservation = reserve_capacity(conn, claim, size)
     if reservation is None:
         raise StorageBlocked('source evidence storage blocked; reconciliation deferred')
     bind_reservation(conn, reservation, job_id=job_id, scope=scope)
     yield
+    from job_discovery.archive.outbox import flush_public_changes
+    flush_public_changes(conn, claim)
     settle_capacity(conn, reservation)
 
 
 def claim_due_source(conn) -> tuple[dict, ClaimRef] | None:
     enter_gate(conn)
     if not read_control(conn).source_enabled:
         return None
     # Order by the last claimed work turn, including reconciliation-only turns.
     # The persisted lease start prevents a huge pending tail starving other
     # sources while last_attempt_at continues to mean an actual feed attempt.
@@ -58,20 +60,22 @@ def claim_due_source(conn) -> tuple[dict, ClaimRef] | None:
           AND NOT EXISTS (SELECT FROM lifecycle_claims c WHERE c.kind='source'
             AND c.work_id=s.id::text AND c.state='active' AND c.lease_until>clock_timestamp())
         ORDER BY GREATEST(last_attempt_at,lease_until-interval '180 seconds') NULLS FIRST,
                  last_complete_success_at NULLS FIRST,id
         LIMIT 1""").fetchone()
     if not source:
         return None
     claim = claim_work(conn, 'source', str(source['id']), 180)
     if claim is None:
         raise StorageBlocked('source claim storage blocked; reconciliation deferred')
+    from .operational import provision
+    provision(conn,source['id'],claim)
     pending = conn.execute('''SELECT 1 FROM source_enumerations WHERE source_id=%s
         AND status='complete' AND reconciled_at IS NULL AND sequence>%s LIMIT 1''',
         (source['id'],source['replay_floor'])).fetchone() is not None
     with _write(conn, claim, 'source_accounts'):
         conn.execute("""UPDATE source_accounts SET last_attempt_at=CASE WHEN %s THEN last_attempt_at ELSE clock_timestamp() END,
             last_outcome=CASE WHEN %s THEN last_outcome ELSE 'attempting' END,
             claim_owner_token=%s,claim_generation=%s,lease_until=%s WHERE id=%s""",
             (pending,pending,claim.owner_token,claim.generation,claim.lease_until,source['id']))
     return source, claim
 
@@ -381,39 +385,15 @@ def verify_due_sources(conn, *, max_boards=100, seconds=300):
             health = 'healthy' if verdict.complete else ('failed' if verdict.failed else 'partial')
             log.warning('source %s %s-but-storage-blocked; reconciliation-deferred',source['id'],health)
         finally:
             conn.rollback()
             cancel_claim(conn,claim)
             conn.commit()
     return result
 
 
 def verify_storage_blocked(conn, *, max_boards, deadline):
-    """Read-only fallback: healthy feeds are storage-deferred, never source-failed.
-
-    Existing enforced source metadata writes require physical reservations. Do
-    not weaken that contract: report health in logs until persistence can resume.
-    """
-    from job_discovery.adapters import ADAPTERS
-    from job_discovery.adapters.completeness import source_budget
-    sources = conn.execute("""WITH due AS (SELECT *,row_number() OVER(ORDER BY last_attempt_at NULLS FIRST,id)-1 AS position,
-         count(*) OVER() AS total FROM source_accounts
-         WHERE exclusion_state IN ('enabled','failure_disabled')
-         AND (next_due_at IS NULL OR next_due_at<=clock_timestamp()))
-       SELECT * FROM due ORDER BY mod(position-mod(floor(extract(epoch FROM clock_timestamp())/86400)::bigint,total)+total,total)
-       LIMIT %s""", (max_boards,)).fetchall()
-    conn.commit()
-    for source in sources:
-        if monotonic() >= deadline:
-            break
-        try:
-            with source_budget(min(BOARD_SECONDS,deadline-monotonic()),BOARD_REQUESTS):
-                feed = ADAPTERS[source['ats']](source['public_board_ref'],fetch_details=False)
-                for count, _ in enumerate(feed,1):
-                    if count >= BOARD_ROWS:
-                        break
-                health = 'healthy' if feed.complete else 'partial'
-        except SourceBudgetExceeded:
-            health = 'partial'
-        except Exception:
-            health = 'failed'
-        log.warning('source %s attempted: %s; storage-blocked, reconciliation-deferred',source['id'],health)
+    """Persist bounded existing-source evidence through the preallocated lane."""
+    from .operational import run_due
+    progress = run_due(conn,max_boards=max_boards,deadline=deadline)
+    log.warning('source operational verification: %s; missing slots/readiness remain storage-deferred',progress)
+    return progress
diff --git a/migrations/2026-10-03-04-public-outbox.sql b/migrations/2026-10-03-04-public-outbox.sql
new file mode 100644
index 0000000..050e898
--- /dev/null
+++ b/migrations/2026-10-03-04-public-outbox.sql
@@ -0,0 +1,622 @@
+-- Task10: transactional public projections, exact membership and durable receipts.
+-- Defaults and destination/readiness guards remain unchanged: no activation here.
+CREATE TABLE IF NOT EXISTS public_archive_heads (
+ aggregate_type text NOT NULL, aggregate_id text NOT NULL, revision bigint NOT NULL CHECK(revision>0),
+ PRIMARY KEY(aggregate_type,aggregate_id)
+);
+CREATE TABLE IF NOT EXISTS public_change_requirements (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+ transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
+ aggregate_type text NOT NULL, aggregate_id text NOT NULL, revision bigint NOT NULL,
+ kind text NOT NULL CHECK(kind IN ('baseline','upsert','closed','reopened','removed')),
+ body jsonb NOT NULL CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=8192),
+ occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+ UNIQUE(aggregate_type,aggregate_id,revision)
+);
+CREATE TABLE IF NOT EXISTS public_outbox (
+ event_id uuid PRIMARY KEY,
+ requirement_id bigint NOT NULL UNIQUE REFERENCES public_change_requirements(id),
+ aggregate_type text NOT NULL, aggregate_id text NOT NULL, revision bigint NOT NULL CHECK(revision>0),
+ predecessor_id uuid, kind text NOT NULL,
+ body jsonb NOT NULL, occurred_at timestamptz NOT NULL,
+ canonical_event bytea NOT NULL CHECK(octet_length(canonical_event)<=12288),
+ body_bytes integer NOT NULL CHECK(body_bytes BETWEEN 1 AND 8192),
+ recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+ UNIQUE(aggregate_type,aggregate_id,revision)
+);
+CREATE INDEX IF NOT EXISTS idx_public_outbox_pending ON public_outbox(recorded_at,event_id);
+CREATE TABLE IF NOT EXISTS public_archive_batches (
+ batch_id uuid PRIMARY KEY, owner_token text NOT NULL,generation bigint NOT NULL,
+ serializer_version integer NOT NULL CHECK(serializer_version=1),
+ state text NOT NULL DEFAULT 'claimed' CHECK(state IN ('claimed','sealed','acked')),
+ sealed_at timestamptz NOT NULL,eligible_until timestamptz NOT NULL,
+ prior_batch_id uuid REFERENCES public_archive_batches(batch_id),
+ data_key text,manifest_key text,canonical_hash text,compressed_hash text,manifest_hash text,
+ event_count integer NOT NULL CHECK(event_count BETWEEN 1 AND 2000),
+ expanded_bytes integer NOT NULL CHECK(expanded_bytes BETWEEN 1 AND 8388608),
+ compressed_bytes integer,manifest_bytes integer,acked_at timestamptz,
+ CHECK(eligible_until=sealed_at+interval '17520 hours'),
+ CHECK(state='claimed' OR (data_key IS NOT NULL AND manifest_key IS NOT NULL AND canonical_hash IS NOT NULL
+ AND compressed_hash IS NOT NULL AND manifest_hash IS NOT NULL AND compressed_bytes BETWEEN 1 AND 16777216
+ AND manifest_bytes BETWEEN 1 AND 1048576))
+);
+CREATE TABLE IF NOT EXISTS public_archive_items (
+ batch_id uuid NOT NULL REFERENCES public_archive_batches(batch_id),position integer NOT NULL,
+ event_id uuid NOT NULL UNIQUE,aggregate_type text NOT NULL,aggregate_id text NOT NULL,revision bigint NOT NULL,
+ canonical_event bytea NOT NULL,
+ PRIMARY KEY(batch_id,position),CHECK(position BETWEEN 0 AND 1999)
+);
+CREATE TABLE IF NOT EXISTS public_archive_receipts (
+ batch_id uuid PRIMARY KEY REFERENCES public_archive_batches(batch_id),
+ data_receipt jsonb NOT NULL,manifest_receipt jsonb NOT NULL,
+ verified_at timestamptz NOT NULL DEFAULT clock_timestamp()
+);
+CREATE TABLE IF NOT EXISTS public_archive_coverage (
+ aggregate_type text NOT NULL,aggregate_id text NOT NULL,revision bigint NOT NULL,
+ event_id uuid NOT NULL UNIQUE,batch_id uuid NOT NULL REFERENCES public_archive_batches(batch_id),
+ archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+ PRIMARY KEY(aggregate_type,aggregate_id,revision)
+);
+CREATE TABLE IF NOT EXISTS public_archive_suppressions (
+ aggregate_type text NOT NULL,aggregate_id text NOT NULL,suppressed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+ reason text NOT NULL,PRIMARY KEY(aggregate_type,aggregate_id)
+);
+CREATE TABLE IF NOT EXISTS public_archive_version_coverage (
+ version_id uuid PRIMARY KEY,source_listing_id uuid NOT NULL,version_revision bigint NOT NULL,
+ content_hash text NOT NULL,event_id uuid NOT NULL,batch_id uuid NOT NULL REFERENCES public_archive_batches(batch_id),
+ archived_at timestamptz NOT NULL DEFAULT clock_timestamp()
+);
+CREATE OR REPLACE FUNCTION lifecycle_private.public_projection(t text,n jsonb) RETURNS jsonb
+LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
+DECLARE fields text[]; result jsonb;
+BEGIN
+ CASE t
+ WHEN 'jobs' THEN fields:=ARRAY['id','company_id','external_id','title','url','location','department','remote','closed_at'];
+ WHEN 'source_accounts' THEN fields:=ARRAY['id','legacy_company_id','ats','public_board_ref','public_url','exclusion_state'];
+ WHEN 'source_listings' THEN fields:=ARRAY['id','source_account_id','external_id','job_id','current_version_id','current_revision','original_discovered_at','source_published_at','source_published_provenance','discovery_anchor_at','discovery_anchor_provenance','discovery_expires_at','source_availability','suspected_id_reuse'];
+ WHEN 'job_versions' THEN fields:=ARRAY['id','job_id','source_listing_id','revision','content_hash','public_metadata','observed_at'];
+ WHEN 'companies' THEN fields:=ARRAY['id','name','ats','token','display_name','industry','industry_subcategory','size','hq_country'];
+ WHEN 'locations' THEN fields:=ARRAY['raw','canonicals','components','source'];
+ WHEN 'brands' THEN fields:=ARRAY['id','name'];
+ WHEN 'skills' THEN fields:=ARRAY['id','canonical_name'];
+ WHEN 'company_brands' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','company_id','brand_id'];
+ WHEN 'company_sources' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','company_id','source_account_id'];
+ WHEN 'job_locations' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','job_version_id','location_id'];
+ WHEN 'job_skills' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','job_version_id','skill_id'];
+ WHEN 'identity_assertions' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','left_listing_id','right_listing_id','relation','reviewed_at'];
+ ELSE RETURN NULL;
+ END CASE;
+ SELECT jsonb_object_agg(key,value) INTO result FROM jsonb_each(n) WHERE key=ANY(fields);
+ RETURN result;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.public_projection(text,jsonb) FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_private.require_public_change() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; aid text; rev bigint; k text;
+BEGIN
+ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+ IF NOT ctl.archive_ever_activated THEN RETURN NULL; END IF;
+ n:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(NEW)) END;
+ o:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(OLD)) END;
+ IF n IS NOT DISTINCT FROM o THEN RETURN NULL; END IF;
+ -- Safe local version retirement does not assert disappearance of public facts.
+ IF TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
+  SELECT FROM public.public_archive_version_coverage c WHERE c.version_id::text=o->>'id' AND c.content_hash=o->>'content_hash'
+   AND c.source_listing_id::text=o->>'source_listing_id' AND c.version_revision=(o->>'revision')::bigint) THEN RETURN NULL; END IF;
+ IF ctl.archive_stage<>'active' THEN RAISE EXCEPTION 'archive producer paused'; END IF;
+ aid:=COALESCE(n,o)->>CASE WHEN TG_TABLE_NAME='locations' THEN 'raw' ELSE 'id' END;
+ INSERT INTO public.public_archive_heads VALUES(TG_TABLE_NAME,aid,1)
+ ON CONFLICT(aggregate_type,aggregate_id) DO UPDATE SET revision=public.public_archive_heads.revision+1 RETURNING revision INTO rev;
+ k:=CASE WHEN rev=1 THEN 'baseline' WHEN TG_OP='DELETE' THEN 'removed'
+  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NOT NULL AND o->>'closed_at' IS NULL THEN 'closed'
+  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NULL AND o->>'closed_at' IS NOT NULL THEN 'reopened'
+  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='closed' AND o->>'source_availability'<>'closed' THEN 'closed'
+  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='open' AND o->>'source_availability'='closed' THEN 'reopened'
+  ELSE 'upsert' END;
+ INSERT INTO public.public_change_requirements(aggregate_type,aggregate_id,revision,kind,body)
+ VALUES(TG_TABLE_NAME,aid,rev,k,COALESCE(n,o));
+ RETURN NULL;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.require_public_change() FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_private.validate_public_pair() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+BEGIN
+ IF NOT EXISTS(SELECT FROM public.public_outbox e WHERE e.requirement_id=NEW.id
+  AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision
+  AND e.kind=NEW.kind AND e.body=NEW.body AND e.occurred_at=NEW.occurred_at) THEN
+  RAISE EXCEPTION 'public change requires exact transactional outbox event';
+ END IF;
+ RETURN NULL;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.validate_public_pair() FROM PUBLIC,anon,authenticated;
+DROP TRIGGER IF EXISTS public_pair ON public_change_requirements;
+CREATE CONSTRAINT TRIGGER public_pair AFTER INSERT ON public_change_requirements DEFERRABLE INITIALLY DEFERRED
+FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_public_pair();
+CREATE OR REPLACE FUNCTION lifecycle_private.preserve_archive_row() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+BEGIN
+ IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'archive pending/history cannot be truncated'; END IF;
+ IF TG_TABLE_NAME='public_archive_items' AND TG_OP='UPDATE' THEN
+  IF NEW.canonical_event=''::bytea AND (to_jsonb(NEW)-'canonical_event')=(to_jsonb(OLD)-'canonical_event') AND EXISTS(
+   SELECT FROM public.public_archive_batches b JOIN public.public_archive_receipts r USING(batch_id)
+   WHERE b.batch_id=NEW.batch_id AND b.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN NEW; END IF;
+  RAISE EXCEPTION 'immutable pending membership';
+ END IF;
+ IF TG_TABLE_NAME='public_archive_batches' AND TG_OP='UPDATE' THEN
+  IF (to_jsonb(NEW)-ARRAY['state','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation'])
+    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation']) THEN
+   RAISE EXCEPTION 'immutable batch membership and seal clock'; END IF;
+  IF OLD.state<>'claimed' AND (to_jsonb(NEW)-ARRAY['state','acked_at','owner_token','generation'])
+    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','acked_at','owner_token','generation']) THEN RAISE EXCEPTION 'immutable persisted seal'; END IF;
+  IF OLD.state='acked' AND NEW IS DISTINCT FROM OLD OR OLD.state='sealed' AND NEW.state='claimed' THEN RAISE EXCEPTION 'archive state cannot move backward'; END IF;
+  RETURN NEW;
+ END IF;
+ IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('public_outbox','public_change_requirements') THEN
+  IF TG_TABLE_NAME='public_outbox' AND EXISTS(SELECT FROM public.public_archive_coverage c
+    JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id::text=to_jsonb(OLD)->>'event_id') THEN RETURN OLD; END IF;
+  IF TG_TABLE_NAME='public_change_requirements' AND NOT EXISTS(SELECT FROM public.public_outbox WHERE requirement_id=(to_jsonb(OLD)->>'id')::bigint)
+   AND EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id)
+     WHERE c.aggregate_type=OLD.aggregate_type AND c.aggregate_id=OLD.aggregate_id AND c.revision=OLD.revision) THEN RETURN OLD; END IF;
+ END IF;
+ RAISE EXCEPTION 'immutable pending event or archive history';
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.preserve_archive_row() FROM PUBLIC,anon,authenticated;
+DO $$ DECLARE t text; BEGIN
+ FOREACH t IN ARRAY ARRAY['public_archive_heads','public_change_requirements','public_outbox','public_archive_batches','public_archive_items','public_archive_receipts','public_archive_coverage','public_archive_suppressions','public_archive_version_coverage'] LOOP
+  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
+  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
+  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
+  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
+  IF t<>'public_archive_heads' THEN
+   EXECUTE format('DROP TRIGGER IF EXISTS archive_immutable ON public.%I',t);
+   EXECUTE format('CREATE TRIGGER archive_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_archive_row()',t);
+  END IF;
+  EXECUTE format('DROP TRIGGER IF EXISTS archive_no_truncate ON public.%I',t);
+  EXECUTE format('CREATE TRIGGER archive_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row()',t);
+ END LOOP;
+ FOREACH t IN ARRAY ARRAY['jobs','source_accounts','source_listings','job_versions','companies','locations','brands','skills','company_brands','company_sources','job_locations','job_skills','identity_assertions'] LOOP
+  EXECUTE format('DROP TRIGGER IF EXISTS archive_public_change ON public.%I',t);
+  EXECUTE format('CREATE TRIGGER archive_public_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.require_public_change()',t);
+ END LOOP;
+END $$;
+REVOKE ALL ON SEQUENCE public_change_requirements_id_seq FROM PUBLIC,anon,authenticated;
+
+CREATE OR REPLACE FUNCTION lifecycle_validate_row() RETURNS trigger LANGUAGE plpgsql
+SET search_path=pg_catalog AS $$
+DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; jid text; growth bigint:=0;
+ payload text; oldpayload text; k text; vid text; owner_id uuid; protection boolean:=false;
+ rid uuid; json_keys text[];
+BEGIN
+ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+ n:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
+ o:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
+ jid:=CASE WHEN TG_TABLE_NAME='jobs' THEN n->>'id' ELSE n->>'job_id' END;
+ IF jid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0)); END IF;
+ -- Task10 AFTER projection trigger and deferred exact pairing replace the old placeholder.
+ IF ctl.safety_stage<>'enforced' THEN
+  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
+ END IF;
+ IF TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND TG_OP='DELETE' THEN
+  RAISE EXCEPTION 'lean lifecycle identity deletion is disabled after cutover';
+ END IF;
+ IF TG_TABLE_NAME IN ('jobs','job_questions') AND (TG_OP='DELETE' OR
+   (TG_TABLE_NAME='jobs' AND o->>'description' IS NOT NULL AND (n->>'description' IS DISTINCT FROM o->>'description' OR n->>'description_version_id' IS DISTINCT FROM o->>'description_version_id')) OR
+   (TG_TABLE_NAME='job_questions' AND (n->'questions' IS DISTINCT FROM o->'questions' OR n->>'job_version_id' IS DISTINCT FROM o->>'job_version_id'))) THEN
+  IF EXISTS(SELECT FROM public.job_reviews WHERE job_id=jid AND verdict='approve')
+   OR EXISTS(SELECT FROM public.review_corrections WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.application_packages WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.resume_scores WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.cover_letter_edits WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.generation_jobs WHERE job_id=jid AND status IN ('pending','running'))
+   OR EXISTS(SELECT FROM public.job_payload_demands WHERE job_id=jid AND status IN ('pending','running') AND COALESCE(lease_until,protection_until)>clock_timestamp())
+  THEN RAISE EXCEPTION 'job payload is protected'; END IF;
+ END IF;
+ IF TG_OP='DELETE' THEN RETURN OLD; END IF;
+ owner_id:=(n->>'user_id')::uuid;
+ IF current_user='authenticated' AND owner_id IS DISTINCT FROM public.app_user_id() THEN
+  RAISE EXCEPTION 'foreign lifecycle owner' USING ERRCODE='42501'; END IF;
+ protection:=TG_TABLE_NAME IN ('review_corrections','application_packages','resume_scores','cover_letter_edits')
+ OR (TG_TABLE_NAME='job_reviews' AND n->>'verdict'='approve')
+ OR (TG_TABLE_NAME='generation_jobs' AND n->>'status' IN ('pending','running','ready'))
+ OR (TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready');
+ IF protection THEN
+  vid:=n->>'job_version_id';
+  IF vid IS NULL OR (NOT (TG_TABLE_NAME='job_payload_demands' AND n->>'kind'='questions') AND n->>'description_snapshot' IS NULL AND NOT EXISTS(
+    SELECT FROM public.jobs WHERE id=jid AND description IS NOT NULL AND description_version_id::text=vid)) THEN
+   RAISE EXCEPTION 'protection requires version-ready payload or durable snapshot'; END IF;
+ END IF;
+ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready' AND n->>'kind'='questions'
+ AND (n->'questions_snapshot' IS NULL OR n->'questions_snapshot'='null'::jsonb)
+ AND NOT EXISTS(SELECT FROM public.job_questions WHERE job_id=jid AND job_version_id::text=n->>'job_version_id') THEN
+  RAISE EXCEPTION 'ready question demand requires version-ready questions or snapshot';
+ END IF;
+ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status' IN ('pending','running') THEN
+  IF COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz) IS NULL OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)<=clock_timestamp()
+    OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)>clock_timestamp()+interval '180 seconds' THEN
+   RAISE EXCEPTION 'active demand requires bounded database-time lease'; END IF;
+ END IF;
+ -- Payload fields are charged on every rewrite, including same-size replacements;
+ -- a prior DELETE or shrink never supplies physical allocation credit.
+ IF TG_TABLE_NAME IN ('jobs','job_questions','job_reviews','review_corrections','application_packages','resume_scores','cover_letter_edits','generation_jobs','job_payload_demands') THEN
+  -- Inspect actual declared types: JSON numeric/boolean/string scalars are
+  -- payload too. SQL numeric metadata is not confused with a JSON scalar.
+  SELECT array_agg(attname::text) INTO json_keys FROM pg_attribute
+   WHERE attrelid=TG_RELID AND attnum>0 AND NOT attisdropped
+   AND atttypid IN ('jsonb'::regtype,'json'::regtype);
+  FOR k,payload IN SELECT key,value FROM jsonb_each_text(n) LOOP
+   oldpayload:=o->>k;
+   IF payload IS NOT NULL AND payload IS DISTINCT FROM oldpayload
+     AND (k=ANY(json_keys) AND n->k NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
+       OR jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
+       OR jsonb_typeof(n->k)='string' AND
+       (octet_length(payload)>256 OR (k NOT IN (
+        'id','user_id','job_id','job_version_id','profile_version','verdict','stage1_decision',
+        'experience_match','confidence','work_arrangement','pay_period','status','kind',
+        'description_capture_provenance','capture_provenance','description_version_id',
+        'claim_owner_token','lease_until','protection_until') AND k NOT LIKE '%\_at' ESCAPE '\')))
+   THEN growth:=growth+octet_length(payload)*4+256; END IF;
+  END LOOP;
+  IF TG_TABLE_NAME='jobs' AND TG_OP='INSERT' THEN growth:=growth+octet_length(n::text)*4+1024; END IF;
+ ELSE
+  IF n IS DISTINCT FROM o THEN growth:=octet_length(n::text)*4+1024; END IF;
+ END IF;
+ IF growth>0 THEN
+  BEGIN rid:=NULLIF(current_setting('lifecycle.reservation',true),'')::uuid;
+  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'growth_without_reservation'; END;
+ END IF;
+ INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,reservation_id,job_id,scope,bytes,row_count)
+ VALUES(current_user,public.app_user_id(),rid,jid,TG_TABLE_NAME,growth,1);
+ RETURN NEW;
+END $$;
+
+REVOKE ALL ON FUNCTION lifecycle_validate_row() FROM PUBLIC,anon,authenticated;
+INSERT INTO schema_migrations(filename) VALUES('2026-10-03-04-public-outbox.sql') ON CONFLICT DO NOTHING;
+-- R6-4: provision below the physical guard, then reuse only fixed operational rows.
+CREATE TABLE IF NOT EXISTS lifecycle_operational_sources (
+ source_id uuid PRIMARY KEY REFERENCES source_accounts(id),
+ sequence bigint NOT NULL DEFAULT 0,status text NOT NULL DEFAULT 'idle'
+ CHECK(status IN ('idle','running','complete','partial','failed')),
+ started_at timestamptz,completed_at timestamptz,last_turn_at timestamptz,cursor uuid,reconciled boolean NOT NULL DEFAULT true,
+ members_seen bigint NOT NULL DEFAULT 0
+);
+CREATE TABLE IF NOT EXISTS lifecycle_operational_listings (
+ listing_id uuid PRIMARY KEY REFERENCES source_listings(id),source_id uuid NOT NULL REFERENCES source_accounts(id),
+ seen_sequence bigint NOT NULL DEFAULT 0,seen_at timestamptz,seen_kind text,
+ miss_sequence bigint NOT NULL DEFAULT 0,miss_count integer NOT NULL DEFAULT 0 CHECK(miss_count BETWEEN 0 AND 2),
+ first_miss_at timestamptz,
+ CHECK(seen_kind IS NULL OR seen_kind IN ('seen','unlisted','removed','expired'))
+);
+CREATE INDEX IF NOT EXISTS operational_listing_source ON lifecycle_operational_listings(source_id,listing_id);
+CREATE TABLE IF NOT EXISTS lifecycle_operational_receipts (
+ source_id uuid PRIMARY KEY REFERENCES source_accounts(id),
+ backend_pid integer,transaction_id xid8,owner_token text,generation bigint,invoking_role name,subject_id uuid,
+ row_count integer NOT NULL DEFAULT 0 CHECK(row_count BETWEEN 0 AND 500)
+);
+CREATE TABLE IF NOT EXISTS public_critical_event_slots (
+ slot integer PRIMARY KEY CHECK(slot BETWEEN 1 AND 12500),
+ state text NOT NULL DEFAULT 'free' CHECK(state IN ('free','allocated','pending','acked')),
+ transaction_id xid8,source_id uuid,aggregate_type text,aggregate_id text,revision bigint,
+ event_id uuid UNIQUE,predecessor_id uuid,kind text,body jsonb,occurred_at timestamptz,
+ canonical_event bytea,recorded_at timestamptz,
+ padding bytea NOT NULL DEFAULT decode(repeat('00',24576),'hex'),
+ CHECK(body IS NULL OR octet_length(body::text)<=8192),
+ CHECK(canonical_event IS NULL OR octet_length(canonical_event)<=12288),
+ CHECK(state='free' OR (aggregate_type IS NOT NULL AND aggregate_id IS NOT NULL AND revision IS NOT NULL)),
+ CHECK(state NOT IN ('pending','acked') OR (event_id IS NOT NULL AND canonical_event IS NOT NULL))
+);
+ALTER TABLE public_critical_event_slots ALTER COLUMN padding SET STORAGE EXTERNAL;
+CREATE OR REPLACE VIEW public_pending_events AS
+ SELECT event_id,requirement_id,aggregate_type,aggregate_id,revision,predecessor_id,kind,body,occurred_at,
+ canonical_event,body_bytes,recorded_at FROM public_outbox
+ UNION ALL
+ SELECT event_id,NULL::bigint,aggregate_type,aggregate_id,revision,predecessor_id,kind,body,occurred_at,
+ canonical_event,octet_length(body::text),recorded_at FROM public_critical_event_slots WHERE state='pending';
+REVOKE ALL ON public_pending_events FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_private.operational_receipt_valid(sid uuid) RETURNS boolean
+LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
+ SELECT EXISTS(SELECT FROM public.lifecycle_operational_receipts r JOIN public.lifecycle_claims c
+ ON c.kind='source' AND c.work_id=r.source_id::text AND c.owner_token=r.owner_token AND c.generation=r.generation
+ WHERE r.source_id=sid AND r.backend_pid=pg_backend_pid() AND r.transaction_id=pg_current_xact_id()
+ AND r.invoking_role=current_user AND r.subject_id IS NOT DISTINCT FROM public.app_user_id()
+ AND c.invoking_role=r.invoking_role AND c.subject_id IS NOT DISTINCT FROM r.subject_id
+ AND c.state='active' AND c.generation>c.replay_floor AND c.lease_until>clock_timestamp())
+$$;
+REVOKE ALL ON FUNCTION lifecycle_private.operational_receipt_valid(uuid) FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_private.operational_update(t text,n jsonb,o jsonb) RETURNS boolean
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE sid uuid; fields text[];
+BEGIN
+ IF t='source_accounts' THEN sid:=(n->>'id')::uuid;
+  fields:=ARRAY['last_attempt_at','last_complete_success_at','last_outcome','next_due_at','failure_streak','suspicious_empty_streak'];
+ ELSIF t='source_listings' THEN sid:=(n->>'source_account_id')::uuid;
+  fields:=ARRAY['source_availability','successful_last_observed_at','successful_sighting_count','consecutive_complete_misses','first_complete_miss_at'];
+ ELSIF t='jobs' THEN
+  SELECT l.source_account_id INTO sid FROM public.source_listings l JOIN public.lifecycle_operational_listings p ON p.listing_id=l.id
+    WHERE l.job_id=n->>'id' AND lifecycle_private.operational_receipt_valid(l.source_account_id) LIMIT 1;
+  fields:=ARRAY['closed_at'];
+ ELSE RETURN false;
+ END IF;
+ IF sid IS NULL OR NOT lifecycle_private.operational_receipt_valid(sid) THEN RETURN false; END IF;
+ IF t='source_accounts' AND n->>'last_outcome' NOT IN ('attempting','complete','partial','failed','suspicious_empty') THEN RAISE EXCEPTION 'invalid bounded source outcome'; END IF;
+ IF n-fields IS DISTINCT FROM o-fields THEN RAISE EXCEPTION 'operational update exceeds fixed field allowlist'; END IF;
+ IF t='source_listings' AND NOT EXISTS(SELECT FROM public.lifecycle_operational_listings WHERE listing_id=(n->>'id')::uuid) THEN
+  RAISE EXCEPTION 'operational listing not preallocated'; END IF;
+ UPDATE public.lifecycle_operational_receipts SET row_count=row_count+1 WHERE source_id=sid;
+ RETURN true;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.operational_update(text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_private.validate_operational_receipt() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+BEGIN
+ IF COALESCE(current_query(),'') !~* '^[[:space:]]*(COMMIT|END)([[:space:]]+(WORK|TRANSACTION))?[[:space:]]*;?[[:space:]]*$' THEN
+  RAISE EXCEPTION 'operational receipt requires standalone COMMIT'; END IF;
+ IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) THEN RAISE EXCEPTION 'operational receipt claim expired or fenced'; END IF;
+ IF EXISTS(SELECT FROM public.public_critical_event_slots WHERE transaction_id=pg_current_xact_id() AND state='allocated') THEN
+  RAISE EXCEPTION 'operational closure requires exact critical event'; END IF;
+ RETURN NULL;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.validate_operational_receipt() FROM PUBLIC,anon,authenticated;
+DROP TRIGGER IF EXISTS operational_commit_receipt ON lifecycle_operational_receipts;
+CREATE CONSTRAINT TRIGGER operational_commit_receipt AFTER UPDATE ON lifecycle_operational_receipts
+DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_operational_receipt();
+CREATE OR REPLACE FUNCTION lifecycle_private.preserve_operational_slot() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE envelope jsonb; total_count bigint; total_bytes bigint;
+BEGIN
+ IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'operational slots cannot be deleted or truncated'; END IF;
+ IF NEW.slot<>OLD.slot THEN RAISE EXCEPTION 'operational slot identity immutable'; END IF;
+ IF OLD.state='free' AND NEW.state='allocated' THEN
+  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) THEN RAISE EXCEPTION 'critical slot requires operational receipt'; END IF;
+ ELSIF OLD.state='allocated' AND NEW.state='pending' THEN
+  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) OR NEW.transaction_id<>pg_current_xact_id()
+   OR (to_jsonb(NEW)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) IS DISTINCT FROM
+      (to_jsonb(OLD)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) THEN
+   RAISE EXCEPTION 'critical event differs from allocated public change'; END IF;
+ ELSIF OLD.state='pending' AND NEW.state='acked' THEN
+  IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') OR NOT EXISTS(
+   SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id) THEN
+   RAISE EXCEPTION 'critical slot ack requires exact durable receipt'; END IF;
+ ELSIF OLD.state='acked' AND NEW.state='acked' AND NEW.body='{}'::jsonb AND NEW.canonical_event=''::bytea
+  AND (to_jsonb(NEW)-ARRAY['body','canonical_event'])=(to_jsonb(OLD)-ARRAY['body','canonical_event']) THEN
+  IF NOT EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_batches b USING(batch_id)
+    JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id AND b.state='acked'
+    AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RAISE EXCEPTION 'critical terminal retention not reached'; END IF;
+ ELSE RAISE EXCEPTION 'pending critical event is immutable; slots never recycled automatically'; END IF;
+ IF NEW.state='pending' THEN
+  envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
+  IF envelope->>'event_id' IS DISTINCT FROM NEW.event_id::text OR envelope->'body' IS DISTINCT FROM NEW.body
+    OR envelope->>'aggregate_type' IS DISTINCT FROM NEW.aggregate_type OR envelope->>'aggregate_id' IS DISTINCT FROM NEW.aggregate_id
+    OR (envelope->>'revision')::bigint IS DISTINCT FROM NEW.revision OR envelope->>'kind' IS DISTINCT FROM NEW.kind
+    OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR (envelope->>'occurred_at')::timestamptz IS DISTINCT FROM NEW.occurred_at THEN
+   RAISE EXCEPTION 'critical event envelope differs from exact projection'; END IF;
+  IF NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
+    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
+    AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
+    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN RAISE EXCEPTION 'critical predecessor unavailable'; END IF;
+  SELECT count(*),COALESCE(sum(octet_length(canonical_event)),0) INTO total_count,total_bytes FROM public.public_pending_events;
+  IF total_count+1>100000 OR total_bytes+octet_length(NEW.canonical_event)>134217728 THEN RAISE EXCEPTION 'critical outbox budget exhausted'; END IF;
+ END IF;
+ RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.preserve_operational_slot() FROM PUBLIC,anon,authenticated;
+DROP TRIGGER IF EXISTS critical_slot_integrity ON public_critical_event_slots;
+CREATE TRIGGER critical_slot_integrity BEFORE UPDATE OR DELETE ON public_critical_event_slots
+FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_operational_slot();
+DROP TRIGGER IF EXISTS critical_slot_no_truncate ON public_critical_event_slots;
+CREATE TRIGGER critical_slot_no_truncate BEFORE TRUNCATE ON public_critical_event_slots
+FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_operational_slot();
+DO $$ DECLARE t text; BEGIN
+ FOREACH t IN ARRAY ARRAY['lifecycle_operational_sources','lifecycle_operational_listings','lifecycle_operational_receipts','public_critical_event_slots'] LOOP
+  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
+  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
+  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
+  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
+ END LOOP;
+END $$;
+
+CREATE OR REPLACE FUNCTION lifecycle_validate_row() RETURNS trigger LANGUAGE plpgsql
+SET search_path=pg_catalog AS $$
+DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; jid text; growth bigint:=0;
+ payload text; oldpayload text; k text; vid text; owner_id uuid; protection boolean:=false;
+ rid uuid; json_keys text[];
+BEGIN
+ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+ n:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
+ o:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
+ jid:=CASE WHEN TG_TABLE_NAME='jobs' THEN n->>'id' ELSE n->>'job_id' END;
+ IF jid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0)); END IF;
+ -- Task10 AFTER projection trigger and deferred exact pairing replace the old placeholder.
+ IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND current_user NOT IN ('anon','authenticated') THEN
+  IF lifecycle_private.operational_update(TG_TABLE_NAME,n,o) THEN RETURN NEW; END IF;
+ END IF;
+ IF ctl.safety_stage<>'enforced' THEN
+  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
+ END IF;
+ IF TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND TG_OP='DELETE' THEN
+  RAISE EXCEPTION 'lean lifecycle identity deletion is disabled after cutover';
+ END IF;
+ IF TG_TABLE_NAME IN ('jobs','job_questions') AND (TG_OP='DELETE' OR
+   (TG_TABLE_NAME='jobs' AND o->>'description' IS NOT NULL AND (n->>'description' IS DISTINCT FROM o->>'description' OR n->>'description_version_id' IS DISTINCT FROM o->>'description_version_id')) OR
+   (TG_TABLE_NAME='job_questions' AND (n->'questions' IS DISTINCT FROM o->'questions' OR n->>'job_version_id' IS DISTINCT FROM o->>'job_version_id'))) THEN
+  IF EXISTS(SELECT FROM public.job_reviews WHERE job_id=jid AND verdict='approve')
+   OR EXISTS(SELECT FROM public.review_corrections WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.application_packages WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.resume_scores WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.cover_letter_edits WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.generation_jobs WHERE job_id=jid AND status IN ('pending','running'))
+   OR EXISTS(SELECT FROM public.job_payload_demands WHERE job_id=jid AND status IN ('pending','running') AND COALESCE(lease_until,protection_until)>clock_timestamp())
+  THEN RAISE EXCEPTION 'job payload is protected'; END IF;
+ END IF;
+ IF TG_OP='DELETE' THEN RETURN OLD; END IF;
+ owner_id:=(n->>'user_id')::uuid;
+ IF current_user='authenticated' AND owner_id IS DISTINCT FROM public.app_user_id() THEN
+  RAISE EXCEPTION 'foreign lifecycle owner' USING ERRCODE='42501'; END IF;
+ protection:=TG_TABLE_NAME IN ('review_corrections','application_packages','resume_scores','cover_letter_edits')
+ OR (TG_TABLE_NAME='job_reviews' AND n->>'verdict'='approve')
+ OR (TG_TABLE_NAME='generation_jobs' AND n->>'status' IN ('pending','running','ready'))
+ OR (TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready');
+ IF protection THEN
+  vid:=n->>'job_version_id';
+  IF vid IS NULL OR (NOT (TG_TABLE_NAME='job_payload_demands' AND n->>'kind'='questions') AND n->>'description_snapshot' IS NULL AND NOT EXISTS(
+    SELECT FROM public.jobs WHERE id=jid AND description IS NOT NULL AND description_version_id::text=vid)) THEN
+   RAISE EXCEPTION 'protection requires version-ready payload or durable snapshot'; END IF;
+ END IF;
+ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready' AND n->>'kind'='questions'
+ AND (n->'questions_snapshot' IS NULL OR n->'questions_snapshot'='null'::jsonb)
+ AND NOT EXISTS(SELECT FROM public.job_questions WHERE job_id=jid AND job_version_id::text=n->>'job_version_id') THEN
+  RAISE EXCEPTION 'ready question demand requires version-ready questions or snapshot';
+ END IF;
+ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status' IN ('pending','running') THEN
+  IF COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz) IS NULL OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)<=clock_timestamp()
+    OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)>clock_timestamp()+interval '180 seconds' THEN
+   RAISE EXCEPTION 'active demand requires bounded database-time lease'; END IF;
+ END IF;
+ -- Payload fields are charged on every rewrite, including same-size replacements;
+ -- a prior DELETE or shrink never supplies physical allocation credit.
+ IF TG_TABLE_NAME IN ('jobs','job_questions','job_reviews','review_corrections','application_packages','resume_scores','cover_letter_edits','generation_jobs','job_payload_demands') THEN
+  -- Inspect actual declared types: JSON numeric/boolean/string scalars are
+  -- payload too. SQL numeric metadata is not confused with a JSON scalar.
+  SELECT array_agg(attname::text) INTO json_keys FROM pg_attribute
+   WHERE attrelid=TG_RELID AND attnum>0 AND NOT attisdropped
+   AND atttypid IN ('jsonb'::regtype,'json'::regtype);
+  FOR k,payload IN SELECT key,value FROM jsonb_each_text(n) LOOP
+   oldpayload:=o->>k;
+   IF payload IS NOT NULL AND payload IS DISTINCT FROM oldpayload
+     AND (k=ANY(json_keys) AND n->k NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
+       OR jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
+       OR jsonb_typeof(n->k)='string' AND
+       (octet_length(payload)>256 OR (k NOT IN (
+        'id','user_id','job_id','job_version_id','profile_version','verdict','stage1_decision',
+        'experience_match','confidence','work_arrangement','pay_period','status','kind',
+        'description_capture_provenance','capture_provenance','description_version_id',
+        'claim_owner_token','lease_until','protection_until') AND k NOT LIKE '%\_at' ESCAPE '\')))
+   THEN growth:=growth+octet_length(payload)*4+256; END IF;
+  END LOOP;
+  IF TG_TABLE_NAME='jobs' AND TG_OP='INSERT' THEN growth:=growth+octet_length(n::text)*4+1024; END IF;
+ ELSE
+  IF n IS DISTINCT FROM o THEN growth:=octet_length(n::text)*4+1024; END IF;
+ END IF;
+ IF growth>0 THEN
+  BEGIN rid:=NULLIF(current_setting('lifecycle.reservation',true),'')::uuid;
+  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'growth_without_reservation'; END;
+ END IF;
+ INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,reservation_id,job_id,scope,bytes,row_count)
+ VALUES(current_user,public.app_user_id(),rid,jid,TG_TABLE_NAME,growth,1);
+ RETURN NEW;
+END $$;
+
+
+CREATE OR REPLACE FUNCTION lifecycle_private.require_public_change() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; aid text; rev bigint; k text; sid uuid; slot_id integer;
+BEGIN
+ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+ IF NOT ctl.archive_ever_activated THEN RETURN NULL; END IF;
+ n:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(NEW)) END;
+ o:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(OLD)) END;
+ IF n IS NOT DISTINCT FROM o THEN RETURN NULL; END IF;
+ -- Safe local version retirement does not assert disappearance of public facts.
+ IF TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
+  SELECT FROM public.public_archive_version_coverage c WHERE c.version_id::text=o->>'id' AND c.content_hash=o->>'content_hash'
+   AND c.source_listing_id::text=o->>'source_listing_id' AND c.version_revision=(o->>'revision')::bigint) THEN RETURN NULL; END IF;
+ IF ctl.archive_stage<>'active' THEN RAISE EXCEPTION 'archive producer paused'; END IF;
+ aid:=COALESCE(n,o)->>CASE WHEN TG_TABLE_NAME='locations' THEN 'raw' ELSE 'id' END;
+ SELECT source_id INTO sid FROM public.lifecycle_operational_receipts WHERE backend_pid=pg_backend_pid()
+  AND transaction_id=pg_current_xact_id() AND lifecycle_private.operational_receipt_valid(source_id) LIMIT 1;
+ IF sid IS NOT NULL AND NOT EXISTS(SELECT FROM public.public_archive_heads WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid) THEN
+  RAISE EXCEPTION 'operational archive baseline not ready'; END IF;
+ IF sid IS NOT NULL THEN
+  UPDATE public.public_archive_heads SET revision=revision+1 WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid RETURNING revision INTO rev;
+ ELSE
+ INSERT INTO public.public_archive_heads VALUES(TG_TABLE_NAME,aid,1)
+ ON CONFLICT(aggregate_type,aggregate_id) DO UPDATE SET revision=public.public_archive_heads.revision+1 RETURNING revision INTO rev;
+ END IF;
+ k:=CASE WHEN rev=1 THEN 'baseline' WHEN TG_OP='DELETE' THEN 'removed'
+  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NOT NULL AND o->>'closed_at' IS NULL THEN 'closed'
+  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NULL AND o->>'closed_at' IS NOT NULL THEN 'reopened'
+  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='closed' AND o->>'source_availability'<>'closed' THEN 'closed'
+  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='open' AND o->>'source_availability'='closed' THEN 'reopened'
+  ELSE 'upsert' END;
+ IF sid IS NOT NULL THEN
+  IF k NOT IN ('closed','reopened') THEN RAISE EXCEPTION 'only critical closure/reopen uses operational event slots'; END IF;
+  SELECT slot INTO slot_id FROM public.public_critical_event_slots WHERE state='free' ORDER BY slot LIMIT 1;
+  IF slot_id IS NULL THEN RAISE EXCEPTION 'critical operational event slots exhausted'; END IF;
+  UPDATE public.public_critical_event_slots SET state='allocated',transaction_id=pg_current_xact_id(),source_id=sid,
+   aggregate_type=TG_TABLE_NAME,aggregate_id=aid,revision=rev,kind=k,body=COALESCE(n,o),occurred_at=clock_timestamp(),recorded_at=clock_timestamp()
+   WHERE slot=slot_id;
+  RETURN NULL;
+ END IF;
+ INSERT INTO public.public_change_requirements(aggregate_type,aggregate_id,revision,kind,body)
+ VALUES(TG_TABLE_NAME,aid,rev,k,COALESCE(n,o));
+ RETURN NULL;
+END $$;
+CREATE OR REPLACE FUNCTION lifecycle_private.validate_outbox_insert() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE r public.public_change_requirements; usage_count bigint; usage_bytes bigint; critical boolean; envelope jsonb;
+BEGIN
+ SELECT * INTO r FROM public.public_change_requirements WHERE id=NEW.requirement_id AND transaction_id=pg_current_xact_id();
+ IF NOT FOUND OR (r.aggregate_type,r.aggregate_id,r.revision,r.kind,r.body,r.occurred_at)
+ IS DISTINCT FROM (NEW.aggregate_type,NEW.aggregate_id,NEW.revision,NEW.kind,NEW.body,NEW.occurred_at) THEN
+  RAISE EXCEPTION 'outbox requires exact current transaction projection'; END IF;
+ IF (NEW.revision=1) IS DISTINCT FROM (NEW.predecessor_id IS NULL) THEN RAISE EXCEPTION 'outbox predecessor inconsistent'; END IF;
+ IF NEW.revision>1 AND NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id
+   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
+  AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id
+   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN
+  RAISE EXCEPTION 'outbox predecessor unavailable'; END IF;
+ envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
+ IF envelope->>'event_id'<>NEW.event_id::text OR envelope->>'aggregate_type'<>NEW.aggregate_type
+ OR envelope->>'aggregate_id'<>NEW.aggregate_id OR (envelope->>'revision')::bigint<>NEW.revision
+ OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR envelope->>'kind'<>NEW.kind
+ OR envelope->'body'<>NEW.body OR (envelope->>'occurred_at')::timestamptz<>NEW.occurred_at THEN
+  RAISE EXCEPTION 'outbox canonical envelope differs'; END IF;
+ SELECT count(*),COALESCE(sum(octet_length(canonical_event)),0) INTO usage_count,usage_bytes FROM public.public_pending_events;
+ critical:=NEW.kind IN ('closed','reopened');
+ IF usage_count+1>(CASE WHEN critical THEN 100000 ELSE 87500 END)
+ OR usage_bytes+octet_length(NEW.canonical_event)>(CASE WHEN critical THEN 134217728 ELSE 117440512 END) THEN
+  RAISE EXCEPTION 'public outbox budget exhausted'; END IF;
+ RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.validate_outbox_insert() FROM PUBLIC,anon,authenticated;
+DROP TRIGGER IF EXISTS a_outbox_contract ON public_outbox;
+CREATE TRIGGER a_outbox_contract BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_outbox_insert();
+DROP TRIGGER IF EXISTS lifecycle_validate ON public_outbox;
+CREATE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();
+
+CREATE OR REPLACE FUNCTION lifecycle_private.validate_archive_item() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE b public.public_archive_batches;
+BEGIN
+ SELECT * INTO STRICT b FROM public.public_archive_batches WHERE batch_id=NEW.batch_id;
+ IF b.state<>'claimed' OR NEW.position>=b.event_count OR NOT EXISTS(SELECT FROM public.public_pending_events e
+  WHERE e.event_id=NEW.event_id AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id
+  AND e.revision=NEW.revision AND e.canonical_event=NEW.canonical_event) THEN
+  RAISE EXCEPTION 'batch item must match exact unsealed pending event'; END IF;
+ RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.validate_archive_item() FROM PUBLIC,anon,authenticated;
+DROP TRIGGER IF EXISTS archive_item_insert ON public_archive_items;
+CREATE TRIGGER archive_item_insert BEFORE INSERT ON public_archive_items FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_archive_item();
+
+CREATE OR REPLACE FUNCTION lifecycle_private.validate_operational_state() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE sid uuid;
+BEGIN
+ IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'preallocated operational identity cannot be deleted or truncated'; END IF;
+ sid:=NEW.source_id;
+ IF sid<>OLD.source_id OR NOT lifecycle_private.operational_receipt_valid(sid) THEN
+  RAISE EXCEPTION 'operational update requires same-source current receipt'; END IF;
+ IF TG_TABLE_NAME='lifecycle_operational_listings' AND to_jsonb(NEW)->>'listing_id' IS DISTINCT FROM to_jsonb(OLD)->>'listing_id' THEN
+  RAISE EXCEPTION 'operational listing identity immutable'; END IF;
+ UPDATE public.lifecycle_operational_receipts SET row_count=row_count+1 WHERE source_id=sid;
+ RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.validate_operational_state() FROM PUBLIC,anon,authenticated;
+DO $$ DECLARE t text; BEGIN
+ FOREACH t IN ARRAY ARRAY['lifecycle_operational_sources','lifecycle_operational_listings'] LOOP
+  EXECUTE format('DROP TRIGGER IF EXISTS operational_state_integrity ON public.%I',t);
+  EXECUTE format('CREATE TRIGGER operational_state_integrity BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_operational_state()',t);
+  EXECUTE format('DROP TRIGGER IF EXISTS operational_state_no_truncate ON public.%I',t);
+  EXECUTE format('CREATE TRIGGER operational_state_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.validate_operational_state()',t);
+ END LOOP;
+END $$;
diff --git a/pyproject.toml b/pyproject.toml
index bd8b760..140358a 100644
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
-packages = ["job_discovery", "job_discovery.adapters", "job_discovery.lifecycle", "reviewer", "company_discovery", "observability"]
+packages = ["job_discovery", "job_discovery.adapters", "job_discovery.lifecycle", "job_discovery.archive", "reviewer", "company_discovery", "observability"]
 
 [tool.ruff.lint.per-file-ignores]
 # Tests intentionally import after module-level env/stub setup.
 "tests/*" = ["E402"]
diff --git a/schema.sql b/schema.sql
index e84bbc0..bb27b29 100644
--- a/schema.sql
+++ b/schema.sql
@@ -2248,10 +2248,633 @@ RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalo
       THEN p_legacy_closed_at IS NOT NULL
     WHEN NOT EXISTS(SELECT 1 FROM public.source_listings l WHERE l.job_id=p_job_id AND l.source_availability<>'closed') THEN true
     WHEN NOT (ctl.feed_enabled OR ctl.source_enabled) THEN p_legacy_closed_at IS NOT NULL
     ELSE false END
   FROM public.lifecycle_control ctl WHERE ctl.singleton
 $$;
 REVOKE ALL ON FUNCTION public.lifecycle_source_closed(text,timestamptz) FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION public.lifecycle_source_closed(text,timestamptz) TO anon,authenticated;
 INSERT INTO public.schema_migrations(filename) VALUES('2026-10-07-04-lifecycle-feed.sql') ON CONFLICT DO NOTHING;
 COMMIT;
+
+-- Task10: transactional public projections, exact membership and durable receipts.
+-- Defaults and destination/readiness guards remain unchanged: no activation here.
+CREATE TABLE IF NOT EXISTS public_archive_heads (
+ aggregate_type text NOT NULL, aggregate_id text NOT NULL, revision bigint NOT NULL CHECK(revision>0),
+ PRIMARY KEY(aggregate_type,aggregate_id)
+);
+CREATE TABLE IF NOT EXISTS public_change_requirements (
+ id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
+ transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
+ aggregate_type text NOT NULL, aggregate_id text NOT NULL, revision bigint NOT NULL,
+ kind text NOT NULL CHECK(kind IN ('baseline','upsert','closed','reopened','removed')),
+ body jsonb NOT NULL CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=8192),
+ occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+ UNIQUE(aggregate_type,aggregate_id,revision)
+);
+CREATE TABLE IF NOT EXISTS public_outbox (
+ event_id uuid PRIMARY KEY,
+ requirement_id bigint NOT NULL UNIQUE REFERENCES public_change_requirements(id),
+ aggregate_type text NOT NULL, aggregate_id text NOT NULL, revision bigint NOT NULL CHECK(revision>0),
+ predecessor_id uuid, kind text NOT NULL,
+ body jsonb NOT NULL, occurred_at timestamptz NOT NULL,
+ canonical_event bytea NOT NULL CHECK(octet_length(canonical_event)<=12288),
+ body_bytes integer NOT NULL CHECK(body_bytes BETWEEN 1 AND 8192),
+ recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+ UNIQUE(aggregate_type,aggregate_id,revision)
+);
+CREATE INDEX IF NOT EXISTS idx_public_outbox_pending ON public_outbox(recorded_at,event_id);
+CREATE TABLE IF NOT EXISTS public_archive_batches (
+ batch_id uuid PRIMARY KEY, owner_token text NOT NULL,generation bigint NOT NULL,
+ serializer_version integer NOT NULL CHECK(serializer_version=1),
+ state text NOT NULL DEFAULT 'claimed' CHECK(state IN ('claimed','sealed','acked')),
+ sealed_at timestamptz NOT NULL,eligible_until timestamptz NOT NULL,
+ prior_batch_id uuid REFERENCES public_archive_batches(batch_id),
+ data_key text,manifest_key text,canonical_hash text,compressed_hash text,manifest_hash text,
+ event_count integer NOT NULL CHECK(event_count BETWEEN 1 AND 2000),
+ expanded_bytes integer NOT NULL CHECK(expanded_bytes BETWEEN 1 AND 8388608),
+ compressed_bytes integer,manifest_bytes integer,acked_at timestamptz,
+ CHECK(eligible_until=sealed_at+interval '17520 hours'),
+ CHECK(state='claimed' OR (data_key IS NOT NULL AND manifest_key IS NOT NULL AND canonical_hash IS NOT NULL
+ AND compressed_hash IS NOT NULL AND manifest_hash IS NOT NULL AND compressed_bytes BETWEEN 1 AND 16777216
+ AND manifest_bytes BETWEEN 1 AND 1048576))
+);
+CREATE TABLE IF NOT EXISTS public_archive_items (
+ batch_id uuid NOT NULL REFERENCES public_archive_batches(batch_id),position integer NOT NULL,
+ event_id uuid NOT NULL UNIQUE,aggregate_type text NOT NULL,aggregate_id text NOT NULL,revision bigint NOT NULL,
+ canonical_event bytea NOT NULL,
+ PRIMARY KEY(batch_id,position),CHECK(position BETWEEN 0 AND 1999)
+);
+CREATE TABLE IF NOT EXISTS public_archive_receipts (
+ batch_id uuid PRIMARY KEY REFERENCES public_archive_batches(batch_id),
+ data_receipt jsonb NOT NULL,manifest_receipt jsonb NOT NULL,
+ verified_at timestamptz NOT NULL DEFAULT clock_timestamp()
+);
+CREATE TABLE IF NOT EXISTS public_archive_coverage (
+ aggregate_type text NOT NULL,aggregate_id text NOT NULL,revision bigint NOT NULL,
+ event_id uuid NOT NULL UNIQUE,batch_id uuid NOT NULL REFERENCES public_archive_batches(batch_id),
+ archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+ PRIMARY KEY(aggregate_type,aggregate_id,revision)
+);
+CREATE TABLE IF NOT EXISTS public_archive_suppressions (
+ aggregate_type text NOT NULL,aggregate_id text NOT NULL,suppressed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
+ reason text NOT NULL,PRIMARY KEY(aggregate_type,aggregate_id)
+);
+CREATE TABLE IF NOT EXISTS public_archive_version_coverage (
+ version_id uuid PRIMARY KEY,source_listing_id uuid NOT NULL,version_revision bigint NOT NULL,
+ content_hash text NOT NULL,event_id uuid NOT NULL,batch_id uuid NOT NULL REFERENCES public_archive_batches(batch_id),
+ archived_at timestamptz NOT NULL DEFAULT clock_timestamp()
+);
+CREATE OR REPLACE FUNCTION lifecycle_private.public_projection(t text,n jsonb) RETURNS jsonb
+LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
+DECLARE fields text[]; result jsonb;
+BEGIN
+ CASE t
+ WHEN 'jobs' THEN fields:=ARRAY['id','company_id','external_id','title','url','location','department','remote','closed_at'];
+ WHEN 'source_accounts' THEN fields:=ARRAY['id','legacy_company_id','ats','public_board_ref','public_url','exclusion_state'];
+ WHEN 'source_listings' THEN fields:=ARRAY['id','source_account_id','external_id','job_id','current_version_id','current_revision','original_discovered_at','source_published_at','source_published_provenance','discovery_anchor_at','discovery_anchor_provenance','discovery_expires_at','source_availability','suspected_id_reuse'];
+ WHEN 'job_versions' THEN fields:=ARRAY['id','job_id','source_listing_id','revision','content_hash','public_metadata','observed_at'];
+ WHEN 'companies' THEN fields:=ARRAY['id','name','ats','token','display_name','industry','industry_subcategory','size','hq_country'];
+ WHEN 'locations' THEN fields:=ARRAY['raw','canonicals','components','source'];
+ WHEN 'brands' THEN fields:=ARRAY['id','name'];
+ WHEN 'skills' THEN fields:=ARRAY['id','canonical_name'];
+ WHEN 'company_brands' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','company_id','brand_id'];
+ WHEN 'company_sources' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','company_id','source_account_id'];
+ WHEN 'job_locations' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','job_version_id','location_id'];
+ WHEN 'job_skills' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','job_version_id','skill_id'];
+ WHEN 'identity_assertions' THEN fields:=ARRAY['id','evidence_kind','public_evidence_ref','observed_at','valid_from','valid_to','status','confidence','revision','left_listing_id','right_listing_id','relation','reviewed_at'];
+ ELSE RETURN NULL;
+ END CASE;
+ SELECT jsonb_object_agg(key,value) INTO result FROM jsonb_each(n) WHERE key=ANY(fields);
+ RETURN result;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.public_projection(text,jsonb) FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_private.require_public_change() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; aid text; rev bigint; k text;
+BEGIN
+ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+ IF NOT ctl.archive_ever_activated THEN RETURN NULL; END IF;
+ n:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(NEW)) END;
+ o:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(OLD)) END;
+ IF n IS NOT DISTINCT FROM o THEN RETURN NULL; END IF;
+ -- Safe local version retirement does not assert disappearance of public facts.
+ IF TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
+  SELECT FROM public.public_archive_version_coverage c WHERE c.version_id::text=o->>'id' AND c.content_hash=o->>'content_hash'
+   AND c.source_listing_id::text=o->>'source_listing_id' AND c.version_revision=(o->>'revision')::bigint) THEN RETURN NULL; END IF;
+ IF ctl.archive_stage<>'active' THEN RAISE EXCEPTION 'archive producer paused'; END IF;
+ aid:=COALESCE(n,o)->>CASE WHEN TG_TABLE_NAME='locations' THEN 'raw' ELSE 'id' END;
+ INSERT INTO public.public_archive_heads VALUES(TG_TABLE_NAME,aid,1)
+ ON CONFLICT(aggregate_type,aggregate_id) DO UPDATE SET revision=public.public_archive_heads.revision+1 RETURNING revision INTO rev;
+ k:=CASE WHEN rev=1 THEN 'baseline' WHEN TG_OP='DELETE' THEN 'removed'
+  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NOT NULL AND o->>'closed_at' IS NULL THEN 'closed'
+  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NULL AND o->>'closed_at' IS NOT NULL THEN 'reopened'
+  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='closed' AND o->>'source_availability'<>'closed' THEN 'closed'
+  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='open' AND o->>'source_availability'='closed' THEN 'reopened'
+  ELSE 'upsert' END;
+ INSERT INTO public.public_change_requirements(aggregate_type,aggregate_id,revision,kind,body)
+ VALUES(TG_TABLE_NAME,aid,rev,k,COALESCE(n,o));
+ RETURN NULL;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.require_public_change() FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_private.validate_public_pair() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+BEGIN
+ IF NOT EXISTS(SELECT FROM public.public_outbox e WHERE e.requirement_id=NEW.id
+  AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision
+  AND e.kind=NEW.kind AND e.body=NEW.body AND e.occurred_at=NEW.occurred_at) THEN
+  RAISE EXCEPTION 'public change requires exact transactional outbox event';
+ END IF;
+ RETURN NULL;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.validate_public_pair() FROM PUBLIC,anon,authenticated;
+DROP TRIGGER IF EXISTS public_pair ON public_change_requirements;
+CREATE CONSTRAINT TRIGGER public_pair AFTER INSERT ON public_change_requirements DEFERRABLE INITIALLY DEFERRED
+FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_public_pair();
+CREATE OR REPLACE FUNCTION lifecycle_private.preserve_archive_row() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+BEGIN
+ IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'archive pending/history cannot be truncated'; END IF;
+ IF TG_TABLE_NAME='public_archive_items' AND TG_OP='UPDATE' THEN
+  IF NEW.canonical_event=''::bytea AND (to_jsonb(NEW)-'canonical_event')=(to_jsonb(OLD)-'canonical_event') AND EXISTS(
+   SELECT FROM public.public_archive_batches b JOIN public.public_archive_receipts r USING(batch_id)
+   WHERE b.batch_id=NEW.batch_id AND b.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RETURN NEW; END IF;
+  RAISE EXCEPTION 'immutable pending membership';
+ END IF;
+ IF TG_TABLE_NAME='public_archive_batches' AND TG_OP='UPDATE' THEN
+  IF (to_jsonb(NEW)-ARRAY['state','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation'])
+    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','data_key','manifest_key','canonical_hash','compressed_hash','manifest_hash','compressed_bytes','manifest_bytes','acked_at','owner_token','generation']) THEN
+   RAISE EXCEPTION 'immutable batch membership and seal clock'; END IF;
+  IF OLD.state<>'claimed' AND (to_jsonb(NEW)-ARRAY['state','acked_at','owner_token','generation'])
+    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','acked_at','owner_token','generation']) THEN RAISE EXCEPTION 'immutable persisted seal'; END IF;
+  IF OLD.state='acked' AND NEW IS DISTINCT FROM OLD OR OLD.state='sealed' AND NEW.state='claimed' THEN RAISE EXCEPTION 'archive state cannot move backward'; END IF;
+  RETURN NEW;
+ END IF;
+ IF TG_OP='DELETE' AND TG_TABLE_NAME IN ('public_outbox','public_change_requirements') THEN
+  IF TG_TABLE_NAME='public_outbox' AND EXISTS(SELECT FROM public.public_archive_coverage c
+    JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id::text=to_jsonb(OLD)->>'event_id') THEN RETURN OLD; END IF;
+  IF TG_TABLE_NAME='public_change_requirements' AND NOT EXISTS(SELECT FROM public.public_outbox WHERE requirement_id=(to_jsonb(OLD)->>'id')::bigint)
+   AND EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id)
+     WHERE c.aggregate_type=OLD.aggregate_type AND c.aggregate_id=OLD.aggregate_id AND c.revision=OLD.revision) THEN RETURN OLD; END IF;
+ END IF;
+ RAISE EXCEPTION 'immutable pending event or archive history';
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.preserve_archive_row() FROM PUBLIC,anon,authenticated;
+DO $$ DECLARE t text; BEGIN
+ FOREACH t IN ARRAY ARRAY['public_archive_heads','public_change_requirements','public_outbox','public_archive_batches','public_archive_items','public_archive_receipts','public_archive_coverage','public_archive_suppressions','public_archive_version_coverage'] LOOP
+  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
+  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
+  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
+  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
+  IF t<>'public_archive_heads' THEN
+   EXECUTE format('DROP TRIGGER IF EXISTS archive_immutable ON public.%I',t);
+   EXECUTE format('CREATE TRIGGER archive_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_archive_row()',t);
+  END IF;
+  EXECUTE format('DROP TRIGGER IF EXISTS archive_no_truncate ON public.%I',t);
+  EXECUTE format('CREATE TRIGGER archive_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_archive_row()',t);
+ END LOOP;
+ FOREACH t IN ARRAY ARRAY['jobs','source_accounts','source_listings','job_versions','companies','locations','brands','skills','company_brands','company_sources','job_locations','job_skills','identity_assertions'] LOOP
+  EXECUTE format('DROP TRIGGER IF EXISTS archive_public_change ON public.%I',t);
+  EXECUTE format('CREATE TRIGGER archive_public_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.require_public_change()',t);
+ END LOOP;
+END $$;
+REVOKE ALL ON SEQUENCE public_change_requirements_id_seq FROM PUBLIC,anon,authenticated;
+
+CREATE OR REPLACE FUNCTION lifecycle_validate_row() RETURNS trigger LANGUAGE plpgsql
+SET search_path=pg_catalog AS $$
+DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; jid text; growth bigint:=0;
+ payload text; oldpayload text; k text; vid text; owner_id uuid; protection boolean:=false;
+ rid uuid; json_keys text[];
+BEGIN
+ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+ n:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
+ o:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
+ jid:=CASE WHEN TG_TABLE_NAME='jobs' THEN n->>'id' ELSE n->>'job_id' END;
+ IF jid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0)); END IF;
+ -- Task10 AFTER projection trigger and deferred exact pairing replace the old placeholder.
+ IF ctl.safety_stage<>'enforced' THEN
+  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
+ END IF;
+ IF TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND TG_OP='DELETE' THEN
+  RAISE EXCEPTION 'lean lifecycle identity deletion is disabled after cutover';
+ END IF;
+ IF TG_TABLE_NAME IN ('jobs','job_questions') AND (TG_OP='DELETE' OR
+   (TG_TABLE_NAME='jobs' AND o->>'description' IS NOT NULL AND (n->>'description' IS DISTINCT FROM o->>'description' OR n->>'description_version_id' IS DISTINCT FROM o->>'description_version_id')) OR
+   (TG_TABLE_NAME='job_questions' AND (n->'questions' IS DISTINCT FROM o->'questions' OR n->>'job_version_id' IS DISTINCT FROM o->>'job_version_id'))) THEN
+  IF EXISTS(SELECT FROM public.job_reviews WHERE job_id=jid AND verdict='approve')
+   OR EXISTS(SELECT FROM public.review_corrections WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.application_packages WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.resume_scores WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.cover_letter_edits WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.generation_jobs WHERE job_id=jid AND status IN ('pending','running'))
+   OR EXISTS(SELECT FROM public.job_payload_demands WHERE job_id=jid AND status IN ('pending','running') AND COALESCE(lease_until,protection_until)>clock_timestamp())
+  THEN RAISE EXCEPTION 'job payload is protected'; END IF;
+ END IF;
+ IF TG_OP='DELETE' THEN RETURN OLD; END IF;
+ owner_id:=(n->>'user_id')::uuid;
+ IF current_user='authenticated' AND owner_id IS DISTINCT FROM public.app_user_id() THEN
+  RAISE EXCEPTION 'foreign lifecycle owner' USING ERRCODE='42501'; END IF;
+ protection:=TG_TABLE_NAME IN ('review_corrections','application_packages','resume_scores','cover_letter_edits')
+ OR (TG_TABLE_NAME='job_reviews' AND n->>'verdict'='approve')
+ OR (TG_TABLE_NAME='generation_jobs' AND n->>'status' IN ('pending','running','ready'))
+ OR (TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready');
+ IF protection THEN
+  vid:=n->>'job_version_id';
+  IF vid IS NULL OR (NOT (TG_TABLE_NAME='job_payload_demands' AND n->>'kind'='questions') AND n->>'description_snapshot' IS NULL AND NOT EXISTS(
+    SELECT FROM public.jobs WHERE id=jid AND description IS NOT NULL AND description_version_id::text=vid)) THEN
+   RAISE EXCEPTION 'protection requires version-ready payload or durable snapshot'; END IF;
+ END IF;
+ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready' AND n->>'kind'='questions'
+ AND (n->'questions_snapshot' IS NULL OR n->'questions_snapshot'='null'::jsonb)
+ AND NOT EXISTS(SELECT FROM public.job_questions WHERE job_id=jid AND job_version_id::text=n->>'job_version_id') THEN
+  RAISE EXCEPTION 'ready question demand requires version-ready questions or snapshot';
+ END IF;
+ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status' IN ('pending','running') THEN
+  IF COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz) IS NULL OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)<=clock_timestamp()
+    OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)>clock_timestamp()+interval '180 seconds' THEN
+   RAISE EXCEPTION 'active demand requires bounded database-time lease'; END IF;
+ END IF;
+ -- Payload fields are charged on every rewrite, including same-size replacements;
+ -- a prior DELETE or shrink never supplies physical allocation credit.
+ IF TG_TABLE_NAME IN ('jobs','job_questions','job_reviews','review_corrections','application_packages','resume_scores','cover_letter_edits','generation_jobs','job_payload_demands') THEN
+  -- Inspect actual declared types: JSON numeric/boolean/string scalars are
+  -- payload too. SQL numeric metadata is not confused with a JSON scalar.
+  SELECT array_agg(attname::text) INTO json_keys FROM pg_attribute
+   WHERE attrelid=TG_RELID AND attnum>0 AND NOT attisdropped
+   AND atttypid IN ('jsonb'::regtype,'json'::regtype);
+  FOR k,payload IN SELECT key,value FROM jsonb_each_text(n) LOOP
+   oldpayload:=o->>k;
+   IF payload IS NOT NULL AND payload IS DISTINCT FROM oldpayload
+     AND (k=ANY(json_keys) AND n->k NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
+       OR jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
+       OR jsonb_typeof(n->k)='string' AND
+       (octet_length(payload)>256 OR (k NOT IN (
+        'id','user_id','job_id','job_version_id','profile_version','verdict','stage1_decision',
+        'experience_match','confidence','work_arrangement','pay_period','status','kind',
+        'description_capture_provenance','capture_provenance','description_version_id',
+        'claim_owner_token','lease_until','protection_until') AND k NOT LIKE '%\_at' ESCAPE '\')))
+   THEN growth:=growth+octet_length(payload)*4+256; END IF;
+  END LOOP;
+  IF TG_TABLE_NAME='jobs' AND TG_OP='INSERT' THEN growth:=growth+octet_length(n::text)*4+1024; END IF;
+ ELSE
+  IF n IS DISTINCT FROM o THEN growth:=octet_length(n::text)*4+1024; END IF;
+ END IF;
+ IF growth>0 THEN
+  BEGIN rid:=NULLIF(current_setting('lifecycle.reservation',true),'')::uuid;
+  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'growth_without_reservation'; END;
+ END IF;
+ INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,reservation_id,job_id,scope,bytes,row_count)
+ VALUES(current_user,public.app_user_id(),rid,jid,TG_TABLE_NAME,growth,1);
+ RETURN NEW;
+END $$;
+
+REVOKE ALL ON FUNCTION lifecycle_validate_row() FROM PUBLIC,anon,authenticated;
+INSERT INTO schema_migrations(filename) VALUES('2026-10-03-04-public-outbox.sql') ON CONFLICT DO NOTHING;
+-- R6-4: provision below the physical guard, then reuse only fixed operational rows.
+CREATE TABLE IF NOT EXISTS lifecycle_operational_sources (
+ source_id uuid PRIMARY KEY REFERENCES source_accounts(id),
+ sequence bigint NOT NULL DEFAULT 0,status text NOT NULL DEFAULT 'idle'
+ CHECK(status IN ('idle','running','complete','partial','failed')),
+ started_at timestamptz,completed_at timestamptz,last_turn_at timestamptz,cursor uuid,reconciled boolean NOT NULL DEFAULT true,
+ members_seen bigint NOT NULL DEFAULT 0
+);
+CREATE TABLE IF NOT EXISTS lifecycle_operational_listings (
+ listing_id uuid PRIMARY KEY REFERENCES source_listings(id),source_id uuid NOT NULL REFERENCES source_accounts(id),
+ seen_sequence bigint NOT NULL DEFAULT 0,seen_at timestamptz,seen_kind text,
+ miss_sequence bigint NOT NULL DEFAULT 0,miss_count integer NOT NULL DEFAULT 0 CHECK(miss_count BETWEEN 0 AND 2),
+ first_miss_at timestamptz,
+ CHECK(seen_kind IS NULL OR seen_kind IN ('seen','unlisted','removed','expired'))
+);
+CREATE INDEX IF NOT EXISTS operational_listing_source ON lifecycle_operational_listings(source_id,listing_id);
+CREATE TABLE IF NOT EXISTS lifecycle_operational_receipts (
+ source_id uuid PRIMARY KEY REFERENCES source_accounts(id),
+ backend_pid integer,transaction_id xid8,owner_token text,generation bigint,invoking_role name,subject_id uuid,
+ row_count integer NOT NULL DEFAULT 0 CHECK(row_count BETWEEN 0 AND 500)
+);
+CREATE TABLE IF NOT EXISTS public_critical_event_slots (
+ slot integer PRIMARY KEY CHECK(slot BETWEEN 1 AND 12500),
+ state text NOT NULL DEFAULT 'free' CHECK(state IN ('free','allocated','pending','acked')),
+ transaction_id xid8,source_id uuid,aggregate_type text,aggregate_id text,revision bigint,
+ event_id uuid UNIQUE,predecessor_id uuid,kind text,body jsonb,occurred_at timestamptz,
+ canonical_event bytea,recorded_at timestamptz,
+ padding bytea NOT NULL DEFAULT decode(repeat('00',24576),'hex'),
+ CHECK(body IS NULL OR octet_length(body::text)<=8192),
+ CHECK(canonical_event IS NULL OR octet_length(canonical_event)<=12288),
+ CHECK(state='free' OR (aggregate_type IS NOT NULL AND aggregate_id IS NOT NULL AND revision IS NOT NULL)),
+ CHECK(state NOT IN ('pending','acked') OR (event_id IS NOT NULL AND canonical_event IS NOT NULL))
+);
+ALTER TABLE public_critical_event_slots ALTER COLUMN padding SET STORAGE EXTERNAL;
+CREATE OR REPLACE VIEW public_pending_events AS
+ SELECT event_id,requirement_id,aggregate_type,aggregate_id,revision,predecessor_id,kind,body,occurred_at,
+ canonical_event,body_bytes,recorded_at FROM public_outbox
+ UNION ALL
+ SELECT event_id,NULL::bigint,aggregate_type,aggregate_id,revision,predecessor_id,kind,body,occurred_at,
+ canonical_event,octet_length(body::text),recorded_at FROM public_critical_event_slots WHERE state='pending';
+REVOKE ALL ON public_pending_events FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_private.operational_receipt_valid(sid uuid) RETURNS boolean
+LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
+ SELECT EXISTS(SELECT FROM public.lifecycle_operational_receipts r JOIN public.lifecycle_claims c
+ ON c.kind='source' AND c.work_id=r.source_id::text AND c.owner_token=r.owner_token AND c.generation=r.generation
+ WHERE r.source_id=sid AND r.backend_pid=pg_backend_pid() AND r.transaction_id=pg_current_xact_id()
+ AND r.invoking_role=current_user AND r.subject_id IS NOT DISTINCT FROM public.app_user_id()
+ AND c.invoking_role=r.invoking_role AND c.subject_id IS NOT DISTINCT FROM r.subject_id
+ AND c.state='active' AND c.generation>c.replay_floor AND c.lease_until>clock_timestamp())
+$$;
+REVOKE ALL ON FUNCTION lifecycle_private.operational_receipt_valid(uuid) FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_private.operational_update(t text,n jsonb,o jsonb) RETURNS boolean
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE sid uuid; fields text[];
+BEGIN
+ IF t='source_accounts' THEN sid:=(n->>'id')::uuid;
+  fields:=ARRAY['last_attempt_at','last_complete_success_at','last_outcome','next_due_at','failure_streak','suspicious_empty_streak'];
+ ELSIF t='source_listings' THEN sid:=(n->>'source_account_id')::uuid;
+  fields:=ARRAY['source_availability','successful_last_observed_at','successful_sighting_count','consecutive_complete_misses','first_complete_miss_at'];
+ ELSIF t='jobs' THEN
+  SELECT l.source_account_id INTO sid FROM public.source_listings l JOIN public.lifecycle_operational_listings p ON p.listing_id=l.id
+    WHERE l.job_id=n->>'id' AND lifecycle_private.operational_receipt_valid(l.source_account_id) LIMIT 1;
+  fields:=ARRAY['closed_at'];
+ ELSE RETURN false;
+ END IF;
+ IF sid IS NULL OR NOT lifecycle_private.operational_receipt_valid(sid) THEN RETURN false; END IF;
+ IF t='source_accounts' AND n->>'last_outcome' NOT IN ('attempting','complete','partial','failed','suspicious_empty') THEN RAISE EXCEPTION 'invalid bounded source outcome'; END IF;
+ IF n-fields IS DISTINCT FROM o-fields THEN RAISE EXCEPTION 'operational update exceeds fixed field allowlist'; END IF;
+ IF t='source_listings' AND NOT EXISTS(SELECT FROM public.lifecycle_operational_listings WHERE listing_id=(n->>'id')::uuid) THEN
+  RAISE EXCEPTION 'operational listing not preallocated'; END IF;
+ UPDATE public.lifecycle_operational_receipts SET row_count=row_count+1 WHERE source_id=sid;
+ RETURN true;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.operational_update(text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
+CREATE OR REPLACE FUNCTION lifecycle_private.validate_operational_receipt() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+BEGIN
+ IF COALESCE(current_query(),'') !~* '^[[:space:]]*(COMMIT|END)([[:space:]]+(WORK|TRANSACTION))?[[:space:]]*;?[[:space:]]*$' THEN
+  RAISE EXCEPTION 'operational receipt requires standalone COMMIT'; END IF;
+ IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) THEN RAISE EXCEPTION 'operational receipt claim expired or fenced'; END IF;
+ IF EXISTS(SELECT FROM public.public_critical_event_slots WHERE transaction_id=pg_current_xact_id() AND state='allocated') THEN
+  RAISE EXCEPTION 'operational closure requires exact critical event'; END IF;
+ RETURN NULL;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.validate_operational_receipt() FROM PUBLIC,anon,authenticated;
+DROP TRIGGER IF EXISTS operational_commit_receipt ON lifecycle_operational_receipts;
+CREATE CONSTRAINT TRIGGER operational_commit_receipt AFTER UPDATE ON lifecycle_operational_receipts
+DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_operational_receipt();
+CREATE OR REPLACE FUNCTION lifecycle_private.preserve_operational_slot() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE envelope jsonb; total_count bigint; total_bytes bigint;
+BEGIN
+ IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'operational slots cannot be deleted or truncated'; END IF;
+ IF NEW.slot<>OLD.slot THEN RAISE EXCEPTION 'operational slot identity immutable'; END IF;
+ IF OLD.state='free' AND NEW.state='allocated' THEN
+  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) THEN RAISE EXCEPTION 'critical slot requires operational receipt'; END IF;
+ ELSIF OLD.state='allocated' AND NEW.state='pending' THEN
+  IF NOT lifecycle_private.operational_receipt_valid(NEW.source_id) OR NEW.transaction_id<>pg_current_xact_id()
+   OR (to_jsonb(NEW)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) IS DISTINCT FROM
+      (to_jsonb(OLD)-ARRAY['state','event_id','predecessor_id','canonical_event','padding']) THEN
+   RAISE EXCEPTION 'critical event differs from allocated public change'; END IF;
+ ELSIF OLD.state='pending' AND NEW.state='acked' THEN
+  IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') OR NOT EXISTS(
+   SELECT FROM public.public_archive_coverage c JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id) THEN
+   RAISE EXCEPTION 'critical slot ack requires exact durable receipt'; END IF;
+ ELSIF OLD.state='acked' AND NEW.state='acked' AND NEW.body='{}'::jsonb AND NEW.canonical_event=''::bytea
+  AND (to_jsonb(NEW)-ARRAY['body','canonical_event'])=(to_jsonb(OLD)-ARRAY['body','canonical_event']) THEN
+  IF NOT EXISTS(SELECT FROM public.public_archive_coverage c JOIN public.public_archive_batches b USING(batch_id)
+    JOIN public.public_archive_receipts r USING(batch_id) WHERE c.event_id=OLD.event_id AND b.state='acked'
+    AND b.acked_at<=clock_timestamp()-interval '7 days') THEN RAISE EXCEPTION 'critical terminal retention not reached'; END IF;
+ ELSE RAISE EXCEPTION 'pending critical event is immutable; slots never recycled automatically'; END IF;
+ IF NEW.state='pending' THEN
+  envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
+  IF envelope->>'event_id' IS DISTINCT FROM NEW.event_id::text OR envelope->'body' IS DISTINCT FROM NEW.body
+    OR envelope->>'aggregate_type' IS DISTINCT FROM NEW.aggregate_type OR envelope->>'aggregate_id' IS DISTINCT FROM NEW.aggregate_id
+    OR (envelope->>'revision')::bigint IS DISTINCT FROM NEW.revision OR envelope->>'kind' IS DISTINCT FROM NEW.kind
+    OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR (envelope->>'occurred_at')::timestamptz IS DISTINCT FROM NEW.occurred_at THEN
+   RAISE EXCEPTION 'critical event envelope differs from exact projection'; END IF;
+  IF NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
+    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
+    AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id AND e.aggregate_type=NEW.aggregate_type
+    AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN RAISE EXCEPTION 'critical predecessor unavailable'; END IF;
+  SELECT count(*),COALESCE(sum(octet_length(canonical_event)),0) INTO total_count,total_bytes FROM public.public_pending_events;
+  IF total_count+1>100000 OR total_bytes+octet_length(NEW.canonical_event)>134217728 THEN RAISE EXCEPTION 'critical outbox budget exhausted'; END IF;
+ END IF;
+ RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.preserve_operational_slot() FROM PUBLIC,anon,authenticated;
+DROP TRIGGER IF EXISTS critical_slot_integrity ON public_critical_event_slots;
+CREATE TRIGGER critical_slot_integrity BEFORE UPDATE OR DELETE ON public_critical_event_slots
+FOR EACH ROW EXECUTE FUNCTION lifecycle_private.preserve_operational_slot();
+DROP TRIGGER IF EXISTS critical_slot_no_truncate ON public_critical_event_slots;
+CREATE TRIGGER critical_slot_no_truncate BEFORE TRUNCATE ON public_critical_event_slots
+FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.preserve_operational_slot();
+DO $$ DECLARE t text; BEGIN
+ FOREACH t IN ARRAY ARRAY['lifecycle_operational_sources','lifecycle_operational_listings','lifecycle_operational_receipts','public_critical_event_slots'] LOOP
+  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
+  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
+  EXECUTE format('DROP TRIGGER IF EXISTS lifecycle_gate ON public.%I',t);
+  EXECUTE format('CREATE TRIGGER lifecycle_gate BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.lifecycle_gate()',t);
+ END LOOP;
+END $$;
+
+CREATE OR REPLACE FUNCTION lifecycle_validate_row() RETURNS trigger LANGUAGE plpgsql
+SET search_path=pg_catalog AS $$
+DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; jid text; growth bigint:=0;
+ payload text; oldpayload text; k text; vid text; owner_id uuid; protection boolean:=false;
+ rid uuid; json_keys text[];
+BEGIN
+ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+ n:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
+ o:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
+ jid:=CASE WHEN TG_TABLE_NAME='jobs' THEN n->>'id' ELSE n->>'job_id' END;
+ IF jid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle:job:'||jid,0)); END IF;
+ -- Task10 AFTER projection trigger and deferred exact pairing replace the old placeholder.
+ IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND current_user NOT IN ('anon','authenticated') THEN
+  IF lifecycle_private.operational_update(TG_TABLE_NAME,n,o) THEN RETURN NEW; END IF;
+ END IF;
+ IF ctl.safety_stage<>'enforced' THEN
+  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
+ END IF;
+ IF TG_TABLE_NAME IN ('jobs','source_accounts','source_listings') AND TG_OP='DELETE' THEN
+  RAISE EXCEPTION 'lean lifecycle identity deletion is disabled after cutover';
+ END IF;
+ IF TG_TABLE_NAME IN ('jobs','job_questions') AND (TG_OP='DELETE' OR
+   (TG_TABLE_NAME='jobs' AND o->>'description' IS NOT NULL AND (n->>'description' IS DISTINCT FROM o->>'description' OR n->>'description_version_id' IS DISTINCT FROM o->>'description_version_id')) OR
+   (TG_TABLE_NAME='job_questions' AND (n->'questions' IS DISTINCT FROM o->'questions' OR n->>'job_version_id' IS DISTINCT FROM o->>'job_version_id'))) THEN
+  IF EXISTS(SELECT FROM public.job_reviews WHERE job_id=jid AND verdict='approve')
+   OR EXISTS(SELECT FROM public.review_corrections WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.application_packages WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.resume_scores WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.cover_letter_edits WHERE job_id=jid)
+   OR EXISTS(SELECT FROM public.generation_jobs WHERE job_id=jid AND status IN ('pending','running'))
+   OR EXISTS(SELECT FROM public.job_payload_demands WHERE job_id=jid AND status IN ('pending','running') AND COALESCE(lease_until,protection_until)>clock_timestamp())
+  THEN RAISE EXCEPTION 'job payload is protected'; END IF;
+ END IF;
+ IF TG_OP='DELETE' THEN RETURN OLD; END IF;
+ owner_id:=(n->>'user_id')::uuid;
+ IF current_user='authenticated' AND owner_id IS DISTINCT FROM public.app_user_id() THEN
+  RAISE EXCEPTION 'foreign lifecycle owner' USING ERRCODE='42501'; END IF;
+ protection:=TG_TABLE_NAME IN ('review_corrections','application_packages','resume_scores','cover_letter_edits')
+ OR (TG_TABLE_NAME='job_reviews' AND n->>'verdict'='approve')
+ OR (TG_TABLE_NAME='generation_jobs' AND n->>'status' IN ('pending','running','ready'))
+ OR (TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready');
+ IF protection THEN
+  vid:=n->>'job_version_id';
+  IF vid IS NULL OR (NOT (TG_TABLE_NAME='job_payload_demands' AND n->>'kind'='questions') AND n->>'description_snapshot' IS NULL AND NOT EXISTS(
+    SELECT FROM public.jobs WHERE id=jid AND description IS NOT NULL AND description_version_id::text=vid)) THEN
+   RAISE EXCEPTION 'protection requires version-ready payload or durable snapshot'; END IF;
+ END IF;
+ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status'='ready' AND n->>'kind'='questions'
+ AND (n->'questions_snapshot' IS NULL OR n->'questions_snapshot'='null'::jsonb)
+ AND NOT EXISTS(SELECT FROM public.job_questions WHERE job_id=jid AND job_version_id::text=n->>'job_version_id') THEN
+  RAISE EXCEPTION 'ready question demand requires version-ready questions or snapshot';
+ END IF;
+ IF TG_TABLE_NAME='job_payload_demands' AND n->>'status' IN ('pending','running') THEN
+  IF COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz) IS NULL OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)<=clock_timestamp()
+    OR COALESCE((n->>'lease_until')::timestamptz,(n->>'protection_until')::timestamptz)>clock_timestamp()+interval '180 seconds' THEN
+   RAISE EXCEPTION 'active demand requires bounded database-time lease'; END IF;
+ END IF;
+ -- Payload fields are charged on every rewrite, including same-size replacements;
+ -- a prior DELETE or shrink never supplies physical allocation credit.
+ IF TG_TABLE_NAME IN ('jobs','job_questions','job_reviews','review_corrections','application_packages','resume_scores','cover_letter_edits','generation_jobs','job_payload_demands') THEN
+  -- Inspect actual declared types: JSON numeric/boolean/string scalars are
+  -- payload too. SQL numeric metadata is not confused with a JSON scalar.
+  SELECT array_agg(attname::text) INTO json_keys FROM pg_attribute
+   WHERE attrelid=TG_RELID AND attnum>0 AND NOT attisdropped
+   AND atttypid IN ('jsonb'::regtype,'json'::regtype);
+  FOR k,payload IN SELECT key,value FROM jsonb_each_text(n) LOOP
+   oldpayload:=o->>k;
+   IF payload IS NOT NULL AND payload IS DISTINCT FROM oldpayload
+     AND (k=ANY(json_keys) AND n->k NOT IN ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
+       OR jsonb_typeof(n->k) IN ('object','array') AND payload NOT IN ('{}','[]')
+       OR jsonb_typeof(n->k)='string' AND
+       (octet_length(payload)>256 OR (k NOT IN (
+        'id','user_id','job_id','job_version_id','profile_version','verdict','stage1_decision',
+        'experience_match','confidence','work_arrangement','pay_period','status','kind',
+        'description_capture_provenance','capture_provenance','description_version_id',
+        'claim_owner_token','lease_until','protection_until') AND k NOT LIKE '%\_at' ESCAPE '\')))
+   THEN growth:=growth+octet_length(payload)*4+256; END IF;
+  END LOOP;
+  IF TG_TABLE_NAME='jobs' AND TG_OP='INSERT' THEN growth:=growth+octet_length(n::text)*4+1024; END IF;
+ ELSE
+  IF n IS DISTINCT FROM o THEN growth:=octet_length(n::text)*4+1024; END IF;
+ END IF;
+ IF growth>0 THEN
+  BEGIN rid:=NULLIF(current_setting('lifecycle.reservation',true),'')::uuid;
+  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'growth_without_reservation'; END;
+ END IF;
+ INSERT INTO public.lifecycle_write_checks(invoking_role,subject_id,reservation_id,job_id,scope,bytes,row_count)
+ VALUES(current_user,public.app_user_id(),rid,jid,TG_TABLE_NAME,growth,1);
+ RETURN NEW;
+END $$;
+
+
+CREATE OR REPLACE FUNCTION lifecycle_private.require_public_change() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE ctl public.lifecycle_control; n jsonb; o jsonb; aid text; rev bigint; k text; sid uuid; slot_id integer;
+BEGIN
+ SELECT * INTO STRICT ctl FROM public.lifecycle_control WHERE singleton;
+ IF NOT ctl.archive_ever_activated THEN RETURN NULL; END IF;
+ n:=CASE WHEN TG_OP='DELETE' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(NEW)) END;
+ o:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE lifecycle_private.public_projection(TG_TABLE_NAME,to_jsonb(OLD)) END;
+ IF n IS NOT DISTINCT FROM o THEN RETURN NULL; END IF;
+ -- Safe local version retirement does not assert disappearance of public facts.
+ IF TG_TABLE_NAME='job_versions' AND TG_OP='DELETE' AND EXISTS(
+  SELECT FROM public.public_archive_version_coverage c WHERE c.version_id::text=o->>'id' AND c.content_hash=o->>'content_hash'
+   AND c.source_listing_id::text=o->>'source_listing_id' AND c.version_revision=(o->>'revision')::bigint) THEN RETURN NULL; END IF;
+ IF ctl.archive_stage<>'active' THEN RAISE EXCEPTION 'archive producer paused'; END IF;
+ aid:=COALESCE(n,o)->>CASE WHEN TG_TABLE_NAME='locations' THEN 'raw' ELSE 'id' END;
+ SELECT source_id INTO sid FROM public.lifecycle_operational_receipts WHERE backend_pid=pg_backend_pid()
+  AND transaction_id=pg_current_xact_id() AND lifecycle_private.operational_receipt_valid(source_id) LIMIT 1;
+ IF sid IS NOT NULL AND NOT EXISTS(SELECT FROM public.public_archive_heads WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid) THEN
+  RAISE EXCEPTION 'operational archive baseline not ready'; END IF;
+ IF sid IS NOT NULL THEN
+  UPDATE public.public_archive_heads SET revision=revision+1 WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=aid RETURNING revision INTO rev;
+ ELSE
+ INSERT INTO public.public_archive_heads VALUES(TG_TABLE_NAME,aid,1)
+ ON CONFLICT(aggregate_type,aggregate_id) DO UPDATE SET revision=public.public_archive_heads.revision+1 RETURNING revision INTO rev;
+ END IF;
+ k:=CASE WHEN rev=1 THEN 'baseline' WHEN TG_OP='DELETE' THEN 'removed'
+  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NOT NULL AND o->>'closed_at' IS NULL THEN 'closed'
+  WHEN TG_TABLE_NAME='jobs' AND n-'closed_at'=o-'closed_at' AND n->>'closed_at' IS NULL AND o->>'closed_at' IS NOT NULL THEN 'reopened'
+  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='closed' AND o->>'source_availability'<>'closed' THEN 'closed'
+  WHEN TG_TABLE_NAME='source_listings' AND n-'source_availability'=o-'source_availability' AND n->>'source_availability'='open' AND o->>'source_availability'='closed' THEN 'reopened'
+  ELSE 'upsert' END;
+ IF sid IS NOT NULL THEN
+  IF k NOT IN ('closed','reopened') THEN RAISE EXCEPTION 'only critical closure/reopen uses operational event slots'; END IF;
+  SELECT slot INTO slot_id FROM public.public_critical_event_slots WHERE state='free' ORDER BY slot LIMIT 1;
+  IF slot_id IS NULL THEN RAISE EXCEPTION 'critical operational event slots exhausted'; END IF;
+  UPDATE public.public_critical_event_slots SET state='allocated',transaction_id=pg_current_xact_id(),source_id=sid,
+   aggregate_type=TG_TABLE_NAME,aggregate_id=aid,revision=rev,kind=k,body=COALESCE(n,o),occurred_at=clock_timestamp(),recorded_at=clock_timestamp()
+   WHERE slot=slot_id;
+  RETURN NULL;
+ END IF;
+ INSERT INTO public.public_change_requirements(aggregate_type,aggregate_id,revision,kind,body)
+ VALUES(TG_TABLE_NAME,aid,rev,k,COALESCE(n,o));
+ RETURN NULL;
+END $$;
+CREATE OR REPLACE FUNCTION lifecycle_private.validate_outbox_insert() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE r public.public_change_requirements; usage_count bigint; usage_bytes bigint; critical boolean; envelope jsonb;
+BEGIN
+ SELECT * INTO r FROM public.public_change_requirements WHERE id=NEW.requirement_id AND transaction_id=pg_current_xact_id();
+ IF NOT FOUND OR (r.aggregate_type,r.aggregate_id,r.revision,r.kind,r.body,r.occurred_at)
+ IS DISTINCT FROM (NEW.aggregate_type,NEW.aggregate_id,NEW.revision,NEW.kind,NEW.body,NEW.occurred_at) THEN
+  RAISE EXCEPTION 'outbox requires exact current transaction projection'; END IF;
+ IF (NEW.revision=1) IS DISTINCT FROM (NEW.predecessor_id IS NULL) THEN RAISE EXCEPTION 'outbox predecessor inconsistent'; END IF;
+ IF NEW.revision>1 AND NOT EXISTS(SELECT FROM public.public_pending_events e WHERE e.event_id=NEW.predecessor_id
+   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1)
+  AND NOT EXISTS(SELECT FROM public.public_archive_coverage e WHERE e.event_id=NEW.predecessor_id
+   AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id AND e.revision=NEW.revision-1) THEN
+  RAISE EXCEPTION 'outbox predecessor unavailable'; END IF;
+ envelope:=convert_from(NEW.canonical_event,'UTF8')::jsonb;
+ IF envelope->>'event_id'<>NEW.event_id::text OR envelope->>'aggregate_type'<>NEW.aggregate_type
+ OR envelope->>'aggregate_id'<>NEW.aggregate_id OR (envelope->>'revision')::bigint<>NEW.revision
+ OR envelope->>'predecessor_id' IS DISTINCT FROM NEW.predecessor_id::text OR envelope->>'kind'<>NEW.kind
+ OR envelope->'body'<>NEW.body OR (envelope->>'occurred_at')::timestamptz<>NEW.occurred_at THEN
+  RAISE EXCEPTION 'outbox canonical envelope differs'; END IF;
+ SELECT count(*),COALESCE(sum(octet_length(canonical_event)),0) INTO usage_count,usage_bytes FROM public.public_pending_events;
+ critical:=NEW.kind IN ('closed','reopened');
+ IF usage_count+1>(CASE WHEN critical THEN 100000 ELSE 87500 END)
+ OR usage_bytes+octet_length(NEW.canonical_event)>(CASE WHEN critical THEN 134217728 ELSE 117440512 END) THEN
+  RAISE EXCEPTION 'public outbox budget exhausted'; END IF;
+ RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.validate_outbox_insert() FROM PUBLIC,anon,authenticated;
+DROP TRIGGER IF EXISTS a_outbox_contract ON public_outbox;
+CREATE TRIGGER a_outbox_contract BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_outbox_insert();
+DROP TRIGGER IF EXISTS lifecycle_validate ON public_outbox;
+CREATE TRIGGER lifecycle_validate BEFORE INSERT ON public_outbox FOR EACH ROW EXECUTE FUNCTION lifecycle_validate_row();
+
+CREATE OR REPLACE FUNCTION lifecycle_private.validate_archive_item() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE b public.public_archive_batches;
+BEGIN
+ SELECT * INTO STRICT b FROM public.public_archive_batches WHERE batch_id=NEW.batch_id;
+ IF b.state<>'claimed' OR NEW.position>=b.event_count OR NOT EXISTS(SELECT FROM public.public_pending_events e
+  WHERE e.event_id=NEW.event_id AND e.aggregate_type=NEW.aggregate_type AND e.aggregate_id=NEW.aggregate_id
+  AND e.revision=NEW.revision AND e.canonical_event=NEW.canonical_event) THEN
+  RAISE EXCEPTION 'batch item must match exact unsealed pending event'; END IF;
+ RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.validate_archive_item() FROM PUBLIC,anon,authenticated;
+DROP TRIGGER IF EXISTS archive_item_insert ON public_archive_items;
+CREATE TRIGGER archive_item_insert BEFORE INSERT ON public_archive_items FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_archive_item();
+
+CREATE OR REPLACE FUNCTION lifecycle_private.validate_operational_state() RETURNS trigger
+LANGUAGE plpgsql SET search_path=pg_catalog AS $$
+DECLARE sid uuid;
+BEGIN
+ IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'preallocated operational identity cannot be deleted or truncated'; END IF;
+ sid:=NEW.source_id;
+ IF sid<>OLD.source_id OR NOT lifecycle_private.operational_receipt_valid(sid) THEN
+  RAISE EXCEPTION 'operational update requires same-source current receipt'; END IF;
+ IF TG_TABLE_NAME='lifecycle_operational_listings' AND to_jsonb(NEW)->>'listing_id' IS DISTINCT FROM to_jsonb(OLD)->>'listing_id' THEN
+  RAISE EXCEPTION 'operational listing identity immutable'; END IF;
+ UPDATE public.lifecycle_operational_receipts SET row_count=row_count+1 WHERE source_id=sid;
+ RETURN NEW;
+END $$;
+REVOKE ALL ON FUNCTION lifecycle_private.validate_operational_state() FROM PUBLIC,anon,authenticated;
+DO $$ DECLARE t text; BEGIN
+ FOREACH t IN ARRAY ARRAY['lifecycle_operational_sources','lifecycle_operational_listings'] LOOP
+  EXECUTE format('DROP TRIGGER IF EXISTS operational_state_integrity ON public.%I',t);
+  EXECUTE format('CREATE TRIGGER operational_state_integrity BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION lifecycle_private.validate_operational_state()',t);
+  EXECUTE format('DROP TRIGGER IF EXISTS operational_state_no_truncate ON public.%I',t);
+  EXECUTE format('CREATE TRIGGER operational_state_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION lifecycle_private.validate_operational_state()',t);
+ END LOOP;
+END $$;
diff --git a/tests/archive_helpers.py b/tests/archive_helpers.py
new file mode 100644
index 0000000..c8e97f3
--- /dev/null
+++ b/tests/archive_helpers.py
@@ -0,0 +1,29 @@
+"""Owned-database only fixtures for ordinary Task10 producer behavior."""
+
+from job_discovery.lifecycle.claims import claim_work
+from job_discovery.archive.outbox import baseline_batch
+
+
+def activate_fixture(conn):
+    # Fixture-only state seed: production activation remains deliberately unavailable.
+    conn.execute(
+        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
+    )
+    conn.execute(
+        "UPDATE lifecycle_control SET archive_ever_activated=true,archive_stage='active',activation_generation=activation_generation+1"
+    )
+    conn.execute(
+        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
+    )
+    conn.commit()
+
+
+def seeded_events(conn, n=3):
+    for i in range(n):
+        conn.execute("INSERT INTO brands(name) VALUES(%s)", (f"Brand {i}",))
+    conn.commit()
+    activate_fixture(conn)
+    claim = claim_work(conn, "archive", "fixture", 180)
+    refs = baseline_batch(conn, "brands", claim)
+    conn.commit()
+    return claim, refs
diff --git a/tests/test_archive_batches.py b/tests/test_archive_batches.py
new file mode 100644
index 0000000..e3bc0b5
--- /dev/null
+++ b/tests/test_archive_batches.py
@@ -0,0 +1,242 @@
+"""Task10 persisted exact membership and acknowledgement with offline receipts."""
+
+from job_discovery.archive.batches import (
+    claim_batch,
+    seal_batch,
+    persist_seal,
+    ack_batch,
+)
+from job_discovery.archive.types import BatchLimits
+
+
+def test_batch_limits_are_bounded():
+    import pytest
+
+    with pytest.raises(ValueError):
+        BatchLimits(max_events=2001)
+    with pytest.raises(ValueError):
+        BatchLimits(max_expanded_bytes=8 * 1024**2 + 1)
+
+
+from dataclasses import replace
+import pytest
+from tests.conftest import requires_db
+from tests.archive_helpers import seeded_events
+from job_discovery.archive.types import VerifiedBatch, VerificationReceipt
+
+
+def verified(seal):
+    return VerifiedBatch(
+        seal,
+        VerificationReceipt(
+            seal.data_key, seal.compressed_hash, seal.compressed_bytes, "offline-data"
+        ),
+        VerificationReceipt(
+            seal.manifest_key,
+            seal.manifest_hash,
+            seal.manifest_bytes,
+            "offline-manifest",
+        ),
+    )
+
+
+@requires_db
+def test_persisted_exact_partial_membership_and_ack(conn):
+    claim, refs = seeded_events(conn)
+    batch = claim_batch(conn, BatchLimits(max_events=2), claim)
+    conn.commit()
+    seal = seal_batch(batch, 1)
+    assert seal == seal_batch(batch, 1)
+    persist_seal(conn, seal)
+    conn.commit()
+    result = ack_batch(conn, verified(seal), claim)
+    conn.commit()
+    assert result.exact_event_ids == batch.ordered_event_ids
+    pending = {
+        r["event_id"] for r in conn.execute("SELECT event_id FROM public_outbox")
+    }
+    assert pending == {r.event_id for r in refs} - set(batch.ordered_event_ids)
+    assert ack_batch(conn, verified(seal), claim) == result
+    conn.commit()
+
+
+@requires_db
+def test_seal_membership_and_clock_are_immutable(conn):
+    claim, _ = seeded_events(conn)
+    batch = claim_batch(conn, BatchLimits(), claim)
+    conn.commit()
+    seal = seal_batch(batch)
+    persist_seal(conn, seal)
+    conn.commit()
+    for statement in [
+        "UPDATE public_archive_batches SET sealed_at=sealed_at+interval '1 second',eligible_until=eligible_until+interval '1 second'",
+        "UPDATE public_archive_items SET position=position+10",
+        "UPDATE public_archive_batches SET manifest_hash='different'",
+    ]:
+        with pytest.raises(Exception, match="immutable"), conn.transaction():
+            conn.execute(statement)
+
+
+@requires_db
+def test_ack_rollback_retains_every_exact_pending_event(conn):
+    claim, refs = seeded_events(conn)
+    batch = claim_batch(conn, BatchLimits(), claim)
+    conn.commit()
+    seal = seal_batch(batch)
+    persist_seal(conn, seal)
+    conn.commit()
+    with pytest.raises(RuntimeError), conn.transaction():
+        ack_batch(conn, verified(seal), claim)
+        raise RuntimeError("crash before commit")
+    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == len(
+        refs
+    )
+    assert (
+        conn.execute("SELECT count(*) n FROM public_archive_receipts").fetchone()["n"]
+        == 0
+    )
+
+
+@requires_db
+def test_exact_receipts_and_suppressed_membership_fail_closed(conn):
+    claim, refs = seeded_events(conn)
+    batch = claim_batch(conn, BatchLimits(), claim)
+    conn.commit()
+    seal = seal_batch(batch)
+    persist_seal(conn, seal)
+    conn.commit()
+    bad = replace(
+        verified(seal),
+        data_receipt=VerificationReceipt(
+            seal.data_key, "bad", seal.compressed_bytes, "offline"
+        ),
+    )
+    with pytest.raises(ValueError, match="exact data"), conn.transaction():
+        ack_batch(conn, bad, claim)
+    conn.execute(
+        "INSERT INTO public_archive_suppressions(aggregate_type,aggregate_id,reason) VALUES('brands',%s,'local fixture')",
+        (refs[0].aggregate_id,),
+    )
+    conn.commit()
+    with pytest.raises(Exception, match="suppressed"), conn.transaction():
+        ack_batch(conn, verified(seal), claim)
+    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 3
+
+
+@requires_db
+def test_per_aggregate_ordering_survives_small_batches(conn):
+    from job_discovery.archive.outbox import flush_public_changes
+
+    claim, _ = seeded_events(conn, 1)
+    for i in range(2):
+        conn.execute("UPDATE brands SET name=%s", (f"Changed {i}",))
+        flush_public_changes(conn, claim)
+        conn.commit()
+    first = claim_batch(conn, BatchLimits(max_events=1), claim)
+    conn.commit()
+    assert claim_batch(conn, BatchLimits(), claim) is None
+    conn.commit()
+    seal = seal_batch(first)
+    persist_seal(conn, seal)
+    conn.commit()
+    ack_batch(conn, verified(seal), claim)
+    conn.commit()
+    rest = claim_batch(conn, BatchLimits(), claim)
+    assert len(rest.ordered_event_ids) == 2
+    conn.commit()
+
+
+@requires_db
+def test_later_lower_sequence_commit_remains_pending(conn):
+    from tests.lifecycle_helpers import open_sessions
+    from tests.conftest import TEST_DSN
+    from job_discovery.archive.outbox import flush_public_changes
+    from job_discovery.lifecycle.claims import claim_work
+
+    claim, _ = seeded_events(conn, 1)
+    # Allocate sequence before the gate: sequence allocation never certifies commit membership.
+    other = open_sessions(TEST_DSN, 1)[0]
+    try:
+        lower = other.execute(
+            "SELECT nextval('public_change_requirements_id_seq') n"
+        ).fetchone()["n"]
+        other.commit()
+        conn.execute("UPDATE brands SET name='Before batch'")
+        flush_public_changes(conn, claim)
+        conn.commit()
+        batch = claim_batch(conn, BatchLimits(), claim)
+        conn.commit()
+        late_claim = claim_work(other, "archive", "late", 180)
+        other.execute(
+            "SELECT setval('public_change_requirements_id_seq',%s,false)", (lower,)
+        )
+        other.execute("INSERT INTO brands(name) VALUES('Late commit')")
+        # The real newly committed requirement has the earlier reserved sequence.
+        req = other.execute(
+            "SELECT id FROM public_change_requirements WHERE transaction_id=pg_current_xact_id()"
+        ).fetchone()["id"]
+        assert lower == req
+        # Actual pending sequence is independent of its event UUID; no production sequence watermark is used.
+        late = flush_public_changes(other, late_claim)
+        other.commit()
+        seal = seal_batch(batch)
+        persist_seal(conn, seal)
+        conn.commit()
+        ack_batch(conn, verified(seal), claim)
+        conn.commit()
+        assert {
+            r["event_id"]
+            for r in conn.execute("SELECT event_id FROM public_pending_events")
+        } == {r.event_id for r in late}
+    finally:
+        other.close()
+
+
+@requires_db
+def test_seven_day_terminal_compaction_preserves_exact_markers(conn):
+    from job_discovery.archive.batches import compact_terminal_batches
+
+    claim, refs = seeded_events(conn, 1)
+    batch = claim_batch(conn, BatchLimits(), claim)
+    conn.commit()
+    seal = seal_batch(batch)
+    persist_seal(conn, seal)
+    conn.commit()
+    ack_batch(conn, verified(seal), claim)
+    conn.commit()
+    assert compact_terminal_batches(conn, claim) == 0
+    conn.commit()
+    # Isolated terminal-age fixture; no production time setting or bypass exists.
+    conn.execute("ALTER TABLE public_archive_batches DISABLE TRIGGER archive_immutable")
+    conn.execute(
+        "UPDATE public_archive_batches SET acked_at=clock_timestamp()-interval '8 days'"
+    )
+    conn.execute("ALTER TABLE public_archive_batches ENABLE TRIGGER archive_immutable")
+    conn.commit()
+    assert compact_terminal_batches(conn, claim) == 1
+    conn.commit()
+    assert (
+        conn.execute("SELECT event_id FROM public_archive_coverage").fetchone()[
+            "event_id"
+        ]
+        == refs[0].event_id
+    )
+    assert (
+        conn.execute("SELECT canonical_event FROM public_archive_items").fetchone()[
+            "canonical_event"
+        ]
+        == b""
+    )
+
+
+@requires_db
+def test_batch_claim_excludes_own_uncommitted_public_events(conn):
+    from job_discovery.archive.outbox import flush_public_changes
+
+    claim, _ = seeded_events(conn, 0)
+    conn.execute("INSERT INTO brands(name) VALUES('Uncommitted')")
+    flush_public_changes(conn, claim)
+    assert claim_batch(conn, BatchLimits(), claim) is None
+    conn.commit()
+    assert len(claim_batch(conn, BatchLimits(), claim).ordered_event_ids) == 1
+    conn.commit()
diff --git a/tests/test_archive_codec.py b/tests/test_archive_codec.py
new file mode 100644
index 0000000..a72f917
--- /dev/null
+++ b/tests/test_archive_codec.py
@@ -0,0 +1,84 @@
+"""Ordinary deterministic public serialization; no infrastructure or security probes."""
+
+from datetime import UTC, datetime
+from uuid import uuid4
+import gzip
+import pytest
+from job_discovery.archive.schema import (
+    PublicChange,
+    AggregateType,
+    ChangeKind,
+    validate_change,
+)
+from job_discovery.archive.codec import canonical_json, encode_events
+
+
+def test_canonical_utf8_sorted_jsonl_and_zero_time_gzip():
+    rows = [{"z": "é", "a": 1}, {"b": True}]
+    a = encode_events(rows)
+    assert a == encode_events(rows)
+    assert a[0] == b'{"a":1,"z":"\xc3\xa9"}\n{"b":true}\n'
+    assert gzip.decompress(a[1]) == a[0]
+    assert a[1][4:8] == b"\0\0\0\0"
+
+
+def test_total_public_schema_rejects_private_or_oversize_data():
+    change = PublicChange(
+        AggregateType.BRAND,
+        str(uuid4()),
+        ChangeKind.BASELINE,
+        {"id": str(uuid4()), "name": "Brand"},
+        datetime.now(UTC),
+    )
+    # Exact aggregate endpoint identity is part of validation.
+    with pytest.raises(ValueError):
+        validate_change(change)
+    for value in [None, [], {}, "bad", True]:
+        with pytest.raises(ValueError):
+            validate_change(value)
+    with pytest.raises(ValueError):
+        canonical_json({"a": float("nan")})
+
+
+def test_schema_enforces_complete_relation_endpoints_and_version_identity():
+    from dataclasses import replace
+
+    eid = str(uuid4())
+    change = PublicChange(
+        AggregateType.JOB_SKILL,
+        eid,
+        ChangeKind.UPSERT,
+        {
+            "id": eid,
+            "job_version_id": str(uuid4()),
+            "skill_id": str(uuid4()),
+            "revision": 1,
+            "status": "accepted",
+            "evidence_kind": "structured_source",
+            "public_evidence_ref": "https://example.test/job",
+        },
+        datetime.now(UTC),
+    )
+    assert validate_change(change) == change
+    for body in [
+        dict(change.body, job_version_id="job-string"),
+        {k: v for k, v in change.body.items() if k != "skill_id"},
+        dict(change.body, private_notes="private"),
+    ]:
+        with pytest.raises(ValueError):
+            validate_change(replace(change, body=body))
+
+
+def test_body_is_bounded_and_gzip_single_event_boundary():
+    eid = str(uuid4())
+    change = PublicChange(
+        AggregateType.BRAND,
+        eid,
+        ChangeKind.BASELINE,
+        {"id": eid, "name": "x" * 8192},
+        datetime.now(UTC),
+    )
+    with pytest.raises(ValueError, match="8KiB"):
+        validate_change(change)
+    with pytest.raises(ValueError, match="2000"):
+        encode_events([{}] * 2001)
diff --git a/tests/test_archive_outbox.py b/tests/test_archive_outbox.py
new file mode 100644
index 0000000..e36bf91
--- /dev/null
+++ b/tests/test_archive_outbox.py
@@ -0,0 +1,249 @@
+"""Task10 ordinary paired-transaction behavior, intentionally no deferred Task3 probes."""
+
+import pytest
+from job_discovery.archive import outbox
+from job_discovery.lifecycle.claims import claim_work
+from tests.conftest import requires_db
+
+
+@requires_db
+def test_flag_off_legacy_write_has_no_event(conn):
+    conn.execute("INSERT INTO brands(name) VALUES('Legacy')")
+    conn.commit()
+    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 0
+
+
+@requires_db
+def test_bounded_current_baseline_pairs_rollback(conn):
+    conn.execute("INSERT INTO brands(name) VALUES('Brand')")
+    from tests.archive_helpers import activate_fixture
+
+    conn.commit()
+    activate_fixture(conn)
+    claim = claim_work(conn, "archive", "baseline", 180)
+    conn.commit()
+    with pytest.raises(RuntimeError), conn.transaction():
+        outbox.baseline_batch(conn, "brands", claim, limit=1)
+        raise RuntimeError("discard work")
+    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 0
+
+
+@requires_db
+def test_direct_mutation_requires_pair_and_revision_predecessor(conn):
+    from tests.archive_helpers import seeded_events
+    from job_discovery.archive.schema import event_id
+
+    claim, refs = seeded_events(conn, 1)
+    with (
+        pytest.raises(Exception, match="requires exact transactional"),
+        conn.transaction(),
+    ):
+        conn.execute("UPDATE brands SET name='Unpaired'")
+    assert conn.execute("SELECT name FROM brands").fetchone()["name"] == "Brand 0"
+    conn.execute("UPDATE brands SET name='Paired'")
+    pair = outbox.flush_public_changes(conn, claim)
+    conn.commit()
+    event = conn.execute(
+        "SELECT * FROM public_outbox WHERE event_id=%s", (pair[0].event_id,)
+    ).fetchone()
+    assert event["revision"] == 2 and event["predecessor_id"] == refs[0].event_id
+    assert event["event_id"] == event_id("brands", refs[0].aggregate_id, 2)
+
+
+@requires_db
+def test_unchanged_poll_and_private_cache_do_not_emit(conn):
+    from tests.test_lifecycle_reconcile import setup_source
+    from tests.archive_helpers import activate_fixture
+
+    setup_source(conn)
+    conn.commit()
+    activate_fixture(conn)
+    claim = claim_work(conn, "archive", "unchanged", 180)
+    outbox.baseline_batch(conn, "jobs", claim)
+    conn.commit()
+    before = outbox.outbox_health(conn)["events"]
+    conn.execute(
+        "UPDATE jobs SET last_seen_at=clock_timestamp(),description_last_used_at=clock_timestamp()"
+    )
+    conn.execute("UPDATE source_accounts SET last_attempt_at=clock_timestamp()")
+    assert outbox.flush_public_changes(conn, claim) == ()
+    conn.commit()
+    assert outbox.outbox_health(conn)["events"] == before
+
+
+def test_budget_boundaries_and_critical_reserve():
+    assert outbox.budget_allows(87499, 0, 1, False)
+    assert not outbox.budget_allows(87500, 0, 1, False)
+    assert outbox.budget_allows(87500, 112 * 1024**2, 1, True)
+    assert outbox.budget_allows(99999, 128 * 1024**2 - 1, 1, True)
+    assert not outbox.budget_allows(100000, 0, 1, True)
+    assert not outbox.budget_allows(0, 112 * 1024**2, 1, False)
+    assert not outbox.budget_allows(0, 128 * 1024**2, 1, True)
+    assert outbox.HARD_EVENTS - outbox.ORDINARY_EVENTS == 12500
+    assert outbox.HARD_BYTES - outbox.ORDINARY_BYTES == 16 * 1024**2
+
+
+@requires_db
+def test_pending_events_have_no_ttl_or_cascade_cleanup(conn):
+    from tests.archive_helpers import seeded_events
+
+    seeded_events(conn)
+    with pytest.raises(Exception, match="immutable pending"), conn.transaction():
+        conn.execute("DELETE FROM public_outbox")
+    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 3
+
+
+@requires_db
+def test_identity_and_reconcile_mutators_pair_transactionally(conn):
+    from tests.test_lifecycle_reconcile import setup_source
+    from tests.archive_helpers import activate_fixture
+    from tests.test_lifecycle_admission import admit
+    from job_discovery.models import Posting
+    from job_discovery.lifecycle import reconcile
+    from job_discovery.lifecycle.types import Observation
+
+    source = setup_source(conn)
+    conn.commit()
+    activate_fixture(conn)
+    _, claim = admit(
+        conn,
+        source,
+        [
+            Posting(
+                "0",
+                "Updated",
+                "https://example.test/job",
+                raw={"descriptionPlain": "Public content"},
+            )
+        ],
+    )
+    enum = reconcile.begin_enumeration(conn, source["id"], claim)
+    listing = conn.execute("SELECT * FROM source_listings").fetchone()
+    now = conn.execute("SELECT clock_timestamp() t").fetchone()["t"]
+    reconcile.commit_sightings(
+        conn, enum, [Observation("0", listing["id"], "removed", now)]
+    )
+    conn.commit()
+    assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"]
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM public_outbox WHERE kind='closed'"
+        ).fetchone()["n"]
+        >= 1
+    )
+    types = {
+        r["aggregate_type"]
+        for r in conn.execute("SELECT aggregate_type FROM public_outbox")
+    }
+    assert {"jobs", "job_versions", "source_listings"} <= types
+
+
+@requires_db
+def test_listing_watermark_does_not_certify_unknown_version(conn):
+    from tests.test_lifecycle_reconcile import setup_source
+    from tests.archive_helpers import activate_fixture
+    from job_discovery.lifecycle.maintenance import _version_batch
+    from job_discovery.archive.batches import (
+        claim_batch,
+        seal_batch,
+        persist_seal,
+        ack_batch,
+    )
+    from job_discovery.archive.types import BatchLimits
+    from tests.test_archive_batches import verified
+
+    setup_source(conn)
+    listing = conn.execute("SELECT * FROM source_listings").fetchone()
+    versions = []
+    for revision in (1, 2):
+        versions.append(
+            conn.execute(
+                """INSERT INTO job_versions(job_id,source_listing_id,revision,content_hash,public_metadata,observed_at,recorded_at)
+          VALUES(%s,%s,%s,%s,'{"title":"Role","url":"https://example.test/job"}',clock_timestamp(),clock_timestamp()-interval '31 days') RETURNING id""",
+                (listing["job_id"], listing["id"], revision, str(revision) * 64),
+            ).fetchone()["id"]
+        )
+    conn.execute(
+        "UPDATE source_listings SET current_version_id=%s,current_revision=2,archived_revision=2",
+        (versions[1],),
+    )
+    conn.commit()
+    assert _version_batch(conn, 100, True)[0] == 0
+    conn.commit()
+    activate_fixture(conn)
+    claim = claim_work(conn, "archive", "versions", 180)
+    outbox.baseline_batch(conn, "job_versions", claim)
+    conn.commit()
+    batch = claim_batch(conn, BatchLimits(), claim)
+    conn.commit()
+    seal = seal_batch(batch)
+    persist_seal(conn, seal)
+    conn.commit()
+    ack_batch(conn, verified(seal), claim)
+    conn.commit()
+    assert _version_batch(conn, 100, True)[0] == 1
+    conn.commit()
+
+
+@requires_db
+def test_migration_reapplication_preserves_flags_and_existing_events(conn):
+    from pathlib import Path
+    from tests.archive_helpers import seeded_events
+
+    claim, refs = seeded_events(conn, 1)
+    conn.execute(Path("migrations/2026-10-03-04-public-outbox.sql").read_text())
+    conn.commit()
+    assert {
+        r["event_id"]
+        for r in conn.execute("SELECT event_id FROM public_pending_events")
+    } == {r.event_id for r in refs}
+
+
+@requires_db
+def test_flag_off_legacy_upsert_approval_prepare_generation_and_account_cleanup(conn):
+    from uuid import uuid4
+
+    owner = uuid4()
+    company = conn.execute(
+        "INSERT INTO companies(name,ats,token) VALUES('Legacy','lever','legacy') RETURNING id"
+    ).fetchone()["id"]
+    conn.execute(
+        "INSERT INTO jobs(id,company_id,external_id,title,url,description) VALUES('legacy-job',%s,'1','Role','https://example.test/job','Legacy body')",
+        (company,),
+    )
+    conn.execute(
+        "INSERT INTO jobs(id,company_id,external_id,title,url) VALUES('legacy-job',%s,'1','Updated','https://example.test/job') ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title",
+        (company,),
+    )
+    conn.execute(
+        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES(%s,'legacy-job','legacy','approve')",
+        (owner,),
+    )
+    conn.execute(
+        "INSERT INTO application_packages(user_id,job_id,answers_snapshot) VALUES(%s,'legacy-job','{}')",
+        (owner,),
+    )
+    conn.execute(
+        "INSERT INTO generation_jobs(user_id,job_id,kind) VALUES(%s,'legacy-job','prepare'),(%s,'legacy-job','resume')",
+        (owner, owner),
+    )
+    conn.commit()
+    assert (
+        conn.execute("SELECT count(*) n FROM public_pending_events").fetchone()["n"]
+        == 0
+    )
+    from tests.conftest import as_user
+
+    with as_user(conn, owner):
+        conn.execute(
+            "UPDATE job_reviews SET human_override=true WHERE user_id=%s AND job_id='legacy-job'",
+            (owner,),
+        )
+    conn.execute("DELETE FROM generation_jobs WHERE user_id=%s", (owner,))
+    conn.execute("DELETE FROM application_packages WHERE user_id=%s", (owner,))
+    conn.execute("DELETE FROM job_reviews WHERE user_id=%s", (owner,))
+    conn.commit()
+    assert (
+        conn.execute("SELECT title FROM jobs WHERE id='legacy-job'").fetchone()["title"]
+        == "Updated"
+    )
diff --git a/tests/test_lifecycle_operational.py b/tests/test_lifecycle_operational.py
new file mode 100644
index 0000000..9d99335
--- /dev/null
+++ b/tests/test_lifecycle_operational.py
@@ -0,0 +1,294 @@
+"""Ordinary preallocated lane integration; no physical guard or omitted mechanism probes."""
+
+import json
+from datetime import timedelta
+import pytest
+from tests.conftest import requires_db
+from tests.test_lifecycle_reconcile import setup_source
+from job_discovery.lifecycle import operational as op
+from job_discovery.lifecycle.claims import claim_work
+
+
+def setup(conn, count=2, slots=16):
+    source = setup_source(conn, count=count)
+    claim = claim_work(conn, "source", str(source["id"]), 180)
+    assert op.provision(conn, source["id"], claim, critical_slots=slots)
+    conn.commit()
+    return source, claim
+
+
+def stats(conn):
+    row = conn.execute("""SELECT pg_database_size(current_database()) allocated,
+      sum(pg_table_size(oid)) table_toast_bytes,sum(pg_indexes_size(oid)) index_bytes
+      FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' """).fetchone()
+    return {k: int(v) for k, v in row.items()}
+
+
+@requires_db
+def test_preallocated_health_membership_and_two_complete_misses(conn):
+    source, claim = setup(conn)
+    before = stats(conn)
+    source_id = source["id"]
+    first, _ = op.start(conn, source_id, claim)
+    conn.commit()
+    op.sightings(
+        conn, source_id, first, claim, [("0", "seen"), ("new-not-admitted", "seen")]
+    )
+    conn.commit()
+    op.complete(conn, source_id, first, claim, successful=True)
+    conn.commit()
+    timing = conn.execute(
+        "SELECT last_attempt_at,next_due_at FROM source_accounts WHERE id=%s",
+        (source_id,),
+    ).fetchone()
+    assert timing["next_due_at"] == timing["last_attempt_at"].replace(
+        hour=0, minute=0, second=0, microsecond=0
+    ) + timedelta(days=1)
+    assert op.reconcile(conn, source_id, first, claim)
+    conn.commit()
+    assert conn.execute("SELECT count(*) n FROM jobs").fetchone()["n"] == 2
+    assert (
+        conn.execute("SELECT closed_at FROM jobs WHERE external_id='1'").fetchone()[
+            "closed_at"
+        ]
+        is None
+    )
+    second, _ = op.start(conn, source_id, claim)
+    conn.commit()
+    op.sightings(conn, source_id, second, claim, [("0", "seen")])
+    op.complete(conn, source_id, second, claim, successful=True)
+    # Local fixture evidence interval; production clock is never configurable.
+    conn.execute(
+        "UPDATE lifecycle_operational_sources SET completed_at=completed_at+interval '24 hours' WHERE source_id=%s",
+        (source_id,),
+    )
+    conn.commit()
+    assert op.reconcile(conn, source_id, second, claim)
+    conn.commit()
+    assert conn.execute("SELECT closed_at FROM jobs WHERE external_id='1'").fetchone()[
+        "closed_at"
+    ]
+    assert (
+        conn.execute("SELECT closed_at FROM jobs WHERE external_id='0'").fetchone()[
+            "closed_at"
+        ]
+        is None
+    )
+    after = stats(conn)
+    print(
+        "ordinary operational resource evidence",
+        json.dumps(
+            {
+                "before": before,
+                "after": after,
+                "delta": {k: after[k] - before[k] for k in before},
+            },
+            sort_keys=True,
+        ),
+    )
+
+
+@requires_db
+def test_partial_positive_survives_restart_and_never_certifies_absence(conn):
+    from tests.lifecycle_helpers import open_sessions
+    from tests.conftest import TEST_DSN
+
+    source, claim = setup(conn)
+    source_id = source["id"]
+    sequence, _ = op.start(conn, source_id, claim)
+    conn.commit()
+    op.sightings(conn, source_id, sequence, claim, [("0", "seen")])
+    conn.commit()
+    fresh = open_sessions(TEST_DSN, 1)[0]
+    try:
+        op.complete(fresh, source_id, sequence, claim, successful=False, failed=True)
+        fresh.commit()
+        assert op.reconcile(fresh, source_id, sequence, claim)
+        fresh.commit()
+        row = fresh.execute(
+            "SELECT * FROM lifecycle_operational_listings WHERE seen_sequence=%s",
+            (sequence,),
+        ).fetchone()
+        assert row["seen_at"] and row["miss_count"] == 0
+        assert (
+            fresh.execute(
+                "SELECT max(miss_count) n FROM lifecycle_operational_listings"
+            ).fetchone()["n"]
+            == 0
+        )
+        next_sequence, resuming = op.start(fresh, source_id, claim)
+        assert next_sequence > sequence and not resuming
+        fresh.commit()
+    finally:
+        fresh.close()
+
+
+@requires_db
+def test_complete_checkpoint_resumes_with_fresh_connection(conn):
+    from tests.lifecycle_helpers import open_sessions
+    from tests.conftest import TEST_DSN
+
+    source, claim = setup(conn, count=3)
+    sequence, _ = op.start(conn, source["id"], claim)
+    conn.commit()
+    op.complete(conn, source["id"], sequence, claim, successful=True)
+    conn.commit()
+    assert not op.reconcile(conn, source["id"], sequence, claim, limit=1)
+    conn.commit()
+    fresh = open_sessions(TEST_DSN, 1)[0]
+    try:
+        assert op.start(fresh, source["id"], claim) == (sequence, True)
+        fresh.commit()
+        assert op.reconcile(fresh, source["id"], sequence, claim)
+        fresh.commit()
+        assert (
+            fresh.execute(
+                "SELECT sum(miss_count) n FROM lifecycle_operational_listings"
+            ).fetchone()["n"]
+            == 3
+        )
+    finally:
+        fresh.close()
+
+
+@requires_db
+def test_active_archive_critical_slots_exact_ack(conn):
+    from tests.archive_helpers import activate_fixture
+    from job_discovery.archive.outbox import baseline_batch
+    from job_discovery.archive.batches import (
+        claim_batch,
+        seal_batch,
+        persist_seal,
+        ack_batch,
+    )
+    from job_discovery.archive.types import BatchLimits
+    from tests.test_archive_batches import verified
+
+    source, claim = setup(conn, count=1)
+    activate_fixture(conn)
+    for kind in ["jobs", "source_listings"]:
+        baseline_batch(conn, kind, claim)
+    conn.commit()
+    sequence, _ = op.start(conn, source["id"], claim)
+    conn.commit()
+    op.sightings(conn, source["id"], sequence, claim, [("0", "removed")])
+    conn.commit()
+    ids = {
+        r["event_id"]
+        for r in conn.execute(
+            "SELECT event_id FROM public_critical_event_slots WHERE state='pending'"
+        )
+    }
+    assert len(ids) == 2
+    batch = claim_batch(conn, BatchLimits(), claim)
+    conn.commit()
+    seal = seal_batch(batch)
+    persist_seal(conn, seal)
+    conn.commit()
+    result = ack_batch(conn, verified(seal), claim)
+    conn.commit()
+    assert ids <= set(result.exact_event_ids)
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM public_critical_event_slots WHERE state='acked'"
+        ).fetchone()["n"]
+        == 2
+    )
+
+    from job_discovery.archive.batches import compact_terminal_batches
+
+    conn.execute("ALTER TABLE public_archive_batches DISABLE TRIGGER archive_immutable")
+    conn.execute(
+        "UPDATE public_archive_batches SET acked_at=clock_timestamp()-interval '8 days'"
+    )
+    conn.execute("ALTER TABLE public_archive_batches ENABLE TRIGGER archive_immutable")
+    conn.commit()
+    assert compact_terminal_batches(conn, claim) == len(batch.ordered_event_ids) + 2
+    conn.commit()
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM public_critical_event_slots WHERE state='acked' AND canonical_event=''::bytea"
+        ).fetchone()["n"]
+        == 2
+    )
+
+
+@requires_db
+def test_missing_preallocation_reports_deferred(conn):
+    source = setup_source(conn)
+    claim = claim_work(conn, "source", str(source["id"]), 180)
+    conn.commit()
+    with (
+        pytest.raises(op.OperationalDeferred, match="not preallocated"),
+        conn.transaction(),
+    ):
+        op.start(conn, source["id"], claim)
+
+
+@requires_db
+def test_operational_entrypoint_uses_preallocated_rows_and_offline_full_feed(
+    conn, monkeypatch
+):
+    from time import monotonic
+    from job_discovery.adapters import ADAPTERS
+    from job_discovery.adapters.completeness import SourceResult, SourceStatus
+    from job_discovery.models import Posting
+    from job_discovery.lifecycle.claims import cancel_claim
+    from job_discovery.lifecycle.reconcile import verify_storage_blocked
+
+    source, claim = setup(conn, count=2)
+    cancel_claim(conn, claim)
+    conn.commit()
+    tables = [
+        "lifecycle_operational_sources",
+        "lifecycle_operational_listings",
+        "lifecycle_operational_receipts",
+        "public_critical_event_slots",
+        "lifecycle_write_checks",
+    ]
+    # Constant known table identifiers; service integration fixture only.
+    before = {
+        t: conn.execute(f"SELECT count(*) n FROM {t}").fetchone()["n"] for t in tables
+    }
+    conn.commit()
+
+    def feed(*args, **kwargs):
+        assert conn.info.transaction_status.name == "IDLE"
+        return SourceResult(
+            iter([Posting("0", "Role", "https://example.test/job")]), SourceStatus()
+        )
+
+    monkeypatch.setitem(ADAPTERS, "lever", feed)
+    result = verify_storage_blocked(conn, max_boards=1, deadline=monotonic() + 60)
+    assert result == {"complete": 1, "deferred": 0}
+    after = {
+        t: conn.execute(f"SELECT count(*) n FROM {t}").fetchone()["n"] for t in tables
+    }
+    assert after == before
+    assert conn.execute(
+        "SELECT last_complete_success_at FROM source_accounts WHERE id=%s",
+        (source["id"],),
+    ).fetchone()["last_complete_success_at"]
+
+
+@requires_db
+def test_insufficient_critical_slots_defers_closure_atomically(conn):
+    from tests.archive_helpers import activate_fixture
+    from job_discovery.archive.outbox import baseline_batch
+
+    source, claim = setup(conn, count=1, slots=1)
+    activate_fixture(conn)
+    for kind in ["jobs", "source_listings"]:
+        baseline_batch(conn, kind, claim)
+    conn.commit()
+    sequence, _ = op.start(conn, source["id"], claim)
+    conn.commit()
+    with pytest.raises(Exception, match="slots exhausted"), conn.transaction():
+        op.sightings(conn, source["id"], sequence, claim, [("0", "removed")])
+    assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"] is None
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM public_critical_event_slots WHERE state='pending'"
+        ).fetchone()["n"]
+        == 0
+    )
