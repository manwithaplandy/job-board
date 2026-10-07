"""Local test resource measurement; reads only the harness-owned PostgreSQL."""
import json
import os
from pathlib import Path
import resource
import subprocess
import sys
import time

import psycopg


def tree_rss(root):
    rows = {}
    for path in Path('/proc').iterdir():
        if not path.name.isdigit():
            continue
        try:
            stat = (path / 'stat').read_text().rsplit(')', 1)[1].split()
            rows[int(path.name)] = (int(stat[1]), int(stat[21]) * os.sysconf('SC_PAGE_SIZE'))
        except (OSError, ValueError, IndexError):
            continue
    owned = {root}
    while True:
        expanded = owned | {pid for pid, (parent, _) in rows.items() if parent in owned}
        if expanded == owned:
            break
        owned = expanded
    return sum(rss for pid, (_, rss) in rows.items() if pid in owned)


with psycopg.connect(os.environ['TEST_DATABASE_URL'], autocommit=True) as monitor:
    print('RESOURCE server:', monitor.execute('SHOW server_version').fetchone()[0], flush=True)
    print('RESOURCE Python:', sys.version.split()[0], flush=True)
    baseline = monitor.execute("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid()").fetchone()[0]
    started = time.monotonic()
    child = subprocess.Popen([sys.executable, '-m', 'pytest', *sys.argv[1:]])
    peak_rss = peak_connections = samples = 0
    try:
        while child.poll() is None:
            peak_rss = max(peak_rss, tree_rss(child.pid))
            count = monitor.execute("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid()").fetchone()[0]
            peak_connections = max(peak_connections, count)
            samples += 1
            time.sleep(0.05)
        code = child.wait(timeout=1)
    finally:
        if child.poll() is None:
            child.kill()
            child.wait(timeout=5)
    usage = resource.getrusage(resource.RUSAGE_CHILDREN)
    remaining = monitor.execute("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid()").fetchone()[0]
    print('RESOURCE ' + json.dumps({
        'wall_seconds': round(time.monotonic() - started, 3),
        'child_user_cpu_seconds': round(usage.ru_utime, 3),
        'child_system_cpu_seconds': round(usage.ru_stime, 3),
        'waited_child_max_rss_kib': usage.ru_maxrss,
        'sampled_peak_test_process_tree_rss_bytes': peak_rss,
        'sampled_peak_test_database_connections': peak_connections,
        'database_connections_before': baseline,
        'database_connections_after': remaining,
        'monitor_extra_connections': 1, 'samples': samples,
        'sampling_interval_seconds': 0.05,
        'scope': 'test client processes; excludes DB server CPU/memory and harness/container overhead',
    }), flush=True)
    sys.exit(code)
