import json
from pathlib import Path

from job_discovery.adapters.lever import parse_lever

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "lever.json").read_text())


def test_field_mapping_uses_text_and_hostedurl():
    eng = parse_lever(FIXTURE)[0]
    assert eng.external_id == "abc-123-def"
    assert eng.title == "Staff Backend Engineer"
    assert eng.url == "https://jobs.lever.co/acme/abc-123-def"
    assert eng.location == "San Francisco"
    assert eng.department == "Platform"  # categories.team
    assert eng.remote is True            # workplaceType == "remote"


def test_onsite_is_not_remote():
    ops = parse_lever(FIXTURE)[1]
    assert ops.remote is False
    assert ops.department == "Operations"
