# company_discovery/db.py
import uuid

from psycopg.types.json import Json

from company_discovery.dataset import Candidate

_REVIEW_COLUMNS = (
    "user_id", "company_id", "company_profile_version", "verdict", "confidence",
    "reasoning", "industry", "industry_subcategory", "tech_tags", "red_flags",
    "model", "error",
)
_JSONB_COLUMNS = ("tech_tags", "red_flags")

# UPSERT updates only AI columns — human_override / override_verdict are sticky.
_UPSERT_REVIEW_SQL = (
    f"INSERT INTO company_reviews ({', '.join(_REVIEW_COLUMNS)}, reviewed_at)\n"
    f"VALUES ({', '.join(f'%({c})s' for c in _REVIEW_COLUMNS)}, now())\n"
    "ON CONFLICT (user_id, company_id) DO UPDATE SET\n"
    f"    {', '.join(f'{c} = EXCLUDED.{c}' for c in _REVIEW_COLUMNS if c not in ('user_id', 'company_id'))}"
    ", reviewed_at = now()"
)


def _uuid(v) -> uuid.UUID:
    return v if isinstance(v, uuid.UUID) else uuid.UUID(str(v))


def load_company_profiles(conn) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT user_id, company_instructions, company_profile_version, model_company "
            "FROM profiles WHERE company_instructions IS NOT NULL AND company_instructions <> ''"
        )
        return cur.fetchall()


def upsert_candidates(conn, candidates: list[Candidate]) -> int:
    inserted = 0
    with conn.cursor() as cur:
        for c in candidates:
            cur.execute(
                "INSERT INTO companies (name, ats, token, active, discovery_source) "
                "VALUES (%s, %s, %s, FALSE, 'dataset') "
                "ON CONFLICT (ats, token) DO NOTHING",
                (c.name, c.ats, c.token),
            )
            inserted += cur.rowcount
    return inserted


def select_for_review(conn, user_id: str, company_profile_version: str,
                      limit: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.id, c.name, c.ats, c.token,
                   c.display_name, c.about, c.web_description
            FROM companies c
            LEFT JOIN company_reviews r ON r.company_id = c.id AND r.user_id = %(uid)s
            WHERE c.discovery_source NOT IN ('seed', 'manual')
              AND (r.company_id IS NULL
                   OR (r.human_override = FALSE AND r.company_profile_version <> %(pv)s)
                   OR (r.human_override = FALSE AND r.error IS NOT NULL)
                   OR (r.human_override = FALSE AND c.enriched_at > r.reviewed_at))
            ORDER BY c.first_seen_at DESC
            LIMIT %(lim)s
            """,
            {"uid": _uuid(user_id), "pv": company_profile_version, "lim": limit},
        )
        return cur.fetchall()


def upsert_company_review(conn, row: dict) -> None:
    full = {c: row.get(c) for c in _REVIEW_COLUMNS}
    full["user_id"] = _uuid(full["user_id"])
    for c in _JSONB_COLUMNS:
        full[c] = Json(full[c] if full[c] is not None else [])
    with conn.cursor() as cur:
        cur.execute(_UPSERT_REVIEW_SQL, full)


def reconcile_active(conn, user_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE companies c SET active = sub.is_active
            FROM (
              SELECT c2.id,
                (c2.discovery_source = 'seed'
                 OR COALESCE(
                      CASE WHEN r.human_override THEN r.override_verdict ELSE r.verdict END,
                      'exclude') = 'include') AS is_active
              FROM companies c2
              LEFT JOIN company_reviews r ON r.company_id = c2.id AND r.user_id = %(uid)s
              WHERE c2.discovery_source <> 'manual'
            ) sub
            WHERE c.id = sub.id AND c.active IS DISTINCT FROM sub.is_active
            """,
            {"uid": _uuid(user_id)},
        )


def count_backlog(conn, user_id: str, company_profile_version: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT count(*)::int AS n
            FROM companies c
            LEFT JOIN company_reviews r ON r.company_id = c.id AND r.user_id = %(uid)s
            WHERE c.discovery_source NOT IN ('seed', 'manual')
              AND (r.company_id IS NULL
                   OR (r.human_override = FALSE AND r.company_profile_version <> %(pv)s)
                   OR (r.human_override = FALSE AND r.error IS NOT NULL)
                   OR (r.human_override = FALSE AND c.enriched_at > r.reviewed_at))
            """,
            {"uid": _uuid(user_id), "pv": company_profile_version},
        )
        return cur.fetchone()["n"]


def start_discovery_run(conn) -> int:
    with conn.cursor() as cur:
        cur.execute("INSERT INTO discovery_runs (started_at) VALUES (now()) RETURNING id")
        return cur.fetchone()["id"]


def finish_discovery_run(conn, run_id: int, *, status: str, ingested: int,
                         reviewed: int, included: int, excluded: int, unknown: int,
                         errors: int, backlog: int, notes: str | None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE discovery_runs SET
                finished_at = now(), status = %s, ingested = %s, reviewed = %s,
                included = %s, excluded = %s, unknown = %s, errors = %s,
                backlog = %s, notes = %s
            WHERE id = %s
            """,
            (status, ingested, reviewed, included, excluded, unknown, errors,
             backlog, notes, run_id),
        )


def set_halted(conn, halted: bool) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE discovery_state SET halted_no_credits = %s, updated_at = now() WHERE id = TRUE",
            (halted,),
        )
