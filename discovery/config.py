import os
from pathlib import Path

_DEFAULT_DATASET_DIR = Path(__file__).resolve().parent / "data"


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        # A malformed override (e.g. DISCOVERY_BATCH_CAP=abc) falls back to the
        # default rather than crashing discovery at import time.
        return default


CONCURRENCY = _int_env("DISCOVERY_CONCURRENCY", 5)
BATCH_CAP = _int_env("DISCOVERY_BATCH_CAP", 500)


def dataset_dir() -> Path:
    override = os.environ.get("DISCOVERY_DATASET_DIR")
    return Path(override) if override else _DEFAULT_DATASET_DIR


def has_api_key() -> bool:
    return bool(os.environ.get("OPENROUTER_API_KEY"))
