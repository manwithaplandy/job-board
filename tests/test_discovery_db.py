# tests/test_discovery_db.py
import uuid

from discovery import db
from discovery.dataset import Candidate
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
