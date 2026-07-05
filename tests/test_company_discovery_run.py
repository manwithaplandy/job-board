# tests/test_discovery_run.py
import asyncio
import os


from company_discovery.llm import OutOfCreditsError
from company_discovery.schemas import CompanyReviewResult
from company_discovery.run import review_batch
from tests.conftest import requires_db

USER = "44444444-4444-4444-4444-444444444444"


class StubClient:
    """No network. Verdict keyed off company name; CREDITS -> out of credits; BOOM -> error."""

    def __init__(self):
        self.model = "stub"
        self.calls = []

    async def review(self, *, company_block, name, ats, token):
        self.calls.append(name)
        if name == "CREDITS":
            raise OutOfCreditsError("402 insufficient credits")
        if name == "BOOM":
            raise RuntimeError("model down")
        verdict = {"Linear": "include", "Defense": "exclude"}.get(name, "unknown")
        return CompanyReviewResult(verdict=verdict, confidence="high", reasoning="r")


def _cands(*names):
    return [{"id": i, "name": n, "ats": "greenhouse", "token": n.lower()}
            for i, n in enumerate(names, start=1)]


def test_batch_halts_on_out_of_credits():
    client = StubClient()
    results, halted = asyncio.run(
        review_batch(_cands("Linear", "CREDITS", "Defense"), "P", client, concurrency=1))
    assert halted is True
    reviewed_ids = {cid for cid, res, err in results if res is not None}
    assert 1 in reviewed_ids                 # Linear reviewed before the halt
    # CREDITS produced no result row; the rest are not force-errored
    assert all(err is None for _, _, err in results)


def test_batch_isolates_errors():
    client = StubClient()
    results, halted = asyncio.run(
        review_batch(_cands("Linear", "BOOM"), "P", client, concurrency=2))
    assert halted is False
    by_id = {cid: (res, err) for cid, res, err in results}
    assert by_id[1][0].verdict == "include"
    assert by_id[2][1] is not None and "model down" in by_id[2][1]


def test_review_row_serializes_red_flags_as_json_dicts():
    from company_discovery.run import _review_row
    res = CompanyReviewResult.model_validate({
        "verdict": "exclude",
        "red_flags": [{"category": "defense_military", "note": "defense"}],
    })
    row = _review_row(user_id="u", company_id=1, pv="v1", model="m", res=res, err=None)
    # Stored as plain JSON dicts, not pydantic objects (psycopg Json() uses json.dumps).
    assert row["red_flags"] == [{"category": "defense_military", "note": "defense"}]
    import json
    json.dumps(row["red_flags"])  # must not raise


def test_review_row_error_has_no_ai_columns():
    from company_discovery.run import _review_row
    row = _review_row(user_id="u", company_id=1, pv="v1", model="m", res=None, err="boom")
    assert row["error"] == "boom"
    assert "red_flags" not in row and "verdict" not in row


def test_review_company_one_traces_when_sampled(monkeypatch):
    from observability import tracing
    import contextlib
    from company_discovery.run import review_company_one

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
    monkeypatch.setattr(tracing, "identity", lambda **kw: contextlib.nullcontext())

    c = {"id": 1, "name": "Linear", "ats": "greenhouse", "token": "linear"}
    res = asyncio.run(review_company_one(c, "P", StubClient(), user_id="u1", run_id=7))
    assert res.verdict == "include"
    assert seen["spans"] == 1
    assert seen["span_update"]["metadata"]["verdict"] == "include"


@requires_db
def test_run_writes_reviews_and_reconciles(conn, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO companies (name, ats, token, active, discovery_source) VALUES "
            "('Linear','greenhouse','linear', FALSE, 'dataset'), "
            "('Defense','greenhouse','defense', FALSE, 'dataset')")
        cur.execute(
            "INSERT INTO profiles (user_id, instructions, company_instructions, "
            "company_profile_version, profile_version) "
            "VALUES (%s, 'i', 'prefer devtools, no defense', 'cv1', 'pv1')", (USER,))
    conn.commit()

    import company_discovery.run as run_module
    monkeypatch.setattr(run_module, "CompanyReviewClient", lambda **kw: StubClient())
    monkeypatch.setattr(run_module.dataset, "load_candidates", lambda _d: [])  # skip ingest
    run_module.run(conn)

    with conn.cursor() as cur:
        cur.execute("SELECT token, active FROM companies ORDER BY token")
        active = {r["token"]: r["active"] for r in cur.fetchall()}
        cur.execute("SELECT status, included, excluded FROM discovery_runs ORDER BY id DESC LIMIT 1")
        run = cur.fetchone()
    assert active["linear"] is True and active["defense"] is False
    assert run["status"] == "completed" and run["included"] == 1 and run["excluded"] == 1
