"""Checkpoint A: real sessions, catalog inventory and adversarial capabilities."""

from concurrent.futures import ThreadPoolExecutor
import importlib
import json
import time

import psycopg
import pytest
from psycopg.rows import dict_row
from tests.conftest import TEST_DSN, as_user, requires_db
from tests.test_lifecycle_identity import seed

A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


def api(name):
    return importlib.import_module("job_discovery.lifecycle." + name)


def enforced(conn):
    """Test-only DDL fixture; production readiness is deliberately unavailable."""
    conn.execute(
        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
    )
    conn.execute(
        "UPDATE lifecycle_control SET safety_stage='enforced', activation_generation=activation_generation+1"
    )
    conn.execute(
        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
    )
    conn.commit()


def version(conn):
    api("identity").migrate_identity_batch(conn)
    row = conn.execute(
        "INSERT INTO job_versions(job_id,source_listing_id,revision,content_hash,public_metadata,observed_at) SELECT job_id,id,1,repeat('a',64),'{}',clock_timestamp() FROM source_listings WHERE job_id='lever:x:0' RETURNING id"
    ).fetchone()
    conn.execute(
        "UPDATE jobs SET description_version_id=%s WHERE id='lever:x:0'", (row["id"],)
    )
    conn.commit()
    return row["id"]


def connect():
    return psycopg.connect(TEST_DSN, row_factory=dict_row)


@requires_db
def test_catalog_gate_covers_all_tables_and_fk_ancestors(conn):
    required = {
        "jobs",
        "job_questions",
        "job_reviews",
        "review_corrections",
        "application_packages",
        "resume_scores",
        "cover_letter_edits",
        "generation_jobs",
        "job_payload_demands",
        "lifecycle_claims",
        "capacity_reservations",
        "source_enumerations",
        "enumeration_members",
        "reconciliation_checkpoints",
        "source_accounts",
        "source_listings",
        "job_versions",
        "company_sources",
        "company_brands",
        "job_locations",
        "job_skills",
        "identity_assertions",
        "companies",
        "profiles",
        "matching_activity",
        "account_deletions",
    }
    rows = conn.execute(
        "SELECT c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE t.tgname='lifecycle_pre_dml'"
    ).fetchall()
    covered = {r["relname"] for r in rows}
    assert required <= covered
    # Every FK parent of an in-scope table must take the gate before a cascade
    # or parent UPDATE acquires row/FK locks.
    parents = conn.execute(
        "SELECT DISTINCT p.relname FROM pg_constraint f JOIN pg_class p ON p.oid=f.confrelid JOIN pg_class c ON c.oid=f.conrelid WHERE f.contype='f' AND c.relname=ANY(%s)",
        (sorted(covered),),
    ).fetchall()
    assert {r["relname"] for r in parents} <= covered
    children = conn.execute(
        "SELECT DISTINCT c.relname FROM pg_constraint f JOIN pg_class p ON p.oid=f.confrelid JOIN pg_class c ON c.oid=f.conrelid WHERE f.contype='f' AND p.relname=ANY(%s)",
        (sorted(covered),),
    ).fetchall()
    assert {r["relname"] for r in children} <= covered


@requires_db
def test_claim_fencing_replay_and_crash_reservation(conn):
    claim = api("claims").claim_work(conn, "source", "board", 180)
    assert claim and claim.lease_until.tzinfo
    reservation = api("capacity").reserve_capacity(conn, claim, 4096)
    conn.commit()
    assert api("claims").claim_work(conn, "source", "board", 180) is None
    conn.rollback()
    conn.execute(
        "UPDATE lifecycle_claims SET lease_until=clock_timestamp()-interval '1 second'"
    )
    conn.commit()
    # Expiry does not release the held bytes.
    assert (
        conn.execute(
            "SELECT sum(bytes) n FROM capacity_reservations WHERE state='held'"
        ).fetchone()["n"]
        == 4096
    )
    conn.rollback()
    with connect() as restarted:
        newer = api("claims").claim_work(restarted, "source", "board", 180)
        assert newer.generation > claim.generation
    with pytest.raises(Exception, match="stale|expired|fenced"):
        api("claims").validate_claim(conn, claim)
    conn.rollback()
    assert (
        conn.execute(
            "SELECT state FROM capacity_reservations WHERE id=%s", (reservation.id,)
        ).fetchone()["state"]
        == "fenced"
    )
    assert (
        conn.execute("SELECT replay_floor FROM lifecycle_claims").fetchone()[
            "replay_floor"
        ]
        >= claim.generation
    )


@requires_db
def test_concurrent_reservations_include_all_held_even_expired(conn):
    c1 = api("claims").claim_work(conn, "source", "one", 180)
    conn.commit()
    c2 = api("claims").claim_work(conn, "source", "two", 180)
    conn.commit()
    # Two reservations of 3100MiB exceed 6000MiB together without allocating data.
    first = api("capacity").reserve_capacity(conn, c1, 3100 * 1024**2)
    with ThreadPoolExecutor() as pool:

        def second():
            with connect() as c:
                return api("capacity").reserve_capacity(c, c2, 3100 * 1024**2)

        future = pool.submit(second)
        time.sleep(0.1)
        assert not future.done()
        conn.commit()
        assert future.result(5) is None
    assert first
    conn.execute(
        "UPDATE lifecycle_claims SET lease_until=clock_timestamp()-interval '1 second' WHERE owner_token=%s",
        (c1.owner_token,),
    )
    conn.commit()
    assert api("capacity").reserve_capacity(conn, c2, 3100 * 1024**2) is None


@requires_db
def test_expired_claim_rejected_at_commit(conn):
    claim = api("claims").claim_work(conn, "source", "one", 180)
    conn.commit()
    api("claims").validate_claim(conn, claim)
    conn.execute(
        "UPDATE lifecycle_claims SET lease_until=clock_timestamp()-interval '1 second'"
    )
    with pytest.raises(Exception, match="stale|expired|fenced"):
        conn.commit()
    conn.rollback()


@requires_db
def test_growth_without_reservation_and_guc_bypass_fail(conn):
    seed(conn)
    conn.commit()
    enforced(conn)
    conn.execute("SELECT set_config('lifecycle.safety_stage','legacy',true)")
    with pytest.raises(Exception, match="growth_without_reservation"):
        conn.execute("UPDATE jobs SET description=repeat('x',5000)")
    conn.rollback()


@requires_db
def test_valid_capacity_is_backend_transaction_scope_and_owner_bound(conn):
    seed(conn)
    vid = version(conn)
    claim = api("claims").claim_work(conn, "payload", "lever:x:0", 180)
    res = api("capacity").reserve_capacity(conn, claim, 32768)
    conn.commit()
    enforced(conn)
    api("capacity").bind_reservation(
        conn,
        res,
        job_id="lever:x:0",
        scope="job_reviews",
        subject_id=A,
        invoking_role="authenticated",
    )
    with as_user(conn, B):
        with pytest.raises(Exception, match="capacity|reservation|owner"):
            conn.execute(
                "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict,job_version_id,description_snapshot) VALUES (%s,'lever:x:0','v','approve',%s,repeat('x',100))",
                (B, vid),
            )
    # Rolled-back binding cannot be replayed from another backend using a token GUC.
    with connect() as other:
        with as_user(other, A):
            other.execute(
                "SELECT set_config('lifecycle.reservation',%s,true)", (str(res.id),)
            )
            with pytest.raises(
                Exception, match="growth_without_reservation|capacity reservation"
            ):
                other.execute(
                    "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict,job_version_id,description_snapshot) VALUES (%s,'lever:x:0','v','approve',%s,'payload')",
                    (A, vid),
                )
    api("capacity").bind_reservation(
        conn,
        res,
        job_id="lever:x:0",
        scope="job_reviews",
        subject_id=A,
        invoking_role="authenticated",
    )
    conn.execute("SET LOCAL ROLE authenticated")
    conn.execute(
        "SELECT set_config('request.jwt.claims',%s,true)",
        (json.dumps({"sub": A, "role": "authenticated"}),),
    )
    conn.execute(
        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict,job_version_id,description_snapshot) VALUES (%s,'lever:x:0','v','approve',%s,'payload')",
        (A, vid),
    )
    conn.commit()


@requires_db
def test_zero_growth_own_protection_and_foreign_user_rejected(conn):
    seed(conn)
    vid = version(conn)
    enforced(conn)
    with as_user(conn, A):
        conn.execute(
            "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict,job_version_id) VALUES (%s,'lever:x:0','v','approve',%s)",
            (A, vid),
        )
        assert conn.execute("SELECT count(*) n FROM job_reviews").fetchone()["n"] == 1
    with as_user(conn, A):
        with pytest.raises(Exception):
            conn.execute(
                "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict,job_version_id) VALUES (%s,'lever:x:0','v','approve',%s)",
                (B, vid),
            )


@requires_db
@pytest.mark.parametrize("approval_first", [True, False])
def test_approval_retirement_two_session_orders(conn, approval_first):
    seed(conn)
    vid = version(conn)
    enforced(conn)

    def approve(c):
        c.execute(
            "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict,job_version_id) VALUES (%s,'lever:x:0','v','approve',%s)",
            (A, vid),
        )

    def retire(c):
        c.execute(
            "UPDATE jobs SET description=NULL,description_pruned=true WHERE id='lever:x:0'"
        )

    first, second = (approve, retire) if approval_first else (retire, approve)
    first(conn)
    with ThreadPoolExecutor() as pool:

        def competing():
            with connect() as c:
                second(c)

        future = pool.submit(competing)
        time.sleep(0.1)
        assert not future.done()
        conn.commit()
        with pytest.raises(Exception, match="protected|payload"):
            future.result(5)
    if approval_first:
        assert (
            conn.execute("SELECT description FROM jobs").fetchone()["description"]
            == "legacy description"
        )


@requires_db
def test_opposite_multi_job_order_and_profile_root_take_gate(conn):
    seed(conn, 2)
    conn.execute("INSERT INTO profiles(user_id,profile_version) VALUES (%s,'v')", (A,))
    conn.commit()
    api("locks").enter_gate(conn)
    with ThreadPoolExecutor() as pool:

        def mutate():
            with connect() as c:
                c.execute("DELETE FROM profiles WHERE user_id=%s", (A,))
                c.execute("UPDATE jobs SET title='two' WHERE id='lever:x:1'")
                c.execute("UPDATE jobs SET title='one' WHERE id='lever:x:0'")

        future = pool.submit(mutate)
        time.sleep(0.1)
        assert not future.done()
        conn.execute("UPDATE jobs SET title='first' WHERE id='lever:x:0'")
        conn.execute("UPDATE jobs SET title='first' WHERE id='lever:x:1'")
        # If root DELETE locked profiles before the gate this would block.
        conn.execute(
            "SELECT user_id FROM profiles WHERE user_id=%s FOR UPDATE NOWAIT", (A,)
        )
        conn.commit()
        future.result(5)
    assert conn.execute("SELECT count(*) n FROM matching_activity").fetchone()["n"] == 0


@requires_db
def test_private_helper_catalog_and_attempted_calls(conn):
    funcs = conn.execute(
        "SELECT p.oid::regprocedure::text name,p.proconfig,p.prosecdef,has_function_privilege('authenticated',p.oid,'EXECUTE') auth,has_function_privilege('anon',p.oid,'EXECUTE') anon FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='lifecycle_private'"
    ).fetchall()
    assert funcs
    for row in funcs:
        assert row["prosecdef"] and row["proconfig"] == ["search_path=pg_catalog"]
        assert not row["auth"] and not row["anon"]
        for role in ["anon", "authenticated"]:
            conn.rollback()
            conn.execute("SET LOCAL ROLE " + role)
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                conn.execute("SELECT " + row["name"])
    conn.rollback()


@requires_db
def test_reservation_cannot_release_on_expiry_or_resurrect(conn):
    claim = api("claims").claim_work(conn, "source", "board", 180)
    res = api("capacity").reserve_capacity(conn, claim, 4096)
    conn.commit()
    conn.execute(
        "UPDATE lifecycle_claims SET lease_until=clock_timestamp()-interval '1 second'"
    )
    conn.commit()
    with pytest.raises(Exception, match="fenc"):
        conn.execute(
            "UPDATE capacity_reservations SET state='fenced' WHERE id=%s", (res.id,)
        )
    conn.rollback()
    with pytest.raises(Exception, match="held|reservation"):
        conn.execute("DELETE FROM capacity_reservations WHERE id=%s", (res.id,))
    conn.rollback()
    api("claims").claim_work(conn, "source", "board", 180)
    conn.commit()
    with pytest.raises(Exception, match="terminal|resurrect"):
        conn.execute(
            "UPDATE capacity_reservations SET state='held' WHERE id=%s", (res.id,)
        )
    conn.rollback()


@requires_db
def test_all_private_payload_fields_and_repeated_writes_consume_budget(conn):
    seed(conn)
    vid = version(conn)
    conn.execute(
        "INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)",
        (A, vid),
    )
    claim = api("claims").claim_work(conn, "payload", "lever:x:0", 180)
    res = api("capacity").reserve_capacity(conn, claim, 2500)
    conn.commit()
    enforced(conn)
    for column in [
        "resume_json",
        "cover_letter_json",
        "answers_snapshot",
        "greenhouse_questions",
        "prefilled_answers",
    ]:
        with pytest.raises(Exception, match="growth_without_reservation"):
            conn.execute(
                f'UPDATE application_packages SET {column}=\'{{"payload":"new"}}\''
            )
        conn.rollback()
    api("capacity").bind_reservation(
        conn, res, job_id="lever:x:0", scope="application_packages"
    )
    conn.execute("UPDATE application_packages SET resume_instructions=repeat('a',400)")
    with pytest.raises(Exception, match="budget"):
        conn.execute(
            "UPDATE application_packages SET resume_instructions=repeat('b',400)"
        )
    conn.rollback()


@requires_db
def test_active_demand_and_cross_user_snapshots_survive_retirement(conn):
    seed(conn)
    vid = version(conn)
    conn.execute(
        "INSERT INTO job_payload_demands(user_id,job_id,kind,claim_owner_token,lease_until) VALUES (%s,'lever:x:0','review','pending',clock_timestamp()+interval '180 seconds')",
        (B,),
    )
    conn.execute(
        "INSERT INTO review_corrections(user_id,job_id,verdict,job_version_id,description_snapshot) VALUES (%s,'lever:x:0','approve',%s,'durable private snapshot')",
        (A, vid),
    )
    conn.commit()
    enforced(conn)
    with pytest.raises(Exception, match="protected"):
        conn.execute("UPDATE jobs SET description=NULL")
    conn.rollback()
    assert (
        conn.execute("SELECT description_snapshot FROM review_corrections").fetchone()[
            "description_snapshot"
        ]
        == "durable private snapshot"
    )
    conn.execute("DELETE FROM review_corrections")
    conn.commit()
    with pytest.raises(Exception, match="protected"):
        conn.execute("UPDATE jobs SET description=NULL")
    conn.rollback()


@requires_db
def test_capability_cannot_cross_job_or_scope_or_be_reused(conn):
    seed(conn, 2)
    claim = api("claims").claim_work(conn, "payload", "lever:x:0", 180)
    res = api("capacity").reserve_capacity(conn, claim, 20000)
    conn.commit()
    enforced(conn)
    api("capacity").bind_reservation(conn, res, job_id="lever:x:0", scope="jobs")
    with pytest.raises(Exception, match="scope"):
        conn.execute("UPDATE jobs SET description='foreign' WHERE id='lever:x:1'")
    conn.rollback()
    api("capacity").bind_reservation(conn, res, job_id="lever:x:0", scope="jobs")
    conn.execute("UPDATE jobs SET description='own rewrite' WHERE id='lever:x:0'")
    api("capacity").settle_capacity(conn, res)
    conn.commit()
    with pytest.raises(Exception, match="bound|stale"):
        api("capacity").bind_reservation(conn, res, job_id="lever:x:0", scope="jobs")


@requires_db
def test_501_zero_growth_protections_rejected_at_transaction_boundary(conn):
    seed(conn)
    vid = version(conn)
    enforced(conn)
    conn.execute(
        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict,job_version_id) VALUES (%s,'lever:x:0','v','approve',%s)",
        (A, vid),
    )
    for n in range(499):
        conn.execute("UPDATE job_reviews SET profile_version=%s", (str(n),))
    with pytest.raises(Exception, match="500"):
        conn.execute("UPDATE job_reviews SET profile_version='overflow'")


@requires_db
def test_stale_snapshot_isolation_and_truncate_cannot_bypass_guard(conn):
    seed(conn)
    conn.commit()
    conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
    conn.execute("SELECT count(*) FROM jobs")
    with pytest.raises(Exception, match="read committed"):
        conn.execute("UPDATE jobs SET title='stale'")
    conn.rollback()
    enforced(conn)
    with pytest.raises(Exception, match="truncated"):
        conn.execute("TRUNCATE jobs CASCADE")
    conn.rollback()
    with pytest.raises(Exception, match="deletion"):
        conn.execute("DELETE FROM jobs")


@requires_db
def test_direct_reservation_cannot_oversubscribe_physical_guard(conn):
    claim = api("claims").claim_work(conn, "source", "board", 180)
    conn.commit()
    with pytest.raises(Exception, match="capacity"):
        conn.execute(
            "INSERT INTO capacity_reservations(claim_kind,claim_id,owner_token,generation,bytes) VALUES ('source','board',%s,%s,6291456000)",
            (claim.owner_token, claim.generation),
        )


@requires_db
def test_staging_rejects_wrong_claim_and_source_replay_floor(conn):
    seed(conn)
    api("identity").migrate_identity_batch(conn)
    source = conn.execute("SELECT id FROM source_accounts").fetchone()["id"]
    claim = api("claims").claim_work(conn, "source", str(source), 180)
    conn.commit()
    with pytest.raises(Exception, match="claim|fenced"):
        conn.execute(
            "INSERT INTO source_enumerations(source_id,sequence,owner_token,generation) VALUES (%s,1,'forged',1)",
            (source,),
        )
    conn.rollback()
    enum = conn.execute(
        "INSERT INTO source_enumerations(source_id,sequence,owner_token,generation) VALUES (%s,1,%s,%s) RETURNING id",
        (source, claim.owner_token, claim.generation),
    ).fetchone()["id"]
    conn.commit()
    conn.execute("UPDATE source_accounts SET replay_floor=1")
    conn.commit()
    with pytest.raises(Exception, match="replay"):
        conn.execute(
            "INSERT INTO enumeration_members(enumeration_id,external_id,public_metadata) VALUES (%s,'x','{}')",
            (enum,),
        )
    conn.rollback()
    with pytest.raises(Exception, match="monotonic"):
        conn.execute("UPDATE source_accounts SET replay_floor=0")


@requires_db
@pytest.mark.parametrize("approval_first", [True, False])
def test_legacy_actual_prune_and_approval_orders(conn, approval_first):
    from job_discovery.prune import _run_batched

    seed(conn)
    conn.execute("UPDATE jobs SET closed_at=clock_timestamp()-interval '90 days'")
    conn.commit()
    api("locks").enter_gate(conn)
    with ThreadPoolExecutor() as pool:
        if approval_first:
            conn.execute(
                "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (%s,'lever:x:0','v','approve')",
                (A,),
            )

            def prune():
                with connect() as c:
                    return _run_batched(c, 30, 2000, 20000)

            future = pool.submit(prune)
            time.sleep(0.1)
            assert not future.done()
            conn.commit()
            assert future.result(5) == 0
            assert (
                conn.execute("SELECT description FROM jobs").fetchone()["description"]
                == "legacy description"
            )
        else:

            def approve():
                with connect() as c:
                    c.execute(
                        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (%s,'lever:x:0','v','approve')",
                        (A,),
                    )

            future = pool.submit(approve)
            time.sleep(0.1)
            assert not future.done()
            assert _run_batched(conn, 30, 2000, 20000) == 1
            with pytest.raises(psycopg.errors.ForeignKeyViolation):
                future.result(5)


@requires_db
def test_account_forget_subject_fences_capabilities_without_other_user_damage(conn):
    seed(conn)
    first = api("claims").claim_work(conn, "payload", "one", 180)
    r1 = api("capacity").reserve_capacity(conn, first, 1024)
    second = api("claims").claim_work(conn, "payload", "two", 180)
    r2 = api("capacity").reserve_capacity(conn, second, 1024)
    conn.commit()
    api("capacity").bind_reservation(
        conn,
        r1,
        job_id="lever:x:0",
        scope="job_reviews",
        subject_id=A,
        invoking_role="authenticated",
    )
    conn.commit()
    api("capacity").bind_reservation(
        conn,
        r2,
        job_id="lever:x:0",
        scope="job_reviews",
        subject_id=B,
        invoking_role="authenticated",
    )
    conn.commit()
    conn.execute("SELECT lifecycle_forget_subject(%s)", (A,))
    conn.commit()
    assert conn.execute(
        "SELECT state,subject_id FROM capacity_reservations WHERE id=%s", (r1.id,)
    ).fetchone() == {"state": "fenced", "subject_id": None}
    assert (
        str(
            conn.execute(
                "SELECT subject_id FROM capacity_reservations WHERE id=%s", (r2.id,)
            ).fetchone()["subject_id"]
        )
        == B
    )
    with pytest.raises(Exception, match="stale|fenced"):
        api("claims").validate_claim(conn, first)
    conn.rollback()
    api("claims").validate_claim(conn, second)


@requires_db
def test_ready_questions_need_questions_and_protected_version_cannot_change(conn):
    seed(conn)
    vid = version(conn)
    conn.execute(
        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict,job_version_id) VALUES (%s,'lever:x:0','v','approve',%s)",
        (A, vid),
    )
    conn.commit()
    enforced(conn)
    with pytest.raises(Exception, match="question"):
        conn.execute(
            "INSERT INTO job_payload_demands(user_id,job_id,kind,status,job_version_id) VALUES (%s,'lever:x:0','questions','ready',%s)",
            (A, vid),
        )
    conn.rollback()
    with pytest.raises(Exception, match="protected"):
        conn.execute("UPDATE jobs SET description_version_id=NULL")
    conn.rollback()


@requires_db
def test_pending_owner_lease_needs_no_payload_and_cannot_write_worker_claim(conn):
    seed(conn)
    conn.commit()
    enforced(conn)
    with as_user(conn, A):
        conn.execute(
            "INSERT INTO job_payload_demands(user_id,job_id,kind) VALUES (%s,'lever:x:0','description')",
            (A,),
        )
        assert conn.execute(
            "SELECT protection_until>clock_timestamp() AS active FROM job_payload_demands"
        ).fetchone()["active"]
    with as_user(conn, A):
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute(
                "INSERT INTO job_payload_demands(user_id,job_id,kind,claim_owner_token,lease_until) VALUES (%s,'lever:x:0','description','forged',clock_timestamp()+interval '180 seconds')",
                (A,),
            )


@requires_db
def test_demand_removal_requires_fencing_even_after_claim_expiry(conn):
    seed(conn)
    demand = conn.execute(
        "INSERT INTO job_payload_demands(user_id,job_id,kind) VALUES (%s,'lever:x:0','description') RETURNING id",
        (A,),
    ).fetchone()["id"]
    claim = api("claims").claim_work(conn, "demand", str(demand), 180)
    conn.commit()
    with as_user(conn, A):
        with pytest.raises(Exception, match="fenced"):
            conn.execute("DELETE FROM job_payload_demands WHERE id=%s", (demand,))
    conn.execute(
        "UPDATE lifecycle_claims SET lease_until=clock_timestamp()-interval '1 second'"
    )
    conn.commit()
    with pytest.raises(Exception, match="fenced"):
        conn.execute("DELETE FROM job_payload_demands WHERE id=%s", (demand,))
    conn.rollback()
    api("claims").cancel_claim(conn, claim)
    conn.commit()
    with as_user(conn, A):
        conn.execute("DELETE FROM job_payload_demands WHERE id=%s", (demand,))


@requires_db
def test_direct_authenticated_receipts_are_not_a_write_api(conn):
    with as_user(conn, A):
        with pytest.raises(Exception, match="receipt|trigger"):
            conn.execute(
                "INSERT INTO lifecycle_write_checks(invoking_role,subject_id) VALUES (current_user,app_user_id())"
            )


@requires_db
def test_inherited_authenticated_role_cannot_forge_receipts(conn):
    conn.execute("CREATE ROLE lifecycle_inherited_client NOLOGIN INHERIT")
    conn.execute("GRANT authenticated TO lifecycle_inherited_client")
    conn.execute("SET LOCAL ROLE lifecycle_inherited_client")
    conn.execute(
        "SELECT set_config('request.jwt.claims',%s,true)",
        (json.dumps({"sub": A, "role": "authenticated"}),),
    )
    with pytest.raises(Exception, match="receipt|trigger"):
        conn.execute(
            "INSERT INTO lifecycle_write_checks(invoking_role,subject_id) VALUES (current_user,app_user_id())"
        )
    conn.rollback()


@requires_db
def test_over_budget_still_allows_zero_growth_maintenance_without_delete_credit(conn):
    seed(conn)
    writer = api("claims").claim_work(conn, "source", "board", 180)
    conn.commit()
    allocated = conn.execute(
        "SELECT pg_database_size(current_database()) AS bytes"
    ).fetchone()["bytes"]
    api("capacity").reserve_capacity(conn, writer, 6000 * 1024**2 - allocated - 1024**2)
    conn.commit()
    # Real allocated growth (about 4MiB) plus held forecasts crosses the guard
    # without a 6GiB fixture, monkeypatched production clock, or metric bypass.
    conn.execute(
        "UPDATE jobs SET description=(SELECT string_agg(md5(i::text),'') FROM generate_series(1,131072) i)"
    )
    conn.commit()
    enforced(conn)
    assert conn.execute(
        "SELECT pg_database_size(current_database())+sum(bytes)>6291456000 AS full FROM capacity_reservations WHERE state='held'"
    ).fetchone()["full"]
    maintenance = api("claims").claim_work(conn, "maintenance", "singleton", 120)
    assert maintenance is not None
    api("claims").validate_claim(conn, maintenance)
    conn.execute("UPDATE jobs SET description=NULL,description_pruned=true")
    conn.commit()
    assert api("capacity").reserve_capacity(conn, maintenance, 1) is None
