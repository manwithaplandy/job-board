from job_discovery import db
from job_discovery.models import Posting
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


@requires_db
def test_upsert_stores_extracted_description(conn):
    cid = _seed_company(conn)
    p = Posting(external_id="1", title="Eng", url="https://x",
                raw={"descriptionPlain": "Hello JD"})
    db.upsert_job(conn, cid, "lever", "acme", p)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT description FROM jobs WHERE id='lever:acme:1'")
        assert cur.fetchone()["description"] == "Hello JD"


@requires_db
def test_resight_does_not_overwrite_description(conn):
    cid = _seed_company(conn)
    db.upsert_job(conn, cid, "lever", "acme",
                  Posting(external_id="1", title="Eng", url="https://x",
                          raw={"descriptionPlain": "Original"}))
    conn.commit()
    # Simulate the JD being pruned to NULL after a deny.
    with conn.cursor() as cur:
        cur.execute("UPDATE jobs SET description=NULL WHERE id='lever:acme:1'")
    conn.commit()
    # Re-poll with a different JD must NOT restore description (insert-only).
    db.upsert_job(conn, cid, "lever", "acme",
                  Posting(external_id="1", title="Eng", url="https://x",
                          raw={"descriptionPlain": "Rewritten"}))
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT description FROM jobs WHERE id='lever:acme:1'")
        assert cur.fetchone()["description"] is None
