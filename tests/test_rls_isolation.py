"""DB-level proof of cross-tenant denial (spec top-risk #1).

These run against the SAME schema.sql the prod RLS migration mirrors, using the
exact `SET LOCAL ROLE authenticated` + set_config('request.jwt.claims', …) the
dashboard's withUserSql uses. They validate the policy semantics directly —
including the subtle anon-grant-without-policy behaviour that lets the public
board's job-detail LEFT JOIN return zero review rows instead of a hard denial.
"""
import uuid

import psycopg
import pytest

from tests.conftest import as_user, requires_db

A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


def _seed_two_users(conn):
    """A shared company + job, then a full set of owner-scoped rows for A and B."""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token) VALUES ('Acme','lever','acme') RETURNING id"
        )
        cid = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO jobs (id, company_id, external_id, title, url, description) "
            "VALUES ('lever:acme:1', %s, '1', 'Engineer', 'https://x', 'jd')",
            (cid,),
        )
        for uid in (A, B):
            cur.execute(
                "INSERT INTO profiles (user_id, resume_text, profile_version) "
                "VALUES (%s, 'resume', 'v1')",
                (uid,),
            )
            cur.execute(
                "INSERT INTO job_reviews (user_id, job_id, profile_version, verdict, fit_score) "
                "VALUES (%s, 'lever:acme:1', 'v1', 'approve', 80)",
                (uid,),
            )
            cur.execute(
                "INSERT INTO review_corrections (user_id, job_id, verdict) "
                "VALUES (%s, 'lever:acme:1', 'deny')",
                (uid,),
            )
            cur.execute(
                "INSERT INTO company_reviews (user_id, company_id, company_profile_version, verdict) "
                "VALUES (%s, %s, 'v1', 'include')",
                (uid, cid),
            )
            cur.execute(
                "INSERT INTO application_packages (user_id, job_id, status) "
                "VALUES (%s, 'lever:acme:1', 'prepared')",
                (uid,),
            )
            cur.execute(
                "INSERT INTO resume_scores (user_id, job_id, grounding, jd_relevance) "
                "VALUES (%s, 'lever:acme:1', 3, 4)",
                (uid,),
            )
            cur.execute(
                "INSERT INTO usage_counters (user_id, day, kind, n) "
                "VALUES (%s, now()::date, 'review', 5)",
                (uid,),
            )
    conn.commit()
    return cid


_OWNER_TABLES = [
    ("profiles", "user_id = %s"),
    ("job_reviews", "user_id = %s"),
    ("review_corrections", "user_id = %s"),
    ("company_reviews", "user_id = %s"),
    ("application_packages", "user_id = %s"),
    ("resume_scores", "user_id = %s"),
    ("usage_counters", "user_id = %s"),
]


@requires_db
def test_select_of_other_tenant_rows_returns_zero(conn):
    _seed_two_users(conn)
    with as_user(conn, A) as c:
        with c.cursor() as cur:
            for table, _ in _OWNER_TABLES:
                cur.execute(f"SELECT count(*)::int AS n FROM {table}")
                assert cur.fetchone()["n"] == 1, f"{table}: A should see only its own row"
                cur.execute(f"SELECT count(*)::int AS n FROM {table} WHERE user_id = %s", (B,))
                assert cur.fetchone()["n"] == 0, f"{table}: A must not see B's rows"


@requires_db
def test_update_delete_of_other_tenant_rows_affects_zero(conn):
    cid = _seed_two_users(conn)
    # UPDATE/DELETE targeting B's rows affect 0 rows (RLS filters them out).
    with as_user(conn, A) as c:
        with c.cursor() as cur:
            cur.execute("UPDATE profiles SET resume_text = 'hax' WHERE user_id = %s", (B,))
            assert cur.rowcount == 0
            cur.execute("UPDATE job_reviews SET verdict = 'deny' WHERE user_id = %s", (B,))
            assert cur.rowcount == 0
            cur.execute("DELETE FROM application_packages WHERE user_id = %s", (B,))
            assert cur.rowcount == 0
            cur.execute("DELETE FROM resume_scores WHERE user_id = %s", (B,))
            assert cur.rowcount == 0
    # B's rows survived untouched (verify as service role).
    with conn.cursor() as cur:
        cur.execute("SELECT resume_text FROM profiles WHERE user_id = %s", (B,))
        assert cur.fetchone()["resume_text"] == "resume"
        cur.execute("SELECT count(*)::int AS n FROM application_packages WHERE user_id = %s", (B,))
        assert cur.fetchone()["n"] == 1


@requires_db
def test_insert_with_foreign_user_id_fails_with_check(conn):
    _seed_two_users(conn)
    # Each attempt to write a row owned by B must trip the WITH CHECK (42501).
    for table, cols, vals in [
        ("profiles", "(user_id, profile_version)", "(%s, 'v2')"),
        ("job_reviews", "(user_id, job_id, profile_version)", "(%s, 'lever:acme:1', 'v2')"),
        ("usage_counters", "(user_id, day, kind, n)", "(%s, now()::date, 'resume', 1)"),
    ]:
        with as_user(conn, A) as c:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                with c.cursor() as cur:
                    cur.execute(f"INSERT INTO {table} {cols} VALUES {vals}", (B,))


@requires_db
def test_owner_full_crud_on_own_rows_succeeds(conn):
    _seed_two_users(conn)
    with as_user(conn, A) as c:
        with c.cursor() as cur:
            cur.execute("UPDATE profiles SET resume_text = 'mine' WHERE user_id = %s", (A,))
            assert cur.rowcount == 1
            cur.execute(
                "INSERT INTO usage_counters (user_id, day, kind, n) VALUES (%s, now()::date, 'cover', 2)",
                (A,),
            )
            assert cur.rowcount == 1
            cur.execute("DELETE FROM resume_scores WHERE user_id = %s AND job_id = 'lever:acme:1'", (A,))
            assert cur.rowcount == 1


@requires_db
def test_shared_reads_and_review_runs_scope(conn):
    _seed_two_users(conn)
    # Legacy (NULL) + A's + B's review_runs; A should see only its own + NULL.
    with conn.cursor() as cur:
        cur.execute("INSERT INTO review_runs (user_id) VALUES (%s), (%s), (NULL)", (A, B))
    conn.commit()
    with as_user(conn, A) as c:
        with c.cursor() as cur:
            cur.execute("SELECT count(*)::int AS n FROM jobs")
            assert cur.fetchone()["n"] == 1
            cur.execute("SELECT count(*)::int AS n FROM companies")
            assert cur.fetchone()["n"] == 1
            cur.execute("SELECT user_id FROM review_runs")
            seen = [r["user_id"] for r in cur.fetchall()]
            assert uuid.UUID(A) in seen
            assert None in seen
            assert uuid.UUID(B) not in seen


@requires_db
def test_authenticated_cannot_read_invite_codes(conn):
    _seed_two_users(conn)
    with as_user(conn, A) as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with c.cursor() as cur:
                cur.execute("SELECT * FROM invite_codes")


@requires_db
def test_anon_board_reads_and_job_detail_shape(conn):
    _seed_two_users(conn)
    # The exact getJobReviewDetail shape for an anonymous viewer: LEFT JOIN the
    # review tables on user_id = NULL::uuid. anon has SELECT (no policy → zero rows),
    # so every review field is NULL and only the job columns are populated — and it
    # must NOT raise permission-denied.
    with conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE anon")
        cur.execute("SELECT count(*)::int AS n FROM jobs")
        assert cur.fetchone()["n"] == 1
        cur.execute("SELECT count(*)::int AS n FROM companies")
        assert cur.fetchone()["n"] == 1
        cur.execute(
            """
            SELECT j.description, j.url, r.verdict, rc.note
            FROM jobs j
            LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = NULL::uuid
            LEFT JOIN review_corrections rc ON rc.job_id = j.id AND rc.user_id = NULL::uuid
            WHERE j.id = 'lever:acme:1'
            """
        )
        row = cur.fetchone()
        assert row["description"] == "jd"
        assert row["verdict"] is None and row["note"] is None
    conn.rollback()
    # anon must NOT be able to read profiles at all (no grant → permission denied).
    with conn.cursor() as cur:
        cur.execute("SET LOCAL ROLE anon")
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            cur.execute("SELECT * FROM profiles")
    conn.rollback()


@requires_db
def test_billing_tables_are_owner_scoped(conn):
    with conn.cursor() as cur:
        for uid in (A, B):
            cur.execute("INSERT INTO subscriptions (user_id, status, plan) VALUES (%s, 'active', 'pro')", (uid,))
    conn.commit()
    # A sees only its own subscription and can enqueue only its own review request.
    with as_user(conn, A) as c:
        with c.cursor() as cur:
            cur.execute("SELECT count(*)::int AS n FROM subscriptions")
            assert cur.fetchone()["n"] == 1
            cur.execute("INSERT INTO review_requests (user_id, status) VALUES (%s, 'pending')", (A,))
            assert cur.rowcount == 1
    # A cannot enqueue a request owned by B (WITH CHECK).
    with as_user(conn, A) as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with c.cursor() as cur:
                cur.execute("INSERT INTO review_requests (user_id, status) VALUES (%s, 'pending')", (B,))
    # authenticated has NO update policy on review_requests — only the worker (service
    # role) transitions status.
    with conn.cursor() as cur:  # seed a running row as service role
        cur.execute("INSERT INTO review_requests (user_id, status) VALUES (%s, 'running')", (A,))
    conn.commit()
    with as_user(conn, A) as c:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            with c.cursor() as cur:
                cur.execute("UPDATE review_requests SET status = 'done' WHERE user_id = %s", (A,))


@requires_db
def test_local_config_does_not_bleed_after_transaction(conn):
    _seed_two_users(conn)
    with as_user(conn, A) as c:
        with c.cursor() as cur:
            cur.execute("SELECT count(*)::int AS n FROM profiles")
            assert cur.fetchone()["n"] == 1  # scoped to A
    # as_user rolled back → role + GUC reset. Service-level access is back.
    with conn.cursor() as cur:
        cur.execute("SELECT count(*)::int AS n FROM profiles")
        assert cur.fetchone()["n"] == 2  # both users visible again
        cur.execute("SELECT current_setting('request.jwt.claims', true) AS c")
        assert cur.fetchone()["c"] in (None, "")
