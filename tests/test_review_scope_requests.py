"""Migration 20 (redesign plan Task 1.9): the review_scope_requests table on its own.

The reviewer's claim/finish functions and the scoped candidate query come with the
reviewer change (a later PR); these tests need only the table, its index, its CHECKs
and its RLS. They run against schema.sql, which mirrors the migration, and the last
one applies the migration file itself twice on top of it.
"""
from datetime import datetime, timezone
from pathlib import Path

import psycopg
import pytest

from tests.conftest import as_user, requires_db

A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
STAMP = datetime(2026, 11, 25, tzinfo=timezone.utc)
MIGRATION = (
    Path(__file__).resolve().parents[1] / "supabase" / "migrations" / "20261125093000_review_scope_requests.sql"
)


def _enqueue(conn, user_id, job_ids=("lever:acme:1",), **cols):
    """Inserts one request as the owner (bypasses RLS) and returns its id."""
    names = ["user_id", "job_ids", "reason", *cols]
    values = [user_id, list(job_ids), "memo_change", *cols.values()]
    placeholders = ", ".join(["%s"] * len(names))
    with conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO review_scope_requests ({', '.join(names)}) VALUES ({placeholders}) RETURNING id",
            values,
        )
        return cur.fetchone()["id"]


@requires_db
def test_one_active_scope_request_per_user(conn):
    _enqueue(conn, A)
    conn.commit()
    # A second pending request for the same user hits one_active_review_scope_request.
    with pytest.raises(psycopg.errors.UniqueViolation):
        _enqueue(conn, A)
    conn.rollback()
    # A running request counts as active too.
    with conn.cursor() as cur:
        cur.execute("UPDATE review_scope_requests SET status = 'running', claim_version = 1 WHERE user_id = %s", (A,))
    conn.commit()
    with pytest.raises(psycopg.errors.UniqueViolation):
        _enqueue(conn, A)
    conn.rollback()
    # Another user is independent, and a finished request frees the slot.
    _enqueue(conn, B)
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE review_scope_requests SET status = 'done', finished_at = now() WHERE user_id = %s", (A,)
        )
    _enqueue(conn, A)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT count(*) FILTER (WHERE status IN ('pending','running'))::int AS active, count(*)::int AS n "
            "FROM review_scope_requests WHERE user_id = %s",
            (A,),
        )
        assert cur.fetchone() == {"active": 1, "n": 2}


@requires_db
def test_scope_request_rls(conn):
    a_id = _enqueue(conn, A)
    b_id = _enqueue(conn, B, job_ids=("lever:acme:2",))
    conn.commit()

    # Each user sees only their own requests; B sees none of A's.
    with as_user(conn, B), conn.cursor() as cur:
        cur.execute("SELECT id, user_id FROM review_scope_requests")
        rows = cur.fetchall()
        assert [r["id"] for r in rows] == [b_id]
        assert all(str(r["user_id"]) == B for r in rows)
    with as_user(conn, A), conn.cursor() as cur:
        cur.execute("SELECT id FROM review_scope_requests")
        assert [r["id"] for r in cur.fetchall()] == [a_id]

    # No UPDATE or DELETE grant: A cannot change or remove even their own request.
    with as_user(conn, A), conn.cursor() as cur, pytest.raises(psycopg.errors.InsufficientPrivilege):
        cur.execute("UPDATE review_scope_requests SET status = 'done' WHERE id = %s", (a_id,))
    with as_user(conn, A), conn.cursor() as cur, pytest.raises(psycopg.errors.InsufficientPrivilege):
        cur.execute("DELETE FROM review_scope_requests WHERE id = %s", (a_id,))

    # The INSERT policy admits only a fresh pending row for the caller.
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE review_scope_requests SET status = 'done', finished_at = now() WHERE id = %s", (a_id,)
        )
    conn.commit()
    refused = [
        ("user_id", B),  # a row for another user
        ("status", "running"),
        ("status", "done"),
        ("claim_version", 1),
        ("started_at", STAMP),
        ("finished_at", STAMP),
        ("notes", "faked"),
        ("requested_at", STAMP),  # backdated, would jump the oldest-first claim
    ]
    for column, value in refused:
        cols = {"user_id": A, "job_ids": ["lever:acme:1"], "reason": "memo_change", column: value}
        with as_user(conn, A), conn.cursor() as cur, pytest.raises(psycopg.errors.InsufficientPrivilege):
            cur.execute(
                f"INSERT INTO review_scope_requests ({', '.join(cols)}) "
                f"VALUES ({', '.join(['%s'] * len(cols))})",
                list(cols.values()),
            )

    # The plain enqueue the dashboard makes is accepted and comes back pending.
    with as_user(conn, A), conn.cursor() as cur:
        cur.execute(
            "INSERT INTO review_scope_requests (user_id, job_ids, reason) VALUES (%s, %s, 'memo_change') "
            "RETURNING status, claim_version, started_at, finished_at, notes",
            (A, ["lever:acme:1", "lever:acme:3"]),
        )
        assert cur.fetchone() == {
            "status": "pending", "claim_version": 0, "started_at": None, "finished_at": None, "notes": None,
        }

    # anon has no privilege at all.
    with conn.cursor() as cur:
        cur.execute(
            "SELECT has_table_privilege('anon', 'public.review_scope_requests', 'SELECT') AS s, "
            "has_table_privilege('anon', 'public.review_scope_requests', 'INSERT') AS i"
        )
        assert cur.fetchone() == {"s": False, "i": False}


@requires_db
def test_scope_request_job_ids_cardinality_check(conn):
    for job_ids in ([], [f"lever:acme:{n}" for n in range(201)]):
        with pytest.raises(psycopg.errors.CheckViolation):
            _enqueue(conn, A, job_ids=job_ids)
        conn.rollback()
    # The bounds themselves are accepted (one at a time: one active request per user).
    _enqueue(conn, A, job_ids=["lever:acme:1"])
    _enqueue(conn, B, job_ids=[f"lever:acme:{n}" for n in range(200)])
    conn.commit()


@requires_db
def test_scope_request_refuses_null_job_ids_and_null_reason(conn):
    with pytest.raises(psycopg.errors.CheckViolation):
        _enqueue(conn, A, job_ids=["lever:acme:1", None])
    conn.rollback()
    with conn.cursor() as cur, pytest.raises(psycopg.errors.NotNullViolation):
        cur.execute(
            "INSERT INTO review_scope_requests (user_id, job_ids, reason) VALUES (%s, %s, NULL)",
            (A, ["lever:acme:1"]),
        )
    conn.rollback()
    # reason defaults to memo_change when omitted.
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO review_scope_requests (user_id, job_ids) VALUES (%s, %s) RETURNING reason",
            (A, ["lever:acme:1"]),
        )
        assert cur.fetchone() == {"reason": "memo_change"}
    conn.rollback()


@requires_db
def test_scope_request_value_checks(conn):
    for cols in ({"reason": "other"}, {"status": "queued"}, {"notes": "x" * 2001}):
        names = ["user_id", "job_ids", *cols]
        with conn.cursor() as cur, pytest.raises(psycopg.errors.CheckViolation):
            cur.execute(
                f"INSERT INTO review_scope_requests ({', '.join(names)}) "
                f"VALUES ({', '.join(['%s'] * len(names))})",
                [A, ["lever:acme:1"], *cols.values()],
            )
        conn.rollback()


@requires_db
def test_review_scope_requests_migration_applies_twice(conn):
    # conn already loaded schema.sql (which mirrors the migration); the file must be a
    # no-op on top of it, twice.
    text = MIGRATION.read_text()
    with conn.cursor() as cur:
        cur.execute(text)
        cur.execute(text)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT c.relrowsecurity AS rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = 'public' AND c.relname = 'review_scope_requests'"
        )
        assert cur.fetchone() == {"rls": True}
        cur.execute(
            "SELECT policyname FROM pg_policies WHERE schemaname = 'public' "
            "AND tablename = 'review_scope_requests' ORDER BY policyname"
        )
        assert [r["policyname"] for r in cur.fetchall()] == [
            "review_scope_requests_owner_insert", "review_scope_requests_owner_read",
        ]
        cur.execute(
            "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' "
            "AND tablename = 'review_scope_requests' ORDER BY indexname"
        )
        assert [r["indexname"] for r in cur.fetchall()] == [
            "one_active_review_scope_request", "review_scope_requests_pending_idx", "review_scope_requests_pkey",
        ]
