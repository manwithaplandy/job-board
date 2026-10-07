"""One-time backfill: populate companies.display_name for ACTIVE companies that
lack one, from free public ATS-board metadata (no LLM inference anywhere).

Run against a database:  DATABASE_URL=... python -m company_discovery.name_backfill

Scope: active AND display_name IS NULL — the set users actually see (jobs only
come from active companies; the dashboard renders COALESCE(display_name, name)).
Unknown/inactive companies keep getting names via the standing enrichment stage
when they are next selected for review.

Writes display_name ONLY — never about / about_source / enriched_at. Stamping
enriched_at here would re-queue every already-reviewed company for an LLM
re-screen (select_for_review re-selects on enriched_at > reviewed_at): cost and
verdict churn this backfill must not cause. The display_name IS NULL guard (in
both the scope query and the UPDATE) makes reruns idempotent; a dead board
writes nothing, so a rerun retries it.

ROLLOUT ARTIFACT — the operator runs it once at rollout; safe to rerun.
"""
import logging

from company_discovery.enrich import ENRICHERS, JD_PROBE_ATS, fetch_board_name
from company_discovery.enrich_apply import fetch_batches

log = logging.getLogger("name_backfill")

_SCOPE_SQL = ("SELECT id, ats, token FROM companies "
              "WHERE active AND display_name IS NULL")
_UPDATE_SQL = ("UPDATE companies SET display_name = %s "
               "WHERE id = %s AND display_name IS NULL")


def fetch_name(ats: str, token: str) -> str | None:
    """Name-only fetch for one company; never raises (returns None to skip, so a
    rerun retries). lever/ashby read the board page <title>; the JSON-API ATSes
    reuse the existing enrichers and keep only the name half."""
    try:
        if ats in JD_PROBE_ATS:
            return fetch_board_name(ats, token)
        if ats in ENRICHERS:
            return ENRICHERS[ats](token)[0]
    except Exception as exc:
        log.warning("name fetch %s/%s failed (%s: %s); skipping",
                    ats, token, type(exc).__name__, exc)
    return None


def main() -> None:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")
    from job_discovery import db as job_discovery_db  # shared connection factory
    conn = job_discovery_db.connect()
    try:
        with conn.cursor() as cur:
            cur.execute(_SCOPE_SQL)
            rows = cur.fetchall()
        log.info("backfill scope: %s active companies without display_name", len(rows))
        updated = 0
        conn.commit()  # Close the selection read before HTTP starts.
        for results in fetch_batches(rows, fetch_name):
            batch_updated = 0
            try:
                for row, name in results:
                    if name is None:
                        continue
                    with conn.cursor() as cur:
                        cur.execute(_UPDATE_SQL, (name, row["id"]))
                        batch_updated += cur.rowcount
                conn.commit()
            except BaseException:
                conn.rollback()
                raise
            updated += batch_updated
            log.info("named %s companies so far", updated)
        log.info("backfill complete: named %s of %s companies", updated, len(rows))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
