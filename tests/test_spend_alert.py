import httpx
import pytest

from observability import spend_alert
from tests.conftest import requires_db


# ── Threshold math (pure) ─────────────────────────────────────────────────────

def test_evaluate_burn_over_limit():
    tripped, burn, remaining = spend_alert.evaluate_thresholds(100.0, 200.0, 88.0, 10.0, 20.0)
    assert burn == pytest.approx(12.0)
    assert any("burn" in t for t in tripped)
    assert remaining == pytest.approx(100.0)


def test_evaluate_burn_under_limit():
    tripped, burn, _ = spend_alert.evaluate_thresholds(100.0, 200.0, 95.0, 10.0, 20.0)
    assert burn == pytest.approx(5.0)
    assert tripped == []


def test_evaluate_credits_under_floor():
    tripped, _, remaining = spend_alert.evaluate_thresholds(190.0, 200.0, 189.0, 10.0, 20.0)
    assert remaining == pytest.approx(10.0)
    assert any("remaining" in t for t in tripped)


def test_evaluate_first_run_no_prior_no_burn_alert():
    tripped, burn, _ = spend_alert.evaluate_thresholds(100.0, 200.0, None, 10.0, 20.0)
    assert burn is None
    assert tripped == []  # remaining 100 > floor 20, and no burn baseline


def test_send_alert_unset_webhook_is_false():
    assert spend_alert.send_alert(None, {"text": "x"}) is False
    assert spend_alert.send_alert("", {"text": "x"}) is False


# ── fetch_credits (mocked httpx) ──────────────────────────────────────────────

def test_fetch_credits_success(monkeypatch):
    class Resp:
        status_code = 200
        def raise_for_status(self): pass
        def json(self): return {"data": {"total_usage": 12.5, "total_credits": 100.0}}

    class OkClient:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def get(self, *a, **k): return Resp()

    monkeypatch.setattr(spend_alert.httpx, "Client", OkClient)
    assert spend_alert.fetch_credits("k") == (12.5, 100.0)


def test_fetch_credits_retries_then_raises(monkeypatch):
    calls = {"n": 0}

    class BoomClient:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def get(self, *a, **k):
            calls["n"] += 1
            raise httpx.ConnectError("boom")

    monkeypatch.setattr(spend_alert, "_FETCH_BACKOFF", 0)
    monkeypatch.setattr(spend_alert.httpx, "Client", BoomClient)
    with pytest.raises(RuntimeError):
        spend_alert.fetch_credits("k")
    assert calls["n"] == spend_alert._FETCH_ATTEMPTS


# ── run_once (seeded DB) ──────────────────────────────────────────────────────

def _seed_prior(conn, hours_ago, usage, credits=1000.0):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO openrouter_usage_snapshots (taken_at, total_usage, total_credits) "
            "VALUES (now() - make_interval(hours => %s), %s, %s)",
            (hours_ago, usage, credits),
        )
    conn.commit()


@requires_db
def test_run_once_first_run_writes_snapshot_no_alert(conn, monkeypatch):
    monkeypatch.setattr(spend_alert, "fetch_credits", lambda k: (5.0, 1000.0))
    sent = []
    monkeypatch.setattr(spend_alert, "send_alert", lambda url, p: sent.append(p) or True)
    code = spend_alert.run_once(conn, api_key="k", webhook_url="http://x",
                                daily_limit=10.0, credits_floor=20.0)
    assert code == 0
    assert sent == []  # healthy
    with conn.cursor() as cur:
        cur.execute("SELECT count(*)::int AS n FROM openrouter_usage_snapshots")
        assert cur.fetchone()["n"] == 1


@requires_db
def test_run_once_burn_alert_delivered(conn, monkeypatch):
    _seed_prior(conn, hours_ago=1, usage=80.0)  # now 100 → burn 20 > 10
    monkeypatch.setattr(spend_alert, "fetch_credits", lambda k: (100.0, 1000.0))
    sent = []
    monkeypatch.setattr(spend_alert, "send_alert", lambda url, p: sent.append(p) or True)
    code = spend_alert.run_once(conn, api_key="k", webhook_url="http://x",
                                daily_limit=10.0, credits_floor=20.0)
    assert code == 0  # tripped but successfully alerted
    assert len(sent) == 1
    assert "burn" in sent[0]["text"]
    assert sent[0]["burn_24h_usd"] == pytest.approx(20.0)


@requires_db
def test_run_once_credits_floor_alert(conn, monkeypatch):
    monkeypatch.setattr(spend_alert, "fetch_credits", lambda k: (990.0, 1000.0))  # remaining 10
    sent = []
    monkeypatch.setattr(spend_alert, "send_alert", lambda url, p: sent.append(p) or True)
    code = spend_alert.run_once(conn, api_key="k", webhook_url="http://x",
                                daily_limit=1e9, credits_floor=20.0)
    assert code == 0
    assert any("remaining" in t for t in sent[0]["tripped"])


@requires_db
def test_run_once_alert_delivery_failure_exits_nonzero(conn, monkeypatch):
    _seed_prior(conn, hours_ago=1, usage=80.0)
    monkeypatch.setattr(spend_alert, "fetch_credits", lambda k: (100.0, 1000.0))
    monkeypatch.setattr(spend_alert, "send_alert", lambda url, p: False)  # delivery fails / unset
    code = spend_alert.run_once(conn, api_key="k", webhook_url=None,
                                daily_limit=10.0, credits_floor=20.0)
    assert code == 1  # tripped but couldn't tell anyone


@requires_db
def test_run_once_fetch_failure_writes_no_snapshot(conn, monkeypatch):
    def boom(_k):
        raise RuntimeError("openrouter down")
    monkeypatch.setattr(spend_alert, "fetch_credits", boom)
    with pytest.raises(RuntimeError):
        spend_alert.run_once(conn, api_key="k", webhook_url="http://x",
                             daily_limit=10.0, credits_floor=20.0)
    conn.rollback()
    with conn.cursor() as cur:
        cur.execute("SELECT count(*)::int AS n FROM openrouter_usage_snapshots")
        assert cur.fetchone()["n"] == 0
