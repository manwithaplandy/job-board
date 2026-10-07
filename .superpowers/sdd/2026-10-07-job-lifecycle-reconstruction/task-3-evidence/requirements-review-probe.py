import importlib
import json
import os
from pathlib import Path
import sys
from threading import Event
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path.cwd()))
import psycopg
from psycopg.rows import dict_row
from tools.lifecycle_test_db import validate_test_connection, validate_test_dsn
from job_discovery.models import Posting
from company_discovery import enrich_apply

dsn = os.environ['TEST_DATABASE_URL']
validate_test_dsn(dsn)
conn = psycopg.connect(dsn, row_factory=dict_row)
validate_test_connection(conn)
conn.execute(Path('schema.sql').read_text())
conn.commit()
run = importlib.import_module('job_discovery.run')
calls = []

def question(url):
    calls.append(url)
    return {'questions': [{'label': 'new remote question', 'required': False,
                           'fields': [{'name': 'q', 'type': 'input_text'}]}]}

with patch.object(run, 'load_targets', return_value=[{'name':'Probe','ats':'greenhouse','token':'probe'}]), \
     patch.dict(run.ADAPTERS, greenhouse=lambda _: [Posting('1','Engineer','u'), Posting('2','Engineer','u')]), \
     patch.object(run, '_get_json', side_effect=question), \
     patch('job_discovery.locations.resolve_new_locations'), patch('reviewer.run.review_all'):
    first = run.run(dsn)
    calls.clear()
    second = run.run(dsn)
    print('cached_poll', json.dumps({'first': first, 'second': second, 'http_calls': calls}))

conn.execute("UPDATE job_questions SET questions='{}'::jsonb")
conn.commit()
calls.clear()
with patch.object(run, 'load_targets', return_value=[{'name':'Probe','ats':'greenhouse','token':'probe'}]), \
     patch.dict(run.ADAPTERS, greenhouse=lambda _: [Posting('1','Engineer','u'), Posting('2','Engineer','u')]), \
     patch.object(run, '_get_json', side_effect=question), \
     patch('job_discovery.locations.resolve_new_locations'), patch('reviewer.run.review_all'):
    third = run.run(dsn)
    replaced = conn.execute("SELECT questions<>'{}'::jsonb AS replaced FROM job_questions ORDER BY job_id").fetchall()
    conn.commit()
    print('cached_payload_replaced', json.dumps({'result': third, 'rows': replaced, 'http_calls': len(calls)}))

ticks = iter([0, 0, 0, 0, 0, 121])
calls.clear()
with patch.object(run, 'load_targets', return_value=[{'name':'Probe','ats':'greenhouse','token':'probe'}]), \
     patch.dict(run.ADAPTERS, greenhouse=lambda _: [Posting('1','Engineer','u'), Posting('2','Engineer','u')]), \
     patch.object(run, '_get_json', side_effect=question), \
     patch('job_discovery.locations.resolve_new_locations'), patch('reviewer.run.review_all'), \
     patch('job_discovery.lifecycle.legacy_spool.time', SimpleNamespace(monotonic=lambda: next(ticks, 121))):
    failed = run.run(dsn)
    streak = conn.execute("SELECT poll_failures FROM companies WHERE token='probe'").fetchone()['poll_failures']
    conn.commit()
    print('cached_feed_question_timeout', json.dumps({'result': failed, 'poll_failures': streak, 'http_calls': len(calls)}))

# Demonstrate the omitted company-discovery path with deterministic local doubles.
# Second network callback starts only after the first result was written.
rows = conn.execute("INSERT INTO companies(name,ats,token) VALUES ('C1','lever','c1'),('C2','lever','c2') RETURNING id,ats,token,enriched_at").fetchall()
conn.commit()
wrote = Event()
observed = []
original_apply = enrich_apply.apply_enrichment

def apply(c, company_id, plan):
    original_apply(c, company_id, plan)
    wrote.set()

def fetch(ats, token):
    if token == 'c2':
        assert wrote.wait(5), 'first write missing'
        with psycopg.connect(dsn, row_factory=dict_row) as observer:
            free = observer.execute('SELECT pg_try_advisory_xact_lock(20916294442894917) AS free').fetchone()['free']
        observed.append({'during_http': 'second_company_fetch', 'transaction': conn.info.transaction_status.name, 'global_gate_available_to_other_backend': free})
    return enrich_apply.EnrichUpdate(token, 'public about', 'ats_board')

with patch.object(enrich_apply, 'plan_enrichment', side_effect=fetch), patch.object(enrich_apply, 'apply_enrichment', side_effect=apply):
    count = enrich_apply.enrich_selected(conn, rows, max_workers=1)
conn.rollback()
print('company_network_gate', json.dumps({'count': count, 'observed': observed}))
conn.close()
