"""Read-only catalog evidence after bootstrapping a fresh owned harness DB."""
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path.cwd()))
import psycopg
from psycopg.rows import dict_row
from tools.lifecycle_test_db import validate_test_connection, validate_test_dsn

url = os.environ['TEST_DATABASE_URL']
validate_test_dsn(url)
with psycopg.connect(url, row_factory=dict_row) as conn:
    validate_test_connection(conn)
    conn.execute(Path('schema.sql').read_text())
    queries = {
        'foreign_keys': "SELECT conrelid::regclass::text child,confrelid::regclass::text parent,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE contype='f' ORDER BY 1,2,3",
        'table_grants': "SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated','PUBLIC') ORDER BY 1,2,3",
        'column_grants': "SELECT table_name,column_name,grantee,privilege_type FROM information_schema.column_privileges WHERE table_schema='public' AND table_name IN ('job_payload_demands','lifecycle_control','lifecycle_write_checks','lifecycle_claims','capacity_reservations') AND grantee IN ('anon','authenticated','PUBLIC') ORDER BY 1,2,3,4",
        'gates': "SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid,true) definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE t.tgname='lifecycle_pre_dml' ORDER BY 1,2",
        'private_functions': "SELECT p.oid::regprocedure::text name,p.prosecdef,p.proconfig,p.proacl::text,pg_get_userbyid(p.proowner) owner,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='lifecycle_private' ORDER BY 1",
        'control': 'SELECT * FROM lifecycle_control',
    }
    for label, sql in queries.items():
        print(label, json.dumps(conn.execute(sql).fetchall(), indent=2, default=str))
