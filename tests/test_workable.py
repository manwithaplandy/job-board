import json
from pathlib import Path

import job_discovery.adapters.workable as workable
from job_discovery.adapters.workable import fetch_workable, parse_workable_job
from job_discovery.jd import extract_description

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "workable.json").read_text())
WIDGET = FIXTURE["widget"]
JOBS = {j["shortcode"]: j for j in WIDGET["jobs"]}

WIDGET_URL = "https://apply.workable.com/api/v1/widget/accounts/acme?details=true"


def test_field_mapping_uses_widget_fields_and_telecommuting():
    eng = parse_workable_job(JOBS["ENG123"], "acme")
    assert eng.external_id == "ENG123"
    assert eng.title == "Senior Backend Engineer"
    # URL is built account-qualified (not from application_url/shortlink).
    assert eng.url == "https://apply.workable.com/acme/j/ENG123/"
    assert eng.location == "San Francisco, California, United States"
    assert eng.department == "Engineering"  # widget `department` is a string
    assert eng.remote is True  # job-top-level `telecommuting` flag
    assert eng.raw is JOBS["ENG123"]  # the full widget entry (with description) is kept


def test_department_list_and_onsite_not_remote():
    ops = parse_workable_job(JOBS["OPS456"], "acme")
    assert ops.department == "Operations"  # tolerate `department` given as a list
    assert ops.location == "Austin, Texas, United States"
    assert ops.url == "https://apply.workable.com/acme/j/OPS456/"
    assert ops.remote is False  # telecommuting False + non-remote location


def test_url_is_account_qualified():
    ds = parse_workable_job(JOBS["DS789"], "acme")
    assert ds.url == "https://apply.workable.com/acme/j/DS789/"
    assert ds.location == "Toronto, Ontario, Canada"
    assert ds.remote is False


def test_extract_description_reads_merged_widget_html():
    # The widget merges description + requirements + benefits into `description`.
    out = extract_description("workable", JOBS["ENG123"])
    assert "Senior Backend Engineer" in out
    assert "5+ years experience" in out
    assert "Equity & healthcare" in out  # entity decoded, tags stripped
    assert "<" not in out


def test_extract_description_none_when_empty():
    assert extract_description("workable", {"description": ""}) is None


def test_fetch_is_a_single_widget_call_with_no_pagination(monkeypatch):
    requested: list[str] = []

    def fake_get_json(url):
        requested.append(url)
        return WIDGET

    monkeypatch.setattr(workable, "get_json", fake_get_json)
    postings = fetch_workable("acme")

    assert [p.external_id for p in postings] == ["ENG123", "OPS456", "DS789"]
    # exactly ONE call: the widget endpoint — no per-job detail fetch, no paging
    assert requested == [WIDGET_URL]
    assert postings[0].url == "https://apply.workable.com/acme/j/ENG123/"


def test_fetch_keeps_minimal_posting_when_job_malformed(monkeypatch):
    # A malformed entry (here: missing `title`, which the parser dereferences)
    # must not abort the company fetch nor be dropped — dropping it would let
    # run.py's close-detection falsely close a still-open job. A minimal posting
    # built from the entry is kept instead.
    payload = {"name": "Acme", "jobs": [
        {"shortcode": "ENG123", "title": "Good", "telecommuting": False,
         "city": "SF", "department": "Eng", "description": "<p>x</p>"},
        {"shortcode": "BAD"},  # no title -> parse raises -> minimal posting kept
    ]}

    def fake_get_json(url):
        return payload

    monkeypatch.setattr(workable, "get_json", fake_get_json)
    postings = fetch_workable("acme")
    assert [p.external_id for p in postings] == ["ENG123", "BAD"]
    bad = postings[1]
    assert bad.title is None  # no title available in the listing entry
    assert bad.url == "https://apply.workable.com/acme/j/BAD/"  # token+shortcode


def test_fetch_drops_only_entries_without_a_shortcode(monkeypatch):
    # The single legitimate drop: an entry with no shortcode (no stable id, no
    # apply URL) cannot become even a minimal posting.
    payload = {"jobs": [
        {"title": "No Shortcode", "telecommuting": True},  # no shortcode -> dropped
        {"shortcode": "OK", "title": "OK", "telecommuting": False,
         "city": "NYC", "department": "Eng", "description": "<p>x</p>"},
    ]}

    def fake_get_json(url):
        return payload

    monkeypatch.setattr(workable, "get_json", fake_get_json)
    postings = fetch_workable("acme")
    assert [p.external_id for p in postings] == ["OK"]
