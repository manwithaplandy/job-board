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
    return (detail.get("department") or {}).get("label") or None


def _explicit_remote(loc: dict | None) -> bool | None:
    remote = (loc or {}).get("remote")
    return remote if isinstance(remote, bool) else None


def parse_smartrecruiters_posting(detail: dict) -> Posting:
    """Map a SmartRecruiters posting-detail payload to the internal Posting."""
    loc = detail.get("location") or {}
    location = _location_str(loc)
    return Posting(
        external_id=str(detail["id"]),
        title=detail.get("name"),
        # `applyUrl` is the public apply ref; `postingUrl` is the posting page.
        url=detail.get("applyUrl") or detail.get("postingUrl"),
        location=location,
        department=_department(detail),
        remote=detect_remote(location, _explicit_remote(loc)),
        raw=detail,
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
                detail = get_json(f"{base}/{pid}")
            except Exception:  # one bad detail must not sink the whole company
                log.warning("smartrecruiters: detail fetch failed for %s/%s", token, pid)
                continue
            postings.append(parse_smartrecruiters_posting(detail))
        offset += _PAGE_LIMIT
        if not content or offset >= (page.get("totalFound") or 0):
            break
    return postings
