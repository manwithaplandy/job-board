"""Stable lean identity, bounded public revisions, and explicit typed evidence.

Callers own short transactions. Legacy mapping is an explicit migration helper;
runtime discovery uses metadata admission and never reconstructs private history.
"""

import hashlib
import json
import unicodedata
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit
from uuid import UUID

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .config import read_control
from job_discovery.models import Posting
from job_discovery.jd import extract_description
from .capacity import bind_reservation, settle_capacity
from .claims import validate_claim
from .locks import enter_gate, lock_jobs
from .types import ClaimRef, ReservationRef


def choose_anchor(
    published_at: datetime | None, discovered_at: datetime, now: datetime
) -> tuple[datetime, str]:
    for value in (discovered_at, now):
        if (
            not isinstance(value, datetime)
            or value.tzinfo is None
            or value.utcoffset() is None
        ):
            raise ValueError("discovery and now require timezone-aware datetimes")
    if (
        isinstance(published_at, datetime)
        and published_at.tzinfo is not None
        and published_at.utcoffset() is not None
        and published_at <= now
    ):
        return published_at.astimezone(UTC), "source_published"
    return discovered_at.astimezone(UTC), "local_observation"


def migrate_identity_batch(conn, limit: int = 500, *, job_ids: list[str] | None = None) -> int:
    """Map <=500 legacy jobs (or remaining empty source accounts) atomically.

    The stable listing existence is the checkpoint. A rolled back batch has no
    checkpoint; a committed batch cannot reset its anchor or cache capture. The
    migration activation clock is set once by the first explicit batch, not DDL.
    Inactive boards preserve their old status without guessing why disabled.
    Legacy/collect mapping enters the common gate and sorted job locks. Enforced
    and ever-activated archive states remain rejected; this mapper has no
    admission or outbox bypass.
    """
    if type(limit) is not int or not 1 <= limit <= 500:
        raise ValueError("identity batch limit must be an integer between 1 and 500")
    if job_ids is not None and (not isinstance(job_ids,list) or len(job_ids)>500 or any(not isinstance(j,str) for j in job_ids)):
        raise ValueError("identity job filter must contain at most 500 job IDs")
    with conn.cursor(row_factory=dict_row) as cur:
        enter_gate(conn)
        control = read_control(conn)
        if (
            control.safety_stage not in {"legacy", "collect"}
            or control.archive_ever_activated
        ):
            raise RuntimeError("legacy mapping requires pre-cutover control state")
        cur.execute(
            """SELECT j.*, c.ats, c.token, c.active, c.poll_failures
            FROM jobs j JOIN companies c ON c.id=j.company_id
            WHERE NOT EXISTS (SELECT 1 FROM source_listings l WHERE l.job_id=j.id)
              AND (%s::text[] IS NULL OR j.id=ANY(%s::text[]))
            ORDER BY j.id LIMIT %s""",
            (job_ids,job_ids,limit),
        )
        rows = cur.fetchall()
        # Reserve sorted namespaced Job keys before taking any Job/FK locks.
        # Global BEFORE STATEMENT triggers cover direct callers as well.
        for job in rows:
            cur.execute(
                "SELECT pg_advisory_xact_lock(hashtextextended(%s,0))",
                ("lifecycle:job:" + job["id"],),
            )
        cur.execute("""UPDATE lifecycle_control
            SET identity_migration_activated_at = clock_timestamp()
            WHERE singleton AND identity_migration_activated_at IS NULL
            RETURNING identity_migration_activated_at""")
        activation = read_control(conn).identity_migration_activated_at
        if rows:
            cur.execute(
                "SELECT id FROM jobs WHERE id=ANY(%s) ORDER BY id FOR UPDATE",
                ([job["id"] for job in rows],),
            )
        for job in rows:
            cur.execute(
                """INSERT INTO source_accounts
                (legacy_company_id,ats,public_board_ref,legacy_active,exclusion_state,failure_streak)
                VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (ats,public_board_ref) DO NOTHING""",
                (
                    job["company_id"],
                    job["ats"],
                    job["token"],
                    job["active"],
                    "enabled" if job["active"] else "unknown",
                    job["poll_failures"],
                ),
            )
            cur.execute(
                "SELECT id FROM source_accounts WHERE ats=%s AND public_board_ref=%s",
                (job["ats"], job["token"]),
            )
            source_id = cur.fetchone()["id"]
            _map_company_source(
                cur, job["company_id"], source_id, job["ats"], job["token"]
            )
            cur.execute(
                """INSERT INTO source_listings(source_account_id,external_id,job_id,
                original_discovered_at,discovery_anchor_at,discovery_anchor_provenance,
                discovery_expires_at,legacy_closed_at)
                VALUES (%s,%s,%s,%s,%s,'legacy_local_observation',%s,%s)""",
                (
                    source_id,
                    job["external_id"],
                    job["id"],
                    job["first_seen_at"],
                    job["first_seen_at"],
                    job["first_seen_at"].astimezone(UTC) + timedelta(days=30),
                    job["closed_at"],
                ),
            )
            # No actual use or source publication/observation is inferred.
            cur.execute(
                """UPDATE jobs SET description_captured_at=%s,
                description_capture_provenance='migration_activation'
                WHERE id=%s AND description IS NOT NULL AND description_captured_at IS NULL
                  AND description_last_used_at IS NULL""",
                (activation, job["id"]),
            )
            cur.execute(
                """UPDATE job_questions SET captured_at=%s,
                capture_provenance='migration_activation'
                WHERE job_id=%s AND captured_at IS NULL AND last_used_at IS NULL""",
                (activation, job["id"]),
            )
        if rows or job_ids is not None:
            return len(rows)
        # Source-only boards also need a stable coordinate. Count these only in
        # batches with no jobs so a zero return means the whole mapping is done.
        cur.execute(
            """INSERT INTO source_accounts
            (legacy_company_id,ats,public_board_ref,legacy_active,exclusion_state,failure_streak)
            SELECT c.id,c.ats,c.token,c.active,CASE WHEN c.active THEN 'enabled' ELSE 'unknown' END,c.poll_failures
            FROM companies c WHERE NOT EXISTS
              (SELECT 1 FROM source_accounts s WHERE s.ats=c.ats AND s.public_board_ref=c.token)
            ORDER BY c.id LIMIT %s ON CONFLICT (ats,public_board_ref) DO NOTHING
            RETURNING id,legacy_company_id,ats,public_board_ref""",
            (limit,),
        )
        accounts = cur.fetchall()
        for account in accounts:
            _map_company_source(
                cur,
                account["legacy_company_id"],
                account["id"],
                account["ats"],
                account["public_board_ref"],
            )
        return len(accounts)


def _map_company_source(cur, company_id, source_id, ats, board_ref):
    # This records the existing typed legacy board association, not inferred
    # employer identity or a manufactured source-observation timestamp.
    cur.execute(
        """INSERT INTO company_sources
        (company_id,source_account_id,evidence_kind,public_evidence_ref,status)
        VALUES (%s,%s,'legacy_mapping',%s,'accepted')
        ON CONFLICT (company_id,source_account_id) DO NOTHING""",
        (company_id, source_id, f"{ats}:{board_ref}"),
    )


def _text(value):
    return (
        " ".join(unicodedata.normalize("NFC", value).split())
        if isinstance(value, str)
        else None
    )


def _public_ref(value):
    if not isinstance(value, str) or len(value.encode()) > 2048:
        raise ValueError("bounded public evidence URL required")
    try:
        url = urlsplit(value)
        if (
            url.scheme not in {"http", "https"}
            or not url.hostname
            or url.username
            or url.password
        ):
            raise ValueError("public evidence URL required")
    except ValueError:
        raise ValueError("public evidence URL required") from None
    return value


def posting_metadata(
    ats: str, posting: Posting, previous: dict | None = None
) -> dict | None:
    """Allowlist source facts; never serialize raw or private applicant content.

    Missing optional fields and absent bodies are unknown, not a source assertion
    that a previously observed fact disappeared. A minimal fallback is only a
    positive sighting and cannot overwrite any known metadata.
    """
    if (
        not posting.metadata_complete
        or not _text(posting.title)
        or not _text(posting.url)
    ):
        return None
    try:
        url = _public_ref(posting.url.strip())
    except ValueError:
        return None
    metadata = dict(previous or {})
    metadata.update(title=_text(posting.title), url=url)
    for field in ("location", "department"):
        value = _text(getattr(posting, field))
        if value:
            metadata[field] = value
    if type(posting.remote) is bool:
        metadata["remote"] = posting.remote
    try:
        body = extract_description(ats, posting.raw or {})
    except (TypeError, ValueError, AttributeError, KeyError):
        body = None
    body = _text(body)
    if body:
        metadata["description_hash"] = hashlib.sha256(body.encode()).hexdigest()
    if len(json.dumps(metadata, ensure_ascii=False).encode()) > 6144:
        return None
    return metadata


def _source_publication(ats, raw, now):
    # Ashby documents last publication, not original requisition creation.
    # Unknown source fields and invalid/future/naive values remain unknown.
    if ats != "ashby" or not isinstance(raw, dict):
        return None
    value = raw.get("publishedAt")
    if not isinstance(value, str):
        return None
    try:
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    anchor, provenance = choose_anchor(value, now, now)
    return anchor if provenance == "source_published" else None


def _version_room(conn, listing):
    # Retain evidence until maintenance can retire exact archived, unreferenced
    # versions. Private references may continue to prevent retirement.
    # A changed version would supersede the current row too, so include its age.
    row = conn.execute(
        """SELECT count(*) n,
        bool_or(recorded_at<clock_timestamp()-interval '30 days') old
        FROM job_versions WHERE source_listing_id=%s""",
        (listing["id"],),
    ).fetchone()
    return row["n"] < 11 and not row["old"]


def capture_version(
    conn, listing_id: UUID, metadata: dict, observed_at: datetime, claim: ClaimRef
) -> UUID | None:
    """Capture one meaningful public revision, or pause at the retention bound.

    The caller owns the transaction. Shared _write pairs meaningful public
    projections with the transactional outbox whenever the producer is active.
    """
    from .reconcile import _write

    allowed = {"title", "url", "location", "department", "remote", "description_hash"}
    if not isinstance(metadata, dict) or set(metadata) - allowed:
        raise ValueError("only typed public metadata is accepted")
    if not isinstance(observed_at, datetime) or observed_at.tzinfo is None:
        raise ValueError("aware observation timestamp required")
    normalized = {}
    for key, value in metadata.items():
        if key == "remote":
            if type(value) is not bool:
                raise ValueError("remote requires boolean")
            normalized[key] = value
        else:
            if not isinstance(value, str) or not value.strip():
                raise ValueError("metadata requires nonempty strings")
            normalized[key] = _text(value)
    if not normalized.get("title") or not normalized.get("url"):
        raise ValueError("title and public URL required")
    _public_ref(normalized["url"])
    if "description_hash" in normalized and (
        len(normalized["description_hash"]) != 64
        or any(c not in "0123456789abcdef" for c in normalized["description_hash"])
    ):
        raise ValueError("invalid public content hash")
    encoded = json.dumps(
        normalized, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode()
    if len(encoded) > 6144:
        raise ValueError("public metadata exceeds bounded size")
    enter_gate(conn)
    listing = conn.execute(
        "SELECT * FROM source_listings WHERE id=%s", (listing_id,)
    ).fetchone()
    if listing is None:
        raise ValueError("unknown source listing")
    lock_jobs(conn, [listing["job_id"]])
    validate_claim(conn, claim)
    digest = hashlib.sha256(encoded).hexdigest()
    if digest == listing["content_hash"]:
        return listing["current_version_id"]
    if not _version_room(conn, listing):
        return None
    revision = listing["current_revision"] + 1
    with _write(conn, claim, "job_versions", listing["job_id"], size=65536):
        version = conn.execute(
            """INSERT INTO job_versions
            (job_id,source_listing_id,revision,content_hash,public_metadata,observed_at)
            VALUES(%s,%s,%s,%s,%s,%s) RETURNING id""",
            (
                listing["job_id"],
                listing_id,
                revision,
                digest,
                Jsonb(normalized),
                observed_at,
            ),
        ).fetchone()["id"]
    with _write(conn, claim, "source_listings", listing["job_id"]):
        conn.execute(
            """UPDATE source_listings SET current_version_id=%s,current_revision=%s,
            content_hash=%s,content_changed_at=%s WHERE id=%s""",
            (version, revision, digest, observed_at, listing_id),
        )
    location = normalized.get("location")
    # Reuse the established dictionary; never invent canonical location facts.
    if (
        location
        and conn.execute("SELECT 1 FROM locations WHERE raw=%s", (location,)).fetchone()
    ):
        with _write(conn, claim, "job_locations"):
            conn.execute(
                """INSERT INTO job_locations(job_version_id,location_id,evidence_kind,
                public_evidence_ref,observed_at,status) VALUES(%s,%s,'structured_source',%s,%s,'accepted')""",
                (version, location, normalized["url"], observed_at),
            )
    return version


# At most five metadata row effects per posting (one known location edge;
# listing creation and a later publication update are mutually exclusive).
# Source staging adds at most three more: 25 * 8 = 200, below the 500-row cap.
ADMISSION_CHUNK_SIZE = 25


def admit_metadata(
    conn,
    source_id: UUID,
    postings: list[Posting],
    claim: ClaimRef,
    reservation: ReservationRef,
) -> int:
    """Admit <=25 lean identities (within the 500-row transaction bound); stable legacy Job keys/private FKs never move.

    A held chunk forecast accompanies separate scoped reservations for each row
    effect. This conservatively double-counts temporary headroom rather than
    reusing a reservation across incompatible deferred-validation scopes.
    """
    from .reconcile import _write

    if len(postings) > ADMISSION_CHUNK_SIZE:
        raise ValueError(
            "admission chunk exceeds 25 postings (500 row-effects ceiling)"
        )
    if reservation is None or reservation.claim != claim:
        raise ValueError("matching chunk reservation required")
    enter_gate(conn)
    source = conn.execute(
        "SELECT * FROM source_accounts WHERE id=%s", (source_id,)
    ).fetchone()
    if source is None or source["legacy_company_id"] is None:
        raise ValueError("source requires an explicit existing company mapping")
    keys = []
    for posting in postings:
        if (
            not isinstance(posting.external_id, str)
            or not posting.external_id.strip()
            or len(posting.external_id.encode()) > 2048
        ):
            raise ValueError("bounded source external ID required")
        keys.append(
            f"{source['ats']}:{source['public_board_ref']}:{posting.external_id}"
        )
    existing = conn.execute(
        "SELECT job_id FROM source_listings WHERE source_account_id=%s AND external_id=ANY(%s)",
        (source_id, [p.external_id for p in postings]),
    ).fetchall()
    lock_jobs(conn, keys + [r["job_id"] for r in existing])
    validate_claim(conn, claim)
    bind_reservation(conn, reservation, job_id=None, scope="source_listings")
    now = conn.execute("SELECT clock_timestamp() t").fetchone()["t"]
    admitted = 0
    for posting, key in zip(postings, keys):
        listing = conn.execute(
            "SELECT * FROM source_listings WHERE source_account_id=%s AND external_id=%s",
            (source_id, posting.external_id),
        ).fetchone()
        old = (
            conn.execute(
                "SELECT public_metadata FROM job_versions WHERE id=%s",
                (listing["current_version_id"],),
            ).fetchone()
            if listing
            else None
        )
        job_id = listing["job_id"] if listing else key
        job = conn.execute("SELECT * FROM jobs WHERE id=%s", (job_id,)).fetchone()
        previous = (
            old["public_metadata"]
            if old
            else (
                {
                    k: job[k]
                    for k in ("title", "url", "location", "department", "remote")
                    if job[k] is not None
                }
                if job
                else {}
            )
        )
        metadata = posting_metadata(source["ats"], posting, previous)
        if metadata is None:
            continue
        published = _source_publication(source["ats"], posting.raw, now)
        if listing and published and listing["source_published_at"] != published:
            with _write(conn, claim, "source_listings", job_id):
                conn.execute(
                    """UPDATE source_listings SET source_published_at=%s,
                    source_published_provenance='ashby.publishedAt' WHERE id=%s""",
                    (published, listing["id"]),
                )
        digest = hashlib.sha256(
            json.dumps(
                metadata, sort_keys=True, separators=(",", ":"), ensure_ascii=False
            ).encode()
        ).hexdigest()
        if listing and (
            listing["content_hash"] == digest or not _version_room(conn, listing)
        ):
            continue
        with _write(conn, claim, "jobs", job_id, size=65536):
            row = conn.execute(
                """INSERT INTO jobs(id,company_id,external_id,title,url,location,department,remote)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO UPDATE SET
                title=EXCLUDED.title,url=EXCLUDED.url,location=EXCLUDED.location,
                department=EXCLUDED.department,remote=EXCLUDED.remote
                WHERE (jobs.title,jobs.url,jobs.location,jobs.department,jobs.remote)
                  IS DISTINCT FROM (EXCLUDED.title,EXCLUDED.url,EXCLUDED.location,EXCLUDED.department,EXCLUDED.remote)
                RETURNING (xmax=0) AS is_new""",
                (
                    job_id,
                    source["legacy_company_id"],
                    posting.external_id,
                    metadata["title"],
                    metadata["url"],
                    metadata.get("location"),
                    metadata.get("department"),
                    metadata.get("remote"),
                ),
            ).fetchone()
            admitted += bool(row and row["is_new"])
        if not listing:
            discovered = job["first_seen_at"] if job else now
            anchor, provenance = choose_anchor(
                None if job else published, discovered, now
            )
            if job:
                provenance = "legacy_local_observation"
            with _write(conn, claim, "source_listings", job_id):
                listing = conn.execute(
                    """INSERT INTO source_listings(source_account_id,external_id,job_id,
                    original_discovered_at,discovery_anchor_at,discovery_anchor_provenance,discovery_expires_at,
                    source_published_at,source_published_provenance,legacy_closed_at)
                    VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                    (
                        source_id,
                        posting.external_id,
                        job_id,
                        discovered,
                        anchor,
                        provenance,
                        anchor + timedelta(days=30),
                        published,
                        "ashby.publishedAt" if published else None,
                        job["closed_at"] if job else None,
                    ),
                ).fetchone()
        capture_version(conn, listing["id"], metadata, now, claim)
    settle_capacity(conn, reservation)
    return admitted


def set_identity_assertion(conn, assertion: dict, claim: ClaimRef) -> UUID:
    """Record reviewed public evidence without merging Jobs or private history.

    Accepted same-job edges point toward one representative. Proposals do not
    participate in conflict/cycle checks and never imply transitive acceptance.
    """
    from .reconcile import _write

    allowed = {
        "left_listing_id",
        "right_listing_id",
        "relation",
        "evidence_kind",
        "public_evidence_ref",
        "status",
        "observed_at",
        "reviewed_at",
    }
    if not isinstance(assertion, dict) or set(assertion) - allowed:
        raise ValueError("only typed public assertion fields accepted")
    data = {key: assertion.get(key) for key in allowed}
    if (
        data["relation"] not in {"same_job", "repost_of", "source_migration"}
        or data["evidence_kind"] not in {"structured_source", "reviewed_public"}
        or data["status"] not in {"proposed", "accepted", "retracted"}
    ):
        raise ValueError("invalid identity assertion type")
    _public_ref(data["public_evidence_ref"])
    left, right = data["left_listing_id"], data["right_listing_id"]
    if left == right or not isinstance(left, UUID) or not isinstance(right, UUID):
        raise ValueError("distinct listing UUIDs required")
    for key in ("observed_at", "reviewed_at"):
        if data[key] is not None and (
            not isinstance(data[key], datetime) or data[key].tzinfo is None
        ):
            raise ValueError("aware public evidence timestamps required")
    if data["status"] == "accepted" and (
        data["evidence_kind"] != "reviewed_public" or data["reviewed_at"] is None
    ):
        raise ValueError("accepted assertion requires reviewed public evidence")
    enter_gate(conn)
    rows = conn.execute(
        "SELECT job_id FROM source_listings WHERE id=ANY(%s)", ([left, right],)
    ).fetchall()
    if len(rows) != 2:
        raise ValueError("unknown listing")
    lock_jobs(conn, [r["job_id"] for r in rows])
    validate_claim(conn, claim)
    if data["status"] == "accepted" and data["relation"] == "same_job":
        conflict = conn.execute(
            "SELECT 1 FROM identity_assertions WHERE left_listing_id=%s AND right_listing_id<>%s AND relation='same_job' AND status='accepted'",
            (left, right),
        ).fetchone()
        cycle = conn.execute(
            """WITH RECURSIVE paths(id) AS (
            SELECT %s::uuid UNION SELECT a.right_listing_id FROM identity_assertions a JOIN paths p ON a.left_listing_id=p.id
            WHERE a.relation='same_job' AND a.status='accepted') SELECT 1 FROM paths WHERE id=%s""",
            (right, left),
        ).fetchone()
        if conflict or cycle:
            raise ValueError("conflicting representative or accepted same-job cycle")
    old = conn.execute(
        "SELECT * FROM identity_assertions WHERE left_listing_id=%s AND right_listing_id=%s AND relation=%s",
        (left, right, data["relation"]),
    ).fetchone()
    if old and all(old[k] == v for k, v in data.items()):
        return old["id"]
    with _write(conn, claim, "identity_assertions"):
        return conn.execute(
            """INSERT INTO identity_assertions(left_listing_id,right_listing_id,relation,evidence_kind,public_evidence_ref,status,observed_at,reviewed_at)
            VALUES(%(left_listing_id)s,%(right_listing_id)s,%(relation)s,%(evidence_kind)s,%(public_evidence_ref)s,%(status)s,%(observed_at)s,%(reviewed_at)s)
            ON CONFLICT(left_listing_id,right_listing_id,relation) DO UPDATE SET evidence_kind=EXCLUDED.evidence_kind,
            public_evidence_ref=EXCLUDED.public_evidence_ref,status=EXCLUDED.status,observed_at=EXCLUDED.observed_at,
            reviewed_at=EXCLUDED.reviewed_at,revision=identity_assertions.revision+1 RETURNING id""",
            data,
        ).fetchone()["id"]
