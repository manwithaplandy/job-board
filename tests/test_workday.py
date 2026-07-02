import json
from pathlib import Path

import pytest

import job_discovery.adapters.workday as workday
from job_discovery.adapters.workday import (
    _choose_subdivider,
    _iter_candidate_facets,
    _parse_token,
    _true_total,
    fetch_workday,
    parse_workday_job,
)
from job_discovery.jd import extract_description

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "workday.json").read_text())
DETAILS = FIXTURE["details"]
LARGE = json.loads(
    (Path(__file__).parent / "fixtures" / "workday_large.json").read_text()
)
LID = LARGE["ids"]
LDETAILS = LARGE["details"]
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
    postings = list(fetch_workday("acme:wd5:External"))
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
    postings = list(fetch_workday("acme:wd5:External"))
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
    postings = list(fetch_workday("acme:wd5:External"))
    assert [b["offset"] for b in bodies] == [0, 2]  # stopped once offset >= 4
    assert len(postings) == 4


# --- true-total / facet helpers -------------------------------------------


def test_true_total_sums_disjoint_facet_over_capped_listing_total():
    # listing `total` is the unreliable 2000 cap; jobFamilyGroup counts sum to
    # the real tenant total (the helper must prefer the facet sum).
    facets = [{"facetParameter": "jobFamilyGroup", "values": [
        {"id": "a", "count": 1759}, {"id": "b", "count": 791}]}]
    assert _true_total(facets, 2000) == 2550


def test_true_total_falls_back_through_disjoint_facets():
    # no jobFamilyGroup -> the next disjoint facet (workerSubType) is summed.
    facets = [{"facetParameter": "workerSubType", "values": [
        {"id": "a", "count": 100}, {"id": "b", "count": 5}]}]
    assert _true_total(facets, 2000) == 105


def test_true_total_uses_listing_total_only_when_no_facets():
    assert _true_total(None, 1234) == 1234
    assert _true_total([], None) == 0


def test_iter_candidate_facets_descends_into_location_group():
    # the nested locationMainGroup wrapper must expose its inner location facets
    # as selectable candidates (its own values are facets, not filterable ids).
    facets = [
        {"facetParameter": "jobFamilyGroup", "values": [{"id": "e", "count": 1}]},
        {"facetParameter": "locationMainGroup", "values": [
            {"facetParameter": "locationHierarchy1", "values": [{"id": "us", "count": 9}]},
            {"facetParameter": "locations", "values": [{"id": "sc", "count": 3}]},
        ]},
    ]
    assert {p for p, _ in _iter_candidate_facets(facets)} == {
        "jobFamilyGroup", "locationHierarchy1", "locations"
    }


def test_choose_subdivider_skips_applied_and_over_cap_picks_tightest(monkeypatch):
    monkeypatch.setattr(workday, "_HARD_CAP", 100)
    facets = [
        {"facetParameter": "jobFamilyGroup", "values": [{"id": "e", "count": 50}]},
        {"facetParameter": "workerSubType", "values": [{"id": "r", "count": 150}]},
        {"facetParameter": "timeType", "values": [
            {"id": "f", "count": 40}, {"id": "p", "count": 10}]},
        {"facetParameter": "locationMainGroup", "values": [
            {"facetParameter": "locationHierarchy1", "values": [
                {"id": "us", "count": 30}, {"id": "eu", "count": 20}]},
        ]},
    ]
    param, values = _choose_subdivider(facets, {"jobFamilyGroup"})
    # jobFamilyGroup excluded (already applied); workerSubType excluded (150>=cap);
    # locationHierarchy1 (max 30) beats timeType (max 40) as the tightest split.
    assert param == "locationHierarchy1"
    assert {v["id"] for v in values} == {"us", "eu"}


def test_choose_subdivider_returns_none_when_nothing_under_cap(monkeypatch):
    monkeypatch.setattr(workday, "_HARD_CAP", 4)
    facets = [{"facetParameter": "workerSubType", "values": [{"id": "r", "count": 10}]}]
    assert _choose_subdivider(facets, {"jobFamilyGroup"}) is None


# --- faceted crawl (tenants with >2000 postings) --------------------------


def _large_facet_label(applied: dict) -> str:
    """Map an appliedFacets body to its workday_large.json response label."""
    if not applied:
        return "unfaceted"
    jfg = applied.get("jobFamilyGroup", [])
    loc = applied.get("locationHierarchy1", [])
    if jfg == [LID["ENG"]] and loc == [LID["US"]]:
        return "ENG_US"
    if jfg == [LID["ENG"]] and loc == [LID["EU"]]:
        return "ENG_EU"
    if jfg == [LID["ENG"]]:
        return "ENG"
    if jfg == [LID["SALES"]]:
        return "SALES"
    raise AssertionError(f"unexpected appliedFacets {applied}")


def _make_large_fakes():
    """Build post/get fakes that DISPATCH on appliedFacets, plus call recorders."""
    post_bodies: list[dict] = []
    get_paths: list[str] = []

    def fake_post_json(url, json=None):
        post_bodies.append(json)
        assert url == f"{CXS}/jobs"
        label = _large_facet_label(json["appliedFacets"])
        resp = LARGE["unfaceted"] if label == "unfaceted" else LARGE["filtered"][label]
        items = resp.get("jobPostings") or []
        off = json["offset"]
        page = dict(resp)
        page["jobPostings"] = items[off: off + workday._PAGE_LIMIT]  # slice the page
        return page

    def fake_get_json(url):
        for key in LDETAILS:
            if url.endswith(key):
                get_paths.append(key)
                return LDETAILS[key]
        raise AssertionError(f"unexpected detail url {url}")

    return fake_post_json, fake_get_json, post_bodies, get_paths


def test_large_tenant_escalates_facets_subdivides_and_dedups(monkeypatch):
    # true_total (8, summed from jobFamilyGroup) exceeds the capped listing total
    # (6) -> escalate to a facet-partitioned crawl, sub-dividing the over-cap
    # Engineering slice on the location facet and de-duping its US/EU overlap.
    monkeypatch.setattr(workday, "_PAGE_LIMIT", 2)
    monkeypatch.setattr(workday, "_HARD_CAP", 6)
    fake_post, fake_get, bodies, gets = _make_large_fakes()
    monkeypatch.setattr(workday, "post_json", fake_post)
    monkeypatch.setattr(workday, "get_json", fake_get)

    postings = fetch_workday("acme:wd5:External")
    ids = [p.external_id for p in postings]
    applied = [b["appliedFacets"] for b in bodies]

    assert {} in applied  # the single unfaceted probe
    assert {"jobFamilyGroup": [LID["ENG"]]} in applied  # partition by category
    assert {"jobFamilyGroup": [LID["SALES"]]} in applied
    # Engineering (count 6 == cap) is recursively sub-divided on the location facet
    assert {"jobFamilyGroup": [LID["ENG"]],
            "locationHierarchy1": [LID["US"]]} in applied
    assert {"jobFamilyGroup": [LID["ENG"]],
            "locationHierarchy1": [LID["EU"]]} in applied

    assert sorted(ids) == sorted([
        "/job/US-CA-Santa-Clara/Account-Executive_JR-S1",
        "/job/US-NY-New-York/Sales-Director_JR-S2",
        "/job/US-CA-Santa-Clara/Principal-Systems-Software-Engineer_JR-E1",
        "/job/US-TX-Austin/Senior-GPU-Compiler-Engineer_JR-E2",
        "/job/US-CA-Remote/Distributed-Systems-Engineer_JR-E3",
        "/job/US-CA-Santa-Clara/Senior-HPC-Architect_JR-E4",
        "/job/Germany-Munich/Embedded-Systems-Engineer_JR-E5",
        "/job/France-Remote/Compiler-Engineer_JR-E6",
        "/job/canary/JR-C1",  # A4: unfaceted walk after escalated crawl ingests these
        "/job/canary/JR-C2",
    ])
    assert len(ids) == len(set(ids)) == 10  # union == true total + canary; no duplicates
    # A4: the escalated path must also run an unfaceted walk to pick up postings
    # with NO jobFamilyGroup facet value (the canary postings above).
    assert any("canary" in i for i in ids)
    # dedup also skips the detail re-fetch for the overlapping e3/e4 postings
    assert gets.count("/job/US-CA-Remote/Distributed-Systems-Engineer_JR-E3") == 1
    assert gets.count("/job/US-CA-Santa-Clara/Senior-HPC-Architect_JR-E4") == 1


def test_small_tenant_with_facets_stays_on_unfaceted_walk(monkeypatch):
    # Facets are present but their true total is under the cap, so the adapter
    # must NOT escalate — it pages the plain unfaceted walk and never issues a
    # per-facet query (keeping small tenants cheap).
    monkeypatch.setattr(workday, "_PAGE_LIMIT", 2)
    monkeypatch.setattr(workday, "_HARD_CAP", 6)
    page0 = {
        "total": 3,
        "jobPostings": [
            {"externalPath": "/job/a/JR-1", "title": "A"},
            {"externalPath": "/job/b/JR-2", "title": "B"},
        ],
        "facets": [{"facetParameter": "jobFamilyGroup", "values": [
            {"descriptor": "Eng", "id": "eng", "count": 2},
            {"descriptor": "Sales", "id": "sales", "count": 1},
        ]}],
    }
    page1 = {"total": 3, "jobPostings": [{"externalPath": "/job/c/JR-3", "title": "C"}]}
    bodies: list[dict] = []

    def fake_post_json(url, json=None):
        bodies.append(json)
        return {0: page0, 2: page1}.get(json["offset"], {"jobPostings": []})

    def fake_get_json(url):
        return {"jobPostingInfo": {"title": "x", "externalUrl": f"https://x{url[-8:]}"}}

    monkeypatch.setattr(workday, "post_json", fake_post_json)
    monkeypatch.setattr(workday, "get_json", fake_get_json)
    postings = fetch_workday("acme:wd5:External")
    assert [p.external_id for p in postings] == [
        "/job/a/JR-1", "/job/b/JR-2", "/job/c/JR-3",
    ]
    assert all(b["appliedFacets"] == {} for b in bodies)  # never partitioned


# ── A3: missing top-level key ─────────────────────────────────────────────────


def test_missing_jobpostings_key_raises(monkeypatch):
    monkeypatch.setattr(workday, "post_json", lambda url, json=None: {"error": "gone"})
    with pytest.raises(ValueError, match="missing 'jobPostings'"):
        # fetch_workday is a generator; the error fires on first iteration.
        list(fetch_workday("acme:wd5:External"))


# ── A4: total-flap fallback + unfaceted walk on escalated crawls ──────────────


def test_crawl_falls_back_to_page_walk_when_total_flaps_to_zero(monkeypatch):
    """When a FACETED PARTITION's first page reports total=0 but still has a full
    page of postings (Workday total-flap bug), _crawl must fall back to _page_walk
    to keep paging and ingest all the postings — not stop after page 0.

    This exercises _crawl (not the unfaceted _page_walk path): the unfaceted probe
    returns a true_total > cap, forcing escalation to _crawl for each facet slice.
    The ENG slice's first page shows total=0 despite having a full page of items.
    """
    monkeypatch.setattr(workday, "_PAGE_LIMIT", 2)
    monkeypatch.setattr(workday, "_HARD_CAP", 4)
    # Unfaceted probe: true_total=5 (facet sum), forces escalation.
    unfaceted = {
        "total": 4,
        "jobPostings": [],
        "facets": [{"facetParameter": "jobFamilyGroup", "values": [
            {"descriptor": "Eng", "id": "eng", "count": 3},
            {"descriptor": "Sales", "id": "sales", "count": 2},
        ]}],
    }
    # ENG partition: total flaps to 0 despite 3 real postings across 2 pages.
    eng_pages = {
        0: {"total": 0, "jobPostings": [
            {"externalPath": "/job/eng/JR-E1", "title": "E1"},
            {"externalPath": "/job/eng/JR-E2", "title": "E2"},
        ]},
        2: {"total": 0, "jobPostings": [
            {"externalPath": "/job/eng/JR-E3", "title": "E3"},
        ]},
    }
    # SALES partition: normal (total=2 < cap, fits in 1 page).
    sales_page = {"total": 2, "jobPostings": [
        {"externalPath": "/job/sales/JR-S1", "title": "S1"},
        {"externalPath": "/job/sales/JR-S2", "title": "S2"},
    ]}
    offsets_by_facet: dict[str, list[int]] = {}

    def fake_post_json(url, json=None):
        applied = json.get("appliedFacets", {})
        off = json["offset"]
        if not applied:
            return unfaceted  # unfaceted probe
        facet_id = list(applied.values())[0][0]
        offsets_by_facet.setdefault(facet_id, []).append(off)
        if facet_id == "eng":
            return eng_pages.get(off, {"total": 0, "jobPostings": []})
        return sales_page if off == 0 else {"total": 2, "jobPostings": []}

    def fake_get_json(url):
        return {"jobPostingInfo": {"title": url[-6:], "externalUrl": f"https://x{url[-6:]}"}}

    monkeypatch.setattr(workday, "post_json", fake_post_json)
    monkeypatch.setattr(workday, "get_json", fake_get_json)
    postings = fetch_workday("acme:wd5:External")
    ids = [p.external_id for p in postings]
    # _crawl must have paged beyond offset 0 for ENG (total-flap fallback via _page_walk).
    assert offsets_by_facet.get("eng", []) == [0, 2], \
        "ENG partition must have been walked to offset 2 (total-flap fallback)"
    assert "/job/eng/JR-E1" in ids
    assert "/job/eng/JR-E2" in ids
    assert "/job/eng/JR-E3" in ids  # this one is missed without the fallback
    assert "/job/sales/JR-S1" in ids


def test_escalated_crawl_includes_unfaceted_postings(monkeypatch):
    """After the per-facet partition loop on an escalated crawl, the adapter must
    also do an unfaceted _page_walk to ingest postings with NO jobFamilyGroup
    facet value (they are absent from every per-facet slice)."""
    monkeypatch.setattr(workday, "_PAGE_LIMIT", 2)
    monkeypatch.setattr(workday, "_HARD_CAP", 4)
    # Unfaceted probe: facet count sum = 6 > cap=4 → escalates.
    # The probe page itself has 2 canary postings (no jobFamilyGroup).
    unfaceted = {
        "total": 4,
        "jobPostings": [
            {"externalPath": "/job/canary/JR-X1", "title": "Canary 1"},
            {"externalPath": "/job/canary/JR-X2", "title": "Canary 2"},
        ],
        "facets": [{"facetParameter": "jobFamilyGroup", "values": [
            {"descriptor": "Eng", "id": "eng", "count": 3},
            {"descriptor": "Sales", "id": "sales", "count": 3},
        ]}],
    }
    # ENG partition: 3 postings, all fit (count 3 < cap 4).
    eng_page = {"total": 3, "jobPostings": [
        {"externalPath": "/job/eng/JR-E1", "title": "Eng 1"},
        {"externalPath": "/job/eng/JR-E2", "title": "Eng 2"},
        {"externalPath": "/job/eng/JR-E3", "title": "Eng 3"},
    ]}
    # SALES partition: 2 postings (3 count but total=2 from first page).
    sales_page = {"total": 2, "jobPostings": [
        {"externalPath": "/job/sales/JR-S1", "title": "Sales 1"},
        {"externalPath": "/job/sales/JR-S2", "title": "Sales 2"},
    ]}

    def fake_post_json(url, json=None):
        applied = json.get("appliedFacets", {})
        off = json["offset"]
        if not applied:
            return unfaceted if off == 0 else {"jobPostings": []}
        facet_id = list(applied.values())[0][0]
        if facet_id == "eng":
            return eng_page if off == 0 else {"jobPostings": []}
        return sales_page if off == 0 else {"jobPostings": []}

    def fake_get_json(url):
        return {"jobPostingInfo": {"title": url[-6:], "externalUrl": f"https://x{url[-6:]}"}}

    monkeypatch.setattr(workday, "post_json", fake_post_json)
    monkeypatch.setattr(workday, "get_json", fake_get_json)
    postings = fetch_workday("acme:wd5:External")
    ids = [p.external_id for p in postings]
    # Both faceted postings AND unfaceted canary postings must be in the result.
    assert "/job/eng/JR-E1" in ids
    assert "/job/eng/JR-E2" in ids
    assert "/job/eng/JR-E3" in ids
    assert "/job/sales/JR-S1" in ids
    assert "/job/canary/JR-X1" in ids   # unfaceted postings picked up by the trailing walk
    assert "/job/canary/JR-X2" in ids


# ── A10: generator-based fetch (memory bounding) ──────────────────────────────


def test_fetch_workday_returns_iterator_not_list(monkeypatch):
    """fetch_workday must return a lazy iterator, not a list.

    Memory bounding: a Workday tenant can have tens of thousands of postings.
    Building a list before returning would hold every Posting object (+ its full
    raw detail dict) in memory simultaneously. An iterator lets run.py upsert and
    discard each posting before the next one is fetched, keeping peak memory at
    O(1) postings rather than O(N).
    """
    import types

    page = {"total": 1, "jobPostings": [
        {"externalPath": "/job/a/JR-1", "title": "A"},
    ]}

    monkeypatch.setattr(workday, "post_json",
                        lambda url, json=None: page if json["offset"] == 0 else {"jobPostings": []})
    monkeypatch.setattr(workday, "get_json",
                        lambda url: {"jobPostingInfo": {"title": "A", "externalUrl": "https://x/a"}})

    result = fetch_workday("acme:wd5:External")

    assert not isinstance(result, list), (
        "fetch_workday returned a list; it must return a lazy iterator/generator "
        "so callers process one posting at a time without buffering all N in memory"
    )
    # Must still be iterable and yield the correct posting.
    postings = list(result)
    assert len(postings) == 1
    assert postings[0].external_id == "/job/a/JR-1"


def test_fetch_is_lazy_bounds_detail_fetches(monkeypatch):
    """Consuming only the first page's worth of postings from fetch_workday must
    trigger at most one page's worth of detail fetches — proving the generator is
    lazy. An eager (list-building) implementation would fetch EVERY page's details
    up front (here 6), holding the whole tenant + all detail payloads in memory.
    """
    import itertools

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
        4: {"jobPostings": [
            {"externalPath": "/job/e/JR-5", "title": "E"},
            {"externalPath": "/job/f/JR-6", "title": "F"},
        ]},
        6: {"jobPostings": []},
    }
    post_calls = {"n": 0}
    detail_calls = {"n": 0}

    def fake_post_json(url, json=None):
        post_calls["n"] += 1
        return pages[json["offset"]]

    def fake_get_json(url):
        detail_calls["n"] += 1
        return {"jobPostingInfo": {"title": "x", "externalUrl": f"https://x{url[-10:]}"}}

    monkeypatch.setattr(workday, "post_json", fake_post_json)
    monkeypatch.setattr(workday, "get_json", fake_get_json)

    it = fetch_workday("acme:wd5:External")
    first_page = list(itertools.islice(it, workday._PAGE_LIMIT))  # pull ONE page's worth

    assert [p.external_id for p in first_page] == ["/job/a/JR-1", "/job/b/JR-2"]
    # Laziness: only the first page's details were fetched; later pages untouched.
    assert detail_calls["n"] <= workday._PAGE_LIMIT
    assert post_calls["n"] == 1  # never paged ahead to fetch later pages' listings/details


def test_oversized_partition_without_splitter_pages_to_cap_and_warns(monkeypatch, caplog):
    # A partition over the cap whose facets offer no value below the cap cannot be
    # sub-divided; the crawl must page it up to the hard cap (never looping past
    # the wrap, never silently dropping the tail) and warn that it is truncated.
    import logging

    monkeypatch.setattr(workday, "_PAGE_LIMIT", 2)
    monkeypatch.setattr(workday, "_HARD_CAP", 4)
    mega_items = [
        {"externalPath": f"/job/m/JR-{i}", "title": f"M{i}"} for i in range(1, 7)
    ]
    unfaceted = {
        "total": 4,
        "jobPostings": [],
        "facets": [{"facetParameter": "jobFamilyGroup", "values": [
            {"descriptor": "Mega", "id": "mega", "count": 10}]}],
    }
    mega = {  # filtered slice: reports the capped 4, but a finer facet still >= cap
        "total": 4,
        "jobPostings": mega_items,
        "facets": [{"facetParameter": "workerSubType", "values": [
            {"descriptor": "Regular", "id": "reg", "count": 10}]}],
    }

    def fake_post_json(url, json=None):
        resp = unfaceted if not json["appliedFacets"] else mega
        items = resp["jobPostings"]
        off = json["offset"]
        page = dict(resp)
        page["jobPostings"] = items[off: off + workday._PAGE_LIMIT]
        return page

    def fake_get_json(url):
        return {"jobPostingInfo": {"title": url[-6:], "externalUrl": f"https://x{url[-6:]}"}}

    monkeypatch.setattr(workday, "post_json", fake_post_json)
    monkeypatch.setattr(workday, "get_json", fake_get_json)
    with caplog.at_level(logging.WARNING, logger="job_discovery"):
        postings = fetch_workday("acme:wd5:External")
    ids = [p.external_id for p in postings]
    assert ids == ["/job/m/JR-1", "/job/m/JR-2", "/job/m/JR-3", "/job/m/JR-4"]
    assert "too large to fully enumerate" in caplog.text
