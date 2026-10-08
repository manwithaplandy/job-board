"""Task10 persisted exact membership and acknowledgement with offline receipts."""

from job_discovery.archive.batches import (
    claim_batch,
    seal_batch,
    persist_seal,
    ack_batch,
)
from job_discovery.archive.types import BatchLimits


def test_batch_limits_are_bounded():
    import pytest

    with pytest.raises(ValueError):
        BatchLimits(max_events=2001)
    with pytest.raises(ValueError):
        BatchLimits(max_expanded_bytes=8 * 1024**2 + 1)


from dataclasses import replace
import pytest
from tests.conftest import requires_db
from tests.archive_helpers import seeded_events
from job_discovery.archive.types import VerifiedBatch, VerificationReceipt


def verified(seal):
    return VerifiedBatch(
        seal,
        VerificationReceipt(
            seal.data_key, seal.compressed_hash, seal.compressed_bytes, "offline-data"
        ),
        VerificationReceipt(
            seal.manifest_key,
            seal.manifest_hash,
            seal.manifest_bytes,
            "offline-manifest",
        ),
    )


@requires_db
def test_persisted_exact_partial_membership_and_ack(conn):
    claim, refs = seeded_events(conn)
    batch = claim_batch(conn, BatchLimits(max_events=2), claim)
    conn.commit()
    seal = seal_batch(batch, 1)
    assert seal == seal_batch(batch, 1)
    persist_seal(conn, seal)
    conn.commit()
    result = ack_batch(conn, verified(seal), claim)
    conn.commit()
    assert result.exact_event_ids == batch.ordered_event_ids
    pending = {
        r["event_id"] for r in conn.execute("SELECT event_id FROM public_outbox")
    }
    assert pending == {r.event_id for r in refs} - set(batch.ordered_event_ids)
    assert ack_batch(conn, verified(seal), claim) == result
    conn.commit()


@requires_db
def test_seal_membership_and_clock_are_immutable(conn):
    claim, _ = seeded_events(conn)
    batch = claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    seal = seal_batch(batch)
    persist_seal(conn, seal)
    conn.commit()
    for statement in [
        "UPDATE public_archive_batches SET sealed_at=sealed_at+interval '1 second',eligible_until=eligible_until+interval '1 second'",
        "UPDATE public_archive_items SET position=position+10",
        "UPDATE public_archive_batches SET manifest_hash='different'",
    ]:
        with pytest.raises(Exception, match="immutable"), conn.transaction():
            conn.execute(statement)


@requires_db
def test_ack_rollback_retains_every_exact_pending_event(conn):
    claim, refs = seeded_events(conn)
    batch = claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    seal = seal_batch(batch)
    persist_seal(conn, seal)
    conn.commit()
    with pytest.raises(RuntimeError), conn.transaction():
        ack_batch(conn, verified(seal), claim)
        raise RuntimeError("crash before commit")
    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == len(
        refs
    )
    assert (
        conn.execute("SELECT count(*) n FROM public_archive_receipts").fetchone()["n"]
        == 0
    )


@requires_db
def test_exact_receipts_and_suppressed_membership_fail_closed(conn):
    claim, refs = seeded_events(conn)
    batch = claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    seal = seal_batch(batch)
    persist_seal(conn, seal)
    conn.commit()
    bad = replace(
        verified(seal),
        data_receipt=VerificationReceipt(
            seal.data_key, "bad", seal.compressed_bytes, "offline"
        ),
    )
    with pytest.raises(ValueError, match="exact data"), conn.transaction():
        ack_batch(conn, bad, claim)
    conn.execute(
        "INSERT INTO public_archive_suppressions(aggregate_type,aggregate_id,reason) VALUES('brands',%s,'local fixture')",
        (refs[0].aggregate_id,),
    )
    conn.commit()
    with pytest.raises(Exception, match="suppressed"), conn.transaction():
        ack_batch(conn, verified(seal), claim)
    assert conn.execute("SELECT count(*) n FROM public_outbox").fetchone()["n"] == 3


@requires_db
def test_per_aggregate_ordering_survives_small_batches(conn):
    from job_discovery.archive.outbox import flush_public_changes

    claim, _ = seeded_events(conn, 1)
    for i in range(2):
        conn.execute("UPDATE brands SET name=%s", (f"Changed {i}",))
        flush_public_changes(conn, claim)
        conn.commit()
    first = claim_batch(conn, BatchLimits(max_events=1), claim)
    conn.commit()
    assert claim_batch(conn, BatchLimits(), claim) is None
    conn.commit()
    seal = seal_batch(first)
    persist_seal(conn, seal)
    conn.commit()
    ack_batch(conn, verified(seal), claim)
    conn.commit()
    rest = claim_batch(conn, BatchLimits(), claim)
    assert len(rest.ordered_event_ids) == 2
    conn.commit()


@requires_db
def test_later_lower_sequence_commit_remains_pending(conn):
    from tests.lifecycle_helpers import open_sessions
    from tests.conftest import TEST_DSN
    from job_discovery.archive.outbox import flush_public_changes
    from job_discovery.lifecycle.claims import claim_work

    claim, _ = seeded_events(conn, 1)
    # Allocate sequence before the gate: sequence allocation never certifies commit membership.
    other = open_sessions(TEST_DSN, 1)[0]
    try:
        lower = other.execute(
            "SELECT nextval('public_change_requirements_id_seq') n"
        ).fetchone()["n"]
        other.commit()
        conn.execute("UPDATE brands SET name='Before batch'")
        flush_public_changes(conn, claim)
        conn.commit()
        batch = claim_batch(conn, BatchLimits(), claim)
        conn.commit()
        late_claim = claim_work(other, "archive", "late", 180)
        other.execute(
            "SELECT setval('public_change_requirements_id_seq',%s,false)", (lower,)
        )
        other.execute("INSERT INTO brands(name) VALUES('Late commit')")
        # The real newly committed requirement has the earlier reserved sequence.
        req = other.execute(
            "SELECT id FROM public_change_requirements WHERE transaction_id=pg_current_xact_id()"
        ).fetchone()["id"]
        assert lower == req
        # Actual pending sequence is independent of its event UUID; no production sequence watermark is used.
        late = flush_public_changes(other, late_claim)
        other.commit()
        seal = seal_batch(batch)
        persist_seal(conn, seal)
        conn.commit()
        ack_batch(conn, verified(seal), claim)
        conn.commit()
        assert {
            r["event_id"]
            for r in conn.execute("SELECT event_id FROM public_pending_events")
        } == {r.event_id for r in late}
    finally:
        other.close()


@requires_db
def test_seven_day_terminal_compaction_preserves_exact_markers(conn):
    from job_discovery.archive.batches import compact_terminal_batches

    claim, refs = seeded_events(conn, 1)
    batch = claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    seal = seal_batch(batch)
    persist_seal(conn, seal)
    conn.commit()
    ack_batch(conn, verified(seal), claim)
    conn.commit()
    assert compact_terminal_batches(conn, claim) == 0
    conn.commit()
    # Isolated terminal-age fixture; no production time setting or bypass exists.
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
    assert compact_terminal_batches(conn, claim) == 3
    conn.commit()
    assert (
        conn.execute("SELECT event_id FROM public_archive_coverage").fetchone()[
            "event_id"
        ]
        == refs[0].event_id
    )
    assert (
        conn.execute("SELECT count(*) n FROM public_archive_items").fetchone()["n"] == 0
    )
    assert (
        conn.execute("SELECT count(*) n FROM public_archive_batch_markers").fetchone()[
            "n"
        ]
        == 1
    )


@requires_db
def test_batch_claim_excludes_own_uncommitted_public_events(conn):
    from job_discovery.archive.outbox import flush_public_changes

    claim, _ = seeded_events(conn, 0)
    conn.execute("INSERT INTO brands(name) VALUES('Uncommitted')")
    flush_public_changes(conn, claim)
    assert claim_batch(conn, BatchLimits(), claim) is None
    conn.commit()
    assert len(claim_batch(conn, BatchLimits(), claim).ordered_event_ids) == 1
    conn.commit()
