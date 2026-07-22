import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass, field

from observability import tracing
from reviewer import config, db, entitlements, floors, scoring
from reviewer.llm import (
    OutOfCreditsError, ReviewClient, _is_out_of_credits, build_company_about,
    build_company_context, build_profile_block,
)

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
            jd=jd, company_context=build_company_context(candidate),
            company_about=build_company_about(candidate),
        )
        res.model_stage2 = client.model_stage2
        res.verdict = s2.verdict
        res.experience_match = s2.experience_match
        res.industry = s2.industry
        res.industry_subcategory = s2.industry_subcategory
        res.confidence = s2.confidence
        res.reasoning = s2.reasoning
        res.role_category = s2.role_category
        # Deterministic write-time floors (plan J1/J2): recover work_arrangement /
        # seniority when the model abstained ("unknown") but the answer is recoverable
        # from the ATS remote flag or a single title ladder word. Applied HERE, not in
        # the schema, so the LangFuse generation output keeps the raw model answer.
        res.seniority = floors.floor_seniority(s2.seniority, candidate.get("title"))
        res.work_arrangement = floors.floor_work_arrangement(
            s2.work_arrangement, candidate.get("remote"))
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
                       run_id=None,
                       deleted_check: Callable[[], bool] | None = None,
                       on_results: Callable[[list[ReviewResult]], None] | None = None,
                       ) -> tuple[list[ReviewResult], bool]:
    """Gate candidates through batched stage-1 calls, streaming each chunk's results.

    Per-chunk pipeline: each STAGE1_BATCH_SIZE-sized chunk is stage-1 screened, then its
    own passers run stage 2, then the chunk's terminal results are emitted — BEFORE the
    next chunk's stage-1 runs. This lets the caller persist/surface a chunk's results as
    soon as they exist, instead of waiting for the whole run. STAGE1_BATCH_SIZE is read
    at call time (tests monkeypatch it). Chunks serialize (chunk k's stage-2 completes
    before chunk k+1's stage-1) but peak LLM concurrency is unchanged: ONE semaphore is
    created before the loop and shared by every chunk.

    Returns (results, halted). Never-attempted jobs stay retryable: a 402 halt skips
    them entirely (no row), a whole-batch stage-1 failure and a per-id missing decision
    each yield a retryable error row, and a stage-1 pass whose stage 2 never ran (halt,
    or a deferred JD-less job) also stays retryable (no row). halted=True means a 402 was
    encountered (in any chunk's stage 1 or stage 2) or the user was deleted mid-run, and
    the remaining candidates were skipped.

    on_results, when supplied, is a plain SYNCHRONOUS callable (list[ReviewResult]) ->
    None, invoked from inside the async pipeline once per chunk with that chunk's terminal
    results — but only when the chunk produced at least one result. The concatenation of
    all emitted chunks equals the returned `results` (same objects, same order). Any
    exception it raises propagates out of review_batch; the caller owns its failure
    envelope. It does NOT change the (results, halted) contract for no-callback callers.

    Halt semantics: a 402 in chunk k breaks the loop — chunks 0..k-1 are fully emitted,
    chunk k emits only its terminal results (completed stage-2 + rejects + errors), and
    chunks k+1.. are never stage-1'd (no rows, retryable).

    deleted_check, when supplied, is a cheap predicate polled ONCE per stage-1 chunk (and
    once before each chunk's stage-2 fan-out) — not once per row. If it returns True the
    user was deleted mid-run, so the batch halts early: no further LLM calls are issued
    and remaining jobs stay retryable (no rows). The caller re-checks the tombstone at its
    write boundary and skips all writes.
    """
    halt = asyncio.Event()
    results: list[ReviewResult] = []
    # ONE semaphore per run, shared across chunks: chunks serialize, but peak in-flight
    # stage-2 LLM calls stay bounded by `concurrency` exactly as the non-streamed shape.
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

    def _emit(chunk_results: list[ReviewResult]) -> None:
        # Accumulate then hand THIS chunk's terminal results to the caller. The extend
        # keeps `results` == concat(emitted chunks); the callback fires only for a
        # non-empty chunk so an all-deferred/halted chunk emits nothing.
        results.extend(chunk_results)
        if on_results is not None and chunk_results:
            on_results(chunk_results)

    for start in range(0, len(candidates), config.STAGE1_BATCH_SIZE):
        if halt.is_set():
            break
        if deleted_check is not None and deleted_check():
            log.info("user deleted mid-run; aborting stage-1 gate before further LLM calls")
            halt.set()
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
            # Whole-batch failure: every job stays retryable via its error row. These
            # rows ARE this chunk's emission; then continue to the next chunk (not halt).
            log.warning("stage1_batch failed for %s job(s): %s", len(batch), exc)
            _emit([ReviewResult(
                job_id=c["id"], model_stage1=client.model_stage1,
                error=f"stage1_batch {type(exc).__name__}: {exc}") for c in batch])
            continue

        by_decision = {d.job_id: d for d in decisions}
        chunk_results: list[ReviewResult] = []
        passed: list[tuple[dict, ReviewResult]] = []
        for c in batch:
            d = by_decision.get(c["id"])
            if d is None:  # missing per-id decision → retryable error (spec B6/B1)
                chunk_results.append(ReviewResult(
                    job_id=c["id"], model_stage1=client.model_stage1,
                    error="stage1_batch returned no decision"))
                continue
            res = ReviewResult(
                job_id=c["id"], model_stage1=client.model_stage1,
                stage1_decision=d.decision, stage1_reason=d.reason)
            if d.decision == "reject":
                chunk_results.append(res)
            else:
                passed.append((c, res))

        # One more check before THIS chunk's (expensive) stage-2 fan-out: if the user was
        # deleted while stage 1 ran, skip stage 2 rather than issue its LLM calls.
        if deleted_check is not None and not halt.is_set() and deleted_check():
            log.info("user deleted mid-run; skipping stage-2 for %s passed job(s)", len(passed))
            halt.set()

        if not halt.is_set() and passed:
            stage2 = await asyncio.gather(*[_run_stage2(c, r) for c, r in passed])
            # Drop the Nones: passers whose stage 2 never ran (halt) stay retryable —
            # no row — exactly the non-streamed per-item semantics.
            chunk_results.extend(r for r in stage2 if r is not None)

        _emit(chunk_results)

    return results, halt.is_set()


def _review_user(conn, profile: dict, ent: dict | None = None,
                 comp_plan: str = entitlements.DEFAULT_INVITE_COMP_PLAN) -> None:
    # `ent` is the DB-overlaid entitlements map (T1). review_all loads it once per run;
    # the on-demand worker passes None so it is loaded per request. None → compiled
    # defaults inside the entitlement helpers. `comp_plan` is the DB-configured invite
    # comp plan (db.load_invite_comp_plan), likewise read once per run and threaded into
    # resolve_plan; the default keeps standalone callers on the compiled default.
    user_id = str(profile["user_id"])
    pv = profile["profile_version"]
    run_id = db.start_review_run(conn, user_id)
    conn.commit()

    counts = {"reviewed": 0, "gate_rejected": 0, "approved": 0, "denied": 0, "errors": 0}
    notes = None
    locked = False
    try:
        # M-TOCTOU: serialize per-user review spend across the cron reviewer (review_all)
        # and the on-demand worker. Without this, both can read spend=0, each select up
        # to the cap, and each spend up to the cap → up to 2x the per-user daily budget on
        # the operator's LLM balance. A non-blocking per-user advisory lock lets only one
        # run review a user at a time; a concurrent run skips (the holder covers its
        # budget) rather than blocking the whole cron loop behind a slow LLM batch. The
        # lock is released in the finally, AFTER the spend/finish commit, so the next run
        # reads the committed spend. Covers BOTH entry points since both funnel here.
        locked = db.try_lock_user_review(conn, user_id)
        if not locked:
            notes = "review already in progress; skipped"
            log.info("review already in progress for %s; skipping", user_id)
            return

        # Tier gate (spec subsystem C/D). Resolve the user's plan from their
        # subscription mirror + invite proof + operator pin (all loaded by
        # db.load_profiles). No plan → skip entirely: zero candidate selection,
        # zero LLM calls.
        sub = {
            "plan": profile.get("sub_plan"),
            "status": profile.get("sub_status"),
            "current_period_end": profile.get("sub_current_period_end"),
        }
        override = None
        if profile.get("ov_plan"):
            override = {"plan": profile.get("ov_plan"), "expires_at": profile.get("ov_expires_at")}
        plan = entitlements.resolve_plan(
            sub, bool(profile.get("invited")), comp_plan=comp_plan, override=override
        )
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
        # (premium only if the plan grants it, else cheap). When the user hasn't picked a
        # stage-2 model, fall back to their TIER'S default (config.default_stage2_model —
        # Pro defaults to a stronger model than Standard) before gating, so an unset
        # selection is resolved exactly like an explicit one.
        requested_stage2 = profile.get("model_stage2") or config.default_stage2_model(plan)
        resolved_stage2 = entitlements.resolve_stage2_model(plan, requested_stage2, ent)

        # Per-user rolling daily budget: the per-model cap minus what's already been
        # spent today (UTC). The tier's per-model cap is the ceiling; a per-profile
        # daily_review_cap is an operator override that may only LOWER it, never raise
        # it (cost integrity, finding B-COST — the same clamp lives in the dashboard's
        # reviewRequests.ts). daily_review_cap is operator-only at the DB layer (users
        # have no UPDATE privilege on that column), so this is defense in depth against
        # any path that could still write it. config.DAILY_REVIEW_CAP_DEFAULT is only a
        # last-resort fallback (a resolved plan always yields a positive entitlement cap).
        tier_cap = (entitlements.daily_review_cap(plan, resolved_stage2, ent)
                    or config.DAILY_REVIEW_CAP_DEFAULT)
        override = profile.get("daily_review_cap")
        cap = min(override, tier_cap) if override is not None else tier_cap
        remaining = max(0, cap - db.get_daily_spend(conn, user_id))
        if remaining == 0:
            # Budget exhausted — skip the user entirely: zero candidates selected,
            # zero LLM calls. The run row still closes so the skip is auditable.
            notes = "daily cap exhausted"
            log.info("daily cap %s exhausted for %s; skipping", cap, user_id)
            return

        # Deterministic company exclusion gate (pre-LLM): the user's structured
        # company_exclusions (facets) + per-user company_overrides, applied inside
        # select_candidates so facet/override-excluded companies never cost an LLM call.
        exclusions = db.parse_company_exclusions(profile.get("company_exclusions"))
        candidates, total = db.select_candidates(
            conn, user_id, pv, remaining,
            preferred_locations=profile.get("preferred_locations"),
            exclusions=exclusions,
        )
        overflow = total - len(candidates)
        if overflow > 0:
            notes = f"overflow: {overflow} job(s) deferred to next run"
            log.info("review overflow: %s job(s) over remaining budget %s, deferred",
                     overflow, remaining)

        profile_block = build_profile_block(
            profile["resume_text"], profile["instructions"],
            company_instructions=profile.get("company_instructions"),
        )
        client = ReviewClient(
            model_stage1=entitlements.CHEAP_MODEL,   # cheap gate always (see above)
            model_stage2=resolved_stage2,
        )

        def _persist_chunk(chunk: list[ReviewResult]) -> None:
            # Persist + count + charge THIS chunk the moment review_batch emits it (once
            # per non-empty chunk), so the dashboard's cursor poll sees committed rows +
            # spend as they land instead of only at end of run. Accumulates into the same
            # `counts` the finally reports; because Task 4 guarantees the emitted chunks
            # concatenate to `results`, the cross-chunk totals equal the old single pass.

            # M-RESURRECT-2 (now per chunk): the account can be erased mid-run (profile
            # loaded before the deletion cascade; the LLM work is slow). Re-check the
            # tombstone at this write boundary — BEFORE persisting job_reviews or charging
            # usage_counters — so a purge that landed during this run isn't undone by
            # recreated PII / spend rows. Covers BOTH the cron (review_all) and the
            # on-demand worker, since both funnel their writes through here. review_batch's
            # own deleted_check halts further LLM work at its next poll; this guard is the
            # write-boundary protection for the chunk already in hand. Cheap EXISTS.
            if db.user_deleted(conn, user_id):
                return

            rows_this_chunk = []
            for r in chunk:
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
                rows_this_chunk.append(r.as_row(user_id=user_id, profile_version=pv))
            _persist_rows(conn, rows_this_chunk, config.PERSIST_CHUNK_SIZE)

            # Charge the daily budget for jobs that actually consumed LLM budget: any
            # result carrying a stage-1 decision (gate-reject, stage-2-complete, or
            # JD-deferred). Error-only rows (stage1_batch transport failures leave
            # stage1_decision NULL) are excluded so an outage can't burn a day's budget.
            spent = sum(1 for r in chunk if r.stage1_decision is not None)
            db.add_daily_spend(conn, user_id, spent)
            # _persist_rows already committed this chunk's job_reviews (per-PERSIST_CHUNK_SIZE
            # commits + a tail commit inside it); this commit lands the spend immediately
            # after, in its own separate transaction. A crash BETWEEN the two leaves at most
            # one chunk persisted-but-uncharged — a self-limiting under-charge, never a
            # double-charge, because the persisted rows block that chunk's re-selection. This
            # commit is what makes the chunk visible to the dashboard's cursor poll (not at
            # end of run). Per-chunk commits do NOT release the session advisory lock — only
            # unlock_user_review does (M-TOCTOU).
            conn.commit()

        _, halted = asyncio.run(review_batch(
            candidates, profile_block, client, config.CONCURRENCY,
            user_id=user_id, run_id=run_id,
            # Cheap per-chunk poll so a mid-run deletion stops issuing LLM calls instead
            # of grinding all ≤cap jobs whose writes the tombstone guard then discards.
            deleted_check=lambda: db.user_deleted(conn, user_id),
            on_results=_persist_chunk,
        ))

        # M-RESURRECT-2 (final note): the account can be erased mid-run. The per-chunk
        # guard already skips writes; here we set the run note. The deletion note REPLACES
        # any overflow note and is checked BEFORE the credits-halt note so a
        # deletion-aborted run (which also sets halt) isn't mislabeled "out of credits".
        # Cheap EXISTS; the run row still closes below.
        if db.user_deleted(conn, user_id):
            notes = "account deleted mid-run; skipped writes"
            log.info("account %s deleted mid-run; skipping writes", user_id)
            return

        if halted:
            notes = (f"{notes}; " if notes else "") + "halted: out of credits"
            log.warning("review halted (no credits) for %s", user_id)
    except Exception:
        conn.rollback()
        notes = (f"{notes}; " if notes else "") + "review phase errored; see logs"
        log.exception("review failed for %s", user_id)
    finally:
        db.finish_review_run(conn, run_id, notes=notes, **counts)
        conn.commit()
        # Release AFTER the commit above so any concurrent run that now acquires the
        # lock reads this run's committed daily spend (M-TOCTOU). No-op if we never
        # acquired it (a concurrent run already held it → this call skipped).
        if locked:
            db.unlock_user_review(conn, user_id)
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
    # DB-overlaid tier config (T1), read ONCE per run and threaded into every user's
    # cap/model resolution. An operator's `UPDATE tier_settings` is honored on the next
    # run with no redeploy.
    ent = db.load_tier_settings(conn)
    comp_plan = db.load_invite_comp_plan(conn)
    try:
        for profile in profiles:
            _review_user(conn, profile, ent, comp_plan)
    finally:
        tracing.flush()
