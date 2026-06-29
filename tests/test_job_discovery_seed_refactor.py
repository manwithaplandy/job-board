# tests/test_poller_seed_refactor.py
from job_discovery import db
from tests.conftest import requires_db


@requires_db
def test_sync_seed_does_not_deactivate_discovered(conn):
    # a discovered, AI-approved company already active
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) "
            "VALUES ('Disco','ashby','disco', TRUE, 'dataset')")
    conn.commit()
    db.sync_seed(conn, [{"name": "Seed", "ats": "lever", "token": "seed"}])
    conn.commit()
    active = {r["token"] for r in db.active_companies(conn)}
    assert "seed" in active        # seed upserted active
    assert "disco" in active       # discovered company NOT deactivated by seed sync


@requires_db
def test_sync_seed_marks_source_seed(conn):
    db.sync_seed(conn, [{"name": "Seed", "ats": "lever", "token": "seed"}])
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT discovery_source, active FROM companies WHERE token='seed'")
        r = cur.fetchone()
    assert r["discovery_source"] == "seed" and r["active"] is True


@requires_db
def test_active_companies_excludes_inactive(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) VALUES "
            "('On','ashby','on', TRUE, 'dataset'), ('Off','ashby','off', FALSE, 'dataset')")
    conn.commit()
    tokens = {r["token"] for r in db.active_companies(conn)}
    assert "on" in tokens and "off" not in tokens
