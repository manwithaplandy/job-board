import subprocess,time,json
from pathlib import Path
root=Path('/workspace/job-board/.claude/worktrees/lifecycle-recovery');ev=root/'.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence'
commands=[('python-red17',root,[str(root/'.venv/bin/python'),'tools/lifecycle_test_db.py','--postgres-major','17','--',str(root/'.venv/bin/python'),'-m','pytest','tests/test_lifecycle_task13_fix1.py','tests/test_lifecycle_end_to_end.py::test_explicit_readiness_transitions_through_existing_control_api','-vv','-ra']),('dashboard-red17',Path('/tmp/task13-fix1-layout'),['/tmp/task13-fix1-python/bin/python','tools/lifecycle_test_db.py','--postgres-major','17','--','/tmp/task13-fix1-python/bin/python','tools/run_lifecycle_acceptance.py','dashboard'])]
for name,cwd,cmd in commands:
 start=time.monotonic()
 with (ev/(name+'.txt')).open('w') as f:r=subprocess.run(cmd,cwd=cwd,stdout=f,stderr=subprocess.STDOUT)
 (ev/(name+'.exit')).write_text(str(r.returncode)+'\n')
 record=dict(name=name,cwd=str(cwd),command=cmd,exit=r.returncode,seconds=round(time.monotonic()-start,3))
 (ev/(name+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record),flush=True)
