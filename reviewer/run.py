import asyncio
import logging
from dataclasses import dataclass

from reviewer import config, db
from reviewer.jd import extract_description
from reviewer.llm import ReviewClient, build_profile_block

log = logging.getLogger("reviewer")

_NO_JD = "(no description available)"


@dataclass
class ReviewResult:
    job_id: str
    stage1_decision: str | None = None
    stage1_reason: str | None = None
    verdict: str | None = None
    experience_match: str | None = None
    industry: str | None = None
    industry_subcategory: str | None = None
    confidence: str | None = None
    reasoning: str | None = None
    model_stage1: str | None = None
    model_stage2: str | None = None
    error: str | None = None
    description: str | None = None  # written to jobs.description (not job_reviews)

    def as_row(self, *, user_id: str, profile_version: str) -> dict:
        # user_id/profile_version come from the caller; the rest are own fields.
        row = {c: getattr(self, c, None) for c in db._REVIEW_COLUMNS}
        row["user_id"] = user_id
        row["profile_version"] = profile_version
        return row


async def review_one(candidate: dict, profile_block: str, client) -> ReviewResult:
    res = ReviewResult(job_id=candidate["id"])
    try:
        s1 = await client.stage1(
            profile_block=profile_block, title=candidate["title"],
            company=candidate["company_name"], location=candidate.get("location"),
        )
        res.model_stage1 = client.model_stage1
        res.stage1_decision = s1.decision
        res.stage1_reason = s1.reason
        if s1.decision == "reject":
            return res

        jd = extract_description(candidate["ats"], candidate.get("raw") or {})
        res.description = jd
        s2 = await client.stage2(
            profile_block=profile_block, title=candidate["title"],
            company=candidate["company_name"], location=candidate.get("location"),
            jd=jd or _NO_JD,
        )
        res.model_stage2 = client.model_stage2
        res.verdict = s2.verdict
        res.experience_match = s2.experience_match
        res.industry = s2.industry
        res.industry_subcategory = s2.industry_subcategory
        res.confidence = s2.confidence
        res.reasoning = s2.reasoning
    except Exception as exc:  # per-job isolation (spec §3)
        res.error = f"{type(exc).__name__}: {exc}"
        log.warning("review failed for %s: %s", candidate["id"], res.error)
    return res


async def review_batch(candidates: list[dict], profile_block: str, client,
                       concurrency: int) -> list[ReviewResult]:
    sem = asyncio.Semaphore(concurrency)

    async def _guarded(c: dict) -> ReviewResult:
        async with sem:
            return await review_one(c, profile_block, client)

    return await asyncio.gather(*[_guarded(c) for c in candidates])


def _review_user(conn, profile: dict) -> None:
    user_id = str(profile["user_id"])
    pv = profile["profile_version"]
    run_id = db.start_review_run(conn)
    conn.commit()

    counts = {"reviewed": 0, "gate_rejected": 0, "approved": 0, "denied": 0, "errors": 0}
    notes = None
    try:
        candidates = db.select_candidates(conn, user_id, pv, config.MAX_JOBS_PER_RUN)
        total = candidates[0]["total_stale"] if candidates else 0
        overflow = total - len(candidates)
        if overflow > 0:
            notes = f"overflow: {overflow} job(s) deferred to next run"
            log.info("review overflow: %s job(s) over cap %s, deferred",
                     overflow, config.MAX_JOBS_PER_RUN)

        profile_block = build_profile_block(profile["resume_text"], profile["instructions"])
        client = ReviewClient(
            model_stage1=profile.get("model_stage1"),
            model_stage2=profile.get("model_stage2"),
        )
        results = asyncio.run(review_batch(candidates, profile_block, client, config.CONCURRENCY))

        for r in results:
            db.upsert_review(conn, r.as_row(user_id=user_id, profile_version=pv))
            if r.description:
                db.set_job_description(conn, r.job_id, r.description)
            if r.error:
                counts["errors"] += 1
                continue
            if r.stage1_decision is not None:
                counts["reviewed"] += 1
            if r.stage1_decision == "reject":
                counts["gate_rejected"] += 1
            if r.verdict == "approve":
                counts["approved"] += 1
            elif r.verdict == "deny":
                counts["denied"] += 1
        conn.commit()
    except Exception:
        conn.rollback()
        notes = (f"{notes}; " if notes else "") + "review phase errored; see logs"
        log.exception("review failed for %s", user_id)
    finally:
        db.finish_review_run(conn, run_id, notes=notes, **counts)
        conn.commit()
    log.info("review complete for %s: %s", user_id, counts)


def review_all(conn) -> None:
    if not config.has_api_key():
        log.info("OPENROUTER_API_KEY not set; skipping review phase")
        return
    profiles = db.load_profiles(conn)
    if not profiles:
        log.info("no profiles; skipping review phase")
        return
    for profile in profiles:
        _review_user(conn, profile)
