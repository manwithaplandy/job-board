# discovery/run.py
import asyncio
import logging

from discovery import config, dataset, db
from discovery.llm import CompanyReviewClient, OutOfCreditsError, build_company_block
from discovery.profile import compute_company_profile_version

log = logging.getLogger("discovery")

# AI verdict string -> discovery_runs counts column.
_VERDICT_COUNT_KEY = {"include": "included", "exclude": "excluded", "unknown": "unknown"}


async def review_batch(candidates: list[dict], company_block: str, client,
                       concurrency: int):
    sem = asyncio.Semaphore(concurrency)
    halt = asyncio.Event()

    async def _guarded(c: dict):
        if halt.is_set():
            return None
        async with sem:
            if halt.is_set():
                return None
            try:
                res = await client.review(
                    company_block=company_block, name=c["name"],
                    ats=c["ats"], token=c["token"],
                )
                return (c["id"], res, None)
            except OutOfCreditsError:
                halt.set()  # stop launching new work; in-flight calls finish
                return None
            except Exception as exc:  # per-company isolation
                return (c["id"], None, f"{type(exc).__name__}: {exc}")

    out = await asyncio.gather(*[_guarded(c) for c in candidates])
    return [r for r in out if r is not None], halt.is_set()


def _review_user(conn, profile: dict) -> None:
    user_id = str(profile["user_id"])
    pv = profile.get("company_profile_version") \
        or compute_company_profile_version(profile.get("company_instructions"))
    run_id = db.start_discovery_run(conn)
    conn.commit()

    counts = {"reviewed": 0, "included": 0, "excluded": 0, "unknown": 0, "errors": 0}
    status, notes = "completed", None
    backlog = 0
    try:
        candidates = db.select_for_review(conn, user_id, pv, config.BATCH_CAP)
        company_block = build_company_block(profile.get("company_instructions"))
        client = CompanyReviewClient(model=profile.get("model_company"))
        results, halted = asyncio.run(
            review_batch(candidates, company_block, client, config.CONCURRENCY))

        for cid, res, err in results:
            row = {
                "user_id": user_id, "company_id": cid, "company_profile_version": pv,
                "model": client.model, "error": err,
            }
            if res is not None:
                row.update(
                    verdict=res.verdict, confidence=res.confidence, reasoning=res.reasoning,
                    industry=res.industry, industry_subcategory=res.industry_subcategory,
                    tech_tags=list(res.tech_tags), red_flags=list(res.red_flags),
                )
                counts["reviewed"] += 1
                counts[_VERDICT_COUNT_KEY[res.verdict]] += 1
            else:
                counts["errors"] += 1
            db.upsert_company_review(conn, row)

        db.reconcile_active(conn, user_id)
        backlog = db.count_backlog(conn, user_id, pv)
        if halted:
            status = "halted_no_credits"
            notes = f"out of credits; {backlog} pending"
            log.warning("discovery halted (no credits) for %s; backlog=%s", user_id, backlog)
        db.set_halted(conn, halted)
        conn.commit()
    except Exception:
        conn.rollback()
        status, notes = "error", "discovery errored; see logs"
        backlog = 0
        log.exception("discovery failed for %s", user_id)
    finally:
        db.finish_discovery_run(conn, run_id, status=status, ingested=0, backlog=backlog,
                                notes=notes, **counts)
        conn.commit()
    log.info("discovery finished for %s: %s status=%s", user_id, counts, status)


def run(conn=None) -> None:
    from poller import db as poller_db  # reuse the shared connection factory
    own = conn is None
    conn = conn or poller_db.connect()
    try:
        if not config.has_api_key():
            log.info("OPENROUTER_API_KEY not set; skipping discovery")
            return
        over, size_mb, ceiling_mb = poller_db.over_size_ceiling(conn)
        if over:
            log.error(
                "DB at %.0f MB >= ceiling %.0f MB; skipping discovery so it does not "
                "activate more companies near the disk limit", size_mb, ceiling_mb,
            )
            return
        ingested = db.upsert_candidates(conn, dataset.load_candidates(config.dataset_dir()))
        conn.commit()
        log.info("ingested %s new candidate companies", ingested)
        profiles = db.load_company_profiles(conn)
        if not profiles:
            log.info("no profiles with company_instructions; skipping review")
            return
        for profile in profiles:
            _review_user(conn, profile)
    finally:
        if own:
            conn.close()
