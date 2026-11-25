"""Gate A17 (plan Q8): tools/lifecycle_test_db.py forwards an opt-in variable only when
asked with --allow-env, only for _OPT_IN_ENV names, and only to the test command.

Values here are low-entropy placeholders; no real key is used or needed.
"""

import importlib
import json
import os
import subprocess
import sys

import pytest

LOCAL = "postgresql://postgres:test-only@127.0.0.1:55432/poller_lifecycle_test"
KEY = "OPENROUTER_API_KEY"
VALUE = "test-key"


def harness():
    return importlib.import_module("tools.lifecycle_test_db")


def todays_child_environment(module, dsn):
    """child_environment as it was before gate A17, rebuilt from its parts."""
    env = {name: value for name, value in os.environ.items() if name in module._SAFE_ENV}
    env.update({
        "TEST_DATABASE_URL": dsn,
        "DATABASE_URL": dsn,
        "LIFECYCLE_REQUIRE_DB_TESTS": "1",
        "OPENAI_API_KEY": "test-disabled",
        "AWS_EC2_METADATA_DISABLED": "true",
        "AWS_SHARED_CREDENTIALS_FILE": os.devnull,
        "AWS_CONFIG_FILE": os.devnull,
        "PYTHONUNBUFFERED": "1",
    })
    return env


def no_docker(monkeypatch, module):
    calls = []
    monkeypatch.setattr(module, "_docker", lambda args, **kw: calls.append(args) or "")
    monkeypatch.setattr(module.subprocess, "run", lambda *a, **kw: calls.append(a) or None)
    return calls


def run_main(monkeypatch, module, argv):
    monkeypatch.setattr(sys, "argv", ["lifecycle_test_db.py", *argv])
    with pytest.raises(SystemExit) as exited:
        module.main()
    return exited.value.code


def test_opt_in_allowlist_is_exactly_the_openrouter_key():
    allowed = harness()._OPT_IN_ENV
    assert allowed == frozenset({KEY})


def test_without_the_flag_the_child_environment_is_unchanged(monkeypatch):
    module = harness()
    monkeypatch.setenv(KEY, VALUE)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-other")
    env = module.child_environment(LOCAL)
    assert env == todays_child_environment(module, LOCAL)
    assert module.child_environment(LOCAL, ()) == env
    assert KEY not in env
    assert VALUE not in env.values()


def test_with_the_flag_exactly_that_one_variable_is_added(monkeypatch):
    module = harness()
    monkeypatch.setenv(KEY, VALUE)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-other")
    without = module.child_environment(LOCAL)
    with_key = module.child_environment(LOCAL, (KEY,))
    assert set(with_key) - set(without) == {KEY}
    assert with_key[KEY] == VALUE
    assert {name: value for name, value in with_key.items() if name != KEY} == without


@pytest.mark.parametrize("name", ["ANTHROPIC_API_KEY", "DATABASE_URL", "openrouter_api_key", VALUE])
def test_an_unlisted_name_is_a_usage_error_that_echoes_nothing(monkeypatch, capsys, name):
    module = harness()
    monkeypatch.setenv(KEY, VALUE)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-other")
    calls = no_docker(monkeypatch, module)
    code = run_main(monkeypatch, module, ["--allow-env", name, "--", "true"])
    out = capsys.readouterr()
    assert code != 0
    assert calls == []
    assert "allowed: OPENROUTER_API_KEY" in out.err
    for secret in (VALUE, "test-other"):
        assert secret not in out.out + out.err


def test_an_unlisted_name_is_refused_by_the_library_entries_too(monkeypatch):
    module = harness()
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-other")
    calls = no_docker(monkeypatch, module)
    with pytest.raises(ValueError) as error:
        module.child_environment(LOCAL, ("ANTHROPIC_API_KEY",))
    assert "test-other" not in str(error.value)
    with pytest.raises(ValueError):
        module.isolated_database([sys.executable, "-c", "pass"], 17, ("ANTHROPIC_API_KEY",))
    assert calls == []


@pytest.mark.parametrize("unset", ["missing", "empty"])
def test_an_asked_for_but_unset_name_exits_non_zero_before_docker(monkeypatch, capsys, unset):
    module = harness()
    if unset == "missing":
        monkeypatch.delenv(KEY, raising=False)
    else:
        monkeypatch.setenv(KEY, "")
    calls = no_docker(monkeypatch, module)
    code = run_main(monkeypatch, module, ["--allow-env", KEY, "--", "true"])
    assert code != 0
    assert calls == []
    assert f"{KEY} is not set" in capsys.readouterr().err
    with pytest.raises(ValueError):
        module.child_environment(LOCAL, (KEY,))
    with pytest.raises(ValueError):
        module.isolated_database([sys.executable, "-c", "pass"], 17, (KEY,))
    assert calls == []


def test_unset_name_on_the_existing_service_entry_exits_non_zero(monkeypatch, capsys):
    module = harness()
    monkeypatch.delenv(KEY, raising=False)
    monkeypatch.setenv("TEST_DATABASE_URL", LOCAL)
    calls = no_docker(monkeypatch, module)
    code = run_main(monkeypatch, module, ["--existing-service", "--allow-env", KEY, "--", "true"])
    assert code != 0
    assert calls == []
    assert f"{KEY} is not set" in capsys.readouterr().err


def test_the_key_reaches_only_the_test_command_and_is_never_printed(monkeypatch, capfd):
    """An owned launch with --allow-env: docker calls, the readiness probe and every
    printed line stay free of the key; the test command alone receives it."""
    module = harness()
    monkeypatch.setenv(KEY, VALUE)
    cid, owner = "c" * 64, "test-owner"
    monkeypatch.setattr(module.secrets, "token_hex", lambda *a: "test-name")
    monkeypatch.setattr(module.secrets, "token_urlsafe", lambda *a: owner)
    seen = []

    def fake_run(args, **kwargs):
        seen.append((list(args), dict(kwargs.get("env") or {})))
        if list(args[: len(module.DOCKER)]) == module.DOCKER:
            verb = args[len(module.DOCKER)]
            out = {
                "run": cid,
                "port": "127.0.0.1:55999",
                "inspect": json.dumps({"id": cid, "owner": owner}),
            }.get(verb, "")
            return subprocess.CompletedProcess(args, 0, stdout=out + "\n", stderr="")
        return subprocess.CompletedProcess(args, 0, stdout="17.6\n", stderr="")  # readiness probe

    monkeypatch.setattr(module.subprocess, "run", fake_run)
    child = (
        "import os; "
        "print('child-has-key' if os.environ.get('OPENROUTER_API_KEY') == 'test-key' else 'child-lacks-key')"
    )
    monkeypatch.setattr(sys, "argv", ["lifecycle_test_db.py", "--allow-env", KEY, "--", sys.executable, "-c", child])
    assert module.main() == 0
    out = capfd.readouterr()
    assert "child-has-key" in out.out
    assert VALUE not in out.out + out.err
    docker_calls = [call for call in seen if call[0][: len(module.DOCKER)] == module.DOCKER]
    probes = [call for call in seen if call[0][: len(module.DOCKER)] != module.DOCKER]
    assert [args[len(module.DOCKER)] for args, _ in docker_calls] == ["run", "port", "inspect", "rm"]
    assert len(probes) == 1
    for args, env in seen:
        assert KEY not in env
        assert VALUE not in env.values()
        assert not any(VALUE in str(arg) for arg in args)
    for _, env in docker_calls:
        assert set(env) <= module._SAFE_ENV
