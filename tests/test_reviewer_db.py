import uuid

from job_discovery import db as poller_db
from job_discovery.models import Posting
from reviewer import db as rdb
from tests.conftest import apply_clane_ddl, requires_db

USER = "11111111-1111-1111-1111-111111111111"


def _seed_job(conn, external_id="1", title="Engineer"):
    poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        cid = cur.fetchone()["id"]
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
         "preferred_locations": [], "daily_review_cap": None}
    ]


@requires_db
def test_candidates_missing_then_excluded_when_fresh(conn):
    job_id = _seed_job(conn)
    cands, _ = rdb.select_candidates(conn, USER, "v1", limit=10)
    assert [c["id"] for c in cands] == [job_id]
    assert cands[0]["ats"] == "lever"
    assert cands[0]["company_name"] == "Acme"
    assert cands[0]["description"] == "jd"

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
    rows, total = rdb.select_candidates(conn, USER, "v1", limit=10)
    assert rows == [] and total == 0
    # stale profile_version -> re-selected
    rows2, _ = rdb.select_candidates(conn, USER, "v2", limit=10)
    assert [c["id"] for c in rows2] == [job_id]


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
    rows, _ = rdb.select_candidates(conn, USER, "v1", limit=10)
    assert {c["id"] for c in rows} == {berlin, ny, blank, remote}

    # include-list -> exact match + remote pass; non-match and blank dropped
    rows2, _ = rdb.select_candidates(
        conn, USER, "v1", limit=10, preferred_locations=["Berlin, Germany"])
    assert {c["id"] for c in rows2} == {berlin, remote}

    # empty list behaves like no preference
    rows3, _ = rdb.select_candidates(
        conn, USER, "v1", limit=10, preferred_locations=[])
    assert {c["id"] for c in rows3} == {berlin, ny, blank, remote}


@requires_db
def test_closed_jobs_excluded_and_limit_and_count(conn):
    j1 = _seed_job(conn, "1")
    j2 = _seed_job(conn, "2")
    with conn.cursor() as cur:
        cur.execute("UPDATE jobs SET closed_at = now() WHERE id = %s", (j2,))
    conn.commit()
    rows, total = rdb.select_candidates(conn, USER, "v1", limit=10)
    assert [r["id"] for r in rows] == [j1]
    assert total == 1
    # limit caps the rows returned but total reflects all stale
    _seed_job(conn, "3")
    rows2, total2 = rdb.select_candidates(conn, USER, "v1", limit=1)
    assert len(rows2) == 1
    assert total2 == 2


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
    rows, _ = rdb.select_candidates(conn, USER, "v1", limit=10)
    assert [c["id"] for c in rows] == [job_id]


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
    rows, total = rdb.select_candidates(conn, USER, "v1", limit=10)
    assert rows == [] and total == 0


@requires_db
def test_denied_never_reselected_even_on_profile_change(conn):
    """Denied roles are never re-selected, even when profile_version changes.

    Their JD has already been pruned to NULL by Rule A (prune.py), so a
    re-review would be JD-blind anyway.  An approved role at the same old
    profile_version must still be re-selected (profile change triggers re-review
    only for non-denied outcomes).
    """
    # Job 1: denied at v1 — must be excluded at v1 AND at v2 (changed profile)
    denied_id = _seed_job(conn, "deny-1", "Denied Engineer")
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": denied_id, "profile_version": "v1",
        "stage1_decision": "pass", "verdict": "deny",
        "experience_match": "far_reach", "industry": "software_internet",
        "industry_subcategory": "devtools_platforms", "confidence": "high",
        "reasoning": "not a fit", "model_stage1": "m1", "model_stage2": "m2",
        "fit_score": 20,
    })
    # Job 2: approved at v1 — must be re-selected at v2 (profile changed)
    approved_id = _seed_job(conn, "approve-1", "Approved Engineer")
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": approved_id, "profile_version": "v1",
        "stage1_decision": "pass", "verdict": "approve",
        "experience_match": "match", "industry": "software_internet",
        "industry_subcategory": "devtools_platforms", "confidence": "high",
        "reasoning": "great fit", "model_stage1": "m1", "model_stage2": "m2",
        "fit_score": 90,
    })
    conn.commit()

    rows_v1, _ = rdb.select_candidates(conn, USER, "v1", limit=10)
    rows_v2, _ = rdb.select_candidates(conn, USER, "v2", limit=10)
    ids_v1 = {c["id"] for c in rows_v1}
    ids_v2 = {c["id"] for c in rows_v2}

    # Denied job excluded at same version
    assert denied_id not in ids_v1, "denied job must be excluded at v1"
    # Denied job excluded even after profile change (the core regression fix)
    assert denied_id not in ids_v2, "denied job must NOT be re-selected after profile change"
    # Approved job re-selected when profile_version changes
    assert approved_id in ids_v2, "approved job must be re-selected when profile_version changes"


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
def test_upsert_does_not_overwrite_human_override(conn):
    """A manual reject (verdict='deny', human_override=TRUE) is sticky.

    Once the operator has denied a job by hand, the AI reviewer's upsert must
    never flip it back: the ON CONFLICT DO UPDATE is guarded by
    `WHERE job_reviews.human_override IS NOT TRUE`, so a re-review of an
    overridden row is a no-op and every column keeps its hand-set value.
    """
    job_id = _seed_job(conn)
    # AI first approves the job at v1.
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": "pass", "verdict": "approve",
        "experience_match": "match", "industry": "software_internet",
        "industry_subcategory": "devtools_platforms", "confidence": "high",
        "reasoning": "ok", "fit_score": 80,
    })
    # Operator rejects it by hand.
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE job_reviews SET verdict='deny', human_override=TRUE WHERE job_id=%s",
            (job_id,))
    conn.commit()
    # AI re-reviews at a new profile_version and would re-approve — the guard
    # must block the entire upsert, leaving the overridden row untouched.
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v2",
        "stage1_decision": "pass", "verdict": "approve",
        "experience_match": "match", "industry": "software_internet",
        "industry_subcategory": "devtools_platforms", "confidence": "high",
        "reasoning": "great fit now", "fit_score": 95,
    })
    conn.commit()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT verdict, human_override, profile_version FROM job_reviews WHERE job_id=%s",
            (job_id,))
        row = cur.fetchone()
    assert row["verdict"] == "deny", "human override must survive AI re-review"
    assert row["human_override"] is True
    assert row["profile_version"] == "v1", "overridden row must not be touched by the upsert"


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


@requires_db
def test_recent_stage2_reviews(conn):
    """recent_stage2_reviews returns only passed+verdicted rows with joined fields."""
    job_id = _seed_job(conn)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version) "
            "VALUES (%s, 'my resume', 'my instructions', 'v1')",
            (USER,),
        )
    # A full stage-2 review that should appear.
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": "pass", "stage1_reason": None, "verdict": "approve",
        "experience_match": "match", "industry": "software_internet",
        "industry_subcategory": "devtools_platforms", "confidence": "high",
        "reasoning": "ok", "model_stage1": "m1", "model_stage2": "m2", "error": None,
        "fit_score": 80,
    })
    conn.commit()
    rows = rdb.recent_stage2_reviews(conn, limit=10)
    assert len(rows) == 1
    row = rows[0]
    assert row["title"] == "Engineer"
    assert row["company_name"] == "Acme"
    assert row["ats"] == "lever"
    assert row["verdict"] == "approve"
    assert row["resume_text"] == "my resume"
    assert row["instructions"] == "my instructions"
    assert row["description"] == "jd"


@requires_db
def test_recent_stage2_reviews_excludes_gate_rejected(conn):
    """Gate-rejected rows (no verdict) must not appear in recent_stage2_reviews."""
    job_id = _seed_job(conn)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version) "
            "VALUES (%s, 'r', 'i', 'v1')",
            (USER,),
        )
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": "reject", "stage1_reason": "off-target",
    })
    conn.commit()
    assert rdb.recent_stage2_reviews(conn, limit=10) == []


@requires_db
def test_recent_stage2_reviews_respects_limit(conn):
    """Limit parameter caps the number of rows returned."""
    job_ids = [_seed_job(conn, str(i)) for i in range(3)]
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version) "
            "VALUES (%s, 'r', 'i', 'v1')",
            (USER,),
        )
    for jid in job_ids:
        rdb.upsert_review(conn, {
            "user_id": USER, "job_id": jid, "profile_version": "v1",
            "stage1_decision": "pass", "verdict": "approve",
            "experience_match": "match", "industry": "software_internet",
            "industry_subcategory": "devtools_platforms", "confidence": "high",
            "reasoning": "ok",
        })
    conn.commit()
    assert len(rdb.recent_stage2_reviews(conn, limit=2)) == 2
    assert len(rdb.recent_stage2_reviews(conn, limit=10)) == 3


@requires_db
def test_pruned_jd_rows_are_never_selected(conn):
    """Jobs with description_pruned=TRUE must never appear as review candidates."""
    apply_clane_ddl(conn)
    job_id = _seed_job(conn)
    with conn.cursor() as cur:
        cur.execute("UPDATE jobs SET description_pruned = TRUE WHERE id = %s", (job_id,))
    conn.commit()
    rows, total = rdb.select_candidates(conn, USER, "v1", limit=10)
    assert rows == [] and total == 0, "pruned jobs must be excluded from candidate selection"


@requires_db
def test_errored_review_is_reselected(conn):
    """A review row with error set must be re-selected so it can be retried."""
    job_id = _seed_job(conn)
    rdb.upsert_review(conn, {
        "user_id": USER, "job_id": job_id, "profile_version": "v1",
        "stage1_decision": None, "verdict": None, "error": "timeout",
    })
    conn.commit()
    # error IS NOT NULL → must be re-selected even though profile_version matches
    rows, _ = rdb.select_candidates(conn, USER, "v1", limit=10)
    assert [c["id"] for c in rows] == [job_id]


@requires_db
def test_total_stale_still_reported(conn):
    """total_stale count is still returned alongside candidate rows."""
    j1 = _seed_job(conn, "1")
    j2 = _seed_job(conn, "2")
    rows, total = rdb.select_candidates(conn, USER, "v1", limit=10)
    assert {r["id"] for r in rows} == {j1, j2}
    assert total == 2
    # limit=1 still reports full total
    rows2, total2 = rdb.select_candidates(conn, USER, "v1", limit=1)
    assert len(rows2) == 1
    assert total2 == 2


@requires_db
def test_golden_corrections_prefer_snapshots(conn):
    """Snapshot columns take priority over live job/profile data."""
    job_id = _seed_job(conn)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version) "
            "VALUES (%s, 'live resume', 'live instr', 'v1')",
            (USER,),
        )
        # Set the live job description to NULL (as if it was pruned)
        cur.execute("UPDATE jobs SET description = NULL WHERE id = %s", (job_id,))
        cur.execute(
            "INSERT INTO review_corrections "
            "(user_id, job_id, verdict, experience_match, industry, "
            " industry_subcategory, confidence, role_category, seniority, "
            " work_arrangement, skills_score, experience_score, comp_score, "
            " description_snapshot, resume_text_snapshot, instructions_snapshot) "
            "VALUES (%s, %s, 'approve', 'match', 'software_internet', "
            " 'devtools_platforms', 'high', 'Backend', 'senior', 'remote', "
            " 80, 70, 60, 'old JD', 'snapshot resume', 'snapshot instr')",
            (USER, job_id),
        )
    conn.commit()

    rows = rdb.golden_corrections(conn)
    assert len(rows) == 1
    r = rows[0]
    # Snapshot columns preferred over live data
    assert r["description"] == "old JD"
    assert r["resume_text"] == "snapshot resume"
    assert r["instructions"] == "snapshot instr"


@requires_db
def test_golden_corrections_joins_inputs(conn):
    job_id = _seed_job(conn)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version) "
            "VALUES (%s, 'resume', 'instr', 'v1')",
            (USER,),
        )
        cur.execute(
            "INSERT INTO review_corrections "
            "(user_id, job_id, verdict, experience_match, industry, "
            " industry_subcategory, confidence, role_category, seniority, "
            " work_arrangement, skills_score, experience_score, comp_score, note) "
            "VALUES (%s, %s, 'approve', 'match', 'software_internet', "
            " 'devtools_platforms', 'high', 'Backend', 'senior', 'remote', "
            " 80, 70, 60, 'looks right')",
            (USER, job_id),
        )
    conn.commit()

    rows = rdb.golden_corrections(conn)
    assert len(rows) == 1
    r = rows[0]
    assert r["job_id"] == job_id
    assert r["title"] == "Engineer"
    assert r["company_name"] == "Acme"
    assert r["ats"] == "lever"
    assert r["description"] == "jd"
    assert r["resume_text"] == "resume"
    assert r["instructions"] == "instr"
    assert r["verdict"] == "approve"
    assert r["industry_subcategory"] == "devtools_platforms"
    assert r["skills_score"] == 80


# --- Per-user daily review budget (usage_counters, spec subsystem D) ---

USER_B = "33333333-3333-3333-3333-333333333333"


@requires_db
def test_daily_spend_starts_at_zero_and_accumulates(conn):
    """get_daily_spend is 0 before any spend; add_daily_spend accumulates in place."""
    assert rdb.get_daily_spend(conn, USER) == 0
    rdb.add_daily_spend(conn, USER, 5)
    rdb.add_daily_spend(conn, USER, 3)
    conn.commit()
    assert rdb.get_daily_spend(conn, USER) == 8


@requires_db
def test_add_daily_spend_ignores_nonpositive(conn):
    """A zero/negative charge is a no-op (never writes a counter row)."""
    rdb.add_daily_spend(conn, USER, 0)
    rdb.add_daily_spend(conn, USER, -4)
    conn.commit()
    assert rdb.get_daily_spend(conn, USER) == 0


@requires_db
def test_daily_spend_is_per_user(conn):
    """Two users' budgets are independent — one's spend never bleeds into the other."""
    rdb.add_daily_spend(conn, USER, 7)
    rdb.add_daily_spend(conn, USER_B, 2)
    conn.commit()
    assert rdb.get_daily_spend(conn, USER) == 7
    assert rdb.get_daily_spend(conn, USER_B) == 2


@requires_db
def test_daily_spend_scoped_to_today_utc(conn):
    """Spend recorded on a prior UTC day does not count toward today's budget."""
    rdb.add_daily_spend(conn, USER, 9)
    conn.commit()
    # Backdate the counter to yesterday: today's spend must read 0 again.
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE usage_counters SET day = day - INTERVAL '1 day' "
            "WHERE user_id = %s AND kind = 'review'",
            (USER,),
        )
    conn.commit()
    assert rdb.get_daily_spend(conn, USER) == 0


@requires_db
def test_start_review_run_stamps_user_id(conn):
    """A run started for a user records that user_id so per-user runs are distinguishable."""
    rid = rdb.start_review_run(conn, USER)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT user_id FROM review_runs WHERE id = %s", (rid,))
        assert str(cur.fetchone()["user_id"]) == USER


@requires_db
def test_select_candidates_orders_newest_first(conn):
    """Locked spec decision: candidates drain newest-first (first_seen_at DESC)."""
    poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        cid = cur.fetchone()["id"]
    poller_db.upsert_job(conn, cid, "lever", "acme",
                         Posting(external_id="old", title="Old", url="u",
                                 raw={"descriptionPlain": "jd"}))
    poller_db.upsert_job(conn, cid, "lever", "acme",
                         Posting(external_id="new", title="New", url="u",
                                 raw={"descriptionPlain": "jd"}))
    # Force a deterministic ordering by first_seen_at.
    with conn.cursor() as cur:
        cur.execute("UPDATE jobs SET first_seen_at = now() - INTERVAL '1 day' "
                    "WHERE id = 'lever:acme:old'")
    conn.commit()
    rows, _ = rdb.select_candidates(conn, USER, "v1", limit=10)
    assert [r["id"] for r in rows] == ["lever:acme:new", "lever:acme:old"]
