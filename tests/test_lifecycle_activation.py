"""Control transition guards at the safety-only intermediate schema."""

from dataclasses import replace
import pytest
from tests.conftest import as_user, requires_db
from tests.test_lifecycle_safety import api, A
from tests.test_lifecycle_identity import seed


@requires_db
def test_control_cas_requires_current_control_claim(conn):
    control = api("config").read_control(conn)
    claim = api("claims").claim_work(conn, "control", "singleton", 180)
    next_control = api("config").transition_control(
        conn,
        control.activation_generation,
        replace(control, safety_stage="collect"),
        claim,
    )
    assert next_control.safety_stage == "collect"
    assert next_control.activation_generation == control.activation_generation + 1
    conn.commit()
    with pytest.raises(Exception, match="generation"):
        api("config").transition_control(conn, 0, control, claim)


@requires_db
@pytest.mark.parametrize(
    "change",
    [
        {"safety_stage": "enforced"},
        {
            "archive_stage": "active",
            "archive_ever_activated": True,
            "export_enabled": True,
        },
        {"retirement_dry_run": False, "retirement_enabled": True},
    ],
)
def test_readiness_cannot_be_invented(conn, change):
    claim = api("claims").claim_work(conn, "control", "singleton", 180)
    control = api("config").read_control(conn)
    conn.commit()
    with pytest.raises(Exception, match="readiness|activation|contract"):
        api("config").transition_control(
            conn, control.activation_generation, replace(control, **change), claim
        )
    conn.rollback()
    assert api("config").read_control(conn) == control


@requires_db
def test_client_cannot_change_control_or_claims(conn):
    seed(conn)
    conn.commit()
    with as_user(conn, A):
        with pytest.raises(Exception):
            conn.execute("UPDATE lifecycle_control SET safety_stage='collect'")
    with as_user(conn, A):
        with pytest.raises(Exception):
            api("claims").claim_work(conn, "control", "singleton", 180)


@requires_db
@pytest.mark.parametrize("stage", ["active", "producer_paused"])
def test_archive_sticky_and_direct_eventful_dml_fail_closed(conn, stage):
    seed(conn)
    conn.commit()
    # Task3 cannot activate production. This DDL-only fixture tests previously
    # activated state; no application setting can perform this bypass.
    conn.execute(
        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
    )
    conn.execute(
        "UPDATE lifecycle_control SET archive_ever_activated=true,archive_stage=%s,activation_generation=1",
        (stage,),
    )
    conn.execute(
        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
    )
    conn.commit()
    conn.execute("SELECT set_config('lifecycle.archive_stage','never_activated',true)")
    with pytest.raises(Exception, match="outbox|paused"):
        conn.execute("UPDATE jobs SET title='eventful'")
    conn.rollback()
    if stage == "active":
        conn.execute(
            "UPDATE lifecycle_control SET archive_stage='producer_paused',activation_generation=2"
        )
        conn.commit()
    with pytest.raises(Exception, match="monotonic"):
        conn.execute(
            "UPDATE lifecycle_control SET archive_ever_activated=false,archive_stage='never_activated',activation_generation=3"
        )


@requires_db
def test_owner_demands_queue_and_export_projection(conn):
    seed(conn)
    conn.commit()
    with as_user(conn, A):
        conn.execute(
            "INSERT INTO job_payload_demands(user_id,job_id,kind) VALUES (%s,'lever:x:0','description')",
            (A,),
        )
        assert (
            conn.execute("SELECT job_id FROM job_payload_demands").fetchone()["job_id"]
            == "lever:x:0"
        )
        with pytest.raises(Exception):
            conn.execute(
                "INSERT INTO job_payload_demands(user_id,job_id,kind) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','lever:x:0','description')"
            )


@requires_db
def test_export_only_pause_retains_sticky_producer_enforcement(conn):
    seed(conn)
    conn.execute(
        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
    )
    conn.execute(
        "UPDATE lifecycle_control SET archive_ever_activated=true,archive_stage='active',export_enabled=true,activation_generation=1"
    )
    conn.execute(
        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
    )
    conn.commit()
    conn.execute(
        "UPDATE lifecycle_control SET export_enabled=false,activation_generation=2"
    )
    conn.commit()
    state = api("config").read_control(conn)
    assert (
        not state.export_enabled
        and state.archive_ever_activated
        and state.archive_stage == "active"
    )
    with pytest.raises(Exception, match="outbox"):
        conn.execute("UPDATE jobs SET description='changed'")
