import psycopg
import pytest
from tests.conftest import requires_db


@requires_db
def test_tables_exist(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' ORDER BY table_name"
        )
        names = {r["table_name"] for r in cur.fetchall()}
    assert {"companies", "jobs", "poll_runs"} <= names


@requires_db
def test_ats_check_constraint(conn):
    with conn.cursor() as cur, pytest.raises(psycopg.errors.CheckViolation):
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('X', 'workday', 't')"
        )


@requires_db
def test_review_tables_exist(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public'"
        )
        names = {r["table_name"] for r in cur.fetchall()}
    assert {"profiles", "job_reviews", "review_runs"} <= names


@requires_db
def test_jobs_has_description_column(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'jobs'"
        )
        cols = {r["column_name"] for r in cur.fetchall()}
    assert "description" in cols


@requires_db
def test_stage1_decision_check_constraint(conn):
    import psycopg, pytest
    # seed a company + job so the job_reviews FK is satisfiable
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('X','lever','x') RETURNING id"
        )
        cid = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO jobs (id, company_id, external_id, title, url) "
            "VALUES ('lever:x:1', %s, '1', 'Eng', 'u')",
            (cid,),
        )
        with pytest.raises(psycopg.errors.CheckViolation):
            cur.execute(
                "INSERT INTO job_reviews "
                "(user_id, job_id, profile_version, stage1_decision) "
                "VALUES (gen_random_uuid(), 'lever:x:1', 'v', 'maybe')"
            )
