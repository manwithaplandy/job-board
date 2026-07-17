"""One-time rollout migration: remap every profile's preferred_locations
through the locations table and ensure 'Remote' (prepended so the
MAX_LOCATIONS cap can never drop it).

Run against a database:  DATABASE_URL=... python -m job_discovery.prefs_backfill

Remote-bypass removal makes remote OPT-IN; appending 'Remote' to every
existing profile preserves each user's current feed exactly (spec decision —
no feed may silently shrink at cutover). Entries with no mapping row are kept
verbatim (they still match via the predicate's COALESCE raw fallback).
Idempotent: remapping canonical values is a no-op and 'Remote' is set-guarded;
the UPDATE only fires when the array actually changes.

ROLLOUT ARTIFACT — run once at rollout, AFTER location_backfill.
"""
import logging

log = logging.getLogger("prefs_backfill")

_MAX_LOCATIONS = 100  # dashboard/lib/preferredLocations.ts MAX_LOCATIONS


def remap(prefs: list[str], mapping: dict[str, list[str]]) -> list[str]:
    """Pure remap: expand each entry through the mapping (multi-location raws
    expand to all their canonicals), dedupe preserving order, ensure 'Remote'
    (prepended so the MAX_LOCATIONS cap can never drop it)."""
    out: list[str] = ["Remote"]
    seen = {"Remote"}
    for p in prefs:
        for c in mapping.get(p, [p]):
            if c not in seen:
                seen.add(c)
                out.append(c)
    return out[:_MAX_LOCATIONS]


def run(conn) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT raw, canonicals FROM locations")
        mapping = {r["raw"]: r["canonicals"] for r in cur.fetchall()}
        cur.execute("SELECT user_id, preferred_locations FROM profiles")
        profiles = cur.fetchall()
    updated = 0
    for p in profiles:
        new = remap(p["preferred_locations"] or [], mapping)
        if new == (p["preferred_locations"] or []):
            continue
        with conn.cursor() as cur:
            cur.execute("UPDATE profiles SET preferred_locations = %s WHERE user_id = %s",
                        (new, p["user_id"]))
        updated += 1
    conn.commit()
    log.info("prefs remap complete: %s of %s profiles updated", updated, len(profiles))
    return {"profiles": len(profiles), "updated": updated}


def main() -> None:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")
    from job_discovery import db
    conn = db.connect()
    try:
        run(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
