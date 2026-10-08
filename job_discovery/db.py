from job_discovery.archive.writers import public_write
from job_discovery.lifecycle.locks import enter_gate, lock_jobs
import json
import os

import psycopg
from psycopg.rows import dict_row

from job_discovery.models import Posting
from job_discovery.jd import extract_description
from job_discovery.lifecycle.config import legacy_description_capture_allowed


def connect(dsn: str | None = None) -> psycopg.Connection:
    dsn = dsn or os.environ["DATABASE_URL"]
    return psycopg.connect(
        dsn,
        row_factory=dict_row,
        connect_timeout=10,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=3,
    )


# Lifecycle discovery stores lean metadata; pre-cutover legacy readers retain JD capture. The
# physical backstop remains below the 8 GB volume. Override via DB_SIZE_CEILING_MB.
DB_SIZE_CEILING_MB_DEFAULT = 6000.0


def db_size_ceiling_mb() -> float:
    raw = os.environ.get("DB_SIZE_CEILING_MB")
    if raw is None or raw.strip() == "":
        return DB_SIZE_CEILING_MB_DEFAULT
    try:
        return float(raw)
    except ValueError:
        # A malformed override falls back to the default rather than disabling
        # the guard (which is what an exception here would effectively do).
        return DB_SIZE_CEILING_MB_DEFAULT


def database_size_mb(conn) -> float:
    with conn.cursor() as cur:
        cur.execute("SELECT pg_database_size(current_database()) AS bytes")
        return cur.fetchone()["bytes"] / (1024.0 * 1024.0)


def over_size_ceiling(conn) -> tuple[bool, float, float]:
    """Disk safety valve. Returns (is_over, size_mb, ceiling_mb). Callers halt
    when is_over so the DB never marches into the hard volume limit again."""
    ceiling = db_size_ceiling_mb()
    size = database_size_mb(conn)
    return size >= ceiling, size, ceiling


def sync_seed(conn, targets: list[dict]) -> None:
    """Upsert targets.json as the always-included seed. Owns ONLY seed rows —
    company discovery owns `active` for everything else, so this never deactivates."""
    with conn.cursor() as cur:
        for t in targets:
            with public_write(conn, 'companies'):
                cur.execute(
                    """
                    INSERT INTO companies (name, ats, token, active, discovery_source)
                    VALUES (%(name)s, %(ats)s, %(token)s, TRUE, 'seed')
                    ON CONFLICT (ats, token)
                    DO UPDATE SET name = EXCLUDED.name, active = TRUE,
                                 discovery_source = 'seed'
                    """,
                    t,
                )

def active_companies(conn) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, ats, token FROM companies WHERE active ORDER BY id"
        )
        return cur.fetchall()


POLL_FAILURE_DEACTIVATE = 5  # consecutive failed board fetches before a non-seed company stops being polled


def record_poll_result(conn, company_id: int, ok: bool) -> bool:
    """Track consecutive board-fetch failures; deactivate dead non-seed boards.
    Returns True when this call deactivated the company."""
    with conn.cursor() as cur:
        if ok:
            cur.execute(
                "UPDATE companies SET poll_failures = 0 WHERE id = %s AND poll_failures > 0",
                (company_id,))
            return False
        cur.execute(
            """
            UPDATE companies SET
              poll_failures = poll_failures + 1,
              active = CASE WHEN poll_failures + 1 >= %(cap)s
                             AND discovery_source <> 'seed'
                            THEN FALSE ELSE active END
            WHERE id = %(id)s
            RETURNING active
            """,
            {"cap": POLL_FAILURE_DEACTIVATE, "id": company_id})
        return cur.fetchone()["active"] is False


_UPSERT_SQL = """
    INSERT INTO jobs (id, company_id, external_id, title, url,
                      location, department, remote, description)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (id) DO UPDATE SET
        title       = EXCLUDED.title,
        url         = EXCLUDED.url,
        location    = COALESCE(EXCLUDED.location,    jobs.location),
        department  = COALESCE(EXCLUDED.department,  jobs.department),
        remote      = COALESCE(EXCLUDED.remote,      jobs.remote),
        description = CASE WHEN jobs.description IS NULL AND NOT jobs.description_pruned
                           THEN EXCLUDED.description ELSE jobs.description END,
        last_seen_at = now(),
        closed_at    = NULL
    WHERE jobs.closed_at IS NOT NULL
       OR (jobs.title, jobs.url) IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.url)
       OR COALESCE(EXCLUDED.location,   jobs.location)   IS DISTINCT FROM jobs.location
       OR COALESCE(EXCLUDED.department, jobs.department) IS DISTINCT FROM jobs.department
       OR COALESCE(EXCLUDED.remote,     jobs.remote)     IS DISTINCT FROM jobs.remote
       OR (jobs.description IS NULL AND NOT jobs.description_pruned
           AND EXCLUDED.description IS NOT NULL)
    RETURNING (xmax = 0) AS is_new
"""


def _posting_row(ats: str, token: str, company_id: int, p: Posting, *,
                 capture_description: bool = False) -> tuple:
    job_id = f"{ats}:{token}:{p.external_id}"
    description = extract_description(ats, p.raw) if capture_description else None
    return (job_id, company_id, p.external_id, p.title, p.url,
            p.location, p.department, p.remote, description)


def _legacy_public_writer(conn):
    """Legacy public ingestion is unavailable after archive cutover."""
    from job_discovery.lifecycle.config import read_control
    from job_discovery.lifecycle.errors import StorageBlocked
    enter_gate(conn)
    if read_control(conn).archive_ever_activated:
        raise StorageBlocked("legacy public job writer disabled; use lifecycle source admission")


def upsert_jobs(
    conn, company_id: int, ats: str, token: str, postings: list[Posting]
) -> int:
    """Batch-upsert a list of postings using psycopg3 pipelined executemany.

    Returns the count of rows that were newly inserted (is_new=TRUE). A conditional
    DO UPDATE skips no-op rows entirely (returns no RETURNING row for those), so a
    skipped update is counted as not new. Note: last_seen_at does not advance for
    unchanged rows.
    """
    if not postings:
        return 0
    _legacy_public_writer(conn)
    capture_description = legacy_description_capture_allowed(conn)
    rows = [_posting_row(ats, token, company_id, p, capture_description=capture_description) for p in postings
            if p.metadata_complete and isinstance(p.title,str) and p.title.strip()
            and isinstance(p.url,str) and p.url.strip()]
    if not rows:
        return 0
    new = 0
    lock_jobs(conn, [row[0] for row in rows])
    with conn.cursor() as cur:
        cur.executemany(_UPSERT_SQL, rows, returning=True)
        while True:
            row = cur.fetchone()
            if row and row["is_new"]:
                new += 1
            if not cur.nextset():
                break
    return new


def upsert_job(conn, company_id: int, ats: str, token: str, p: Posting) -> bool:
    """Single-row upsert, implemented as a batch of one. Returns True if new."""
    return upsert_jobs(conn, company_id, ats, token, [p]) > 0


def compute_newly_closed(
    open_external_ids: set[str], seen_external_ids: set[str]
) -> set[str]:
    return open_external_ids - seen_external_ids


def get_open_external_ids(conn, company_id: int) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT external_id FROM jobs WHERE company_id = %s AND closed_at IS NULL",
            (company_id,),
        )
        return {r["external_id"] for r in cur.fetchall()}


def _lock_company_jobs(conn, company_id, external_ids):
    enter_gate(conn)
    rows = conn.execute(
        "SELECT id FROM jobs WHERE company_id=%s AND external_id=ANY(%s)",
        (company_id, sorted(external_ids)),
    ).fetchall()
    lock_jobs(conn, [r["id"] for r in rows])


def reopen_jobs(conn, company_id: int, external_ids: set[str]) -> None:
    """A listing can reopen existing jobs during maintenance without ingestion."""
    if external_ids:
        _legacy_public_writer(conn)
        _lock_company_jobs(conn, company_id, external_ids)
        conn.execute(
            "UPDATE jobs SET closed_at = NULL WHERE company_id = %s "
            "AND closed_at IS NOT NULL AND external_id = ANY(%s)",
            (company_id, list(external_ids)),
        )


def close_jobs(conn, company_id: int, external_ids: set[str]) -> int:
    if not external_ids:
        return 0
    _legacy_public_writer(conn)
    _lock_company_jobs(conn, company_id, external_ids)
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE jobs SET closed_at = now() "
            "WHERE company_id = %s AND closed_at IS NULL AND external_id = ANY(%s)",
            (company_id, list(external_ids)),
        )
        return cur.rowcount


def start_run(conn) -> int:
    with conn.cursor() as cur:
        cur.execute("INSERT INTO poll_runs (started_at) VALUES (now()) RETURNING id")
        return cur.fetchone()["id"]


def finish_run(
    conn,
    run_id: int,
    *,
    companies_ok: int,
    companies_failed: int,
    new_jobs: int,
    closed_jobs: int,
    notes: str | None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE poll_runs SET
                finished_at      = now(),
                companies_ok     = %s,
                companies_failed = %s,
                new_jobs         = %s,
                closed_jobs      = %s,
                notes            = %s
            WHERE id = %s
            """,
            (companies_ok, companies_failed, new_jobs, closed_jobs, notes, run_id),
        )


def insert_job_questions(conn, job_id: str, questions: dict, *, overwrite: bool = True) -> None:
    """Store question schema; optional legacy backfill never replaces a cache."""
    lock_jobs(conn, [job_id])
    conflict = ("DO UPDATE SET questions = EXCLUDED.questions, fetched_at = now()"
                if overwrite else "DO NOTHING")
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO job_questions (job_id, questions, fetched_at)
            VALUES (%s, %s::jsonb, now())
            ON CONFLICT (job_id) {conflict}
            """,
            (job_id, json.dumps(questions)),
        )


def greenhouse_jobs_missing_questions(conn, company_id: int, *, limit: int | None = None) -> list[str]:
    """external_ids of this company's OPEN jobs that have no job_questions row yet —
    the rolling-backfill predicate (covers both new jobs and the existing backlog)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT j.external_id
            FROM jobs j
            LEFT JOIN job_questions q ON q.job_id = j.id
            WHERE j.company_id = %s AND j.closed_at IS NULL AND q.job_id IS NULL
            ORDER BY j.external_id LIMIT %s
            """,
            (company_id, limit),
        )
        return [r["external_id"] for r in cur.fetchall()]


def sync_source_accounts(conn, limit: int = 100) -> int:
    """Register a bounded slice of the whole company corpus for verification.

    Existing source exclusions are authoritative. An inactive legacy company
    whose reason is unknown remains unknown; only the recorded failure threshold
    supplies failure-disabled provenance. No user preferences participate.
    Caller commits before enumeration/network work.
    """
    from job_discovery.lifecycle.claims import claim_work
    from job_discovery.lifecycle.config import read_control
    from job_discovery.lifecycle.reconcile import _write, StorageBlocked
    if type(limit) is not int or not 1 <= limit <= 500:
        raise ValueError('source registration limit must be 1..500')
    enter_gate(conn)
    if not read_control(conn).source_enabled:
        return 0
    companies = conn.execute("""SELECT c.* FROM companies c WHERE NOT EXISTS
        (SELECT FROM source_accounts s WHERE s.ats=c.ats AND s.public_board_ref=c.token)
        ORDER BY c.id LIMIT %s""", (limit,)).fetchall()
    if not companies:
        return 0
    claim = claim_work(conn,'source_catalog','singleton',180)
    if claim is None:
        raise StorageBlocked('source catalog registration deferred')
    for co in companies:
        exclusion = 'enabled' if co['active'] else ('failure_disabled' if co['poll_failures']>=POLL_FAILURE_DEACTIVATE else 'unknown')
        with _write(conn,claim,'source_accounts'):
            conn.execute("""INSERT INTO source_accounts(legacy_company_id,ats,public_board_ref,legacy_active,exclusion_state,failure_streak)
                VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(ats,public_board_ref) DO NOTHING""",
                (co['id'],co['ats'],co['token'],co['active'],exclusion,co['poll_failures']))
    return len(companies)
