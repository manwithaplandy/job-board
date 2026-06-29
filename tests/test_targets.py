import json

import pytest

from job_discovery.adapters import ADAPTERS
from job_discovery.targets import load_targets


def test_registry_has_three_adapters():
    assert set(ADAPTERS) == {"greenhouse", "lever", "ashby"}
    assert all(callable(fn) for fn in ADAPTERS.values())


def test_load_targets_reads_file(tmp_path):
    p = tmp_path / "targets.json"
    p.write_text(json.dumps([{"name": "Acme", "ats": "lever", "token": "acme"}]))
    targets = load_targets(p)
    assert targets == [{"name": "Acme", "ats": "lever", "token": "acme"}]


def test_load_targets_rejects_unknown_ats(tmp_path):
    p = tmp_path / "targets.json"
    p.write_text(json.dumps([{"name": "Acme", "ats": "workday", "token": "acme"}]))
    with pytest.raises(ValueError, match="workday"):
        load_targets(p)
