"""Offline normal bounded public-transport behavior, no live network."""

import gzip
import io
import subprocess

import httpx
import pytest

from job_discovery import public_fetch as p


class Response:
    def __init__(self, body=b"{}", status=200, headers=None):
        self.status = status
        self.headers = headers or {"Content-Type": "application/json"}
        self.body = io.BytesIO(body)

    def getheader(self, key):
        return self.headers.get(key)

    def read(self, size):
        return self.body.read(size)


def transport(responses):
    calls = []

    class Connection:
        sock = None

        def __init__(self, host, port, address, secure, timeout):
            calls.append({"host": host, "address": address, "timeout": timeout})

        def request(self, method, path, body=None, headers=None):
            calls[-1].update(method=method, path=path, headers=headers, body=body)

        def getresponse(self):
            return responses.pop(0)

        def close(self):
            pass

    return Connection, calls


def test_redirect_revalidates_and_strips_credentials():
    connection, calls = transport(
        [
            Response(
                status=302, headers={"Location": "https://user:secret@next.example/job"}
            ),
            Response(),
        ]
    )
    resolved = []

    def resolve(host, port):
        resolved.append(host)
        return "8.8.8.8"

    p.fetch_local(
        "GET",
        "https://user:secret@first.example/job",
        None,
        20,
        resolve=resolve,
        connection=connection,
    )
    assert resolved == ["first.example", "next.example"]
    assert all(call["address"] == "8.8.8.8" for call in calls)
    assert all(
        not {"Authorization", "Cookie", "Proxy-Authorization"} & call["headers"].keys()
        for call in calls
    )


def test_redirect_private_resolution_is_rejected(monkeypatch):
    def addresses(host, port, **_):
        return [
            (
                2,
                1,
                6,
                "",
                ("127.0.0.1" if host == "private.example" else "8.8.8.8", port),
            )
        ]

    monkeypatch.setattr(p.socket, "getaddrinfo", addresses)
    conn, calls = transport(
        [Response(status=302, headers={"Location": "http://private.example/x"})]
    )
    with pytest.raises(ValueError, match="globally routable"):
        p.fetch_local(
            "GET",
            "https://public.example/x",
            None,
            20,
            resolve=p.public_address,
            connection=conn,
        )
    assert len(calls) == 1


def test_redirect_limit_and_rebinding_validation(monkeypatch):
    conn, calls = transport(
        [Response(status=302, headers={"Location": "/again"}) for _ in range(4)]
    )
    with pytest.raises(ValueError, match="redirect limit"):
        p.fetch_local(
            "GET",
            "https://example.test/",
            None,
            20,
            resolve=lambda *_: "8.8.8.8",
            connection=conn,
        )
    assert len(calls) == 4
    answers = iter(["8.8.8.8", "127.0.0.1"])
    monkeypatch.setattr(
        p.socket,
        "getaddrinfo",
        lambda host, port, **_: [(2, 1, 6, "", (next(answers), port))],
    )
    conn, calls = transport([Response(status=302, headers={"Location": "/again"})])
    with pytest.raises(ValueError, match="globally routable"):
        p.fetch_local(
            "GET",
            "https://same.example/",
            None,
            20,
            resolve=p.public_address,
            connection=conn,
        )
    assert len(calls) == 1


@pytest.mark.parametrize(
    "body,headers",
    [
        (b"x" * (p.MAX_BYTES + 1), {"Content-Type": "text/plain"}),
        (
            gzip.compress(b"x" * (p.MAX_BYTES + 1)),
            {"Content-Type": "text/plain", "Content-Encoding": "gzip"},
        ),
        (b"{}", {"Content-Type": "application/octet-stream"}),
    ],
)
def test_body_and_type_limits(body, headers):
    conn, _ = transport([Response(body, headers=headers)])
    with pytest.raises(ValueError):
        p.fetch_local(
            "GET",
            "https://example.test/",
            None,
            20,
            resolve=lambda *_: "8.8.8.8",
            connection=conn,
        )


def test_hard_deadline_includes_resolver_and_parsing(monkeypatch):
    def timeout(*args, **kwargs):
        assert kwargs["timeout"] == 20
        raise subprocess.TimeoutExpired(args[0], 20)

    monkeypatch.setattr(p.subprocess, "run", timeout)
    with pytest.raises(httpx.TimeoutException):
        p.request("GET", "https://example.test", timeout=60)


def test_only_readonly_workday_search_post():
    conn, calls = transport([Response()])
    p.fetch_local(
        "POST",
        "https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/site/jobs",
        {"limit": 20},
        20,
        resolve=lambda *_: "8.8.8.8",
        connection=conn,
    )
    assert calls[0]["method"] == "POST"
    with pytest.raises(ValueError, match="approved readonly"):
        p.fetch_local(
            "POST",
            "https://apply.example/jobs",
            {},
            20,
            resolve=lambda *_: "8.8.8.8",
            connection=conn,
        )


def test_http_error_status_does_not_require_a_json_error_body():
    conn, _ = transport([Response(b"<html>not found</html>", status=404)])
    response = p.fetch_local(
        "GET",
        "https://example.test/",
        None,
        20,
        resolve=lambda *_: "8.8.8.8",
        connection=conn,
    )
    assert response["status"] == 404 and response["body"] == b""
