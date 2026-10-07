"""Task 2 contracts; all mutable behavior runs in the owned database harness."""

from datetime import UTC, datetime, timedelta
import importlib
from uuid import uuid4

import psycopg
import pytest
from psycopg.rows import dict_row

from tests.conftest import TEST_DSN, as_user, requires_db


def identity():
    return importlib.import_module("job_discovery.lifecycle.identity")


def seed(conn, count=1):
    cid = conn.execute(
        "INSERT INTO companies(name,ats,token,poll_failures) VALUES ('X','lever','x',3) RETURNING id"
    ).fetchone()["id"]
    for n in range(count):
        conn.execute(
            "INSERT INTO jobs(id,company_id,external_id,title,url,first_seen_at,last_seen_at,description) VALUES (%s,%s,%s,'Engineer','https://example.test/job','2025-01-01Z','2025-02-01Z',%s)",
            (f"lever:x:{n}", cid, str(n), "legacy description" if n % 2 == 0 else None),
        )
    conn.execute(
        "INSERT INTO job_questions(job_id,questions) VALUES ('lever:x:0','{}')"
    )
    return cid


def test_anchor_uses_trustworthy_publication_and_elapsed_utc():
    now = datetime(2026, 10, 7, tzinfo=UTC)
    discovered = now - timedelta(days=10)
    published = now - timedelta(days=30)
    anchor, provenance = identity().choose_anchor(published, discovered, now)
    assert (anchor, provenance) == (published, "source_published")
    assert now >= anchor + timedelta(days=30)
    assert now - timedelta(microseconds=1) < anchor + timedelta(days=30)
    for invalid in [None, now + timedelta(microseconds=1), "not a date"]:
        assert identity().choose_anchor(invalid, discovered, now) == (
            discovered,
            "local_observation",
        )
    with pytest.raises(ValueError, match="timezone"):
        identity().choose_anchor(None, discovered.replace(tzinfo=None), now)


@requires_db
def test_bounded_mapping_restart_preserves_identity_history_and_cache_provenance(conn):
    seed(conn, 5)
    user = uuid4()
    conn.execute(
        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (%s,'lever:x:0','v','approve')",
        (user,),
    )
    conn.commit()
    before = conn.execute(
        "SELECT id,first_seen_at,last_seen_at FROM jobs ORDER BY id"
    ).fetchall()
    assert identity().migrate_identity_batch(conn, 2) == 2
    conn.commit()
    activation = conn.execute(
        "SELECT identity_migration_activated_at FROM lifecycle_control"
    ).fetchone()["identity_migration_activated_at"]
    assert activation is not None
    # Discard the connection used by the worker; only persisted progress is reused.
    with psycopg.connect(TEST_DSN, row_factory=dict_row) as restarted:
        assert identity().migrate_identity_batch(restarted, 2) == 2
    assert identity().migrate_identity_batch(conn, 2) == 1
    conn.commit()
    rows = conn.execute("SELECT * FROM source_listings ORDER BY job_id").fetchall()
    assert len(rows) == 5
    assert all(
        r["successful_sighting_count"] == 0 and r["successful_last_observed_at"] is None
        for r in rows
    )
    assert all(
        r["source_published_at"] is None and r["current_version_id"] is None
        for r in rows
    )
    assert all(
        r["original_discovered_at"]
        == before[0]["first_seen_at"]
        == r["discovery_anchor_at"]
        for r in rows
    )
    assert all(
        r["discovery_anchor_provenance"] == "legacy_local_observation" for r in rows
    )
    assert all(
        r["discovery_expires_at"] == r["discovery_anchor_at"] + timedelta(days=30)
        for r in rows
    )
    cache = conn.execute(
        "SELECT description,description_captured_at,description_last_used_at,description_capture_provenance FROM jobs ORDER BY id"
    ).fetchall()
    for r in cache:
        assert r["description_captured_at"] == (
            activation if r["description"] is not None else None
        )
        assert r["description_last_used_at"] is None
        assert r["description_capture_provenance"] == (
            "migration_activation" if r["description"] is not None else None
        )
    question = conn.execute(
        "SELECT captured_at,last_used_at,capture_provenance FROM job_questions"
    ).fetchone()
    assert question == dict(
        captured_at=activation,
        last_used_at=None,
        capture_provenance="migration_activation",
    )
    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 0
    assert (
        conn.execute(
            "SELECT count(*) n FROM job_reviews WHERE user_id=%s AND job_version_id IS NULL",
            (user,),
        ).fetchone()["n"]
        == 1
    )
    assert (
        conn.execute(
            "SELECT id,first_seen_at,last_seen_at FROM jobs ORDER BY id"
        ).fetchall()
        == before
    )
    assert identity().migrate_identity_batch(conn, 2) == 0
    assert (
        conn.execute("SELECT * FROM source_listings ORDER BY job_id").fetchall() == rows
    )
    source = conn.execute("SELECT * FROM source_accounts").fetchone()
    assert source["failure_streak"] == 3
    assert source["last_complete_success_at"] is None


@requires_db
def test_batch_rollback_retry_and_limit_validation(conn):
    seed(conn, 3)
    conn.commit()
    for limit in [0, -1, 501, True, 1.5]:
        with pytest.raises(ValueError):
            identity().migrate_identity_batch(conn, limit)
    assert identity().migrate_identity_batch(conn, 1) == 1
    conn.rollback()
    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 0
    assert identity().migrate_identity_batch(conn, 500) == 3
    assert identity().migrate_identity_batch(conn) == 0


@requires_db
def test_same_id_legacy_upsert_does_not_reset_frozen_age(conn):
    from job_discovery.db import upsert_job
    from job_discovery.models import Posting

    cid = seed(conn)
    identity().migrate_identity_batch(conn)
    before = conn.execute("SELECT * FROM source_listings").fetchone()
    assert not upsert_job(
        conn, cid, "lever", "x", Posting("0", "Changed", "https://example.test/new")
    )
    assert identity().migrate_identity_batch(conn) == 0
    assert conn.execute("SELECT * FROM source_listings").fetchone() == before


@requires_db
def test_capture_version_requires_complete_typed_public_metadata(conn):
    from job_discovery.lifecycle.claims import claim_work

    seed(conn)
    identity().migrate_identity_batch(conn)
    listing = conn.execute("SELECT id FROM source_listings").fetchone()["id"]
    claim = claim_work(conn, 'source', 'fixture', 180)
    with pytest.raises(ValueError, match='title and public URL'):
        identity().capture_version(conn, listing, {"title": "Engineer"}, datetime.now(UTC), claim)
    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 0


@requires_db
def test_defaults_are_service_owned_and_gucs_do_not_enable_controls(conn):
    from job_discovery.lifecycle.config import read_control

    control = read_control(conn)
    assert control.safety_stage == "legacy"
    assert control.archive_stage == "never_activated"
    assert not control.archive_ever_activated and not control.export_enabled
    assert control.activation_generation == 0 and control.flags_version == 1
    assert control.retirement_dry_run
    assert not any(
        [
            control.identity_enabled,
            control.source_enabled,
            control.maintenance_enabled,
            control.hydration_enabled,
            control.feed_enabled,
            control.retirement_enabled,
        ]
    )
    conn.execute("SELECT set_config('lifecycle.safety_stage','enforced',true)")
    assert read_control(conn) == control
    with as_user(conn, uuid4()):
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute("UPDATE lifecycle_control SET safety_stage='enforced'")


@requires_db
def test_new_tables_have_rls_and_no_client_privileges(conn):
    tables = [
        "source_accounts",
        "source_listings",
        "job_versions",
        "brands",
        "skills",
        "company_brands",
        "company_sources",
        "job_locations",
        "job_skills",
        "identity_assertions",
    ]
    for table in tables:
        assert conn.execute(
            "SELECT relrowsecurity FROM pg_class WHERE oid=%s::regclass", (table,)
        ).fetchone()["relrowsecurity"]
        for role in ["anon", "authenticated"]:
            assert not conn.execute(
                "SELECT has_table_privilege(%s,%s,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') p",
                (role, table),
            ).fetchone()["p"]
            with conn.transaction():
                conn.execute(f"SET LOCAL ROLE {role}")
                with (
                    pytest.raises(psycopg.errors.InsufficientPrivilege),
                    conn.transaction(),
                ):
                    conn.execute(f"SELECT * FROM {table}")
                with (
                    pytest.raises(psycopg.errors.InsufficientPrivilege),
                    conn.transaction(),
                ):
                    conn.execute(f"DELETE FROM {table}")
                conn.execute("RESET ROLE")


@requires_db
def test_nullable_private_prerequisites_and_flag_off_owner_writes(conn):
    seed(conn)
    identity().migrate_identity_batch(conn)
    user, other = uuid4(), uuid4()
    conn.commit()
    statements = [
        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (%s,'lever:x:0','v','approve')",
        "INSERT INTO review_corrections(user_id,job_id,verdict) VALUES (%s,'lever:x:0','approve')",
        "INSERT INTO application_packages(user_id,job_id) VALUES (%s,'lever:x:0')",
        "INSERT INTO generation_jobs(user_id,job_id,kind) VALUES (%s,'lever:x:0','prepare')",
        "INSERT INTO resume_scores(user_id,job_id) VALUES (%s,'lever:x:0')",
        "INSERT INTO cover_letter_edits(user_id,job_id,edited_text) VALUES (%s,'lever:x:0','edit')",
    ]
    with as_user(conn, user):
        for query in statements:
            conn.execute(query, (user,))
        for table in [
            "job_reviews",
            "review_corrections",
            "application_packages",
            "generation_jobs",
            "resume_scores",
            "cover_letter_edits",
        ]:
            row = conn.execute(
                f"SELECT job_version_id,description_snapshot,questions_snapshot FROM {table}"
            ).fetchone()
            assert row == dict(
                job_version_id=None, description_snapshot=None, questions_snapshot=None
            )
        conn.commit()
    with as_user(conn, other):
        for table in [
            "job_reviews",
            "review_corrections",
            "application_packages",
            "generation_jobs",
            "resume_scores",
            "cover_letter_edits",
        ]:
            assert conn.execute(f"SELECT count(*) n FROM {table}").fetchone()["n"] == 0
    with as_user(conn, other):
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute(statements[2], (user,))
    # Existing account cleanup statements continue to work without a version.
    with as_user(conn, user):
        for table in [
            "job_reviews",
            "review_corrections",
            "application_packages",
            "generation_jobs",
            "resume_scores",
            "cover_letter_edits",
        ]:
            conn.execute(f"DELETE FROM {table} WHERE user_id=%s", (user,))


@requires_db
def test_typed_locations_and_cross_job_version_reference_rejected(conn):
    seed(conn, 2)
    identity().migrate_identity_batch(conn)
    listing = conn.execute(
        "SELECT id FROM source_listings WHERE job_id='lever:x:0'"
    ).fetchone()["id"]
    version = conn.execute(
        "INSERT INTO job_versions(job_id,source_listing_id,revision,content_hash,public_metadata,observed_at) VALUES ('lever:x:0',%s,1,%s,'{}',now()) RETURNING id",
        (listing, "a" * 64),
    ).fetchone()["id"]
    conn.execute(
        "INSERT INTO locations(raw,canonicals,components,source) VALUES ('Remote','{Remote}','{}','rule')"
    )
    conn.execute(
        "INSERT INTO job_locations(job_version_id,location_id,evidence_kind,public_evidence_ref) VALUES (%s,'Remote','structured_source','https://example.test/location')",
        (version,),
    )
    with pytest.raises(psycopg.errors.ForeignKeyViolation), conn.transaction():
        conn.execute(
            "INSERT INTO job_reviews(user_id,job_id,profile_version,job_version_id) VALUES (%s,'lever:x:1','v',%s)",
            (uuid4(), version),
        )
    with pytest.raises(psycopg.errors.CheckViolation), conn.transaction():
        conn.execute(
            "INSERT INTO job_payload_demands(user_id,job_id,kind,status) VALUES (%s,'lever:x:0','description','ready')",
            (uuid4(),),
        )


@requires_db
def test_mapped_flag_off_legacy_prune_and_direct_delete_preserve_protected_rows(conn):
    from job_discovery.prune import prune_jobs

    seed(conn, 5)
    conn.execute("UPDATE jobs SET closed_at=now()-interval '40 days'")
    user = uuid4()
    conn.execute(
        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (%s,'lever:x:1','v','approve')",
        (user,),
    )
    conn.execute(
        "INSERT INTO review_corrections(user_id,job_id,description_snapshot) VALUES (%s,'lever:x:2','protected')",
        (user,),
    )
    conn.execute(
        "INSERT INTO application_packages(user_id,job_id) VALUES (%s,'lever:x:3')",
        (user,),
    )
    identity().migrate_identity_batch(conn)
    conn.commit()
    # Staged compatibility: unmigrated legacy callers may delete pre-cutover
    # unprotected Jobs. Later gate/cutover must prohibit these identity deletes.
    conn.execute("DELETE FROM jobs WHERE id='lever:x:4'")
    conn.commit()
    assert prune_jobs(conn)["closed_deleted"] == 1
    assert {r["id"] for r in conn.execute("SELECT id FROM jobs")} == {
        "lever:x:1",
        "lever:x:2",
        "lever:x:3",
    }
    assert {
        r["job_id"] for r in conn.execute("SELECT job_id FROM source_listings")
    } == {"lever:x:1", "lever:x:2", "lever:x:3"}
    assert (
        conn.execute("SELECT description_snapshot FROM review_corrections").fetchone()[
            "description_snapshot"
        ]
        == "protected"
    )
    assert conn.execute("SELECT count(*) n FROM job_reviews").fetchone()["n"] == 1
    assert (
        conn.execute("SELECT count(*) n FROM application_packages").fetchone()["n"] == 1
    )


@requires_db
def test_mapping_defaults_to_500_and_maps_empty_boards_without_invented_evidence(conn):
    seed(conn, 501)
    conn.execute(
        "INSERT INTO companies(name,ats,token,active) VALUES ('Empty','ashby','empty',false)"
    )
    assert identity().migrate_identity_batch(conn) == 500
    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 500
    conn.commit()
    assert identity().migrate_identity_batch(conn) == 1
    conn.commit()
    assert identity().migrate_identity_batch(conn) == 1  # Remaining empty board.
    assert identity().migrate_identity_batch(conn) == 0
    assert conn.execute("SELECT count(*) n FROM company_sources").fetchone()["n"] == 2
    rows = conn.execute(
        "SELECT observed_at,valid_from,valid_to,confidence FROM company_sources"
    ).fetchall()
    assert all(all(value is None for value in row.values()) for row in rows)
    assert conn.execute("SELECT count(*) n FROM brands").fetchone()["n"] == 0
    assert conn.execute("SELECT count(*) n FROM skills").fetchone()["n"] == 0
    empty = conn.execute(
        "SELECT * FROM source_accounts WHERE public_board_ref='empty'"
    ).fetchone()
    assert empty["legacy_active"] is False and empty["exclusion_state"] == "unknown"
    assert empty["last_complete_success_at"] is None


@requires_db
def test_control_history_and_activation_barrier(conn):
    from job_discovery.lifecycle.config import read_control

    initial = read_control(conn)
    for statement in [
        "DELETE FROM lifecycle_control",
        "TRUNCATE lifecycle_control",
        "UPDATE lifecycle_control SET feed_enabled=true",
        "UPDATE lifecycle_control SET archive_ever_activated=true,archive_stage='active',activation_generation=1",
        "UPDATE lifecycle_control SET safety_stage='enforced',activation_generation=1",
    ]:
        with pytest.raises(psycopg.errors.RaiseException), conn.transaction():
            conn.execute(statement)
    conn.execute(
        "UPDATE lifecycle_control SET safety_stage='collect',activation_generation=1"
    )
    assert read_control(conn).activation_generation == initial.activation_generation + 1
    assert identity().migrate_identity_batch(conn) == 0
    conn.rollback()
    # Future activated state fixture: Task2 deliberately has no activation API.
    conn.execute(
        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
    )
    conn.execute(
        "UPDATE lifecycle_control SET archive_ever_activated=true,archive_stage='producer_paused',activation_generation=5"
    )
    conn.execute(
        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
    )
    with (
        pytest.raises(psycopg.errors.RaiseException, match="monotonic"),
        conn.transaction(),
    ):
        conn.execute(
            "UPDATE lifecycle_control SET archive_ever_activated=false,archive_stage='never_activated',activation_generation=6"
        )


@requires_db
def test_control_helper_not_callable_by_client_roles(conn):
    for role in ["anon", "authenticated"]:
        assert not conn.execute(
            "SELECT has_function_privilege(%s,'preserve_lifecycle_control()','EXECUTE') p",
            (role,),
        ).fetchone()["p"]
        with conn.transaction():
            conn.execute(f"SET LOCAL ROLE {role}")
            with (
                pytest.raises(psycopg.errors.InsufficientPrivilege),
                conn.transaction(),
            ):
                conn.execute("SELECT preserve_lifecycle_control()")
            conn.execute("RESET ROLE")


@requires_db
def test_mapping_never_overwrites_existing_cache_use_or_observation_evidence(conn):
    seed(conn)
    identity().migrate_identity_batch(conn)
    conn.execute("UPDATE jobs SET description_last_used_at='2026-01-01Z'")
    conn.execute(
        "UPDATE source_listings SET successful_sighting_count=5,successful_last_observed_at='2026-01-01Z',source_published_at='2025-06-01Z',source_published_provenance='new_source_response'"
    )
    before = conn.execute("SELECT * FROM source_listings").fetchone()
    assert identity().migrate_identity_batch(conn) == 0
    assert conn.execute("SELECT * FROM source_listings").fetchone() == before
    assert conn.execute("SELECT description_last_used_at FROM jobs").fetchone()[
        "description_last_used_at"
    ] == datetime(2026, 1, 1, tzinfo=UTC)


@requires_db
def test_service_account_erasure_inventory_deletes_only_target_demands(conn):
    """Exercise the actual registry's bounded account erasure statements locally.

    The existing accountDeletion.ts serviceSql loop is privileged, derives its
    user from the verified caller and filters each DELETE by that user_id.
    No authenticated demand DELETE privilege is added for this path.
    """
    import re
    from pathlib import Path

    seed(conn)
    identity().migrate_identity_batch(conn)
    users = [uuid4(), uuid4()]
    for user in users:
        conn.execute(
            "INSERT INTO profiles(user_id,profile_version) VALUES (%s,'v')", (user,)
        )
        conn.execute(
            "INSERT INTO job_payload_demands(user_id,job_id,kind) VALUES (%s,'lever:x:0','description')",
            (user,),
        )
    conn.commit()
    registry = (
        Path(__file__).resolve().parents[1] / "dashboard/lib/userScopedTables.ts"
    ).read_text()
    table_list = registry.split("export const USER_DELETE_TABLES = [", 1)[1].split(
        "] as const;", 1
    )[0]
    tables = re.findall(r'^  "([a-z_]+)",', table_list, re.MULTILINE)
    assert "job_payload_demands" in tables
    for table in tables:
        # Registry identifiers only; target user remains a bound parameter.
        conn.execute(f"DELETE FROM {table} WHERE user_id=%s", (users[0],))
    assert conn.execute("SELECT user_id FROM job_payload_demands").fetchall() == [
        {"user_id": users[1]}
    ]
    assert conn.execute("SELECT count(*) n FROM jobs").fetchone()["n"] == 1


@requires_db
def test_collect_mapping_is_bounded_restartable_and_preserves_frozen_age(conn):
    seed(conn, 3)
    conn.execute(
        "UPDATE lifecycle_control SET safety_stage='collect',activation_generation=1"
    )
    assert identity().migrate_identity_batch(conn, 1) == 1
    conn.commit()
    original = conn.execute(
        "SELECT * FROM source_listings WHERE job_id='lever:x:0'"
    ).fetchone()
    with psycopg.connect(TEST_DSN, row_factory=dict_row) as restarted:
        assert identity().migrate_identity_batch(restarted, 1) == 1
    assert identity().migrate_identity_batch(conn, 1) == 1
    assert identity().migrate_identity_batch(conn, 1) == 0
    assert (
        conn.execute(
            "SELECT * FROM source_listings WHERE job_id='lever:x:0'"
        ).fetchone()
        == original
    )
    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 0


@requires_db
@pytest.mark.parametrize(
    "stage,ever,archive",
    [
        ("enforced", False, "never_activated"),
        ("legacy", True, "active"),
        ("collect", True, "producer_paused"),
    ],
)
def test_mapping_refuses_enforced_or_sticky_archive_state(conn, stage, ever, archive):
    seed(conn)
    # Test fixture for later schema stages; no production activation API exists.
    conn.execute(
        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
    )
    conn.execute(
        "UPDATE lifecycle_control SET safety_stage=%s,archive_ever_activated=%s,archive_stage=%s,activation_generation=1",
        (stage, ever, archive),
    )
    conn.execute(
        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
    )
    before = conn.execute("SELECT * FROM lifecycle_control").fetchone()
    with pytest.raises(RuntimeError, match="pre-cutover"):
        identity().migrate_identity_batch(conn)
    assert conn.execute("SELECT * FROM lifecycle_control").fetchone() == before
    assert conn.execute("SELECT count(*) n FROM source_listings").fetchone()["n"] == 0
    assert (
        conn.execute("SELECT description_captured_at FROM jobs").fetchone()[
            "description_captured_at"
        ]
        is None
    )
