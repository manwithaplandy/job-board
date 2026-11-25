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
from reviewer.schemas import Stage1Decision, Stage2Result
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
    """The worker's in-flight registries and scoped-slot count are process-global;
    never leak an id or a slot."""
    worker._scope_slots_in_use = 0
    yield
    worker._in_flight_ids.clear()
    worker._in_flight_scope_ids.clear()
    worker._scope_slots_in_use = 0


def _seed_job(conn, external_id, *, closed=False, remote=None):
    poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        cid = cur.fetchone()["id"]
    poller_db.upsert_job(
        conn, cid, "lever", "acme",
        Posting(external_id=external_id, title=f"Engineer {external_id}", url="https://x",
                location="Remote", remote=remote, raw={"descriptionPlain": "jd"}),
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
def test_scope_over_every_job_returns_the_unscoped_selection(conn):
    # The unscoped statement is proven unchanged by the sha256 pin in
    # test_none_scope_query_is_byte_for_byte_unchanged; this checks on real SQL that
    # the unscoped selection is the stale set and that a scope only narrows it.
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


def _age_started(conn, req_id, minutes=31):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE review_scope_requests SET started_at = now() - make_interval(mins => %s) WHERE id = %s",
            (minutes, req_id),
        )
    conn.commit()


@requires_db
def test_stale_scope_requests_are_requeued_then_failed(conn):
    aged = _enqueue(conn, A)
    fresh = _enqueue(conn, B)
    conn.commit()
    rdb.claim_next_scope_request(conn)
    rdb.claim_next_scope_request(conn)
    conn.commit()
    _age_started(conn, aged)
    # This process's in-flight id is protected however old it is.
    assert rdb.recover_stale_scope_requests(conn, 30, exclude_ids={aged}) == 0
    conn.commit()
    # So is a request whose review still holds the user's lock in another session.
    with psycopg.connect(TEST_DSN, row_factory=dict_row) as holder:
        assert rdb.try_lock_user_review(holder, A)
        assert rdb.recover_stale_scope_requests(conn, 30) == 0
        conn.commit()
        rdb.unlock_user_review(holder, A)

    # Claimed once (a redeploy's drain abandoned it): back to pending, claimable at once.
    assert rdb.recover_stale_scope_requests(conn, 30) == 1
    conn.commit()
    row = _scope_row(conn, aged)
    assert row["status"] == "pending" and row["notes"] == "worker timeout; requeued"
    assert row["started_at"] is None and row["finished_at"] is None and row["claim_version"] == 1
    assert _scope_row(conn, fresh)["status"] == "running"

    # The second claim is requeued too; the third (claim_version 3) is failed.
    for claim_version, status, notes in ((2, "pending", "worker timeout; requeued"), (3, "failed", "worker timeout")):
        claimed = rdb.claim_next_scope_request(conn)
        conn.commit()
        assert claimed["id"] == aged and claimed["claim_version"] == claim_version
        _age_started(conn, aged)
        assert rdb.recover_stale_scope_requests(conn, 30) == 1
        conn.commit()
        row = _scope_row(conn, aged)
        assert row["status"] == status and row["notes"] == notes and row["claim_version"] == claim_version
    assert row["finished_at"] is not None
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


# ── Fix round 1 (review of PR #50): model path, fences, retries, slots, isolation ──

class _ApprovingModel:
    """Stands in for ReviewClient with no network: every job passes stage 1 and is
    approved. Records which jobs reached the model; `on_stage1` runs once, at the first
    stage-1 call (a test uses it to change the profile while the run works)."""

    def __init__(self, on_stage1=None):
        self.stage1_jobs: list[str] = []
        self._on_stage1 = on_stage1

    def __call__(self, *, model_stage1="m1", model_stage2="m2", **_kw):
        # run._review_user constructs ReviewClient(model_stage1=..., model_stage2=...).
        self.model_stage1, self.model_stage2 = model_stage1, model_stage2
        return self

    async def stage1_batch(self, *, profile_block, jobs):
        if self._on_stage1 is not None:
            hook, self._on_stage1 = self._on_stage1, None
            hook()
        self.stage1_jobs.extend(j["id"] for j in jobs)
        return [Stage1Decision(job_id=j["id"], decision="pass", reason="r") for j in jobs]

    async def stage2(self, **_kwargs):
        return Stage2Result(
            verdict="approve", experience_match="match",
            industry="software_internet", industry_subcategory="devtools_platforms",
            confidence="high", reasoning="fit",
            role_category="Backend", skills_score=80, experience_score=80, comp_score=80,
        )


def _reviews(conn, user_id):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT job_id, profile_version, verdict FROM job_reviews WHERE user_id = %s ORDER BY job_id",
            (uuid.UUID(user_id),),
        )
        return cur.fetchall()


def _scope_rows(conn, user_id):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, status, job_ids, claim_version, notes FROM review_scope_requests "
            "WHERE user_id = %s ORDER BY id",
            (uuid.UUID(user_id),),
        )
        return cur.fetchall()


def _last_run(conn, user_id):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT notes, reviewed, approved, errors FROM review_runs WHERE user_id = %s ORDER BY id DESC LIMIT 1",
            (uuid.UUID(user_id),),
        )
        return cur.fetchone()


@requires_db
def test_scoped_run_reaches_the_model_and_is_charged_through_the_budget(conn, monkeypatch):
    _entitle_profile(conn, A)
    ids = [_seed_job(conn, str(n), remote=True) for n in range(3)]
    rid = _enqueue(conn, A, job_ids=(ids[0], ids[2]))
    conn.commit()
    model = _ApprovingModel()
    monkeypatch.setattr(worker.run, "ReviewClient", model)

    assert worker.process_one(conn) is True
    # Only the listed jobs reached the model, were persisted at the run's version and
    # were charged to today's budget, one each.
    assert sorted(model.stage1_jobs) == [ids[0], ids[2]]
    assert _reviews(conn, A) == [
        {"job_id": ids[0], "profile_version": "v1", "verdict": "approve"},
        {"job_id": ids[2], "profile_version": "v1", "verdict": "approve"},
    ]
    assert rdb.get_daily_spend(conn, A) == 2
    assert _last_run(conn, A) == {"notes": None, "reviewed": 2, "approved": 2, "errors": 0}
    row = _scope_row(conn, rid)
    assert row["status"] == "done" and row["notes"] == "2 of 2 listed job(s) selected; 2 reviewed, 0 errors"
    # The profile did not change, so nothing was queued again.
    assert [r["id"] for r in _scope_rows(conn, A)] == [rid]


@requires_db
def test_scoped_claim_superseded_before_the_user_lock_spends_nothing(conn, monkeypatch):
    _entitle_profile(conn, A)
    job = _seed_job(conn, "1", remote=True)
    rid = _enqueue(conn, A, job_ids=(job,))
    conn.commit()
    model = _ApprovingModel()
    monkeypatch.setattr(worker.run, "ReviewClient", model)

    def delayed_config(connection):
        # The claimant stalled before taking the user's lock; meanwhile another process
        # recovered the stale claim (requeued it) and claimed it again.
        connection.execute(
            "UPDATE review_scope_requests SET started_at = now() - interval '2 hours' WHERE id = %s", (rid,)
        )
        connection.commit()
        with psycopg.connect(TEST_DSN, row_factory=dict_row) as sibling:
            assert rdb.recover_stale_scope_requests(sibling) == 1
            assert rdb.claim_next_scope_request(sibling)["claim_version"] == 2
        return "standard"

    monkeypatch.setattr(rdb, "load_invite_comp_plan", delayed_config)
    assert worker.process_one(conn) is True
    assert _last_run(conn, A)["notes"] == "review scope request claim superseded; skipped"
    # The old generation's finish was a no-op: the new claim still owns the row.
    row = _scope_row(conn, rid)
    assert row["status"] == "running" and row["claim_version"] == 2 and row["finished_at"] is None
    # Nothing reached the model, nothing was persisted or charged, nothing was queued.
    assert model.stage1_jobs == []
    assert _reviews(conn, A) == []
    assert rdb.get_daily_spend(conn, A) == 0
    assert [r["id"] for r in _scope_rows(conn, A)] == [rid]


@requires_db
def test_profile_change_during_a_scoped_run_queues_the_jobs_again(conn, monkeypatch):
    _entitle_profile(conn, A)
    ids = [_seed_job(conn, str(n), remote=True) for n in range(2)]
    rid = _enqueue(conn, A, job_ids=ids)
    conn.commit()

    def save_new_memo():
        # A memo save lands while the model works: new profile_version, and its
        # enqueue would get already_active because this request is running.
        conn.execute("UPDATE profiles SET profile_version = 'v2' WHERE user_id = %s", (uuid.UUID(A),))
        conn.commit()

    model = _ApprovingModel(on_stage1=save_new_memo)
    monkeypatch.setattr(worker.run, "ReviewClient", model)

    assert worker.process_one(conn) is True
    # The run finished at the version it loaded under the lock.
    assert {r["profile_version"] for r in _reviews(conn, A)} == {"v1"}
    first, second = _scope_rows(conn, A)
    assert first["id"] == rid and first["status"] == "done"
    assert first["notes"] == (
        "2 of 2 listed job(s) selected; 2 reviewed, 0 errors; "
        "the profile changed during the run, so the jobs were queued again"
    )
    # A fresh pending request with the same jobs, in the same transaction.
    assert second["status"] == "pending" and second["job_ids"] == ids and second["claim_version"] == 0

    # It runs at the new version and does not queue itself again.
    assert worker.process_one(conn) is True
    assert {r["profile_version"] for r in _reviews(conn, A)} == {"v2"}
    assert rdb.get_daily_spend(conn, A) == 4
    rows = _scope_rows(conn, A)
    assert [r["status"] for r in rows] == ["done", "done"]
    assert rows[1]["notes"] == "2 of 2 listed job(s) selected; 2 reviewed, 0 errors"


@requires_db
def test_a_temporary_stop_retries_the_scoped_request_until_it_is_a_day_old(conn, monkeypatch):
    _entitle_profile(conn, A)
    job = _seed_job(conn, "1", remote=True)
    rdb.add_daily_spend(conn, A, 100_000)  # today's cap is spent
    conn.commit()
    rid = _enqueue(conn, A, job_ids=(job,))
    conn.commit()
    model = _ApprovingModel()
    monkeypatch.setattr(worker.run, "ReviewClient", model)

    # Nothing reviewed, for a temporary reason: back to pending, requested_at kept, and
    # started_at marks the attempt for the backoff.
    requested_at = conn.execute(
        "SELECT requested_at FROM review_scope_requests WHERE id = %s", (rid,)
    ).fetchone()["requested_at"]
    assert worker.process_one(conn) is False
    row = _scope_row(conn, rid)
    assert row["status"] == "pending" and row["notes"] == "will retry: daily cap exhausted"
    assert row["started_at"] is not None and row["finished_at"] is None and row["claim_version"] == 1
    assert conn.execute(
        "SELECT requested_at FROM review_scope_requests WHERE id = %s", (rid,)
    ).fetchone()["requested_at"] == requested_at
    # While it backs off, no loop claims it.
    assert worker.process_one(conn) is False
    assert _scope_row(conn, rid)["claim_version"] == 1
    # After the backoff it is tried again.
    _age_started(conn, rid, rdb.SCOPE_RETRY_BACKOFF_MINUTES + 1)
    assert worker.process_one(conn) is False
    row = _scope_row(conn, rid)
    assert row["status"] == "pending" and row["claim_version"] == 2

    # Once the request is a day old it ends, with a note that promises no later run.
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE review_scope_requests SET requested_at = now() - interval '25 hours', "
            "started_at = now() - interval '16 minutes' WHERE id = %s",
            (rid,),
        )
    conn.commit()
    assert worker.process_one(conn) is True
    row = _scope_row(conn, rid)
    assert row["status"] == "done" and row["finished_at"] is not None and row["claim_version"] == 3
    assert row["notes"] == (
        "gave up after 24 hours: daily cap exhausted; none of the 1 listed job(s) reviewed here; "
        "left to the regular review"
    )
    assert "deferred" not in row["notes"]
    assert model.stage1_jobs == [] and _reviews(conn, A) == []
    assert worker.process_one(conn) is False


@requires_db
def test_a_lock_busy_handback_also_ends_once_the_request_is_a_day_old(conn, monkeypatch):
    _entitle_profile(conn, A)
    rid = _enqueue(conn, A)
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE review_scope_requests SET requested_at = now() - interval '25 hours' WHERE id = %s", (rid,)
        )
    conn.commit()
    monkeypatch.setattr(worker.run, "_review_user", lambda *_a, **_k: False)
    assert worker.process_one(conn) is True
    row = _scope_row(conn, rid)
    assert row["status"] == "done" and row["notes"] == (
        "gave up after 24 hours: another review kept holding the user's lock; "
        "none of the 1 listed job(s) reviewed here; left to the regular review"
    )


@pytest.mark.parametrize("parallelism, limit", [(-1, 1), (0, 1), (1, 1), (2, 1), (3, 2), (5, 4)])
def test_scoped_slots_are_k_minus_one_but_never_zero(monkeypatch, parallelism, limit):
    monkeypatch.setattr(worker.config, "REVIEW_WORKER_PARALLELISM", parallelism)
    claims = []

    def claim(_conn):
        claims.append(1)  # and returns None: nothing pending

    monkeypatch.setattr(worker.db, "claim_next_scope_request", claim)

    class _Conn:
        def commit(self):
            pass

    held = 0
    while worker._take_scope_slot():
        held += 1
    assert held == limit
    # Every slot is busy: the loop does not even claim.
    assert worker.process_scope_request(_Conn()) is False and claims == []
    # One frees up: the loop claims, and gives the slot back when the attempt ends.
    worker._release_scope_slot()
    assert worker.process_scope_request(_Conn()) is False and claims == [1]
    assert worker._scope_slots_in_use == limit - 1

    def broken_claim(_conn):
        raise RuntimeError("scoped table unavailable")

    monkeypatch.setattr(worker.db, "claim_next_scope_request", broken_claim)
    with pytest.raises(RuntimeError):
        worker.process_scope_request(_Conn())
    assert worker._scope_slots_in_use == limit - 1  # released on an error too


@requires_db
def test_scoped_runs_never_take_the_last_loop(conn, monkeypatch):
    monkeypatch.setattr(worker.config, "REVIEW_WORKER_PARALLELISM", 3)
    calls = []

    def fake_review(_connection, profile, *_args, **kwargs):
        calls.append((str(profile["user_id"]), kwargs.get("request_claim") is not None))

    monkeypatch.setattr(worker.run, "_review_user", fake_review)
    _entitle_profile(conn, A)
    _entitle_profile(conn, B)
    scoped = _enqueue(conn, A)
    conn.commit()

    # Two of the three loops are already running scoped requests.
    assert worker._take_scope_slot() and worker._take_scope_slot()
    assert worker.process_one(conn) is False
    row = _scope_row(conn, scoped)
    assert row["status"] == "pending" and row["claim_version"] == 0 and calls == []
    # This loop still serves a full request.
    with conn.cursor() as cur:
        cur.execute("INSERT INTO review_requests (user_id, status) VALUES (%s, 'pending')", (uuid.UUID(B),))
    conn.commit()
    assert worker.process_one(conn) is True
    assert calls == [(B, True)]
    # Once one scoped run ends, the scoped request runs.
    worker._release_scope_slot()
    assert worker.process_one(conn) is True
    assert calls[1] == (A, False) and _scope_row(conn, scoped)["status"] == "done"
    assert worker._scope_slots_in_use == 1  # the slot still held above


@requires_db
def test_a_scoped_table_fault_never_stops_the_full_queue(conn, monkeypatch):
    def broken(connection, *_args, **_kwargs):
        # A database without the scoped table: the statement fails and aborts the
        # transaction, exactly as the real query would.
        connection.execute("SELECT 1 FROM review_scope_requests_missing")

    monkeypatch.setattr(rdb, "recover_stale_scope_requests", broken)
    monkeypatch.setattr(rdb, "claim_next_scope_request", broken)
    calls = []
    monkeypatch.setattr(worker.run, "_review_user", lambda _c, profile, *_a, **_k: calls.append(str(profile["user_id"])))
    _entitle_profile(conn, A)
    _entitle_profile(conn, B)
    with conn.cursor() as cur:
        cur.execute("INSERT INTO review_requests (user_id, status) VALUES (%s, 'pending') RETURNING id", (uuid.UUID(B),))
        stale = cur.fetchone()["id"]
        cur.execute(
            "UPDATE review_requests SET status = 'running', started_at = now() - interval '31 minutes' WHERE id = %s",
            (stale,),
        )
        cur.execute("INSERT INTO review_requests (user_id, status) VALUES (%s, 'pending') RETURNING id", (uuid.UUID(A),))
        pending = cur.fetchone()["id"]
    conn.commit()

    # The full queue's recovery and claim both still work, and the request is processed.
    assert worker.process_one(conn) is True
    assert calls == [A]
    with conn.cursor() as cur:
        cur.execute("SELECT id, status FROM review_requests WHERE id = ANY(%s) ORDER BY id", ([stale, pending],))
        assert {r["id"]: r["status"] for r in cur.fetchall()} == {stale: "failed", pending: "done"}
    # With no full request left, the broken scoped claim is logged, not raised.
    assert worker.process_one(conn) is False
    assert conn.execute("SELECT 1 AS ok").fetchone()["ok"] == 1
