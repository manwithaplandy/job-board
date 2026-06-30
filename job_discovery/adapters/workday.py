import logging

from job_discovery.http import get_json, post_json
from job_discovery.models import Posting
from job_discovery.normalize import detect_remote

log = logging.getLogger("job_discovery")

# Workday's cxs `/jobs` is a POST search paged with offset/limit against `total`;
# 20 is the page size the public career-site UI uses.
_PAGE_LIMIT = 20

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


def _explicit_remote(remote_type: str | None) -> bool | None:
    if not remote_type:
        return None
    return "remote" in remote_type.lower()


def parse_workday_job(item: dict, detail: dict, *, host: str, site: str) -> Posting:
    """Map a Workday cxs (listing item, job detail) pair to the internal model.

    `externalPath` (the stable per-posting path from the listing, e.g.
    `/job/San-Francisco/Engineer_R-123`) is the external id: it is always present
    and uniquely identifies the posting. A title change rotates the slug and thus
    the id (looks like close+reopen) — an accepted edge versus the slug-free ids
    the other ATSes expose.
    """
    info = detail.get("jobPostingInfo") or {}
    external_path = item.get("externalPath")
    location = item.get("locationsText") or info.get("location")
    # The detail payload carries the authoritative public job-page URL; fall back
    # to constructing it from the path (best-effort — omits any locale segment).
    # TODO(live-validation): this fallback drops the locale segment (e.g. /en-US/)
    # that real Workday job pages carry, so it may 404. The correct locale is
    # tenant/region-specific, so it is deliberately NOT hardcoded here pending live
    # validation.
    url = info.get("externalUrl")
    if not url and external_path:
        url = f"https://{host}/{site}{external_path}"
    return Posting(
        external_id=str(external_path),
        title=info.get("title") or item.get("title"),
        url=url,
        location=location,
        department=None,  # not exposed by the public cxs read endpoints
        remote=detect_remote(location, _explicit_remote(info.get("remoteType"))),
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
    while True:
        page = post_json(
            f"{cxs}/jobs",
            json={"appliedFacets": {}, "limit": _PAGE_LIMIT, "offset": offset,
                  "searchText": ""},
        )
        items = page.get("jobPostings") or []
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
        # Page while a FULL page comes back and stop on a short/empty one. The
        # `total` count is only an *additional* stop signal when it is a positive
        # number — a missing/null/zero total must NOT end paging, which previously
        # truncated after page 1 and triggered false closures.
        offset += _PAGE_LIMIT
        total = page.get("total")
        full_page = len(items) == _PAGE_LIMIT
        reached_total = isinstance(total, int) and total > 0 and offset >= total
        if not full_page or reached_total:
            break
    return postings
