import os

import psycopg
from psycopg.rows import dict_row


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
