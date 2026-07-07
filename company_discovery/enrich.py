"""Per-ATS company enrichment: fetch the real display name + about text that the
job adapters already touch but discard. Reuses job_discovery.http.get_json/get_text
(retry/backoff, shared client) + job_discovery.jd.html_to_text/extract_description.

Each enricher returns (display_name, about) — (None, None) when the board yields
nothing usable. For lever/ashby the name comes from the public board page <title>
(their JSON APIs carry no org name); see fetch_board_name / enrich_from_jd. Callers
persist display_name/about/about_source and stamp enriched_at. The endpoints mirror
the corresponding job_discovery/adapters/*.py so enrichment hits the exact same
public, no-auth boards the poller already uses (greenhouse board-metadata is the
PARENT of the adapter's /jobs path; workable and smartrecruiters reuse the adapter's
own listing/detail endpoints).
"""
import logging
import re
from html import unescape

from job_discovery.adapters import ADAPTERS
from job_discovery.http import get_json, get_text
from job_discovery.jd import extract_description, html_to_text

log = logging.getLogger("company_discovery.enrich")

# Cap stored about text. The screener also truncates its <company_description>
# block at 2000 chars (company_discovery/llm.py), so anything longer is unused.
_ABOUT_MAX = 2000

# Cap stored display name. Board <title> text is untrusted external input into an
# uncapped TEXT column; this mirrors _ABOUT_MAX's role for the about-path.
_NAME_MAX = 200

# ATSes with no board-level name/about JSON endpoint — their company identity is
# derived from a one-shot probe of the job board (handled by enrich_from_jd, NOT the
# ENRICHERS table below): the about text comes from a posting's JD and the display
# name from the public board page <title> (see fetch_board_name / _BOARD_PAGES).
JD_PROBE_ATS = ("lever", "ashby")

# Public board pages for the JD-probe ATSes: their JSON APIs carry no org name,
# but the page <title> does. lever titles are the bare name ("PushPress", "CIC");
# ashby appends " Jobs" ("Modal Jobs").
_BOARD_PAGES = {
    "lever": "https://jobs.lever.co/{token}",
    "ashby": "https://jobs.ashbyhq.com/{token}",
}
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_JOBS_SUFFIX_RE = re.compile(r"\s+jobs\s*$", re.IGNORECASE)


def fetch_board_name(ats: str, token: str) -> str | None:
    """Company display name from the public job-board page <title>. Returns None
    for ATSes without a mapped page or when the page has no usable title; network
    failures propagate (callers guard)."""
    page = _BOARD_PAGES.get(ats)
    if page is None:
        return None
    m = _TITLE_RE.search(get_text(page.format(token=token)))
    if not m:
        return None
    title = _JOBS_SUFFIX_RE.sub("", unescape(m.group(1)).strip())
    return _clean(title[:_NAME_MAX])


def _clean(value: str | None) -> str | None:
    return (value or "").strip() or None


def _about(html: str | None) -> str | None:
    if not html:
        return None
    return html_to_text(html)[:_ABOUT_MAX] or None


def enrich_greenhouse(token: str) -> tuple[str | None, str | None]:
    # Parent of the adapter's `/jobs` path (job_discovery/adapters/greenhouse.py
    # fetches `/v1/boards/{token}/jobs?content=true`): the board root returns
    # {"name": ..., "content": <about html>}.
    data = get_json(f"https://boards-api.greenhouse.io/v1/boards/{token}")
    return _clean(data.get("name")), _about(data.get("content"))


def enrich_workable(token: str) -> tuple[str | None, str | None]:
    # Same no-auth widget the adapter uses (job_discovery/adapters/workable.py):
    # {"name", "description", "jobs": [...]}. The adapter keeps `jobs` and discards
    # the account-level name/description that we want here.
    data = get_json(
        f"https://apply.workable.com/api/v1/widget/accounts/{token}?details=true"
    )
    return _clean(data.get("name")), _about(data.get("description"))


def enrich_smartrecruiters(token: str) -> tuple[str | None, str | None]:
    # Listing + first posting's detail (job_discovery/adapters/smartrecruiters.py):
    # the per-posting detail carries company.name and
    # jobAd.sections.companyDescription. One posting is enough for the company blurb.
    base = f"https://api.smartrecruiters.com/v1/companies/{token}/postings"
    page = get_json(f"{base}?limit=1&offset=0")
    content = page.get("content") or []
    first_id = content[0].get("id") if content else None
    if not first_id:
        return None, None
    detail = get_json(f"{base}/{first_id}")
    name = _clean((detail.get("company") or {}).get("name"))
    sections = (detail.get("jobAd") or {}).get("sections") or {}
    company_desc = sections.get("companyDescription") or {}
    return name, _about(company_desc.get("text"))


def enrich_from_jd(ats: str, token: str) -> tuple[str | None, str | None]:
    """Probe-poll a lever/ashby board once: display name from the board page
    <title> (best-effort — its failure must not sink the probe) and grounding
    text from the first posting whose JD is extractable. The adapter raises on a
    404 / dead board, which the caller catches so a later pass can retry."""
    name = None
    try:
        name = fetch_board_name(ats, token)
    except Exception as exc:
        log.warning("board-title fetch %s/%s failed (%s: %s); continuing without name",
                    ats, token, type(exc).__name__, exc)
    for posting in ADAPTERS[ats](token):
        text = extract_description(ats, posting.raw or {})
        if text:
            header = f"Job postings from this company's board include: {posting.title}\n\n"
            return name, (header + text)[:_ABOUT_MAX]
    return name, None


# Board-metadata enrichers keyed by ATS. lever/ashby are absent on purpose — they
# go through enrich_from_jd (see JD_PROBE_ATS).
ENRICHERS = {
    "greenhouse": enrich_greenhouse,
    "workable": enrich_workable,
    "smartrecruiters": enrich_smartrecruiters,
}
