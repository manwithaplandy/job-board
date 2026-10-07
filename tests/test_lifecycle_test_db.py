"""Safety and real session proofs for the isolated lifecycle test database."""

import importlib
import os
from pathlib import Path
import subprocess
import sys
import threading
from types import SimpleNamespace

import psycopg
import pytest

from tests.conftest import TEST_DSN, as_user, requires_db

ROOT = Path(__file__).resolve().parents[1]
LOCAL = "postgresql://postgres:test-only@127.0.0.1:55432/poller_lifecycle_test"


def harness():
    # The reconstruction RED is an assertion, rather than an import error.
    assert (ROOT / "tools/lifecycle_test_db.py").exists(), "isolated harness is absent"
    return importlib.import_module("tools.lifecycle_test_db")


@pytest.mark.parametrize("dsn", [
    "postgresql://postgres:secret@db.project.supabase.co:5432/postgres",
    "postgresql://postgres:secret@aws-0.pooler.supabase.com:6543/poller_test",
    "postgresql://postgres:secret@production.example:5432/poller_test",
    "postgresql://postgres:secret@127.0.0.1:5432/postgres",
    "postgresql://postgres:secret@localhost:5432/production",
    "postgresql://postgres:secret@192.168.1.2:5432/poller_test",
    "postgresql://postgres:secret@0.0.0.0:5432/poller_test",
    "postgresql:///poller_test",
    "postgresql://postgres@localhost:5432/poller_test",
    "postgresql://postgres:secret@localhost/poller_test",
    "postgresql://postgres:secret@localhost:0/poller_test",
    "postgresql://postgres:secret@localhost:65536/poller_test",
    "postgresql://postgres:secret@localhost:5432/poller_test?host=production.example",
    "postgresql://postgres:secret@localhost:5432/poller_test?hostaddr=8.8.8.8",
    "postgresql://postgres:secret@localhost:5432/poller_test?service=production",
    "postgresql://postgres:secret@localhost:5432/poller_test?options=-csearch_path=other",
    "postgresql://postgres:secret@localhost:5432/poller_test#fragment",
    "postgresql://postgres:secret@localhost,production.example:5432/poller_test",
    "postgresql://postgres:secret@localhost%2cproduction.example:5432/poller_test",
    "host=localhost port=5432 dbname=poller_test user=postgres password=secret",
    "mysql://postgres:secret@localhost:5432/poller_test",
    "", " postgresql://postgres:secret@localhost:5432/poller_test",
])
def test_unsafe_dsn_is_rejected_before_connection_or_ddl(dsn, monkeypatch):
    harness()
    module = importlib.import_module("tests.lifecycle_helpers")
    calls = []
    monkeypatch.setattr(psycopg, "connect", lambda *a, **kw: calls.append(a))
    with pytest.raises(ValueError) as error:
        module.open_sessions(dsn, 2)
    assert calls == []
    assert "secret" not in str(error.value)


@pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "[::1]"])
@pytest.mark.parametrize("database", ["poller_test", "poller_lifecycle_test"])
def test_only_explicit_loopback_test_databases_are_allowed(host, database):
    harness().validate_test_dsn(f"postgresql://postgres:test@{host}:55432/{database}")


def test_child_environment_scrubs_ambient_secrets_and_database(monkeypatch):
    module = harness()
    ambient = {
        "DATABASE_URL": "production-do-not-use", "TEST_DATABASE_URL": "production-do-not-use",
        "OPENAI_API_KEY": "live", "OPENROUTER_API_KEY": "live", "ANTHROPIC_API_KEY": "live",
        "AWS_ACCESS_KEY_ID": "live", "AWS_SECRET_ACCESS_KEY": "live", "AWS_PROFILE": "prod",
        "LANGFUSE_PUBLIC_KEY": "live", "LANGFUSE_SECRET_KEY": "live",
        "OTEL_EXPORTER_OTLP_HEADERS": "live", "SUPABASE_SERVICE_ROLE_KEY": "live",
        "PGHOSTADDR": "8.8.8.8", "PGSERVICE": "production", "PGOPTIONS": "live",
        "HTTP_PROXY": "production", "CUSTOM_PROVIDER_TOKEN": "live", "DOCKER_HOST": "remote",
    }
    for name, value in ambient.items():
        monkeypatch.setenv(name, value)
    env = module.child_environment(LOCAL)
    assert env["DATABASE_URL"] == env["TEST_DATABASE_URL"] == LOCAL
    assert env["LIFECYCLE_REQUIRE_DB_TESTS"] == "1"
    assert env["OPENAI_API_KEY"] == "test-disabled"
    assert env["AWS_EC2_METADATA_DISABLED"] == "true"
    assert env["AWS_SHARED_CREDENTIALS_FILE"] == env["AWS_CONFIG_FILE"] == os.devnull
    assert not any(value == "live" or value == "production" for value in env.values())
    for name in ambient.keys() - {"DATABASE_URL", "TEST_DATABASE_URL", "OPENAI_API_KEY"}:
        assert name not in env


def test_invalid_major_is_rejected_before_docker(monkeypatch):
    module = harness()
    calls = []
    monkeypatch.setattr(subprocess, "run", lambda *a, **kw: calls.append(a))
    with pytest.raises(ValueError):
        module.isolated_database([sys.executable, "-c", "pass"], postgres_major=15)
    assert calls == []


def test_helper_rechecks_connected_target_before_any_ddl():
    harness()
    helpers = importlib.import_module("tests.lifecycle_helpers")
    calls = []
    connection = SimpleNamespace(
        info=SimpleNamespace(host="production.example", hostaddr="192.0.2.1", dbname="postgres", port=5432),
        execute=lambda *a, **kw: calls.append(a),
    )
    with pytest.raises(ValueError):
        helpers.bootstrap_schema(connection, "DROP TABLE jobs")
    with pytest.raises(ValueError):
        helpers.apply_migrations(connection, [])
    assert calls == []


def test_direct_pytest_refuses_unsafe_dsn_before_fixtures(tmp_path):
    module = harness()
    marker = tmp_path / "ddl-ran"
    test = tmp_path / "test_before_ddl.py"
    test.write_text(f"def test_before_ddl():\n    from pathlib import Path\n    Path({str(marker)!r}).touch()\n")
    env = module.child_environment(LOCAL)
    env["TEST_DATABASE_URL"] = "postgresql://postgres:do-not-log-this@db.project.supabase.co:5432/postgres"
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-p", "tests.conftest", str(test), "-q"],
        env=env, capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 4
    assert "unsafe test DSN" in result.stdout + result.stderr
    assert "do-not-log-this" not in result.stdout + result.stderr
    assert not marker.exists()
    env.pop("TEST_DATABASE_URL")
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-p", "tests.conftest", str(test), "-q"],
        env=env, capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 4
    assert "needs TEST_DATABASE_URL" in result.stdout + result.stderr
    assert not marker.exists()


@requires_db
def test_direct_pytest_scrubs_ambient_libpq_target_overrides(tmp_path):
    module = harness()
    test = tmp_path / "test_pg_environment.py"
    test.write_text(
        "def test_safe_target():\n"
        "    import os,psycopg\n"
        "    assert 'PGSERVICE' not in os.environ\n"
        "    assert 'PGHOSTADDR' not in os.environ\n"
        "    with psycopg.connect(os.environ['TEST_DATABASE_URL'],connect_timeout=1) as conn:\n"
        "        assert conn.info.hostaddr in ('127.0.0.1','::1')\n"
    )
    env = module.child_environment(TEST_DSN)
    env.update(PGSERVICE="nonexistent-production-service", PGHOSTADDR="192.0.2.1")
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-p", "tests.conftest", str(test), "-q"],
        env=env, capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr


@requires_db
def test_existing_ci_service_entry_runs_with_scrubbed_environment(monkeypatch):
    module = harness()
    monkeypatch.setenv("DATABASE_URL", "production-do-not-use")
    monkeypatch.setenv("PGSERVICE", "nonexistent-production-service")
    assert module.run_existing_database([
        sys.executable, "-c",
        "import os,psycopg; assert os.environ['DATABASE_URL']==os.environ['TEST_DATABASE_URL']; "
        "assert 'PGSERVICE' not in os.environ; "
        "c=psycopg.connect(os.environ['DATABASE_URL']); "
        "assert c.info.hostaddr in ('127.0.0.1','::1'); c.close()",
    ], TEST_DSN) == 0


@requires_db
def test_independent_sessions_share_committed_rows_and_enforce_rls(conn):
    module = harness()
    helpers = importlib.import_module("tests.lifecycle_helpers")
    owner = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    foreign = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    conn.execute("INSERT INTO profiles(user_id,profile_version) VALUES (%s,'v1')", (foreign,))
    conn.commit()
    sessions = helpers.open_sessions(TEST_DSN, 2)
    assert len(sessions) == 2
    try:
        pids = [c.execute("SELECT pg_backend_pid() AS pid").fetchone()["pid"] for c in sessions]
        assert len(set(pids)) == 2
        for session in sessions:
            assert session.execute("SELECT count(*) AS n FROM profiles").fetchone()["n"] == 1
            session.rollback()
            with as_user(session, owner):
                assert session.execute("SELECT count(*) AS n FROM profiles").fetchone()["n"] == 0
            with as_user(session, foreign):
                assert session.execute("SELECT count(*) AS n FROM profiles").fetchone()["n"] == 1
            session.execute("SET LOCAL ROLE anon")
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                session.execute("SELECT * FROM profiles")
            session.rollback()
        module.validate_test_dsn(TEST_DSN)
    finally:
        for session in sessions:
            session.close()


@requires_db
def test_event_synchronized_sessions_see_only_committed_changes(conn):
    harness()
    helpers = importlib.import_module("tests.lifecycle_helpers")
    owner = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    conn.execute("INSERT INTO profiles(user_id,profile_version) VALUES (%s,'v1')", (owner,))
    conn.commit()
    writer, reader = helpers.open_sessions(TEST_DSN, 2)
    updated, inspected, committed = threading.Event(), threading.Event(), threading.Event()
    failures = []

    def write():
        try:
            writer.execute("UPDATE profiles SET profile_version='v2' WHERE user_id=%s", (owner,))
            updated.set()
            assert inspected.wait(5), "reader did not inspect uncommitted state"
            writer.commit()
            committed.set()
        except BaseException as error:
            failures.append(error)
            updated.set()
            committed.set()

    thread = threading.Thread(target=write)
    thread.start()
    try:
        assert updated.wait(5)
        assert reader.execute("SELECT profile_version FROM profiles").fetchone()["profile_version"] == "v1"
        inspected.set()
        assert committed.wait(5)
        assert reader.execute("SELECT profile_version FROM profiles").fetchone()["profile_version"] == "v2"
    finally:
        inspected.set()
        thread.join(6)
        for session in (writer, reader):
            session.close()
    assert not thread.is_alive()
    assert failures == []


@requires_db
@pytest.mark.parametrize("skip_kind", ["runtest", "collection"])
def test_required_database_entry_refuses_skipped_tests(tmp_path, skip_kind):
    module = harness()
    test = tmp_path / "test_skip.py"
    if skip_kind == "runtest":
        test.write_text("import pytest\n@pytest.mark.integration\n@pytest.mark.skip(reason='required')\ndef test_required(): pass\n")
    else:
        test.write_text("import pytest\npytest.skip('required',allow_module_level=True)\n")
        (tmp_path / "test_pass.py").write_text("def test_pass(): pass\n")
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-p", "tests.conftest", str(tmp_path), "-q"],
        env=module.child_environment(TEST_DSN), capture_output=True, text=True, timeout=30,
    )
    assert result.returncode != 0, result.stdout
    assert "required database tests skipped" in result.stdout + result.stderr


@requires_db
def test_owned_docker_child_failure_and_timeout_cleanup(monkeypatch, capsys):
    module = harness()
    # Nested real Docker run proves cleanup on a failed child and timeout. No ambient DSN reuse.
    monkeypatch.setenv("PGSERVICE", "nonexistent-production-service")
    monkeypatch.setenv("PGHOSTADDR", "192.0.2.1")
    monkeypatch.setenv("DATABASE_URL", "production-do-not-use")
    monkeypatch.setattr(module, "COMMAND_TIMEOUT_SECONDS", 1)
    before = subprocess.check_output(module.DOCKER + ["ps", "-aq"], text=True).splitlines()
    volumes_before = subprocess.check_output(module.DOCKER + ["volume", "ls", "-q"], text=True).splitlines()
    assert module.isolated_database([sys.executable, "-c", "raise SystemExit(7)"], 17) == 7
    assert module.isolated_database(
        [sys.executable, "-c", "import threading; threading.Event().wait(30)"], 17,
    ) == 124
    after = subprocess.check_output(module.DOCKER + ["ps", "-aq"], text=True).splitlines()
    volumes_after = subprocess.check_output(module.DOCKER + ["volume", "ls", "-q"], text=True).splitlines()
    assert sorted(after) == sorted(before)
    assert sorted(volumes_after) == sorted(volumes_before)
    output = capsys.readouterr().out
    assert "PostgreSQL 17." in output
    assert "postgresql://" not in output
