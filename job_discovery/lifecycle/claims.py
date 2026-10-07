"""Database-clock leases with persistent generations and commit-time fences."""

from secrets import token_urlsafe
from .locks import enter_gate
from .types import ClaimRef


def claim_work(conn, kind: str, id: str, lease_seconds: int) -> ClaimRef | None:
    if (
        not kind
        or not id
        or type(lease_seconds) is not int
        or not 1 <= lease_seconds <= 180
    ):
        raise ValueError("claim kind/id and lease in 1..180 seconds required")
    enter_gate(conn)
    old = conn.execute(
        "SELECT * FROM lifecycle_claims WHERE kind=%s AND work_id=%s FOR UPDATE",
        (kind, id),
    ).fetchone()
    if (
        old
        and conn.execute(
            "SELECT %s > clock_timestamp() AS active", (old["lease_until"],)
        ).fetchone()["active"]
        and old["state"] == "active"
    ):
        return None
    if (
        old is None
        and (kind, id) not in {("maintenance", "singleton"), ("control", "singleton")}
        and conn.execute(
            "SELECT pg_database_size(current_database())+COALESCE(sum(bytes) FILTER(WHERE state='held'),0)+4096>6291456000 AS full FROM capacity_reservations"
        ).fetchone()["full"]
    ):
        return None
    token = token_urlsafe(32)
    row = conn.execute(
        """INSERT INTO lifecycle_claims(kind,work_id,owner_token,lease_until,invoking_role,subject_id)
        VALUES (%s,%s,%s,clock_timestamp()+make_interval(secs=>%s),current_user,app_user_id())
        ON CONFLICT(kind,work_id) DO UPDATE SET owner_token=EXCLUDED.owner_token,
        generation=lifecycle_claims.generation+1,replay_floor=lifecycle_claims.generation,
        lease_until=EXCLUDED.lease_until,invoking_role=EXCLUDED.invoking_role,subject_id=EXCLUDED.subject_id,
        state='active',terminal_at=NULL RETURNING *""",
        (kind, id, token, lease_seconds),
    ).fetchone()
    if old:
        # Fence first; expiry alone never frees reservations.
        conn.execute(
            "UPDATE capacity_reservations SET state='fenced',terminal_at=clock_timestamp() WHERE claim_kind=%s AND claim_id=%s AND generation<=%s AND state='held'",
            (kind, id, old["generation"]),
        )
    return ClaimRef(token, row["generation"], row["lease_until"])


def validate_claim(conn, claim: ClaimRef) -> None:
    enter_gate(conn)
    row = conn.execute(
        """SELECT kind FROM lifecycle_claims WHERE owner_token=%s AND generation=%s
       AND generation>replay_floor AND state='active' AND lease_until>clock_timestamp()
       AND invoking_role=current_user AND subject_id IS NOT DISTINCT FROM app_user_id() FOR UPDATE""",
        (claim.owner_token, claim.generation),
    ).fetchone()
    if row is None:
        raise RuntimeError("stale, expired or fenced lifecycle claim")
    conn.execute(
        "INSERT INTO lifecycle_write_checks(owner_token,generation,invoking_role,subject_id) VALUES (%s,%s,current_user,app_user_id())",
        (claim.owner_token, claim.generation),
    )


def renew_claim(conn, claim: ClaimRef, lease_seconds: int = 180) -> ClaimRef:
    if type(lease_seconds) is not int or not 1 <= lease_seconds <= 180:
        raise ValueError("lease must be 1..180 seconds")
    validate_claim(conn, claim)
    row = conn.execute(
        "UPDATE lifecycle_claims SET lease_until=clock_timestamp()+make_interval(secs=>%s) WHERE owner_token=%s AND generation=%s RETURNING lease_until",
        (lease_seconds, claim.owner_token, claim.generation),
    ).fetchone()
    return ClaimRef(claim.owner_token, claim.generation, row["lease_until"])


def cancel_claim(conn, claim: ClaimRef) -> None:
    enter_gate(conn)
    row = conn.execute(
        "UPDATE lifecycle_claims SET replay_floor=generation,generation=generation+1,state='cancelled',terminal_at=clock_timestamp() WHERE owner_token=%s AND generation=%s AND invoking_role=current_user AND subject_id IS NOT DISTINCT FROM app_user_id() RETURNING kind,work_id",
        (claim.owner_token, claim.generation),
    ).fetchone()
    if row is None:
        raise RuntimeError("stale or fenced lifecycle claim")
    conn.execute(
        "UPDATE capacity_reservations SET state='fenced',terminal_at=clock_timestamp() WHERE claim_kind=%s AND claim_id=%s AND generation=%s AND state='held'",
        (row["kind"], row["work_id"], claim.generation),
    )
