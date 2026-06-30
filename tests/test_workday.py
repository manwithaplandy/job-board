import json
from pathlib import Path

import pytest

import job_discovery.adapters.workday as workday
from job_discovery.adapters.workday import (
    _parse_token,
    fetch_workday,
    parse_workday_job,
)
from job_discovery.jd import extract_description

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "workday.json").read_text())
DETAILS = FIXTURE["details"]
HOST = "acme.wd5.myworkdayjobs.com"
SITE = "External"


def _item(external_path: str) -> dict:
    for page in FIXTURE["list_pages"]:
        for it in page["jobPostings"]:
            if it["externalPath"] == external_path:
                return it
    raise KeyError(external_path)


def test_parse_token_splits_three_coordinates():
    assert _parse_token("acme:wd5:External") == ("acme", "wd5", "External")


@pytest.mark.parametrize("bad", ["acme:wd5", "acme::External", "acme:wd5:", "plain"])
def test_parse_token_rejects_malformed(bad):
    with pytest.raises(ValueError, match="workday token"):
        _parse_token(bad)


def test_field_mapping_uses_external_path_and_external_url():
    path = "/job/San-Francisco/Senior-Software-Engineer_R-1001"
    eng = parse_workday_job(_item(path), DETAILS[path], host=HOST, site=SITE)
    assert eng.external_id == path
    assert eng.title == "Senior Software Engineer"
    assert eng.url == (
        "https://acme.wd5.myworkdayjobs.com/en-US/External/job/"
        "San-Francisco/Senior-Software-Engineer_R-1001"
    )
    assert eng.location == "San Francisco, CA"
    assert eng.department is None
    assert eng.remote is False  # remoteType "On-site"


def test_url_constructed_when_external_url_absent():
    path = "/job/New-York/Product-Manager_R-1002"
    pm = parse_workday_job(_item(path), DETAILS[path], host=HOST, site=SITE)
    assert pm.url == f"https://{HOST}/{SITE}{path}"  # built from host/site/path
    assert pm.remote is False  # remoteType "Hybrid"


def test_remote_type_remote_flags_remote():
    path = "/job/Remote/Remote-Recruiter_R-1003"
    rec = parse_workday_job(_item(path), DETAILS[path], host=HOST, site=SITE)
    assert rec.remote is True


def test_extract_description_strips_html():
    path = "/job/San-Francisco/Senior-Software-Engineer_R-1001"
    out = extract_description("workday", DETAILS[path])
    assert out == "Build distributed systems at scale."


def test_extract_description_none_when_absent():
    assert extract_description("workday", {"jobPostingInfo": {}}) is None


def test_fetch_posts_search_pages_and_reads_details(monkeypatch):
    monkeypatch.setattr(workday, "_PAGE_LIMIT", 2)
    list_bodies: list[dict] = []

    def fake_post_json(url, json=None):
        list_bodies.append(json)
        assert url == (
            "https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/jobs"
        )
        return FIXTURE["list_pages"][0 if json["offset"] == 0 else 1]

    def fake_get_json(url):
        for key in DETAILS:
            if url.endswith(key):
                return DETAILS[key]
        raise AssertionError(f"unexpected detail url {url}")

    monkeypatch.setattr(workday, "post_json", fake_post_json)
    monkeypatch.setattr(workday, "get_json", fake_get_json)
    postings = fetch_workday("acme:wd5:External")

    assert [p.external_id for p in postings] == [
        "/job/San-Francisco/Senior-Software-Engineer_R-1001",
        "/job/New-York/Product-Manager_R-1002",
        "/job/Remote/Remote-Recruiter_R-1003",
    ]
    assert [b["offset"] for b in list_bodies] == [0, 2]  # walked two search pages


def test_fetch_skips_posting_when_detail_fails(monkeypatch):
    page = {"total": 2, "jobPostings": [
        {"externalPath": "/job/ok/R-1", "title": "OK"},
        {"externalPath": "/job/bad/R-2", "title": "Bad"},
    ]}

    def fake_post_json(url, json=None):
        return page

    def fake_get_json(url):
        if url.endswith("/job/bad/R-2"):
            raise RuntimeError("500")
        return {"jobPostingInfo": {"title": "OK", "externalUrl": "https://x/ok"}}

    monkeypatch.setattr(workday, "post_json", fake_post_json)
    monkeypatch.setattr(workday, "get_json", fake_get_json)
    postings = fetch_workday("acme:wd5:External")
    assert [p.external_id for p in postings] == ["/job/ok/R-1"]
