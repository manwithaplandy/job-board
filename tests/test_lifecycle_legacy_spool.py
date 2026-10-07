"""No HTTP/model work while the newly installed transaction gate is held."""

import importlib
import pytest
from psycopg.pq import TransactionStatus
from tests.conftest import requires_db
from job_discovery.models import Posting
from job_discovery.lifecycle import legacy_spool


def test_partial_or_budget_exhausted_spool_never_yields_complete_feed(monkeypatch):
    def partial():
        yield Posting("1", "Engineer", "u")
        raise ValueError("page failed")

    for stream in [
        partial(),
        [Posting("1", "Engineer", "u"), Posting("2", "Engineer", "u")],
    ]:
        monkeypatch.setattr(legacy_spool, "MAX_ROWS", 1)
        with pytest.raises(ValueError):
            with legacy_spool.spool_feed(stream):
                pytest.fail("partial/overflow feed was exposed for writes")


@pytest.mark.parametrize("limit,value", [("MAX_BYTES", 1), ("MAX_SECONDS", -1)])
def test_spool_byte_and_deadline_limits_fail_closed(monkeypatch, limit, value):
    monkeypatch.setattr(legacy_spool, limit, value)
    with pytest.raises(ValueError, match="budget"):
        with legacy_spool.spool_feed([Posting("1", "E", "u")]):
            pytest.fail("oversize feed was exposed")


@requires_db
def test_legacy_adapters_and_question_http_observe_idle_connection(conn, monkeypatch):
    run = importlib.import_module("job_discovery.run")
    locations = importlib.import_module("job_discovery.locations")
    reviewer = importlib.import_module("reviewer.run")
    observations = []

    class Connection:
        def __getattr__(self, name):
            return getattr(conn, name)

        def close(self):
            pass

    monkeypatch.setattr(run.db, "connect", lambda _: Connection())
    monkeypatch.setattr(
        run, "load_targets", lambda: [{"name": "X", "ats": "greenhouse", "token": "x"}]
    )
    monkeypatch.setattr(run, "UPSERT_CHUNK_SIZE", 1)

    def adapter(token):
        for i in range(3):
            observations.append(conn.info.transaction_status)
            assert conn.info.transaction_status == TransactionStatus.IDLE
            yield Posting(str(i), "Engineer", "u")

    def http(url):
        observations.append(conn.info.transaction_status)
        assert conn.info.transaction_status == TransactionStatus.IDLE
        return {
            "questions": [
                {
                    "label": "Q",
                    "required": False,
                    "fields": [{"name": "q", "type": "input_text"}],
                }
            ]
        }

    monkeypatch.setitem(run.ADAPTERS, "greenhouse", adapter)
    monkeypatch.setattr(run, "_get_json", http)
    monkeypatch.setattr(locations, "resolve_new_locations", lambda c: None)
    monkeypatch.setattr(reviewer, "review_all", lambda c: None)
    result = run.run()
    assert result["failed"] == 0 and result["new_jobs"] == 3
    assert len(observations) == 6
    assert conn.execute("SELECT count(*) n FROM job_questions").fetchone()["n"] == 3


@requires_db
@pytest.mark.parametrize(
    "budget,value", [("MAX_SECONDS", -1), ("MAX_ROWS", 0), ("MAX_BYTES", 1)]
)
def test_poll_preserves_cached_questions_and_optional_backfill_timeout(
    conn, monkeypatch, budget, value
):
    from tests.conftest import TEST_DSN

    run = importlib.import_module("job_discovery.run")
    monkeypatch.setattr(
        run,
        "load_targets",
        lambda: [{"name": "Cached", "ats": "greenhouse", "token": "cached"}],
    )
    monkeypatch.setitem(
        run.ADAPTERS,
        "greenhouse",
        lambda _: [Posting("1", "Engineer", "u"), Posting("2", "Engineer", "u")],
    )
    monkeypatch.setattr("job_discovery.locations.resolve_new_locations", lambda c: None)
    monkeypatch.setattr("reviewer.run.review_all", lambda c: None)
    calls = []

    def http(url):
        calls.append(url)
        return {
            "questions": [
                {
                    "label": "Remote",
                    "required": False,
                    "fields": [{"name": "q", "type": "input_text"}],
                }
            ]
        }

    monkeypatch.setattr(run, "_get_json", http)
    assert run.run(TEST_DSN)["ok"] == 1
    conn.execute("UPDATE job_questions SET questions='{}'::jsonb")
    conn.commit()
    calls.clear()
    assert run.run(TEST_DSN)["ok"] == 1
    assert calls == []
    assert all(
        r["questions"] == {}
        for r in conn.execute("SELECT questions FROM job_questions").fetchall()
    )
    conn.execute("DELETE FROM job_questions")
    conn.commit()
    # Feed enumeration remains complete; only optional question backfill expires.
    original = legacy_spool.spool_questions

    def expired(*args, **kwargs):
        monkeypatch.setattr(legacy_spool, budget, value)
        return original(*args, **kwargs)

    monkeypatch.setattr(run, "spool_questions", expired)
    result = run.run(TEST_DSN)
    assert result["ok"] == 1 and result["failed"] == 0
    assert (
        conn.execute("SELECT poll_failures FROM companies").fetchone()["poll_failures"]
        == 0
    )


@requires_db
def test_question_backlog_read_is_bounded_before_spooling(conn):
    from job_discovery import db
    from tests.test_lifecycle_safety import seed

    seed(conn, count=3)
    company = conn.execute("SELECT id FROM companies").fetchone()["id"]
    assert db.greenhouse_jobs_missing_questions(conn, company, limit=1) == ["1"]
