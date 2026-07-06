# tests/test_discovery_db.py

from company_discovery import db
from company_discovery.dataset import Candidate
from tests.conftest import requires_db

USER = "33333333-3333-3333-3333-333333333333"


def _candidate_review_row(company_id, verdict, pv="v1"):
    return {
        "user_id": USER, "company_id": company_id, "company_profile_version": pv,
        "verdict": verdict, "confidence": "high", "reasoning": "r",
        "industry": None, "industry_subcategory": None,
        "tech_tags": ["java"], "red_flags": [], "model": "m", "error": None,
    }


@requires_db
def test_upsert_candidates_inserts_inactive(conn):
    n = db.upsert_candidates(conn, [
        Candidate("Stripe", "greenhouse", "stripe"),
        Candidate("Linear", "ashby", "linear"),
    ])
    conn.commit()
    assert n == 2
    # idempotent: second call inserts nothing new
    assert db.upsert_candidates(conn, [Candidate("Stripe", "greenhouse", "stripe")]) == 0
    with conn.cursor() as cur:
        cur.execute("SELECT active, discovery_source FROM companies WHERE token='stripe'")
        row = cur.fetchone()
    assert row["active"] is False and row["discovery_source"] == "dataset"


@requires_db
def test_select_for_review_skips_overridden_and_current(conn):
    db.upsert_candidates(conn, [
        Candidate("A", "greenhouse", "a"),
        Candidate("B", "greenhouse", "b"),
        Candidate("C", "greenhouse", "c"),
    ])
    conn.commit()
    ids = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, token FROM companies")
        for r in cur.fetchall():
            ids[r["token"]] = r["id"]
    # A reviewed at current version -> skip; B overridden -> skip; C unreviewed -> pick
    db.upsert_company_review(conn, _candidate_review_row(ids["a"], "include", pv="v1"))
    db.upsert_company_review(conn, _candidate_review_row(ids["b"], "exclude", pv="old"))
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE company_reviews SET human_override=TRUE, override_verdict='include' "
            "WHERE company_id=%s", (ids["b"],))
    conn.commit()
    picked = {r["token"] for r in db.select_for_review(conn, USER, "v1", 100)}
    assert picked == {"c"}


@requires_db
def test_upsert_preserves_human_override(conn):
    db.upsert_candidates(conn, [Candidate("A", "greenhouse", "a")])
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE token='a'")
        cid = cur.fetchone()["id"]
    db.upsert_company_review(conn, _candidate_review_row(cid, "exclude", pv="v1"))
    with conn.cursor() as cur:
        cur.execute("UPDATE company_reviews SET human_override=TRUE, override_verdict='include' "
                    "WHERE company_id=%s", (cid,))
    conn.commit()
    # re-review at a new version flips AI verdict but must keep the override
    db.upsert_company_review(conn, _candidate_review_row(cid, "include", pv="v2"))
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT verdict, company_profile_version, human_override, override_verdict "
                    "FROM company_reviews WHERE company_id=%s", (cid,))
        r = cur.fetchone()
    assert r["verdict"] == "include" and r["company_profile_version"] == "v2"
    assert r["human_override"] is True and r["override_verdict"] == "include"


@requires_db
def test_reconcile_active_from_effective_verdict(conn):
    db.upsert_candidates(conn, [
        Candidate("Inc", "greenhouse", "inc"),
        Candidate("Exc", "greenhouse", "exc"),
        Candidate("Unk", "greenhouse", "unk"),
        Candidate("Ovr", "greenhouse", "ovr"),
    ])
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token, active, discovery_source) "
                    "VALUES ('Seed','lever','seed', FALSE, 'seed')")
    conn.commit()
    ids = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, token FROM companies")
        for r in cur.fetchall():
            ids[r["token"]] = r["id"]
    db.upsert_company_review(conn, _candidate_review_row(ids["inc"], "include"))
    db.upsert_company_review(conn, _candidate_review_row(ids["exc"], "exclude"))
    db.upsert_company_review(conn, _candidate_review_row(ids["unk"], "unknown"))
    db.upsert_company_review(conn, _candidate_review_row(ids["ovr"], "exclude"))
    with conn.cursor() as cur:
        cur.execute("UPDATE company_reviews SET human_override=TRUE, override_verdict='include' "
                    "WHERE company_id=%s", (ids["ovr"],))
    conn.commit()
    db.reconcile_active(conn, USER)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT token, active FROM companies")
        active = {r["token"]: r["active"] for r in cur.fetchall()}
    assert active["inc"] is True            # AI include
    assert active["exc"] is False           # AI exclude
    assert active["unk"] is False           # unknown -> inactive
    assert active["ovr"] is True            # override beats AI exclude
    assert active["seed"] is True           # seed always active


@requires_db
def test_manual_companies_excluded_from_discovery(conn):
    """Manual companies must never be reviewed, counted in backlog, or reconciled."""
    # Insert: one manual-inactive, one manual-active, one dataset (unreviewed)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) "
            "VALUES ('ManFalse','greenhouse','man_false', FALSE, 'manual')"
        )
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) "
            "VALUES ('ManTrue','greenhouse','man_true', TRUE, 'manual')"
        )
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) "
            "VALUES ('Dat','greenhouse','dat', FALSE, 'dataset')"
        )
    conn.commit()

    # select_for_review must NOT return manual companies; must return dataset one
    picked_tokens = {r["token"] for r in db.select_for_review(conn, USER, "v1", 100)}
    assert "man_false" not in picked_tokens, "manual company should not be selected for review"
    assert "man_true" not in picked_tokens, "manual company should not be selected for review"
    assert "dat" in picked_tokens, "unreviewed dataset company must be selected for review"

    # count_backlog must not count manual companies
    backlog = db.count_backlog(conn, USER, "v1")
    assert backlog == 1, f"backlog should be 1 (only dataset), got {backlog}"

    # reconcile_active must leave manual companies untouched (no review = would default exclude)
    db.reconcile_active(conn, USER)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT token, active FROM companies WHERE discovery_source='manual'")
        manual_rows = {r["token"]: r["active"] for r in cur.fetchall()}
    assert manual_rows["man_false"] is False, "manual inactive should remain FALSE after reconcile"
    assert manual_rows["man_true"] is True, "manual active should remain TRUE after reconcile"
    # an unreviewed non-seed (dataset) company has no review -> COALESCE 'exclude' -> inactive
    with conn.cursor() as cur:
        cur.execute("SELECT active FROM companies WHERE token='dat'")
        assert cur.fetchone()["active"] is False, "unreviewed dataset company must be inactive after reconcile"


@requires_db
def test_errored_company_review_is_reselected(conn):
    """A company_review row with error set must be re-selected for retry."""
    db.upsert_candidates(conn, [Candidate("X", "greenhouse", "x")])
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE token='x'")
        cid = cur.fetchone()["id"]
    db.upsert_company_review(conn, {
        "user_id": USER, "company_id": cid, "company_profile_version": "v1",
        "verdict": None, "confidence": None, "reasoning": None,
        "industry": None, "industry_subcategory": None,
        "tech_tags": [], "red_flags": [], "model": "m", "error": "timeout",
    })
    conn.commit()
    # error IS NOT NULL → must be re-selected even though profile_version matches
    picked = {r["token"] for r in db.select_for_review(conn, USER, "v1", 100)}
    assert "x" in picked


@requires_db
def test_reselects_when_enrichment_postdates_review(conn):
    """A reviewed company is re-screened once its enrichment postdates the review
    (companies.enriched_at > company_reviews.reviewed_at); a human-overridden row is
    never re-picked; an unenriched company (enriched_at IS NULL) is not spuriously
    re-picked; and a fresh review that bumps reviewed_at past enriched_at stops it."""
    db.upsert_candidates(conn, [
        Candidate("Enriched", "greenhouse", "enriched"),
        Candidate("Override", "greenhouse", "override"),
        Candidate("Unenriched", "greenhouse", "unenriched"),
    ])
    conn.commit()
    ids = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, token FROM companies")
        for r in cur.fetchall():
            ids[r["token"]] = r["id"]

    # All reviewed 'unknown' at the CURRENT profile version, no error — so ONLY the
    # enriched_at > reviewed_at predicate can re-pick any of them.
    for tok in ("enriched", "override", "unenriched"):
        db.upsert_company_review(conn, _candidate_review_row(ids[tok], "unknown", pv="v1"))
    conn.commit()

    with conn.cursor() as cur:
        # Enrichment lands strictly AFTER the review for two of the three.
        cur.execute(
            "UPDATE companies SET enriched_at = "
            "(SELECT reviewed_at FROM company_reviews WHERE company_id = companies.id) "
            "+ interval '1 minute' WHERE token IN ('enriched','override')")
        # 'override' is human-pinned and must never be re-screened.
        cur.execute("UPDATE company_reviews SET human_override=TRUE, override_verdict='include' "
                    "WHERE company_id=%s", (ids["override"],))
    conn.commit()

    picked = {r["token"] for r in db.select_for_review(conn, USER, "v1", 100)}
    assert "enriched" in picked          # enrichment postdates review -> re-screen
    assert "override" not in picked      # human override is sticky
    assert "unenriched" not in picked    # enriched_at IS NULL -> not re-picked
    # count_backlog must agree with select_for_review.
    assert db.count_backlog(conn, USER, "v1") == 1

    # A fresh review that bumps reviewed_at past enriched_at stops the re-screen.
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE company_reviews SET reviewed_at = "
            "(SELECT enriched_at FROM companies WHERE id = company_reviews.company_id) "
            "+ interval '1 minute' WHERE company_id=%s", (ids["enriched"],))
    conn.commit()
    picked2 = {r["token"] for r in db.select_for_review(conn, USER, "v1", 100)}
    assert "enriched" not in picked2
    assert db.count_backlog(conn, USER, "v1") == 0


@requires_db
def test_run_and_state_helpers(conn):
    rid = db.start_discovery_run(conn)
    db.set_halted(conn, True)
    db.finish_discovery_run(conn, rid, status="halted_no_credits", ingested=5,
                            reviewed=3, included=1, excluded=1, unknown=1, errors=0,
                            backlog=2, notes="paused")
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT status, backlog FROM discovery_runs WHERE id=%s", (rid,))
        run = cur.fetchone()
        cur.execute("SELECT halted_no_credits FROM discovery_state")
        st = cur.fetchone()
    assert run["status"] == "halted_no_credits" and run["backlog"] == 2
    assert st["halted_no_credits"] is True
