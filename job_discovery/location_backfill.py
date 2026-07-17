"""One-time rollout backfill: resolve EVERY existing distinct jobs.location and
stamp jobs.location_canonicals.

Run against a database:  DATABASE_URL=... OPENROUTER_API_KEY=... python -m job_discovery.location_backfill

This is exactly the nightly resolution step (locations.resolve_new_locations)
run outside a poll: the scope query already targets "raws with no locations
row", so a rerun only touches what the previous run missed (e.g. after an LLM
outage). Safe to rerun; commits per batch, so an interrupt loses nothing.

ROLLOUT ARTIFACT — run once at rollout, BEFORE deploying the dashboard/reviewer
predicate cutover and BEFORE prefs_backfill (which needs the mapping rows).
"""
import logging

from job_discovery import db
from job_discovery.locations import resolve_new_locations


def main() -> None:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")
    conn = db.connect()
    try:
        counts = resolve_new_locations(conn)
        logging.getLogger("location_backfill").info("backfill complete: %s", counts)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
