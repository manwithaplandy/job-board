import asyncio
import types

import pytest

from reviewer.llm import ReviewClient, build_profile_block
from reviewer.schemas import Stage1Result, Stage2Result


class _FakeMessages:
    def __init__(self):
        self.calls = []

    async def parse(self, **kwargs):
        self.calls.append(kwargs)
        if kwargs["output_format"] is Stage1Result:
            parsed = Stage1Result(decision="pass", reason="looks relevant")
        else:
            parsed = Stage2Result(
                verdict="approve", experience_match="match",
                industry="software_internet", industry_subcategory="devtools_platforms",
                confidence="high", reasoning="Strong fit.",
            )
        return types.SimpleNamespace(parsed_output=parsed)


class _FakeClient:
    def __init__(self):
        self.messages = _FakeMessages()


def test_build_profile_block_includes_resume_and_instructions():
    block = build_profile_block("RESUME-A", "INSTR-B")
    assert "RESUME-A" in block and "INSTR-B" in block


def test_stage1_passes_title_and_caches_profile_block():
    fake = _FakeClient()
    rc = ReviewClient(client=fake, model_stage1="m1", model_stage2="m2")
    out = asyncio.run(
        rc.stage1(profile_block="P", title="Staff Engineer", company="Acme", location="Remote")
    )
    assert isinstance(out, Stage1Result) and out.decision == "pass"
    call = fake.messages.calls[0]
    assert call["model"] == "m1"
    assert call["output_format"] is Stage1Result
    # resume/instructions block is the cached system block
    assert call["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert call["system"][0]["text"] == "P"
    # title/company/location reach the user message
    assert "Staff Engineer" in call["messages"][0]["content"]


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
    call = fake.messages.calls[0]
    assert call["model"] == "m2"
    assert call["output_format"] is Stage2Result
    assert "Operate Kubernetes clusters" in call["messages"][0]["content"]


def test_models_default_from_env(monkeypatch):
    monkeypatch.setenv("REVIEW_MODEL_STAGE1", "env-s1")
    monkeypatch.delenv("REVIEW_MODEL_STAGE2", raising=False)
    rc = ReviewClient(client=_FakeClient())
    assert rc.model_stage1 == "env-s1"
    assert rc.model_stage2 == "claude-haiku-4-5"


def test_stage_raises_when_parsed_output_none():
    class _NoneClient:
        class messages:
            @staticmethod
            async def parse(**kwargs):
                return types.SimpleNamespace(parsed_output=None)
    rc = ReviewClient(client=_NoneClient(), model_stage1="m1", model_stage2="m2")
    with pytest.raises(ValueError, match="no parsed output"):
        asyncio.run(rc.stage1(profile_block="P", title="T", company="C", location=None))
