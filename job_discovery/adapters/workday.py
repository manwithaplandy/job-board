import logging

from job_discovery.http import get_json, post_json
from job_discovery.models import Posting
from job_discovery.normalize import detect_remote

log = logging.getLogger("job_discovery")

# Workday's cxs `/jobs` is a POST search paged with offset/limit; 20 is the page
# size the public career-site UI uses AND the hard ceiling — a `limit` above 20
# returns HTTP 400, so this is fixed, not just a default.
_PAGE_LIMIT = 20

# Workday HARD-CAPS paged results at 2000 postings *per query*. Past the cap an
# `offset` >= 2000 does NOT return an empty page — it WRAPS back to a full page 1
# — and the `total` field is unreliable (it caps at 2000 and is known to flap to
# 0 on the last legitimate pages). So `total` is never used as the primary stop
# signal of the unfaceted walk and we never page a single query past this ceiling.
_HARD_CAP = 2000

# --- Facet-partitioned crawl (reading tenants with >2000 postings) ---------
# Because each *query* caps at 2000, a tenant with >2000 live postings cannot be
# read by the plain unfaceted walk above. The cxs `/jobs` response carries
# `facets[]` (Job Category, Job Type, Time Type, Location…) and accepts an
# `appliedFacets` filter, so we partition the search into per-facet-value slices
# that each fall under the 2000 cap and union the results.
#
# Escalation is LAZY so small tenants stay cheap: we make one unfaceted offset-0
# call, derive the TRUE tenant total from a disjoint facet (see `_true_total`),
# and only if that exceeds the cap do we partition. Otherwise the original
# unfaceted walk runs unchanged.
#
# Key live-verified facts the crawl relies on:
#   * The unfaceted listing `total` is capped at 2000 and unreliable; the true
#     total = sum of a DISJOINT facet's value counts. `jobFamilyGroup` (Job
#     Category) is disjoint and its values are individually small, so it is the
#     primary partition; workerSubType / timeType are disjoint fallbacks.
#   * A filtered response's `total` is the partition's exact size when <2000, but
#     is itself capped at 2000 (and wraps past offset 2000) when the partition is
#     still too big — so an oversized partition is recursively sub-divided on a
#     finer facet read from its OWN response (its other facets carry within-subset
#     counts). Location facets OVERLAP, so results are de-duplicated.
#   * DEDUP is by `externalPath` (stable, unique); it absorbs facet overlap and
#     any wrap duplicates so the union is exactly the set of distinct postings.
_MAX_FACET_DEPTH = 3

# Facets whose value counts are DISJOINT (each posting belongs to exactly one
# value), so summing them recovers the true tenant total the listing `total`
# caps at 2000. Tried in order; the first present in the response wins.
_DISJOINT_TOTAL_FACETS = ("jobFamilyGroup", "workerSubType", "timeType")

# The facet to partition an oversized tenant by: disjoint and individually small.
_PARTITION_FACET = "jobFamilyGroup"

# --- Token encoding -------------------------------------------------------
# A Workday career site is identified by THREE coordinates: the tenant, the
# data-center label (wd1, wd3, wd5, wd103, …) and the site id. The company model
# only carries a single `token`, so we pack all three into it as a
# colon-delimited triple:
#
#       token = "{tenant}:{datacenter}:{site}"   e.g.  "acme:wd5:External"
#
# from which we reconstruct:
#       host = "{tenant}.{datacenter}.myworkdayjobs.com"
#       cxs  = "https://{host}/wday/cxs/{tenant}/{site}"
#
# LIMITATIONS (documented per the phase spec; live validation still required):
#   * This assumes the standard `*.myworkdayjobs.com` host that backs the public
#     cxs READ API. A handful of tenants front the career site with a vanity
#     domain; those are NOT representable in this token form and would need a
#     host-bearing token. `_parse_token` raises on a malformed token so we never
#     silently emit broken rows.
#   * The `site` segment is case-sensitive in Workday URLs, so Workday companies
#     must be added via the case-preserving seed/targets path. The dataset
#     ingestion path lower-cases tokens for the slug-style ATSes and is therefore
#     not a safe entry point for Workday (see company_discovery/dataset.py).


def _parse_token(token: str) -> tuple[str, str, str]:
    parts = token.split(":")
    if len(parts) != 3 or not all(p.strip() for p in parts):
        raise ValueError(
            "workday token must be 'tenant:datacenter:site' "
            f"(e.g. 'acme:wd5:External'); got {token!r}"
        )
    tenant, datacenter, site = (p.strip() for p in parts)
    return tenant, datacenter, site


def _remote_signal(additional_locations: list | None, external_path: str | None) -> bool | None:
    """Infer remoteness from the detail's additionalLocations[] and the URL slug.

    Workday's public cxs detail carries NO boolean remote flag, so the only
    machine-readable signals are the location strings and the externalPath slug,
    which literally contains "Remote" for remote postings (e.g.
    `/job/US-CA-Remote/...`). Returns True when any of those mention "remote",
    else None — leaving the primary location string to drive detect_remote.
    """
    blob = " ".join(p for p in [*(additional_locations or []), external_path] if p)
    return detect_remote(blob)  # True if it matches /remote/i, else None


def parse_workday_job(item: dict, detail: dict, *, host: str, site: str) -> Posting:
    """Map a Workday cxs (listing item, job detail) pair to the internal model.

    `externalPath` (the stable per-posting path from the listing, e.g.
    `/job/San-Francisco/Engineer_R-123`) is the external id: it is always present
    and uniquely identifies the posting. NOTE: `jobReqId` / `bulletFields[0]`
    (e.g. "JR1999579") is a *more stable* id — a title change rotates the slug
    and thus this id (looks like close+reopen) — but externalPath is kept here so
    existing rows stay stable.
    """
    info = detail.get("jobPostingInfo") or {}
    external_path = item.get("externalPath")
    additional = info.get("additionalLocations") or []
    # The detail's jobPostingInfo.location (+ additionalLocations[]) is the
    # authoritative location; the listing's locationsText is unreliable for
    # multi-location jobs, where it degrades to a bare count like "13 Locations".
    location = info.get("location") or item.get("locationsText")
    # Prefer the detail's canonical public URL; fall back to host/site/path. Both
    # forms are live-confirmed identical and both resolve (the public job page is
    # a client-rendered SPA), so no locale segment is needed.
    url = info.get("externalUrl")
    if not url and external_path:
        url = f"https://{host}/{site}{external_path}"
    return Posting(
        external_id=str(external_path),
        title=info.get("title") or item.get("title"),
        url=url,
        location=location,
        department=None,  # not exposed by the public cxs read endpoints
        remote=detect_remote(location, _remote_signal(additional, external_path)),
        raw=detail,
    )


def _minimal_posting(item: dict, *, host: str, site: str) -> Posting | None:
    """Build a bare Posting from a listing item when the detail fetch/parse fails.

    Keeping the posting (rather than dropping it) preserves the job in run.py's
    seen-set so close-detection does not falsely close a still-open job.
    `externalPath` is the same value `parse_workday_job` uses for the external id,
    and the URL is the same best-effort host/site/path fallback the parser builds.
    Returns None only if no externalPath is available.
    """
    external_path = item.get("externalPath")
    if not external_path:
        return None
    return Posting(
        external_id=str(external_path),
        title=item.get("title"),
        url=f"https://{host}/{site}{external_path}",
        location=item.get("locationsText"),
        raw=item,
    )


def _post_jobs(cxs: str, applied_facets: dict, offset: int) -> dict:
    """POST one `/jobs` search page with the given `appliedFacets` filter."""
    return post_json(
        f"{cxs}/jobs",
        json={"appliedFacets": applied_facets, "limit": _PAGE_LIMIT,
              "offset": offset, "searchText": ""},
    )


def _iter_candidate_facets(facets: list | None):
    """Yield (facetParameter, values) for every *selectable* facet in a response.

    Descends into group wrappers (e.g. `locationMainGroup`, whose values are
    themselves facets like `locationHierarchy1` / `locations`) so nested location
    facets become available as sub-dividers. A facet is selectable when its
    values carry an `id` to filter on; a wrapper whose values are themselves
    facets is recursed into, not yielded.
    """
    for facet in facets or []:
        values = facet.get("values") or []
        param = facet.get("facetParameter")
        if values and all(
            isinstance(v, dict) and "facetParameter" in v for v in values
        ):
            yield from _iter_candidate_facets(values)
            continue
        if param and values:
            yield param, values


def _facet_values(facets: list | None, parameter: str) -> list:
    """Return the values[] of the facet named `parameter`, or [] if absent."""
    for param, values in _iter_candidate_facets(facets):
        if param == parameter:
            return values
    return []


def _true_total(facets: list | None, listing_total: int | None) -> int:
    """Recover the true tenant total from a disjoint facet's value counts.

    The unfaceted listing `total` is capped at 2000, but a disjoint facet's
    counts sum to the real total. Try jobFamilyGroup, then workerSubType, then
    timeType; fall back to the (capped, possibly-missing) listing `total` only
    when the response carries no facets to count.
    """
    for parameter in _DISJOINT_TOTAL_FACETS:
        values = _facet_values(facets, parameter)
        if values:
            return sum(v.get("count") or 0 for v in values)
    return listing_total or 0


def _choose_subdivider(
    facets: list | None, applied_keys: set[str]
) -> tuple[str, list] | None:
    """Pick the best facet to sub-divide an oversized (>=cap) partition.

    A candidate is any selectable facet not already applied whose LARGEST value
    count is < the hard cap (so every child slice is individually reachable).
    Among candidates pick the one with the smallest max-count — the tightest
    split, which keeps the most headroom under the cap and fans out the least.
    Returns (facetParameter, values) or None when nothing splits it below the cap.
    """
    best: tuple[int, str, list] | None = None
    for param, values in _iter_candidate_facets(facets):
        if param in applied_keys:
            continue
        counts = [v.get("count") or 0 for v in values if v.get("id")]
        if not counts:
            continue
        max_count = max(counts)
        if max_count >= _HARD_CAP:
            continue  # a value still over the cap -> useless as a splitter
        if best is None or max_count < best[0]:
            best = (max_count, param, values)
    return None if best is None else (best[1], best[2])


def _ingest_items(
    items: list, sink: dict[str, Posting], *, cxs: str, host: str, site: str
) -> None:
    """Fetch+parse each listing item into `sink`, keyed by externalPath (dedup).

    This is the per-page work shared by the unfaceted walk and the faceted crawl:
    skip items already seen (facet overlap / wrap), fetch the detail and parse
    inside a try (a malformed HTTP-200 body must not abort the tenant), and fall
    back to a minimal posting when the detail is unavailable so the job is not
    dropped from run.py's seen-set.
    """
    for item in items:
        external_path = item.get("externalPath")
        if not external_path or external_path in sink:
            continue  # missing id, or already ingested via another facet/page
        try:
            # externalPath already begins with `/job/...`, so it appends directly
            # onto the cxs base. Both the fetch and the parse live inside the try.
            detail = get_json(f"{cxs}{external_path}")
            posting = parse_workday_job(item, detail, host=host, site=site)
        except Exception:  # detail unavailable/unparseable: keep, don't drop
            log.warning(
                "workday: detail unavailable for %s%s; keeping minimal posting",
                host, external_path,
            )
            posting = _minimal_posting(item, host=host, site=site)
        if posting is not None:
            sink[external_path] = posting


def _page_walk(
    cxs: str,
    applied_facets: dict,
    first_page: dict,
    sink: dict[str, Posting],
    *,
    host: str,
    site: str,
) -> None:
    """Wrap-guarded, hard-capped offset paging (the original unfaceted walk).

    `first_page` is the already-fetched offset-0 response, so the caller's
    facet-probing call is reused rather than repeated. Stops on an empty page, a
    wrap back to page 1, a short page, or the 2000 hard cap — `total` is never
    the primary stop signal. Used for both the unfaceted path and the
    can't-sub-divide fallback of an oversized partition.
    """
    page = first_page
    offset = 0
    first_path: str | None = None
    while True:
        items = page.get("jobPostings") or []
        if not items:
            break  # genuinely empty page -> end of results
        # Wrap guard: past the 2000 hard cap Workday wraps back to page 1 rather
        # than returning empty, so if a later page repeats page 1's first posting
        # we've wrapped — stop BEFORE re-ingesting duplicates.
        this_first = items[0].get("externalPath")
        if offset == 0:
            first_path = this_first
        elif this_first is not None and this_first == first_path:
            break
        _ingest_items(items, sink, cxs=cxs, host=host, site=site)
        offset += _PAGE_LIMIT
        if offset >= _HARD_CAP:
            break  # hard cap: never page a single query past the 2000 ceiling
        if len(items) < _PAGE_LIMIT:
            break  # short page -> end of results
        page = _post_jobs(cxs, applied_facets, offset)
        if "jobPostings" not in page:
            raise ValueError(f"workday response missing 'jobPostings' key")


def _crawl(
    cxs: str,
    applied_facets: dict,
    sink: dict[str, Posting],
    *,
    host: str,
    site: str,
    depth: int,
) -> None:
    """Crawl one facet partition: page it when reachable, else sub-divide.

    Reads offset 0 first to learn the partition's `total` (reliable only at
    offset 0). When total < cap the partition is fully reachable, so page
    0,20,…,until offset >= total (the offset-0 total is the exact ceiling). When
    total >= cap the partition is itself capped/wrapping, so recurse on a finer
    facet read from THIS response. `depth` bounds the recursion; at the limit (or
    when no facet splits it below the cap) we page what we can up to the hard cap
    and warn that the tail is unreadable.
    """
    first = _post_jobs(cxs, applied_facets, 0)
    if "jobPostings" not in first:
        raise ValueError(f"workday response missing 'jobPostings' key")
    total = first.get("total") or 0
    # Total-flap fallback: total=0 but the page has items → Workday is reporting a
    # stale/flapped total. Use the wrap-guarded _page_walk (which never relies on
    # `total` as a stop signal) to keep paging until the genuine end of results.
    if not total and first.get("jobPostings"):
        _page_walk(cxs, applied_facets, first, sink, host=host, site=site)
        return
    if total < _HARD_CAP:
        _ingest_items(first.get("jobPostings") or [], sink,
                      cxs=cxs, host=host, site=site)
        offset = _PAGE_LIMIT
        while offset < total:
            page = _post_jobs(cxs, applied_facets, offset)
            if "jobPostings" not in page:
                raise ValueError(f"workday response missing 'jobPostings' key")
            items = page.get("jobPostings") or []
            if not items:
                break
            _ingest_items(items, sink, cxs=cxs, host=host, site=site)
            offset += _PAGE_LIMIT
        return

    subdivider = (
        _choose_subdivider(first.get("facets"), set(applied_facets))
        if depth < _MAX_FACET_DEPTH
        else None
    )
    if subdivider is None:
        log.warning(
            "workday: partition %s on %s too large to fully enumerate "
            "(total>=%d, depth=%d); reading only the first %d",
            applied_facets, host, _HARD_CAP, depth, _HARD_CAP,
        )
        _page_walk(cxs, applied_facets, first, sink, host=host, site=site)
        return

    param, values = subdivider
    for value in values:
        vid = value.get("id")
        if not vid:
            continue
        _crawl(cxs, {**applied_facets, param: [vid]}, sink,
               host=host, site=site, depth=depth + 1)


def fetch_workday(token: str) -> list[Posting]:
    tenant, datacenter, site = _parse_token(token)
    host = f"{tenant}.{datacenter}.myworkdayjobs.com"
    cxs = f"https://{host}/wday/cxs/{tenant}/{site}"
    sink: dict[str, Posting] = {}  # externalPath -> Posting (dedup across facets)

    # One unfaceted offset-0 probe drives the escalation decision and doubles as
    # page 1 of the unfaceted walk (so a small tenant costs no extra call).
    first = _post_jobs(cxs, {}, 0)
    if "jobPostings" not in first:
        raise ValueError(f"workday response missing 'jobPostings' key")
    facets = first.get("facets")
    true_total = _true_total(facets, first.get("total"))
    partition = _facet_values(facets, _PARTITION_FACET)

    if true_total <= _HARD_CAP or not partition:
        # Small tenant (or no facet to partition by): the original unfaceted walk,
        # bounded by the wrap-guard/hard-cap safety net, reads everything.
        _page_walk(cxs, {}, first, sink, host=host, site=site)
    else:
        # >2000 postings: partition by jobFamilyGroup and crawl each slice,
        # sub-dividing any slice that is itself over the cap.
        log.info(
            "workday: %s has ~%d postings (> %d cap); facet-partitioning by %s "
            "into %d slices",
            host, true_total, _HARD_CAP, _PARTITION_FACET, len(partition),
        )
        for value in partition:
            vid = value.get("id")
            if not vid:
                continue
            _crawl(cxs, {_PARTITION_FACET: [vid]}, sink,
                   host=host, site=site, depth=1)
        # Some postings belong to NO jobFamilyGroup facet value and therefore never
        # appear in any per-facet slice. Walk the full unfaceted feed one more time
        # (using the already-fetched first page) so these postings are ingested.
        # The dedup-by-externalPath sink ensures facet-overlapping postings are not
        # re-fetched or double-counted.
        _page_walk(cxs, {}, first, sink, host=host, site=site)

    return list(sink.values())
