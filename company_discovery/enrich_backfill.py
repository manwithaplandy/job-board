"""One-time backfill: populate companies.display_name / about / about_source and
stamp enriched_at from the free ATS-board metadata the poller already fetches, so
the screener can re-run against real grounding text (T2's
`enriched_at > company_reviews.reviewed_at` predicate re-queues enriched companies).

Run against a database:  DATABASE_URL=... python -m company_discovery.enrich_backfill

Scope: UNKNOWNS ONLY — companies not yet enriched (enriched_at IS NULL) whose
effective verdict is 'unknown' (an un-classified company that grounding could
rescue; a company with no review at all is effectively 'unknown'). Currently
active/included companies are deliberately left untouched so the re-screen does
not churn the active set. Already-enriched rows (enriched_at set) are
excluded, so the run is resumable/idempotent and a later pass retries any board
that was transiently dead. Guarding on enriched_at (not display_name) matters
because a JD-probe/about-only success returns no name, so it never sets
display_name — a display_name guard would re-probe and re-stamp it forever
(re-queuing a needless LLM re-screen); a dead board writes nothing, so its
enriched_at stays NULL and it is correctly retried.

The per-row decision (plan_enrichment) and persistence (apply_enrichment) live in
company_discovery/enrich_apply.py, shared verbatim with the standing cron stage
(enrich_selected) so both ground companies through byte-identical logic.

ROLLOUT ARTIFACT — must NOT be run against the production DB during feature
development; the operator runs it at rollout.
"""
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from company_discovery.enrich_apply import MAX_WORKERS, apply_enrichment, plan_enrichment

log = logging.getLogger("enrich_backfill")

# Commit cadence (rows written) so a long run is durable and resumable.
_COMMIT_EVERY = 50

# UNKNOWNS-ONLY: a company qualifies if ANY user's effective verdict is 'unknown',
# or it has no review at all (COALESCE default 'unknown'). Currently-active/included
# companies are deliberately NOT re-evaluated — enriching + re-screening them could
# churn the active set, so we only rescue the unclassified. DISTINCT collapses the
# per-review fan-out. Mirrors the effective-verdict COALESCE pattern in
# company_discovery/db.reconcile_active (here defaulting to 'unknown' instead of
# 'exclude'). enriched_at IS NULL makes it resumable/idempotent — an about-only /
# JD-probe success (which leaves display_name NULL) still gets an enriched_at stamp,
# so it is not re-selected and re-screened on a later run.
_SCOPE_SQL = """
    SELECT DISTINCT c.id, c.name, c.ats, c.token
    FROM companies c
    LEFT JOIN company_reviews r ON r.company_id = c.id
    WHERE c.enriched_at IS NULL
      AND COALESCE(
            CASE WHEN r.human_override THEN r.override_verdict ELSE r.verdict END,
            'unknown') = 'unknown'
"""


def select_to_enrich(conn) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(_SCOPE_SQL)
        return cur.fetchall()


def main() -> None:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")
    from job_discovery import db as job_discovery_db  # shared connection factory
    conn = job_discovery_db.connect()
    try:
        rows = select_to_enrich(conn)
        log.info("enrichment scope: %s companies (enriched_at IS NULL, effective verdict unknown)",
                 len(rows))
        updated = 0
        # Board fetches (HTTP) run concurrently across a small thread pool; the DB
        # writes stay on the main thread — one psycopg connection must not be shared
        # across threads.
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            futures = {pool.submit(plan_enrichment, r["ats"], r["token"]): r for r in rows}
            for fut in as_completed(futures):
                row = futures[fut]
                plan = fut.result()  # plan_enrichment never raises (it skips instead)
                if plan is None:
                    continue
                apply_enrichment(conn, row["id"], plan)
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
