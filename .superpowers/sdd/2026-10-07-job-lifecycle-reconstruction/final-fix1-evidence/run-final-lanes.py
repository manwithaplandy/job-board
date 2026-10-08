import subprocess,time,json,os
from pathlib import Path
root=Path.cwd(); ev=root/'.superpowers/sdd/2026-10-07-job-lifecycle-reconstruction/final-fix1-evidence'
py=str(root/'.venv/bin/python')
lanes=[]
for major in (17,16):
 lanes.append((f'final-python{major}',[py,'tools/lifecycle_test_db.py','--postgres-major',str(major),'--',py,'tools/run_lifecycle_acceptance.py'],root,None))
 lanes.append((f'final-owned{major}',[py,'tools/lifecycle_test_db.py','--postgres-major',str(major),'--',py,'tools/run_lifecycle_acceptance.py','dashboard'],root,None))
for name,args in [('default',['npm','test']),('type',['npx','tsc','--noEmit']),('lint',['npm','run','lint'])]:
 lanes.append(('final-'+name,args,root/'dashboard',None))
clean={k:v for k,v in os.environ.items() if k in ('PATH','HOME','LANG','USER','TMPDIR')}
clean.update(DATABASE_URL='postgresql://test:test@127.0.0.1:1/test',NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:1',NEXT_PUBLIC_SUPABASE_ANON_KEY='test',OPENAI_API_KEY='test-disabled',NEXT_TELEMETRY_DISABLED='1',NEXT_FONT_GOOGLE_MOCKED_RESPONSES=str(ev/'font-mock.cjs'))
lanes += [('final-build',['npm','run','build','--','--webpack'],root/'dashboard',clean),('final-browser',['node',str(ev/'browser/run.cjs')],root,None)]
results=[]
for name,cmd,cwd,env in lanes:
 pin=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();start=time.time()
 print(name+' START '+pin,flush=True)
 with (ev/(name+'.log')).open('w') as f:
  r=subprocess.run(cmd,cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT)
 result=dict(name=name,command=cmd,cwd=str(cwd),source=pin,start_utc=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(start)),seconds=round(time.time()-start,2),exit=r.returncode,environment='sanitized offline build' if env else 'owned harness or offline local tool')
 (ev/(name+'.exit')).write_text(str(r.returncode)+'\n');results.append(result);(ev/'final-lanes.json').write_text(json.dumps(results,indent=2)+'\n')
 print(name+' END '+str(r.returncode)+' '+str(result['seconds'])+'s',flush=True)
 if r.returncode: break
