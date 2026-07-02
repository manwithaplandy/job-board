import json
from pathlib import Path

import pytest

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

# Real-shaped detail ids captured from BoschGroup / TheNielsenCompany:
BOSCH = "744000135080134"      # postingUrl + applyUrl, department {} -> function
NIELSEN = "744000900000001"    # no postingUrl, applyUrl present, department.label
ARCHITECT = "744000135078460"  # postingUrl + applyUrl, hybrid:true, empty sections


def test_url_prefers_posting_url_over_apply_url():
    # `postingUrl` is the canonical viewable page (200); `applyUrl` (…?oga=true)
    # 302->403s for non-browser clients and must NOT be used even though present.
    bosch = parse_smartrecruiters_posting(DETAILS[BOSCH])
    assert bosch.external_id == "744000135080134"
    assert bosch.title == "Facilities Soft Services Engineer"
    assert bosch.url == (
        "https://jobs.smartrecruiters.com/BoschGroup/"
        "744000135080134-facilities-soft-services-engineer"
    )  # postingUrl, NOT applyUrl
    assert "oga=true" not in bosch.url
    assert bosch.location == "Pedro Escobedo, Qro., mx"


def test_url_falls_back_to_bare_id_form_when_posting_url_absent():
    # No `postingUrl`; `applyUrl` is present but must be ignored. The URL falls
    # back to the bare-id form built from company.identifier + id.
    nielsen = parse_smartrecruiters_posting(DETAILS[NIELSEN])
    assert nielsen.url == (
        "https://jobs.smartrecruiters.com/TheNielsenCompany/744000900000001"
    )
    assert "oga=true" not in nielsen.url


def test_department_uses_department_label_when_present():
    nielsen = parse_smartrecruiters_posting(DETAILS[NIELSEN])
    assert nielsen.department == "Technology"  # department.label


def test_department_falls_back_to_function_label_when_department_empty():
    # Bosch returns department:{} and categorises under `function` instead.
    bosch = parse_smartrecruiters_posting(DETAILS[BOSCH])
    assert DETAILS[BOSCH]["department"] == {}  # guard: fixture really is empty
    assert bosch.department == "Education"  # function.label fallback


def test_remote_from_location_remote_flag():
    assert parse_smartrecruiters_posting(DETAILS[NIELSEN]).remote is True
    assert parse_smartrecruiters_posting(DETAILS[BOSCH]).remote is False


def test_hybrid_is_not_treated_as_remote():
    # location.hybrid is a separate bool; only location.remote marks remote.
    detail = DETAILS[ARCHITECT]
    assert detail["location"]["hybrid"] is True
    assert detail["location"]["remote"] is False
    assert parse_smartrecruiters_posting(detail).remote is False


def test_extract_description_joins_titled_sections():
    out = extract_description("smartrecruiters", DETAILS[BOSCH])
    assert "Descripción de la empresa" in out and "Bosch fue fundada" in out
    assert "Descripción del empleo" in out and "Facilities Services" in out
    assert "Requisitos" in out and "Engineering background" in out
    assert "Get to know more" in out
    assert "Landscaping & Pest Control" in out  # &amp; entity decoded
    assert "<" not in out


def test_extract_description_none_when_sections_empty():
    assert extract_description("smartrecruiters", DETAILS[ARCHITECT]) is None


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
    postings = fetch_smartrecruiters("BoschGroup")

    assert [p.external_id for p in postings] == [BOSCH, NIELSEN, ARCHITECT]
    assert requested[0] == (
        "https://api.smartrecruiters.com/v1/companies/BoschGroup/postings"
        "?limit=2&offset=0"
    )
    assert any("offset=2" in u for u in requested)  # second page was walked


def test_fetch_stops_on_short_last_page_with_positive_total(monkeypatch):
    # totalFound=3 across a full page (2) + a short page (1): the short page ends
    # paging; offsets advance to a real short last page and never wrap.
    monkeypatch.setattr(smartrecruiters, "_PAGE_LIMIT", 2)
    offsets: list[int] = []

    def fake_get_json(url):
        if "/postings/" in url:  # detail call
            return DETAILS[url.rsplit("/", 1)[1]]
        offset = int(url.split("offset=")[1])
        offsets.append(offset)
        return FIXTURE["list_pages"][0 if offset == 0 else 1]

    monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
    postings = fetch_smartrecruiters("BoschGroup")
    assert [p.external_id for p in postings] == [BOSCH, NIELSEN, ARCHITECT]
    assert offsets == [0, 2]  # stopped after the short page; no wrap/extra fetch


def test_fetch_keeps_minimal_posting_when_detail_fails(monkeypatch):
    # A failed detail fetch must NOT drop the posting (dropping it would let
    # run.py's close-detection falsely close a still-open job). A minimal posting
    # is built from the listing item so the job stays in `seen`.
    page = {"totalFound": 2, "content": [
        {"id": "744000135080134", "name": "Facilities Soft Services Engineer"},
        {"id": "BAD", "name": "Broken Posting"},
    ]}

    def fake_get_json(url):
        if url.endswith("/postings/BAD"):
            raise RuntimeError("404")
        if "/postings/" in url:
            pid = url.rsplit("/", 1)[1]
            return {
                "id": pid,
                "name": "Facilities Soft Services Engineer",
                "postingUrl": f"https://jobs.smartrecruiters.com/BoschGroup/{pid}",
            }
        return page

    monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
    postings = fetch_smartrecruiters("BoschGroup")
    assert [p.external_id for p in postings] == ["744000135080134", "BAD"]
    bad = postings[1]
    assert bad.title == "Broken Posting"  # carried over from the listing item
    assert bad.url == "https://jobs.smartrecruiters.com/BoschGroup/BAD"  # token+id


def test_fetch_keeps_minimal_posting_when_detail_malformed(monkeypatch):
    # A malformed HTTP-200 detail body (here: missing `id`, which the parser
    # dereferences) must not abort the whole company fetch.
    page = {"totalFound": 1, "content": [
        {"id": "744000135080134", "name": "Facilities Soft Services Engineer"},
    ]}

    def fake_get_json(url):
        if "/postings/" in url:
            return {"name": "Facilities Soft Services Engineer"}  # no id key
        return page

    monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
    postings = fetch_smartrecruiters("BoschGroup")
    assert [p.external_id for p in postings] == ["744000135080134"]
    assert postings[0].url == (
        "https://jobs.smartrecruiters.com/BoschGroup/744000135080134"
    )


def test_fetch_pages_until_short_page_when_total_missing(monkeypatch):
    # When the listing omits `totalFound`, paging must continue while a full page
    # comes back and stop on the short page — not truncate after page 1 (which
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
            return {"id": pid, "name": f"Job {pid}",
                    "postingUrl": f"https://jobs.smartrecruiters.com/acme/{pid}"}
        offset = int(url.split("offset=")[1])
        return pages[offset]

    monkeypatch.setattr(smartrecruiters, "get_json", fake_get_json)
    postings = fetch_smartrecruiters("acme")
    assert [p.external_id for p in postings] == ["1", "2", "3", "4", "5"]


# ── A3: missing top-level key ─────────────────────────────────────────────────

def test_missing_content_key_raises(monkeypatch):
    monkeypatch.setattr(smartrecruiters, "get_json", lambda url: {"error": "gone"})
    with pytest.raises(ValueError, match="missing 'content'"):
        fetch_smartrecruiters("BoschGroup")
