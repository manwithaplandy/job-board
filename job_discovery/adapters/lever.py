from job_discovery.http import get_json
from job_discovery.models import Posting
from job_discovery.normalize import detect_remote


def _explicit_remote(workplace_type: str | None) -> bool | None:
    if workplace_type == "remote":
        return True
    if workplace_type in ("on-site", "hybrid"):
        return False
    return None


def parse_lever(data: list) -> list[Posting]:
    postings: list[Posting] = []
    for j in data:
        cats = j.get("categories") or {}
        loc = cats.get("location")
        postings.append(
            Posting(
                external_id=str(j["id"]),
                title=j["text"],
                url=j["hostedUrl"],
                location=loc,
                department=cats.get("team") or cats.get("department"),
                remote=detect_remote(loc, _explicit_remote(j.get("workplaceType"))),
                raw=j,
            )
        )
    return postings


def fetch_lever(token: str) -> list[Posting]:
    url = f"https://api.lever.co/v0/postings/{token}?mode=json"
    return parse_lever(get_json(url))
