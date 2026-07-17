import os


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
