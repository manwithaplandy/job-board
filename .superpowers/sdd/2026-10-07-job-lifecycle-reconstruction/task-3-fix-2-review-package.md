# Full pinned review package

BASE: 3880e2eef93cae3ffc0fa33424ae7c2ce4ab6061

HEAD: a17b6427ea06c60e801836e56114890441166842

## Commits

a17b6427ea06c60e801836e56114890441166842 fix: retry incomplete weekly company ingest ticks


## Files

 .../task-3-evidence/fix2-final16.txt               |   4 +
 .../task-3-evidence/fix2-final17.txt               |   4 +
 .../task-3-evidence/fix2-green17.txt               |   4 +
 .../task-3-evidence/fix2-red17.txt                 |  80 +++++++++++
 .../task-3-evidence/fix2-ruff.txt                  |   1 +
 .../task-3-report.md                               |  74 +++++++++++
 company_discovery/enrich_apply.py                  |   6 +-
 company_discovery/worker.py                        | 112 ++++++++++++----
 tests/test_weekly_ingest_retry.py                  | 146 +++++++++++++++++++++
 9 files changed, 404 insertions(+), 27 deletions(-)


## Complete diff

diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix2-final16.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix2-final16.txt
new file mode 100644
index 0000000..6298367
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix2-final16.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) (required 16)
+........................................................................ [ 66%]
+.....................................                                    [100%]
+109 passed in 33.60s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix2-final17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix2-final17.txt
new file mode 100644
index 0000000..b498949
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix2-final17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 66%]
+.....................................                                    [100%]
+109 passed in 24.72s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix2-green17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix2-green17.txt
new file mode 100644
index 0000000..0994d57
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix2-green17.txt
@@ -0,0 +1,4 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+........................................................................ [ 96%]
+...                                                                      [100%]
+75 passed in 12.60s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix2-red17.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix2-red17.txt
new file mode 100644
index 0000000..8f428e6
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix2-red17.txt
@@ -0,0 +1,80 @@
+Owned lifecycle database: PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) (required 17)
+FF.                                                                      [100%]
+=================================== FAILURES ===================================
+_ test_failed_weekly_batch_preserves_committed_progress_and_retries_next_cycle _
+
+conn = <psycopg.Connection [IDLE] (host=127.0.0.1 port=32925 user=postgres database=poller_lifecycle_test) at 0x7ff7e2cb1b20>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7ff7e2a3c8c0>
+
+    @requires_db
+    def test_failed_weekly_batch_preserves_committed_progress_and_retries_next_cycle(conn, monkeypatch):
+        monkeypatch.setattr(worker.dataset, 'load_candidates', lambda _: candidates(55))
+        monkeypatch.setattr(worker.config, 'BATCH_CAP', 100)
+        fetched = []
+        def fetch(ats, token):
+            assert conn.info.transaction_status == TransactionStatus.IDLE
+            fetched.append(token)
+            return enrich_apply.EnrichUpdate(token, 'offline about', 'ats_board')
+        monkeypatch.setattr(enrich_apply, 'plan_enrichment', fetch)
+        real_apply = enrich_apply.apply_enrichment
+        written = 0
+        def fail_second_batch(c, company, plan):
+            nonlocal written
+            real_apply(c, company, plan)
+            written += 1
+            if written == 52:
+                raise RuntimeError('transient enrichment persistence failure')
+        monkeypatch.setattr(enrich_apply, 'apply_enrichment', fail_second_batch)
+        with pytest.raises(RuntimeError, match='transient'):
+            worker._maybe_ingest(conn)
+        conn.rollback()  # Same recovery boundary as process_one.
+        failed = state(conn)[0]
+        assert conn.execute('SELECT count(*) n FROM companies WHERE enriched_at IS NOT NULL').fetchone()['n'] == 50
+        conn.commit()
+        monkeypatch.setattr(enrich_apply, 'apply_enrichment', real_apply)
+        before = len(fetched)
+        worker._maybe_ingest(conn)
+>       assert len(fetched)-before == 5, 'failed tick suppressed the next-cycle retry'
+E       AssertionError: failed tick suppressed the next-cycle retry
+E       assert (55 - 55) == 5
+E        +  where 55 = len(['retry-0', 'retry-1', 'retry-2', 'retry-3', 'retry-4', 'retry-5', ...])
+
+tests/test_weekly_ingest_retry.py:50: AssertionError
+____ test_interrupted_durable_weekly_marker_recovers_on_reconnected_worker _____
+
+conn = <psycopg.Connection [BAD] at 0x7ff7e2a3ed50>
+monkeypatch = <_pytest.monkeypatch.MonkeyPatch object at 0x7ff7e2a3d310>
+
+    @requires_db
+    def test_interrupted_durable_weekly_marker_recovers_on_reconnected_worker(conn, monkeypatch):
+        class ProcessStopped(BaseException):
+            pass
+        monkeypatch.setattr(worker.dataset, 'load_candidates', lambda _: candidates(1))
+        def stop_during_fetch(ats, token):
+            assert conn.info.transaction_status == TransactionStatus.IDLE
+            raise ProcessStopped()
+        monkeypatch.setattr(enrich_apply, 'plan_enrichment', stop_during_fetch)
+        with pytest.raises(ProcessStopped):
+            worker._maybe_ingest(conn)
+        interrupted = state(conn)[0]
+        conn.close()  # The interrupted process's database session is gone.
+        with psycopg.connect(TEST_DSN, row_factory=dict_row) as resumed:
+            calls = []
+            def fetch(ats, token):
+                assert resumed.info.transaction_status == TransactionStatus.IDLE
+                calls.append(token)
+                return enrich_apply.EnrichUpdate(token, 'offline about', 'ats_board')
+            monkeypatch.setattr(enrich_apply, 'plan_enrichment', fetch)
+            worker._maybe_ingest(resumed)
+>           assert calls == ['retry-0'], 'orphan running marker suppressed retry'
+E           AssertionError: orphan running marker suppressed retry
+E           assert [] == ['retry-0']
+E
+E             Right contains one more item: 'retry-0'
+E             Use -v to get more diff
+
+tests/test_weekly_ingest_retry.py:85: AssertionError
+=========================== short test summary info ============================
+FAILED tests/test_weekly_ingest_retry.py::test_failed_weekly_batch_preserves_committed_progress_and_retries_next_cycle
+FAILED tests/test_weekly_ingest_retry.py::test_interrupted_durable_weekly_marker_recovers_on_reconnected_worker
+2 failed, 1 passed in 1.43s
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix2-ruff.txt b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix2-ruff.txt
new file mode 100644
index 0000000..1f5f344
--- /dev/null
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-evidence/fix2-ruff.txt
@@ -0,0 +1 @@
+All checks passed!
diff --git a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-report.md b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-report.md
index 791c119..17adedc 100644
--- a/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-report.md
+++ b/.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-3-report.md
@@ -451,10 +451,84 @@ npm --prefix dashboard run typecheck
 .venv/bin/ruff check .
 git diff --check
 git diff --cached --check
 ```
 
 This completes author Fix Round 1 only. Both independent re-review gates of the
 original scope plus the full forward fix remain pending. Task 4, Library 03
 acceptance and production activation are not claimed. All database execution
 used disposable owned harnesses, random loopback ports and local synthetic
 HTTP/model/throttle callbacks; no production/provider/paid calls occurred.
+
+## Fix round 2 — weekly-ingest retry requirements correction only
+
+FIX_BASE: `3880e2eef93cae3ffc0fa33424ae7c2ce4ab6061`. Read the complete
+Fix Round 1 requirements re-review and its exact saved diagnostic and output
+(`fix1-requirements-review-probe.py`, `fix1-requirements-review-probe17.txt`).
+FR1-R1 correctly found that the new pre-HTTP commit made a still-running run
+marker durable, so the unfiltered seven-day probe suppressed its own retry.
+
+This round changes only company weekly orchestration and its batch-accounting
+hook. Completed discovery runs alone satisfy the existing weekly interval.
+Before HTTP, the durable run records the actual committed ingest count and
+selected backlog. The enrichment helper's optional progress callback updates
+that run in the **same transaction** as each completed company batch. A failed
+later batch cannot report uncommitted enrichment, lose earlier batches, or erase
+the committed ingest count. Caught failures finalize the run as error with a
+finish timestamp and preserved progress; the next cycle retries remaining
+unenriched companies. Failures before the initial commit still roll back the
+whole initial attempt, preserving the existing queue-isolation behavior.
+
+A running weekly marker carries its backend PID/start-time incarnation as a
+small metadata suffix to its existing human-readable notes. A subsequent tick
+recovers an interrupted marker when that session is gone or it belongs to an
+earlier attempt on the same connection, marking it error without inventing
+completion. An overlapping live backend is left alone. The existing global
+gate serializes only this short probe/start transaction, and is committed before
+HTTP; no transaction or new session lock spans a fetch. This is local worker
+bookkeeping, not a new lifecycle claim, queue, scheduling policy or migration.
+Completed/failed notes retain the human-readable enrichment count; the running
+ownership suffix is removed at finalization. Untagged historical running rows
+are excluded from the successful-run cadence without guessing which old
+orchestration produced them.
+
+Meaningful RED: `fix2-red17.txt` records **2 failed, 1 passed** on actual
+PostgreSQL 17.11. The real weekly function failed to retry both a persistence
+failure after the initial commit and an interrupted durable marker.
+`fix2-green17.txt` then records **75 passed, zero skips** across the new business
+regressions and affected company suites. Final regressions also cover recovery
+on the same connection, a reconnected worker, and a live overlapping attempt.
+The partial-batch case commits 50 of 55 enrichments, fails in batch two, proves
+the run reports ingested=55 / enriched=50 / backlog=5 / error, then fetches only
+the remaining five and records a completed retry with ingested=0 / backlog=0.
+Fake fetch callbacks assert the real connection is IDLE.
+
+Final unchanged source verification:
+
+- `fix2-final17.txt`: **109 passed, zero skipped**, actual PostgreSQL **17.11
+  (Debian 17.11-1.pgdg13+2)**, **24.72 seconds**.
+- `fix2-final16.txt`: **109 passed, zero skipped**, actual PostgreSQL **16.15
+  (Debian 16.15-1.pgdg13+2)**, **33.60 seconds**.
+- `fix2-ruff.txt`: repository Ruff passed. Working and staged whitespace
+  checks passed. No SQL, migration, grants, dashboard or security source changed;
+  the old 344-test and dashboard lanes were not redundantly rerun.
+
+Exact final commands, same worktree and `/bin/bash`, `login:false`:
+
+```sh
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 17 -- .venv/bin/python -m pytest tests/test_weekly_ingest_retry.py tests/test_classification_worker.py tests/test_lifecycle_company_boundaries.py tests/test_company_enrich.py tests/test_name_backfill.py tests/test_company_discovery_run.py tests/test_company_discovery_db.py tests/test_classification_jobs_db.py -q
+.venv/bin/python tools/lifecycle_test_db.py --postgres-major 16 -- .venv/bin/python -m pytest tests/test_weekly_ingest_retry.py tests/test_classification_worker.py tests/test_lifecycle_company_boundaries.py tests/test_company_enrich.py tests/test_name_backfill.py tests/test_company_discovery_run.py tests/test_company_discovery_db.py tests/test_classification_jobs_db.py -q
+.venv/bin/ruff check .
+git diff --check
+git diff --cached --check
+```
+
+All DB runs used the owned random-loopback harness and local synthetic callbacks;
+no shared port 55432, external HTTP/model/provider/cloud/paid action occurred.
+Controller/reviewer files are excluded from the author commit.
+
+The independent security re-review was separately blocked by a platform
+cybersecurity-risk content flag directing Daybreak access, as reported by the
+controller. This round neither retries nor rephrases that review, performs its
+probes, or delegates around the block. Only the unaffected weekly-retry
+requirements correction was performed. Requirements re-review and the separate
+security gate still prevent Task 3 acceptance, Library 03 and Task 4 progression.
diff --git a/company_discovery/enrich_apply.py b/company_discovery/enrich_apply.py
index df734c9..fe51afd 100644
--- a/company_discovery/enrich_apply.py
+++ b/company_discovery/enrich_apply.py
@@ -70,37 +70,41 @@ def fetch_batches(rows, fetch, *, max_workers=MAX_WORKERS):
     """
     for start in range(0, len(rows), FETCH_BATCH_SIZE):
         batch = rows[start:start + FETCH_BATCH_SIZE]
         with ThreadPoolExecutor(max_workers=max_workers) as pool:
             futures = {pool.submit(fetch, r["ats"], r["token"]): r for r in batch}
             results = [(futures[f], f.result()) for f in as_completed(futures)]
         yield results
 
 
 def enrich_selected(conn, candidates: list[dict], *,
-                    max_workers: int = MAX_WORKERS) -> int:
+                    max_workers: int = MAX_WORKERS, record_progress=None) -> int:
     """Fetch outside transactions, then persist up to 50 completed enrichments.
 
     Owns short batch commits, including closing the initial candidate read even
     when nothing needs enrichment. Failed boards remain unstamped and retryable.
     A DB failure rolls back only the current batch; earlier batches are durable.
+    Optional record_progress(total) runs inside that same batch transaction, so
+    its checkpoint and the enrichment writes commit or roll back together.
     """
     pending = [c for c in candidates if c.get("enriched_at") is None]
     conn.commit()
     enriched = 0
     for results in fetch_batches(pending, plan_enrichment, max_workers=max_workers):
         updated = []
         try:
             for c, plan in results:
                 if plan is not None:
                     apply_enrichment(conn, c["id"], plan)
                     updated.append((c, plan))
+            if record_progress is not None:
+                record_progress(enriched + len(updated))
             conn.commit()
         except BaseException:
             conn.rollback()
             raise
         for c, plan in updated:
             if plan.display_name is not None:
                 c["display_name"] = plan.display_name
             c["about"] = plan.about
         enriched += len(updated)
     return enriched
diff --git a/company_discovery/worker.py b/company_discovery/worker.py
index 04f7081..6228d96 100644
--- a/company_discovery/worker.py
+++ b/company_discovery/worker.py
@@ -12,20 +12,21 @@ import logging
 import os
 import signal
 import sys
 import time
 from datetime import datetime, timedelta, timezone
 
 from company_discovery import config, dataset, db, jobs_db, serp
 from company_discovery.enrich_apply import enrich_selected
 from company_discovery.llm import OutOfCreditsError
 from job_discovery import db as jdb
+from job_discovery.lifecycle.locks import enter_gate
 
 log = logging.getLogger("company_discovery.worker")
 
 CHUNK = 25          # targets classified+persisted per progress bump / cancel check
 POLL_SECONDS = int(os.environ.get("CLASSIFY_WORKER_POLL_SECONDS", "15"))
 # Bound the whole classify operation, including the OpenAI SDK's internal retries. Without
 # this outer deadline one wedged provider request keeps asyncio.gather() from returning,
 # which prevents all other successful results in the 25-company chunk from committing and
 # leaves the admin UI parked at the preceding chunk boundary indefinitely.
 CALL_TIMEOUT_SECONDS = float(os.environ.get("CLASSIFY_CALL_TIMEOUT_SECONDS", "300"))
@@ -292,54 +293,113 @@ def process_job(conn, job, classify_client=None, should_stop=None) -> None:
         # them (a caller-supplied stub client is left untouched — it owns no pool), then
         # close the loop. Runs on every exit path, including the early returns above.
         if own_client:
             try:
                 loop.run_until_complete(client.aclose())
             except Exception:
                 log.exception("classify client close failed (non-fatal)")
         loop.close()
 
 
+def _weekly_progress_note(enriched, owner):
+    # Human-readable accounting plus the exact backend incarnation. Keeping this
+    # on the existing run row lets a restart recognize an interrupted attempt,
+    # without holding a database transaction or lock across HTTP.
+    return f"weekly ingest tick (enriched {enriched})\n" + json.dumps(owner)
+
+
+def _fail_weekly_run(conn, run_id, reason):
+    conn.execute(
+        "UPDATE discovery_runs SET status='error',finished_at=clock_timestamp(), "
+        "errors=COALESCE(errors,0)+1,notes=split_part(notes,chr(10),1)||%s "
+        "WHERE id=%s AND status='running'",
+        (f"; {reason}; retry pending", run_id),
+    )
+
+
 def _maybe_ingest(conn) -> None:
-    """LLM-free weekly tick: if the last discovery run is >= INGEST_EVERY old (or there
-    are none), ingest the shipped company dataset AND HTTP-enrich a bounded batch of
-    un-enriched companies, then record a discovery_runs row. Cheap probe (max(started_at))
-    so it is safe to call every poll cycle.
-
-    Enrichment is LLM-free (board display_name/about fetches) but essential: without it,
-    newly ingested / poller-added companies get board display names + reviewer grounding
-    (c.about) ONLY if an admin classification job happens to select them. Enriching each
-    weekly tick keeps that fresh, matching the old weekly cron's behavior."""
-    with conn.cursor() as cur:
-        cur.execute("SELECT max(started_at) AS last FROM discovery_runs")
-        last = cur.fetchone()["last"]
-    conn.commit()
+    """Weekly successful-tick cadence; failed/interrupted work retries next cycle.
+
+    Ingest and each bounded enrichment batch are durable checkpoints. Only a
+    completed discovery run satisfies the weekly interval. A running weekly row
+    belongs to one backend incarnation, so an overlapping live worker is left
+    alone while a disconnected (or prior same-connection) attempt is recovered.
+    """
+    # Serialize only the short probe/start transaction with existing writers.
+    # This gate is committed before any HTTP begins.
+    enter_gate(conn)
+    owner = conn.execute(
+        "SELECT pid,backend_start::text AS started FROM pg_stat_activity "
+        "WHERE pid=pg_backend_pid()"
+    ).fetchone()
+    running = conn.execute(
+        "SELECT id,notes FROM discovery_runs WHERE status='running' "
+        "AND notes LIKE 'weekly ingest tick%' ORDER BY id"
+    ).fetchall()
+    for run in running:
+        try:
+            previous = json.loads(run["notes"].split("\n", 1)[1])
+            live = conn.execute(
+                "SELECT EXISTS(SELECT FROM pg_stat_activity WHERE pid=%s "
+                "AND backend_start=%s::timestamptz) AS live",
+                (previous["pid"], previous["started"]),
+            ).fetchone()["live"]
+        except (ValueError, KeyError, IndexError, TypeError):
+            previous, live = None, False
+        if live and previous != owner:
+            conn.commit()
+            return
+        _fail_weekly_run(conn, run["id"], "interrupted")
+    last = conn.execute(
+        "SELECT max(started_at) AS last FROM discovery_runs WHERE status='completed'"
+    ).fetchone()["last"]
     if last is not None and datetime.now(timezone.utc) - last < INGEST_EVERY:
+        conn.commit()
         return
     run_id = db.start_discovery_run(conn)
-    ingested = db.upsert_candidates(conn, dataset.load_candidates(config.dataset_dir()))
-    # HTTP enrichment (LLM-free): fetch board metadata for a bounded batch of the newest
-    # un-enriched companies. Ingest is durable before the bounded HTTP batches.
-    with conn.cursor() as cur:
-        cur.execute(
+    try:
+        ingested = db.upsert_candidates(conn, dataset.load_candidates(config.dataset_dir()))
+        pending = conn.execute(
             "SELECT id, ats, token, enriched_at FROM companies "
             "WHERE enriched_at IS NULL ORDER BY first_seen_at DESC LIMIT %(cap)s",
             {"cap": config.BATCH_CAP},
+        ).fetchall()
+        conn.execute(
+            "UPDATE discovery_runs SET ingested=%s,reviewed=0,included=0,excluded=0, "
+            "unknown=0,errors=0,backlog=%s,notes=%s WHERE id=%s",
+            (ingested, len(pending), _weekly_progress_note(0, owner), run_id),
         )
-        pending = cur.fetchall()
-    conn.commit()
-    enriched = enrich_selected(conn, pending)
-    db.finish_discovery_run(conn, run_id, status="completed", ingested=ingested,
-                            reviewed=0, included=0, excluded=0, unknown=0,
-                            errors=0, backlog=0,
-                            notes=f"weekly ingest tick (enriched {enriched})")
-    conn.commit()
+        conn.commit()  # Durable ingest/accounting; no transaction spans HTTP.
+
+        def progress(enriched):
+            conn.execute(
+                "UPDATE discovery_runs SET backlog=%s,notes=%s WHERE id=%s",
+                (len(pending)-enriched, _weekly_progress_note(enriched, owner), run_id),
+            )
+
+        enriched = enrich_selected(conn, pending, record_progress=progress)
+        db.finish_discovery_run(conn, run_id, status="completed", ingested=ingested,
+                                reviewed=0, included=0, excluded=0, unknown=0,
+                                errors=0, backlog=len(pending)-enriched,
+                                notes=f"weekly ingest tick (enriched {enriched})")
+        conn.commit()
+    except Exception:
+        # Before the first commit this removes the whole attempt. Afterwards it
+        # preserves completed batches and closes only the failed batch/run.
+        # Process termination may bypass this; the next worker recovers its row.
+        try:
+            conn.rollback()
+            _fail_weekly_run(conn, run_id, "failed")
+            conn.commit()
+        except Exception:
+            log.exception("could not finalize weekly ingest failure; next worker will recover")
+        raise
 
 
 def process_one(conn, should_stop=None) -> bool:
     """One cycle: run the weekly ingest tick (isolated), sweep stale orphaned jobs, then
     claim + process one job. Returns True if a job was handled (poll again immediately),
     False if the queue was empty (sleep). Per-job isolation: a job failure is recorded on
     the row and never propagates out. `should_stop` is threaded into process_job so a
     SIGTERM requeues the in-flight job at the next chunk boundary rather than blocking the
     drain until the whole job finishes."""
     # Weekly ingest tick — ISOLATED. A persistent tick failure (malformed committed
diff --git a/tests/test_weekly_ingest_retry.py b/tests/test_weekly_ingest_retry.py
new file mode 100644
index 0000000..86ceafa
--- /dev/null
+++ b/tests/test_weekly_ingest_retry.py
@@ -0,0 +1,146 @@
+"""Weekly ingest failures and interrupted checkpoints remain retryable, offline."""
+
+from contextlib import nullcontext
+
+import psycopg
+import pytest
+from psycopg.pq import TransactionStatus
+from psycopg.rows import dict_row
+
+from company_discovery import enrich_apply, worker
+from company_discovery.dataset import Candidate
+from tests.conftest import TEST_DSN, requires_db
+
+
+def candidates(count):
+    return [Candidate(f"Retry {i}", "lever", f"retry-{i}") for i in range(count)]
+
+
+def state(conn):
+    rows = conn.execute(
+        "SELECT status,finished_at,ingested,errors,backlog,notes FROM discovery_runs ORDER BY id"
+    ).fetchall()
+    conn.commit()
+    return rows
+
+
+@requires_db
+def test_failed_weekly_batch_preserves_committed_progress_and_retries_next_cycle(
+    conn, monkeypatch
+):
+    monkeypatch.setattr(worker.dataset, "load_candidates", lambda _: candidates(55))
+    monkeypatch.setattr(worker.config, "BATCH_CAP", 100)
+    fetched = []
+
+    def fetch(ats, token):
+        assert conn.info.transaction_status == TransactionStatus.IDLE
+        fetched.append(token)
+        return enrich_apply.EnrichUpdate(token, "offline about", "ats_board")
+
+    monkeypatch.setattr(enrich_apply, "plan_enrichment", fetch)
+    real_apply = enrich_apply.apply_enrichment
+    written = 0
+
+    def fail_second_batch(c, company, plan):
+        nonlocal written
+        real_apply(c, company, plan)
+        written += 1
+        if written == 52:
+            raise RuntimeError("transient enrichment persistence failure")
+
+    monkeypatch.setattr(enrich_apply, "apply_enrichment", fail_second_batch)
+    with pytest.raises(RuntimeError, match="transient"):
+        worker._maybe_ingest(conn)
+    conn.rollback()  # Same recovery boundary as process_one.
+    failed = state(conn)[0]
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM companies WHERE enriched_at IS NOT NULL"
+        ).fetchone()["n"]
+        == 50
+    )
+    conn.commit()
+    monkeypatch.setattr(enrich_apply, "apply_enrichment", real_apply)
+    before = len(fetched)
+    worker._maybe_ingest(conn)
+    assert len(fetched) - before == 5, "failed tick suppressed the next-cycle retry"
+    runs = state(conn)
+    assert failed["status"] == "error" and failed["finished_at"] is not None
+    assert failed["ingested"] == 55 and failed["errors"] == 1 and failed["backlog"] == 5
+    assert "enriched 50" in failed["notes"]
+    assert len(runs) == 2 and runs[1]["status"] == "completed"
+    assert runs[1]["ingested"] == 0 and runs[1]["backlog"] == 0
+    assert "enriched 5" in runs[1]["notes"]
+    assert (
+        conn.execute(
+            "SELECT count(*) n FROM companies WHERE enriched_at IS NULL"
+        ).fetchone()["n"]
+        == 0
+    )
+    conn.commit()
+    worker._maybe_ingest(conn)
+    assert (
+        len(state(conn)) == 2
+    )  # A successful retry restores the normal weekly interval.
+
+
+@requires_db
+@pytest.mark.parametrize("reconnect", [False, True])
+def test_interrupted_durable_weekly_marker_recovers(conn, monkeypatch, reconnect):
+    class ProcessStopped(BaseException):
+        pass
+
+    monkeypatch.setattr(worker.dataset, "load_candidates", lambda _: candidates(1))
+
+    def stop_during_fetch(ats, token):
+        assert conn.info.transaction_status == TransactionStatus.IDLE
+        raise ProcessStopped()
+
+    monkeypatch.setattr(enrich_apply, "plan_enrichment", stop_during_fetch)
+    with pytest.raises(ProcessStopped):
+        worker._maybe_ingest(conn)
+    interrupted = state(conn)[0]
+    if reconnect:
+        conn.close()  # The interrupted process's database session is gone.
+    resumed_connection = (
+        psycopg.connect(TEST_DSN, row_factory=dict_row)
+        if reconnect
+        else nullcontext(conn)
+    )
+    with resumed_connection as resumed:
+        calls = []
+
+        def fetch(ats, token):
+            assert resumed.info.transaction_status == TransactionStatus.IDLE
+            calls.append(token)
+            return enrich_apply.EnrichUpdate(token, "offline about", "ats_board")
+
+        monkeypatch.setattr(enrich_apply, "plan_enrichment", fetch)
+        worker._maybe_ingest(resumed)
+        assert calls == ["retry-0"], "orphan running marker suppressed retry"
+        runs = state(resumed)
+        assert interrupted["status"] == "running" and interrupted["ingested"] == 1
+        assert runs[0]["status"] == "error" and runs[0]["finished_at"] is not None
+        assert runs[0]["ingested"] == 1 and runs[0]["backlog"] == 1
+        assert "interrupted" in runs[0]["notes"]
+        assert runs[1]["status"] == "completed" and runs[1]["ingested"] == 0
+
+
+@requires_db
+def test_live_weekly_attempt_is_not_misclassified_as_an_interruption(conn, monkeypatch):
+    loads = []
+    monkeypatch.setattr(
+        worker.dataset, "load_candidates", lambda _: loads.append(1) or candidates(1)
+    )
+
+    def fetch(ats, token):
+        assert conn.info.transaction_status == TransactionStatus.IDLE
+        with psycopg.connect(TEST_DSN, row_factory=dict_row) as other:
+            worker._maybe_ingest(other)
+        return enrich_apply.EnrichUpdate(token, "offline about", "ats_board")
+
+    monkeypatch.setattr(enrich_apply, "plan_enrichment", fetch)
+    worker._maybe_ingest(conn)
+    assert loads == [1]
+    runs = state(conn)
+    assert len(runs) == 1 and runs[0]["status"] == "completed"
