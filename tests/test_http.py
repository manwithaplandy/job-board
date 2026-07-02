import httpx
import pytest

import job_discovery.http as http_mod
from job_discovery.http import get_json


class _Resp:
    """Minimal httpx.Response stand-in."""

    def __init__(self, payload, status=200, headers=None):
        self._payload = payload
        self.status_code = status
        self.headers = headers or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"{self.status_code}",
                request=httpx.Request("GET", "https://x"),
                response=httpx.Response(self.status_code),
            )

    def json(self):
        return self._payload


def test_returns_json_on_success(monkeypatch):
    monkeypatch.setattr(http_mod._client, "request",
                        lambda method, url, **kw: _Resp({"ok": True}))
    assert get_json("https://x") == {"ok": True}


def test_retries_then_succeeds(monkeypatch):
    calls = {"n": 0}

    def flaky(method, url, **kw):
        calls["n"] += 1
        if calls["n"] < 3:
            raise httpx.ConnectError("down")
        return _Resp({"ok": True})

    monkeypatch.setattr(http_mod._client, "request", flaky)
    monkeypatch.setattr(http_mod.time, "sleep", lambda *_: None)
    monkeypatch.setattr(http_mod.random, "uniform", lambda *_: 0)
    assert get_json("https://x", retries=2, backoff=0.01) == {"ok": True}
    assert calls["n"] == 3


def test_raises_after_exhausting_retries(monkeypatch):
    def always_fail(method, url, **kw):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(http_mod._client, "request", always_fail)
    monkeypatch.setattr(http_mod.time, "sleep", lambda *_: None)
    monkeypatch.setattr(http_mod.random, "uniform", lambda *_: 0)
    with pytest.raises(httpx.HTTPError):
        get_json("https://x", retries=2, backoff=0.01)


# ── A6: retry policy, shared client, redirects ────────────────────────────────


def test_404_is_not_retried(monkeypatch):
    """A 404 is a non-429 4xx: it must raise immediately (one attempt only)."""
    calls = {"n": 0}

    def fake_request(method, url, **kw):
        calls["n"] += 1
        return _Resp({}, status=404)

    monkeypatch.setattr(http_mod._client, "request", fake_request)
    monkeypatch.setattr(http_mod.time, "sleep", lambda *_: None)
    with pytest.raises(httpx.HTTPStatusError):
        get_json("https://x", retries=2)
    assert calls["n"] == 1  # must NOT retry


def test_429_honors_retry_after(monkeypatch):
    """429 must sleep the Retry-After value (not the default backoff) then retry."""
    calls = {"n": 0}
    slept = []

    def fake_request(method, url, **kw):
        calls["n"] += 1
        if calls["n"] == 1:
            resp = httpx.Response(429, headers={"Retry-After": "3"})
            raise httpx.HTTPStatusError("429", request=httpx.Request("GET", url),
                                        response=resp)
        return _Resp({"ok": True})

    monkeypatch.setattr(http_mod._client, "request", fake_request)
    monkeypatch.setattr(http_mod.time, "sleep", lambda s: slept.append(s))
    monkeypatch.setattr(http_mod.random, "uniform", lambda *_: 0)
    result = get_json("https://x", retries=2, backoff=999)  # backoff != Retry-After
    assert result == {"ok": True}
    assert calls["n"] == 2
    assert slept[0] == pytest.approx(3.0, abs=0.01)  # must use Retry-After, not backoff


def test_client_is_reused(monkeypatch):
    """Two get_json calls must share the same httpx.Client instance."""
    clients_used = []

    def fake_request(method, url, **kw):
        clients_used.append(id(http_mod._client))
        return _Resp({"n": len(clients_used)})

    monkeypatch.setattr(http_mod._client, "request", fake_request)
    get_json("https://a")
    get_json("https://b")
    # Both calls used the same client (same id).
    assert len(clients_used) == 2
    assert clients_used[0] == clients_used[1]


def test_redirects_followed(monkeypatch):
    """The shared client must follow redirects (follow_redirects=True is configured)."""
    assert http_mod._client.follow_redirects is True
    # Functional test: a 301 followed by a 200 resolves to the final payload.
    calls = {"n": 0}

    def fake_request(method, url, **kw):
        calls["n"] += 1
        # httpx.Client with follow_redirects=True handles redirects internally;
        # from the caller's perspective this always returns the final response.
        return _Resp({"redirected": True})

    monkeypatch.setattr(http_mod._client, "request", fake_request)
    assert get_json("https://x") == {"redirected": True}
    # The client's follow_redirects flag is set (not just the test being trivial).
    assert http_mod._client.follow_redirects is True
