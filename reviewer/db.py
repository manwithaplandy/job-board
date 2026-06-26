import uuid

_REVIEW_COLUMNS = (
    "user_id", "job_id", "profile_version", "stage1_decision", "stage1_reason",
    "verdict", "experience_match", "industry", "industry_subcategory",
    "confidence", "reasoning", "model_stage1", "model_stage2", "error",
)

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
            "model_stage1, model_stage2 FROM profiles"
        )
        return cur.fetchall()


def select_candidates(conn, user_id: str, profile_version: str, limit: int) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT j.id, j.title, j.location, j.raw, c.ats, c.name AS company_name, COUNT(*) OVER() AS total_stale
            FROM jobs j
            JOIN companies c ON c.id = j.company_id
            LEFT JOIN job_reviews r ON r.job_id = j.id AND r.user_id = %(uid)s
            WHERE j.closed_at IS NULL
              AND (r.job_id IS NULL OR r.profile_version <> %(pv)s)
            ORDER BY j.first_seen_at DESC
            LIMIT %(lim)s
            """,
            {"uid": _uuid(user_id), "pv": profile_version, "lim": limit},
        )
        return cur.fetchall()



def upsert_review(conn, row: dict) -> None:
    row = {**row, "user_id": _uuid(row["user_id"])}
    with conn.cursor() as cur:
        cur.execute(_UPSERT_REVIEW_SQL, row)


def set_job_description(conn, job_id: str, description: str) -> None:
    with conn.cursor() as cur:
        cur.execute("UPDATE jobs SET description = %s WHERE id = %s", (description, job_id))


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
