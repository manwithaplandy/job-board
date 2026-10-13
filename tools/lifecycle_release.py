"""Read-only preflight for the initial lifecycle identity release.

Run as ``python -m tools.lifecycle_release`` from the repository root. Output
contains operational counts and controls only, never connection credentials.
"""

import json
import os
import re

from job_discovery.db import connect
from job_discovery.lifecycle.config import read_control


def probe():
    revision = os.environ.get('RAILWAY_GIT_COMMIT_SHA', '')
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise RuntimeError('Railway deployment revision is missing')
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


if __name__ == '__main__':
    print(json.dumps(probe(), sort_keys=True), flush=True)
