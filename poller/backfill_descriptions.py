import logging
import os

from poller import db
from poller.jd import extract_description

log = logging.getLogger("poller.backfill")


def _batch_size() -> int:
    raw = os.environ.get("BACKFILL_BATCH_SIZE")
    if raw is None or raw.strip() == "":
        return 2000
    try:
        return int(raw)
    except ValueError:
        return 2000


def backfill(conn, batch_size: int | None = None) -> int:
    """Distill jobs.description from jobs.raw, then null raw. Batched + idempotent.
    Only touches rows that still have raw and no description, so it is safe to
    re-run and to resume after interruption."""
    size = batch_size or _batch_size()
    total = 0
    while True:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT j.id, c.ats, j.raw
                FROM jobs j
                JOIN companies c ON c.id = j.company_id
                WHERE j.description IS NULL AND j.raw IS NOT NULL
                LIMIT %s
                """,
                (size,),
            )
            rows = cur.fetchall()
        if not rows:
            break
        with conn.cursor() as cur:
            for r in rows:
                desc = extract_description(r["ats"], r["raw"] or {})
                cur.execute(
                    "UPDATE jobs SET description = %s, raw = NULL WHERE id = %s",
                    (desc, r["id"]),
                )
        conn.commit()
        total += len(rows)
        log.info("backfilled %s rows (running total %s)", len(rows), total)
    return total


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    conn = db.connect()
    try:
        n = backfill(conn)
        log.info("backfill complete: %s rows processed", n)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
