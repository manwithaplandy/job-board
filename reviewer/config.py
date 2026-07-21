import os

from reviewer import entitlements


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


CONCURRENCY = _int_env("REVIEW_CONCURRENCY", 5)
# Last-resort fallback for the per-user daily review cap. As of Phase 1 the cap is
# TIER-SOURCED: reviewer.entitlements.daily_review_cap(plan, model) (spec subsystem
# C/D), with an optional profiles.daily_review_cap admin override. This env default is
# only reached in the degenerate case where a resolved plan somehow yields a 0 cap; a
# user with no plan is skipped entirely, never falling back to this. 400 = Standard.
DAILY_REVIEW_CAP_DEFAULT = _int_env("REVIEW_DAILY_CAP_DEFAULT", 400)
STAGE1_BATCH_SIZE = _int_env("REVIEW_STAGE1_BATCH", 50)
PERSIST_CHUNK_SIZE = _int_env("REVIEW_PERSIST_CHUNK", 20)
# On-demand review worker (reviewer.worker): seconds to sleep when the
# review_requests queue is empty before polling again.
REVIEW_WORKER_POLL_SECONDS = _int_env("REVIEW_WORKER_POLL_SECONDS", 15)
# On-demand review worker: number of concurrent worker loops (threads) it runs. K=1
# behaves exactly like the historical single-loop worker; default 3 turns parallelism
# on without any Railway env change.
REVIEW_WORKER_PARALLELISM = _int_env("REVIEW_WORKER_PARALLELISM", 3)


def has_api_key() -> bool:
    return bool(os.environ.get("OPENROUTER_API_KEY"))


# ── Per-tier default stage-2 model ───────────────────────────────────────────────
# When a user has NOT explicitly chosen a stage-2 model (profiles.model_stage2 IS
# NULL), the reviewer falls back to their PLAN'S default model rather than a single
# global default — so Pro can default to a stronger model than Standard. Each tier's
# default is env-overridable (REVIEW_DEFAULT_MODEL_<TIER>) so an operator can retune it
# without a redeploy; the compiled fallbacks below are what ships.
#
# NOTE: the resolved default still passes through entitlements.resolve_stage2_model at
# the call site, so it is metered like any model — gemini-flash-latest is unassigned in
# entitlements.STAGE2_MODEL_TIER, so it meters at the Pro premium cap (the codebase's
# conservative default for any model not explicitly tier-1). The dashboard mirrors this
# default (dashboard/lib/reviewRequests.ts) so the displayed daily cap matches what the
# reviewer enforces. Keep the compiled Pro/Standard defaults below in sync with the
# COMPILED_DEFAULT_STAGE2_MODEL map in dashboard/lib/reviewRequests.ts.
_DEFAULT_STAGE2_MODEL_ENV = {
    "standard": "REVIEW_DEFAULT_MODEL_STANDARD",
    "pro": "REVIEW_DEFAULT_MODEL_PRO",
}

_COMPILED_DEFAULT_STAGE2_MODEL = {
    "standard": entitlements.CHEAP_MODEL,
    "pro": "gemini-flash-latest",
}


def default_stage2_model(plan: str | None) -> str:
    """The default stage-2 model for `plan` when the user hasn't picked one.

    Read at call time (an env change is picked up without reimport). An unset or blank
    env var — and any plan with no configured default — falls back to the compiled
    default, ultimately CHEAP_MODEL. The returned model is still gated by
    entitlements.resolve_stage2_model at the call site, so a mis-set default the plan
    can't run degrades safely to CHEAP_MODEL rather than granting unentitled access.
    """
    env_name = _DEFAULT_STAGE2_MODEL_ENV.get(plan or "")
    if env_name:
        raw = os.environ.get(env_name)
        if raw and raw.strip():
            return raw.strip()
    return _COMPILED_DEFAULT_STAGE2_MODEL.get(plan or "", entitlements.CHEAP_MODEL)
