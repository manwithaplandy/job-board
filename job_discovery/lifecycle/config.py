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
