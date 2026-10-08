const path=require('node:path'),fs=require('node:fs'),http=require('node:http');
const root=process.cwd(),dir=__dirname;
const esbuild=require(path.join(root,'dashboard/node_modules/esbuild'));
const {chromium,expect}=require(path.join(root,'dashboard/node_modules/@playwright/test'));
(async()=>{
 const bundle=await esbuild.build({entryPoints:[path.join(dir,'entry.tsx')],bundle:true,write:false,jsx:'automatic',platform:'browser',define:{'process.env.NODE_ENV':'"development"'},tsconfig:path.join(root,'dashboard/tsconfig.json'),nodePaths:[path.join(root,'dashboard/node_modules')]});
 const server=http.createServer((req,res)=>{if(req.url==='/entry.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].text);}else{res.end('<html><body><div id="root"></div><script src="/entry.js"></script></body></html>')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;const errors=[],blocked=[],assertions=[];
 try {
  const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==base){blocked.push(route.request().url());return route.abort();}return route.continue();});
  for(const [name,width,height] of [['desktop',1280,800],['mobile',390,844]]){
   await page.setViewportSize({width,height});await page.goto(base);
   await expect(page.getByText('10',{exact:true})).toHaveCount(2);
   await expect(page.getByText(/Applied totals include retained history/)).toBeVisible();
   await expect(page.getByText(/of approved/)).toHaveCount(0);
   await expect(page.getByRole('button',{name:/Applied\./})).toBeVisible();
   assertions.push(name+': actual FunnelSection shows lifetime applied=10, approved=2, no cross-cohort percentage, retained-history caption');
   await page.screenshot({path:path.join(dir,name+'.png'),fullPage:true});
  }
  if(errors.length||blocked.length)throw Error(JSON.stringify({errors,blocked}));
  fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({browser:browser.version(),target:'owned random loopback',boundary:'actual FunnelSection; static fixture metrics; no server/auth/provider',assertions,errors,blocked},null,2));
  console.log('PASS '+assertions.length+' viewports, eight assertions; Chromium '+browser.version());
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
