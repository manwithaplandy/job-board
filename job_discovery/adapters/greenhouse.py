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


def _as_string(v) -> str:
    if isinstance(v, str):
        return v
    if isinstance(v, bool) or isinstance(v, (int, float)):
        return str(v)
    return ""


def _parse_options(values) -> list[dict]:
    if not isinstance(values, list):
        return []
    out = []
    for v in values:
        if not isinstance(v, dict):
            continue
        label = _as_string(v.get("label"))
        value = _as_string(v.get("value"))  # Greenhouse encodes option values as numbers
        if label:                            # drop options with no label; keep empty value
            out.append({"value": value, "label": label})
    return out


def _parse_fields(fields) -> list[dict]:
    if not isinstance(fields, list):
        return []
    out = []
    for f in fields:
        if not isinstance(f, dict):
            continue
        name = _as_string(f.get("name"))
        type_ = _as_string(f.get("type"))
        if not name and not type_:           # drop a field only when BOTH are empty
            continue
        out.append({"name": name, "type": type_, "options": _parse_options(f.get("values"))})
    return out


def parse_greenhouse_questions(data) -> dict | None:
    """Mirror of dashboard/lib/rolefit/greenhouseQuestions.ts::parseGreenhouseQuestions.
    Returns {"questions": [...]} or None. Pure and total — keep edge cases identical
    to the TS parser so the two sides of the jsonb boundary can't drift."""
    if not isinstance(data, dict):
        return None
    raw = data.get("questions")
    if not isinstance(raw, list):
        return None
    questions = []
    for q in raw:
        if not isinstance(q, dict):
            continue
        label = _as_string(q.get("label"))
        if not label:                        # skip label-less questions
            continue
        questions.append({
            "label": label,
            "required": q.get("required") is True,
            "fields": _parse_fields(q.get("fields")),
        })
    return {"questions": questions}
