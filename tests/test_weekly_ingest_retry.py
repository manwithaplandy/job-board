"""Weekly ingest failures and interrupted checkpoints remain retryable, offline."""

from contextlib import nullcontext

import psycopg
import pytest
from psycopg.pq import TransactionStatus
from psycopg.rows import dict_row

from company_discovery import enrich_apply, worker
from company_discovery.dataset import Candidate
from tests.conftest import TEST_DSN, requires_db


def candidates(count):
    return [Candidate(f"Retry {i}", "lever", f"retry-{i}") for i in range(count)]


def state(conn):
    rows = conn.execute(
        "SELECT status,finished_at,ingested,errors,backlog,notes FROM discovery_runs ORDER BY id"
    ).fetchall()
    conn.commit()
    return rows


@requires_db
def test_failed_weekly_batch_preserves_committed_progress_and_retries_next_cycle(
    conn, monkeypatch
):
    monkeypatch.setattr(worker.dataset, "load_candidates", lambda _: candidates(55))
    monkeypatch.setattr(worker.config, "BATCH_CAP", 100)
    fetched = []

    def fetch(ats, token):
        assert conn.info.transaction_status == TransactionStatus.IDLE
        fetched.append(token)
        return enrich_apply.EnrichUpdate(token, "offline about", "ats_board")

    monkeypatch.setattr(enrich_apply, "plan_enrichment", fetch)
    real_apply = enrich_apply.apply_enrichment
    written = 0

    def fail_second_batch(c, company, plan):
        nonlocal written
        real_apply(c, company, plan)
        written += 1
        if written == 52:
            raise RuntimeError("transient enrichment persistence failure")

    monkeypatch.setattr(enrich_apply, "apply_enrichment", fail_second_batch)
    with pytest.raises(RuntimeError, match="transient"):
        worker._maybe_ingest(conn)
    conn.rollback()  # Same recovery boundary as process_one.
    failed = state(conn)[0]
    assert (
        conn.execute(
            "SELECT count(*) n FROM companies WHERE enriched_at IS NOT NULL"
        ).fetchone()["n"]
        == 50
    )
    conn.commit()
    monkeypatch.setattr(enrich_apply, "apply_enrichment", real_apply)
    before = len(fetched)
    worker._maybe_ingest(conn)
    assert len(fetched) - before == 5, "failed tick suppressed the next-cycle retry"
    runs = state(conn)
    assert failed["status"] == "error" and failed["finished_at"] is not None
    assert failed["ingested"] == 55 and failed["errors"] == 1 and failed["backlog"] == 5
    assert "enriched 50" in failed["notes"]
    assert len(runs) == 2 and runs[1]["status"] == "completed"
    assert runs[1]["ingested"] == 0 and runs[1]["backlog"] == 0
    assert "enriched 5" in runs[1]["notes"]
    assert (
        conn.execute(
            "SELECT count(*) n FROM companies WHERE enriched_at IS NULL"
        ).fetchone()["n"]
        == 0
    )
    conn.commit()
    worker._maybe_ingest(conn)
    assert (
        len(state(conn)) == 2
    )  # A successful retry restores the normal weekly interval.


@requires_db
@pytest.mark.parametrize("reconnect", [False, True])
def test_interrupted_durable_weekly_marker_recovers(conn, monkeypatch, reconnect):
    class ProcessStopped(BaseException):
        pass

    monkeypatch.setattr(worker.dataset, "load_candidates", lambda _: candidates(1))

    def stop_during_fetch(ats, token):
        assert conn.info.transaction_status == TransactionStatus.IDLE
        raise ProcessStopped()

    monkeypatch.setattr(enrich_apply, "plan_enrichment", stop_during_fetch)
    with pytest.raises(ProcessStopped):
        worker._maybe_ingest(conn)
    interrupted = state(conn)[0]
    if reconnect:
        conn.close()  # The interrupted process's database session is gone.
    resumed_connection = (
        psycopg.connect(TEST_DSN, row_factory=dict_row)
        if reconnect
        else nullcontext(conn)
    )
    with resumed_connection as resumed:
        calls = []

        def fetch(ats, token):
            assert resumed.info.transaction_status == TransactionStatus.IDLE
            calls.append(token)
            return enrich_apply.EnrichUpdate(token, "offline about", "ats_board")

        monkeypatch.setattr(enrich_apply, "plan_enrichment", fetch)
        worker._maybe_ingest(resumed)
        assert calls == ["retry-0"], "orphan running marker suppressed retry"
        runs = state(resumed)
        assert interrupted["status"] == "running" and interrupted["ingested"] == 1
        assert runs[0]["status"] == "error" and runs[0]["finished_at"] is not None
        assert runs[0]["ingested"] == 1 and runs[0]["backlog"] == 1
        assert "interrupted" in runs[0]["notes"]
        assert runs[1]["status"] == "completed" and runs[1]["ingested"] == 0


@requires_db
def test_live_weekly_attempt_is_not_misclassified_as_an_interruption(conn, monkeypatch):
    loads = []
    monkeypatch.setattr(
        worker.dataset, "load_candidates", lambda _: loads.append(1) or candidates(1)
    )

    def fetch(ats, token):
        assert conn.info.transaction_status == TransactionStatus.IDLE
        with psycopg.connect(TEST_DSN, row_factory=dict_row) as other:
            worker._maybe_ingest(other)
        return enrich_apply.EnrichUpdate(token, "offline about", "ats_board")

    monkeypatch.setattr(enrich_apply, "plan_enrichment", fetch)
    worker._maybe_ingest(conn)
    assert loads == [1]
    runs = state(conn)
    assert len(runs) == 1 and runs[0]["status"] == "completed"
