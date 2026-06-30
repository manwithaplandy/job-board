import os
from pathlib import Path

import pytest

import psycopg
from psycopg.rows import dict_row

SCHEMA_SQL = (Path(__file__).resolve().parent.parent / "schema.sql").read_text()
TEST_DSN = os.environ.get("TEST_DATABASE_URL")

requires_db = pytest.mark.skipif(TEST_DSN is None, reason="TEST_DATABASE_URL not set")


@pytest.fixture(autouse=True)
def _no_real_langfuse(monkeypatch):
    """Ambient LANGFUSE_* keys (shell, CI) must never let a test send real
    traces into the production Langfuse project. Tests that want tracing
    behavior opt in by stubbing observability.tracing.get_langfuse directly."""
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)


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
