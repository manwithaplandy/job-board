from job_discovery import db
from tests.conftest import requires_db


@requires_db
def test_start_then_finish_run(conn):
    run_id = db.start_run(conn)
    assert isinstance(run_id, int)

    db.finish_run(
        conn, run_id,
        companies_ok=3, companies_failed=1,
        new_jobs=5, closed_jobs=2, notes="Bad: HTTPStatusError",
    )

    with conn.cursor() as cur:
        cur.execute("SELECT * FROM poll_runs WHERE id = %s", (run_id,))
        row = cur.fetchone()
    assert row["finished_at"] is not None
    assert row["companies_ok"] == 3
    assert row["companies_failed"] == 1
    assert row["new_jobs"] == 5
    assert row["closed_jobs"] == 2
    assert "Bad" in row["notes"]
