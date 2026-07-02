"""Backfill: convert company_reviews.red_flags from free-text strings to the
{category, note} enum shape using deterministic keyword rules (no LLM).

Run against a database:  DATABASE_URL=... python -m company_discovery.reclassify
"""
import logging
import re

from psycopg.types.json import Json

from company_discovery.schemas import RedFlag

log = logging.getLogger("reclassify")

# Ordered (pattern, category) rules — FIRST match wins. defense_military is ahead
# of consulting_agency on purpose so "defense/intelligence consulting" routes to
# defense (the narrower, more severe signal).
_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"defense|military|aerospace|weapon|missile|intelligence|surveillance|warfare"),
     "defense_military"),
    (re.compile(r"consult|agency|staffing|recruit|advisory|outsourc|contracting firm"),
     "consulting_agency"),
    (re.compile(r"cannabis|fossil fuel|gambling|predatory|payday|tobacco|vaping"),
     "values_mismatch"),
    (re.compile(r"non-?tech|not a (software|tech|technology)"),
     "non_tech"),
    (re.compile(r"unknown|unrecognized|cannot verify|can't verify|no real knowledge"),
     "unknown_unverified"),
    (re.compile(r"early-?stage|limited (public )?track record|small.*(tech|engineering) footprint|very small"),
     "early_stage_risk"),
]
# Strings that are not real red flags — dropped entirely.
_DROP = re.compile(r"no (obvious )?red flags?|^\s*none\s*$")


def classify_red_flag(text: str) -> RedFlag | None:
    t = text.strip().lower()
    if not t or _DROP.search(t):
        return None
    for pattern, category in _RULES:
        if pattern.search(t):
            return RedFlag(category=category, note=text.strip())
    return RedFlag(category="other", note=text.strip())


def reclassify_flags(flags: list) -> list[dict]:
    """Map a red_flags array to the new shape. Idempotent: dict elements (already
    migrated) pass through unchanged. Non-flag strings are dropped."""
    out: list[dict] = []
    for f in flags or []:
        if isinstance(f, dict):
            out.append(f)
            continue
        rf = classify_red_flag(str(f))
        if rf is not None:
            out.append(rf.model_dump())
    return out


def main() -> None:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")
    from job_discovery import db as job_discovery_db  # shared connection factory
    conn = job_discovery_db.connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id, company_id, red_flags FROM company_reviews")
            rows = cur.fetchall()
        updated = 0
        for r in rows:
            new = reclassify_flags(r["red_flags"])
            if new == (r["red_flags"] or []):
                continue  # already migrated / nothing to change
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE company_reviews SET red_flags = %s "
                    "WHERE user_id = %s AND company_id = %s",
                    (Json(new), r["user_id"], r["company_id"]),
                )
            updated += 1
        conn.commit()
        log.info("reclassified red_flags on %s of %s company_reviews rows", updated, len(rows))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
