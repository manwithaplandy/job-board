"""Safety and real session proofs for the isolated lifecycle test database."""

import importlib
import ctypes
from contextlib import contextmanager
import json
import os
from pathlib import Path
import subprocess
import signal
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


@pytest.mark.parametrize("creation", ["conflict", "ambiguous-owned", "successful"])
def test_creation_cleanup_requires_this_invocations_owner_and_immutable_id(monkeypatch, creation):
    module = harness()
    calls = []
    token, cid = "fix-round-one-owner", "a" * 64
    monkeypatch.setattr(module.secrets, "token_hex", lambda *args: token)
    monkeypatch.setattr(module.secrets, "token_urlsafe", lambda *args: token)

    def docker(args, **kwargs):
        calls.append(args)
        if args[0] == "run":
            if creation == "conflict":
                raise subprocess.CalledProcessError(125, ["docker", "run"])
            if creation == "ambiguous-owned":
                raise subprocess.TimeoutExpired(["docker", "run"], 180)
            return cid
        if args[0] == "inspect":
            return json.dumps({"id": cid, "owner": token if creation != "conflict" else "someone-else"})
        if args[0] == "port":
            raise RuntimeError("stop after successful creation")
        return ""

    monkeypatch.setattr(module, "_docker", docker)
    assert module.isolated_database([sys.executable, "-c", "pass"]) == 2
    removals = [args for args in calls if args[0] == "rm"]
    if creation == "conflict":
        assert removals == [], "failed creation must not remove an unowned name conflict"
    else:
        assert removals == [["rm", "--force", "--volumes", cid]]


def test_prior_harness_name_collision_does_not_reuse_the_prior_owner_marker(monkeypatch):
    module = harness()
    suffix, cid, calls = "prior-harness-name-suffix", "b" * 64, []
    monkeypatch.setattr(module.secrets, "token_hex", lambda *args: suffix)
    monkeypatch.setattr(module.secrets, "token_urlsafe", lambda *args: "fresh-invocation-marker")

    def docker(args, **kwargs):
        calls.append(args)
        if args[0] == "run":
            raise subprocess.CalledProcessError(125, ["docker", "run"])
        if args[0] == "inspect":
            # Exact prior-harness representation at FIX_BASE: marker=name suffix.
            return json.dumps({"id": cid, "owner": suffix})
        return ""

    monkeypatch.setattr(module, "_docker", docker)
    assert module.isolated_database([sys.executable, "-c", "pass"]) == 2
    assert not any(args[0] == "rm" for args in calls), "prior harness invocation was accepted as this invocation"
    assert "poller.lifecycle-test.owner=fresh-invocation-marker" in calls[0]


@requires_db
def test_real_name_conflict_preserves_the_other_invocations_container(monkeypatch):
    module = harness()
    token = module.secrets.token_hex(12)
    name = "poller-lifecycle-test-" + token
    # This test owns the sentinel, but the invoked harness does not. Never start
    # it or contact it as a DB; its immutable ID is the only test cleanup target.
    sentinel = module._docker([
        "create", "--name", name, "--label", "poller.lifecycle-test.owner=sentinel-" + token,
        "postgres:17",
    ])
    monkeypatch.setattr(module.secrets, "token_hex", lambda *args: token)
    try:
        assert module.isolated_database([sys.executable, "-c", "pass"]) == 2
        assert module._docker(["inspect", "--format", "{{.Id}}", sentinel]) == sentinel
    finally:
        if module._docker(["ps", "-aq", "--filter", "id=" + sentinel]):
            module._docker(["rm", "--force", "--volumes", sentinel])


@contextmanager
def adopt_own_descendants():
    # Reap only the descendant PID created by each test, including the RED probe.
    libc = ctypes.CDLL(None, use_errno=True)
    original = ctypes.c_int()
    assert libc.prctl(37, ctypes.byref(original), 0, 0, 0) == 0  # PR_GET_CHILD_SUBREAPER
    assert libc.prctl(36, 1, 0, 0, 0) == 0  # PR_SET_CHILD_SUBREAPER
    try:
        yield
    finally:
        assert libc.prctl(36, original.value, 0, 0, 0) == 0


def test_timeout_terminates_and_reaps_a_real_sigterm_ignoring_descendant(monkeypatch, tmp_path):
    module = harness()
    pidfile = tmp_path / "descendant.pid"
    worker = "import signal,threading; signal.signal(signal.SIGTERM,signal.SIG_IGN); print('ready',flush=True); threading.Event().wait(30)"
    parent = (
        "import subprocess,sys,threading; from pathlib import Path; "
        f"p=subprocess.Popen([sys.executable,'-c',{worker!r}],stdout=subprocess.PIPE,text=True); "
        "assert p.stdout.readline().strip()=='ready'; "
        f"Path({str(pidfile)!r}).write_text(str(p.pid)); threading.Event().wait(30)"
    )
    monkeypatch.setattr(module, "COMMAND_TIMEOUT_SECONDS", 0.5)
    monkeypatch.setattr(module, "COMMAND_TERMINATION_GRACE_SECONDS", 0.5, raising=False)
    with adopt_own_descendants():
        pid = None
        try:
            assert module.run_existing_database([sys.executable, "-c", parent], LOCAL) == 124
            assert pidfile.exists(), "descendant readiness was not acknowledged"
            pid = int(pidfile.read_text())
            reaped, status = os.waitpid(pid, os.WNOHANG)
            assert reaped == pid, "owned descendant remained alive after command timeout"
            pid = None
            assert os.WIFSIGNALED(status)
            assert os.WTERMSIG(status) == signal.SIGKILL
        finally:
            if pid is not None:
                os.kill(pid, signal.SIGKILL)
                os.waitpid(pid, 0)


def test_outer_cancellation_during_inner_timeout_cleanup_survives_a_second_signal(monkeypatch, tmp_path):
    module = harness()
    pidfile = tmp_path / "inner-worker.pid"
    second_signal = tmp_path / "second-signal"
    cleanup_started = threading.Event()
    previous_usr1 = signal.getsignal(signal.SIGUSR1)
    signal.signal(signal.SIGUSR1, lambda *args: cleanup_started.set())
    worker = (
        "import os,signal,threading; from pathlib import Path; "
        "signal.signal(signal.SIGTERM,signal.SIG_IGN); "
        f"Path({str(pidfile)!r}).write_text(str(os.getpid())); threading.Event().wait(30)"
    )
    inner = f"""
import os,signal,sys
from pathlib import Path
from tools import lifecycle_test_db as module
module.COMMAND_TIMEOUT_SECONDS=0.2
module.COMMAND_TERMINATION_GRACE_SECONDS=20
real_group=module._group_has_live_processes
announced=False
def observed_group(pgid):
    global announced
    if not announced:
        announced=True
        os.kill({os.getpid()},signal.SIGUSR1)
    return real_group(pgid)
module._group_has_live_processes=observed_group
real_signal=signal.signal
signal_seen=False
def observing_signal(sig,handler):
    if sig==signal.SIGTERM and callable(handler):
        def repeat(signum,frame):
            global signal_seen
            first=not signal_seen
            signal_seen=True
            if not first:
                Path({str(second_signal)!r}).touch()
            result=handler(signum,frame)
            if first:
                os.kill(os.getpid(),signal.SIGTERM)
            return result
        return real_signal(sig,repeat)
    return real_signal(sig,handler)
signal.signal=observing_signal
module.run_existing_database([sys.executable,'-c',{worker!r}],{LOCAL!r})
"""
    real_stop = module._stop_command_group

    def after_inner_cleanup_started(process, *args, **kwargs):
        assert cleanup_started.wait(5), "real inner timeout cleanup did not begin"
        return real_stop(process, *args, **kwargs)

    monkeypatch.setattr(module, "_stop_command_group", after_inner_cleanup_started)
    monkeypatch.setattr(module, "COMMAND_TIMEOUT_SECONDS", 1)
    monkeypatch.setattr(module, "COMMAND_TERMINATION_GRACE_SECONDS", 0.5)
    with adopt_own_descendants():
        pid = None
        try:
            assert module.run_existing_database([sys.executable, "-c", inner], LOCAL) == 124
            assert cleanup_started.is_set()
            assert second_signal.exists(), "second termination signal was not exercised"
            assert pidfile.exists(), "inner worker never acknowledged its PID"
            pid = int(pidfile.read_text())
            assert not Path(f"/proc/{pid}").exists(), "inner timeout cleanup was interrupted and its worker survived"
            pid = None  # The inner Popen has reaped its own worker.
        finally:
            signal.signal(signal.SIGUSR1, previous_usr1)
            if pid is not None:
                try:
                    os.kill(pid, signal.SIGKILL)
                    os.waitpid(pid, 0)
                except (ProcessLookupError, ChildProcessError):
                    pass


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


@requires_db
def test_outer_timeout_allows_nested_harness_container_and_process_cleanup(monkeypatch, tmp_path):
    module = harness()
    marker = tmp_path / "nested.json"
    command_started = threading.Event()
    previous_usr1 = signal.getsignal(signal.SIGUSR1)
    signal.signal(signal.SIGUSR1, lambda *args: command_started.set())
    script = (
        "import os,json,signal,subprocess,threading; from pathlib import Path; from urllib.parse import urlsplit; "
        "signal.signal(signal.SIGTERM,signal.SIG_IGN); "
        "port=str(urlsplit(os.environ['TEST_DATABASE_URL']).port); "
        f"ids=subprocess.check_output({module.DOCKER!r}+['ps','--no-trunc','-q','--filter','publish='+port],text=True).splitlines(); "
        "assert len(ids)==1; "
        f"Path({str(marker)!r}).write_text(json.dumps(dict(cid=ids[0],pid=os.getpid()))); "
        f"os.kill({os.getpid()},signal.SIGUSR1); threading.Event().wait(30)"
    )
    real_stop = module._stop_command_group

    def after_command_started(process, *args, **kwargs):
        # Exercise cancellation of a running child. Docker startup can consume
        # the outer deadline; a separate test below covers that startup phase.
        acknowledged = command_started.wait(module.READINESS_TIMEOUT_SECONDS)
        result = real_stop(process, *args, **kwargs)
        assert acknowledged, "nested owned database command never acknowledged startup"
        return result

    monkeypatch.setattr(module, "_stop_command_group", after_command_started)
    monkeypatch.setattr(module, "COMMAND_TIMEOUT_SECONDS", 8)
    monkeypatch.setattr(module, "COMMAND_TERMINATION_GRACE_SECONDS", 10, raising=False)
    command = [sys.executable, str(ROOT / "tools/lifecycle_test_db.py"), "--postgres-major", "17", "--", sys.executable, "-c", script]
    with adopt_own_descendants():
        data = None
        try:
            assert module.run_existing_database(command, TEST_DSN) == 124
            assert marker.exists(), "nested owned database command never started"
            data = json.loads(marker.read_text())
            remaining = module._docker(["ps", "--all", "--quiet", "--filter", "id=" + data["cid"]])
            assert remaining == "", "outer timeout bypassed nested container cleanup"
            assert not Path(f"/proc/{data['pid']}").exists(), "nested command descendant survived"
        finally:
            signal.signal(signal.SIGUSR1, previous_usr1)
            # Exact IDs/PIDs acknowledged by this test's owned nested child only.
            if data is None and marker.exists():
                data = json.loads(marker.read_text())
            if data:
                try:
                    os.kill(data["pid"], signal.SIGKILL)
                except ProcessLookupError:
                    pass
                try:
                    os.waitpid(data["pid"], 0)
                except ChildProcessError:
                    pass
                if module._docker(["ps", "-aq", "--filter", "id=" + data["cid"]]):
                    module._docker(["rm", "--force", "--volumes", data["cid"]])


@requires_db
def test_outer_timeout_during_owned_database_startup_cleans_its_container(monkeypatch, tmp_path):
    module = harness()
    marker = tmp_path / "startup-container-id"
    command_marker = tmp_path / "command-started"
    port_known = threading.Event()
    previous_usr1 = signal.getsignal(signal.SIGUSR1)
    signal.signal(signal.SIGUSR1, lambda *args: port_known.set())
    worker = f"from pathlib import Path; Path({str(command_marker)!r}).touch()"
    driver = f"""
import os,signal,sys,threading
from pathlib import Path
from tools import lifecycle_test_db as module
real_docker=module._docker
created_id=None
def observed_docker(args,**kwargs):
    global created_id
    result=real_docker(args,**kwargs)
    if args[0]=='run':
        created_id=result
    if args[0]=='port':
        Path({str(marker)!r}).write_text(created_id)
        os.kill({os.getpid()},signal.SIGUSR1)
        threading.Event().wait(30)
    return result
module._docker=observed_docker
raise SystemExit(module.isolated_database([sys.executable,'-c',{worker!r}],17))
"""
    real_stop = module._stop_command_group

    def after_owned_startup(process, *args, **kwargs):
        acknowledged = port_known.wait(module.READINESS_TIMEOUT_SECONDS)
        result = real_stop(process, *args, **kwargs)
        assert acknowledged, "owned container startup never acknowledged its identity"
        return result

    monkeypatch.setattr(module, "_stop_command_group", after_owned_startup)
    monkeypatch.setattr(module, "COMMAND_TIMEOUT_SECONDS", 1)
    monkeypatch.setattr(module, "COMMAND_TERMINATION_GRACE_SECONDS", 10)
    try:
        assert module.run_existing_database([sys.executable, "-c", driver], TEST_DSN) == 124
        assert marker.exists()
        assert not command_marker.exists(), "test cancellation missed the database startup phase"
        assert module._docker(["ps", "-aq", "--filter", "id=" + marker.read_text()]) == ""
    finally:
        signal.signal(signal.SIGUSR1, previous_usr1)
        if marker.exists() and module._docker(["ps", "-aq", "--filter", "id=" + marker.read_text()]):
            module._docker(["rm", "--force", "--volumes", marker.read_text()])


@requires_db
def test_two_real_harness_invocations_with_one_name_preserve_the_first(monkeypatch, tmp_path):
    module = harness()
    suffix = module.secrets.token_hex(12)
    marker = tmp_path / "first-harness.json"
    first_ready = threading.Event()
    previous_usr1 = signal.getsignal(signal.SIGUSR1)
    signal.signal(signal.SIGUSR1, lambda *args: first_ready.set())
    worker = (
        "import os,json,signal,subprocess,threading; from pathlib import Path; from urllib.parse import urlsplit; "
        "port=str(urlsplit(os.environ['TEST_DATABASE_URL']).port); "
        f"ids=subprocess.check_output({module.DOCKER!r}+['ps','--no-trunc','-q','--filter','publish='+port],text=True).splitlines(); "
        "assert len(ids)==1; "
        f"Path({str(marker)!r}).write_text(json.dumps(dict(cid=ids[0],pid=os.getpid()))); "
        f"os.kill({os.getpid()},signal.SIGUSR1); threading.Event().wait(30)"
    )
    driver = (
        "import sys; from tools import lifecycle_test_db as module; "
        f"module.secrets.token_hex=lambda *args:{suffix!r}; "
        f"raise SystemExit(module.isolated_database([sys.executable,'-c',{worker!r}],17))"
    )
    first = subprocess.Popen([sys.executable, "-c", driver], env=module.child_environment(TEST_DSN), start_new_session=True)
    try:
        assert first_ready.wait(15), "first real harness did not acknowledge its owned container"
        first_id = json.loads(marker.read_text())["cid"]
        monkeypatch.setattr(module.secrets, "token_hex", lambda *args: suffix)
        assert module.isolated_database([sys.executable, "-c", "pass"], 17) == 2
        assert module._docker(["inspect", "--format", "{{.Id}}", first_id]) == first_id
    finally:
        signal.signal(signal.SIGUSR1, previous_usr1)
        module._stop_command_group(first)
