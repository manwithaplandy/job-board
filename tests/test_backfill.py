from psycopg.types.json import Json

from poller.backfill_descriptions import backfill
from tests.conftest import requires_db


def _setup(conn):
    # Simulate the pre-migration schema (schema.sql no longer has raw).
    with conn.cursor() as cur:
        cur.execute("ALTER TABLE jobs ADD COLUMN raw jsonb")
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('Acme','lever','acme') RETURNING id"
        )
        cid = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO jobs (id, company_id, external_id, title, url, raw) "
            "VALUES ('lever:acme:1', %s, '1', 'Eng', 'u', %s)",
            (cid, Json({"descriptionPlain": "Full JD"})),
        )
        cur.execute(
            "INSERT INTO jobs (id, company_id, external_id, title, url, raw) "
            "VALUES ('lever:acme:2', %s, '2', 'Eng2', 'u2', %s)",
            (cid, Json({})),  # no extractable JD
        )
    conn.commit()


@requires_db
def test_backfill_populates_description_and_nulls_raw(conn):
    _setup(conn)
    assert backfill(conn, batch_size=1000) == 2
    with conn.cursor() as cur:
        cur.execute("SELECT id, description, raw FROM jobs ORDER BY id")
        rows = {r["id"]: r for r in cur.fetchall()}
    assert rows["lever:acme:1"]["description"] == "Full JD"
    assert rows["lever:acme:1"]["raw"] is None
    assert rows["lever:acme:2"]["description"] is None   # nothing to extract
    assert rows["lever:acme:2"]["raw"] is None           # still cleared


@requires_db
def test_backfill_is_idempotent(conn):
    _setup(conn)
    backfill(conn, batch_size=1000)
    assert backfill(conn, batch_size=1000) == 0
