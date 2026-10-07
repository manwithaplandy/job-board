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
