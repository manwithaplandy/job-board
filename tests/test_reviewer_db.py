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
         "profile_version": "v1"}
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
    })
    conn.commit()
    # fresh verdict -> excluded
    assert rdb.select_candidates(conn, USER, "v1", limit=10) == []
    # stale profile_version -> re-selected
    assert [c["id"] for c in rdb.select_candidates(conn, USER, "v2", limit=10)] == [job_id]


@requires_db
def test_closed_jobs_excluded_and_limit_and_count(conn):
    j1 = _seed_job(conn, "1")
    j2 = _seed_job(conn, "2")
    with conn.cursor() as cur:
        cur.execute("UPDATE jobs SET closed_at = now() WHERE id = %s", (j2,))
    conn.commit()
    assert [c["id"] for c in rdb.select_candidates(conn, USER, "v1", limit=10)] == [j1]
    assert rdb.count_stale(conn, USER, "v1") == 1
    # limit caps the rows returned
    _seed_job(conn, "3")
    assert len(rdb.select_candidates(conn, USER, "v1", limit=1)) == 1
    assert rdb.count_stale(conn, USER, "v1") == 2


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
