import logging

from job_discovery import db
from job_discovery.adapters import ADAPTERS
from job_discovery.targets import load_targets

log = logging.getLogger("job_discovery")


def _run_prune(conn) -> None:
    try:
        from job_discovery.prune import prune_jobs
        prune_jobs(conn)
    except Exception:
        conn.rollback()
        log.exception("prune phase failed; poll results unaffected")


def run(dsn: str | None = None) -> None:
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
            return

        over, size_mb, ceiling_mb = db.over_size_ceiling(conn)
        if over:
            log.error(
                "DB at %.0f MB >= ceiling %.0f MB; skipping poll to stay under the "
                "disk limit (no jobs written this run)", size_mb, ceiling_mb,
            )
            # Still prune when the ceiling is breached: prune is delete/strip-only
            # and is the only automated mechanism that can shrink the DB back under
            # the ceiling.  Skipping it here would stall recovery.
            _run_prune(conn)
            return
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
                for p in postings:
                    if p.external_id:
                        seen.add(p.external_id)   # close-detection sees every live posting,
                    if not p.url or not p.title:  # even ones too malformed to upsert
                        log.warning(
                            "skipping malformed posting %s for %s",
                            p.external_id, co["name"],
                        )
                        continue
                    if db.upsert_job(conn, company_id, ats, token, p):
                        new_jobs += 1
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
                conn.commit()
                ok += 1
            except Exception as exc:  # per-company isolation (incl. dead boards)
                try:
                    conn.rollback()
                except Exception:
                    log.exception("rollback failed for %s; attempting reconnect",
                                  co["name"])
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

        db.finish_run(
            conn, run_id,
            companies_ok=ok, companies_failed=failed,
            new_jobs=new_jobs, closed_jobs=closed_jobs,
            notes="; ".join(failures) or None,
        )
        conn.commit()
        log.info("run complete: ok=%s failed=%s new=%s closed=%s",
                 ok, failed, new_jobs, closed_jobs)

        try:
            from reviewer.run import review_all
            review_all(conn)
        except Exception:
            conn.rollback()
            log.exception("review phase failed; poll results unaffected")

        _run_prune(conn)
    finally:
        conn.close()
