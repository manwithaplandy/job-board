import os, sys, time
from pathlib import Path
sys.path.insert(0, str(Path.cwd()))
import psycopg
from psycopg.rows import dict_row
from tests.test_lifecycle_safety import seed, enforced, version, A
from job_discovery.lifecycle import claims, capacity

with psycopg.connect(os.environ['TEST_DATABASE_URL'], row_factory=dict_row) as c:
    c.execute(Path('schema.sql').read_text())
    c.commit()
    seed(c)
    vid = version(c)
    claim = claims.claim_work(c, 'payload', 'lever:x:0', 2)
    reservation = capacity.reserve_capacity(c, claim, 32768)
    c.commit()
    enforced(c)
    capacity.bind_reservation(c, reservation, job_id='lever:x:0', scope='job_reviews', subject_id=A, invoking_role='authenticated')
    c.execute('SET LOCAL ROLE authenticated')
    c.execute("SELECT set_config('request.jwt.claims',%s,true)", ('{"sub":"'+A+'","role":"authenticated"}',))
    c.execute('SET CONSTRAINTS ALL IMMEDIATE')
    c.execute("INSERT INTO job_reviews(user_id,job_id,profile_version,verdict,job_version_id,description_snapshot) VALUES (%s,'lever:x:0','v','approve',%s,'receipt expiry probe')", (A,vid))
    time.sleep(2.1)
    c.commit()
    print('expired_reserved_growth_committed', c.execute('SELECT lease_until < clock_timestamp() AS expired FROM lifecycle_claims').fetchone()['expired'])
    print('committed_reviews', c.execute('SELECT count(*) AS count FROM job_reviews').fetchone()['count'])
