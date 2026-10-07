import os, sys, json
from pathlib import Path
sys.path.insert(0, str(Path.cwd()))
import psycopg
from psycopg.rows import dict_row
from tests.test_lifecycle_safety import seed, version, enforced, A

with psycopg.connect(os.environ['TEST_DATABASE_URL'], row_factory=dict_row) as c:
    c.execute(Path('schema.sql').read_text())
    c.commit()
    seed(c)
    vid=version(c)
    c.execute("INSERT INTO application_packages(user_id,job_id,job_version_id) VALUES (%s,'lever:x:0',%s)",(A,vid))
    c.commit()
    enforced(c)
    c.execute('SET LOCAL ROLE authenticated')
    c.execute("SELECT set_config('request.jwt.claims',%s,true)",(json.dumps({'sub':A,'role':'authenticated'}),))
    c.execute("UPDATE application_packages SET resume_json=repeat('9',100000)::jsonb WHERE user_id=%s",(A,))
    c.commit()
    print('unreserved_numeric_payload',c.execute('SELECT jsonb_typeof(resume_json) AS kind,length(resume_json::text) AS digits FROM application_packages').fetchone())
    print('receipt_charge',c.execute('SELECT sum(bytes) AS bytes,count(*) AS count FROM lifecycle_write_checks').fetchone())
    print('reservations',c.execute('SELECT count(*) AS count FROM capacity_reservations').fetchone()['count'])
