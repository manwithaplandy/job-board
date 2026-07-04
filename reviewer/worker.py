"""On-demand review worker (spec F core).

Consumes the review_requests queue near-real-time so a user who clicks "review my
board now" (or a brand-new account after onboarding) sees results within minutes
instead of at the next cron. It reuses run._review_user, so every budget / location /
model-entitlement bound (T8) comes for free — there is ZERO duplicated gating logic
here; the worker only drives the queue and the per-user profile load.

Run as: `python -m reviewer.worker`. Always-on (no cron); Railway service config in
railway.reviewer-worker.json. Backend job → keeps the service role (direct connection).
"""
import logging
import signal
import time

from job_discovery import db as jdb
from reviewer import config, db, run

log = logging.getLogger("reviewer.worker")

# 'running' requests older than this are presumed orphaned by a crashed worker and
# failed so the user's single active slot is freed.
STALE_MINUTES = 30


class _Stop:
    """Cooperative shutdown flag set by SIGTERM/SIGINT so the loop exits cleanly
    AFTER the in-flight request finishes (never mid-review)."""

    def __init__(self) -> None:
        self.stop = False

    def request(self, *_a) -> None:
        log.info("shutdown signal received; finishing in-flight work then exiting")
        self.stop = True


def process_one(conn) -> bool:
    """Recover stale claims, then claim + process one pending request. Returns True if
    a request was handled (caller should poll again immediately), False if the queue
    was empty (caller should sleep). Per-request isolation: any failure is recorded on
    the request row and never propagates out of this function."""
    recovered = db.recover_stale_review_requests(conn, STALE_MINUTES)
    if recovered:
        log.warning("recovered %s stale 'running' request(s)", recovered)
    conn.commit()

    claimed = db.claim_next_review_request(conn)
    conn.commit()
    if not claimed:
        return False

    req_id = claimed["id"]
    user_id = str(claimed["user_id"])
    log.info("processing review request %s for user %s", req_id, user_id)
    try:
        profile = db.load_profile(conn, user_id)
        if profile is None:
            db.finish_review_request(conn, req_id, "failed", notes="profile not found")
            conn.commit()
            return True
        # _review_user manages its own review_runs row + commits (incl. the cap/skip
        # notes). It catches per-user errors internally, so this mostly closes 'done'.
        run._review_user(conn, profile)
        db.finish_review_request(conn, req_id, "done")
        conn.commit()
    except Exception as exc:  # belt-and-braces: never let one request kill the loop
        try:
            conn.rollback()
        except Exception:
            pass
        db.finish_review_request(conn, req_id, "failed", notes=f"{type(exc).__name__}: {exc}"[:500])
        conn.commit()
        log.exception("review request %s failed", req_id)
    return True


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    if not config.has_api_key():
        log.warning("OPENROUTER_API_KEY not set; requests will fail until it is configured")

    stop = _Stop()
    signal.signal(signal.SIGTERM, stop.request)
    signal.signal(signal.SIGINT, stop.request)

    poll = config.REVIEW_WORKER_POLL_SECONDS
    conn = jdb.connect()
    log.info("review worker started (poll=%ss, stale=%smin)", poll, STALE_MINUTES)
    try:
        while not stop.stop:
            try:
                handled = process_one(conn)
            except Exception:
                # A failure in claim/recover itself (e.g. a dropped connection) must
                # not kill the loop.
                log.exception("worker cycle error")
                handled = False
            if not handled:
                # Idle: sleep in 1s slices so SIGTERM is honored promptly.
                for _ in range(poll):
                    if stop.stop:
                        break
                    time.sleep(1)
    finally:
        conn.close()
        log.info("review worker stopped")


if __name__ == "__main__":
    main()
