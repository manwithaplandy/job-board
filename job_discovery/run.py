from contextlib import nullcontext
from job_discovery.lifecycle.maintenance import pre_admission_maintenance
from job_discovery.lifecycle.locks import enter_gate
from job_discovery.lifecycle.capacity import CEILING_BYTES
from job_discovery.lifecycle.legacy_spool import spool_feed, spool_questions
import logging

from job_discovery import db
from job_discovery.adapters import ADAPTERS
from job_discovery.adapters.greenhouse import parse_greenhouse_questions
from job_discovery.http import get_json as _get_json
from job_discovery.targets import load_targets

log = logging.getLogger("job_discovery")


def backfill_greenhouse_questions(conn, company_id, token, *, get_json=None, log=log) -> int:
    """Fetch + persist the question schema for this Greenhouse company's open jobs that
    lack a job_questions row (rolling backfill). One HTTP call per missing job, each
    wrapped so a single failure never aborts the company. Returns the count persisted."""
    with spool_questions(conn, company_id, token, get_json or _get_json,
                         parse_greenhouse_questions, db.greenhouse_jobs_missing_questions,
                         log=log) as questions:
        fetched = 0
        for external_id, data in questions:
            db.insert_job_questions(conn, f"greenhouse:{token}:{external_id}", data, overwrite=False)
            fetched += 1
            if fetched % UPSERT_CHUNK_SIZE == 0:
                conn.commit()
        conn.commit()
        return fetched

# Upsert postings in fixed-size chunks. The workday adapter yields lazily to keep
# peak memory bounded (A10); buffering a whole tenant into one list before a single
# upsert would defeat that, so we flush every UPSERT_CHUNK_SIZE postings. At most
# one chunk (plus its detail payloads) is resident at a time.
UPSERT_CHUNK_SIZE = 500


def _run_prune(conn) -> None:
    try:
        from job_discovery.prune import prune_jobs
        prune_jobs(conn)
    except Exception:
        conn.rollback()
        log.exception("prune phase failed; poll results unaffected")


def _admit_chunk(conn, company_id, ats, token, chunk):
    """Measure again under the gate before each bounded admission transaction."""
    try:
        enter_gate(conn)
        over, _, _ = db.over_size_ceiling(conn)
        held = conn.execute("SELECT COALESCE(sum(bytes),0) AS bytes FROM capacity_reservations WHERE state='held'").fetchone()['bytes']
        # Conservative local forecast includes payload expansion/index/WAL room.
        # Enforced compatible writers still require their Task 3 reservations.
        forecast = sum(16384 + 4 * sum(len(str(value).encode('utf-8')) for value in db._posting_row(ats, token, company_id, p) if value is not None) for p in chunk)
        allocated = conn.execute('SELECT pg_database_size(current_database()) AS bytes').fetchone()['bytes']
        if over or allocated + held + forecast >= CEILING_BYTES:
            log.warning('admission paused at chunk boundary; source verification continues')
            conn.commit()
            return 0, True
    except Exception:
        conn.rollback()
        log.exception('admission capacity measurement failed; verification only')
        return 0, True
    admitted = db.upsert_jobs(conn, company_id, ats, token, chunk)
    conn.commit()
    return admitted, False


def run(dsn: str | None = None) -> dict:
    """Execute one poll cycle.

    Returns a counts dict with keys ``ok``, ``failed``, ``new_jobs``,
    ``closed_jobs``.  Callers (e.g. ``__main__``) use this to decide the
    process exit code.
    """
    maintenance = pre_admission_maintenance(dsn)
    targets = load_targets()
    conn = db.connect(dsn)
    try:
        # Advisory lock: only one poll run at a time per DB. pg_try_advisory_lock
        # returns TRUE if we acquired it, FALSE if another session holds it.
        locked = conn.execute(
            "SELECT pg_try_advisory_lock(hashtext('job_discovery_poll')) AS locked"
        ).fetchone()["locked"]
        if not locked:
            log.warning("another poll run holds the lock; exiting")
            return {"ok": 0, "failed": 0, "new_jobs": 0, "closed_jobs": 0}

        try:
            over, size_mb, ceiling_mb = db.over_size_ceiling(conn)
        except Exception:
            conn.rollback()
            log.exception("capacity check failed; verification only")
            over, size_mb, ceiling_mb = True, 0, 6000
        over = over or maintenance.blocked
        guard_note = None
        if over:
            guard_note = ("maintenance only: safety maintenance blocked admission" if maintenance.blocked
                          else f"maintenance only: capacity unavailable or db at {size_mb:.0f} MiB; ceiling {ceiling_mb:.0f} MiB")
            log.warning("%s; checking closures without ingestion or enrichment", guard_note)

        run_id = db.start_run(conn)
        if not over:
            db.sync_seed(conn, targets)
        conn.commit()
        companies = db.active_companies(conn)
        conn.commit()  # No read transaction spans adapter HTTP.

        ok = failed = new_jobs = closed_jobs = 0
        aborted = False
        failures: list[str] = []

        for co in companies:
            ats, token, company_id = co["ats"], co["token"], co["id"]
            try:
                company_closed = 0
                postings = (ADAPTERS[ats](token, fetch_details=False)
                            if over and ats in {"workday", "smartrecruiters"}
                            else ADAPTERS[ats](token))
                admissible_ids = set()
                with spool_feed(postings, admissible_ids=admissible_ids) as (buffered, seen):
                    questions_context = (spool_questions(
                        conn, company_id, token, _get_json, parse_greenhouse_questions,
                        db.greenhouse_jobs_missing_questions, admissible_ids, log,
                    ) if not over and ats == "greenhouse" else nullcontext(iter(())))
                    with questions_context as questions:
                        chunk: list = []
                        for p in buffered:
                            if over or not p.url or not p.title:
                                continue
                            chunk.append(p)
                            if len(chunk) >= UPSERT_CHUNK_SIZE:
                                admitted, over = _admit_chunk(conn, company_id, ats, token, chunk)
                                new_jobs += admitted
                                chunk = []
                        if chunk:
                            admitted, over = _admit_chunk(conn, company_id, ats, token, chunk)
                            new_jobs += admitted
                        for question_index, (external_id, data) in enumerate(questions, 1):
                            if over:
                                break
                            # Malformed feed entries were never admitted; retain the
                            # old FK behavior by writing only existing shared Jobs.
                            if conn.execute("SELECT 1 FROM jobs WHERE id=%s", (f"greenhouse:{token}:{external_id}",)).fetchone():
                                db.insert_job_questions(conn, f"greenhouse:{token}:{external_id}", data, overwrite=False)
                            if question_index % UPSERT_CHUNK_SIZE == 0:
                                conn.commit()
                        conn.commit()
                if over:
                    db.reopen_jobs(conn, company_id, seen)
                open_ids = db.get_open_external_ids(conn, company_id)
                if not seen and len(open_ids) > 20:
                    log.error(
                        "%s returned zero postings but has %d open jobs; skipping close-detection",
                        co["name"], len(open_ids),
                    )
                else:
                    company_closed += db.close_jobs(
                        conn, company_id, db.compute_newly_closed(open_ids, seen)
                    )
                # Healthy poll: clear any accrued failure streak in the same tx.
                db.record_poll_result(conn, company_id, ok=True)
                conn.commit()
                closed_jobs += company_closed
                ok += 1
            except Exception as exc:  # per-company isolation (incl. dead boards)
                try:
                    conn.rollback()
                except Exception:
                    log.exception("rollback failed for %s; attempting reconnect",
                                  co["name"])
                    # The old connection is unusable. Close it first — that releases
                    # its session advisory lock and frees the socket — so we don't
                    # leak the connection (and its lock) when we open a fresh one.
                    try:
                        conn.close()
                    except Exception:
                        log.exception("closing the broken connection failed")
                    try:
                        maintenance = pre_admission_maintenance(dsn)
                        conn = db.connect(dsn)
                        locked = conn.execute(
                            "SELECT pg_try_advisory_lock(hashtext('job_discovery_poll')) AS locked"
                        ).fetchone()["locked"]
                        if not locked:
                            raise RuntimeError("poll lock unavailable after reconnect")
                        try:
                            reconnect_over, _, _ = db.over_size_ceiling(conn)
                        except Exception:
                            conn.rollback()
                            reconnect_over = True
                        over = over or maintenance.blocked or reconnect_over
                    except Exception:
                        aborted = True
                        log.exception("reconnect failed; aborting poll")
                        failures.append(f"{co['name']}: {type(exc).__name__}: {exc}")
                        failed += 1
                        break
                failed += 1
                failures.append(f"{co['name']}: {type(exc).__name__}: {exc}")
                log.exception("poll failed for %s (%s:%s)", co["name"], ats, token)
                # Track the failure so a persistently dead board is eventually
                # deactivated. The company's poll work was rolled back, so this
                # write needs its own commit; isolate it so a hiccup here never
                # aborts the whole run.
                try:
                    deactivated = db.record_poll_result(conn, company_id, ok=False)
                    conn.commit()
                    if deactivated:
                        log.warning(
                            "deactivating dead board %s (%s:%s) after %d consecutive failures",
                            co["name"], ats, token, db.POLL_FAILURE_DEACTIVATE)
                except Exception:
                    try:
                        conn.rollback()
                    except Exception:
                        log.exception("rollback after failure-record error failed for %s",
                                      co["name"])
                    log.exception("recording poll failure for %s failed", co["name"])

        if aborted:
            # Reconnect/lock acquisition failed: accounting is best effort, and
            # this invocation must never enter any optional post-poll phase.
            try:
                db.finish_run(
                    conn, run_id, companies_ok=ok, companies_failed=failed,
                    new_jobs=new_jobs, closed_jobs=closed_jobs,
                    notes="; ".join(["poll aborted after reconnect failure", *failures]),
                )
                conn.commit()
            except Exception:
                log.exception("could not finalize aborted poll accounting")
            return {"ok": ok, "failed": failed, "new_jobs": new_jobs, "closed_jobs": closed_jobs}

        db.finish_run(
            conn, run_id,
            companies_ok=ok, companies_failed=failed,
            new_jobs=new_jobs, closed_jobs=closed_jobs,
            notes="; ".join(([guard_note] if guard_note else []) + failures) or None,
        )
        conn.commit()
        log.info("run complete: ok=%s failed=%s new=%s closed=%s",
                 ok, failed, new_jobs, closed_jobs)

        if over:
            _run_prune(conn)
            return {"ok": ok, "failed": failed, "new_jobs": new_jobs, "closed_jobs": closed_jobs}

        # Location canonicalization: resolve any raw location strings first
        # seen this poll, then re-stamp jobs.location_canonicals (also
        # propagates manual corrections). Runs before the review phase so
        # tonight's reviews filter on fresh canonicals. Failure is isolated —
        # unresolved raws just retry tomorrow.
        try:
            from job_discovery.locations import resolve_new_locations
            resolve_new_locations(conn)
            conn.commit()
        except Exception:
            conn.rollback()
            log.exception("location resolution failed; poll results unaffected")

        try:
            from reviewer.run import review_all
            review_all(conn)
        except Exception:
            conn.rollback()
            log.exception("review phase failed; poll results unaffected")

        _run_prune(conn)
    finally:
        conn.close()

    return {"ok": ok, "failed": failed, "new_jobs": new_jobs, "closed_jobs": closed_jobs}
