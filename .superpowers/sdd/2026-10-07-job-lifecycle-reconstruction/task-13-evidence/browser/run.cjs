// Actual RolefitBoard browser; fake server props/actions/navigation/data only. No auth/providers.
const path=require('node:path'),fs=require('node:fs'),http=require('node:http');
const root=process.cwd(),dir=__dirname;
const esbuild=require(path.join(root,'dashboard/node_modules/esbuild'));
const {chromium,expect}=require(path.join(root,'dashboard/node_modules/@playwright/test'));
(async()=>{
  const output=path.join('/tmp','task13-browser-bundle');fs.mkdirSync(output,{recursive:true});
  await esbuild.build({entryPoints:[path.join(dir,'entry.tsx')],bundle:true,outdir:output,jsx:'automatic',platform:'browser',define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},tsconfig:path.join(root,'dashboard/tsconfig.json'),nodePaths:[path.join(root,'dashboard/node_modules')],plugins:[{name:'offline-boundaries',setup(build){
    build.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'offline'}));
    build.onResolve({filter:/^@\/app\/actions\//},args=>({path:args.path,namespace:'offline'}));
    build.onLoad({filter:/.*/,namespace:'offline'},args=>{
      if(args.path==='navigation') return {contents:'export const useRouter=()=>({push:url=>location.assign(url),refresh:()=>location.reload(),replace:url=>location.replace(url)});',loader:'js'};
      const original=fs.readFileSync(path.join(root,'dashboard',args.path.slice(2)+'.ts'),'utf8');
      const names=[...original.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m=>m[1]);
      return {contents:names.map(name=>`export const ${name}=async()=>{throw new Error("Fake browser actions must not run")};`).join('\n'),loader:'js'};
    });
  }}]});
  const requests=[],errors=[],blocked=[];
  const server=http.createServer((req,res)=>{
    requests.push(req.method+' '+req.url);
    if(req.url.startsWith('/api/jobs/')) {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({description:null,descriptionIsSaved:false,currentDescription:'Current employer JD',currentQuestions:{questions:[{label:'Current employer question',required:false,fields:[{name:'current',type:'input_text',options:[]}]}]},questions:null}));return;}
    if(req.url.startsWith('/api/')) {res.setHeader('Content-Type','application/json');res.end('{}');return;}
    const filename=req.url==='/entry.js'?'entry.js':req.url==='/entry.css'?'entry.css':null;
    if(filename){res.setHeader('Content-Type',filename.endsWith('css')?'text/css':'application/javascript');res.end(fs.readFileSync(path.join(output,filename)));return;}
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/entry.css"></head><body><div id="root"></div><script src="/entry.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port,base=`http://127.0.0.1:${port}`;
  let browser;
  try {
    browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(10000);
    page.on('pageerror',error=>{errors.push(error.message);console.error('Browser page error: '+error.message);});
    await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==base){blocked.push(url.origin);return route.abort();}return route.continue();});
    const assertions=[];
    const check=async(name,callback)=>{await callback();assertions.push(name);};
    await page.goto(base+'/board?historyPage=1');
    await page.getByRole('button',{name:'History',exact:true}).click();
    await check('selected history page has two distinct fixture rows',()=>expect(page.locator('.rf-job-card__title')).toHaveCount(2));
    await check('discovery-page rows excluded from history',()=>expect(page.locator('.rf-job-card__title').filter({hasText:'Discovery page one'})).toHaveCount(0));
    await check('history page-local total agrees',()=>expect(page.locator('.rf-board-result-count')).toHaveText('2 of 2 roles'));
    await check('server history pagination retained',()=>expect(page.getByText(/1000 saved jobs · Page 2/)).toBeVisible());
    await check('applied count is one on this page',()=>expect(page.getByRole('radio',{name:'Applied · 1'})).toBeVisible());
    await page.screenshot({path:path.join(dir,'history.png'),fullPage:true});
    await page.getByRole('button',{name:/Retained prepared role/}).click();
    await check('unscored prepared status visible',()=>expect(page.getByText('Prepared application',{exact:true})).toBeVisible());
    await check('retained résumé visible',()=>expect(page.getByText('Retained résumé summary',{exact:true})).toBeVisible());
    await check('retained cover letter visible',()=>expect(page.getByText('Retained cover letter body',{exact:true})).toBeVisible());
    await page.screenshot({path:path.join(dir,'prepared-status.png'),fullPage:true});
    await page.getByRole('button',{name:/Application questions/}).click();
    await check('orphan saved answer retained',()=>expect(page.getByText('Retained historical answer',{exact:true})).toBeVisible());
    await check('orphan historical question retained',()=>expect(page.getByText('Historical orphan question',{exact:true})).toBeVisible());
    await check('honest unknown historical schema',()=>expect(page.getByText(/historical question schema is unavailable/)).toHaveCount(1));
    await page.getByText('Saved application description',{exact:true}).click();
    await check('immutable saved JD visible',()=>expect(page.getByText('Immutable application JD',{exact:true})).toBeVisible());
    await check('unscored generation controls absent',()=>expect(page.getByRole('button',{name:/Regenerate|Re-prefill|Generate résumé|Generate cover letter|Generation instructions/})).toHaveCount(0));
    await page.getByText('Immutable application JD',{exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(dir,'prepared.png'),fullPage:true});
    await page.getByRole('radio',{name:'Applied · 1'}).click();
    await check('applied view is selected history subset',()=>expect(page.locator('.rf-job-card__title')).toHaveText(['Retained applied role']));
    await check('applied page-local count agrees',()=>expect(page.locator('.rf-board-result-count')).toHaveText('1 of 1 roles'));
    await page.getByRole('button',{name:/Retained applied role/}).click();
    await check('unscored persisted applied status visible',()=>expect(page.getByText('Applied · you',{exact:false})).toBeVisible());
    await page.setViewportSize({width:390,height:844});
    await check('retained applied role on mobile',()=>expect(page.getByRole('heading',{name:'Retained applied role',level:1})).toBeVisible());
    await page.screenshot({path:path.join(dir,'applied-mobile.png'),fullPage:true});
    if(errors.length||blocked.length) throw new Error(JSON.stringify({errors,blocked}));
    fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({browser:browser.version(),target:'owned random loopback port',boundaries:'fake authenticated props/actions/navigation/API; actual RolefitBoard and descendants; read-only UI interactions',assertions,requests,errors,blocked},null,2));
    console.log('PASS: '+assertions.length+' assertions, disjoint history/applied pools and unscored retained application content/status; Chromium '+browser.version());
  } finally {if(browser) await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
