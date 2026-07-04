"""Tests for reviewer/experiments.py: verdict_match scorer and run_experiment wiring."""
import asyncio
import contextlib

import pytest

from reviewer.experiments import sync_golden_dataset



def test_run_experiment_iterates_items(monkeypatch):
    """Wiring test: stub the v4 DatasetClient.run_experiment to verify task+evaluator flow."""

    from observability import tracing
    from reviewer import experiments
    from tests.test_reviewer_run import StubClient

    class _Item:
        id = "item-1"
        input = {
            "title": "SRE", "company_name": "Acme", "location": "Remote",
            "ats": "lever", "description": "jd",
            "resume_text": "r", "instructions": "i",
        }
        expected_output = {"verdict": "approve", "seniority": "senior"}
        metadata = None

    class _FakeResult:
        item_results = [object(), object()]  # 2 placeholder results

    class _DS:
        """Fake DatasetClient: invokes task + evaluators like the real SDK does."""

        def run_experiment(self, *, name, task, evaluators, **kwargs):
            items = [_Item(), _Item()]

            async def _drive():
                for item in items:
                    result = task(item=item)
                    output = await result if asyncio.iscoroutine(result) else result
                    assert "seniority" in output
                    assert "skills_score" in output
                    names = {ev(input=item.input, output=output,
                                expected_output=item.expected_output,
                                metadata=item.metadata).name
                             for ev in evaluators}
                    assert "verdict_match" in names
                    assert "field_accuracy" in names

            asyncio.run(_drive())
            return _FakeResult()

    class _Span:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): pass

    class _LF:
        """Fake Langfuse client for both run_experiment and review_one tracing paths."""

        def get_dataset(self, name):
            return _DS()

        def flush(self):
            pass

        # Methods called by reviewer.run.review_one when lf is not None
        def start_as_current_observation(self, **kw):
            return _Span()

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())
    # review_one also calls tracing.identity(); nullcontext keeps it side-effect-free
    monkeypatch.setattr(tracing, "identity", lambda **kw: contextlib.nullcontext())
    stub = StubClient()
    n = experiments.run_experiment("golden", "exp-1", client=stub)
    assert n == 2
    # stage2 ran once per item (SRE passes stage1 in StubClient)
    assert len(stub.stage2_calls) == 2


def _correction_row(user_id, job_id):
    import datetime
    return {
        "user_id": user_id, "job_id": job_id, "title": "SRE", "company_name": "Acme",
        "location": "Remote", "ats": "lever",
        "description": "jd", "resume_text": "r", "instructions": "i",
        "verdict": "approve", "experience_match": "match",
        "industry": "software_internet", "industry_subcategory": "devtools_platforms",
        "confidence": "high", "role_category": "Backend", "seniority": "senior",
        "work_arrangement": "remote", "skills_score": 80, "experience_score": 70,
        "comp_score": 60, "note": None,
        "corrected_at": datetime.datetime(2025, 1, 1),
    }


def test_sync_preserves_dashboard_provenance(monkeypatch):
    """An existing item with metadata.source='dashboard' keeps it after sync; an
    item Langfuse doesn't already have is stamped 'backfill'."""
    from observability import tracing
    from reviewer import experiments

    created_items = []

    class _ExistingItem:
        id = "u1:j1"
        metadata = {"source": "dashboard"}

    class _DS:
        items = [_ExistingItem()]

    class _LF:
        def create_dataset(self, *, name):
            pass

        def get_dataset(self, name):
            return _DS()

        def create_dataset_item(self, *, dataset_name, id, input, expected_output, metadata):
            created_items.append({"id": id, "metadata": metadata})

        def flush(self):
            pass

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())
    # u1:j1 already exists (dashboard-sourced); u2:j2 is new.
    monkeypatch.setattr(
        experiments.db, "golden_corrections",
        lambda conn: [_correction_row("u1", "j1"), _correction_row("u2", "j2")],
    )

    n = sync_golden_dataset(None)
    assert n == 2
    by_id = {i["id"]: i for i in created_items}
    assert by_id["u1:j1"]["metadata"]["source"] == "dashboard"  # preserved, not overwritten
    assert by_id["u2:j2"]["metadata"]["source"] == "backfill"   # default stamp for new items


def test_stage1_evaluated_separately():
    """The stage1_pass evaluator scores 1.0 when the gate passes, 0.0 when it rejects."""
    from reviewer.experiments import _stage1_pass_evaluator
    from tests.test_reviewer_run import StubClient

    ev = _stage1_pass_evaluator(StubClient())

    class _Pass:
        input = {"title": "SRE", "company_name": "Acme", "location": "Remote",
                 "resume_text": "r", "instructions": "i"}

    class _Reject:
        input = {"title": "Forklift Operator", "company_name": "X", "location": None,
                 "resume_text": "r", "instructions": "i"}

    e_pass = ev(input={}, output={}, expected_output={}, item=_Pass())
    e_reject = ev(input={}, output={}, expected_output={}, item=_Reject())
    assert e_pass.name == "stage1_pass" and e_pass.value == 1.0
    assert e_reject.value == 0.0


def test_experiment_bypasses_stage1():
    """run_experiment task must feed golden items straight to stage 2 (no stage-1 gate)."""
    from observability import tracing
    from reviewer import experiments
    from tests.test_reviewer_run import StubClient

    class _DS:
        def run_experiment(self, *, name, task, evaluators, **kwargs):
            class _Item:
                id = "item-1"
                input = {
                    "title": "Forklift Operator",  # would be rejected by stage-1
                    "company_name": "X", "location": None,
                    "ats": "lever", "description": "jd",
                    "resume_text": "r", "instructions": "i",
                }
                expected_output = {"verdict": "approve"}
                metadata = None

            items = [_Item()]

            async def _drive():
                for item in items:
                    result = await task(item=item)
                    # For a golden item, stage 2 must run regardless of stage-1 signal
                    assert result.get("verdict") is not None, \
                        "stage-2 must run even if stage-1 would reject"

            asyncio.run(_drive())

            class _Res:
                item_results = items
            return _Res()

    class _Span:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): pass

    class _LF:
        def get_dataset(self, name): return _DS()
        def flush(self): pass
        def start_as_current_observation(self, **kw): return _Span()

    import contextlib
    # We need a monkeypatch-like approach; use direct attribute setting
    original = tracing.get_langfuse
    original_identity = tracing.identity
    try:
        tracing.get_langfuse = lambda: _LF()
        tracing.identity = lambda **kw: contextlib.nullcontext()
        stub = StubClient()
        n = experiments.run_experiment("golden", "exp-1", client=stub)
        assert n == 1
    finally:
        tracing.get_langfuse = original
        tracing.identity = original_identity


def test_verdict_match_module_fn_removed():
    """The dead module-level verdict_match function must not exist in experiments."""
    import reviewer.experiments as exp
    # After B8, verdict_match is removed from experiments.py
    with pytest.raises(AttributeError):
        _ = exp.verdict_match


def test_screen_prompt_defines_neutral_case():
    """Company screen prompt must contain the known-but-neutral confidence rule."""
    from company_discovery.llm import _INSTRUCTIONS
    # The specific neutral rule added by B8: when known but preferences neither
    # clearly match nor clearly violate, return 'include' with low confidence.
    # `confidence` is a low/medium/high enum, so the rule uses the enum value.
    assert 'confidence="low"' in _INSTRUCTIONS, \
        "neutral-company rule must return 'include' with low confidence"


def test_build_evaluators_scores_all_fields():
    from reviewer.experiments import build_evaluators

    inp, meta = {}, None
    output = {
        "verdict": "approve", "experience_match": "match",
        "industry": "software_internet", "industry_subcategory": "gaming",
        "role_category": "Backend", "seniority": "senior",
        "work_arrangement": "remote", "confidence": "high",
        "skills_score": 80, "experience_score": 70, "comp_score": 60,
    }
    expected = {**output, "seniority": "staff", "skills_score": 95}  # 2 misses

    scores = {}
    for ev in build_evaluators():
        e = ev(input=inp, output=output, expected_output=expected, metadata=meta)
        scores[e.name] = e.value

    assert scores["verdict_match"] == 1.0
    assert scores["match_seniority"] == 0.0        # senior != staff
    assert scores["match_role_category"] == 1.0
    assert scores["close_skills_score"] == 0.0     # |80-95| = 15 > 10
    assert scores["close_comp_score"] == 1.0       # exact
    # field_accuracy = 6/7 categoricals correct (seniority wrong)
    assert abs(scores["field_accuracy"] - 6 / 7) < 1e-9
