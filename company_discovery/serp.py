import logging
import os
import time

import requests

log = logging.getLogger(__name__)

_SERPER_URL = "https://google.serper.dev/search"
_TIMEOUT = 10
_MAX_SNIPPETS = 5
# Minimum seconds between SERP requests, enforced at the adapter so a provider
# swap stays safe. Brave's "Data for AI" plan (the licensing-clean alternative
# to Serper.dev) throttles at ~1-2 req/s, so the fetch loop self-limits
# regardless of provider. Override via SERP_MIN_INTERVAL_SECONDS.
_MIN_INTERVAL = float(os.environ.get("SERP_MIN_INTERVAL_SECONDS", "0.5"))
_last_call = 0.0


def serp_available() -> bool:
    return bool(os.environ.get("SERPER_API_KEY"))


def _throttle() -> None:
    """Block until at least _MIN_INTERVAL seconds have elapsed since the last request."""
    global _last_call
    wait = _MIN_INTERVAL - (time.monotonic() - _last_call)
    if wait > 0:
        time.sleep(wait)
    _last_call = time.monotonic()


def fetch_company_snippets(name: str, ats: str) -> str | None:
    """Top organic results for the company as 'title — snippet' lines, or None.
    Never raises: SERP grounding is best-effort; classification proceeds without it."""
    key = os.environ.get("SERPER_API_KEY")
    if not key:
        return None
    try:
        _throttle()
        resp = requests.post(
            _SERPER_URL,
            json={"q": f"{name} company", "num": _MAX_SNIPPETS},
            headers={"X-API-KEY": key, "Content-Type": "application/json"},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        organic = resp.json().get("organic", [])[:_MAX_SNIPPETS]
        lines = [
            f"{r.get('title') or ''} — {r.get('snippet') or ''}".strip(" —")
            for r in organic
            if isinstance(r, dict) and (r.get("title") or r.get("snippet"))
        ]
    except Exception:
        log.warning("serp fetch failed for %s (%s)", name, ats, exc_info=True)
        return None
    return "\n".join(lines) or None


def persist_web_description(conn, company_id: int, text: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE companies SET web_description = %s, web_searched_at = now(), "
            "about_source = COALESCE(about_source, 'serp') WHERE id = %s",
            (text, company_id),
        )
