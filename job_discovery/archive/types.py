"""Immutable service contracts shared by producer, offline codec and later exporter."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID
from job_discovery.lifecycle.types import ClaimRef


@dataclass(frozen=True)
class EventRef:
    event_id: UUID
    aggregate_type: str
    aggregate_id: str
    revision: int


@dataclass(frozen=True)
class BatchLimits:
    max_events: int = 2000
    max_expanded_bytes: int = 8 * 1024**2
    flush_after_seconds: int = 300

    def __post_init__(self):
        for value, maximum in [
            (self.max_events, 2000),
            (self.max_expanded_bytes, 8 * 1024**2),
            (self.flush_after_seconds, 300),
        ]:
            if type(value) is not int or not 1 <= value <= maximum:
                raise ValueError("batch limits exceed approved bounds")


@dataclass(frozen=True)
class BatchRef:
    batch_id: UUID
    claim: ClaimRef
    ordered_event_ids: tuple[UUID, ...]
    serializer_version: int
    sealed_at: datetime
    eligible_until: datetime
    event_bytes: tuple[bytes, ...] = field(repr=False)
    prior_batch_id: UUID | None = None
    object_prefix: str | None = None


@dataclass(frozen=True)
class SealedBatch:
    batch: BatchRef
    data_key: str
    manifest_key: str
    canonical_hash: str
    compressed_hash: str
    manifest_hash: str
    event_count: int
    expanded_bytes: int
    compressed_bytes: int
    manifest_bytes: int
    canonical_data: bytes = field(repr=False)
    compressed_data: bytes = field(repr=False)
    manifest_data: bytes = field(repr=False)

    @property
    def batch_id(self):
        return self.batch.batch_id

    @property
    def claim(self):
        return self.batch.claim

    @property
    def ordered_event_ids(self):
        return self.batch.ordered_event_ids

    @property
    def serializer_version(self):
        return self.batch.serializer_version

    @property
    def sealed_at(self):
        return self.batch.sealed_at

    @property
    def eligible_until(self):
        return self.batch.eligible_until


@dataclass(frozen=True)
class VerificationReceipt:
    key: str
    sha256: str
    byte_count: int
    receipt: str


@dataclass(frozen=True)
class VerifiedBatch:
    seal: SealedBatch
    data_receipt: VerificationReceipt
    manifest_receipt: VerificationReceipt


@dataclass(frozen=True)
class AckResult:
    exact_event_ids: tuple[UUID, ...]
    archived_revision_markers: tuple[tuple[str, str, int], ...]


@dataclass(frozen=True)
class ProjectedFact:
    aggregate_type: str
    aggregate_id: str
    revision: int
    event_id: UUID
    fields: dict
    occurred_at: datetime
    observed_at: datetime | None
    recorded_at: datetime
    provenance: str
    history_complete: bool  # Only from the declared activation baseline.
    eligible_until: datetime
    event_sha256: str


@dataclass(frozen=True)
class ProjectionCoverage:
    aggregate_type: str
    aggregate_id: str
    status: str
    baseline_revision: int | None
    complete_history: bool = False  # No assertion about pre-activation history.


@dataclass(frozen=True)
class ProjectionGap:
    aggregate_type: str
    aggregate_id: str
    kind: str
    reason: str
    missing_revision: int | None
    terminal: bool = True  # Never a request for an automatic retry.


@dataclass(frozen=True)
class ProjectionResult:
    applied_event_ids: tuple[UUID, ...]
    ignored_event_ids: tuple[UUID, ...]
    facts: tuple[ProjectedFact, ...] = ()
    coverage: tuple[ProjectionCoverage, ...] = ()
    gaps: tuple[ProjectionGap, ...] = ()
    retained_revision_ranges: tuple[tuple[str, str, int, int], ...] = ()
    errors: tuple[str, ...] = ()
    suppression_epoch: int = 0
