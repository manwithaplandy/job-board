import asyncio
import logging
from dataclasses import dataclass, field

from observability import tracing
from reviewer import config, db, entitlements, scoring
from reviewer.llm import OutOfCreditsError, ReviewClient, _is_out_of_credits, build_profile_block

log = logging.getLogger("reviewer")

_NO_JD = "(no description available)"


def _persist_rows(conn, rows: list[dict], chunk_size: int = 20) -> None:
    """Persist review rows with per-chunk commits.

    Commits every chunk_size rows so a partial batch is durable on partial
    failure. An exception on a single row is logged and skipped; the chunk
    committed so far is kept and iteration continues from the next row.
    """
    for i, row in enumerate(rows):
        try:
            db.upsert_review(conn, row)
        except Exception as exc:
            log.warning("persist failed for row %s: %s", row.get("job_id"), exc)
            try:
                conn.rollback()
            except Exception:
                pass
            continue
        if (i + 1) % chunk_size == 0:
            conn.commit()
    conn.commit()  # final commit for the tail


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


async def _stage2_inner(candidate: dict, profile_block: str, client,
                        res: ReviewResult) -> ReviewResult:
    """Run stage 2 for a candidate that already passed stage 1; mutate and return res.

    A missing JD defers stage 2 (verdict/error stay None) so the job is re-selected
    once its description is refilled. Per-job errors are isolated onto res.error; a
    402 propagates as OutOfCreditsError so the batch can halt.
    """
    try:
        jd = candidate.get("description")
        if not jd:
            log.info("no JD for %s; deferring stage-2", candidate["id"])
            return res  # verdict/error None → the persist filter drops this row

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
        if None not in (s2.skills_score, s2.experience_score, s2.comp_score):
            res.fit_score = scoring.compute_fit(
                skills_score=s2.skills_score, experience_score=s2.experience_score,
                comp_score=s2.comp_score, experience_match=s2.experience_match,
                confidence=s2.confidence, red_flags=s2.red_flags, verdict=s2.verdict,
            )
        # else: fit_score stays None; the fit_score IS NULL AND verdict IS NOT NULL clause
        # in select_candidates will re-select this row for re-review on the next run.
    except OutOfCreditsError:
        raise  # let review_batch's halt logic handle it; do not write an error row
    except Exception as exc:  # per-job isolation (spec §3)
        if _is_out_of_credits(exc):
            raise OutOfCreditsError(str(exc)) from exc
        res.error = f"{type(exc).__name__}: {exc}"
        log.warning("review failed for %s: %s", candidate["id"], res.error)
    return res


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
    except OutOfCreditsError:
        raise
    except Exception as exc:  # per-job isolation (spec §3)
        if _is_out_of_credits(exc):
            raise OutOfCreditsError(str(exc)) from exc
        res.error = f"{type(exc).__name__}: {exc}"
        log.warning("review failed for %s: %s", candidate["id"], res.error)
        return res
    if s1.decision == "reject":
        return res
    return await _stage2_inner(candidate, profile_block, client, res)


async def _traced_review(candidate: dict, inner, *, user_id: str | None = None,
                         run_id=None) -> ReviewResult:
    """Wrap an async ReviewResult producer in a per-job 'job-review' span."""
    lf = tracing.get_langfuse()
    if lf is None:
        return await inner()
    with tracing.identity(user_id=user_id, session_id=run_id, tags=["reviewer"]):
        with lf.start_as_current_observation(
            as_type="span", name="job-review",
            input={"job_id": candidate["id"], "title": candidate.get("title")},
        ) as span:
            res = await inner()
            span.update(
                output={"verdict": res.verdict, "fit_score": res.fit_score},
                metadata={
                    "job_id": res.job_id, "stage1_decision": res.stage1_decision,
                    "verdict": res.verdict, "fit_score": res.fit_score,
                    "error": res.error,
                },
            )
            return res


async def review_one(candidate: dict, profile_block: str, client,
                     *, user_id: str | None = None, run_id=None) -> ReviewResult:
    return await _traced_review(
        candidate,
        lambda: _review_one_inner(candidate, profile_block, client),
        user_id=user_id, run_id=run_id,
    )


async def review_batch(candidates: list[dict], profile_block: str, client,
                       concurrency: int, *, user_id: str | None = None,
                       run_id=None) -> tuple[list[ReviewResult], bool]:
    """Gate candidates through a batched stage-1 call, then run stage 2 for passes.

    Returns (results, halted). Never-attempted jobs stay retryable: a 402 halt
    skips them entirely (no row), a whole-batch stage-1 failure and a per-id
    missing decision each yield a retryable error row. halted=True means a 402 was
    encountered and remaining candidates were skipped.
    """
    halt = asyncio.Event()
    results: list[ReviewResult] = []
    passed: list[tuple[dict, ReviewResult]] = []

    for start in range(0, len(candidates), config.STAGE1_BATCH_SIZE):
        if halt.is_set():
            break
        batch = candidates[start:start + config.STAGE1_BATCH_SIZE]
        try:
            decisions = await client.stage1_batch(profile_block=profile_block, jobs=batch)
        except OutOfCreditsError:
            halt.set()
            break
        except Exception as exc:
            if _is_out_of_credits(exc):
                halt.set()
                break
            # Whole-batch failure: every job stays retryable via its error row.
            log.warning("stage1_batch failed for %s job(s): %s", len(batch), exc)
            for c in batch:
                results.append(ReviewResult(
                    job_id=c["id"], model_stage1=client.model_stage1,
                    error=f"stage1_batch {type(exc).__name__}: {exc}"))
            continue
        by_decision = {d.job_id: d for d in decisions}
        for c in batch:
            d = by_decision.get(c["id"])
            if d is None:  # missing per-id decision → retryable error (spec B6/B1)
                results.append(ReviewResult(
                    job_id=c["id"], model_stage1=client.model_stage1,
                    error="stage1_batch returned no decision"))
                continue
            res = ReviewResult(
                job_id=c["id"], model_stage1=client.model_stage1,
                stage1_decision=d.decision, stage1_reason=d.reason)
            if d.decision == "reject":
                results.append(res)
            else:
                passed.append((c, res))

    sem = asyncio.Semaphore(concurrency)

    async def _run_stage2(candidate: dict, res: ReviewResult) -> ReviewResult | None:
        if halt.is_set():
            return None  # skipped: stay retryable (no row written)
        async with sem:
            if halt.is_set():
                return None
            try:
                return await _traced_review(
                    candidate,
                    lambda: _stage2_inner(candidate, profile_block, client, res),
                    user_id=user_id, run_id=run_id,
                )
            except OutOfCreditsError:
                halt.set()
                return None

    stage2 = await asyncio.gather(*[_run_stage2(c, r) for c, r in passed])
    results.extend(r for r in stage2 if r is not None)
    return results, halt.is_set()


def _review_user(conn, profile: dict) -> None:
    user_id = str(profile["user_id"])
    pv = profile["profile_version"]
    run_id = db.start_review_run(conn, user_id)
    conn.commit()

    counts = {"reviewed": 0, "gate_rejected": 0, "approved": 0, "denied": 0, "errors": 0}
    notes = None
    try:
        # Tier gate (spec subsystem C/D). Resolve the user's plan from their
        # subscription mirror + invite proof (loaded by db.load_profiles). No plan →
        # skip entirely: zero candidate selection, zero LLM calls.
        sub = {
            "plan": profile.get("sub_plan"),
            "status": profile.get("sub_status"),
            "current_period_end": profile.get("sub_current_period_end"),
        }
        plan = entitlements.resolve_plan(sub, bool(profile.get("invited")))
        if plan is None:
            notes = "no active subscription"
            log.info("no active subscription for %s; skipping", user_id)
            return

        # Mandatory location filter (spec's #1 cost lever). Phase-0 onboarding already
        # requires it, but this closes the pre-Phase-0 / direct-write hole: an empty or
        # NULL preferred_locations means an unbounded pool, so skip with zero LLM calls.
        if not (profile.get("preferred_locations") or []):
            notes = "location filter required"
            log.info("no location filter for %s; skipping", user_id)
            return

        # Cheap gate ALWAYS (spec model-policy decision): stage 1 is forced to the cheap
        # model regardless of profiles.model_stage1. Stage 2 is the tier-entitled model
        # (premium only if the plan grants it, else cheap).
        resolved_stage2 = entitlements.resolve_stage2_model(plan, profile.get("model_stage2"))

        # Per-user rolling daily budget: the per-model cap minus what's already been
        # spent today (UTC). A per-profile daily_review_cap is an admin override; else
        # the tier's per-model cap. config.DAILY_REVIEW_CAP_DEFAULT is only a last-resort
        # fallback (a resolved plan always yields a positive entitlement cap).
        cap = (profile.get("daily_review_cap")
               or entitlements.daily_review_cap(plan, resolved_stage2)
               or config.DAILY_REVIEW_CAP_DEFAULT)
        remaining = max(0, cap - db.get_daily_spend(conn, user_id))
        if remaining == 0:
            # Budget exhausted — skip the user entirely: zero candidates selected,
            # zero LLM calls. The run row still closes so the skip is auditable.
            notes = "daily cap exhausted"
            log.info("daily cap %s exhausted for %s; skipping", cap, user_id)
            return

        candidates, total = db.select_candidates(
            conn, user_id, pv, remaining,
            preferred_locations=profile.get("preferred_locations"),
        )
        overflow = total - len(candidates)
        if overflow > 0:
            notes = f"overflow: {overflow} job(s) deferred to next run"
            log.info("review overflow: %s job(s) over remaining budget %s, deferred",
                     overflow, remaining)

        profile_block = build_profile_block(profile["resume_text"], profile["instructions"])
        client = ReviewClient(
            model_stage1=entitlements.CHEAP_MODEL,   # cheap gate always (see above)
            model_stage2=resolved_stage2,
        )
        results, halted = asyncio.run(review_batch(
            candidates, profile_block, client, config.CONCURRENCY,
            user_id=user_id, run_id=run_id,
        ))
        if halted:
            notes = (f"{notes}; " if notes else "") + "halted: out of credits"
            log.warning("review halted (no credits) for %s", user_id)

        rows_to_persist = []
        for r in results:
            if r.error:
                counts["errors"] += 1
            elif r.stage1_decision == "reject":
                counts["reviewed"] += 1
                counts["gate_rejected"] += 1
            elif r.verdict is not None:
                counts["reviewed"] += 1
                if r.verdict == "approve":
                    counts["approved"] += 1
                elif r.verdict == "deny":
                    counts["denied"] += 1
            else:
                # Stage-1 passed but stage 2 was deferred (no JD yet): no terminal
                # outcome. A verdict=NULL/error=NULL row is unreachable by every
                # re-selection predicate at this profile_version and would stick the
                # job forever, so skip persisting it — the absent row keeps the job
                # re-selectable once a JD is refilled.
                continue
            rows_to_persist.append(r.as_row(user_id=user_id, profile_version=pv))
        _persist_rows(conn, rows_to_persist, config.PERSIST_CHUNK_SIZE)

        # Charge the daily budget for jobs that actually consumed LLM budget: any
        # result carrying a stage-1 decision (gate-reject, stage-2-complete, or
        # JD-deferred). Error-only rows (stage1_batch transport failures leave
        # stage1_decision NULL) are excluded so an outage can't burn a day's budget.
        # Committed together with finish_review_run in the finally's single commit.
        spent = sum(1 for r in results if r.stage1_decision is not None)
        db.add_daily_spend(conn, user_id, spent)
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
