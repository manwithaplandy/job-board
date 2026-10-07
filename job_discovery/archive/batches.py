"""Persist exact committed membership; serialize without a connection or transaction."""

from dataclasses import asdict, replace
from datetime import UTC
import hashlib
import json
from uuid import uuid4
from psycopg.types.json import Jsonb
from job_discovery.lifecycle.claims import validate_claim
from job_discovery.lifecycle.capacity import (
    reserve_capacity,
    bind_reservation,
    settle_capacity,
)
from .codec import canonical_json, encode_events, MAX_MANIFEST
from .outbox import ArchiveBlocked
from .types import BatchRef, BatchLimits, SealedBatch, VerifiedBatch, AckResult


def _hash(value):
    return hashlib.sha256(value).hexdigest()


def _ref(tx, row, claim):
    items = tx.execute(
        "SELECT * FROM public_archive_items WHERE batch_id=%s ORDER BY position",
        (row["batch_id"],),
    ).fetchall()
    return BatchRef(
        row["batch_id"],
        claim,
        tuple(i["event_id"] for i in items),
        row["serializer_version"],
        row["sealed_at"],
        row["eligible_until"],
        tuple(bytes(i["canonical_event"]) for i in items),
        row["prior_batch_id"],
    )


def claim_batch(tx, limits: BatchLimits, claim) -> BatchRef | None:
    if not isinstance(limits, BatchLimits):
        raise ValueError("BatchLimits required")
    validate_claim(tx, claim)
    # No watermark: only committed, unassigned exact IDs visible under the gate.
    rows = tx.execute(
        """SELECT e.* FROM public_pending_events e
      WHERE NOT EXISTS(SELECT FROM public_change_requirements r WHERE r.id=e.requirement_id AND r.transaction_id=pg_current_xact_id())
      AND NOT EXISTS(SELECT FROM public_critical_event_slots s WHERE s.event_id=e.event_id AND s.transaction_id=pg_current_xact_id())
      AND NOT EXISTS(SELECT FROM public_archive_items i WHERE i.event_id=e.event_id)
      AND NOT EXISTS(SELECT FROM public_archive_items i JOIN public_archive_batches b USING(batch_id)
        WHERE i.aggregate_type=e.aggregate_type AND i.aggregate_id=e.aggregate_id AND b.state<>'acked')
      ORDER BY e.recorded_at,e.aggregate_type,e.aggregate_id,e.revision,e.event_id LIMIT %s""",
        (limits.max_events,),
    ).fetchall()
    selected = []
    total = 0
    for row in rows:
        size = len(row["canonical_event"]) + 1
        if total + size > limits.max_expanded_bytes:
            break
        # A prior pending predecessor must be included earlier in this same batch.
        if (
            row["revision"] > 1
            and not any(r["event_id"] == row["predecessor_id"] for r in selected)
            and not tx.execute(
                "SELECT 1 FROM public_archive_coverage WHERE event_id=%s",
                (row["predecessor_id"],),
            ).fetchone()
        ):
            continue
        selected.append(row)
        total += size
    if not selected:
        return None
    reservation = reserve_capacity(tx, claim, total * 4 + 65536)
    if reservation is None:
        raise ArchiveBlocked("physical batch capacity unavailable")
    bind_reservation(tx, reservation, job_id=None, scope="public_archive_batches")
    batch_id = uuid4()
    row = tx.execute(
        """INSERT INTO public_archive_batches(batch_id,owner_token,generation,serializer_version,sealed_at,eligible_until,event_count,expanded_bytes)
      SELECT %s,%s,%s,1,t,t+interval '17520 hours',%s,%s FROM (SELECT clock_timestamp() t) clock RETURNING *""",
        (batch_id, claim.owner_token, claim.generation, len(selected), total),
    ).fetchone()
    for position, event in enumerate(selected):
        tx.execute(
            """INSERT INTO public_archive_items(batch_id,position,event_id,aggregate_type,aggregate_id,revision,canonical_event)
         VALUES(%s,%s,%s,%s,%s,%s,%s)""",
            (
                batch_id,
                position,
                event["event_id"],
                event["aggregate_type"],
                event["aggregate_id"],
                event["revision"],
                event["canonical_event"],
            ),
        )
    settle_capacity(tx, reservation)
    return _ref(tx, row, claim)


def seal_batch(batch_ref: BatchRef, serializer_version: int = 1) -> SealedBatch:
    if serializer_version != 1 or batch_ref.serializer_version != 1:
        raise ValueError("unsupported serializer version")
    events = [json.loads(value) for value in batch_ref.event_bytes]
    if tuple(e["event_id"] for e in events) != tuple(
        str(e) for e in batch_ref.ordered_event_ids
    ):
        raise ValueError("membership differs from event bytes")
    canonical, compressed = encode_events(events)
    prefix = f"public/v1/{batch_ref.batch_id}"
    data_key = f"{prefix}/events.jsonl.gz"
    manifest_key = f"{prefix}/manifest.json"
    manifest = canonical_json(
        dict(
            schema_version=1,
            serializer_version=1,
            batch_id=str(batch_ref.batch_id),
            ordered_event_ids=[str(e) for e in batch_ref.ordered_event_ids],
            sealed_at=batch_ref.sealed_at.astimezone(UTC).isoformat(),
            eligible_until=batch_ref.eligible_until.astimezone(UTC).isoformat(),
            prior_batch_id=str(batch_ref.prior_batch_id)
            if batch_ref.prior_batch_id
            else None,
            data_key=data_key,
            manifest_key=manifest_key,
            canonical_hash=_hash(canonical),
            compressed_hash=_hash(compressed),
            event_count=len(events),
            expanded_bytes=len(canonical),
            compressed_bytes=len(compressed),
        )
    )
    if len(manifest) > MAX_MANIFEST:
        raise ValueError("manifest exceeds 1MiB")
    return SealedBatch(
        batch_ref,
        data_key,
        manifest_key,
        _hash(canonical),
        _hash(compressed),
        _hash(manifest),
        len(events),
        len(canonical),
        len(compressed),
        len(manifest),
        canonical,
        compressed,
        manifest,
    )


def _owned(tx, batch_id, claim):
    validate_claim(tx, claim)
    row = tx.execute(
        "SELECT * FROM public_archive_batches WHERE batch_id=%s FOR UPDATE", (batch_id,)
    ).fetchone()
    if not row or (row["owner_token"], row["generation"]) != (
        claim.owner_token,
        claim.generation,
    ):
        raise ArchiveBlocked("stale batch owner")
    if not tx.execute(
        "SELECT clock_timestamp()<%s eligible", (row["eligible_until"],)
    ).fetchone()["eligible"]:
        raise ArchiveBlocked(
            "archive seal expired; explicit replacement authorization required"
        )
    return row


def recover_batch(tx, batch_id, claim) -> BatchRef:
    """Fence an expired/cancelled prior worker, preserving exact membership and seal."""
    validate_claim(tx, claim)
    row = tx.execute(
        "SELECT * FROM public_archive_batches WHERE batch_id=%s FOR UPDATE", (batch_id,)
    ).fetchone()
    if not row or row["state"] == "acked":
        raise ArchiveBlocked("batch unavailable")
    if (row["owner_token"], row["generation"]) != (claim.owner_token, claim.generation):
        if tx.execute(
            "SELECT 1 FROM lifecycle_claims WHERE owner_token=%s AND generation=%s AND state='active' AND lease_until>clock_timestamp()",
            (row["owner_token"], row["generation"]),
        ).fetchone():
            raise ArchiveBlocked("batch still owned")
        tx.execute(
            "UPDATE public_archive_batches SET owner_token=%s,generation=%s WHERE batch_id=%s",
            (claim.owner_token, claim.generation, batch_id),
        )
    _owned(tx, batch_id, claim)
    return _ref(tx, row, claim)


def persist_seal(tx, seal: SealedBatch) -> None:
    row = _owned(tx, seal.batch.batch_id, seal.batch.claim)
    ref = _ref(tx, row, seal.batch.claim)
    if ref != seal.batch:
        raise ArchiveBlocked("persisted membership differs from seal")
    # Validate already-serialized bytes and hashes; never compress under the gate.
    if seal.canonical_data != b"".join(e + b"\n" for e in ref.event_bytes) or any(
        _hash(data) != digest
        for data, digest in [
            (seal.canonical_data, seal.canonical_hash),
            (seal.compressed_data, seal.compressed_hash),
            (seal.manifest_data, seal.manifest_hash),
        ]
    ):
        raise ValueError("seal bytes or hashes differ")
    if (
        seal.event_count,
        seal.expanded_bytes,
        seal.compressed_bytes,
        seal.manifest_bytes,
    ) != (
        len(ref.ordered_event_ids),
        len(seal.canonical_data),
        len(seal.compressed_data),
        len(seal.manifest_data),
    ):
        raise ValueError("seal counts or sizes differ")
    prefix = f"public/v1/{ref.batch_id}"
    if (seal.data_key, seal.manifest_key) != (
        f"{prefix}/events.jsonl.gz",
        f"{prefix}/manifest.json",
    ):
        raise ValueError("seal object keys differ")
    manifest = json.loads(seal.manifest_data)
    for key in (
        "data_key",
        "manifest_key",
        "canonical_hash",
        "compressed_hash",
        "event_count",
        "expanded_bytes",
        "compressed_bytes",
    ):
        if manifest.get(key) != getattr(seal, key):
            raise ValueError("manifest differs from seal")
    if (
        manifest.get("ordered_event_ids") != [str(e) for e in ref.ordered_event_ids]
        or manifest.get("sealed_at") != ref.sealed_at.astimezone(UTC).isoformat()
        or manifest.get("eligible_until")
        != ref.eligible_until.astimezone(UTC).isoformat()
    ):
        raise ValueError("manifest identity or horizon differs")
    values = {
        k: getattr(seal, k)
        for k in (
            "data_key",
            "manifest_key",
            "canonical_hash",
            "compressed_hash",
            "manifest_hash",
            "event_count",
            "expanded_bytes",
            "compressed_bytes",
            "manifest_bytes",
        )
    }
    if row["state"] != "claimed":
        if any(row[k] != v for k, v in values.items()):
            raise ArchiveBlocked("immutable seal differs")
        return
    reservation = reserve_capacity(tx, seal.batch.claim, 65536)
    if reservation is None:
        raise ArchiveBlocked("physical seal capacity unavailable")
    bind_reservation(tx, reservation, job_id=None, scope="public_archive_batches")
    tx.execute(
        """UPDATE public_archive_batches SET state='sealed',data_key=%(data_key)s,manifest_key=%(manifest_key)s,
      canonical_hash=%(canonical_hash)s,compressed_hash=%(compressed_hash)s,manifest_hash=%(manifest_hash)s,
      compressed_bytes=%(compressed_bytes)s,manifest_bytes=%(manifest_bytes)s WHERE batch_id=%(batch_id)s""",
        dict(values, batch_id=ref.batch_id),
    )

    settle_capacity(tx, reservation)


def ack_batch(tx, verified_batch: VerifiedBatch, claim) -> AckResult:
    if not isinstance(verified_batch, VerifiedBatch):
        raise ValueError("VerifiedBatch required")
    seal = verified_batch.seal
    row = _owned(tx, seal.batch.batch_id, claim)
    current = _ref(tx, row, claim)
    if replace(seal.batch, claim=claim) != current:
        raise ArchiveBlocked("ack membership differs")
    for key in (
        "data_key",
        "manifest_key",
        "canonical_hash",
        "compressed_hash",
        "manifest_hash",
        "event_count",
        "expanded_bytes",
        "compressed_bytes",
        "manifest_bytes",
    ):
        if row[key] != getattr(seal, key):
            raise ArchiveBlocked("ack seal differs")
    if row["state"] not in {"sealed", "acked"}:
        raise ArchiveBlocked("batch is not sealed")
    for receipt, key, digest, size in [
        (
            verified_batch.data_receipt,
            seal.data_key,
            seal.compressed_hash,
            seal.compressed_bytes,
        ),
        (
            verified_batch.manifest_receipt,
            seal.manifest_key,
            seal.manifest_hash,
            seal.manifest_bytes,
        ),
    ]:
        if (
            (receipt.key, receipt.sha256, receipt.byte_count) != (key, digest, size)
            or not isinstance(receipt.receipt, str)
            or not 1 <= len(receipt.receipt) <= 2048
        ):
            raise ValueError("exact data and manifest verification receipts required")
    if tx.execute(
        """SELECT 1 FROM public_archive_items i JOIN public_archive_suppressions s USING(aggregate_type,aggregate_id)
        WHERE i.batch_id=%s LIMIT 1""",
        (current.batch_id,),
    ).fetchone():
        raise ArchiveBlocked("batch contains suppressed aggregate")
    items = tx.execute(
        "SELECT * FROM public_archive_items WHERE batch_id=%s ORDER BY position",
        (current.batch_id,),
    ).fetchall()
    markers = tuple(
        (i["aggregate_type"], i["aggregate_id"], i["revision"]) for i in items
    )
    if row["state"] == "acked":
        return AckResult(current.ordered_event_ids, markers)
    reservation = reserve_capacity(tx, claim, 65536 + len(items) * 16384)
    if reservation is None:
        raise ArchiveBlocked("physical exact acknowledgement capacity unavailable")
    bind_reservation(tx, reservation, job_id=None, scope="public_archive_coverage")
    tx.execute(
        "INSERT INTO public_archive_receipts(batch_id,data_receipt,manifest_receipt) VALUES(%s,%s,%s)",
        (
            current.batch_id,
            Jsonb(asdict(verified_batch.data_receipt)),
            Jsonb(asdict(verified_batch.manifest_receipt)),
        ),
    )
    for item in items:
        tx.execute(
            "INSERT INTO public_archive_coverage(aggregate_type,aggregate_id,revision,event_id,batch_id) VALUES(%s,%s,%s,%s,%s)",
            (
                item["aggregate_type"],
                item["aggregate_id"],
                item["revision"],
                item["event_id"],
                current.batch_id,
            ),
        )
        if item["aggregate_type"] == "job_versions":
            body = json.loads(bytes(item["canonical_event"]))["body"]
            tx.execute(
                """INSERT INTO public_archive_version_coverage(version_id,source_listing_id,version_revision,content_hash,event_id,batch_id)
             VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
                (
                    body["id"],
                    body["source_listing_id"],
                    body["revision"],
                    body["content_hash"],
                    item["event_id"],
                    current.batch_id,
                ),
            )
    # Exact IDs only, even when a lower sequence commits after selection.
    reqs = tx.execute(
        "DELETE FROM public_outbox WHERE event_id=ANY(%s) RETURNING requirement_id",
        (list(current.ordered_event_ids),),
    ).fetchall()
    slots = tx.execute(
        "UPDATE public_critical_event_slots SET state='acked' WHERE state='pending' AND event_id=ANY(%s) RETURNING event_id",
        (list(current.ordered_event_ids),),
    ).fetchall()
    if len(reqs) + len(slots) != len(items):
        raise ArchiveBlocked("exact pending acknowledgement membership missing")
    tx.execute(
        "DELETE FROM public_change_requirements WHERE id=ANY(%s)",
        ([r["requirement_id"] for r in reqs],),
    )
    tx.execute(
        "UPDATE public_archive_batches SET state='acked',acked_at=clock_timestamp() WHERE batch_id=%s",
        (current.batch_id,),
    )
    settle_capacity(tx, reservation)
    return AckResult(current.ordered_event_ids, markers)


def compact_terminal_batches(tx, claim, *, limit=2000) -> int:
    """Seven-day terminal byte compaction retains exact IDs, receipts and fences."""
    if type(limit) is not int or not 1 <= limit <= 2000:
        raise ValueError("terminal compaction limit must be 1..2000")
    validate_claim(tx, claim)
    rows = tx.execute(
        """UPDATE public_archive_items SET canonical_event=''::bytea WHERE (batch_id,position) IN
      (SELECT i.batch_id,i.position FROM public_archive_items i JOIN public_archive_batches b USING(batch_id)
       WHERE b.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days' AND octet_length(i.canonical_event)>0
       ORDER BY b.acked_at,i.position LIMIT %s) RETURNING event_id""",
        (limit,),
    ).fetchall()
    slots = tx.execute(
        """UPDATE public_critical_event_slots SET body='{}'::jsonb,canonical_event=''::bytea WHERE slot IN
      (SELECT s.slot FROM public_critical_event_slots s JOIN public_archive_coverage c USING(event_id)
       JOIN public_archive_batches b USING(batch_id) WHERE s.state='acked' AND b.acked_at<=clock_timestamp()-interval '7 days'
       AND octet_length(s.canonical_event)>0 ORDER BY s.slot LIMIT %s) RETURNING slot""",
        (limit - len(rows),),
    ).fetchall()
    return len(rows) + len(slots)
