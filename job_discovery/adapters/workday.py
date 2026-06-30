import logging

from job_discovery.http import get_json, post_json
from job_discovery.models import Posting
from job_discovery.normalize import detect_remote

log = logging.getLogger("job_discovery")

# Workday's cxs `/jobs` is a POST search paged with offset/limit; 20 is the page
# size the public career-site UI uses.
_PAGE_LIMIT = 20

# Workday HARD-CAPS paged results at 2000 postings. Past the cap an `offset`
# >= 2000 does NOT return an empty page — it WRAPS back to a full page 1 — and
# the `total` field is unreliable (it caps at 2000 and is known to flap to 0 on
# the last legitimate pages). So `total` is never used as the primary stop
# signal and we never page past this ceiling.
# LIMITATION: a tenant with >2000 live postings needs facet-partitioned queries
# (split the search by a jobFamilyGroup / location facet and union the results)
# to read the tail. That is NOT implemented here — this adapter reads the first
# 2000 postings; faceting is left as future work.
_HARD_CAP = 2000

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


def fetch_workday(token: str) -> list[Posting]:
    tenant, datacenter, site = _parse_token(token)
    host = f"{tenant}.{datacenter}.myworkdayjobs.com"
    cxs = f"https://{host}/wday/cxs/{tenant}/{site}"
    postings: list[Posting] = []
    offset = 0
    first_path: str | None = None
    while True:
        page = post_json(
            f"{cxs}/jobs",
            json={"appliedFacets": {}, "limit": _PAGE_LIMIT, "offset": offset,
                  "searchText": ""},
        )
        items = page.get("jobPostings") or []
        if not items:
            break  # genuinely empty page -> end of results
        # Wrap guard: past the 2000 hard cap Workday wraps back to page 1 rather
        # than returning empty, so if a later page repeats page 1's first posting
        # we've wrapped — stop BEFORE re-ingesting duplicates. (`total` is not a
        # reliable stop signal here; see the _HARD_CAP note above.)
        this_first = items[0].get("externalPath")
        if offset == 0:
            first_path = this_first
        elif this_first is not None and this_first == first_path:
            break
        for item in items:
            external_path = item.get("externalPath")
            if not external_path:
                continue
            try:
                # externalPath already begins with `/job/...`, so it appends
                # directly onto the cxs base. Both the fetch and the parse live
                # inside the try: a malformed HTTP-200 detail body must not abort
                # the whole tenant fetch.
                detail = get_json(f"{cxs}{external_path}")
                posting = parse_workday_job(item, detail, host=host, site=site)
            except Exception:  # detail unavailable/unparseable: keep, don't drop
                log.warning(
                    "workday: detail unavailable for %s%s; keeping minimal posting",
                    host, external_path,
                )
                posting = _minimal_posting(item, host=host, site=site)
            if posting is not None:
                postings.append(posting)
        offset += _PAGE_LIMIT
        if offset >= _HARD_CAP:
            break  # hard cap: never page past Workday's 2000-result ceiling
        if len(items) < _PAGE_LIMIT:
            break  # short page -> end of results
    return postings
