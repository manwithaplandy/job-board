import json
from pathlib import Path

from poller.adapters.ashby import parse_ashby

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "ashby.json").read_text())


def test_field_mapping_uses_isremote_flag():
    eng = parse_ashby(FIXTURE)[0]
    assert eng.external_id == "11111111-2222-3333-4444-555555555555"
    assert eng.title == "Research Engineer"
    assert eng.url == "https://jobs.ashbyhq.com/acme/11111111"
    assert eng.location == "San Francisco, CA"
    assert eng.department == "Research"
    assert eng.remote is True  # isRemote flag, even though location has no "remote"


def test_non_remote_flag():
    rec = parse_ashby(FIXTURE)[1]
    assert rec.remote is False
