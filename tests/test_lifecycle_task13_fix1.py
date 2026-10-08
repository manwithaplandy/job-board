"""Ordinary maintenance-result propagation through the two real source callers."""

import pytest

from job_discovery import http, run as daily
from job_discovery.lifecycle import source_worker
from job_discovery.lifecycle.types import SweepResult
from tests.conftest import TEST_DSN, requires_db
from tests.test_lifecycle_reconcile import setup_source


@requires_db
@pytest.mark.parametrize("caller", ["source_worker", "daily"])
@pytest.mark.parametrize("blocked", [True, False])
def test_maintenance_result_defers_admission_but_commits_source_progress(
    conn, monkeypatch, caller, blocked
):
    source = setup_source(conn, count=2)
    conn.execute("UPDATE jobs SET closed_at=clock_timestamp() WHERE external_id='0'")
    before = conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"]
    conn.commit()
    calls = []

    def maintenance(dsn):
        assert dsn == TEST_DSN
        calls.append("maintenance")
        return SweepResult(0, 0, blocked, None)

    def feed(url, **kwargs):
        assert calls == ["maintenance"]
        calls.append("feed")
        return [
            {"id": "0", "text": "Changed title", "hostedUrl": "https://example.test/0"},
            {"id": "novel", "text": "Novel role", "hostedUrl": "https://example.test/novel"},
        ]

    monkeypatch.setattr(http, "get_json", feed)
    target = source_worker if caller == "source_worker" else daily
    monkeypatch.setattr(target, "pre_admission_maintenance", maintenance)
    if caller == "daily":
        monkeypatch.setattr(daily, "load_targets", lambda: [])
        result = daily.run(TEST_DSN)
    else:
        result = source_worker.run_source_once(TEST_DSN)

    assert calls == ["maintenance", "feed"]
    assert result["ok"] == 1 and result["failed"] == 0
    assert result["new_jobs"] == int(not blocked) and result["closed_jobs"] == 0
    # The caller closed its worker connection; these are durable observations.
    assert conn.execute("SELECT closed_at FROM jobs WHERE external_id='0'").fetchone()["closed_at"] is None
    listed = conn.execute("SELECT successful_sighting_count FROM source_listings WHERE external_id='0'").fetchone()
    assert listed["successful_sighting_count"] == 1
    assert conn.execute("SELECT consecutive_complete_misses FROM source_listings WHERE external_id='1'").fetchone()["consecutive_complete_misses"] == 1
    enum = conn.execute("SELECT id,status,reconciled_at FROM source_enumerations WHERE source_id=%s", (source["id"],)).fetchone()
    assert enum["status"] == "complete" and enum["reconciled_at"] is not None
    assert {r["external_id"] for r in conn.execute("SELECT external_id FROM enumeration_members WHERE enumeration_id=%s", (enum["id"],))} == {"0", "novel"}
    assert conn.execute("SELECT count(*) n FROM jobs WHERE external_id='novel'").fetchone()["n"] == int(not blocked)
    if blocked:
        assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == before
        assert conn.execute("SELECT title FROM jobs WHERE external_id='0'").fetchone()["title"] == "Role"
    if caller == "daily":
        recorded = conn.execute("SELECT new_jobs,closed_jobs,companies_ok,finished_at FROM poll_runs ORDER BY id DESC LIMIT 1").fetchone()
        assert recorded["new_jobs"] == result["new_jobs"]
        assert recorded["closed_jobs"] == 0 and recorded["companies_ok"] == 1
        assert recorded["finished_at"] is not None
