"""Explicit, bounded legacy compatibility mapping. Never reconstruct history.

The caller owns commit/rollback and must invoke mapping as the first operation of
its short transaction. Runtime polling does not call this migration helper.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from psycopg.rows import dict_row

from .config import LIFECYCLE_GATE_KEY, read_control
from .types import ClaimRef


def choose_anchor(
    published_at: datetime | None, discovered_at: datetime, now: datetime
) -> tuple[datetime, str]:
    for value in (discovered_at, now):
        if (
            not isinstance(value, datetime)
            or value.tzinfo is None
            or value.utcoffset() is None
        ):
            raise ValueError("discovery and now require timezone-aware datetimes")
    if (
        isinstance(published_at, datetime)
        and published_at.tzinfo is not None
        and published_at.utcoffset() is not None
        and published_at <= now
    ):
        return published_at.astimezone(UTC), "source_published"
    return discovered_at.astimezone(UTC), "local_observation"


def migrate_identity_batch(conn, limit: int = 500) -> int:
    """Map <=500 legacy jobs (or remaining empty source accounts) atomically.

    The stable listing existence is the checkpoint. A rolled back batch has no
    checkpoint; a committed batch cannot reset its anchor or cache capture. The
    migration activation clock is set once by the first explicit batch, not DDL.
    Inactive boards preserve their old status without guessing why disabled.
    Legacy/collect mapping has no reservation or claim protocol yet: enforced or
    ever-activated archive states are rejected until later safety integration.
    """
    if type(limit) is not int or not 1 <= limit <= 500:
        raise ValueError("identity batch limit must be an integer between 1 and 500")
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT pg_advisory_xact_lock(%s)", (LIFECYCLE_GATE_KEY,))
        control = read_control(conn)
        if (
            control.safety_stage not in {"legacy", "collect"}
            or control.archive_ever_activated
        ):
            raise RuntimeError("legacy mapping requires pre-cutover control state")
        cur.execute(
            """SELECT j.*, c.ats, c.token, c.active, c.poll_failures
            FROM jobs j JOIN companies c ON c.id=j.company_id
            WHERE NOT EXISTS (SELECT 1 FROM source_listings l WHERE l.job_id=j.id)
            ORDER BY j.id LIMIT %s""",
            (limit,),
        )
        rows = cur.fetchall()
        # Reserve sorted namespaced Job keys before taking any Job/FK locks.
        # Task3's global BEFORE STATEMENT gate will extend this order to callers.
        for job in rows:
            cur.execute(
                "SELECT pg_advisory_xact_lock(hashtextextended(%s,0))",
                ("lifecycle:job:" + job["id"],),
            )
        cur.execute("""UPDATE lifecycle_control
            SET identity_migration_activated_at = clock_timestamp()
            WHERE singleton AND identity_migration_activated_at IS NULL
            RETURNING identity_migration_activated_at""")
        activation = read_control(conn).identity_migration_activated_at
        if rows:
            cur.execute(
                "SELECT id FROM jobs WHERE id=ANY(%s) ORDER BY id FOR UPDATE",
                ([job["id"] for job in rows],),
            )
        for job in rows:
            cur.execute(
                """INSERT INTO source_accounts
                (legacy_company_id,ats,public_board_ref,legacy_active,exclusion_state,failure_streak)
                VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (ats,public_board_ref) DO NOTHING""",
                (
                    job["company_id"],
                    job["ats"],
                    job["token"],
                    job["active"],
                    "enabled" if job["active"] else "unknown",
                    job["poll_failures"],
                ),
            )
            cur.execute(
                "SELECT id FROM source_accounts WHERE ats=%s AND public_board_ref=%s",
                (job["ats"], job["token"]),
            )
            source_id = cur.fetchone()["id"]
            _map_company_source(
                cur, job["company_id"], source_id, job["ats"], job["token"]
            )
            cur.execute(
                """INSERT INTO source_listings(source_account_id,external_id,job_id,
                original_discovered_at,discovery_anchor_at,discovery_anchor_provenance,
                discovery_expires_at,legacy_closed_at)
                VALUES (%s,%s,%s,%s,%s,'legacy_local_observation',%s,%s)""",
                (
                    source_id,
                    job["external_id"],
                    job["id"],
                    job["first_seen_at"],
                    job["first_seen_at"],
                    job["first_seen_at"].astimezone(UTC) + timedelta(days=30),
                    job["closed_at"],
                ),
            )
            # No actual use or source publication/observation is inferred.
            cur.execute(
                """UPDATE jobs SET description_captured_at=%s,
                description_capture_provenance='migration_activation'
                WHERE id=%s AND description IS NOT NULL AND description_captured_at IS NULL
                  AND description_last_used_at IS NULL""",
                (activation, job["id"]),
            )
            cur.execute(
                """UPDATE job_questions SET captured_at=%s,
                capture_provenance='migration_activation'
                WHERE job_id=%s AND captured_at IS NULL AND last_used_at IS NULL""",
                (activation, job["id"]),
            )
        if rows:
            return len(rows)
        # Source-only boards also need a stable coordinate. Count these only in
        # batches with no jobs so a zero return means the whole mapping is done.
        cur.execute(
            """INSERT INTO source_accounts
            (legacy_company_id,ats,public_board_ref,legacy_active,exclusion_state,failure_streak)
            SELECT c.id,c.ats,c.token,c.active,CASE WHEN c.active THEN 'enabled' ELSE 'unknown' END,c.poll_failures
            FROM companies c WHERE NOT EXISTS
              (SELECT 1 FROM source_accounts s WHERE s.ats=c.ats AND s.public_board_ref=c.token)
            ORDER BY c.id LIMIT %s ON CONFLICT (ats,public_board_ref) DO NOTHING
            RETURNING id,legacy_company_id,ats,public_board_ref""",
            (limit,),
        )
        accounts = cur.fetchall()
        for account in accounts:
            _map_company_source(
                cur,
                account["legacy_company_id"],
                account["id"],
                account["ats"],
                account["public_board_ref"],
            )
        return len(accounts)


def _map_company_source(cur, company_id, source_id, ats, board_ref):
    # This records the existing typed legacy board association, not inferred
    # employer identity or a manufactured source-observation timestamp.
    cur.execute(
        """INSERT INTO company_sources
        (company_id,source_account_id,evidence_kind,public_evidence_ref,status)
        VALUES (%s,%s,'legacy_mapping',%s,'accepted')
        ON CONFLICT (company_id,source_account_id) DO NOTHING""",
        (company_id, source_id, f"{ats}:{board_ref}"),
    )


def capture_version(
    conn, listing_id: UUID, metadata: dict, observed_at: datetime, claim: ClaimRef
) -> UUID | None:
    """Reserved interface: no version writes until gated writers/outbox exist.

    Identical and changed content both return None at this intermediate stage.
    No flag/GUC enables an unfenced write implementation.
    """
    read_control(conn)  # Missing/unreadable control must fail closed.
    return None
