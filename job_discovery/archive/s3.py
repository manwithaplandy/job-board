"""Bounded immutable S3 transport. Destination comes only from validated service state."""

import base64
from dataclasses import dataclass
from datetime import datetime
import gzip
import hashlib
import io
import json
import re
import time

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, ConnectionClosedError, ReadTimeoutError

from .batches import seal_batch
from .codec import MAX_COMPRESSED, MAX_EXPANDED, MAX_MANIFEST, canonical_json
from .schema import AggregateType, ChangeKind, PublicChange, event_id, validate_change
from .types import SealedBatch, VerificationReceipt, VerifiedBatch


@dataclass(frozen=True)
class Destination:
    bucket: str
    region: str
    object_prefix: str
    expected_owner: str

    def __post_init__(self):
        if not (
            isinstance(self.bucket, str)
            and re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", self.bucket)
            and ".." not in self.bucket
            and not re.fullmatch(r"[0-9.]+", self.bucket)
            and isinstance(self.region, str)
            and re.fullmatch(r"[a-z]{2}(?:-[a-z]+)+-\d", self.region)
            and isinstance(self.object_prefix, str)
            and len(self.object_prefix) <= 256
            and re.fullmatch(r"[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*", self.object_prefix)
            and isinstance(self.expected_owner, str)
            and re.fullmatch(r"\d{12}", self.expected_owner)
        ):
            raise ValueError("invalid service archive destination")


class ArchiveClient:
    """No list/delete/head/provisioning interface. Reuse one explicitly configured client."""

    def __init__(self, destination: Destination, sdk):
        if (
            not isinstance(destination, Destination)
            or sdk.meta.region_name != destination.region
        ):
            raise ValueError("archive client region differs from validated destination")
        self.destination, self._sdk = destination, sdk

    @classmethod
    def from_destination(cls, destination: Destination):
        sdk = boto3.session.Session(region_name=destination.region).client(
            "s3",
            region_name=destination.region,
            config=Config(
                connect_timeout=3,
                read_timeout=5,
                max_pool_connections=2,
                retries={"total_max_attempts": 2, "mode": "standard"},
                signature_version="s3v4",
                ignore_configured_endpoint_urls=True,
                s3={"addressing_style": "virtual"},
            ),
        )
        return cls(destination, sdk)

    def _key(self, key):
        pattern = (
            re.escape(self.destination.object_prefix)
            + r"/ingestion_date=\d{4}-\d{2}-\d{2}/[0-9a-f-]{36}-[0-9a-f]{64}\.(?:jsonl\.gz|manifest\.json)"
        )
        if not isinstance(key, str) or not re.fullmatch(pattern, key):
            raise ValueError("object key differs from service archive namespace")

    def put_parameters(self, key, data):
        self._key(key)
        return dict(
            Bucket=self.destination.bucket,
            Key=key,
            Body=data,
            IfNoneMatch="*",
            ExpectedBucketOwner=self.destination.expected_owner,
            ChecksumSHA256=base64.b64encode(hashlib.sha256(data).digest()).decode(),
            ContentType="application/gzip"
            if key.endswith(".gz")
            else "application/json",
            ServerSideEncryption="AES256",
        )

    def conditional_put(self, key, data):
        try:
            self._sdk.put_object(**self.put_parameters(key, data))
        except ClientError as exc:
            # S3 has no modelled PreconditionFailed exception. Only a real 412
            # means immutable-existing recovery; authorization and 409 errors propagate.
            if exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode") != 412:
                raise
        except (ReadTimeoutError, ConnectionClosedError):
            # Ambiguous upload is resolved only by an exact bounded read below.
            pass

    def bounded_read(self, key, limit, deadline):
        self._key(key)
        if time.monotonic() >= deadline:
            raise TimeoutError("archive verification deadline")
        response = self._sdk.get_object(
            Bucket=self.destination.bucket,
            Key=key,
            ExpectedBucketOwner=self.destination.expected_owner,
            ChecksumMode="ENABLED",
        )
        body = response["Body"]
        try:
            size = response.get("ContentLength")
            if type(size) is not int or not 0 <= size <= limit:
                raise ValueError("archive object exceeds declared bound")
            chunks = []
            total = 0
            while True:
                if time.monotonic() >= deadline:
                    raise TimeoutError("archive verification deadline")
                chunk = body.read(min(65536, limit - total + 1))
                if not chunk:
                    break
                total += len(chunk)
                if total > limit:
                    raise ValueError("archive object exceeds read bound")
                chunks.append(chunk)
            data = b"".join(chunks)
            if len(data) != size:
                raise ValueError("archive object length differs")
            digest = hashlib.sha256(data).digest()
            checksum = response.get("ChecksumSHA256")
            if checksum is not None and checksum != base64.b64encode(digest).decode():
                raise ValueError("archive object checksum differs")
            version = response.get("VersionId")
            if version is not None and (
                not isinstance(version, str) or not 1 <= len(version) <= 1024
            ):
                raise ValueError("invalid archive version receipt")
            return data, VerificationReceipt(
                key,
                digest.hex(),
                len(data),
                canonical_json({"verified": "sha256", "version_id": version}).decode(),
            )
        finally:
            body.close()


def _validate_events(seal):
    fields = {
        "event_id",
        "aggregate_type",
        "aggregate_id",
        "revision",
        "predecessor_id",
        "kind",
        "body",
        "occurred_at",
        "observed_at",
        "recorded_at",
        "provenance",
        "schema_version",
    }
    for raw in seal.batch.event_bytes:
        event = json.loads(raw)
        if (
            not isinstance(event, dict)
            or set(event) != fields
            or type(event["schema_version"]) is not int
            or event["schema_version"] != 1
        ):
            raise ValueError("invalid public event envelope")
        if type(event["revision"]) is not int or event["revision"] < 1:
            raise ValueError("invalid public event revision")
        if event["event_id"] != str(
            event_id(event["aggregate_type"], event["aggregate_id"], event["revision"])
        ):
            raise ValueError("invalid public event identity")
        previous = (
            str(
                event_id(
                    event["aggregate_type"],
                    event["aggregate_id"],
                    event["revision"] - 1,
                )
            )
            if event["revision"] > 1
            else None
        )
        if event["predecessor_id"] != previous or event["provenance"] not in {
            "current_baseline",
            "database_change",
            "source_observation",
        }:
            raise ValueError("invalid public event lineage")
        for key in ("occurred_at", "observed_at", "recorded_at"):
            value = event[key]
            if value is None and key == "observed_at":
                continue
            if (
                not isinstance(value, str)
                or datetime.fromisoformat(value).tzinfo is None
            ):
                raise ValueError("invalid public event time")
        validate_change(
            PublicChange(
                AggregateType(event["aggregate_type"]),
                event["aggregate_id"],
                ChangeKind(event["kind"]),
                event["body"],
                datetime.fromisoformat(event["occurred_at"]),
            )
        )
        if canonical_json(event) != raw:
            raise ValueError("noncanonical public event")


def put_verify_batch(
    sealed_batch: SealedBatch, archive_client: ArchiveClient
) -> VerifiedBatch:
    seal = sealed_batch
    if seal.batch.object_prefix != archive_client.destination.object_prefix:
        raise ValueError("seal prefix differs from validated destination")
    _validate_events(seal)
    # Reconstruct the complete immutable manifest, key, count and digest contract.
    if seal_batch(seal.batch) != seal:
        raise ValueError("immutable seal differs")
    if (
        not 1 <= seal.event_count <= 2000
        or seal.compressed_bytes > MAX_COMPRESSED
        or seal.expanded_bytes > MAX_EXPANDED
        or seal.manifest_bytes > MAX_MANIFEST
    ):
        raise ValueError("seal exceeds verification bounds")
    deadline = time.monotonic() + 100
    archive_client.conditional_put(seal.data_key, seal.compressed_data)
    data, data_receipt = archive_client.bounded_read(
        seal.data_key, min(MAX_COMPRESSED, seal.compressed_bytes), deadline
    )
    if data != seal.compressed_data:
        raise ValueError("archive data differs")
    with gzip.GzipFile(fileobj=io.BytesIO(data), mode="rb") as stream:
        expanded = stream.read(MAX_EXPANDED + 1)
    if len(expanded) > MAX_EXPANDED or expanded != seal.canonical_data:
        raise ValueError("archive expanded data differs")
    archive_client.conditional_put(seal.manifest_key, seal.manifest_data)
    manifest, manifest_receipt = archive_client.bounded_read(
        seal.manifest_key, min(MAX_MANIFEST, seal.manifest_bytes), deadline
    )
    if manifest != seal.manifest_data:
        raise ValueError("archive manifest differs")
    return VerifiedBatch(seal, data_receipt, manifest_receipt)
