"""Fix2 ordinary logical lifecycle and offline actual-caller regressions only."""

from types import SimpleNamespace
import importlib
import json
import pytest
import psycopg
from psycopg.rows import dict_row
from tests.conftest import requires_db, TEST_DSN
from tests.archive_helpers import seeded_events, activate_fixture
from tests.test_archive_batches import verified
from job_discovery.archive import outbox, batches
from job_discovery.archive.types import BatchLimits
from job_discovery import locations


@requires_db
def test_processing_room_is_committed_before_claim_or_seal(conn):
    claim, _ = seeded_events(conn, 2)
    admitted = outbox.outbox_health(conn)
    sample = conn.execute(
        "SELECT octet_length(body::text) body_bytes,octet_length(canonical_event) canonical_bytes,lifecycle_private.archive_processing_charge(canonical_event) escrow FROM public_outbox LIMIT 1"
    ).fetchone()
    ordinary_cost = (
        4 * sample["body_bytes"]
        + 2 * sample["canonical_bytes"]
        + 4096
        + sample["escrow"]
    )
    critical_cost = (
        2 * sample["body_bytes"]
        + 2 * sample["canonical_bytes"]
        + 2048
        + sample["escrow"]
    )
    print(
        "logical escrow sample",
        json.dumps(
            dict(
                sample,
                ordinary_event_cost=ordinary_cost,
                critical_slot_cost=critical_cost,
                ordinary_byte_capacity=outbox.ORDINARY_BYTES // ordinary_cost,
                critical_reserved_capacity=outbox.CRITICAL_BYTES // critical_cost,
            )
        ),
    )
    ref = batches.claim_batch(conn, BatchLimits(max_events=1), claim)
    conn.commit()
    claimed = outbox.outbox_health(conn)
    assert claimed["bytes"] == admitted["bytes"]
    assert claimed["live_bytes"] > admitted["live_bytes"]
    seal = batches.seal_batch(ref)
    batches.persist_seal(conn, seal)
    conn.commit()
    sealed = outbox.outbox_health(conn)
    assert sealed["bytes"] == admitted["bytes"]
    assert sealed["live_bytes"] > claimed["live_bytes"]
    batches.ack_batch(conn, verified(seal), claim)
    conn.commit()
    assert outbox.outbox_health(conn)["bytes"] < admitted["bytes"]


def location_jobs(conn):
    company = conn.execute(
        "INSERT INTO companies(name,ats,token) VALUES('Fixture','lever','fixture') RETURNING id"
    ).fetchone()["id"]
    for n in range(101):
        conn.execute(
            "INSERT INTO jobs(id,company_id,external_id,title,url,location) VALUES(%s,%s,%s,'Role','https://example.test','Austin Texas')",
            (f"job-{n:03}", company, str(n)),
        )
    conn.commit()


@requires_db
@pytest.mark.parametrize("correction", [False, True])
def test_actual_location_resolution_finishes_all_committed_chunks(conn, correction):
    from tests.test_locations_resolution import FakeParseClient

    location_jobs(conn)
    if correction:
        locations.resolve_new_locations(conn, parse_client=FakeParseClient())
        conn.execute(
            "UPDATE locations SET canonicals=ARRAY['Austin, MN'],source='manual'"
        )
        conn.commit()
    result = locations.resolve_new_locations(conn, parse_client=FakeParseClient())
    assert result["stamped"] == 101
    assert result["complete"] and not result["storage_deferred"]
    expected = "Austin, MN" if correction else "Austin, TX"
    assert (
        conn.execute(
            "SELECT count(*) n FROM jobs WHERE location_canonicals=ARRAY[%s]",
            (expected,),
        ).fetchone()["n"]
        == 101
    )


@requires_db
def test_later_stamp_failure_preserves_progress_and_reports_incomplete(
    conn, monkeypatch
):
    from tests.test_locations_resolution import FakeParseClient

    location_jobs(conn)
    original = locations.stamp_jobs
    calls = []

    def interrupted(c):
        calls.append(1)
        result = original(c)
        if len(calls) == 2:
            raise outbox.ArchiveBlocked("offline later chunk deferral")
        return result

    monkeypatch.setattr(locations, "stamp_jobs", interrupted)
    result = locations.resolve_new_locations(conn, parse_client=FakeParseClient())
    assert (
        result["stamped"] == 100
        and not result["complete"]
        and result["storage_deferred"]
    )
    assert (
        conn.execute(
            "SELECT count(*) n FROM jobs WHERE location_canonicals IS NOT NULL"
        ).fetchone()["n"]
        == 100
    )
    monkeypatch.setattr(locations, "stamp_jobs", original)
    resumed = locations.resolve_new_locations(conn, parse_client=FakeParseClient())
    assert resumed["stamped"] == 1 and resumed["complete"]


@requires_db
@pytest.mark.parametrize("failed_chunk", [1, 2])
def test_daily_seed_deferral_preserves_run_and_existing_verification(
    conn, monkeypatch, failed_chunk
):
    from tests.test_lifecycle_reconcile import setup_source
    from job_discovery.adapters import ADAPTERS
    from job_discovery.adapters.completeness import SourceResult, SourceStatus
    from job_discovery.models import Posting

    runner = importlib.import_module("job_discovery.run")
    source = setup_source(conn)
    conn.commit()
    activate_fixture(conn)
    monkeypatch.setattr(
        runner, "pre_admission_maintenance", lambda dsn: SimpleNamespace(blocked=False)
    )
    monkeypatch.setattr(
        runner.db,
        "connect",
        lambda dsn: psycopg.connect(TEST_DSN, row_factory=dict_row),
    )
    targets = [
        dict(name=f"Seed {i}", ats="lever", token=f"seed-{i}") for i in range(101)
    ]
    monkeypatch.setattr(runner, "load_targets", lambda: targets)
    original = runner.db.sync_seed
    calls = []

    def blocked(c, chunk):
        original(c, chunk)
        calls.append(1)
        if len(calls) == failed_chunk:
            raise outbox.ArchiveBlocked("offline seed chunk deferral")

    monkeypatch.setattr(runner.db, "sync_seed", blocked)
    # Keep the test on seed pressure and verification of the existing corpus.
    monkeypatch.setattr(runner.db, "sync_source_accounts", lambda c: 0)
    feeds = []

    def feed(token, **kwargs):
        feeds.append(token)
        return SourceResult(
            iter([Posting("0", "Role", "https://example.test/job")]), SourceStatus()
        )

    monkeypatch.setitem(ADAPTERS, "lever", feed)
    result = runner.run()
    assert result["seed_storage_deferred"] and result["storage_deferred"] >= 1
    assert result["seed_targets_committed"] == (failed_chunk - 1) * 100
    assert feeds == [source["public_board_ref"]]
    assert result["ok"] == 1 and result["failed"] == 0
    run = conn.execute("SELECT * FROM poll_runs ORDER BY id DESC LIMIT 1").fetchone()
    assert run["finished_at"] and "seed storage deferred" in run["notes"]
    count = conn.execute(
        "SELECT count(*) n FROM companies WHERE token LIKE 'seed-%%'"
    ).fetchone()["n"]
    assert count == (failed_chunk - 1) * 100
    assert (
        conn.execute(
            "SELECT count(*) n FROM public_outbox WHERE aggregate_type='companies'"
        ).fetchone()["n"]
        == count
    )
    assert conn.execute(
        "SELECT last_complete_success_at FROM source_accounts WHERE id=%s",
        (source["id"],),
    ).fetchone()["last_complete_success_at"]


def event_charge(conn, row):
    from job_discovery.archive.codec import canonical_json
    from psycopg.types.json import Jsonb

    encoded = canonical_json(outbox._envelope(row))
    return conn.execute(
        "SELECT lifecycle_private.archive_row_charge(%s,%s,2048)+lifecycle_private.archive_processing_charge(%s) n",
        (Jsonb(row["body"]), encoded, encoded),
    ).fetchone()["n"]


@requires_db
def test_scaled_ordinary_and_critical_boundaries_keep_exact_drain_room(
    conn, monkeypatch
):
    from tests.test_lifecycle_reconcile import setup_source
    from job_discovery.lifecycle.claims import claim_work

    setup_source(conn)
    conn.commit()
    activate_fixture(conn)
    claim = claim_work(conn, "archive", "escrow", 180)
    # Real public mutation and exact requirement; scale only Python's new logical
    # policy below the unchanged SQL/physical ceilings. No database load pressure.
    conn.execute("UPDATE jobs SET title='Observed role'")
    req = conn.execute("SELECT * FROM public_change_requirements").fetchone()
    ordinary = outbox.outbox_health(conn)["bytes"] + event_charge(conn, req)
    monkeypatch.setattr(outbox, "ORDINARY_BYTES", ordinary)
    outbox.flush_public_changes(conn, claim)
    conn.commit()
    assert outbox.outbox_health(conn)["bytes"] == ordinary
    conn.commit()
    with pytest.raises(outbox.ArchiveBlocked), conn.transaction():
        conn.execute("INSERT INTO brands(name) VALUES('No ordinary room')")
        outbox.flush_public_changes(conn, claim)
    ref = batches.claim_batch(conn, BatchLimits(max_events=1), claim)
    conn.commit()
    seal = batches.seal_batch(ref)
    batches.persist_seal(conn, seal)
    conn.commit()
    assert outbox.outbox_health(conn)["bytes"] == ordinary
    # A pure closure can use critical allowance without losing its future drain room.
    conn.execute("UPDATE jobs SET closed_at=clock_timestamp()")
    req = conn.execute(
        "SELECT r.* FROM public_change_requirements r WHERE NOT EXISTS(SELECT FROM public_outbox e WHERE e.requirement_id=r.id)"
    ).fetchone()
    hard = outbox.outbox_health(conn)["bytes"] + event_charge(conn, req)
    assert hard > ordinary
    monkeypatch.setattr(outbox, "HARD_BYTES", hard)
    outbox.flush_public_changes(conn, claim)
    conn.commit()
    assert outbox.outbox_health(conn)["bytes"] == hard
    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 2
    batches.ack_batch(conn, verified(seal), claim)
    conn.commit()
    ref = batches.claim_batch(conn, BatchLimits(max_events=1), claim)
    conn.commit()
    seal = batches.seal_batch(ref)
    batches.persist_seal(conn, seal)
    conn.commit()
    health = outbox.outbox_health(conn)
    assert health["live_bytes"] <= health["bytes"] <= hard
    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 1
    batches.ack_batch(conn, verified(seal), claim)
    conn.commit()
    assert outbox.outbox_health(conn)["bytes"] == 0
    assert (
        conn.execute("SELECT count(*) n FROM public_archive_coverage").fetchone()["n"]
        == 2
    )


@requires_db
def test_default_selection_shrinks_to_manifest_workspace_and_drains(conn):
    from job_discovery.lifecycle.claims import claim_work

    for n in range(130):
        conn.execute("INSERT INTO brands(name) VALUES(%s)", (f"Brand {n}",))
    conn.commit()
    activate_fixture(conn)
    claim = claim_work(conn, "archive", "many-small", 180)
    outbox.baseline_batch(conn, "brands", claim, limit=100)
    conn.commit()
    outbox.baseline_batch(conn, "brands", claim, limit=100)
    conn.commit()
    admitted = outbox.outbox_health(conn)["bytes"]
    counts = []
    while ref := batches.claim_batch(conn, BatchLimits(), claim):
        conn.commit()
        counts.append(len(ref.ordered_event_ids))
        seal = batches.seal_batch(ref)
        batches.persist_seal(conn, seal)
        conn.commit()
        assert outbox.outbox_health(conn)["bytes"] <= admitted
        batches.ack_batch(conn, verified(seal), claim)
        conn.commit()
    assert len(counts) > 1 and sum(counts) == 130
    assert outbox.outbox_health(conn)["bytes"] == 0


@requires_db
@pytest.mark.parametrize(
    "receipt_character", ["😀", "\x01"], ids=["unicode", "json-escaped"]
)
def test_large_valid_event_and_unicode_receipts_fit_singleton_escrow(
    conn, receipt_character
):
    from dataclasses import replace
    from job_discovery.lifecycle.claims import claim_work

    conn.execute("INSERT INTO brands(name) VALUES(%s)", ("😀" * 2000,))
    conn.commit()
    activate_fixture(conn)
    claim = claim_work(conn, "archive", "large-singleton", 180)
    outbox.baseline_batch(conn, "brands", claim)
    conn.commit()
    before = outbox.outbox_health(conn)["bytes"]
    sample = conn.execute(
        "SELECT octet_length(body::text) body_bytes,octet_length(canonical_event) canonical_bytes,lifecycle_private.archive_processing_charge(canonical_event) escrow FROM public_outbox LIMIT 1"
    ).fetchone()
    ordinary_cost = (
        4 * sample["body_bytes"]
        + 2 * sample["canonical_bytes"]
        + 4096
        + sample["escrow"]
    )
    critical_cost = (
        2 * sample["body_bytes"]
        + 2 * sample["canonical_bytes"]
        + 2048
        + sample["escrow"]
    )
    print(
        "logical escrow sample",
        json.dumps(
            dict(
                sample,
                ordinary_event_cost=ordinary_cost,
                critical_slot_cost=critical_cost,
                ordinary_byte_capacity=outbox.ORDINARY_BYTES // ordinary_cost,
                critical_reserved_capacity=outbox.CRITICAL_BYTES // critical_cost,
            )
        ),
    )
    ref = batches.claim_batch(conn, BatchLimits(max_events=1), claim)
    conn.commit()
    seal = batches.seal_batch(ref)
    batches.persist_seal(conn, seal)
    conn.commit()
    receipts = verified(seal)
    receipts = replace(
        receipts,
        data_receipt=replace(receipts.data_receipt, receipt=receipt_character * 2048),
        manifest_receipt=replace(
            receipts.manifest_receipt, receipt=receipt_character * 2048
        ),
    )
    assert outbox.outbox_health(conn)["bytes"] == before
    batches.ack_batch(conn, receipts, claim)
    conn.commit()
    assert outbox.outbox_health(conn)["bytes"] == 0


@requires_db
def test_active_location_pass_stamps_all_rows_without_cache_events(conn):
    from tests.test_locations_resolution import FakeParseClient

    location_jobs(conn)
    activate_fixture(conn)
    result = locations.resolve_new_locations(conn, parse_client=FakeParseClient())
    assert result["complete"] and result["stamped"] == 101
    events = conn.execute("SELECT aggregate_type,kind FROM public_outbox").fetchall()
    assert events == [dict(aggregate_type="locations", kind="baseline")]
