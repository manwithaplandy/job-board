"""Worker tests for company_discovery/worker.py (Task 6).

process_job is the testable unit: it drains a classification_jobs row by classifying
select_targets in CHUNK-sized bites, optionally grounding via SERP, stamping progress,
and honoring an admin cancel / an out-of-credits halt. _maybe_ingest is the LLM-free
weekly dataset tick. Every LLM + HTTP boundary is stubbed so these tests never touch
the network — only the DB (conn fixture) and the worker's control flow.
"""
from types import SimpleNamespace

from tests.conftest import requires_db

from company_discovery import jobs_db, worker
from company_discovery.dataset import Candidate
from company_discovery.llm import OutOfCreditsError
from company_discovery.schemas import CompanyClassificationResult


def _result(**over) -> CompanyClassificationResult:
    base = dict(industry="software_internet", industry_subcategory=None,
                size="51-200", hq_country="US", confidence="high",
                tech_tags=["python"], red_flags=[])
    base.update(over)
    return CompanyClassificationResult(**base)


class _StubClient:
    """Stands in for CompanyClassifyClient. Records every classify call, optionally
    raises (OutOfCreditsError) or runs a hook (to simulate an admin cancel mid-run)."""

    def __init__(self, *, result=None, exc=None, model="stub/model", hook=None):
        self.model = model
        self._result = result if result is not None else _result()
        self._exc = exc
        self._hook = hook
        self.calls = 0
        self.seen: list[dict] = []

    async def classify(self, *, name, ats, token, display_name=None, about=None,
                       web_description=None):
        self.calls += 1
        self.seen.append({"name": name, "ats": ats, "token": token,
                          "display_name": display_name, "about": about,
                          "web_description": web_description})
        if self._hook is not None:
            self._hook(self.calls)
        if self._exc is not None:
            raise self._exc
        raw = SimpleNamespace(
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5, cost=0.001))
        return self._result, raw


class _SomeFailClient(_StubClient):
    """Raises a generic per-target exception for targets whose token is in `fail_tokens`,
    succeeds otherwise — to exercise partial-failure surfacing."""

    def __init__(self, fail_tokens, **kw):
        super().__init__(**kw)
        self._fail_tokens = set(fail_tokens)

    async def classify(self, *, token, **kw):
        if token in self._fail_tokens:
            self.calls += 1
            self.seen.append({"token": token, **kw})
            raise RuntimeError(f"boom-{token}")
        return await super().classify(token=token, **kw)


def _new_job(conn, **overrides) -> dict:
    cols = {"model": "stub/model", "company_cap": 500,
            "selection_mode": "unclassified", "use_serp": False}
    cols.update(overrides)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO classification_jobs (model, company_cap, selection_mode, use_serp) "
            "VALUES (%(model)s, %(company_cap)s, %(selection_mode)s, %(use_serp)s) "
            "RETURNING *",
            cols,
        )
        return cur.fetchone()


# --- (a) classify up to the cap, then finish done ---------------------------


@requires_db
def test_process_job_classifies_up_to_cap_and_finishes_done(conn):
    with conn.cursor() as cur:
        for i in range(3):
            cur.execute("INSERT INTO companies (name, ats, token, enriched_at) "
                        "VALUES (%s,'greenhouse',%s, now())", (f"c{i}", f"c{i}"))
    job = _new_job(conn, company_cap=2)
    conn.commit()

    client = _StubClient()
    worker.process_job(conn, job, classify_client=client)
    conn.commit()

    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM companies WHERE classified_at IS NOT NULL")
        classified = cur.fetchone()["n"]
        cur.execute("SELECT status, processed, errored, actual_prompt_tokens, "
                    "actual_completion_tokens, actual_cost FROM classification_jobs "
                    "WHERE id = %s", (job["id"],))
        row = cur.fetchone()
        cur.execute("SELECT classification_source FROM companies "
                    "WHERE classified_at IS NOT NULL LIMIT 1")
        source = cur.fetchone()["classification_source"]
    assert classified == 2          # cap respected; the 3rd stays unclassified
    assert client.calls == 2
    assert row["status"] == "done"
    assert row["processed"] == 2
    assert row["errored"] == 0
    assert row["actual_prompt_tokens"] == 20    # 10 per target * 2
    assert row["actual_completion_tokens"] == 10
    assert float(row["actual_cost"]) == 0.002
    assert source == "job"          # use_serp=False -> source 'job'


# --- (a2) ONE event loop drives all chunks of a job (pool-safety regression) -


@requires_db
def test_process_job_uses_one_event_loop_across_chunks(conn, monkeypatch):
    # Regression guard: the client owns a single pooled httpx.AsyncClient, so every
    # chunk MUST run on the same event loop. A per-chunk asyncio.run() would give each
    # chunk a fresh loop, orphaning the pool's keep-alive connections on the prior,
    # now-closed loop (-> 'Event loop is closed' / PoolTimeout in prod, silently folded
    # into err counts). With CHUNK=1 forcing three separate chunks, all three classify
    # calls must observe the SAME running loop. This test FAILS on a per-chunk
    # asyncio.run() implementation (three distinct loops) and PASSES on the single-loop
    # fix — the stubbed classify does no HTTP, so only the loop identity is asserted.
    import asyncio as _asyncio

    monkeypatch.setattr(worker, "CHUNK", 1)
    with conn.cursor() as cur:
        for i in range(3):
            cur.execute("INSERT INTO companies (name, ats, token, enriched_at) "
                        "VALUES (%s,'greenhouse',%s, now())", (f"c{i}", f"c{i}"))
    job = _new_job(conn, company_cap=3)
    conn.commit()

    seen_loops: list = []

    class _LoopRecordingClient(_StubClient):
        async def classify(self, **kw):
            seen_loops.append(_asyncio.get_running_loop())
            return await super().classify(**kw)

    client = _LoopRecordingClient()
    worker.process_job(conn, job, classify_client=client)
    conn.commit()

    assert client.calls == 3                          # three chunks (CHUNK=1, cap=3)
    assert len(seen_loops) == 3
    assert all(lp is seen_loops[0] for lp in seen_loops)  # ONE loop, not one-per-chunk


# --- (b) admin cancel mid-run stops the loop, finishes canceled -------------


@requires_db
def test_process_job_cancel_mid_run_finishes_canceled(conn, monkeypatch):
    monkeypatch.setattr(worker, "CHUNK", 1)   # one target per chunk -> a cancel window
    with conn.cursor() as cur:
        for i in range(3):
            cur.execute("INSERT INTO companies (name, ats, token, enriched_at) "
                        "VALUES (%s,'greenhouse',%s, now())", (f"c{i}", f"c{i}"))
    job = _new_job(conn, company_cap=5)
    conn.commit()
    jid = job["id"]

    def hook(n):
        # After the first classification, an admin cancels: flip the row in this
        # same transaction so the next loop iteration's cancel check sees it.
        if n == 1:
            conn.execute("UPDATE classification_jobs SET status='canceled' WHERE id=%s",
                         (jid,))

    client = _StubClient(hook=hook)
    worker.process_job(conn, job, classify_client=client)
    conn.commit()

    with conn.cursor() as cur:
        cur.execute("SELECT status, processed FROM classification_jobs WHERE id=%s", (jid,))
        row = cur.fetchone()
        cur.execute("SELECT count(*) AS n FROM companies WHERE classified_at IS NOT NULL")
        classified = cur.fetchone()["n"]
    assert row["status"] == "canceled"
    assert client.calls == 1        # stopped after the first chunk
    assert classified == 1
    assert row["processed"] == 1


# --- (c) SERP only for un-searched targets, increments serp_queries ---------


@requires_db
def test_process_job_serp_only_unsearched(conn, monkeypatch):
    fetched: list[str] = []
    monkeypatch.setattr(worker.serp, "serp_available", lambda: True)
    monkeypatch.setattr(worker.serp, "fetch_company_snippets",
                        lambda name, ats: (fetched.append(name) or "snip"))
    monkeypatch.setattr(worker.serp, "persist_web_description",
                        lambda conn_, cid, text: None)
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token, enriched_at, web_searched_at) "
                    "VALUES ('searched','greenhouse','searched', now(), now())")
        cur.execute("INSERT INTO companies (name, ats, token, enriched_at) "
                    "VALUES ('fresh','greenhouse','fresh', now())")
    job = _new_job(conn, use_serp=True, company_cap=10)
    conn.commit()

    client = _StubClient()
    worker.process_job(conn, job, classify_client=client)
    conn.commit()

    with conn.cursor() as cur:
        cur.execute("SELECT serp_queries, status FROM classification_jobs WHERE id=%s",
                    (job["id"],))
        row = cur.fetchone()
        cur.execute("SELECT classification_source FROM companies WHERE token='fresh'")
        source = cur.fetchone()["classification_source"]
    assert fetched == ["fresh"]     # only the web_searched_at IS NULL company hit SERP
    assert row["serp_queries"] == 1
    assert row["status"] == "done"
    assert source == "job_serp"     # use_serp=True -> source 'job_serp'


# --- (d) out of credits -> job error + global halt --------------------------


@requires_db
def test_process_job_out_of_credits_errors_and_halts(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token, enriched_at) "
                    "VALUES ('c','greenhouse','c', now())")
    job = _new_job(conn, company_cap=5)
    conn.commit()

    client = _StubClient(exc=OutOfCreditsError("402 out of credits"))
    worker.process_job(conn, job, classify_client=client)
    conn.commit()

    with conn.cursor() as cur:
        cur.execute("SELECT status, error FROM classification_jobs WHERE id=%s", (job["id"],))
        row = cur.fetchone()
        cur.execute("SELECT halted_no_credits FROM discovery_state WHERE id=TRUE")
        halted = cur.fetchone()["halted_no_credits"]
    assert row["status"] == "error"
    # The halt now carries the actual exception text for diagnostics (not a bare marker).
    assert row["error"].startswith("out of credits")
    assert "402 out of credits" in row["error"]
    assert halted is True


# --- (e) _maybe_ingest: runs when stale, skips when recent ------------------


@requires_db
def test_maybe_ingest_runs_when_stale_and_records_run(conn, monkeypatch):
    monkeypatch.setattr(worker.dataset, "load_candidates",
                        lambda d: [Candidate(name="Ingest Co", ats="greenhouse",
                                             token="ingtok")])
    # Stub the HTTP enrichment (no network): record which un-enriched companies it saw.
    enrich_seen: list[list[str]] = []

    def fake_enrich(conn_, companies, **kw):
        enrich_seen.append([c["token"] for c in companies])
        return len(companies)

    monkeypatch.setattr(worker, "enrich_selected", fake_enrich)
    with conn.cursor() as cur:
        cur.execute("INSERT INTO discovery_runs (started_at, status) "
                    "VALUES (now() - interval '8 days', 'completed')")
    conn.commit()

    worker._maybe_ingest(conn)
    conn.commit()

    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM companies WHERE token='ingtok'")
        assert cur.fetchone()["n"] == 1
        cur.execute("SELECT ingested, status, notes FROM discovery_runs "
                    "ORDER BY id DESC LIMIT 1")
        run = cur.fetchone()
    assert run is not None
    assert run["status"] == "completed"
    assert run["ingested"] == 1
    # Enrichment ran on the just-ingested un-enriched company, and the count is recorded.
    assert enrich_seen == [["ingtok"]]
    assert run["notes"].startswith("weekly ingest tick")
    assert "enriched 1" in run["notes"]


@requires_db
def test_maybe_ingest_skips_when_recent(conn, monkeypatch):
    calls: list[int] = []
    enrich_calls: list[int] = []
    monkeypatch.setattr(worker.dataset, "load_candidates",
                        lambda d: calls.append(1) or [])
    monkeypatch.setattr(worker, "enrich_selected",
                        lambda *a, **k: enrich_calls.append(1) or 0)
    with conn.cursor() as cur:
        cur.execute("INSERT INTO discovery_runs (started_at, status) "
                    "VALUES (now(), 'completed')")
    conn.commit()

    worker._maybe_ingest(conn)
    conn.commit()

    assert calls == []              # short-circuited before the (LLM-free) dataset load
    assert enrich_calls == []       # ...and before HTTP enrichment
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM discovery_runs "
                    "WHERE notes LIKE %s", ("weekly ingest tick%",))
        assert cur.fetchone()["n"] == 0


# --- (f) unknown_repass terminates via started_at (reviewer refinement) ------


@requires_db
def test_process_job_unknown_repass_terminates_via_started_at(conn):
    # A company classified BEFORE the run but still size='unknown' matches the repass
    # mode. Re-classifying it (still unknown) must NOT re-select it forever: the
    # started_at `before` bound excludes rows classified during this run.
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token, enriched_at, classified_at, "
                    "size, hq_country, industry, classification_confidence) "
                    "VALUES ('u','greenhouse','u', now(), now() - interval '1 hour', "
                    "'unknown','US','software_internet','high') RETURNING id")
        cur.fetchone()
    _new_job(conn, selection_mode="unknown_repass", company_cap=50)
    conn.commit()
    claimed = jobs_db.claim_next_job(conn)   # stamps started_at = now()
    conn.commit()

    # Result STILL leaves size unknown -> the coarse ok/err guard does NOT fire (ok=1);
    # only the started_at bound stops re-selection.
    client = _StubClient(result=_result(size="unknown"))
    worker.process_job(conn, claimed, classify_client=client)
    conn.commit()

    with conn.cursor() as cur:
        cur.execute("SELECT status, processed FROM classification_jobs WHERE id=%s",
                    (claimed["id"],))
        row = cur.fetchone()
    assert row["status"] == "done"
    assert client.calls == 1        # classified exactly once, not looped forever
    assert row["processed"] == 1


# --- (g) boot recovery requeues an orphaned 'running' row + honors cap on resume ---


@requires_db
def test_boot_recovers_orphaned_running_job_and_honors_cap_on_resume(conn):
    # Simulate a crash mid-job: attempt 1 classified 2 companies (processed=2) then the
    # worker died, leaving the row 'running'. Boot recovery must requeue it, the resume
    # must be re-claimable, and it must honor the REMAINING cap (5 - 2 = 3 more) rather
    # than restarting the whole cap of 5.
    with conn.cursor() as cur:
        # 2 already classified in attempt 1 (excluded from 'unclassified' selection) ...
        for i in range(2):
            cur.execute("INSERT INTO companies (name, ats, token, enriched_at, "
                        "classified_at, classification_source) "
                        "VALUES (%s,'greenhouse',%s, now(), now(), 'job')",
                        (f"done{i}", f"done{i}"))
        # ... and 5 still unclassified.
        for i in range(5):
            cur.execute("INSERT INTO companies (name, ats, token, enriched_at) "
                        "VALUES (%s,'greenhouse',%s, now())", (f"todo{i}", f"todo{i}"))
        cur.execute(
            "INSERT INTO classification_jobs (model, company_cap, selection_mode, "
            "use_serp, status, processed, started_at) "
            "VALUES ('stub/model', 5, 'unclassified', FALSE, 'running', 2, "
            "now() - interval '1 hour') RETURNING id, started_at")
        seed = cur.fetchone()
        jid, orig_started = seed["id"], seed["started_at"]
    conn.commit()

    recovered = jobs_db.recover_orphaned_jobs(conn)
    conn.commit()
    assert recovered == 1

    claimed = jobs_db.claim_next_job(conn)
    conn.commit()
    assert claimed is not None and claimed["id"] == jid
    assert claimed["processed"] == 2                 # progress preserved across the requeue
    assert claimed["started_at"] == orig_started     # COALESCE kept the original started_at

    client = _StubClient()
    worker.process_job(conn, claimed, classify_client=client)
    conn.commit()

    with conn.cursor() as cur:
        cur.execute("SELECT status, processed FROM classification_jobs WHERE id=%s", (jid,))
        row = cur.fetchone()
        cur.execute("SELECT count(*) AS n FROM companies WHERE classified_at IS NOT NULL")
        classified = cur.fetchone()["n"]
    assert client.calls == 3        # only the remaining 3 of the cap of 5, not 5
    assert row["status"] == "done"
    assert row["processed"] == 5    # 2 (attempt 1) + 3 (resume)
    assert classified == 5          # 2 old + 3 new; the other 2 todo stay unclassified


# --- (h) graceful shutdown requeues the job 'pending' with progress persisted ------


@requires_db
def test_process_job_graceful_stop_requeues_pending(conn, monkeypatch):
    monkeypatch.setattr(worker, "CHUNK", 1)   # one target per chunk -> a stop window
    with conn.cursor() as cur:
        for i in range(3):
            cur.execute("INSERT INTO companies (name, ats, token, enriched_at) "
                        "VALUES (%s,'greenhouse',%s, now())", (f"c{i}", f"c{i}"))
    job = _new_job(conn, company_cap=5)
    conn.commit()
    jid = job["id"]
    # Claim it so it is 'running' with a started_at, exactly as the loop would.
    claimed = jobs_db.claim_next_job(conn)
    conn.commit()

    # should_stop flips True after the first chunk's classify: the loop must finish that
    # chunk, requeue the job to 'pending' (progress kept), and return within one chunk.
    stop_state = {"stop": False}
    client = _StubClient(hook=lambda n: stop_state.__setitem__("stop", True))
    worker.process_job(conn, claimed, classify_client=client,
                       should_stop=lambda: stop_state["stop"])
    conn.commit()

    with conn.cursor() as cur:
        cur.execute("SELECT status, processed, finished_at, started_at "
                    "FROM classification_jobs WHERE id=%s", (jid,))
        row = cur.fetchone()
        cur.execute("SELECT count(*) AS n FROM companies WHERE classified_at IS NOT NULL")
        classified = cur.fetchone()["n"]
    assert client.calls == 1            # stopped after the first chunk, not the whole cap
    assert row["status"] == "pending"   # requeued for resume, NOT done/canceled
    assert row["finished_at"] is None   # requeue is not a terminal transition
    assert row["started_at"] is not None  # preserved so the repass bound survives
    assert row["processed"] == 1        # the first chunk's progress persisted
    assert classified == 1


# --- (i) stale-recovery is heartbeat-gated: a live job is NOT reaped -----------


@requires_db
def test_recover_orphaned_jobs_skips_fresh_heartbeat(conn):
    # A 'running' job with a FRESH progress heartbeat is actively owned (e.g. by an
    # overlapping zero-downtime deploy's old container, or this worker's just-claimed job)
    # and must NOT be requeued — only a job whose heartbeat has aged past STALE_MINUTES is
    # reaped. Without the gate, an unconditional requeue would let a second worker double-
    # claim and double-spend on a job that is very much alive.
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO classification_jobs (model, company_cap, selection_mode, "
            "use_serp, status, started_at, last_progress_at) "
            "VALUES ('stub/model', 5, 'unclassified', FALSE, 'running', "
            "now() - interval '2 hours', now()) RETURNING id")
        fresh = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO classification_jobs (model, company_cap, selection_mode, "
            "use_serp, status, started_at, last_progress_at) "
            "VALUES ('stub/model', 5, 'unclassified', FALSE, 'running', "
            "now() - interval '2 hours', now() - interval '20 minutes') RETURNING id")
        stale = cur.fetchone()["id"]
    conn.commit()

    recovered = jobs_db.recover_orphaned_jobs(conn)
    conn.commit()

    assert recovered == 1
    with conn.cursor() as cur:
        cur.execute("SELECT status FROM classification_jobs WHERE id=%s", (fresh,))
        assert cur.fetchone()["status"] == "running"    # fresh heartbeat -> protected
        cur.execute("SELECT status FROM classification_jobs WHERE id=%s", (stale,))
        assert cur.fetchone()["status"] == "pending"     # aged heartbeat -> requeued


# --- (j) per-cycle sweep recovers a stranded orphan (no reboot needed) --------


@requires_db
def test_process_one_recovers_stale_orphan_and_resumes(conn, monkeypatch):
    # A job stranded 'running' with an aged heartbeat (a connection drop mid-job after
    # which the always-on process reconnected and kept looping — never rebooting) is
    # requeued by the PER-CYCLE sweep inside process_one and then claimed + resumed. A
    # boot-only sweep would leave it hanging 'running' forever.
    monkeypatch.setattr(worker, "_maybe_ingest", lambda conn_: None)  # skip the weekly tick
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token, enriched_at) "
                    "VALUES ('c','greenhouse','c', now())")
        cur.execute(
            "INSERT INTO classification_jobs (model, company_cap, selection_mode, "
            "use_serp, status, started_at, last_progress_at) "
            "VALUES ('stub/model', 5, 'unclassified', FALSE, 'running', "
            "now() - interval '2 hours', now() - interval '30 minutes') RETURNING id")
        jid = cur.fetchone()["id"]
    conn.commit()

    processed: list[int] = []

    def fake_process_job(conn_, job, should_stop=None):
        processed.append(job["id"])
        jobs_db.finish_job(conn_, job["id"], "done")
        conn_.commit()

    monkeypatch.setattr(worker, "process_job", fake_process_job)

    handled = worker.process_one(conn)
    conn.commit()

    assert handled is True
    assert processed == [jid]        # the requeued orphan was claimed + resumed this cycle
    with conn.cursor() as cur:
        cur.execute("SELECT status FROM classification_jobs WHERE id=%s", (jid,))
        assert cur.fetchone()["status"] == "done"


# --- (k) a failing weekly ingest tick does NOT starve the job queue -----------


@requires_db
def test_process_one_ingest_failure_does_not_starve_queue(conn, monkeypatch):
    # A persistent weekly-tick failure (malformed dataset, missing dataset dir, ...) must
    # be isolated: it cannot propagate out of process_one, where main()'s cycle-error
    # handler would misread it as a dead connection and churn a healthy conn every cycle
    # while admin classification jobs sit 'pending' forever. The pending job is still
    # claimed and processed.
    def boom(_dataset_dir):
        raise RuntimeError("malformed committed dataset")

    monkeypatch.setattr(worker.dataset, "load_candidates", boom)
    with conn.cursor() as cur:
        # Aged discovery_run -> the ingest probe passes and reaches the (raising) load.
        cur.execute("INSERT INTO discovery_runs (started_at, status) "
                    "VALUES (now() - interval '8 days', 'completed')")
        cur.execute("INSERT INTO companies (name, ats, token, enriched_at) "
                    "VALUES ('c','greenhouse','c', now())")
    _new_job(conn, company_cap=5)
    conn.commit()

    processed: list[int] = []

    def fake_process_job(conn_, job, should_stop=None):
        processed.append(job["id"])
        jobs_db.finish_job(conn_, job["id"], "done")
        conn_.commit()

    monkeypatch.setattr(worker, "process_job", fake_process_job)

    handled = worker.process_one(conn)   # must NOT raise despite the tick blowing up
    conn.commit()

    assert handled is True               # the cycle completed; the tick failure was swallowed
    assert len(processed) == 1           # the pending job WAS claimed + processed
    with conn.cursor() as cur:
        cur.execute("SELECT status FROM classification_jobs WHERE id=%s", (processed[0],))
        assert cur.fetchone()["status"] == "done"
        # The tick's partial work (a start_discovery_run row) was rolled back, so no new
        # 'weekly ingest tick' run leaked from the failed attempt.
        cur.execute("SELECT count(*) AS n FROM discovery_runs "
                    "WHERE notes LIKE %s", ("weekly ingest tick%",))
        assert cur.fetchone()["n"] == 0


# --- (l) all-fail run surfaces status 'error' + a sample exception on the row -----


@requires_db
def test_process_job_all_fail_errors_with_sample(conn, caplog):
    # Regression for the 2026-07-22 incident: every classify call raised (an OpenRouter
    # monthly-key-limit 403 that was NOT yet detected as terminal), yet the job finished
    # 'done' processed=0 with a NULL error and ZERO log lines. An all-failed run must now
    # finish 'error' with a sample exception on the row, and the first per-target failure
    # of the chunk must be logged (not silently discarded).
    import logging
    with conn.cursor() as cur:
        for i in range(3):
            cur.execute("INSERT INTO companies (name, ats, token, enriched_at) "
                        "VALUES (%s,'greenhouse',%s, now())", (f"c{i}", f"c{i}"))
    job = _new_job(conn, company_cap=3)
    conn.commit()

    client = _StubClient(exc=RuntimeError("boom-403"))
    with caplog.at_level(logging.WARNING, logger="company_discovery.worker"):
        worker.process_job(conn, job, classify_client=client)
    conn.commit()

    with conn.cursor() as cur:
        cur.execute("SELECT status, processed, errored, error FROM classification_jobs "
                    "WHERE id=%s", (job["id"],))
        row = cur.fetchone()
        cur.execute("SELECT count(*) AS n FROM companies WHERE classified_at IS NOT NULL")
        classified = cur.fetchone()["n"]
    assert classified == 0
    assert row["status"] == "error"          # all-failed -> 'error', not a misleading 'done'
    assert row["processed"] == 0
    assert row["errored"] == 3
    assert "all 3 classifications failed" in row["error"]
    assert "boom-403" in row["error"]        # sample carries the exception repr
    # The failure was logged ONCE (first of the chunk), not spammed one line per target:
    # exactly one WARNING record for the chunk, carrying the exception repr AND an
    # aggregated count of the rest ("and N more error(s) this chunk").
    records = [r for r in caplog.records
               if r.levelno == logging.WARNING and "classify failed" in r.getMessage()]
    assert len(records) == 1
    assert "boom-403" in records[0].getMessage()
    assert "and 2 more error(s) this chunk" in records[0].getMessage()


# --- (m) partial-fail run stays 'done' but records the failure count + a sample ----


@requires_db
def test_process_job_partial_fail_done_with_sample(conn):
    # A run where SOME targets succeed and some fail stays 'done' (work was accomplished)
    # but records "X of Y failed" + a sample exception so the failures are visible.
    with conn.cursor() as cur:
        for i in range(3):
            cur.execute("INSERT INTO companies (name, ats, token, enriched_at) "
                        "VALUES (%s,'greenhouse',%s, now())", (f"c{i}", f"c{i}"))
    job = _new_job(conn, company_cap=3)
    conn.commit()

    client = _SomeFailClient(fail_tokens={"c1"})   # one of three targets fails
    worker.process_job(conn, job, classify_client=client)
    conn.commit()

    with conn.cursor() as cur:
        cur.execute("SELECT status, processed, errored, error FROM classification_jobs "
                    "WHERE id=%s", (job["id"],))
        row = cur.fetchone()
    assert row["status"] == "done"           # partial success stays 'done'
    assert row["processed"] == 2
    assert row["errored"] == 1
    assert "1 of 3 failed" in row["error"]
    assert "boom-c1" in row["error"]         # sample carries the failing target's exception


# --- (n) a monthly-key-limit 403 halts the job just like a 402 ---------------------


@requires_db
def test_process_job_monthly_limit_403_errors_and_halts(conn):
    # In production the classify path converts OpenRouter's monthly-key-limit 403 into an
    # OutOfCreditsError via the (now-extended) _is_out_of_credits detector; the worker then
    # halts the whole job + the global pipeline exactly as it does for a 402. Simulate the
    # already-converted exception (the detector conversion is covered in the llm tests).
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token, enriched_at) "
                    "VALUES ('c','greenhouse','c', now())")
    job = _new_job(conn, company_cap=5)
    conn.commit()

    client = _StubClient(exc=OutOfCreditsError(
        "Error code: 403 - Key limit exceeded (monthly limit)"))
    worker.process_job(conn, job, classify_client=client)
    conn.commit()

    with conn.cursor() as cur:
        cur.execute("SELECT status, error FROM classification_jobs WHERE id=%s", (job["id"],))
        row = cur.fetchone()
        cur.execute("SELECT halted_no_credits FROM discovery_state WHERE id=TRUE")
        halted = cur.fetchone()["halted_no_credits"]
    assert row["status"] == "error"
    assert row["error"].startswith("out of credits")
    assert "Key limit exceeded" in row["error"]   # exc text carried for diagnostics
    assert halted is True


# --- (o) resumed job whose errors are ALL from a prior attempt: no dangling 'sample:' --


@requires_db
def test_process_job_resumed_prior_errors_no_dangling_sample(conn):
    # Crash/SIGTERM window: attempt 1 errored its whole cap (errored=3, processed=0) and
    # committed the progress bump, then died BEFORE the terminal finish_job. Boot recovery
    # requeues it; on resume remaining == 0 so the classify loop never runs and this attempt
    # sees no exception (first_exc is None). The terminal row must still read 'error' with
    # the honest count, but WITHOUT a dangling 'sample: ' that has nothing after it.
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO classification_jobs (model, company_cap, selection_mode, "
            "use_serp, status, processed, errored, started_at) "
            "VALUES ('stub/model', 3, 'unclassified', FALSE, 'running', 0, 3, "
            "now() - interval '1 hour') RETURNING *")
        job = cur.fetchone()
    conn.commit()

    client = _StubClient()          # never called: remaining == 0
    worker.process_job(conn, job, classify_client=client)
    conn.commit()

    with conn.cursor() as cur:
        cur.execute("SELECT status, processed, errored, error FROM classification_jobs "
                    "WHERE id=%s", (job["id"],))
        row = cur.fetchone()
    assert client.calls == 0                        # remaining==0 -> no classify calls
    assert row["status"] == "error"                 # all-failed (from the prior attempt)
    assert row["processed"] == 0
    assert row["errored"] == 3
    assert "all 3 classifications failed" in row["error"]
    assert "sample unavailable" in row["error"]     # honest marker, not a dangling clause
    assert "sample: " not in row["error"]           # no empty 'sample: ' tail
