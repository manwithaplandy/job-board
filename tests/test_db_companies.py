from poller import db
from tests.conftest import requires_db


@requires_db
def test_sync_inserts_and_returns_ids(conn):
    targets = [
        {"name": "Acme", "ats": "lever", "token": "acme"},
        {"name": "Globex", "ats": "ashby", "token": "globex"},
    ]
    ids = db.sync_companies(conn, targets)
    assert set(ids) == {("lever", "acme"), ("ashby", "globex")}
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM companies WHERE active")
        assert cur.fetchone()["n"] == 2


@requires_db
def test_sync_is_idempotent_and_updates_name(conn):
    db.sync_companies(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    ids = db.sync_companies(conn, [{"name": "Acme Inc", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n, max(name) AS name FROM companies")
        row = cur.fetchone()
    assert row["n"] == 1
    assert row["name"] == "Acme Inc"
    assert list(ids) == [("lever", "acme")]


@requires_db
def test_sync_deactivates_missing(conn):
    db.sync_companies(conn, [
        {"name": "Acme", "ats": "lever", "token": "acme"},
        {"name": "Globex", "ats": "ashby", "token": "globex"},
    ])
    db.sync_companies(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT token, active FROM companies ORDER BY token")
        rows = {r["token"]: r["active"] for r in cur.fetchall()}
    assert rows == {"acme": True, "globex": False}
