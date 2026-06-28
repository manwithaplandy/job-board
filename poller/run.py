import logging

from poller import db
from poller.adapters import ADAPTERS
from poller.targets import load_targets

log = logging.getLogger("poller")


def run(dsn: str | None = None) -> None:
    targets = load_targets()
    conn = db.connect(dsn)
    try:
        over, size_mb, ceiling_mb = db.over_size_ceiling(conn)
        if over:
            log.error(
                "DB at %.0f MB >= ceiling %.0f MB; skipping poll to stay under the "
                "disk limit (no jobs written this run)", size_mb, ceiling_mb,
            )
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
                    if not p.url or not p.title:
                        log.warning(
                            "skipping malformed posting (missing url/title) for %s: %r",
                            co["name"], p.external_id,
                        )
                        continue
                    if db.upsert_job(conn, company_id, ats, token, p):
                        new_jobs += 1
                    seen.add(p.external_id)
                open_ids = db.get_open_external_ids(conn, company_id)
                closed_jobs += db.close_jobs(
                    conn, company_id, db.compute_newly_closed(open_ids, seen)
                )
                conn.commit()
                ok += 1
            except Exception as exc:  # per-company isolation (incl. dead boards)
                conn.rollback()
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
            log.exception("review phase failed; poll results unaffected")
    finally:
        conn.close()
