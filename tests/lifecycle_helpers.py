"""Test-only session, migration and complete public catalog parity helpers."""

from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from tools.lifecycle_test_db import validate_test_connection, validate_test_dsn


def open_sessions(dsn: str, count: int) -> list[psycopg.Connection]:
    """Independent connections to the exact same throwaway public schema."""
    validate_test_dsn(dsn)
    if count < 1:
        raise ValueError("session count must be positive")
    sessions = []
    try:
        for _ in range(count):
            session = psycopg.connect(dsn, row_factory=dict_row, connect_timeout=5)
            sessions.append(session)
            validate_test_connection(session)
        return sessions
    except BaseException:
        for session in sessions:
            session.close()
        raise


def bootstrap_schema(conn: psycopg.Connection, schema_sql: str) -> None:
    validate_test_connection(conn)
    # DROP SCHEMA removes schema-scoped defaults, but global defaults survive
    # and would affect both comparison builds. Require a clean global baseline.
    if conn.execute("SELECT EXISTS(SELECT 1 FROM pg_default_acl WHERE defaclnamespace=0) AS dirty").fetchone()["dirty"]:
        raise ValueError("global default privileges must be reset before bootstrap")
    try:
        conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
        conn.execute(schema_sql)
        conn.commit()
    except BaseException:
        conn.rollback()
        raise


def apply_migrations(conn: psycopg.Connection, paths: list[Path]) -> None:
    """Execute ordered additive SQL, including repeat runs; keep the repo ledger.

Reapplication deliberately exercises SQL idempotence, rather than hiding unsafe
migrations behind a ledger skip. Existing BEGIN/COMMIT files are supported.
"""
    validate_test_connection(conn)
    for path in paths:
        try:
            conn.execute(path.read_text())
            conn.execute(
                "INSERT INTO schema_migrations(filename) VALUES (%s) ON CONFLICT DO NOTHING", (path.name,),
            )
            conn.commit()
        except BaseException:
            conn.rollback()
            raise


_CATALOG_QUERIES = {
    "tables": """
        SELECT c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
               c.relreplident,c.reloptions,c.relacl::text,pg_get_userbyid(c.relowner) AS owner
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S') ORDER BY c.relname
    """,
    "columns": """
        SELECT c.relname,a.attname,a.attnum,format_type(a.atttypid,a.atttypmod) AS type,
               a.attnotnull,a.attidentity,a.attgenerated,a.attacl::text,
               pg_get_expr(d.adbin,d.adrelid) AS default_expr
        FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace
        LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
        WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped
          AND c.relkind IN ('r','p','v','m') ORDER BY c.relname,a.attnum
    """,
    "constraints": """
        SELECT c.relname,k.conname,k.contype,k.convalidated,k.condeferrable,k.condeferred,
               pg_get_constraintdef(k.oid,true) AS definition
        FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
        ORDER BY c.relname,k.conname
    """,
    "indexes": """
        SELECT t.relname,i.relname AS index_name,x.indisvalid,x.indisready,
               pg_get_indexdef(i.oid) AS definition
        FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid
        JOIN pg_class t ON t.oid=x.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace
        WHERE n.nspname='public' ORDER BY t.relname,i.relname
    """,
    "policies": """
        SELECT tablename,policyname,permissive,roles,cmd,qual,with_check
        FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname
    """,
    "functions": """
        SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
               pg_get_functiondef(p.oid) AS definition,p.proconfig,p.prosecdef,p.proacl::text,
               pg_get_userbyid(p.proowner) AS owner
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' ORDER BY p.proname,arguments
    """,
    "triggers": """
        SELECT c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,true) AS definition
        FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname
    """,
    "sequences": """
        SELECT sequencename,data_type,start_value,min_value,max_value,increment_by,cycle,cache_size
        FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename
    """,
    "schema_grants": """
        SELECT nspacl::text,pg_get_userbyid(nspowner) AS owner
        FROM pg_namespace WHERE nspname='public'
    """,
    "default_grants": """
        SELECT r.rolname,COALESCE(n.nspname,'global') AS scope,d.defaclobjtype,d.defaclacl::text
        FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole
        LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
        WHERE d.defaclnamespace=0 OR n.nspname='public'
        ORDER BY r.rolname,scope,d.defaclobjtype
    """,
}


def schema_catalog(conn: psycopg.Connection) -> dict[str, list[dict]]:
    """OID-free comparison including grants, RLS and function proconfig."""
    validate_test_connection(conn)
    return {name: conn.execute(sql).fetchall() for name, sql in _CATALOG_QUERIES.items()}
