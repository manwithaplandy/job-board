from poller import db
from poller.models import Posting
from tests.conftest import requires_db


def _seed_company(conn):
    db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        return cur.fetchone()["id"]


@requires_db
def test_insert_then_idempotent_update(conn):
    cid = _seed_company(conn)
    p = Posting(external_id="1", title="Engineer", url="https://x", location="Remote")

    assert db.upsert_job(conn, cid, "lever", "acme", p) is True
    with conn.cursor() as cur:
        cur.execute("SELECT id, first_seen_at FROM jobs WHERE id = 'lever:acme:1'")
        first = cur.fetchone()

    # Second sighting: not a new insert, first_seen_at unchanged (AC-1)
    assert db.upsert_job(conn, cid, "lever", "acme", p) is False
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n, first_seen_at FROM jobs GROUP BY first_seen_at")
        again = cur.fetchone()
    assert again["n"] == 1
    assert again["first_seen_at"] == first["first_seen_at"]


@requires_db
def test_resighting_clears_closed_at(conn):
    cid = _seed_company(conn)
    p = Posting(external_id="1", title="Engineer", url="https://x")
    db.upsert_job(conn, cid, "lever", "acme", p)
    with conn.cursor() as cur:
        cur.execute("UPDATE jobs SET closed_at = now() WHERE id = 'lever:acme:1'")
    conn.commit()

    db.upsert_job(conn, cid, "lever", "acme", p)  # reopened
    with conn.cursor() as cur:
        cur.execute("SELECT closed_at FROM jobs WHERE id = 'lever:acme:1'")
        assert cur.fetchone()["closed_at"] is None
