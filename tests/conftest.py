import os
from pathlib import Path

import pytest

import psycopg
from psycopg.rows import dict_row

SCHEMA_SQL = (Path(__file__).resolve().parent.parent / "schema.sql").read_text()
TEST_DSN = os.environ.get("TEST_DATABASE_URL")

# DDL additions from C-lane that may not yet be in schema.sql (applied idempotently).
_CLANE_DDL = """
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS
  description_pruned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS
  description_snapshot TEXT;
ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS
  resume_text_snapshot TEXT;
ALTER TABLE review_corrections ADD COLUMN IF NOT EXISTS
  instructions_snapshot TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  is_owner BOOLEAN NOT NULL DEFAULT FALSE;
"""


def apply_clane_ddl(conn) -> None:
    """Apply C-lane schema additions idempotently. Call from tests that need them."""
    with conn.cursor() as cur:
        cur.execute(_CLANE_DDL)
    conn.commit()

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
            # Apply C-lane DDL additions that may not yet be in schema.sql.
            # These are idempotent (IF NOT EXISTS) and safe to run every time.
            cur.execute(_CLANE_DDL)
        connection.commit()
        yield connection
    finally:
        connection.close()
