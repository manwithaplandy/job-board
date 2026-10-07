"""Task11 offline request/integrity contracts. No provider calls."""

import io
from datetime import UTC, datetime, timedelta
from uuid import uuid4
import pytest
from botocore.exceptions import ClientError, ReadTimeoutError
from job_discovery.archive.s3 import ArchiveClient, Destination, put_verify_batch
from job_discovery.archive.batches import seal_batch
from job_discovery.archive.codec import canonical_json
from job_discovery.archive.types import BatchRef
from job_discovery.lifecycle.types import ClaimRef
from job_discovery.archive.schema import event_id


@pytest.fixture(autouse=True)
def offline_aws(monkeypatch):
    monkeypatch.setenv("AWS_EC2_METADATA_DISABLED", "true")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "offline-fake")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "offline-fake")


def destination():
    return Destination("fixture-bucket", "us-east-1", "fixture/public", "123456789012")


def sealed():
    now = datetime.now(UTC)
    aid = str(uuid4())
    eid = event_id("brands", aid, 1)
    event = dict(
        event_id=str(eid),
        aggregate_type="brands",
        aggregate_id=aid,
        revision=1,
        predecessor_id=None,
        kind="baseline",
        body={"id": aid, "name": "Public"},
        occurred_at=now.isoformat(),
        observed_at=None,
        recorded_at=now.isoformat(),
        provenance="current_baseline",
        schema_version=1,
    )
    return seal_batch(
        BatchRef(
            uuid4(),
            ClaimRef("fixture", 1, now + timedelta(seconds=180)),
            (eid,),
            1,
            now,
            now + timedelta(days=730),
            (canonical_json(event),),
            object_prefix="fixture/public",
        )
    )


class FakeS3:
    def __init__(self):
        self.objects = {}
        self.calls = []
        self.bodies = []
        self.ambiguous = False
        self.meta = type("Meta", (), {"region_name": "us-east-1"})()

    def put_object(self, **kwargs):
        self.calls.append(("put", kwargs))
        assert kwargs["IfNoneMatch"] == "*"
        key = kwargs["Key"]
        if key in self.objects:
            raise ClientError(
                {
                    "Error": {"Code": "PreconditionFailed"},
                    "ResponseMetadata": {"HTTPStatusCode": 412},
                },
                "PutObject",
            )
        self.objects[key] = kwargs["Body"]
        if self.ambiguous:
            self.ambiguous = False
            raise ReadTimeoutError(endpoint_url="https://offline.invalid")
        return {}

    def get_object(self, **kwargs):
        self.calls.append(("get", kwargs))
        key = kwargs["Key"]
        if key not in self.objects:
            raise ClientError(
                {
                    "Error": {"Code": "NoSuchKey"},
                    "ResponseMetadata": {"HTTPStatusCode": 404},
                },
                "GetObject",
            )
        body = io.BytesIO(self.objects[key])
        self.bodies.append(body)
        return {
            "Body": body,
            "ContentLength": len(self.objects[key]),
            "VersionId": "offline-version",
        }


@pytest.mark.parametrize("mode", ["new", "existing", "data-only", "ambiguous"])
def test_conditional_exact_retry(mode):
    seal = sealed()
    sdk = FakeS3()
    client = ArchiveClient(destination(), sdk)
    if mode in {"existing", "data-only"}:
        sdk.objects[seal.data_key] = seal.compressed_data
    if mode == "existing":
        sdk.objects[seal.manifest_key] = seal.manifest_data
    sdk.ambiguous = mode == "ambiguous"
    verified = put_verify_batch(seal, client)
    assert verified.seal == seal
    assert sdk.objects == {
        seal.data_key: seal.compressed_data,
        seal.manifest_key: seal.manifest_data,
    }
    assert all(b.closed for b in sdk.bodies)
    assert "offline-version" in verified.data_receipt.receipt


@pytest.mark.parametrize("which", ["data", "manifest"])
def test_corrupt_existing_fails_closed(which):
    seal = sealed()
    sdk = FakeS3()
    sdk.objects[getattr(seal, which + "_key")] = b"corrupt"
    with pytest.raises(ValueError):
        put_verify_batch(seal, ArchiveClient(destination(), sdk))
    assert all(b.closed for b in sdk.bodies)


def test_sdk_stubber_request_contract():
    import boto3
    from botocore.stub import Stubber

    sdk = boto3.client(
        "s3",
        region_name="us-east-1",
        aws_access_key_id="fake",
        aws_secret_access_key="fake",
    )
    client = ArchiveClient(destination(), sdk)
    seal = sealed()
    with Stubber(sdk) as stub:
        for key, data in [
            (seal.data_key, seal.compressed_data),
            (seal.manifest_key, seal.manifest_data),
        ]:
            params = client.put_parameters(key, data)
            stub.add_client_error(
                "put_object",
                service_error_code="PreconditionFailed",
                http_status_code=412,
                expected_params=params,
            )
            stub.add_response(
                "get_object",
                {"Body": io.BytesIO(data), "ContentLength": len(data)},
                {
                    "Bucket": "fixture-bucket",
                    "Key": key,
                    "ExpectedBucketOwner": "123456789012",
                    "ChecksumMode": "ENABLED",
                },
            )
        assert put_verify_batch(seal, client).seal == seal
        stub.assert_no_pending_responses()


@pytest.mark.parametrize(
    "case", ["oversize", "lying-length", "checksum", "read-error", "deadline", "bomb"]
)
def test_bounded_body_closed_for_all_read_failures(case):
    import gzip
    import time

    seal = sealed()
    sdk = FakeS3()
    client = ArchiveClient(destination(), sdk)
    raw = gzip.compress(b"x" * (8 * 1024**2 + 1)) if case == "bomb" else b"abc"

    class Body(io.BytesIO):
        def read(self, n=-1):
            assert n > 0
            if case == "read-error":
                raise OSError("offline read failure")
            return super().read(n)

    body = Body(raw)
    response = {"Body": body, "ContentLength": len(raw)}
    if case == "oversize":
        response["ContentLength"] = 17 * 1024**2
    if case == "lying-length":
        response["ContentLength"] = 1
    if case == "checksum":
        response["ChecksumSHA256"] = "incorrect"

    def get(**kw):
        return response

    sdk.get_object = get
    if case == "deadline":
        # Expiry after Get guarantees that an acquired stream is still closed.
        calls = iter([0, 2])
        from unittest.mock import patch

        with patch(
            "job_discovery.archive.s3.time.monotonic", side_effect=lambda: next(calls)
        ):
            with pytest.raises(TimeoutError):
                client.bounded_read(seal.data_key, 10, 1)
    else:
        with pytest.raises((ValueError, OSError)):
            client.bounded_read(
                seal.data_key,
                2 if case in {"lying-length", "bomb"} else 16 * 1024**2,
                time.monotonic() + 10,
            )
    assert body.closed


@pytest.mark.parametrize(
    "field,value",
    [
        ("canonical_hash", "0" * 64),
        ("manifest_hash", "0" * 64),
        ("event_count", 999),
        ("manifest_data", b"{}"),
    ],
)
def test_complete_seal_contract_before_upload(field, value):
    from dataclasses import replace

    sdk = FakeS3()
    with pytest.raises(ValueError):
        put_verify_batch(
            replace(sealed(), **{field: value}), ArchiveClient(destination(), sdk)
        )
    assert not sdk.calls


def test_non_412_errors_propagate_without_read():
    sdk = FakeS3()
    client = ArchiveClient(destination(), sdk)

    def denied(**kw):
        raise ClientError(
            {
                "Error": {"Code": "AccessDenied"},
                "ResponseMetadata": {"HTTPStatusCode": 403},
            },
            "PutObject",
        )

    sdk.put_object = denied
    with pytest.raises(ClientError):
        put_verify_batch(sealed(), client)
    assert not sdk.bodies


def test_explicit_sdk_configuration(monkeypatch):
    import job_discovery.archive.s3 as module

    captured = {}

    class Session:
        def client(self, *args, **kwargs):
            captured.update(kwargs)
            return FakeS3()

    monkeypatch.setattr(module.boto3.session, "Session", lambda **kw: Session())
    ArchiveClient.from_destination(destination())
    cfg = captured["config"]
    assert (cfg.connect_timeout, cfg.read_timeout, cfg.max_pool_connections) == (
        3,
        5,
        2,
    )
    assert cfg.retries == {"total_max_attempts": 2, "mode": "standard"}
    assert not hasattr(ArchiveClient, "delete_object")
