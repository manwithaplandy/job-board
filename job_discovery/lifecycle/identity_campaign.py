"""Opt-in, finite identity continuation. No source HTTP, models or control changes.

An operator prepares a paused campaign pinned to a revision and finite high-water
marks. Both its running state and the reviewer environment opt-in are required.
Every mapping checkpoint and its cursor/counters commit in the same transaction.
"""

import logging
import os
import resource
import signal
import sys
from time import monotonic, sleep
from uuid import UUID

from job_discovery.db import connect
from .claims import claim_work, validate_claim, renew_claim, cancel_claim
from .config import read_control
from .identity import migrate_identity_batch
from .locks import enter_gate
from .maintenance import _TimedConnection, _PhaseEnded
from psycopg.errors import QueryCanceled
from tools.lifecycle_release import (
    _other_stages_off,
    REVIEWER_SERVICE,
    PRODUCTION_ENVIRONMENT,
)

log = logging.getLogger(__name__)
BATCH_ROWS = 100
MAX_BATCHES = 20
TURN_SECONDS = 240
HARD_SECONDS = 300
COOLDOWN_SECONDS = 60
STORAGE_LIMIT = 5800 * 1024**2
GROWTH_MARGIN = 32 * 1024**2
MEMORY_LIMIT = 384 * 1024**2


def _load(conn, campaign_id):
    return conn.execute(
        """SELECT *,expires_at<=clock_timestamp() expired,
        next_turn_at>clock_timestamp() cooling FROM lifecycle_identity_campaigns
        WHERE id=%s FOR UPDATE""",
        (campaign_id,),
    ).fetchone()


def _stop(conn, campaign_id, reason, state="stopped"):
    conn.execute(
        """UPDATE lifecycle_identity_campaigns SET state=%s,stop_reason=%s,
        finished_at=clock_timestamp() WHERE id=%s AND state='running'""",
        (state, reason, campaign_id),
    )


def _usage(conn):
    return conn.execute("""SELECT pg_database_size(current_database()) allocated,
        COALESCE(sum(bytes) FILTER(WHERE state='held'),0) held FROM capacity_reservations""").fetchone()


def _guard(conn, row, revision):
    control = read_control(conn)
    if row["expired"]:
        raise RuntimeError("campaign expiry reached")
    if row["source_revision"] != revision:
        raise RuntimeError("campaign revision mismatch")
    if not (
        control.safety_stage == "collect"
        and control.identity_enabled
        and control.identity_migration_activated_at is not None
        and control.activation_generation == row["activation_generation"]
        and _other_stages_off(control)
    ):
        raise RuntimeError("campaign controls changed")
    usage = _usage(conn)
    if usage["allocated"] + usage["held"] + GROWTH_MARGIN >= STORAGE_LIMIT:
        raise RuntimeError("campaign storage headroom exhausted")
    return usage["allocated"]


def _batch(conn, row):
    cid = row["id"]
    if row["phase"] == "jobs":
        remaining = row["max_job_rows"] - row["job_rows"]
        ids = [
            r["id"]
            for r in conn.execute(
                """SELECT j.id FROM jobs j
            WHERE (%s::text IS NULL OR j.id>%s) AND j.id<=%s AND j.company_id<=%s
            AND NOT EXISTS(SELECT FROM source_listings l WHERE l.job_id=j.id)
            ORDER BY j.id LIMIT %s""",
                (
                    row["job_cursor"],
                    row["job_cursor"],
                    row["job_high_water"],
                    row["company_high_water"],
                    max(1, min(BATCH_ROWS, remaining)),
                ),
            ).fetchall()
        ]
        if not ids:
            conn.execute(
                "UPDATE lifecycle_identity_campaigns SET phase='companies' WHERE id=%s",
                (cid,),
            )
            return _batch(conn, {**row, "phase": "companies"})
        accounts = conn.execute(
            """SELECT count(DISTINCT c.id) n FROM jobs j JOIN companies c ON c.id=j.company_id
            WHERE j.id=ANY(%s) AND NOT EXISTS(SELECT FROM source_accounts s WHERE s.ats=c.ats AND s.public_board_ref=c.token)""",
            (ids,),
        ).fetchone()["n"]
        if (
            remaining == 0
            or row["mapped_accounts"] + accounts > row["max_company_rows"]
        ):
            _stop(conn, cid, "approved row/account budget reached", "budget_exhausted")
            return
        mapped = migrate_identity_batch(conn, limit=len(ids), job_ids=ids)
        conn.execute(
            """UPDATE lifecycle_identity_campaigns SET job_cursor=%s,
            job_rows=job_rows+%s,mapped_jobs=mapped_jobs+%s,mapped_accounts=mapped_accounts+%s WHERE id=%s""",
            (ids[-1], len(ids), mapped, accounts, cid),
        )
    else:
        remaining = row["max_company_rows"] - row["mapped_accounts"]
        ids = [
            r["id"]
            for r in conn.execute(
                """SELECT c.id FROM companies c
            WHERE c.id>%s AND c.id<=%s AND NOT EXISTS(SELECT FROM source_accounts s
                WHERE s.ats=c.ats AND s.public_board_ref=c.token)
            ORDER BY c.id LIMIT %s""",
                (
                    row["company_cursor"],
                    row["company_high_water"],
                    max(1, min(BATCH_ROWS, remaining)),
                ),
            ).fetchall()
        ]
        if not ids:
            # Concurrent inserts behind the cursor cannot falsely certify completion.
            gap = conn.execute(
                """SELECT EXISTS(SELECT FROM jobs j WHERE j.id<=%s AND j.company_id<=%s
                AND NOT EXISTS(SELECT FROM source_listings l WHERE l.job_id=j.id))
                OR EXISTS(SELECT FROM companies c WHERE c.id<=%s AND NOT EXISTS(SELECT FROM source_accounts s
                  WHERE s.ats=c.ats AND s.public_board_ref=c.token)) gap""",
                (
                    row["job_high_water"],
                    row["company_high_water"],
                    row["company_high_water"],
                ),
            ).fetchone()["gap"]
            if gap:
                _stop(conn, cid, "unmapped work behind cursor; review a new campaign")
            else:
                conn.execute(
                    """UPDATE lifecycle_identity_campaigns SET phase='finished',state='completed',
                    finished_at=clock_timestamp() WHERE id=%s""",
                    (cid,),
                )
            return
        if remaining == 0:
            _stop(conn, cid, "approved account budget reached", "budget_exhausted")
            return
        mapped = migrate_identity_batch(conn, limit=len(ids), company_ids=ids)
        conn.execute(
            """UPDATE lifecycle_identity_campaigns SET company_cursor=%s,
            company_rows=company_rows+%s,mapped_accounts=mapped_accounts+%s WHERE id=%s""",
            (ids[-1], len(ids), mapped, cid),
        )


def run_turn(dsn, campaign_id, revision):
    campaign_id = UUID(str(campaign_id))
    deadline = monotonic() + TURN_SECONDS
    claim = None
    with connect(dsn) as conn:
        try:
            enter_gate(conn)
            row = _load(conn, campaign_id)
            if row is None:
                return {"state": "missing"}
            if row["state"] != "running":
                return dict(row)
            allocated = _guard(conn, row, revision)
            if row["cooling"]:
                return dict(row)
            if row["turns"] >= row["max_turns"]:
                _stop(
                    conn,
                    campaign_id,
                    "approved turn budget reached",
                    "budget_exhausted",
                )
                conn.commit()
                return dict(_load(conn, campaign_id))
            claim = claim_work(conn, "identity_backfill", "singleton", 180)
            if claim is None:
                return dict(row)
            conn.execute(
                """UPDATE lifecycle_identity_campaigns SET turns=turns+1,heartbeat_at=clock_timestamp(),
                next_turn_at=clock_timestamp()+make_interval(secs=>%s),before_bytes=COALESCE(before_bytes,%s)
                WHERE id=%s""",
                (HARD_SECONDS, allocated, campaign_id),
            )
            conn.commit()
            for _ in range(MAX_BATCHES):
                if monotonic() >= deadline:
                    break
                batch = _TimedConnection(conn, min(deadline, monotonic() + 150))
                enter_gate(batch)
                row = _load(batch, campaign_id)
                if row["state"] != "running":
                    conn.commit()
                    break
                _guard(batch, row, revision)
                claim = renew_claim(batch, claim)
                # Recheck after potentially slow gate/guard queries.
                if monotonic() >= deadline:
                    conn.rollback()
                    break
                _batch(batch, row)
                usage = _usage(batch)
                if usage["allocated"] + usage["held"] >= STORAGE_LIMIT:
                    raise RuntimeError("campaign post-batch storage guard reached")
                validate_claim(batch, claim)
                batch.execute(
                    """UPDATE lifecycle_identity_campaigns SET heartbeat_at=clock_timestamp(),after_bytes=%s
                    WHERE id=%s""",
                    (usage["allocated"], campaign_id),
                )
                batch.commit()
                sleep(0.25)
            enter_gate(conn)
            validate_claim(conn, claim)
            conn.execute(
                """UPDATE lifecycle_identity_campaigns SET next_turn_at=clock_timestamp()+make_interval(secs=>%s)
                WHERE id=%s""",
                (COOLDOWN_SECONDS, campaign_id),
            )
            conn.commit()
            # Deferred write checks must commit while the lease is still active.
            cancel_claim(conn, claim)
            conn.commit()
            claim = None
        except (_PhaseEnded, QueryCanceled):
            # A spent query/turn window abandons only the uncommitted batch.
            # The durable checkpoint and conservative retry time survive.
            conn.rollback()
            log.info("identity campaign yielded at its time budget")
        except Exception as error:
            conn.rollback()
            log.warning("identity campaign stopped (%s)", type(error).__name__)
            enter_gate(conn)
            # A replaced worker cannot stop its successor's campaign.
            if claim is None:
                owns_claim = not conn.execute(
                    "SELECT EXISTS(SELECT FROM lifecycle_claims WHERE kind='identity_backfill' AND work_id='singleton' AND state='active' AND lease_until>clock_timestamp()) active"
                ).fetchone()["active"]
            else:
                owns_claim = conn.execute(
                    "SELECT EXISTS(SELECT FROM lifecycle_claims WHERE owner_token=%s AND generation=%s AND state='active') owned",
                    (claim.owner_token, claim.generation),
                ).fetchone()["owned"]
            if owns_claim:
                _stop(
                    conn,
                    campaign_id,
                    str(error)[:300]
                    if isinstance(error, RuntimeError)
                    else type(error).__name__,
                )
            conn.commit()
        finally:
            if claim:
                try:
                    conn.rollback()
                    cancel_claim(conn, claim)
                    conn.commit()
                except Exception:
                    conn.rollback()
                    log.warning("identity campaign claim will expire")
        return dict(_load(conn, campaign_id))


def main():
    campaign_id = os.environ.get("IDENTITY_BACKFILL_CAMPAIGN")
    if not campaign_id:
        return 0
    if (
        os.environ.get("RAILWAY_SERVICE_ID") != REVIEWER_SERVICE
        or os.environ.get("RAILWAY_ENVIRONMENT_ID") != PRODUCTION_ENVIRONMENT
        or os.environ.get("RAILWAY_GIT_BRANCH") != "main"
    ):
        raise RuntimeError(
            "identity campaign requires production reviewer main deployment"
        )
    resource.setrlimit(resource.RLIMIT_AS, (MEMORY_LIMIT, MEMORY_LIMIT))
    resource.setrlimit(resource.RLIMIT_CPU, (TURN_SECONDS, TURN_SECONDS))
    os.nice(10)
    signal.signal(signal.SIGALRM, signal.SIG_DFL)
    signal.alarm(HARD_SECONDS)
    result = run_turn(None, campaign_id, os.environ.get("RAILWAY_GIT_COMMIT_SHA", ""))
    log.info(
        "identity campaign state=%s mapped_jobs=%s mapped_accounts=%s turns=%s",
        result["state"],
        result.get("mapped_jobs"),
        result.get("mapped_accounts"),
        result.get("turns"),
    )
    return int(result["state"] == "stopped")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    sys.exit(main())
