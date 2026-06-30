import json
from pathlib import Path

import job_discovery.adapters.workable as workable
from job_discovery.adapters.workable import fetch_workable, parse_workable_job
from job_discovery.jd import extract_description

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "workable.json").read_text())
DETAILS = FIXTURE["details"]


def test_field_mapping_uses_application_url_and_telecommuting():
    eng = parse_workable_job(DETAILS["ENG123"])
    assert eng.external_id == "ENG123"
    assert eng.title == "Senior Backend Engineer"
    assert eng.url == "https://apply.workable.com/acme/j/ENG123/"  # application_url
    assert eng.location == "San Francisco, California, United States"
    assert eng.department == "Engineering"
    assert eng.remote is True  # location.telecommuting


def test_department_list_and_onsite_not_remote():
    ops = parse_workable_job(DETAILS["OPS456"])
    assert ops.department == "Operations"  # department given as a list
    assert ops.location == "Austin, Texas, United States"
    assert ops.remote is False  # workplace_type == "on-site"


def test_url_falls_back_to_shortlink():
    ds = parse_workable_job(DETAILS["DS789"])
    assert ds.url == "https://apply.workable.com/j/DS789"  # no application_url
    assert ds.remote is False  # hybrid


def test_extract_description_combines_sections():
    out = extract_description("workable", DETAILS["ENG123"])
    assert "Senior Backend Engineer" in out
    assert "5+ years experience" in out
    assert "Equity & healthcare" in out  # entity decoded, tags stripped
    assert "<" not in out


def test_extract_description_none_when_empty():
    assert extract_description("workable", {"requirements": "", "benefits": ""}) is None


def test_fetch_walks_pages_and_fetches_details(monkeypatch):
    requested: list[str] = []
    pages = iter(FIXTURE["list_pages"])

    def fake_get_json(url):
        requested.append(url)
        if "/jobs/" in url:  # detail call: /spi/v3/jobs/{shortcode}
            return DETAILS[url.rsplit("/", 1)[1]]
        return next(pages)  # listing page (first call + each paging.next)

    monkeypatch.setattr(workable, "get_json", fake_get_json)
    postings = fetch_workable("acme")

    assert [p.external_id for p in postings] == ["ENG123", "OPS456", "DS789"]
    assert requested[0] == "https://acme.workable.com/spi/v3/jobs?state=published"
    # second listing page is the server-provided paging.next cursor
    assert "since_id=1002" in requested[3]


def test_fetch_skips_posting_when_detail_fails(monkeypatch):
    page = {"jobs": [{"shortcode": "ENG123"}, {"shortcode": "BAD"}], "paging": {}}

    def fake_get_json(url):
        if url.endswith("/jobs/BAD"):
            raise RuntimeError("404")
        if "/jobs/" in url:
            return DETAILS[url.rsplit("/", 1)[1]]
        return page

    monkeypatch.setattr(workable, "get_json", fake_get_json)
    postings = fetch_workable("acme")
    assert [p.external_id for p in postings] == ["ENG123"]
