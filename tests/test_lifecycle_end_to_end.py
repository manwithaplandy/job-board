"""Task13 ordinary composition on owned PG; offline boundaries, no Task3 probes."""

from dataclasses import replace
from datetime import timedelta
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from uuid import uuid4


from tests.conftest import TEST_DSN, requires_db
from tests.test_lifecycle_reconcile import setup_source
from tests.test_archive_export import FakeS3, destination
from tests.test_archive_retention_recovery import (
    setup_batch,
    pending,
    set_archive_clock,
)
from job_discovery import http
from job_discovery.lifecycle import reconcile, source_worker, maintenance
from job_discovery.lifecycle.claims import claim_work, cancel_claim
from job_discovery.lifecycle.demand import request_demand, hydrate_demand
from job_discovery.archive import export
from job_discovery.archive.batches import (
    seal_batch,
    claim_batch,
    persist_seal,
    ack_batch,
    recover_batch,
)
from job_discovery.archive.recovery import RecoveryAuthorization, replace_expired_batch
from job_discovery.archive.s3 import ArchiveClient, put_verify_batch
from job_discovery.archive.types import BatchLimits
from job_discovery.archive.replay import (
    Manifest,
    ProjectionPolicy,
    ReplayLimits,
    project_archive,
)
from tests.archive_helpers import activate_fixture

FAMILIES = ("greenhouse", "lever", "ashby", "workable", "smartrecruiters", "workday")


def feeds(monkeypatch, conn, members):
    def get(url, **kwargs):
        assert conn.info.transaction_status.name == "IDLE"
        ids = members[:]
        if "lever" in url:
            return [
                dict(id=i, text="Role", hostedUrl="https://example.test/job")
                for i in ids
            ]
        if "greenhouse" in url:
            return {
                "jobs": [
                    dict(id=i, title="Role", absolute_url="https://example.test/job")
                    for i in ids
                ]
            }
        if "ashby" in url:
            return {
                "jobs": [
                    dict(id=i, title="Role", jobUrl="https://example.test/job")
                    for i in ids
                ]
            }
        if "smartrecruiters" in url:
            return {
                "content": [dict(id=i, name="Role") for i in ids],
                "totalFound": len(ids),
            }
        return {"jobs": [dict(shortcode=i, title="Role") for i in ids]}

    def post(url, **kwargs):
        assert conn.info.transaction_status.name == "IDLE"
        return {
            "jobPostings": [dict(externalPath=i, title="Role") for i in members],
            "total": len(members),
        }

    monkeypatch.setattr(http, "get_json", get)
    monkeypatch.setattr(http, "post_json", post)


def due(conn):
    conn.execute("UPDATE source_accounts SET next_due_at=NULL")
    conn.commit()


@requires_db
def test_six_family_identity_demand_retirement_and_exact_archive_composition(
    conn, monkeypatch
):
    started = time.monotonic()
    for family in FAMILIES:
        setup_source(
            conn,
            2,
            family,
            "fixture:wd5:External" if family == "workday" else "fixture",
        )
    owner = uuid4()
    conn.execute(
        "UPDATE jobs SET description='Public cached JD',description_captured_at=clock_timestamp()-interval '31 days'"
    )
    conn.execute(
        """INSERT INTO application_packages(user_id,job_id,description_snapshot,resume_json)
        SELECT %s,id,'Saved private JD','{"name":"Fixture"}' FROM jobs WHERE external_id='0'""",
        (owner,),
    )
    conn.commit()
    identities = conn.execute(
        "SELECT id,job_id,discovery_anchor_at FROM source_listings ORDER BY id"
    ).fetchall()
    private = conn.execute(
        "SELECT * FROM application_packages ORDER BY job_id"
    ).fetchall()
    members = ["0", "1"]
    feeds(monkeypatch, conn, members)
    first = reconcile.verify_due_sources(conn, max_boards=6)
    assert first["ok"] == 6 and first["closed_jobs"] == 0
    members[:] = ["0"]
    due(conn)
    assert reconcile.verify_due_sources(conn, max_boards=6)["closed_jobs"] == 0
    # Ordinary source evidence fixture represents the first complete miss 25h ago;
    # no claim/lease/guard time overrides or expiry-enforcement probes.
    conn.execute(
        "UPDATE source_listings SET first_complete_miss_at=clock_timestamp()-interval '25 hours' WHERE external_id='1'"
    )
    due(conn)
    second = reconcile.verify_due_sources(conn, max_boards=6)
    assert second["closed_jobs"] == 6
    assert (
        conn.execute(
            "SELECT count(*) n FROM jobs WHERE closed_at IS NOT NULL"
        ).fetchone()["n"]
        == 6
    )
    due(conn)
    assert reconcile.verify_due_sources(conn, max_boards=6)["closed_jobs"] == 0
    members[:] = ["0", "1"]
    due(conn)
    assert reconcile.verify_due_sources(conn, max_boards=6)["closed_jobs"] == 0
    job = conn.execute(
        "SELECT id FROM jobs WHERE external_id='1' ORDER BY id LIMIT 1"
    ).fetchone()["id"]
    demand = request_demand(conn, job, str(owner), "description")
    conn.commit()

    def fetch(_):
        assert conn.info.transaction_status.name == "IDLE"
        return {"description": "Actual demanded input"}

    assert hydrate_demand(conn, demand, fetch) == "ready"
    conn.execute(
        "UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1"
    )
    conn.commit()
    actual = maintenance.read_control
    # Worker readiness double only; stored enforcement/activation remains off.
    monkeypatch.setattr(
        maintenance,
        "read_control",
        lambda c: replace(
            actual(c),
            safety_stage="enforced",
            retirement_enabled=True,
            retirement_dry_run=False,
        ),
    )
    claim = claim_work(conn, "maintenance", "singleton", 120)
    conn.commit()
    swept = maintenance.sweep(conn, claim, dry_run=False)
    cancel_claim(conn, claim)
    conn.commit()
    assert swept.retired_rows == 5
    assert (
        conn.execute("SELECT * FROM application_packages ORDER BY job_id").fetchall()
        == private
    )
    retired = [
        r["id"]
        for r in conn.execute(
            "SELECT id FROM jobs WHERE description IS NULL ORDER BY id"
        )
    ]
    members[:] = ["0", "1"]
    due(conn)
    result = reconcile.verify_due_sources(conn, max_boards=6)
    assert result["new_jobs"] == result["closed_jobs"] == 0
    assert (
        conn.execute(
            "SELECT id,job_id,discovery_anchor_at FROM source_listings ORDER BY id"
        ).fetchall()
        == identities
    )
    assert [
        r["id"]
        for r in conn.execute(
            "SELECT id FROM jobs WHERE description IS NULL ORDER BY id"
        )
    ] == retired
    assert (
        conn.execute(
            "SELECT count(*) n FROM jobs WHERE closed_at IS NOT NULL"
        ).fetchone()["n"]
        == 0
    )
    activate_fixture(conn)
    from job_discovery.archive.outbox import baseline_batch, outbox_health

    claim = claim_work(conn, "archive", "integration", 180)
    events = baseline_batch(conn, "jobs", claim)
    conn.commit()
    batch = claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    seal = seal_batch(batch)
    persist_seal(conn, seal)
    conn.commit()
    verified = put_verify_batch(seal, ArchiveClient(destination(), FakeS3()))
    ack = ack_batch(conn, verified, claim)
    conn.commit()
    assert set(ack.exact_event_ids) == {e.event_id for e in events}
    assert not conn.execute("SELECT * FROM public_pending_events").fetchall()
    projection = project_archive(
        [Manifest(seal)],
        ProjectionPolicy(True, batch.sealed_at + timedelta(seconds=1)),
        ReplayLimits(),
    )
    assert not projection.errors and len(projection.facts) == 12
    assert (
        conn.execute("SELECT * FROM application_packages ORDER BY job_id").fetchall()
        == private
    )
    logical = conn.execute("SELECT sum(pg_column_size(j)) n FROM jobs j").fetchone()[
        "n"
    ]
    allocated = conn.execute(
        "SELECT pg_database_size(current_database()) n"
    ).fetchone()["n"]
    print(
        "TASK13_METRICS",
        json.dumps(
            dict(
                seconds=round(time.monotonic() - started, 3),
                jobs=12,
                retired_rows=swept.retired_rows,
                retired_bytes=swept.retired_bytes,
                job_row_bytes=logical,
                database_allocated_bytes=allocated,
                canonical_event_bytes=len(seal.canonical_data),
                compressed_event_bytes=len(seal.compressed_data),
                manifest_bytes=len(seal.manifest_data),
                pending=outbox_health(conn),
            ),
            default=str,
        ),
    )


@requires_db
def test_source_worker_flag_off_and_maintenance_before_verification(conn, monkeypatch):
    called = []
    monkeypatch.setattr(
        source_worker,
        "pre_admission_maintenance",
        lambda d: called.append("maintenance"),
    )
    monkeypatch.setattr(
        source_worker,
        "verify_due_sources",
        lambda c, **kw: called.append(("verify", kw)) or {"closed_jobs": 0},
    )
    assert source_worker.run_source_once(TEST_DSN) is None and not called
    conn.execute(
        "UPDATE lifecycle_control SET source_enabled=true,activation_generation=activation_generation+1"
    )
    conn.commit()
    assert source_worker.run_source_once(TEST_DSN) == {"closed_jobs": 0}
    assert called == ["maintenance", ("verify", {"max_boards": 100, "seconds": 300})]


def test_periodic_source_turns_and_hard_deadline(monkeypatch):
    from reviewer import supervisor as s
    from tests.test_lifecycle_supervisor import Clock, Stop, Child

    clock = Clock()
    children = []
    monkeypatch.setattr(s.time, "sleep", lambda n: setattr(clock, "now", clock.now + n))

    def spawn(name):
        p = Child(
            clock,
            duration=1 if name in {"maintenance", "archive"} else None,
            ignores_term=True,
        )
        children.append((name, p))
        return p

    assert s.supervise(Stop(clock, 400), spawn, clock) == 0
    source = [p for n, p in children if n == "source"]
    assert source[0].killed == 330 and source[1].started <= 335
    assert (s.SOURCE_INTERVAL_SECONDS, s.SOURCE_DEADLINE_SECONDS) == (60, 330)
    assert len([p for n, p in children if n == "reviewer"]) == 1


@requires_db
def test_superseded_shell_seven_day_cleanup_preserves_pending_and_authorization(conn):
    batch, _ = setup_batch(conn)
    claim = claim_work(conn, "archive-export", "cleanup-test", 180)
    batch = recover_batch(conn, batch.batch_id, claim)
    persist_seal(conn, seal_batch(batch))
    conn.commit()
    set_archive_clock(conn, batch.eligible_until + timedelta(seconds=1))
    authorization = uuid4()
    conn.execute(
        """INSERT INTO public_archive_recovery_authorizations(authorization_id,batch_id,event_ids_sha256,manifest_hash,approved_by,reason,expires_at)
      SELECT %s,batch_id,event_ids_sha256,manifest_hash,'fixture','offline cleanup',clock_timestamp()+interval '1 hour'
      FROM public_archive_batches WHERE batch_id=%s""",
        (authorization, batch.batch_id),
    )
    replacement = replace_expired_batch(
        conn, batch.batch_id, claim, RecoveryAuthorization(authorization)
    )
    conn.commit()
    before = pending(conn)
    assert export.cleanup_terminal(conn, claim, limit=1) == 0
    conn.commit()
    conn.execute(
        "ALTER TABLE public_archive_supersessions DISABLE TRIGGER archive_immutable"
    )
    conn.execute(
        "UPDATE public_archive_supersessions SET replaced_at=clock_timestamp()-interval '8 days'"
    )
    conn.execute(
        "ALTER TABLE public_archive_supersessions ENABLE TRIGGER archive_immutable"
    )
    conn.commit()
    assert export.cleanup_terminal(conn, claim, limit=1) == 1
    conn.commit()
    assert pending(conn) == before
    assert conn.execute(
        "SELECT batch_id FROM public_archive_batches WHERE batch_id=%s",
        (replacement.batch_id,),
    ).fetchone()
    assert (
        conn.execute("SELECT count(*) n FROM public_archive_supersessions").fetchone()[
            "n"
        ]
        == 1
    )
    assert conn.execute(
        "SELECT consumed_at FROM public_archive_recovery_authorizations WHERE authorization_id=%s",
        (authorization,),
    ).fetchone()["consumed_at"]


@requires_db
def test_combined_offline_children_resources(conn, tmp_path):
    """Actual four processes with inert reviewer work and disabled feature flags.

    Reports sampled aggregate RSS/DB sessions and process CPU, not production cost.
    """
    setup_batch(conn)
    conn.execute(
        "UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1"
    )
    conn.commit()
    marker = tmp_path / "reviewer-ready"
    reviewer_code = """
import pathlib,sys,time
from reviewer import worker
worker.config.has_api_key=lambda: True
worker.config.REVIEW_WORKER_PARALLELISM=1
class Conn:
    def close(self): pass
worker.jdb.connect=Conn
def idle(conn):
    pathlib.Path(sys.argv[1]).touch()
    time.sleep(2)
worker.process_one=idle
worker.DRAIN_SECONDS=0.1
worker.main()
"""
    commands = [
        [sys.executable, "-c", reviewer_code, str(marker)],
        [sys.executable, "-m", "job_discovery.lifecycle.worker"],
        [
            sys.executable,
            "-c",
            "from job_discovery.archive.export import export_once; from job_discovery.archive.s3 import ArchiveClient; from tests.test_archive_export import FakeS3,destination; assert export_once(None,ArchiveClient(destination(),FakeS3())) is not None",
        ],
        [sys.executable, "-m", "job_discovery.lifecycle.source_worker"],
    ]
    started = time.monotonic()
    children = [
        subprocess.Popen(c, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for c in commands
    ]
    rss_peak = 0
    sessions_peak = 0
    cpu_peak = 0
    try:
        deadline = started + 10
        while time.monotonic() < deadline:
            rss = 0
            cpu = 0
            for p in children:
                try:
                    stat = (
                        Path(f"/proc/{p.pid}/stat")
                        .read_text()
                        .rsplit(")", 1)[1]
                        .split()
                    )
                    rss += int(stat[21]) * os.sysconf("SC_PAGE_SIZE")
                    cpu += (int(stat[11]) + int(stat[12])) / os.sysconf("SC_CLK_TCK")
                except FileNotFoundError:
                    pass
            rss_peak = max(rss_peak, rss)
            cpu_peak = max(cpu_peak, cpu)
            sessions_peak = max(
                sessions_peak,
                conn.execute(
                    "SELECT count(*) n FROM pg_stat_activity WHERE datname=current_database()"
                ).fetchone()["n"],
            )
            conn.commit()
            if marker.exists() and all(p.poll() == 0 for p in children[1:]):
                break
            time.sleep(0.02)
        assert marker.exists() and all(p.poll() == 0 for p in children[1:])
        print(
            "TASK13_RUNTIME",
            json.dumps(
                dict(
                    seconds=round(time.monotonic() - started, 3),
                    aggregate_rss_peak_bytes=rss_peak,
                    sampled_cpu_seconds=round(cpu_peak, 3),
                    database_sessions_peak_including_observer=sessions_peak,
                    scope="four actual processes; real maintenance and fake-S3 export turn; stalled reviewer; source disabled",
                )
            ),
        )
    finally:
        for p in children:
            if p.poll() is None:
                p.terminate()
        for p in children:
            try:
                p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                p.kill()
                p.wait(timeout=2)


@requires_db
def test_operational_fallback_reports_committed_closures_without_replay(
    conn, monkeypatch
):
    from tests.test_lifecycle_operational import setup
    from job_discovery.lifecycle.errors import StorageBlocked

    source, claim = setup(conn)
    cancel_claim(conn, claim)
    conn.execute(
        "UPDATE source_listings SET consecutive_complete_misses=1,first_complete_miss_at=clock_timestamp()-interval '25 hours'"
    )
    conn.commit()
    monkeypatch.setattr(http, "get_json", lambda *a, **kw: [])

    def defer(_):
        raise StorageBlocked("ordinary source staging unavailable")

    monkeypatch.setattr(reconcile, "claim_due_source", defer)
    result = reconcile.verify_due_sources(conn, max_boards=1)
    assert result["closed_jobs"] == 2
    assert result["storage_deferred"] == 1 and result["failed"] == 0
    assert (
        conn.execute(
            "SELECT count(*) n FROM jobs WHERE closed_at IS NOT NULL"
        ).fetchone()["n"]
        == 2
    )
    conn.commit()
    assert reconcile.verify_due_sources(conn, max_boards=1)["closed_jobs"] == 0


@requires_db
def test_explicit_readiness_transitions_through_existing_control_api(conn, monkeypatch):
    """New positive readiness integration, not the omitted activation probe suite.

    Service attestations below are local fixture evidence only. No production
    readiness, permission, destination ownership or runtime compatibility is inferred.
    """
    from job_discovery.lifecycle.config import read_control, transition_control
    from job_discovery.lifecycle.readiness import COMPONENTS, verify_backfill_batch
    from job_discovery.archive.outbox import baseline_batch
    from job_discovery.archive.schema import AggregateType

    setup_source(conn)
    conn.execute(
        "UPDATE lifecycle_control SET identity_enabled=true,maintenance_enabled=true,hydration_enabled=true,safety_stage='collect',activation_generation=activation_generation+1"
    )
    # One actual bounded mapping pass has already run in setup_source.
    revision = "a" * 40
    for component in COMPONENTS:
        conn.execute(
            """INSERT INTO lifecycle_writer_readiness(writer,contract_version,source_revision,validated_at,notes)
          VALUES(%s,1,%s,clock_timestamp(),'explicit local fixture attestation, not production approval')
          ON CONFLICT(writer) DO UPDATE SET source_revision=EXCLUDED.source_revision,
           validated_at=EXCLUDED.validated_at,notes=EXCLUDED.notes""",
            (component, revision),
        )
    conn.commit()

    def certify():
        turns = 0
        while True:
            turns += 1
            done = verify_backfill_batch(conn, revision, limit=1)
            conn.commit()
            if done:
                break
            assert turns <= 4
        return turns

    assert certify() == 4
    claim = claim_work(conn, "control", "singleton", 120)
    control = read_control(conn)
    enforced = transition_control(
        conn,
        control.activation_generation,
        replace(control, safety_stage="enforced"),
        claim,
    )
    conn.commit()
    assert enforced.safety_stage == "enforced" and enforced.retirement_dry_run
    certify()
    conn.execute("""INSERT INTO public_archive_destination(singleton,object_prefix,validated_at,bucket,region,expected_owner,
      private_validated,encryption_validated,policy_validated,validation_evidence)
      VALUES(true,'fixture/public',clock_timestamp(),'fixture-bucket','us-east-1','123456789012',true,true,true,'offline fixture approval only')""")
    active = transition_control(
        conn,
        enforced.activation_generation,
        replace(enforced, archive_ever_activated=True, archive_stage="active"),
        claim,
    )
    conn.commit()
    assert active.archive_ever_activated and not active.export_enabled
    # Deliver a bounded first page while the rest of the corpus is incomplete.
    first = baseline_batch(conn, "jobs", claim, limit=1)
    conn.commit()
    assert len(first) == 1
    assert not conn.execute("SELECT lifecycle_private.archive_baseline_ready() ready").fetchone()["ready"]
    conn.commit()
    certify()
    exporting = transition_control(
        conn, active.activation_generation, replace(active, export_enabled=True), claim
    )
    conn.commit()
    assert exporting.export_enabled
    # One-event flush threshold keeps this ordinary fixture small; no budget changes.
    monkeypatch.setattr(export, "BatchLimits", lambda: BatchLimits(max_events=1))
    client = ArchiveClient(destination(), FakeS3())
    delivered = []

    def deliver_page(refs):
        assert len(refs) == 1
        result = export.export_once(TEST_DSN, client)
        assert result is not None
        assert result.exact_event_ids == (refs[0].event_id,)
        assert not pending(conn)
        delivered.extend(result.exact_event_ids)

    deliver_page(first)
    assert not conn.execute("SELECT lifecycle_private.archive_baseline_ready() ready").fetchone()["ready"]
    conn.commit()
    # Each next page commits after the preceding exact ACK. Save the last page
    # pending to retain the original pause/resume preservation assertion too.
    last = ()
    for aggregate in AggregateType:
        while True:
            if last:
                deliver_page(last)
                last = ()
            page = baseline_batch(conn, aggregate, claim, limit=1)
            conn.commit()
            if not page:
                break
            last = page
    assert len(delivered) > 1
    assert conn.execute("SELECT lifecycle_private.archive_baseline_ready() ready").fetchone()["ready"]
    conn.commit()
    paused = transition_control(
        conn,
        exporting.activation_generation,
        replace(exporting, export_enabled=False),
        claim,
    )
    conn.commit()
    assert paused.archive_ever_activated and paused.archive_stage == "active"
    from job_discovery.archive.writers import public_write
    with public_write(conn, "companies"):
        conn.execute("UPDATE companies SET name='Fixture updated' WHERE name='Fixture'")
    conn.commit()
    before = pending(conn)
    assert before
    producer_paused = transition_control(
        conn,
        paused.activation_generation,
        replace(paused, archive_stage="producer_paused"),
        claim,
    )
    conn.commit()
    assert producer_paused.archive_ever_activated and not producer_paused.export_enabled
    certify()
    resumed = transition_control(
        conn,
        producer_paused.activation_generation,
        replace(producer_paused, archive_stage="active"),
        claim,
    )
    conn.commit()
    assert resumed.archive_stage == "active" and pending(conn) == before
