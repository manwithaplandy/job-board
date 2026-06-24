import json
from pathlib import Path

from poller.adapters.greenhouse import parse_greenhouse

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
