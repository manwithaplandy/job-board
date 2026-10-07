"""Public transaction pairing; no transport, credentials, or activation side effects."""

from datetime import UTC
from psycopg import sql
from psycopg.types.json import Jsonb
from job_discovery.lifecycle.claims import validate_claim
from job_discovery.lifecycle.config import read_control
from job_discovery.lifecycle.capacity import (
    reserve_capacity,
    bind_reservation,
    settle_capacity,
)
from .codec import canonical_json
from .schema import AggregateType, ChangeKind, PublicChange, event_id, validate_change
from .types import EventRef

WARNING_BYTES, WARNING_EVENTS, WARNING_AGE = 64 * 1024**2, 50000, 900
ORDINARY_BYTES, ORDINARY_EVENTS = 112 * 1024**2, 87500
HARD_BYTES, HARD_EVENTS = 128 * 1024**2, 100000
CRITICAL_BYTES, CRITICAL_EVENTS = 16 * 1024**2, 12500


class ArchiveBlocked(RuntimeError):
    pass


def budget_allows(count: int, size: int, next_size: int, critical: bool) -> bool:
    return count + 1 <= (
        HARD_EVENTS if critical else ORDINARY_EVENTS
    ) and size + next_size <= (HARD_BYTES if critical else ORDINARY_BYTES)


def outbox_health(conn) -> dict:
    row = conn.execute("""SELECT count(*) events,COALESCE(sum(octet_length(canonical_event)),0) bytes,
      COALESCE(extract(epoch FROM clock_timestamp()-min(recorded_at)),0) age_seconds FROM public_pending_events""").fetchone()
    row["warning"] = (
        row["events"] >= WARNING_EVENTS
        or row["bytes"] >= WARNING_BYTES
        or row["age_seconds"] >= WARNING_AGE
    )
    row["ordinary_paused"] = (
        row["events"] >= ORDINARY_EVENTS or row["bytes"] >= ORDINARY_BYTES
    )
    return row


def _envelope(row):
    eid = event_id(row["aggregate_type"], row["aggregate_id"], row["revision"])
    previous = (
        event_id(row["aggregate_type"], row["aggregate_id"], row["revision"] - 1)
        if row["revision"] > 1
        else None
    )
    return dict(
        event_id=str(eid),
        aggregate_type=row["aggregate_type"],
        aggregate_id=row["aggregate_id"],
        revision=row["revision"],
        predecessor_id=str(previous) if previous else None,
        kind=row["kind"],
        body=row["body"],
        occurred_at=row["occurred_at"].astimezone(UTC).isoformat(),
        schema_version=1,
    )


def record_public_change(tx, change: PublicChange, claim) -> EventRef:
    validate_change(change)
    validate_claim(tx, claim)
    ctl = read_control(tx)
    if ctl.archive_stage != "active":
        raise ArchiveBlocked("archive producer inactive or paused")
    row = tx.execute(
        """SELECT r.* FROM public_change_requirements r
      WHERE transaction_id=pg_current_xact_id() AND aggregate_type=%s AND aggregate_id=%s
       AND kind=%s AND body=%s AND occurred_at=%s
       AND NOT EXISTS(SELECT FROM public_outbox e WHERE e.requirement_id=r.id) ORDER BY revision LIMIT 1""",
        (
            change.aggregate_type,
            change.aggregate_id,
            change.kind,
            Jsonb(change.body),
            change.occurred_at,
        ),
    ).fetchone()
    if not row:
        raise ValueError("no exact unpaired public mutation in this transaction")
    envelope = _envelope(row)
    encoded = canonical_json(envelope)
    health = outbox_health(tx)
    critical = change.kind in {ChangeKind.CLOSED, ChangeKind.REOPENED}
    if not budget_allows(health["events"], health["bytes"], len(encoded), critical):
        raise ArchiveBlocked("public outbox budget exhausted; mutation must roll back")
    reservation = reserve_capacity(
        tx, claim, max(65536, len(encoded) * 16 + 32768), critical=critical
    )
    if reservation is None:
        raise ArchiveBlocked(
            "physical archive capacity unavailable; mutation must roll back"
        )
    bind_reservation(tx, reservation, job_id=None, scope="public_outbox")
    tx.execute(
        """INSERT INTO public_outbox(event_id,requirement_id,aggregate_type,aggregate_id,revision,
       predecessor_id,kind,body,occurred_at,canonical_event,body_bytes)
       VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (
            envelope["event_id"],
            row["id"],
            change.aggregate_type,
            change.aggregate_id,
            row["revision"],
            envelope["predecessor_id"],
            change.kind,
            Jsonb(change.body),
            change.occurred_at,
            encoded,
            len(canonical_json(change.body)),
        ),
    )
    settle_capacity(tx, reservation)
    return EventRef(
        event_id(change.aggregate_type, change.aggregate_id, row["revision"]),
        change.aggregate_type,
        change.aggregate_id,
        row["revision"],
    )


def flush_public_changes(tx, claim) -> tuple[EventRef, ...]:
    if not read_control(tx).archive_ever_activated:
        return ()
    rows = tx.execute("""SELECT r.* FROM public_change_requirements r WHERE transaction_id=pg_current_xact_id()
      AND NOT EXISTS(SELECT FROM public_outbox e WHERE e.requirement_id=r.id) ORDER BY r.id""").fetchall()
    return tuple(
        record_public_change(
            tx,
            PublicChange(
                AggregateType(r["aggregate_type"]),
                r["aggregate_id"],
                ChangeKind(r["kind"]),
                r["body"],
                r["occurred_at"],
            ),
            claim,
        )
        for r in rows
    )


def baseline_batch(
    tx, aggregate_type: str, claim, *, limit: int = 100
) -> tuple[EventRef, ...]:
    """Snapshot current rows only; persisted head existence is the bounded checkpoint."""
    table = AggregateType(aggregate_type)
    if type(limit) is not int or not 1 <= limit <= 100:
        raise ValueError("baseline limit must be 1..100")
    validate_claim(tx, claim)
    if read_control(tx).archive_stage != "active":
        raise ArchiveBlocked("baseline requires validated active producer")
    identity = "raw" if table == AggregateType.LOCATION else "id"
    rows = tx.execute(
        sql.SQL("""SELECT t.{identity}::text aid,lifecycle_private.public_projection(%s,to_jsonb(t)) body
       FROM {table} t WHERE NOT EXISTS(SELECT FROM public_archive_heads h WHERE h.aggregate_type=%s
       AND h.aggregate_id=t.{identity}::text) ORDER BY t.{identity} LIMIT %s""").format(
            identity=sql.Identifier(identity), table=sql.Identifier(table)
        ),
        (table, table, limit),
    ).fetchall()
    for row in rows:
        tx.execute(
            "INSERT INTO public_archive_heads VALUES(%s,%s,1)", (table, row["aid"])
        )
        tx.execute(
            """INSERT INTO public_change_requirements(aggregate_type,aggregate_id,revision,kind,body)
          VALUES(%s,%s,1,'baseline',%s)""",
            (table, row["aid"], Jsonb(row["body"])),
        )
    return flush_public_changes(tx, claim)


def event_rows(tx, event_ids):
    rows = tx.execute(
        "SELECT * FROM public_outbox WHERE event_id=ANY(%s)", (list(event_ids),)
    ).fetchall()
    by_id = {r["event_id"]: r for r in rows}
    if set(by_id) != set(event_ids):
        raise ArchiveBlocked("exact pending membership missing")
    return [by_id[eid] for eid in event_ids]
