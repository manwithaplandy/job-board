import os

import poller.run as run_module
from poller import db
from poller.adapters import ADAPTERS
from poller.models import Posting
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
