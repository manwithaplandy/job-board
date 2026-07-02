import os

import psycopg
from psycopg.rows import dict_row

from job_discovery.jd import extract_description
from job_discovery.models import Posting


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


# The Supabase Pro volume is 8 GB. A poll now stores only the distilled JD text
# (jobs.description), so per-poll growth is modest, but we still halt well below
# the hard limit as a backstop. Override via DB_SIZE_CEILING_MB.
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


def _posting_row(ats: str, token: str, company_id: int, p: Posting) -> tuple:
    job_id = f"{ats}:{token}:{p.external_id}"
    description = extract_description(ats, p.raw or {})
    return (job_id, company_id, p.external_id, p.title, p.url,
            p.location, p.department, p.remote, description)


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
    rows = [_posting_row(ats, token, company_id, p) for p in postings]
    new = 0
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


def close_jobs(conn, company_id: int, external_ids: set[str]) -> int:
    if not external_ids:
        return 0
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
