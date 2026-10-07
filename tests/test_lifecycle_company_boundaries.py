"""Offline HTTP/model callbacks observe actual idle connections and a free gate."""

import importlib
from threading import Lock
from types import SimpleNamespace

from psycopg.pq import TransactionStatus
import pytest

from tests.conftest import requires_db
from tests.test_lifecycle_safety import connect
from tests.test_classification_worker import _new_job, _StubClient
from company_discovery import enrich_apply, worker, jobs_db
from company_discovery.dataset import Candidate


_observer_lock = Lock()


def assert_network_boundary(conn):
    assert conn.info.transaction_status == TransactionStatus.IDLE
    # Concurrent fake HTTP callbacks must not contend with each other's probe.
    with _observer_lock, connect() as observer:
        assert observer.execute(
            "SELECT pg_try_advisory_xact_lock(20916294442894917) AS free"
        ).fetchone()["free"]


def companies(conn, count=3):
    rows = []
    for i in range(count):
        rows.append(
            conn.execute(
                "INSERT INTO companies(name,ats,token,active,discovery_source) VALUES (%s,'lever',%s,true,'dataset') RETURNING *",
                (f"Company{i}", f"c{i}"),
            ).fetchone()
        )
    conn.commit()
    return rows


@requires_db
def test_enrichment_batches_never_overlap_network_and_database(conn, monkeypatch):
    rows = companies(conn, 55)
    observed = []

    def fetch(ats, token):
        assert_network_boundary(conn)
        observed.append(token)
        return (
            None
            if token == "c1"
            else enrich_apply.EnrichUpdate(token, "about", "ats_board")
        )

    monkeypatch.setattr(enrich_apply, "plan_enrichment", fetch)
    # Start with the real candidate read transaction too.
    conn.execute("SELECT 1")
    assert enrich_apply.enrich_selected(conn, rows, max_workers=1) == 54
    assert len(observed) == 55
    assert_network_boundary(conn)
    assert (
        conn.execute(
            "SELECT count(*) n FROM companies WHERE enriched_at IS NOT NULL"
        ).fetchone()["n"]
        == 54
    )


@requires_db
@pytest.mark.parametrize("module_name", ["name_backfill", "enrich_backfill"])
def test_streaming_backfills_finish_network_batch_before_writes(
    conn, monkeypatch, module_name
):
    module = importlib.import_module("company_discovery." + module_name)
    companies(conn, 55)

    class Borrowed:
        def __getattr__(self, name):
            return getattr(conn, name)

        def close(self):
            pass

    monkeypatch.setattr("job_discovery.db.connect", lambda: Borrowed())
    seen = []

    def fetch(ats, token):
        assert_network_boundary(conn)
        seen.append(token)
        if token == "c1":
            return None
        return (
            token
            if module_name == "name_backfill"
            else enrich_apply.EnrichUpdate(token, "about", "ats_board")
        )

    monkeypatch.setattr(
        module,
        "fetch_name" if module_name == "name_backfill" else "plan_enrichment",
        fetch,
    )
    module.main()
    assert len(seen) == 55
    assert_network_boundary(conn)
    assert (
        conn.execute(
            "SELECT count(*) n FROM companies WHERE display_name IS NOT NULL"
        ).fetchone()["n"]
        == 54
    )


@requires_db
def test_weekly_ingest_commits_before_enrichment(conn, monkeypatch):
    monkeypatch.setattr(
        worker.dataset, "load_candidates", lambda _: [Candidate("New", "lever", "new")]
    )
    called = []

    def fetch(ats, token):
        assert_network_boundary(conn)
        called.append(token)
        return enrich_apply.EnrichUpdate("New", "about", "ats_board")

    monkeypatch.setattr(enrich_apply, "plan_enrichment", fetch)
    worker._maybe_ingest(conn)
    assert called == ["new"]
    assert (
        conn.execute("SELECT status FROM discovery_runs").fetchone()["status"]
        == "completed"
    )


@requires_db
@pytest.mark.parametrize("serp_enabled", [False, True])
def test_classification_reads_serp_throttle_and_empty_enrichment_are_idle(
    conn, monkeypatch, serp_enabled
):
    companies(conn)
    _new_job(conn, company_cap=3, use_serp=serp_enabled)
    conn.commit()
    job = jobs_db.claim_next_job(conn)
    conn.commit()
    seen = []

    def enrichment(ats, token):
        assert_network_boundary(conn)
        seen.append("enrich")
        return None

    def post(*args, **kwargs):
        assert_network_boundary(conn)
        seen.append("serp")
        return SimpleNamespace(
            raise_for_status=lambda: None,
            json=lambda: {"organic": [{"title": "public snippets"}]},
        )

    def throttle(seconds):
        assert seconds > 0
        assert_network_boundary(conn)
        seen.append("throttle")

    monkeypatch.setattr(enrich_apply, "plan_enrichment", enrichment)
    monkeypatch.setenv("SERPER_API_KEY", "offline-test-key")
    monkeypatch.setattr(worker.serp.requests, "post", post)
    monkeypatch.setattr(
        worker.serp, "time", SimpleNamespace(monotonic=lambda: 0, sleep=throttle)
    )
    monkeypatch.setattr(worker.serp, "_last_call", 0)
    monkeypatch.setattr(worker.serp, "_MIN_INTERVAL", 0.5)
    client = _StubClient(hook=lambda _: assert_network_boundary(conn))
    worker.process_job(conn, job, classify_client=client)
    assert client.calls == 3
    assert seen.count("serp") == (3 if serp_enabled else 0)
    assert seen.count("throttle") == (3 if serp_enabled else 0)
    assert (
        conn.execute("SELECT processed FROM classification_jobs").fetchone()[
            "processed"
        ]
        == 3
    )


@requires_db
def test_company_review_no_success_branch_closes_read_before_model(conn, monkeypatch):
    run = importlib.import_module("company_discovery.run")
    companies(conn)
    seen = []

    def fetch(ats, token):
        assert_network_boundary(conn)
        return None

    monkeypatch.setattr(enrich_apply, "plan_enrichment", fetch)

    class Client:
        model = "offline"

        async def review(self, **kw):
            assert_network_boundary(conn)
            seen.append(kw["token"])
            from company_discovery.schemas import CompanyReviewResult

            return CompanyReviewResult(
                verdict="unknown", confidence="high", reasoning="offline"
            )

    monkeypatch.setattr(run, "CompanyReviewClient", lambda **kw: Client())
    run._review_user(
        conn,
        {
            "user_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "company_instructions": "software",
        },
    )
    assert len(seen) == 3
    assert (
        conn.execute("SELECT status FROM discovery_runs").fetchone()["status"]
        == "completed"
    )


@requires_db
def test_enrichment_database_failure_rolls_back_current_bounded_batch(
    conn, monkeypatch
):
    rows = companies(conn, 55)

    def fetch(ats, token):
        assert_network_boundary(conn)
        return enrich_apply.EnrichUpdate(token, "about", "ats_board")

    original = enrich_apply.apply_enrichment
    calls = []

    def apply(c, cid, plan):
        calls.append(cid)
        original(c, cid, plan)
        if len(calls) == 52:
            raise RuntimeError("second batch persistence failed")

    monkeypatch.setattr(enrich_apply, "plan_enrichment", fetch)
    monkeypatch.setattr(enrich_apply, "apply_enrichment", apply)
    with pytest.raises(RuntimeError, match="second batch"):
        enrich_apply.enrich_selected(conn, rows, max_workers=1)
    assert_network_boundary(conn)
    assert (
        conn.execute(
            "SELECT count(*) n FROM companies WHERE enriched_at IS NOT NULL"
        ).fetchone()["n"]
        == 50
    )
    assert all(r.get("about") is None for r in rows[50:])
