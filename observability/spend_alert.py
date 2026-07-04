"""OpenRouter spend-alert backstop (spec D/G).

A Railway cron (`python -m observability.spend_alert`) that records OpenRouter's
usage/credits, computes the trailing-24h burn from prior snapshots, and alerts the
operator when either (a) the 24h burn exceeds SPEND_ALERT_DAILY_USD or (b) remaining
credits fall below SPEND_ALERT_CREDITS_FLOOR_USD. This is the safety net BEHIND the
per-user daily review caps: a cap bug or a cost-capture gap should page us before the
credit balance does. It complements — does not replace — the OutOfCreditsError hard
halt in observability/llm.py.

Alert channel: an HTTP POST to ALERT_WEBHOOK_URL (Slack/Discord-compatible JSON). If the
webhook is unset OR the POST fails WHILE a threshold is tripped, we log at ERROR and exit
NONZERO so the Railway cron surfaces the failure — never a silent pass.
"""
import logging
import os
import sys
import time

import httpx
import psycopg
from psycopg.rows import dict_row

log = logging.getLogger("spend_alert")

_CREDITS_URL = "https://openrouter.ai/api/v1/credits"
_FETCH_ATTEMPTS = 3
_FETCH_TIMEOUT = 5.0   # seconds, per request
_FETCH_BACKOFF = 1.0   # seconds between attempts

DEFAULT_DAILY_USD = 10.0
DEFAULT_CREDITS_FLOOR_USD = 20.0


def _float_env(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return float(raw)


def fetch_credits(api_key: str) -> tuple[float, float | None]:
    """Return (total_usage, total_credits) from OpenRouter's credits endpoint.

    Bounded timeout + retries (mirrors observability.llm._confirm_generation_cost).
    total_credits may be None if the account has no credit ceiling. Raises RuntimeError
    if every attempt fails or the payload lacks total_usage — the caller must NOT write a
    snapshot on failure (no corruption from a bad read).
    """
    headers = {"Authorization": f"Bearer {api_key}"}
    last_exc: Exception | None = None
    for attempt in range(_FETCH_ATTEMPTS):
        try:
            with httpx.Client(timeout=_FETCH_TIMEOUT) as http:
                resp = http.get(_CREDITS_URL, headers=headers)
            resp.raise_for_status()
            data = (resp.json() or {}).get("data") or {}
            total_usage = data.get("total_usage")
            total_credits = data.get("total_credits")
            if total_usage is None:
                raise ValueError("OpenRouter credits payload missing total_usage")
            return (
                float(total_usage),
                float(total_credits) if total_credits is not None else None,
            )
        except Exception as exc:  # network / HTTP / parse — retry, then give up
            last_exc = exc
            log.debug("credits fetch attempt %s failed: %s", attempt + 1, exc)
            if attempt + 1 < _FETCH_ATTEMPTS:
                time.sleep(_FETCH_BACKOFF)
    raise RuntimeError(f"OpenRouter credits fetch failed after {_FETCH_ATTEMPTS} attempts: {last_exc}")


def insert_snapshot(conn, total_usage: float, total_credits: float | None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO openrouter_usage_snapshots (total_usage, total_credits) VALUES (%s, %s)",
            (total_usage, total_credits),
        )


def oldest_usage_within_24h(conn) -> float | None:
    """total_usage of the OLDEST snapshot in the trailing 24h (the burn baseline).

    Called AFTER inserting the current snapshot: if a prior snapshot exists in the
    window it is the baseline; if none does (first run) the just-inserted row is the
    oldest, so burn computes to 0 and no burn alert fires — the snapshot is still written.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT total_usage FROM openrouter_usage_snapshots "
            "WHERE taken_at >= now() - interval '24 hours' "
            "ORDER BY taken_at ASC LIMIT 1"
        )
        row = cur.fetchone()
    return float(row["total_usage"]) if row and row["total_usage"] is not None else None


def evaluate_thresholds(
    total_usage: float,
    total_credits: float | None,
    prior_usage: float | None,
    daily_limit: float,
    credits_floor: float,
) -> tuple[list[str], float | None, float | None]:
    """Return (tripped_reasons, burn_24h, remaining_credits). Empty reasons = healthy."""
    tripped: list[str] = []
    burn: float | None = None
    if prior_usage is not None:
        burn = total_usage - prior_usage
        if burn > daily_limit:
            tripped.append(f"24h burn ${burn:.2f} exceeds ${daily_limit:.2f}")
    remaining: float | None = None
    if total_credits is not None:
        remaining = total_credits - total_usage
        if remaining < credits_floor:
            tripped.append(f"remaining credits ${remaining:.2f} below ${credits_floor:.2f}")
    return tripped, burn, remaining


def send_alert(webhook_url: str | None, payload: dict) -> bool:
    """POST the alert payload. Returns True on a 2xx, False when the webhook is unset or
    the POST fails (both are alert-DELIVERY failures the caller treats as nonzero exit)."""
    if not webhook_url:
        return False
    try:
        with httpx.Client(timeout=_FETCH_TIMEOUT) as http:
            resp = http.post(webhook_url, json=payload)
        return 200 <= resp.status_code < 300
    except Exception as exc:
        log.debug("alert webhook POST failed: %s", exc)
        return False


def run_once(conn, *, api_key: str, webhook_url: str | None,
             daily_limit: float, credits_floor: float) -> int:
    """One cycle. Returns the process exit code (0 healthy or tripped+alerted; 1 when a
    tripped threshold could not be delivered). fetch_credits raising propagates to main."""
    total_usage, total_credits = fetch_credits(api_key)
    insert_snapshot(conn, total_usage, total_credits)
    conn.commit()

    prior = oldest_usage_within_24h(conn)
    tripped, burn, remaining = evaluate_thresholds(
        total_usage, total_credits, prior, daily_limit, credits_floor,
    )
    if not tripped:
        log.info("spend healthy: usage=%.4f credits=%s burn=%s remaining=%s",
                 total_usage, total_credits, burn, remaining)
        return 0

    payload = {
        "text": (
            "⚠️ OpenRouter spend alert: " + "; ".join(tripped)
            + f" | usage ${total_usage:.2f}"
            + (f", remaining ${remaining:.2f}" if remaining is not None else "")
            + (f", 24h burn ${burn:.2f}" if burn is not None else "")
        ),
        "burn_24h_usd": burn,
        "remaining_credits_usd": remaining,
        "tripped": tripped,
    }
    if not send_alert(webhook_url, payload):
        # Tripped but we couldn't tell anyone — the LOUDEST failure mode. Exit nonzero.
        log.error("SPEND THRESHOLD TRIPPED but alert delivery failed (webhook unset or POST failed): %s",
                  tripped)
        return 1
    log.error("spend alert delivered: %s", tripped)
    return 0


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        log.error("OPENROUTER_API_KEY not set; cannot check spend")
        sys.exit(1)
    daily_limit = _float_env("SPEND_ALERT_DAILY_USD", DEFAULT_DAILY_USD)
    credits_floor = _float_env("SPEND_ALERT_CREDITS_FLOOR_USD", DEFAULT_CREDITS_FLOOR_USD)
    webhook_url = os.environ.get("ALERT_WEBHOOK_URL")

    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        log.error("DATABASE_URL not set")
        sys.exit(1)
    conn = psycopg.connect(dsn, row_factory=dict_row, connect_timeout=10)
    try:
        code = run_once(conn, api_key=api_key, webhook_url=webhook_url,
                        daily_limit=daily_limit, credits_floor=credits_floor)
    except Exception:
        # NOT "(no snapshot written)": run_once inserts+commits the snapshot BEFORE it
        # evaluates thresholds, so a failure AFTER that commit (e.g. in the differencing
        # read) leaves a snapshot written. Only a fetch_credits failure writes none — the
        # generic message is accurate in both cases.
        log.exception("spend alert run failed")
        code = 1
    finally:
        conn.close()
    sys.exit(code)


if __name__ == "__main__":
    main()
