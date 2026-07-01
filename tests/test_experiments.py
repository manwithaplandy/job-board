"""Tests for reviewer/experiments.py: verdict_match scorer and run_experiment wiring."""
import asyncio

from reviewer.experiments import verdict_match


def test_verdict_match_exact_and_miss():
    assert verdict_match("approve", "approve") == 1.0
    assert verdict_match("approve", "deny") == 0.0
    assert verdict_match(None, "approve") == 0.0


def test_run_experiment_iterates_items(monkeypatch):
    """Wiring test: stub the v4 DatasetClient.run_experiment to verify task+evaluator flow."""
    import contextlib

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
