"""Ordinary offline campaign, provenance and activation contracts."""

import os
from uuid import uuid4

import pytest

from tests.conftest import requires_db

REVISION = "a" * 40


def seed_campaign(conn, jobs=205, max_jobs=2000, max_companies=100, max_turns=5, exploratory=False):
    from job_discovery.lifecycle.identity import migrate_identity_batch

    conn.execute(
        "INSERT INTO companies(id,name,ats,token) VALUES(1,'Fixture','lever','campaign')"
    )
    conn.execute(
        "INSERT INTO jobs(id,company_id,external_id,title,url) SELECT lpad(n::text,6,'0'),1,n::text,'Role','https://example.test/'||n FROM generate_series(1,%s)n",
        (jobs,),
    )
    # Existing first-turn activation is immutable; this worker only continues.
    migrate_identity_batch(conn, limit=1, job_ids=[])
    conn.execute(
        "UPDATE lifecycle_control SET safety_stage='collect',identity_enabled=true,activation_generation=1"
    )
    cid = uuid4()
    conn.execute(
        """INSERT INTO lifecycle_identity_campaigns
        (id,state,source_revision,activation_generation,expires_at,max_job_rows,max_company_rows,max_turns,job_high_water,company_high_water,exploratory_pilot)
        SELECT %s,'running',%s,1,clock_timestamp()+%s::interval,%s,%s,%s,max(id),1,%s FROM jobs""",
        (cid, REVISION, '30 minutes' if exploratory else '1 hour', max_jobs, max_companies, max_turns, exploratory),
    )
    if exploratory:
        conn.execute("""INSERT INTO lifecycle_identity_authorizations
        (campaign_id,source_revision,activation_generation,authorized_at,valid_until,observed_at,
         project_ref,source,volume,capacity_bytes,free_bytes,resident_wal_bytes,
         observation_basis,disk_fetched_at,wal_fetched_at,disk_source_observed_at)
        SELECT id,source_revision,activation_generation,clock_timestamp(),clock_timestamp()+interval '40 seconds',
          NULL,'fdhspmavadgucktetzoi','supabase_metrics','synthetic-primary',
          10737418240,6442450944,1073741824,'retrieval_unknown',clock_timestamp(),clock_timestamp(),
          clock_timestamp()-interval '1 day' FROM lifecycle_identity_campaigns WHERE id=%s""", (cid,))
    else:
        authorize_campaign(conn, cid)
    conn.commit()
    return cid


def authorize_campaign(conn, cid):
    """Synthetic operator input for the owned test DB only."""
    conn.execute("""INSERT INTO lifecycle_identity_authorizations
        (campaign_id,source_revision,activation_generation,authorized_at,valid_until,observed_at,
         project_ref,source,volume,capacity_bytes,free_bytes,resident_wal_bytes)
        SELECT id,source_revision,activation_generation,clock_timestamp(),clock_timestamp()+interval '40 seconds',
          clock_timestamp(),'fdhspmavadgucktetzoi','supabase_metrics','synthetic-primary',
          10737418240,6442450944,1073741824 FROM lifecycle_identity_campaigns WHERE id=%s
        ON CONFLICT(campaign_id) DO UPDATE SET authorized_at=excluded.authorized_at,
          valid_until=excluded.valid_until,observed_at=excluded.observed_at""", (cid,))


@requires_db
def test_campaign_budget_is_durable_and_does_not_reset_ages(conn):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn, jobs=205, max_jobs=100)
    before = conn.execute("SELECT id,first_seen_at FROM jobs ORDER BY id").fetchall()
    conn.commit()
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["state"] == "budget_exhausted"
    assert result["mapped_jobs"] == result["job_rows"] == 100
    again = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert again["mapped_jobs"] == 100 and again["turns"] == 1
    assert (
        conn.execute("SELECT id,first_seen_at FROM jobs ORDER BY id").fetchall()
        == before
    )
    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 100


@requires_db
def test_campaign_resumes_exact_batches_and_accounts(conn, monkeypatch):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn)
    conn.execute(
        "INSERT INTO companies(id,name,ats,token,active,poll_failures) VALUES(2,'Old','lever','inactive',false,8)"
    )
    conn.execute(
        "UPDATE lifecycle_identity_campaigns SET company_high_water=2 WHERE id=%s",
        (cid,),
    )
    conn.commit()
    monkeypatch.setattr(worker, "MAX_BATCHES", 1)
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["mapped_jobs"] == 100
    assert worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)["turns"] == 1
    for _ in range(4):
        conn.execute(
            "UPDATE lifecycle_identity_campaigns SET next_turn_at=clock_timestamp() WHERE id=%s",
            (cid,),
        )
        conn.commit()
        result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
        if result["state"] == "completed":
            break
    assert result["state"] == "completed"
    assert result["mapped_jobs"] == 205
    assert (
        conn.execute(
            "SELECT exclusion_state FROM source_accounts WHERE public_board_ref='inactive'"
        ).fetchone()["exclusion_state"]
        == "unknown"
    )
    assert not conn.execute(
        "SELECT source_enabled OR hydration_enabled OR maintenance_enabled OR feed_enabled FROM lifecycle_control"
    ).fetchone()["?column?"]


@requires_db
@pytest.mark.parametrize("reason", ["expiry", "revision", "control", "capacity"])
def test_campaign_stops_without_mapping_on_guard_change(conn, monkeypatch, reason):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn)
    revision = REVISION
    if reason == "expiry":
        conn.execute(
            "UPDATE lifecycle_identity_campaigns SET expires_at=clock_timestamp()-interval '1 second'"
        )
    elif reason == "revision":
        revision = "b" * 40
    elif reason == "control":
        conn.execute("UPDATE lifecycle_control SET activation_generation=2")
    else:
        monkeypatch.setattr(worker, "STORAGE_LIMIT", 1)
    conn.commit()
    assert (
        worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, revision)["state"]
        == "stopped"
    )
    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 0


@requires_db
def test_campaign_failed_batch_rolls_back_cursor_and_mapping(conn, monkeypatch):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn)
    original = worker.migrate_identity_batch

    def crash(*args, **kwargs):
        original(*args, **kwargs)
        raise RuntimeError("simulated failed checkpoint")

    monkeypatch.setattr(worker, "migrate_identity_batch", crash)
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["state"] == "stopped"
    assert result["job_cursor"] is None and result["mapped_jobs"] == 0
    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 0


def test_campaign_default_entrypoint_does_not_connect(monkeypatch):
    from job_discovery.lifecycle import identity_campaign as worker

    monkeypatch.delenv("IDENTITY_BACKFILL_CAMPAIGN", raising=False)
    monkeypatch.setattr(
        worker, "connect", lambda *a: pytest.fail("disabled worker connected")
    )
    assert worker.main() == 0


@requires_db
def test_process_crash_keeps_committed_checkpoint_and_resumes(conn):
    import subprocess
    import sys
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn)
    code = """
import os,sys
from job_discovery.lifecycle import identity_campaign as worker
worker.sleep = lambda _: os._exit(73)
worker.run_turn(os.environ['TEST_DATABASE_URL'],sys.argv[1],sys.argv[2])
"""
    result = subprocess.run(
        [sys.executable, "-c", code, str(cid), REVISION], timeout=20
    )
    assert result.returncode == 73
    row = conn.execute(
        "SELECT * FROM lifecycle_identity_campaigns WHERE id=%s", (cid,)
    ).fetchone()
    assert (
        row["mapped_jobs"] == 100
        and row["job_cursor"] == "000100"
        and row["turns"] == 1
    )
    # Simulate passage of DB time after abrupt process death, using only the owned DB.
    conn.execute(
        "UPDATE lifecycle_claims SET lease_until=clock_timestamp()-interval '1 second' WHERE kind='identity_backfill'"
    )
    conn.execute(
        "UPDATE lifecycle_identity_campaigns SET next_turn_at=clock_timestamp()"
    )
    conn.commit()
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert (
        result["state"] == "completed"
        and result["mapped_jobs"] == 205
        and result["turns"] == 2
    )
    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 205


@requires_db
def test_campaign_does_not_expand_high_water_or_wait_on_another_worker(conn):
    from job_discovery.lifecycle import identity_campaign as worker
    from job_discovery.lifecycle.claims import claim_work, cancel_claim

    cid = seed_campaign(conn, jobs=2)
    conn.execute(
        "INSERT INTO companies(id,name,ats,token) VALUES(2,'Later','lever','later')"
    )
    conn.execute(
        "INSERT INTO jobs(id,company_id,external_id,title,url) VALUES('later',1,'later','Later','https://example.test/later')"
    )
    claim = claim_work(conn, "identity_backfill", "singleton", 180)
    conn.commit()
    assert worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)["turns"] == 0
    cancel_claim(conn, claim)
    conn.commit()
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["state"] == "completed" and result["mapped_jobs"] == 2
    assert (
        conn.execute(
            "SELECT count(*) n FROM source_accounts WHERE public_board_ref='later'"
        ).fetchone()["n"]
        == 0
    )
    assert (
        conn.execute(
            "SELECT count(*) n FROM source_listings WHERE job_id='later'"
        ).fetchone()["n"]
        == 0
    )


@requires_db
@pytest.mark.parametrize("change", ["pause", "controls", "expiry", "held_capacity"])
def test_campaign_rechecks_operator_and_resource_stops_between_checkpoints(
    conn, monkeypatch, change
):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn)

    def after_commit(_):
        if change == "pause":
            conn.execute("UPDATE lifecycle_identity_campaigns SET state='paused'")
        elif change == "controls":
            conn.execute(
                "UPDATE lifecycle_control SET hydration_enabled=true,activation_generation=activation_generation+1"
            )
        elif change == "expiry":
            conn.execute(
                "UPDATE lifecycle_identity_campaigns SET expires_at=clock_timestamp()-interval '1 second'"
            )
        else:
            monkeypatch.setattr(
                worker,
                "_usage",
                lambda _: {"allocated": 1, "held": worker.STORAGE_LIMIT},
            )
        conn.commit()

    monkeypatch.setattr(worker, "sleep", after_commit)
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["state"] == ("paused" if change == "pause" else "stopped")
    assert result["mapped_jobs"] == 100
    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 100


@requires_db
def test_spent_turn_budget_rolls_back_only_uncommitted_batch(conn, monkeypatch):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn)
    original = worker.migrate_identity_batch
    calls = 0

    def yield_second(*args, **kwargs):
        nonlocal calls
        calls += 1
        result = original(*args, **kwargs)
        if calls == 2:
            raise worker._PhaseEnded()
        return result

    monkeypatch.setattr(worker, "migrate_identity_batch", yield_second)
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["state"] == "running" and result["mapped_jobs"] == 100
    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 100
    conn.execute(
        "UPDATE lifecycle_identity_campaigns SET next_turn_at=clock_timestamp()"
    )
    conn.commit()
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["state"] == "completed" and result["mapped_jobs"] == 205


@requires_db
def test_finite_turn_budget_does_not_self_expand(conn, monkeypatch):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn, max_turns=1)
    monkeypatch.setattr(worker, "MAX_BATCHES", 1)
    assert (
        worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)["mapped_jobs"]
        == 100
    )
    conn.execute(
        "UPDATE lifecycle_identity_campaigns SET next_turn_at=clock_timestamp()"
    )
    conn.commit()
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert (
        result["state"] == "budget_exhausted"
        and result["mapped_jobs"] == 100
        and result["turns"] == 1
    )


@requires_db
@pytest.mark.parametrize("path", ["job_mapping", "account_mapping", "registration"])
def test_all_source_creation_paths_keep_ambiguous_inactive_boards_unknown(conn, path):
    from job_discovery.db import sync_source_accounts
    from job_discovery.lifecycle.identity import migrate_identity_batch

    conn.execute(
        "INSERT INTO companies(id,name,ats,token,active,poll_failures) VALUES(1,'A','lever','a',false,0),(2,'B','lever','b',false,5),(3,'C','lever','c',false,8),(4,'D','lever','d',true,8)"
    )
    if path == "job_mapping":
        conn.execute(
            "INSERT INTO jobs(id,company_id,external_id,title,url) SELECT token,id,token,name,'https://example.test/'||token FROM companies"
        )
        migrate_identity_batch(conn, job_ids=["a", "b", "c", "d"])
    elif path == "account_mapping":
        migrate_identity_batch(conn, company_ids=[1, 2, 3, 4])
    else:
        conn.execute(
            "UPDATE lifecycle_control SET source_enabled=true,activation_generation=activation_generation+1"
        )
        sync_source_accounts(conn)
    conn.commit()
    assert [
        r["exclusion_state"]
        for r in conn.execute(
            "SELECT exclusion_state FROM source_accounts ORDER BY public_board_ref"
        )
    ] == ["unknown", "unknown", "unknown", "enabled"]
    # Existing reviewed states stay authoritative even if legacy activity changes.
    conn.execute(
        "UPDATE source_accounts SET exclusion_state=CASE public_board_ref WHEN 'a' THEN 'deliberate' WHEN 'b' THEN 'failure_disabled' WHEN 'c' THEN 'unknown' ELSE 'enabled' END"
    )
    conn.execute("UPDATE companies SET active=true,poll_failures=0")
    conn.execute(
        "UPDATE lifecycle_control SET source_enabled=true,activation_generation=activation_generation+1"
    )
    sync_source_accounts(conn)
    migrate_identity_batch(conn, company_ids=[1, 2, 3, 4])
    conn.commit()
    assert [
        r["exclusion_state"]
        for r in conn.execute(
            "SELECT exclusion_state FROM source_accounts ORDER BY public_board_ref"
        )
    ] == ["deliberate", "failure_disabled", "unknown", "enabled"]


@requires_db
def test_revision_overlap_does_not_stop_current_worker(conn):
    from job_discovery.lifecycle import identity_campaign as worker
    from job_discovery.lifecycle.claims import claim_work, cancel_claim

    cid = seed_campaign(conn)
    claim = claim_work(conn, "identity_backfill", "singleton", 180)
    conn.commit()
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, "b" * 40)
    assert (
        result["state"] == "running"
        and result["turns"] == 0
        and result["stop_reason"] is None
    )
    cancel_claim(conn, claim)
    conn.commit()
    assert (
        worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)["state"]
        == "completed"
    )


@requires_db
def test_company_only_budget_is_finite(conn):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn, jobs=0, max_companies=1)
    conn.execute(
        "INSERT INTO companies(id,name,ats,token) VALUES(2,'Second','lever','second')"
    )
    conn.execute("UPDATE lifecycle_identity_campaigns SET company_high_water=2")
    conn.commit()
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert (
        result["state"] == "budget_exhausted"
        and result["mapped_accounts"] == 1
        and result["company_rows"] == 1
    )
    assert conn.execute("SELECT count(*) n FROM source_accounts").fetchone()["n"] == 1


@requires_db
def test_insert_behind_cursor_prevents_false_completion(conn, monkeypatch):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn, jobs=1)
    inserted = False

    def after_commit(_):
        nonlocal inserted
        if not inserted:
            conn.execute(
                "INSERT INTO jobs(id,company_id,external_id,title,url) VALUES('000000',1,'behind','Behind','https://example.test/behind')"
            )
            conn.commit()
            inserted = True

    monkeypatch.setattr(worker, "sleep", after_commit)
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert result["state"] == "stopped" and result["mapped_jobs"] == 1
    assert "behind cursor" in result["stop_reason"]


@requires_db
def test_post_batch_storage_guard_rolls_back_checkpoint(conn, monkeypatch):
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn, jobs=1)
    original = worker.migrate_identity_batch

    def map_and_measure(*args, **kwargs):
        result = original(*args, **kwargs)
        monkeypatch.setattr(
            worker, "_usage", lambda _: {"allocated": worker.STORAGE_LIMIT, "held": 0}
        )
        return result

    monkeypatch.setattr(worker, "migrate_identity_batch", map_and_measure)
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert (
        result["state"] == "stopped"
        and result["mapped_jobs"] == 0
        and result["job_cursor"] is None
    )
    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 0


@requires_db
def test_replaced_worker_cannot_stop_successor_campaign(conn, monkeypatch):
    from job_discovery.lifecycle import identity_campaign as worker
    from job_discovery.lifecycle.claims import claim_work, cancel_claim

    cid = seed_campaign(conn)
    successor = None

    def takeover(_):
        nonlocal successor
        conn.execute(
            "UPDATE lifecycle_claims SET lease_until=clock_timestamp()-interval '1 second' WHERE kind='identity_backfill'"
        )
        successor = claim_work(conn, "identity_backfill", "singleton", 180)
        conn.commit()

    monkeypatch.setattr(worker, "sleep", takeover)
    result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
    assert successor is not None
    assert (
        result["state"] == "running"
        and result["mapped_jobs"] == 100
        and result["stop_reason"] is None
    )
    owner = conn.execute(
        "SELECT owner_token,state FROM lifecycle_claims WHERE kind='identity_backfill'"
    ).fetchone()
    assert owner["owner_token"] == successor.owner_token and owner["state"] == "active"
    cancel_claim(conn, successor)
    conn.commit()


def test_opt_in_entrypoint_installs_resource_limits_before_connecting(monkeypatch):
    from job_discovery.lifecycle import identity_campaign as worker

    monkeypatch.setenv("IDENTITY_BACKFILL_CAMPAIGN", str(uuid4()))
    monkeypatch.setenv("RAILWAY_SERVICE_ID", worker.REVIEWER_SERVICE)
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_ID", worker.PRODUCTION_ENVIRONMENT)
    monkeypatch.setenv("RAILWAY_GIT_BRANCH", "main")
    monkeypatch.setenv("RAILWAY_GIT_COMMIT_SHA", REVISION)
    limits = []
    monkeypatch.setattr(worker.resource, "setrlimit", lambda *args: limits.append(args))
    monkeypatch.setattr(worker.os, "nice", lambda n: limits.append(("nice", n)))
    monkeypatch.setattr(
        worker.signal, "signal", lambda *args: limits.append(("signal", *args))
    )
    monkeypatch.setattr(worker.signal, "alarm", lambda n: limits.append(("alarm", n)))

    def run(dsn, cid, revision):
        assert dsn is None and revision == REVISION
        assert (worker.resource.RLIMIT_AS, (384 * 1024**2, 384 * 1024**2)) in limits
        assert (worker.resource.RLIMIT_CPU, (240, 240)) in limits
        assert ("nice", 10) in limits and ("alarm", 300) in limits
        return {"state": "completed"}

    monkeypatch.setattr(worker, "run_turn", run)
    assert worker.main() == 0


@requires_db
@pytest.mark.parametrize('company_only', [False, True])
def test_campaign_allows_concurrent_reviewer_and_archive(conn, monkeypatch, company_only):
    """Real consumers retain their two-second lock timeout across network RTT."""
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from time import sleep
    from job_discovery import db
    from job_discovery.archive.export import export_once
    from job_discovery.lifecycle import identity_campaign as worker
    from reviewer.worker import process_one

    cid = seed_campaign(conn, jobs=0 if company_only else 100)
    if company_only:
        conn.execute("INSERT INTO companies(id,name,ats,token) SELECT n,'Empty','lever','empty-'||n FROM generate_series(2,100)n")
        conn.execute("UPDATE lifecycle_identity_campaigns SET company_high_water=100 WHERE id=%s", (cid,))
        conn.commit()
    mapping = Event()
    original_mapper = worker.migrate_identity_batch

    def map_batch(*args, **kwargs):
        mapping.set()
        return original_mapper(*args, **kwargs)

    # Simulate each actual network round trip, including timeout SETs and COMMIT.
    class Latency:
        def __init__(self, real):
            self.real = real

        def __enter__(self):
            self.real.__enter__()
            return self

        def __exit__(self, *args):
            return self.real.__exit__(*args)

        def execute(self, *args, **kwargs):
            sleep(0.012 if company_only else 0.004)
            return self.real.execute(*args, **kwargs)

        def commit(self):
            sleep(0.012 if company_only else 0.004)
            return self.real.commit()

        def cursor(self, **kwargs):
            return Latency(self.real.cursor(**kwargs))

        def __getattr__(self, name):
            return getattr(self.real, name)

    monkeypatch.setattr(worker, 'connect', lambda dsn: Latency(db.connect(dsn)))
    monkeypatch.setattr(worker, 'migrate_identity_batch', map_batch)
    monkeypatch.setattr(worker, 'MAX_BATCHES', 1)
    dsn = os.environ['TEST_DATABASE_URL']

    def review():
        with db.connect(dsn) as reviewer_conn:
            return process_one(reviewer_conn)

    with ThreadPoolExecutor(max_workers=5) as pool:
        campaign = pool.submit(worker.run_turn, dsn, cid, REVISION)
        assert mapping.wait(10), 'campaign never reached mapping'
        consumers = [pool.submit(review) for _ in range(3)]
        consumers.append(pool.submit(export_once, dsn))
        errors = [future.exception(timeout=20) for future in consumers]
        result = campaign.result(timeout=20)
    assert errors == [None] * 4
    assert [future.result() for future in consumers] == [False, False, False, None]
    assert result['mapped_accounts' if company_only else 'mapped_jobs'] == 100


@requires_db
@pytest.mark.parametrize('phase', ['setup', 'mapping', 'cleanup'])
def test_campaign_short_window_releases_gate_and_keeps_checkpoint(conn, monkeypatch, phase):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from job_discovery import db
    from job_discovery.archive.export import export_once
    from job_discovery.lifecycle import identity_campaign as worker

    cid = seed_campaign(conn)
    blocked = Event()
    calls = 0
    name = {'setup': '_guard', 'mapping': 'migrate_identity_batch', 'cleanup': 'cancel_claim'}[phase]
    original = getattr(worker, name)

    def slow(connection, *args, **kwargs):
        nonlocal calls
        calls += 1
        result = original(connection, *args, **kwargs)
        if calls == (2 if phase == 'mapping' else 1):
            blocked.set()
            # Actual server work must be interrupted, including setup/cleanup.
            connection.execute('SELECT pg_sleep(3)')
        return result

    monkeypatch.setattr(worker, name, slow)
    monkeypatch.setattr(worker, 'MAX_BATCHES', 2)
    dsn = os.environ['TEST_DATABASE_URL']
    with ThreadPoolExecutor(max_workers=2) as pool:
        campaign = pool.submit(worker.run_turn, dsn, cid, REVISION)
        assert blocked.wait(10)
        consumer = pool.submit(export_once, dsn)
        assert consumer.result(timeout=5) is None
        result = campaign.result(timeout=5)
    expected = {'setup': 0, 'mapping': 100, 'cleanup': 200}[phase]
    assert result['mapped_jobs'] == result['job_rows'] == expected
    assert result['job_cursor'] == (f'{expected:06d}' if expected else None)
    with db.connect(dsn) as check:
        assert check.execute('SELECT count(*) n FROM source_listings').fetchone()['n'] == expected
    # An interrupted transaction never claims completion or expands turn limits.
    assert result['state'] == 'running'


@requires_db
def test_batched_mapping_preserves_existing_evidence_and_elapsed_expiry(conn):
    from datetime import UTC, timedelta
    from job_discovery.lifecycle.identity import migrate_identity_batch

    seed_campaign(conn, jobs=3)
    conn.execute("SET LOCAL TIME ZONE 'America/New_York'")
    conn.execute("UPDATE jobs SET first_seen_at='2026-03-01 12:00:00+00',description='Existing body'")
    assert migrate_identity_batch(conn, job_ids=['000001']) == 1
    conn.execute("UPDATE source_accounts SET exclusion_state='deliberate'")
    conn.execute("UPDATE company_sources SET public_evidence_ref='https://example.test/existing'")
    conn.execute("UPDATE jobs SET description_captured_at='2026-02-01Z',description_capture_provenance='migration_activation' WHERE id='000002'")
    before_source = conn.execute('SELECT * FROM source_accounts').fetchall()
    before_link = conn.execute('SELECT * FROM company_sources').fetchall()
    before_capture = conn.execute("SELECT description_captured_at,description_capture_provenance FROM jobs WHERE id='000002'").fetchone()
    assert migrate_identity_batch(conn, job_ids=['000002']) == 1
    assert conn.execute('SELECT * FROM source_accounts').fetchall() == before_source
    assert conn.execute('SELECT * FROM company_sources').fetchall() == before_link
    assert conn.execute("SELECT description_captured_at,description_capture_provenance FROM jobs WHERE id='000002'").fetchone() == before_capture
    rows = conn.execute('SELECT job_id,discovery_anchor_at,discovery_expires_at FROM source_listings ORDER BY job_id').fetchall()
    assert [row['job_id'] for row in rows] == ['000001', '000002']
    for row in rows:
        assert row['discovery_expires_at'].astimezone(UTC) - row['discovery_anchor_at'].astimezone(UTC) == timedelta(hours=720)


@requires_db
def test_exploratory_pilot_schema_preserves_distinct_timing(conn):
    columns = {r['column_name'] for r in conn.execute("SELECT column_name FROM information_schema.columns WHERE table_name='lifecycle_identity_authorizations'")}
    assert {'observation_basis', 'disk_fetched_at', 'wal_fetched_at', 'disk_source_observed_at', 'wal_source_observed_at'} <= columns


@requires_db
def test_exploratory_pilot_one_turn_keeps_unknown_source_age(conn):
    from job_discovery.lifecycle import identity_campaign as worker
    cid = seed_campaign(conn, jobs=2, max_turns=1, exploratory=True)
    result = worker.run_turn(os.environ['TEST_DATABASE_URL'], cid, REVISION)
    assert result['mapped_jobs'] == 2 and result['turns'] == 1
    assert result['state'] in ('completed', 'budget_exhausted')
    auth = conn.execute('SELECT * FROM lifecycle_identity_authorizations WHERE campaign_id=%s', (cid,)).fetchone()
    assert auth['observed_at'] is None
    assert auth['observation_basis'] == 'retrieval_unknown'
    assert auth['disk_source_observed_at'] < auth['disk_fetched_at']
    assert auth['wal_source_observed_at'] is None
    conn.commit()
    assert worker.run_turn(os.environ['TEST_DATABASE_URL'], cid, REVISION)['turns'] == 1


@requires_db
@pytest.mark.parametrize('change', [
    "disk_fetched_at=clock_timestamp()-interval '91 seconds'",
    "wal_fetched_at=clock_timestamp()-interval '91 seconds'",
    "disk_fetched_at=clock_timestamp()+interval '1 second'",
    "authorized_at=clock_timestamp()-interval '50 seconds',valid_until=clock_timestamp()-interval '10 seconds'",
    "free_bytes=1073741824", "resident_wal_bytes=4294967296",
    "source_revision=repeat('b',40)", "activation_generation=2",
])
def test_exploratory_pilot_retains_authorization_capacity_guards(conn, change):
    from job_discovery.lifecycle import identity_campaign as worker
    cid = seed_campaign(conn, jobs=2, max_turns=1, exploratory=True)
    conn.execute('UPDATE lifecycle_identity_authorizations SET '+change)
    conn.commit()
    result = worker.run_turn(os.environ['TEST_DATABASE_URL'], cid, REVISION)
    assert result['state'] == 'stopped' and result['mapped_jobs'] == 0


@requires_db
@pytest.mark.parametrize('change', [
    'max_job_rows=2001', 'max_company_rows=2001', 'max_turns=2',
    "expires_at=expires_at+interval '1 minute'", 'exploratory_pilot=false',
    "source_revision=repeat('b',40)", 'activation_generation=2',
    'company_high_water=company_high_water+1',
])
def test_exploratory_pilot_scope_cannot_expand(conn, change):
    import psycopg
    seed_campaign(conn, jobs=2, max_turns=1, exploratory=True)
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute('UPDATE lifecycle_identity_campaigns SET '+change)
        conn.commit()
    conn.rollback()


@requires_db
def test_exploratory_pilot_cannot_be_deleted_or_replaced(conn):
    import psycopg
    seed_campaign(conn, jobs=2, max_turns=1, exploratory=True)
    for statement in ['DELETE FROM lifecycle_identity_campaigns', 'TRUNCATE lifecycle_identity_campaigns CASCADE']:
        with pytest.raises(psycopg.errors.CheckViolation):
            conn.execute(statement)
            conn.commit()
        conn.rollback()
    conn.execute("UPDATE lifecycle_identity_campaigns SET state='stopped'")
    conn.commit()
    with pytest.raises(psycopg.errors.UniqueViolation):
        conn.execute("""INSERT INTO lifecycle_identity_campaigns
          (source_revision,activation_generation,expires_at,max_job_rows,max_company_rows,max_turns,company_high_water,exploratory_pilot)
          VALUES(%s,1,clock_timestamp()+interval '20 minutes',1,1,1,1,true)""", (REVISION,))
    conn.rollback()


@requires_db
def test_exploratory_pilot_commit_rechecks_retrieval_age(conn):
    import psycopg
    cid = seed_campaign(conn, jobs=2, max_turns=1, exploratory=True)
    conn.execute('UPDATE lifecycle_identity_campaigns SET turns=1 WHERE id=%s', (cid,))
    conn.execute("UPDATE lifecycle_identity_authorizations SET wal_fetched_at=clock_timestamp()-interval '91 seconds'")
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.commit()
    conn.rollback()
    assert conn.execute('SELECT turns FROM lifecycle_identity_campaigns WHERE id=%s', (cid,)).fetchone()['turns'] == 0


@requires_db
def test_measured_campaign_cannot_use_retrieval_exception(conn):
    from job_discovery.lifecycle import identity_campaign as worker
    cid = seed_campaign(conn, jobs=2, max_turns=1)
    conn.execute("""UPDATE lifecycle_identity_authorizations SET observation_basis='retrieval_unknown',
        observed_at=NULL,disk_fetched_at=clock_timestamp(),wal_fetched_at=clock_timestamp()""")
    conn.commit()
    assert worker.run_turn(os.environ['TEST_DATABASE_URL'], cid, REVISION)['mapped_jobs'] == 0


@requires_db
@pytest.mark.parametrize('basis', ['retrieval_unknown', 'measurement'])
def test_exploratory_commit_uses_final_campaign_expiry(conn, basis):
    import psycopg
    cid = seed_campaign(conn, jobs=2, max_turns=1, exploratory=True)
    if basis == 'measurement':
        conn.execute("""UPDATE lifecycle_identity_authorizations SET observation_basis='measurement',
          observed_at=clock_timestamp(),disk_fetched_at=NULL,wal_fetched_at=NULL""")
    conn.execute('UPDATE lifecycle_identity_campaigns SET turns=1 WHERE id=%s', (cid,))
    conn.execute("UPDATE lifecycle_identity_campaigns SET expires_at=clock_timestamp()-interval '1 second' WHERE id=%s", (cid,))
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.commit()
    conn.rollback()
    assert conn.execute('SELECT turns FROM lifecycle_identity_campaigns WHERE id=%s', (cid,)).fetchone()['turns'] == 0


@requires_db
@pytest.mark.parametrize('change', [
    "observed_at=clock_timestamp()", 'disk_fetched_at=NULL', 'wal_fetched_at=NULL',
    "observation_basis='measurement'", "observation_basis='invented'",
])
def test_exploratory_timing_provenance_cannot_be_mislabeled(conn, change):
    import psycopg
    seed_campaign(conn, jobs=2, max_turns=1, exploratory=True)
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute('UPDATE lifecycle_identity_authorizations SET '+change)
    conn.rollback()


@requires_db
@pytest.mark.parametrize('jobs,accounts,turns,duration', [
    (2001,2000,1,'20 minutes'), (2000,2001,1,'20 minutes'),
    (2000,2000,2,'20 minutes'), (2000,2000,1,'31 minutes'),
])
def test_exploratory_initial_limits_are_enforced(conn, jobs, accounts, turns, duration):
    import psycopg
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute("""INSERT INTO lifecycle_identity_campaigns
          (source_revision,activation_generation,expires_at,max_job_rows,max_company_rows,max_turns,company_high_water,exploratory_pilot)
          VALUES(%s,1,clock_timestamp()+%s::interval,%s,%s,%s,1,true)""", (REVISION,duration,jobs,accounts,turns))
    conn.rollback()


@requires_db
@pytest.mark.parametrize('change', [
    'turns=0', 'job_rows=0', 'mapped_jobs=0', 'mapped_accounts=0',
    'job_cursor=NULL', 'before_bytes=NULL', "state='running'",
])
def test_exploratory_terminal_progress_cannot_be_reset(conn, change):
    import psycopg
    from job_discovery.lifecycle import identity_campaign as worker
    cid = seed_campaign(conn, jobs=2, max_turns=1, exploratory=True)
    result = worker.run_turn(os.environ['TEST_DATABASE_URL'], cid, REVISION)
    assert result['mapped_jobs'] == 2 and result['mapped_accounts'] > 0
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute('UPDATE lifecycle_identity_campaigns SET '+change)
    conn.rollback()
