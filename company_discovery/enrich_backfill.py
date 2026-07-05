"""One-time backfill: populate companies.display_name / about / about_source and
stamp enriched_at from the free ATS-board metadata the poller already fetches, so
the screener can re-run against real grounding text (T2's
`enriched_at > company_reviews.reviewed_at` predicate re-queues enriched companies).

Run against a database:  DATABASE_URL=... python -m company_discovery.enrich_backfill

Scope: companies not yet enriched (enriched_at IS NULL) that are still worth
screening — either active, or whose effective verdict is 'unknown' (an
un-classified company that grounding could rescue; a company with no review at
all is effectively 'unknown'). Already-enriched rows (enriched_at set) are
excluded, so the run is resumable/idempotent and a later pass retries any board
that was transiently dead. Guarding on enriched_at (not display_name) matters
because a JD-probe/about-only success returns no name, so it never sets
display_name — a display_name guard would re-probe and re-stamp it forever
(re-queuing a needless LLM re-screen); a dead board writes nothing, so its
enriched_at stays NULL and it is correctly retried.

ROLLOUT ARTIFACT — must NOT be run against the production DB during feature
development; the operator runs it at rollout.
"""
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import NamedTuple

from company_discovery.enrich import ENRICHERS, JD_PROBE_ATS, enrich_from_jd

log = logging.getLogger("enrich_backfill")

# The poller shares this process's egress IP; keep board-fetch concurrency small.
_MAX_WORKERS = 5
# Commit cadence (rows written) so a long run is durable and resumable.
_COMMIT_EVERY = 50


class EnrichUpdate(NamedTuple):
    display_name: str | None
    about: str | None
    about_source: str


# Un-scoped LEFT JOIN: a company qualifies if it is active, OR ANY user's effective
# verdict is 'unknown', OR it has no review at all (COALESCE default 'unknown').
# DISTINCT collapses the per-review fan-out. Mirrors the effective-verdict COALESCE
# pattern in company_discovery/db.reconcile_active (here defaulting to 'unknown'
# instead of 'exclude'). enriched_at IS NULL makes it resumable/idempotent — an
# about-only / JD-probe success (which leaves display_name NULL) still gets an
# enriched_at stamp, so it is not re-selected and re-screened on a later run.
_SCOPE_SQL = """
    SELECT DISTINCT c.id, c.name, c.ats, c.token
    FROM companies c
    LEFT JOIN company_reviews r ON r.company_id = c.id
    WHERE c.enriched_at IS NULL
      AND (c.active
           OR COALESCE(
                CASE WHEN r.human_override THEN r.override_verdict ELSE r.verdict END,
                'unknown') = 'unknown')
"""

_UPDATE_SQL = (
    "UPDATE companies SET display_name = COALESCE(%s, display_name), about = %s, "
    "about_source = %s, enriched_at = now() WHERE id = %s"
)


def select_to_enrich(conn) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(_SCOPE_SQL)
        return cur.fetchall()


def plan_enrichment(ats: str, token: str) -> EnrichUpdate | None:
    """Pure per-row decision (DB-free; it does perform the board fetch): pick the
    enricher for `ats`, call it, and map the result to an UPDATE spec — or None to
    skip. A skip (unsupported ats, dead board / adapter error, or an empty result)
    writes nothing, so a later pass can retry a transiently-dead board.

    Safe to call from a worker thread: it only touches the shared, thread-safe
    httpx client via the enrichers; no DB handle is involved."""
    if ats in ENRICHERS:
        source, fetch, args = "ats_board", ENRICHERS[ats], (token,)
    elif ats in JD_PROBE_ATS:
        source, fetch, args = "jd_probe", enrich_from_jd, (ats, token)
    else:
        return None
    try:
        display_name, about = fetch(*args)
    except Exception as exc:  # 404 / dead board / malformed body -> skip, no write
        log.warning("enrich %s/%s failed (%s: %s); skipping",
                    ats, token, type(exc).__name__, exc)
        return None
    if display_name is None and about is None:
        return None
    return EnrichUpdate(display_name, about, source)


def _apply(conn, company_id, plan: EnrichUpdate) -> None:
    with conn.cursor() as cur:
        cur.execute(_UPDATE_SQL,
                    (plan.display_name, plan.about, plan.about_source, company_id))


def main() -> None:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")
    from job_discovery import db as job_discovery_db  # shared connection factory
    conn = job_discovery_db.connect()
    try:
        rows = select_to_enrich(conn)
        log.info("enrichment scope: %s companies (enriched_at IS NULL, active-or-unknown)",
                 len(rows))
        updated = 0
        # Board fetches (HTTP) run concurrently across a small thread pool; the DB
        # writes stay on the main thread — one psycopg connection must not be shared
        # across threads.
        with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
            futures = {pool.submit(plan_enrichment, r["ats"], r["token"]): r for r in rows}
            for fut in as_completed(futures):
                row = futures[fut]
                plan = fut.result()  # plan_enrichment never raises (it skips instead)
                if plan is None:
                    continue
                _apply(conn, row["id"], plan)
                updated += 1
                if updated % _COMMIT_EVERY == 0:
                    conn.commit()
                    log.info("enriched %s companies so far", updated)
        conn.commit()
        log.info("enrichment complete: updated %s of %s companies", updated, len(rows))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
