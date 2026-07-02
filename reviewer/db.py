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
# The WHERE guard makes a hand-set verdict sticky: once the operator denies a
# job by hand (verdict='deny', human_override=TRUE), the AI's upsert is a no-op
# and can never overwrite it.
_UPSERT_REVIEW_SQL = (
    f"INSERT INTO job_reviews ({', '.join(_REVIEW_COLUMNS)}, reviewed_at)\n"
    f"VALUES ({', '.join(f'%({c})s' for c in _REVIEW_COLUMNS)}, now())\n"
    "ON CONFLICT (user_id, job_id) DO UPDATE SET\n"
    f"    {', '.join(f'{c} = EXCLUDED.{c}' for c in _REVIEW_COLUMNS if c not in ('user_id', 'job_id'))}"
    ", reviewed_at = now()\n"
    "    WHERE job_reviews.human_override IS NOT TRUE"
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
) -> tuple[list[dict], int]:
    """Return (rows, total_stale) where total_stale is the unbounded stale count.

    Splitting the count into a separate bounded SELECT avoids materialising the
    full stale set before LIMIT when the window-aggregate approach would do.
    """
    # Empty/None preference list = no location pre-filter (the `NOT has_prefs`
    # guard makes the whole OR true). When set, keep remote jobs always and
    # otherwise require an exact location match; blank locations are dropped.
    prefs = preferred_locations or []
    _where = """
        FROM jobs j
        JOIN companies c ON c.id = j.company_id
        LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = %(uid)s
        WHERE j.closed_at IS NULL
          AND (
            r.job_id IS NULL
            OR r.profile_version <> %(pv)s
            OR (r.fit_score IS NULL AND r.verdict IS NOT NULL)
            OR r.error IS NOT NULL
          )
          -- Denied roles are never re-reviewed: their JD is pruned to NULL by
          -- Rule A in prune.py, so a re-review after a profile change would be
          -- JD-blind.  A deny is final regardless of future profile versions.
          -- IS DISTINCT FROM treats NULL (never-reviewed) as NOT 'deny', so
          -- unreviewed jobs still pass through correctly.
          AND (r.verdict IS DISTINCT FROM 'deny')
          AND NOT COALESCE(j.description_pruned, FALSE)
          AND (NOT %(has_prefs)s OR j.remote IS TRUE OR j.location = ANY(%(prefs)s::text[]))
    """
    params = {"uid": _uuid(user_id), "pv": profile_version, "lim": limit,
              "has_prefs": bool(prefs), "prefs": prefs}
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT count(*)::int AS n {_where}",
            params,
        )
        total = cur.fetchone()["n"]
        cur.execute(
            f"SELECT j.id, j.title, j.location, j.description, c.ats, c.name AS company_name"
            f" {_where} ORDER BY j.first_seen_at DESC LIMIT %(lim)s",
            params,
        )
        rows = cur.fetchall()
    return rows, total



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


def golden_corrections(conn) -> list[dict]:
    """Human corrections joined to each job's review inputs, for dataset seeding.

    input fields (title..instructions) reconstruct the review_one call; the
    remaining fields are the golden expected_output. Newest-first.

    Snapshot columns (description_snapshot, resume_text_snapshot,
    instructions_snapshot) are preferred over live job/profile data so that
    corrections remain stable even after the job description is pruned or the
    candidate's résumé is updated (C-lane DDL; COALESCE falls back to live for
    legacy rows where snapshots were not captured).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT rc.user_id, rc.job_id, j.title, c.name AS company_name,
                   j.location, c.ats,
                   COALESCE(rc.description_snapshot, j.description) AS description,
                   COALESCE(rc.resume_text_snapshot, p.resume_text) AS resume_text,
                   COALESCE(rc.instructions_snapshot, p.instructions) AS instructions,
                   rc.verdict, rc.experience_match, rc.industry,
                   rc.industry_subcategory, rc.confidence, rc.role_category,
                   rc.seniority, rc.work_arrangement,
                   rc.skills_score, rc.experience_score, rc.comp_score,
                   rc.note, rc.corrected_at
            FROM review_corrections rc
            JOIN jobs j ON j.id = rc.job_id
            JOIN companies c ON c.id = j.company_id
            JOIN profiles p ON p.user_id = rc.user_id
            ORDER BY rc.corrected_at DESC
            """
        )
        return cur.fetchall()
