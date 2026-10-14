"""Explicitly selected, synthetic owned-DB continuation checks; no external calls."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import os
from threading import Event
from time import monotonic, sleep
from uuid import uuid4

import pytest

from tests.conftest import requires_db
from tests.test_identity_campaign import authorize_campaign

REVISION = "c2ec584b05c7b42811b2d788327fb0432269a4ef"


class Latency:
    def __init__(self, real, delay, holds=None):
        self.real, self.delay, self.holds = real, delay, holds
        self.gate_start = None

    def __enter__(self):
        self.real.__enter__()
        return self

    def __exit__(self, *args):
        return self.real.__exit__(*args)

    def execute(self, query, *args, **kwargs):
        sleep(self.delay)
        if (
            self.holds is not None
            and "pg_advisory_xact_lock" in str(query)
            and self.gate_start is None
        ):
            self.gate_start = monotonic()
        return self.real.execute(query, *args, **kwargs)

    def _record(self):
        if self.gate_start is not None:
            self.holds.append(monotonic() - self.gate_start)
            self.gate_start = None

    def commit(self):
        sleep(self.delay)
        result = self.real.commit()
        self._record()
        return result

    def rollback(self):
        sleep(self.delay)
        result = self.real.rollback()
        self._record()
        return result

    def cursor(self, **kwargs):
        return Latency(self.real.cursor(**kwargs), self.delay)

    def __getattr__(self, name):
        return getattr(self.real, name)


def seed(conn, jobs, companies, mapped_jobs=0, mapped_companies=0):
    # Fixture construction only: directly populate a consistent pre-existing
    # corpus. Production triggers are restored before any tested operation.
    conn.execute("SET session_replication_role='replica'")
    conn.execute(
        "INSERT INTO companies(id,name,ats,token) SELECT n,'Synthetic company '||n,'lever','synthetic-'||n FROM generate_series(1,%s)n",
        (companies,),
    )
    conn.execute(
        """INSERT INTO jobs(id,company_id,external_id,title,url,location,remote,description,first_seen_at,
        description_captured_at,description_capture_provenance)
        SELECT 'job-'||lpad(n::text,7,'0'),1+(n-1)%%%s,n::text,'Synthetic Engineer',
        'https://example.test/'||n,'Remote',true,repeat('Synthetic description. ',80),
        clock_timestamp()-interval '5 days',clock_timestamp(),'migration_activation'
        FROM generate_series(1,%s)n""",
        (mapped_companies or companies, jobs),
    )
    conn.execute(
        "INSERT INTO job_questions(job_id,questions,captured_at,capture_provenance) SELECT id,'{}',clock_timestamp(),'migration_activation' FROM jobs WHERE external_id::int%10=0"
    )
    if mapped_companies:
        conn.execute(
            """INSERT INTO source_accounts(legacy_company_id,ats,public_board_ref,legacy_active,exclusion_state)
            SELECT id,ats,token,true,'enabled' FROM companies WHERE id<=%s""",
            (mapped_companies,),
        )
        conn.execute("""INSERT INTO company_sources(company_id,source_account_id,evidence_kind,public_evidence_ref,status)
            SELECT legacy_company_id,id,'legacy_mapping',ats||':'||public_board_ref,'accepted' FROM source_accounts""")
    if mapped_jobs:
        conn.execute(
            """INSERT INTO source_listings(source_account_id,external_id,job_id,original_discovered_at,
            discovery_anchor_at,discovery_anchor_provenance,discovery_expires_at)
            SELECT s.id,j.external_id,j.id,j.first_seen_at,j.first_seen_at,'legacy_local_observation',
            j.first_seen_at+interval '720 hours' FROM jobs j JOIN source_accounts s ON s.legacy_company_id=j.company_id
            WHERE j.id<=%s""",
            (f"job-{mapped_jobs:07d}",),
        )
    conn.execute(
        "UPDATE lifecycle_control SET safety_stage='collect',identity_enabled=true,activation_generation=1,identity_migration_activated_at=clock_timestamp()"
    )
    conn.execute("SET session_replication_role='origin'")
    conn.commit()
    conn.execute("ANALYZE")
    conn.commit()


def campaign(conn, jobs, companies, turns=30):
    cid = uuid4()
    conn.execute(
        """INSERT INTO lifecycle_identity_campaigns(id,state,source_revision,activation_generation,
        expires_at,max_job_rows,max_company_rows,max_turns,job_high_water,company_high_water)
        VALUES(%s,'running',%s,1,clock_timestamp()+interval '1 hour',%s,%s,%s,%s,%s)""",
        (cid, REVISION, jobs, companies, turns, f"job-{jobs:07d}", companies),
    )
    authorize_campaign(conn, cid)
    conn.commit()
    return cid


@pytest.fixture
def no_network(monkeypatch):
    import httpx
    import requests

    def fail(*args, **kwargs):
        raise AssertionError("external HTTP is forbidden in this synthetic test")

    async def afail(*args, **kwargs):
        raise AssertionError("external HTTP is forbidden in this synthetic test")

    monkeypatch.setattr(httpx.Client, "send", fail)
    monkeypatch.setattr(httpx.AsyncClient, "send", afail)
    monkeypatch.setattr(requests.Session, "request", fail)


@requires_db
def test_loaded_reviewer_archive_soak(conn, monkeypatch, no_network, caplog):
    from job_discovery import db
    from job_discovery.archive.export import export_once
    from job_discovery.lifecycle import identity_campaign as worker
    from reviewer import worker as reviewer
    from reviewer.schemas import Stage1Decision, Stage2Result

    seed(conn, 40000, 400)
    # A real durable backlog, not empty process_one calls or a mocked reviewer.
    conn.execute("""INSERT INTO profiles(user_id,resume_text,instructions,profile_version,preferred_locations,daily_review_cap)
        SELECT md5('synthetic-user-'||n)::uuid,'Synthetic resume','Synthetic instructions','v1',ARRAY['Remote'],3
        FROM generate_series(1,1000)n""")
    conn.execute(
        "INSERT INTO subscriptions(user_id,status,plan,current_period_end) SELECT user_id,'active','standard',now()+interval '30 days' FROM profiles"
    )
    conn.execute("INSERT INTO review_requests(user_id) SELECT user_id FROM profiles")
    conn.commit()
    cid = campaign(conn, 40000, 400, 31)

    class Model:
        def __init__(self, model_stage1, model_stage2):
            self.model_stage1, self.model_stage2 = model_stage1, model_stage2

        async def stage1_batch(self, *, profile_block, jobs):
            await asyncio.sleep(0.04)
            return [
                Stage1Decision(job_id=j["id"], decision="pass", reason="synthetic")
                for j in jobs
            ]

        async def stage2(self, **kwargs):
            await asyncio.sleep(0.08)
            return Stage2Result(
                verdict="approve",
                experience_match="match",
                industry="software_internet",
                industry_subcategory="devtools_platforms",
                confidence="high",
                reasoning="synthetic",
                role_category="Backend",
                skills_score=80,
                experience_score=80,
                comp_score=80,
            )

    monkeypatch.setattr(reviewer.run, "ReviewClient", Model)
    real_connect = db.connect
    holds = []
    delay = [0.004]
    monkeypatch.setattr(
        db, "connect", lambda dsn=None: Latency(real_connect(dsn), 0.004)
    )
    monkeypatch.setattr(
        worker, "connect", lambda dsn: Latency(real_connect(dsn), delay[0], holds)
    )
    inside = Event()
    stop = Event()
    mapper = worker.migrate_identity_batch
    overlaps = []

    def map_batch(*args, **kwargs):
        inside.set()
        try:
            return mapper(*args, **kwargs)
        finally:
            inside.clear()

    monkeypatch.setattr(worker, "migrate_identity_batch", map_batch)
    dsn = os.environ["TEST_DATABASE_URL"]
    review_counts = [0, 0, 0]
    review_latencies = []
    archive_latencies = []

    def review_loop(index):
        with db.connect(dsn) as connection:
            while not stop.is_set():
                start = monotonic()
                if reviewer.process_one(connection):
                    review_counts[index] += 1
                    review_latencies.append(monotonic() - start)
                else:
                    sleep(0.02)

    def archive_loop():
        while not stop.is_set():
            if not inside.wait(0.1):
                continue
            overlaps.append(monotonic())
            start = monotonic()
            assert export_once(dsn) is None
            archive_latencies.append(monotonic() - start)
            sleep(0.03)

    turns = []
    start = monotonic()
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(review_loop, n) for n in range(3)] + [
            pool.submit(archive_loop)
        ]
        try:
            for n in range(30):
                delay[0] = (0.004, 0.008, 0.012)[n % 3]
                # Advance only the owned ledger cooldown between turns. Continuous
                # pressure is intentional; this does not measure production cadence.
                conn.execute(
                    "UPDATE lifecycle_identity_campaigns SET next_turn_at=clock_timestamp() WHERE id=%s",
                    (cid,),
                )
                conn.commit()
                authorize_campaign(conn, cid)
                conn.commit()
                before = monotonic()
                result = worker.run_turn(dsn, cid, REVISION)
                turns.append(
                    {
                        "turn": n + 1,
                        "rtt_ms": delay[0] * 1000,
                        "seconds": monotonic() - before,
                        "mapped": result["mapped_jobs"],
                        "state": result["state"],
                        "reviews": sum(review_counts),
                    }
                )
                print("SOAK_TURN " + json.dumps(turns[-1]), flush=True)
                if result["state"] != "running" or result["mapped_jobs"] == 40000:
                    break
        finally:
            stop.set()
            for future in futures:
                future.result(timeout=30)
    conn.commit()
    counts = conn.execute(
        "SELECT status,count(*) n FROM review_requests GROUP BY status"
    ).fetchall()
    reviews = conn.execute("SELECT count(*) n FROM job_reviews").fetchone()["n"]
    errors = conn.execute(
        "SELECT count(*) n FROM review_runs WHERE errors>0 OR notes LIKE '%%review phase errored%%'"
    ).fetchone()["n"]
    summary = {
        "seconds": monotonic() - start,
        "turns": turns,
        "reviewer_counts": review_counts,
        "request_counts": counts,
        "persisted_reviews": reviews,
        "review_run_errors": errors,
        "archive_overlap_attempts": len(overlaps),
        "archive_max_seconds": max(archive_latencies, default=0),
        "review_request_max_seconds": max(review_latencies, default=0),
        "campaign_gate_window_max": max(holds, default=0),
    }
    print("SOAK_RESULT " + json.dumps(summary), flush=True)
    assert all(review_counts) and reviews > 0
    assert errors == 0 and not any(r["status"] in ("failed", "running") for r in counts)
    assert len(overlaps) >= 20
    assert not any(r.levelno >= 40 for r in caplog.records)
    assert result["mapped_jobs"] == 40000 and result["turns"] == len(turns) <= 30


@requires_db
def test_production_sized_transition_and_completion_gap(conn, monkeypatch, no_network):
    from job_discovery import db
    from job_discovery.lifecycle import identity_campaign as worker

    before = monotonic()
    seed(conn, 835466, 29412, mapped_jobs=835366, mapped_companies=9709)
    print(
        "SCALE_SEEDED "
        + json.dumps(
            {
                "seconds": monotonic() - before,
                "bytes": conn.execute(
                    "SELECT pg_database_size(current_database()) n"
                ).fetchone()["n"],
            }
        ),
        flush=True,
    )
    conn.commit()
    cid = campaign(conn, 835466, 29412, 30)
    conn.execute(
        "UPDATE lifecycle_identity_campaigns SET job_cursor='job-0835366',job_rows=835366,mapped_jobs=835366,mapped_accounts=9709 WHERE id=%s",
        (cid,),
    )
    conn.commit()
    holds = []
    real_connect = db.connect
    monkeypatch.setattr(
        worker, "connect", lambda dsn: Latency(real_connect(dsn), 0.012, holds)
    )
    turns = []
    start = monotonic()
    for n in range(15):
        conn.execute(
            "UPDATE lifecycle_identity_campaigns SET next_turn_at=clock_timestamp() WHERE id=%s",
            (cid,),
        )
        conn.commit()
        authorize_campaign(conn, cid)
        conn.commit()
        before = monotonic()
        result = worker.run_turn(os.environ["TEST_DATABASE_URL"], cid, REVISION)
        turns.append(
            {
                "turn": n + 1,
                "seconds": monotonic() - before,
                "mapped_jobs": result["mapped_jobs"],
                "mapped_accounts": result["mapped_accounts"],
                "phase": result["phase"],
                "state": result["state"],
            }
        )
        print("SCALE_TURN " + json.dumps(turns[-1]), flush=True)
        if result["state"] != "running":
            break
    conn.commit()
    gaps = conn.execute(
        "SELECT (SELECT count(*) FROM jobs j WHERE NOT EXISTS(SELECT FROM source_listings l WHERE l.job_id=j.id)) jobs,(SELECT count(*) FROM companies c WHERE NOT EXISTS(SELECT FROM source_accounts s WHERE s.ats=c.ats AND s.public_board_ref=c.token)) companies"
    ).fetchone()
    print(
        "SCALE_RESULT "
        + json.dumps(
            {
                "seconds": monotonic() - start,
                "gaps": gaps,
                "turns": turns,
                "campaign_gate_window_max": max(holds, default=0),
            }
        ),
        flush=True,
    )
    assert gaps == {"jobs": 0, "companies": 0}
    assert result["state"] == "completed" and result["phase"] == "finished"
    assert len(turns) <= 11, "completion still spends repeated zero-progress turns"
    assert result["mapped_jobs"] == 835466 and result["mapped_accounts"] == 29412
