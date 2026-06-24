from poller.http import get_json
from poller.models import Posting
from poller.normalize import detect_remote


def parse_greenhouse(data: dict) -> list[Posting]:
    postings: list[Posting] = []
    for j in data.get("jobs", []):
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
    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs"
    return parse_greenhouse(get_json(url))
