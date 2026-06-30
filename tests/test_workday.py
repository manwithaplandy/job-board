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


def test_fetch_keeps_minimal_posting_when_detail_fails(monkeypatch):
    # FIX 2: a failed detail fetch must NOT drop the posting (dropping it would let
    # run.py's close-detection falsely close a still-open job). A minimal posting is
    # built from the listing item so the job stays in `seen`.
    page = {"total": 2, "jobPostings": [
        {"externalPath": "/job/ok/R-1", "title": "OK", "locationsText": "NYC"},
        {"externalPath": "/job/bad/R-2", "title": "Bad", "locationsText": "Remote"},
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
    assert [p.external_id for p in postings] == ["/job/ok/R-1", "/job/bad/R-2"]
    bad = postings[1]
    assert bad.title == "Bad"  # carried over from the listing item
    assert bad.url == f"https://{HOST}/{SITE}/job/bad/R-2"  # built from host/site/path
    assert bad.location == "Remote"


def test_fetch_keeps_minimal_posting_when_detail_malformed(monkeypatch):
    # FIX 1: a malformed HTTP-200 detail body (here: a non-dict, which the parser
    # dereferences via .get) must not abort the whole tenant fetch.
    page = {"total": 1, "jobPostings": [
        {"externalPath": "/job/x/R-9", "title": "X", "locationsText": "Remote"},
    ]}

    def fake_post_json(url, json=None):
        return page

    def fake_get_json(url):
        return ["unexpected", "list"]  # non-dict body -> AttributeError in parser

    monkeypatch.setattr(workday, "post_json", fake_post_json)
    monkeypatch.setattr(workday, "get_json", fake_get_json)
    postings = fetch_workday("acme:wd5:External")
    assert [p.external_id for p in postings] == ["/job/x/R-9"]
    assert postings[0].title == "X"
    assert postings[0].url == f"https://{HOST}/{SITE}/job/x/R-9"
    assert postings[0].location == "Remote"


def test_fetch_pages_until_short_page_when_total_missing(monkeypatch):
    # FIX 3: when the listing omits `total`, paging must continue while a full page
    # comes back and stop on the short page — not truncate after page 1 (which would
    # drop later postings and trigger false closures).
    monkeypatch.setattr(workday, "_PAGE_LIMIT", 2)
    pages = {
        0: {"jobPostings": [
            {"externalPath": "/job/a/R-1", "title": "A"},
            {"externalPath": "/job/b/R-2", "title": "B"},
        ]},
        2: {"jobPostings": [
            {"externalPath": "/job/c/R-3", "title": "C"},
            {"externalPath": "/job/d/R-4", "title": "D"},
        ]},
        4: {"jobPostings": [  # short page -> stop
            {"externalPath": "/job/e/R-5", "title": "E"},
        ]},
    }

    def fake_post_json(url, json=None):
        return pages[json["offset"]]

    def fake_get_json(url):
        for ep in ("/job/a/R-1", "/job/b/R-2", "/job/c/R-3", "/job/d/R-4", "/job/e/R-5"):
            if url.endswith(ep):
                return {"jobPostingInfo": {"title": ep, "externalUrl": f"https://x{ep}"}}
        raise AssertionError(f"unexpected detail url {url}")

    monkeypatch.setattr(workday, "post_json", fake_post_json)
    monkeypatch.setattr(workday, "get_json", fake_get_json)
    postings = fetch_workday("acme:wd5:External")
    assert [p.external_id for p in postings] == [
        "/job/a/R-1", "/job/b/R-2", "/job/c/R-3", "/job/d/R-4", "/job/e/R-5",
    ]
