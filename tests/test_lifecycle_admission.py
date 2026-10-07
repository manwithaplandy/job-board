"""Ordinary lean-admission contracts on the owned throwaway database."""

from uuid import uuid4

import pytest

from job_discovery.lifecycle import identity
from job_discovery.lifecycle.capacity import reserve_capacity
from job_discovery.lifecycle.claims import claim_work
from job_discovery.models import Posting
from tests.conftest import requires_db
from tests.test_lifecycle_reconcile import setup_source


def admit(conn, source, postings, claim=None):
    claim = claim or claim_work(conn, "source", str(source["id"]), 180)
    reservation = reserve_capacity(conn, claim, 65536 * max(1, len(postings)))
    count = identity.admit_metadata(conn, source["id"], postings, claim, reservation)
    conn.commit()
    return count, claim


@requires_db
def test_stable_lean_admission_and_private_history(conn):
    source = setup_source(conn)
    before = conn.execute("SELECT * FROM source_listings").fetchone()
    conn.execute(
        "INSERT INTO application_packages(user_id,job_id) VALUES (%s,%s)",
        (uuid4(), before["job_id"]),
    )
    private = conn.execute("SELECT * FROM application_packages").fetchall()
    postings = [
        Posting(
            "0",
            "Role",
            "https://example.test/job",
            raw={"descriptionPlain": "Public JD"},
        ),
        Posting(
            "new",
            "Role",
            "https://example.test/new",
            raw={"descriptionPlain": "Public JD"},
        ),
    ]
    count, claim = admit(conn, source, postings)
    assert count == 1
    assert admit(conn, source, postings, claim)[0] == 0
    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 2
    assert all(
        r["description"] is None for r in conn.execute("SELECT description FROM jobs")
    )
    after = conn.execute(
        "SELECT * FROM source_listings WHERE id=%s", (before["id"],)
    ).fetchone()
    assert after["job_id"] == before["job_id"]
    assert after["discovery_anchor_at"] == before["discovery_anchor_at"]
    assert conn.execute("SELECT * FROM application_packages").fetchall() == private
    assert (
        conn.execute("SELECT count(*) n FROM identity_assertions").fetchone()["n"] == 0
    )


@requires_db
def test_normalized_content_and_missing_payload_do_not_manufacture_versions(conn):
    source = setup_source(conn)
    _, claim = admit(
        conn,
        source,
        [
            Posting(
                "0",
                " Role  ",
                "https://example.test/job",
                raw={"descriptionPlain": "Hello   world"},
            )
        ],
    )
    for raw in [{"descriptionPlain": "Hello\nworld"}, {}]:
        admit(
            conn,
            source,
            [Posting("0", "Role", "https://example.test/job", raw=raw)],
            claim,
        )
    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 1
    admit(
        conn,
        source,
        [
            Posting(
                "0",
                "Role",
                "https://example.test/job",
                raw={"descriptionPlain": "Changed content"},
            )
        ],
        claim,
    )
    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 2
    assert (
        conn.execute("SELECT description FROM jobs").fetchone()["description"] is None
    )


@requires_db
def test_partial_display_is_availability_only(conn):
    from job_discovery.adapters.completeness import (
        SourceStatus,
        iter_identified_postings,
    )

    source = setup_source(conn)
    before = conn.execute("SELECT title,url FROM jobs").fetchone()
    # A parser failure may still produce nonempty fallback display values.
    status = SourceStatus()

    def broken(_):
        raise ValueError("bad optional display")

    rows = iter_identified_postings(
        [{"id": "0", "title": "Fallback", "url": "https://example.test/fallback"}],
        broken,
        status,
        title_key="title",
        url_keys=["url"],
    )
    posting = next(rows)
    assert posting.metadata_complete is False
    admit(conn, source, [posting])
    assert conn.execute("SELECT title,url FROM jobs").fetchone() == before
    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 0


@requires_db
def test_version_growth_pauses_without_discarding_unarchived_evidence(conn):
    source = setup_source(conn)
    claim = None
    for i in range(12):
        _, claim = admit(
            conn, source, [Posting("0", f"Role {i}", "https://example.test/job")], claim
        )
    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 11
    assert conn.execute("SELECT title FROM jobs").fetchone()["title"] == "Role 10"
    assert (
        conn.execute("SELECT current_revision FROM source_listings").fetchone()[
            "current_revision"
        ]
        == 11
    )


@requires_db
def test_chunk_limit_and_each_chunk_uses_reservation(conn):
    source = setup_source(conn, count=0)
    claim = claim_work(conn, "source", str(source["id"]), 180)
    reservation = reserve_capacity(conn, claim, 1000000)
    for count in (26, 501):
        with pytest.raises(ValueError, match="500"):
            identity.admit_metadata(
                conn,
                source["id"],
                [
                    Posting(str(i), "Role", "https://example.test/job")
                    for i in range(count)
                ],
                claim,
                reservation,
            )
    assert conn.execute("SELECT count(*) n FROM jobs").fetchone()["n"] == 0
    for start in [0, 3]:
        admit(
            conn,
            source,
            [
                Posting(str(i), "Same title", "https://example.test/job")
                for i in range(start, start + 3)
            ],
            claim,
        )
    assert conn.execute("SELECT count(*) n FROM jobs").fetchone()["n"] == 6
    assert (
        conn.execute(
            "SELECT count(*) n FROM capacity_reservations WHERE state='settled'"
        ).fetchone()["n"]
        >= 2
    )


@requires_db
def test_actual_source_orchestration_admits_and_records_sightings(conn, monkeypatch):
    from job_discovery.lifecycle.reconcile import verify_due_sources
    from job_discovery.adapters import ADAPTERS
    from job_discovery.adapters.completeness import SourceResult, SourceStatus

    setup_source(conn, count=0)
    monkeypatch.setitem(
        ADAPTERS,
        "lever",
        lambda *a, **kw: SourceResult(
            iter(
                [
                    Posting(
                        "new",
                        "Engineer",
                        "https://example.test/job",
                        raw={"descriptionPlain": "unused"},
                    )
                ]
            ),
            SourceStatus(),
        ),
    )
    result = verify_due_sources(conn, max_boards=1)
    assert result["new_jobs"] == 1
    row = conn.execute("SELECT * FROM source_listings").fetchone()
    assert (
        row["successful_sighting_count"] == 1 and row["source_availability"] == "open"
    )
    assert (
        conn.execute("SELECT description FROM jobs").fetchone()["description"] is None
    )


@requires_db
def test_legacy_writer_is_lean_and_does_not_refill(conn):
    from job_discovery.db import upsert_jobs

    source = setup_source(conn)
    posting = Posting(
        "0", "Role", "https://example.test/job", raw={"descriptionPlain": "Unused body"}
    )
    upsert_jobs(conn, source["legacy_company_id"], "lever", "fixture", [posting])
    assert (
        conn.execute("SELECT description FROM jobs").fetchone()["description"] is None
    )


@requires_db
def test_ordinary_enforced_admission_uses_existing_writer_contract(conn):
    source = setup_source(conn, count=0)
    # Fixture readiness only: no activation/security guarantees are evaluated.
    conn.execute(
        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
    )
    conn.execute("UPDATE lifecycle_control SET safety_stage='enforced'")
    conn.execute(
        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
    )
    conn.commit()
    assert (
        admit(conn, source, [Posting("new", "Role", "https://example.test/job")])[0]
        == 1
    )


@requires_db
def test_legacy_poll_does_not_fetch_questions_or_unused_details(conn, monkeypatch):
    import os
    from job_discovery import run as runner
    from job_discovery.adapters import ADAPTERS

    monkeypatch.setenv("DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(
        runner,
        "load_targets",
        lambda: [
            {"name": "X", "ats": "greenhouse", "token": "g"},
            {"name": "W", "ats": "workday", "token": "w"},
        ],
    )

    def no_question(*a, **k):
        raise AssertionError("routine question fetch forbidden")

    monkeypatch.setattr(runner, "spool_questions", no_question)
    monkeypatch.setitem(
        ADAPTERS,
        "greenhouse",
        lambda token: [Posting("0", "Role", "https://example.test/job")],
    )

    def workday(token, *, fetch_details=True):
        assert fetch_details is False
        return [Posting("1", "Role", "https://example.test/job")]

    monkeypatch.setitem(ADAPTERS, "workday", workday)
    monkeypatch.setattr(runner, "_run_prune", lambda conn: None)
    monkeypatch.setattr("reviewer.run.review_all", lambda conn: None)
    monkeypatch.setattr(
        "job_discovery.locations.resolve_new_locations", lambda conn: None
    )
    result = runner.run()
    assert result["ok"] == 2 and result["new_jobs"] == 2
    assert conn.execute("SELECT count(*) n FROM job_questions").fetchone()["n"] == 0


@requires_db
def test_old_unarchived_history_pauses_growth_and_preserves_populated_cache(conn):
    source = setup_source(conn)
    conn.execute(
        "UPDATE jobs SET description='protected original',description_captured_at='2026-01-01Z'"
    )
    _, claim = admit(conn, source, [Posting("0", "First", "https://example.test/job")])
    admit(conn, source, [Posting("0", "Second", "https://example.test/job")], claim)
    conn.execute(
        "UPDATE job_versions SET recorded_at=now()-interval '31 days' WHERE revision=1"
    )
    admit(
        conn,
        source,
        [
            Posting(
                "0",
                "Third",
                "https://example.test/job",
                raw={"descriptionPlain": "replacement"},
            )
        ],
        claim,
    )
    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 2
    assert conn.execute("SELECT title,description FROM jobs").fetchone() == {
        "title": "Second",
        "description": "protected original",
    }


@requires_db
def test_new_ashby_listing_freezes_trustworthy_source_publication(conn):
    from datetime import UTC, datetime

    source = setup_source(conn, count=0, ats="ashby")
    _, claim = admit(
        conn,
        source,
        [
            Posting(
                "new",
                "Role",
                "https://example.test/job",
                raw={"publishedAt": "2025-01-01T00:00:00Z"},
            )
        ],
    )
    listing = conn.execute("SELECT * FROM source_listings").fetchone()
    assert listing["discovery_anchor_at"] == datetime(2025, 1, 1, tzinfo=UTC)
    assert listing["discovery_anchor_provenance"] == "source_published"
    admit(
        conn,
        source,
        [
            Posting(
                "new",
                "Role changed",
                "https://example.test/job",
                raw={"publishedAt": "2026-01-01T00:00:00Z"},
            )
        ],
        claim,
    )
    assert (
        conn.execute("SELECT discovery_anchor_at FROM source_listings").fetchone()[
            "discovery_anchor_at"
        ]
        == listing["discovery_anchor_at"]
    )
    assert conn.execute("SELECT source_published_at FROM source_listings").fetchone()[
        "source_published_at"
    ] == datetime(2026, 1, 1, tzinfo=UTC)

    admit(
        conn,
        source,
        [
            Posting(
                "new",
                "Role changed",
                "https://example.test/job",
                raw={"publishedAt": "2026-02-01T00:00:00Z"},
            )
        ],
        claim,
    )
    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 2
    row = conn.execute(
        "SELECT source_published_at,discovery_anchor_at FROM source_listings"
    ).fetchone()
    assert row["source_published_at"] == datetime(2026, 2, 1, tzinfo=UTC)
    assert row["discovery_anchor_at"] == listing["discovery_anchor_at"]


@requires_db
def test_enforced_source_orchestration_chunks_metadata_and_sightings(conn, monkeypatch):
    from job_discovery.lifecycle.reconcile import verify_due_sources
    from job_discovery.adapters import ADAPTERS
    from job_discovery.adapters.completeness import SourceResult, SourceStatus

    setup_source(conn, count=0)
    conn.execute(
        "INSERT INTO locations(raw,canonicals,components,source) VALUES('Remote','{Remote}','{}','rule')"
    )
    conn.execute(
        "ALTER TABLE lifecycle_control DISABLE TRIGGER lifecycle_control_history"
    )
    conn.execute("UPDATE lifecycle_control SET safety_stage='enforced'")
    conn.execute(
        "ALTER TABLE lifecycle_control ENABLE TRIGGER lifecycle_control_history"
    )
    conn.commit()
    monkeypatch.setitem(
        ADAPTERS,
        "lever",
        lambda *a, **kw: SourceResult(
            iter(
                Posting(str(i), "Role", "https://example.test/job", location="Remote")
                for i in range(70)
            ),
            SourceStatus(),
        ),
    )
    result = verify_due_sources(conn, max_boards=1)
    assert result["new_jobs"] == 70 and result["ok"] == 1
    assert (
        conn.execute(
            "SELECT min(successful_sighting_count) n FROM source_listings"
        ).fetchone()["n"]
        == 1
    )


@requires_db
def test_old_current_cannot_become_expired_unarchived_superseded_version(conn):
    source = setup_source(conn)
    _, claim = admit(conn, source, [Posting("0", "First", "https://example.test/job")])
    conn.execute("UPDATE job_versions SET recorded_at=now()-interval '31 days'")
    admit(conn, source, [Posting("0", "Changed", "https://example.test/job")], claim)
    assert conn.execute("SELECT count(*) n FROM job_versions").fetchone()["n"] == 1
    assert conn.execute("SELECT title FROM jobs").fetchone()["title"] == "First"
