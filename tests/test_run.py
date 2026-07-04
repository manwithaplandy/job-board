import logging
import os

import job_discovery.run as run_module
from job_discovery.adapters import ADAPTERS
from job_discovery.models import Posting
from tests.conftest import requires_db


@requires_db
def test_run_isolates_failures_and_records(conn, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(
        run_module, "load_targets",
        lambda: [
            {"name": "Good", "ats": "greenhouse", "token": "good"},
            {"name": "Bad", "ats": "lever", "token": "bad"},
        ],
    )
    monkeypatch.setitem(
        ADAPTERS, "greenhouse",
        lambda token: [Posting(external_id="1", title="Engineer", url="u")],
    )

    def boom(token):
        raise RuntimeError("api down")

    monkeypatch.setitem(ADAPTERS, "lever", boom)

    run_module.run()

    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM jobs")
        assert cur.fetchone()["n"] == 1  # Good company's job inserted
        cur.execute("SELECT * FROM poll_runs ORDER BY id DESC LIMIT 1")
        last = cur.fetchone()
    assert last["companies_ok"] == 1
    assert last["companies_failed"] == 1
    assert last["new_jobs"] == 1
    assert last["finished_at"] is not None
    assert "Bad" in (last["notes"] or "")


@requires_db
def test_failed_company_does_not_close_its_jobs(conn, monkeypatch):
    # AC-3: an API error must NOT mass-close the failing company's open jobs.
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])

    # Seed an open job for "Bad" via a first successful run.
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Bad", "ats": "lever", "token": "bad"}])
    monkeypatch.setitem(ADAPTERS, "lever",
                        lambda token: [Posting(external_id="9", title="Eng", url="u")])
    run_module.run()

    # Now the same company's fetch fails.
    def boom(token):
        raise RuntimeError("api down")

    monkeypatch.setitem(ADAPTERS, "lever", boom)
    run_module.run()

    with conn.cursor() as cur:
        cur.execute("SELECT closed_at FROM jobs WHERE id = 'lever:bad:9'")
        assert cur.fetchone()["closed_at"] is None  # still open


@requires_db
def test_disappeared_role_closes_then_reopens(conn, monkeypatch):
    # AC-4
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Acme", "ats": "ashby", "token": "acme"}])

    monkeypatch.setitem(ADAPTERS, "ashby",
                        lambda token: [Posting(external_id="7", title="Eng", url="u")])
    run_module.run()

    monkeypatch.setitem(ADAPTERS, "ashby", lambda token: [])  # role gone
    run_module.run()
    with conn.cursor() as cur:
        cur.execute("SELECT closed_at FROM jobs WHERE id = 'ashby:acme:7'")
        assert cur.fetchone()["closed_at"] is not None

    monkeypatch.setitem(ADAPTERS, "ashby",
                        lambda token: [Posting(external_id="7", title="Eng", url="u")])
    run_module.run()  # role back
    with conn.cursor() as cur:
        cur.execute("SELECT closed_at FROM jobs WHERE id = 'ashby:acme:7'")
        assert cur.fetchone()["closed_at"] is None


@requires_db
def test_db_error_isolated_and_run_completes(conn, monkeypatch):
    # C1 regression: a real DB error for one company must not abort the run,
    # must roll back cleanly, count that company failed, and still record the run.
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(
        run_module, "load_targets",
        lambda: [
            {"name": "Bad", "ats": "lever", "token": "bad"},
            {"name": "Good", "ats": "greenhouse", "token": "good"},
        ],
    )
    # external_id=None violates NOT NULL -> real DB error inside upsert_job
    monkeypatch.setitem(
        ADAPTERS, "lever",
        lambda token: [Posting(external_id=None, title="Eng", url="u")],
    )
    monkeypatch.setitem(
        ADAPTERS, "greenhouse",
        lambda token: [Posting(external_id="1", title="Engineer", url="u")],
    )

    run_module.run()

    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM jobs")
        assert cur.fetchone()["n"] == 1  # Good company's job survived the rollback
        cur.execute("SELECT * FROM poll_runs ORDER BY id DESC LIMIT 1")
        last = cur.fetchone()
    assert last["companies_ok"] == 1
    assert last["companies_failed"] == 1
    assert last["finished_at"] is not None  # run completed, did not abort
    assert "Bad" in (last["notes"] or "")


@requires_db
def test_run_invokes_review_phase_isolated(conn, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Good", "ats": "greenhouse", "token": "good"}])
    monkeypatch.setitem(ADAPTERS, "greenhouse",
                        lambda token: [Posting(external_id="1", title="Engineer", url="u")])

    calls = {"n": 0}

    def fake_review_all(conn):
        calls["n"] += 1

    import reviewer.run as reviewer_run
    monkeypatch.setattr(reviewer_run, "review_all", fake_review_all)

    run_module.run()  # must not raise
    assert calls["n"] == 1
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM jobs")
        assert cur.fetchone()["n"] == 1


@requires_db
def test_run_survives_review_phase_error(conn, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Good", "ats": "greenhouse", "token": "good"}])
    monkeypatch.setitem(ADAPTERS, "greenhouse",
                        lambda token: [Posting(external_id="1", title="Engineer", url="u")])

    import reviewer.run as reviewer_run

    def boom(conn):
        raise RuntimeError("anthropic down")

    monkeypatch.setattr(reviewer_run, "review_all", boom)

    run_module.run()  # review error must not abort the poll
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM poll_runs ORDER BY id DESC LIMIT 1")
        assert cur.fetchone()["finished_at"] is not None


@requires_db
def test_run_invokes_prune(conn, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Good", "ats": "greenhouse", "token": "good"}])
    monkeypatch.setitem(ADAPTERS, "greenhouse",
                        lambda token: [Posting(external_id="1", title="Engineer", url="u")])

    calls = {"n": 0}

    def fake_prune(conn):
        calls["n"] += 1
        return {}

    import job_discovery.prune as prune_module
    monkeypatch.setattr(prune_module, "prune_jobs", fake_prune)

    run_module.run()
    assert calls["n"] == 1


@requires_db
def test_run_survives_prune_error(conn, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Good", "ats": "greenhouse", "token": "good"}])
    monkeypatch.setitem(ADAPTERS, "greenhouse",
                        lambda token: [Posting(external_id="1", title="Engineer", url="u")])

    import job_discovery.prune as prune_module

    def boom(conn):
        raise RuntimeError("prune exploded")

    monkeypatch.setattr(prune_module, "prune_jobs", boom)

    run_module.run()  # prune error must not abort the poll
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM poll_runs ORDER BY id DESC LIMIT 1")
        assert cur.fetchone()["finished_at"] is not None


# ── A2: malformed posting / empty-result guard ─────────────────────────────────

@requires_db
def test_posting_without_title_still_counts_as_seen(conn, monkeypatch):
    """A malformed posting (no title/url) must still go into seen so it is NOT
    treated as closed by the close-detection pass that runs immediately after."""
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    # First run: seed a real job so x1 exists and is open.
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Co", "ats": "greenhouse", "token": "c1"}])
    monkeypatch.setitem(ADAPTERS, "greenhouse",
                        lambda token: [Posting(external_id="x1", title="Eng", url="u")])
    run_module.run()

    # Second run: same external_id but malformed (no title/url) — must NOT close x1.
    monkeypatch.setitem(ADAPTERS, "greenhouse",
                        lambda token: [Posting(external_id="x1", title=None, url=None)])
    run_module.run()

    with conn.cursor() as cur:
        cur.execute("SELECT closed_at FROM jobs WHERE id='greenhouse:c1:x1'")
        assert cur.fetchone()["closed_at"] is None


@requires_db
def test_empty_result_with_many_open_jobs_skips_close(conn, monkeypatch, caplog):
    """When a feed returns zero postings but the company has >20 open jobs,
    skip close-detection and log a warning (suspicious scraper block, not real closure)."""
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    # Seed 25 open jobs via first run.
    postings_25 = [Posting(external_id=f"j{i}", title=f"Job {i}", url=f"u{i}")
                   for i in range(25)]
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Big", "ats": "greenhouse", "token": "big"}])
    monkeypatch.setitem(ADAPTERS, "greenhouse", lambda token: postings_25)
    run_module.run()

    # Second run: feed returns empty — should NOT close those 25 jobs.
    monkeypatch.setitem(ADAPTERS, "greenhouse", lambda token: [])
    with caplog.at_level(logging.ERROR, logger="job_discovery"):
        run_module.run()

    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM jobs WHERE company_id IN "
                    "(SELECT id FROM companies WHERE token='big') AND closed_at IS NULL")
        assert cur.fetchone()["n"] == 25
    assert "skipping close-detection" in caplog.text


# ── A7: connection resilience + advisory lock ─────────────────────────────────

@requires_db
def test_rollback_failure_does_not_escape_company_handler(conn, monkeypatch):
    """When conn.rollback() raises inside a company's error handler, the next
    company must still be polled (the exception must not bubble out)."""
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(
        run_module, "load_targets",
        lambda: [
            {"name": "Bad", "ats": "lever", "token": "bad"},
            {"name": "Good", "ats": "greenhouse", "token": "good"},
        ],
    )
    monkeypatch.setitem(ADAPTERS, "lever", lambda token: (_ for _ in ()).throw(RuntimeError("api down")))
    monkeypatch.setitem(ADAPTERS, "greenhouse",
                        lambda token: [Posting(external_id="1", title="Eng", url="u")])

    rollback_calls = {"n": 0}
    original_connect = run_module.db.connect

    class _BrokenRollbackConn:
        """Proxy that lets all calls through but makes rollback raise once."""
        def __init__(self, real):
            self._real = real
        def rollback(self):
            rollback_calls["n"] += 1
            if rollback_calls["n"] == 1:
                raise OSError("network gone during rollback")
            return self._real.rollback()
        def __getattr__(self, name):
            return getattr(self._real, name)

    def patched_connect(dsn=None):
        real = original_connect(dsn)
        return _BrokenRollbackConn(real)

    monkeypatch.setattr(run_module.db, "connect", patched_connect)

    run_module.run()  # must not raise

    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM jobs")
        assert cur.fetchone()["n"] == 1  # Good's job was still polled


@requires_db
def test_review_phase_exception_rolls_back(conn, monkeypatch):
    """When review_all raises AFTER dirtying the connection (mid-transaction),
    the connection must be rolled back so prune can still run cleanly (not left
    in a failed-transaction state that makes every subsequent SQL fail)."""
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Good", "ats": "greenhouse", "token": "good"}])
    monkeypatch.setitem(ADAPTERS, "greenhouse",
                        lambda token: [Posting(external_id="1", title="Eng", url="u")])

    import reviewer.run as reviewer_run

    def dirty_then_raise(c):
        # Leave the connection in a failed-transaction state, then raise.
        # In psycopg3, a failed SQL inside a transaction block aborts the entire
        # transaction. Without conn.rollback() after catching review_all's
        # exception, any subsequent SQL (in prune) will raise "current transaction
        # is aborted".
        try:
            c.execute("SELECT 1/0")  # aborts the transaction block
        except Exception:
            pass  # don't rollback here — let run.py do it
        raise RuntimeError("anthropic down")

    monkeypatch.setattr(reviewer_run, "review_all", dirty_then_raise)

    prune_exceptions = []
    import job_discovery.prune as prune_module

    def catching_prune(c):
        try:
            # A simple SELECT verifies the connection is in a clean state.
            c.execute("SELECT 1")
            return prune_module.prune_jobs.__wrapped__(c) if hasattr(prune_module.prune_jobs, "__wrapped__") else {}
        except Exception as e:
            prune_exceptions.append(e)
            raise

    _original_prune = prune_module.prune_jobs
    monkeypatch.setattr(prune_module, "prune_jobs", catching_prune)

    run_module.run()  # must not raise

    # If prune had exceptions (e.g. "current transaction is aborted"), it means
    # the connection was NOT rolled back after review_all raised — that's the bug.
    assert prune_exceptions == [], \
        f"prune got exceptions (conn not rolled back): {prune_exceptions}"


@requires_db
def test_second_concurrent_run_exits_cleanly(conn, monkeypatch, caplog):
    """When another process holds the advisory lock, run() must log a warning
    and return without writing a poll_run row (clean early exit, no exception)."""
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])

    # Hold the advisory lock on our test conn so the run() conn cannot acquire it.
    lock_key = conn.execute(
        "SELECT hashtext('job_discovery_poll') AS k"
    ).fetchone()["k"]
    conn.execute("SELECT pg_advisory_lock(%s)", (lock_key,))
    conn.commit()

    run_module.run()  # must return cleanly (not raise)

    # No poll_run row should have been written.
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM poll_runs")
        assert cur.fetchone()["n"] == 0

    assert "already running" in caplog.text or "holds the lock" in caplog.text

    # Release the lock so the test's conn isn't left dirty.
    conn.execute("SELECT pg_advisory_unlock(%s)", (lock_key,))
    conn.commit()


# ── A9: honest exit codes + over-ceiling accounting ──────────────────────────

@requires_db
def test_all_companies_failed_exits_nonzero(conn, monkeypatch):
    """run() must return a counts dict with ok=0, failed>0 when all companies fail.
    __main__ uses this dict to decide sys.exit(1)."""
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Bad", "ats": "lever", "token": "bad"}])
    monkeypatch.setitem(ADAPTERS, "lever", lambda token: (_ for _ in ()).throw(RuntimeError("api down")))

    counts = run_module.run()

    assert counts is not None, "run() must return a counts dict"
    assert counts["ok"] == 0
    assert counts["failed"] == 1


@requires_db
def test_over_ceiling_run_writes_poll_run_row(conn, monkeypatch):
    """When the DB is over the size ceiling, run() must still write a poll_run row
    so operators can see that the guard fired (not a silent skip)."""
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(run_module, "load_targets", lambda: [])
    # Force over-ceiling.
    monkeypatch.setattr(run_module.db, "over_size_ceiling",
                        lambda conn: (True, 9000.0, 6000.0))

    run_module.run()

    with conn.cursor() as cur:
        cur.execute("SELECT * FROM poll_runs ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
    assert row is not None, "poll_run row must be written even when over ceiling"
    assert row["finished_at"] is not None
    assert "ceiling" in (row["notes"] or "").lower() or "skipped" in (row["notes"] or "").lower()


# ── A8⇄A10: chunked upserts keep peak memory bounded ─────────────────────────

@requires_db
def test_upserts_are_chunked_and_do_not_drain_the_generator(conn, monkeypatch):
    """run() must consume a lazy adapter in fixed-size chunks and flush each chunk
    to upsert_jobs before pulling the rest — otherwise A10's lazy workday generator
    is defeated by buffering the whole tenant (and every detail payload) at once.

    We prove it by recording, at each upsert_jobs call, how many postings the
    generator has produced so far. With a chunk size of 2, the FIRST flush must
    fire after exactly 2 postings (one chunk), NOT after the generator is drained.
    """
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(run_module, "UPSERT_CHUNK_SIZE", 2)
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Big", "ats": "greenhouse", "token": "big"}])

    produced = {"n": 0}

    def lazy_adapter(token):
        for i in range(5):
            produced["n"] += 1          # incremented as run.py pulls each posting
            yield Posting(external_id=f"j{i}", title=f"Job {i}", url=f"u{i}")

    monkeypatch.setitem(ADAPTERS, "greenhouse", lazy_adapter)

    flushes: list[tuple[int, int]] = []  # (chunk_size, postings_produced_so_far)
    real_upsert = run_module.db.upsert_jobs

    def recording_upsert(conn_, company_id, ats, token, postings):
        flushes.append((len(postings), produced["n"]))
        return real_upsert(conn_, company_id, ats, token, postings)

    monkeypatch.setattr(run_module.db, "upsert_jobs", recording_upsert)

    run_module.run()

    # First flush: one full chunk (2), and only those 2 have been produced so far
    # — the generator was NOT drained to 5 before the first upsert.
    assert flushes[0] == (2, 2), f"expected bounded first flush, got {flushes}"
    # Chunks tile the whole feed: 2 + 2 + 1 == 5, none dropped.
    assert [n for n, _ in flushes] == [2, 2, 1]
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM jobs WHERE company_id IN "
                    "(SELECT id FROM companies WHERE token='big')")
        assert cur.fetchone()["n"] == 5


@requires_db
def test_close_detection_sees_ids_from_all_chunks(conn, monkeypatch):
    """Close-detection runs AFTER every chunk is consumed, so an id that appears
    only in a LATER chunk is still in `seen` and must not be falsely closed."""
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(run_module, "UPSERT_CHUNK_SIZE", 2)
    monkeypatch.setattr(run_module, "load_targets",
                        lambda: [{"name": "Big", "ats": "greenhouse", "token": "big"}])
    # Seed j0..j4 (spanning multiple chunks).
    seed = [Posting(external_id=f"j{i}", title=f"Job {i}", url=f"u{i}") for i in range(5)]
    monkeypatch.setitem(ADAPTERS, "greenhouse", lambda token: list(seed))
    run_module.run()

    # Re-poll lazily returning j0..j3 (NOT j4). j3 lands in the SECOND chunk.
    def lazy_adapter(token):
        for i in range(4):
            yield Posting(external_id=f"j{i}", title=f"Job {i}", url=f"u{i}")

    monkeypatch.setitem(ADAPTERS, "greenhouse", lazy_adapter)
    run_module.run()

    with conn.cursor() as cur:
        cur.execute("SELECT closed_at FROM jobs WHERE id='greenhouse:big:j3'")
        assert cur.fetchone()["closed_at"] is None      # in a later chunk's seen -> kept open
        cur.execute("SELECT closed_at FROM jobs WHERE id='greenhouse:big:j4'")
        assert cur.fetchone()["closed_at"] is not None  # genuinely gone -> closed
