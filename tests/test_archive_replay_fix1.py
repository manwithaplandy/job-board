"""Task12 Fix1: ordinary coverage and small descriptor-order regressions only."""

from dataclasses import replace
from uuid import UUID, uuid4

import pytest

from job_discovery.archive import replay
from job_discovery.archive.replay import ProjectionPolicy, ReplayLimits
from job_discovery.archive.schema import event_id
from tests.test_archive_replay import NOW, event, manifest, project


def test_present_prefix_below_floor_cannot_expand_declared_coverage():
    policy = ProjectionPolicy(True, NOW, coverage_starts=(("jobs", "job-1", 3),))
    result = project(manifest(event(), event(2), event(3)), policy=policy)
    assert not result.errors
    assert result.coverage[0].status == "incomplete"
    assert result.coverage[0].baseline_revision is None
    assert not result.coverage[0].complete_history
    assert (
        result.gaps[0].terminal and result.gaps[0].reason == "outside_declared_coverage"
    )
    assert result.gaps[0].missing_revision == 2
    fact = result.facts[0]
    assert not fact.history_complete
    assert set(fact.fields) == {"id", "external_id", "title", "url"}
    assert result.retained_revision_ranges == (("jobs", "job-1", 3, 3),)
    assert result.applied_event_ids == (event_id("jobs", "job-1", 3),)
    assert set(result.ignored_event_ids) == {
        event_id("jobs", "job-1", n) for n in (1, 2)
    }


def test_present_relationship_prefix_below_floor_cannot_supply_full_fields():
    rid, brand = str(uuid4()), str(uuid4())
    values = []
    for revision in range(1, 4):
        value = event(revision)
        value.update(
            aggregate_type="company_brands",
            aggregate_id=rid,
            event_id=str(event_id("company_brands", rid, revision)),
            predecessor_id=str(event_id("company_brands", rid, revision - 1))
            if revision > 1
            else None,
            body=dict(
                id=rid,
                company_id=1,
                brand_id=brand,
                revision=revision,
                status="accepted",
                evidence_kind="structured_source",
                public_evidence_ref="https://example.test/evidence",
            ),
        )
        values.append(value)
    policy = ProjectionPolicy(True, NOW, coverage_starts=(("company_brands", rid, 3),))
    result = project(manifest(*values), policy=policy)
    assert not result.errors and not result.facts
    assert result.coverage[0].status == "incomplete"
    assert (
        result.gaps[0].terminal and result.gaps[0].reason == "outside_declared_coverage"
    )
    assert result.retained_revision_ranges == (("company_brands", rid, 3, 3),)
    assert result.applied_event_ids == (event_id("company_brands", rid, 3),)


def test_baseline_at_floor_still_anchors_only_declared_history():
    policy = ProjectionPolicy(True, NOW, coverage_starts=(("jobs", "job-1", 3),))
    result = project(
        manifest(
            event(),
            event(2),
            event(3, kind="baseline", provenance="current_baseline"),
            event(4),
        ),
        policy=policy,
    )
    assert not result.errors and not result.gaps
    assert result.coverage[0].status == "complete_from_baseline"
    assert result.coverage[0].baseline_revision == 3
    assert not result.coverage[0].complete_history
    assert result.facts[0].history_complete
    assert "company_id" in result.facts[0].fields
    assert result.retained_revision_ranges == (("jobs", "job-1", 3, 4),)
    assert set(result.applied_event_ids) == {
        event_id("jobs", "job-1", n) for n in (3, 4)
    }


def test_entirely_below_floor_input_has_truthful_terminal_reason():
    policy = ProjectionPolicy(True, NOW, coverage_starts=(("jobs", "job-1", 3),))
    result = project(manifest(event(), event(2)), policy=policy)
    assert not result.errors and not result.facts and not result.applied_event_ids
    assert not result.retained_revision_ranges
    assert result.coverage[0].status == "incomplete"
    assert (
        result.gaps[0].terminal and result.gaps[0].reason == "outside_declared_coverage"
    )


class _NoTraversal(tuple):
    """Small fixture descriptor: detect order without time/resource experiments."""

    def __iter__(self):
        pytest.fail("membership traversal preceded cardinality/event-budget rejection")


@pytest.mark.parametrize(
    "ids,events,declared", [(2, 1, 1), (1, 2, 2), (2001, 1, 1), (0, 1, 1), (1, 1, 2)]
)
def test_count_mismatch_rejected_before_membership_or_seal_builder(
    monkeypatch, ids, events, declared
):
    item = manifest(*(event(n) for n in range(1, events + 1)))
    ref = replace(item.seal.batch, ordered_event_ids=_NoTraversal([UUID(int=1)] * ids))
    item = replace(item, seal=replace(item.seal, batch=ref, event_count=declared))

    def forbidden(*args, **kwargs):
        pytest.fail("malformed membership reached accepted seal builder")

    monkeypatch.setattr(replay, "seal_batch", forbidden)
    result = project(item)
    assert result.errors == ("invalid_membership_count",)
    assert not result.facts and not result.applied_event_ids


def test_remaining_event_budget_checked_before_membership_traversal(monkeypatch):
    first = manifest(event())
    second = manifest(event(2), event(3))
    ref = replace(
        second.seal.batch,
        ordered_event_ids=_NoTraversal(second.seal.batch.ordered_event_ids),
    )
    second = replace(second, seal=replace(second.seal, batch=ref))
    original = replay.seal_batch
    calls = []

    def guarded(ref):
        assert ref is first.seal.batch, "over-budget descriptor reached seal builder"
        calls.append(ref.batch_id)
        return original(ref)

    monkeypatch.setattr(replay, "seal_batch", guarded)
    result = project(first, second, limits=ReplayLimits(max_events=2))
    assert result.errors == ("event_limit",) and not result.facts
    assert calls == [first.seal.batch.batch_id]
