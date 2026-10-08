"""Read-only wait observation around the unchanged positive selection."""
import json,os,subprocess,sys,threading,time
from pathlib import Path
import psycopg
sys.path.insert(0,str(Path.cwd()))
from tools.lifecycle_test_db import validate_test_dsn
selection=json.loads(Path('tools/lifecycle_test_selection.json').read_text())
dsn=os.environ['TEST_DATABASE_URL'];validate_test_dsn(dsn)
stop=threading.Event()
def observe():
 try:
  with psycopg.connect(dsn,autocommit=True,connect_timeout=5,application_name='task13-observer',options='-c statement_timeout=5000') as conn:
   while not stop.wait(10):
    rows=conn.execute("SELECT state,wait_event_type,wait_event,extract(epoch from clock_timestamp()-query_start)::int,left(query,1),position('pg_database_size' in query)>0 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND state='active'").fetchall()
    files=conn.execute("WITH d AS (SELECT 'base/'||oid::text||'/' AS path FROM pg_database WHERE datname=current_database()), f AS (SELECT path,pg_ls_dir(path) AS name FROM d) SELECT count(*),count(*) FILTER(WHERE (pg_stat_file(path||name,true)).size=0) FROM f WHERE name~'^[0-9]'").fetchone()
    print('TASK13_RESET_FILES',json.dumps(dict(total=files[0],zero_length=files[1])),flush=True)
    print('TASK13_OWNED_WAIT',json.dumps([dict(state=r[0],wait_type=r[1],wait=r[2],query_seconds=r[3],allocation_measurement=r[5]) for r in rows]),flush=True)
 except Exception as error:print('TASK13_OBSERVER_ERROR',type(error).__name__,flush=True)
thread=threading.Thread(target=observe);thread.start()
try: code=subprocess.call([sys.executable,'-m','pytest',*selection['python'],'-vv','-ra','-o','faulthandler_timeout=20'])
finally:stop.set();thread.join(timeout=6)
raise SystemExit(code)
