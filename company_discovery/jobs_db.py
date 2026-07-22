# company_discovery/jobs_db.py
"""classification_jobs queue + target selection + classification persistence.

The admin-launched `classification_jobs` queue is drained by the always-on worker
(company_discovery/worker.py). Every function here takes an open psycopg connection
(dict_row) and never commits — the worker owns transaction boundaries so a chunk of
classifications + its progress bump land atomically.

`select_targets`'s ordering/predicates MUST stay in lockstep with the dashboard's
target-count SQL (dashboard/lib/classificationJobs.ts) — spend hits maximum board
impact first: companies with the most open jobs, then newest first_seen_at.
"""

from psycopg.types.json import Json

# Predicate (on alias `c`, the companies table) selecting classification targets per mode.
_TARGET_MODES = {
    "unclassified": "c.classified_at IS NULL",
    "unknown_repass": (
        "c.classified_at IS NOT NULL AND ("
        "COALESCE(c.size, 'unknown') = 'unknown'"
        " OR COALESCE(c.hq_country, 'unknown') = 'unknown'"
        " OR COALESCE(c.industry, 'unknown') = 'unknown'"
        " OR c.classification_confidence = 'low')"
    ),
}


def claim_next_job(conn) -> dict | None:
    """Atomically claim the oldest pending job: flip it to 'running', stamp
    started_at (only if not already set), return the full row (or None if none
    pending). FOR UPDATE SKIP LOCKED keeps concurrent workers from claiming the
    same row.

    started_at uses COALESCE(started_at, now()) so a RESUMED job (one requeued to
    'pending' by stale-job recovery or a graceful-shutdown requeue) keeps its ORIGINAL
    started_at — the unknown_repass `before` bound must not slide forward on resume,
    or rows classified in the first attempt (but still 'unknown') would be re-selected
    forever. A first claim (started_at IS NULL) gets now().

    last_progress_at is stamped to now() (NOT coalesced) so a freshly claimed or resumed
    job starts with a fresh heartbeat — recover_orphaned_jobs's staleness gate must not
    consider a just-claimed job stale, and a concurrent (overlapping-deploy) worker's
    sweep must see this claim as live from the moment it is taken."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE classification_jobs
               SET status = 'running', started_at = COALESCE(started_at, now()),
                   last_progress_at = now()
            WHERE id = (SELECT id FROM classification_jobs WHERE status = 'pending'
                        ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
            RETURNING *
            """
        )
        return cur.fetchone()


def recover_orphaned_jobs(conn, stale_minutes: int = 15) -> int:
    """Requeue jobs left 'running' by a crashed / SIGKILLed worker so they resume
    instead of hanging forever. Called each poll cycle (and thus at boot) by
    worker.process_one, NOT boot-only — a connection drop mid-job can leave a row
    'running' while the process keeps looping after a successful reconnect, so relying
    on the next reboot (an always-on service may not reboot for weeks) would hang the
    row forever.

    Heartbeat-gated: only rows whose last progress (COALESCE(last_progress_at,
    started_at)) is older than `stale_minutes` are requeued. This is what makes the
    per-cycle sweep safe when TWO workers overlap (e.g. a Railway zero-downtime deploy):
    the old container's actively-owned job bumps last_progress_at every chunk (~25 LLM
    calls, well inside 15 min), so the new container's sweep sees it as live and never
    reaps a job someone is mid-classifying. A truly crashed job stops bumping and is
    requeued once its heartbeat ages past the gate.

    Preserves started_at (the unknown_repass `before` bound) and processed/errored
    (so the resumed run does not double-spend company_cap — process_job computes
    remaining = company_cap - processed - errored). Returns the number requeued.

    NOTE: this single-loop worker needs no in-flight exclude set (unlike the parallel
    reviewer worker's recover_stale_review_requests): the sweep runs only at the TOP of
    process_one, before any claim and never concurrently with process_job, so this
    worker can never reap its own in-flight job regardless of the gate."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE classification_jobs SET status = 'pending'
            WHERE status = 'running'
              AND COALESCE(last_progress_at, started_at)
                    < now() - make_interval(mins => %(mins)s)
            """,
            {"mins": stale_minutes},
        )
        return cur.rowcount


def requeue_job(conn, job_id: int) -> None:
    """Flip a claimed job back to 'pending' for a later resume (graceful shutdown).
    started_at and the processed/errored counters are left intact so the resumed run
    keeps its unknown_repass `before` bound and does not re-spend the cap. Guarded on
    status = 'running' so a concurrent admin cancel (status='canceled') is never
    clobbered back into the queue."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE classification_jobs SET status = 'pending' "
            "WHERE id = %s AND status = 'running'",
            (job_id,),
        )


def job_status(conn, job_id: int) -> str:
    """Current status of a job (used mid-run to detect an admin cancel)."""
    with conn.cursor() as cur:
        cur.execute("SELECT status FROM classification_jobs WHERE id = %s", (job_id,))
        row = cur.fetchone()
    return row["status"] if row else "error"


def select_targets(conn, mode: str, limit: int, *, before=None) -> list[dict]:
    """Companies to classify next, highest board impact first (most open jobs,
    then newest first_seen_at). `before` (timestamptz) applies to 'unknown_repass'
    only: also require classified_at < before (the job's started_at) so a company
    re-classified this run but still 'unknown' is not re-selected forever. Ignored
    for 'unclassified'.

    MUST stay in lockstep with dashboard/lib/classificationJobs.ts countTargets()."""
    predicate = _TARGET_MODES[mode]
    params = {"lim": limit}
    if mode == "unknown_repass" and before is not None:
        predicate = f"({predicate}) AND c.classified_at < %(before)s"
        params["before"] = before
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT c.id, c.name, c.ats, c.token, c.display_name, c.about,
                   c.web_description, c.enriched_at, c.web_searched_at
            FROM companies c
            LEFT JOIN (SELECT company_id, count(*) AS n FROM jobs
                       WHERE closed_at IS NULL GROUP BY company_id) o
              ON o.company_id = c.id
            WHERE {predicate}
            ORDER BY COALESCE(o.n, 0) DESC, c.first_seen_at DESC
            LIMIT %(lim)s
            """,
            params,
        )
        return cur.fetchall()


def apply_classification(conn, company_id: int, res, *, model: str, source: str) -> None:
    """Stamp the global classification facts onto a company row. `res` is a
    CompanyClassificationResult (Task 3). classified_at is set to now()."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE companies SET
              industry = %s, industry_subcategory = %s, size = %s, hq_country = %s,
              tech_tags = %s, red_flags = %s, classification_confidence = %s,
              classified_at = now(), classification_model = %s, classification_source = %s
            WHERE id = %s
            """,
            (res.industry, res.industry_subcategory, res.size, res.hq_country,
             Json(res.tech_tags), Json([f.model_dump() for f in res.red_flags]),
             res.confidence, model, source, company_id),
        )


def bump_progress(conn, job_id: int, *, processed=0, errored=0, serp=0,
                  prompt_tokens=0, completion_tokens=0, cost=None) -> None:
    """Accumulate one chunk's counters onto the job row. actual_cost only advances
    when a cost is supplied (COALESCE(actual_cost, 0) + cost), so a run that never
    saw a usage.cost leaves actual_cost NULL rather than a misleading 0.

    Also refreshes last_progress_at to now(): every chunk is a liveness heartbeat, so a
    job that is making progress is never mistaken for a crashed orphan by
    recover_orphaned_jobs's staleness gate (even across an overlapping deploy)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE classification_jobs SET
              processed = processed + %(processed)s,
              errored = errored + %(errored)s,
              serp_queries = serp_queries + %(serp)s,
              actual_prompt_tokens = actual_prompt_tokens + %(ptok)s,
              actual_completion_tokens = actual_completion_tokens + %(ctok)s,
              last_progress_at = now(),
              actual_cost = CASE WHEN %(cost)s::numeric IS NULL THEN actual_cost
                                 ELSE COALESCE(actual_cost, 0) + %(cost)s::numeric END
            WHERE id = %(id)s
            """,
            {"processed": processed, "errored": errored, "serp": serp,
             "ptok": prompt_tokens, "ctok": completion_tokens, "cost": cost,
             "id": job_id},
        )


def finish_job(conn, job_id: int, status: str, error: str | None = None) -> None:
    """Terminal transition: stamp status/error/finished_at."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE classification_jobs SET status = %s, error = %s, finished_at = now() "
            "WHERE id = %s",
            (status, error, job_id),
        )
