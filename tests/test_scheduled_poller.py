import os
import signal
import subprocess
import sys

import pytest

from tests.conftest import requires_db


@requires_db
@pytest.mark.parametrize("lane", ["normal", "operational"])
def test_interrupted_attempt_keeps_daily_retry_slot(conn, lane):
    from job_discovery.lifecycle import reconcile, operational
    from job_discovery.lifecycle.claims import cancel_claim
    from tests.test_lifecycle_reconcile import setup_source

    source = setup_source(conn, count=0)
    source, claim = reconcile.claim_due_source(conn)
    if lane == "operational":
        conn.execute("UPDATE source_accounts SET next_due_at=NULL")
        operational.start(conn, source["id"], claim)
    conn.commit()
    # An abrupt exit leaves committed attempt bookkeeping without completion.
    # Releasing the lease here models its eventual expiry, without waiting.
    cancel_claim(conn, claim)
    conn.commit()
    row = conn.execute(
        "SELECT next_due_at, (date_trunc('day',last_attempt_at AT TIME ZONE 'UTC') "
        "+ interval '24 hours') AT TIME ZONE 'UTC' expected FROM source_accounts WHERE id=%s",
        (source["id"],),
    ).fetchone()
    assert row["next_due_at"] == row["expected"]
    assert reconcile.claim_due_source(conn) is None


@requires_db
def test_source_worker_includes_maintenance_in_turn_budget(conn, monkeypatch):
    from job_discovery.lifecycle import source_worker
    from tests.test_lifecycle_reconcile import setup_source

    setup_source(conn, count=0)
    conn.commit()
    clock = [100.0]
    monkeypatch.setattr(source_worker, "monotonic", lambda: clock[0])
    original = source_worker.pre_admission_maintenance

    def maintenance(dsn):
        result = original(dsn)
        clock[0] += 90
        return result

    monkeypatch.setattr(source_worker, "pre_admission_maintenance", maintenance)
    seen = []
    monkeypatch.setattr(
        source_worker, "verify_due_sources", lambda connection, **kw: seen.append(kw)
    )
    source_worker.run_source_once(os.environ["TEST_DATABASE_URL"])
    assert seen[0]["seconds"] == 210


@requires_db
@pytest.mark.parametrize("explicit_fallback", [False, True])
@pytest.mark.parametrize("changes_attempt", [False, True])
def test_operational_candidates_recheck_after_other_worker_finishes(
    conn, monkeypatch, explicit_fallback, changes_attempt
):
    from time import monotonic
    from job_discovery.lifecycle import reconcile, operational
    from job_discovery.lifecycle.claims import cancel_claim, claim_work
    from job_discovery.adapters import ADAPTERS
    from tests.test_lifecycle_reconcile import setup_source

    source = setup_source(conn, count=0)
    source, claim = reconcile.claim_due_source(conn)
    with reconcile._write(conn, claim, "source_accounts"):
        conn.execute("UPDATE source_accounts SET next_due_at=NULL")
    conn.commit()
    cancel_claim(conn, claim)
    conn.commit()
    original = operational.enter_gate

    def concurrent_completion(connection):
        original(connection)
        other = claim_work(connection, "source", str(source["id"]), 180)
        with reconcile._write(connection, other, "source_accounts"):
            connection.execute(
                "UPDATE source_accounts SET last_attempt_at=CASE WHEN %s THEN clock_timestamp() ELSE last_attempt_at END,next_due_at=clock_timestamp()+interval '1 day'",
                (changes_attempt,),
            )
        connection.commit()
        cancel_claim(connection, other)
        connection.commit()
        original(connection)

    monkeypatch.setattr(operational, "enter_gate", concurrent_completion)

    def forbidden(*args, **kwargs):
        pytest.fail("stale operational candidate must not fetch again")

    monkeypatch.setitem(ADAPTERS, "lever", forbidden)
    result = operational.run_due(
        conn,
        max_boards=1,
        deadline=monotonic() + 10,
        source_id=source["id"] if explicit_fallback else None,
        fallback_claim=claim if explicit_fallback else None,
    )
    assert result["complete"] == 0


@requires_db
def test_scheduled_poller_pauses_before_any_legacy_work(conn, monkeypatch):
    from job_discovery import run as runner

    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])

    def forbidden(*args, **kwargs):
        pytest.fail(
            "paused scheduled poller must not start maintenance, seeding or HTTP"
        )

    monkeypatch.setattr(runner, "pre_admission_maintenance", forbidden)
    monkeypatch.setattr(runner, "load_targets", forbidden)
    result = runner.run(require_source_enabled=True)
    assert result["paused"] is True
    assert result["new_jobs"] == 0
    assert conn.execute("SELECT count(*) AS n FROM poll_runs").fetchone()["n"] == 0


def test_scheduled_entrypoint_requires_source_mode_and_bounds_process(monkeypatch):
    import job_discovery.__main__ as entry

    calls = []
    handlers = {}
    monkeypatch.setattr(
        entry.signal, "signal", lambda sig, handler: handlers.setdefault(sig, handler)
    )
    monkeypatch.setattr(entry.signal, "alarm", lambda seconds: calls.append(seconds))
    monkeypatch.setattr(
        entry, "run", lambda **kw: calls.append(kw) or {"ok": 1, "failed": 0}
    )
    entry.main()
    assert calls == [entry.POLL_HARD_SECONDS, {"require_source_enabled": True}, 0]
    assert handlers[entry.signal.SIGALRM] == signal.SIG_DFL


def test_scheduled_deadline_terminates_even_blocked_cleanup():
    script = """
import time
import job_discovery.__main__ as entry
entry.POLL_HARD_SECONDS = 1
def blocked(**kwargs):
    try:
        time.sleep(60)
    finally:
        time.sleep(60)
entry.run = blocked
entry.main()
"""
    result = subprocess.run([sys.executable, "-c", script], timeout=10)
    assert result.returncode == -signal.SIGALRM


@requires_db
@pytest.mark.parametrize("disable_during_startup", [False, True])
def test_scheduled_poller_never_falls_back_to_legacy(
    conn, monkeypatch, disable_during_startup
):
    from job_discovery import run as runner
    from job_discovery.adapters import ADAPTERS
    from job_discovery.adapters.completeness import SourceResult, SourceStatus
    from job_discovery.models import Posting
    from tests.test_lifecycle_reconcile import setup_source

    setup_source(conn, count=0)
    conn.commit()
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(runner, "load_targets", lambda: [])

    def no_legacy(*args, **kwargs):
        pytest.fail("scheduled poll must not run legacy ingestion or pruning")

    monkeypatch.setattr(runner.db, "active_companies", no_legacy)
    monkeypatch.setattr(runner, "_run_prune", no_legacy)
    seen = []

    def feed(*args, **kwargs):
        seen.append(kwargs)
        return SourceResult(
            iter(
                [
                    Posting(
                        "new",
                        "Engineer",
                        "https://example.test/job",
                        raw={"descriptionPlain": "unneeded payload"},
                    )
                ]
            ),
            SourceStatus(),
        )

    monkeypatch.setitem(ADAPTERS, "lever", feed)
    if disable_during_startup:
        original = runner.pre_admission_maintenance

        def disable(dsn):
            conn.execute(
                "UPDATE lifecycle_control SET source_enabled=false,activation_generation=activation_generation+1 WHERE singleton"
            )
            conn.commit()
            return original(dsn)

        monkeypatch.setattr(runner, "pre_admission_maintenance", disable)
    result = runner.run(require_source_enabled=True)
    assert result["new_jobs"] == (0 if disable_during_startup else 1)
    if disable_during_startup:
        assert result["paused"] is True
        assert seen == []
    else:
        assert seen and all(call["fetch_details"] is False for call in seen)
        assert (
            conn.execute("SELECT description FROM jobs").fetchone()["description"]
            is None
        )
    assert (
        conn.execute("SELECT finished_at FROM poll_runs").fetchone()["finished_at"]
        is not None
    )
