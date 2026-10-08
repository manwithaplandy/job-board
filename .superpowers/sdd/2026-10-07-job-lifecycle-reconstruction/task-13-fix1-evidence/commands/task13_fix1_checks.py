import subprocess,time,json,os
from pathlib import Path
root=Path.cwd();ev=root/'.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence'
env={k:v for k,v in os.environ.items() if k in {'PATH','HOME','LANG','USER','TMPDIR'}}
env.update(DATABASE_URL='postgresql://test:test@127.0.0.1:1/test',NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:1',NEXT_PUBLIC_SUPABASE_ANON_KEY='test',OPENAI_API_KEY='test-disabled',NEXT_TELEMETRY_DISABLED='1')
for name,cwd,cmd in [('ruff',root,[str(root/'.venv/bin/ruff'),'check','.']),('typecheck',root/'dashboard',['npm','run','typecheck'])]:
 start=time.monotonic()
 with (ev/(name+'.txt')).open('w') as f:r=subprocess.run(cmd,cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT)
 (ev/(name+'.exit')).write_text(str(r.returncode)+'\n')
 record=dict(name=name,command=cmd,exit=r.returncode,seconds=round(time.monotonic()-start,3));(ev/(name+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record),flush=True)
