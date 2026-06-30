import json

import pytest

from job_discovery.adapters import ADAPTERS
from job_discovery.targets import load_targets


def test_registry_has_all_adapters():
    assert set(ADAPTERS) == {
        "greenhouse", "lever", "ashby", "workable", "smartrecruiters", "workday"
    }
    assert all(callable(fn) for fn in ADAPTERS.values())


def test_load_targets_reads_file(tmp_path):
    p = tmp_path / "targets.json"
    p.write_text(json.dumps([{"name": "Acme", "ats": "lever", "token": "acme"}]))
    targets = load_targets(p)
    assert targets == [{"name": "Acme", "ats": "lever", "token": "acme"}]


def test_load_targets_accepts_new_providers(tmp_path):
    p = tmp_path / "targets.json"
    p.write_text(json.dumps([
        {"name": "Acme", "ats": "workable", "token": "acme"},
        {"name": "Beta", "ats": "smartrecruiters", "token": "beta"},
        {"name": "Gamma", "ats": "workday", "token": "gamma:wd5:External"},
    ]))
    assert {t["ats"] for t in load_targets(p)} == {
        "workable", "smartrecruiters", "workday"
    }


def test_load_targets_rejects_unknown_ats(tmp_path):
    p = tmp_path / "targets.json"
    p.write_text(json.dumps([{"name": "Acme", "ats": "bamboohr", "token": "acme"}]))
    with pytest.raises(ValueError, match="bamboohr"):
        load_targets(p)


@pytest.mark.parametrize("bad_token", ["acme:wd5", "acme::External", "acme:wd5:", "plain"])
def test_load_targets_rejects_malformed_workday_token(tmp_path, bad_token):
    # FIX 4: a Workday token must be a well-formed 'tenant:datacenter:site' triple;
    # reject a malformed one at load time instead of failing every poll.
    p = tmp_path / "targets.json"
    p.write_text(json.dumps([{"name": "Bad", "ats": "workday", "token": bad_token}]))
    with pytest.raises(ValueError, match="workday token"):
        load_targets(p)
