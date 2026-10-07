"""Bounded public read transport. No ambient proxy, credentials or cookie jar.

A disposable subprocess owns DNS, socket, headers, decompression and JSON parsing.
Its parent deadline can terminate even a stuck resolver. Each hop connects to the
validated numeric address while TLS checks the original hostname.
"""

import pickle
import http.client
import ipaddress
import json
import re
import socket
import ssl
import subprocess
import sys
import time
import zlib
from urllib.parse import urljoin, urlsplit, urlunsplit

MAX_BYTES = 10 * 1024 * 1024
MAX_SECONDS = 20.0
MAX_REDIRECTS = 3


def public_address(host, port):
    addresses = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    if not addresses:
        raise ValueError("public host has no addresses")
    for _, _, _, _, address in addresses:
        ip = ipaddress.ip_address(address[0])
        if not ip.is_global or ip.is_multicast:
            raise ValueError("public fetch requires globally routable addresses")
    return addresses[0][4][0]


def clean_url(url):
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or len(url) > 4096:
        raise ValueError("invalid public URL")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if port not in {80, 443}:
        raise ValueError("public URL port is unsupported")
    host = parsed.hostname.encode("idna").decode("ascii")
    authority = f"[{host}]" if ":" in host else host
    if parsed.port:
        authority += f":{port}"
    return (
        urlunsplit((parsed.scheme, authority, parsed.path or "/", parsed.query, "")),
        host,
        port,
    )


class PinnedConnection(http.client.HTTPConnection):
    def __init__(self, host, port, address, secure, timeout):
        super().__init__(host, port, timeout=timeout)
        self.address, self.secure = address, secure

    def connect(self):
        # Numeric address avoids a second hostname lookup / DNS rebinding window.
        family = socket.AF_INET6 if ":" in self.address else socket.AF_INET
        sock = socket.socket(family, socket.SOCK_STREAM)
        try:
            sock.settimeout(self.timeout)
            sock.connect((self.address, self.port))
            peer = ipaddress.ip_address(sock.getpeername()[0])
            if (
                str(peer) != str(ipaddress.ip_address(self.address))
                or not peer.is_global
            ):
                raise ValueError("public peer address changed")
            self.sock = (
                ssl.create_default_context().wrap_socket(
                    sock, server_hostname=self.host
                )
                if self.secure
                else sock
            )
        except BaseException:
            sock.close()
            raise


def fetch_local(
    method,
    url,
    payload,
    seconds,
    parse_json=True,
    *,
    resolve=public_address,
    connection=PinnedConnection,
):
    deadline = time.monotonic() + min(seconds, MAX_SECONDS)

    def remaining():
        value = deadline - time.monotonic()
        if value <= 0:
            raise TimeoutError("public fetch deadline exceeded")
        return value

    if method not in {"GET", "POST"}:
        raise ValueError("public transport supports readonly requests only")
    body = None if payload is None else json.dumps(payload, allow_nan=False).encode()
    if body is not None and len(body) > 65536:
        raise ValueError("readonly search body exceeds limit")
    for hop in range(MAX_REDIRECTS + 1):
        url, host, port = clean_url(url)
        # POST is exclusively Workday's documented public readonly search.
        path = urlsplit(url).path
        if method == "POST" and (
            not re.fullmatch(r"[a-zA-Z0-9_-]+\.wd[0-9]+\.myworkdayjobs\.com", host)
            or not re.fullmatch(r"/wday/cxs/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/jobs", path)
        ):
            raise ValueError("POST is not an approved readonly search")
        if method == "POST" and (
            not isinstance(payload, dict)
            or set(payload) - {"appliedFacets", "limit", "offset", "searchText"}
        ):
            raise ValueError("invalid readonly search parameters")
        address = resolve(host, port)
        conn = connection(host, port, address, url.startswith("https:"), remaining())
        try:
            headers = {
                "User-Agent": "job-board/0.1",
                "Accept-Encoding": "gzip, deflate",
                "Accept": "application/json, text/html, text/plain",
            }
            if body is not None:
                headers["Content-Type"] = "application/json"
            parts = urlsplit(url)
            conn.request(
                method,
                parts.path + ("?" + parts.query if parts.query else ""),
                body=body,
                headers=headers,
            )
            response = conn.getresponse()
            remaining()
            if response.status in {301, 302, 303, 307, 308}:
                if hop == MAX_REDIRECTS:
                    raise ValueError("public redirect limit exceeded")
                location = response.getheader("Location")
                if not location:
                    raise ValueError("redirect missing location")
                if method == "POST":
                    # Never forward search data to a redirected endpoint.
                    raise ValueError("readonly POST redirects are unsupported")
                url = urljoin(url, location)
                continue
            if response.status >= 400:
                return {
                    "status": response.status,
                    "headers": {"retry-after": response.getheader("Retry-After") or ""},
                    "body": b"",
                    "parsed": None,
                    "parse_json": parse_json,
                }
            media = (
                (response.getheader("Content-Type") or "").split(";")[0].strip().lower()
            )
            if (
                media
                and media
                not in {"application/json", "text/json", "text/html", "text/plain"}
                and not media.endswith("+json")
            ):
                raise ValueError("unsupported public response media type")
            encoding = (response.getheader("Content-Encoding") or "identity").lower()
            if encoding not in {"identity", "gzip", "deflate"}:
                raise ValueError("unsupported public content encoding")
            decoder = (
                None
                if encoding == "identity"
                else zlib.decompressobj(31 if encoding == "gzip" else zlib.MAX_WBITS)
            )
            chunks, wire, expanded = [], 0, 0
            while True:
                if conn.sock is not None:
                    conn.sock.settimeout(remaining())
                chunk = response.read(65536)
                remaining()
                if not chunk:
                    break
                wire += len(chunk)
                if wire > MAX_BYTES:
                    raise ValueError("public wire body exceeds 10 MiB")
                chunk = (
                    decoder.decompress(chunk, MAX_BYTES - expanded + 1)
                    if decoder
                    else chunk
                )
                expanded += len(chunk)
                if expanded > MAX_BYTES or (decoder and decoder.unconsumed_tail):
                    raise ValueError("public expanded body exceeds 10 MiB")
                chunks.append(chunk)
            if decoder and (not decoder.eof or decoder.unused_data):
                raise ValueError("invalid or concatenated compressed body")
            data = b"".join(chunks)
            # Validate JSON within the subprocess's hard deadline as well.
            parsed = json.loads(data) if parse_json else None
            remaining()
            return {
                "status": response.status,
                "headers": {
                    "content-type": media,
                    "retry-after": response.getheader("Retry-After") or "",
                },
                "body": data,
                "parsed": parsed,
                "parse_json": parse_json,
            }
        finally:
            conn.close()
    raise ValueError("public redirect limit exceeded")


def request(method, url, *, timeout=20.0, json=None, parse_json=True):
    import httpx

    seconds = min(float(timeout), MAX_SECONDS)
    started = time.monotonic()
    try:
        result = subprocess.run(
            [sys.executable, "-m", "job_discovery.public_fetch"],
            input=__import__("json")
            .dumps(
                {
                    "method": method,
                    "url": url,
                    "payload": json,
                    "seconds": seconds,
                    "parse_json": parse_json,
                }
            )
            .encode(),
            capture_output=True,
            timeout=seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise httpx.TimeoutException("public fetch deadline exceeded") from exc
    if result.returncode:
        raise httpx.RequestError(
            "public fetch rejected or failed: "
            + result.stdout[:200].decode(errors="replace")
        )
    # Only our child serializes this envelope; network bytes are never unpickled.
    data = pickle.loads(result.stdout)
    body = data["body"]
    if time.monotonic() - started >= seconds:
        raise httpx.TimeoutException("public fetch deadline exceeded")
    return httpx.Response(
        data["status"],
        headers=data["headers"],
        content=body,
        request=httpx.Request(method, url),
        extensions={"public_json": data["parsed"]} if parse_json else {},
    )


if __name__ == "__main__":
    try:
        args = json.load(sys.stdin)
        sys.stdout.buffer.write(pickle.dumps(fetch_local(**args), protocol=5))
    except Exception as exc:
        print(type(exc).__name__ + ": " + str(exc)[:160])
        sys.exit(1)
