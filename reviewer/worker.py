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
import sys
import threading
import time

from job_discovery import db as jdb
from reviewer import config, db, run

log = logging.getLogger("reviewer.worker")

# 'running' requests older than this are presumed orphaned by a crashed worker and
# failed so the user's single active slot is freed.
STALE_MINUTES = 30
DRAIN_SECONDS = 30

# In-flight registry: request ids THIS process is actively working right now, so a
# parallel sibling loop's recovery sweep (Task 3) never reaps a healthy long-running
# review it doesn't own. Module-global and shared across loops, so guard it with a lock.
_in_flight_lock = threading.Lock()
_in_flight_ids: set[int] = set()


def _mark_in_flight(req_id: int) -> None:
    with _in_flight_lock:
        _in_flight_ids.add(req_id)


def _clear_in_flight(req_id: int) -> None:
    with _in_flight_lock:
        _in_flight_ids.discard(req_id)  # discard: tolerate an already-cleared id


def _in_flight_snapshot() -> set[int]:
    """A copy of the current in-flight ids, taken under the lock, so the caller can
    iterate/pass it without racing concurrent mark/clear on another loop."""
    with _in_flight_lock:
        return set(_in_flight_ids)


class _Stop:
    """Request cooperative shutdown with a bounded in-flight drain window."""

    def __init__(self) -> None:
        self.stop = False
        self.deadline = None

    def request(self, *_a) -> None:
        log.info("shutdown signal received; draining in-flight work for at most 30 seconds")
        if self.deadline is None:
            self.deadline = time.monotonic() + DRAIN_SECONDS
        self.stop = True


def process_one(conn) -> bool:
    """Recover stale claims, then claim + process one pending request. Returns True if
    a request was handled (caller should poll again immediately), False if the queue
    was empty (caller should sleep). Per-request isolation: any failure is recorded on
    the request row and never propagates out of this function."""
    recovered = db.recover_stale_review_requests(
        conn, STALE_MINUTES, exclude_ids=_in_flight_snapshot()
    )
    if recovered:
        log.warning("recovered %s stale 'running' request(s)", recovered)
    conn.commit()

    claimed = db.claim_next_review_request(conn)
    conn.commit()
    if not claimed:
        return False

    req_id = claimed["id"]
    claim_version = claimed["claim_version"]
    user_id = str(claimed["user_id"])
    log.info("processing review request %s for user %s", req_id, user_id)
    # Mark before any processing so a sibling loop's recovery sweep can't reap this
    # just-claimed row. The tiny claim→mark gap is safe: claim wrote started_at=now(),
    # so the row is not stale for another STALE_MINUTES regardless.
    _mark_in_flight(req_id)
    try:
        profile = db.load_profile(conn, user_id)
        if profile is None:
            db.finish_review_request(conn, req_id, "failed", notes="profile not found", claim_version=claim_version)
            conn.commit()
            return True
        # _review_user manages its own review_runs row + commits (incl. the cap/skip
        # notes). It catches per-user errors internally, so this mostly closes 'done'.
        # Load the DB-overlaid tier config (T1) and invite comp plan per request so a
        # retune is honored without a worker restart.
        completed = run._review_user(
            conn, profile, db.load_tier_settings(conn), db.load_invite_comp_plan(conn),
            request_claim=(req_id, claim_version),
        )
        if completed is False:
            # A cron run holds the shared lock. Keep the request durable and back
            # off, rather than consume a resume which has not actually executed.
            db.finish_review_request(conn, req_id, "pending", notes="waiting for active review", claim_version=claim_version)
            conn.commit()
            return False
        db.finish_review_request(conn, req_id, "done", claim_version=claim_version)
        conn.commit()
    except Exception as exc:  # belt-and-braces: never let one request kill the loop
        try:
            conn.rollback()
        except Exception:
            pass
        db.finish_review_request(conn, req_id, "failed", notes=f"{type(exc).__name__}: {exc}"[:500], claim_version=claim_version)
        conn.commit()
        log.exception("review request %s failed", req_id)
    finally:
        # Clear only now — after finish_review_request + commit in BOTH paths above, so
        # by the time the id leaves the exclude set the row is already terminal
        # ('done'/'failed') and no longer visible to recovery: the exclude-gap is safe.
        # Fallback: if finish/commit itself raised, we still clear here; the row stays
        # 'running' and the STALE_MINUTES sweep reaps it later — today's crash behavior.
        _clear_in_flight(req_id)
    return True


def reconnect(conn):
    """Close a (possibly dead) connection and return a fresh one.

    MAJOR-2: the loop below holds ONE connection for the process lifetime. psycopg3 does
    not auto-reconnect, so a single dropped connection (pooler recycle, DB failover, idle
    timeout) turns every subsequent cycle into an exception on a dead connection — the
    loop would spin forever without exiting, so Railway's ON_FAILURE restart never fires
    and the queue silently stalls. On a cycle error we close the dead connection and open
    a fresh one so the worker self-heals. If the reconnect ITSELF fails (DB genuinely
    down), exit nonzero so Railway restarts the whole service rather than hot-spinning.
    """
    try:
        conn.close()
    except Exception:
        pass
    try:
        return jdb.connect()
    except Exception:
        log.exception("worker DB reconnect failed; exiting nonzero for a Railway restart")
        sys.exit(1)


def _run_loop(stop, fatal, idx) -> None:
    """One worker loop: claim + process requests until a shutdown (`stop`) or a sibling
    loop's fatal event (`fatal`) fires.

    Owns its OWN connection: threads must NEVER share a psycopg connection — per-request
    transactions and the session-level advisory locks _review_user takes are all
    connection-scoped — so each loop opens one via jdb.connect() and closes it in a
    finally. The claim path (FOR UPDATE SKIP LOCKED) lets K loops on separate connections
    poll the same queue without ever double-claiming.

    A SystemExit from reconnect propagates to the thread wrapper, which requests
    bounded sibling drain. main() preserves the single-loop exit code and exits
    nonzero on parallel-loop failure so the supervisor restarts this child.
    """
    poll = config.REVIEW_WORKER_POLL_SECONDS
    conn = jdb.connect()
    log.info("review loop %s started (poll=%ss, stale=%smin)", idx, poll, STALE_MINUTES)
    try:
        while not stop.stop and not fatal.is_set():
            try:
                handled = process_one(conn)
            except Exception:
                # A failure in claim/recover itself (e.g. a dropped connection) must not
                # kill the loop — but it must also not leave us spinning on a dead
                # psycopg3 connection. Reconnect (or exit for a Railway restart) so the
                # worker recovers instead of wedging forever (MAJOR-2).
                log.exception("worker cycle error; reconnecting")
                conn = reconnect(conn)
                handled = False
            if not handled:
                # Idle: sleep in 1s slices so a SIGTERM (stop) or a sibling's fatal event
                # is honored promptly.
                for _ in range(poll):
                    if stop.stop or fatal.is_set():
                        break
                    time.sleep(1)
    finally:
        conn.close()
        log.info("review loop %s stopped", idx)


def _drain_threads(threads, stop, fatal) -> bool:
    """Wait for loops, allowing at most 30 seconds after stop/fatal is observed.

    Daemon threads allow process exit even when a provider call never returns.
    The supervisor independently enforces the same bound from signal delivery.
    """
    deadline = None
    while any(t.is_alive() for t in threads):
        for thread in threads:
            if stop.stop:
                deadline = stop.deadline if deadline is None else min(deadline, stop.deadline)
            elif deadline is None and fatal.is_set():
                deadline = time.monotonic() + DRAIN_SECONDS
            remaining = 1.0 if deadline is None else min(1.0, deadline - time.monotonic())
            if remaining <= 0:
                return False
            thread.join(timeout=remaining)
    return True


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    if not config.has_api_key():
        log.warning("OPENROUTER_API_KEY not set; requests will fail until it is configured")

    stop = _Stop()
    # Keep signals on the main thread while each review loop owns its connection.
    # Both a stop signal and a fatal sibling start a bounded drain.
    signal.signal(signal.SIGTERM, stop.request)
    signal.signal(signal.SIGINT, stop.request)

    fatal = threading.Event()
    # Preserve the historical k <= 1 fallback while keeping every loop drainable.
    k = max(1, config.REVIEW_WORKER_PARALLELISM)
    log.info(
        "review worker started (parallelism=%s, poll=%ss, stale=%smin)",
        k, config.REVIEW_WORKER_POLL_SECONDS, STALE_MINUTES,
    )

    exits = []

    def _thread_body(idx):
        # Fail CLOSED: ANY exception escaping _run_loop must set `fatal` so main() exits
        # nonzero for a Railway restart — otherwise a thread that dies silently (e.g. the
        # initial jdb.connect() at loop entry raising when the DB is down at startup, which
        # is NOT routed through reconnect) would leave `fatal` unset and the process exit 0,
        # staying down. Keep the arms separate: SystemExit is a BaseException (from
        # reconnect, already logged there); the Exception arm needs its own log.exception.
        try:
            _run_loop(stop, fatal, idx)
        except SystemExit as exc:
            exits.append(exc)
            fatal.set()  # a loop's reconnect gave up → whole process must restart
        except Exception:
            log.exception("review loop %s crashed; draining siblings for a restart", idx)
            fatal.set()

    threads = [
        threading.Thread(target=_thread_body, args=(i,), name=f"review-loop-{i}", daemon=True)
        for i in range(k)
    ]
    for t in threads:
        t.start()
    drained = _drain_threads(threads, stop, fatal)
    if not drained:
        log.warning("review drain deadline reached; process exiting with unfinished work")
    if k <= 1 and exits:
        raise exits[0]  # Retain the single-loop SystemExit contract.

    if fatal.is_set():
        # A loop hit an unrecoverable DB error → exit nonzero so Railway restarts us.
        sys.exit(1)
    log.info("review worker stopped")


if __name__ == "__main__":
    main()
