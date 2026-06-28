import os
from contextlib import nullcontext

_CLIENT = None
_INITIALIZED = False


def tracing_enabled() -> bool:
    return bool(os.environ.get("LANGFUSE_PUBLIC_KEY")) and bool(
        os.environ.get("LANGFUSE_SECRET_KEY")
    )


def get_langfuse():
    """Cached Langfuse client, or None when tracing is disabled."""
    global _CLIENT, _INITIALIZED
    if not tracing_enabled():
        return None
    if not _INITIALIZED:
        from langfuse import get_client  # lazy: avoid import at module load

        _CLIENT = get_client()  # reads LANGFUSE_* from env
        _INITIALIZED = True
    return _CLIENT


def sample_rate() -> float:
    raw = os.environ.get("LANGFUSE_SAMPLE_RATE")
    if not raw or not raw.strip():
        return 1.0
    try:
        return max(0.0, min(1.0, float(raw)))
    except ValueError:
        return 1.0


def identity(*, user_id=None, session_id=None, tags=None):
    """Context manager that sets trace identity, or nullcontext when disabled."""
    if get_langfuse() is None:
        return nullcontext()
    from langfuse import propagate_attributes

    return propagate_attributes(
        user_id=user_id,
        session_id=str(session_id) if session_id is not None else None,
        tags=tags or [],
    )


def flush() -> None:
    client = get_langfuse()
    if client is not None:
        client.flush()
