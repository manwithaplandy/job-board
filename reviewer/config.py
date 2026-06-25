import os


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


CONCURRENCY = _int_env("REVIEW_CONCURRENCY", 5)
MAX_JOBS_PER_RUN = _int_env("REVIEW_MAX_JOBS_PER_RUN", 200)


def has_api_key() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))
