"""DB-level proof of per-prefix résumé-bucket isolation (review finding B-STORAGE).

migrations/2026-07-04-resume-bucket-storage-policies.sql adds RLS policies to
storage.objects so `authenticated` can only touch objects under its own
`resumes/<uid>/…` prefix, and `anon` gets nothing. That migration runs ONLY on
the live Supabase project (the `storage` schema is Supabase-managed and absent
from the plain-Postgres test DB), so it is not in schema.sql and the live
cross-account probe is a manual step.

To still verify the *policy predicate* here, we stand up a faithful in-DB mock of
the pieces Supabase provides — `auth.uid()`, `storage.foldername()`,
`storage.objects`, `storage.buckets` — then apply the REAL migration file on top
and exercise cross-prefix access with the same `SET LOCAL ROLE authenticated` +
request.jwt.claims the dashboard's user-session client uses.
"""
import uuid
from pathlib import Path

import psycopg
import pytest

from tests.conftest import as_user, requires_db

A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

_MIGRATION = (
    Path(__file__).resolve().parent.parent
    / "migrations"
    / "2026-07-04-resume-bucket-storage-policies.sql"
).read_text()

# Ensure the Supabase-managed pieces the migration targets exist. On the user's
# local Supabase test DB they already do (real auth.uid / storage.* — we do NOT
# clobber them); on a bare-Postgres test DB this stands up faithful equivalents
# (auth.uid / storage.foldername mirror Supabase's own definitions). The `storage`
# schema is NOT reset by conftest (it only drops `public`), so the fixture cleans
# and re-seeds the `resumes` objects each run.
_SUPABASE_MOCK = """
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

DO $$
BEGIN
  IF to_regprocedure('auth.uid()') IS NULL THEN
    EXECUTE $fn$
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $body$
        SELECT (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid
      $body$
    $fn$;
  END IF;
  IF to_regprocedure('storage.foldername(text)') IS NULL THEN
    EXECUTE $fn$
      CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql STABLE AS $body$
        SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
      $body$
    $fn$;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id     text PRIMARY KEY,
  name   text NOT NULL,
  public boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id        uuid PRIMARY KEY,
  bucket_id text,
  name      text,
  owner     uuid
);

GRANT USAGE ON SCHEMA storage, auth TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated, anon;

-- Supabase ships storage.objects with RLS already ENABLED; the migration relies
-- on that and deliberately does NOT enable it (see the migration's own NOTE). On
-- the local Supabase test DB the real table already has RLS on, so the CREATE
-- TABLE above is a no-op and this ALTER is an idempotent no-op. On a bare-Postgres
-- test DB (e.g. CI's fresh service container) the freshly-created mock table has
-- RLS OFF, so without this the policies exist but never enforce and the isolation
-- probes give false passes. Enabling it here makes the mock a faithful Supabase
-- equivalent so the RLS proof runs identically everywhere.
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
"""


@pytest.fixture
def storage_conn(conn):
    """`conn` (schema.sql loaded) + the Supabase storage/auth schema ensured + the
    real résumé-bucket migration applied, seeded with one committed object under
    A/ and B/. Teardown removes the seeded `resumes` objects (storage persists)."""
    conn.autocommit = True  # let the migration's own BEGIN/COMMIT manage its txn
    with conn.cursor() as cur:
        cur.execute(_SUPABASE_MOCK)
        cur.execute(_MIGRATION)
        cur.execute("DELETE FROM storage.objects WHERE bucket_id = 'resumes'")  # clean slate
        for uid in (A, B):
            cur.execute(
                "INSERT INTO storage.objects (id, bucket_id, name, owner) "
                "VALUES (%s, 'resumes', %s, %s)",
                (str(uuid.uuid4()), f"{uid}/resume.pdf", uid),
            )
    conn.autocommit = False  # probes run inside transactions (as_user needs one)
    yield conn
    conn.rollback()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("DELETE FROM storage.objects WHERE bucket_id = 'resumes'")
    conn.autocommit = False


@requires_db
def test_migration_created_policies_and_private_bucket(storage_conn):
    with storage_conn.cursor() as cur:
        cur.execute("SELECT relrowsecurity FROM pg_class WHERE oid = 'storage.objects'::regclass")
        assert cur.fetchone()["relrowsecurity"] is True
        cur.execute(
            "SELECT count(*)::int AS n FROM pg_policies "
            "WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'resumes_owner_%'"
        )
        assert cur.fetchone()["n"] == 4  # select/insert/update/delete
        cur.execute("SELECT public FROM storage.buckets WHERE id = 'resumes'")
        assert cur.fetchone()["public"] is False
        # No policy grants anon anything on the bucket.
        cur.execute(
            "SELECT count(*)::int AS n FROM pg_policies "
            "WHERE schemaname = 'storage' AND tablename = 'objects' AND roles::text LIKE '%anon%'"
        )
        assert cur.fetchone()["n"] == 0
    storage_conn.rollback()


@requires_db
def test_authenticated_sees_only_own_prefix(storage_conn):
    # This is the createSignedUrl / list defense: signing an object first SELECTs
    # its row, so zero visible rows under a foreign prefix == cannot sign/list it.
    with as_user(storage_conn, A) as c:
        with c.cursor() as cur:
            cur.execute("SELECT count(*)::int AS n FROM storage.objects")
            assert cur.fetchone()["n"] == 1  # only A's own object
            cur.execute(
                "SELECT count(*)::int AS n FROM storage.objects WHERE name LIKE %s",
                (f"{B}/%",),
            )
            assert cur.fetchone()["n"] == 0  # B's résumé is invisible to A
            cur.execute(
                "SELECT count(*)::int AS n FROM storage.objects WHERE name = %s",
                (f"{B}/resume.pdf",),
            )
            assert cur.fetchone()["n"] == 0


@requires_db
def test_authenticated_cannot_write_into_foreign_prefix(storage_conn):
    # INSERT under B's prefix trips WITH CHECK (42501).
    with as_user(storage_conn, A) as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with c.cursor() as cur:
                cur.execute(
                    "INSERT INTO storage.objects (id, bucket_id, name, owner) "
                    "VALUES (%s, 'resumes', %s, %s)",
                    (str(uuid.uuid4()), f"{B}/stolen.pdf", A),
                )
    # UPDATE/DELETE of B's existing row are filtered out (affect 0 rows).
    with as_user(storage_conn, A) as c:
        with c.cursor() as cur:
            cur.execute(
                "UPDATE storage.objects SET name = %s WHERE name = %s",
                (f"{B}/hax.pdf", f"{B}/resume.pdf"),
            )
            assert cur.rowcount == 0
            cur.execute("DELETE FROM storage.objects WHERE name = %s", (f"{B}/resume.pdf",))
            assert cur.rowcount == 0
    # B's object survived (verify as service role).
    with storage_conn.cursor() as cur:
        cur.execute(
            "SELECT count(*)::int AS n FROM storage.objects WHERE name = %s",
            (f"{B}/resume.pdf",),
        )
        assert cur.fetchone()["n"] == 1
    storage_conn.rollback()


@requires_db
def test_authenticated_full_crud_within_own_prefix(storage_conn):
    with as_user(storage_conn, A) as c:
        with c.cursor() as cur:
            cur.execute(
                "INSERT INTO storage.objects (id, bucket_id, name, owner) "
                "VALUES (%s, 'resumes', %s, %s)",
                (str(uuid.uuid4()), f"{A}/tailored.pdf", A),
            )
            assert cur.rowcount == 1
            cur.execute(
                "UPDATE storage.objects SET owner = %s WHERE name = %s",
                (A, f"{A}/resume.pdf"),
            )
            assert cur.rowcount == 1
            cur.execute("DELETE FROM storage.objects WHERE name = %s", (f"{A}/tailored.pdf",))
            assert cur.rowcount == 1


@requires_db
def test_anon_gets_nothing_from_resumes_bucket(storage_conn):
    with storage_conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE anon")
        # No anon policy → zero rows on read (not an error), and writes are denied.
        cur.execute("SELECT count(*)::int AS n FROM storage.objects")
        assert cur.fetchone()["n"] == 0
    storage_conn.rollback()
    with storage_conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE anon")
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            cur.execute(
                "INSERT INTO storage.objects (id, bucket_id, name, owner) "
                "VALUES (%s, 'resumes', %s, NULL)",
                (str(uuid.uuid4()), f"{A}/anon.pdf"),
            )
    storage_conn.rollback()
