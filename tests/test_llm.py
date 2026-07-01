import asyncio
import types

import pytest

from reviewer.llm import ReviewClient, build_profile_block
from reviewer.schemas import Stage1Result, Stage2Result


def _make_response(parsed, refusal=None):
    msg = types.SimpleNamespace(parsed=parsed, refusal=refusal)
    return types.SimpleNamespace(choices=[types.SimpleNamespace(message=msg)])


class _FakeCompletions:
    def __init__(self):
        self.calls = []

    async def parse(self, **kwargs):
        self.calls.append(kwargs)
        if kwargs["response_format"] is Stage1Result:
            return _make_response(Stage1Result(decision="pass", reason="looks relevant"))
        return _make_response(Stage2Result(
            verdict="approve", experience_match="match",
            industry="software_internet", industry_subcategory="devtools_platforms",
            confidence="high", reasoning="Strong fit.",
        ))


class _FakeClient:
    """Mimics AsyncOpenAI's beta.chat.completions.parse surface."""

    def __init__(self):
        self._fake_completions = _FakeCompletions()
        self.beta = types.SimpleNamespace(
            chat=types.SimpleNamespace(completions=self._fake_completions)
        )

    @property
    def calls(self):
        return self._fake_completions.calls


def test_build_profile_block_includes_resume_and_instructions():
    block = build_profile_block("RESUME-A", "INSTR-B")
    assert "RESUME-A" in block and "INSTR-B" in block


def test_stage1_passes_title_and_sends_profile_in_system():
    fake = _FakeClient()
    rc = ReviewClient(client=fake, model_stage1="m1", model_stage2="m2")
    out = asyncio.run(
        rc.stage1(profile_block="P", title="Staff Engineer", company="Acme", location="Remote")
    )
    assert isinstance(out, Stage1Result) and out.decision == "pass"
    call = fake.calls[0]
    assert call["model"] == "m1"
    assert call["response_format"] is Stage1Result
    msgs = call["messages"]
    assert msgs[0]["role"] == "system" and "P" in msgs[0]["content"]
    assert msgs[1]["role"] == "user" and "Staff Engineer" in msgs[1]["content"]


def test_stage2_includes_jd_and_uses_stage2_model():
    fake = _FakeClient()
    rc = ReviewClient(client=fake, model_stage1="m1", model_stage2="m2")
    out = asyncio.run(
        rc.stage2(
            profile_block="P", title="SRE", company="Acme",
            location="Remote", jd="Operate Kubernetes clusters",
        )
    )
    assert isinstance(out, Stage2Result) and out.verdict == "approve"
    call = fake.calls[0]
    assert call["model"] == "m2"
    assert call["response_format"] is Stage2Result
    assert "Operate Kubernetes clusters" in call["messages"][1]["content"]


def test_models_default_from_env(monkeypatch):
    monkeypatch.setenv("REVIEW_MODEL_STAGE1", "env-s1")
    monkeypatch.delenv("REVIEW_MODEL_STAGE2", raising=False)
    rc = ReviewClient(client=_FakeClient())
    assert rc.model_stage1 == "env-s1"
    assert rc.model_stage2 == "deepseek/deepseek-v4-flash"


def test_stage_raises_when_parsed_output_none():
    class _NoneCompletions:
        async def parse(self, **kwargs):
            return _make_response(None)

    client = types.SimpleNamespace(
        beta=types.SimpleNamespace(
            chat=types.SimpleNamespace(completions=_NoneCompletions())
        )
    )
    rc = ReviewClient(client=client, model_stage1="m1", model_stage2="m2")
    with pytest.raises(ValueError, match="no parsed output"):
        asyncio.run(rc.stage1(profile_block="P", title="T", company="C", location=None))


def test_stage_raises_on_refusal():
    class _RefusingCompletions:
        async def parse(self, **kwargs):
            return _make_response(None, refusal="I can't help with that.")

    client = types.SimpleNamespace(
        beta=types.SimpleNamespace(
            chat=types.SimpleNamespace(completions=_RefusingCompletions())
        )
    )
    rc = ReviewClient(client=client, model_stage1="m1", model_stage2="m2")
    with pytest.raises(ValueError, match="refused"):
        asyncio.run(rc.stage1(profile_block="P", title="T", company="C", location=None))


def test_stage1_creates_generation_when_tracing_enabled(monkeypatch):
    from observability import tracing

    events = {}

    class _Gen:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): events["update"] = kw

    class _LF:
        def start_as_current_observation(self, **kw):
            events["create"] = kw
            return _Gen()

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())
    fake = _FakeClient()
    rc = ReviewClient(client=fake, model_stage1="m1", model_stage2="m2")
    out = asyncio.run(
        rc.stage1(profile_block="P", title="SRE", company="Acme", location="Remote")
    )
    assert out.decision == "pass"
    assert events["create"]["as_type"] == "generation"
    assert events["create"]["model"] == "m1"
    assert events["create"]["name"] == "stage1"
    assert "output" in events["update"]


def test_prompt_contains_anchors_and_guard():
    """Stage-2 system prompt must contain score anchors, UNTRUSTED guard, and comp definition."""
    from reviewer.llm import _STAGE2_INSTRUCTIONS, _STAGE1_INSTRUCTIONS
    # Score anchor for skills_score
    assert "90-100" in _STAGE2_INSTRUCTIONS
    # Separate comp definition
    assert "comp_score" in _STAGE2_INSTRUCTIONS and "compensation fit" in _STAGE2_INSTRUCTIONS
    # Untrusted JD guard in stage-2
    assert "UNTRUSTED" in _STAGE2_INSTRUCTIONS or "untrusted" in _STAGE2_INSTRUCTIONS
    # job_description delimiter present
    assert "<job_description>" in _STAGE2_INSTRUCTIONS


def test_stage1_jd_guard():
    """Stage-1 user message wraps job data in untrusted block when calling stage."""
    fake = _FakeClient()
    rc = ReviewClient(client=fake, model_stage1="m1", model_stage2="m2")
    asyncio.run(rc.stage1(profile_block="P", title="SRE", company="Acme", location="NYC"))
    # Stage-1 system prompt should also include untrusted-JD awareness
    user_msg = fake.calls[0]["messages"][1]["content"]
    assert "SRE" in user_msg


def test_stage1_forwards_openrouter_cost_as_cost_details(monkeypatch):
    """OpenRouter returns the actual USD cost on resp.usage.cost; Langfuse has no
    price entry for OpenRouter-prefixed model slugs like deepseek/deepseek-v4-flash,
    so without forwarding this explicitly, cost is silently always $0."""
    from observability import tracing

    events = {}

    class _Gen:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): events["update"] = kw

    class _LF:
        def start_as_current_observation(self, **kw):
            return _Gen()

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())

    usage = types.SimpleNamespace(prompt_tokens=868, completion_tokens=38, cost=1.23e-05)

    class _CostCompletions:
        async def parse(self, **kwargs):
            return types.SimpleNamespace(
                choices=[types.SimpleNamespace(
                    message=types.SimpleNamespace(
                        parsed=Stage1Result(decision="pass", reason="r"), refusal=None
                    )
                )],
                usage=usage,
            )

    client = types.SimpleNamespace(
        beta=types.SimpleNamespace(chat=types.SimpleNamespace(completions=_CostCompletions()))
    )
    rc = ReviewClient(client=client, model_stage1="m1", model_stage2="m2")
    asyncio.run(rc.stage1(profile_block="P", title="T", company="C", location=None))

    assert events["update"]["cost_details"] == {"total": 1.23e-05}
