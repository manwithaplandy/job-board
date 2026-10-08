import os,subprocess,time,json
from pathlib import Path
root=Path.cwd();ev=root/'.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/task-13-evidence'
env={k:v for k,v in os.environ.items() if k in {'PATH','HOME','LANG','USER','TMPDIR'}}
env.update(DATABASE_URL='postgresql://test:test@127.0.0.1:1/test',NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:1',NEXT_PUBLIC_SUPABASE_ANON_KEY='test',OPENAI_API_KEY='test-disabled',NEXT_TELEMETRY_DISABLED='1')
env['NEXT_FONT_GOOGLE_MOCKED_RESPONSES']=str(ev/'font-mock.cjs')
for name,cmd in [('dashboard-billing-fix',['npm','test','--','app/api/stripe/webhook/route.test.ts','app/api/stripe/webhookDedupe.test.ts']),('dashboard-build-offline-final',['npm','run','build','--','--webpack'])]:
 start=time.monotonic()
 with (ev/(name+'.txt')).open('w') as f: result=subprocess.run(cmd,cwd=root/'dashboard',env=env,stdout=f,stderr=subprocess.STDOUT)
 (ev/(name+'.exit')).write_text(str(result.returncode)+'\n')
 print(json.dumps(dict(name=name,command=cmd,exit=result.returncode,seconds=round(time.monotonic()-start,3))),flush=True)
