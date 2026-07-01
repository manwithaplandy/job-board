import logging

from job_discovery.http import get_json
from job_discovery.models import Posting
from job_discovery.normalize import detect_remote

log = logging.getLogger("job_discovery")

# Workable's PUBLIC, no-auth widget endpoint returns the FULL published job list
# for an account in a SINGLE GET, with the full HTML job description inline
# (the widget merges description + requirements + benefits into one `description`
# field). There is no pagination and no per-job detail call — `?details=true`
# returns everything:
#   GET https://apply.workable.com/api/v1/widget/accounts/{account}?details=true
#       -> { "name", "description", "jobs": [ {job}, ... ] }
# (The old /spi/v3 path is the AUTHENTICATED employer SPI and 401s for any real
# company, which is why it was replaced.)
_WIDGET_URL = "https://apply.workable.com/api/v1/widget/accounts/{account}?details=true"


def _location_str(job: dict) -> str | None:
    # The widget carries city/state/country at the job top level (with a parallel
    # `locations` list). Join the non-empty parts into a single location string,
    # the way greenhouse/the other adapters format location.
    parts = [job.get("city"), job.get("state"), job.get("country")]
    joined = ", ".join(p for p in parts if p)
    if joined:
        return joined
    # Fall back to the structured `locations` list if the flat fields are blank.
    first = (job.get("locations") or [{}])[0]
    parts = [first.get("city"), first.get("region"), first.get("country")]
    joined = ", ".join(p for p in parts if p)
    return joined or None


def _department(job: dict) -> str | None:
    # The widget exposes `department` as a plain STRING; other/older Workable
    # payloads use a list of strings. Accept either and take the first usable.
    dept = job.get("department")
    if isinstance(dept, list):
        return next((d for d in dept if d), None)
    return dept or None


def parse_workable_job(job: dict, account: str) -> Posting:
    """Map a Workable widget job entry to the internal Posting model.

    The widget puts the remote flag at the JOB top level as `telecommuting`
    (bool) — there is no per-location dict and no `workplace_type`. The public
    apply URL is built account-qualified (`/{account}/j/{shortcode}/`) so it
    resolves with a 200 instead of bouncing through an apply.workable.com
    redirect. The full HTML JD lives in `job["description"]` and is kept on `raw`.
    """
    shortcode = str(job["shortcode"])
    location = _location_str(job)
    return Posting(
        external_id=shortcode,
        title=job["title"],
        url=f"https://apply.workable.com/{account}/j/{shortcode}/",
        location=location,
        department=_department(job),
        # `telecommuting` is True/False/None; feed it as the explicit ATS flag.
        remote=detect_remote(location, job.get("telecommuting")),
        raw=job,
    )


def _minimal_posting(account: str, job: dict) -> Posting | None:
    """Build a bare Posting from a widget entry when full parsing fails.

    Keeping the posting (rather than dropping it) preserves the job in run.py's
    seen-set so close-detection does not falsely mark a still-open job as closed.
    `shortcode` is the same value `parse_workable_job` uses for the external id,
    so the row stays stable across runs; the apply URL is identical to the one
    the full parser builds. Returns None only when no shortcode is available.
    """
    shortcode = job.get("shortcode")
    if not shortcode:
        return None
    return Posting(
        external_id=str(shortcode),
        title=job.get("title"),
        url=f"https://apply.workable.com/{account}/j/{shortcode}/",
        raw=job,
    )


def fetch_workable(token: str) -> list[Posting]:
    # ONE no-auth GET returns every published job with its full description
    # inline. Parse each entry inside a try/except so a single malformed job
    # entry yields a minimal posting instead of being dropped or crashing the
    # whole company fetch (a dropped job would let run.py's close-detection
    # falsely close a still-open posting).
    payload = get_json(_WIDGET_URL.format(account=token))
    if "jobs" not in payload:
        raise ValueError(f"workable response missing 'jobs' key")
    postings: list[Posting] = []
    for job in payload.get("jobs") or []:
        try:
            posting = parse_workable_job(job, token)
        except Exception:  # malformed entry: keep a minimal posting, don't drop
            log.warning(
                "workable: malformed job entry for %s/%s; keeping minimal posting",
                token, job.get("shortcode"),
            )
            posting = _minimal_posting(token, job)
        if posting is not None:
            postings.append(posting)
    return postings
