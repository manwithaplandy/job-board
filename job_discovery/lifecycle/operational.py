"""Bounded preallocated verification lane; physical MVCC reuse is not guaranteed.

Provision only with ordinary positive capacity reservations. Above the guard,
reuse existing source claims, listing marks, a per-source transaction receipt and
fixed critical event slots. New identities and payloads are never admitted here.
"""

from time import monotonic
import logging
import psycopg

from .claims import claim_work, cancel_claim
from .capacity import reserve_capacity, bind_reservation, settle_capacity
from .locks import enter_gate, lock_jobs

log = logging.getLogger(__name__)


class OperationalDeferred(RuntimeError):
    pass


def provision(conn, source_id, claim, *, limit=100, critical_slots=16):
    if (
        type(limit) is not int
        or not 1 <= limit <= 100
        or type(critical_slots) is not int
        or not 0 <= critical_slots <= 100
    ):
        raise ValueError("preallocation chunk is limited to 100 listings/slots")
    reservation = reserve_capacity(conn, claim, 65536 * (limit + critical_slots + 3))
    if reservation is None:
        return False
    bind_reservation(
        conn, reservation, job_id=None, scope="lifecycle_operational_sources"
    )
    conn.execute(
        "INSERT INTO lifecycle_operational_sources(source_id) VALUES(%s) ON CONFLICT DO NOTHING",
        (source_id,),
    )
    conn.execute(
        "INSERT INTO lifecycle_operational_receipts(source_id) VALUES(%s) ON CONFLICT DO NOTHING",
        (source_id,),
    )
    conn.execute(
        """INSERT INTO lifecycle_operational_listings(listing_id,source_id)
      SELECT id,source_account_id FROM source_listings l WHERE source_account_id=%s
      AND NOT EXISTS(SELECT FROM lifecycle_operational_listings p WHERE p.listing_id=l.id)
      ORDER BY id LIMIT %s ON CONFLICT DO NOTHING""",
        (source_id, limit),
    )
    # Slots are global. Never recycle pending/acked history or infer delete credit.
    conn.execute(
        """INSERT INTO public_critical_event_slots(slot)
      SELECT n FROM generate_series(1,12500) n WHERE NOT EXISTS(SELECT FROM public_critical_event_slots s WHERE s.slot=n)
      ORDER BY n LIMIT %s""",
        (critical_slots,),
    )
    settle_capacity(conn, reservation)
    return True


def _receipt(conn, source_id, claim):
    enter_gate(conn)
    if conn.execute(
        "SELECT 1 FROM lifecycle_operational_receipts WHERE transaction_id=pg_current_xact_id() AND backend_pid=pg_backend_pid() AND source_id<>%s",
        (source_id,),
    ).fetchone():
        raise OperationalDeferred(
            "one source operational receipt per transaction required"
        )
    valid = conn.execute(
        """SELECT 1 FROM lifecycle_claims WHERE kind='source' AND work_id=%s AND owner_token=%s
       AND generation=%s AND generation>replay_floor AND state='active' AND lease_until>clock_timestamp()
       AND invoking_role=current_user AND subject_id IS NOT DISTINCT FROM app_user_id() FOR UPDATE""",
        (str(source_id), claim.owner_token, claim.generation),
    ).fetchone()
    if not valid:
        raise OperationalDeferred("existing source claim unavailable or fenced")
    conn.execute(
        "UPDATE lifecycle_claims SET lease_until=clock_timestamp()+interval '180 seconds' WHERE kind='source' AND work_id=%s",
        (str(source_id),),
    )
    row = conn.execute(
        """UPDATE lifecycle_operational_receipts SET backend_pid=pg_backend_pid(),transaction_id=pg_current_xact_id(),
      owner_token=%s,generation=%s,invoking_role=current_user,subject_id=app_user_id(),row_count=CASE WHEN transaction_id=pg_current_xact_id() THEN row_count ELSE 0 END WHERE source_id=%s RETURNING source_id""",
        (claim.owner_token, claim.generation, source_id),
    ).fetchone()
    if not row:
        raise OperationalDeferred("source receipt not preallocated")


def start(conn, source_id, claim):
    _receipt(conn, source_id, claim)
    if conn.execute(
        """SELECT 1 FROM source_listings l WHERE source_account_id=%s AND NOT EXISTS(
       SELECT FROM lifecycle_operational_listings p WHERE p.listing_id=l.id) LIMIT 1""",
        (source_id,),
    ).fetchone():
        raise OperationalDeferred("full existing membership not preallocated")
    old = conn.execute(
        "SELECT * FROM lifecycle_operational_sources WHERE source_id=%s FOR UPDATE",
        (source_id,),
    ).fetchone()
    if old is None:
        raise OperationalDeferred("source operational state not preallocated")
    conn.execute(
        "UPDATE lifecycle_operational_sources SET last_turn_at=clock_timestamp() WHERE source_id=%s",
        (source_id,),
    )
    if old["status"] == "complete" and not old["reconciled"]:
        return old["sequence"], True
    row = conn.execute(
        """UPDATE lifecycle_operational_sources SET sequence=sequence+1,status='running',started_at=clock_timestamp(),
       completed_at=NULL,cursor=NULL,reconciled=false,members_seen=0 WHERE source_id=%s RETURNING sequence""",
        (source_id,),
    ).fetchone()
    conn.execute(
        "UPDATE source_accounts SET last_attempt_at=clock_timestamp(),last_outcome='attempting' WHERE id=%s",
        (source_id,),
    )
    return row["sequence"], False


def _state(conn, source_id, sequence):
    row = conn.execute(
        "SELECT * FROM lifecycle_operational_sources WHERE source_id=%s AND sequence=%s",
        (source_id, sequence),
    ).fetchone()
    if not row:
        raise OperationalDeferred("operational sequence replaced")
    return row


def _flush(conn):
    from job_discovery.archive.outbox import budget_allows, outbox_health, _envelope
    from job_discovery.archive.codec import canonical_json
    from job_discovery.archive.schema import (
        PublicChange,
        AggregateType,
        ChangeKind,
        validate_change,
    )

    rows = conn.execute(
        "SELECT * FROM public_critical_event_slots WHERE transaction_id=pg_current_xact_id() AND state='allocated' ORDER BY slot"
    ).fetchall()
    for row in rows:
        validate_change(
            PublicChange(
                AggregateType(row["aggregate_type"]),
                row["aggregate_id"],
                ChangeKind(row["kind"]),
                row["body"],
                row["occurred_at"],
            )
        )
        envelope = _envelope(row)
        encoded = canonical_json(envelope)
        health = outbox_health(conn)
        if not budget_allows(health["events"], health["bytes"], len(encoded), True):
            raise OperationalDeferred("critical outbox budget exhausted")
        conn.execute(
            """UPDATE public_critical_event_slots SET state='pending',event_id=%s,predecessor_id=%s,
          canonical_event=%s,padding=''::bytea WHERE slot=%s""",
            (envelope["event_id"], envelope["predecessor_id"], encoded, row["slot"]),
        )


def sightings(conn, source_id, sequence, claim, observations):
    if len(observations) > 100:
        raise ValueError("operational sighting chunk exceeds 100")
    enter_gate(conn)
    if _state(conn, source_id, sequence)["status"] != "running":
        raise OperationalDeferred("operational enumeration not running")
    rows = conn.execute(
        """SELECT l.*,p.seen_sequence FROM source_listings l JOIN lifecycle_operational_listings p ON p.listing_id=l.id
      WHERE l.source_account_id=%s AND l.external_id=ANY(%s)""",
        (source_id, [o[0] for o in observations]),
    ).fetchall()
    lock_jobs(conn, [r["job_id"] for r in rows])
    _receipt(conn, source_id, claim)
    by_id = {r["external_id"]: r for r in rows}
    for external_id, kind in observations:
        if kind not in {"seen", "unlisted", "removed", "expired"}:
            continue
        row = by_id.get(external_id)
        if not row or row["seen_sequence"] >= sequence:
            continue
        conn.execute(
            """UPDATE lifecycle_operational_listings SET seen_sequence=%s,seen_at=clock_timestamp(),seen_kind=%s,
          miss_count=0,first_miss_at=NULL WHERE listing_id=%s""",
            (sequence, kind, row["id"]),
        )
        removed = kind in {"removed", "expired"}
        conn.execute(
            """UPDATE source_listings SET successful_last_observed_at=clock_timestamp(),
          successful_sighting_count=successful_sighting_count+%s,source_availability=CASE WHEN %s THEN 'closed'
          WHEN source_availability='closed' THEN 'open' ELSE source_availability END,
          consecutive_complete_misses=0,first_complete_miss_at=NULL WHERE id=%s""",
            (0 if removed else 1, removed, row["id"]),
        )
        conn.execute(
            "UPDATE jobs SET closed_at=CASE WHEN %s THEN COALESCE(closed_at,clock_timestamp()) ELSE NULL END WHERE id=%s",
            (removed, row["job_id"]),
        )
        _flush(conn)
        row["seen_sequence"] = sequence
    conn.execute(
        "UPDATE lifecycle_operational_sources SET members_seen=members_seen+%s WHERE source_id=%s",
        (len(observations), source_id),
    )


def complete(conn, source_id, sequence, claim, *, successful, failed=False):
    _receipt(conn, source_id, claim)
    state = _state(conn, source_id, sequence)
    if state["status"] != "running":
        raise OperationalDeferred("operational enumeration already terminal")
    open_count = conn.execute(
        """SELECT count(*) n FROM source_listings l JOIN jobs j ON j.id=l.job_id
      WHERE l.source_account_id=%s AND j.closed_at IS NULL""",
        (source_id,),
    ).fetchone()["n"]
    suspicious = state["members_seen"] == 0 and open_count > 20
    status = (
        "complete"
        if successful and not suspicious
        else ("failed" if failed else "partial")
    )
    conn.execute(
        """UPDATE lifecycle_operational_sources SET status=%s,completed_at=clock_timestamp(),reconciled=%s WHERE source_id=%s""",
        (status, status != "complete", source_id),
    )
    conn.execute(
        """UPDATE source_accounts SET last_outcome=%s,last_complete_success_at=CASE WHEN %s THEN clock_timestamp() ELSE last_complete_success_at END,
      failure_streak=CASE WHEN %s THEN 0 ELSE failure_streak+1 END,suspicious_empty_streak=CASE WHEN %s THEN suspicious_empty_streak+1 ELSE 0 END,
      next_due_at=(date_trunc('day',last_attempt_at AT TIME ZONE 'UTC')+interval '24 hours' * CASE WHEN exclusion_state='failure_disabled' AND NOT %s
       THEN LEAST(7,power(2,LEAST(failure_streak,3))) ELSE 1 END) AT TIME ZONE 'UTC' WHERE id=%s""",
        (
            "suspicious_empty" if suspicious else status,
            status == "complete",
            status == "complete",
            suspicious,
            status == "complete",
            source_id,
        ),
    )
    return status


def reconcile(conn, source_id, sequence, claim, *, limit=100):
    if type(limit) is not int or not 1 <= limit <= 100:
        raise ValueError("operational reconcile chunk exceeds 100")
    enter_gate(conn)
    state = _state(conn, source_id, sequence)
    if state["status"] != "complete":
        return True
    if state["reconciled"]:
        return True
    rows = conn.execute(
        """SELECT p.*,l.job_id,l.successful_last_observed_at FROM lifecycle_operational_listings p
       JOIN source_listings l ON l.id=p.listing_id WHERE p.source_id=%s
       AND (%s::uuid IS NULL OR p.listing_id>%s) ORDER BY p.listing_id LIMIT %s""",
        (source_id, state["cursor"], state["cursor"], limit),
    ).fetchall()
    lock_jobs(conn, [r["job_id"] for r in rows])
    _receipt(conn, source_id, claim)
    for row in rows:
        if (
            row["seen_sequence"] >= sequence
            or row["miss_sequence"] >= sequence
            or row["successful_last_observed_at"]
            and row["successful_last_observed_at"] >= state["started_at"]
        ):
            continue
        result = conn.execute(
            """UPDATE lifecycle_operational_listings SET miss_sequence=%s,miss_count=LEAST(2,miss_count+1),
           first_miss_at=COALESCE(first_miss_at,%s) WHERE listing_id=%s
           RETURNING miss_count>=2 AND %s>=first_miss_at+interval '24 hours' closed,miss_count,first_miss_at""",
            (sequence, state["completed_at"], row["listing_id"], state["completed_at"]),
        ).fetchone()
        conn.execute(
            """UPDATE source_listings SET consecutive_complete_misses=%s,first_complete_miss_at=%s,
          source_availability=CASE WHEN %s THEN 'closed' ELSE source_availability END WHERE id=%s""",
            (
                result["miss_count"],
                result["first_miss_at"],
                result["closed"],
                row["listing_id"],
            ),
        )
        if result["closed"]:
            conn.execute(
                "UPDATE jobs SET closed_at=COALESCE(closed_at,%s) WHERE id=%s",
                (state["completed_at"], row["job_id"]),
            )
        _flush(conn)
    done = len(rows) < limit
    conn.execute(
        "UPDATE lifecycle_operational_sources SET cursor=%s,reconciled=%s WHERE source_id=%s",
        (rows[-1]["listing_id"] if rows else state["cursor"], done, source_id),
    )
    return done


def run_due(conn, *, max_boards, deadline):
    """Stream complete existing-ID membership; every commit is independently fenced."""
    from job_discovery.adapters import ADAPTERS
    from job_discovery.adapters.completeness import source_budget, SourceBudgetExceeded

    sources = conn.execute(
        """SELECT s.* FROM source_accounts s JOIN lifecycle_operational_sources p ON p.source_id=s.id
      WHERE s.exclusion_state IN ('enabled','failure_disabled') AND (s.next_due_at IS NULL OR s.next_due_at<=clock_timestamp()
       OR p.status='complete' AND NOT p.reconciled)
      ORDER BY GREATEST(s.last_attempt_at,p.last_turn_at) NULLS FIRST,s.id LIMIT %s""",
        (max_boards,),
    ).fetchall()
    conn.commit()
    missing = conn.execute(
        "SELECT count(*) n FROM source_accounts s WHERE exclusion_state IN ('enabled','failure_disabled') AND (next_due_at IS NULL OR next_due_at<=clock_timestamp()) AND NOT EXISTS(SELECT FROM lifecycle_operational_sources p WHERE p.source_id=s.id)"
    ).fetchone()["n"]
    conn.commit()
    progress = {"complete": 0, "deferred": missing}
    for source in sources:
        if monotonic() >= deadline:
            break
        claim = None
        try:
            # This lane can only reuse a claim row provisioned by ordinary admission.
            enter_gate(conn)
            if not conn.execute(
                "SELECT 1 FROM lifecycle_claims WHERE kind='source' AND work_id=%s",
                (str(source["id"]),),
            ).fetchone():
                raise OperationalDeferred("source claim not preallocated")
            claim = claim_work(conn, "source", str(source["id"]), 180)
            if claim is None:
                conn.rollback()
                continue
            sequence, resuming = start(conn, source["id"], claim)
            conn.commit()
            if not resuming:
                success = False
                failed = False
                pending = []
                try:

                    def pulse():
                        _receipt(conn, source["id"], claim)
                        conn.execute(
                            "UPDATE lifecycle_claims SET lease_until=clock_timestamp()+interval '180 seconds' WHERE owner_token=%s AND generation=%s",
                            (claim.owner_token, claim.generation),
                        )
                        conn.commit()

                    with source_budget(
                        min(60, max(0, deadline - monotonic())), 50, pulse
                    ):
                        feed = ADAPTERS[source["ats"]](
                            source["public_board_ref"], fetch_details=False
                        )
                        for count, posting in enumerate(feed, 1):
                            if count > 10000:
                                break
                            pending.append(
                                (
                                    posting.external_id,
                                    "unlisted"
                                    if (posting.raw or {}).get("isListed") is False
                                    else "seen",
                                )
                            )
                            if len(pending) >= 100:
                                sightings(conn, source["id"], sequence, claim, pending)
                                conn.commit()
                                pending = []
                        else:
                            success = feed.complete
                except OperationalDeferred:
                    raise
                except psycopg.Error as exc:
                    raise OperationalDeferred(
                        "operational storage transaction deferred"
                    ) from exc
                except SourceBudgetExceeded:
                    conn.rollback()
                except Exception:
                    conn.rollback()
                    failed = True
                if pending:
                    sightings(conn, source["id"], sequence, claim, pending)
                    conn.commit()
                status = complete(
                    conn,
                    source["id"],
                    sequence,
                    claim,
                    successful=success,
                    failed=failed,
                )
                conn.commit()
                if status != "complete":
                    continue
            while monotonic() < deadline:
                done = reconcile(conn, source["id"], sequence, claim)
                conn.commit()
                if done:
                    progress["complete"] += 1
                    break
        except Exception as error:
            conn.rollback()
            log.warning(
                "source %s operational progress storage-deferred (%s)",
                source["id"],
                type(error).__name__,
            )
            progress["deferred"] += 1
        finally:
            if claim:
                conn.rollback()
                cancel_claim(conn, claim)
                conn.commit()
    return progress
