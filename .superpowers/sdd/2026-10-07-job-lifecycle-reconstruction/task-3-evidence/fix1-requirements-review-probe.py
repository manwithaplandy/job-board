import json
import os
from pathlib import Path
import sys
from unittest.mock import patch

sys.path.insert(0, str(Path.cwd()))
import psycopg
from psycopg.rows import dict_row
from company_discovery import worker, enrich_apply
from company_discovery.dataset import Candidate
from tools.lifecycle_test_db import validate_test_connection, validate_test_dsn

dsn = os.environ['TEST_DATABASE_URL']
validate_test_dsn(dsn)
with psycopg.connect(dsn, row_factory=dict_row) as conn:
    validate_test_connection(conn)
    conn.execute(Path('schema.sql').read_text())
    conn.commit()
    calls = []
    original_apply = enrich_apply.apply_enrichment
    def fetch(ats, token):
        assert conn.info.transaction_status.name == 'IDLE'
        calls.append(token)
        return enrich_apply.EnrichUpdate(token, 'synthetic public about', 'ats_board')
    def failed_write(c, company_id, result):
        original_apply(c, company_id, result)
        raise RuntimeError('synthetic transient database persistence failure')
    with patch.object(worker.dataset, 'load_candidates', return_value=[Candidate('Probe', 'lever', 'retry-probe')]), \
         patch.object(enrich_apply, 'plan_enrichment', side_effect=fetch):
        with patch.object(enrich_apply, 'apply_enrichment', side_effect=failed_write):
            try:
                worker._maybe_ingest(conn)
            except RuntimeError:
                conn.rollback()
        first = conn.execute('SELECT status,finished_at,ingested FROM discovery_runs').fetchall()
        pending = conn.execute('SELECT count(*) AS n FROM companies WHERE enriched_at IS NULL').fetchone()['n']
        conn.commit()
        before = len(calls)
        worker._maybe_ingest(conn)
        after = len(calls)
        state = conn.execute('SELECT status,finished_at,ingested FROM discovery_runs').fetchall()
        still_pending = conn.execute('SELECT count(*) AS n FROM companies WHERE enriched_at IS NULL').fetchone()['n']
        print(json.dumps({'after_transient_failure': first, 'pending_after_failure': pending, 'fetches_on_retry': after-before, 'after_retry': state, 'pending_after_retry': still_pending}, default=str))
