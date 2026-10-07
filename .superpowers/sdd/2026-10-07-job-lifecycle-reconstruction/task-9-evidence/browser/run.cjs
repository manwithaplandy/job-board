// Actual RolefitBoard browser; fake server props/actions/navigation/data only. No auth/providers.
const path=require('node:path'),fs=require('node:fs'),http=require('node:http');
const root=process.cwd(),dir=__dirname;
const esbuild=require(path.join(root,'dashboard/node_modules/esbuild'));
const {chromium,expect}=require(path.join(root,'dashboard/node_modules/@playwright/test'));
(async()=>{
  const output=path.join('/tmp','task9-browser-bundle');fs.mkdirSync(output,{recursive:true});
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
    if(req.url.startsWith('/api/jobs/')) {res.setHeader('Content-Type','application/json');res.end(JSON.stringify({description:'Offline current posting',descriptionIsSaved:false,requirements:'broken',benefits:'["Health"]',questions:null,lifecycle:{feedEnabled:true,sourceEnabled:true,sourceAvailability:'open',discoveryAnchorAt:'2026-09-01T00:00:00Z',discoveryExpiresAt:'2026-10-01T00:00:00Z',payloadAvailability:'retired'}}));return;}
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
    await page.goto(base+'/board');
    await expect(page.getByText('Recent Engineer',{exact:true})).toBeVisible();
    await expect(page.getByText('Older Live Engineer',{exact:true})).toHaveCount(0);
    await expect(page.getByRole('checkbox',{name:'Include older live jobs'})).not.toBeChecked();
    await page.screenshot({path:path.join(dir,'default.png'),fullPage:true});
    await page.getByRole('checkbox',{name:'Include older live jobs'}).check();
    await page.waitForURL('**?older=1');
    await expect(page.getByText('Older Live Engineer',{exact:true})).toBeVisible();
    await expect(page.getByText('Discovery expired',{exact:true})).toBeVisible();
    await expect(page.getByText('Posting payload retired',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:/Older Live Engineer/}).click();
    await expect(page.getByRole('heading',{name:'Older Live Engineer',level:1})).toBeVisible();
    await page.getByRole('button',{name:'Show full job description'}).click();
    await expect(page.getByText('Offline current posting',{exact:true})).toBeVisible();
    await page.screenshot({path:path.join(dir,'older-detail.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await expect(page.getByRole('heading',{name:'Older Live Engineer',level:1})).toBeVisible();
    await page.screenshot({path:path.join(dir,'mobile-detail.png'),fullPage:true});
    if(errors.length||blocked.length) throw new Error(JSON.stringify({errors,blocked}));
    fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({browser:browser.version(),target:'owned random loopback port',boundaries:'fake server props/actions/navigation/API; actual RolefitBoard and components',assertions:["default current visible","default older absent","default toggle unchecked","older visible after opt-in","expiry label","retirement label","selected detail","offline description disclosure","mobile detail"],requests,errors,blocked},null,2));
    console.log('PASS: actual public board, older-live opt-in, independent expiry/source/payload labels, detail JSON tolerance, desktop/mobile; Chromium '+browser.version());
  } finally {if(browser) await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
