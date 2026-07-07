import random
import time
from typing import Any

import httpx

DEFAULT_TIMEOUT = 10.0
_TIMEOUT = DEFAULT_TIMEOUT
_HEADERS = {"User-Agent": "job-board/0.1"}

# Default retry count (number of re-attempts after the first failure); total
# attempts = _ATTEMPTS = retries + 1. Backoff table: one entry per inter-attempt
# sleep before the last attempt; length == retries.
_DEFAULT_RETRIES = 2
_DEFAULT_BACKOFF = 0.5

# Shared client: connection pool is reused across all requests in one process.
# Avoids the per-call TCP handshake overhead of the previous httpx.get() calls.
# follow_redirects=True handles 301/302 transparently.
_client = httpx.Client(timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True)


def _sleep_backoff(attempt: int, backoff: float) -> None:
    """Exponential back-off with a small random jitter (avoids thundering herd)."""
    time.sleep(backoff * (2 ** attempt) + random.uniform(0, 0.25))


def _request(
    method: str,
    url: str,
    *,
    retries: int = _DEFAULT_RETRIES,
    backoff: float = _DEFAULT_BACKOFF,
    parse=None,
    **kw: Any,
) -> Any:
    """Send an HTTP request with retry/back-off, using the shared client.

    Retry policy:
      - 429 (rate-limited): respect the Retry-After header, then retry.
      - 5xx (server error): exponential back-off + jitter, then retry.
      - Non-429 4xx (client error): retrying cannot help; raise immediately.
      - Network errors / JSON decode errors: exponential back-off + jitter.
    """
    attempts = retries + 1
    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            resp = _client.request(method, url, **kw)
            resp.raise_for_status()
            return parse(resp) if parse is not None else resp.json()
        except httpx.HTTPStatusError as e:
            last_exc = e
            code = e.response.status_code
            if code == 429 and attempt < attempts - 1:
                delay = float(e.response.headers.get("Retry-After") or
                              backoff * (2 ** attempt))
                time.sleep(delay + random.uniform(0, 0.25))
                continue
            if 400 <= code < 500:
                raise  # non-429 4xx: retrying cannot help
            if attempt < attempts - 1:
                _sleep_backoff(attempt, backoff)  # 5xx: back off and retry
        except (httpx.HTTPError, ValueError) as e:
            last_exc = e
            if attempt < attempts - 1:
                _sleep_backoff(attempt, backoff)
    assert last_exc is not None
    raise last_exc


def get_json(
    url: str,
    *,
    retries: int = _DEFAULT_RETRIES,
    backoff: float = _DEFAULT_BACKOFF,
    timeout: float = _TIMEOUT,
) -> Any:
    return _request("GET", url, retries=retries, backoff=backoff, timeout=timeout)


def get_text(
    url: str,
    *,
    retries: int = _DEFAULT_RETRIES,
    backoff: float = _DEFAULT_BACKOFF,
    timeout: float = _TIMEOUT,
) -> str:
    """GET a page and return its body text. Same retry/backoff contract as
    get_json — used for ATS board HTML pages that carry the company name in
    <title> (lever/ashby expose no JSON org-name endpoint)."""
    return _request("GET", url, retries=retries, backoff=backoff, timeout=timeout,
                    parse=lambda r: r.text)


def post_json(
    url: str,
    *,
    json: Any = None,
    retries: int = _DEFAULT_RETRIES,
    backoff: float = _DEFAULT_BACKOFF,
    timeout: float = _TIMEOUT,
) -> Any:
    """POST a JSON body and return the decoded JSON response. Same retry/backoff
    contract as get_json — used by ATSes whose listing endpoint is a POST search
    (e.g. Workday's cxs `/jobs`)."""
    return _request("POST", url, json=json, retries=retries, backoff=backoff,
                    timeout=timeout)
