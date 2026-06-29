from job_discovery import db
from job_discovery.models import Posting
from tests.conftest import requires_db


def test_compute_newly_closed_is_pure_set_diff():
    assert db.compute_newly_closed({"1", "2", "3"}, {"2", "3"}) == {"1"}
    assert db.compute_newly_closed({"1"}, {"1"}) == set()
    assert db.compute_newly_closed(set(), {"5"}) == set()


@requires_db
def test_close_jobs_sets_closed_at(conn):
    db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        cid = cur.fetchone()["id"]
    for ext in ("1", "2"):
        db.upsert_job(conn, cid, "lever", "acme", Posting(external_id=ext, title="T", url="u"))

    open_ids = db.get_open_external_ids(conn, cid)
    assert open_ids == {"1", "2"}

    to_close = db.compute_newly_closed(open_ids, {"1"})  # "2" disappeared
    assert db.close_jobs(conn, cid, to_close) == 1

    with conn.cursor() as cur:
        cur.execute("SELECT external_id FROM jobs WHERE closed_at IS NOT NULL")
        assert {r["external_id"] for r in cur.fetchall()} == {"2"}
