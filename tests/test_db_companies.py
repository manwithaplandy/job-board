from poller import db
from tests.conftest import requires_db


@requires_db
def test_sync_inserts_and_returns_ids(conn):
    targets = [
        {"name": "Acme", "ats": "lever", "token": "acme"},
        {"name": "Globex", "ats": "ashby", "token": "globex"},
    ]
    db.sync_seed(conn, targets)
    conn.commit()
    active = db.active_companies(conn)
    tokens = {r["token"] for r in active}
    assert tokens == {"acme", "globex"}
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM companies WHERE active")
        assert cur.fetchone()["n"] == 2


@requires_db
def test_sync_is_idempotent_and_updates_name(conn):
    db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    db.sync_seed(conn, [{"name": "Acme Inc", "ats": "lever", "token": "acme"}])
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n, max(name) AS name FROM companies")
        row = cur.fetchone()
    assert row["n"] == 1
    assert row["name"] == "Acme Inc"
