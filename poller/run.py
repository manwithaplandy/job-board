import logging

from poller import db
from poller.adapters import ADAPTERS
from poller.targets import load_targets

log = logging.getLogger("poller")


def run(dsn: str | None = None) -> None:
    targets = load_targets()
    conn = db.connect(dsn)
    try:
        run_id = db.start_run(conn)
        company_ids = db.sync_companies(conn, targets)
        conn.commit()

        ok = failed = new_jobs = closed_jobs = 0
        failures: list[str] = []

        for t in targets:
            ats, token = t["ats"], t["token"]
            company_id = company_ids[(ats, token)]
            try:
                postings = ADAPTERS[ats](token)
            except Exception as exc:  # per-company isolation (FR-4)
                failed += 1
                failures.append(f"{t['name']}: {type(exc).__name__}: {exc}")
                log.exception("fetch failed for %s (%s:%s)", t["name"], ats, token)
                continue

            seen: set[str] = set()
            for p in postings:
                if db.upsert_job(conn, company_id, ats, token, p):
                    new_jobs += 1
                seen.add(p.external_id)

            open_ids = db.get_open_external_ids(conn, company_id)
            closed_jobs += db.close_jobs(
                conn, company_id, db.compute_newly_closed(open_ids, seen)
            )
            ok += 1
            conn.commit()

        db.finish_run(
            conn, run_id,
            companies_ok=ok, companies_failed=failed,
            new_jobs=new_jobs, closed_jobs=closed_jobs,
            notes="; ".join(failures) or None,
        )
        conn.commit()
        log.info(
            "run complete: ok=%s failed=%s new=%s closed=%s",
            ok, failed, new_jobs, closed_jobs,
        )
    finally:
        conn.close()  # FR-6: release all DB connections before exit
