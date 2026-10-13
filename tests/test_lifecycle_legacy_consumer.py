"""Pre-cutover compatibility through the real poll and reviewer, offline providers."""
import os
from dataclasses import replace
from unittest.mock import Mock

import pytest

from job_discovery import db, run as runner
from job_discovery.lifecycle import config, locks
from job_discovery.models import Posting
from tests.conftest import requires_db
from tests.test_reviewer_run import StubClient, USER, _entitle

JD = "Build reliable public services."
RAWS = {
    "lever": {"descriptionPlain": JD},
    "workday": {"jobPostingInfo": {"jobDescription": JD}},
    "smartrecruiters": {"jobAd": {"sections": {"jobDescription": {"text": JD}}}},
}


@requires_db
@pytest.mark.parametrize("ats", list(RAWS))
def test_flag_off_new_job_completes_actual_reviewer(conn, monkeypatch, ats):
    import reviewer.run as reviewer

    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setenv("OPENROUTER_API_KEY", "offline-provider-double")
    conn.execute(
        "INSERT INTO profiles(user_id,resume_text,instructions,profile_version,preferred_locations) "
        "VALUES (%s,'Synthetic resume','Synthetic instructions','v1',ARRAY['Remote'])", (USER,)
    )
    conn.commit()
    _entitle(conn, USER)
    monkeypatch.setattr(runner, "load_targets", lambda: [{"name": "Fixture", "ats": ats, "token": "fixture"}])

    def adapter(token, **kwargs):
        if ats != "lever":
            assert kwargs == {"fetch_details": True}
        return [Posting("new", "SRE", "https://example.test/job", remote=True, raw=RAWS[ats])]

    monkeypatch.setitem(runner.ADAPTERS, ats, adapter)
    provider = StubClient()
    monkeypatch.setattr(reviewer, "ReviewClient", lambda **kw: provider)
    # Unrelated enrichers are isolated; review_all, selection, stage2 and persistence are real.
    monkeypatch.setattr("job_discovery.locations.resolve_new_locations", lambda conn: None)
    monkeypatch.setattr(runner, "_run_prune", lambda conn: None)
    result = runner.run()
    assert result["failed"] == 0 and result["new_jobs"] == 1
    assert provider.stage2_calls == [JD]
    row = conn.execute("SELECT j.description,r.verdict,r.error FROM jobs j JOIN job_reviews r ON r.job_id=j.id").fetchone()
    assert row == {"description": JD, "verdict": "approve", "error": None}


@requires_db
def test_sticky_cutover_with_flags_off_blocks_new_and_refill(conn):
    db.sync_seed(conn, [{"name": "Fixture", "ats": "lever", "token": "fixture"}])
    cid = conn.execute("SELECT id FROM companies").fetchone()["id"]
    db.upsert_job(conn, cid, "lever", "fixture", Posting("old", "SRE", "https://example.test/old"))
    # Normal feature fixture records already-completed cutover; no activation/guard probe.
    conn.execute("UPDATE lifecycle_maintenance_state SET cutover_at=clock_timestamp() WHERE singleton")
    conn.commit()
    control = config.read_control(conn)
    assert not control.maintenance_enabled and not control.source_enabled
    for external_id in ("old", "new"):
        db.upsert_job(conn, cid, "lever", "fixture", Posting(external_id, "SRE", "https://example.test/job", raw=RAWS["lever"]))
    assert [r["description"] for r in conn.execute("SELECT description FROM jobs")] == [None, None]


@requires_db
@pytest.mark.parametrize("changes,cutover,allowed", [
    ({}, None, True),
    ({"source_enabled": True}, None, False),
    ({"hydration_enabled": True}, None, False),
    ({"maintenance_enabled": True}, None, False),
    ({"safety_stage": "enforced"}, None, False),
    ({"archive_ever_activated": True}, None, False),
    ({}, "existing durable timestamp", False),
])
def test_legacy_capture_reads_existing_control_contract(conn, monkeypatch, changes, cutover, allowed):
    # Read-side states only: no control transitions or privilege/activation tests.
    control = replace(config.read_control(conn), **changes)
    monkeypatch.setattr(config, "read_control", lambda conn: control)
    monkeypatch.setattr(locks, "enter_gate", lambda conn: None)
    reader = Mock()
    reader.execute.return_value.fetchone.return_value = {"cutover_at": cutover}
    assert config.legacy_description_capture_allowed(reader) is allowed


@requires_db
@pytest.mark.parametrize("ats", ["workday", "smartrecruiters"])
def test_post_cutover_flag_off_poll_skips_details_and_payloads(conn, monkeypatch, ats):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    conn.execute("UPDATE lifecycle_maintenance_state SET cutover_at=clock_timestamp() WHERE singleton")
    conn.commit()
    monkeypatch.setattr(runner, "load_targets", lambda: [{"name": "Fixture", "ats": ats, "token": "fixture"}])
    def adapter(token, *, fetch_details):
        assert fetch_details is False
        # Even an unsolicited body in the listing response must stay transient.
        return [Posting("new", "SRE", "https://example.test/job", raw=RAWS[ats])]
    monkeypatch.setitem(runner.ADAPTERS, ats, adapter)
    monkeypatch.setattr("job_discovery.locations.resolve_new_locations", lambda conn: None)
    monkeypatch.setattr(runner, "_run_prune", lambda conn: None)
    assert runner.run()["new_jobs"] == 1
    assert conn.execute("SELECT description FROM jobs").fetchone()["description"] is None
