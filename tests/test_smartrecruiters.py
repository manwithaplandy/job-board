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


def test_fetch_skips_posting_when_detail_fails(monkeypatch):
    page = {"totalFound": 2, "content": [{"id": "743111"}, {"id": "BAD"}]}

    def fake_get_json(url):
        if url.endswith("/postings/BAD"):
            raise RuntimeError("404")
        if "/postings/" in url:
            return DETAILS[url.rsplit("/", 1)[1]]
        return page

    monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
    postings = fetch_smartrecruiters("acme")
    assert [p.external_id for p in postings] == ["743111"]
