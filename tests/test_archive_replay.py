"""Ordinary offline projection correctness; synthetic immutable public seals only."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from itertools import repeat
from uuid import UUID, uuid4
import pytest

from job_discovery.archive.batches import seal_batch
from job_discovery.archive.codec import canonical_json
from job_discovery.archive.schema import event_id
from job_discovery.archive.types import BatchRef
from job_discovery.lifecycle.types import ClaimRef
from job_discovery.archive.replay import (
    Manifest,
    ProjectionPolicy,
    ReplayLimits,
    Suppression,
    project_archive,
)

NOW = datetime(2026, 10, 7, tzinfo=UTC)


def event(revision=1, *, title="Engineer", aggregate_id="job-1", kind=None, **changes):
    value = dict(
        event_id=str(event_id("jobs", aggregate_id, revision)),
        aggregate_type="jobs",
        aggregate_id=aggregate_id,
        revision=revision,
        predecessor_id=str(event_id("jobs", aggregate_id, revision - 1))
        if revision > 1
        else None,
        kind=kind or ("baseline" if revision == 1 else "upsert"),
        body=dict(
            id=aggregate_id,
            company_id=1,
            external_id="ext",
            title=title,
            url="https://example.test/job",
            closed_at=None,
        ),
        occurred_at=(NOW - timedelta(days=2)).isoformat(),
        observed_at=(NOW - timedelta(days=3)).isoformat(),
        recorded_at=(NOW - timedelta(days=1)).isoformat(),
        provenance="current_baseline" if revision == 1 else "source_observation",
        schema_version=1,
    )
    return value | changes


def manifest(*events, expired=False, version="current"):
    sealed = NOW - timedelta(days=731 if expired else 1)
    ref = BatchRef(
        uuid4(),
        ClaimRef("fixture", 1, NOW + timedelta(seconds=180)),
        tuple(UUID(e["event_id"]) for e in events),
        1,
        sealed,
        sealed + timedelta(days=730),
        tuple(canonical_json(e) for e in events),
        object_prefix="synthetic/public",
    )
    return Manifest(seal_batch(ref), version)


def project(*items, policy=None, limits=None):
    return project_archive(
        items,
        policy or ProjectionPolicy(admin_authorized=True, as_of=NOW),
        limits or ReplayLimits(),
    )


def test_exact_id_hash_dedup_and_stale_order_preserve_latest_and_times():
    old, new = event(), event(2, title="Senior")
    result = project(manifest(new), manifest(old), manifest(old, version="noncurrent"))
    assert result.errors == ()
    assert len(result.facts) == 1
    fact = result.facts[0]
    assert fact.fields["title"] == "Senior" and fact.revision == 2
    assert fact.observed_at == datetime.fromisoformat(new["observed_at"])
    assert fact.recorded_at == datetime.fromisoformat(new["recorded_at"])
    assert fact.history_complete and fact.provenance == "source_observation"
    assert len(result.applied_event_ids) == 2
    assert result.retained_revision_ranges == (("jobs", "job-1", 1, 2),)


def test_conflicting_exact_id_fails_closed_even_after_good_fact():
    result = project(manifest(event()), manifest(event(title="Conflict")))
    assert not result.facts and "conflicting_event_id" in result.errors


@pytest.mark.parametrize(
    "changes",
    [
        {"schema_version": 2},
        {"schema_version": True},
        {"revision": True},
        {"aggregate_id": None},
        {"body": []},
        {"occurred_at": 3},
        {"observed_at": "2026-01-01"},
        {"extra": "unknown"},
        {"provenance": "private"},
        {"predecessor_id": str(uuid4())},
    ],
)
def test_total_envelope_unknown_schema_and_invalid_fields_fail_closed(changes):
    value = event() | changes
    # Keep a synthetically sealed exact membership despite invalid envelope fields.
    result = project(manifest(value))
    assert not result.facts and result.errors


def test_expired_baseline_terminal_gap_independent_facts_only():
    result = project(manifest(event(), expired=True), manifest(event(2)))
    assert result.gaps[0].kind == "retention_gap"
    assert result.gaps[0].reason == "expired" and result.gaps[0].terminal
    assert not result.facts[0].history_complete
    assert set(result.facts[0].fields) == {"id", "external_id", "title", "url"}
    assert result.retained_revision_ranges == (("jobs", "job-1", 2, 2),)
    assert result.facts[0].eligible_until == NOW + timedelta(days=729)


def test_missing_predecessor_unknown_cause_is_terminal_without_retries():
    result = project(manifest(event(3)))
    assert result.gaps[0].reason == "unknown"
    assert result.gaps[0].missing_revision == 2 and result.gaps[0].terminal
    assert result.coverage[0].status == "incomplete"
    assert not result.coverage[0].complete_history


def test_later_baseline_does_not_invent_earlier_history():
    result = project(manifest(event(5, kind="baseline", provenance="current_baseline")))
    assert result.coverage[0].baseline_revision == 5
    assert result.coverage[0].status == "complete_from_baseline"
    assert not result.coverage[0].complete_history


def test_authorized_suppression_dominates_current_noncurrent_and_later_epochs():
    marker = Suppression("jobs", "job-1", NOW - timedelta(days=1), "authorized_removal")
    policy = ProjectionPolicy(True, NOW, suppressions=(marker,), suppression_epoch=7)
    result = project(
        manifest(event()),
        manifest(event(), version="noncurrent"),
        manifest(event(2)),
        policy=policy,
    )
    assert not result.facts and result.coverage[0].status == "suppressed"
    assert result.gaps[0].reason == "removed" and result.gaps[0].terminal
    assert result.suppression_epoch == 7
    assert not project(
        manifest(event(3)), policy=replace(policy, suppression_epoch=8)
    ).facts


def test_suppressed_endpoint_invalidates_dependent_facts():
    policy = ProjectionPolicy(
        True,
        NOW,
        suppressions=(Suppression("companies", "1", NOW, "authorized_removal"),),
    )
    assert not project(manifest(event()), policy=policy).facts


def test_expired_duplicate_does_not_invalidate_eligible_authorized_reseal():
    result = project(manifest(event(), expired=True), manifest(event()))
    assert result.facts[0].history_complete and not result.gaps


def test_projection_expiry_recomputes_no_retained_facts_after_horizon():
    item = manifest(event())
    assert project(item).facts
    result = project(item, policy=ProjectionPolicy(True, NOW + timedelta(days=729)))
    assert not result.facts and result.gaps[0].reason == "expired"


@pytest.mark.parametrize(
    "field", ["canonical_data", "compressed_data", "manifest_data"]
)
def test_tampered_seal_bytes_fail_closed(field):
    item = manifest(event())
    item = replace(item, seal=replace(item.seal, **{field: b"corrupt"}))
    result = project(item)
    assert result.errors and not result.facts


@pytest.mark.parametrize(
    "limits",
    [
        ReplayLimits(max_events=1),
        ReplayLimits(max_bytes=1),
        ReplayLimits(max_manifests=1),
    ],
)
def test_finite_input_budgets_fail_closed(limits):
    item = manifest(event())
    result = project_archive(repeat(item), ProjectionPolicy(True, NOW), limits)
    assert result.errors and not result.facts


def test_deadline_fails_closed(monkeypatch):
    ticks = iter([0, 2, 3, 4])
    monkeypatch.setattr(
        "job_discovery.archive.replay.time.monotonic", lambda: next(ticks, 5)
    )
    assert (
        "deadline"
        in project(manifest(event()), limits=ReplayLimits(deadline_seconds=1)).errors
    )


def test_depth_limits_json_and_predecessor_walk():
    result = project(
        manifest(event(), event(2), event(3)), limits=ReplayLimits(max_depth=2)
    )
    assert not result.facts or not result.facts[0].history_complete
    assert result.errors or result.gaps


@pytest.mark.parametrize(
    "kwargs",
    [
        {"max_events": 0},
        {"max_bytes": float("inf")},
        {"deadline_seconds": float("nan")},
        {"max_depth": True},
        {"max_manifests": 0},
    ],
)
def test_invalid_limits_rejected(kwargs):
    with pytest.raises(ValueError):
        ReplayLimits(**kwargs)


def test_explicit_admin_policy_and_aware_time_required():
    with pytest.raises(ValueError):
        project(manifest(event()), policy=ProjectionPolicy(False, NOW))
    with pytest.raises(ValueError):
        ProjectionPolicy(True, datetime(2026, 1, 1))


def test_pure_projection_has_zero_application_or_external_calls(monkeypatch):
    import socket
    import psycopg
    import subprocess

    def forbidden(*args, **kwargs):
        pytest.fail("projection attempted external/application work")

    monkeypatch.setattr(socket, "socket", forbidden)
    monkeypatch.setattr(psycopg, "connect", forbidden)
    monkeypatch.setattr(subprocess, "Popen", forbidden)
    # Trace application/provider Python calls as well as blocking all external
    # effects. Dashboard-only generation/notification code has no in-process
    # import here and cannot run through a subprocess or network bridge.
    import sys

    item = manifest(event())
    calls = []
    forbidden_modules = (
        "reviewer.",
        "openai.",
        "boto3.",
        "botocore.",
        "requests.",
        "httpx.",
        "job_discovery.db",
        "job_discovery.lifecycle.",
    )

    def trace(frame, action, arg):
        if action == "call" and frame.f_globals.get("__name__", "").startswith(
            forbidden_modules
        ):
            calls.append(frame.f_code.co_name)

    previous = sys.getprofile()
    try:
        sys.setprofile(trace)
        result = project(item)
    finally:
        sys.setprofile(previous)
    assert result.facts
    assert calls == []


def test_outside_declared_coverage_is_terminal():
    policy = ProjectionPolicy(True, NOW, coverage_starts=(("jobs", "job-1", 3),))
    result = project(manifest(event(3)), policy=policy)
    assert result.gaps[0].reason == "outside_declared_coverage"


def test_missing_prefix_cannot_project_relationship_or_lifespan():
    rid = str(uuid4())
    value = event(2)
    value.update(
        aggregate_type="company_brands",
        aggregate_id=rid,
        event_id=str(event_id("company_brands", rid, 2)),
        predecessor_id=str(event_id("company_brands", rid, 1)),
        body=dict(
            id=rid,
            company_id=1,
            brand_id=str(uuid4()),
            revision=2,
            status="accepted",
            evidence_kind="structured_source",
            public_evidence_ref="https://example.test/evidence",
        ),
    )
    result = project(manifest(value))
    assert not result.facts and result.gaps[0].kind == "retention_gap"


def test_prefix_dependent_fact_expires_with_earliest_baseline():
    old = manifest(event())
    # A still eligible baseline has only one second left.
    ref = replace(
        old.seal.batch,
        sealed_at=NOW - timedelta(days=730) + timedelta(seconds=1),
        eligible_until=NOW + timedelta(seconds=1),
    )
    old = replace(old, seal=seal_batch(ref))
    result = project(old, manifest(event(2)))
    assert result.facts[0].history_complete
    assert result.facts[0].eligible_until == NOW + timedelta(seconds=1)
    later = project(
        old,
        manifest(event(2)),
        policy=ProjectionPolicy(True, NOW + timedelta(seconds=1)),
    )
    assert not later.facts[0].history_complete
    assert "closed_at" not in later.facts[0].fields


def test_predecessor_walk_stops_at_depth_with_normal_json():
    result = project(
        manifest(*(event(i) for i in range(1, 7))), limits=ReplayLimits(max_depth=4)
    )
    assert not result.errors
    assert result.gaps[0].reason == "depth_limit"
    assert not result.facts[0].history_complete


def test_disjoint_retained_ranges_never_claim_missing_revisions():
    result = project(manifest(event(), event(3)))
    assert result.retained_revision_ranges == (
        ("jobs", "job-1", 1, 1),
        ("jobs", "job-1", 3, 3),
    )
    assert result.gaps[0].missing_revision == 2


def test_complete_relation_assertion_retracts_without_identity_inference():
    rid, left, right = (str(uuid4()) for _ in range(3))

    def assertion(rev, status, kind):
        value = event(rev, kind=kind)
        value.update(
            aggregate_type="identity_assertions",
            aggregate_id=rid,
            event_id=str(event_id("identity_assertions", rid, rev)),
            predecessor_id=str(event_id("identity_assertions", rid, rev - 1))
            if rev > 1
            else None,
            body=dict(
                id=rid,
                left_listing_id=left,
                right_listing_id=right,
                relation="possible_same_posting",
                revision=rev,
                status=status,
                evidence_kind="public_correction",
                public_evidence_ref="https://example.test/evidence",
            ),
        )
        return value

    result = project(
        manifest(
            assertion(1, "proposed", "baseline"), assertion(2, "retracted", "upsert")
        )
    )
    assert len(result.facts) == 1
    assert result.facts[0].fields["status"] == "retracted"
    assert result.facts[0].fields["relation"] == "possible_same_posting"
    assert result.facts[0].revision == 2


@pytest.mark.parametrize(
    "field,value", [("serializer_version", True), ("serializer_version", 2)]
)
def test_total_manifest_rejects_unknown_or_boolean_serializer(field, value):
    item = manifest(event())
    # A total reader also rejects the boolean/1 equality ambiguity.
    ref = replace(item.seal.batch, **{field: value})
    seal = replace(item.seal, batch=ref)
    if value is True:
        seal = seal_batch(ref)
    result = project(replace(item, seal=seal))
    assert result.errors and not result.facts


def test_invalid_iterable_member_returns_sanitized_error():
    result = project({"private": "never log bodies"})
    assert result.errors == ("invalid_manifest",) and not result.facts


def test_retention_window_requires_730_elapsed_utc_days():
    from zoneinfo import ZoneInfo

    item = manifest(event())
    london = ZoneInfo("Europe/London")
    # The same wall time crosses a DST offset; it is one hour short of730days.
    start = datetime(2024, 3, 31, 0, 30, tzinfo=london)
    end = datetime(2026, 3, 31, 0, 30, tzinfo=london)
    ref = replace(item.seal.batch, sealed_at=start, eligible_until=end)
    result = project(replace(item, seal=seal_batch(ref)))
    assert result.errors == ("invalid_seal_window",)
