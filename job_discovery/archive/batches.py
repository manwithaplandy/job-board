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


def _processing_capacity(tx, event_bytes, *, manifest_bytes=None, receipt_bytes=None):
    """Spend only the selected immutable events' admission-time escrow.

    The bound admits singleton batches, so max_events=1 always makes logical
    progress. Larger batches share the same bounded header/seal/ack allowance.
    Physical reservations remain separate and may still defer any phase.
    """
    count = len(event_bytes)
    canonical_bytes = sum(len(value) for value in event_bytes)
    manifest_bound = 8192 * count + 2 * canonical_bytes
    if manifest_bytes is not None and manifest_bytes > manifest_bound:
        raise ArchiveBlocked("manifest exceeds reserved processing workspace")
    if receipt_bytes is not None and 2 * receipt_bytes + 16384 * count > 98304 * count:
        raise ArchiveBlocked("acknowledgement exceeds reserved processing workspace")
    reserved = tx.execute(
        "SELECT sum(lifecycle_private.archive_processing_charge(value)) n FROM unnest(%s::bytea[]) value",
        (list(event_bytes),),
    ).fetchone()["n"]
    required = (
        2 * canonical_bytes
        + 1024 * count
        + 8192
        + 4096
        + 2 * (manifest_bytes if manifest_bytes is not None else manifest_bound)
        + 98304 * count
    )
    if required > reserved:
        raise ArchiveBlocked("batch exceeds reserved processing workspace")


def _keys(ref, compressed_hash):
    import re

    if (
        not ref.object_prefix
        or not re.fullmatch(r"[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*", ref.object_prefix)
        or len(ref.object_prefix) > 256
    ):
        raise ValueError("validated service object prefix required")
    stem = f"{ref.object_prefix}/ingestion_date={ref.sealed_at.astimezone(UTC).date().isoformat()}/{ref.batch_id}-{compressed_hash}"
    return stem + ".jsonl.gz", stem + ".manifest.json"


def _manifest(
    ref,
    data_key,
    manifest_key,
    canonical_hash,
    compressed_hash,
    expanded_bytes,
    compressed_bytes,
):
    ids = [str(e) for e in ref.ordered_event_ids]
    ranges = {}
    for raw in ref.event_bytes:
        e = json.loads(raw)
        key = (e["aggregate_type"], e["aggregate_id"])
        revisions = ranges.setdefault(key, [])
        revisions.append(e["revision"])
    return dict(
        schema_version=1,
        serializer_version=ref.serializer_version,
        batch_id=str(ref.batch_id),
        object_prefix=ref.object_prefix,
        ingestion_date=ref.sealed_at.astimezone(UTC).date().isoformat(),
        ordered_event_ids=ids,
        event_ids_sha256=_hash(canonical_json(ids)),
        aggregate_revision_ranges=[
            dict(
                aggregate_type=t,
                aggregate_id=i,
                first_revision=min(v),
                last_revision=max(v),
            )
            for (t, i), v in sorted(ranges.items())
        ],
        sealed_at=ref.sealed_at.astimezone(UTC).isoformat(),
        eligible_until=ref.eligible_until.astimezone(UTC).isoformat(),
        prior_batch_id=str(ref.prior_batch_id) if ref.prior_batch_id else None,
        data_key=data_key,
        manifest_key=manifest_key,
        canonical_hash=canonical_hash,
        compressed_hash=compressed_hash,
        event_count=len(ids),
        expanded_bytes=expanded_bytes,
        compressed_bytes=compressed_bytes,
    )


def _ref(tx, row, claim):
    if (
        row["schema_version"] != 1
        or row["ingestion_date"] != row["sealed_at"].astimezone(UTC).date()
    ):
        raise ArchiveBlocked("persisted schema or UTC ingestion identity differs")
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
        row["object_prefix"],
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
    selected_ids = set()
    covered = {
        r["event_id"]
        for r in tx.execute(
            "SELECT event_id FROM public_archive_coverage WHERE event_id=ANY(%s)",
            ([r["predecessor_id"] for r in rows if r["predecessor_id"]],),
        ).fetchall()
    }
    total = 0
    for row in rows:
        size = len(row["canonical_event"]) + 1
        if total + size > limits.max_expanded_bytes:
            break
        # Reserve a manifest bound before selection too. This conservative bound
        # fits even singleton processing and avoids selecting an unsealable batch.
        if 8192 * (len(selected) + 1) + 2 * (total + size) > MAX_MANIFEST:
            break
        # A prior pending predecessor must be included earlier in this same batch.
        if (
            row["revision"] > 1
            and row["predecessor_id"] not in selected_ids
            and row["predecessor_id"] not in covered
        ):
            continue
        selected.append(row)
        selected_ids.add(row["event_id"])
        total += size
    if not selected:
        return None
    destination = tx.execute(
        "SELECT object_prefix FROM public_archive_destination WHERE singleton AND validated_at<=clock_timestamp()"
    ).fetchone()
    if not destination:
        raise ArchiveBlocked("archive destination prefix not validated")
    _processing_capacity(tx, [bytes(r["canonical_event"]) for r in selected])
    reservation = reserve_capacity(tx, claim, total * 4 + 65536)
    if reservation is None:
        raise ArchiveBlocked("physical batch capacity unavailable")
    bind_reservation(tx, reservation, job_id=None, scope="public_archive_batches")
    batch_id = uuid4()
    row = tx.execute(
        """INSERT INTO public_archive_batches(batch_id,owner_token,generation,serializer_version,sealed_at,eligible_until,event_count,expanded_bytes,object_prefix,ingestion_date)
      SELECT %s,%s,%s,1,t,t+interval '17520 hours',%s,%s,%s,(t AT TIME ZONE 'UTC')::date FROM (SELECT clock_timestamp() t) clock RETURNING *""",
        (
            batch_id,
            claim.owner_token,
            claim.generation,
            len(selected),
            total,
            destination["object_prefix"],
        ),
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
    data_key, manifest_key = _keys(batch_ref, _hash(compressed))
    manifest = canonical_json(
        _manifest(
            batch_ref,
            data_key,
            manifest_key,
            _hash(canonical),
            _hash(compressed),
            len(canonical),
            len(compressed),
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
    if (seal.data_key, seal.manifest_key) != _keys(ref, seal.compressed_hash):
        raise ValueError("seal object keys differ")
    manifest = _manifest(
        ref,
        seal.data_key,
        seal.manifest_key,
        seal.canonical_hash,
        seal.compressed_hash,
        seal.expanded_bytes,
        seal.compressed_bytes,
    )
    if seal.manifest_data != canonical_json(manifest):
        raise ValueError("complete manifest differs from immutable batch identity")
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
    values.update(
        event_ids_sha256=manifest["event_ids_sha256"],
        aggregate_revision_ranges=manifest["aggregate_revision_ranges"],
    )
    if row["state"] != "claimed":
        if any(row[k] != v for k, v in values.items()):
            raise ArchiveBlocked("immutable seal differs")
        return
    _processing_capacity(tx, ref.event_bytes, manifest_bytes=seal.manifest_bytes)
    reservation = reserve_capacity(
        tx, seal.batch.claim, 65536 + seal.manifest_bytes * 4
    )
    if reservation is None:
        raise ArchiveBlocked("physical seal capacity unavailable")
    bind_reservation(tx, reservation, job_id=None, scope="public_archive_batches")
    tx.execute(
        """UPDATE public_archive_batches SET state='sealed',event_ids_sha256=%(event_ids_sha256)s,aggregate_revision_ranges=%(aggregate_revision_ranges)s,data_key=%(data_key)s,manifest_key=%(manifest_key)s,
      canonical_hash=%(canonical_hash)s,compressed_hash=%(compressed_hash)s,manifest_hash=%(manifest_hash)s,
      compressed_bytes=%(compressed_bytes)s,manifest_bytes=%(manifest_bytes)s WHERE batch_id=%(batch_id)s""",
        dict(
            values,
            aggregate_revision_ranges=Jsonb(values["aggregate_revision_ranges"]),
            batch_id=ref.batch_id,
        ),
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
    receipt_bytes = tx.execute(
        "SELECT octet_length(%s::jsonb::text)+octet_length(%s::jsonb::text) n",
        (
            Jsonb(asdict(verified_batch.data_receipt)),
            Jsonb(asdict(verified_batch.manifest_receipt)),
        ),
    ).fetchone()["n"]
    _processing_capacity(
        tx,
        current.event_bytes,
        manifest_bytes=seal.manifest_bytes,
        receipt_bytes=receipt_bytes,
    )
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
    tx.execute(
        """INSERT INTO public_archive_batch_markers(batch_id,owner_token,generation,event_ids_sha256,manifest_hash)
      VALUES(%s,%s,%s,%s,%s)""",
        (
            current.batch_id,
            claim.owner_token,
            claim.generation,
            row["event_ids_sha256"],
            row["manifest_hash"],
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
    """Bounded seven-day retirement; compact exact coverage and fences survive."""
    if type(limit) is not int or not 1 <= limit <= 2000:
        raise ValueError("terminal compaction limit must be 1..2000")
    validate_claim(tx, claim)
    slots = tx.execute(
        """UPDATE public_critical_event_slots SET body='{}'::jsonb,canonical_event=''::bytea WHERE slot IN
     (SELECT s.slot FROM public_critical_event_slots s JOIN public_archive_coverage c USING(event_id)
      JOIN public_archive_batch_markers m USING(batch_id) WHERE s.state='acked' AND m.acked_at<=clock_timestamp()-interval '7 days'
      AND octet_length(s.canonical_event)>0 ORDER BY s.slot LIMIT %s) RETURNING slot""",
        (limit,),
    ).fetchall()
    count = len(slots)
    for table, key, extra in [
        ("public_archive_items", "event_id", ""),
        (
            "public_archive_receipts",
            "batch_id",
            "AND NOT EXISTS(SELECT FROM public_archive_items i WHERE i.batch_id=t.batch_id)",
        ),
        (
            "public_archive_batches",
            "batch_id",
            "AND t.state='acked' AND NOT EXISTS(SELECT FROM public_archive_items i WHERE i.batch_id=t.batch_id) AND NOT EXISTS(SELECT FROM public_archive_receipts r WHERE r.batch_id=t.batch_id)",
        ),
    ]:
        # Identifiers are the fixed service allowlist above, never external input.
        rows = tx.execute(
            f"""DELETE FROM {table} WHERE {key} IN
          (SELECT t.{key} FROM {table} t JOIN public_archive_batch_markers m USING(batch_id)
           WHERE m.acked_at<=clock_timestamp()-interval '7 days' {extra}
           ORDER BY m.acked_at,t.{key} LIMIT %s) RETURNING {key}""",
            (limit - count,),
        ).fetchall()
        count += len(rows)
    return count
