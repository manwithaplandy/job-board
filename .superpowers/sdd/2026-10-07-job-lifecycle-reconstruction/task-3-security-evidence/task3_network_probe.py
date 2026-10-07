import os, sys, threading
from pathlib import Path
sys.path.insert(0, str(Path.cwd()))
import psycopg
from psycopg.rows import dict_row
from company_discovery import enrich_apply

with psycopg.connect(os.environ['TEST_DATABASE_URL'], row_factory=dict_row) as c:
    c.execute(Path('schema.sql').read_text())
    rows = c.execute("INSERT INTO companies(name,ats,token) VALUES ('First','lever','first'),('Second','lever','second') RETURNING id,ats,token,enriched_at").fetchall()
    c.commit()
    first_write = threading.Event()
    original = enrich_apply.apply_enrichment
    def apply(conn, company_id, plan):
        original(conn, company_id, plan)
        first_write.set()
    def network(ats, token):
        if token == 'second':
            assert first_write.wait(5)
            with psycopg.connect(os.environ['TEST_DATABASE_URL']) as other:
                available = other.execute('SELECT pg_try_advisory_xact_lock(20916294442894917)').fetchone()[0]
                print('gate_available_during_second_network_callback', available)
                print('writer_transaction_during_network_callback', c.info.transaction_status.name)
        return enrich_apply.EnrichUpdate(token, 'public employer description', 'ats_board')
    enrich_apply.plan_enrichment = network
    enrich_apply.apply_enrichment = apply
    print('enriched_count', enrich_apply.enrich_selected(c, rows, max_workers=1))
    c.commit()
