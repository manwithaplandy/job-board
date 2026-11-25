"""Migration 20 and the scoped re-review queue (redesign plan Task 1.9).

The first group needs only the table, its index, its CHECKs and its RLS; they run
against schema.sql, which mirrors the migration, and one applies the migration file
itself twice on top of it. The second group covers the reviewer side: the scoped
candidate query (db.select_candidates with job_ids), the claim/finish/recovery
functions fenced by claim_version, and the worker's scoped path.
"""
import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import psycopg
import pytest
from psycopg.rows import dict_row

from job_discovery import db as poller_db
from job_discovery.models import Posting
from reviewer import db as rdb
from reviewer import worker
from tests.conftest import TEST_DSN, as_user, requires_db

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


# ── The reviewer side: scoped candidates, claim/finish/recovery, the worker ──────

# sha256 of the statement select_candidates executed before job_ids existed (taken at
# de566dd with no location preferences and no exclusions). An unscoped call must keep
# producing exactly these bytes.
UNSCOPED_SQL_SHA256 = "e2f1c7979453fb2b2fc9271c339aa095e899a34fcde07b74ba440507aefa6052"
UNSCOPED_PARAMS = ["exc_ctry", "exc_flag", "exc_ind", "exc_size", "has_prefs", "hydrate", "lim", "prefs", "pv", "uid"]
SCOPE_CLAUSE = "      AND j.id = ANY(%(job_ids)s::text[])\n    "


@pytest.fixture(autouse=True)
def _reset_worker_registries():
    """The worker's in-flight registries are process-global; never leak an id."""
    yield
    worker._in_flight_ids.clear()
    worker._in_flight_scope_ids.clear()


def _seed_job(conn, external_id, *, closed=False):
    poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        cid = cur.fetchone()["id"]
    poller_db.upsert_job(
        conn, cid, "lever", "acme",
        Posting(external_id=external_id, title=f"Engineer {external_id}", url="https://x",
                location="Remote", raw={"descriptionPlain": "jd"}),
    )
    job_id = f"lever:acme:{external_id}"
    if closed:
        with conn.cursor() as cur:
            cur.execute("UPDATE jobs SET closed_at = now() WHERE id = %s", (job_id,))
    conn.commit()
    return job_id


def _review(conn, user_id, job_id, verdict, pv="v1"):
    rdb.upsert_review(conn, {
        "user_id": user_id, "job_id": job_id, "profile_version": pv,
        "stage1_decision": "pass", "verdict": verdict, "experience_match": "match",
        "industry": "software_internet", "industry_subcategory": "devtools_platforms",
        "confidence": "high", "reasoning": "r", "model_stage1": "m1", "model_stage2": "m2",
        "fit_score": 80 if verdict == "approve" else 20,
    })
    conn.commit()


def _entitle_profile(conn, user_id):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version, preferred_locations) "
            "VALUES (%s, 'r', 'i', 'v1', %s)",
            (uuid.UUID(user_id), ["Remote"]),
        )
        cur.execute(
            "INSERT INTO subscriptions (user_id, status, plan, current_period_end) "
            "VALUES (%s, 'active', 'standard', now() + interval '30 days')",
            (uuid.UUID(user_id),),
        )
    conn.commit()


def _scope_row(conn, req_id):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT status, notes, claim_version, started_at, finished_at FROM review_scope_requests WHERE id = %s",
            (req_id,),
        )
        return cur.fetchone()


def _captured_candidates_sql(monkeypatch, **kwargs):
    """The statement and parameters select_candidates sends, with no database."""
    from job_discovery.lifecycle import config as lifecycle_config
    monkeypatch.setattr(lifecycle_config, "read_control", lambda _conn: SimpleNamespace(hydration_enabled=False))
    seen = {}

    class _Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *_exc):
            return False

        def execute(self, sql, params):
            seen["sql"], seen["params"] = sql, params

        def fetchone(self):
            return {"rows": [], "n": 0}

    class _Conn:
        def cursor(self):
            return _Cursor()

    rdb.select_candidates(_Conn(), A, "v1", 10, **kwargs)
    return seen["sql"], seen["params"]


def test_none_scope_query_is_byte_for_byte_unchanged(monkeypatch):
    sql, params = _captured_candidates_sql(monkeypatch)
    assert hashlib.sha256(sql.encode()).hexdigest() == UNSCOPED_SQL_SHA256
    assert sorted(params) == UNSCOPED_PARAMS
    assert _captured_candidates_sql(monkeypatch, job_ids=None) == (sql, params)
    # A scope adds one AND to both the count and the rows subquery, and nothing else.
    scoped_sql, scoped_params = _captured_candidates_sql(monkeypatch, job_ids=["lever:acme:1"])
    assert scoped_sql.count(SCOPE_CLAUSE) == 2
    assert scoped_sql.replace(SCOPE_CLAUSE, "") == sql
    assert scoped_params == {**params, "job_ids": ["lever:acme:1"]}


@requires_db
def test_scoped_candidates_are_only_the_listed_jobs(conn):
    ids = [_seed_job(conn, str(n)) for n in range(5)]
    rows, total = rdb.select_candidates(conn, A, "v1", 10, job_ids=[ids[1], ids[3]])
    assert sorted(r["id"] for r in rows) == sorted([ids[1], ids[3]])
    assert total == 2
    # The limit still bounds the rows while the count covers the whole scope.
    rows, total = rdb.select_candidates(conn, A, "v1", 1, job_ids=[ids[1], ids[3]])
    assert len(rows) == 1 and total == 2
    # Unscoped, all five stale jobs are due.
    assert rdb.select_candidates(conn, A, "v1", 10)[1] == 5


@requires_db
def test_scope_never_resurrects_a_denied_job(conn):
    denied = _seed_job(conn, "deny")
    approved = _seed_job(conn, "ok")
    closed = _seed_job(conn, "closed", closed=True)
    _review(conn, A, denied, "deny")
    _review(conn, A, approved, "approve")
    scope = [denied, approved, closed, "lever:acme:does-not-exist"]
    # After a memo change (new profile_version) only the approved, open job is due.
    rows, total = rdb.select_candidates(conn, A, "v2", 10, job_ids=scope)
    assert [r["id"] for r in rows] == [approved] and total == 1
    # At the same profile_version the approved review is fresh, so nothing is due.
    assert rdb.select_candidates(conn, A, "v1", 10, job_ids=scope) == ([], 0)


@requires_db
def test_none_scope_matches_previous_behaviour(conn):
    stale = [_seed_job(conn, f"stale-{n}") for n in range(3)]
    fresh = _seed_job(conn, "fresh")
    denied = _seed_job(conn, "denied")
    closed = _seed_job(conn, "closed", closed=True)
    _review(conn, A, fresh, "approve", pv="v1")
    _review(conn, A, denied, "deny", pv="v0")
    rows, total = rdb.select_candidates(conn, A, "v1", 10)
    assert sorted(r["id"] for r in rows) == sorted(stale) and total == 3
    # A scope over every job is a pure narrowing: the same rows, order and count.
    scoped = rdb.select_candidates(conn, A, "v1", 10, job_ids=[*stale, fresh, denied, closed])
    assert scoped == (rows, total)


@requires_db
def test_claim_and_finish_respect_claim_version(conn):
    rid = _enqueue(conn, A, job_ids=("lever:acme:1", "lever:acme:2"))
    conn.commit()
    claimed = rdb.claim_next_scope_request(conn)
    conn.commit()
    assert claimed["id"] == rid and claimed["claim_version"] == 1
    assert str(claimed["user_id"]) == A and claimed["job_ids"] == ["lever:acme:1", "lever:acme:2"]
    row = _scope_row(conn, rid)
    assert row["status"] == "running" and row["started_at"] is not None
    assert rdb.claim_next_scope_request(conn) is None  # nothing else pending
    conn.commit()
    assert rdb.current_scope_claim(conn, A, rid, 1) is True
    assert rdb.current_scope_claim(conn, A, rid, 0) is False
    assert rdb.current_scope_claim(conn, B, rid, 1) is False

    # An older generation cannot finish the claim.
    assert rdb.finish_scope_request(conn, rid, "done", "late", claim_version=0) is False
    conn.commit()
    assert _scope_row(conn, rid)["status"] == "running"
    # Handing it back (the user's lock was busy) clears started_at; a reclaim bumps the
    # generation, and the old one can no longer finish it.
    assert rdb.finish_scope_request(conn, rid, "pending", "waiting", claim_version=1) is True
    conn.commit()
    row = _scope_row(conn, rid)
    assert row["status"] == "pending" and row["started_at"] is None and row["finished_at"] is None
    assert rdb.claim_next_scope_request(conn)["claim_version"] == 2
    conn.commit()
    assert rdb.finish_scope_request(conn, rid, "done", "old claim", claim_version=1) is False
    # A note over the table's 2000-character cap is cut, never a CheckViolation.
    assert rdb.finish_scope_request(conn, rid, "done", "x" * 5000, claim_version=2) is True
    conn.commit()
    row = _scope_row(conn, rid)
    assert row["status"] == "done" and row["finished_at"] is not None and len(row["notes"]) == 2000
    # A finished row is never finished again, and 'running' is not a finish.
    assert rdb.finish_scope_request(conn, rid, "failed", "again", claim_version=2) is False
    with pytest.raises(ValueError):
        rdb.finish_scope_request(conn, rid, "running", claim_version=2)
    conn.rollback()


@requires_db
def test_claim_takes_the_oldest_pending_request_and_skips_a_locked_one(conn):
    newer = _enqueue(conn, A)
    older = _enqueue(conn, B, requested_at=datetime(2026, 11, 24, tzinfo=timezone.utc))
    conn.commit()
    # conn holds the oldest row's lock (uncommitted claim); a second claimer skips it.
    assert rdb.claim_next_scope_request(conn)["id"] == older
    with psycopg.connect(TEST_DSN, row_factory=dict_row) as sibling:
        assert rdb.claim_next_scope_request(sibling)["id"] == newer
        sibling.commit()
        assert rdb.claim_next_scope_request(sibling) is None
    conn.commit()


@requires_db
def test_stale_scope_requests_are_recovered(conn):
    aged = _enqueue(conn, A)
    fresh = _enqueue(conn, B)
    conn.commit()
    rdb.claim_next_scope_request(conn)
    rdb.claim_next_scope_request(conn)
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE review_scope_requests SET started_at = now() - interval '31 minutes' WHERE id = %s", (aged,)
        )
    conn.commit()
    # This process's in-flight id is protected however old it is.
    assert rdb.recover_stale_scope_requests(conn, 30, exclude_ids={aged}) == 0
    conn.commit()
    # So is a request whose review still holds the user's lock in another session.
    with psycopg.connect(TEST_DSN, row_factory=dict_row) as holder:
        assert rdb.try_lock_user_review(holder, A)
        assert rdb.recover_stale_scope_requests(conn, 30) == 0
        conn.commit()
        rdb.unlock_user_review(holder, A)
    assert rdb.recover_stale_scope_requests(conn, 30) == 1
    conn.commit()
    row = _scope_row(conn, aged)
    assert row["status"] == "failed" and row["notes"] == "worker timeout" and row["finished_at"] is not None
    assert _scope_row(conn, fresh)["status"] == "running"
    # The user's one active slot is free again.
    _enqueue(conn, A)
    conn.commit()


@requires_db
def test_scope_request_whose_jobs_all_dropped_out_finishes_done(conn):
    _entitle_profile(conn, A)
    denied = _seed_job(conn, "deny")
    closed = _seed_job(conn, "closed", closed=True)
    _review(conn, A, denied, "deny")
    rid = _enqueue(conn, A, job_ids=(denied, closed, "lever:acme:gone"))
    conn.commit()

    assert worker.process_one(conn) is True
    row = _scope_row(conn, rid)
    assert row["status"] == "done" and row["finished_at"] is not None
    assert row["notes"] == (
        "0 of 3 listed job(s) selected; 0 reviewed, 0 errors; scope: none of the 3 listed job(s) need review"
    )
    with conn.cursor() as cur:
        cur.execute("SELECT notes FROM review_runs WHERE user_id = %s ORDER BY id DESC LIMIT 1", (uuid.UUID(A),))
        assert cur.fetchone()["notes"] == "scope: none of the 3 listed job(s) need review"
    assert worker._in_flight_snapshot(scope=True) == set()
    assert worker.process_one(conn) is False


@requires_db
def test_process_one_claims_a_scope_request_only_when_no_full_request(conn, monkeypatch):
    calls = []

    def fake_review(_connection, profile, *_args, **kwargs):
        calls.append({
            "user": str(profile["user_id"]), "job_ids": kwargs.get("job_ids"),
            "scope_claim": kwargs.get("scope_claim"), "full": kwargs.get("request_claim") is not None,
        })
        if kwargs.get("outcome") is not None:
            kwargs["outcome"].update(notes=None, counts={"reviewed": 2, "errors": 0}, selected=2)
        # Falls through to None, as _review_user does when it completes.

    monkeypatch.setattr(worker.run, "_review_user", fake_review)
    _entitle_profile(conn, A)
    _entitle_profile(conn, B)
    with conn.cursor() as cur:
        cur.execute("INSERT INTO review_requests (user_id, status) VALUES (%s, 'pending')", (uuid.UUID(B),))
    scoped = _enqueue(conn, A, job_ids=("lever:acme:1", "lever:acme:2"))
    conn.commit()

    # The full request goes first; the scoped one waits.
    assert worker.process_one(conn) is True
    assert calls == [{"user": B, "job_ids": None, "scope_claim": None, "full": True}]
    assert _scope_row(conn, scoped)["status"] == "pending"
    # Next cycle, with no full request pending, the scoped one runs with its job list.
    assert worker.process_one(conn) is True
    assert calls[1] == {"user": A, "job_ids": ["lever:acme:1", "lever:acme:2"], "scope_claim": (scoped, 1), "full": False}
    row = _scope_row(conn, scoped)
    assert row["status"] == "done" and row["notes"] == "2 of 2 listed job(s) selected; 2 reviewed, 0 errors"
    assert worker.process_one(conn) is False


@requires_db
def test_scope_request_backs_off_while_locked_and_fails_cleanly_on_error(conn, monkeypatch):
    _entitle_profile(conn, A)
    rid = _enqueue(conn, A)
    conn.commit()

    # Another run holds the user's lock: the request goes back to pending, no spend.
    monkeypatch.setattr(worker.run, "_review_user", lambda *_a, **_k: False)
    assert worker.process_one(conn) is False
    row = _scope_row(conn, rid)
    assert row["status"] == "pending" and row["started_at"] is None and row["finished_at"] is None

    def boom(*_a, **_k):
        raise RuntimeError("boom")

    monkeypatch.setattr(worker.run, "_review_user", boom)
    assert worker.process_one(conn) is True
    row = _scope_row(conn, rid)
    assert row["status"] == "failed" and row["notes"] == "RuntimeError: boom" and row["claim_version"] == 2
    assert worker._in_flight_snapshot(scope=True) == set()
