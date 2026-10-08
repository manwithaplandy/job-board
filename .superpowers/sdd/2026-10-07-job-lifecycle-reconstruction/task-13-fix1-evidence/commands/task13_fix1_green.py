import subprocess,time,json,shutil
from pathlib import Path
root=Path('/workspace/job-board/.claude/worktrees/lifecycle-recovery');ev=root/'.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-fix1-evidence';layout=Path('/tmp/task13-fix1-layout')
for name in subprocess.check_output(['git','ls-files'],cwd=root,text=True).splitlines():
 if name.startswith(('.superpowers/','.claude/')):continue
 p=root/name
 if not p.is_file():continue
 target=layout/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
assert not (layout/'.venv').exists()
selection=json.loads((ev/'selection.json').read_text())
commands=[]
for major in (17,16):
 commands.append((f'python-green{major}',root,[str(root/'.venv/bin/python'),'tools/lifecycle_test_db.py','--postgres-major',str(major),'--',str(root/'.venv/bin/python'),'-m','pytest',*selection,'-vv','-ra','-s']))
 commands.append((f'dashboard-green{major}',layout,['/tmp/task13-fix1-python/bin/python','tools/lifecycle_test_db.py','--postgres-major',str(major),'--','/tmp/task13-fix1-python/bin/python','tools/run_lifecycle_acceptance.py','dashboard']))
for name,cwd,cmd in commands:
 start=time.monotonic()
 with (ev/(name+'.txt')).open('w') as f:r=subprocess.run(cmd,cwd=cwd,stdout=f,stderr=subprocess.STDOUT)
 (ev/(name+'.exit')).write_text(str(r.returncode)+'\n')
 record=dict(name=name,cwd=str(cwd),command=cmd,exit=r.returncode,seconds=round(time.monotonic()-start,3))
 (ev/(name+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record),flush=True)
 if r.returncode:break
