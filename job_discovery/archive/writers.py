"""Current service writers use one claim per bounded transaction; callers commit."""

from contextlib import contextmanager
from job_discovery.lifecycle.claims import claim_work
from job_discovery.lifecycle.config import read_control
from job_discovery.lifecycle.locks import enter_gate
from job_discovery.lifecycle.types import ClaimRef
from job_discovery.lifecycle.errors import StorageBlocked


@contextmanager
def public_write(conn, scope, *, job_id=None, forecast=262144):
    if scope not in {"companies", "locations", "jobs"}:
        raise ValueError("unsupported public writer scope")
    enter_gate(conn)
    control = read_control(conn)
    if not control.archive_ever_activated and control.safety_stage != "enforced":
        yield
        return
    # The server-assigned transaction identity cannot be reused by another writer.
    identity = conn.execute(
        "SELECT pg_backend_pid()::text||':'||pg_current_xact_id()::text id"
    ).fetchone()["id"]
    existing = conn.execute(
        "SELECT * FROM lifecycle_claims WHERE kind='public_writer' AND work_id=%s",
        (identity,),
    ).fetchone()
    claim = (
        ClaimRef(
            existing["owner_token"], existing["generation"], existing["lease_until"]
        )
        if existing
        else claim_work(conn, "public_writer", identity, 180)
    )
    if claim is None:
        raise StorageBlocked("public writer claim storage unavailable")
    from job_discovery.lifecycle.reconcile import _write

    with _write(conn, claim, scope, job_id=job_id, size=forecast):
        yield


def ingest_candidates(conn, candidates, *, record_progress=None):
    """Explicit bounded ingest boundary shared by the scheduled/weekly callers."""
    from company_discovery.db import upsert_candidates

    inserted = 0
    for start in range(0, len(candidates), 100):
        inserted += upsert_candidates(conn, candidates[start : start + 100])
        if record_progress is not None:
            record_progress(inserted)
        conn.commit()
    return inserted
