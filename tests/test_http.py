import httpx
import pytest

import job_discovery.http as http_mod
from job_discovery.http import get_json


class _Resp:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("boom", request=None, response=None)

    def json(self):
        return self._payload


def test_returns_json_on_success(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda url, **kw: _Resp({"ok": True}))
    assert get_json("https://x") == {"ok": True}


def test_retries_then_succeeds(monkeypatch):
    calls = {"n": 0}

    def flaky(url, **kw):
        calls["n"] += 1
        if calls["n"] < 3:
            raise httpx.ConnectError("down")
        return _Resp({"ok": True})

    monkeypatch.setattr(httpx, "get", flaky)
    monkeypatch.setattr(http_mod.time, "sleep", lambda *_: None)
    assert get_json("https://x", retries=2, backoff=0.01) == {"ok": True}
    assert calls["n"] == 3


def test_raises_after_exhausting_retries(monkeypatch):
    def always_fail(url, **kw):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx, "get", always_fail)
    monkeypatch.setattr(http_mod.time, "sleep", lambda *_: None)
    with pytest.raises(httpx.HTTPError):
        get_json("https://x", retries=2, backoff=0.01)
