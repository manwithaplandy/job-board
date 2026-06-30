import json
from pathlib import Path

import job_discovery.adapters.smartrecruiters as smartrecruiters
from job_discovery.adapters.smartrecruiters import (
    fetch_smartrecruiters,
    parse_smartrecruiters_posting,
)
from job_discovery.jd import extract_description

FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures" / "smartrecruiters.json").read_text()
)
DETAILS = FIXTURE["details"]


def test_field_mapping_uses_apply_url_and_department_label():
    eng = parse_smartrecruiters_posting(DETAILS["743111"])
    assert eng.external_id == "743111"
    assert eng.title == "Staff Engineer"
    assert eng.url == "https://jobs.smartrecruiters.com/acme/743111-staff-engineer"  # applyUrl
    assert eng.location == "San Francisco, CA, us"
    assert eng.department == "Engineering"
    assert eng.remote is False  # location.remote == false


def test_url_falls_back_to_posting_url_and_remote_flag():
    rec = parse_smartrecruiters_posting(DETAILS["743222"])
    assert rec.url == "https://jobs.smartrecruiters.com/acme/743222"  # no applyUrl
    assert rec.remote is True  # location.remote == true (and city "Remote")


def test_extract_description_joins_titled_sections():
    out = extract_description("smartrecruiters", DETAILS["743111"])
    assert "Company Description" in out and "Acme builds things." in out
    assert "Job Description" in out and "Lead the backend." in out
    assert "Qualifications" in out and "10y exp" in out
    assert "Equity & more" in out  # entity decoded
    assert "<" not in out


def test_extract_description_none_when_sections_empty():
    assert extract_description("smartrecruiters", DETAILS["743333"]) is None


def test_fetch_pages_by_offset_and_fetches_details(monkeypatch):
    monkeypatch.setattr(smartrecruiters, "_PAGE_LIMIT", 2)
    requested: list[str] = []

    def fake_get_json(url):
        requested.append(url)
        if "/postings/" in url:  # detail call
            return DETAILS[url.rsplit("/", 1)[1]]
        page_index = 0 if "offset=0" in url else 1
        return FIXTURE["list_pages"][page_index]

    monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
    postings = fetch_smartrecruiters("acme")

    assert [p.external_id for p in postings] == ["743111", "743222", "743333"]
    assert requested[0] == (
        "https://api.smartrecruiters.com/v1/companies/acme/postings?limit=2&offset=0"
    )
    assert any("offset=2" in u for u in requested)  # second page was walked


def test_fetch_keeps_minimal_posting_when_detail_fails(monkeypatch):
    # FIX 2: a failed detail fetch must NOT drop the posting (dropping it would let
    # run.py's close-detection falsely close a still-open job). A minimal posting is
    # built from the listing item so the job stays in `seen`.
    page = {"totalFound": 2, "content": [
        {"id": "743111", "name": "Staff Engineer"},
        {"id": "BAD", "name": "Broken Posting"},
    ]}

    def fake_get_json(url):
        if url.endswith("/postings/BAD"):
            raise RuntimeError("404")
        if "/postings/" in url:
            return DETAILS[url.rsplit("/", 1)[1]]
        return page

    monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
    postings = fetch_smartrecruiters("acme")
    assert [p.external_id for p in postings] == ["743111", "BAD"]
    bad = postings[1]
    assert bad.title == "Broken Posting"  # carried over from the listing item
    assert bad.url == "https://jobs.smartrecruiters.com/acme/BAD"  # built from token+id


def test_fetch_keeps_minimal_posting_when_detail_malformed(monkeypatch):
    # FIX 1: a malformed HTTP-200 detail body (here: missing `id`, which the parser
    # dereferences) must not abort the whole company fetch.
    page = {"totalFound": 1, "content": [{"id": "743111", "name": "Staff Engineer"}]}

    def fake_get_json(url):
        if "/postings/" in url:
            return {"name": "Staff Engineer"}  # no id key
        return page

    monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
    postings = fetch_smartrecruiters("acme")
    assert [p.external_id for p in postings] == ["743111"]
    assert postings[0].url == "https://jobs.smartrecruiters.com/acme/743111"


def test_fetch_pages_until_short_page_when_total_missing(monkeypatch):
    # FIX 3: when the listing omits `totalFound`, paging must continue while a full
    # page comes back and stop on the short page — not truncate after page 1 (which
    # would drop later postings and trigger false closures).
    monkeypatch.setattr(smartrecruiters, "_PAGE_LIMIT", 2)
    pages = {
        0: {"content": [{"id": "1", "name": "A"}, {"id": "2", "name": "B"}]},
        2: {"content": [{"id": "3", "name": "C"}, {"id": "4", "name": "D"}]},
        4: {"content": [{"id": "5", "name": "E"}]},  # short page -> stop
    }

    def fake_get_json(url):
        if "/postings/" in url:  # detail call
            pid = url.rsplit("/", 1)[1]
            return {"id": pid, "name": f"Job {pid}", "applyUrl": f"https://x/{pid}"}
        offset = int(url.split("offset=")[1])
        return pages[offset]

    monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
    postings = fetch_smartrecruiters("acme")
    assert [p.external_id for p in postings] == ["1", "2", "3", "4", "5"]
