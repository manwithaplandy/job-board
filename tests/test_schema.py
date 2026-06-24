import psycopg
import pytest
from tests.conftest import requires_db


@requires_db
def test_tables_exist(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' ORDER BY table_name"
        )
        names = {r["table_name"] for r in cur.fetchall()}
    assert {"companies", "jobs", "poll_runs"} <= names


@requires_db
def test_ats_check_constraint(conn):
    with conn.cursor() as cur, pytest.raises(psycopg.errors.CheckViolation):
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('X', 'workday', 't')"
        )
