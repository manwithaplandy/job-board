"""Physical allocation plus ALL held forecasts; deleting rows earns no credit."""

from .claims import validate_claim
from .locks import enter_gate
from .types import ClaimRef, ReservationRef

CEILING_BYTES = 6000 * 1024**2


def reserve_capacity(
    conn, claim: ClaimRef, bytes: int, critical: bool = False
) -> ReservationRef | None:
    if type(bytes) is not int or bytes < 0:
        raise ValueError("capacity bytes must be a nonnegative integer")
    validate_claim(conn, claim)
    budget = conn.execute(
        "SELECT pg_database_size(current_database()) + COALESCE(sum(bytes) FILTER(WHERE state='held'),0) AS allocated FROM capacity_reservations"
    ).fetchone()["allocated"]
    if budget + bytes > CEILING_BYTES:
        return None
    row = conn.execute(
        """INSERT INTO capacity_reservations(claim_kind,claim_id,owner_token,generation,bytes,critical)
       SELECT kind,work_id,owner_token,generation,%s,%s FROM lifecycle_claims
       WHERE owner_token=%s AND generation=%s RETURNING id""",
        (bytes, critical, claim.owner_token, claim.generation),
    ).fetchone()
    return ReservationRef(row["id"], claim, bytes)


def bind_reservation(
    conn,
    reservation: ReservationRef,
    *,
    job_id: str | None,
    scope: str,
    subject_id: str | None = None,
    invoking_role: str | None = None,
) -> None:
    """Service grants one job/table/subject a capability on THIS backend/transaction.

    GUC is merely an untrusted locator. The trigger validates every field against
    the service-owned row; token/GUC possession alone confers no privilege.
    """
    validate_claim(conn, reservation.claim)
    row = conn.execute(
        """UPDATE capacity_reservations SET backend_pid=pg_backend_pid(),transaction_id=pg_current_xact_id(),
        job_id=%s,scope=%s,subject_id=%s,invoking_role=COALESCE(%s,current_user)
        WHERE id=%s AND owner_token=%s AND generation=%s AND state='held'
        AND (transaction_id IS NULL OR (transaction_id=pg_current_xact_id() AND backend_pid=pg_backend_pid()))
        RETURNING id""",
        (
            job_id,
            scope,
            subject_id,
            invoking_role,
            reservation.id,
            reservation.claim.owner_token,
            reservation.claim.generation,
        ),
    ).fetchone()
    if row is None:
        raise RuntimeError("stale or already bound capacity reservation")
    conn.execute(
        "SELECT set_config('lifecycle.reservation',%s,true)", (str(reservation.id),)
    )


def settle_capacity(conn, reservation: ReservationRef) -> None:
    validate_claim(conn, reservation.claim)
    row = conn.execute(
        """UPDATE capacity_reservations SET state='settled',terminal_at=clock_timestamp(),
        measured_database_bytes=pg_database_size(current_database())
        WHERE id=%s AND owner_token=%s AND generation=%s AND state='held'
        AND transaction_id=pg_current_xact_id() AND backend_pid=pg_backend_pid() RETURNING id""",
        (reservation.id, reservation.claim.owner_token, reservation.claim.generation),
    ).fetchone()
    if row is None:
        raise RuntimeError("stale or unbound capacity reservation")


def recover_reservation(conn, reservation: ReservationRef) -> None:
    """Explicitly retire a prior committed binding only after fencing its writer."""
    enter_gate(conn)
    row = conn.execute(
        """UPDATE capacity_reservations r SET state='fenced',terminal_at=clock_timestamp()
      FROM lifecycle_claims c WHERE r.id=%s AND c.kind=r.claim_kind AND c.work_id=r.claim_id
      AND c.generation>r.generation AND c.replay_floor>=r.generation RETURNING r.id""",
        (reservation.id,),
    ).fetchone()
    if row is None:
        raise RuntimeError("reservation recovery requires fenced writer")
