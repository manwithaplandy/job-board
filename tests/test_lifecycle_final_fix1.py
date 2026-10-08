"""Final ordinary composition regressions. No omitted mechanism probes."""
from time import monotonic
from uuid import uuid4

import pytest

from tests.conftest import requires_db
from tests.test_lifecycle_reconcile import setup_source, begin
from tests.test_lifecycle_admission import admit
from tests.archive_helpers import activate_fixture
from tests.test_archive_batches import verified
from job_discovery.models import Posting
from job_discovery.lifecycle import demand, maintenance, reconcile, operational
from job_discovery.lifecycle.claims import claim_work, cancel_claim
from job_discovery.archive import batches
from job_discovery.archive.types import BatchLimits


def retirement_fixture(conn):
    conn.execute("ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history")
    conn.execute("UPDATE lifecycle_control SET safety_stage='enforced',retirement_enabled=true,retirement_dry_run=false,activation_generation=activation_generation+1")
    conn.execute("ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history")
    conn.commit()


def acknowledge(conn):
    claim = claim_work(conn, "archive", str(uuid4()), 180)
    conn.commit()
    while conn.execute("SELECT 1 FROM public_pending_events LIMIT 1").fetchone():
        ref = batches.claim_batch(conn, BatchLimits(), claim)
        conn.commit()
        seal = batches.seal_batch(ref)
        batches.persist_seal(conn, seal)
        conn.commit()
        batches.ack_batch(conn, verified(seal), claim)
        conn.commit()
    cancel_claim(conn, claim)
    conn.commit()


def posting(title="Role", location=None, body="JD"):
    return Posting("0", title, "https://example.test/job", location=location,
                   raw={"descriptionPlain": body})


@requires_db
@pytest.mark.parametrize("case", ["old_current", "count", "old_location"])
def test_archived_admission_resumes_at_prospective_bound(conn, case):
    source = setup_source(conn)
    if case == "old_location":
        conn.execute("INSERT INTO locations(raw,canonicals,source) VALUES('London',ARRAY['London'],'manual')")
    activate_fixture(conn)
    _, claim = admit(conn, source, [posting(location="London" if case == "old_location" else None)])
    if case == "count":
        for i in range(2, 12):
            admit(conn, source, [posting(title=f"Role {i}")], claim)
    else:
        conn.execute("UPDATE job_versions SET recorded_at=clock_timestamp()-interval '31 days'")
        conn.commit()
    acknowledge(conn)
    old = conn.execute("SELECT current_version_id FROM source_listings").fetchone()["current_version_id"]
    retirement_fixture(conn)
    admit(conn, source, [posting(title="Changed", location="London" if case == "old_location" else None)], claim)
    current = conn.execute("SELECT current_version_id,current_revision FROM source_listings").fetchone()
    assert current["current_version_id"] != old
    assert conn.execute("SELECT title FROM jobs").fetchone()["title"] == "Changed"
    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] <= 11
    assert not conn.execute("SELECT 1 FROM job_versions v JOIN source_listings l ON l.id=v.source_listing_id WHERE v.id<>l.current_version_id AND v.recorded_at<clock_timestamp()-interval '30 days'").fetchone()
    assert not conn.execute("SELECT 1 FROM public_pending_events WHERE aggregate_type IN ('job_versions','job_locations','job_skills') AND kind='removed'").fetchone()


@requires_db
@pytest.mark.parametrize("protected", [False, True])
def test_unarchived_or_private_versions_still_pause(conn, protected):
    source = setup_source(conn)
    activate_fixture(conn)
    _, claim = admit(conn, source, [posting()])
    old = conn.execute("SELECT current_version_id FROM source_listings").fetchone()["current_version_id"]
    conn.execute("UPDATE job_versions SET recorded_at=clock_timestamp()-interval '31 days'")
    if protected:
        conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id,description_snapshot) VALUES(%s,'lever:fixture:0',%s,'Saved JD')", (uuid4(), old))
    conn.commit()
    if protected:
        acknowledge(conn)
    retirement_fixture(conn)
    admit(conn, source, [posting(title="Changed")], claim)
    assert conn.execute("SELECT current_version_id FROM source_listings").fetchone()["current_version_id"] == old
    assert conn.execute("SELECT title FROM jobs").fetchone()["title"] == "Role"


@requires_db
def test_live_demand_records_one_positive_and_defeats_older_absence(conn):
    source = setup_source(conn)
    conn.execute("UPDATE source_listings SET consecutive_complete_misses=1,first_complete_miss_at=clock_timestamp()-interval '25 hours'")
    older = begin(conn, source)
    before = conn.execute("SELECT * FROM source_listings").fetchone()
    request = demand.request_demand(conn, before["job_id"], str(uuid4()), "description")
    conn.commit()
    assert demand.hydrate_demand(conn, request, lambda _: {"description": "Live JD"}) == "ready"
    after = conn.execute("SELECT * FROM source_listings").fetchone()
    assert after["successful_sighting_count"] == before["successful_sighting_count"] + 1
    assert after["last_demand_verification_id"] == request.id
    assert after["last_observation_kind"] == "demand"
    assert after["consecutive_complete_misses"] == 0
    assert after["discovery_anchor_at"] == before["discovery_anchor_at"]
    assert demand.hydrate_demand(conn, request, lambda _: pytest.fail("ready reuse fetched")) == "ready"
    reconcile.complete_enumeration(conn, older, reconcile.SourceStatus(complete=True))
    reconcile.reconcile_chunk(conn, older)
    conn.commit()
    assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"] is None
    assert conn.execute("SELECT successful_sighting_count FROM source_listings").fetchone()["successful_sighting_count"] == after["successful_sighting_count"]


@requires_db
def test_poll_and_live_demand_share_unicode_hash(conn):
    source = setup_source(conn)
    admit(conn, source, [posting(body="Cafe\u0301   team")])
    before = conn.execute("SELECT current_version_id FROM source_listings").fetchone()
    request = demand.request_demand(conn, "lever:fixture:0", str(uuid4()), "description")
    conn.commit()
    assert demand.hydrate_demand(conn, request, lambda _: {"description": "Cafe\u0301 team"}) == "ready"
    assert conn.execute("SELECT current_version_id FROM source_listings").fetchone() == before


@requires_db
def test_detail_capture_and_bookkeeping_retire_without_erasing_saved_inputs(conn):
    setup_source(conn, count=3)
    requests = []
    for i in range(3):
        request = demand.request_demand(conn, f"lever:fixture:{i}", str(uuid4()), "description")
        conn.commit()
        assert demand.hydrate_demand(conn, request, lambda _: {"description": "Live JD"}) == "ready"
        requests.append(request)
    assert conn.execute("SELECT count(*) n FROM lifecycle_claims WHERE kind='demand' AND state='active'").fetchone()["n"] == 0
    conn.execute("UPDATE job_payload_demands SET settled_at=clock_timestamp()-interval '8 days',snapshot_captured_at=clock_timestamp()-interval '31 days',protection_until=clock_timestamp()-interval '1 hour'")
    conn.execute("UPDATE jobs SET description_captured_at=clock_timestamp()-interval '31 days'")
    conn.execute("INSERT INTO application_packages(user_id,job_id,job_version_id,description_snapshot,snapshot_captured_at) SELECT user_id,job_id,job_version_id,description_snapshot,snapshot_captured_at FROM job_payload_demands WHERE id=%s", (requests[1].id,))
    conn.execute("INSERT INTO generation_jobs(user_id,job_id,kind,job_version_id,description_snapshot,snapshot_captured_at) SELECT user_id,job_id,'resume',job_version_id,description_snapshot,snapshot_captured_at FROM job_payload_demands WHERE id=%s", (requests[2].id,))
    conn.commit()
    assert maintenance._terminal_batch(conn, 100, 4) == 2
    conn.commit()
    assert maintenance._payload_batch(conn, None, 100, False)[1] == 1
    conn.commit()
    assert conn.execute("SELECT description FROM jobs WHERE id='lever:fixture:0'").fetchone()["description"] is None
    assert conn.execute("SELECT description_snapshot FROM application_packages").fetchone()["description_snapshot"] == "Live JD"
    assert conn.execute("SELECT description_snapshot FROM job_payload_demands WHERE id=%s", (requests[2].id,)).fetchone()["description_snapshot"] == "Live JD"
    next_request = demand.request_demand(conn, "lever:fixture:0", str(uuid4()), "description")
    conn.commit()
    assert next_request.id != requests[0].id
    assert demand.hydrate_demand(conn, next_request, lambda _: {"description": "Fresh JD"}) == "ready"


@requires_db
def test_actual_public_writer_reaches_terminal_cleanup(conn):
    from job_discovery.db import sync_seed
    activate_fixture(conn)
    sync_seed(conn, [{"name": "Seed", "ats": "lever", "token": "fixture"}])
    conn.commit()
    maintenance.finalize_completed_producers(conn, 100)
    conn.commit()
    row = conn.execute("SELECT * FROM lifecycle_claims WHERE kind='public_writer'").fetchone()
    assert row["state"] == "cancelled" and row["generation"] > row["replay_floor"] >= 1
    # Move only the maintenance retention cutoff, never old mechanism clocks.
    class TerminalCutoff:
        def execute(self, query, params=None):
            return conn.execute(query.replace("clock_timestamp()-interval '168 hours'", "clock_timestamp()+interval '1 hour'"), params)
    assert maintenance._terminal_batch(TerminalCutoff(), 100, 3) > 0
    conn.commit()
    assert conn.execute("SELECT count(*) n FROM capacity_reservations WHERE claim_kind='public_writer'").fetchone()["n"] == 0


@requires_db
@pytest.mark.parametrize("lane", ["normal", "operational"])
def test_suspicious_empty_scheduler_has_finite_followup(conn, monkeypatch, caplog, lane):
    from job_discovery.adapters.completeness import SourceResult
    source = setup_source(conn, count=21)
    calls = []
    monkeypatch.setitem(__import__("job_discovery.adapters", fromlist=["ADAPTERS"]).ADAPTERS, "lever", lambda *a, **kw: SourceResult(iter([]), reconcile.SourceStatus()))
    monkeypatch.setattr("job_discovery.lifecycle.demand.fetch_payload", lambda coordinates: calls.append(coordinates["external_id"]))
    if lane == "operational":
        claim = claim_work(conn, "source", str(source["id"]), 180)
        operational.provision(conn, source["id"], claim)
        conn.commit()
        cancel_claim(conn, claim)
        conn.commit()
    for _ in range(3):
        conn.execute("UPDATE source_accounts SET next_due_at=NULL")
        conn.commit()
        if lane == "normal":
            reconcile.verify_due_sources(conn, max_boards=1, admission_allowed=False)
        else:
            operational.run_due(conn, max_boards=1, deadline=monotonic()+60)
    assert len(calls) == 3
    assert len(set(calls)) == 3
    assert conn.execute("SELECT count(*) n FROM jobs WHERE closed_at IS NULL").fetchone()["n"] == 21
    assert conn.execute("SELECT followup_status FROM source_accounts").fetchone()["followup_status"] == "migration_review"
    assert "migration review" in caplog.text
