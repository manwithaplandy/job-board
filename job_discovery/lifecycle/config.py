"""Service-owned persisted controls; no environment or caller-GUC overrides."""

from dataclasses import dataclass
from datetime import datetime

from psycopg.rows import dict_row

# Shared transaction gate identity for subsequent safety/claims/capacity modules.
LIFECYCLE_GATE_KEY = 0x4A4F424C494645


@dataclass(frozen=True)
class LifecycleControl:
    flags_version: int
    safety_stage: str
    identity_enabled: bool
    source_enabled: bool
    maintenance_enabled: bool
    hydration_enabled: bool
    feed_enabled: bool
    retirement_enabled: bool
    retirement_dry_run: bool
    archive_ever_activated: bool
    archive_stage: str
    export_enabled: bool
    activation_generation: int
    identity_migration_activated_at: datetime | None


def read_control(conn) -> LifecycleControl:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM lifecycle_control WHERE singleton")
        row = cur.fetchone()
    if row is None:
        raise RuntimeError("lifecycle control is missing; refusing implicit defaults")
    row.pop("singleton")
    return LifecycleControl(**row)


def transition_control(
    conn, expected_generation: int, target: LifecycleControl, claim
) -> LifecycleControl:
    """CAS under the common gate. SQL guards remain authoritative for direct DML."""
    from dataclasses import asdict
    from psycopg import sql
    from .claims import validate_claim

    validate_claim(conn, claim)
    if not conn.execute(
        "SELECT 1 FROM lifecycle_claims WHERE owner_token=%s AND generation=%s AND kind='control' AND work_id='singleton'",
        (claim.owner_token, claim.generation),
    ).fetchone():
        raise RuntimeError("control transition requires control singleton claim")
    current = read_control(conn)
    if current.activation_generation != expected_generation:
        raise RuntimeError("stale control activation generation")
    values = asdict(target)
    values["activation_generation"] = expected_generation + 1
    assignments = sql.SQL(",").join(
        sql.SQL("{}=%s").format(sql.Identifier(k)) for k in values
    )
    conn.execute(
        sql.SQL("UPDATE lifecycle_control SET {} WHERE singleton").format(assignments),
        list(values.values()),
    )
    return read_control(conn)
