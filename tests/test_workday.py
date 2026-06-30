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
CXS = f"https://{HOST}/wday/cxs/acme/{SITE}"


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
    path = "/job/US-CA-Santa-Clara/Senior-Software-Engineer_JR-1001"
    eng = parse_workday_job(_item(path), DETAILS[path], host=HOST, site=SITE)
    assert eng.external_id == path
    assert eng.title == "Senior Software Engineer"
    # the detail's canonical externalUrl is preferred verbatim (no locale segment)
    assert eng.url == DETAILS[path]["jobPostingInfo"]["externalUrl"]
    assert eng.location == "US, CA, Santa Clara"  # authoritative detail location
    assert eng.department is None
    assert eng.remote is None  # no remote signal in slug or locations


def test_url_constructed_when_external_url_absent():
    path = "/job/US-NY-New-York/Product-Manager_JR-1002"
    pm = parse_workday_job(_item(path), DETAILS[path], host=HOST, site=SITE)
    # no externalUrl in this detail -> build it host/site/path (no locale segment)
    assert pm.url == f"https://{HOST}/{SITE}{path}"
    assert pm.remote is None


def test_remote_detected_from_additional_locations_for_multi_location_job():
    # The listing's locationsText is the unreliable bare count "13 Locations";
    # location must come from the detail and remote from its additionalLocations.
    path = "/job/US-CA-Santa-Clara/Senior-HPC-Architect_JR-1999579"
    assert _item(path)["locationsText"] == "13 Locations"
    hpc = parse_workday_job(_item(path), DETAILS[path], host=HOST, site=SITE)
    assert hpc.location == "US, CA, Santa Clara"  # NOT the "13 Locations" count
    assert hpc.remote is True  # additionalLocations[] include "... Remote"


def test_remote_detected_from_external_path_slug():
    # Even with no additionalLocations the slug literally contains "Remote".
    path = "/job/US-CA-Remote/Senior-ASIC-Methodology-Engineer_JR-2013789"
    asic = parse_workday_job(_item(path), DETAILS[path], host=HOST, site=SITE)
    assert asic.remote is True


def test_extract_description_strips_html():
    path = "/job/US-CA-Santa-Clara/Senior-Software-Engineer_JR-1001"
    out = extract_description("workday", DETAILS[path])
    assert out == "Build distributed systems at scale."


def test_extract_description_none_when_absent():
    assert extract_description("workday", {"jobPostingInfo": {}}) is None


def test_fetch_posts_search_pages_and_reads_details(monkeypatch):
    monkeypatch.setattr(workday, "_PAGE_LIMIT", 2)
    bodies: list[dict] = []

    def fake_post_json(url, json=None):
        bodies.append(json)
        assert url == f"{CXS}/jobs"
        off = json["offset"]
        if off == 0:
            return FIXTURE["list_pages"][0]
        if off == 2:
            return FIXTURE["list_pages"][1]
        return {"jobPostings": []}  # empty -> stop

    def fake_get_json(url):
        for key in DETAILS:
            if url.endswith(key):
                return DETAILS[key]
        raise AssertionError(f"unexpected detail url {url}")

    monkeypatch.setattr(workday, "post_json", fake_post_json)
    monkeypatch.setattr(workday, "get_json", fake_get_json)
    postings = fetch_workday("acme:wd5:External")

    assert [p.external_id for p in postings] == [
        "/job/US-CA-Santa-Clara/Senior-Software-Engineer_JR-1001",
        "/job/US-CA-Santa-Clara/Senior-HPC-Architect_JR-1999579",
        "/job/US-CA-Remote/Senior-ASIC-Methodology-Engineer_JR-2013789",
        "/job/US-NY-New-York/Product-Manager_JR-1002",
    ]
    assert [b["offset"] for b in bodies] == [0, 2, 4]  # walked the empty 3rd page


def test_fetch_keeps_minimal_posting_when_detail_fails(monkeypatch):
    # A failed detail fetch must NOT drop the posting (dropping it would let
    # run.py's close-detection falsely close a still-open job). A minimal posting
    # is built from the listing item so the job stays in `seen`.
    page = {"total": 2, "jobPostings": [
        {"externalPath": "/job/ok/JR-1", "title": "OK", "locationsText": "NYC"},
        {"externalPath": "/job/bad/JR-2", "title": "Bad", "locationsText": "Remote"},
    ]}

    def fake_post_json(url, json=None):
        return page if json["offset"] == 0 else {"jobPostings": []}

    def fake_get_json(url):
        if url.endswith("/job/bad/JR-2"):
            raise RuntimeError("500")
        return {"jobPostingInfo": {"title": "OK", "externalUrl": "https://x/ok"}}

    monkeypatch.setattr(workday, "post_json", fake_post_json)
    monkeypatch.setattr(workday, "get_json", fake_get_json)
    postings = fetch_workday("acme:wd5:External")
    assert [p.external_id for p in postings] == ["/job/ok/JR-1", "/job/bad/JR-2"]
    bad = postings[1]
    assert bad.title == "Bad"  # carried over from the listing item
    assert bad.url == f"https://{HOST}/{SITE}/job/bad/JR-2"  # built from host/site/path
    assert bad.location == "Remote"


def test_fetch_keeps_minimal_posting_when_detail_malformed(monkeypatch):
    # A malformed HTTP-200 detail body (here: a non-dict, which the parser
    # dereferences via .get) must not abort the whole tenant fetch.
    page = {"total": 1, "jobPostings": [
        {"externalPath": "/job/x/JR-9", "title": "X", "locationsText": "Remote"},
    ]}

    def fake_post_json(url, json=None):
        return page if json["offset"] == 0 else {"jobPostings": []}

    def fake_get_json(url):
        return ["unexpected", "list"]  # non-dict body -> AttributeError in parser

    monkeypatch.setattr(workday, "post_json", fake_post_json)
    monkeypatch.setattr(workday, "get_json", fake_get_json)
    postings = fetch_workday("acme:wd5:External")
    assert [p.external_id for p in postings] == ["/job/x/JR-9"]
    assert postings[0].title == "X"
    assert postings[0].url == f"https://{HOST}/{SITE}/job/x/JR-9"
    assert postings[0].location == "Remote"


def test_fetch_pages_until_short_page_when_total_missing(monkeypatch):
    # When the listing omits `total`, paging continues while a full page comes
    # back and stops on the short page — not truncating after page 1 (which would
    # drop later postings and trigger false closures). `total` is never relied on.
    monkeypatch.setattr(workday, "_PAGE_LIMIT", 2)
    pages = {
        0: {"jobPostings": [
            {"externalPath": "/job/a/JR-1", "title": "A"},
            {"externalPath": "/job/b/JR-2", "title": "B"},
        ]},
        2: {"jobPostings": [
            {"externalPath": "/job/c/JR-3", "title": "C"},
            {"externalPath": "/job/d/JR-4", "title": "D"},
        ]},
        4: {"jobPostings": [  # short page -> stop
            {"externalPath": "/job/e/JR-5", "title": "E"},
        ]},
    }

    def fake_post_json(url, json=None):
        return pages[json["offset"]]

    def fake_get_json(url):
        return {"jobPostingInfo": {"title": url, "externalUrl": f"https://x{url[-12:]}"}}

    monkeypatch.setattr(workday, "post_json", fake_post_json)
    monkeypatch.setattr(workday, "get_json", fake_get_json)
    postings = fetch_workday("acme:wd5:External")
    assert [p.external_id for p in postings] == [
        "/job/a/JR-1", "/job/b/JR-2", "/job/c/JR-3", "/job/d/JR-4", "/job/e/JR-5",
    ]


def test_fetch_stops_on_wrap_without_duplicate_flood(monkeypatch):
    # Past the 2000 hard cap Workday WRAPS back to a full page 1 (never an empty
    # page) and `total` is unreliable. The wrap guard must detect the repeated
    # first posting and stop — so the walk terminates and page 1 is not
    # re-ingested as duplicates.
    monkeypatch.setattr(workday, "_PAGE_LIMIT", 2)
    monkeypatch.setattr(workday, "_HARD_CAP", 1000)  # high; the wrap must stop first
    page1 = {"total": 2000, "jobPostings": [
        {"externalPath": "/job/a/JR-1", "title": "A"},
        {"externalPath": "/job/b/JR-2", "title": "B"},
    ]}
    page2 = {"total": 2000, "jobPostings": [
        {"externalPath": "/job/c/JR-3", "title": "C"},
        {"externalPath": "/job/d/JR-4", "title": "D"},
    ]}
    calls = {"n": 0}

    def fake_post_json(url, json=None):
        calls["n"] += 1
        off = json["offset"]
        if off == 0:
            return page1
        if off == 2:
            return page2
        return page1  # offset 4+ WRAPS back to page 1 (the 2000-cap behavior)

    def fake_get_json(url):
        return {"jobPostingInfo": {"title": "x", "externalUrl": f"https://x{url[-10:]}"}}

    monkeypatch.setattr(workday, "post_json", fake_post_json)
    monkeypatch.setattr(workday, "get_json", fake_get_json)
    postings = fetch_workday("acme:wd5:External")
    ids = [p.external_id for p in postings]
    assert ids == ["/job/a/JR-1", "/job/b/JR-2", "/job/c/JR-3", "/job/d/JR-4"]
    assert ids.count("/job/a/JR-1") == 1  # wrap detected, page 1 not re-ingested
    assert calls["n"] == 3  # off 0, off 2, off 4 (wrap) -> terminates, no infinite loop


def test_fetch_stops_at_hard_cap(monkeypatch):
    # Defense in depth: even if every page is full AND distinct (never short,
    # never wraps) the walk must still terminate at the 2000-result ceiling.
    monkeypatch.setattr(workday, "_PAGE_LIMIT", 2)
    monkeypatch.setattr(workday, "_HARD_CAP", 4)
    bodies: list[dict] = []

    def fake_post_json(url, json=None):
        bodies.append(json)
        off = json["offset"]
        return {"total": 999999, "jobPostings": [
            {"externalPath": f"/job/p{off}-a/JR-{off}a", "title": "A"},
            {"externalPath": f"/job/p{off}-b/JR-{off}b", "title": "B"},
        ]}

    def fake_get_json(url):
        return {"jobPostingInfo": {"title": "x", "externalUrl": f"https://x{url[-10:]}"}}

    monkeypatch.setattr(workday, "post_json", fake_post_json)
    monkeypatch.setattr(workday, "get_json", fake_get_json)
    postings = fetch_workday("acme:wd5:External")
    assert [b["offset"] for b in bodies] == [0, 2]  # stopped once offset >= 4
    assert len(postings) == 4
