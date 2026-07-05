"""Unit tests for free ATS-board company enrichment (plan C1 + C2).

`get_json` / `ADAPTERS` are monkeypatched so no network is touched, but the real
`html_to_text` / `extract_description` run so the HTML/JD parse is genuinely
exercised. The backfill's per-row decision (`plan_enrichment`) is DB-free and the
scope query is validated behind `requires_db`.
"""
import company_discovery.enrich as enrich
import company_discovery.enrich_backfill as bf
from company_discovery import db
from job_discovery.models import Posting
from tests.conftest import requires_db

USER = "44444444-4444-4444-4444-444444444444"


# --------------------------------------------------------------------------
# enrich_greenhouse
# --------------------------------------------------------------------------
def test_greenhouse_name_and_about(monkeypatch):
    def fake_get_json(url):
        assert url == "https://boards-api.greenhouse.io/v1/boards/acme"
        return {"name": "Acme Corp", "content": "<div>Cloud &amp; AI platform.</div>"}

    monkeypatch.setattr(enrich, "get_json", fake_get_json)
    assert enrich.enrich_greenhouse("acme") == ("Acme Corp", "Cloud & AI platform.")


def test_greenhouse_name_only_when_content_null(monkeypatch):
    monkeypatch.setattr(enrich, "get_json", lambda url: {"name": "Solo", "content": None})
    assert enrich.enrich_greenhouse("t") == ("Solo", None)


def test_greenhouse_empty_payload(monkeypatch):
    monkeypatch.setattr(enrich, "get_json", lambda url: {})
    assert enrich.enrich_greenhouse("t") == (None, None)


def test_greenhouse_blank_name_becomes_none(monkeypatch):
    monkeypatch.setattr(enrich, "get_json", lambda url: {"name": "   ", "content": None})
    assert enrich.enrich_greenhouse("t") == (None, None)


def test_greenhouse_about_truncated_to_2000(monkeypatch):
    long_html = "<p>" + ("x" * 3000) + "</p>"
    monkeypatch.setattr(enrich, "get_json", lambda url: {"name": "N", "content": long_html})
    name, about = enrich.enrich_greenhouse("t")
    assert name == "N"
    assert about is not None and len(about) == 2000


# --------------------------------------------------------------------------
# enrich_workable
# --------------------------------------------------------------------------
def test_workable_name_and_about(monkeypatch):
    def fake_get_json(url):
        assert url == "https://apply.workable.com/api/v1/widget/accounts/acme?details=true"
        return {"name": "Acme", "description": "<p>We build developer tools.</p>", "jobs": []}

    monkeypatch.setattr(enrich, "get_json", fake_get_json)
    assert enrich.enrich_workable("acme") == ("Acme", "We build developer tools.")


def test_workable_no_description(monkeypatch):
    monkeypatch.setattr(enrich, "get_json", lambda url: {"name": "Acme", "jobs": []})
    assert enrich.enrich_workable("acme") == ("Acme", None)


# --------------------------------------------------------------------------
# enrich_smartrecruiters
# --------------------------------------------------------------------------
def test_smartrecruiters_name_and_about(monkeypatch):
    def fake_get_json(url):
        if "/postings/" in url:  # per-posting detail
            assert url == "https://api.smartrecruiters.com/v1/companies/srco/postings/job1"
            return {
                "company": {"name": "SR Co"},
                "jobAd": {"sections": {"companyDescription": {"text": "<p>About SR.</p>"}}},
            }
        assert url == "https://api.smartrecruiters.com/v1/companies/srco/postings?limit=1&offset=0"
        return {"content": [{"id": "job1"}], "totalFound": 1}

    monkeypatch.setattr(enrich, "get_json", fake_get_json)
    assert enrich.enrich_smartrecruiters("srco") == ("SR Co", "About SR.")


def test_smartrecruiters_zero_postings(monkeypatch):
    monkeypatch.setattr(enrich, "get_json", lambda url: {"content": [], "totalFound": 0})
    assert enrich.enrich_smartrecruiters("srco") == (None, None)


# --------------------------------------------------------------------------
# enrich_from_jd (lever / ashby)
# --------------------------------------------------------------------------
def _posting(title, raw):
    return Posting(external_id="1", title=title, url="https://x", raw=raw)


def test_enrich_from_jd_derives_about_with_title_header(monkeypatch):
    posting = _posting("Senior Engineer",
                       {"descriptionPlain": "We are a fintech building payments."})
    monkeypatch.setattr(enrich, "ADAPTERS", {"lever": lambda token: [posting]})
    name, about = enrich.enrich_from_jd("lever", "acme")
    assert name is None
    assert about.startswith("Job postings from this company's board include: Senior Engineer")
    assert "fintech building payments" in about


def test_enrich_from_jd_truncates_to_2000(monkeypatch):
    posting = _posting("T", {"descriptionPlain": "z" * 3000})
    monkeypatch.setattr(enrich, "ADAPTERS", {"lever": lambda token: [posting]})
    name, about = enrich.enrich_from_jd("lever", "acme")
    assert name is None and len(about) == 2000


def test_enrich_from_jd_no_extractable_jd(monkeypatch):
    posting = _posting("T", {"id": "1"})  # truthy raw, but no JD fields
    monkeypatch.setattr(enrich, "ADAPTERS", {"lever": lambda token: [posting]})
    assert enrich.enrich_from_jd("lever", "acme") == (None, None)


def test_enrich_from_jd_skips_to_first_posting_with_jd(monkeypatch):
    p1 = _posting("No JD", {"id": "1"})
    p2 = _posting("Has JD", {"descriptionPlain": "real jd text"})
    monkeypatch.setattr(enrich, "ADAPTERS", {"lever": lambda token: [p1, p2]})
    name, about = enrich.enrich_from_jd("lever", "acme")
    assert name is None
    assert "Has JD" in about and "real jd text" in about


def test_enrich_from_jd_ashby(monkeypatch):
    posting = _posting("Backend Dev", {"descriptionPlain": "Ashby-hosted infra company."})
    monkeypatch.setattr(enrich, "ADAPTERS", {"ashby": lambda token: [posting]})
    name, about = enrich.enrich_from_jd("ashby", "acme")
    assert name is None
    assert "Ashby-hosted infra company." in about


# --------------------------------------------------------------------------
# backfill per-row decision (pure, DB-free)
# --------------------------------------------------------------------------
def test_plan_greenhouse_maps_to_ats_board(monkeypatch):
    monkeypatch.setattr(bf, "ENRICHERS", {"greenhouse": lambda t: ("Acme", "about text")})
    assert bf.plan_enrichment("greenhouse", "acme") == ("Acme", "about text", "ats_board")


def test_plan_lever_maps_to_jd_probe(monkeypatch):
    monkeypatch.setattr(bf, "enrich_from_jd", lambda ats, token: (None, "jd about"))
    assert bf.plan_enrichment("lever", "acme") == (None, "jd about", "jd_probe")


def test_plan_ashby_maps_to_jd_probe(monkeypatch):
    monkeypatch.setattr(bf, "enrich_from_jd", lambda ats, token: (None, "jd about"))
    assert bf.plan_enrichment("ashby", "acme") == (None, "jd about", "jd_probe")


def test_plan_skips_when_enricher_returns_empty(monkeypatch):
    monkeypatch.setattr(bf, "ENRICHERS", {"greenhouse": lambda t: (None, None)})
    assert bf.plan_enrichment("greenhouse", "acme") is None


def test_plan_skips_when_enricher_raises(monkeypatch):
    def boom(t):
        raise RuntimeError("404 dead board")

    monkeypatch.setattr(bf, "ENRICHERS", {"greenhouse": boom})
    assert bf.plan_enrichment("greenhouse", "acme") is None


def test_plan_skips_unsupported_ats():
    # workday has an adapter but no board-metadata / JD-probe enricher.
    assert bf.plan_enrichment("workday", "acme") is None


def test_plan_name_only_result_is_kept(monkeypatch):
    # A name-only board (about None) is still a usable enrichment.
    monkeypatch.setattr(bf, "ENRICHERS", {"greenhouse": lambda t: ("Acme", None)})
    assert bf.plan_enrichment("greenhouse", "acme") == ("Acme", None, "ats_board")


# --------------------------------------------------------------------------
# backfill scope query (needs a DB)
# --------------------------------------------------------------------------
def _review_row(company_id, verdict, pv="v1"):
    return {
        "user_id": USER, "company_id": company_id, "company_profile_version": pv,
        "verdict": verdict, "confidence": "high", "reasoning": "r",
        "industry": None, "industry_subcategory": None,
        "tech_tags": [], "red_flags": [], "model": "m", "error": None,
    }


@requires_db
def test_select_to_enrich_scope(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) VALUES "
            "('ActiveCo','greenhouse','active', TRUE, 'dataset'),"
            "('NoReview','greenhouse','noreview', FALSE, 'dataset'),"
            "('Excluded','greenhouse','excluded', FALSE, 'dataset'),"
            "('Unknowned','greenhouse','unknowned', FALSE, 'dataset'),"
            "('Enriched','greenhouse','enriched', TRUE, 'dataset')"
        )
        # Already-enriched row: display_name set -> must be skipped even though active.
        cur.execute("UPDATE companies SET display_name='Already' WHERE token='enriched'")
    conn.commit()
    ids = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, token FROM companies")
        for r in cur.fetchall():
            ids[r["token"]] = r["id"]
    db.upsert_company_review(conn, _review_row(ids["excluded"], "exclude"))
    db.upsert_company_review(conn, _review_row(ids["unknowned"], "unknown"))
    conn.commit()

    tokens = {r["token"] for r in bf.select_to_enrich(conn)}
    assert tokens == {"active", "noreview", "unknowned"}


@requires_db
def test_select_to_enrich_no_duplicate_rows_across_reviews(conn):
    """A company reviewed by multiple users must appear once (DISTINCT collapses
    the per-review fan-out)."""
    other = "55555555-5555-5555-5555-555555555555"
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) "
            "VALUES ('Multi','greenhouse','multi', TRUE, 'dataset')"
        )
        cur.execute("SELECT id FROM companies WHERE token='multi'")
        cid = cur.fetchone()["id"]
    conn.commit()
    db.upsert_company_review(conn, {**_review_row(cid, "include"), "user_id": USER})
    db.upsert_company_review(conn, {**_review_row(cid, "unknown"), "user_id": other})
    conn.commit()
    rows = [r for r in bf.select_to_enrich(conn) if r["token"] == "multi"]
    assert len(rows) == 1
