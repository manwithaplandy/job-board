import json
import os
from contextlib import contextmanager
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
"""


def apply_clane_ddl(conn) -> None:
    """Apply C-lane schema additions idempotently. Call from tests that need them."""
    with conn.cursor() as cur:
        cur.execute(_CLANE_DDL)
    conn.commit()

requires_db = pytest.mark.skipif(TEST_DSN is None, reason="TEST_DATABASE_URL not set")


@contextmanager
def as_user(conn, user_id):
    """Run the enclosed queries as the `authenticated` Postgres role scoped to
    `user_id`, exactly mirroring the dashboard's withUserSql: inside a transaction
    it does `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', …,
    is_local=true)` so public.app_user_id() resolves to this user and RLS policies
    apply (the role is non-owner, so it does NOT bypass RLS).

    Both settings are transaction-LOCAL, so the `conn.rollback()` on exit resets the
    role + GUC back to the session default — nothing bleeds onto the pooled
    connection. Seed data as the superuser (and commit) BEFORE entering this block;
    a statement that trips an RLS WITH CHECK aborts the transaction, so keep one
    error-expecting operation per `with as_user(...)` block.
    """
    claims = json.dumps({"sub": str(user_id), "role": "authenticated"})
    with conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE authenticated")
        cur.execute("SELECT set_config('request.jwt.claims', %s, true)", (claims,))
    try:
        yield conn
    finally:
        conn.rollback()


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
