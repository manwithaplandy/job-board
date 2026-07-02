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

class _GuardResult:
    """Minimal cursor-shaped result for ``conn.execute(...).fetchone()`` (the
    advisory-lock acquire). ``locked=True`` so run() proceeds past the lock."""

    def __init__(self, row):
        self._row = row

    def fetchone(self):
        return self._row


class _GuardCursor:
    """A no-op recording cursor. When over the ceiling, the ONLY cursor work run()
    is allowed to do is the single poll_runs accounting row (start_run/finish_run)
    and prune; this records the SQL it sees but performs no real DB work so the
    expensive poll body cannot silently succeed against a live table."""

    def __init__(self, queries):
        self._queries = queries

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, query, params=None):
        self._queries.append(query)

    @property
    def rowcount(self):
        return 0  # prune's batched sweeps see 0 rows -> stop after one pass

    def fetchone(self):
        return None

    def fetchall(self):
        return []


class _GuardConn:
    """Connection double for the over-ceiling short-circuit.

    A7 (advisory lock) and A9 (over-ceiling accounting) changed what run() does
    BEFORE it decides to skip the poll, so this double now permits exactly those
    cheap interactions and nothing more:

      * ``execute()`` — the advisory-lock acquire (returns ``locked=True``);
      * ``cursor()`` — the single poll_runs accounting row (start_run/finish_run)
        and prune, via a no-op recording cursor;
      * ``commit()`` / ``rollback()`` / ``close()``.

    The double records every SQL string that flows through it (``queries``) so a
    test can assert the accounting row was written. The guard's REAL purpose —
    that the expensive per-company poll/upsert work is skipped — is enforced by
    the tests monkeypatching ``sync_seed``/``active_companies`` to blow up if the
    poll body is ever entered (a no-op cursor alone would let it silently pass).
    """

    def __init__(self):
        self.closed = False
        self.queries: list[str] = []

    def execute(self, query, params=None):
        # run() acquires the advisory lock via conn.execute(...).fetchone()["locked"].
        self.queries.append(query)
        return _GuardResult({"locked": True})

    def cursor(self):
        return _GuardCursor(self.queries)

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        self.closed = True


def _forbid_poll_body(monkeypatch):
    """Make the expensive poll body fail loudly if it is ever entered.

    ``sync_seed`` and ``active_companies`` are the gateways into the per-company
    poll/upsert work; over the ceiling neither must be called. This keeps the
    guard meaningful even though the double now permits the accounting cursor."""
    def _boom(*a, **k):
        raise AssertionError("expensive poll work ran despite being over the size ceiling")
    monkeypatch.setattr(job_discovery_run.db, "sync_seed", _boom)
    monkeypatch.setattr(job_discovery_run.db, "active_companies", _boom)


def test_job_discovery_run_skips_when_over_ceiling(monkeypatch):
    conn = _GuardConn()
    monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
    monkeypatch.setattr(job_discovery_run.db, "connect", lambda dsn=None: conn)
    monkeypatch.setattr(job_discovery_run.db, "over_size_ceiling", lambda c: (True, 6500.0, 6000.0))
    _forbid_poll_body(monkeypatch)
    started = {"called": False}
    monkeypatch.setattr(job_discovery_run.db, "start_run",
                        lambda c: started.__setitem__("called", True) or 1)

    job_discovery_run.run()

    # New contract (A9): the guard records ONE poll_runs accounting row instead of
    # silently skipping, so operators can see the ceiling fired.
    assert started["called"] is True                       # start_run was called
    assert any("poll_runs" in q for q in conn.queries)     # finish_run wrote the row
    # New contract (A7): the advisory lock is acquired before the ceiling check.
    assert any("pg_try_advisory_lock" in q for q in conn.queries)
    assert conn.closed is True                             # connection still cleaned up


def test_job_discovery_run_prunes_when_over_ceiling(monkeypatch):
    """prune_jobs must still run when the size guard short-circuits the poll.

    Prune is the only mechanism that can shrink the DB; skipping it on the
    over-ceiling path would stall recovery.
    """
    conn = _GuardConn()
    monkeypatch.setattr(job_discovery_run, "load_targets", lambda: [])
    monkeypatch.setattr(job_discovery_run.db, "connect", lambda dsn=None: conn)
    monkeypatch.setattr(job_discovery_run.db, "over_size_ceiling", lambda c: (True, 6500.0, 6000.0))
    _forbid_poll_body(monkeypatch)
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
    assert started["called"] is True   # accounting row still written (A9)
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
