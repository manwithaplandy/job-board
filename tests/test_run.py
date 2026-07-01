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
