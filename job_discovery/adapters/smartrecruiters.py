import logging

from job_discovery.http import get_json
from job_discovery.models import Posting
from job_discovery.normalize import detect_remote

log = logging.getLogger("job_discovery")

# Postings are paged with offset/limit against `totalFound`; 100 is the API max.
# The full JD lives on the per-posting detail endpoint, not the listing.
_PAGE_LIMIT = 100


def _location_str(loc: dict | None) -> str | None:
    if not loc:
        return None
    parts = [loc.get("city"), loc.get("region"), loc.get("country")]
    joined = ", ".join(p for p in parts if p)
    return joined or None


def _department(detail: dict) -> str | None:
    # Large companies (e.g. Bosch) return `department: {}` and categorise the
    # role under `function` instead. Fall back to `function.label` so the
    # category is not needlessly null — both map to the same Posting.department.
    dept = (detail.get("department") or {}).get("label")
    if dept:
        return dept
    return (detail.get("function") or {}).get("label") or None


def _view_url(detail: dict) -> str | None:
    # `postingUrl` is the canonical, viewable job page (HTTP 200). `applyUrl`
    # (…?oga=true) is the apply form and 302->403s for non-browser clients, so
    # it is never used as the job URL. When `postingUrl` is absent, fall back to
    # the bare-id posting form (same safe shape as `_minimal_posting`).
    posting_url = detail.get("postingUrl")
    if posting_url:
        return posting_url
    company = (detail.get("company") or {}).get("identifier")
    pid = detail.get("id")
    if company and pid:
        return f"https://jobs.smartrecruiters.com/{company}/{pid}"
    return None


def _explicit_remote(loc: dict | None) -> bool | None:
    # Remote is `location.remote` only. `location.hybrid` is a separate bool
    # that the adapter intentionally does NOT treat as remote.
    remote = (loc or {}).get("remote")
    return remote if isinstance(remote, bool) else None


def parse_smartrecruiters_posting(detail: dict) -> Posting:
    """Map a SmartRecruiters posting-detail payload to the internal Posting."""
    loc = detail.get("location") or {}
    location = _location_str(loc)
    return Posting(
        external_id=str(detail["id"]),
        title=detail.get("name"),
        url=_view_url(detail),
        location=location,
        department=_department(detail),
        remote=detect_remote(location, _explicit_remote(loc)),
        raw=detail,
    )


def _minimal_posting(token: str, item: dict) -> Posting | None:
    """Build a bare Posting from a listing item when the detail fetch/parse fails.

    Keeping the posting (rather than dropping it) preserves the job in run.py's
    seen-set so close-detection does not falsely close a still-open job. `id`
    matches the external id `parse_smartrecruiters_posting` uses; the URL is the
    public posting-page form. Returns None only if no id is available.
    """
    pid = item.get("id")
    if not pid:
        return None
    return Posting(
        external_id=str(pid),
        title=item.get("name"),
        url=f"https://jobs.smartrecruiters.com/{token}/{pid}",
        raw=item,
    )


def fetch_smartrecruiters(token: str) -> list[Posting]:
    base = f"https://api.smartrecruiters.com/v1/companies/{token}/postings"
    postings: list[Posting] = []
    offset = 0
    while True:
        page = get_json(f"{base}?limit={_PAGE_LIMIT}&offset={offset}")
        content = page.get("content") or []
        for item in content:
            pid = item.get("id")
            if not pid:
                continue
            try:
                # Both the fetch and the parse live inside the try: a malformed
                # HTTP-200 detail body must not abort the whole company fetch.
                detail = get_json(f"{base}/{pid}")
                posting = parse_smartrecruiters_posting(detail)
            except Exception:  # detail unavailable/unparseable: keep, don't drop
                log.warning(
                    "smartrecruiters: detail unavailable for %s/%s; keeping minimal posting",
                    token, pid,
                )
                posting = _minimal_posting(token, item)
            if posting is not None:
                postings.append(posting)
        # Page while a FULL page comes back and stop on a short/empty one. The
        # `totalFound` count is only an *additional* stop signal when it is a
        # positive number — a missing/null/zero total must NOT end paging, which
        # previously truncated after page 1 and triggered false closures.
        offset += _PAGE_LIMIT
        total = page.get("totalFound")
        full_page = len(content) == _PAGE_LIMIT
        reached_total = isinstance(total, int) and total > 0 and offset >= total
        if not full_page or reached_total:
            break
    return postings
