"""One-time backfill: apply reviewer.floors to job_reviews rows the model left at
'unknown' but that a deterministic floor can recover (the ATS remote flag, or a
single ladder word in the title).

Rollout artifact — run ONCE after deploying the write-time floors:
    DATABASE_URL=... python -m reviewer.backfill_floors

Only rows whose value actually changes are UPDATEd, and human-overridden rows are
never touched (WHERE r.human_override IS NOT TRUE). reviewer.floors is the single
source of truth for the regexes, so a backfilled row lands on the same value a
fresh write-time review would.
"""
import logging

from reviewer import floors

log = logging.getLogger("backfill_floors")

_SELECT = """
    SELECT r.user_id, r.job_id, r.seniority, r.work_arrangement, j.title, j.remote
    FROM job_reviews r
    JOIN jobs j ON j.id = r.job_id
    WHERE (r.seniority = 'unknown' OR r.work_arrangement = 'unknown')
      AND r.human_override IS NOT TRUE
"""


def compute_floor_update(row: dict) -> dict | None:
    """Pure per-row decision (DB-free, so it is unit-testable).

    Returns {"seniority", "work_arrangement"} when a floor changes at least one
    field, else None (nothing to UPDATE). Both values come from reviewer.floors.
    """
    seniority = floors.floor_seniority(row.get("seniority"), row.get("title"))
    work_arrangement = floors.floor_work_arrangement(
        row.get("work_arrangement"), row.get("remote"))
    if (seniority == row.get("seniority")
            and work_arrangement == row.get("work_arrangement")):
        return None
    return {"seniority": seniority, "work_arrangement": work_arrangement}


def main() -> None:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")
    from job_discovery import db as job_discovery_db  # shared connection factory
    conn = job_discovery_db.connect()
    try:
        with conn.cursor() as cur:
            cur.execute(_SELECT)
            rows = cur.fetchall()
        updated = 0
        for r in rows:
            new = compute_floor_update(r)
            if new is None:
                continue
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE job_reviews SET seniority = %s, work_arrangement = %s "
                    "WHERE user_id = %s AND job_id = %s",
                    (new["seniority"], new["work_arrangement"],
                     r["user_id"], r["job_id"]),
                )
            updated += 1
        conn.commit()
        log.info("floored %s of %s candidate job_reviews rows", updated, len(rows))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
