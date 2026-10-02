"""Policy and queue races against an explicitly disposable PostgreSQL database."""

from pathlib import Path
from uuid import uuid4

import pytest
from tests.conftest import requires_db, as_user
from reviewer import db

pytestmark = requires_db


@pytest.fixture
def user(conn):
    migration = Path("migrations/2026-10-02-matching-activity.sql")
    if migration.exists():
        conn.execute(migration.read_text())
    uid = uuid4()
    conn.execute(
        "INSERT INTO profiles(user_id,profile_version) VALUES (%s,'v1')", (uid,)
    )
    conn.commit()
    return uid


def paused(conn, uid):
    return conn.execute("SELECT matching_paused(%s) AS paused", (uid,)).fetchone()[
        "paused"
    ]


@pytest.mark.parametrize(
    "age,expected", [("6 days 23 hours", False), ("7 days", True), ("8 days", True)]
)
def test_free_boundary(conn, user, age, expected):
    conn.execute(
        "UPDATE matching_activity SET last_meaningful_at=now()-%s::interval WHERE user_id=%s",
        (age, user),
    )
    assert paused(conn, user) is expected


@pytest.mark.parametrize(
    "status,subscription_id,period,expected",
    [
        ("active", "sub_real", "1 day", False),
        ("active", "sub_real", "-2 days", False),
        ("active", "sub_real", "-4 days", True),
        ("trialing", "sub_trial", "1 day", True),
        ("canceled", "sub_old", "1 day", True),
        ("active", None, "1 day", True),
    ],
)
def test_only_actual_valid_paid_subscription_is_exempt(
    conn, user, status, subscription_id, period, expected
):
    conn.execute(
        "UPDATE matching_activity SET last_meaningful_at=now()-interval '8 days' WHERE user_id=%s",
        (user,),
    )
    conn.execute(
        "INSERT INTO subscriptions(user_id,plan,status,stripe_subscription_id,current_period_end) VALUES(%s,'pro',%s,%s,now()+%s::interval)",
        (user, status, subscription_id, period),
    )
    assert paused(conn, user) is expected


def test_read_does_not_track_activity_and_profile_edit_does_not_resume(conn, user):
    conn.execute(
        "UPDATE matching_activity SET last_meaningful_at=now()-interval '8 days' WHERE user_id=%s",
        (user,),
    )
    conn.commit()
    before = conn.execute(
        "SELECT * FROM matching_activity WHERE user_id=%s", (user,)
    ).fetchone()
    conn.commit()
    with as_user(conn, user):
        assert paused(conn, user)
        assert paused(conn, user)
        assert (
            conn.execute(
                "SELECT * FROM matching_activity WHERE user_id=%s", (user,)
            ).fetchone()
            == before
        )
        conn.execute(
            "UPDATE profiles SET instructions='New preferences' WHERE user_id=%s",
            (user,),
        )
        row = conn.execute(
            "SELECT * FROM matching_activity WHERE user_id=%s", (user,)
        ).fetchone()
        assert row["last_meaningful_at"] > before["last_meaningful_at"]
        assert row["paused_at"] is not None
        assert paused(conn, user)


def test_resume_atomic_dedup_and_running_followup(conn, user):
    conn.execute(
        "UPDATE matching_activity SET last_meaningful_at=now()-interval '8 days' WHERE user_id=%s",
        (user,),
    )
    req = conn.execute(
        "INSERT INTO review_requests(user_id,status) VALUES(%s,'running') RETURNING id",
        (user,),
    ).fetchone()["id"]
    conn.commit()
    with as_user(conn, user):
        assert (
            conn.execute("SELECT * FROM resume_matching()").fetchone()["status"]
            == "running"
        )
        assert not paused(conn, user)
        conn.execute("SELECT * FROM resume_matching()")
        assert (
            conn.execute("SELECT count(*) AS n FROM review_requests").fetchone()["n"]
            == 1
        )
        conn.commit()
    db.finish_review_request(conn, req, "done")
    assert (
        conn.execute(
            "SELECT status FROM review_requests WHERE id=%s", (req,)
        ).fetchone()["status"]
        == "pending"
    )
    # A second completion consumes the marker; no endless loop.
    db.finish_review_request(conn, req, "done")
    assert (
        conn.execute(
            "SELECT status FROM review_requests WHERE id=%s", (req,)
        ).fetchone()["status"]
        == "done"
    )


def test_resume_requires_identity_and_activity_cannot_be_forged(conn, user):
    with pytest.raises(Exception):
        conn.execute("SELECT * FROM resume_matching()")
    conn.rollback()
    with as_user(conn, user):
        with pytest.raises(Exception):
            conn.execute("UPDATE matching_activity SET paused_at=NULL")


def test_execution_gate_persists_pause(conn, user):
    conn.execute(
        "UPDATE matching_activity SET last_meaningful_at=now()-interval '8 days' WHERE user_id=%s",
        (user,),
    )
    assert db.matching_eligible(conn, str(user)) is False
    assert (
        conn.execute(
            "SELECT paused_at FROM matching_activity WHERE user_id=%s", (user,)
        ).fetchone()["paused_at"]
        is not None
    )


def test_queued_execution_reloads_stale_profile(conn, user, monkeypatch):
    from reviewer import run

    conn.execute("INSERT INTO plan_overrides(user_id,plan) VALUES(%s,'pro')", (user,))
    conn.commit()
    stale = db.load_profile(conn, str(user))
    conn.execute(
        "UPDATE matching_activity SET last_meaningful_at=now()-interval '8 days' WHERE user_id=%s",
        (user,),
    )
    conn.commit()
    run._review_user(conn, stale)
    row = conn.execute(
        "SELECT notes FROM review_runs WHERE user_id=%s ORDER BY id DESC LIMIT 1",
        (user,),
    ).fetchone()
    assert "matching paused" in row["notes"]


def test_resume_concurrent_calls_deduplicate(conn, user):
    import psycopg
    import json
    from concurrent.futures import ThreadPoolExecutor
    from tests.conftest import TEST_DSN

    conn.execute(
        "UPDATE matching_activity SET last_meaningful_at=now()-interval '8 days' WHERE user_id=%s",
        (user,),
    )
    conn.commit()

    def resume(_):
        with psycopg.connect(TEST_DSN) as other:
            other.execute("SET LOCAL ROLE authenticated")
            other.execute(
                "SELECT set_config('request.jwt.claims',%s,true)",
                (json.dumps({"sub": str(user)}),),
            )
            return other.execute("SELECT * FROM resume_matching()").fetchone()

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(resume, range(4)))
    assert [r[1] for r in results].count(False) == 1
    assert (
        conn.execute("SELECT count(*) AS n FROM review_requests").fetchone()["n"] == 1
    )


def test_worker_does_not_consume_resume_while_cron_holds_lock(conn, user):
    import psycopg
    from tests.conftest import TEST_DSN
    from reviewer import worker

    conn.execute("INSERT INTO review_requests(user_id) VALUES(%s)", (user,))
    conn.commit()
    with psycopg.connect(TEST_DSN, row_factory=psycopg.rows.dict_row) as holder:
        assert db.try_lock_user_review(holder, str(user))
        assert worker.process_one(conn) is False
        assert (
            conn.execute("SELECT status FROM review_requests").fetchone()["status"]
            == "pending"
        )


def test_manual_rejection_tracks_activity_but_reviewer_writes_do_not(conn, user):
    conn.execute("INSERT INTO companies(ats,token,name) VALUES('lever','acme','Acme')")
    company = conn.execute("SELECT id FROM companies LIMIT 1").fetchone()["id"]
    conn.execute(
        "INSERT INTO jobs(id,company_id,title,external_id,url) VALUES('lever:acme:1',%s,'Engineer','1','https://example.com')",
        (company,),
    )
    conn.execute(
        "UPDATE matching_activity SET last_meaningful_at=now()-interval '1 day' WHERE user_id=%s",
        (user,),
    )
    conn.commit()
    before = conn.execute(
        "SELECT last_meaningful_at FROM matching_activity WHERE user_id=%s", (user,)
    ).fetchone()["last_meaningful_at"]
    conn.execute(
        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES(%s,'lever:acme:1','v1','approve')",
        (user,),
    )
    conn.commit()
    assert (
        conn.execute(
            "SELECT last_meaningful_at FROM matching_activity WHERE user_id=%s", (user,)
        ).fetchone()["last_meaningful_at"]
        == before
    )
    conn.commit()
    with as_user(conn, user):
        conn.execute(
            "UPDATE job_reviews SET verdict='deny',human_override=true WHERE user_id=%s",
            (user,),
        )
        assert (
            conn.execute(
                "SELECT last_meaningful_at FROM matching_activity WHERE user_id=%s",
                (user,),
            ).fetchone()["last_meaningful_at"]
            > before
        )


def test_application_applied_tracks_but_generated_content_does_not(conn, user):
    conn.execute("INSERT INTO companies(ats,token,name) VALUES('lever','acme','Acme')")
    company = conn.execute("SELECT id FROM companies LIMIT 1").fetchone()["id"]
    conn.execute(
        "INSERT INTO jobs(id,company_id,title,external_id,url) VALUES('lever:acme:1',%s,'Engineer','1','https://example.com')",
        (company,),
    )
    conn.execute(
        "UPDATE matching_activity SET last_meaningful_at=now()-interval '1 day' WHERE user_id=%s",
        (user,),
    )
    conn.commit()
    before = conn.execute(
        "SELECT last_meaningful_at FROM matching_activity WHERE user_id=%s", (user,)
    ).fetchone()["last_meaningful_at"]
    conn.commit()
    with as_user(conn, user):
        conn.execute(
            "INSERT INTO application_packages(user_id,job_id,status) VALUES(%s,'lever:acme:1','prepared')",
            (user,),
        )
        assert (
            conn.execute(
                "SELECT last_meaningful_at FROM matching_activity WHERE user_id=%s",
                (user,),
            ).fetchone()["last_meaningful_at"]
            == before
        )
        conn.execute(
            "UPDATE application_packages SET status='applied',applied_at=now() WHERE user_id=%s",
            (user,),
        )
        assert (
            conn.execute(
                "SELECT last_meaningful_at FROM matching_activity WHERE user_id=%s",
                (user,),
            ).fetchone()["last_meaningful_at"]
            > before
        )


@pytest.mark.parametrize("_attempt", range(3))
def test_resume_racing_completion_always_leaves_one_pending_request(
    conn, user, _attempt
):
    import json
    import psycopg
    from psycopg.rows import dict_row
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from tests.conftest import TEST_DSN

    conn.execute(
        "UPDATE matching_activity SET last_meaningful_at=now()-interval '8 days' WHERE user_id=%s",
        (user,),
    )
    req = conn.execute(
        "INSERT INTO review_requests(user_id,status,started_at) VALUES(%s,'running',now()) RETURNING id",
        (user,),
    ).fetchone()["id"]
    conn.commit()
    barrier = Barrier(2)

    def finish():
        with psycopg.connect(TEST_DSN, row_factory=dict_row) as other:
            barrier.wait()
            db.finish_review_request(other, req, "done")

    def resume():
        with psycopg.connect(TEST_DSN, row_factory=dict_row) as other:
            other.execute("SET LOCAL ROLE authenticated")
            other.execute(
                "SELECT set_config('request.jwt.claims',%s,true)",
                (json.dumps({"sub": str(user)}),),
            )
            barrier.wait()
            other.execute("SELECT * FROM resume_matching()")

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(finish), pool.submit(resume)]
        for f in futures:
            f.result(timeout=10)
    assert not paused(conn, user)
    assert (
        conn.execute(
            "SELECT count(*) AS n FROM review_requests WHERE status='pending'"
        ).fetchone()["n"]
        == 1
    )


def test_stale_recovery_preserves_explicit_resume(conn, user):
    conn.execute(
        "INSERT INTO review_requests(user_id,status,started_at,resume_requested) VALUES(%s,'running',now()-interval '2 hours',true)",
        (user,),
    )
    assert db.recover_stale_review_requests(conn) == 1
    assert (
        conn.execute("SELECT status FROM review_requests").fetchone()["status"]
        == "pending"
    )


def test_background_filter_persistence_does_not_count(conn, user):
    conn.execute(
        "UPDATE matching_activity SET last_meaningful_at=now()-interval '1 day' WHERE user_id=%s",
        (user,),
    )
    conn.commit()
    before = conn.execute(
        "SELECT last_meaningful_at FROM matching_activity WHERE user_id=%s", (user,)
    ).fetchone()["last_meaningful_at"]
    conn.commit()
    with as_user(conn, user):
        conn.execute(
            "UPDATE profiles SET board_filters='{}'::jsonb WHERE user_id=%s", (user,)
        )
        assert (
            conn.execute(
                "SELECT last_meaningful_at FROM matching_activity WHERE user_id=%s",
                (user,),
            ).fetchone()["last_meaningful_at"]
            == before
        )


def test_paid_subscription_bypasses_persisted_pause_and_expiry_rechecks(conn, user):
    conn.execute(
        "UPDATE matching_activity SET paused_at=now(),last_meaningful_at=now()-interval '8 days' WHERE user_id=%s",
        (user,),
    )
    conn.execute(
        "INSERT INTO subscriptions(user_id,plan,status,stripe_subscription_id,current_period_end) VALUES(%s,'standard','active','sub_real',now()+interval '1 day')",
        (user,),
    )
    assert db.matching_eligible(conn, str(user))
    conn.execute("UPDATE subscriptions SET status='canceled' WHERE user_id=%s", (user,))
    assert not db.matching_eligible(conn, str(user))


def test_cross_process_recovery_respects_active_review_lock(conn, user):
    import psycopg
    from tests.conftest import TEST_DSN

    conn.execute(
        "INSERT INTO review_requests(user_id,status,started_at,resume_requested) VALUES(%s,'running',now()-interval '2 hours',true)",
        (user,),
    )
    conn.commit()
    with psycopg.connect(TEST_DSN, row_factory=psycopg.rows.dict_row) as holder:
        assert db.try_lock_user_review(holder, str(user))
        assert db.recover_stale_review_requests(conn) == 0
        row = conn.execute(
            "SELECT status,resume_requested FROM review_requests"
        ).fetchone()
        assert row == {"status": "running", "resume_requested": True}


def test_resume_keeps_followup_when_subscription_activates_after_paused_execution(
    conn, user
):
    conn.execute(
        "UPDATE matching_activity SET paused_at=now() WHERE user_id=%s", (user,)
    )
    req = conn.execute(
        "INSERT INTO review_requests(user_id,status) VALUES(%s,'running') RETURNING id",
        (user,),
    ).fetchone()["id"]
    # The in-flight request has already skipped, then a webhook activates billing.
    conn.execute(
        "INSERT INTO subscriptions(user_id,plan,status,stripe_subscription_id,current_period_end) VALUES(%s,'standard','active','sub_new',now()+interval '1 day')",
        (user,),
    )
    conn.commit()
    with as_user(conn, user):
        conn.execute("SELECT * FROM resume_matching()")
        conn.commit()
    db.finish_review_request(conn, req, "done")
    assert (
        conn.execute(
            "SELECT status FROM review_requests WHERE id=%s", (req,)
        ).fetchone()["status"]
        == "pending"
    )
