import os


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


CONCURRENCY = _int_env("REVIEW_CONCURRENCY", 5)
# Per-user, per-day ceiling on jobs entering review — a hard cost cap regardless of
# pool size, edit frequency, or run cadence (spec subsystem D). 400 = the spec's
# Standard-tier figure; per-tier entitlements land in Phase 1. A profile's
# daily_review_cap column overrides this per-user (NULL = use this default).
DAILY_REVIEW_CAP_DEFAULT = _int_env("REVIEW_DAILY_CAP_DEFAULT", 400)
STAGE1_BATCH_SIZE = _int_env("REVIEW_STAGE1_BATCH", 50)
PERSIST_CHUNK_SIZE = _int_env("REVIEW_PERSIST_CHUNK", 20)


def has_api_key() -> bool:
    return bool(os.environ.get("OPENROUTER_API_KEY"))
