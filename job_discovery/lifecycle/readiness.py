"""Bounded release evidence collection; never attest writers or enable controls.

An operator must quiesce incompatible writers and attest the deployed source
revision separately. This checks stored mapping/cache prerequisites only.
"""

import re
from .config import read_control
from .locks import enter_gate

COMPONENTS = (
    "source_metadata",
    "company_writers",
    "location_writers",
    "demand_snapshots",
    "dashboard_snapshots",
    "reviewer_snapshots",
    "account_cascade",
    "legacy_consumers",
    "archive_producers",
    "operational_preallocation",
)


def verify_backfill_batch(conn, source_revision: str, *, limit: int = 500) -> bool:
    """Check <=500 identities per caller-owned commit; persist a generation pin.

    No source/client clock override, automatic runtime attestation or payload use.
    Incomplete prerequisites raise and leave the current chunk for an operator to
    repair using the existing bounded mapper. Any control generation change starts
    a fresh scan. Rechecking a finished generation also starts a fresh scan.
    """
    if not re.fullmatch(r"[0-9a-f]{40}", source_revision):
        raise ValueError("source revision must be a full commit SHA")
    if type(limit) is not int or not 1 <= limit <= 500:
        raise ValueError("readiness batch limit must be 1..500")
    enter_gate(conn)
    control = read_control(conn)
    row = conn.execute(
        "SELECT * FROM lifecycle_backfill_readiness WHERE singleton FOR UPDATE"
    ).fetchone()
    restart = (
        row["activation_generation"] != control.activation_generation
        or row["source_revision"] != source_revision
        or row["completed_at"] is not None
    )
    phase, cursor = ("jobs", None) if restart else (row["phase"], row["cursor"])
    if phase == "jobs":
        rows = conn.execute(
            """SELECT j.id,
          EXISTS(SELECT FROM source_listings l WHERE l.job_id=j.id) mapped,
          (j.description IS NULL OR COALESCE(j.description_last_used_at,j.description_captured_at) IS NOT NULL)
          AND (q.job_id IS NULL OR COALESCE(q.last_used_at,q.captured_at) IS NOT NULL) captured
          FROM jobs j LEFT JOIN job_questions q ON q.job_id=j.id
          WHERE (%s::text IS NULL OR j.id>%s) ORDER BY j.id LIMIT %s""",
            (cursor, cursor, limit),
        ).fetchall()
        if any(not r["mapped"] or not r["captured"] for r in rows):
            raise RuntimeError("identity/cache backfill incomplete")
        cursor = rows[-1]["id"] if rows else cursor
        if len(rows) < limit:
            phase, cursor = "companies", None
        done = False
    else:
        rows = conn.execute(
            """SELECT c.id,EXISTS(SELECT FROM source_accounts s
          WHERE s.ats=c.ats AND s.public_board_ref=c.token) mapped FROM companies c
          WHERE (%s::bigint IS NULL OR c.id>%s::bigint) ORDER BY c.id LIMIT %s""",
            (cursor, cursor, limit),
        ).fetchall()
        if any(not r["mapped"] for r in rows):
            raise RuntimeError("source account backfill incomplete")
        cursor = str(rows[-1]["id"]) if rows else cursor
        done = len(rows) < limit
    conn.execute(
        """UPDATE lifecycle_backfill_readiness SET activation_generation=%s,
        source_revision=%s,phase=%s,cursor=%s,completed_at=CASE WHEN %s THEN clock_timestamp() END
        WHERE singleton""",
        (control.activation_generation, source_revision, phase, cursor, done),
    )
    return done
