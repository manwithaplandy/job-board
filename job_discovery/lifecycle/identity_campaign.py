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
TRANSACTION_SECONDS = 1.25
STORAGE_LIMIT = 5800 * 1024**2
GROWTH_MARGIN = 32 * 1024**2
MEMORY_LIMIT = 384 * 1024**2
COMPLETION_SECONDS = 10
AUTHORIZATION_SECONDS = 45
OBSERVATION_SECONDS = 90
CAPACITY_PROJECT = "fdhspmavadgucktetzoi"
MIN_FREE_BYTES = 1024**3
MAX_RESIDENT_WAL_BYTES = 4 * 1024**3
MAX_CAMPAIGN_GROWTH = 1280 * 1024**2


class _CampaignConnection(_TimedConnection):
    """One short window per transaction, including guards and deferred commit.

    Begin on the first statement so cooldown sleep doesn't spend the next
    transaction's budget. Client deadlines also account for network round trips;
    statement_timeout clips server work to the remaining window. This is not a
    hard wall-clock guarantee against a stalled client or network connection.
    """

    def __init__(self, conn):
        super().__init__(conn, None)

    def _timeout(self):
        if self.end is None:
            self.end = monotonic() + TRANSACTION_SECONDS
        super()._timeout()

    def commit(self):
        super().commit()
        self.end = None

    def rollback(self):
        self.conn.rollback()
        self.end = None


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


def _authorization(conn, row, allocated):
    # Evaluate freshness on the database clock, including the check immediately
    # before commit. The worker never renews its own operator authorization.
    health = conn.execute(
        """SELECT *, authorized_at<=clock_timestamp()
          AND valid_until>clock_timestamp()
          AND valid_until<=authorized_at+make_interval(secs=>%s)
          AND observed_at<=clock_timestamp()
          AND observed_at>clock_timestamp()-make_interval(secs=>%s) fresh
        FROM lifecycle_identity_authorizations WHERE campaign_id=%s""",
        (AUTHORIZATION_SECONDS, OBSERVATION_SECONDS, row["id"]),
    ).fetchone()
    if not health or not health["fresh"]:
        raise RuntimeError(
            "campaign authorization or capacity observation missing/stale"
        )
    if (
        health["project_ref"] != CAPACITY_PROJECT
        or health["source"] != "supabase_metrics"
        or health["source_revision"] != row["source_revision"]
        or health["activation_generation"] != row["activation_generation"]
    ):
        raise RuntimeError("campaign capacity observation scope mismatch")
    if (
        health["free_bytes"] <= max(MIN_FREE_BYTES, health["capacity_bytes"] // 5)
        or health["resident_wal_bytes"] >= MAX_RESIDENT_WAL_BYTES
    ):
        raise RuntimeError("campaign physical capacity headroom exhausted")
    if (
        row["before_bytes"] is not None
        and allocated - row["before_bytes"] >= MAX_CAMPAIGN_GROWTH
    ):
        raise RuntimeError("campaign allocation growth exhausted")


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
    _authorization(conn, row, usage["allocated"])
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
            # Expensive verification runs only after committing this short batch.
            return True
        if remaining == 0:
            _stop(conn, cid, "approved account budget reached", "budget_exhausted")
            return
        mapped = migrate_identity_batch(conn, limit=len(ids), company_ids=ids)
        conn.execute(
            """UPDATE lifecycle_identity_campaigns SET company_cursor=%s,
            company_rows=company_rows+%s,mapped_accounts=mapped_accounts+%s WHERE id=%s""",
            (ids[-1], len(ids), mapped, cid),
        )


def _completion_snapshot(raw, row, deadline):
    """One statement = one MVCC snapshot for both generation and exact gaps.

    No shared gate or campaign row lock is held during this bounded read. Every
    relevant DML statement transactionally advances the generation under the gate.
    """
    remaining = min(COMPLETION_SECONDS, deadline - monotonic())
    if remaining <= 0:
        raise _PhaseEnded()
    raw.execute("SET TRANSACTION READ ONLY")
    raw.execute(
        "SELECT set_config('statement_timeout',%s,true)",
        (str(max(1, int(remaining * 1000))),),
    )
    result = raw.execute(
        """SELECT generation,
        (SELECT EXISTS(SELECT FROM jobs j WHERE j.id<=%s AND j.company_id<=%s
          AND NOT EXISTS(SELECT FROM source_listings l WHERE l.job_id=j.id))
        OR EXISTS(SELECT FROM companies c WHERE c.id<=%s AND NOT EXISTS(SELECT FROM source_accounts s
          WHERE s.ats=c.ats AND s.public_board_ref=c.token))) gap
        FROM lifecycle_identity_generation WHERE singleton""",
        (row["job_high_water"], row["company_high_water"], row["company_high_water"]),
    ).fetchone()
    raw.commit()
    if result is None:
        raise RuntimeError("campaign mutation generation missing")
    return result


def _certify_completion(conn, row, snapshot, revision, claim):
    enter_gate(conn)
    current = _load(conn, row["id"])
    if current["state"] != "running":
        conn.commit()
        return
    if any(
        current[key] != row[key]
        for key in (
            "phase",
            "source_revision",
            "activation_generation",
            "job_high_water",
            "company_high_water",
        )
    ):
        raise RuntimeError("campaign snapshot boundaries changed")
    _guard(conn, current, revision)
    validate_claim(conn, claim)
    generation = conn.execute(
        "SELECT generation FROM lifecycle_identity_generation WHERE singleton"
    ).fetchone()
    if generation is None or generation["generation"] != snapshot["generation"]:
        # Any mutation (even outside the boundaries) invalidates the scan. A
        # subsequent finite turn takes a new complete snapshot, never a partial one.
        conn.commit()
        return
    if snapshot["gap"]:
        _stop(conn, row["id"], "unmapped work behind cursor; review a new campaign")
    else:
        conn.execute(
            "UPDATE lifecycle_identity_campaigns SET phase='finished',state='completed',finished_at=clock_timestamp() WHERE id=%s",
            (row["id"],),
        )
    _authorization(conn, current, _usage(conn)["allocated"])
    conn.commit()


def run_turn(dsn, campaign_id, revision):
    campaign_id = UUID(str(campaign_id))
    deadline = monotonic() + TURN_SECONDS
    claim = None
    with connect(dsn) as raw:
        conn = _CampaignConnection(raw)
        try:
            enter_gate(conn)
            row = _load(conn, campaign_id)
            if row is None:
                conn.commit()
                return {"state": "missing"}
            if row["state"] != "running":
                conn.commit()
                return dict(row)
            allocated = _guard(conn, row, revision)
            if row["cooling"]:
                conn.commit()
                return dict(row)
            if row["turns"] >= row["max_turns"]:
                _stop(
                    conn,
                    campaign_id,
                    "approved turn budget reached",
                    "budget_exhausted",
                )
                conn.commit()
                result = dict(_load(conn, campaign_id))
                conn.commit()
                return result
            claim = claim_work(conn, "identity_backfill", "singleton", 180)
            if claim is None:
                conn.commit()
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
                batch = conn
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
                completion = _batch(batch, row)
                usage = _usage(batch)
                if usage["allocated"] + usage["held"] >= STORAGE_LIMIT:
                    raise RuntimeError("campaign post-batch storage guard reached")
                validate_claim(batch, claim)
                batch.execute(
                    """UPDATE lifecycle_identity_campaigns SET heartbeat_at=clock_timestamp(),after_bytes=%s
                    WHERE id=%s""",
                    (usage["allocated"], campaign_id),
                )
                _authorization(batch, row, usage["allocated"])
                batch.commit()
                if completion:
                    # _batch may have transitioned jobs -> companies recursively.
                    row = {**row, "phase": "companies"}
                    snapshot = _completion_snapshot(raw, row, deadline)
                    _certify_completion(conn, row, snapshot, revision, claim)
                    break
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
        result = dict(_load(conn, campaign_id))
        conn.commit()
        return result


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
