import uuid

import psycopg
from psycopg.rows import dict_row

from reviewer import db as rdb
from reviewer import worker
from tests.conftest import TEST_DSN, requires_db

UA = "aaaa1111-1111-1111-1111-111111111111"
UB = "bbbb2222-2222-2222-2222-222222222222"


def _enqueue(conn, user_id) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO review_requests (user_id, status) VALUES (%s, 'pending') RETURNING id",
            (uuid.UUID(user_id),),
        )
        rid = cur.fetchone()["id"]
    conn.commit()
    return rid


def _entitle_profile(conn, user_id, *, locations=("Remote",), cap=None):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version, "
            " preferred_locations, daily_review_cap) VALUES (%s, 'r', 'i', 'v1', %s, %s)",
            (uuid.UUID(user_id), list(locations), cap),
        )
        cur.execute(
            "INSERT INTO subscriptions (user_id, status, plan, current_period_end) "
            "VALUES (%s, 'active', 'standard', now() + interval '30 days')",
            (uuid.UUID(user_id),),
        )
    conn.commit()


@requires_db
def test_claim_marks_running(conn):
    rid = _enqueue(conn, UA)
    claimed = rdb.claim_next_review_request(conn)
    conn.commit()
    assert claimed["id"] == rid
    with conn.cursor() as cur:
        cur.execute("SELECT status, started_at FROM review_requests WHERE id = %s", (rid,))
        row = cur.fetchone()
    assert row["status"] == "running" and row["started_at"] is not None


@requires_db
def test_two_claimers_never_take_the_same_row(conn):
    # Two pending rows (distinct users — the partial unique index forbids two active
    # per user). Two concurrent connections must claim DIFFERENT rows (SKIP LOCKED).
    _enqueue(conn, UA)
    _enqueue(conn, UB)
    conn2 = psycopg.connect(TEST_DSN, row_factory=dict_row)
    try:
        c1 = rdb.claim_next_review_request(conn)   # locks row 1 (uncommitted)
        c2 = rdb.claim_next_review_request(conn2)  # must skip the locked row → row 2
        assert c1 is not None and c2 is not None
        assert c1["id"] != c2["id"]
        conn.commit()
        conn2.commit()
    finally:
        conn2.close()


@requires_db
def test_second_claimer_gets_nothing_when_only_row_is_locked(conn):
    _enqueue(conn, UA)
    conn2 = psycopg.connect(TEST_DSN, row_factory=dict_row)
    try:
        c1 = rdb.claim_next_review_request(conn)   # locks the only pending row
        c2 = rdb.claim_next_review_request(conn2)  # SKIP LOCKED → nothing
        assert c1 is not None
        assert c2 is None
        conn.commit()
        conn2.commit()
    finally:
        conn2.close()


@requires_db
def test_finish_transitions_and_notes(conn):
    rid = _enqueue(conn, UA)
    rdb.claim_next_review_request(conn)
    rdb.finish_review_request(conn, rid, "failed", notes="boom")
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT status, notes, finished_at FROM review_requests WHERE id = %s", (rid,))
        row = cur.fetchone()
    assert row["status"] == "failed" and row["notes"] == "boom" and row["finished_at"] is not None


@requires_db
def test_stale_running_recovery(conn):
    rid = _enqueue(conn, UA)
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE review_requests SET status = 'running', started_at = now() - interval '31 minutes' "
            "WHERE id = %s",
            (rid,),
        )
    conn.commit()
    n = rdb.recover_stale_review_requests(conn, 30)
    conn.commit()
    assert n == 1
    with conn.cursor() as cur:
        cur.execute("SELECT status, notes FROM review_requests WHERE id = %s", (rid,))
        row = cur.fetchone()
    assert row["status"] == "failed" and row["notes"] == "worker timeout — re-request"


@requires_db
def test_process_one_exhausted_budget_completes_done(conn):
    # A request for a user whose daily budget is spent: _review_user skips (zero LLM
    # calls, so no API key needed), the review_runs note is 'daily cap exhausted', and
    # the REQUEST still completes as 'done'.
    _entitle_profile(conn, UA, cap=5)
    rdb.add_daily_spend(conn, UA, 5)  # pre-exhaust today's budget
    conn.commit()
    rid = _enqueue(conn, UA)

    handled = worker.process_one(conn)
    assert handled is True
    with conn.cursor() as cur:
        cur.execute("SELECT status FROM review_requests WHERE id = %s", (rid,))
        assert cur.fetchone()["status"] == "done"
        cur.execute(
            "SELECT notes FROM review_runs WHERE user_id = %s ORDER BY id DESC LIMIT 1",
            (uuid.UUID(UA),),
        )
        assert cur.fetchone()["notes"] == "daily cap exhausted"


@requires_db
def test_process_one_empty_queue_returns_false(conn):
    assert worker.process_one(conn) is False
