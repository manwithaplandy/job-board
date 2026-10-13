from job_discovery.lifecycle.locks import enter_gate, lock_jobs
from job_discovery.lifecycle.maintenance import legacy_prune_disabled
import logging
import os

from psycopg.errors import LockNotAvailable

log = logging.getLogger("job_discovery.prune")


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = int(raw)
        return value if value > 0 else default
    except ValueError:
        return default


_CLOSED_UNPROTECTED = """
    j.closed_at IS NOT NULL
    AND j.closed_at < now() - make_interval(days => %s)
    AND NOT EXISTS (SELECT 1 FROM job_reviews r WHERE r.job_id = j.id
                    AND r.verdict = 'approve')
    AND NOT EXISTS (SELECT 1 FROM review_corrections rc WHERE rc.job_id = j.id)
    AND NOT EXISTS (SELECT 1 FROM application_packages ap WHERE ap.job_id = j.id)
"""

_SELECT_CLOSED = f"""
SELECT j.id FROM jobs j WHERE {_CLOSED_UNPROTECTED}
ORDER BY j.closed_at, j.id
LIMIT %s
FOR UPDATE OF j SKIP LOCKED
"""

_DELETE_CLOSED = f"""
DELETE FROM jobs j WHERE {_CLOSED_UNPROTECTED} AND j.id = ANY(%s)
"""


def _run_batched(conn, days: int, batch: int, cap: int) -> int:
    """Lock a bounded candidate set, then recheck history in a fresh snapshot.

    Parent locks exclude concurrent history inserts through their foreign keys.
    Existing reviews also need locks: changing deny to approve does not change
    their FK, so a parent lock alone cannot protect an approval in progress.
    NOWAIT yields the sweep to that writer rather than blocking maintenance.
    """
    done = 0
    while done < cap:
        try:
            enter_gate(conn)
            if legacy_prune_disabled(conn):
                conn.commit()
                break
            with conn.cursor() as cur:
                cur.execute(_SELECT_CLOSED.replace("FOR UPDATE OF j SKIP LOCKED", ""), (days, min(batch, cap - done)))
                lock_jobs(conn, [row["id"] for row in cur.fetchall()])
                cur.execute(_SELECT_CLOSED, (days, min(batch, cap - done)))
                ids = [row["id"] for row in cur.fetchall()]
                if not ids:
                    conn.commit()
                    break
                cur.execute(
                    "SELECT job_id FROM job_reviews WHERE job_id = ANY(%s) FOR UPDATE NOWAIT",
                    (ids,),
                )
                # Separate statement: READ COMMITTED now sees any approvals that
                # committed between candidate selection and review lock acquisition.
                cur.execute(_DELETE_CLOSED, (days, ids))
                n = cur.rowcount
            conn.commit()
        except LockNotAvailable:
            conn.rollback()
            log.info("prune yielded to a concurrent history update")
            break
        if n == 0:
            break
        done += n
    return done


def prune_jobs(conn) -> dict:
    """Delete only old source-confirmed closures, retaining protected history.

    Company inactivity and per-user denial never authorize shared data removal.
    closed_at is written after complete source reconciliation; last_seen_at is
    never a deletion cutoff. Commit each bounded batch to limit transaction size.
    """
    batch = _int_env("PRUNE_BATCH_SIZE", 2000)
    cap = _int_env("PRUNE_MAX_ROWS_PER_RUN", 20000)
    days = _int_env("CLOSED_JOB_RETENTION_DAYS", 30)
    counts = {
        "denied_descriptions_dropped": 0,
        "closed_deleted": _run_batched(conn, days, batch, cap),
        "inactive_company_deleted": 0,
    }
    log.info("prune complete: %s", counts)
    return counts
