"""Preflight and explicit first-turn mapping for the lifecycle identity release.

Run as ``python -m tools.lifecycle_release`` from the repository root. Output
contains operational counts and controls only, never connection credentials.
The default operation is read-only; --first-backfill is a production-only,
first-run operation that cannot resume partially committed work.
"""

import json
import os
import re
import argparse
from dataclasses import replace
from time import monotonic

from job_discovery.db import connect
from job_discovery.lifecycle.config import read_control, transition_control
from job_discovery.lifecycle.claims import claim_work, cancel_claim
from job_discovery.lifecycle.identity import migrate_identity_batch
from job_discovery.lifecycle.locks import enter_gate

REVIEWER_SERVICE = '258ed329-47b9-47b6-ab70-a0347e6db1d7'
PRODUCTION_ENVIRONMENT = '374211c1-6c80-4a9c-9038-520883ccfae2'


def _revision():
    revision = os.environ.get('RAILWAY_GIT_COMMIT_SHA', '')
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise RuntimeError('Railway deployment revision is missing')
    return revision


def probe():
    revision = _revision()
    with connect() as conn:
        conn.execute('SET TRANSACTION READ ONLY')
        conn.execute("SET LOCAL statement_timeout = '5s'")
        control = read_control(conn)
        counts = conn.execute('''
            SELECT (SELECT count(*) FROM source_accounts) AS source_accounts,
                   (SELECT count(*) FROM source_listings) AS source_listings,
                   pg_database_size(current_database()) AS allocated_bytes
        ''').fetchone()
        return {
            'marker': 'lifecycle-release-readonly-v1',
            'revision': revision,
            'transaction_read_only': conn.execute('SHOW transaction_read_only').fetchone()['transaction_read_only'],
            'safety_stage': control.safety_stage,
            'activation_generation': control.activation_generation,
            **counts,
        }


def _other_stages_off(control):
    return not any((
        control.source_enabled, control.maintenance_enabled,
        control.hydration_enabled, control.feed_enabled, control.retirement_enabled,
        control.archive_ever_activated, control.export_enabled,
    )) and control.retirement_dry_run and control.archive_stage == 'never_activated'


def _headroom(conn):
    usage = conn.execute('SELECT pg_database_size(current_database()) AS bytes').fetchone()['bytes']
    if usage >= 5800 * 1024**2:
        raise RuntimeError('mapping headroom exhausted; stop without deletion')


def first_backfill():
    """One initial turn only: <=20 batches of <=100, each committed separately.

    No batch starts after 240 seconds. Railway caps the entire predeploy at 300.
    Partial progress is retained; every later invocation refuses to resume it.
    """
    revision = _revision()
    if (os.environ.get('RAILWAY_SERVICE_ID') != REVIEWER_SERVICE
            or os.environ.get('RAILWAY_ENVIRONMENT_ID') != PRODUCTION_ENVIRONMENT
            or os.environ.get('RAILWAY_GIT_BRANCH') != 'main'):
        raise RuntimeError('expected production reviewer main deployment')
    started = monotonic()
    mapped = batches = 0
    complete = False
    with connect() as conn:
        enter_gate(conn)
        control = read_control(conn)
        populated = conn.execute('SELECT EXISTS(SELECT FROM source_listings) OR EXISTS(SELECT FROM source_accounts) AS started').fetchone()['started']
        if (populated or control.identity_migration_activated_at is not None
                or control.safety_stage != 'legacy' or control.activation_generation != 0
                or control.identity_enabled or not _other_stages_off(control)):
            raise RuntimeError('first-run mapping requires pristine legacy state; inspect before any resume')
        _headroom(conn)
        claim = claim_work(conn, 'control', 'singleton', 120)
        if claim is None:
            raise RuntimeError('control claim unavailable')
        transition_control(conn, 0, replace(control, safety_stage='collect', identity_enabled=True), claim)
        conn.commit()
        cancel_claim(conn, claim)
        conn.commit()
        print(f'lifecycle first-run started revision={revision} generation=1', flush=True)
        for _ in range(20):
            if monotonic() - started >= 240:
                break
            enter_gate(conn)
            control = read_control(conn)
            if not (control.safety_stage == 'collect' and control.activation_generation == 1
                    and control.identity_enabled and _other_stages_off(control)):
                raise RuntimeError('controls changed during first-run mapping')
            _headroom(conn)
            if monotonic() - started >= 240:
                conn.rollback()
                break
            count = migrate_identity_batch(conn, limit=100)
            conn.commit()
            batches += 1
            mapped += count
            print(f'lifecycle first-run committed batch={batches} rows={count} total={mapped} elapsed={monotonic()-started:.1f}s', flush=True)
            if count == 0:
                complete = True
                break
    return {'marker': 'lifecycle-first-backfill-v1', 'revision': revision,
            'mapped': mapped, 'batches': batches, 'corpus_complete': complete}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--first-backfill', action='store_true')
    args = parser.parse_args()
    print(json.dumps(first_backfill() if args.first_backfill else probe(), sort_keys=True), flush=True)
