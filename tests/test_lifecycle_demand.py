"""Ordinary demand hydration contracts; not an independent mechanism review."""

import asyncio
from uuid import uuid4
from unittest.mock import AsyncMock

from job_discovery.lifecycle.demand import (
    parse_payload,
    fetch_payload,
    request_demand,
    hydrate_demand,
)
from reviewer.run import review_batch, review_one
from tests.conftest import requires_db
from tests.test_lifecycle_reconcile import setup_source


def test_total_payload_parser():
    for raw in [None, [], "x", {"description": 3}, {"description": " "}]:
        assert parse_payload(raw) is None
    assert parse_payload({"description": " JD ", "questions": False}) == {
        "description": "JD",
        "questions": None,
    }


def test_missing_description_has_zero_model_calls():
    client = AsyncMock()
    candidate = {
        "id": "x",
        "title": "Role",
        "company_name": "Acme",
        "description": None,
    }
    assert asyncio.run(review_one(candidate, "", client)).verdict is None
    assert asyncio.run(review_batch([candidate], "", client, 1)) == ([], False)
    assert client.mock_calls == []


def test_exact_stored_coordinates_and_total_detail(monkeypatch):
    calls = []

    def fetch(url):
        calls.append(url)
        return {"id": 123, "content": "<p>JD</p>", "questions": []}

    monkeypatch.setattr("job_discovery.lifecycle.demand.get_json", fetch)
    assert (
        fetch_payload(
            {"ats": "greenhouse", "public_board_ref": "acme", "external_id": "123"}
        )["description"]
        == "JD"
    )
    assert calls == [
        "https://boards-api.greenhouse.io/v1/boards/acme/jobs/123?questions=true"
    ]
    for bad in ["../acme", "https://evil.test", "acme?x=1"]:
        assert (
            fetch_payload(
                {"ats": "greenhouse", "public_board_ref": bad, "external_id": "123"}
            )
            is None
        )


@requires_db
def test_demand_ready_is_durable_and_fetch_is_outside_transaction(conn):
    setup_source(conn)
    job = conn.execute("SELECT id FROM jobs LIMIT 1").fetchone()["id"]
    user = str(uuid4())
    demand = request_demand(conn, job, user, "review")
    conn.commit()
    assert request_demand(conn, job, user, "review").id == demand.id
    conn.commit()

    def fetch(coordinates):
        assert conn.info.transaction_status.name == "IDLE"
        return {"description": "Demand JD", "questions": {"questions": []}}

    assert hydrate_demand(conn, demand, fetch) == "ready"
    row = conn.execute(
        "SELECT * FROM job_payload_demands WHERE id=%s", (demand.id,)
    ).fetchone()
    assert row["job_version_id"] is not None
    assert row["description_snapshot"] == "Demand JD"
    assert (
        conn.execute(
            "SELECT description_last_used_at FROM jobs WHERE id=%s", (job,)
        ).fetchone()["description_last_used_at"]
        is None
    )
    assert (
        hydrate_demand(
            conn,
            demand,
            lambda _: (_ for _ in ()).throw(AssertionError("must reuse durable ready")),
        )
        == "ready"
    )


@requires_db
def test_failed_fetch_defers_without_version(conn):
    setup_source(conn)
    job = conn.execute("SELECT id FROM jobs LIMIT 1").fetchone()["id"]
    demand = request_demand(conn, job, str(uuid4()), "prepare")
    conn.commit()

    def failure(_):
        raise ValueError("offline fetch unavailable")

    assert hydrate_demand(conn, demand, failure) == "deferred"
    row = conn.execute(
        "SELECT status,job_version_id FROM job_payload_demands WHERE id=%s",
        (demand.id,),
    ).fetchone()
    assert row == {"status": "deferred", "job_version_id": None}


@requires_db
def test_direct_older_live_demand_and_immutable_snapshot(conn):
    from job_discovery.lifecycle.identity import migrate_identity_batch

    cid = conn.execute(
        "INSERT INTO companies(name,ats,token) VALUES ('Old','lever','old') RETURNING id"
    ).fetchone()["id"]
    job = "lever:old:1"
    conn.execute(
        "INSERT INTO jobs(id,company_id,external_id,title,url,first_seen_at) VALUES(%s,%s,'1','Old live','https://example.test/job',clock_timestamp()-interval '31 days')",
        (job, cid),
    )
    migrate_identity_batch(conn)
    demand = request_demand(conn, job, str(uuid4()), "description")
    conn.commit()
    assert (
        hydrate_demand(conn, demand, lambda _: {"description": "Original JD"})
        == "ready"
    )
    before = conn.execute(
        "SELECT job_version_id,description_snapshot FROM job_payload_demands WHERE id=%s",
        (demand.id,),
    ).fetchone()
    conn.execute(
        "UPDATE jobs SET description='A later source description' WHERE id=%s", (job,)
    )
    conn.commit()
    assert (
        conn.execute(
            "SELECT job_version_id,description_snapshot FROM job_payload_demands WHERE id=%s",
            (demand.id,),
        ).fetchone()
        == before
    )


@requires_db
def test_source_change_during_fetch_defers_stale_completion(conn):
    from job_discovery.lifecycle.claims import claim_work
    from job_discovery.lifecycle.identity import capture_version

    setup_source(conn)
    job = conn.execute("SELECT id FROM jobs LIMIT 1").fetchone()["id"]
    demand = request_demand(conn, job, str(uuid4()), "description")
    conn.commit()

    def fetch(coordinates):
        claim = claim_work(conn, "source_update", str(uuid4()), 180)
        capture_version(
            conn,
            coordinates["listing_id"],
            {"title": "New title", "url": "https://example.test/job"},
            conn.execute("SELECT clock_timestamp() n").fetchone()["n"],
            claim,
        )
        conn.commit()
        return {"description": "stale input"}

    assert hydrate_demand(conn, demand, fetch) == "deferred"
    assert (
        conn.execute(
            "SELECT description_snapshot FROM job_payload_demands WHERE id=%s",
            (demand.id,),
        ).fetchone()["description_snapshot"]
        is None
    )


@requires_db
def test_consumption_stamps_only_successful_exact_payload(conn):
    from job_discovery.lifecycle.demand import apply_consumptions

    setup_source(conn)
    job = conn.execute("SELECT id FROM jobs LIMIT 1").fetchone()["id"]
    demand = request_demand(conn, job, str(uuid4()), "description")
    conn.commit()
    assert hydrate_demand(conn, demand, lambda _: {"description": "JD"}) == "ready"
    assert apply_consumptions(conn) == 0
    assert (
        conn.execute(
            "SELECT description_last_used_at FROM jobs WHERE id=%s", (job,)
        ).fetchone()["description_last_used_at"]
        is None
    )
    conn.execute(
        "UPDATE job_payload_demands SET consumed_at=clock_timestamp() WHERE id=%s",
        (demand.id,),
    )
    conn.commit()
    assert apply_consumptions(conn) == 1
    assert (
        conn.execute(
            "SELECT description_last_used_at FROM jobs WHERE id=%s", (job,)
        ).fetchone()["description_last_used_at"]
        is not None
    )


@requires_db
def test_cancelled_own_demand_does_not_get_late_snapshot(conn):
    from job_discovery.lifecycle.claims import cancel_claim
    from job_discovery.lifecycle.types import ClaimRef

    setup_source(conn)
    job = conn.execute("SELECT id FROM jobs LIMIT 1").fetchone()["id"]
    demand = request_demand(conn, job, str(uuid4()), "description")
    conn.commit()

    def fetch(_):
        row = conn.execute(
            "SELECT * FROM job_payload_demands WHERE id=%s", (demand.id,)
        ).fetchone()
        cancel_claim(
            conn,
            ClaimRef(
                row["claim_owner_token"], row["claim_generation"], row["lease_until"]
            ),
        )
        conn.execute(
            "UPDATE job_payload_demands SET status='cancelled' WHERE id=%s",
            (demand.id,),
        )
        conn.commit()
        return {"description": "late"}

    assert hydrate_demand(conn, demand, fetch) == "deferred"
    assert conn.execute(
        "SELECT status,description_snapshot FROM job_payload_demands WHERE id=%s",
        (demand.id,),
    ).fetchone() == {"status": "cancelled", "description_snapshot": None}


@requires_db
def test_filtered_candidates_hydrate_before_review_and_persist_exact_input(
    conn, monkeypatch
):
    from job_discovery.lifecycle.demand import hydrate_candidates
    from reviewer import db
    from tests.test_reviewer_run import StubClient

    setup_source(conn, count=2)
    jobs = [r["id"] for r in conn.execute("SELECT id FROM jobs ORDER BY id")]
    conn.execute("UPDATE jobs SET location='Elsewhere',remote=false")
    conn.execute(
        "UPDATE jobs SET location='Remote',remote=true WHERE id=%s", (jobs[0],)
    )
    conn.execute(
        "UPDATE lifecycle_control SET hydration_enabled=true,activation_generation=activation_generation+1"
    )
    conn.commit()
    user = str(uuid4())
    candidates, total = db.select_candidates(
        conn, user, "profile", 10, preferred_locations=["Remote"]
    )
    assert total == 1 and candidates[0]["id"] == jobs[0]
    fetched = []

    def get(url):
        fetched.append(url)
        return {"id": "0", "descriptionPlain": "Actual JD"}

    monkeypatch.setattr("job_discovery.lifecycle.demand.get_json", get)
    assert hydrate_candidates(conn, [r["id"] for r in candidates], user) == [jobs[0]]
    assert len(fetched) == 1 and fetched[0].endswith("/0?mode=json")
    candidates = db.attach_demand_snapshots(conn, candidates, user)
    conn.commit()
    client = StubClient()
    results, halted = asyncio.run(review_batch(candidates, "profile", client, 1))
    assert not halted and client.stage2_calls == ["Actual JD"]
    db.upsert_review(conn, results[0].as_row(user_id=user, profile_version="profile"))
    conn.commit()
    row = conn.execute(
        "SELECT job_version_id,description_snapshot FROM job_reviews WHERE user_id=%s",
        (user,),
    ).fetchone()
    assert row["job_version_id"] == candidates[0]["job_version_id"]
    assert row["description_snapshot"] == "Actual JD"
    assert (
        conn.execute(
            "SELECT consumed_at FROM job_payload_demands WHERE user_id=%s", (user,)
        ).fetchone()["consumed_at"]
        is not None
    )


@requires_db
def test_flag_off_prepare_missing_questions_worker_reaches_durable_ready(
    conn, monkeypatch
):
    from job_discovery import db as job_db
    from job_discovery.models import Posting
    from job_discovery.lifecycle.demand import process_pending

    cid = conn.execute(
        "INSERT INTO companies(name,ats,token) VALUES('Legacy','greenhouse','legacy') RETURNING id"
    ).fetchone()["id"]
    job = "greenhouse:legacy:1"
    job_db.upsert_jobs(
        conn,
        cid,
        "greenhouse",
        "legacy",
        [
            Posting(
                "1", "Role", "https://example.test/job", raw={"content": "Legacy JD"}
            )
        ],
    )
    conn.commit()
    assert (
        conn.execute("SELECT * FROM source_listings WHERE job_id=%s", (job,)).fetchone()
        is None
    )
    assert (
        conn.execute("SELECT hydration_enabled FROM lifecycle_control").fetchone()[
            "hydration_enabled"
        ]
        is False
    )
    assert (
        conn.execute("SELECT * FROM job_questions WHERE job_id=%s", (job,)).fetchone()
        is None
    )
    demand = request_demand(conn, job, str(uuid4()), "prepare")
    conn.commit()
    fetched = []

    def get(url):
        assert conn.info.transaction_status.name == "IDLE"
        fetched.append(url)
        return {
            "id": 1,
            "content": "Complete JD",
            "questions": [
                {"label": "Name", "fields": [{"name": "name", "type": "input_text"}]}
            ],
        }

    monkeypatch.setattr("job_discovery.lifecycle.demand.get_json", get)
    assert process_pending(conn) == 1
    assert fetched == [
        "https://boards-api.greenhouse.io/v1/boards/legacy/jobs/1?questions=true"
    ]
    row = conn.execute(
        "SELECT * FROM job_payload_demands WHERE id=%s", (demand.id,)
    ).fetchone()
    assert row["status"] == "ready" and row["job_version_id"] is not None
    assert (
        conn.execute("SELECT * FROM source_listings WHERE job_id=%s", (job,)).fetchone()
        is not None
    )
    assert (
        row["description_snapshot"] == "Complete JD"
        and row["questions_snapshot"]["questions"][0]["label"] == "Name"
    )
    assert row["consumed_at"] is None
    # Sticky cutover never restores the compatibility worker when flags are off.
    conn.execute(
        "UPDATE lifecycle_maintenance_state SET cutover_at=clock_timestamp() WHERE singleton"
    )
    conn.commit()
    request_demand(conn, job, str(uuid4()), "prepare")
    conn.commit()
    assert process_pending(conn) == 0
    assert len(fetched) == 1
