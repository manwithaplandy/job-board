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


def test_extra_body_and_max_tokens_forwarded(monkeypatch):
    """max_tokens and a caller extra_body (merged with usage accounting) reach the transport."""
    from observability import llm as obs_llm
    from reviewer.schemas import Stage1Result

    calls = []

    class _Completions:
        async def parse(self, **kwargs):
            calls.append(kwargs)
            msg = types.SimpleNamespace(
                parsed=Stage1Result(decision="pass", reason="ok"), refusal=None)
            return types.SimpleNamespace(
                choices=[types.SimpleNamespace(message=msg)], usage=None)

    fake = types.SimpleNamespace(
        beta=types.SimpleNamespace(chat=types.SimpleNamespace(completions=_Completions())))
    monkeypatch.setattr(tracing, "get_langfuse", lambda: None)
    asyncio.run(obs_llm.traced_structured_call(
        fake, model="m", messages=[{"role": "user", "content": "hi"}],
        schema=Stage1Result, name="t", metadata={},
        max_tokens=512, extra_body={"cache_control": {"type": "ephemeral"}},
    ))
    call = calls[0]
    assert call["max_tokens"] == 512                                   # cap forwarded
    assert call["extra_body"]["usage"]["include"] is True              # accounting preserved
    assert call["extra_body"]["cache_control"] == {"type": "ephemeral"}  # caller passthrough


def test_span_wraps_awaited_api_call(monkeypatch):
    """The generation span is entered BEFORE the API call and exited AFTER it,
    so recorded latency reflects the call rather than ~0."""
    from observability import llm as obs_llm
    from reviewer.schemas import Stage1Result

    order = []

    class _Gen:
        def __enter__(self): order.append("enter"); return self
        def __exit__(self, *a): order.append("exit"); return False
        def update(self, **kw): order.append("update")

    class _LF:
        def start_as_current_observation(self, **kw): return _Gen()

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())

    class _Completions:
        async def parse(self, **kwargs):
            order.append("call")
            msg = types.SimpleNamespace(
                parsed=Stage1Result(decision="pass", reason="ok"), refusal=None)
            return types.SimpleNamespace(
                choices=[types.SimpleNamespace(message=msg)], usage=None)

    fake = types.SimpleNamespace(
        beta=types.SimpleNamespace(chat=types.SimpleNamespace(completions=_Completions())))
    asyncio.run(obs_llm.traced_structured_call(
        fake, model="m", messages=[{"role": "user", "content": "hi"}],
        schema=Stage1Result, name="t", metadata={},
    ))
    assert order.index("enter") < order.index("call") < order.index("exit")
    assert order[-1] == "exit"  # span closes only after the call resolves


def test_error_recorded_inside_span(monkeypatch):
    """On API failure the span is opened and the error recorded inside it."""
    from observability import llm as obs_llm
    from reviewer.schemas import Stage1Result

    recorded = {}
    entered = []

    class _Gen:
        def __enter__(self): entered.append(True); return self
        def __exit__(self, *a): return False
        def update(self, **kw): recorded.update(kw)

    class _LF:
        def start_as_current_observation(self, **kw): return _Gen()

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())

    class _Boom:
        async def parse(self, **kwargs):
            raise RuntimeError("api down")

    fake = types.SimpleNamespace(
        beta=types.SimpleNamespace(chat=types.SimpleNamespace(completions=_Boom())))
    with pytest.raises(RuntimeError, match="api down"):
        asyncio.run(obs_llm.traced_structured_call(
            fake, model="m", messages=[{"role": "user", "content": "hi"}],
            schema=Stage1Result, name="t", metadata={},
        ))
    assert entered == [True]                    # span opened before the failing call
    assert recorded.get("level") == "ERROR"     # error recorded inside the span
