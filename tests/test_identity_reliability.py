"""Ordinary owned-database reliability checks; no network or production data."""

import os

from tests.conftest import requires_db
from tests.test_identity_campaign import REVISION, seed_campaign


@requires_db
def test_missing_operator_authorization_prevents_any_progress(conn):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn, jobs=1)
    # Remove the optional fixture authorization once the new ledger exists.
    if conn.execute(
        "SELECT to_regclass('lifecycle_identity_authorizations') n"
    ).fetchone()["n"]:
        conn.execute(
            "DELETE FROM lifecycle_identity_authorizations WHERE campaign_id=%s", (cid,)
        )
    conn.commit()
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["state"] == "stopped"
    assert result["mapped_jobs"] == 0


@requires_db
def test_full_gap_scan_does_not_hold_shared_gate(conn, monkeypatch):
    from job_discovery import db
    from job_discovery.lifecycle import identity_campaign as worker
    from job_discovery.lifecycle.config import LIFECYCLE_GATE_KEY

    cid = seed_campaign(conn, jobs=1)
    real_connect = db.connect
    scans = []

    class Observed:
        def __init__(self, real):
            self.real = real

        def __enter__(self):
            self.real.__enter__()
            return self

        def __exit__(self, *args):
            return self.real.__exit__(*args)

        def __getattr__(self, name):
            return getattr(self.real, name)

        def execute(self, query, *args, **kwargs):
            if "SELECT EXISTS(SELECT FROM jobs j" in str(query):
                with real_connect(os.environ["TEST_DATABASE_URL"]) as other:
                    acquired = other.execute(
                        "SELECT pg_try_advisory_xact_lock(%s) ok", (LIFECYCLE_GATE_KEY,)
                    ).fetchone()["ok"]
                    scans.append(acquired)
            return self.real.execute(query, *args, **kwargs)

    monkeypatch.setattr(worker, "connect", lambda dsn: Observed(real_connect(dsn)))
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["state"] == "completed"
    assert scans and all(scans), "full-corpus scan blocked the shared gate"


import pytest


@requires_db
@pytest.mark.parametrize(
    "change",
    [
        "authorized_at=clock_timestamp()-interval '50 seconds',valid_until=clock_timestamp()-interval '10 seconds'",
        "observed_at=clock_timestamp()-interval '91 seconds'",
        "observed_at=clock_timestamp()+interval '1 second'",
        "authorized_at=clock_timestamp()+interval '1 second',valid_until=clock_timestamp()+interval '30 seconds'",
        "project_ref='wrong-project'",
        "source_revision=repeat('b',40)",
        "activation_generation=999",
        "free_bytes=1073741824",
        "resident_wal_bytes=4294967296",
    ],
)
def test_unusable_observation_stops_before_mapping(conn, change):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn, jobs=1)
    conn.execute("UPDATE lifecycle_identity_authorizations SET " + change)
    conn.commit()
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["state"] == "stopped" and result["mapped_jobs"] == 0


@requires_db
@pytest.mark.parametrize(
    "change",
    [
        "observed_at=clock_timestamp()-interval '91 seconds'",
        "authorized_at=clock_timestamp()-interval '50 seconds',valid_until=clock_timestamp()-interval '10 seconds'",
    ],
)
def test_freshness_expiry_during_mapping_rolls_back_batch(conn, monkeypatch, change):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn, jobs=2)
    mapper = worker.migrate_identity_batch

    def expire(*args, **kwargs):
        mapped = mapper(*args, **kwargs)
        args[0].execute("UPDATE lifecycle_identity_authorizations SET " + change)
        return mapped

    monkeypatch.setattr(worker, "migrate_identity_batch", expire)
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["state"] == "stopped" and result["mapped_jobs"] == 0
    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 0


@requires_db
@pytest.mark.parametrize(
    "mutation", ["behind", "outside", "boundary", "listing_removed"]
)
def test_mutation_between_snapshot_and_certification_never_certifies_old_snapshot(
    conn, monkeypatch, mutation
):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn, jobs=1)
    scan = worker._completion_snapshot

    def change(raw, row, deadline):
        result = scan(raw, row, deadline)
        if mutation == "listing_removed":
            conn.execute("DELETE FROM source_listings")
        elif mutation == "boundary":
            conn.execute(
                "UPDATE lifecycle_identity_campaigns SET company_high_water=2 WHERE id=%s",
                (cid,),
            )
        else:
            key = "000000" if mutation == "behind" else "zzz"
            conn.execute(
                "INSERT INTO jobs(id,company_id,external_id,title,url) VALUES(%s,1,%s,'Synthetic','https://example.test')",
                (key, key),
            )
        conn.commit()
        return result

    monkeypatch.setattr(worker, "_completion_snapshot", change)
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["state"] != "completed"
    assert result["mapped_jobs"] == 1
    monkeypatch.setattr(worker, "_completion_snapshot", scan)
    if mutation != "boundary":
        conn.execute(
            "UPDATE lifecycle_identity_campaigns SET next_turn_at=clock_timestamp() WHERE id=%s",
            (cid,),
        )
        conn.commit()
        result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
        assert result["state"] == (
            "stopped" if mutation in ("behind", "listing_removed") else "completed"
        )


@requires_db
def test_generation_is_transactional_and_covers_relevant_updates(conn):
    from job_discovery.lifecycle.identity import migrate_identity_batch

    seed_campaign(conn, jobs=1)
    migrate_identity_batch(conn, job_ids=["000001"])
    conn.commit()

    def generation():
        return conn.execute(
            "SELECT generation FROM lifecycle_identity_generation"
        ).fetchone()["generation"]

    for table, assignment in [
        ("jobs", "title='Changed'"),
        ("companies", "name='Changed'"),
        ("source_accounts", "legacy_active=false"),
        ("source_listings", "external_id='changed'"),
    ]:
        before = generation()
        conn.commit()
        conn.execute(f"UPDATE {table} SET {assignment}")
        assert generation() > before
        conn.rollback()
        assert generation() == before
        conn.commit()


@requires_db
def test_authorization_expiring_during_gap_scan_prevents_completion(conn, monkeypatch):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn, jobs=1)
    scan = worker._completion_snapshot

    def expire(*args):
        result = scan(*args)
        conn.execute(
            "UPDATE lifecycle_identity_authorizations SET authorized_at=clock_timestamp()-interval '50 seconds',valid_until=clock_timestamp()-interval '10 seconds'"
        )
        conn.commit()
        return result

    monkeypatch.setattr(worker, "_completion_snapshot", expire)
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["state"] == "stopped" and result["mapped_jobs"] == 1


@requires_db
def test_authorization_expiring_after_final_check_rejects_commit(conn, monkeypatch):
    from time import sleep
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn, jobs=1)
    mapped = [False]
    original_map = worker.migrate_identity_batch
    original_commit = worker._CampaignConnection.commit

    def map_batch(*args, **kwargs):
        result = original_map(*args, **kwargs)
        mapped[0] = True
        return result

    def commit(connection):
        if mapped[0]:
            mapped[0] = False
            connection.execute(
                "UPDATE lifecycle_identity_authorizations SET valid_until=clock_timestamp()+interval '50 milliseconds'"
            )
            sleep(0.08)
        return original_commit(connection)

    monkeypatch.setattr(worker, "migrate_identity_batch", map_batch)
    monkeypatch.setattr(worker._CampaignConnection, "commit", commit)
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["state"] == "stopped" and result["mapped_jobs"] == 0
    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 0


@requires_db
@pytest.mark.parametrize(
    "statement",
    ["UPDATE companies SET name='waiting'", "DELETE FROM lifecycle_identity_campaigns"],
)
def test_direct_operator_dml_keeps_bounded_gate_order(conn, statement):
    from concurrent.futures import ThreadPoolExecutor, TimeoutError
    from time import monotonic
    from job_discovery import db
    from job_discovery.lifecycle.locks import enter_gate
    from psycopg.errors import LockNotAvailable

    seed_campaign(conn, jobs=1)
    enter_gate(conn)

    def write():
        with db.connect(os.environ["TEST_DATABASE_URL"]) as other:
            other.execute(statement)

    start = monotonic()
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(write)
        try:
            with pytest.raises(LockNotAvailable):
                future.result(timeout=3)
        except TimeoutError:
            pytest.fail("DML bypassed bounded statement gate")
        finally:
            conn.rollback()
    assert monotonic() - start < 3


@requires_db
def test_campaign_growth_cap_prevents_more_mapping(conn, monkeypatch):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn, jobs=1)
    monkeypatch.setattr(worker, "MAX_CAMPAIGN_GROWTH", 1024**2)
    conn.execute(
        "UPDATE lifecycle_identity_campaigns SET before_bytes=pg_database_size(current_database())-2097152 WHERE id=%s",
        (cid,),
    )
    conn.commit()
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["state"] == "stopped" and result["mapped_jobs"] == 0
    assert "growth" in result["stop_reason"]
