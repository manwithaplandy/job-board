"""New archive public payload/configuration correctness, no role/security probes."""

from dataclasses import replace
import pytest
from tests.test_archive_export import sealed, destination, FakeS3
from job_discovery.archive.s3 import ArchiveClient, Destination, put_verify_batch
from job_discovery.archive.batches import seal_batch
from job_discovery.archive.codec import canonical_json
import json


def test_private_field_and_path_rejected_before_io(caplog):
    seal = sealed()
    sdk = FakeS3()
    client = ArchiveClient(destination(), sdk)
    event = json.loads(seal.batch.event_bytes[0])
    event["body"]["private_notes"] = "private-sentinel"
    bad = seal_batch(replace(seal.batch, event_bytes=(canonical_json(event),)))
    with pytest.raises(ValueError):
        put_verify_batch(bad, client)
    with pytest.raises(ValueError):
        put_verify_batch(replace(seal, data_key="../private"), client)
    assert not sdk.calls
    assert "private-sentinel" not in caplog.text


@pytest.mark.parametrize(
    "prefix", ["../public", "public//events", "https://bucket", "public?x=y"]
)
def test_invalid_service_prefix(prefix):
    with pytest.raises(ValueError):
        Destination("fixture-bucket", "us-east-1", prefix, "123456789012")


def test_region_and_prefix_must_match():
    sdk = FakeS3()
    sdk.meta.region_name = "eu-west-1"
    with pytest.raises(ValueError):
        ArchiveClient(destination(), sdk)
    with pytest.raises(ValueError):
        put_verify_batch(
            sealed(),
            ArchiveClient(replace(destination(), object_prefix="other"), FakeS3()),
        )


def test_worker_diagnostics_never_log_provider_body_or_url(monkeypatch, caplog):
    import reviewer.archive_worker as worker
    from botocore.exceptions import ClientError

    def fail(_):
        raise ClientError(
            {
                "Error": {
                    "Code": "AccessDenied",
                    "Message": "private-sentinel https://signed.invalid?secret=sentinel",
                }
            },
            "PutObject",
        )

    monkeypatch.setattr(worker, "export_once", fail)
    monkeypatch.setattr(worker.signal, "signal", lambda *_: None)
    assert worker.main() == 1
    assert "ClientError" in caplog.text
    assert "sentinel" not in caplog.text and "https://" not in caplog.text
