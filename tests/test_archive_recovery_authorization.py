"""R11-1: fresh operator approval after an unused approval expires, owned DB only."""

from datetime import timedelta
from uuid import uuid4

import pytest

from job_discovery import db
from job_discovery.archive.batches import persist_seal, recover_batch, seal_batch
from job_discovery.archive.outbox import ArchiveBlocked
from job_discovery.archive.recovery import RecoveryAuthorization, replace_expired_batch
from job_discovery.lifecycle.claims import cancel_claim, claim_work
from tests.conftest import TEST_DSN, requires_db
from tests.test_archive_retention_recovery import (
    Crash,
    pending,
    set_archive_clock,
    setup_batch,
)


def approval_rows(conn, batch_id):
    rows = conn.execute(
        "SELECT * FROM public_archive_recovery_authorizations WHERE batch_id=%s ORDER BY authorization_id",
        (batch_id,),
    ).fetchall()
    conn.commit()
    return {row["authorization_id"]: row for row in rows}


@requires_db
def test_fresh_explicit_approval_after_unused_approval_expires(conn):
    batch, _ = setup_batch(conn)
    claim = claim_work(conn, "archive-export", "singleton", 180)
    ref = recover_batch(conn, batch.batch_id, claim)
    conn.commit()
    seal = seal_batch(ref)
    persist_seal(conn, seal)
    conn.commit()
    original_pending = pending(conn)
    set_archive_clock(conn, ref.eligible_until + timedelta(seconds=1))
    expired_id, fresh_id = uuid4(), uuid4()
    # Seed an already-expired historical approval; ordinary authorization time
    # remains the real DB clock, separate from the archive-horizon fixture clock.
    conn.execute(
        """INSERT INTO public_archive_recovery_authorizations(
        authorization_id,batch_id,event_ids_sha256,manifest_hash,approved_by,reason,approved_at,expires_at)
        SELECT %s,batch_id,event_ids_sha256,manifest_hash,'fixture operator',
        'original explicit approval',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour'
        FROM public_archive_batches WHERE batch_id=%s""",
        (expired_id, ref.batch_id),
    )
    conn.commit()
    old_history = approval_rows(conn, ref.batch_id)[expired_id]
    with pytest.raises(ArchiveBlocked, match="authorization"), conn.transaction():
        replace_expired_batch(
            conn, ref.batch_id, claim, RecoveryAuthorization(expired_id)
        )
    assert approval_rows(conn, ref.batch_id) == {expired_id: old_history}
    assert pending(conn) == original_pending
    assert (
        conn.execute("SELECT count(*) n FROM public_archive_supersessions").fetchone()[
            "n"
        ]
        == 0
    )
    assert (
        conn.execute(
            "SELECT state FROM public_archive_batches WHERE batch_id=%s",
            (ref.batch_id,),
        ).fetchone()["state"]
        == "sealed"
    )
    conn.commit()

    # A distinct operator grant is required: no mutation/extension of old approval.
    conn.execute(
        """INSERT INTO public_archive_recovery_authorizations(
        authorization_id,batch_id,event_ids_sha256,manifest_hash,approved_by,reason,expires_at)
        SELECT %s,batch_id,event_ids_sha256,manifest_hash,'fixture operator',
        'new separately granted explicit approval',clock_timestamp()+interval '1 hour'
        FROM public_archive_batches WHERE batch_id=%s""",
        (fresh_id, ref.batch_id),
    )
    conn.commit()
    before_transfer = approval_rows(conn, ref.batch_id)
    assert before_transfer[expired_id] == old_history
    with pytest.raises(Crash), conn.transaction():
        replace_expired_batch(
            conn, ref.batch_id, claim, RecoveryAuthorization(fresh_id)
        )
        raise Crash()
    assert approval_rows(conn, ref.batch_id) == before_transfer
    assert pending(conn) == original_pending
    assert (
        conn.execute("SELECT count(*) n FROM public_archive_supersessions").fetchone()[
            "n"
        ]
        == 0
    )
    assert (
        conn.execute("SELECT count(*) n FROM public_archive_batches").fetchone()["n"]
        == 1
    )
    conn.commit()

    retry = db.connect(TEST_DSN)
    try:
        replacement = replace_expired_batch(
            retry, ref.batch_id, claim, RecoveryAuthorization(fresh_id)
        )
        retry.commit()
    finally:
        retry.close()
    assert retry.closed
    assert replacement.ordered_event_ids == ref.ordered_event_ids
    assert replacement.event_bytes == ref.event_bytes
    assert replacement.prior_batch_id == ref.batch_id
    assert replacement.batch_id != ref.batch_id
    assert replacement.sealed_at > ref.eligible_until
    assert replacement.eligible_until - replacement.sealed_at == timedelta(days=730)
    assert pending(conn) == original_pending
    after = approval_rows(conn, ref.batch_id)
    assert after[expired_id] == old_history
    assert after[fresh_id]["consumed_at"] is not None
    assert after[fresh_id]["replacement_batch_id"] == replacement.batch_id
    assert {
        k: v
        for k, v in after[fresh_id].items()
        if k not in {"consumed_at", "replacement_batch_id"}
    } == {
        k: v
        for k, v in before_transfer[fresh_id].items()
        if k not in {"consumed_at", "replacement_batch_id"}
    }
    fence = conn.execute("SELECT * FROM public_archive_supersessions").fetchall()
    assert len(fence) == 1
    assert (
        fence[0]["old_batch_id"],
        fence[0]["new_batch_id"],
        fence[0]["authorization_id"],
    ) == (ref.batch_id, replacement.batch_id, fresh_id)
    assert (
        fence[0]["owner_token"],
        fence[0]["generation"],
        fence[0]["manifest_hash"],
    ) == (claim.owner_token, claim.generation, seal.manifest_hash)
    conn.commit()
    with pytest.raises(ArchiveBlocked, match="not eligible"), conn.transaction():
        replace_expired_batch(
            conn, ref.batch_id, claim, RecoveryAuthorization(fresh_id)
        )
    assert approval_rows(conn, ref.batch_id) == after
    assert pending(conn) == original_pending
    assert (
        conn.execute("SELECT * FROM public_archive_supersessions").fetchall() == fence
    )
    conn.commit()
    cancel_claim(conn, claim)
    conn.commit()
