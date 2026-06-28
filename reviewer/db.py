import uuid

from psycopg.types.json import Json

_REVIEW_COLUMNS = (
    "user_id", "job_id", "profile_version", "stage1_decision", "stage1_reason",
    "verdict", "experience_match", "industry", "industry_subcategory",
    "confidence", "reasoning", "model_stage1", "model_stage2", "error",
    "role_category", "seniority", "work_arrangement", "about",
    "pay_min", "pay_max", "pay_currency", "pay_period", "headcount",
    "skills_score", "experience_score", "comp_score", "fit_score",
    "red_flags", "skill_gaps", "benefits", "requirements",
)
_JSONB_COLUMNS = ("red_flags", "skill_gaps", "benefits", "requirements")

# Built once from the fixed column tuple (the row values are bound per call).
_UPSERT_REVIEW_SQL = (
    f"INSERT INTO job_reviews ({', '.join(_REVIEW_COLUMNS)}, reviewed_at)\n"
    f"VALUES ({', '.join(f'%({c})s' for c in _REVIEW_COLUMNS)}, now())\n"
    "ON CONFLICT (user_id, job_id) DO UPDATE SET\n"
    f"    {', '.join(f'{c} = EXCLUDED.{c}' for c in _REVIEW_COLUMNS if c not in ('user_id', 'job_id'))}"
    ", reviewed_at = now()"
)


def _uuid(v) -> uuid.UUID:
    # Bind user_id as a real uuid so comparisons are `uuid = uuid`, not `uuid = text`
    # (Postgres has no `uuid = text` operator for typed params).
    return v if isinstance(v, uuid.UUID) else uuid.UUID(str(v))


def load_profiles(conn) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT user_id, resume_text, instructions, profile_version, "
            "model_stage1, model_stage2, preferred_locations FROM profiles"
        )
        return cur.fetchall()


def select_candidates(
    conn, user_id: str, profile_version: str, limit: int,
    preferred_locations: list[str] | None = None,
) -> list[dict]:
    # Empty/None preference list = no location pre-filter (the `NOT has_prefs`
    # guard makes the whole OR true). When set, keep remote jobs always and
    # otherwise require an exact location match; blank locations are dropped.
    prefs = preferred_locations or []
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT j.id, j.title, j.location, j.description, c.ats, c.name AS company_name, COUNT(*) OVER() AS total_stale
            FROM jobs j
            JOIN companies c ON c.id = j.company_id
            LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = %(uid)s
            WHERE j.closed_at IS NULL
              AND (r.job_id IS NULL OR r.profile_version <> %(pv)s OR (r.fit_score IS NULL AND r.verdict IS NOT NULL))
              -- Denied roles are never re-reviewed: their JD is pruned to NULL by
              -- Rule A in prune.py, so a re-review after a profile change would be
              -- JD-blind.  A deny is final regardless of future profile versions.
              -- IS DISTINCT FROM treats NULL (never-reviewed) as NOT 'deny', so
              -- unreviewed jobs still pass through correctly.
              AND (r.verdict IS DISTINCT FROM 'deny')
              AND (NOT %(has_prefs)s OR j.remote IS TRUE OR j.location = ANY(%(prefs)s::text[]))
            ORDER BY j.first_seen_at DESC
            LIMIT %(lim)s
            """,
            {"uid": _uuid(user_id), "pv": profile_version, "lim": limit,
             "has_prefs": bool(prefs), "prefs": prefs},
        )
        return cur.fetchall()



def upsert_review(conn, row: dict) -> None:
    # Normalize to the full column set so callers may omit new keys; wrap JSONB.
    full = {c: row.get(c) for c in _REVIEW_COLUMNS}
    full["user_id"] = _uuid(full["user_id"])
    for c in _JSONB_COLUMNS:
        full[c] = Json(full[c] if full[c] is not None else [])
    with conn.cursor() as cur:
        cur.execute(_UPSERT_REVIEW_SQL, full)


def recent_stage2_reviews(conn, limit: int) -> list[dict]:
    """Return up to `limit` recent stage-2 reviews joined with job and profile data.

    Only rows that completed stage 2 (verdict IS NOT NULL, stage1_decision = 'pass')
    are included.  Results are ordered newest-first so the freshest golden examples
    are used when seeding a dataset.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT j.title, c.name AS company_name, j.location, c.ats, j.description,
                   p.resume_text, p.instructions, r.verdict
            FROM job_reviews r
            JOIN jobs j ON j.id = r.job_id
            JOIN companies c ON c.id = j.company_id
            JOIN profiles p ON p.user_id = r.user_id
            WHERE r.verdict IS NOT NULL
              AND r.stage1_decision = 'pass'
            ORDER BY r.reviewed_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def start_review_run(conn) -> int:
    with conn.cursor() as cur:
        cur.execute("INSERT INTO review_runs (started_at) VALUES (now()) RETURNING id")
        return cur.fetchone()["id"]


def finish_review_run(conn, run_id: int, *, reviewed: int, gate_rejected: int,
                      approved: int, denied: int, errors: int, notes: str | None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE review_runs SET
                finished_at   = now(),
                reviewed      = %s,
                gate_rejected = %s,
                approved      = %s,
                denied        = %s,
                errors        = %s,
                notes         = %s
            WHERE id = %s
            """,
            (reviewed, gate_rejected, approved, denied, errors, notes, run_id),
        )
