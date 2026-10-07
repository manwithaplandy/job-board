"""Typed public relationships never rewrite private Job anchors."""

import pytest
from job_discovery.lifecycle import identity
from job_discovery.models import Posting
from tests.conftest import requires_db
from tests.test_lifecycle_admission import admit
from tests.test_lifecycle_reconcile import setup_source


@requires_db
def test_typed_location_has_unknown_validity_and_no_invented_skills(conn):
    source = setup_source(conn)
    conn.execute(
        "INSERT INTO locations(raw,canonicals,components,source) VALUES('Remote','{Remote}','{}','rule')"
    )
    admit(
        conn,
        source,
        [
            Posting(
                "0",
                "Role",
                "https://example.test/job",
                location="Remote",
                raw={"descriptionPlain": "Python expert"},
            )
        ],
    )
    edge = conn.execute("SELECT * FROM job_locations").fetchone()
    assert edge["evidence_kind"] == "structured_source"
    assert edge["public_evidence_ref"] == "https://example.test/job"
    assert edge["valid_from"] is None and edge["valid_to"] is None
    assert edge["confidence"] is None
    assert conn.execute("SELECT count(*) n FROM skills").fetchone()["n"] == 0


@requires_db
def test_identity_assertions_require_review_and_reject_conflicts_cycles(conn):
    source = setup_source(conn, count=3)
    _, claim = admit(conn, source, [])
    ids = [
        r["id"]
        for r in conn.execute("SELECT id FROM source_listings ORDER BY external_id")
    ]
    now = conn.execute("SELECT clock_timestamp() t").fetchone()["t"]

    def assertion(left, right, **extra):
        return dict(
            left_listing_id=left,
            right_listing_id=right,
            relation="same_job",
            evidence_kind="reviewed_public",
            public_evidence_ref="https://example.test/evidence",
            status="accepted",
            reviewed_at=now,
            **extra,
        )

    a = assertion(ids[0], ids[1])
    first = identity.set_identity_assertion(conn, a, claim)
    assert identity.set_identity_assertion(conn, a, claim) == first
    for bad in [
        assertion(ids[0], ids[0]),
        assertion(ids[0], ids[2]),
        assertion(ids[1], ids[0]),
        dict(a, evidence_kind="structured_source"),
        dict(a, private_notes="secret"),
    ]:
        with pytest.raises(ValueError), conn.transaction():
            identity.set_identity_assertion(conn, bad, claim)
    identity.set_identity_assertion(
        conn,
        dict(assertion(ids[1], ids[2]), status="proposed", reviewed_at=None),
        claim,
    )
    assert conn.execute("SELECT count(*) n FROM jobs").fetchone()["n"] == 3
    assert (
        conn.execute(
            "SELECT count(*) n FROM identity_assertions WHERE status='accepted'"
        ).fetchone()["n"]
        == 1
    )
