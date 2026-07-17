"""Raw-location resolution + nightly re-stamp.

locations is the permanent raw->canonicals cache. Rule pass first (gazetteer),
then a batched LLM pass for the leftovers (each element validated back through
the gazetteer), then a set-based re-stamp of jobs.location_canonicals. The
re-stamp runs every call, so a manual correction to a locations row propagates
on the next poll. LLM/API failure leaves those raws unmapped (retried next
run) — resolution must never fail the poll.
Spec: docs/superpowers/specs/2026-07-16-location-dedupe-design.md
"""
import asyncio
import json
import logging

from job_discovery.gazetteer import Resolved, resolve_fields, resolve_location

log = logging.getLogger("job_discovery.locations")

_NEW_RAWS_SQL = """
    SELECT DISTINCT j.location AS raw
    FROM jobs j
    LEFT JOIN locations l ON l.raw = j.location
    WHERE j.location IS NOT NULL AND j.location <> '' AND l.raw IS NULL
"""

# ON CONFLICT DO NOTHING: a concurrent run (or rerun after a partial commit)
# may have inserted the row already; first write wins, corrections go via
# source='manual' UPDATEs.
_INSERT_SQL = """
    INSERT INTO locations (raw, canonicals, components, source)
    VALUES (%s, %s, %s::jsonb, %s)
    ON CONFLICT (raw) DO NOTHING
"""

_STAMP_SQL = """
    UPDATE jobs SET location_canonicals = l.canonicals
    FROM locations l
    WHERE jobs.location = l.raw
      AND jobs.location_canonicals IS DISTINCT FROM l.canonicals
"""


def _component(r: Resolved) -> dict:
    return {"canonical": r.canonical, "kind": r.kind, "geonameid": r.geonameid,
            "country_code": r.country_code, "admin1_code": r.admin1_code}


def _insert(conn, raw: str, resolved: list[Resolved], source: str) -> None:
    with conn.cursor() as cur:
        cur.execute(_INSERT_SQL, (raw, [r.canonical for r in resolved],
                                  json.dumps([_component(r) for r in resolved]), source))


def _insert_unmappable(conn, raw: str) -> None:
    components = [{"canonical": raw, "kind": "unmappable", "geonameid": None,
                   "country_code": None, "admin1_code": None}]
    with conn.cursor() as cur:
        cur.execute(_INSERT_SQL, (raw, [raw], json.dumps(components), "llm"))


def stamp_jobs(conn) -> int:
    """Set-based re-stamp; returns rows updated. Cheap when nothing changed."""
    with conn.cursor() as cur:
        cur.execute(_STAMP_SQL)
        return cur.rowcount


def _validated(places) -> list[Resolved]:
    out: list[Resolved] = []
    for p in places:
        r = resolve_fields(p.city, p.state, p.country, p.remote)
        if r is not None and r not in out:
            out.append(r)
    return out


async def _llm_pass(conn, client, leftovers: list[str], counts: dict) -> None:
    """Batch the leftovers through the LLM under ONE event loop.

    A single asyncio.run wraps this coroutine so the client's httpx pool stays
    bound to one loop across every batch (per-batch asyncio.run would close the
    loop and break the pool on the next call). Batch-local counters fold into
    `counts` only AFTER that batch's commit, so a mid-batch throw can't inflate
    the returned counts past what was actually committed. Blocking the loop on
    the sync conn.commit() between batches is fine in this cron context.
    """
    from job_discovery.location_llm import BATCH_SIZE
    for start in range(0, len(leftovers), BATCH_SIZE):
        batch = leftovers[start:start + BATCH_SIZE]
        answers = await client.parse_batch(batch)
        batch_counts = {"llm": 0, "unmappable": 0}
        for i, raw in enumerate(batch):
            if i not in answers:
                continue  # unanswered -> retry on a later run
            resolved = _validated(answers[i])
            if resolved:
                _insert(conn, raw, resolved, "llm")
                batch_counts["llm"] += 1
            else:
                _insert_unmappable(conn, raw)
                batch_counts["unmappable"] += 1
        conn.commit()
        counts["llm"] += batch_counts["llm"]
        counts["unmappable"] += batch_counts["unmappable"]


def resolve_new_locations(conn, parse_client=None) -> dict:
    """Resolve every raw jobs.location that has no locations row, then re-stamp.

    Returns counts {'rule','llm','unmappable','stamped'}. Commits after the
    rule pass and after each LLM batch (durable and resumable, like
    name_backfill). An LLM element that fails gazetteer validation is dropped;
    a raw whose answered elements ALL fail (or that the model answers []) is
    stored unmappable; a raw the model doesn't answer, or any LLM/API error,
    leaves the raw absent so a later run retries it.
    """
    with conn.cursor() as cur:
        cur.execute(_NEW_RAWS_SQL)
        raws = [r["raw"] for r in cur.fetchall()]
    counts = {"rule": 0, "llm": 0, "unmappable": 0, "stamped": 0}
    leftovers: list[str] = []
    for raw in raws:
        resolved = resolve_location(raw)
        if resolved:
            _insert(conn, raw, resolved, "rule")
            counts["rule"] += 1
        else:
            leftovers.append(raw)
    conn.commit()

    if leftovers:
        try:
            from job_discovery.location_llm import LocationParseClient
            client = parse_client or LocationParseClient()
            asyncio.run(_llm_pass(conn, client, leftovers, counts))
        except Exception:
            conn.rollback()
            log.exception("location LLM pass failed; %s unresolved raws retry next run",
                          len(leftovers) - counts["llm"] - counts["unmappable"])

    counts["stamped"] = stamp_jobs(conn)
    conn.commit()
    log.info("locations: rule=%(rule)s llm=%(llm)s unmappable=%(unmappable)s "
             "stamped=%(stamped)s", counts)
    return counts
