import asyncio

import pytest

from company_discovery.llm import (
    CompanyReviewClient, OutOfCreditsError, _INSTRUCTIONS, build_company_block,
)
from observability.llm import _is_out_of_credits
from company_discovery.schemas import RED_FLAG_CATEGORIES, CompanyReviewResult


class _Resp:
    def __init__(self, parsed):
        msg = type("M", (), {"parsed": parsed, "refusal": None})()
        self.choices = [type("C", (), {"message": msg})()]


class _Parse:
    def __init__(self, outcome):
        self._outcome = outcome

    async def parse(self, **kw):
        if isinstance(self._outcome, Exception):
            raise self._outcome
        return _Resp(self._outcome)


class _Client:
    """Mimics AsyncOpenAI: client.beta.chat.completions.parse(...)."""

    def __init__(self, outcome):
        completions = type("Co", (), {"parse": _Parse(outcome).parse})()
        chat = type("Ch", (), {"completions": completions})()
        self.beta = type("B", (), {"chat": chat})()


class _Status402(Exception):
    status_code = 402


class _Status402Alt(Exception):
    status = 402


class _Resp402(Exception):
    def __init__(self):
        super().__init__("payment required")
        self.response = type("R", (), {"status_code": 402})()


class _RefusalParse:
    async def parse(self, **kw):
        msg = type("M", (), {"parsed": None, "refusal": "policy violation"})()
        return type("R", (), {"choices": [type("C", (), {"message": msg})()]})()


class _RefusalClient:
    """parse() returns a response whose message carries a refusal."""

    def __init__(self):
        completions = type("Co", (), {"parse": _RefusalParse().parse})()
        chat = type("Ch", (), {"completions": completions})()
        self.beta = type("B", (), {"chat": chat})()


def test_is_out_of_credits_detects_402():
    assert _is_out_of_credits(_Status402()) is True
    assert _is_out_of_credits(RuntimeError("nope")) is False


def test_is_out_of_credits_secondary_channels():
    assert _is_out_of_credits(_Status402Alt()) is True            # .status attr
    assert _is_out_of_credits(_Resp402()) is True                 # .response.status_code
    assert _is_out_of_credits(RuntimeError("Error 402: insufficient credits")) is True  # text
    assert _is_out_of_credits(RuntimeError("402 teapot")) is False  # has 402 but not 'credit'


def test_build_company_block_includes_prefs():
    assert "exclude defense" in build_company_block("exclude defense")
    assert "(none provided)" in build_company_block(None)


def test_review_returns_parsed_result():
    parsed = CompanyReviewResult(verdict="include", confidence="high", reasoning="devtools")
    client = CompanyReviewClient(client=_Client(parsed), model="m")
    out = asyncio.run(client.review(company_block="P", name="Linear", ats="ashby", token="linear"))
    assert out.verdict == "include"


def test_review_maps_402_to_out_of_credits():
    client = CompanyReviewClient(client=_Client(_Status402()), model="m")
    with pytest.raises(OutOfCreditsError):
        asyncio.run(client.review(company_block="P", name="X", ats="lever", token="x"))


def test_review_propagates_other_errors():
    client = CompanyReviewClient(client=_Client(RuntimeError("boom")), model="m")
    with pytest.raises(RuntimeError):
        asyncio.run(client.review(company_block="P", name="X", ats="lever", token="x"))


def test_review_refusal_raises_valueerror():
    client = CompanyReviewClient(client=_RefusalClient(), model="m")
    with pytest.raises(ValueError):
        asyncio.run(client.review(company_block="P", name="X", ats="lever", token="x"))


def test_review_none_parsed_raises_valueerror():
    client = CompanyReviewClient(client=_Client(None), model="m")
    with pytest.raises(ValueError):
        asyncio.run(client.review(company_block="P", name="X", ats="lever", token="x"))


def test_review_creates_generation_when_tracing_enabled(monkeypatch):
    from observability import tracing

    events = {}

    class _Gen:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): events["update"] = kw
        def end(self, **kw): events["end"] = kw

    class _LF:
        def start_as_current_observation(self, **kw):
            events["create"] = kw
            return _Gen()

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())
    parsed = CompanyReviewResult(verdict="include", confidence="high", reasoning="x")
    client = CompanyReviewClient(client=_Client(parsed), model="m")
    out = asyncio.run(
        client.review(company_block="P", name="Linear", ats="ashby", token="linear"))
    assert out.verdict == "include"
    assert events["create"]["as_type"] == "generation"
    assert events["create"]["name"] == "company-screen"
    assert events["create"]["model"] == "m"
    assert "output" in events["update"]


def test_review_system_prompt_mandates_english_output():
    from reviewer.schemas import ENGLISH_ONLY_INSTRUCTION

    captured = {}

    class _CapParse:
        async def parse(self, **kw):
            captured["messages"] = kw["messages"]
            parsed = CompanyReviewResult(verdict="include", confidence="high", reasoning="x")
            return _Resp(parsed)

    client = type("Cl", (), {"beta": type("B", (), {
        "chat": type("Ch", (), {"completions": _CapParse()})()
    })()})()
    rc = CompanyReviewClient(client=client, model="m")
    asyncio.run(rc.review(company_block="P", name="X", ats="lever", token="x"))

    system = captured["messages"][0]["content"]
    assert ENGLISH_ONLY_INSTRUCTION in system


def test_instructions_document_every_category():
    for category in RED_FLAG_CATEGORIES:
        assert category in _INSTRUCTIONS, f"prompt is missing category {category}"


def test_instructions_ask_for_empty_list_when_none():
    assert "[]" in _INSTRUCTIONS


def test_instructions_reasoning_forbids_deliberation_and_caps_length():
    lower = _INSTRUCTIONS.lower()
    # Reasoning must be a single, capped sentence with no chain-of-thought.
    assert "single" in lower
    assert "200" in _INSTRUCTIONS
    assert "deliberation" in lower
    assert "self-correction" in lower
    # Verdict must be derived from / match the reasoning conclusion.
    assert "derived from" in lower
    assert "match its conclusion" in lower


def test_instructions_use_confidence_enum_not_float():
    # The old text said "confidence <= 0.4"; confidence is a low/medium/high enum.
    assert "<= 0.4" not in _INSTRUCTIONS
    assert 'confidence="low"' in _INSTRUCTIONS


def _capture_user_message(**review_kwargs) -> str:
    """Run review() against a message-capturing stub; return the user message text."""
    captured = {}

    class _CapParse:
        async def parse(self, **kw):
            captured["messages"] = kw["messages"]
            parsed = CompanyReviewResult(verdict="unknown", confidence="low", reasoning="x")
            return _Resp(parsed)

    client = type("Cl", (), {"beta": type("B", (), {
        "chat": type("Ch", (), {"completions": _CapParse()})()
    })()})()
    rc = CompanyReviewClient(client=client, model="m")
    asyncio.run(rc.review(company_block="P", **review_kwargs))
    return captured["messages"][1]["content"]


def test_review_user_message_uses_display_name_when_set():
    user = _capture_user_message(name="acme-corp", ats="lever", token="acme",
                                 display_name="Acme Corporation")
    assert "Company: Acme Corporation" in user
    assert "acme-corp" not in user  # raw slug name is hidden when a display name exists


def test_review_user_message_falls_back_to_name_without_display_name():
    user = _capture_user_message(name="Acme", ats="lever", token="acme")
    assert "Company: Acme" in user


def test_review_injects_about_as_untrusted_description():
    user = _capture_user_message(name="Acme", ats="lever", token="acme",
                                 about="Acme builds developer tools for CI/CD.")
    assert "<company_description>" in user
    assert "Acme builds developer tools for CI/CD." in user
    assert "</company_description>" in user
    assert "UNTRUSTED" in user


def test_review_uses_web_description_when_no_about():
    user = _capture_user_message(name="Acme", ats="lever", token="acme",
                                 web_description="Acme is a fintech startup.")
    assert "<company_description>" in user
    assert "Acme is a fintech startup." in user


def test_review_prefers_about_over_web_description():
    user = _capture_user_message(name="Acme", ats="lever", token="acme",
                                 about="ABOUT-TEXT", web_description="WEB-TEXT")
    assert "ABOUT-TEXT" in user
    assert "WEB-TEXT" not in user


def test_review_omits_description_block_when_no_context():
    user = _capture_user_message(name="Acme", ats="lever", token="acme")
    assert "<company_description>" not in user
    assert "UNTRUSTED" not in user


def test_review_truncates_description_to_2000_chars():
    user = _capture_user_message(name="Acme", ats="lever", token="acme", about="x" * 5000)
    assert "x" * 2000 in user
    assert "x" * 2001 not in user


def test_instructions_opening_acknowledges_description_block():
    # The opening line must no longer claim the model gets "only a company's name
    # and its ATS slug" now that a <company_description> block can be present — it
    # would contradict the verdict bullet that tells the model to judge from it.
    assert "given only a company's name" not in _INSTRUCTIONS
    assert "sometimes a" in _INSTRUCTIONS and "description block" in _INSTRUCTIONS


def test_instructions_ground_unknown_on_provided_description():
    # 'unknown' is only correct when there is no identifying description; a provided
    # company_description that identifies the company must be judged from.
    assert "company_description block is provided" in _INSTRUCTIONS
    assert "do not answer 'unknown'" in _INSTRUCTIONS
    assert "merely because the name is unfamiliar" in _INSTRUCTIONS


def test_review_forwards_openrouter_cost_as_cost_details(monkeypatch):
    """OpenRouter returns the actual USD cost on resp.usage.cost; Langfuse has no
    price entry for OpenRouter-prefixed model slugs, so without forwarding this
    explicitly, cost is silently always $0."""
    from observability import tracing

    events = {}

    class _Gen:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): events["update"] = kw
        def end(self, **kw): events["end"] = kw

    class _LF:
        def start_as_current_observation(self, **kw):
            return _Gen()

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())

    usage = type("U", (), {"prompt_tokens": 200, "completion_tokens": 50, "cost": 4.5e-06})()
    parsed = CompanyReviewResult(verdict="include", confidence="high", reasoning="x")

    class _CostResp:
        def __init__(self):
            msg = type("M", (), {"parsed": parsed, "refusal": None})()
            self.choices = [type("C", (), {"message": msg})()]
            self.usage = usage

    class _CostParse:
        async def parse(self, **kw):
            return _CostResp()

    client = type("Cl", (), {"beta": type("B", (), {
        "chat": type("Ch", (), {"completions": _CostParse()})()
    })()})()

    rc = CompanyReviewClient(client=client, model="m")
    asyncio.run(rc.review(company_block="P", name="Linear", ats="ashby", token="linear"))

    assert events["update"]["cost_details"] == {"total": 4.5e-06}
