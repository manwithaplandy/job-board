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
    get_json = get_json or _get_json
    fetched = 0
    for external_id in db.greenhouse_jobs_missing_questions(conn, company_id):
        url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs/{external_id}?questions=true"
        # ONLY the HTTP fetch + pure parse are swallowed. A DB write error must NOT be
        # caught here — a failed statement aborts the transaction, and continuing to
        # issue statements (all silently caught) then `conn.commit()` in the poll loop
        # would commit an aborted tx (→ rollback), discarding the company's whole
        # upsert_jobs work with no error. Let db errors propagate to the per-company
        # handler, which rolls back correctly (mirrors smartrecruiters/workday:
        # HTTP-only try/except).
        try:
            questions = parse_greenhouse_questions(get_json(url))
        except Exception as e:  # noqa: BLE001 — fetch/parse only; never abort the company
            log.warning("greenhouse question fetch failed for %s:%s (%s)", token, external_id, e)
            continue
        if questions and questions["questions"]:
            db.insert_job_questions(conn, f"greenhouse:{token}:{external_id}", questions)
            fetched += 1
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


def run(dsn: str | None = None) -> dict:
    """Execute one poll cycle.

    Returns a counts dict with keys ``ok``, ``failed``, ``new_jobs``,
    ``closed_jobs``.  Callers (e.g. ``__main__``) use this to decide the
    process exit code.
    """
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

        over, size_mb, ceiling_mb = db.over_size_ceiling(conn)
        if over:
            log.error(
                "DB at %.0f MB >= ceiling %.0f MB; skipping poll to stay under the "
                "disk limit (no jobs written this run)", size_mb, ceiling_mb,
            )
            # Record the ceiling-guard fire so operators can see it in poll_runs.
            note = f"skipped: db at {size_mb:.0f} MB >= ceiling {ceiling_mb:.0f} MB"
            run_id = db.start_run(conn)
            db.finish_run(conn, run_id,
                          companies_ok=0, companies_failed=0,
                          new_jobs=0, closed_jobs=0, notes=note)
            conn.commit()
            # Still prune when the ceiling is breached: prune is delete/strip-only
            # and is the only automated mechanism that can shrink the DB back under
            # the ceiling.  Skipping it here would stall recovery.
            _run_prune(conn)
            return {"ok": 0, "failed": 0, "new_jobs": 0, "closed_jobs": 0}

        run_id = db.start_run(conn)
        db.sync_seed(conn, targets)
        conn.commit()
        companies = db.active_companies(conn)

        ok = failed = new_jobs = closed_jobs = 0
        failures: list[str] = []

        for co in companies:
            ats, token, company_id = co["ats"], co["token"], co["id"]
            try:
                postings = ADAPTERS[ats](token)
                seen: set[str] = set()
                chunk: list = []
                for p in postings:
                    if p.external_id:
                        seen.add(p.external_id)   # close-detection sees every live posting,
                    if not p.url or not p.title:  # even ones too malformed to upsert
                        log.warning(
                            "skipping malformed posting %s for %s",
                            p.external_id, co["name"],
                        )
                        continue
                    chunk.append(p)
                    if len(chunk) >= UPSERT_CHUNK_SIZE:
                        # Flush and release this chunk so a large (lazily-yielded)
                        # tenant never holds more than one chunk in memory at once.
                        new_jobs += db.upsert_jobs(conn, company_id, ats, token, chunk)
                        chunk = []
                if chunk:
                    new_jobs += db.upsert_jobs(conn, company_id, ats, token, chunk)
                # `seen` now holds every truthy external_id from ALL chunks, so
                # close-detection below never misses a posting from a later chunk.
                open_ids = db.get_open_external_ids(conn, company_id)
                if not seen and len(open_ids) > 20:
                    log.error(
                        "%s returned zero postings but has %d open jobs; skipping close-detection",
                        co["name"], len(open_ids),
                    )
                else:
                    closed_jobs += db.close_jobs(
                        conn, company_id, db.compute_newly_closed(open_ids, seen)
                    )
                if ats == "greenhouse":
                    backfill_greenhouse_questions(conn, company_id, token)
                # Healthy poll: clear any accrued failure streak in the same tx.
                db.record_poll_result(conn, company_id, ok=True)
                conn.commit()
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
                        conn = db.connect(dsn)
                    except Exception:
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

        db.finish_run(
            conn, run_id,
            companies_ok=ok, companies_failed=failed,
            new_jobs=new_jobs, closed_jobs=closed_jobs,
            notes="; ".join(failures) or None,
        )
        conn.commit()
        log.info("run complete: ok=%s failed=%s new=%s closed=%s",
                 ok, failed, new_jobs, closed_jobs)

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
