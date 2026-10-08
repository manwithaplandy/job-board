"""Independent-review regressions: constraint timing, JSON scalars and tenant claims."""

import json
import time

import psycopg
import pytest

from tests.conftest import as_user, requires_db
from tests.test_lifecycle_safety import A, B, api, enforced, seed, version


def owned_growth(conn, role="authenticated", seconds=2):
    seed(conn)
    vid = version(conn)
    if role != "authenticated":
        conn.execute(
            "DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='review_inherited') THEN CREATE ROLE review_inherited NOLOGIN INHERIT; END IF; END $$"
        )
        conn.execute("GRANT authenticated TO review_inherited")
        conn.commit()
    enforced(conn)
    claim = api("claims").claim_work(conn, "payload", "lease-review", seconds)
    reservation = api("capacity").reserve_capacity(conn, claim, 32768)
    conn.commit()
    api("capacity").bind_reservation(
        conn,
        reservation,
        job_id="lever:x:0",
        scope="job_reviews",
        subject_id=A,
        invoking_role=role,
    )
    conn.execute("SET LOCAL ROLE " + role)
    conn.execute(
        "SELECT set_config('request.jwt.claims',%s,true)", (json.dumps({"sub": A}),)
    )
    return vid


def insert_review(conn, vid):
    conn.execute(
        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict,job_version_id,description_snapshot) VALUES (%s,'lever:x:0','v','approve',%s,'reserved snapshot')",
        (A, vid),
    )


@requires_db
@pytest.mark.parametrize("role", ["authenticated", "review_inherited"])
@pytest.mark.parametrize("timing", ["before", "after"])
def test_early_constraint_consumption_never_commits_expired_growth(conn, role, timing):
    vid = owned_growth(conn, role)
    error = None
    try:
        if timing == "before":
            conn.execute("SET CONSTRAINTS ALL IMMEDIATE")
        insert_review(conn, vid)
        if timing == "after":
            conn.execute("SET CONSTRAINTS ALL IMMEDIATE")
        time.sleep(2.1)
        conn.commit()
    except psycopg.Error as exc:
        error = exc
        conn.rollback()
    assert error is not None, "expired reserved owner write committed"
    assert conn.execute("SELECT count(*) n FROM job_reviews").fetchone()["n"] == 0
    conn.rollback()
    if role != "authenticated":
        conn.execute("DROP ROLE review_inherited")
        conn.commit()


@requires_db
@pytest.mark.parametrize(
    "command",
    [
        "SET CONSTRAINTS ALL IMMEDIATE; -- COMMIT",
        "/* COMMIT */ SET CONSTRAINTS ALL IMMEDIATE",
        "SET CONSTRAINTS ALL IMMEDIATE; SELECT pg_sleep(2.1); COMMIT",
        "/* receipt */ COMMIT",
        "COMMIT; SELECT 1",
    ],
)
def test_commit_boundary_rejects_comments_and_multistatement_evasion(conn, command):
    vid = owned_growth(conn)
    insert_review(conn, vid)
    with pytest.raises(psycopg.Error, match="commit|COMMIT"):
        conn.execute(command)
    conn.rollback()
    assert conn.execute("SELECT count(*) n FROM job_reviews").fetchone()["n"] == 0


@requires_db
@pytest.mark.parametrize("command", ["COMMIT", " commit work ; ", "END TRANSACTION"])
def test_standalone_commit_boundary_accepts_live_owned_growth(conn, command):
    vid = owned_growth(conn, seconds=180)
    insert_review(conn, vid)
    conn.execute(command)
    assert conn.execute("SELECT count(*) n FROM job_reviews").fetchone()["n"] == 1


@requires_db
@pytest.mark.parametrize(
    "field",
    [
        "resume_json",
        "cover_letter_json",
        "answers_snapshot",
        "greenhouse_questions",
        "prefilled_answers",
    ],
)
@pytest.mark.parametrize(
    "value",
    ["9" * 100000, "true", '"text"', '{"a":1}', "[1]"],
    ids=["large-number", "boolean", "string", "object", "array"],
)
def test_every_package_json_representation_requires_capacity(conn, field, value):
    seed(conn)
    vid = version(conn)
    conn.execute(
        "INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)",
        (A, vid),
    )
    conn.commit()
    enforced(conn)
    with as_user(conn, A):
        with pytest.raises(psycopg.Error, match="growth_without_reservation"):
            conn.execute(
                f"UPDATE application_packages SET {field}=%s::jsonb WHERE user_id=%s",
                (value, A),
            )


@requires_db
def test_shared_claim_refuses_mixed_owner_binding_and_preserves_other_owner(conn):
    seed(conn)
    conn.commit()
    claim = api("claims").claim_work(conn, "payload", "shared", 180)
    ra = api("capacity").reserve_capacity(conn, claim, 16384)
    rb = api("capacity").reserve_capacity(conn, claim, 16384)
    api("capacity").bind_reservation(
        conn,
        ra,
        job_id="lever:x:0",
        scope="job_reviews",
        subject_id=A,
        invoking_role="authenticated",
    )
    conn.commit()
    with pytest.raises(psycopg.Error, match="subject|owner"):
        api("capacity").bind_reservation(
            conn,
            rb,
            job_id="lever:x:0",
            scope="job_reviews",
            subject_id=B,
            invoking_role="authenticated",
        )
    conn.rollback()
    other = api("claims").claim_work(conn, "payload", "separate-b", 180)
    separate = api("capacity").reserve_capacity(conn, other, 16384)
    api("capacity").bind_reservation(
        conn,
        separate,
        job_id="lever:x:0",
        scope="job_reviews",
        subject_id=B,
        invoking_role="authenticated",
    )
    conn.execute(
        "INSERT INTO job_reviews(user_id,job_id,profile_version,verdict) VALUES (%s,'lever:x:0','v','approve')",
        (B,),
    )
    conn.commit()
    conn.execute("SELECT lifecycle_forget_subject(%s)", (A,))
    conn.commit()
    assert (
        conn.execute(
            "SELECT state FROM capacity_reservations WHERE id=%s", (separate.id,)
        ).fetchone()["state"]
        == "held"
    )
    assert (
        conn.execute(
            "SELECT count(*) n FROM job_reviews WHERE user_id=%s", (B,)
        ).fetchone()["n"]
        == 1
    )
    assert conn.execute("SELECT count(*) n FROM jobs").fetchone()["n"] == 1
    with pytest.raises(RuntimeError, match="stale|fenced"):
        api("claims").validate_claim(conn, claim)


@requires_db
@pytest.mark.parametrize("role", ["authenticated", "review_inherited"])
def test_natural_expiry_rolls_back_entire_authenticated_transaction(conn, role):
    vid = owned_growth(conn, role)
    insert_review(conn, vid)
    time.sleep(2.1)
    with pytest.raises(psycopg.Error, match="expired"):
        conn.commit()
    conn.rollback()
    assert conn.execute("SELECT count(*) n FROM job_reviews").fetchone()["n"] == 0
    conn.rollback()
    if role != "authenticated":
        conn.execute("DROP ROLE review_inherited")
        conn.commit()


@requires_db
@pytest.mark.parametrize(
    "table", ["job_reviews", "review_corrections", "resume_scores"]
)
def test_numeric_payload_guard_covers_all_private_json_columns(conn, table):
    seed(conn)
    vid = version(conn)
    extra = ",profile_version" if table == "job_reviews" else ""
    val = ",'v'" if table == "job_reviews" else ""
    conn.execute(
        f"INSERT INTO {table}(user_id,job_id,job_version_id{extra}) VALUES (%s,'lever:x:0',%s{val})",
        (A, vid),
    )
    columns = conn.execute(
        "SELECT attname FROM pg_attribute WHERE attrelid=%s::regclass AND atttypid='jsonb'::regtype",
        (table,),
    ).fetchall()
    conn.commit()
    enforced(conn)
    assert columns
    for column in columns:
        with as_user(conn, A):
            with pytest.raises(psycopg.Error, match="growth_without_reservation"):
                conn.execute(
                    f"UPDATE {table} SET {column['attname']}=repeat('9',100000)::jsonb"
                )


@requires_db
def test_numeric_rewrites_consume_cumulative_reservation_and_rollback(conn):
    seed(conn)
    vid = version(conn)
    conn.execute(
        "INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)",
        (A, vid),
    )
    claim = api("claims").claim_work(conn, "payload", "numbers", 180)
    reservation = api("capacity").reserve_capacity(conn, claim, 810000)
    conn.commit()
    enforced(conn)
    api("capacity").bind_reservation(
        conn,
        reservation,
        job_id="lever:x:0",
        scope="application_packages",
        subject_id=A,
        invoking_role="authenticated",
    )
    with as_user(conn, A):
        for digit in ("9", "8"):
            conn.execute(
                "UPDATE application_packages SET resume_json=repeat(%s,100000)::jsonb",
                (digit,),
            )
        assert (
            conn.execute("SELECT sum(bytes) n FROM lifecycle_write_checks").fetchone()[
                "n"
            ]
            >= 800000
        )
        with pytest.raises(psycopg.Error, match="budget"):
            conn.execute(
                "UPDATE application_packages SET resume_json=repeat('7',100000)::jsonb"
            )
    assert (
        conn.execute("SELECT resume_json FROM application_packages").fetchone()[
            "resume_json"
        ]
        is None
    )


@requires_db
def test_numeric_growth_above_physical_ceiling_refused_but_metadata_allowed(conn):
    seed(conn)
    vid = version(conn)
    conn.execute(
        "INSERT INTO application_packages(user_id,job_id,job_version_id,resume_json) VALUES (%s,'lever:x:0',%s,'12345'::jsonb)",
        (A, vid),
    )
    claim = api("claims").claim_work(conn, "payload", "full", 180)
    conn.commit()
    allocated = conn.execute(
        "SELECT pg_database_size(current_database()) n"
    ).fetchone()["n"]
    api("capacity").reserve_capacity(conn, claim, 6291456000 - allocated - 1024**2)
    conn.commit()
    conn.execute(
        "UPDATE jobs SET description=(SELECT string_agg(md5(i::text),'') FROM generate_series(1,131072) i)"
    )
    conn.commit()
    enforced(conn)
    with as_user(conn, A):
        with pytest.raises(psycopg.Error, match="physical capacity"):
            conn.execute(
                "UPDATE application_packages SET resume_json=repeat('9',100000)::jsonb"
            )
    with as_user(conn, A):
        conn.execute(
            "UPDATE application_packages SET status='applied',applied_at=clock_timestamp(),resume_json=NULL"
        )
        conn.commit()
    assert conn.execute(
        "SELECT status,resume_json FROM application_packages"
    ).fetchone() == {"status": "applied", "resume_json": None}


@requires_db
def test_capacity_subject_including_public_null_is_fixed_until_generation_fenced(conn):
    seed(conn)
    conn.commit()
    claim = api("claims").claim_work(conn, "payload", "public-first", 180)
    public = api("capacity").reserve_capacity(conn, claim, 4096)
    owner = api("capacity").reserve_capacity(conn, claim, 4096)
    api("capacity").bind_reservation(conn, public, job_id="lever:x:0", scope="jobs")
    conn.commit()
    with pytest.raises(psycopg.Error, match="subject"):
        api("capacity").bind_reservation(
            conn,
            owner,
            job_id="lever:x:0",
            scope="job_reviews",
            subject_id=A,
            invoking_role="authenticated",
        )
    conn.rollback()
    api("claims").cancel_claim(conn, claim)
    conn.commit()
    replacement = api("claims").claim_work(conn, "payload", "public-first", 180)
    owner = api("capacity").reserve_capacity(conn, replacement, 4096)
    api("capacity").bind_reservation(
        conn,
        owner,
        job_id="lever:x:0",
        scope="job_reviews",
        subject_id=A,
        invoking_role="authenticated",
    )
    conn.commit()
    conn.execute("SELECT lifecycle_forget_subject(%s)", (A,))
    conn.commit()
    assert (
        conn.execute("SELECT reservation_subject_id FROM lifecycle_claims").fetchone()[
            "reservation_subject_id"
        ]
        is None
    )
