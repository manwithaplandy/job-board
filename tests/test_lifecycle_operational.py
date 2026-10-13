"""Ordinary preallocated lane integration; no physical guard or omitted mechanism probes."""

import json
from datetime import timedelta
import pytest
from tests.conftest import requires_db
from tests.test_lifecycle_reconcile import setup_source
from job_discovery.lifecycle import operational as op
from job_discovery.lifecycle.claims import claim_work


def setup(conn, count=2, slots=16):
    source = setup_source(conn, count=count)
    claim = claim_work(conn, "source", str(source["id"]), 180)
    assert op.provision(conn, source["id"], claim, critical_slots=slots)
    conn.commit()
    return source, claim


def stats(conn):
    row = conn.execute("""SELECT pg_database_size(current_database()) allocated,
      sum(pg_table_size(oid)) table_toast_bytes,sum(pg_indexes_size(oid)) index_bytes
      FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' """).fetchone()
    return {k: int(v) for k, v in row.items()}


@requires_db
def test_preallocated_health_membership_and_two_complete_misses(conn):
    source, claim = setup(conn)
    before = stats(conn)
    source_id = source["id"]
    first, _ = op.start(conn, source_id, claim)
    conn.commit()
    op.sightings(
        conn, source_id, first, claim, [("0", "seen"), ("new-not-admitted", "seen")]
    )
    conn.commit()
    op.complete(conn, source_id, first, claim, successful=True)
    conn.commit()
    timing = conn.execute(
        "SELECT last_attempt_at,next_due_at FROM source_accounts WHERE id=%s",
        (source_id,),
    ).fetchone()
    assert timing["next_due_at"] == timing["last_attempt_at"].replace(
        hour=0, minute=0, second=0, microsecond=0
    ) + timedelta(days=1)
    assert op.reconcile(conn, source_id, first, claim)
    conn.commit()
    assert conn.execute("SELECT count(*) n FROM jobs").fetchone()["n"] == 2
    assert (
        conn.execute("SELECT closed_at FROM jobs WHERE external_id='1'").fetchone()[
            "closed_at"
        ]
        is None
    )
    second, _ = op.start(conn, source_id, claim)
    conn.commit()
    op.sightings(conn, source_id, second, claim, [("0", "seen")])
    op.complete(conn, source_id, second, claim, successful=True)
    # Local fixture evidence interval; production clock is never configurable.
    conn.execute(
        "UPDATE lifecycle_operational_sources SET completed_at=completed_at+interval '24 hours' WHERE source_id=%s",
        (source_id,),
    )
    conn.commit()
    assert op.reconcile(conn, source_id, second, claim)
    conn.commit()
    assert conn.execute("SELECT closed_at FROM jobs WHERE external_id='1'").fetchone()[
        "closed_at"
    ]
    assert (
        conn.execute("SELECT closed_at FROM jobs WHERE external_id='0'").fetchone()[
            "closed_at"
        ]
        is None
    )
    after = stats(conn)
    print(
        "ordinary operational resource evidence",
        json.dumps(
            {
                "before": before,
                "after": after,
                "delta": {k: after[k] - before[k] for k in before},
            },
            sort_keys=True,
        ),
    )


@requires_db
def test_partial_positive_survives_restart_and_never_certifies_absence(conn):
    from tests.lifecycle_helpers import open_sessions
    from tests.conftest import TEST_DSN

    source, claim = setup(conn)
    source_id = source["id"]
    sequence, _ = op.start(conn, source_id, claim)
    conn.commit()
    op.sightings(conn, source_id, sequence, claim, [("0", "seen")])
    conn.commit()
    fresh = open_sessions(TEST_DSN, 1)[0]
    try:
        op.complete(fresh, source_id, sequence, claim, successful=False, failed=True)
        fresh.commit()
        assert op.reconcile(fresh, source_id, sequence, claim)
        fresh.commit()
        row = fresh.execute(
            "SELECT p.*,l.consecutive_complete_misses FROM lifecycle_operational_listings p JOIN source_listings l ON l.id=p.listing_id WHERE seen_sequence=%s",
            (sequence,),
        ).fetchone()
        assert row["seen_at"] and row["consecutive_complete_misses"] == 0
        assert (
            fresh.execute(
                "SELECT max(consecutive_complete_misses) n FROM source_listings"
            ).fetchone()["n"]
            == 0
        )
        next_sequence, resuming = op.start(fresh, source_id, claim)
        assert next_sequence > sequence and not resuming
        fresh.commit()
    finally:
        fresh.close()


@requires_db
def test_complete_checkpoint_resumes_with_fresh_connection(conn):
    from tests.lifecycle_helpers import open_sessions
    from tests.conftest import TEST_DSN

    source, claim = setup(conn, count=3)
    sequence, _ = op.start(conn, source["id"], claim)
    conn.commit()
    op.complete(conn, source["id"], sequence, claim, successful=True)
    conn.commit()
    assert not op.reconcile(conn, source["id"], sequence, claim, limit=1)
    conn.commit()
    fresh = open_sessions(TEST_DSN, 1)[0]
    try:
        assert op.start(fresh, source["id"], claim) == (sequence, True)
        fresh.commit()
        assert op.reconcile(fresh, source["id"], sequence, claim)
        fresh.commit()
        assert (
            fresh.execute(
                "SELECT sum(consecutive_complete_misses) n FROM source_listings"
            ).fetchone()["n"]
            == 3
        )
    finally:
        fresh.close()


@requires_db
def test_active_archive_critical_slots_exact_ack(conn):
    from tests.archive_helpers import activate_fixture
    from job_discovery.archive.outbox import baseline_batch
    from job_discovery.archive.batches import (
        claim_batch,
        seal_batch,
        persist_seal,
        ack_batch,
    )
    from job_discovery.archive.types import BatchLimits
    from tests.test_archive_batches import verified

    source, claim = setup(conn, count=1)
    activate_fixture(conn)
    for kind in ["jobs", "source_listings"]:
        baseline_batch(conn, kind, claim)
    conn.commit()
    sequence, _ = op.start(conn, source["id"], claim)
    conn.commit()
    op.sightings(conn, source["id"], sequence, claim, [("0", "removed")])
    conn.commit()
    ids = {
        r["event_id"]
        for r in conn.execute(
            "SELECT event_id FROM public_critical_event_slots WHERE state='pending'"
        )
    }
    assert len(ids) == 2
    batch = claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    seal = seal_batch(batch)
    persist_seal(conn, seal)
    conn.commit()
    result = ack_batch(conn, verified(seal), claim)
    conn.commit()
    assert ids <= set(result.exact_event_ids)
    assert (
        conn.execute(
            "SELECT count(*) n FROM public_critical_event_slots WHERE state='acked'"
        ).fetchone()["n"]
        == 2
    )

    from job_discovery.archive.batches import compact_terminal_batches

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
    assert compact_terminal_batches(conn, claim) == len(batch.ordered_event_ids) + 4
    conn.commit()
    assert (
        conn.execute(
            "SELECT count(*) n FROM public_critical_event_slots WHERE state='acked' AND canonical_event=''::bytea"
        ).fetchone()["n"]
        == 2
    )


@requires_db
def test_missing_preallocation_reports_deferred(conn):
    source = setup_source(conn)
    claim = claim_work(conn, "source", str(source["id"]), 180)
    conn.commit()
    with (
        pytest.raises(op.OperationalDeferred, match="not preallocated"),
        conn.transaction(),
    ):
        op.start(conn, source["id"], claim)


@requires_db
def test_operational_entrypoint_uses_preallocated_rows_and_offline_full_feed(
    conn, monkeypatch
):
    from time import monotonic
    from job_discovery.adapters import ADAPTERS
    from job_discovery.adapters.completeness import SourceResult, SourceStatus
    from job_discovery.models import Posting
    from job_discovery.lifecycle.claims import cancel_claim
    from job_discovery.lifecycle.reconcile import verify_storage_blocked

    source, claim = setup(conn, count=2)
    cancel_claim(conn, claim)
    conn.commit()
    tables = [
        "lifecycle_operational_sources",
        "lifecycle_operational_listings",
        "lifecycle_operational_receipts",
        "public_critical_event_slots",
        "lifecycle_write_checks",
    ]
    # Constant known table identifiers; service integration fixture only.
    before = {
        t: conn.execute(f"SELECT count(*) n FROM {t}").fetchone()["n"] for t in tables
    }
    conn.commit()

    def feed(*args, **kwargs):
        assert conn.info.transaction_status.name == "IDLE"
        return SourceResult(
            iter([Posting("0", "Role", "https://example.test/job")]), SourceStatus()
        )

    monkeypatch.setitem(ADAPTERS, "lever", feed)
    result = verify_storage_blocked(conn, max_boards=1, deadline=monotonic() + 60)
    assert result == {"complete": 1, "deferred": 0}
    after = {
        t: conn.execute(f"SELECT count(*) n FROM {t}").fetchone()["n"] for t in tables
    }
    assert after == before
    assert conn.execute(
        "SELECT last_complete_success_at FROM source_accounts WHERE id=%s",
        (source["id"],),
    ).fetchone()["last_complete_success_at"]


@requires_db
def test_insufficient_critical_slots_defers_closure_atomically(conn):
    from tests.archive_helpers import activate_fixture
    from job_discovery.archive.outbox import baseline_batch

    source, claim = setup(conn, count=1, slots=1)
    activate_fixture(conn)
    for kind in ["jobs", "source_listings"]:
        baseline_batch(conn, kind, claim)
    conn.commit()
    sequence, _ = op.start(conn, source["id"], claim)
    conn.commit()
    with pytest.raises(Exception, match="slots exhausted"), conn.transaction():
        op.sightings(conn, source["id"], sequence, claim, [("0", "removed")])
    assert conn.execute("SELECT closed_at FROM jobs").fetchone()["closed_at"] is None
    assert (
        conn.execute(
            "SELECT count(*) n FROM public_critical_event_slots WHERE state='pending'"
        ).fetchone()["n"]
        == 0
    )
