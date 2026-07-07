"""Unit tests for free ATS-board company enrichment (plan C1 + C2).

`get_json` / `ADAPTERS` are monkeypatched so no network is touched, but the real
`html_to_text` / `extract_description` run so the HTML/JD parse is genuinely
exercised. The backfill's per-row decision (`plan_enrichment`) is DB-free and the
scope query is validated behind `requires_db`.
"""
import company_discovery.enrich as enrich
import company_discovery.enrich_apply as ea
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
    monkeypatch.setattr(enrich, "fetch_board_name", lambda ats, token: None)
    name, about = enrich.enrich_from_jd("lever", "acme")
    assert name is None
    assert about.startswith("Job postings from this company's board include: Senior Engineer")
    assert "fintech building payments" in about


def test_enrich_from_jd_truncates_to_2000(monkeypatch):
    posting = _posting("T", {"descriptionPlain": "z" * 3000})
    monkeypatch.setattr(enrich, "ADAPTERS", {"lever": lambda token: [posting]})
    monkeypatch.setattr(enrich, "fetch_board_name", lambda ats, token: None)
    name, about = enrich.enrich_from_jd("lever", "acme")
    assert name is None and len(about) == 2000


def test_enrich_from_jd_no_extractable_jd(monkeypatch):
    posting = _posting("T", {"id": "1"})  # truthy raw, but no JD fields
    monkeypatch.setattr(enrich, "ADAPTERS", {"lever": lambda token: [posting]})
    monkeypatch.setattr(enrich, "fetch_board_name", lambda ats, token: None)
    assert enrich.enrich_from_jd("lever", "acme") == (None, None)


def test_enrich_from_jd_skips_to_first_posting_with_jd(monkeypatch):
    p1 = _posting("No JD", {"id": "1"})
    p2 = _posting("Has JD", {"descriptionPlain": "real jd text"})
    monkeypatch.setattr(enrich, "ADAPTERS", {"lever": lambda token: [p1, p2]})
    monkeypatch.setattr(enrich, "fetch_board_name", lambda ats, token: None)
    name, about = enrich.enrich_from_jd("lever", "acme")
    assert name is None
    assert "Has JD" in about and "real jd text" in about


def test_enrich_from_jd_ashby(monkeypatch):
    posting = _posting("Backend Dev", {"descriptionPlain": "Ashby-hosted infra company."})
    monkeypatch.setattr(enrich, "ADAPTERS", {"ashby": lambda token: [posting]})
    monkeypatch.setattr(enrich, "fetch_board_name", lambda ats, token: None)
    name, about = enrich.enrich_from_jd("ashby", "acme")
    assert name is None
    assert "Ashby-hosted infra company." in about


# --------------------------------------------------------------------------
# fetch_board_name (lever / ashby board-page <title>)
# --------------------------------------------------------------------------
def test_fetch_board_name_lever_plain_title(monkeypatch):
    def fake_get_text(url):
        assert url == "https://jobs.lever.co/pushpress"
        return "<html><head><title>PushPress</title></head></html>"

    monkeypatch.setattr(enrich, "get_text", fake_get_text)
    assert enrich.fetch_board_name("lever", "pushpress") == "PushPress"


def test_fetch_board_name_ashby_strips_jobs_suffix(monkeypatch):
    def fake_get_text(url):
        assert url == "https://jobs.ashbyhq.com/modal"
        return "<title>Modal Jobs</title>"

    monkeypatch.setattr(enrich, "get_text", fake_get_text)
    assert enrich.fetch_board_name("ashby", "modal") == "Modal"


def test_fetch_board_name_unescapes_entities(monkeypatch):
    monkeypatch.setattr(enrich, "get_text",
                        lambda url: "<title>AT&amp;T Careers Jobs</title>")
    assert enrich.fetch_board_name("ashby", "t") == "AT&T Careers"


def test_fetch_board_name_missing_or_blank_title(monkeypatch):
    monkeypatch.setattr(enrich, "get_text", lambda url: "<html><body>hi</body></html>")
    assert enrich.fetch_board_name("lever", "t") is None
    monkeypatch.setattr(enrich, "get_text", lambda url: "<title>   </title>")
    assert enrich.fetch_board_name("lever", "t") is None


def test_fetch_board_name_unsupported_ats_no_fetch(monkeypatch):
    def boom(url):
        raise AssertionError("must not fetch for unsupported ats")

    monkeypatch.setattr(enrich, "get_text", boom)
    assert enrich.fetch_board_name("greenhouse", "t") is None


def test_fetch_board_name_caps_length(monkeypatch):
    monkeypatch.setattr(enrich, "get_text",
                        lambda url: "<title>" + ("x" * 500) + "</title>")
    name = enrich.fetch_board_name("lever", "t")
    assert name is not None and len(name) == 200


def test_fetch_board_name_rejects_generic_titles(monkeypatch):
    # Some boards title the page, not the company (207 prod ashby boards were
    # just "Jobs") — storing that is worse than the slug fallback.
    for title in ("Jobs", "jobs", "Careers", "Job Board", "Careers Jobs"):
        monkeypatch.setattr(enrich, "get_text",
                            lambda url, t=title: f"<title>{t}</title>")
        assert enrich.fetch_board_name("ashby", "t") is None, title


def test_greenhouse_generic_board_name_becomes_none(monkeypatch):
    monkeypatch.setattr(enrich, "get_json",
                        lambda url: {"name": "Job Board", "content": "<p>About us.</p>"})
    assert enrich.enrich_greenhouse("t") == (None, "About us.")


def test_enrich_from_jd_includes_board_title_name(monkeypatch):
    posting = _posting("Eng", {"descriptionPlain": "We build infra."})
    monkeypatch.setattr(enrich, "ADAPTERS", {"ashby": lambda token: [posting]})
    monkeypatch.setattr(enrich, "fetch_board_name", lambda ats, token: "Modal")
    name, about = enrich.enrich_from_jd("ashby", "modal")
    assert name == "Modal"
    assert "We build infra." in about


def test_enrich_from_jd_title_failure_does_not_sink_probe(monkeypatch):
    posting = _posting("Eng", {"descriptionPlain": "Still grounded."})
    monkeypatch.setattr(enrich, "ADAPTERS", {"lever": lambda token: [posting]})

    def boom(ats, token):
        raise RuntimeError("page down")

    monkeypatch.setattr(enrich, "fetch_board_name", boom)
    name, about = enrich.enrich_from_jd("lever", "acme")
    assert name is None
    assert "Still grounded." in about


def test_enrich_from_jd_name_even_without_jd(monkeypatch):
    posting = _posting("T", {"id": "1"})  # no extractable JD
    monkeypatch.setattr(enrich, "ADAPTERS", {"lever": lambda token: [posting]})
    monkeypatch.setattr(enrich, "fetch_board_name", lambda ats, token: "Acme Inc")
    assert enrich.enrich_from_jd("lever", "acme") == ("Acme Inc", None)


# --------------------------------------------------------------------------
# backfill per-row decision (pure, DB-free)
# --------------------------------------------------------------------------
def test_plan_greenhouse_maps_to_ats_board(monkeypatch):
    monkeypatch.setattr(ea, "ENRICHERS", {"greenhouse": lambda t: ("Acme", "about text")})
    assert ea.plan_enrichment("greenhouse", "acme") == ("Acme", "about text", "ats_board")


def test_plan_lever_maps_to_jd_probe(monkeypatch):
    monkeypatch.setattr(ea, "enrich_from_jd", lambda ats, token: (None, "jd about"))
    assert ea.plan_enrichment("lever", "acme") == (None, "jd about", "jd_probe")


def test_plan_ashby_maps_to_jd_probe(monkeypatch):
    monkeypatch.setattr(ea, "enrich_from_jd", lambda ats, token: (None, "jd about"))
    assert ea.plan_enrichment("ashby", "acme") == (None, "jd about", "jd_probe")


def test_plan_skips_when_enricher_returns_empty(monkeypatch):
    monkeypatch.setattr(ea, "ENRICHERS", {"greenhouse": lambda t: (None, None)})
    assert ea.plan_enrichment("greenhouse", "acme") is None


def test_plan_skips_when_enricher_raises(monkeypatch):
    def boom(t):
        raise RuntimeError("404 dead board")

    monkeypatch.setattr(ea, "ENRICHERS", {"greenhouse": boom})
    assert ea.plan_enrichment("greenhouse", "acme") is None


def test_plan_skips_unsupported_ats():
    # workday has an adapter but no board-metadata / JD-probe enricher.
    assert ea.plan_enrichment("workday", "acme") is None


def test_plan_name_only_result_is_kept(monkeypatch):
    # A name-only board (about None) is still a usable enrichment.
    monkeypatch.setattr(ea, "ENRICHERS", {"greenhouse": lambda t: ("Acme", None)})
    assert ea.plan_enrichment("greenhouse", "acme") == ("Acme", None, "ats_board")


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
            "('Enriched','greenhouse','enriched', TRUE, 'dataset'),"
            "('AboutOnly','lever','aboutonly', TRUE, 'dataset')"
        )
        # Already-enriched (name-bearing) row: enriched_at set -> skipped even though active.
        cur.execute(
            "UPDATE companies SET display_name='Already', enriched_at=now() "
            "WHERE token='enriched'"
        )
        # About-only enrichment (lever/ashby JD probe): enriched_at is stamped but
        # display_name stays NULL. Must be EXCLUDED — a display_name-based guard would
        # wrongly re-select and re-screen it forever.
        cur.execute(
            "UPDATE companies SET about='we build stuff', about_source='jd_probe', "
            "enriched_at=now() WHERE token='aboutonly'"
        )
    conn.commit()
    ids = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, token FROM companies")
        for r in cur.fetchall():
            ids[r["token"]] = r["id"]
    # ActiveCo is a realistic active company: verdict 'include' → active. UNKNOWNS-ONLY
    # scope must EXCLUDE it (we don't re-evaluate currently-active/included companies).
    db.upsert_company_review(conn, _review_row(ids["active"], "include"))
    db.upsert_company_review(conn, _review_row(ids["excluded"], "exclude"))
    db.upsert_company_review(conn, _review_row(ids["unknowned"], "unknown"))
    conn.commit()

    tokens = {r["token"] for r in bf.select_to_enrich(conn)}
    # noreview (no review → effectively unknown) + unknowned; NOT active/include, NOT
    # excluded, NOT the already-enriched rows.
    assert tokens == {"noreview", "unknowned"}


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


@requires_db
def test_enrich_selected_grounds_pending_patches_dicts_and_skips(conn, monkeypatch):
    """enrich_selected grounds only enriched_at-IS-NULL candidates: it persists the
    board result + stamps enriched_at, patches the in-memory dict so this run's
    review sees it, skips dead boards (no write, dict untouched, enriched_at stays
    NULL), and never re-fetches an already-enriched company."""
    from company_discovery import db

    def _dead(token):
        raise RuntimeError("404 dead board")

    # 'workable' stands in for a dead board (its enricher raises); the fabricated
    # 'deadco' from the brief violates the companies.ats CHECK constraint, so use a
    # real ATS value that this run maps to a raising enricher.
    monkeypatch.setattr(ea, "ENRICHERS", {
        "greenhouse": lambda token: (f"Name-{token}", f"About {token}."),
        "workable": _dead,
    })
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) VALUES "
            "('pend','greenhouse','pendtok', FALSE, 'dataset'),"
            "('dead','workable','deadtok', FALSE, 'dataset'),"
            "('done','greenhouse','donetok', FALSE, 'dataset')")
        # 'done' is already enriched -> enrich_selected must skip it (no re-fetch).
        cur.execute("UPDATE companies SET display_name='Already', about='old about', "
                    "about_source='ats_board', enriched_at=now() WHERE token='donetok'")
    conn.commit()

    # Real select_for_review returns candidate dicts INCLUDING enriched_at (Step 1),
    # which enrich_selected filters on. No reviews exist, so all three are selected.
    candidates = db.select_for_review(conn, USER, "pv-current", 100)
    by_token = {c["token"]: c for c in candidates}
    assert by_token["donetok"]["enriched_at"] is not None   # column present + set
    assert by_token["pendtok"]["enriched_at"] is None

    n = ea.enrich_selected(conn, candidates)
    conn.commit()
    assert n == 1                                           # only 'pend' enriched

    # in-memory dict patched for the pending greenhouse company...
    assert by_token["pendtok"]["display_name"] == "Name-pendtok"
    assert by_token["pendtok"]["about"] == "About pendtok."
    # dead board: skipped, dict untouched (reviewed ungrounded this run)
    assert by_token["deadtok"]["display_name"] is None
    assert by_token["deadtok"]["about"] is None
    # already-enriched: not re-fetched/overwritten
    assert by_token["donetok"]["display_name"] == "Already"
    assert by_token["donetok"]["about"] == "old about"

    # ...and persisted to the DB, enriched_at stamped; dead board stays NULL.
    with conn.cursor() as cur:
        cur.execute("SELECT token, display_name, about, about_source, enriched_at "
                    "FROM companies WHERE token IN ('pendtok','deadtok','donetok')")
        rows = {r["token"]: r for r in cur.fetchall()}
    assert rows["pendtok"]["display_name"] == "Name-pendtok"
    assert rows["pendtok"]["about"] == "About pendtok."
    assert rows["pendtok"]["about_source"] == "ats_board"
    assert rows["pendtok"]["enriched_at"] is not None
    assert rows["deadtok"]["enriched_at"] is None           # dead board: no write
    assert rows["donetok"]["display_name"] == "Already"     # untouched
