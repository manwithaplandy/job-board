from job_discovery.http import get_json
from job_discovery.models import Posting
from job_discovery.normalize import detect_remote


def parse_ashby(data: dict) -> list[Posting]:
    postings: list[Posting] = []
    for j in data.get("jobs", []):
        loc = j.get("location")
        postings.append(
            Posting(
                external_id=str(j["id"]),
                title=j["title"],
                url=j.get("jobUrl") or j.get("applyUrl"),
                location=loc,
                department=j.get("department"),
                remote=detect_remote(loc, j.get("isRemote")),
                raw=j,
            )
        )
    return postings


def fetch_ashby(token: str) -> list[Posting]:
    url = f"https://api.ashbyhq.com/posting-api/job-board/{token}"
    return parse_ashby(get_json(url))
