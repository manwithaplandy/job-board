"""Owned-database only fixtures for ordinary Task10 producer behavior."""

from job_discovery.lifecycle.claims import claim_work
from job_discovery.archive.outbox import baseline_batch


def activate_fixture(conn):
    # Fixture-only state seed: production activation remains deliberately unavailable.
    conn.execute(
        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
    )
    conn.execute(
        "UPDATE lifecycle_control SET archive_ever_activated=true,archive_stage='active',activation_generation=activation_generation+1"
    )
    conn.execute(
        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
    )
    conn.commit()


def seeded_events(conn, n=3):
    for i in range(n):
        conn.execute("INSERT INTO brands(name) VALUES(%s)", (f"Brand {i}",))
    conn.commit()
    activate_fixture(conn)
    claim = claim_work(conn, "archive", "fixture", 180)
    refs = baseline_batch(conn, "brands", claim)
    conn.commit()
    return claim, refs
