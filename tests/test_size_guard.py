# tests/test_size_guard.py
"""Disk safety valve: Company Discovery + Job Discovery halt before filling the 8 GB volume."""
import job_discovery.run as job_discovery_run
import company_discovery.run as company_discovery_run
from job_discovery import db


# --- ceiling parsing -------------------------------------------------------

def test_ceiling_default(monkeypatch):
    monkeypatch.delenv("DB_SIZE_CEILING_MB", raising=False)
    assert db.db_size_ceiling_mb() == 6000.0


def test_ceiling_env_override(monkeypatch):
    monkeypatch.setenv("DB_SIZE_CEILING_MB", "7500")
    assert db.db_size_ceiling_mb() == 7500.0


def test_ceiling_malformed_falls_back(monkeypatch):
    monkeypatch.setenv("DB_SIZE_CEILING_MB", "not-a-number")
    assert db.db_size_ceiling_mb() == 6000.0


# --- over_size_ceiling ------------------------------------------------------

class _SizeCur:
    def __init__(self, byte_count):
        self._b = byte_count

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, *a, **k):
        pass

    def fetchone(self):
        return {"bytes": self._b}


class _SizeConn:
    def __init__(self, byte_count):
        self._b = byte_count

    def cursor(self):
        return _SizeCur(self._b)


def test_over_size_ceiling_true(monkeypatch):
    monkeypatch.setenv("DB_SIZE_CEILING_MB", "6000")
    over, size, ceiling = db.over_size_ceiling(_SizeConn(7000 * 1024 * 1024))
    assert over is True and ceiling == 6000.0 and round(size) == 7000


def test_over_size_ceiling_false(monkeypatch):
    monkeypatch.setenv("DB_SIZE_CEILING_MB", "6000")
    over, size, ceiling = db.over_size_ceiling(_SizeConn(2000 * 1024 * 1024))
    assert over is False and round(size) == 2000


# --- run() halts when over ceiling -----------------------------------------

class _GuardConn:
    """A connection whose cursor must never be touched once the guard trips.

    rollback() is allowed because _run_prune calls it when prune itself raises
    (e.g. when prune_jobs is not monkeypatched and cursor() fires).
    """

    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True

    def rollback(self):
        pass  # prune failure path: safe no-op

    def cursor(self):  # pragma: no cover - asserts the guard short-circuited
        raise AssertionError("DB touched despite being over the size ceiling")


def test_job_discovery_run_skips_when_over_ceiling(monkeypatch):
    conn = _GuardConn()
    monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
    monkeypatch.setattr(job_discovery_run.db, "connect", lambda dsn=None: conn)
    monkeypatch.setattr(job_discovery_run.db, "over_size_ceiling", lambda c: (True, 6500.0, 6000.0))
    started = {"called": False}
    monkeypatch.setattr(job_discovery_run.db, "start_run",
                        lambda c: started.__setitem__("called", True) or 1)

    job_discovery_run.run()

    assert started["called"] is False   # never started a poll run
    assert conn.closed is True          # connection still cleaned up


def test_job_discovery_run_prunes_when_over_ceiling(monkeypatch):
    """prune_jobs must still run when the size guard short-circuits the poll.

    Prune is the only mechanism that can shrink the DB; skipping it on the
    over-ceiling path would stall recovery.
    """
    conn = _GuardConn()
    monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
    monkeypatch.setattr(job_discovery_run.db, "connect", lambda dsn=None: conn)
    monkeypatch.setattr(job_discovery_run.db, "over_size_ceiling", lambda c: (True, 6500.0, 6000.0))
    started = {"called": False}
    monkeypatch.setattr(job_discovery_run.db, "start_run",
                        lambda c: started.__setitem__("called", True) or 1)

    prune_calls = {"n": 0}

    def fake_prune(c):
        prune_calls["n"] += 1

    import job_discovery.prune as prune_module
    monkeypatch.setattr(prune_module, "prune_jobs", fake_prune)

    job_discovery_run.run()

    assert prune_calls["n"] == 1       # prune still ran despite ceiling breach
    assert started["called"] is False   # poll was still skipped
    assert conn.closed is True          # connection still cleaned up


def test_company_discovery_run_skips_when_over_ceiling(monkeypatch):
    conn = _GuardConn()
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr("job_discovery.db.connect", lambda: conn)
    monkeypatch.setattr("job_discovery.db.over_size_ceiling", lambda c: (True, 6500.0, 6000.0))
    ingested = {"called": False}
    monkeypatch.setattr(company_discovery_run.db, "upsert_candidates",
                        lambda *a, **k: ingested.__setitem__("called", True) or 0)

    company_discovery_run.run()

    assert ingested["called"] is False  # never ingested / reviewed / activated
    assert conn.closed is True
