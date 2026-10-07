"""Ordinary process/worker tests; no excluded lifecycle security probes."""
import importlib
import json
from pathlib import Path
import subprocess
import sys
import threading
import time

import pytest

from tests.conftest import TEST_DSN, requires_db


def supervisor():
    return importlib.import_module('reviewer.supervisor')


def maintenance_worker():
    return importlib.import_module('job_discovery.lifecycle.worker')


class Clock:
    now = 0.0

    def __call__(self):
        return self.now


class Stop:
    def __init__(self, clock, at):
        self.clock, self.at = clock, at
        self.waits = []

    def is_set(self):
        return self.clock.now >= self.at

    def wait(self, delay):
        assert 0 < delay <= 5
        self.waits.append(delay)
        self.clock.now += delay
        return self.is_set()


class Child:
    def __init__(self, clock, duration=None, code=0, ignores_term=False):
        self.clock = clock
        self.started = clock()
        self.duration, self.code = duration, code
        self.returncode = None
        self.ignores_term = ignores_term
        self.terminated = self.killed = None

    def poll(self):
        if self.returncode is None and self.duration is not None and self.clock() >= self.started + self.duration:
            self.returncode = self.code
        return self.returncode

    def terminate(self):
        self.terminated = self.clock()
        if not self.ignores_term:
            self.returncode = -15

    def kill(self):
        self.killed = self.clock()
        self.returncode = -9

    def wait(self, timeout=None):
        assert timeout is not None and timeout <= 1, 'no unbounded child join'
        assert self.poll() is not None
        return self.returncode


def test_stalled_reviewer_does_not_block_startup_or_quarter_hour_sweeps():
    s = supervisor()
    clock = Clock()
    stop = Stop(clock, 1805)
    children = []

    def spawn(name):
        child = Child(clock, duration=1 if name == 'maintenance' else None)
        children.append((name, child))
        return child

    assert s.supervise(stop, spawn, clock) == 0
    assert [c.started for name, c in children if name == 'maintenance'] == [0, 900, 1800]
    assert len([1 for name, _ in children if name == 'reviewer']) == 1
    assert max(stop.waits) <= 5


def test_maintenance_deadline_and_crash_wait_for_next_tick_reviewer_restarts(monkeypatch):
    s = supervisor()
    clock = Clock()
    monkeypatch.setattr(s.time, 'sleep', lambda delay: setattr(clock, 'now', clock.now + delay))
    stop = Stop(clock, 1810)
    children = []

    def spawn(name):
        prior = sum(n == name for n, _ in children)
        child = Child(clock, duration=1 if prior == 0 and name == 'reviewer' else None,
                      code=1, ignores_term=True)
        if name == 'maintenance' and prior == 1:
            child.duration = 1  # crash second maintenance attempt
        children.append((name, child))
        return child

    assert s.supervise(stop, spawn, clock) == 0
    maint = [c for n, c in children if n == 'maintenance']
    assert [c.started for c in maint] == [0, 900, 1800]
    assert maint[0].killed == 90
    assert [c.started for n, c in children if n == 'reviewer'] == [0, 5]
    assert clock() <= 1840


def test_shutdown_has_one_global_30_second_drain_and_no_new_children(monkeypatch):
    s = supervisor()
    clock = Clock()
    monkeypatch.setattr(s.time, 'sleep', lambda delay: setattr(clock, 'now', clock.now + delay))
    children = []

    def spawn(name):
        child = Child(clock, ignores_term=True)
        children.append(child)
        return child

    assert s.supervise(Stop(clock, 10), spawn, clock) == 0
    assert len(children) == 2
    assert [c.terminated for c in children] == [10, 10]
    assert [c.killed for c in children] == [40, 40]
    assert clock() == 40


def test_spawn_failure_returns_nonzero_and_drains_started_sibling(monkeypatch):
    s = supervisor()
    clock = Clock()
    monkeypatch.setattr(s.time, 'sleep', lambda delay: setattr(clock, 'now', clock.now + delay))
    reviewer = Child(clock, ignores_term=True)

    def spawn(name):
        if name == 'maintenance':
            raise OSError('cannot spawn')
        return reviewer

    assert s.supervise(Stop(clock, 9999), spawn, clock) == 1
    assert reviewer.killed == 30


def test_already_stopped_starts_nothing():
    s = supervisor()
    assert s.supervise(Stop(Clock(), 0), lambda name: pytest.fail(name), Clock()) == 0


def test_deployment_only_changes_reviewer_command():
    cfg = json.loads(Path('railway.reviewer-worker.json').read_text())['deploy']
    assert cfg == {'startCommand': 'python -m reviewer.supervisor',
                   'restartPolicyType': 'ON_FAILURE', 'restartPolicyMaxRetries': 100}
    assert json.loads(Path('railway.json').read_text())['deploy'] == {'startCommand': 'python -m job_discovery'}
    # Cron is configured outside railway.json; the command remains one-shot.
    assert 'supervisor' not in Path('job_discovery/__main__.py').read_text()


def test_real_children_deadline_and_terminated_external_cron(monkeypatch):
    s = supervisor()
    monkeypatch.setattr(s, 'CHECK_SECONDS', 0.02)
    monkeypatch.setattr(s, 'MAINTENANCE_INTERVAL_SECONDS', 0.30)
    monkeypatch.setattr(s, 'MAINTENANCE_DEADLINE_SECONDS', 0.12)
    monkeypatch.setattr(s, 'DRAIN_SECONDS', 0.08)
    stop = threading.Event()
    children = []
    cron = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])
    timer = threading.Timer(0.75, stop.set)

    def spawn(name):
        p = subprocess.Popen([sys.executable, '-c',
            'import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(60)'])
        children.append((name, p))
        return p

    began = time.monotonic()
    try:
        cron.terminate()
        cron.wait(timeout=2)
        timer.start()
        assert s.supervise(stop, spawn, time.monotonic) == 0
        assert time.monotonic() - began < 3
        assert sum(n == 'maintenance' for n, _ in children) >= 2
        assert all(p.poll() is not None for _, p in children)
    finally:
        timer.cancel()
        for p in [cron, *(p for _, p in children)]:
            if p.poll() is None:
                p.kill()
            p.wait(timeout=2)


@requires_db
def test_worker_flag_off_closes_owned_connection(conn, monkeypatch):
    w = maintenance_worker()
    from job_discovery import db
    opened = []
    original = db.connect

    def connect(dsn):
        fresh = original(dsn)
        opened.append(fresh)
        return fresh

    monkeypatch.setattr(w.db, 'connect', connect)
    assert not w.run_maintenance_once(TEST_DSN).blocked
    assert len(opened) == 1 and opened[0].closed
    assert conn.execute("SELECT count(*) AS n FROM lifecycle_claims WHERE kind='maintenance'").fetchone()['n'] == 0


@requires_db
def test_worker_scheduled_sweep_and_normal_restart_generations(conn):
    w = maintenance_worker()
    conn.execute('UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1')
    conn.commit()
    generations = []
    for _ in range(2):
        assert not w.run_maintenance_once(TEST_DSN).blocked
        row = conn.execute("SELECT generation,replay_floor,state FROM lifecycle_claims WHERE kind='maintenance'").fetchone()
        assert row['state'] == 'cancelled' and row['replay_floor'] == row['generation'] - 1
        generations.append(row['generation'])
        assert conn.execute('SELECT last_success_at FROM lifecycle_maintenance_state').fetchone()['last_success_at'] is not None
        conn.commit()
    assert generations[1] > generations[0]


@requires_db
def test_worker_contended_claim_is_blocked_then_recovers_after_release(conn):
    w = maintenance_worker()
    from job_discovery.lifecycle.claims import claim_work, cancel_claim
    conn.execute('UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1')
    claim = claim_work(conn, 'maintenance', 'singleton', 120)
    conn.commit()
    assert w.run_maintenance_once(TEST_DSN).blocked
    cancel_claim(conn, claim)
    conn.commit()
    assert not w.run_maintenance_once(TEST_DSN).blocked


@requires_db
def test_worker_failure_rolls_back_cancels_claim_and_next_worker_runs(conn, monkeypatch):
    w = maintenance_worker()
    conn.execute('UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1')
    conn.commit()
    original = w.sweep

    def fail(connection, claim, **kwargs):
        assert kwargs['scheduled'] is True
        connection.execute('UPDATE lifecycle_maintenance_state SET eligible_rows=999')
        raise RuntimeError('ordinary worker failure')

    monkeypatch.setattr(w, 'sweep', fail)
    assert w.run_maintenance_once(TEST_DSN).blocked
    assert conn.execute('SELECT eligible_rows FROM lifecycle_maintenance_state').fetchone()['eligible_rows'] == 0
    assert conn.execute("SELECT state FROM lifecycle_claims WHERE kind='maintenance'").fetchone()['state'] == 'cancelled'
    conn.commit()
    monkeypatch.setattr(w, 'sweep', original)
    assert not w.run_maintenance_once(TEST_DSN).blocked


def test_approved_timing_constants():
    s = supervisor()
    from job_discovery.lifecycle import maintenance as m
    assert (s.CHECK_SECONDS, s.MAINTENANCE_INTERVAL_SECONDS, s.MAINTENANCE_DEADLINE_SECONDS, s.DRAIN_SECONDS) == (5, 900, 90, 30)
    assert (m.LEASE_SECONDS, m.RENEW_SECONDS, m.DEADLINE_SECONDS) == (120, 30, 90)


def test_reviewer_drain_returns_when_review_is_stalled(monkeypatch):
    from reviewer import worker
    stop = worker._Stop()
    release = threading.Event()
    thread = threading.Thread(target=release.wait, daemon=True)
    thread.start()
    clock = Clock()
    monkeypatch.setattr(worker.time, 'monotonic', clock)
    monkeypatch.setattr(worker, 'DRAIN_SECONDS', 0.01)
    stop.request()
    original_join = thread.join

    def join(timeout=None):
        assert timeout is not None and timeout <= 1
        clock.now += timeout

    monkeypatch.setattr(thread, 'join', join)
    try:
        assert worker._drain_threads([thread], stop, threading.Event()) is False
        assert clock.now <= 1.01
    finally:
        release.set()
        original_join(timeout=2)


@pytest.mark.parametrize('parallelism', [1, 3])
def test_real_reviewer_sigterm_bounds_stalled_request(parallelism, tmp_path):
    marker = tmp_path / 'ready'
    code = '''
import pathlib, sys, time
from reviewer import worker
worker.DRAIN_SECONDS = 0.1
worker.config.REVIEW_WORKER_PARALLELISM = int(sys.argv[2])
worker.config.has_api_key = lambda: True
class Conn:
    def close(self): pass
worker.jdb.connect = Conn
def stalled(conn):
    pathlib.Path(sys.argv[1]).touch()
    time.sleep(60)
worker.process_one = stalled
worker.main()
'''
    process = subprocess.Popen([sys.executable, '-c', code, str(marker), str(parallelism)])
    try:
        deadline = time.monotonic() + 5
        while not marker.exists() and process.poll() is None and time.monotonic() < deadline:
            time.sleep(0.01)
        assert marker.exists()
        process.terminate()
        assert process.wait(timeout=3) == 0
    finally:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=2)


def test_main_signal_stops_children_and_restart_runs_startup_again(tmp_path):
    marker = tmp_path / 'children'
    code = '''
import pathlib, subprocess, sys
from reviewer import supervisor as s
s.CHECK_SECONDS = 0.02
s.DRAIN_SECONDS = 0.1
def spawn(name):
    child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)'])
    with pathlib.Path(sys.argv[1]).open('a') as f:
        f.write(name + ':' + str(child.pid) + '\\n')
    return child
s.spawn_child = spawn
sys.exit(s.main())
'''
    for cycle in (1, 2):
        process = subprocess.Popen([sys.executable, '-c', code, str(marker)])
        try:
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                lines = marker.read_text().splitlines() if marker.exists() else []
                if len(lines) == cycle * 2:
                    break
                time.sleep(0.01)
            assert len(lines) == cycle * 2
            process.terminate()
            assert process.wait(timeout=3) == 0
            assert [line.split(':')[0] for line in lines[-2:]] == ['reviewer', 'maintenance']
            assert all(not Path('/proc', line.split(':')[1]).exists() for line in lines[-2:])
        finally:
            if process.poll() is None:
                process.kill()
            process.wait(timeout=2)


def test_shutdown_does_not_extend_maintenance_90_second_deadline(monkeypatch):
    s = supervisor()
    clock = Clock()
    monkeypatch.setattr(s.time, 'sleep', lambda delay: setattr(clock, 'now', clock.now + delay))
    children = {}

    def spawn(name):
        children[name] = Child(clock, ignores_term=True)
        return children[name]

    assert s.supervise(Stop(clock, 85), spawn, clock) == 0
    assert children['maintenance'].killed == 90
    assert children['reviewer'].killed == 115


@requires_db
def test_real_maintenance_sigterm_releases_connection_and_next_worker_recovers(conn, tmp_path):
    w = maintenance_worker()
    conn.execute('UPDATE lifecycle_control SET maintenance_enabled=true,activation_generation=activation_generation+1')
    conn.commit()
    marker = tmp_path / 'maintenance-claimed'
    code = '''
import pathlib, sys, time
from job_discovery.lifecycle import worker

def paused_sweep(conn, claim, **kwargs):
    pathlib.Path(sys.argv[1]).write_text(str(claim.generation))
    time.sleep(60)
worker.sweep = paused_sweep
sys.exit(worker.main())
'''
    process = subprocess.Popen([sys.executable, '-c', code, str(marker)])
    try:
        deadline = time.monotonic() + 5
        while not marker.exists() and process.poll() is None and time.monotonic() < deadline:
            time.sleep(0.01)
        assert marker.exists()
        generation = int(marker.read_text())
        process.terminate()
        assert process.wait(timeout=3) == 143
        row = conn.execute("SELECT generation,replay_floor,state FROM lifecycle_claims WHERE kind='maintenance'").fetchone()
        assert row == {'generation': generation + 1, 'replay_floor': generation, 'state': 'cancelled'}
        conn.commit()
        assert not w.run_maintenance_once(TEST_DSN).blocked
    finally:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=2)
