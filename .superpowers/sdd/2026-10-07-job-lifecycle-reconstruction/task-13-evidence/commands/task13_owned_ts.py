import subprocess,time,json
from pathlib import Path
root=Path.cwd();ev=root/'.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-evidence'
for major in (17,16):
 name=f'dashboard-owned{major}';cmd=[str(root/'.venv/bin/python'),'tools/lifecycle_test_db.py','--postgres-major',str(major),'--',str(root/'.venv/bin/python'),'tools/run_lifecycle_acceptance.py','dashboard']
 start=time.monotonic()
 with (ev/(name+'.txt')).open('w') as f:r=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT)
 (ev/(name+'.exit')).write_text(str(r.returncode)+'\n')
 print(json.dumps(dict(name=name,command=cmd,exit=r.returncode,seconds=round(time.monotonic()-start,3))),flush=True)
 if r.returncode:break
