from observability import tracing


def test_disabled_when_keys_absent(monkeypatch):
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)
    assert tracing.tracing_enabled() is False
    assert tracing.get_langfuse() is None


def test_enabled_when_keys_present(monkeypatch):
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-lf-x")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-lf-x")
    assert tracing.tracing_enabled() is True


def test_sample_rate_defaults_and_clamps(monkeypatch):
    monkeypatch.delenv("LANGFUSE_SAMPLE_RATE", raising=False)
    assert tracing.sample_rate() == 1.0
    monkeypatch.setenv("LANGFUSE_SAMPLE_RATE", "0.15")
    assert tracing.sample_rate() == 0.15
    monkeypatch.setenv("LANGFUSE_SAMPLE_RATE", "9")
    assert tracing.sample_rate() == 1.0
    monkeypatch.setenv("LANGFUSE_SAMPLE_RATE", "junk")
    assert tracing.sample_rate() == 1.0


def test_identity_is_nullcontext_when_disabled(monkeypatch):
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    with tracing.identity(user_id="u", session_id="s", tags=["t"]):
        pass  # must not raise


def test_flush_is_noop_when_disabled(monkeypatch):
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    tracing.flush()  # must not raise
