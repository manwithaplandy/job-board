"""Existing service writers acquire all sorted Job keys before any row mutation."""

import importlib

import pytest
from tests.conftest import requires_db
from tests.test_lifecycle_safety import seed


class RecordedConnection:
    def __init__(self, conn):
        self.conn = conn
        self.statements = []

    def __getattr__(self, name):
        return getattr(self.conn, name)

    def execute(self, sql, params=None):
        self.statements.append((sql, params))
        return self.conn.execute(sql, params)

    def cursor(self):
        owner = self

        class Cursor:
            def __enter__(self):
                self.cur = owner.conn.cursor()
                return self

            def __exit__(self, *args):
                self.cur.close()

            def __getattr__(self, name):
                return getattr(self.cur, name)

            def execute(self, sql, params=None):
                owner.statements.append((sql, params))
                return self.cur.execute(sql, params)

        return Cursor()

    def close(self):
        pass


@requires_db
@pytest.mark.parametrize("operation", ["close", "reopen", "stamp", "floors"])
def test_service_writer_prelocks_all_sorted_job_keys(conn, monkeypatch, operation):
    seed(conn, count=3)
    company_id = conn.execute("SELECT id FROM companies").fetchone()["id"]
    if operation == "reopen":
        conn.execute("UPDATE jobs SET closed_at=now()")
    if operation == "stamp":
        conn.execute("UPDATE jobs SET location='raw'")
        conn.execute(
            "INSERT INTO locations(raw,canonicals,components,source) VALUES ('raw',ARRAY['remote'],'[]','manual')"
        )
    if operation == "floors":
        conn.execute("UPDATE jobs SET title='Senior Engineer'")
        conn.execute(
            "INSERT INTO job_reviews(user_id,job_id,profile_version,seniority) SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',id,'v','unknown' FROM jobs"
        )
    conn.commit()
    recorded = RecordedConnection(conn)
    db = importlib.import_module("job_discovery.db")
    if operation == "close":
        db.close_jobs(recorded, company_id, {"2", "0", "1"})
    elif operation == "reopen":
        db.reopen_jobs(recorded, company_id, {"2", "0", "1"})
    elif operation == "stamp":
        importlib.import_module("job_discovery.locations").stamp_jobs(recorded)
    else:
        monkeypatch.setattr(db, "connect", lambda: recorded)
        importlib.import_module("reviewer.backfill_floors").main()
    writes = [
        i
        for i, (sql, _) in enumerate(recorded.statements)
        if sql.lstrip().upper().startswith("UPDATE")
    ]
    locks = [
        (i, params)
        for i, (sql, params) in enumerate(recorded.statements)
        if "hashtextextended" in sql
    ]
    gates = [
        i
        for i, (sql, _) in enumerate(recorded.statements)
        if "pg_advisory_xact_lock" in sql and "hashtextextended" not in sql
    ]
    assert writes and gates and locks, recorded.statements
    assert min(gates) < min(i for i, _ in locks) < min(writes)
    assert max(i for i, _ in locks) < min(writes)
    assert [params[0] for _, params in locks] == [
        "lifecycle:job:lever:x:0",
        "lifecycle:job:lever:x:1",
        "lifecycle:job:lever:x:2",
    ]


@requires_db
def test_account_erasure_service_prelocks_owned_jobs(conn):
    from tests.test_lifecycle_safety import A, B, connect

    seed(conn, count=3)
    conn.execute(
        "INSERT INTO job_reviews(user_id,job_id,profile_version) SELECT %s,id,'v' FROM jobs WHERE external_id IN ('0','2')",
        (A,),
    )
    conn.execute(
        "INSERT INTO job_reviews(user_id,job_id,profile_version) VALUES (%s,'lever:x:1','v')",
        (B,),
    )
    conn.commit()
    conn.execute("SELECT lifecycle_forget_subject(%s)", (A,))
    with connect() as observer:
        for suffix in ("0", "2"):
            assert not observer.execute(
                "SELECT pg_try_advisory_xact_lock(hashtextextended(%s,0)) locked",
                ("lifecycle:job:lever:x:" + suffix,),
            ).fetchone()["locked"]
        assert observer.execute(
            "SELECT pg_try_advisory_xact_lock(hashtextextended('lifecycle:job:lever:x:1',0)) locked"
        ).fetchone()["locked"]
