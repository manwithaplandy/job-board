"""Explicit operator-authorized archive recovery. The worker never grants authorization."""

from dataclasses import dataclass
from uuid import UUID, uuid4
from .batches import _ref, _hash, _processing_capacity
from .codec import canonical_json
from .outbox import ArchiveBlocked
from .types import BatchRef
from job_discovery.lifecycle.claims import validate_claim
from job_discovery.lifecycle.capacity import (
    reserve_capacity,
    bind_reservation,
    settle_capacity,
)


@dataclass(frozen=True)
class RecoveryAuthorization:
    authorization_id: UUID


def replace_expired_batch(
    tx, batch_id: UUID, claim, authorization: RecoveryAuthorization
) -> BatchRef:
    validate_claim(tx, claim)
    if not isinstance(authorization, RecoveryAuthorization):
        raise ArchiveBlocked("explicit archive recovery authorization required")
    old = tx.execute(
        "SELECT * FROM public_archive_batches WHERE batch_id=%s FOR UPDATE", (batch_id,)
    ).fetchone()
    if (
        not old
        or old["state"] not in {"claimed", "sealed"}
        or tx.execute(
            "SELECT lifecycle_private.archive_clock()<%s eligible",
            (old["eligible_until"],),
        ).fetchone()["eligible"]
    ):
        raise ArchiveBlocked("batch is not eligible for expired replacement")
    ref = _ref(tx, old, claim)
    digest = _hash(canonical_json([str(e) for e in ref.ordered_event_ids]))
    auth = tx.execute(
        """SELECT * FROM public_archive_recovery_authorizations
        WHERE authorization_id=%s AND batch_id=%s AND consumed_at IS NULL
        AND approved_at<=clock_timestamp() AND expires_at>clock_timestamp() FOR UPDATE""",
        (authorization.authorization_id, batch_id),
    ).fetchone()
    if (
        not auth
        or auth["event_ids_sha256"] != digest
        or auth["manifest_hash"] != old["manifest_hash"]
    ):
        raise ArchiveBlocked(
            "explicit matching archive recovery authorization required"
        )
    pending = tx.execute(
        """SELECT count(*) n FROM public_archive_items i JOIN public_pending_events e USING(event_id)
        WHERE i.batch_id=%s AND i.canonical_event=e.canonical_event""",
        (batch_id,),
    ).fetchone()["n"]
    if pending != len(ref.ordered_event_ids) or pending != old["event_count"]:
        raise ArchiveBlocked("replacement exact pending membership differs")
    if tx.execute(
        """SELECT 1 FROM public_archive_items i JOIN public_archive_suppressions s USING(aggregate_type,aggregate_id)
        WHERE i.batch_id=%s LIMIT 1""",
        (batch_id,),
    ).fetchone():
        raise ArchiveBlocked("replacement contains suppressed aggregate")
    _processing_capacity(tx, ref.event_bytes)
    reservation = reserve_capacity(
        tx, claim, 65536 + sum(map(len, ref.event_bytes)) * 4
    )
    if reservation is None:
        raise ArchiveBlocked("physical replacement capacity unavailable")
    bind_reservation(tx, reservation, job_id=None, scope="public_archive_batches")
    new_id = uuid4()
    row = tx.execute(
        """INSERT INTO public_archive_batches(batch_id,owner_token,generation,serializer_version,sealed_at,
        eligible_until,event_count,expanded_bytes,object_prefix,ingestion_date,prior_batch_id)
        SELECT %s,%s,%s,%s,t,t+interval '17520 hours',%s,%s,%s,(t AT TIME ZONE 'UTC')::date,%s
        FROM (SELECT lifecycle_private.archive_clock() t) clock RETURNING *""",
        (
            new_id,
            claim.owner_token,
            claim.generation,
            ref.serializer_version,
            old["event_count"],
            old["expanded_bytes"],
            ref.object_prefix,
            batch_id,
        ),
    ).fetchone()
    tx.execute(
        """UPDATE public_archive_recovery_authorizations SET consumed_at=clock_timestamp(),replacement_batch_id=%s
        WHERE authorization_id=%s""",
        (new_id, authorization.authorization_id),
    )
    tx.execute(
        """INSERT INTO public_archive_supersessions(old_batch_id,new_batch_id,authorization_id,owner_token,generation,event_ids_sha256,manifest_hash)
        VALUES(%s,%s,%s,%s,%s,%s,%s)""",
        (
            batch_id,
            new_id,
            authorization.authorization_id,
            old["owner_token"],
            old["generation"],
            digest,
            old["manifest_hash"],
        ),
    )
    tx.execute(
        "UPDATE public_archive_batches SET state='superseded' WHERE batch_id=%s",
        (batch_id,),
    )
    tx.execute(
        "UPDATE public_archive_items SET batch_id=%s WHERE batch_id=%s",
        (new_id, batch_id),
    )
    settle_capacity(tx, reservation)
    return _ref(tx, row, claim)
