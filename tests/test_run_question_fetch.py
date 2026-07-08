from job_discovery import db
from job_discovery.run import backfill_greenhouse_questions
from tests.conftest import requires_db


@requires_db
def test_backfill_fetches_only_missing_and_persists(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token) VALUES ('Acme','greenhouse','acme') RETURNING id")
        cid = cur.fetchone()["id"]
        for ext in ("1", "2"):
            cur.execute("INSERT INTO jobs (id, company_id, external_id, title, url) VALUES (%s,%s,%s,'E','https://x')",
                        (f"greenhouse:acme:{ext}", cid, ext))
    conn.commit()

    calls = []

    def fake_get_json(url):
        calls.append(url)
        return {"questions": [{"label": "Why us?", "required": True, "fields": []}]}

    n = backfill_greenhouse_questions(conn, cid, "acme", get_json=fake_get_json)
    conn.commit()

    assert n == 2
    assert calls == [
        "https://boards-api.greenhouse.io/v1/boards/acme/jobs/1?questions=true",
        "https://boards-api.greenhouse.io/v1/boards/acme/jobs/2?questions=true",
    ]
    assert db.greenhouse_jobs_missing_questions(conn, cid) == []


@requires_db
def test_backfill_swallows_fetch_errors_without_aborting(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token) VALUES ('B','greenhouse','b') RETURNING id")
        cid = cur.fetchone()["id"]
        cur.execute("INSERT INTO jobs (id, company_id, external_id, title, url) VALUES ('greenhouse:b:1',%s,'1','E','https://x')", (cid,))
        cur.execute("INSERT INTO jobs (id, company_id, external_id, title, url) VALUES ('greenhouse:b:2',%s,'2','E','https://x')", (cid,))
    conn.commit()

    def flaky_get_json(url):
        if url.endswith("1?questions=true"):
            raise RuntimeError("boom")
        return {"questions": [{"label": "Q", "required": False, "fields": []}]}

    n = backfill_greenhouse_questions(conn, cid, "b", get_json=flaky_get_json)
    conn.commit()
    assert n == 1  # job 1 failed, job 2 persisted; no exception raised
    assert db.greenhouse_jobs_missing_questions(conn, cid) == ["1"]


@requires_db
def test_backfill_skips_persist_when_no_usable_questions(conn):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO companies (name, ats, token) VALUES ('C','greenhouse','c') RETURNING id")
        cid = cur.fetchone()["id"]
        cur.execute("INSERT INTO jobs (id, company_id, external_id, title, url) VALUES ('greenhouse:c:1',%s,'1','E','https://x')", (cid,))
    conn.commit()
    n = backfill_greenhouse_questions(conn, cid, "c", get_json=lambda url: {"no_questions_key": True})
    conn.commit()
    assert n == 0
    assert db.greenhouse_jobs_missing_questions(conn, cid) == ["1"]  # nothing persisted
