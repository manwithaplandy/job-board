"""Service hydration. Network occurs only between committed, fenced transactions."""

import hashlib
import re
from uuid import UUID

from psycopg.types.json import Jsonb

from job_discovery.http import get_json
from job_discovery.jd import extract_description
from job_discovery.adapters.greenhouse import parse_greenhouse_questions
from .claims import claim_work, renew_claim, validate_claim
from .config import read_control, legacy_description_capture_allowed
from .identity import capture_version
from .locks import lock_jobs
from .reconcile import _write, StorageBlocked
from .types import DemandRef

KINDS = {"description", "questions", "review", "prepare", "generation"}
_COORDINATE = re.compile(r"^[A-Za-z0-9_-]{1,200}$")


def parse_payload(value):
    if not isinstance(value, dict):
        return None
    description = value.get("description")
    if (
        not isinstance(description, str)
        or not description.strip()
        or len(description.encode()) > 10 * 1024**2
    ):
        return None
    return {
        "description": description.strip(),
        "questions": parse_greenhouse_questions(value.get("questions")),
    }


def fetch_payload(coordinates):
    """Only stored ATS coordinates, exact detail GET or one bounded current feed.

    Unknown/malformed provider shapes defer. Never follow a job's application URL.
    """
    ats = coordinates.get("ats")
    board = coordinates.get("public_board_ref")
    external = coordinates.get("external_id")
    if not isinstance(board, str) or not isinstance(external, str):
        return None
    if ats == "workday":
        parts = board.split(":")
        if len(parts) != 3 or not all(_COORDINATE.fullmatch(p) for p in parts):
            return None
        tenant, datacenter, site = parts
        if (
            not re.fullmatch(r"wd\d+", datacenter)
            or not re.fullmatch(r"/job/[A-Za-z0-9_/-]{1,1000}", external)
            or ".." in external
        ):
            return None
        url = f"https://{tenant}.{datacenter}.myworkdayjobs.com/wday/cxs/{tenant}/{site}{external}"
    else:
        if not _COORDINATE.fullmatch(board) or not _COORDINATE.fullmatch(external):
            return None
        urls = {
            "greenhouse": f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs/{external}?questions=true",
            "lever": f"https://api.lever.co/v0/postings/{board}/{external}?mode=json",
            "smartrecruiters": f"https://api.smartrecruiters.com/v1/companies/{board}/postings/{external}",
            "ashby": f"https://api.ashbyhq.com/posting-api/job-board/{board}",
            "workable": f"https://apply.workable.com/api/v1/widget/accounts/{board}?details=true",
        }
        url = urls.get(ats)
        if url is None:
            return None
    data = get_json(url)
    if ats in {"ashby", "workable"}:
        items = data.get("jobs") if isinstance(data, dict) else None
        if not isinstance(items, list) or len(items) > 10000:
            return None
        key = "shortcode" if ats == "workable" else "id"
        matching = [
            item
            for item in items
            if isinstance(item, dict) and str(item.get(key)) == external
        ]
        if len(matching) != 1:
            return None
        data = matching[0]
    if not isinstance(data, dict):
        return None
    # The exact endpoint is authoritative, and any supplied identity must agree.
    if (
        ats in {"greenhouse", "lever", "smartrecruiters"}
        and str(data.get("id", external)) != external
    ):
        return None
    try:
        return parse_payload(
            {
                "description": extract_description(ats, data),
                "questions": data if ats == "greenhouse" else None,
            }
        )
    except (ValueError, TypeError, AttributeError, KeyError):
        return None


def request_demand(conn, job_id: str, user_id: str, kind: str) -> DemandRef:
    if kind not in KINDS:
        raise ValueError("invalid demand kind")
    lock_jobs(conn, [job_id])
    ready = conn.execute(
        """SELECT * FROM job_payload_demands WHERE user_id=%s AND job_id=%s AND kind=%s
        AND status='ready' AND job_version_id IS NOT NULL AND description_snapshot IS NOT NULL
        AND COALESCE(consumed_at,snapshot_captured_at)>clock_timestamp()-CASE WHEN kind IN ('questions','prepare') THEN interval '7 days' ELSE interval '30 days' END
        ORDER BY settled_at DESC LIMIT 1""",
        (UUID(user_id), job_id, kind),
    ).fetchone()
    if ready:
        return DemandRef(ready["id"], job_id, kind, None, "ready")
    row = conn.execute(
        """INSERT INTO job_payload_demands(user_id,job_id,kind)
        VALUES(%s,%s,%s) ON CONFLICT(user_id,job_id,kind) WHERE status IN ('pending','running') DO NOTHING
        RETURNING *""",
        (UUID(user_id), job_id, kind),
    ).fetchone()
    if row is None:
        row = conn.execute(
            "SELECT * FROM job_payload_demands WHERE user_id=%s AND job_id=%s AND kind=%s AND status IN ('pending','running')",
            (UUID(user_id), job_id, kind),
        ).fetchone()
    return DemandRef(row["id"], job_id, kind, None, row["status"])


def _finish(conn, demand, claim, status, version=None, payload=None):
    validate_claim(conn, claim)
    payload = payload or {}
    size = 8192 + 8 * len(str(payload).encode())
    with _write(conn, claim, "job_payload_demands", demand.job_id, size=size):
        row = conn.execute(
            """UPDATE job_payload_demands SET status=%s,job_version_id=%s,
            description_snapshot=%s,questions_snapshot=%s,snapshot_captured_at=CASE WHEN %s='ready' THEN clock_timestamp() ELSE NULL END,
            settled_at=clock_timestamp()
            WHERE id=%s AND status='running' AND claim_owner_token=%s AND claim_generation=%s
            RETURNING id""",
            (
                status,
                version,
                payload.get("description"),
                Jsonb(payload["questions"])
                if payload.get("questions") is not None
                else None,
                status,
                demand.id,
                claim.owner_token,
                claim.generation,
            ),
        ).fetchone()
        if row is None:
            raise RuntimeError("demand completion superseded")
    conn.commit()
    return status


def _hydrate_demand(conn, demand: DemandRef, fetch=fetch_payload) -> str:
    """Return pending/ready/deferred; ready is a committed exact-version snapshot.

    Does not overwrite shared payload: protected shared caches remain intact in
    this rollout. The consumer reads its durable demand snapshot instead.
    """
    lock_jobs(conn, [demand.job_id])
    row = conn.execute(
        "SELECT * FROM job_payload_demands WHERE id=%s AND job_id=%s",
        (demand.id, demand.job_id),
    ).fetchone()
    if not row or row["status"] in {"cancelled", "failed"}:
        conn.commit()
        return "deferred"
    if (
        row["status"] == "ready"
        and row["job_version_id"]
        and row["description_snapshot"]
    ):
        conn.commit()
        return "ready"
    if row["status"] == "deferred":
        conn.commit()
        return "deferred"
    claim = claim_work(conn, "demand", str(demand.id), 180)
    if claim is None:
        conn.commit()
        return "pending"
    if (
        legacy_description_capture_allowed(conn)
        and not conn.execute(
            "SELECT 1 FROM source_listings WHERE job_id=%s", (demand.job_id,)
        ).fetchone()
    ):
        from .identity import migrate_identity_batch

        with _write(conn, claim, "source_listings", demand.job_id, size=65536):
            migrate_identity_batch(conn, limit=1, job_ids=[demand.job_id])
    saved_package = None
    if demand.kind in {"prepare", "generation"}:
        saved_package = conn.execute(
            """SELECT job_version_id,description_snapshot,questions_snapshot,snapshot_captured_at,
            resume_json,cover_letter_json,prefilled_answers FROM application_packages WHERE user_id=%s AND job_id=%s""",
            (row["user_id"], demand.job_id),
        ).fetchone()
        if saved_package and not any(
            saved_package[field] is not None
            for field in ("resume_json", "cover_letter_json", "prefilled_answers")
        ):
            saved_package = None
    coordinates = conn.execute(
        """SELECT s.ats,s.public_board_ref,l.external_id,l.id listing_id,l.current_version_id,
        j.title,j.url,j.description,j.description_version_id,
        v.public_metadata FROM jobs j JOIN source_listings l ON l.job_id=j.id
        JOIN source_accounts s ON s.id=l.source_account_id
        LEFT JOIN job_versions v ON v.id=l.current_version_id WHERE j.id=%s
        AND j.closed_at IS NULL ORDER BY l.id LIMIT 1""",
        (demand.job_id,),
    ).fetchone()
    with _write(conn, claim, "job_payload_demands", demand.job_id):
        conn.execute(
            """UPDATE job_payload_demands SET status='running',claim_owner_token=%s,
            claim_generation=%s,lease_until=%s WHERE id=%s""",
            (claim.owner_token, claim.generation, claim.lease_until, demand.id),
        )
    conn.commit()
    if saved_package:
        if (
            not saved_package["job_version_id"]
            or not saved_package["description_snapshot"]
        ):
            return _finish(conn, demand, claim, "deferred")
        if (
            demand.kind == "generation"
            or saved_package["questions_snapshot"] is not None
        ):
            # A genuine new explicit capture of retained private input, not
            # reconstruction of its original demand identity or capture history.
            return _finish(
                conn,
                demand,
                claim,
                "ready",
                saved_package["job_version_id"],
                {
                    "description": saved_package["description_snapshot"],
                    "questions": saved_package["questions_snapshot"],
                },
            )
    if not coordinates:
        return _finish(conn, demand, claim, "deferred")
    try:
        payload = parse_payload(fetch(dict(coordinates)))
    except Exception:
        payload = None
    lock_jobs(conn, [demand.job_id])
    claim = renew_claim(
        conn, claim
    )  # fetch is bounded to 20 seconds, below renew interval
    current = conn.execute(
        "SELECT current_version_id FROM source_listings WHERE id=%s",
        (coordinates["listing_id"],),
    ).fetchone()
    if (
        not current
        or current["current_version_id"] != coordinates["current_version_id"]
    ):
        return _finish(conn, demand, claim, "deferred")
    if payload is None or (
        demand.kind in {"questions", "prepare"}
        and coordinates["ats"] == "greenhouse"
        and payload["questions"] is None
    ):
        return _finish(conn, demand, claim, "deferred")
    if saved_package:
        current_package = conn.execute(
            """SELECT job_version_id,description_snapshot,questions_snapshot,snapshot_captured_at,
            resume_json,cover_letter_json,prefilled_answers FROM application_packages WHERE user_id=%s AND job_id=%s""",
            (row["user_id"], demand.job_id),
        ).fetchone()
        if current_package != saved_package or payload["questions"] is None:
            return _finish(conn, demand, claim, "deferred")
        # First question acquisition preserves the original private JD/version.
        # The demand's capture timestamp records this new Q capture; the package
        # and its original JD capture timestamp are not changed by hydration.
        payload["description"] = saved_package["description_snapshot"]
        return _finish(
            conn, demand, claim, "ready", saved_package["job_version_id"], payload
        )
    metadata = dict(
        coordinates["public_metadata"]
        or {"title": coordinates["title"], "url": coordinates["url"]}
    )
    metadata["description_hash"] = hashlib.sha256(
        " ".join(payload["description"].split()).encode()
    ).hexdigest()
    version = capture_version(
        conn,
        coordinates["listing_id"],
        metadata,
        conn.execute("SELECT clock_timestamp() now").fetchone()["now"],
        claim,
    )
    if version is None:
        return _finish(conn, demand, claim, "deferred")
    result = _finish(conn, demand, claim, "ready", version, payload)
    # Demand completion is durable first. An empty shared cache may be filled by
    # this explicit demand; existing/protected content is never replaced.
    try:
        lock_jobs(conn, [demand.job_id])
        with _write(
            conn,
            claim,
            "jobs",
            demand.job_id,
            size=8192 + 8 * len(payload["description"].encode()),
        ):
            conn.execute(
                """UPDATE jobs SET description=%s,description_version_id=%s,
                description_captured_at=clock_timestamp(),description_capture_provenance='demand',description_pruned=false
                WHERE id=%s AND description IS NULL""",
                (payload["description"], version, demand.job_id),
            )
        conn.commit()
    except Exception:
        conn.rollback()  # private ready snapshot remains authoritative
    return result


def hydrate_demand(conn, demand: DemandRef, fetch=None) -> str:
    try:
        return _hydrate_demand(conn, demand, fetch or fetch_payload)
    except RuntimeError:
        conn.rollback()
        return "deferred"


def hydrate_candidates(conn, job_ids: list[str], user_id: str) -> list[str]:
    """Called only after deterministic entitlement/location/company filtering."""
    enabled = read_control(conn).hydration_enabled
    legacy_allowed = legacy_description_capture_allowed(conn)
    conn.commit()
    if not enabled and not legacy_allowed:
        return []
    if not enabled:
        return [
            row["id"]
            for row in conn.execute(
                "SELECT id FROM jobs WHERE id=ANY(%s) AND NULLIF(btrim(description),'') IS NOT NULL",
                (job_ids,),
            )
        ]
    ready = []
    for job_id in job_ids:
        demand = request_demand(conn, job_id, user_id, "review")
        conn.commit()
        try:
            if hydrate_demand(conn, demand) == "ready":
                ready.append(job_id)
        except (RuntimeError, StorageBlocked):
            conn.rollback()
    return ready


def process_pending(conn, limit=1):
    if not read_control(
        conn
    ).hydration_enabled and not legacy_description_capture_allowed(conn):
        conn.commit()
        return 0
    apply_consumptions(conn)
    rows = conn.execute(
        """SELECT * FROM job_payload_demands WHERE status='pending'
        OR (status='running' AND lease_until<=clock_timestamp()) ORDER BY created_at,id LIMIT %s""",
        (limit,),
    ).fetchall()
    conn.commit()
    for row in rows:
        try:
            hydrate_demand(
                conn,
                DemandRef(row["id"], row["job_id"], row["kind"], None, row["status"]),
            )
        except Exception:
            conn.rollback()
    return len(rows)


def apply_consumptions(conn, limit=100):
    """Service applies only committed owner consumption receipts, never views."""
    from .locks import enter_gate

    enter_gate(conn)
    rows = conn.execute(
        """SELECT id,job_id,job_version_id,kind,consumed_at FROM job_payload_demands
        WHERE consumed_at IS NOT NULL AND (consumption_applied_at IS NULL OR consumed_at>consumption_applied_at)
        ORDER BY consumed_at,id LIMIT %s""",
        (limit,),
    ).fetchall()
    lock_jobs(conn, [r["job_id"] for r in rows])
    for row in rows:
        conn.execute(
            """UPDATE jobs SET description_last_used_at=GREATEST(description_last_used_at,%s)
            WHERE id=%s AND description_version_id=%s""",
            (row["consumed_at"], row["job_id"], row["job_version_id"]),
        )
        if row["kind"] in {"questions", "prepare"}:
            conn.execute(
                """UPDATE job_questions SET last_used_at=GREATEST(last_used_at,%s)
                WHERE job_id=%s AND job_version_id=%s""",
                (row["consumed_at"], row["job_id"], row["job_version_id"]),
            )
        conn.execute(
            "UPDATE job_payload_demands SET consumption_applied_at=%s WHERE id=%s",
            (row["consumed_at"], row["id"]),
        )
    conn.commit()
    return len(rows)
