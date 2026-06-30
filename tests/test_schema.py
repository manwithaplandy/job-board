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
            "INSERT INTO companies (name, ats, token) VALUES ('X', 'bamboohr', 't')"
        )


@requires_db
@pytest.mark.parametrize("ats", ["workable", "smartrecruiters", "workday"])
def test_ats_check_allows_new_providers(conn, ats):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('X', %s, %s)",
            (ats, f"tok-{ats}"),
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


@requires_db
def test_error_row_allows_null_stage1_decision(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('Y','lever','y') RETURNING id"
        )
        cid = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO jobs (id, company_id, external_id, title, url) "
            "VALUES ('lever:y:1', %s, '1', 'Eng', 'u')",
            (cid,),
        )
        cur.execute(
            "INSERT INTO job_reviews "
            "(user_id, job_id, profile_version, stage1_decision, error) "
            "VALUES (gen_random_uuid(), 'lever:y:1', 'v', NULL, 'StageError')"
        )
        cur.execute("SELECT count(*) AS n FROM job_reviews WHERE error = 'StageError'")
        assert cur.fetchone()["n"] == 1


@requires_db
def test_profiles_has_model_columns(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'profiles'"
        )
        cols = {r["column_name"] for r in cur.fetchall()}
    assert {"model_stage1", "model_stage2"} <= cols


@requires_db
def test_profiles_has_preferred_locations_column(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'profiles'"
        )
        cols = {r["column_name"] for r in cur.fetchall()}
    assert "preferred_locations" in cols


@requires_db
def test_deleting_job_cascades_to_review(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('Z','lever','z') RETURNING id"
        )
        cid = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO jobs (id, company_id, external_id, title, url) "
            "VALUES ('lever:z:1', %s, '1', 'Eng', 'u')",
            (cid,),
        )
        cur.execute(
            "INSERT INTO job_reviews (user_id, job_id, profile_version, verdict) "
            "VALUES (gen_random_uuid(), 'lever:z:1', 'v', 'deny')"
        )
        cur.execute("DELETE FROM jobs WHERE id = 'lever:z:1'")
        cur.execute("SELECT count(*) AS n FROM job_reviews WHERE job_id = 'lever:z:1'")
        assert cur.fetchone()["n"] == 0


@requires_db
def test_jobs_has_no_raw_column(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'jobs'"
        )
        cols = {r["column_name"] for r in cur.fetchall()}
    assert "raw" not in cols
    assert "description" in cols


@requires_db
def test_job_reviews_has_human_override_column(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name, data_type, is_nullable, column_default "
            "FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'job_reviews' "
            "AND column_name = 'human_override'"
        )
        row = cur.fetchone()
    assert row is not None, "job_reviews.human_override must exist"
    assert row["data_type"] == "boolean"
    assert row["is_nullable"] == "NO"
    assert "false" in row["column_default"].lower()


@requires_db
def test_human_override_defaults_false(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('HO','lever','ho') RETURNING id"
        )
        cid = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO jobs (id, company_id, external_id, title, url) "
            "VALUES ('lever:ho:1', %s, '1', 'Eng', 'u')",
            (cid,),
        )
        cur.execute(
            "INSERT INTO job_reviews (user_id, job_id, profile_version, verdict) "
            "VALUES (gen_random_uuid(), 'lever:ho:1', 'v', 'approve')"
        )
        cur.execute("SELECT human_override FROM job_reviews WHERE job_id = 'lever:ho:1'")
        assert cur.fetchone()["human_override"] is False
