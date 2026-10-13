"""Persisted Task11 ordinary crash recovery; isolated DB and fake S3 only.

Archive-clock substitution below exists only in the disposable test database.
It never changes lifecycle claim time, capacity, roles, production GUCs or controls.
"""

import json
from dataclasses import replace
from datetime import timedelta
from uuid import uuid4
import pytest
from psycopg import sql
from job_discovery import db
from job_discovery.archive import export as worker
from job_discovery.archive.batches import (
    claim_batch,
    seal_batch,
    persist_seal,
    ack_batch,
    recover_batch,
)
from job_discovery.archive.types import BatchLimits
from job_discovery.archive.recovery import RecoveryAuthorization, replace_expired_batch
from job_discovery.archive.s3 import ArchiveClient, put_verify_batch
from job_discovery.archive.outbox import ArchiveBlocked
from job_discovery.lifecycle.claims import claim_work, cancel_claim
from tests.archive_helpers import seeded_events
from tests.conftest import TEST_DSN, requires_db
from tests.test_archive_export import FakeS3, destination

pytestmark = requires_db


def setup_batch(conn, n=3):
    claim, refs = seeded_events(conn, n)
    conn.execute(
        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
    )
    conn.execute(
        "UPDATE lifecycle_control SET export_enabled=true,activation_generation=activation_generation+1"
    )
    conn.execute(
        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
    )
    conn.execute("""UPDATE public_archive_destination SET bucket='fixture-bucket',region='us-east-1',expected_owner='123456789012',
        private_validated=true,encryption_validated=true,policy_validated=true,validation_evidence='offline fixture only'""")
    batch = claim_batch(conn, BatchLimits(max_events=2), claim)
    conn.commit()
    cancel_claim(conn, claim)
    conn.commit()
    return batch, refs


def pending(conn):
    result = tuple(
        (
            r["event_id"],
            bytes(r["canonical_event"]),
            r["occurred_at"],
            json.loads(bytes(r["canonical_event"]))["observed_at"],
            r["recorded_at"],
            r["revision"],
        )
        for r in conn.execute("SELECT * FROM public_pending_events ORDER BY event_id")
    )
    conn.commit()
    return result


class Crash(BaseException):
    pass


@pytest.mark.parametrize(
    "phase",
    ["seal", "data", "manifest", "ambiguous", "verify", "ack-rollback", "ack-commit"],
)
def test_fresh_worker_connection_recovers_each_persisted_boundary(
    conn, monkeypatch, phase
):
    batch, refs = setup_batch(conn)
    original_pending = pending(conn)
    sdk = FakeS3()
    client = ArchiveClient(destination(), sdk)
    opened = []
    original_connect = db.connect

    def connect(dsn):
        fresh = original_connect(dsn)
        opened.append(fresh)
        return fresh

    monkeypatch.setattr(worker.db, "connect", connect)
    original_seal = worker.persist_seal
    original_verify = worker.put_verify_batch
    original_ack = worker.ack_batch
    if phase == "seal":

        def crash_seal(c, s):
            original_seal(c, s)
            c.commit()
            raise Crash()

        monkeypatch.setattr(worker, "persist_seal", crash_seal)
    elif phase in {"data", "manifest"}:
        original_put = sdk.put_object

        def crash_put(**kw):
            original_put(**kw)
            if kw["Key"].endswith(".jsonl.gz" if phase == "data" else ".manifest.json"):
                raise Crash()

        monkeypatch.setattr(sdk, "put_object", crash_put)
    elif phase == "ambiguous":
        sdk.ambiguous = True

        def crash_read(**kwargs):
            raise Crash()

        monkeypatch.setattr(sdk, "get_object", crash_read)
    elif phase == "verify":

        def crash_verify(s, c):
            original_verify(s, c)
            raise Crash()

        monkeypatch.setattr(worker, "put_verify_batch", crash_verify)
    else:

        def crash_ack(c, v, cl):
            original_ack(c, v, cl)
            if phase == "ack-commit":
                c.commit()
            raise Crash()

        monkeypatch.setattr(worker, "ack_batch", crash_ack)
    with pytest.raises(Crash):
        worker.export_once(TEST_DSN, client)
    assert len(opened) == 1 and opened[0].closed
    state = conn.execute(
        "SELECT * FROM public_archive_batches WHERE batch_id=%s", (batch.batch_id,)
    ).fetchone()
    conn.commit()
    old_claim = replace(
        batch.claim, owner_token=state["owner_token"], generation=state["generation"]
    )
    before_retry = dict(sdk.objects)
    if phase != "ack-commit":
        assert pending(conn) == original_pending
    # Discard the first worker/client AND connection; immutable object storage persists.
    monkeypatch.setattr(worker, "persist_seal", original_seal)
    monkeypatch.setattr(worker, "put_verify_batch", original_verify)
    monkeypatch.setattr(worker, "ack_batch", original_ack)
    monkeypatch.setattr(sdk, "put_object", FakeS3.put_object.__get__(sdk))
    monkeypatch.setattr(sdk, "get_object", FakeS3.get_object.__get__(sdk))
    fresh_client = ArchiveClient(destination(), sdk)
    result = worker.export_once(TEST_DSN, fresh_client)
    assert len(opened) == 2 and opened[1].closed and opened[0] is not opened[1]
    if phase != "ack-commit":
        assert result.exact_event_ids == batch.ordered_event_ids
    assert all(sdk.objects[k] == v for k, v in before_retry.items())
    assert {r[0] for r in pending(conn)} == {r.event_id for r in refs} - set(
        batch.ordered_event_ids
    )
    row = conn.execute(
        "SELECT * FROM public_archive_batches WHERE batch_id=%s", (batch.batch_id,)
    ).fetchone()
    assert (
        row["state"] == "acked"
        and row["sealed_at"] == batch.sealed_at
        and row["eligible_until"] == batch.eligible_until
    )
    conn.commit()
    with pytest.raises((RuntimeError, ArchiveBlocked)), conn.transaction():
        ack_batch(
            conn,
            put_verify_batch(seal_batch(replace(batch, claim=old_claim)), fresh_client),
            old_claim,
        )


def set_archive_clock(conn, instant):
    # Dedicated archive eligibility clock only. No user setting or production setter.
    conn.execute(
        sql.SQL(
            "CREATE OR REPLACE FUNCTION lifecycle_private.archive_clock() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=pg_catalog AS {}"
        ).format(
            sql.Literal(
                "SELECT " + sql.Literal(instant).as_string(conn) + "::timestamptz"
            )
        )
    )
    conn.commit()


@pytest.mark.parametrize("replacement_crash", ["data", "ack-rollback"])
def test_verify_ack_crosses_archive_horizon_then_explicit_replacement(
    conn, monkeypatch, replacement_crash
):
    batch, refs = setup_batch(conn)
    claim = claim_work(conn, "archive-export", "singleton", 180)
    ref = recover_batch(conn, batch.batch_id, claim)
    conn.commit()
    seal = seal_batch(ref)
    persist_seal(conn, seal)
    conn.commit()
    sdk = FakeS3()
    client = ArchiveClient(destination(), sdk)
    verified = put_verify_batch(seal, client)
    original = pending(conn)
    set_archive_clock(conn, ref.eligible_until + timedelta(seconds=1))
    with pytest.raises(ArchiveBlocked, match="expired"), conn.transaction():
        ack_batch(conn, verified, claim)
    with pytest.raises(ArchiveBlocked, match="authorization"), conn.transaction():
        replace_expired_batch(conn, ref.batch_id, claim, RecoveryAuthorization(uuid4()))
    assert pending(conn) == original
    cancel_claim(conn, claim)
    conn.commit()
    before = len(sdk.calls)
    assert worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk)) is None
    assert len(sdk.calls) == before and pending(conn) == original
    authorization = uuid4()
    conn.execute(
        """INSERT INTO public_archive_recovery_authorizations(authorization_id,batch_id,event_ids_sha256,manifest_hash,approved_by,reason,expires_at)
        SELECT %s,batch_id,event_ids_sha256,manifest_hash,'fixture operator','explicit offline recovery',clock_timestamp()+interval '1 hour'
        FROM public_archive_batches WHERE batch_id=%s""",
        (authorization, ref.batch_id),
    )
    conn.commit()
    fresh = db.connect(TEST_DSN)
    try:
        new_claim = claim_work(fresh, "archive-export", "singleton", 180)
        fresh.commit()
        with pytest.raises(Crash), fresh.transaction():
            replace_expired_batch(
                fresh, ref.batch_id, new_claim, RecoveryAuthorization(authorization)
            )
            raise Crash()
        assert (
            fresh.execute(
                "SELECT consumed_at FROM public_archive_recovery_authorizations WHERE authorization_id=%s",
                (authorization,),
            ).fetchone()["consumed_at"]
            is None
        )
        fresh.commit()
        replacement = replace_expired_batch(
            fresh, ref.batch_id, new_claim, RecoveryAuthorization(authorization)
        )
        fresh.commit()
        assert replacement.ordered_event_ids == ref.ordered_event_ids
        assert replacement.event_bytes == ref.event_bytes
        assert (
            replacement.prior_batch_id == ref.batch_id
            and replacement.batch_id != ref.batch_id
        )
        assert replacement.sealed_at > ref.eligible_until
        assert replacement.eligible_until - replacement.sealed_at == timedelta(days=730)
        cancel_claim(fresh, new_claim)
        fresh.commit()
    finally:
        fresh.close()
    assert pending(conn) == original
    with pytest.raises((ArchiveBlocked, RuntimeError)), conn.transaction():
        ack_batch(conn, verified, claim)
    original_put = sdk.put_object
    original_ack = worker.ack_batch
    if replacement_crash == "data":

        def crash_put(**kwargs):
            original_put(**kwargs)
            raise Crash()

        monkeypatch.setattr(sdk, "put_object", crash_put)
    else:

        def crash_ack(connection, verified, owner):
            original_ack(connection, verified, owner)
            raise Crash()

        monkeypatch.setattr(worker, "ack_batch", crash_ack)
    with pytest.raises(Crash):
        worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk))
    assert pending(conn) == original
    monkeypatch.setattr(sdk, "put_object", original_put)
    monkeypatch.setattr(worker, "ack_batch", original_ack)
    assert (
        worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk)).exact_event_ids
        == ref.ordered_event_ids
    )
    assert sdk.objects[seal.data_key] == seal.compressed_data
    assert (
        conn.execute(
            "SELECT state FROM public_archive_batches WHERE batch_id=%s",
            (ref.batch_id,),
        ).fetchone()["state"]
        == "superseded"
    )
    assert (
        conn.execute(
            "SELECT replacement_batch_id FROM public_archive_recovery_authorizations WHERE authorization_id=%s",
            (authorization,),
        ).fetchone()["replacement_batch_id"]
        == replacement.batch_id
    )
    conn.commit()
    assert {r[0] for r in pending(conn)} == {r.event_id for r in refs} - set(
        ref.ordered_event_ids
    )


def test_corrupt_manifest_keeps_persisted_pending(conn):
    batch, _ = setup_batch(conn)
    seal = seal_batch(batch)
    sdk = FakeS3()
    sdk.objects[seal.manifest_key] = b"corrupt"
    before = pending(conn)
    with pytest.raises(ValueError):
        worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk))
    assert pending(conn) == before
    calls = len(sdk.calls)
    assert worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk)) is None
    assert len(sdk.calls) == calls and pending(conn) == before
    assert (
        conn.execute(
            "SELECT state FROM public_archive_batches WHERE batch_id=%s",
            (batch.batch_id,),
        ).fetchone()["state"]
        == "sealed"
    )
    assert (
        conn.execute(
            "SELECT diagnostic_code FROM public_archive_quarantine"
        ).fetchone()["diagnostic_code"]
        == "invalid_archive"
    )
    conn.commit()


def test_flag_off_and_unvalidated_destination_never_touch_sdk(conn):
    sdk = FakeS3()
    client = ArchiveClient(destination(), sdk)
    assert worker.export_once(TEST_DSN, client) is None
    setup_batch(conn)
    conn.execute("UPDATE public_archive_destination SET private_validated=false")
    conn.commit()
    with pytest.raises(ArchiveBlocked, match="validation"):
        worker.export_once(TEST_DSN, client)
    assert not sdk.calls


def test_periodic_cleanup_is_bounded_and_retains_pending_and_markers(conn):
    batch, _ = setup_batch(conn)
    worker.export_once(TEST_DSN, ArchiveClient(destination(), FakeS3()))
    before = pending(conn)
    conn.execute(
        "ALTER TABLE public_archive_batch_markers DISABLE TRIGGER archive_immutable"
    )
    conn.execute(
        "UPDATE public_archive_batch_markers SET acked_at=clock_timestamp()-interval '8 days'"
    )
    conn.execute(
        "ALTER TABLE public_archive_batch_markers ENABLE TRIGGER archive_immutable"
    )
    conn.commit()
    claim = claim_work(conn, "archive-export", "cleanup-fixture", 180)
    conn.commit()
    for _ in range(4):
        assert worker.cleanup_terminal(conn, claim, limit=1) == 1
        conn.commit()
    assert worker.cleanup_terminal(conn, claim, limit=1) == 0
    conn.commit()
    assert pending(conn) == before
    assert (
        conn.execute("SELECT count(*) n FROM public_archive_coverage").fetchone()["n"]
        == 2
    )
    assert (
        conn.execute("SELECT count(*) n FROM public_archive_batch_markers").fetchone()[
            "n"
        ]
        == 1
    )
    assert (
        conn.execute("SELECT count(*) n FROM public_archive_batches").fetchone()["n"]
        == 0
    )


def test_quarantine_allows_unaffected_preclaimed_aggregate(conn):
    batch, refs = setup_batch(conn)
    claim = claim_work(conn, "archive", "healthy-fixture", 180)
    healthy = claim_batch(conn, BatchLimits(), claim)
    conn.commit()
    cancel_claim(conn, claim)
    conn.commit()
    sdk = FakeS3()
    sdk.objects[seal_batch(batch).manifest_key] = b"corrupt"
    with pytest.raises(ValueError):
        worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk))
    result = worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk))
    assert result.exact_event_ids == healthy.ordered_event_ids
    assert {row[0] for row in pending(conn)} == set(batch.ordered_event_ids)


def test_new_small_batch_waits_then_flushes_without_network_transaction(
    conn, monkeypatch
):
    # Setup enables only the owned fixture, then put newly seeded events through
    # the real worker's unassigned-batch path. The scalar aggregate query's aged
    # result is injected locally, without modifying any persisted event or clock.
    seeded_events(conn, 1)
    conn.execute(
        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
    )
    conn.execute(
        "UPDATE lifecycle_control SET export_enabled=true,activation_generation=activation_generation+1"
    )
    conn.execute(
        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
    )
    conn.execute("""UPDATE public_archive_destination SET bucket='fixture-bucket',region='us-east-1',expected_owner='123456789012',
        private_validated=true,encryption_validated=true,policy_validated=true,validation_evidence='offline fixture only'""")
    conn.commit()
    sdk = FakeS3()
    assert worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk)) is None
    assert not sdk.calls
    original_connect = db.connect
    opened = []

    class Connection:
        def __init__(self, inner):
            self.inner = inner

        def __getattr__(self, name):
            return getattr(self.inner, name)

        def execute(self, query, params=None):
            cursor = self.inner.execute(query, params)
            if isinstance(query, str) and "min(recorded_at)" in query:
                row = cursor.fetchone()
                assert row["n"] == 1 and row["aged"] is False

                class Result:
                    def fetchone(self):
                        return dict(row, aged=True)

                return Result()
            return cursor

    def connect(dsn):
        fresh = Connection(original_connect(dsn))
        opened.append(fresh)
        return fresh

    monkeypatch.setattr(worker.db, "connect", connect)
    from psycopg.pq import TransactionStatus

    original_put = sdk.put_object

    def put(**kwargs):
        assert opened[-1].info.transaction_status == TransactionStatus.IDLE
        return original_put(**kwargs)

    sdk.put_object = put
    result = worker.export_once(TEST_DSN, ArchiveClient(destination(), sdk))
    assert len(result.exact_event_ids) == 1 and opened[-1].closed
    assert not pending(conn)


def test_task11_additive_migration_reapplies_without_catalog_drift(conn):
    from pathlib import Path
    from tests.lifecycle_helpers import schema_catalog

    before = schema_catalog(conn)
    conn.commit()
    migration = Path("migrations/2026-10-03-07-archive-export.sql").read_text()
    conn.execute(migration)
    conn.commit()
    assert schema_catalog(conn) == before
    conn.commit()
    assert not conn.execute("SELECT * FROM public_archive_destination").fetchall()
    control = conn.execute(
        "SELECT archive_ever_activated,export_enabled,archive_stage FROM lifecycle_control"
    ).fetchone()
    assert control == dict(
        archive_ever_activated=False,
        export_enabled=False,
        archive_stage="never_activated",
    )
