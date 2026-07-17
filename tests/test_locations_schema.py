import json

from tests.conftest import requires_db


@requires_db
def test_locations_table_shape(conn):
    """locations rows round-trip; the source CHECK rejects unknown values."""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO locations (raw, canonicals, components, source) "
            "VALUES (%s, %s, %s::jsonb, %s)",
            ("Austin Texas", ["Austin, TX"],
             json.dumps([{"canonical": "Austin, TX", "kind": "city",
                          "geonameid": 4671654, "country_code": "US",
                          "admin1_code": "TX"}]),
             "rule"),
        )
        cur.execute("SELECT canonicals, components, source FROM locations WHERE raw = %s",
                    ("Austin Texas",))
        row = cur.fetchone()
    assert row["canonicals"] == ["Austin, TX"]
    assert row["components"][0]["kind"] == "city"
    assert row["source"] == "rule"


@requires_db
def test_locations_source_check(conn):
    import psycopg
    import pytest
    with pytest.raises(psycopg.errors.CheckViolation):
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO locations (raw, canonicals, components, source) "
                "VALUES ('x', '{x}', '[]'::jsonb, 'guess')")
    conn.rollback()


@requires_db
def test_locations_rls_enabled_no_policies(conn):
    """Service-only table: RLS on, zero policies, zero grants to app roles."""
    with conn.cursor() as cur:
        cur.execute("SELECT relrowsecurity FROM pg_class WHERE relname = 'locations'")
        assert cur.fetchone()["relrowsecurity"] is True
        cur.execute("SELECT count(*) AS n FROM pg_policies WHERE tablename = 'locations'")
        assert cur.fetchone()["n"] == 0


@requires_db
def test_jobs_location_canonicals_column(conn):
    """jobs.location_canonicals exists, holds arrays, and the stamp UPDATE joins work."""
    from job_discovery import db as poller_db
    from job_discovery.models import Posting
    poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        cid = cur.fetchone()["id"]
    poller_db.upsert_job(conn, cid, "lever", "acme",
                         Posting(external_id="1", title="Eng", url="https://x",
                                 location="NYC or Remote"))
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO locations (raw, canonicals, components, source) "
            "VALUES ('NYC or Remote', %s, '[]'::jsonb, 'rule')",
            (["New York City, NY", "Remote"],))
        cur.execute("""
            UPDATE jobs SET location_canonicals = l.canonicals
            FROM locations l
            WHERE jobs.location = l.raw
              AND jobs.location_canonicals IS DISTINCT FROM l.canonicals
        """)
        assert cur.rowcount == 1
        cur.execute("SELECT location_canonicals FROM jobs WHERE id = 'lever:acme:1'")
        assert cur.fetchone()["location_canonicals"] == ["New York City, NY", "Remote"]
