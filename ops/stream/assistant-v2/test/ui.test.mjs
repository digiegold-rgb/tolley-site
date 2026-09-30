import test from 'node:test';import assert from 'node:assert/strict';
import {chromium} from '/home/jelly/dgx-services/whatnot-sync-worker/node_modules/playwright/index.mjs';
import {createServer,classicStatus} from '../server.mjs';import {defaults} from '../core.mjs';
test('dashboard preview never calls a sender, starts disabled, is mobile usable and requires CSRF',async()=>{
 let previews=0,sends=0;const state={paused:true,phase:'disconnected',inventory:{ready:true,generatedAt:Date.now(),counts:{listed:54,draft:624,unavailable:1228},lineups:[]},settings:defaults,messages:[],decisions:[]};
 const engine={status:()=>state,inventory:{answer:async q=>{previews++;return {action:'answer',text:'Our catalog lists Fellow Stagg kettle. Not confirmed for this show.',reason:'Listed record'};}},resume:()=>sends++,send:()=>sends++};
 const server=createServer(engine,{port:18112,csrf:'fixture'});await new Promise(r=>server.listen(18112,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:18112/admin');await page.getByText('54 listed · 624 drafts').waitFor();assert.equal(await page.locator('#start').isDisabled(),true);
 await page.getByLabel('Viewer question').fill('Do you have any stag electric kettles?');await page.getByRole('button',{name:'Preview answer',exact:true}).click();await page.locator('#answer').getByText(/Our catalog lists/).waitFor();assert.equal(previews,1);assert.equal(sends,0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/tolley-inventory-v2-mobile.png',fullPage:true});
 assert.equal((await page.request.post('http://127.0.0.1:18112/action',{data:{action:'start',csrf:'wrong'}})).status(),403);assert.equal(sends,0);assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});

test('retired worker connection refusal is allowed; unknown errors and active workers are not treated as retired',async()=>{
 const error=Object.assign(new Error('connect'),{cause:{code:'ECONNREFUSED'}});
 assert.deepEqual(await classicStatus(async()=>{throw error;}),{paused:true,phase:'retired'});
 await assert.rejects(classicStatus(async()=>{throw new Error('timeout');}),/timeout/);
 await assert.rejects(classicStatus(async()=>({ok:false})),/Cannot verify/);
 assert.equal((await classicStatus(async()=>({ok:true,json:async()=>({paused:false,phase:'connected'})}))).paused,false);
});
