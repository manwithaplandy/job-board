"""Malformed successful HTTP bodies must never authorize closure."""
import pytest
from job_discovery.adapters import greenhouse, ashby, workable, smartrecruiters, workday


@pytest.mark.parametrize("module,key", [(greenhouse,"jobs"), (ashby,"jobs"), (workable,"jobs"), (smartrecruiters,"content"), (workday,"jobPostings")])
def test_null_collection_is_not_empty_source(monkeypatch, module, key):
    monkeypatch.setattr(module, "post_json" if module is workday else "get_json", lambda *a, **k: {key: None})
    fetch = getattr(module, "fetch_" + module.__name__.rsplit(".", 1)[1])
    with pytest.raises(ValueError):
        list(fetch("a:wd5:External" if module is workday else "a"))


@pytest.mark.parametrize("module,key,id_key", [(greenhouse,"jobs","id"), (ashby,"jobs","id"), (workable,"jobs","shortcode")])
def test_unidentifiable_entry_cannot_authorize_closure(monkeypatch, module, key, id_key):
    monkeypatch.setattr(module, "get_json", lambda *a: {key: [{id_key: None, "title": "A", "absolute_url": "u"}]})
    fetch = getattr(module, "fetch_" + module.__name__.rsplit(".", 1)[1])
    with pytest.raises(ValueError):
        fetch("a")


def test_greenhouse_reported_total_cannot_exceed_collection(monkeypatch):
    monkeypatch.setattr(greenhouse, "get_json", lambda *a: {"jobs": [], "meta": {"total": 7}})
    with pytest.raises(ValueError):
        greenhouse.fetch_greenhouse("a")
