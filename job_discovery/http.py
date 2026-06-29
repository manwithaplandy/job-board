import time
from typing import Any

import httpx

DEFAULT_TIMEOUT = 10.0
_HEADERS = {"User-Agent": "job-board/0.1"}


def get_json(
    url: str,
    *,
    retries: int = 2,
    backoff: float = 0.5,
    timeout: float = DEFAULT_TIMEOUT,
) -> Any:
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            resp = httpx.get(url, timeout=timeout, headers=_HEADERS)
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            last_exc = exc
            if attempt < retries:
                time.sleep(backoff * (2**attempt))
    assert last_exc is not None
    raise last_exc
