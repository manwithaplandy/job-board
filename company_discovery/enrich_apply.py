"""Shared company-enrichment logic: the per-row board-fetch decision
(plan_enrichment) and its persistence (apply_enrichment). Used by BOTH the
one-time backfill (enrich_backfill.py) and the standing cron stage
(enrich_selected, called from company_discovery/run.py). Keeping it here means the
backfill and the cron ground companies through byte-identical logic."""
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import NamedTuple

from company_discovery.enrich import ENRICHERS, JD_PROBE_ATS, enrich_from_jd

log = logging.getLogger("company_discovery.enrich")

# Board fetches share the poller's egress IP; keep concurrency small.
MAX_WORKERS = 5


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
    with conn.cursor() as cur:
        cur.execute(_UPDATE_SQL,
                    (plan.display_name, plan.about, plan.about_source, company_id))


def enrich_selected(conn, candidates: list[dict], *,
                    max_workers: int = MAX_WORKERS) -> int:
    """Ground every selected company still lacking enrichment (enriched_at IS NULL):
    fetch board metadata, persist it, and patch the in-memory candidate dict
    (display_name/about) so THIS run's review sees the grounding without a re-query.
    Returns the number of companies enriched.

    Dead boards / unsupported ATSes skip silently (plan_enrichment never raises): that
    company is reviewed ungrounded this run and its enriched_at stays NULL, so it is
    retried only when it next becomes stale (a company reviewed under the current
    profile version is not re-selected — there is no per-run re-probe storm).

    Board fetches (HTTP) run in a small thread pool — they share the poller's egress
    IP, so max_workers stays small. DB writes stay on the calling thread; one psycopg
    connection must not be shared across threads. Does not commit — the caller owns
    the transaction."""
    pending = [c for c in candidates if c.get("enriched_at") is None]
    if not pending:
        return 0
    enriched = 0
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(plan_enrichment, c["ats"], c["token"]): c for c in pending}
        for fut in as_completed(futures):
            c = futures[fut]
            plan = fut.result()  # plan_enrichment never raises (it skips instead)
            if plan is None:
                continue
            apply_enrichment(conn, c["id"], plan)
            # Mirror the UPDATE's COALESCE: display_name is only overwritten when the
            # board returned one (JD-probe returns None -> keep prior); about is always
            # set to the fetched value.
            if plan.display_name is not None:
                c["display_name"] = plan.display_name
            c["about"] = plan.about
            enriched += 1
    return enriched
