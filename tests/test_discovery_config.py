from pathlib import Path

from discovery import config


def test_dataset_dir_default():
    assert config.dataset_dir() == Path(config.__file__).resolve().parent / "data"


def test_dataset_dir_override(monkeypatch, tmp_path):
    monkeypatch.setenv("DISCOVERY_DATASET_DIR", str(tmp_path))
    assert config.dataset_dir() == tmp_path


def test_has_api_key(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    assert config.has_api_key() is False
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    assert config.has_api_key() is True


def test_int_env_uses_default_when_unset_or_blank(monkeypatch):
    monkeypatch.delenv("X_INT", raising=False)
    assert config._int_env("X_INT", 7) == 7
    monkeypatch.setenv("X_INT", "  ")
    assert config._int_env("X_INT", 7) == 7


def test_int_env_parses_and_falls_back_on_malformed(monkeypatch):
    monkeypatch.setenv("X_INT", "12")
    assert config._int_env("X_INT", 7) == 12
    monkeypatch.setenv("X_INT", "not-a-number")
    assert config._int_env("X_INT", 7) == 7
