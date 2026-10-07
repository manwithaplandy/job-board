import os, sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd()))
import psycopg
from psycopg.rows import dict_row
from tests.test_lifecycle_safety import seed, A, B
from job_discovery.lifecycle import claims, capacity

with psycopg.connect(os.environ['TEST_DATABASE_URL'], row_factory=dict_row) as c:
    c.execute(Path('schema.sql').read_text())
    c.commit()
    seed(c)
    claim = claims.claim_work(c, 'payload', 'lever:x:0', 180)
    r1 = capacity.reserve_capacity(c, claim, 1024)
    r2 = capacity.reserve_capacity(c, claim, 1024)
    c.commit()
    capacity.bind_reservation(c, r1, job_id='lever:x:0', scope='job_reviews', subject_id=A, invoking_role='authenticated')
    capacity.bind_reservation(c, r2, job_id='lever:x:0', scope='job_reviews', subject_id=B, invoking_role='authenticated')
    c.commit()
    c.execute('SELECT lifecycle_forget_subject(%s)', (A,))
    c.commit()
    print('other_user_reservation_after_erasure', c.execute('SELECT state,subject_id FROM capacity_reservations WHERE id=%s',(r2.id,)).fetchone())
    print('shared_job_count', c.execute('SELECT count(*) AS count FROM jobs').fetchone()['count'])
