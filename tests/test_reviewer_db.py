import uuid

from poller import db as poller_db
from poller.models import Posting
from reviewer import db as rdb
from tests.conftest import requires_db

USER = "11111111-1111-1111-1111-111111111111"


def _seed_job(conn, external_id="1", title="Engineer"):
    cid = poller_db.sync_companies(
        conn, [{"name": "Acme", "ats": "lever", "token": "acme"}]
    )[("lever", "acme")]
    poller_db.upsert_job(
        conn, cid, "lever", "acme",
        Posting(external_id=external_id, title=title, url="https://x",
                location="Remote", raw={"descriptionPlain": "jd"}),
    )
    conn.commit()
    return f"lever:acme:{external_id}"


@requires_db
def test_load_profiles(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version) "
            "VALUES (%s, 'r', 'i', 'v1')",
            (USER,),
        )
    conn.commit()
    profiles = rdb.load_profiles(conn)
    assert profiles == [
        {"user_id": uuid.UUID(USER), "resume_text": "r", "instructions": "i",
         "profile_version": "v1", "model_stage1": None, "model_stage2": None,
         "preferred_locations": []}
    ]


@requires_db
def test_candidates_missing_then_excluded_when_fresh(conn):
    job_id = _seed_job(conn)
    cands = rdb.select_candidates(conn, USER, "v1", limit=10)
    assert [c["id"] for c in cands] == [job_id]
    assert cands[0]["ats"] == "lever"
    assert cands[0]["company_name"] == "Acme"
    assert cands[0]["raw"]["descriptionPlain"] == "jd"

    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": "pass", "stage1_reason": None, "verdict": "approve",
        "experience_match": "match", "industry": "software_internet",
        "industry_subcategory": "devtools_platforms", "confidence": "high",
        "reasoning": "ok", "model_stage1": "m1", "model_stage2": "m2", "error": None,
        "fit_score": 80,
    })
    conn.commit()
    # fresh verdict -> excluded
    assert rdb.select_candidates(conn, USER, "v1", limit=10) == []
    # stale profile_version -> re-selected
    assert [c["id"] for c in rdb.select_candidates(conn, USER, "v2", limit=10)] == [job_id]


def _seed_loc(conn, ext, location, remote):
    job_id = _seed_job(conn, ext)
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE jobs SET location = %s, remote = %s WHERE id = %s",
            (location, remote, job_id),
        )
    conn.commit()
    return job_id


@requires_db
def test_candidates_filtered_by_preferred_locations(conn):
    berlin = _seed_loc(conn, "1", "Berlin, Germany", False)
    ny = _seed_loc(conn, "2", "New York, NY", False)
    blank = _seed_loc(conn, "3", None, False)
    remote = _seed_loc(conn, "4", "Anywhere", True)

    # no preference -> every open job is a candidate
    assert {c["id"] for c in rdb.select_candidates(conn, USER, "v1", limit=10)} == {
        berlin, ny, blank, remote}

    # include-list -> exact match + remote pass; non-match and blank dropped
    got = {c["id"] for c in rdb.select_candidates(
        conn, USER, "v1", limit=10, preferred_locations=["Berlin, Germany"])}
    assert got == {berlin, remote}

    # empty list behaves like no preference
    assert {c["id"] for c in rdb.select_candidates(
        conn, USER, "v1", limit=10, preferred_locations=[])} == {berlin, ny, blank, remote}


@requires_db
def test_closed_jobs_excluded_and_limit_and_count(conn):
    j1 = _seed_job(conn, "1")
    j2 = _seed_job(conn, "2")
    with conn.cursor() as cur:
        cur.execute("UPDATE jobs SET closed_at = now() WHERE id = %s", (j2,))
    conn.commit()
    rows = rdb.select_candidates(conn, USER, "v1", limit=10)
    assert [r["id"] for r in rows] == [j1]
    assert rows[0]["total_stale"] == 1
    # limit caps the rows returned but total_stale reflects all stale
    _seed_job(conn, "3")
    rows = rdb.select_candidates(conn, USER, "v1", limit=1)
    assert len(rows) == 1
    assert rows[0]["total_stale"] == 2


@requires_db
def test_upsert_review_replaces_in_place(conn):
    job_id = _seed_job(conn)
    base = {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": "reject", "stage1_reason": "off-target", "verdict": None,
        "experience_match": None, "industry": None, "industry_subcategory": None,
        "confidence": None, "reasoning": None, "model_stage1": "m1",
        "model_stage2": None, "error": None,
    }
    rdb.upsert_review(conn, base)
    rdb.upsert_review(conn, {**base, "stage1_decision": "pass", "verdict": "deny"})
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n, max(verdict) AS v FROM job_reviews")
        row = cur.fetchone()
    assert row["n"] == 1 and row["v"] == "deny"


@requires_db
def test_set_job_description(conn):
    job_id = _seed_job(conn)
    rdb.set_job_description(conn, job_id, "full text")
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT description FROM jobs WHERE id = %s", (job_id,))
        assert cur.fetchone()["description"] == "full text"


@requires_db
def test_review_run_lifecycle(conn):
    rid = rdb.start_review_run(conn)
    rdb.finish_review_run(conn, rid, reviewed=5, gate_rejected=2, approved=2,
                          denied=1, errors=0, notes="ok")
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM review_runs WHERE id = %s", (rid,))
        row = cur.fetchone()
    assert row["reviewed"] == 5 and row["approved"] == 2 and row["finished_at"] is not None


@requires_db
def test_candidate_reselected_when_fit_score_null(conn):
    job_id = _seed_job(conn)
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": "pass", "verdict": "approve",
        "experience_match": "match", "industry": "software_internet",
        "industry_subcategory": "devtools_platforms", "confidence": "high",
        "reasoning": "ok", "fit_score": None,  # pre-migration row
    })
    conn.commit()
    # null fit_score forces re-review even when profile_version matches
    assert [c["id"] for c in rdb.select_candidates(conn, USER, "v1", limit=10)] == [job_id]


@requires_db
def test_gate_rejected_not_reselected(conn):
    """Gate-rejected rows (no verdict, fit_score NULL) must NOT cause perpetual re-review."""
    job_id = _seed_job(conn)
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": "reject", "stage1_reason": "off-target",
        # verdict intentionally absent (None) — fit_score stays NULL via default
    })
    conn.commit()
    # Must NOT be re-selected: no verdict means this is a gate-rejected/errored row,
    # not a pre-migration backfill target.
    assert rdb.select_candidates(conn, USER, "v1", limit=10) == []


@requires_db
def test_upsert_persists_new_columns_and_jsonb(conn):
    job_id = _seed_job(conn)
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": "pass", "verdict": "approve",
        "experience_match": "match", "industry": "software_internet",
        "industry_subcategory": "devtools_platforms", "confidence": "high",
        "reasoning": "ok", "role_category": "Frontend", "seniority": "senior",
        "work_arrangement": "hybrid", "pay_min": 170000, "pay_max": 210000,
        "pay_currency": "USD", "pay_period": "year", "headcount": "120",
        "skills_score": 96, "experience_score": 93, "comp_score": 90, "fit_score": 94,
        "red_flags": ["Ships daily."], "skill_gaps": ["WebGL"],
        "benefits": ["Equity"], "requirements": [{"text": "5+ yrs React", "met": True}],
    })
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM job_reviews WHERE job_id = %s", (job_id,))
        row = cur.fetchone()
    assert row["role_category"] == "Frontend" and row["fit_score"] == 94
    assert row["pay_min"] == 170000 and row["headcount"] == "120"
    assert row["red_flags"] == ["Ships daily."]            # jsonb -> python list
    assert row["requirements"] == [{"text": "5+ yrs React", "met": True}]


@requires_db
def test_upsert_tolerates_missing_jsonb_keys(conn):
    job_id = _seed_job(conn)
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": "reject", "stage1_reason": "off-target",
    })
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT red_flags, requirements FROM job_reviews WHERE job_id = %s", (job_id,))
        row = cur.fetchone()
    assert row["red_flags"] == [] and row["requirements"] == []
