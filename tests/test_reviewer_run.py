import asyncio

import pytest

from reviewer.run import ReviewResult, review_batch, review_one
from reviewer.schemas import Stage1Decision, Stage1Result, Stage2Result


class StubClient:
    """Drives review_one/review_batch without network. Behavior keyed off the title."""

    def __init__(self, *, model_stage1="m1", model_stage2="m2", **_kw):
        # Capture the resolved models the reviewer passes so tests can assert the
        # cheap-gate-always + tier-entitled-stage-2 policy landed on the client.
        self.model_stage1 = model_stage1
        self.model_stage2 = model_stage2
        self.stage2_calls = []
        self.stage1_batch_calls = 0

    async def stage1(self, *, profile_block, title, company, location):
        if title == "BOOM1":
            raise RuntimeError("stage1 down")
        decision = "reject" if title == "Forklift Operator" else "pass"
        return Stage1Result(decision=decision, reason="r")

    async def stage1_batch(self, *, profile_block, jobs):
        self.stage1_batch_calls += 1
        out = []
        for j in jobs:
            title = j["title"]
            if title.startswith("MISSING"):
                continue  # omit → no per-id decision → retryable error
            decision = "reject" if title == "Forklift Operator" else "pass"
            out.append(Stage1Decision(job_id=j["id"], decision=decision, reason="r"))
        return out

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


def test_missing_jd_skips_stage2_and_writes_no_row():
    """When stage-1 passes but description is NULL/empty, stage-2 must NOT run."""
    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE", description=None), "P", client))
    # stage1 passed (SRE is not a forklift operator), but JD is None
    assert res.stage1_decision == "pass"
    # stage2 must NOT run — no verdict, no row
    assert res.verdict is None
    assert client.stage2_calls == []
    assert res.error is None  # not an error; deferred


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


def test_pass_with_missing_jd_defers_stage2():
    """When stage-1 passes but JD is absent, stage-2 is deferred (not run with a placeholder)."""
    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE", description=None), "P", client))
    assert res.stage1_decision == "pass"
    assert res.verdict is None   # deferred — no fabricated score
    assert client.stage2_calls == []  # stage2 must NOT be called


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
    """Batched stage-1 gate + per-job stage 2: a stage-2 error and a missing gate
    decision are isolated; other jobs still complete."""
    client = StubClient()
    cands = [_cand("BOOM2"), _cand("SRE"), _cand("Forklift Operator"), _cand("MISSING-1")]
    results, halted = asyncio.run(review_batch(cands, "P", client, concurrency=2))
    assert not halted
    assert len(results) == 4
    by_title = {r.job_id.split(":")[-1]: r for r in results}
    # stage-2 error isolated onto one job; stage-1 signal preserved
    assert by_title["BOOM2"].stage1_decision == "pass"
    assert by_title["BOOM2"].error is not None and "stage2 down" in by_title["BOOM2"].error
    assert by_title["SRE"].verdict == "approve"
    assert by_title["Forklift Operator"].stage1_decision == "reject"
    # A missing per-id gate decision becomes a retryable error, not a fabricated verdict
    assert by_title["MISSING-1"].error is not None
    assert by_title["MISSING-1"].verdict is None


def test_review_batch_gates_via_stage1_batch():
    """45 candidates are screened in ONE batched stage-1 call (batch cap 50);
    stage 2 runs only for the passes."""
    client = StubClient()
    cands = ([_cand(f"Eng{i}") for i in range(43)]
             + [_cand("Forklift Operator"), _cand("SRE")])
    results, halted = asyncio.run(review_batch(cands, "P", client, concurrency=5))
    assert not halted
    assert client.stage1_batch_calls == 1, "45 candidates fit one batch of 50"
    # 44 pass (43 Eng + SRE) → stage 2 ran 44 times; the forklift reject skips stage 2
    assert len(client.stage2_calls) == 44
    by_title = {r.job_id.split(":")[-1]: r for r in results}
    assert by_title["Forklift Operator"].stage1_decision == "reject"
    assert by_title["Eng0"].verdict == "approve"


def test_missing_stage1_decision_is_error():
    """A candidate absent from the batched stage-1 response becomes a retryable error."""
    client = StubClient()
    results, halted = asyncio.run(
        review_batch([_cand("MISSING-solo")], "P", client, concurrency=1))
    assert not halted and len(results) == 1
    r = results[0]
    assert r.error is not None and r.verdict is None
    assert client.stage2_calls == []  # never reached stage 2


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
    seen = {"span_update": None, "spans": 0}

    class _Span:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def update(self, **kw): seen["span_update"] = kw

    class _LF:
        def start_as_current_observation(self, **kw):
            seen["spans"] += 1
            return _Span()

    monkeypatch.setattr(tracing, "get_langfuse", lambda: _LF())
    monkeypatch.setattr(tracing, "identity", lambda **kw: __import__("contextlib").nullcontext())

    client = StubClient()
    res = asyncio.run(review_one(_cand("SRE"), "P", client, user_id="u1", run_id=7))
    assert res.verdict == "approve"
    assert seen["spans"] == 1
    assert seen["span_update"]["metadata"]["verdict"] == "approve"


import os
import uuid

import pytest

from job_discovery import db as poller_db
from job_discovery.models import Posting
from reviewer import db as rdb
from reviewer import entitlements
from reviewer.llm import OutOfCreditsError
from tests.conftest import requires_db


class _Status402(Exception):
    status_code = 402


class CreditsBoomClient:
    """Raises a 402-shaped error on the first stage1 call; subsequent calls would succeed."""

    def __init__(self):
        self.model_stage1 = "m1"
        self.model_stage2 = "m2"
        self.calls = 0

    async def stage1(self, *, profile_block, title, company, location):
        self.calls += 1
        raise _Status402("insufficient credits")

    async def stage1_batch(self, *, profile_block, jobs):
        self.calls += 1
        raise _Status402("insufficient credits")

    async def stage2(self, **_):  # pragma: no cover
        raise AssertionError("stage2 should never be called after halt")


def test_402_halts_batch_without_writing_skipped_rows():
    """402 on first job → OutOfCreditsError path sets halt; later jobs get no result."""
    client = CreditsBoomClient()
    cands = [
        _cand("Boom402"),
        _cand("SRE"),
        _cand("DataEng"),
    ]
    results, halted = asyncio.run(review_batch(cands, "P", client, concurrency=1))
    assert halted, "halt flag must be set after 402"
    ids = {r.job_id for r in results}
    # boom job was attempted and must not appear (OutOfCreditsError → halt, no result written)
    # SRE and DataEng skipped due to halt → also not in results
    assert "lever:acme:Boom402" not in ids
    assert "lever:acme:SRE" not in ids
    assert "lever:acme:DataEng" not in ids

USER = "22222222-2222-2222-2222-222222222222"


@requires_db
def test_review_all_persists_stage1_error_without_aborting(conn, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        cid = cur.fetchone()["id"]
    # Title starts with MISSING → StubClient.stage1_batch omits it → the run layer
    # records a retryable error row (stage1_decision NULL) without aborting the batch.
    poller_db.upsert_job(conn, cid, "lever", "acme",
                         Posting(external_id="boom", title="MISSING-boom", url="u",
                                 remote=True, raw={"descriptionPlain": "jd"}))
    poller_db.upsert_job(conn, cid, "lever", "acme",
                         Posting(external_id="good", title="SRE", url="u2",
                                 remote=True, raw={"descriptionPlain": "jd"}))
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version, "
            " preferred_locations) VALUES (%s, 'r', 'i', 'v1', ARRAY['Remote'])",
            (USER,),
        )
    conn.commit()

    _entitle(conn, USER)
    import reviewer.run as run_module
    monkeypatch.setattr(run_module, "ReviewClient", lambda **kw: StubClient(**kw))
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
                                 remote=True, raw={"descriptionPlain": "jd"}))
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version, "
            " preferred_locations) VALUES (%s, 'r', 'i', 'v1', ARRAY['Remote'])",
            (USER,),
        )
    conn.commit()

    _entitle(conn, USER)
    import reviewer.run as run_module
    monkeypatch.setattr(run_module, "ReviewClient", lambda **kw: StubClient(**kw))
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


@requires_db
def test_review_all_defers_jd_less_job_and_reselects(conn, monkeypatch):
    """A stage-1 pass with no JD writes NO review row and stays a candidate next run.

    A verdict=NULL/error=NULL row would be unreachable by every re-selection
    predicate at the same profile_version, permanently sticking the job. The
    persist filter must skip it entirely so the job is re-selected once a JD lands.
    """
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        cid = cur.fetchone()["id"]
    # raw={} → extract_description returns None → JD-less job.
    poller_db.upsert_job(conn, cid, "lever", "acme",
                         Posting(external_id="nojd", title="SRE", url="u", remote=True, raw={}))
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version, "
            " preferred_locations) VALUES (%s, 'r', 'i', 'v1', ARRAY['Remote'])",
            (USER,),
        )
    conn.commit()

    _entitle(conn, USER)
    import reviewer.run as run_module
    monkeypatch.setattr(run_module, "ReviewClient", lambda **kw: StubClient(**kw))
    run_module.review_all(conn)

    with conn.cursor() as cur:
        cur.execute(
            "SELECT count(*)::int AS n FROM job_reviews "
            "WHERE user_id = %s AND job_id = 'lever:acme:nojd'",
            (USER,),
        )
        assert cur.fetchone()["n"] == 0, "JD-less deferral must not write a review row"
    # Re-selected on the next run: absent row → r.job_id IS NULL → candidate again.
    cands, _ = rdb.select_candidates(conn, USER, "v1", limit=10)
    assert "lever:acme:nojd" in {c["id"] for c in cands}


@requires_db
def test_review_user_commits_earlier_chunks_on_midbatch_failure(conn, monkeypatch):
    """A mid-batch upsert failure preserves earlier committed chunks.

    Proves the chunked-commit durability guarantee is active through
    _review_user: rows persisted before a later row explodes must survive, and
    iteration must continue past the failure.
    """
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    from reviewer import config
    monkeypatch.setattr(config, "PERSIST_CHUNK_SIZE", 2)
    poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        cid = cur.fetchone()["id"]
    for i in range(5):
        poller_db.upsert_job(conn, cid, "lever", "acme",
                             Posting(external_id=f"e{i}", title=f"Eng{i}", url="u",
                                     remote=True, raw={"descriptionPlain": "jd"}))
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, profile_version, "
            " preferred_locations) VALUES (%s, 'r', 'i', 'v1', ARRAY['Remote'])",
            (USER,),
        )
    conn.commit()

    import reviewer.run as run_module
    monkeypatch.setattr(run_module, "ReviewClient", lambda **kw: StubClient(**kw))
    _entitle(conn, USER)

    seen = []
    original = rdb.upsert_review

    def failing_upsert(c, row):
        seen.append(row["job_id"])
        if len(seen) == 3:
            raise RuntimeError("boom on the 3rd upsert")
        original(c, row)

    monkeypatch.setattr(rdb, "upsert_review", failing_upsert)
    run_module.review_all(conn)

    with conn.cursor() as cur:
        cur.execute("SELECT job_id FROM job_reviews WHERE user_id = %s", (USER,))
        persisted = {r["job_id"] for r in cur.fetchall()}
    assert len(seen) == 5, "iteration must continue past the mid-batch failure"
    failed_id = seen[2]
    assert failed_id not in persisted, "the row that raised must not be persisted"
    assert len(persisted) == 4, "the other four rows (incl. the first chunk) survive"


# --- Per-user daily review budget: cap + usage_counters spend (spec subsystem D) ---

USER_A = "44444444-4444-4444-4444-444444444444"
USER_B = "55555555-5555-5555-5555-555555555555"


def _seed_company(conn):
    poller_db.sync_seed(conn, [{"name": "Acme", "ats": "lever", "token": "acme"}])
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM companies WHERE ats='lever' AND token='acme'")
        return cur.fetchone()["id"]


def _seed_reviewable_job(conn, cid, ext, *, location="Remote", remote=True):
    # Title 'SRE' passes StubClient's gate and reaches an approve verdict.
    poller_db.upsert_job(conn, cid, "lever", "acme",
                         Posting(external_id=ext, title="SRE", url="u",
                                 location=location, remote=remote,
                                 raw={"descriptionPlain": "jd"}))


def _entitle(conn, user_id, *, plan="standard", status="active", invited=False):
    """Give a user an active subscription (or a comped invite) so the reviewer's tier
    gate resolves a plan. Phase 1: a user with no plan is skipped entirely."""
    with conn.cursor() as cur:
        if invited:
            cur.execute("INSERT INTO invite_codes (code, max_uses, uses) VALUES ('SEED', 999, 1) "
                        "ON CONFLICT (code) DO NOTHING")
            cur.execute("INSERT INTO invite_redemptions (email, code, user_id) VALUES (%s, 'SEED', %s) "
                        "ON CONFLICT (email) DO NOTHING", (f"{user_id}@x.com", user_id))
        else:
            cur.execute(
                "INSERT INTO subscriptions (user_id, status, plan, current_period_end) "
                "VALUES (%s, %s, %s, now() + interval '30 days') "
                "ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status, "
                "plan = EXCLUDED.plan, current_period_end = EXCLUDED.current_period_end",
                (user_id, status, plan))
    conn.commit()


def _insert_profile(conn, user_id, *, cap=None, locations=None, model_stage2=None,
                    plan="standard", invited=False):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (user_id, resume_text, instructions, "
            " profile_version, preferred_locations, daily_review_cap, model_stage2) "
            "VALUES (%s, 'r', 'i', 'v1', %s, %s, %s)",
            # Default to a non-empty location filter (mandatory in Phase 1). Remote
            # jobs pass any filter, so ['Remote'] keeps the remote fixtures reviewable.
            (user_id, locations if locations is not None else ["Remote"], cap, model_stage2),
        )
    conn.commit()
    if plan is not None or invited:
        _entitle(conn, user_id, plan=plan or "standard", invited=invited)


def _run_review_all(conn, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    import reviewer.run as run_module
    monkeypatch.setattr(run_module, "ReviewClient", lambda **kw: StubClient(**kw))
    run_module.review_all(conn)


@requires_db
def test_daily_cap_limits_reviews_and_carries_across_runs(conn, monkeypatch):
    """Cap bounds a single run; spend persists so a second same-UTC-day run shrinks."""
    cid = _seed_company(conn)
    for i in range(3):
        _seed_reviewable_job(conn, cid, f"j{i}")
    _insert_profile(conn, USER, cap=2)

    _run_review_all(conn, monkeypatch)
    with conn.cursor() as cur:
        cur.execute("SELECT count(*)::int AS n FROM job_reviews WHERE user_id = %s", (USER,))
        assert cur.fetchone()["n"] == 2, "cap=2 limits the first run to 2 reviews"
    assert rdb.get_daily_spend(conn, USER) == 2

    # Second run same UTC day: remaining budget is 0 → user skipped, note written.
    _run_review_all(conn, monkeypatch)
    with conn.cursor() as cur:
        cur.execute("SELECT count(*)::int AS n FROM job_reviews WHERE user_id = %s", (USER,))
        assert cur.fetchone()["n"] == 2, "no further reviews once the daily budget is spent"
        cur.execute("SELECT notes FROM review_runs WHERE user_id = %s ORDER BY id DESC LIMIT 1",
                    (USER,))
        assert cur.fetchone()["notes"] == "daily cap exhausted"


@requires_db
def test_daily_cap_exhausted_makes_zero_llm_calls(conn, monkeypatch):
    """A user whose budget is pre-spent is skipped entirely: no candidates, no reviews."""
    cid = _seed_company(conn)
    _seed_reviewable_job(conn, cid, "j0")
    _insert_profile(conn, USER, cap=5)
    rdb.add_daily_spend(conn, USER, 5)  # pre-exhaust today's budget
    conn.commit()

    _run_review_all(conn, monkeypatch)
    with conn.cursor() as cur:
        cur.execute("SELECT count(*)::int AS n FROM job_reviews WHERE user_id = %s", (USER,))
        assert cur.fetchone()["n"] == 0
        cur.execute("SELECT notes FROM review_runs WHERE user_id = %s ORDER BY id DESC LIMIT 1",
                    (USER,))
        assert cur.fetchone()["notes"] == "daily cap exhausted"


@requires_db
def test_two_users_different_caps_drain_independently(conn, monkeypatch):
    """Each user's daily cap applies to their own review count in one pass."""
    cid = _seed_company(conn)
    for i in range(4):
        _seed_reviewable_job(conn, cid, f"j{i}")
    _insert_profile(conn, USER_A, cap=1)
    _insert_profile(conn, USER_B, cap=3)

    _run_review_all(conn, monkeypatch)
    with conn.cursor() as cur:
        cur.execute("SELECT count(*)::int AS n FROM job_reviews WHERE user_id = %s", (USER_A,))
        assert cur.fetchone()["n"] == 1
        cur.execute("SELECT count(*)::int AS n FROM job_reviews WHERE user_id = %s", (USER_B,))
        assert cur.fetchone()["n"] == 3
    assert rdb.get_daily_spend(conn, USER_A) == 1
    assert rdb.get_daily_spend(conn, USER_B) == 3


@requires_db
def test_null_cap_uses_tier_entitlement_cap(conn, monkeypatch):
    """A NULL daily_review_cap now derives from the TIER (entitlements.daily_review_cap),
    not the env default. Patch the entitlement cap to 1 to prove the reviewer sources
    the cap from there."""
    monkeypatch.setattr(entitlements, "daily_review_cap", lambda plan, model, ent=None: 1)
    cid = _seed_company(conn)
    for i in range(3):
        _seed_reviewable_job(conn, cid, f"j{i}")
    _insert_profile(conn, USER, cap=None)  # plan='standard', no override → tier cap

    _run_review_all(conn, monkeypatch)
    with conn.cursor() as cur:
        cur.execute("SELECT count(*)::int AS n FROM job_reviews WHERE user_id = %s", (USER,))
        assert cur.fetchone()["n"] == 1, "NULL cap → tier entitlement cap (patched to 1)"


@requires_db
def test_profile_cap_override_cannot_raise_above_tier_cap(conn, monkeypatch):
    """Cost integrity (B-COST): a daily_review_cap override may only LOWER the tier
    cap, never raise it. Patch the tier cap to 1, set an inflated override of 100 (as if
    a user forced it up via a direct write), and prove the run is still clamped to 1."""
    monkeypatch.setattr(entitlements, "daily_review_cap", lambda plan, model, ent=None: 1)
    cid = _seed_company(conn)
    for i in range(3):
        _seed_reviewable_job(conn, cid, f"j{i}")
    _insert_profile(conn, USER, cap=100)  # override well above the tier cap of 1

    _run_review_all(conn, monkeypatch)
    with conn.cursor() as cur:
        cur.execute("SELECT count(*)::int AS n FROM job_reviews WHERE user_id = %s", (USER,))
        assert cur.fetchone()["n"] == 1, "override=100 clamped down to tier cap 1"


@requires_db
def test_profile_cap_override_still_lowers_below_tier_cap(conn, monkeypatch):
    """The override remains an effective operator lever DOWNWARD: with the tier cap at
    5 and an override of 2, the run is bounded by the lower override."""
    monkeypatch.setattr(entitlements, "daily_review_cap", lambda plan, model, ent=None: 5)
    cid = _seed_company(conn)
    for i in range(4):
        _seed_reviewable_job(conn, cid, f"j{i}")
    _insert_profile(conn, USER, cap=2)  # override below the tier cap of 5

    _run_review_all(conn, monkeypatch)
    with conn.cursor() as cur:
        cur.execute("SELECT count(*)::int AS n FROM job_reviews WHERE user_id = %s", (USER,))
        assert cur.fetchone()["n"] == 2, "override=2 lowers the effective cap below tier 5"


@requires_db
def test_no_subscription_user_is_skipped(conn, monkeypatch):
    """No plan (no subscription, not invited) → skipped, 'no active subscription' note."""
    cid = _seed_company(conn)
    _seed_reviewable_job(conn, cid, "j0")
    _insert_profile(conn, USER, plan=None)

    _run_review_all(conn, monkeypatch)
    with conn.cursor() as cur:
        cur.execute("SELECT count(*)::int AS n FROM job_reviews WHERE user_id = %s", (USER,))
        assert cur.fetchone()["n"] == 0
        cur.execute("SELECT notes FROM review_runs WHERE user_id = %s ORDER BY id DESC LIMIT 1", (USER,))
        assert cur.fetchone()["notes"] == "no active subscription"


@requires_db
def test_comped_invited_user_reviewed_at_standard(conn, monkeypatch):
    """An invited (comped) user with no subscription is reviewed at Standard (cheap)."""
    cid = _seed_company(conn)
    _seed_reviewable_job(conn, cid, "j0")
    _insert_profile(conn, USER, plan=None, invited=True)

    _run_review_all(conn, monkeypatch)
    with conn.cursor() as cur:
        cur.execute("SELECT model_stage1, model_stage2 FROM job_reviews WHERE user_id = %s", (USER,))
        row = cur.fetchone()
        assert row is not None, "comped invitee should be reviewed"
        assert row["model_stage1"] == entitlements.CHEAP_MODEL
        assert row["model_stage2"] == entitlements.CHEAP_MODEL


@requires_db
def test_empty_locations_skipped(conn, monkeypatch):
    """A plan'd user with an empty location filter is skipped (mandatory filter)."""
    cid = _seed_company(conn)
    _seed_reviewable_job(conn, cid, "j0")
    _insert_profile(conn, USER, locations=[])

    _run_review_all(conn, monkeypatch)
    with conn.cursor() as cur:
        cur.execute("SELECT count(*)::int AS n FROM job_reviews WHERE user_id = %s", (USER,))
        assert cur.fetchone()["n"] == 0
        cur.execute("SELECT notes FROM review_runs WHERE user_id = %s ORDER BY id DESC LIMIT 1", (USER,))
        assert cur.fetchone()["notes"] == "location filter required"


@requires_db
def test_pro_premium_stage2_and_cheap_gate_always(conn, monkeypatch):
    """A Pro user who requests the premium stage-2 model gets it; stage 1 is always the
    cheap gate regardless of any stored model_stage1."""
    cid = _seed_company(conn)
    _seed_reviewable_job(conn, cid, "j0")
    _insert_profile(conn, USER, plan="pro", model_stage2=entitlements.PREMIUM_MODEL)

    _run_review_all(conn, monkeypatch)
    with conn.cursor() as cur:
        cur.execute("SELECT model_stage1, model_stage2 FROM job_reviews WHERE user_id = %s", (USER,))
        row = cur.fetchone()
        assert row["model_stage1"] == entitlements.CHEAP_MODEL
        assert row["model_stage2"] == entitlements.PREMIUM_MODEL


@requires_db
def test_standard_non_entitled_premium_falls_back_to_cheap(conn, monkeypatch):
    """A Standard user who requests the premium model has stage 2 fall back to cheap."""
    cid = _seed_company(conn)
    _seed_reviewable_job(conn, cid, "j0")
    _insert_profile(conn, USER, plan="standard", model_stage2=entitlements.PREMIUM_MODEL)

    _run_review_all(conn, monkeypatch)
    with conn.cursor() as cur:
        cur.execute("SELECT model_stage2 FROM job_reviews WHERE user_id = %s", (USER,))
        assert cur.fetchone()["model_stage2"] == entitlements.CHEAP_MODEL


@requires_db
def test_deleted_user_midrun_skips_all_writes(conn, monkeypatch):
    """M-RESURRECT-2: if the account is erased while a run is in flight (tombstone
    present at the write boundary), the reviewer persists NO job_reviews and charges NO
    daily spend — it must not resurrect PII or usage rows for a deleted user."""
    cid = _seed_company(conn)
    for i in range(3):
        _seed_reviewable_job(conn, cid, f"j{i}")
    _insert_profile(conn, USER, cap=5)
    # Simulate the erasure landing mid-run: the profile was loaded, then the deletion
    # cascade wrote the account_deletions tombstone before the reviewer's final writes.
    with conn.cursor() as cur:
        cur.execute("INSERT INTO account_deletions (user_id) VALUES (%s)", (USER,))
    conn.commit()

    _run_review_all(conn, monkeypatch)

    with conn.cursor() as cur:
        cur.execute("SELECT count(*)::int AS n FROM job_reviews WHERE user_id = %s", (USER,))
        assert cur.fetchone()["n"] == 0, "no verdicts written for a tombstoned user"
        cur.execute("SELECT notes FROM review_runs ORDER BY id DESC LIMIT 1")
        assert cur.fetchone()["notes"] == "account deleted mid-run; skipped writes"
    # No daily budget charged either.
    assert rdb.get_daily_spend(conn, USER) == 0


@requires_db
def test_multi_user_disjoint_location_scoped_reviews_in_one_pass(conn, monkeypatch):
    """T7 proof: two profiles with different locations + caps → disjoint, correctly
    scoped job_reviews for both, each location pre-filter + budget applied
    independently, two review_runs rows with distinct user_id."""
    cid = _seed_company(conn)
    _seed_reviewable_job(conn, cid, "nyc", location="New York, NY", remote=False)
    _seed_reviewable_job(conn, cid, "sf", location="San Francisco, CA", remote=False)
    _seed_reviewable_job(conn, cid, "rem", location="Remote", remote=True)
    _insert_profile(conn, USER_A, cap=10, locations=["New York, NY"])
    _insert_profile(conn, USER_B, cap=10, locations=["San Francisco, CA"])

    _run_review_all(conn, monkeypatch)

    with conn.cursor() as cur:
        cur.execute("SELECT job_id FROM job_reviews WHERE user_id = %s", (USER_A,))
        a_jobs = {r["job_id"] for r in cur.fetchall()}
        cur.execute("SELECT job_id FROM job_reviews WHERE user_id = %s", (USER_B,))
        b_jobs = {r["job_id"] for r in cur.fetchall()}
        cur.execute("SELECT DISTINCT user_id FROM review_runs WHERE user_id IS NOT NULL")
        run_users = {str(r["user_id"]) for r in cur.fetchall()}

    # Each user sees only their location + remote; the other metro is filtered out.
    assert a_jobs == {"lever:acme:nyc", "lever:acme:rem"}
    assert b_jobs == {"lever:acme:sf", "lever:acme:rem"}
    # A user's board carries none of the other's metro-specific rows.
    assert "lever:acme:sf" not in a_jobs
    assert "lever:acme:nyc" not in b_jobs
    # One attributable run row per user.
    assert run_users == {USER_A, USER_B}
