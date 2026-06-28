import asyncio

import pytest

from reviewer.run import ReviewResult, review_batch, review_one
from reviewer.schemas import Stage1Result, Stage2Result


class StubClient:
    """Drives review_one without network. Behavior keyed off the title."""

    def __init__(self):
        self.model_stage1 = "m1"
        self.model_stage2 = "m2"
        self.stage2_calls = []

    async def stage1(self, *, profile_block, title, company, location):
        if title == "BOOM1":
            raise RuntimeError("stage1 down")
        decision = "reject" if title == "Forklift Operator" else "pass"
        return Stage1Result(decision=decision, reason="r")

    async def stage2(self, *, profile_block, title, company, location, jd):
        self.stage2_calls.append(jd)
        if title == "BOOM2":
            raise RuntimeError("stage2 down")
        return Stage2Result(
            verdict="approve", experience_match="match",
            industry="software_internet", industry_subcategory="devtools_platforms",
            confidence="high", reasoning="fit",
            role_category="Backend", skills_score=80, experience_score=70, comp_score=60,
            red_flags=["on-call"], requirements=[{"text": "Go", "met": False}],
        )


def _cand(title, ats="lever", description="jd"):
    return {"id": f"lever:acme:{title}", "title": title, "location": "Remote",
            "ats": ats, "company_name": "Acme", "description": description}


def test_gate_reject_skips_stage2():
    client = StubClient()
    res = asyncio.run(review_one(_cand("Forklift Operator"), "P", client))
    assert res.stage1_decision == "reject"
    assert res.verdict is None and res.industry is None
    assert client.stage2_calls == []  # stage 2 never ran


def test_pass_runs_stage2_with_stored_jd():
    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE"), "P", client))
    assert res.stage1_decision == "pass" and res.verdict == "approve"
    assert client.stage2_calls == ["jd"]


def test_pass_with_missing_jd_uses_placeholder():
    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE", description=None), "P", client))
    assert res.verdict == "approve"
    assert client.stage2_calls and "no description" in client.stage2_calls[0].lower()


def test_stage1_error_isolated():
    client = StubClient()
    res = asyncio.run(review_one(_cand("BOOM1"), "P", client))
    assert res.error is not None and "stage1 down" in res.error
    assert res.stage1_decision is None


def test_stage2_error_isolated_keeps_stage1():
    client = StubClient()
    res = asyncio.run(review_one(_cand("BOOM2"), "P", client))
    assert res.stage1_decision == "pass"
    assert res.verdict is None
    assert res.error is not None and "stage2 down" in res.error


def test_batch_continues_past_one_failure():
    client = StubClient()
    cands = [_cand("BOOM1"), _cand("SRE"), _cand("Forklift Operator")]
    results = asyncio.run(review_batch(cands, "P", client, concurrency=2))
    assert len(results) == 3
    by_title = {r.job_id.split(":")[-1]: r for r in results}
    assert by_title["BOOM1"].error is not None
    assert by_title["SRE"].verdict == "approve"
    assert by_title["Forklift Operator"].stage1_decision == "reject"


def test_as_row_maps_all_columns():
    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE"), "P", client))
    row = res.as_row(user_id="u", profile_version="v1")
    assert row["user_id"] == "u" and row["profile_version"] == "v1"
    assert row["job_id"] == "lever:acme:SRE"
    from reviewer.db import _REVIEW_COLUMNS
    assert set(row) == set(_REVIEW_COLUMNS)


def test_fit_score_computed_and_requirements_serialized():
    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE"), "P", client))
    # base = 0.45*80+0.30*70+0.25*60 = 72; +4(match)+3(high) -3(1 flag) = 76
    assert res.fit_score == 76
    assert res.role_category == "Backend"
    assert res.requirements == [{"text": "Go", "met": False}]  # list[dict], JSONB-ready


def test_review_one_traces_when_enabled_and_sampled(monkeypatch):
    from observability import tracing
    seen = {"trace": None, "spans": 0}

    class _Span:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): pass

    class _LF:
        def start_as_current_observation(self, **kw):
            seen["spans"] += 1
            return _Span()
        def update_current_trace(self, **kw):
            seen["trace"] = kw

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())
    monkeypatch.setattr(tracing, "should_sample", lambda: True)
    monkeypatch.setattr(tracing, "identity", lambda **kw: __import__("contextlib").nullcontext())

    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE"), "P", client, user_id="u1", run_id=7))
    assert res.verdict == "approve"
    assert seen["spans"] == 1
    assert seen["trace"]["metadata"]["verdict"] == "approve"


def test_review_one_skips_span_when_not_sampled(monkeypatch):
    from observability import tracing
    calls = {"n": 0}

    class _LF:
        def start_as_current_observation(self, **kw):
            calls["n"] += 1
            raise AssertionError("should not create a span when not sampled")

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())
    monkeypatch.setattr(tracing, "should_sample", lambda: False)
    res = asyncio.run(review_one(_cand("SRE"), "P", StubClient(), user_id="u1", run_id=7))
    assert res.verdict == "approve"  # review still runs
    assert calls["n"] == 0


import os
import uuid

from poller import db as poller_db
from poller.models import Posting
from reviewer import db as rdb
from tests.conftest import requires_db

USER = "22222222-2222-2222-2222-222222222222"


@requires_db
def test_review_all_persists_stage1_error_without_aborting(conn, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        cid = cur.fetchone()["id"]
    poller_db.upsert_job(conn, cid, "lever", "acme",
                         Posting(external_id="boom", title="BOOM1", url="u",
                                 raw={"descriptionPlain": "jd"}))
    poller_db.upsert_job(conn, cid, "lever", "acme",
                         Posting(external_id="good", title="SRE", url="u2",
                                 raw={"descriptionPlain": "jd"}))
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version) "
            "VALUES (%s, 'r', 'i', 'v1')",
            (USER,),
        )
    conn.commit()

    import reviewer.run as run_module
    monkeypatch.setattr(run_module, "ReviewClient", lambda **kw: StubClient())
    run_module.review_all(conn)

    with conn.cursor() as cur:
        cur.execute(
            "SELECT job_id, stage1_decision, error FROM job_reviews WHERE user_id = %s",
            (USER,)
        )
        rows = {r["job_id"]: r for r in cur.fetchall()}
        cur.execute("SELECT * FROM review_runs ORDER BY id DESC LIMIT 1")
        rr = cur.fetchone()

    # errored job has null stage1_decision and error set
    boom_row = rows.get("lever:acme:boom")
    assert boom_row is not None, "errored job should have a job_reviews row"
    assert boom_row["stage1_decision"] is None
    assert boom_row["error"] is not None

    # good job was approved
    good_row = rows.get("lever:acme:good")
    assert good_row is not None
    assert good_row["error"] is None

    # run finished, error-exclusive counting
    assert rr["finished_at"] is not None
    assert rr["errors"] == 1
    assert rr["approved"] == 1
    assert rr["reviewed"] == 1  # errored job not counted in reviewed


@requires_db
def test_review_all_writes_verdicts_and_run(conn, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        cid = cur.fetchone()["id"]
    poller_db.upsert_job(conn, cid, "lever", "acme",
                         Posting(external_id="1", title="SRE", url="u",
                                 raw={"descriptionPlain": "jd"}))
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version) "
            "VALUES (%s, 'r', 'i', 'v1')",
            (USER,),
        )
    conn.commit()

    import reviewer.run as run_module
    monkeypatch.setattr(run_module, "ReviewClient", lambda **kw: StubClient())
    run_module.review_all(conn)

    with conn.cursor() as cur:
        cur.execute("SELECT verdict, profile_version FROM job_reviews WHERE user_id = %s",
                    (USER,))
        rev = cur.fetchone()
        cur.execute("SELECT description FROM jobs WHERE id = 'lever:acme:1'")
        desc = cur.fetchone()["description"]
        cur.execute("SELECT * FROM review_runs ORDER BY id DESC LIMIT 1")
        rr = cur.fetchone()
    assert rev["verdict"] == "approve" and rev["profile_version"] == "v1"
    assert desc == "jd"
    assert rr["approved"] == 1 and rr["finished_at"] is not None
