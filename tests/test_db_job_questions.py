from job_discovery import db
from tests.conftest import requires_db  # marker: skips when TEST_DATABASE_URL unset


@requires_db
def test_insert_and_missing_query(conn):
    # Seed a company + two open greenhouse jobs.
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('Acme','greenhouse','acme') RETURNING id"
        )
        company_id = cur.fetchone()["id"]
        for ext in ("100", "200"):
            cur.execute(
                "INSERT INTO jobs (id, company_id, external_id, title, url) "
                "VALUES (%s, %s, %s, 'Eng', 'https://x')",
                (f"greenhouse:acme:{ext}", company_id, ext),
            )
    conn.commit()

    # Both jobs are missing questions initially.
    assert sorted(db.greenhouse_jobs_missing_questions(conn, company_id)) == ["100", "200"]

    # Insert questions for one; it drops out of the missing set.
    db.insert_job_questions(conn, "greenhouse:acme:100", {"questions": [{"label": "Q", "required": True, "fields": []}]})
    conn.commit()
    assert db.greenhouse_jobs_missing_questions(conn, company_id) == ["200"]

    # Row round-trips as jsonb.
    with conn.cursor() as cur:
        cur.execute("SELECT questions FROM job_questions WHERE job_id = 'greenhouse:acme:100'")
        assert cur.fetchone()["questions"] == {"questions": [{"label": "Q", "required": True, "fields": []}]}


@requires_db
def test_insert_is_idempotent_upsert(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token) VALUES ('B','greenhouse','b') RETURNING id")
        cid = cur.fetchone()["id"]
        cur.execute("INSERT INTO jobs (id, company_id, external_id, title, url) VALUES ('greenhouse:b:1', %s, '1', 'E', 'https://x')", (cid,))
    conn.commit()
    db.insert_job_questions(conn, "greenhouse:b:1", {"questions": []})
    db.insert_job_questions(conn, "greenhouse:b:1", {"questions": [{"label": "New", "required": False, "fields": []}]})
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT questions FROM job_questions WHERE job_id = 'greenhouse:b:1'")
        assert cur.fetchone()["questions"] == {"questions": [{"label": "New", "required": False, "fields": []}]}
