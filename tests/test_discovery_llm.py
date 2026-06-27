import asyncio

import pytest

from discovery.llm import (
    CompanyReviewClient, OutOfCreditsError, _is_out_of_credits, build_company_block,
)
from discovery.schemas import CompanyReviewResult


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
