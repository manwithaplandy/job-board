import json
from pathlib import Path

import pytest

import job_discovery.adapters.greenhouse as greenhouse
from job_discovery.adapters.greenhouse import parse_greenhouse

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "greenhouse.json").read_text())


def test_parses_all_postings():
    postings = parse_greenhouse(FIXTURE)
    assert len(postings) == 2


def test_field_mapping():
    eng = parse_greenhouse(FIXTURE)[0]
    assert eng.external_id == "4012345"
    assert eng.title == "Senior Software Engineer"
    assert eng.url == "https://boards.greenhouse.io/acme/jobs/4012345"
    assert eng.location == "Remote - US"
    assert eng.department == "Engineering"
    assert eng.remote is True  # location matches /remote/i
    assert eng.raw["id"] == 4012345


def test_missing_department_is_none():
    pm = parse_greenhouse(FIXTURE)[1]
    assert pm.department is None
    assert pm.remote is None


def test_fetch_url_requests_content(monkeypatch):
    import job_discovery.adapters.greenhouse as gh
    captured = {}

    def fake_get_json(url):
        captured["url"] = url
        return {"jobs": []}

    monkeypatch.setattr(gh, "get_json", fake_get_json)
    gh.fetch_greenhouse("acme")
    assert captured["url"] == (
        "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true"
    )


# ── A3: missing top-level key ─────────────────────────────────────────────────

def test_missing_jobs_key_raises(monkeypatch):
    monkeypatch.setattr(greenhouse, "get_json", lambda url: {"error": "gone"})
    with pytest.raises(ValueError, match="missing 'jobs'"):
        greenhouse.fetch_greenhouse("acme")
