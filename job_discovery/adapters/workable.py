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


def _minimal_posting(token: str, entry: dict) -> Posting | None:
    """Build a bare Posting from a listing entry when the detail fetch/parse fails.

    Keeping the posting (rather than dropping it) preserves the job in run.py's
    seen-set so close-detection does not falsely mark a still-open job as closed.
    `shortcode` is the same value `parse_workable_job` uses for the external id, so
    the row stays stable across runs; the apply page mirrors the `application_url`
    the detail parser prefers. Returns None only if no id is available.
    """
    shortcode = entry.get("shortcode")
    if not shortcode:
        return None
    return Posting(
        external_id=str(shortcode),
        title=entry.get("title"),
        url=f"https://apply.workable.com/{token}/j/{shortcode}/",
        raw=entry,
    )


def fetch_workable(token: str) -> list[Posting]:
    base = f"https://{token}.workable.com/spi/v3"
    # TODO(live-validation): /spi/v3 is the AUTHENTICATED Workable SPI and needs an
    # employer account token the http layer does not send, so this 401s for any real
    # company. The fix is Workable's PUBLIC job-board API, whose exact endpoint and
    # response shape cannot be verified without live access — do NOT swap in an
    # unverified endpoint (risks substituting another wrong one). Leave the parser
    # as-is pending live validation.
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
                # Both the fetch and the parse live inside the try: a malformed
                # HTTP-200 detail body must not abort the whole company fetch.
                detail = get_json(f"{base}/jobs/{shortcode}")
                posting = parse_workable_job(detail)
            except Exception:  # detail unavailable/unparseable: keep, don't drop
                log.warning(
                    "workable: detail unavailable for %s/%s; keeping minimal posting",
                    token, shortcode,
                )
                posting = _minimal_posting(token, j)
            if posting is not None:
                postings.append(posting)
        url = (page.get("paging") or {}).get("next")
        pages += 1
    return postings
