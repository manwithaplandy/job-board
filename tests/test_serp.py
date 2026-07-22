import pytest

import company_discovery.serp as serp
from tests.conftest import requires_db


@pytest.fixture(autouse=True)
def _reset_serp_throttle():
    """Reset the module-level throttle clock so each single-fetch test starts
    fresh — otherwise the leftover timestamp from a prior test could make the
    next fetch block on a real time.sleep."""
    serp._last_call = 0.0
    yield
    serp._last_call = 0.0


class _FakeResponse:
    def __init__(self, payload, raise_status=False):
        self._payload = payload
        self._raise_status = raise_status

    def raise_for_status(self):
        if self._raise_status:
            raise RuntimeError("HTTP 500")

    def json(self):
        return self._payload


def _fake_post_factory(payload=None, raise_status=False, capture=None):
    def _post(url, json=None, headers=None, timeout=None):
        if capture is not None:
            capture["url"] = url
            capture["json"] = json
            capture["headers"] = headers
            capture["timeout"] = timeout
        return _FakeResponse(payload or {}, raise_status)

    return _post


def test_serp_available_reflects_env(monkeypatch):
    monkeypatch.delenv("SERPER_API_KEY", raising=False)
    assert serp.serp_available() is False
    monkeypatch.setenv("SERPER_API_KEY", "k")
    assert serp.serp_available() is True


def test_fetch_company_snippets_query_shape(monkeypatch):
    monkeypatch.setenv("SERPER_API_KEY", "secret-key")
    capture = {}
    payload = {"organic": [{"title": "Acme Inc", "snippet": "Makes anvils"}]}
    monkeypatch.setattr(
        serp.requests, "post", _fake_post_factory(payload, capture=capture)
    )
    out = serp.fetch_company_snippets("Acme", "greenhouse")
    assert capture["url"] == "https://google.serper.dev/search"
    assert capture["json"] == {"q": "Acme company", "num": 5}
    assert capture["headers"]["X-API-KEY"] == "secret-key"
    assert capture["headers"]["Content-Type"] == "application/json"
    assert capture["timeout"] == 10
    assert out == "Acme Inc — Makes anvils"


def test_fetch_company_snippets_formats_top_five(monkeypatch):
    monkeypatch.setenv("SERPER_API_KEY", "k")
    payload = {"organic": [{"title": f"T{i}", "snippet": f"S{i}"} for i in range(7)]}
    monkeypatch.setattr(serp.requests, "post", _fake_post_factory(payload))
    out = serp.fetch_company_snippets("Foo", "lever")
    lines = out.split("\n")
    assert len(lines) == 5
    assert lines[0] == "T0 — S0"
    assert lines[4] == "T4 — S4"


def test_fetch_company_snippets_skips_empty_and_strips(monkeypatch):
    monkeypatch.setenv("SERPER_API_KEY", "k")
    payload = {
        "organic": [
            {"title": "OnlyTitle", "snippet": ""},
            {"title": "", "snippet": "OnlySnippet"},
            {"title": "", "snippet": ""},
            {"foo": "bar"},
        ]
    }
    monkeypatch.setattr(serp.requests, "post", _fake_post_factory(payload))
    out = serp.fetch_company_snippets("Foo", "lever")
    assert out.split("\n") == ["OnlyTitle", "OnlySnippet"]


def test_fetch_company_snippets_skips_non_dict_organic_entries(monkeypatch):
    # A malformed provider payload with a null (non-dict) organic entry must be
    # skipped best-effort, never propagate an AttributeError to the caller.
    monkeypatch.setenv("SERPER_API_KEY", "k")
    monkeypatch.setattr(serp.requests, "post", _fake_post_factory({"organic": [None]}))
    assert serp.fetch_company_snippets("Foo", "lever") is None


def test_fetch_company_snippets_coerces_null_title(monkeypatch):
    # An explicit JSON null title must not emit a literal "None — " prefix; the
    # snippet alone should survive.
    monkeypatch.setenv("SERPER_API_KEY", "k")
    payload = {"organic": [{"title": None, "snippet": "Snip"}]}
    monkeypatch.setattr(serp.requests, "post", _fake_post_factory(payload))
    assert serp.fetch_company_snippets("Foo", "lever") == "Snip"


def test_fetch_company_snippets_none_on_http_error(monkeypatch):
    monkeypatch.setenv("SERPER_API_KEY", "k")
    monkeypatch.setattr(
        serp.requests, "post", _fake_post_factory({}, raise_status=True)
    )
    assert serp.fetch_company_snippets("Foo", "lever") is None


def test_fetch_company_snippets_none_without_key(monkeypatch):
    monkeypatch.delenv("SERPER_API_KEY", raising=False)

    def _boom(*a, **k):
        raise AssertionError("requests.post must not be called without a key")

    monkeypatch.setattr(serp.requests, "post", _boom)
    assert serp.fetch_company_snippets("Foo", "lever") is None


def test_fetch_company_snippets_empty_organic_returns_none(monkeypatch):
    monkeypatch.setenv("SERPER_API_KEY", "k")
    monkeypatch.setattr(serp.requests, "post", _fake_post_factory({"organic": []}))
    assert serp.fetch_company_snippets("Foo", "lever") is None


def test_fetch_company_snippets_throttles_back_to_back_calls(monkeypatch):
    monkeypatch.setenv("SERPER_API_KEY", "k")
    monkeypatch.setattr(serp.requests, "post", _fake_post_factory({"organic": []}))
    monkeypatch.setattr(serp, "_MIN_INTERVAL", 0.5)
    serp._last_call = 0.0

    # Fixed monotonic clock: two _throttle() calls consume two reads each, and a
    # steady 100.0 makes the first call's wait negative (no sleep) and the
    # second call's wait exactly _MIN_INTERVAL (the previous stamp was 100.0).
    monkeypatch.setattr(serp.time, "monotonic", lambda: 100.0)

    sleeps = []
    monkeypatch.setattr(serp.time, "sleep", lambda s: sleeps.append(s))

    serp.fetch_company_snippets("Foo", "lever")
    assert sleeps == []  # first call never blocks

    serp.fetch_company_snippets("Bar", "lever")
    assert len(sleeps) == 1
    assert sleeps[0] == pytest.approx(0.5)


@requires_db
def test_persist_web_description_writes_columns(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token) "
            "VALUES ('Acme','lever','acme') RETURNING id"
        )
        cid = cur.fetchone()["id"]
    conn.commit()

    serp.persist_web_description(conn, cid, "About Acme from the web")
    conn.commit()

    with conn.cursor() as cur:
        cur.execute(
            "SELECT web_description, web_searched_at, about_source "
            "FROM companies WHERE id = %s",
            (cid,),
        )
        row = cur.fetchone()
    assert row["web_description"] == "About Acme from the web"
    assert row["web_searched_at"] is not None
    assert row["about_source"] == "serp"


@requires_db
def test_persist_web_description_preserves_existing_about_source(conn):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, about_source) "
            "VALUES ('Acme','lever','acme','ats_board') RETURNING id"
        )
        cid = cur.fetchone()["id"]
    conn.commit()

    serp.persist_web_description(conn, cid, "web text")
    conn.commit()

    with conn.cursor() as cur:
        cur.execute(
            "SELECT about_source, web_description FROM companies WHERE id = %s",
            (cid,),
        )
        row = cur.fetchone()
    assert row["about_source"] == "ats_board"
    assert row["web_description"] == "web text"
