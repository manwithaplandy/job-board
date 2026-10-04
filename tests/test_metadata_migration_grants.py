"""Rehearse metadata migrations with Supabase's explicit per-role defaults.

A vanilla Postgres rehearsal misses anon/authenticated function grants. Both the
migration files and schema.sql mirror must close those grants without changing
unrelated objects or default privileges.
"""

from pathlib import Path

import psycopg
import pytest
from psycopg.rows import dict_row

from tests.conftest import SCHEMA_SQL, TEST_DSN, as_user, requires_db

pytestmark = requires_db
A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
MARKER = "-- BEGIN mirrored 2026-10-02-matching-activity.sql"
MIGRATIONS = ("2026-10-02-matching-activity.sql", "2026-10-02-feedback.sql")


def defaults(conn):
    return conn.execute(
        "SELECT defaclobjtype, defaclacl::text FROM pg_default_acl "
        "WHERE defaclnamespace='public'::regnamespace ORDER BY defaclobjtype"
    ).fetchall()


@pytest.fixture(params=["migrations", "schema-mirror"])
def migrated(request):
    with psycopg.connect(TEST_DSN, row_factory=dict_row) as conn:
        conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
        conn.execute(SCHEMA_SQL.split(MARKER)[0])
        # Test-only role, equivalent to Supabase's existing service role. Never
        # create/alter production roles or default privileges in these migrations.
        conn.execute("""
            DO $$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
                CREATE ROLE service_role NOLOGIN BYPASSRLS;
              END IF;
            END $$;
            GRANT USAGE ON SCHEMA public TO service_role;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public
              GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public
              GRANT ALL ON TABLES TO service_role;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public
              GRANT ALL ON SEQUENCES TO service_role;
            CREATE FUNCTION unrelated_rpc() RETURNS integer LANGUAGE sql AS 'SELECT 1';
        """)
        for uid in (A, B):
            conn.execute(
                "INSERT INTO profiles(user_id,profile_version) VALUES (%s,'v1')", (uid,)
            )
        conn.execute(
            "INSERT INTO review_requests(user_id,status) VALUES (%s,'done')", (A,)
        )
        before = defaults(conn)
        conn.commit()
        for _ in range(2):
            if request.param == "migrations":
                for name in MIGRATIONS:
                    conn.execute((Path("migrations") / name).read_text())
            else:
                conn.execute(SCHEMA_SQL.split(MARKER, 1)[1])
                conn.commit()
        assert defaults(conn) == before
        assert conn.execute(
            "SELECT has_function_privilege('anon','unrelated_rpc()','EXECUTE') AS allowed"
        ).fetchone()["allowed"]
        assert (
            conn.execute("SELECT count(*) AS n FROM matching_activity").fetchone()["n"]
            == 2
        )
        assert (
            conn.execute(
                "SELECT count(*) AS n FROM review_requests WHERE status='done' "
                "AND NOT resume_requested AND claim_version=0"
            ).fetchone()["n"]
            == 1
        )
        assert (
            conn.execute(
                "SELECT count(*) AS n FROM schema_migrations WHERE filename = ANY(%s)",
                (list(MIGRATIONS),),
            ).fetchone()["n"]
            == 2
        )
        conn.commit()
        yield conn


@pytest.mark.parametrize(
    "signature",
    [
        "matching_paused(uuid)",
        "resume_matching()",
        "track_matching_activity()",
        "submit_feedback(text,text)",
    ],
)
def test_anon_has_no_execute_even_with_explicit_default_grant(migrated, signature):
    assert not migrated.execute(
        "SELECT has_function_privilege('anon',%s,'EXECUTE') AS allowed", (signature,)
    ).fetchone()["allowed"]


def test_internal_trigger_not_callable_by_authenticated(migrated):
    assert not migrated.execute(
        "SELECT has_function_privilege('authenticated','track_matching_activity()',"
        "'EXECUTE') AS allowed"
    ).fetchone()["allowed"]


@pytest.mark.parametrize(
    "query",
    [
        "SELECT * FROM resume_matching()",
        f"SELECT matching_paused('{A}')",
        "SELECT submit_feedback('issue','forged')",
        "SELECT * FROM matching_activity",
        "SELECT * FROM feedback",
        "SELECT nextval('feedback_id_seq')",
    ],
)
def test_anonymous_denied_even_with_nonempty_claims(migrated, query):
    with as_user(migrated, A):
        migrated.execute("SET LOCAL ROLE anon")
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            migrated.execute(query)


def test_authenticated_owner_reads_rpcs_and_trigger_still_work(migrated):
    with as_user(migrated, A):
        assert len(migrated.execute("SELECT * FROM matching_activity").fetchall()) == 1
        assert (
            migrated.execute("SELECT matching_paused(%s) AS paused", (A,)).fetchone()[
                "paused"
            ]
            is False
        )
        assert (
            migrated.execute("SELECT * FROM resume_matching()").fetchone()["status"]
            == "pending"
        )
        migrated.execute("SELECT submit_feedback('issue','owner feedback')")
        assert (
            str(migrated.execute("SELECT user_id FROM feedback").fetchone()["user_id"])
            == A
        )
        before = migrated.execute(
            "SELECT last_meaningful_at FROM matching_activity"
        ).fetchone()
        migrated.execute(
            "UPDATE profiles SET instructions='deliberate edit' WHERE user_id=%s", (A,)
        )
        after = migrated.execute(
            "SELECT last_meaningful_at FROM matching_activity"
        ).fetchone()
        assert after["last_meaningful_at"] > before["last_meaningful_at"]
        migrated.commit()
    with as_user(migrated, B):
        assert (
            migrated.execute("SELECT count(*) AS n FROM feedback").fetchone()["n"] == 0
        )
        assert (
            migrated.execute("SELECT count(*) AS n FROM review_requests").fetchone()[
                "n"
            ]
            == 0
        )


@pytest.mark.parametrize(
    "query",
    [
        "UPDATE matching_activity SET paused_at=NULL",
        "DELETE FROM matching_activity",
        "TRUNCATE matching_activity",
        "INSERT INTO feedback(user_id,kind,message) VALUES ('"
        + A
        + "','issue','bypass')",
        "UPDATE feedback SET message='bypass'",
        "DELETE FROM feedback",
        "TRUNCATE feedback",
        "SELECT nextval('feedback_id_seq')",
    ],
)
def test_authenticated_cannot_bypass_rpcs(migrated, query):
    with as_user(migrated, A):
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            migrated.execute(query)


def test_service_role_retains_backend_access(migrated):
    for signature in (
        "matching_paused(uuid)",
        "resume_matching()",
        "track_matching_activity()",
        "submit_feedback(text,text)",
    ):
        assert migrated.execute(
            "SELECT has_function_privilege('service_role',%s,'EXECUTE') AS allowed",
            (signature,),
        ).fetchone()["allowed"]
    for table in ("matching_activity", "feedback"):
        for privilege in ("SELECT", "INSERT", "UPDATE", "DELETE"):
            assert migrated.execute(
                "SELECT has_table_privilege('service_role',%s,%s) AS allowed",
                (table, privilege),
            ).fetchone()["allowed"]
    migrated.execute("SET LOCAL ROLE service_role")
    assert (
        migrated.execute("SELECT count(*) AS n FROM matching_activity").fetchone()["n"]
        == 2
    )
    migrated.execute(
        "INSERT INTO feedback(user_id,kind,message) VALUES (%s,'issue','backend')", (A,)
    )
    assert migrated.execute("SELECT count(*) AS n FROM feedback").fetchone()["n"] == 1
    migrated.rollback()


@pytest.mark.parametrize(
    "query",
    [
        "SELECT * FROM resume_matching()",
        "SELECT submit_feedback('issue','no identity')",
    ],
)
def test_authenticated_rpc_requires_session_identity(migrated, query):
    with as_user(migrated, ""):
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            migrated.execute(query)


def test_reapplication_removes_stray_public_table_access(migrated):
    migrated.execute("GRANT SELECT ON matching_activity, feedback TO PUBLIC")
    migrated.commit()
    for name in MIGRATIONS:
        migrated.execute((Path("migrations") / name).read_text())
    for table in ("matching_activity", "feedback"):
        assert not migrated.execute(
            "SELECT has_table_privilege('anon',%s,'SELECT') AS allowed", (table,)
        ).fetchone()["allowed"]


def test_invoker_pause_check_cannot_read_other_tenant(migrated):
    migrated.execute(
        "UPDATE matching_activity SET paused_at=now() WHERE user_id=%s", (B,)
    )
    migrated.commit()
    with as_user(migrated, A):
        assert (
            migrated.execute("SELECT matching_paused(%s) AS paused", (B,)).fetchone()[
                "paused"
            ]
            is False
        )
    with as_user(migrated, B):
        assert (
            migrated.execute("SELECT matching_paused(%s) AS paused", (B,)).fetchone()[
                "paused"
            ]
            is True
        )


def test_pinned_function_paths_ignore_temp_table_shadows(migrated):
    # Matching uses public before pg_temp; feedback qualifies every table/helper.
    # A caller's same-named temporary objects must not replace the real tables.
    migrated.execute("CREATE TEMP TABLE matching_activity (fake integer)")
    migrated.execute("CREATE TEMP TABLE feedback (fake integer)")
    migrated.execute("CREATE TEMP TABLE account_deletions (fake integer)")
    migrated.commit()
    with as_user(migrated, A):
        assert (
            migrated.execute("SELECT * FROM public.resume_matching()").fetchone()[
                "status"
            ]
            == "pending"
        )
        migrated.execute("SELECT public.submit_feedback('issue','safe path')")
        assert (
            migrated.execute("SELECT count(*) AS n FROM public.feedback").fetchone()[
                "n"
            ]
            == 1
        )
        migrated.execute(
            "UPDATE public.profiles SET instructions='safe path' WHERE user_id=%s", (A,)
        )
