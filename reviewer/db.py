import uuid

from psycopg.types.json import Json

from reviewer import entitlements as _entitlements

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


_PROFILE_COLUMNS = """
    p.user_id, p.resume_text, p.instructions, p.profile_version,
    p.model_stage1, p.model_stage2, p.preferred_locations, p.daily_review_cap,
    s.plan AS sub_plan, s.status AS sub_status,
    s.current_period_end AS sub_current_period_end,
    EXISTS(SELECT 1 FROM invite_redemptions ir WHERE ir.user_id = p.user_id) AS invited
"""
# LEFT JOIN the subscription mirror + compute the server-side invite proof so
# run._review_user can resolve each user's tier entitlement (plan → model + daily cap).
_LOAD_PROFILES_SQL = f"""
    SELECT {_PROFILE_COLUMNS}
    FROM profiles p
    LEFT JOIN subscriptions s ON s.user_id = p.user_id
"""


def load_tier_settings(conn) -> dict:
    """The DB-overlaid entitlements map (T1). Read ONCE per reviewer run and threaded
    into entitlements.resolve_stage2_model / daily_review_cap so an operator can retune
    caps/allowances via `UPDATE tier_settings` and have the NEXT run honor it — no
    redeploy, no restart. Mirrors dashboard/lib/tierConfig.ts's overlay + fallback:
    invalid/partial config falls back field-by-field to the compiled defaults, and a
    read failure degrades to the compiled defaults rather than aborting the run."""
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT plan, config FROM tier_settings")
            rows = cur.fetchall()
    except Exception:
        conn.rollback()
        return _entitlements.overlay_entitlements([])
    return _entitlements.overlay_entitlements(rows)


def load_invite_comp_plan(conn) -> str:
    """app_settings.invite_comp_plan, read once per run (same lifecycle as
    load_tier_settings) and threaded into resolve_plan, so an operator's comp-plan
    change is honored on the next run with no redeploy. Degrades to the compiled
    default on any read failure."""
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM app_settings WHERE key = 'invite_comp_plan'")
            row = cur.fetchone()
    except Exception:
        conn.rollback()
        return _entitlements.DEFAULT_INVITE_COMP_PLAN
    return _entitlements.parse_comp_plan(row["value"] if row else None)


def load_profiles(conn) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(_LOAD_PROFILES_SQL)
        return cur.fetchall()


def load_profile(conn, user_id: str) -> dict | None:
    """Same shape as load_profiles but for a single user (the on-demand worker)."""
    with conn.cursor() as cur:
        cur.execute(_LOAD_PROFILES_SQL + " WHERE p.user_id = %s", (_uuid(user_id),))
        return cur.fetchone()


def user_deleted(conn, user_id: str) -> bool:
    """True if `user_id` has an account_deletions tombstone — the account was erased.

    M-RESURRECT-2: an account can be deleted WHILE a review run is in flight (the
    profile was loaded before the erasure cascade, and the reviewer does slow LLM work
    in between). The reviewer re-checks this at its write boundary so it never re-INSERTs
    job_reviews / usage_counters rows for a just-deleted user (recreated PII). A cheap
    EXISTS, mirroring the dashboard's lib/tombstone.ts gate keyed on the same table.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT EXISTS(SELECT 1 FROM account_deletions WHERE user_id = %s) AS deleted",
            (_uuid(user_id),),
        )
        row = cur.fetchone()
    return bool(row and row["deleted"])


# Namespaced key for the per-user review advisory lock (M-TOCTOU). Session-scoped so
# it survives _review_user's intermediate commits (start_review_run, _persist_rows'
# per-chunk commits); it must be explicitly released with unlock_user_review.
def _review_lock_key(user_id: str) -> str:
    return f"reviewer:review:{user_id}"


def try_lock_user_review(conn, user_id: str) -> bool:
    """Try to take the per-user review lock; True if acquired, False if held elsewhere.

    M-TOCTOU: the cron reviewer (run.review_all) and the on-demand worker can both run
    for the SAME user at once. Each reads spend, computes remaining = cap - spend, and
    selects up to `remaining` candidates — so two concurrent runs can each read spend=0
    and each spend up to the cap, charging the operator's LLM balance up to 2x the daily
    budget. This SESSION-level advisory lock serializes per-user review spend: only one
    run reviews a given user at a time. It is non-blocking (pg_try_advisory_lock) — a
    concurrent run skips the user (its budget is covered by the lock holder) instead of
    blocking the whole cron loop behind a slow LLM batch. Release with unlock_user_review
    AFTER the spend/finish commit, so the next run reads the committed spend.

    KEY WIDTH (minor 10): use hashtextextended(key, 0) → bigint (64-bit), NOT hashtext
    → int4 (32-bit). A 32-bit lock space collides across users at ~77k users (birthday
    bound); a collision would make one user's review spuriously SKIP because an unrelated
    user holds the "same" lock. hashtext is not usable here — pg_try_advisory_lock takes
    either two int4s or one bigint, and hashtext's int4 would land in the 2×int4 overload,
    keeping the 32-bit space. hashtextextended's bigint uses the single-key 64-bit overload.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT pg_try_advisory_lock(hashtextextended(%(k)s, 0)) AS locked",
            {"k": _review_lock_key(user_id)},
        )
        return bool(cur.fetchone()["locked"])


def unlock_user_review(conn, user_id: str) -> None:
    """Release the per-user review lock taken by try_lock_user_review (M-TOCTOU)."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT pg_advisory_unlock(hashtextextended(%(k)s, 0))",
            {"k": _review_lock_key(user_id)},
        )


# The single UTC clock for the daily budget. Reading and writing spend both derive
# the day from the DB's now() so there is no client/server skew and no cron: the
# (user_id, day, kind) key rolls over on its own at UTC midnight.
_UTC_DAY_SQL = "(now() AT TIME ZONE 'utc')::date"


def get_daily_spend(conn, user_id: str, kind: str = "review") -> int:
    """Jobs already charged to this user's budget today (UTC). 0 when none."""
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT COALESCE(n, 0)::int AS n FROM usage_counters "
            f"WHERE user_id = %(uid)s AND kind = %(kind)s AND day = {_UTC_DAY_SQL}",
            {"uid": _uuid(user_id), "kind": kind},
        )
        row = cur.fetchone()
    return row["n"] if row else 0


def add_daily_spend(conn, user_id: str, n: int, kind: str = "review") -> None:
    """Charge n jobs to this user's daily budget (UTC day, upserted in place).

    Committed by the caller in the same transaction as the persisted review rows,
    so spend and rows move together.
    """
    if n <= 0:
        return
    with conn.cursor() as cur:
        cur.execute(
            f"INSERT INTO usage_counters (user_id, day, kind, n) "
            f"VALUES (%(uid)s, {_UTC_DAY_SQL}, %(kind)s, %(n)s) "
            f"ON CONFLICT (user_id, day, kind) "
            f"DO UPDATE SET n = usage_counters.n + EXCLUDED.n",
            {"uid": _uuid(user_id), "kind": kind, "n": n},
        )


def select_candidates(
    conn, user_id: str, profile_version: str, limit: int,
    preferred_locations: list[str] | None = None,
) -> tuple[list[dict], int]:
    """Return (rows, total_stale) where total_stale is the unbounded stale count.

    Splitting the count into a separate bounded SELECT avoids materialising the
    full stale set before LIMIT when the window-aggregate approach would do.
    """
    # Empty/None preference list = no location pre-filter (the `NOT has_prefs`
    # guard makes the whole OR true). When set: match the job's canonical
    # locations (array overlap; falls back to the raw string for jobs not yet
    # stamped), and remote jobs ONLY when the user opted in by selecting
    # 'Remote' (spec 2026-07-16: remote no longer bypasses the filter).
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
          AND (NOT %(has_prefs)s
               OR COALESCE(j.location_canonicals, ARRAY[j.location]) && %(prefs)s::text[]
               OR ('Remote' = ANY(%(prefs)s::text[]) AND j.remote IS TRUE))
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
            f"SELECT j.id, j.title, j.location, j.remote, j.description,"
            f" c.ats, COALESCE(c.display_name, c.name) AS company_name"
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
            SELECT j.title, COALESCE(c.display_name, c.name) AS company_name, j.location, c.ats, j.description,
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


def start_review_run(conn, user_id: str | None = None) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO review_runs (started_at, user_id) VALUES (now(), %s) RETURNING id",
            (_uuid(user_id) if user_id is not None else None,),
        )
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


# ── On-demand review queue (reviewer.worker consumes review_requests) ─────────

def claim_next_review_request(conn) -> dict | None:
    """Atomically claim the oldest pending request → status='running'. FOR UPDATE SKIP
    LOCKED lets multiple workers run without ever grabbing the same row. Returns the
    claimed {id, user_id} or None when the queue is empty. Caller commits."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE review_requests SET status = 'running', started_at = now()
            WHERE id = (
              SELECT id FROM review_requests WHERE status = 'pending'
              ORDER BY requested_at
              FOR UPDATE SKIP LOCKED LIMIT 1
            )
            RETURNING id, user_id
            """
        )
        return cur.fetchone()


def finish_review_request(conn, req_id: int, status: str, notes: str | None = None) -> None:
    """Transition a claimed request to a terminal status ('done' | 'failed'). Caller commits."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE review_requests SET status = %s, finished_at = now(), notes = %s WHERE id = %s",
            (status, notes, req_id),
        )


def recover_stale_review_requests(conn, minutes: int = 30) -> int:
    """Fail requests stuck 'running' longer than `minutes` so a crashed worker can't
    wedge a user's only active slot (the partial unique index counts 'running').
    Returns the number recovered. Caller commits."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE review_requests SET status = 'failed', finished_at = now(),
                   notes = 'worker timeout — re-request'
            WHERE status = 'running' AND started_at < now() - make_interval(mins => %s)
            """,
            (minutes,),
        )
        return cur.rowcount


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
            SELECT rc.user_id, rc.job_id, j.title, COALESCE(c.display_name, c.name) AS company_name,
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
