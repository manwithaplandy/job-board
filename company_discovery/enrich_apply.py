"""Shared company-enrichment logic: the per-row board-fetch decision
(plan_enrichment) and its persistence (apply_enrichment). Used by BOTH the
one-time backfill (enrich_backfill.py) and the standing cron stage
(enrich_selected, called from company_discovery/run.py). Keeping it here means the
backfill and the cron ground companies through byte-identical logic."""
from job_discovery.archive.writers import public_write

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import NamedTuple

from company_discovery.enrich import ENRICHERS, JD_PROBE_ATS, enrich_from_jd

log = logging.getLogger("company_discovery.enrich")

# Board fetches share the poller's egress IP; keep concurrency small.
MAX_WORKERS = 5
FETCH_BATCH_SIZE = 50


class EnrichUpdate(NamedTuple):
    display_name: str | None
    about: str | None
    about_source: str


_UPDATE_SQL = (
    "UPDATE companies SET display_name = COALESCE(%s, display_name), about = %s, "
    "about_source = %s, enriched_at = now() WHERE id = %s"
)


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


def apply_enrichment(conn, company_id, plan: EnrichUpdate) -> None:
    """Persist one enrichment. Main-thread only — one psycopg connection must not
    be shared across threads."""
    with public_write(conn, 'companies'), conn.cursor() as cur:
        cur.execute(_UPDATE_SQL,
                    (plan.display_name, plan.about, plan.about_source, company_id))


def fetch_batches(rows, fetch, *, max_workers=MAX_WORKERS):
    """Finish every HTTP future in a bounded batch before exposing DB work.

    Callers close their read/write transaction before iterating and commit each
    returned batch before requesting another. At most 50 results/futures exist;
    a failed fetch remains a None result so successful peers still persist.
    """
    for start in range(0, len(rows), FETCH_BATCH_SIZE):
        batch = rows[start:start + FETCH_BATCH_SIZE]
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            futures = {pool.submit(fetch, r["ats"], r["token"]): r for r in batch}
            results = [(futures[f], f.result()) for f in as_completed(futures)]
        yield results


def enrich_selected(conn, candidates: list[dict], *,
                    max_workers: int = MAX_WORKERS, record_progress=None) -> int:
    """Fetch outside transactions, then persist up to 50 completed enrichments.

    Owns short batch commits, including closing the initial candidate read even
    when nothing needs enrichment. Failed boards remain unstamped and retryable.
    A DB failure rolls back only the current batch; earlier batches are durable.
    Optional record_progress(total) runs inside that same batch transaction, so
    its checkpoint and the enrichment writes commit or roll back together.
    """
    pending = [c for c in candidates if c.get("enriched_at") is None]
    conn.commit()
    enriched = 0
    for results in fetch_batches(pending, plan_enrichment, max_workers=max_workers):
        updated = []
        try:
            for c, plan in results:
                if plan is not None:
                    apply_enrichment(conn, c["id"], plan)
                    updated.append((c, plan))
            if record_progress is not None:
                record_progress(enriched + len(updated))
            conn.commit()
        except BaseException:
            conn.rollback()
            raise
        for c, plan in updated:
            if plan.display_name is not None:
                c["display_name"] = plan.display_name
            c["about"] = plan.about
        enriched += len(updated)
    return enriched
