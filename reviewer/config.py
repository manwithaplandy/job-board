import os


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


CONCURRENCY = _int_env("REVIEW_CONCURRENCY", 5)
MAX_JOBS_PER_RUN = _int_env("REVIEW_MAX_JOBS_PER_RUN", 200)
STAGE1_BATCH_SIZE = _int_env("REVIEW_STAGE1_BATCH", 50)
PERSIST_CHUNK_SIZE = _int_env("REVIEW_PERSIST_CHUNK", 20)


def has_api_key() -> bool:
    return bool(os.environ.get("OPENROUTER_API_KEY"))
