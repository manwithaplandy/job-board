import os
from pathlib import Path

import pytest

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover
    psycopg = None

SCHEMA_SQL = (Path(__file__).resolve().parent.parent / "schema.sql").read_text()
TEST_DSN = os.environ.get("TEST_DATABASE_URL")

requires_db = pytest.mark.skipif(TEST_DSN is None, reason="TEST_DATABASE_URL not set")


@pytest.fixture
def conn():
    assert TEST_DSN, "TEST_DATABASE_URL required"
    connection = psycopg.connect(TEST_DSN, row_factory=dict_row)
    try:
        with connection.cursor() as cur:
            cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
            cur.execute(SCHEMA_SQL)
        connection.commit()
        yield connection
    finally:
        connection.close()
