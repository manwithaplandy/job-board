import asyncio
import types

import pytest

from observability import tracing


def test_disabled_when_keys_absent(monkeypatch):
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)
    assert tracing.tracing_enabled() is False
    assert tracing.get_langfuse() is None


def test_enabled_when_keys_present(monkeypatch):
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-lf-x")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-lf-x")
    assert tracing.tracing_enabled() is True


def test_sample_rate_defaults_and_clamps(monkeypatch):
    monkeypatch.delenv("LANGFUSE_SAMPLE_RATE", raising=False)
    assert tracing.sample_rate() == 1.0
    monkeypatch.setenv("LANGFUSE_SAMPLE_RATE", "0.15")
    assert tracing.sample_rate() == 0.15
    monkeypatch.setenv("LANGFUSE_SAMPLE_RATE", "9")
    assert tracing.sample_rate() == 1.0
    monkeypatch.setenv("LANGFUSE_SAMPLE_RATE", "junk")
    assert tracing.sample_rate() == 1.0


def test_identity_is_nullcontext_when_disabled(monkeypatch):
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    with tracing.identity(user_id="u", session_id="s", tags=["t"]):
        pass  # must not raise


def test_flush_is_noop_when_disabled(monkeypatch):
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    tracing.flush()  # must not raise


def test_get_langfuse_returns_none_by_default_even_with_ambient_keys():
    """Regression: a real LANGFUSE_PUBLIC_KEY/SECRET_KEY exported in the shell or
    CI environment must not make tests send real traces into the production
    Langfuse project. conftest.py must neutralize ambient keys for every test;
    tests that want to exercise tracing opt in by stubbing tracing.get_langfuse."""
    assert tracing.get_langfuse() is None


# --- B7 tests: observability.llm shared helper ---

def test_usage_accounting_requested(monkeypatch):
    """Every outgoing request body must contain {"usage": {"include": true}}."""
    from observability import llm as obs_llm
    from reviewer.schemas import Stage1Result

    calls = []

    class _Completions:
        async def parse(self, **kwargs):
            calls.append(kwargs)
            msg = types.SimpleNamespace(
                parsed=Stage1Result(decision="pass", reason="ok"), refusal=None
            )
            return types.SimpleNamespace(
                choices=[types.SimpleNamespace(message=msg)], usage=None
            )

    fake_client = types.SimpleNamespace(
        beta=types.SimpleNamespace(
            chat=types.SimpleNamespace(completions=_Completions())
        )
    )
    monkeypatch.setattr(tracing, "get_langfuse", lambda: None)
    asyncio.run(obs_llm.traced_structured_call(
        fake_client, model="m", messages=[{"role": "user", "content": "hi"}],
        schema=Stage1Result, name="test", metadata={},
    ))
    assert len(calls) == 1
    extra = calls[0].get("extra_body", {})
    assert extra.get("usage", {}).get("include") is True


def test_cost_recorded_from_usage(monkeypatch):
    """When usage.cost=0.0123, the generation span records cost_details.total=0.0123."""
    from observability import llm as obs_llm
    from reviewer.schemas import Stage1Result

    recorded = {}

    class _Gen:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): recorded.update(kw)

    class _LF:
        def start_as_current_observation(self, **kw):
            return _Gen()

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())

    usage = types.SimpleNamespace(prompt_tokens=100, completion_tokens=20, cost=0.0123)

    class _Completions:
        async def parse(self, **kwargs):
            msg = types.SimpleNamespace(
                parsed=Stage1Result(decision="pass", reason="ok"), refusal=None
            )
            return types.SimpleNamespace(
                choices=[types.SimpleNamespace(message=msg)], usage=usage
            )

    fake_client = types.SimpleNamespace(
        beta=types.SimpleNamespace(
            chat=types.SimpleNamespace(completions=_Completions())
        )
    )
    asyncio.run(obs_llm.traced_structured_call(
        fake_client, model="m", messages=[{"role": "user", "content": "hi"}],
        schema=Stage1Result, name="test", metadata={},
    ))
    assert recorded.get("cost_details") == {"total": 0.0123}


def test_both_clients_share_helper(monkeypatch):
    """ReviewClient and CompanyReviewClient both delegate to observability.llm."""
    import reviewer.llm as reviewer_llm
    import company_discovery.llm as cd_llm

    calls = []

    async def _fake_traced(*args, **kwargs):
        calls.append(kwargs.get("name"))
        from reviewer.schemas import Stage1Result
        return Stage1Result(decision="pass", reason="ok"), None

    # Must patch in the modules that imported it (not the source module)
    monkeypatch.setattr(reviewer_llm, "traced_structured_call", _fake_traced)
    monkeypatch.setattr(cd_llm, "traced_structured_call", _fake_traced)

    from reviewer.schemas import Stage1Result

    rc = reviewer_llm.ReviewClient(
        client=types.SimpleNamespace(),  # irrelevant; fake_traced bypasses it
        model_stage1="m1", model_stage2="m2"
    )
    # _parse delegates to traced_structured_call
    asyncio.run(rc._parse(
        model="m1", max_tokens=512,
        system="sys", user="u",
        schema=Stage1Result, stage=1,
    ))
    assert "stage1" in calls

    # Also verify company client delegates
    from company_discovery.llm import CompanyReviewClient
    from company_discovery.schemas import CompanyReviewResult

    async def _fake_traced_company(*args, **kwargs):
        calls.append(kwargs.get("name"))
        return CompanyReviewResult(verdict="include", confidence="high", reasoning="x"), None

    monkeypatch.setattr(cd_llm, "traced_structured_call", _fake_traced_company)
    crc = CompanyReviewClient(client=types.SimpleNamespace(), model="m")
    asyncio.run(crc.review(company_block="P", name="X", ats="lever", token="x"))
    assert "company-screen" in calls
