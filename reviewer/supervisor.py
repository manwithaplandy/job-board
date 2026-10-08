"""Independent reviewer and bounded, scheduled maintenance child processes.

No database connections or network writes live here.
The maintenance child owns its existing database lease and transactions.
"""

import logging
import signal
import subprocess
import sys
import threading
import time
from dataclasses import dataclass
from typing import Callable

log = logging.getLogger(__name__)
CHECK_SECONDS = 5
MAINTENANCE_INTERVAL_SECONDS = 15 * 60
MAINTENANCE_DEADLINE_SECONDS = 90
DRAIN_SECONDS = 30
ARCHIVE_INTERVAL_SECONDS = 60
ARCHIVE_DEADLINE_SECONDS = 120
SOURCE_INTERVAL_SECONDS = 60
SOURCE_DEADLINE_SECONDS = 330


@dataclass
class Child:
    process: subprocess.Popen
    started: float
    killed: bool = False


def spawn_child(name: str) -> subprocess.Popen:
    modules = {
        "reviewer": "reviewer.worker",
        "maintenance": "job_discovery.lifecycle.worker",
        "archive": "reviewer.archive_worker",
        "source": "job_discovery.lifecycle.source_worker",
    }
    # Inherit stdout/stderr: no pipe can fill and stall a child or the supervisor.
    return subprocess.Popen([sys.executable, "-m", modules[name]])


def _signal(child: Child, *, kill: bool = False) -> None:
    try:
        if kill:
            child.process.kill()
            child.killed = True
        else:
            child.process.terminate()
    except ProcessLookupError:
        pass


def _drain(children: dict[str, Child], clock: Callable) -> bool:
    # One global deadline, independent of child count. Never an unbounded wait.
    deadline = clock() + DRAIN_SECONDS
    for child in children.values():
        if child.process.poll() is None:
            _signal(child)
    while (
        any(c.process.poll() is None for c in children.values()) and clock() < deadline
    ):
        wake = min(deadline, clock() + CHECK_SECONDS)
        for name, seconds in [
            ("maintenance", MAINTENANCE_DEADLINE_SECONDS),
            ("archive", ARCHIVE_DEADLINE_SECONDS),
            ("source", SOURCE_DEADLINE_SECONDS),
        ]:
            child = children.get(name)
            if child is not None and child.process.poll() is None and not child.killed:
                expires = child.started + seconds
                if clock() >= expires:
                    _signal(child, kill=True)
                else:
                    wake = min(wake, expires)
        time.sleep(max(0, wake - clock()))
    for child in children.values():
        if child.process.poll() is None:
            _signal(child, kill=True)
    # Signals are sent by the 30-second deadline. Allow one further shared
    # second only to reap kernel exits, never to continue cooperative work.
    reap_deadline = clock() + 1
    reaped = True
    for child in children.values():
        try:
            child.process.wait(timeout=max(0, reap_deadline - clock()))
        except subprocess.TimeoutExpired:
            log.error("child did not exit after kill")
            reaped = False
    return reaped


def supervise(stop: threading.Event, spawn: Callable, clock: Callable) -> int:
    children: dict[str, Child] = {}
    next_maintenance = clock()
    next_archive = clock()
    next_source = clock()
    failed = False
    try:
        while not stop.is_set():
            now = clock()
            for name, child in list(children.items()):
                code = child.process.poll()
                if code is not None:
                    log.info("%s child exited status=%s", name, code)
                    del children[name]
                elif (
                    name in {"maintenance", "archive", "source"}
                    and not child.killed
                    and now
                    >= child.started
                    + (
                        MAINTENANCE_DEADLINE_SECONDS
                        if name == "maintenance"
                        else ARCHIVE_DEADLINE_SECONDS
                        if name == "archive"
                        else SOURCE_DEADLINE_SECONDS
                    )
                ):
                    log.warning("%s process deadline reached", name)
                    # At 90 seconds no further cooperative grace is permitted.
                    # The next claim acquisition uses the existing DB-time fence.
                    _signal(child, kill=True)
            if stop.is_set():
                break
            if "reviewer" not in children:
                children["reviewer"] = Child(spawn("reviewer"), clock())
            if stop.is_set():
                break
            if now >= next_maintenance and "maintenance" not in children:
                started = clock()
                children["maintenance"] = Child(spawn("maintenance"), started)
                # Skip missed ticks rather than burst-replaying them after delay.
                next_maintenance = started + MAINTENANCE_INTERVAL_SECONDS
            if not stop.is_set() and now >= next_archive and "archive" not in children:
                started = clock()
                children["archive"] = Child(spawn("archive"), started)
                next_archive = started + ARCHIVE_INTERVAL_SECONDS
            if not stop.is_set() and now >= next_source and "source" not in children:
                started = clock()
                children["source"] = Child(spawn("source"), started)
                next_source = started + SOURCE_INTERVAL_SECONDS
            wake = clock() + CHECK_SECONDS
            child = children.get("maintenance")
            if child is not None and not child.killed:
                wake = min(wake, child.started + MAINTENANCE_DEADLINE_SECONDS)
            archive = children.get("archive")
            if archive is not None and not archive.killed:
                wake = min(wake, archive.started + ARCHIVE_DEADLINE_SECONDS)
            source = children.get("source")
            if source is not None and not source.killed:
                wake = min(wake, source.started + SOURCE_DEADLINE_SECONDS)
            if next_source > clock():
                wake = min(wake, next_source)
            if next_archive > clock():
                wake = min(wake, next_archive)
            if next_maintenance > clock():
                wake = min(wake, next_maintenance)
            stop.wait(max(0.001, wake - clock()))
    except Exception:
        log.exception("supervisor failed; draining children before service restart")
        failed = True
    finally:
        if not _drain(children, clock):
            failed = True
    return int(failed)


def main() -> int:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
    )
    stop = threading.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stop.set())
    return supervise(stop, spawn_child, time.monotonic)


if __name__ == "__main__":
    sys.exit(main())
