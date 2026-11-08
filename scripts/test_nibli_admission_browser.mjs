// Real browser/WASM admission boundaries. No Session replacement or engine mock.
// Run after scripts/build_nibli.sh; PLAYWRIGHT_MODULE and BROWSER_EXECUTABLE may
// select locally installed tools. Serves only loopback; does not deploy anything.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const mime={'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm','.css':'text/css','.json':'application/json'};
const server=createServer(async(req,res)=>{
  let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(name==='/probe') {res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><title>Admission probe</title>');return;}
  if(name.endsWith('/'))name+='index.html';
  if(name.includes('..')){res.writeHead(403).end();return;}
  for(const dir of ['static','public'])try{
    let bytes=await readFile(resolve(root,dir,'.'+name));
    // Zola's canonical origin is irrelevant to this local test. Keep shipped JS/WASM bytes intact.
    if(name.endsWith('.html'))bytes=bytes.toString().replaceAll('https://dhilipsiva.dev/','/');
    res.writeHead(200,{'content-type':mime[extname(name)]||'application/octet-stream'}).end(bytes);return;
  }catch{}
  res.writeHead(404).end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(20000);
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const checks=[];
try{
  await page.goto(base+'/probe');
  const workerResults=await page.evaluate(async()=>{
    const worker=new Worker('/nibli/app/nibli-worker.js',{type:'module'});let id=0;const pending=new Map();
    worker.onmessage=e=>{const callback=pending.get(e.data.id);if(callback){pending.delete(e.data.id);callback(e.data);}};
    const call=(op,revision,payload={})=>new Promise(resolve=>{const n=++id;pending.set(n,resolve);worker.postMessage({id:n,op,revision,...payload});});
    const results=[];const add=async(label,op,revision,payload)=>{const result=await call(op,revision,payload);results.push({label,...result});return result;};
    await add('unloaded','query',1,{q:'dog(Adam).'});
    await add('complete','load',1,{text:'dog(Adam).\nanimal(every dog).'});
    await add('complete-query','query',1,{q:'animal(Adam).'});
    await add('middle-rejection','load',2,{text:'# comment\ndog(Bob).\ninvalid syntax here\ncat(Bob).'});
    await add('partial-candidate-unavailable','query',2,{q:'dog(Bob).'});
    await add('old-session-unavailable','query',1,{q:'dog(Adam).'});
    await add('retract-unavailable','retract',2,{factId:0});
    await add('recovered','load',3,{text:'dog(Carol).'});
    await add('recovered-query','query',3,{q:'dog(Carol).'});
    await add('stale-load','load',2,{text:'dog(Stale).'});
    await add('stale-does-not-invalidate','query',3,{q:'dog(Carol).'});
    await add('same-line-rejection','load',4,{text:'dog(One). invalid syntax here'});
    await add('same-line-partial-unavailable','query',4,{q:'dog(One).'});
    await add('empty','load',5,{text:'# comments only\n'});
    await add('empty-query','query',5,{q:'dog(Carol).'});
    worker.terminate();
    // Both revisions arrive before a fresh worker's real WASM initialization completes.
    const queued=new Worker('/nibli/app/nibli-worker.js',{type:'module'});const replies=[];
    await new Promise((resolve,reject)=>{queued.onerror=reject;queued.onmessage=e=>{replies.push(e.data);if(replies.length===2)resolve();};queued.postMessage({id:1,op:'load',revision:1,text:'dog(Old).'});queued.postMessage({id:2,op:'load',revision:2,text:'dog(New).'});});
    queued.terminate();return {results,queued:replies};
  });
  const rows=Object.fromEntries(workerResults.results.map(x=>[x.label,x]));
  for(const label of ['unloaded','middle-rejection','partial-candidate-unavailable','old-session-unavailable','retract-unavailable','stale-load','same-line-rejection','same-line-partial-unavailable'])assert.equal(rows[label].ok,false,label);
  assert.match(rows['middle-rejection'].error,/line 3 was rejected/);
  for(const label of ['complete-query','recovered-query','stale-does-not-invalidate'])assert.equal(rows[label].res.status,'TRUE',label);
  assert.equal(rows.empty.ok,true);assert.equal(rows.empty.facts,0);assert.equal(rows['empty-query'].res.status,'FALSE');
  assert.equal(workerResults.queued.find(x=>x.id===1).ok,false);assert.equal(workerResults.queued.find(x=>x.id===2).ok,true);
  checks.push('real WASM: incomplete candidates never become queryable, including late same-line rejection','real WASM: stale/queued revisions discarded and valid revision preserved','real WASM: recovery and explicit empty KB admission succeed');
  await page.goto(base+'/nibli/');
  await page.waitForFunction(()=>document.querySelector('#nibli-status')?.textContent.includes('engine: live'));
  await page.locator('.nibli-qbtn').first().click();await page.locator('#nibli-result:not([hidden])').waitFor();
  await page.route('**/nibli/kb/gdpr.nibli',route=>route.fulfill({status:200,body:'dog(Bob).\ninvalid syntax here\ncat(Bob).'}));
  await page.locator('.nibli-tab[data-kb="gdpr"]').click();
  await page.waitForFunction(()=>document.querySelector('#nibli-status')?.textContent.includes('line 2 was rejected'));
  assert.equal(await page.locator('#nibli-grid-body').innerText(),'');assert.equal(await page.locator('.nibli-qbtn').count(),0);assert.equal(await page.locator('#nibli-result').isHidden(),true);
  checks.push('guided page: failed whole-KB admission clears triad, query controls, and prior result');
  await page.unroute('**/nibli/kb/gdpr.nibli');await page.locator('.nibli-tab[data-kb="syllogism"]').click();
  await page.waitForFunction(()=>document.querySelector('#nibli-status')?.textContent.includes('engine: live'));
  assert.equal(await page.locator('.nibli-qbtn').first().isEnabled(),true);
  await page.route('**/nibli/kb/gdpr.nibli',route=>route.fulfill({status:200,body:'# empty provided fixture\n'}));
  await page.locator('.nibli-tab[data-kb="gdpr"]').click();await page.waitForFunction(()=>document.querySelector('#nibli-status')?.textContent.includes('empty knowledge base loaded'));
  checks.push('guided page: valid replacement recovers controls and comment-only input is visibly empty');
  assert.deepEqual(errors,[]);
  await mkdir('/tmp/nibli-admission-browser',{recursive:true});await page.screenshot({path:'/tmp/nibli-admission-browser/empty-kb.png',fullPage:true});
  await writeFile('/tmp/nibli-admission-browser/results.json',JSON.stringify({checks,pageErrors:errors,workerResults},null,2));console.log(JSON.stringify({checks,pageErrors:errors},null,2));
}catch(error){await mkdir('/tmp/nibli-admission-browser',{recursive:true});await page.screenshot({path:'/tmp/nibli-admission-browser/failure.png',fullPage:true});console.error({checks,errors,body:await page.locator('body').innerText()});throw error;}
finally{await browser.close();await new Promise(r=>server.close(r));}
