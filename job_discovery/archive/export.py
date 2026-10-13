"""One bounded export turn: short persisted transactions, network only after commit."""

import logging
from job_discovery import db
from job_discovery.lifecycle.claims import (
    claim_work,
    cancel_claim,
    renew_claim,
    validate_claim,
)
from job_discovery.lifecycle.capacity import (
    reserve_capacity,
    bind_reservation,
    settle_capacity,
)
from job_discovery.lifecycle.config import read_control
from job_discovery.lifecycle.locks import enter_gate
from .batches import (
    claim_batch,
    recover_batch,
    seal_batch,
    persist_seal,
    ack_batch,
    compact_terminal_batches,
    _owned,
)
from .types import BatchLimits, AckResult
from .s3 import ArchiveClient, Destination, put_verify_batch
from .outbox import ArchiveBlocked
from .recovery import (
    RecoveryAuthorization as RecoveryAuthorization,
    replace_expired_batch as replace_expired_batch,
)

log = logging.getLogger(__name__)
LEASE_SECONDS = 180
CLEANUP_LIMIT = 2000


def read_destination(conn) -> Destination:
    row = conn.execute("""SELECT bucket,region,object_prefix,expected_owner FROM public_archive_destination
        WHERE singleton AND validated_at<=clock_timestamp() AND private_validated AND encryption_validated
        AND policy_validated AND length(validation_evidence)>0""").fetchone()
    if not row:
        raise ArchiveBlocked("archive destination validation required")
    try:
        return Destination(**row)
    except (TypeError, ValueError):
        raise ArchiveBlocked("archive destination configuration incomplete") from None


def cleanup_terminal(conn, claim, limit=CLEANUP_LIMIT):
    """One shared 2000-row budget; supersession/coverage markers are indefinite."""
    count = compact_terminal_batches(conn, claim, limit=limit)
    rows = conn.execute(
        """DELETE FROM public_archive_batches b WHERE b.batch_id IN
        (SELECT b.batch_id FROM public_archive_batches b JOIN public_archive_supersessions s ON s.old_batch_id=b.batch_id
        WHERE b.state='superseded' AND s.replaced_at<=clock_timestamp()-interval '7 days'
        AND NOT EXISTS(SELECT FROM public_archive_items i WHERE i.batch_id=b.batch_id)
        AND NOT EXISTS(SELECT FROM public_archive_receipts r WHERE r.batch_id=b.batch_id)
        ORDER BY s.replaced_at,b.batch_id LIMIT %s) RETURNING b.batch_id""",
        (limit - count,),
    ).fetchall()
    return count + len(rows)


def export_once(
    dsn: str | None, client: ArchiveClient | None = None
) -> AckResult | None:
    conn = claim = ref = None
    try:
        conn = db.connect(dsn)
        enter_gate(conn)
        control = read_control(conn)
        if not control.archive_ever_activated:
            conn.commit()
            return None
        claim = claim_work(conn, "archive-export", "singleton", LEASE_SECONDS)
        conn.commit()
        if claim is None:
            return None
        # Scheduled even during export pause; never visits pending payloads.
        cleanup_terminal(conn, claim)
        conn.commit()
        enter_gate(conn)
        control = read_control(conn)
        if not control.export_enabled:
            conn.commit()
            return None
        destination = read_destination(conn)
        if client is not None and client.destination != destination:
            raise ArchiveBlocked("archive client differs from validated destination")
        expired = conn.execute(
            "SELECT 1 FROM public_archive_batches WHERE state IN ('claimed','sealed') AND eligible_until<=lifecycle_private.archive_clock() LIMIT 1"
        ).fetchone()
        if expired:
            log.warning("archive retention action needed; pending events retained")
        row = conn.execute(
            "SELECT batch_id FROM public_archive_batches WHERE state IN ('claimed','sealed') AND eligible_until>lifecycle_private.archive_clock() AND NOT EXISTS(SELECT FROM public_archive_quarantine q WHERE q.batch_id=public_archive_batches.batch_id) ORDER BY sealed_at,batch_id LIMIT 1"
        ).fetchone()
        if row:
            ref = recover_batch(conn, row["batch_id"], claim)
        else:
            limits = BatchLimits()
            ready = conn.execute("""SELECT count(*) n,COALESCE(sum(octet_length(canonical_event)+1),0) bytes,
                min(recorded_at)<=clock_timestamp()-interval '5 minutes' aged FROM
                (SELECT canonical_event,recorded_at FROM public_pending_events e WHERE NOT EXISTS(
                 SELECT FROM public_archive_items i WHERE i.event_id=e.event_id)
                 ORDER BY recorded_at,event_id LIMIT 2000) pending""").fetchone()
            ref = (
                claim_batch(conn, limits, claim)
                if ready["n"] >= limits.max_events
                or ready["bytes"] >= limits.max_expanded_bytes
                or ready["aged"]
                else None
            )
        conn.commit()
        if ref is None:
            return None
        seal = seal_batch(ref)
        persist_seal(conn, seal)
        conn.commit()
        # DB-time eligibility immediately before verification; final ack rechecks it.
        _owned(conn, seal.batch_id, claim)
        renew_claim(conn, claim, LEASE_SECONDS)
        conn.commit()
        if client is None:
            client = ArchiveClient.from_destination(destination)
        verified = put_verify_batch(seal, client)
        result = ack_batch(conn, verified, claim)
        conn.commit()
        return result
    except ValueError:
        if conn is not None and claim is not None and ref is not None:
            conn.rollback()
            validate_claim(conn, claim)
            reservation = reserve_capacity(conn, claim, 8192)
            if reservation is not None:
                bind_reservation(
                    conn, reservation, job_id=None, scope="public_archive_batches"
                )
                conn.execute(
                    "INSERT INTO public_archive_quarantine(batch_id,diagnostic_code) VALUES(%s,'invalid_archive') ON CONFLICT DO NOTHING",
                    (ref.batch_id,),
                )
                settle_capacity(conn, reservation)
            conn.commit()
        raise
    finally:
        if conn is not None:
            try:
                conn.rollback()
                if claim is not None:
                    cancel_claim(conn, claim)
                    conn.commit()
            finally:
                conn.close()
