import logging

from job_discovery.http import get_json
from job_discovery.models import Posting
from job_discovery.normalize import detect_remote

log = logging.getLogger("job_discovery")

# Workable's listing returns only summaries (no JD), so the full description is
# read from a per-job detail call. `paging.next` is a server-provided cursor URL;
# cap the walk so a misbehaving cursor can never loop forever.
_PAGE_CAP = 50


def _location_str(loc: dict | None) -> str | None:
    if not loc:
        return None
    parts = [loc.get("city"), loc.get("region"), loc.get("country")]
    joined = ", ".join(p for p in parts if p)
    return joined or None


def _department(detail: dict) -> str | None:
    # Workable exposes `department` as either a string or a list of strings
    # depending on account configuration; take the first usable value.
    dept = detail.get("department")
    if isinstance(dept, list):
        return next((d for d in dept if d), None)
    return dept or None


def _explicit_remote(loc: dict | None) -> bool | None:
    if not loc:
        return None
    if loc.get("telecommuting") is True:
        return True
    workplace = loc.get("workplace_type")
    if workplace == "remote":
        return True
    if workplace in ("on-site", "hybrid"):
        return False
    if loc.get("telecommuting") is False:
        return False
    return None


def parse_workable_job(detail: dict) -> Posting:
    """Map a Workable SPI job-detail payload to the internal Posting model."""
    loc = detail.get("location") or {}
    location = _location_str(loc)
    return Posting(
        external_id=str(detail["shortcode"]),
        title=detail.get("title") or detail.get("full_title"),
        # `application_url` is the hosted apply page (apply.workable.com); fall
        # back to the public shortlink and finally the SPI self URL.
        url=detail.get("application_url") or detail.get("shortlink") or detail.get("url"),
        location=location,
        department=_department(detail),
        remote=detect_remote(location, _explicit_remote(loc)),
        raw=detail,
    )


def fetch_workable(token: str) -> list[Posting]:
    base = f"https://{token}.workable.com/spi/v3"
    url: str | None = f"{base}/jobs?state=published"
    postings: list[Posting] = []
    pages = 0
    while url and pages < _PAGE_CAP:
        page = get_json(url)
        for j in page.get("jobs", []):
            shortcode = j.get("shortcode")
            if not shortcode:
                continue
            try:
                detail = get_json(f"{base}/jobs/{shortcode}")
            except Exception:  # one bad detail must not sink the whole board
                log.warning("workable: detail fetch failed for %s/%s", token, shortcode)
                continue
            postings.append(parse_workable_job(detail))
        url = (page.get("paging") or {}).get("next")
        pages += 1
    return postings
