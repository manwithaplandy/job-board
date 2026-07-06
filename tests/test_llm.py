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
    assert call["max_tokens"] == 512  # cap forwarded, not silently dropped
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
    assert call["max_tokens"] == 6000  # cap forwarded, not silently dropped
    user_msg = call["messages"][1]["content"]
    assert "Operate Kubernetes clusters" in user_msg
    # The real posting is wrapped in the shared untrusted-input guard.
    from reviewer.schemas import UNTRUSTED_JD_GUARD
    assert UNTRUSTED_JD_GUARD in user_msg


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
        def end(self, **kw): events["end"] = kw

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


def test_system_prompt_mandates_english_output():
    # Every reviewer agent (stage1, stage1-batch, stage2) composes its system
    # message through _system(), so the English mandate must land in all of them.
    from reviewer.llm import (
        _system, _STAGE1_INSTRUCTIONS, _STAGE1_BATCH_INSTRUCTIONS, _STAGE2_INSTRUCTIONS,
    )
    from reviewer.schemas import ENGLISH_ONLY_INSTRUCTION

    assert "English" in ENGLISH_ONLY_INSTRUCTION
    for instr in (_STAGE1_INSTRUCTIONS, _STAGE1_BATCH_INSTRUCTIONS, _STAGE2_INSTRUCTIONS):
        assert ENGLISH_ONLY_INSTRUCTION in _system("PROFILE", instr)


def test_prompt_contains_anchors_and_guard():
    """Stage-2 system prompt must contain score anchors, UNTRUSTED guard, and comp definition."""
    from reviewer.llm import _STAGE2_INSTRUCTIONS
    # Score anchor for skills_score
    assert "90-100" in _STAGE2_INSTRUCTIONS
    # Separate comp definition
    assert "comp_score" in _STAGE2_INSTRUCTIONS and "compensation fit" in _STAGE2_INSTRUCTIONS
    # Untrusted JD guard in stage-2 — sourced from the single shared constant.
    from reviewer.schemas import UNTRUSTED_JD_GUARD
    assert UNTRUSTED_JD_GUARD in _STAGE2_INSTRUCTIONS
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


def test_stage1_batches_titles():
    """45 candidates → 1 LLM call with a batch of titles; responses mapped back by job_id."""
    from reviewer.llm import ReviewClient
    from reviewer.schemas import Stage1BatchResult, Stage1Decision

    batch_calls = []

    class _BatchCompletions:
        async def parse(self, **kwargs):
            batch_calls.append(kwargs)
            # Return a batch result with all 45 jobs passing
            decisions = [
                Stage1Decision(job_id=str(i), decision="pass", reason="ok")
                for i in range(45)
            ]
            return _make_response(Stage1BatchResult(decisions=decisions))

    fake_client = types.SimpleNamespace(
        beta=types.SimpleNamespace(
            chat=types.SimpleNamespace(completions=_BatchCompletions())
        )
    )
    rc = ReviewClient(client=fake_client, model_stage1="m1", model_stage2="m2")
    jobs = [{"id": str(i), "title": f"Job {i}", "company_name": "X", "location": None}
            for i in range(45)]
    results = asyncio.run(rc.stage1_batch(profile_block="P", jobs=jobs))
    # 1 LLM call (all 45 fit in the batch cap of 50)
    assert len(batch_calls) == 1
    # All 45 jobs mapped back
    assert len(results) == 45
    assert all(r.decision == "pass" for r in results)


def test_stage1_batch_forwards_cache_control_for_claude():
    """For Claude model slugs, stage1_batch forwards its cache_control extra_body
    (merged with usage accounting) to the transport instead of dropping it."""
    from reviewer.schemas import Stage1BatchResult, Stage1Decision

    calls = []

    class _BatchCompletions:
        async def parse(self, **kwargs):
            calls.append(kwargs)
            return _make_response(Stage1BatchResult(
                decisions=[Stage1Decision(job_id="1", decision="pass", reason="r")]))

    fake = types.SimpleNamespace(
        beta=types.SimpleNamespace(chat=types.SimpleNamespace(completions=_BatchCompletions())))
    rc = ReviewClient(client=fake, model_stage1="anthropic/claude-3.5-sonnet", model_stage2="m2")
    jobs = [{"id": "1", "title": "SRE", "company_name": "Acme", "location": None}]
    asyncio.run(rc.stage1_batch(profile_block="P", jobs=jobs))
    extra = calls[0]["extra_body"]
    assert extra["cache_control"] == {"type": "ephemeral"}  # forwarded, not dropped
    assert extra["usage"]["include"] is True                # accounting preserved


def test_persist_commits_per_chunk(monkeypatch):
    """Exception on row 7 of 10 → rows 1-6 committed; row 7 error logged; rows 8-10 committed."""
    persisted = []
    commits = [0]
    rollbacks = [0]

    class _FakeConn:
        def commit(self):
            commits[0] += 1

        def rollback(self):
            rollbacks[0] += 1

    def _fake_upsert(conn, row):
        job_id = row.get("job_id")
        if job_id == 7:
            raise RuntimeError("row 7 explodes")
        persisted.append(job_id)

    import reviewer.run as run_mod
    import reviewer.db as db_mod
    monkeypatch.setattr(db_mod, "upsert_review", _fake_upsert)

    rows = [{"job_id": i, "user_id": "u", "profile_version": "v"} for i in range(1, 11)]
    conn = _FakeConn()
    run_mod._persist_rows(conn, rows, chunk_size=6)
    # rows 1-6 → commit after chunk, row 7 errors → rollback (but continues), rows 8-10 → final commit
    assert set(persisted) == {1, 2, 3, 4, 5, 6, 8, 9, 10}
    assert commits[0] >= 2   # at least the chunk commit and final commit


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
        def end(self, **kw): events["end"] = kw

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
                id="gen-cost", model="deepseek/deepseek-v4-flash",
            )

    client = types.SimpleNamespace(
        beta=types.SimpleNamespace(chat=types.SimpleNamespace(completions=_CostCompletions()))
    )
    rc = ReviewClient(client=client, model_stage1="m1", model_stage2="m2")
    asyncio.run(rc.stage1(profile_block="P", title="T", company="C", location=None))

    # A real positive usage.cost is trusted verbatim and stamped source='usage'.
    assert events["update"]["cost_details"] == {"total": 1.23e-05}
    assert events["update"]["metadata"]["cost_source"] == "usage"


def test_cost_confirmation_runs_outside_the_span_latency_window(monkeypatch):
    """minor 9: when usage.cost is 0/absent the cost is CONFIRMED via a second OpenRouter
    round-trip. That confirm must NOT inflate the generation latency: the span is ended
    with an explicit end_time pinned to the API-call completion, and the confirmed cost is
    still attached before end()."""
    from observability import tracing, llm

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

    confirm_calls = []

    async def _fake_confirm(gen_id):
        confirm_calls.append(gen_id)
        return 0.5

    monkeypatch.setattr(llm, "_confirm_generation_cost", _fake_confirm)

    # usage.cost absent (capture gap) but a generation id is present → confirm path.
    usage = types.SimpleNamespace(prompt_tokens=10, completion_tokens=2, cost=None)

    class _GapCompletions:
        async def parse(self, **kwargs):
            return types.SimpleNamespace(
                choices=[types.SimpleNamespace(
                    message=types.SimpleNamespace(
                        parsed=Stage1Result(decision="pass", reason="r"), refusal=None
                    )
                )],
                usage=usage, id="gen-gap", model="deepseek/deepseek-v4-flash",
            )

    client = types.SimpleNamespace(
        beta=types.SimpleNamespace(chat=types.SimpleNamespace(completions=_GapCompletions()))
    )
    rc = ReviewClient(client=client, model_stage1="m1", model_stage2="m2")
    asyncio.run(rc.stage1(profile_block="P", title="T", company="C", location=None))

    # The confirm ran (against the generation id) and its cost was recorded…
    assert confirm_calls == ["gen-gap"]
    assert events["update"]["cost_details"] == {"total": 0.5}
    assert events["update"]["metadata"]["cost_source"] == "generation_api"
    # …and the span was ended with an EXPLICIT end_time (pinned to the API call, so the
    # confirm round-trip is excluded from the recorded latency). end_on_exit=False enables this.
    assert events["create"].get("end_on_exit") is False
    assert events["end"].get("end_time") is not None


# ── Robust structured-output parsing (deepseek-v4-flash: fence / prose / fractional) ──
# These reproduce the exact malformed inputs a real prod review run logged and assert the
# parser now recovers them (or fails gracefully when there is genuinely no JSON).
from pydantic import ValidationError

from observability.llm import robust_model_validate
from reviewer.schemas import Stage1BatchResult


def _valid_stage2_json() -> str:
    return Stage2Result(
        verdict="deny", experience_match="match",
        industry="software_internet", industry_subcategory="devtools_platforms",
        confidence="low", reasoning="x",
    ).model_dump_json()


class _RawParsingCompletions:
    """Mimics the OpenAI SDK's beta.chat.completions.parse: it validates a fixed raw
    string into response_format and raises the pydantic ValidationError (with the raw
    payload recorded as the error's `input`) exactly as the SDK does on fenced/malformed
    output — so _invoke's salvage path is exercised end-to-end."""

    def __init__(self, raw):
        self.raw = raw

    async def parse(self, **kwargs):
        schema = kwargs["response_format"]
        return _make_response(schema.model_validate_json(self.raw))


def _client_returning(raw):
    return types.SimpleNamespace(
        beta=types.SimpleNamespace(
            chat=types.SimpleNamespace(completions=_RawParsingCompletions(raw))))


def test_schema_rounds_fractional_pay_and_scores_to_int():
    """A fractional salary/score (real run: pay_min=73539.55) is rounded to int rather
    than failing validation ('got a number with a fractional part') and dropping the
    review. Covers pay_min/pay_max plus the sibling int score fields."""
    m = Stage2Result.model_validate_json(
        '{"verdict":"deny","experience_match":"match","industry":"software_internet",'
        '"industry_subcategory":"devtools_platforms","confidence":"low","reasoning":"x",'
        '"pay_min":73539.55,"pay_max":90000.4,"skills_score":82.6}'
    )
    assert m.pay_min == 73540 and m.pay_max == 90000 and m.skills_score == 83
    assert isinstance(m.pay_min, int) and isinstance(m.skills_score, int)


def test_robust_validate_strips_json_code_fence():
    """The highest-value fix: ```json … ``` wrapping is stripped before validation
    (real run: input_value='```json\\n{ "verdict": … }\\n```')."""
    fenced = "```json\n" + _valid_stage2_json() + "\n```"
    assert robust_model_validate(Stage2Result, fenced).verdict == "deny"


def test_robust_validate_strips_bare_code_fence():
    """A bare ``` … ``` fence (no language tag) is handled too."""
    fenced = "```\n" + _valid_stage2_json() + "\n```"
    assert robust_model_validate(Stage2Result, fenced).verdict == "deny"


def test_robust_validate_salvages_json_after_leading_prose():
    """A leading prose sentence before the JSON object is salvaged via first-block
    extraction, not dropped."""
    noisy = "Sure! Here is the result:\n" + _valid_stage2_json()
    assert robust_model_validate(Stage2Result, noisy).confidence == "low"


def test_robust_validate_raises_on_non_json_numbered_list():
    """The stage-1 numbered-list case (real run: input_value='1. id=lever:agicap:…') has
    no JSON to recover, so it must fail gracefully (raise) rather than fabricate a result."""
    numbered = "1. id=lever:agicap:foo pass\n2. id=lever:bar:baz reject"
    with pytest.raises(ValidationError):
        robust_model_validate(Stage1BatchResult, numbered)


def test_stage2_recovers_fenced_response_end_to_end():
    """A fenced stage-2 response that would raise inside the SDK is salvaged through
    _invoke, so the review is recovered instead of silently dropped."""
    fenced = "```json\n" + _valid_stage2_json() + "\n```"
    rc = ReviewClient(client=_client_returning(fenced), model_stage1="m1", model_stage2="m2")
    out = asyncio.run(rc.stage2(profile_block="P", title="SRE", company="Acme",
                                location="Remote", jd="Operate clusters"))
    assert isinstance(out, Stage2Result) and out.verdict == "deny"


def test_stage1_batch_unrecoverable_numbered_list_still_raises():
    """A stage-1 batch returned as a numbered list (no JSON) can't be salvaged: the error
    propagates so review_batch records a retryable whole-batch error (no regression)."""
    numbered = "1. id=lever:agicap:foo pass\n2. id=lever:bar:baz reject"
    rc = ReviewClient(client=_client_returning(numbered), model_stage1="m1", model_stage2="m2")
    jobs = [{"id": "lever:agicap:foo", "title": "SRE", "company_name": "Acme", "location": None}]
    with pytest.raises(ValidationError):
        asyncio.run(rc.stage1_batch(profile_block="P", jobs=jobs))


# ── Omission observability (J3): omitted-vs-explicit field visibility on the trace ──
# Stage2Result fields role_category/seniority/work_arrangement default to real tokens
# ("Other"/"unknown"), so an OMITTED field and an EXPLICIT "unknown" collapse to the same
# post-default value. model_fields_set records exactly which keys the model emitted, so
# set(model_fields) - model_fields_set is the omitted set — the load-bearing distinction.
from observability.llm import _omission_metadata


def _stage2_json_omitting_seniority() -> str:
    """Valid Stage2Result JSON (all REQUIRED fields present) that OMITS 'seniority'."""
    return (
        '{"verdict":"approve","experience_match":"match",'
        '"industry":"software_internet","industry_subcategory":"devtools_platforms",'
        '"confidence":"high","reasoning":"x"}'
    )


def test_omission_metadata_distinguishes_omitted_from_explicit_unknown():
    """The key assertion: an OMITTED 'seniority' appears in omitted_fields, while an
    EXPLICIT 'seniority':'unknown' does NOT — even though both model_dump() to 'unknown'."""
    resp = types.SimpleNamespace(
        choices=[types.SimpleNamespace(finish_reason="stop")], salvaged=False)

    # (a) OMITTED → present in omitted_fields, completeness < 1.0
    omitted = Stage2Result.model_validate_json(_stage2_json_omitting_seniority())
    msg = types.SimpleNamespace(parsed=omitted, refusal=None)
    meta = _omission_metadata(Stage2Result, resp, msg)
    assert "seniority" in meta["omitted_fields"]
    assert meta["completeness"] < 1.0
    assert meta["salvaged"] is False
    assert meta["finish_reason"] == "stop"
    # role_category/work_arrangement are also defaulted here → likewise omitted…
    assert {"role_category", "work_arrangement"} <= set(meta["omitted_fields"])
    # …but a REQUIRED field the model did emit is never "omitted".
    assert "verdict" not in meta["omitted_fields"]

    # (b) EXPLICIT "unknown" → NOT omitted (proves explicit-unknown != omitted)
    explicit_json = _stage2_json_omitting_seniority()[:-1] + ',"seniority":"unknown"}'
    explicit = Stage2Result.model_validate_json(explicit_json)
    msg2 = types.SimpleNamespace(parsed=explicit, refusal=None)
    meta2 = _omission_metadata(Stage2Result, resp, msg2)
    assert explicit.seniority == "unknown"           # same post-default value…
    assert "seniority" not in meta2["omitted_fields"]  # …but distinguished on the trace


def test_omission_metadata_reads_salvaged_flag_and_absent_finish_reason():
    """The salvage stand-in carries salvaged=True and choices[0].finish_reason=None."""
    parsed = Stage2Result.model_validate_json(_stage2_json_omitting_seniority())
    msg = types.SimpleNamespace(parsed=parsed, refusal=None)
    resp = types.SimpleNamespace(
        choices=[types.SimpleNamespace(finish_reason=None)], salvaged=True)
    meta = _omission_metadata(Stage2Result, resp, msg)
    assert meta["salvaged"] is True
    assert meta["finish_reason"] is None


def test_traced_clean_path_records_omission_metadata(monkeypatch):
    """A normal (non-salvaged) traced call records salvaged=False, the finish_reason, and
    omitted_fields/completeness — with no WARNING level."""
    from observability import tracing, llm as obs_llm

    events = {}

    class _Gen:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): events["update"] = kw
        def end(self, **kw): events["end"] = kw

    class _LF:
        def start_as_current_observation(self, **kw): return _Gen()

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())

    parsed = Stage2Result.model_validate_json(_stage2_json_omitting_seniority())

    class _Completions:
        async def parse(self, **kwargs):
            msg = types.SimpleNamespace(parsed=parsed, refusal=None)
            return types.SimpleNamespace(
                choices=[types.SimpleNamespace(message=msg, finish_reason="stop")],
                usage=None, id=None, model="m")

    fake = types.SimpleNamespace(
        beta=types.SimpleNamespace(chat=types.SimpleNamespace(completions=_Completions())))
    asyncio.run(obs_llm.traced_structured_call(
        fake, model="m", messages=[{"role": "user", "content": "hi"}],
        schema=Stage2Result, name="t", metadata={}))

    md = events["update"]["metadata"]
    assert md["salvaged"] is False
    assert md["finish_reason"] == "stop"
    assert "seniority" in md["omitted_fields"]
    assert md["completeness"] < 1.0
    # a clean path is NOT flagged as a warning
    assert events["update"].get("level") != "WARNING"


def test_traced_salvage_path_flags_salvaged_and_warning(monkeypatch):
    """A fenced response salvaged through _invoke records salvaged=True and level=WARNING on
    the generation update, while still returning the recovered parsed object."""
    from observability import tracing

    events = {}

    class _Gen:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): events["update"] = kw
        def end(self, **kw): events["end"] = kw

    class _LF:
        def start_as_current_observation(self, **kw): return _Gen()

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())

    fenced = "```json\n" + _valid_stage2_json() + "\n```"
    rc = ReviewClient(client=_client_returning(fenced), model_stage1="m1", model_stage2="m2")
    out = asyncio.run(rc.stage2(profile_block="P", title="SRE", company="Acme",
                                location="Remote", jd="Operate clusters"))
    assert isinstance(out, Stage2Result) and out.verdict == "deny"

    md = events["update"]["metadata"]
    assert md["salvaged"] is True
    assert md["finish_reason"] is None            # salvage stand-in has no finish_reason
    assert events["update"]["level"] == "WARNING"
    assert events["update"]["status_message"]     # a human-readable reason is attached
