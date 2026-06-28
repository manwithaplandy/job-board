import asyncio
import logging
from dataclasses import dataclass, field

from observability import tracing
from reviewer import config, db, scoring
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
    role_category: str | None = None
    seniority: str | None = None
    work_arrangement: str | None = None
    about: str | None = None
    pay_min: int | None = None
    pay_max: int | None = None
    pay_currency: str | None = None
    pay_period: str | None = None
    headcount: str | None = None
    skills_score: int | None = None
    experience_score: int | None = None
    comp_score: int | None = None
    fit_score: int | None = None
    red_flags: list = field(default_factory=list)
    skill_gaps: list = field(default_factory=list)
    benefits: list = field(default_factory=list)
    requirements: list = field(default_factory=list)

    def as_row(self, *, user_id: str, profile_version: str) -> dict:
        # user_id/profile_version come from the caller; the rest are own fields.
        row = {c: getattr(self, c, None) for c in db._REVIEW_COLUMNS}
        row["user_id"] = user_id
        row["profile_version"] = profile_version
        return row


async def _review_one_inner(candidate: dict, profile_block: str, client) -> ReviewResult:
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

        jd = candidate.get("description") or _NO_JD
        s2 = await client.stage2(
            profile_block=profile_block, title=candidate["title"],
            company=candidate["company_name"], location=candidate.get("location"),
            jd=jd,
        )
        res.model_stage2 = client.model_stage2
        res.verdict = s2.verdict
        res.experience_match = s2.experience_match
        res.industry = s2.industry
        res.industry_subcategory = s2.industry_subcategory
        res.confidence = s2.confidence
        res.reasoning = s2.reasoning
        res.role_category = s2.role_category
        res.seniority = s2.seniority
        res.work_arrangement = s2.work_arrangement
        res.about = s2.about
        res.pay_min, res.pay_max = s2.pay_min, s2.pay_max
        res.pay_currency, res.pay_period = s2.pay_currency, s2.pay_period
        res.headcount = s2.headcount
        res.skills_score = s2.skills_score
        res.experience_score = s2.experience_score
        res.comp_score = s2.comp_score
        res.red_flags = list(s2.red_flags)
        res.skill_gaps = list(s2.skill_gaps)
        res.benefits = list(s2.benefits)
        res.requirements = [r.model_dump() for r in s2.requirements]
        res.fit_score = scoring.compute_fit(
            skills_score=s2.skills_score, experience_score=s2.experience_score,
            comp_score=s2.comp_score, experience_match=s2.experience_match,
            confidence=s2.confidence, red_flags=s2.red_flags, verdict=s2.verdict,
        )
    except Exception as exc:  # per-job isolation (spec §3)
        res.error = f"{type(exc).__name__}: {exc}"
        log.warning("review failed for %s: %s", candidate["id"], res.error)
    return res


async def review_one(candidate: dict, profile_block: str, client,
                     *, user_id: str | None = None, run_id=None) -> ReviewResult:
    lf = tracing.get_langfuse()
    if lf is None:
        return await _review_one_inner(candidate, profile_block, client)
    with tracing.identity(user_id=user_id, session_id=run_id, tags=["reviewer"]):
        with lf.start_as_current_observation(
            as_type="span", name="job-review",
            input={"job_id": candidate["id"], "title": candidate.get("title")},
        ) as span:
            res = await _review_one_inner(candidate, profile_block, client)
            metadata = {
                "job_id": res.job_id, "stage1_decision": res.stage1_decision,
                "verdict": res.verdict, "fit_score": res.fit_score,
                "error": res.error,
            }
            span.update(output={"verdict": res.verdict, "fit_score": res.fit_score},
                        metadata=metadata)
            return res


async def review_batch(candidates: list[dict], profile_block: str, client,
                       concurrency: int, *, user_id: str | None = None,
                       run_id=None) -> list[ReviewResult]:
    sem = asyncio.Semaphore(concurrency)

    async def _guarded(c: dict) -> ReviewResult:
        async with sem:
            return await review_one(c, profile_block, client,
                                    user_id=user_id, run_id=run_id)

    return await asyncio.gather(*[_guarded(c) for c in candidates])


def _review_user(conn, profile: dict) -> None:
    user_id = str(profile["user_id"])
    pv = profile["profile_version"]
    run_id = db.start_review_run(conn)
    conn.commit()

    counts = {"reviewed": 0, "gate_rejected": 0, "approved": 0, "denied": 0, "errors": 0}
    notes = None
    try:
        candidates = db.select_candidates(
            conn, user_id, pv, config.MAX_JOBS_PER_RUN,
            preferred_locations=profile.get("preferred_locations"),
        )
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
        results = asyncio.run(review_batch(
            candidates, profile_block, client, config.CONCURRENCY,
            user_id=user_id, run_id=run_id,
        ))

        for r in results:
            db.upsert_review(conn, r.as_row(user_id=user_id, profile_version=pv))
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
    if tracing.tracing_enabled():
        log.info("langfuse tracing on; sample_rate=%s", tracing.sample_rate())
    try:
        for profile in profiles:
            _review_user(conn, profile)
    finally:
        tracing.flush()
