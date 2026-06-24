import os

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json

from poller.models import Posting


def connect(dsn: str | None = None) -> psycopg.Connection:
    dsn = dsn or os.environ["DATABASE_URL"]
    return psycopg.connect(dsn, row_factory=dict_row)


def sync_companies(conn, targets: list[dict]) -> dict[tuple[str, str], int]:
    ids: dict[tuple[str, str], int] = {}
    with conn.cursor() as cur:
        for t in targets:
            cur.execute(
                """
                INSERT INTO companies (name, ats, token, active)
                VALUES (%(name)s, %(ats)s, %(token)s, TRUE)
                ON CONFLICT (ats, token)
                DO UPDATE SET name = EXCLUDED.name, active = TRUE
                RETURNING id, ats, token
                """,
                t,
            )
            row = cur.fetchone()
            ids[(row["ats"], row["token"])] = row["id"]

        keys = [f'{t["ats"]}:{t["token"]}' for t in targets]
        cur.execute(
            "UPDATE companies SET active = FALSE "
            "WHERE active = TRUE AND (ats || ':' || token) <> ALL(%s)",
            (keys,),
        )
    return ids


def upsert_job(conn, company_id: int, ats: str, token: str, p: Posting) -> bool:
    job_id = f"{ats}:{token}:{p.external_id}"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO jobs (id, company_id, external_id, title, url,
                              location, department, remote, raw)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                last_seen_at = now(),
                closed_at    = NULL,
                title        = EXCLUDED.title,
                url          = EXCLUDED.url,
                location     = EXCLUDED.location,
                department   = EXCLUDED.department,
                remote       = EXCLUDED.remote,
                raw          = EXCLUDED.raw
            RETURNING (xmax = 0) AS inserted
            """,
            (
                job_id, company_id, p.external_id, p.title, p.url,
                p.location, p.department, p.remote, Json(p.raw),
            ),
        )
        return cur.fetchone()["inserted"]
