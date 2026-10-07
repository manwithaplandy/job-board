"""Optional offline public projection; no I/O, restoration or runtime integration.

The trusted admin caller supplies a complete service-owned suppression snapshot
and already loaded seals from an approved archive. This module grants no read
capability. Snapshot epochs label outputs; they can never unsuppress a scope.
Recompute/discard projections at their eligibility boundary and on suppression
snapshot changes. Current-PostgreSQL bootstrap is deliberately unimplemented.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import hashlib
import json
import math
import time
from typing import Iterable
from uuid import UUID

from .batches import seal_batch
from .codec import MAX_COMPRESSED, MAX_EXPANDED, MAX_MANIFEST, canonical_json
from .schema import (
    AggregateType,
    ChangeKind,
    PublicChange,
    INDEPENDENT_FACT_FIELDS,
    event_id,
    validate_change,
)
from .types import (
    SealedBatch,
    ProjectionResult,
    ProjectedFact,
    ProjectionCoverage,
    ProjectionGap,
)


@dataclass(frozen=True)
class Manifest:
    """In-memory exact persisted seal plus an opaque current/noncurrent label."""

    seal: SealedBatch
    object_version: str = "current"


@dataclass(frozen=True)
class ReplayLimits:
    max_events: int = 10000
    max_bytes: int = 64 * 1024**2
    deadline_seconds: float = 30
    max_depth: int = 64
    max_manifests: int = 2000

    def __post_init__(self):
        for value, maximum in (
            (self.max_events, 100000),
            (self.max_bytes, 128 * 1024**2),
            (self.max_depth, 256),
            (self.max_manifests, 10000),
        ):
            if type(value) is not int or not 1 <= value <= maximum:
                raise ValueError("invalid finite replay limits")
        if (
            type(self.deadline_seconds) not in {int, float}
            or not math.isfinite(self.deadline_seconds)
            or not 0 < self.deadline_seconds <= 120
        ):
            raise ValueError("invalid finite replay deadline")


def _aware(value):
    return (
        isinstance(value, datetime)
        and value.tzinfo is not None
        and value.utcoffset() is not None
    )


def _scope(kind, identity):
    if (
        not isinstance(kind, str)
        or kind not in AggregateType
        or not isinstance(identity, str)
        or not 1 <= len(identity.encode()) <= 2048
    ):
        raise ValueError("invalid projection scope")


@dataclass(frozen=True)
class Suppression:
    """Trusted service snapshot of public_archive_suppressions; never a grant."""

    aggregate_type: str
    aggregate_id: str
    suppressed_at: datetime
    reason: str

    def __post_init__(self):
        _scope(self.aggregate_type, self.aggregate_id)
        if (
            not _aware(self.suppressed_at)
            or not isinstance(self.reason, str)
            or not 1 <= len(self.reason) <= 256
        ):
            raise ValueError("invalid suppression snapshot")


@dataclass(frozen=True)
class ProjectionPolicy:
    admin_authorized: bool
    as_of: datetime
    suppressions: tuple[Suppression, ...] = ()
    suppression_epoch: int = 0
    coverage_starts: tuple[tuple[str, str, int], ...] = ()

    def __post_init__(self):
        if self.admin_authorized is not True or not _aware(self.as_of):
            raise ValueError(
                "explicit admin authorization and aware projection time required"
            )
        if type(self.suppression_epoch) is not int or self.suppression_epoch < 0:
            raise ValueError("invalid suppression snapshot epoch")
        if (
            not isinstance(self.suppressions, tuple)
            or len(self.suppressions) > 100000
            or not all(isinstance(s, Suppression) for s in self.suppressions)
        ):
            raise ValueError("bounded suppression snapshot required")
        if (
            not isinstance(self.coverage_starts, tuple)
            or len(self.coverage_starts) > 100000
        ):
            raise ValueError("bounded coverage declaration required")
        seen = set()
        for entry in self.coverage_starts:
            if not isinstance(entry, tuple) or len(entry) != 3:
                raise ValueError("invalid coverage declaration")
            kind, identity, first = entry
            _scope(kind, identity)
            if type(first) is not int or first < 1 or (kind, identity) in seen:
                raise ValueError("invalid coverage declaration")
            seen.add((kind, identity))


class _Invalid(ValueError):
    pass


def _json(raw, depth):
    """Bound JSON nesting before the recursive standard decoder sees input."""
    level, quoted, escaped = 0, False, False
    for byte in raw:
        if quoted:
            if escaped:
                escaped = False
            elif byte == 92:
                escaped = True
            elif byte == 34:
                quoted = False
        elif byte == 34:
            quoted = True
        elif byte in (91, 123):
            level += 1
            if level > depth:
                raise _Invalid("depth_limit")
        elif byte in (93, 125):
            level -= 1
    value = json.loads(raw)
    if canonical_json(value) != raw:
        raise _Invalid("noncanonical_json")
    return value


_FIELDS = frozenset(
    "event_id aggregate_type aggregate_id revision predecessor_id kind body occurred_at observed_at recorded_at provenance schema_version".split()
)


def _event(raw, depth):
    value = _json(raw, depth)
    if not isinstance(value, dict) or set(value) != _FIELDS:
        raise _Invalid("invalid_envelope")
    if type(value["schema_version"]) is not int or value["schema_version"] != 1:
        raise _Invalid("unknown_schema")
    _scope(value["aggregate_type"], value["aggregate_id"])
    revision = value["revision"]
    if type(revision) is not int or not 1 <= revision <= 9223372036854775807:
        raise _Invalid("invalid_revision")
    expected = str(event_id(value["aggregate_type"], value["aggregate_id"], revision))
    previous = (
        str(event_id(value["aggregate_type"], value["aggregate_id"], revision - 1))
        if revision > 1
        else None
    )
    if value["event_id"] != expected or value["predecessor_id"] != previous:
        raise _Invalid("invalid_lineage")
    if value["provenance"] not in (
        "current_baseline",
        "database_change",
        "source_observation",
    ):
        raise _Invalid("invalid_provenance")
    for name in ("occurred_at", "observed_at", "recorded_at"):
        item = value[name]
        if name == "observed_at" and item is None:
            continue
        if not isinstance(item, str) or not _aware(datetime.fromisoformat(item)):
            raise _Invalid("invalid_timestamp")
    validate_change(
        PublicChange(
            AggregateType(value["aggregate_type"]),
            value["aggregate_id"],
            ChangeKind(value["kind"]),
            value["body"],
            datetime.fromisoformat(value["occurred_at"]),
        )
    )
    return value


# Direct public endpoints only: no inferred identity or transitive graph merging.
_ENDPOINTS = {
    "company_id": "companies",
    "legacy_company_id": "companies",
    "job_id": "jobs",
    "source_account_id": "source_accounts",
    "source_listing_id": "source_listings",
    "job_version_id": "job_versions",
    "current_version_id": "job_versions",
    "brand_id": "brands",
    "skill_id": "skills",
    "location_id": "locations",
    "left_listing_id": "source_listings",
    "right_listing_id": "source_listings",
}


def project_archive(
    manifests: Iterable[Manifest], policy: ProjectionPolicy, limits: ReplayLimits
) -> ProjectionResult:
    """All errors fail the run closed; gaps remain terminal partial evidence.

    Iterators must be local/nonblocking. The deadline is cooperative between
    bounded CPU units, not a process sandbox for a caller's blocking iterator.
    Exact bytes include duplicates/expired objects in budgets and conflict checks.
    """
    if not isinstance(policy, ProjectionPolicy) or not isinstance(limits, ReplayLimits):
        raise ValueError("typed policy and limits required")
    deadline = time.monotonic() + limits.deadline_seconds
    seen, retained, excluded = {}, {}, {}
    ignored, applied = set(), set()
    count = byte_count = 0

    def check():
        if time.monotonic() >= deadline:
            raise _Invalid("deadline")

    try:
        blocked = {(s.aggregate_type, s.aggregate_id) for s in policy.suppressions}
        starts = {(t, i): n for t, i, n in policy.coverage_starts}
        iterator = iter(manifests)
        for position in range(limits.max_manifests + 1):
            check()
            try:
                item = next(iterator)
            except StopIteration:
                break
            if position == limits.max_manifests:
                raise _Invalid("manifest_limit")
            if not isinstance(item, Manifest) or not isinstance(item.seal, SealedBatch):
                raise _Invalid("invalid_manifest")
            seal = item.seal
            ref = seal.batch
            if (
                type(ref.serializer_version) is not int
                or ref.serializer_version != 1
                or not isinstance(ref.batch_id, UUID)
                or ref.prior_batch_id is not None
                and not isinstance(ref.prior_batch_id, UUID)
                or not isinstance(ref.ordered_event_ids, tuple)
                or any(not isinstance(eid, UUID) for eid in ref.ordered_event_ids)
                or any(
                    type(n) is not int
                    for n in (
                        seal.event_count,
                        seal.expanded_bytes,
                        seal.compressed_bytes,
                        seal.manifest_bytes,
                    )
                )
            ):
                raise _Invalid("invalid_manifest_types")
            if (
                not isinstance(item.object_version, str)
                or len(item.object_version) > 1024
                or not _aware(ref.sealed_at)
                or not _aware(ref.eligible_until)
                or ref.eligible_until.astimezone(UTC) - ref.sealed_at.astimezone(UTC)
                != timedelta(days=730)
                or ref.sealed_at.astimezone(UTC) > policy.as_of.astimezone(UTC)
            ):
                raise _Invalid("invalid_seal_window")
            chunks = (seal.canonical_data, seal.compressed_data, seal.manifest_data)
            if (
                any(not isinstance(b, bytes) for b in chunks)
                or not isinstance(ref.event_bytes, tuple)
                or not 1 <= len(ref.event_bytes) <= 2000
                or len(chunks[0]) > MAX_EXPANDED
                or len(chunks[1]) > MAX_COMPRESSED
                or len(chunks[2]) > MAX_MANIFEST
            ):
                raise _Invalid("seal_size_limit")
            count += len(ref.event_bytes)
            if count > limits.max_events:
                raise _Invalid("event_limit")
            for raw in ref.event_bytes:
                if not isinstance(raw, bytes) or len(raw) > 16384:
                    raise _Invalid("event_size_limit")
            byte_count += sum(map(len, chunks)) + sum(map(len, ref.event_bytes))
            if byte_count > limits.max_bytes:
                raise _Invalid("byte_limit")
            events = []
            for raw in ref.event_bytes:
                check()
                events.append(_event(raw, limits.max_depth))
            _json(seal.manifest_data, limits.max_depth)
            if seal_batch(ref) != seal:
                raise _Invalid("invalid_seal")
            check()
            for raw, value in zip(ref.event_bytes, events, strict=True):
                eid = value["event_id"]
                digest = hashlib.sha256(raw).hexdigest()
                if eid in seen and seen[eid] != digest:
                    raise _Invalid("conflicting_event_id")
                if eid in seen:
                    ignored.add(UUID(eid))
                seen[eid] = digest
                key = (value["aggregate_type"], value["aggregate_id"])
                revision = value["revision"]
                # Snapshot markers dominate all object versions and seal epochs.
                reason = (
                    "removed"
                    if key in blocked
                    else "expired"
                    if ref.eligible_until.astimezone(UTC)
                    <= policy.as_of.astimezone(UTC)
                    else None
                )
                if reason:
                    excluded[(key, revision)] = reason
                    ignored.add(UUID(eid))
                    continue
                values = retained.setdefault(key, {})
                existing = values.get(revision)
                if existing is None or existing[1] < ref.eligible_until.astimezone(UTC):
                    values[revision] = (
                        value,
                        ref.eligible_until.astimezone(UTC),
                        digest,
                    )
        else:
            raise _Invalid("manifest_limit")

        # Suppression propagates only along explicit endpoints. No graph output or
        # merge is built. A finite depth cap fails closed if closure is unfinished.
        for _ in range(limits.max_depth):
            check()
            newly = set()
            for key, revisions in retained.items():
                check()
                if key in blocked:
                    continue
                if any(
                    (target, str(v[0]["body"].get(field))) in blocked
                    for v in revisions.values()
                    for field, target in _ENDPOINTS.items()
                    if field in v[0]["body"]
                ):
                    newly.add(key)
            if not newly:
                break
            blocked.update(newly)
        else:
            raise _Invalid("suppression_depth_limit")

        facts, coverage, gaps, ranges = [], [], [], []
        keys = set(retained) | {key for key, _ in excluded}
        for key in sorted(keys):
            check()
            revisions = retained.get(key, {})
            if key in blocked:
                coverage.append(ProjectionCoverage(*key, "suppressed", None))
                gaps.append(ProjectionGap(*key, "retention_gap", "removed", None))
                ignored.update(UUID(v[0]["event_id"]) for v in revisions.values())
                continue
            if not revisions:
                coverage.append(ProjectionCoverage(*key, "incomplete", None))
                gaps.append(ProjectionGap(*key, "retention_gap", "expired", None))
                continue
            ordered = sorted(revisions)
            # Exact disjoint ranges, never min/max across a missing revision.
            first = last = ordered[0]
            for rev in ordered[1:]:
                if rev != last + 1:
                    ranges.append((*key, first, last))
                    first = rev
                last = rev
            ranges.append((*key, first, last))
            latest = ordered[-1]
            current = latest
            baseline = None
            reason = "unknown"
            for _ in range(limits.max_depth):
                check()
                candidate = revisions.get(current)
                if candidate is None:
                    reason = excluded.get(
                        (key, current),
                        "outside_declared_coverage"
                        if current < starts.get(key, 1)
                        else "unknown",
                    )
                    break
                value = candidate[0]
                if value["kind"] == "baseline":
                    baseline = current
                    break
                current -= 1
            else:
                reason = "depth_limit"
            complete = baseline is not None
            coverage.append(
                ProjectionCoverage(
                    *key,
                    "complete_from_baseline" if complete else "incomplete",
                    baseline,
                )
            )
            if not complete:
                gaps.append(
                    ProjectionGap(*key, "retention_gap", reason, max(1, current))
                )
            value, eligible, digest = revisions[latest]
            # Every prefix-derived field expires with its earliest dependency.
            if complete:
                eligible = min(revisions[r][1] for r in range(baseline, latest + 1))
                fields = value["body"].copy()
            else:
                allow = INDEPENDENT_FACT_FIELDS.get(key[0], frozenset())
                fields = {k: v for k, v in value["body"].items() if k in allow}
            if value["kind"] == "removed":
                fields = {}
            applied.update(UUID(revisions[r][0]["event_id"]) for r in ordered)
            if fields:
                facts.append(
                    ProjectedFact(
                        *key,
                        latest,
                        UUID(value["event_id"]),
                        fields,
                        datetime.fromisoformat(value["occurred_at"]),
                        datetime.fromisoformat(value["observed_at"])
                        if value["observed_at"]
                        else None,
                        datetime.fromisoformat(value["recorded_at"]),
                        value["provenance"],
                        complete,
                        eligible,
                        digest,
                    )
                )
        check()
        return ProjectionResult(
            tuple(sorted(applied, key=str)),
            tuple(sorted(ignored, key=str)),
            tuple(facts),
            tuple(coverage),
            tuple(gaps),
            tuple(ranges),
            (),
            policy.suppression_epoch,
        )
    except _Invalid as exc:
        return ProjectionResult(
            (), (), errors=(str(exc),), suppression_epoch=policy.suppression_epoch
        )
    except (
        ValueError,
        TypeError,
        KeyError,
        AttributeError,
        OverflowError,
        RecursionError,
    ):
        # Do not include source bodies/URLs in diagnostics.
        return ProjectionResult(
            (),
            (),
            errors=("invalid_archive_input",),
            suppression_epoch=policy.suppression_epoch,
        )
