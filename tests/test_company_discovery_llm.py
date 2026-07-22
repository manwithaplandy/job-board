import asyncio

import pytest

from company_discovery.llm import (
    CompanyClassifyClient, CompanyReviewClient, OutOfCreditsError,
    _CLASSIFY_INSTRUCTIONS, _INSTRUCTIONS, build_company_block,
)
from observability.llm import _is_out_of_credits
from company_discovery.schemas import (
    COMPANY_SIZES, RED_FLAG_CATEGORIES, CompanyClassificationResult,
    CompanyReviewResult,
)


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


class _Perm403(Exception):
    """Shaped like openai.PermissionDeniedError for OpenRouter's monthly key-spend limit:
    status_code=403 with a body carrying the 'Key limit exceeded (monthly limit)' text."""
    status_code = 403

    def __init__(self):
        super().__init__(
            "Error code: 403 - {'error': {'message': 'Key limit exceeded (monthly "
            "limit). Manage it using https://openrouter.ai/...', 'code': 403}}")


class _Perm403Other(Exception):
    """A 403 that is NOT spend-blocked (moderation / model-access denial) — must stay a
    per-target error, never a halt."""
    status_code = 403

    def __init__(self):
        super().__init__("Error code: 403 - model access denied for this key")


class _Status403Bare(Exception):
    """A 403 whose message carries no key-limit signature at all."""
    status_code = 403


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


def test_is_out_of_credits_monthly_key_limit_403():
    # OpenRouter's monthly key-SPEND limit surfaces as a 403 whose body says
    # "Key limit exceeded (monthly limit)". It is as terminal for spend as a 402 — every
    # subsequent call fails identically — so it must halt the run just like 402. The
    # signature match is case-insensitive (_Perm403's body capitalizes "Key").
    assert _is_out_of_credits(_Perm403()) is True
    # NARROW: a 403 WITHOUT the key-limit signature (moderation, model-access denial) is a
    # per-target error, not a spend halt.
    assert _is_out_of_credits(_Perm403Other()) is False
    # A bare 403 (only the status, no signature) must NOT match.
    assert _is_out_of_credits(_Status403Bare()) is False


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


def test_classify_maps_monthly_limit_403_to_out_of_credits():
    # End-to-end: the classify path runs through traced_structured_call -> _invoke ->
    # _is_out_of_credits, so a monthly-key-limit 403 is converted to OutOfCreditsError
    # exactly like a 402 — letting the worker (and the reviewer) halt on it.
    client = CompanyClassifyClient(client=_Client(_Perm403()), model="m")
    with pytest.raises(OutOfCreditsError):
        asyncio.run(client.classify(name="X", ats="lever", token="x"))


def test_classify_propagates_unrelated_403():
    # A 403 without the key-limit signature stays a plain per-target error, NOT a halt.
    client = CompanyClassifyClient(client=_Client(_Perm403Other()), model="m")
    with pytest.raises(_Perm403Other):
        asyncio.run(client.classify(name="X", ats="lever", token="x"))


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


# ── Facts-only classification (CompanyClassifyClient / CompanyClassificationResult) ──


def test_hq_country_normalization():
    assert CompanyClassificationResult(hq_country="us").hq_country == "US"
    assert CompanyClassificationResult(hq_country="usa").hq_country == "unknown"
    assert CompanyClassificationResult(hq_country=None).hq_country == "unknown"
    # A country NAME (not a 2-letter code) collapses to unknown; a real code survives.
    assert CompanyClassificationResult(hq_country="Germany").hq_country == "unknown"
    assert CompanyClassificationResult(hq_country="de").hq_country == "DE"
    assert CompanyClassificationResult(hq_country="  us  ").hq_country == "US"
    # Non-string input (a model emitting a number/object) collapses to unknown, not a crash.
    assert CompanyClassificationResult(hq_country=123).hq_country == "unknown"
    # Two-char NON-ASCII alphabetics must NOT survive: str.isalpha() is Unicode-wide, so
    # deepseek's documented Chinese/Cyrillic slippage would otherwise persist junk codes
    # that the ASCII-only dashboard isCountryCode can't group under 'Unknown'.
    assert CompanyClassificationResult(hq_country="中国").hq_country == "unknown"
    assert CompanyClassificationResult(hq_country="мс").hq_country == "unknown"


def test_classification_result_defaults_are_facts_only():
    res = CompanyClassificationResult()
    assert res.size == "unknown"
    assert res.hq_country == "unknown"
    assert res.confidence == "low"
    assert res.tech_tags == [] and res.red_flags == []
    # No per-user verdict on the facts model.
    assert not hasattr(res, "verdict")


def test_classify_instructions_are_facts_only_no_preference_block():
    # Facts-only: no candidate/preference block, no verdict field.
    assert "CANDIDATE COMPANY PREFERENCES" not in _CLASSIFY_INSTRUCTIONS
    assert "verdict" not in _CLASSIFY_INSTRUCTIONS.lower()
    assert "NO candidate" in _CLASSIFY_INSTRUCTIONS
    assert "NO preference judgment" in _CLASSIFY_INSTRUCTIONS
    assert "FACTUAL profile" in _CLASSIFY_INSTRUCTIONS


def test_classify_instructions_cover_size_and_hq_country():
    assert "size" in _CLASSIFY_INSTRUCTIONS.lower()
    assert "headcount" in _CLASSIFY_INSTRUCTIONS.lower()
    assert "hq_country" in _CLASSIFY_INSTRUCTIONS
    assert "ISO-3166 alpha-2" in _CLASSIFY_INSTRUCTIONS
    # Every size bucket is enumerated in the prompt. Iterate the SHARED constant (not a
    # hardcoded literal) so a new/renamed bucket in COMPANY_SIZES fails here unless the
    # prompt is updated too — otherwise the model is never told the bucket exists.
    # ('unknown' is present via "or unknown" in the size line.)
    for bucket in COMPANY_SIZES:
        assert bucket in _CLASSIFY_INSTRUCTIONS, f"prompt missing size bucket {bucket}"


def test_classify_instructions_document_every_red_flag_category():
    for category in RED_FLAG_CATEGORIES:
        assert category in _CLASSIFY_INSTRUCTIONS, f"prompt missing category {category}"


def _capture_classify_messages(**classify_kwargs) -> list[dict]:
    """Run classify() against a message-capturing stub; return the messages list."""
    captured = {}

    class _CapParse:
        async def parse(self, **kw):
            captured["messages"] = kw["messages"]
            return _Resp(CompanyClassificationResult(size="51-200", hq_country="US"))

    client = type("Cl", (), {"beta": type("B", (), {
        "chat": type("Ch", (), {"completions": _CapParse()})()
    })()})()
    cc = CompanyClassifyClient(client=client, model="m")
    asyncio.run(cc.classify(**classify_kwargs))
    return captured["messages"]


def test_classify_system_prompt_mandates_english_and_carries_no_preferences():
    from reviewer.schemas import ENGLISH_ONLY_INSTRUCTION

    system = _capture_classify_messages(name="X", ats="lever", token="x")[0]["content"]
    assert ENGLISH_ONLY_INSTRUCTION in system
    assert "CANDIDATE COMPANY PREFERENCES" not in system


def test_classify_user_message_uses_display_name_when_set():
    user = _capture_classify_messages(name="acme-corp", ats="lever", token="acme",
                                      display_name="Acme Corporation")[1]["content"]
    assert "Company: Acme Corporation" in user
    assert "acme-corp" not in user  # raw slug name hidden when a display name exists


def test_classify_omits_description_block_when_no_context():
    user = _capture_classify_messages(name="Acme", ats="lever", token="acme")[1]["content"]
    assert "<company_description>" not in user
    assert "UNTRUSTED" not in user


def test_classify_injects_about_as_untrusted_description():
    user = _capture_classify_messages(name="Acme", ats="lever", token="acme",
                                      about="Acme builds developer tools.")[1]["content"]
    assert "<company_description>" in user
    assert "Acme builds developer tools." in user
    assert "UNTRUSTED" in user


def test_classify_truncates_description_to_2000_chars():
    user = _capture_classify_messages(name="Acme", ats="lever", token="acme",
                                      about="x" * 5000)[1]["content"]
    assert "x" * 2000 in user
    assert "x" * 2001 not in user


def test_classify_returns_parsed_result_and_raw_usage():
    """Task 6's worker reads raw.usage.{prompt_tokens,completion_tokens,cost}; classify
    must expose the OpenRouter usage via raw.usage even though traced_structured_call
    returns (parsed, usage) as its tuple."""
    usage = type("U", (), {"prompt_tokens": 120, "completion_tokens": 30,
                           "cost": 1.2e-06})()
    parsed = CompanyClassificationResult(size="11-50", hq_country="US", confidence="high")

    class _UsageResp:
        def __init__(self):
            msg = type("M", (), {"parsed": parsed, "refusal": None})()
            self.choices = [type("C", (), {"message": msg})()]
            self.usage = usage

    class _UsageParse:
        async def parse(self, **kw):
            return _UsageResp()

    client = type("Cl", (), {"beta": type("B", (), {
        "chat": type("Ch", (), {"completions": _UsageParse()})()
    })()})()
    cc = CompanyClassifyClient(client=client, model="m")
    result, raw = asyncio.run(cc.classify(name="Linear", ats="ashby", token="linear"))
    assert result.size == "11-50" and result.hq_country == "US"
    assert raw.usage.prompt_tokens == 120
    assert raw.usage.completion_tokens == 30
    assert raw.usage.cost == 1.2e-06


def test_classify_creates_generation_named_company_classify(monkeypatch):
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
    cc = CompanyClassifyClient(
        client=_Client(CompanyClassificationResult(size="1-10", hq_country="US")),
        model="m")
    result, _ = asyncio.run(cc.classify(name="Linear", ats="ashby", token="linear"))
    assert result.size == "1-10"
    assert events["create"]["name"] == "company-classify"
    assert events["create"]["as_type"] == "generation"
