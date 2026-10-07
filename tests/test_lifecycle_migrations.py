"""Freeze today's schema; rehearse all future additive migrations against it."""

import hashlib
import importlib
import json
from pathlib import Path

import psycopg
import pytest

from tests.conftest import SCHEMA_SQL, requires_db

ROOT = Path(__file__).resolve().parents[1]
FROZEN = ROOT / "tests/fixtures/lifecycle/schema-before-lifecycle.sql"
MANIFEST = FROZEN.with_suffix(".json")


def helpers():
    assert (ROOT / "tests/lifecycle_helpers.py").exists(), "migration helpers are absent"
    return importlib.import_module("tests.lifecycle_helpers")


def test_prechange_schema_is_frozen_with_complete_migration_manifest():
    assert FROZEN.exists(), "pre-change schema fixture is absent"
    manifest = json.loads(MANIFEST.read_text())
    assert manifest["sha256"] == "fb9b20f4708e7f60d15fb36e0174aa3de4de5254ea6aedf8b27df10bb7e3b0d6"
    assert hashlib.sha256(FROZEN.read_bytes()).hexdigest() == manifest["sha256"]
    assert manifest["base_commit"] == "e1bdc5f840406c4bbc5c7b85976944d7f70f9c3d"
    assert "2026-10-02-feedback.sql" in manifest["existing_migrations"]
    assert "SET search_path = pg_catalog" in FROZEN.read_text()


@requires_db
def test_clean_schema_matches_frozen_baseline_plus_all_new_migrations(conn):
    module = helpers()
    clean = module.schema_catalog(conn)
    manifest = json.loads(MANIFEST.read_text())
    paths = sorted(
        p for p in (ROOT / "migrations").glob("*.sql")
        if p.name not in manifest["existing_migrations"]
    )
    module.bootstrap_schema(conn, FROZEN.read_text())
    module.apply_migrations(conn, paths)
    migrated = module.schema_catalog(conn)
    assert migrated == clean
    first_ledger = conn.execute("SELECT filename,applied_at FROM schema_migrations ORDER BY filename").fetchall()
    module.apply_migrations(conn, paths)
    assert module.schema_catalog(conn) == clean
    assert conn.execute("SELECT filename,applied_at FROM schema_migrations ORDER BY filename").fetchall() == first_ledger


@requires_db
def test_existing_recorded_migrations_reapply_without_catalog_or_ledger_drift(conn):
    module = helpers()
    before = module.schema_catalog(conn)
    ledger = conn.execute("SELECT filename,applied_at FROM schema_migrations ORDER BY filename").fetchall()
    paths = [ROOT / "migrations" / row["filename"] for row in ledger]
    assert paths, "schema.sql must record mirrored migrations"
    module.apply_migrations(conn, paths)
    module.apply_migrations(conn, paths)
    assert module.schema_catalog(conn) == before
    assert conn.execute("SELECT filename,applied_at FROM schema_migrations ORDER BY filename").fetchall() == ledger


@requires_db
def test_apply_migrations_is_ordered_recorded_and_rollback_safe(conn, tmp_path):
    module = helpers()
    first = tmp_path / "01-probe.sql"
    first.write_text("BEGIN; CREATE TABLE IF NOT EXISTS lifecycle_probe(id integer PRIMARY KEY); COMMIT;")
    second = tmp_path / "02-probe.sql"
    second.write_text("INSERT INTO lifecycle_probe VALUES (1) ON CONFLICT DO NOTHING;")
    module.apply_migrations(conn, [first, second])
    module.apply_migrations(conn, [first, second])
    assert conn.execute("SELECT id FROM lifecycle_probe").fetchall() == [{"id": 1}]
    assert conn.execute("SELECT count(*) AS n FROM schema_migrations WHERE filename LIKE '%probe.sql'").fetchone()["n"] == 2
    bad = tmp_path / "03-bad.sql"
    bad.write_text("CREATE TABLE should_rollback(id integer); SELECT missing_column;")
    with pytest.raises(psycopg.errors.UndefinedColumn):
        module.apply_migrations(conn, [bad])
    assert conn.execute("SELECT to_regclass('should_rollback') AS tbl").fetchone()["tbl"] is None
    assert conn.execute("SELECT count(*) AS n FROM schema_migrations WHERE filename=%s", (bad.name,)).fetchone()["n"] == 0


@requires_db
@pytest.mark.parametrize("mutation", [
    "ALTER TABLE jobs ADD COLUMN parity_probe integer",
    "ALTER TABLE jobs DROP CONSTRAINT jobs_pkey CASCADE",
    "CREATE INDEX parity_probe ON jobs(title)",
    "GRANT INSERT ON jobs TO authenticated",
    "GRANT UPDATE(title) ON jobs TO authenticated",
    "ALTER FUNCTION app_user_id() RESET search_path",
    "ALTER TABLE profiles DISABLE ROW LEVEL SECURITY",
    "DROP POLICY owner_access ON profiles",
])
def test_catalog_parity_detects_real_drift(conn, mutation):
    module = helpers()
    before = module.schema_catalog(conn)
    conn.execute(mutation)
    assert module.schema_catalog(conn) != before
    conn.rollback()


@requires_db
def test_bootstrap_accepts_clean_schema_and_same_cluster_roles(conn):
    module = helpers()
    module.bootstrap_schema(conn, SCHEMA_SQL)
    rows = conn.execute("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('anon','authenticated') ORDER BY rolname").fetchall()
    assert len(rows) == 2
    assert all(not row["rolsuper"] and not row["rolbypassrls"] for row in rows)


@requires_db
def test_global_default_grant_migration_changes_catalog_parity(conn, tmp_path):
    module = helpers()
    before = module.schema_catalog(conn)
    migration = tmp_path / "global-default-grant.sql"
    migration.write_text("ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO authenticated;")
    try:
        module.apply_migrations(conn, [migration])
        assert module.schema_catalog(conn) != before
        rows = module.schema_catalog(conn)["default_grants"]
        assert any(row["scope"] == "global" for row in rows)
    finally:
        conn.rollback()
        conn.execute("ALTER DEFAULT PRIVILEGES REVOKE SELECT ON TABLES FROM authenticated")
        conn.commit()


@requires_db
def test_bootstrap_rejects_inherited_global_defaults_before_drop(conn):
    module = helpers()
    conn.execute("ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon")
    conn.commit()
    before = conn.execute("SELECT 'jobs'::regclass::oid AS id").fetchone()["id"]
    try:
        with pytest.raises(ValueError, match="global default"):
            module.bootstrap_schema(conn, SCHEMA_SQL)
        assert conn.execute("SELECT 'jobs'::regclass::oid AS id").fetchone()["id"] == before
    finally:
        conn.rollback()
        conn.execute("ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM anon")
        conn.commit()


@requires_db
@pytest.mark.parametrize("setup,acl_query,mutation", [
    ("CREATE TABLE owner_probe(id integer)", "SELECT relacl AS acl FROM pg_class WHERE oid='owner_probe'::regclass", "ALTER TABLE owner_probe OWNER TO authenticated"),
    ("CREATE SEQUENCE owner_probe", "SELECT relacl AS acl FROM pg_class WHERE oid='owner_probe'::regclass", "ALTER SEQUENCE owner_probe OWNER TO authenticated"),
    ("CREATE FUNCTION owner_probe() RETURNS integer LANGUAGE sql SECURITY DEFINER AS 'SELECT 1'", "SELECT proacl AS acl FROM pg_proc WHERE oid='owner_probe()'::regprocedure", "ALTER FUNCTION owner_probe() OWNER TO authenticated"),
    ("DROP SCHEMA public CASCADE; CREATE SCHEMA public", "SELECT nspacl AS acl FROM pg_namespace WHERE nspname='public'", "ALTER SCHEMA public OWNER TO authenticated"),
])
def test_catalog_detects_implicit_owner_privilege_changes_with_null_acls(conn, setup, acl_query, mutation):
    module = helpers()
    conn.execute(setup)
    assert conn.execute(acl_query).fetchone()["acl"] is None
    before = module.schema_catalog(conn)
    conn.execute(mutation)
    assert conn.execute(acl_query).fetchone()["acl"] is None
    assert module.schema_catalog(conn) != before
    conn.rollback()
