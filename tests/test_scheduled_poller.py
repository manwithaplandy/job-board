import os
import signal
import subprocess
import sys

import pytest

from tests.conftest import requires_db


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
