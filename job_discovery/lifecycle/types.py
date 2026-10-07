"""Stable shared references. Lease decisions always use database time."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True)
class ClaimRef:
    owner_token: str
    generation: int
    lease_until: datetime


@dataclass(frozen=True)
class ReservationRef:
    id: UUID
    claim: ClaimRef
    bytes: int


@dataclass(frozen=True)
class EnumerationRef:
    id: UUID
    source_id: UUID
    sequence: int
    claim: ClaimRef


@dataclass(frozen=True)
class Observation:
    id: str
    listing_id: UUID
    kind: str
    observed_at: datetime


@dataclass(frozen=True)
class DemandRef:
    id: UUID
    job_id: str
    kind: str
    claim: ClaimRef | None
    status: str


@dataclass(frozen=True)
class SweepResult:
    retired_rows: int
    retired_bytes: int
    blocked: bool
    cursor: str | None
