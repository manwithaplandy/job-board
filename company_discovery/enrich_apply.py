"""Shared company-enrichment logic: the per-row board-fetch decision
(plan_enrichment) and its persistence (apply_enrichment). Used by BOTH the
one-time backfill (enrich_backfill.py) and the standing cron stage
(enrich_selected, called from company_discovery/run.py). Keeping it here means the
backfill and the cron ground companies through byte-identical logic."""
import logging
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
