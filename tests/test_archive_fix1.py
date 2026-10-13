"""Seven scoped Task10 corrections; ordinary small DB/offline source contracts only."""

import json
import pytest
from tests.conftest import requires_db
from tests.archive_helpers import seeded_events, activate_fixture
from tests.test_lifecycle_operational import setup
from job_discovery.lifecycle import operational as op, reconcile
from job_discovery.archive import outbox, batches
from job_discovery.archive.types import BatchLimits
from tests.test_archive_batches import verified


def missed(conn, source, claim):
    sequence, _ = op.start(conn, source["id"], claim)
    conn.commit()
    op.complete(conn, source["id"], sequence, claim, successful=True)
    conn.commit()
    op.reconcile(conn, source["id"], sequence, claim)
    conn.commit()
    return sequence


@requires_db
def test_fix1_operational_miss_normal_positive_operational_miss(conn):
    source, claim = setup(conn, count=1)
    missed(conn, source, claim)
    # Persist old absence evidence; subsequent true positive must invalidate it.
    conn.execute(
        "UPDATE source_listings SET first_complete_miss_at=clock_timestamp()-interval '25 hours'"
    )
    conn.commit()
    enum = reconcile.begin_enumeration(conn, source["id"], claim)
    listing = conn.execute("SELECT * FROM source_listings").fetchone()
    observed = conn.execute("SELECT clock_timestamp() t").fetchone()["t"]
    reconcile._positive(conn, enum, listing, "seen", observed)
    conn.commit()
    missed(conn, source, claim)
    row = conn.execute("SELECT * FROM source_listings").fetchone()
    assert row["consecutive_complete_misses"] == 1
    assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"] is None


@requires_db
def test_fix1_membership_and_seal_add_to_live_forecast(conn):
    claim, _ = seeded_events(conn, 2)
    before = outbox.outbox_health(conn)["live_bytes"]
    ref = batches.claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    after = outbox.outbox_health(conn)["live_bytes"]
    conn.commit()
    assert after > before
    seal = batches.seal_batch(ref)
    batches.persist_seal(conn, seal)
    conn.commit()
    assert outbox.outbox_health(conn)["live_bytes"] > after


def test_fix1_archive_pressure_is_storage_deferred():
    assert issubclass(outbox.ArchiveBlocked, reconcile.StorageBlocked)


@requires_db
def test_fix1_actual_seed_and_company_writer_pair(conn):
    from job_discovery.db import sync_seed
    from company_discovery.enrich_apply import apply_enrichment, EnrichUpdate

    activate_fixture(conn)
    sync_seed(conn, [{"name": "Seed", "ats": "lever", "token": "fixture"}])
    conn.commit()
    company = conn.execute("SELECT id FROM companies").fetchone()["id"]
    apply_enrichment(
        conn, company, EnrichUpdate("Public Name", "Public about", "ats_board")
    )
    conn.commit()
    assert (
        conn.execute(
            "SELECT count(*) n FROM public_outbox WHERE aggregate_type='companies'"
        ).fetchone()["n"]
        == 2
    )


@requires_db
def test_fix1_baseline_has_recorded_and_unknown_observed_time(conn):
    claim, _ = seeded_events(conn, 1)
    event = json.loads(
        bytes(
            conn.execute("SELECT canonical_event FROM public_outbox").fetchone()[
                "canonical_event"
            ]
        )
    )
    assert event["observed_at"] is None
    assert event["recorded_at"]
    assert event["provenance"] == "current_baseline"


@requires_db
def test_fix1_seal_layout_and_complete_manifest(conn):
    claim, _ = seeded_events(conn, 1)
    ref = batches.claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    seal = batches.seal_batch(ref)
    manifest = json.loads(seal.manifest_data)
    assert f"ingestion_date={ref.sealed_at.date().isoformat()}/" in seal.data_key
    assert seal.data_key.endswith(f"{ref.batch_id}-{seal.compressed_hash}.jsonl.gz")
    assert manifest["event_ids_sha256"] and manifest["aggregate_revision_ranges"]


@requires_db
def test_fix1_terminal_cleanup_retires_full_receipts_and_catalogue(conn):
    claim, refs = seeded_events(conn, 1)
    ref = batches.claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    seal = batches.seal_batch(ref)
    batches.persist_seal(conn, seal)
    conn.commit()
    batches.ack_batch(conn, verified(seal), claim)
    conn.commit()
    conn.execute("ALTER TABLE public_archive_batches DISABLE TRIGGER archive_immutable")
    conn.execute(
        "UPDATE public_archive_batches SET acked_at=clock_timestamp()-interval '8 days'"
    )
    conn.execute("ALTER TABLE public_archive_batches ENABLE TRIGGER archive_immutable")
    conn.execute(
        "ALTER TABLE public_archive_batch_markers DISABLE TRIGGER archive_immutable"
    )
    conn.execute(
        "UPDATE public_archive_batch_markers SET acked_at=clock_timestamp()-interval '8 days'"
    )
    conn.execute(
        "ALTER TABLE public_archive_batch_markers ENABLE TRIGGER archive_immutable"
    )
    conn.commit()
    batches.compact_terminal_batches(conn, claim)
    conn.commit()
    assert (
        conn.execute("SELECT count(*) n FROM public_archive_receipts").fetchone()["n"]
        == 0
    )
    assert (
        conn.execute("SELECT count(*) n FROM public_archive_items").fetchone()["n"] == 0
    )
    assert (
        conn.execute("SELECT count(*) n FROM public_archive_batches").fetchone()["n"]
        == 0
    )
    assert (
        conn.execute("SELECT event_id FROM public_archive_coverage").fetchone()[
            "event_id"
        ]
        == refs[0].event_id
    )


@requires_db
def test_fix1_normal_miss_then_operational_miss_closes(conn):
    from tests.test_lifecycle_reconcile import setup_source, begin, finish
    from job_discovery.lifecycle.claims import claim_work

    source = setup_source(conn)
    enum = begin(conn, source)
    finish(conn, enum)
    conn.execute(
        "UPDATE source_listings SET first_complete_miss_at=clock_timestamp()-interval '25 hours'"
    )
    claim = claim_work(conn, "source", str(source["id"]), 180)
    conn.commit()
    missed(conn, source, claim)
    assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"]


@requires_db
def test_fix1_normal_positive_before_operational_resume_invalidates_absence(conn):
    source, claim = setup(conn, count=1)
    missed(conn, source, claim)
    conn.execute(
        "UPDATE source_listings SET first_complete_miss_at=clock_timestamp()-interval '25 hours'"
    )
    conn.commit()
    seq, _ = op.start(conn, source["id"], claim)
    op.complete(conn, source["id"], seq, claim, successful=True)
    conn.commit()
    enum = reconcile.begin_enumeration(conn, source["id"], claim)
    listing = conn.execute("SELECT * FROM source_listings").fetchone()
    now = conn.execute("SELECT clock_timestamp() t").fetchone()["t"]
    reconcile._positive(conn, enum, listing, "seen", now)
    conn.commit()
    assert op.reconcile(conn, source["id"], seq, claim)
    conn.commit()
    assert (
        conn.execute(
            "SELECT consecutive_complete_misses FROM source_listings"
        ).fetchone()["consecutive_complete_misses"]
        == 0
    )
    assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"] is None


@requires_db
@pytest.mark.parametrize("boundary", ["chunk", "final_reconcile"])
def test_fix1_actual_orchestration_archive_pressure_defers_and_preserves_health(
    conn, monkeypatch, boundary
):
    from tests.test_lifecycle_reconcile import setup_source
    from job_discovery.models import Posting
    from job_discovery.adapters import ADAPTERS
    from job_discovery.adapters.completeness import SourceResult, SourceStatus

    source = setup_source(conn)

    def feed(*args, **kwargs):
        return SourceResult(
            iter([Posting("0", "Role", "https://example.test/job")]), SourceStatus()
        )

    monkeypatch.setitem(ADAPTERS, "lever", feed)
    calls = []

    def blocked(*args, **kwargs):
        calls.append(1)
        raise outbox.ArchiveBlocked("ordinary fixture logical archive pressure")

    if boundary == "chunk":
        monkeypatch.setattr(reconcile, "ADMISSION_CHUNK_SIZE", 1)
        monkeypatch.setattr(reconcile, "stage_postings", blocked)
    else:
        monkeypatch.setattr(reconcile, "reconcile_chunk", blocked)
    result = reconcile.verify_due_sources(conn, max_boards=1, seconds=60)
    assert calls == [1]
    assert result["failed"] == 0 and result["storage_deferred"] == 1
    health = conn.execute(
        "SELECT * FROM source_accounts WHERE id=%s", (source["id"],)
    ).fetchone()
    assert health["last_complete_success_at"] and health["failure_streak"] == 0
    assert conn.execute(
        "SELECT reconciled FROM lifecycle_operational_sources"
    ).fetchone()["reconciled"]


@requires_db
def test_fix1_current_candidate_classification_name_location_writers(conn):
    from types import SimpleNamespace
    from company_discovery.dataset import Candidate
    from company_discovery.db import upsert_candidates
    from company_discovery.jobs_db import apply_classification
    from company_discovery.name_backfill import apply_name
    from job_discovery.locations import _insert_unmappable, correct_location

    activate_fixture(conn)
    upsert_candidates(conn, [Candidate("Fixture", "lever", "fixture")])
    conn.commit()
    cid = conn.execute("SELECT id FROM companies").fetchone()["id"]
    apply_name(conn, cid, "Public Name")
    apply_classification(
        conn,
        cid,
        SimpleNamespace(
            industry="software",
            industry_subcategory="infrastructure",
            size="11-50",
            hq_country="US",
            tech_tags=[],
            red_flags=[],
            confidence="high",
        ),
        model="offline",
        source="job",
    )
    conn.commit()
    _insert_unmappable(conn, "Fixture raw")
    conn.commit()
    correct_location(conn, "Fixture raw", [])
    conn.commit()
    events = conn.execute(
        "SELECT aggregate_type,revision FROM public_outbox ORDER BY aggregate_type,revision"
    ).fetchall()
    assert [(e["aggregate_type"], e["revision"]) for e in events] == [
        ("companies", 1),
        ("companies", 2),
        ("companies", 3),
        ("locations", 1),
        ("locations", 2),
    ]
    before = len(events)
    # Private worker status/cache-only changes retain no public event.
    conn.execute(
        "UPDATE companies SET classified_at=clock_timestamp(),web_description='operational cache'"
    )
    conn.commit()
    assert outbox.outbox_health(conn)["events"] == before


@requires_db
def test_fix1_writer_rollback_and_flags_off(conn):
    from job_discovery.db import sync_seed

    sync_seed(conn, [dict(name="Flags off", ats="lever", token="flags")])
    conn.commit()
    assert outbox.outbox_health(conn)["events"] == 0
    activate_fixture(conn)
    sync_seed(conn, [dict(name="Rollback", ats="lever", token="rollback")])
    conn.rollback()
    assert (
        conn.execute(
            "SELECT count(*) n FROM companies WHERE token='rollback'"
        ).fetchone()["n"]
        == 0
    )
    assert outbox.outbox_health(conn)["events"] == 0


@requires_db
def test_fix1_observation_time_distinct_from_database_recording(conn):
    from tests.test_lifecycle_reconcile import setup_source
    from job_discovery.lifecycle.claims import claim_work
    from datetime import UTC, datetime

    setup_source(conn)
    conn.commit()
    activate_fixture(conn)
    claim = claim_work(conn, "archive", "time", 180)
    outbox.baseline_batch(conn, "source_listings", claim)
    conn.commit()
    observed = datetime(2026, 1, 2, 3, 4, tzinfo=UTC)
    conn.execute(
        "UPDATE source_listings SET successful_last_observed_at=%s,source_availability='open'",
        (observed,),
    )
    outbox.flush_public_changes(conn, claim)
    conn.commit()
    event = json.loads(
        bytes(
            conn.execute(
                "SELECT canonical_event FROM public_outbox ORDER BY revision DESC LIMIT 1"
            ).fetchone()["canonical_event"]
        )
    )
    assert event["observed_at"] == observed.isoformat()
    assert event["recorded_at"] != event["observed_at"]
    assert event["provenance"] == "source_observation"


@requires_db
def test_fix1_all_manifest_identity_fields_validated(conn):
    from dataclasses import replace
    import hashlib
    from job_discovery.archive.codec import canonical_json

    claim, _ = seeded_events(conn, 1)
    ref = batches.claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    seal = batches.seal_batch(ref)
    for field, value in [
        ("batch_id", "wrong"),
        ("schema_version", 2),
        ("serializer_version", 2),
        ("prior_batch_id", "wrong"),
        ("event_ids_sha256", "wrong"),
        ("aggregate_revision_ranges", []),
    ]:
        manifest = json.loads(seal.manifest_data)
        manifest[field] = value
        data = canonical_json(manifest)
        with pytest.raises(ValueError, match="manifest"):
            batches.persist_seal(
                conn,
                replace(
                    seal,
                    manifest_data=data,
                    manifest_hash=hashlib.sha256(data).hexdigest(),
                    manifest_bytes=len(data),
                ),
            )
        conn.rollback()
    batches.persist_seal(conn, seal)
    conn.commit()
    assert batches.seal_batch(batches.recover_batch(conn, ref.batch_id, claim)) == seal


@requires_db
def test_fix1_logical_small_row_forecasts_and_warning_predicate(conn, monkeypatch):
    claim, _ = seeded_events(conn, 1)
    row = conn.execute("SELECT * FROM public_outbox").fetchone()
    body_size = conn.execute(
        "SELECT octet_length(body::text) n FROM public_outbox"
    ).fetchone()["n"]
    expected = 4 * body_size + 2 * len(row["canonical_event"]) + 4096
    assert outbox.outbox_health(conn)["live_bytes"] == expected
    assert outbox.outbox_health(conn)["bytes"] > expected
    charge = conn.execute(
        "SELECT lifecycle_private.archive_row_charge(body,canonical_event,2048) n FROM public_outbox"
    ).fetchone()["n"]
    for critical, ceiling in [
        (False, outbox.ORDINARY_BYTES),
        (True, outbox.HARD_BYTES),
    ]:
        assert outbox.budget_allows(1, ceiling - charge, charge, critical)
        assert not outbox.budget_allows(1, ceiling - charge + 1, charge, critical)
    monkeypatch.setattr(outbox, "WARNING_BYTES", expected)
    assert outbox.outbox_health(conn)["warning"]
    # The admitted event's escrow now guarantees logical processing room.
    batch = batches.claim_batch(conn, BatchLimits(), claim)
    assert batch is not None


@requires_db
def test_fix1_retirement_preserves_version_coverage_and_pending_batch(conn):
    from tests.test_lifecycle_reconcile import setup_source
    from job_discovery.lifecycle.claims import claim_work
    from uuid import uuid4

    setup_source(conn)
    listing = conn.execute("SELECT * FROM source_listings").fetchone()
    version = uuid4()
    conn.execute(
        """INSERT INTO job_versions(id,job_id,source_listing_id,revision,content_hash,public_metadata,observed_at)
      VALUES(%s,%s,%s,1,%s,'{"title":"Role","url":"https://example.test/job"}',clock_timestamp())""",
        (version, listing["job_id"], listing["id"], "f" * 64),
    )
    conn.commit()
    activate_fixture(conn)
    claim = claim_work(conn, "archive", "terminal-versions", 180)
    outbox.baseline_batch(conn, "job_versions", claim)
    conn.commit()
    old = batches.claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    seal = batches.seal_batch(old)
    batches.persist_seal(conn, seal)
    conn.commit()
    batches.ack_batch(conn, verified(seal), claim)
    conn.commit()
    conn.execute("INSERT INTO brands(name) VALUES('Still pending')")
    outbox.flush_public_changes(conn, claim)
    conn.commit()
    pending = batches.claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    conn.execute(
        "ALTER TABLE public_archive_batch_markers DISABLE TRIGGER archive_immutable"
    )
    conn.execute(
        "UPDATE public_archive_batch_markers SET acked_at=clock_timestamp()-interval '8 days'"
    )
    conn.execute(
        "ALTER TABLE public_archive_batch_markers ENABLE TRIGGER archive_immutable"
    )
    conn.commit()
    # Bounded continuation, including partial removal, retains exact coverage.
    for _ in range(3):
        assert batches.compact_terminal_batches(conn, claim, limit=1) == 1
        conn.commit()
    assert (
        conn.execute(
            "SELECT version_id FROM public_archive_version_coverage"
        ).fetchone()["version_id"]
        == version
    )
    assert (
        conn.execute("SELECT batch_id FROM public_archive_batches").fetchone()[
            "batch_id"
        ]
        == pending.batch_id
    )
    assert (
        conn.execute("SELECT event_id FROM public_outbox").fetchone()["event_id"]
        == pending.ordered_event_ids[0]
    )
    assert batches.compact_terminal_batches(conn, claim) == 0


@requires_db
def test_fix1_critical_observation_and_recording_survive_seal(conn):
    from job_discovery.archive.outbox import baseline_batch

    source, claim = setup(conn, count=1)
    activate_fixture(conn)
    for kind in ("jobs", "source_listings"):
        baseline_batch(conn, kind, claim)
    conn.commit()
    seq, _ = op.start(conn, source["id"], claim)
    conn.commit()
    op.sightings(conn, source["id"], seq, claim, [("0", "removed")])
    conn.commit()
    slots = conn.execute(
        "SELECT * FROM public_critical_event_slots WHERE state='pending'"
    ).fetchall()
    assert len(slots) == 2
    samples = conn.execute("""SELECT aggregate_type,octet_length(body::text) body_bytes,
      octet_length(canonical_event) canonical_bytes,lifecycle_private.archive_processing_charge(canonical_event) escrow,
      lifecycle_private.archive_row_charge(body,canonical_event,2048)+lifecycle_private.archive_processing_charge(canonical_event) lifecycle_bytes
      FROM public_critical_event_slots WHERE state='pending' ORDER BY aggregate_type""").fetchall()
    print("actual critical closure costs", json.dumps(samples))
    for slot in slots:
        event = json.loads(bytes(slot["canonical_event"]))
        assert event["observed_at"] and event["provenance"] == "source_observation"
        assert event["recorded_at"] != event["observed_at"]
    ref = batches.claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    seal = batches.seal_batch(ref)
    batches.persist_seal(conn, seal)
    conn.commit()
    assert batches.seal_batch(batches.recover_batch(conn, ref.batch_id, claim)) == seal


@requires_db
def test_fix1_unconfigured_prefix_and_legacy_writer_truthfully_defer(conn):
    from job_discovery.db import upsert_jobs
    from job_discovery.models import Posting

    claim, _ = seeded_events(conn, 1)
    conn.execute("DELETE FROM public_archive_destination")
    conn.commit()
    with pytest.raises(outbox.ArchiveBlocked, match="prefix not validated"):
        batches.claim_batch(conn, BatchLimits(), claim)
    conn.rollback()
    with pytest.raises(
        reconcile.StorageBlocked, match="legacy public job writer disabled"
    ):
        upsert_jobs(
            conn,
            1,
            "lever",
            "fixture",
            [Posting("0", "Role", "https://example.test/job")],
        )
    conn.rollback()


@requires_db
def test_fix1_version_mutator_preserves_its_explicit_observation(conn):
    from datetime import UTC, datetime
    from job_discovery.lifecycle.identity import capture_version

    source, claim = setup(conn, count=1)
    activate_fixture(conn)
    listing = conn.execute("SELECT * FROM source_listings").fetchone()
    observed = datetime(2026, 1, 2, 3, 4, tzinfo=UTC)
    capture_version(
        conn,
        listing["id"],
        {"title": "Observed role", "url": "https://example.test/job"},
        observed,
        claim,
    )
    conn.commit()
    events = [
        json.loads(bytes(r["canonical_event"]))
        for r in conn.execute(
            "SELECT canonical_event FROM public_outbox WHERE aggregate_type IN ('job_versions','source_listings')"
        )
    ]
    assert len(events) == 2
    assert all(
        e["observed_at"] == observed.isoformat()
        and e["recorded_at"] != e["observed_at"]
        and e["provenance"] == "source_observation"
        for e in events
    )


@requires_db
def test_fix1_weekly_current_entrypoint_keeps_paired_chunk_progress(conn, monkeypatch):
    from company_discovery import db, worker
    from company_discovery.dataset import Candidate

    activate_fixture(conn)
    monkeypatch.setattr(
        worker.dataset,
        "load_candidates",
        lambda _: [
            Candidate(f"Company {i}", "lever", f"fixture-{i}") for i in range(101)
        ],
    )
    actual = db.upsert_candidates
    calls = []

    def fail_second(c, rows):
        calls.append(len(rows))
        if len(calls) == 2:
            raise outbox.ArchiveBlocked("ordinary fixture archive deferral")
        return actual(c, rows)

    monkeypatch.setattr(db, "upsert_candidates", fail_second)
    with pytest.raises(outbox.ArchiveBlocked):
        worker._maybe_ingest(conn)
    conn.rollback()
    assert calls == [100, 1]
    assert conn.execute("SELECT count(*) n FROM companies").fetchone()["n"] == 100
    assert outbox.outbox_health(conn)["events"] == 100
    row = conn.execute("SELECT status,ingested,notes FROM discovery_runs").fetchone()
    assert (
        row["status"] == "error"
        and row["ingested"] == 100
        and row["notes"].startswith("weekly ingest tick")
    )


@requires_db
@pytest.mark.parametrize("writer", ["seed", "enrichment"])
def test_fix1_current_writer_pair_failure_rolls_back_mutation(
    conn, monkeypatch, writer
):
    from job_discovery.db import sync_seed
    from company_discovery.enrich_apply import apply_enrichment, EnrichUpdate

    activate_fixture(conn)
    sync_seed(conn, [dict(name="Original", ats="lever", token="paired")])
    conn.commit()
    cid = conn.execute("SELECT id FROM companies").fetchone()["id"]
    conn.commit()

    def blocked(*args, **kwargs):
        raise outbox.ArchiveBlocked("ordinary fixture pairing admission deferred")

    monkeypatch.setattr(outbox, "record_public_change", blocked)
    with pytest.raises(outbox.ArchiveBlocked):
        if writer == "seed":
            sync_seed(conn, [dict(name="Uncommitted", ats="lever", token="paired")])
        else:
            apply_enrichment(
                conn, cid, EnrichUpdate("Uncommitted", "Public about", "ats_board")
            )
    conn.rollback()
    row = conn.execute("SELECT name,display_name FROM companies").fetchone()
    assert row == dict(name="Original", display_name=None)
    assert outbox.outbox_health(conn)["events"] == 1
    assert (
        conn.execute("SELECT revision FROM public_archive_heads").fetchone()["revision"]
        == 1
    )


@requires_db
def test_fix1_key_day_is_utc_even_for_an_offset_ref(conn):
    from dataclasses import replace
    from datetime import datetime, timedelta, timezone

    claim, _ = seeded_events(conn, 1)
    ref = batches.claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    offset = datetime(2026, 1, 2, 1, tzinfo=timezone(timedelta(hours=14)))
    seal = batches.seal_batch(
        replace(ref, sealed_at=offset, eligible_until=offset + timedelta(days=730))
    )
    assert "/ingestion_date=2026-01-01/" in seal.data_key
