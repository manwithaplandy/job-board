import logging
import os

log = logging.getLogger("poller.prune")


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _run_batched(conn, sql: str, params_prefix: tuple, batch: int, cap: int) -> int:
    """Run a LIMIT-bounded write repeatedly until it stops affecting rows or the
    per-sweep cap is hit, committing each batch to keep WAL bounded."""
    done = 0
    while done < cap:
        limit = min(batch, cap - done)
        with conn.cursor() as cur:
            cur.execute(sql, params_prefix + (limit,))
            n = cur.rowcount
        conn.commit()
        if n == 0:
            break
        done += n
    return done


_DROP_DENIED = """
UPDATE jobs SET description = NULL
WHERE id IN (
    SELECT j.id FROM jobs j
    WHERE j.description IS NOT NULL
      AND EXISTS (SELECT 1 FROM job_reviews r WHERE r.job_id = j.id
                  AND (r.verdict = 'deny' OR r.stage1_decision = 'reject'))
      AND NOT EXISTS (SELECT 1 FROM job_reviews r WHERE r.job_id = j.id
                      AND r.verdict = 'approve')
    LIMIT %s
)
"""

_DELETE_CLOSED = """
DELETE FROM jobs WHERE id IN (
    SELECT j.id FROM jobs j
    WHERE j.closed_at IS NOT NULL
      AND j.closed_at < now() - make_interval(days => %s)
      AND NOT EXISTS (SELECT 1 FROM job_reviews r WHERE r.job_id = j.id
                      AND r.verdict = 'approve')
    LIMIT %s
)
"""

_DELETE_INACTIVE = """
DELETE FROM jobs WHERE id IN (
    SELECT j.id FROM jobs j
    JOIN companies c ON c.id = j.company_id
    WHERE c.active = FALSE
      AND NOT EXISTS (SELECT 1 FROM job_reviews r WHERE r.job_id = j.id
                      AND r.verdict = 'approve')
    LIMIT %s
)
"""


def prune_jobs(conn) -> dict:
    """Lifecycle pruning, run at the end of each poll. Each rule is batched and
    bounded per sweep so a single run can never generate a large WAL burst;
    remaining work is picked up on the next poll. Deletes cascade to job_reviews."""
    batch = _int_env("PRUNE_BATCH_SIZE", 2000)
    cap = _int_env("PRUNE_MAX_ROWS_PER_RUN", 20000)
    days = _int_env("CLOSED_JOB_RETENTION_DAYS", 30)
    counts = {
        "denied_descriptions_dropped": _run_batched(conn, _DROP_DENIED, (), batch, cap),
        "closed_deleted": _run_batched(conn, _DELETE_CLOSED, (days,), batch, cap),
        "inactive_company_deleted": _run_batched(conn, _DELETE_INACTIVE, (), batch, cap),
    }
    log.info("prune complete: %s", counts)
    return counts
