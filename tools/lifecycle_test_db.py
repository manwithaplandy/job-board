"""Run tests in a local, owned, throwaway PostgreSQL 17 (or 16) container.

Never consult ambient DATABASE_URL. The default launcher owns a new database;
--existing-service reuses CI's explicitly supplied, validated TEST_DATABASE_URL.
"""

import argparse
from contextlib import contextmanager
import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import sys
import threading
import time
from urllib.parse import unquote, urlsplit

import psycopg

DOCKER = ["docker", "--host", "unix:///var/run/docker.sock"]
COMMAND_TIMEOUT_SECONDS = 1800
COMMAND_TERMINATION_GRACE_SECONDS = 10
READINESS_TIMEOUT_SECONDS = 60
_HOSTS = {"localhost", "127.0.0.1", "::1"}
_DATABASES = {"poller_test", "poller_lifecycle_test"}
_SAFE_ENV = {"PATH", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "TERM", "TMPDIR", "VIRTUAL_ENV"}


def validate_test_dsn(dsn: str) -> None:
    """Reject ambiguous/remote DSNs without including credentials in errors.

Only explicit URI loopback hosts, ports and test database names are supported.
No query options: hostaddr/service/passfile/options can bypass the URI target.
"""
    try:
        if not isinstance(dsn, str) or any(char.isspace() for char in dsn):
            raise ValueError
        parsed = urlsplit(dsn)
        if (
            parsed.scheme not in {"postgres", "postgresql"}
            or parsed.hostname not in _HOSTS
            or parsed.port is None or not 1 <= parsed.port <= 65535
            or not parsed.username or not parsed.password
            or unquote(parsed.path) not in {f"/{name}" for name in _DATABASES}
            or parsed.query or parsed.fragment or "?" in dsn or "#" in dsn
        ):
            raise ValueError
        parameters = psycopg.conninfo.conninfo_to_dict(dsn)
        if parameters.get("host") not in _HOSTS or parameters.get("dbname") not in _DATABASES:
            raise ValueError
    except (ValueError, psycopg.ProgrammingError):
        raise ValueError("unsafe test DSN: explicit loopback test database required") from None


def validate_test_connection(conn: psycopg.Connection) -> None:
    """Recheck an established target before any helper DDL."""
    if (
        conn.info.host not in _HOSTS
        or conn.info.hostaddr not in {"127.0.0.1", "::1"}
        or conn.info.dbname not in _DATABASES
        or not 1 <= conn.info.port <= 65535
    ):
        raise ValueError("unsafe test connection: loopback test database required")


def child_environment(dsn: str) -> dict[str, str]:
    """An allowlist prevents inherited provider/production/PG credentials.

Existing tests supply offline SDK doubles themselves. Placeholder OpenAI auth
lets constructors work; AWS credential files and instance metadata are disabled.
"""
    validate_test_dsn(dsn)
    env = {name: value for name, value in os.environ.items() if name in _SAFE_ENV}
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


def _docker(args: list[str], *, timeout: int = 30) -> str:
    # Force the local socket; never inherit a remote Docker host or context.
    result = subprocess.run(
        DOCKER + args, env={k: v for k, v in os.environ.items() if k in _SAFE_ENV},
        capture_output=True, text=True, timeout=timeout, check=True,
    )
    return result.stdout.strip()


class _HarnessTermination(BaseException):
    def __init__(self, signum: int):
        self.signum = signum


@contextmanager
def _termination_handlers():
    # SIGTERM must unwind nested runners' finally blocks instead of bypassing
    # their owned container and command-group cleanup. Restore caller handlers.
    if threading.current_thread() is not threading.main_thread():
        yield
        return
    previous = {sig: signal.getsignal(sig) for sig in (signal.SIGTERM, signal.SIGINT)}

    def interrupted(signum, frame):
        raise _HarnessTermination(signum)

    try:
        for sig in previous:
            signal.signal(sig, interrupted)
        yield
    finally:
        for sig, handler in previous.items():
            signal.signal(sig, handler)


@contextmanager
def _defer_termination(on_signal=None):
    """Finish bounded cleanup before propagating cancellation, including repeats."""
    if threading.current_thread() is not threading.main_thread():
        yield
        return
    previous = {sig: signal.getsignal(sig) for sig in (signal.SIGTERM, signal.SIGINT)}
    pending = None

    def deferred(signum, frame):
        nonlocal pending
        if pending is None:
            pending = signum
        if on_signal is not None:
            on_signal()

    try:
        for sig in previous:
            signal.signal(sig, deferred)
        yield
    finally:
        for sig, handler in previous.items():
            signal.signal(sig, handler)
    if pending is not None:
        raise _HarnessTermination(pending)


def _group_has_live_processes(pgid: int) -> bool:
    # The selected Linux Docker environment exposes /proc. Zombies cannot run
    # work; the direct child is reaped by Popen, other parents reap their children.
    try:
        os.killpg(pgid, 0)
    except ProcessLookupError:
        return False
    for directory in Path("/proc").iterdir():
        if not directory.name.isdigit():
            continue
        try:
            fields = (directory / "stat").read_text().rsplit(")", 1)[1].split()
            if int(fields[2]) == pgid and fields[0] != "Z":
                return True
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            continue
    return False


def _stop_command_group(process: subprocess.Popen, grace_seconds: float | None = None) -> None:
    pgid = process.pid  # start_new_session makes the child's PID its owned PGID.
    grace_deadline = time.monotonic() + (COMMAND_TERMINATION_GRACE_SECONDS if grace_seconds is None else grace_seconds)

    def escalate():
        nonlocal grace_deadline
        grace_deadline = min(grace_deadline, time.monotonic())

    # Signals can arrive inside the timeout exception handler itself. A sibling
    # except cannot catch them there; defer them until this group's cleanup is
    # complete and immediately shorten grace so outer cancellation stays bounded.
    with _defer_termination(escalate):
        try:
            os.killpg(pgid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        while _group_has_live_processes(pgid) and time.monotonic() < grace_deadline:
            process.poll()
            threading.Event().wait(0.05)
        if _group_has_live_processes(pgid):
            try:
                os.killpg(pgid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        process.wait(timeout=5)
        deadline = time.monotonic() + 5
        while _group_has_live_processes(pgid) and time.monotonic() < deadline:
            threading.Event().wait(0.05)
        if _group_has_live_processes(pgid):
            raise RuntimeError("owned command process group cleanup failed")


def _cleanup_owned_container(name: str, owner: str, created_id: str | None) -> None:
    candidate = created_id or name
    # Inspect only immutable identity and invocation marker; never read env/password.
    template = '{"id":{{json .Id}},"owner":{{json (index .Config.Labels "poller.lifecycle-test.owner")}}}'
    try:
        metadata = json.loads(_docker(["inspect", "--type", "container", "--format", template, candidate]))
    except (subprocess.SubprocessError, OSError):
        if created_id is None:
            # Failed/ambiguous creation with no verifiable object: never remove
            # an arbitrary name. Provisioning has already failed the lane.
            return
        remains = _docker(["ps", "--all", "--quiet", "--filter", f"id={created_id}"])
        if remains:
            raise RuntimeError("owned lifecycle container identity could not be verified") from None
        return
    cid = metadata.get("id", "")
    if metadata.get("owner") != owner:
        if created_id is not None:
            raise RuntimeError("owned lifecycle container marker mismatch")
        return  # An unowned conflicting name is never a cleanup target.
    if len(cid) != 64 or any(c not in "0123456789abcdef" for c in cid) or (created_id and cid != created_id):
        raise RuntimeError("invalid owned lifecycle container identity")
    try:
        _docker(["rm", "--force", "--volumes", cid])
    except (subprocess.SubprocessError, OSError):
        if _docker(["ps", "--all", "--quiet", "--filter", f"id={cid}"]):
            raise RuntimeError("owned lifecycle container cleanup failed") from None


def run_existing_database(command: list[str], dsn: str) -> int:
    """Required CI entry for its already-owned local PostgreSQL service.

The caller must provide TEST_DATABASE_URL explicitly; DATABASE_URL is ignored.
This entry never creates, drops, stops or cleans up a service/container.
"""
    if not command:
        raise ValueError("a test command is required")
    env = child_environment(dsn)
    with _termination_handlers():
        try:
            process = subprocess.Popen(command, env=env, start_new_session=True)
        except OSError:
            print("Lifecycle test command failed to start", file=sys.stderr)
            return 2
        try:
            result = process.wait(timeout=COMMAND_TIMEOUT_SECONDS)
            if _group_has_live_processes(process.pid):
                _stop_command_group(process)
            return result
        except subprocess.TimeoutExpired:
            _stop_command_group(process)
            print("Lifecycle test command timed out", file=sys.stderr)
            return 124
        except BaseException as error:
            # An outer deadline already sent SIGTERM. Shorten the nested child's
            # grace to reserve the outer grace window for our container finally.
            _stop_command_group(process, grace_seconds=1 if isinstance(error, _HarnessTermination) else None)
            raise


def isolated_database(command: list[str], postgres_major: int = 17) -> int:
    """Provision a new owned container, run a bounded child, and clean only it."""
    if postgres_major not in {16, 17}:
        raise ValueError("postgres-major must be 17 or 16")
    if not command:
        raise ValueError("a test command is required")
    with _termination_handlers():
        return _isolated_database(command, postgres_major)


def _isolated_database(command: list[str], postgres_major: int) -> int:
    name = "poller-lifecycle-test-" + secrets.token_hex(12)
    owner = secrets.token_urlsafe(24)  # Invocation identity is independent of name collision.
    password = secrets.token_urlsafe(32)
    created_id = None
    try:
        created_id = _docker([
            "run", "--detach", "--name", name, "--label", "poller.lifecycle-test=owned",
            "--label", "poller.lifecycle-test.owner=" + owner,
            "--publish", "127.0.0.1::5432",
            "--env", "POSTGRES_PASSWORD=" + password,
            "--env", "POSTGRES_DB=poller_lifecycle_test", f"postgres:{postgres_major}",
        ], timeout=180)
        address = _docker(["port", created_id, "5432/tcp"])
        host, separator, port = address.partition(":")
        if host != "127.0.0.1" or not separator or not port.isdigit():
            raise RuntimeError("Docker did not publish an isolated loopback port")
        dsn = f"postgresql://postgres:{password}@127.0.0.1:{port}/poller_lifecycle_test"
        env = child_environment(dsn)
        deadline = time.monotonic() + READINESS_TIMEOUT_SECONDS
        while True:
            try:
                # The driver probe needs the same clean environment as the tests;
                # libpq otherwise reads ambient PGHOSTADDR/PGSERVICE defaults.
                probe = subprocess.run([
                    sys.executable, "-c",
                    "import os,psycopg; "
                    "c=psycopg.connect(os.environ['TEST_DATABASE_URL'],connect_timeout=1); "
                    "print(c.execute('SHOW server_version').fetchone()[0]); c.close()",
                ], env=env, capture_output=True, text=True, timeout=5, check=True)
                version = probe.stdout.strip()
                if version.split('.', 1)[0] != str(postgres_major):
                    raise RuntimeError("unexpected PostgreSQL server major")
                print(f"Owned lifecycle database: PostgreSQL {version} (required {postgres_major})", flush=True)
                break
            except subprocess.SubprocessError:
                if time.monotonic() >= deadline:
                    raise RuntimeError("owned PostgreSQL readiness timed out") from None
                threading.Event().wait(0.2)
        return run_existing_database(command, dsn)
    except (subprocess.SubprocessError, OSError, RuntimeError, ValueError):
        # Never print CalledProcessError: its argv contains the generated password.
        print("Lifecycle test database launch failed", file=sys.stderr)
        return 2
    finally:
        with _defer_termination():
            _cleanup_owned_container(name, owner, created_id)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--postgres-major", type=int, choices=(17, 16), default=17)
    parser.add_argument("--existing-service", action="store_true", help="reuse CI's explicit local TEST_DATABASE_URL")
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command:
        parser.error("provide a command after --")
    try:
        if args.existing_service:
            try:
                return run_existing_database(command, os.environ.get("TEST_DATABASE_URL", ""))
            except ValueError as error:
                parser.error(str(error))
        return isolated_database(command, args.postgres_major)
    except _HarnessTermination as interrupted:
        return 128 + interrupted.signum


if __name__ == "__main__":
    raise SystemExit(main())
