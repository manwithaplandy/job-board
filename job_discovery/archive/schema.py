"""Total typed public-change validator. Raw content and private fields are absent."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid5
from urllib.parse import urlsplit
from .codec import canonical_json

EVENT_NAMESPACE = UUID("fb2201d3-79ac-5801-923c-471b7823cb15")


class AggregateType(StrEnum):
    JOB = "jobs"
    SOURCE = "source_accounts"
    LISTING = "source_listings"
    VERSION = "job_versions"
    COMPANY = "companies"
    LOCATION = "locations"
    BRAND = "brands"
    SKILL = "skills"
    COMPANY_BRAND = "company_brands"
    COMPANY_SOURCE = "company_sources"
    JOB_LOCATION = "job_locations"
    JOB_SKILL = "job_skills"
    IDENTITY = "identity_assertions"


class ChangeKind(StrEnum):
    BASELINE = "baseline"
    UPSERT = "upsert"
    CLOSED = "closed"
    REOPENED = "reopened"
    REMOVED = "removed"


# SQL owns the persisted projections; this boundary rejects unknown fields/types.
FIELDS = {
    "jobs": "id company_id external_id title url location department remote closed_at",
    "source_accounts": "id legacy_company_id ats public_board_ref public_url exclusion_state",
    "source_listings": "id source_account_id external_id job_id current_version_id current_revision original_discovered_at source_published_at source_published_provenance discovery_anchor_at discovery_anchor_provenance discovery_expires_at source_availability suspected_id_reuse",
    "job_versions": "id job_id source_listing_id revision content_hash public_metadata observed_at",
    "companies": "id name ats token display_name industry industry_subcategory size hq_country",
    "locations": "raw canonicals components source",
    "brands": "id name",
    "skills": "id canonical_name",
}
RELATION_FIELDS = "id evidence_kind public_evidence_ref observed_at valid_from valid_to status confidence revision"
for _kind, _ends in {
    "company_brands": "company_id brand_id",
    "company_sources": "company_id source_account_id",
    "job_locations": "job_version_id location_id",
    "job_skills": "job_version_id skill_id",
    "identity_assertions": "left_listing_id right_listing_id relation reviewed_at",
}.items():
    FIELDS[_kind] = RELATION_FIELDS + " " + _ends
UUID_FIELDS = {
    "source_account_id",
    "current_version_id",
    "source_listing_id",
    "job_version_id",
    "brand_id",
    "skill_id",
    "left_listing_id",
    "right_listing_id",
}
INT_FIELDS = {"company_id", "legacy_company_id", "revision", "current_revision"}


@dataclass(frozen=True)
class PublicChange:
    aggregate_type: AggregateType
    aggregate_id: str
    kind: ChangeKind
    body: dict
    occurred_at: datetime


def event_id(kind: str, aggregate_id: str, revision: int) -> UUID:
    return uuid5(
        EVENT_NAMESPACE, canonical_json([str(kind), aggregate_id, revision]).decode()
    )


def validate_change(value) -> PublicChange:
    if not isinstance(value, PublicChange):
        raise ValueError("PublicChange required")
    if not isinstance(value.aggregate_type, AggregateType) or not isinstance(
        value.kind, ChangeKind
    ):
        raise ValueError("typed aggregate and change enums required")
    if (
        not isinstance(value.aggregate_id, str)
        or not value.aggregate_id
        or len(value.aggregate_id.encode()) > 2048
    ):
        raise ValueError("bounded aggregate ID required")
    if (
        not isinstance(value.occurred_at, datetime)
        or value.occurred_at.tzinfo is None
        or value.occurred_at.utcoffset() is None
    ):
        raise ValueError("aware public observation time required")
    body = value.body
    if not isinstance(body, dict) or set(body) - set(
        FIELDS[value.aggregate_type].split()
    ):
        raise ValueError("unknown public fields")
    identity = "raw" if value.aggregate_type == AggregateType.LOCATION else "id"
    if str(body.get(identity)) != value.aggregate_id:
        raise ValueError("aggregate endpoint identity mismatch")
    required = {
        "jobs": {"id", "company_id", "external_id", "title", "url"},
        "source_accounts": {"id", "ats", "public_board_ref"},
        "source_listings": {
            "id",
            "source_account_id",
            "external_id",
            "job_id",
            "current_revision",
            "discovery_anchor_at",
            "discovery_expires_at",
        },
        "job_versions": {
            "id",
            "job_id",
            "source_listing_id",
            "revision",
            "content_hash",
            "public_metadata",
            "observed_at",
        },
        "companies": {"id", "name", "ats", "token"},
        "locations": {"raw", "canonicals", "components", "source"},
        "brands": {"id", "name"},
        "skills": {"id", "canonical_name"},
        "company_brands": {
            "id",
            "company_id",
            "brand_id",
            "revision",
            "status",
            "evidence_kind",
            "public_evidence_ref",
        },
        "company_sources": {
            "id",
            "company_id",
            "source_account_id",
            "revision",
            "status",
            "evidence_kind",
            "public_evidence_ref",
        },
        "job_locations": {
            "id",
            "job_version_id",
            "location_id",
            "revision",
            "status",
            "evidence_kind",
            "public_evidence_ref",
        },
        "job_skills": {
            "id",
            "job_version_id",
            "skill_id",
            "revision",
            "status",
            "evidence_kind",
            "public_evidence_ref",
        },
        "identity_assertions": {
            "id",
            "left_listing_id",
            "right_listing_id",
            "relation",
            "revision",
            "status",
            "evidence_kind",
            "public_evidence_ref",
        },
    }[value.aggregate_type]
    if not required <= set(body) or any(body[k] is None for k in required):
        raise ValueError("required typed public endpoint fields missing")
    try:
        for key, item in body.items():
            if item is None:
                continue
            if (
                key in UUID_FIELDS
                or key == "id"
                and value.aggregate_type
                not in {AggregateType.JOB, AggregateType.COMPANY}
            ):
                if not isinstance(item, str):
                    raise ValueError("UUID string required")
                UUID(item)
            elif (
                key in INT_FIELDS
                or key == "id"
                and value.aggregate_type == AggregateType.COMPANY
            ):
                if type(item) is not int or item < 0:
                    raise ValueError("nonnegative integer required")
            elif key in {"remote", "suspected_id_reuse"}:
                if type(item) is not bool:
                    raise ValueError("boolean required")
            elif key == "public_metadata":
                if not isinstance(item, dict) or set(item) - {
                    "title",
                    "url",
                    "location",
                    "department",
                    "remote",
                    "description_hash",
                }:
                    raise ValueError("invalid version metadata")
                for k, v in item.items():
                    if (k == "remote" and type(v) is not bool) or (
                        k != "remote" and not isinstance(v, str)
                    ):
                        raise ValueError("invalid metadata value")
            elif key in {"canonicals", "components"}:
                if not isinstance(item, (list, dict)):
                    raise ValueError("structured location field required")
            elif key == "confidence":
                if type(item) not in {int, float} or not 0 <= item <= 1:
                    raise ValueError("confidence outside 0..1")
            elif not isinstance(item, str):
                raise ValueError("public string required")
            if isinstance(item, str) and (
                key.endswith("_at") or key in {"valid_from", "valid_to"}
            ):
                parsed = datetime.fromisoformat(item.replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    raise ValueError("aware public timestamp required")
            if key in {"url", "public_url", "public_evidence_ref"} and item is not None:
                # Legacy mapping evidence is an explicit typed board coordinate.
                if (
                    key == "public_evidence_ref"
                    and body.get("evidence_kind") == "legacy_mapping"
                ):
                    continue
                parsed = urlsplit(item)
                if (
                    parsed.scheme not in {"http", "https"}
                    or not parsed.hostname
                    or parsed.username
                    or parsed.password
                ):
                    raise ValueError("public URL required")
            if key == "content_hash" and (
                len(item) != 64 or any(c not in "0123456789abcdef" for c in item)
            ):
                raise ValueError("content hash requires sha256 hex")
        if len(canonical_json(body)) > 8192:
            raise ValueError("public event body exceeds 8KiB")
    except (TypeError, OverflowError) as exc:
        raise ValueError("invalid public body") from exc
    return value
