from job_discovery.http import get_json
from job_discovery.models import Posting
from job_discovery.normalize import detect_remote


def parse_greenhouse(data: dict) -> list[Posting]:
    postings: list[Posting] = []
    for j in data.get("jobs") or []:
        loc = (j.get("location") or {}).get("name")
        depts = j.get("departments") or []
        dept = depts[0].get("name") if depts else None
        postings.append(
            Posting(
                external_id=str(j["id"]),
                title=j["title"],
                url=j["absolute_url"],
                location=loc,
                department=dept,
                remote=detect_remote(loc, None),
                raw=j,
            )
        )
    return postings


def fetch_greenhouse(token: str) -> list[Posting]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"
    data = get_json(url)
    if "jobs" not in data:
        raise ValueError("greenhouse response missing 'jobs' key")
    return parse_greenhouse(data)
