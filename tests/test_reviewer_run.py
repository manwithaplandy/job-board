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
        )


def _cand(title, ats="lever", raw=None):
    return {"id": f"lever:acme:{title}", "title": title, "location": "Remote",
            "ats": ats, "company_name": "Acme",
            "raw": raw if raw is not None else {"descriptionPlain": "jd"}}


def test_gate_reject_skips_stage2():
    client = StubClient()
    res = asyncio.run(review_one(_cand("Forklift Operator"), "P", client))
    assert res.stage1_decision == "reject"
    assert res.verdict is None and res.industry is None
    assert client.stage2_calls == []  # stage 2 never ran


def test_pass_runs_stage2_with_extracted_jd():
    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE"), "P", client))
    assert res.stage1_decision == "pass" and res.verdict == "approve"
    assert res.description == "jd"
    assert client.stage2_calls == ["jd"]


def test_pass_with_missing_jd_uses_placeholder():
    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE", raw={}), "P", client))
    assert res.verdict == "approve"
    assert res.description is None
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
    assert set(row) == {
        "user_id", "job_id", "profile_version", "stage1_decision", "stage1_reason",
        "verdict", "experience_match", "industry", "industry_subcategory",
        "confidence", "reasoning", "model_stage1", "model_stage2", "error",
    }


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
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    cid = poller_db.sync_companies(
        conn, [{"name": "Acme", "ats": "lever", "token": "acme"}]
    )[("lever", "acme")]
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
    monkeypatch.setattr(run_module, "ReviewClient", lambda: StubClient())
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
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    cid = poller_db.sync_companies(
        conn, [{"name": "Acme", "ats": "lever", "token": "acme"}]
    )[("lever", "acme")]
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
    monkeypatch.setattr(run_module, "ReviewClient", lambda: StubClient())
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
