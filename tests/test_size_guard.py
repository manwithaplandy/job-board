# tests/test_size_guard.py
"""Disk safety valve: discovery + poller halt before filling the 8 GB volume."""
import poller.run as poller_run
import discovery.run as discovery_run
from poller import db


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
    """A connection that must never be touched once the guard trips."""

    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True

    def cursor(self):  # pragma: no cover - asserts the guard short-circuited
        raise AssertionError("DB touched despite being over the size ceiling")


def test_poller_run_skips_when_over_ceiling(monkeypatch):
    conn = _GuardConn()
    monkeypatch.setattr(poller_run, "load_targets", lambda: [])
    monkeypatch.setattr(poller_run.db, "connect", lambda dsn=None: conn)
    monkeypatch.setattr(poller_run.db, "over_size_ceiling", lambda c: (True, 6500.0, 6000.0))
    started = {"called": False}
    monkeypatch.setattr(poller_run.db, "start_run",
                        lambda c: started.__setitem__("called", True) or 1)

    poller_run.run()

    assert started["called"] is False   # never started a poll run
    assert conn.closed is True          # connection still cleaned up


def test_discovery_run_skips_when_over_ceiling(monkeypatch):
    conn = _GuardConn()
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr("poller.db.connect", lambda: conn)
    monkeypatch.setattr("poller.db.over_size_ceiling", lambda c: (True, 6500.0, 6000.0))
    ingested = {"called": False}
    monkeypatch.setattr(discovery_run.db, "upsert_candidates",
                        lambda *a, **k: ingested.__setitem__("called", True) or 0)

    discovery_run.run()

    assert ingested["called"] is False  # never ingested / reviewed / activated
    assert conn.closed is True
