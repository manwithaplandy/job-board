"""Ordinary deterministic public serialization; no infrastructure or security probes."""

from datetime import UTC, datetime
from uuid import uuid4
import gzip
import pytest
from job_discovery.archive.schema import (
    PublicChange,
    AggregateType,
    ChangeKind,
    validate_change,
)
from job_discovery.archive.codec import canonical_json, encode_events


def test_canonical_utf8_sorted_jsonl_and_zero_time_gzip():
    rows = [{"z": "é", "a": 1}, {"b": True}]
    a = encode_events(rows)
    assert a == encode_events(rows)
    assert a[0] == b'{"a":1,"z":"\xc3\xa9"}\n{"b":true}\n'
    assert gzip.decompress(a[1]) == a[0]
    assert a[1][4:8] == b"\0\0\0\0"


def test_total_public_schema_rejects_private_or_oversize_data():
    change = PublicChange(
        AggregateType.BRAND,
        str(uuid4()),
        ChangeKind.BASELINE,
        {"id": str(uuid4()), "name": "Brand"},
        datetime.now(UTC),
    )
    # Exact aggregate endpoint identity is part of validation.
    with pytest.raises(ValueError):
        validate_change(change)
    for value in [None, [], {}, "bad", True]:
        with pytest.raises(ValueError):
            validate_change(value)
    with pytest.raises(ValueError):
        canonical_json({"a": float("nan")})


def test_schema_enforces_complete_relation_endpoints_and_version_identity():
    from dataclasses import replace

    eid = str(uuid4())
    change = PublicChange(
        AggregateType.JOB_SKILL,
        eid,
        ChangeKind.UPSERT,
        {
            "id": eid,
            "job_version_id": str(uuid4()),
            "skill_id": str(uuid4()),
            "revision": 1,
            "status": "accepted",
            "evidence_kind": "structured_source",
            "public_evidence_ref": "https://example.test/job",
        },
        datetime.now(UTC),
    )
    assert validate_change(change) == change
    for body in [
        dict(change.body, job_version_id="job-string"),
        {k: v for k, v in change.body.items() if k != "skill_id"},
        dict(change.body, private_notes="private"),
    ]:
        with pytest.raises(ValueError):
            validate_change(replace(change, body=body))


def test_body_is_bounded_and_gzip_single_event_boundary():
    eid = str(uuid4())
    change = PublicChange(
        AggregateType.BRAND,
        eid,
        ChangeKind.BASELINE,
        {"id": eid, "name": "x" * 8192},
        datetime.now(UTC),
    )
    with pytest.raises(ValueError, match="8KiB"):
        validate_change(change)
    with pytest.raises(ValueError, match="2000"):
        encode_events([{}] * 2001)
