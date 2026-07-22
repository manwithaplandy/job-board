from datetime import datetime, timezone

from tests.conftest import requires_db

from company_discovery import jobs_db
from company_discovery.schemas import CompanyClassificationResult, RedFlag


def _new_job(conn, **overrides):
    cols = {
        "model": "google/gemini-3.5-flash-lite",
        "company_cap": 500,
        "selection_mode": "unclassified",
        "use_serp": False,
    }
    cols.update(overrides)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO classification_jobs (model, company_cap, selection_mode, use_serp) "
            "VALUES (%(model)s, %(company_cap)s, %(selection_mode)s, %(use_serp)s) "
            "RETURNING id",
            cols,
        )
        return cur.fetchone()["id"]


# --- claim_next_job ---------------------------------------------------------


@requires_db
def test_claim_next_job_transitions_pending_to_running(conn):
    jid = _new_job(conn)
    conn.commit()
    job = jobs_db.claim_next_job(conn)
    assert job is not None
    assert job["id"] == jid
    assert job["status"] == "running"
    assert job["started_at"] is not None


@requires_db
def test_claim_next_job_skips_non_pending(conn):
    jid = _new_job(conn)
    with conn.cursor() as cur:
        cur.execute("UPDATE classification_jobs SET status = 'running' WHERE id = %s", (jid,))
    conn.commit()
    assert jobs_db.claim_next_job(conn) is None


@requires_db
def test_claim_next_job_oldest_first(conn):
    old = _new_job(conn)
    new = _new_job(conn)
    with conn.cursor() as cur:
        cur.execute("UPDATE classification_jobs SET created_at = now() - interval '1 hour' "
                    "WHERE id = %s", (old,))
        cur.execute("UPDATE classification_jobs SET created_at = now() WHERE id = %s", (new,))
    conn.commit()
    assert jobs_db.claim_next_job(conn)["id"] == old


# --- job_status -------------------------------------------------------------


@requires_db
def test_job_status_reads_current_status(conn):
    jid = _new_job(conn)
    conn.commit()
    assert jobs_db.job_status(conn, jid) == "pending"
    with conn.cursor() as cur:
        cur.execute("UPDATE classification_jobs SET status = 'canceled' WHERE id = %s", (jid,))
    conn.commit()
    assert jobs_db.job_status(conn, jid) == "canceled"


# --- select_targets ---------------------------------------------------------


@requires_db
def test_select_targets_orders_by_open_jobs(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token) VALUES "
                    "('few','greenhouse','few'), ('many','greenhouse','many') "
                    "RETURNING id")
        few, many = [r["id"] for r in cur.fetchall()]
        for i in range(3):
            cur.execute(
                "INSERT INTO jobs (id, company_id, external_id, title, url) "
                "VALUES (%s, %s, %s, 't', 'u')",
                (f"greenhouse:many:{i}", many, str(i)))
    conn.commit()
    ids = [t["id"] for t in jobs_db.select_targets(conn, "unclassified", 10)]
    assert ids.index(many) < ids.index(few)


@requires_db
def test_select_targets_open_jobs_only_closed_ignored(conn):
    # A company whose jobs are all closed sorts as if it has zero open jobs.
    # Counts are asymmetric (closed_co gets MORE, all closed; open_co gets one
    # open) so if the `closed_at IS NULL` filter were regressed out the sort would
    # deterministically invert (closed_co ahead of open_co) — the test then fails
    # rather than tying and passing ~50% of the time.
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token) VALUES "
                    "('closed','greenhouse','closed'), ('open','greenhouse','open') "
                    "RETURNING id")
        closed_co, open_co = [r["id"] for r in cur.fetchall()]
        for i in range(3):
            cur.execute(
                "INSERT INTO jobs (id, company_id, external_id, title, url, closed_at) "
                "VALUES (%s, %s, %s, 't', 'u', now())",
                (f"greenhouse:closed:{i}", closed_co, str(i)))
        cur.execute("INSERT INTO jobs (id, company_id, external_id, title, url) "
                    "VALUES ('greenhouse:open:1', %s, '1', 't', 'u')", (open_co,))
    conn.commit()
    ids = [t["id"] for t in jobs_db.select_targets(conn, "unclassified", 10)]
    assert ids.index(open_co) < ids.index(closed_co)


@requires_db
def test_select_targets_unclassified_excludes_classified(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token, classified_at) "
                    "VALUES ('done','greenhouse','done', now()) RETURNING id")
        done = cur.fetchone()["id"]
        cur.execute("INSERT INTO companies (name, ats, token) "
                    "VALUES ('todo','greenhouse','todo') RETURNING id")
        todo = cur.fetchone()["id"]
    conn.commit()
    ids = {t["id"] for t in jobs_db.select_targets(conn, "unclassified", 10)}
    assert todo in ids
    assert done not in ids


@requires_db
def test_select_targets_returns_grounding_columns(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token, display_name, about, "
                    "web_description) VALUES "
                    "('c','greenhouse','c','Co Inc','about text','web text') RETURNING id")
        cid = cur.fetchone()["id"]
    conn.commit()
    targets = jobs_db.select_targets(conn, "unclassified", 10)
    row = next(t for t in targets if t["id"] == cid)
    for col in ("id", "name", "ats", "token", "display_name", "about",
                "web_description", "enriched_at", "web_searched_at"):
        assert col in row
    assert row["display_name"] == "Co Inc"
    assert row["about"] == "about text"
    assert row["web_description"] == "web text"


@requires_db
def test_select_targets_unknown_repass_selects_incomplete_only(conn):
    with conn.cursor() as cur:
        # fully classified, everything known -> excluded
        cur.execute("INSERT INTO companies (name, ats, token, classified_at, size, "
                    "hq_country, industry, classification_confidence) VALUES "
                    "('full','greenhouse','full', now(), '51-200', 'US', "
                    "'software_internet', 'high') RETURNING id")
        full = cur.fetchone()["id"]
        # classified but size unknown -> included
        cur.execute("INSERT INTO companies (name, ats, token, classified_at, size, "
                    "hq_country, industry, classification_confidence) VALUES "
                    "('sz','greenhouse','sz', now(), 'unknown', 'US', "
                    "'software_internet', 'high') RETURNING id")
        sz = cur.fetchone()["id"]
        # classified but hq_country unknown -> included
        cur.execute("INSERT INTO companies (name, ats, token, classified_at, size, "
                    "hq_country, industry, classification_confidence) VALUES "
                    "('ctry','greenhouse','ctry', now(), '51-200', 'unknown', "
                    "'software_internet', 'high') RETURNING id")
        ctry = cur.fetchone()["id"]
        # classified but industry null -> included
        cur.execute("INSERT INTO companies (name, ats, token, classified_at, size, "
                    "hq_country, classification_confidence) VALUES "
                    "('ind','greenhouse','ind', now(), '51-200', 'US', 'high') RETURNING id")
        ind = cur.fetchone()["id"]
        # classified but industry literal 'unknown' -> included (industry is
        # unconstrained TEXT; historical rows can hold the string, not just NULL)
        cur.execute("INSERT INTO companies (name, ats, token, classified_at, size, "
                    "hq_country, industry, classification_confidence) VALUES "
                    "('indu','greenhouse','indu', now(), '51-200', 'US', "
                    "'unknown', 'high') RETURNING id")
        indu = cur.fetchone()["id"]
        # classified but low confidence -> included
        cur.execute("INSERT INTO companies (name, ats, token, classified_at, size, "
                    "hq_country, industry, classification_confidence) VALUES "
                    "('lowc','greenhouse','lowc', now(), '51-200', 'US', "
                    "'software_internet', 'low') RETURNING id")
        lowc = cur.fetchone()["id"]
        # never classified -> excluded from repass (belongs to 'unclassified')
        cur.execute("INSERT INTO companies (name, ats, token) VALUES "
                    "('never','greenhouse','never') RETURNING id")
        never = cur.fetchone()["id"]
    conn.commit()
    ids = {t["id"] for t in jobs_db.select_targets(conn, "unknown_repass", 20)}
    assert {sz, ctry, ind, indu, lowc} <= ids
    assert full not in ids
    assert never not in ids


@requires_db
def test_select_targets_unknown_repass_before_excludes_fresh(conn):
    started = datetime.now(timezone.utc)
    with conn.cursor() as cur:
        # classified BEFORE the run started, still unknown -> selectable
        cur.execute("INSERT INTO companies (name, ats, token, classified_at, size) "
                    "VALUES ('old','greenhouse','old', now() - interval '1 hour', 'unknown') "
                    "RETURNING id")
        old = cur.fetchone()["id"]
        # classified AFTER the run started (this run), still unknown -> excluded by `before`
        cur.execute("INSERT INTO companies (name, ats, token, classified_at, size) "
                    "VALUES ('fresh','greenhouse','fresh', now() + interval '1 hour', 'unknown') "
                    "RETURNING id")
        fresh = cur.fetchone()["id"]
    conn.commit()
    ids = {t["id"] for t in jobs_db.select_targets(conn, "unknown_repass", 20, before=started)}
    assert old in ids
    assert fresh not in ids
    # Without `before`, both match.
    ids_all = {t["id"] for t in jobs_db.select_targets(conn, "unknown_repass", 20)}
    assert {old, fresh} <= ids_all


@requires_db
def test_select_targets_respects_limit(conn):
    with conn.cursor() as cur:
        for i in range(5):
            cur.execute("INSERT INTO companies (name, ats, token) VALUES (%s,'greenhouse',%s)",
                        (f"c{i}", f"c{i}"))
    conn.commit()
    assert len(jobs_db.select_targets(conn, "unclassified", 3)) == 3


# --- apply_classification ---------------------------------------------------


@requires_db
def test_apply_classification_stamps_all_columns(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token) VALUES "
                    "('c','greenhouse','c') RETURNING id")
        cid = cur.fetchone()["id"]
    conn.commit()
    res = CompanyClassificationResult(
        industry="software_internet",
        industry_subcategory=None,
        size="51-200",
        hq_country="US",
        confidence="high",
        tech_tags=["python", "go"],
        red_flags=[RedFlag(category="consulting_agency", note="staffing shop")],
    )
    jobs_db.apply_classification(conn, cid, res, model="test/model", source="job")
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT industry, size, hq_country, classification_confidence, "
                    "classification_model, classification_source, tech_tags, red_flags, "
                    "classified_at FROM companies WHERE id = %s", (cid,))
        row = cur.fetchone()
    assert row["industry"] == "software_internet"
    assert row["size"] == "51-200"
    assert row["hq_country"] == "US"
    assert row["classification_confidence"] == "high"
    assert row["classification_model"] == "test/model"
    assert row["classification_source"] == "job"
    assert row["tech_tags"] == ["python", "go"]
    assert row["red_flags"] == [{"category": "consulting_agency", "note": "staffing shop"}]
    assert row["classified_at"] is not None


@requires_db
def test_apply_classification_empty_lists_persist_as_json(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token) VALUES "
                    "('c','greenhouse','c') RETURNING id")
        cid = cur.fetchone()["id"]
    conn.commit()
    res = CompanyClassificationResult(size="unknown", hq_country="unknown")
    jobs_db.apply_classification(conn, cid, res, model="m", source="job_serp")
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT tech_tags, red_flags, industry, classification_source "
                    "FROM companies WHERE id = %s", (cid,))
        row = cur.fetchone()
    assert row["tech_tags"] == []
    assert row["red_flags"] == []
    assert row["industry"] is None
    assert row["classification_source"] == "job_serp"


# --- bump_progress ----------------------------------------------------------


@requires_db
def test_bump_progress_accumulates(conn):
    jid = _new_job(conn)
    conn.commit()
    jobs_db.bump_progress(conn, jid, processed=3, errored=1, serp=2,
                          prompt_tokens=100, completion_tokens=50, cost=0.01)
    jobs_db.bump_progress(conn, jid, processed=2, errored=0, serp=1,
                          prompt_tokens=10, completion_tokens=5, cost=0.02)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT processed, errored, serp_queries, actual_prompt_tokens, "
                    "actual_completion_tokens, actual_cost FROM classification_jobs "
                    "WHERE id = %s", (jid,))
        row = cur.fetchone()
    assert row["processed"] == 5
    assert row["errored"] == 1
    assert row["serp_queries"] == 3
    assert row["actual_prompt_tokens"] == 110
    assert row["actual_completion_tokens"] == 55
    assert float(row["actual_cost"]) == 0.03


@requires_db
def test_bump_progress_cost_none_keeps_actual_cost_null(conn):
    jid = _new_job(conn)
    conn.commit()
    jobs_db.bump_progress(conn, jid, processed=1)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT processed, actual_cost FROM classification_jobs WHERE id = %s",
                    (jid,))
        row = cur.fetchone()
    assert row["processed"] == 1
    assert row["actual_cost"] is None


# --- finish_job -------------------------------------------------------------


@requires_db
def test_finish_job_stamps_finished_at(conn):
    jid = _new_job(conn)
    conn.commit()
    jobs_db.finish_job(conn, jid, "done")
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT status, finished_at, error FROM classification_jobs WHERE id = %s",
                    (jid,))
        row = cur.fetchone()
    assert row["status"] == "done"
    assert row["finished_at"] is not None
    assert row["error"] is None


@requires_db
def test_finish_job_error_records_message(conn):
    jid = _new_job(conn)
    conn.commit()
    jobs_db.finish_job(conn, jid, "error", error="boom")
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT status, error, finished_at FROM classification_jobs WHERE id = %s",
                    (jid,))
        row = cur.fetchone()
    assert row["status"] == "error"
    assert row["error"] == "boom"
    assert row["finished_at"] is not None
