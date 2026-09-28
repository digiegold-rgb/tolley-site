import assert from 'node:assert/strict';
import { chromium, request } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { createOwnerSession, requireIsolatedServer } from '../helpers/owner-session.mjs';
const base='http://localhost:3029';requireIsolatedServer(base);
const p=new PrismaClient();let owner,browser;
const api=await request.newContext({baseURL:base,timeout:120000});
const ids=['whatnot_browser-fresh','whatnot_browser-stale'];
try {
 for(const [i,id] of ids.entries()) await p.liveShow.create({data:{id,title:i?'Expired verification fixture':'Verified schedule fixture',category:'Estate / mixed finds',startsAt:new Date(Date.now()+86400000),status:'confirmed',confirmedUntil:new Date(Date.now()+(i?-3600000:3600000)),whatnotUrl:'https://www.whatnot.com/live/'+id.replace('whatnot_','')}});
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();page.setDefaultTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/live',{waitUntil:'networkidle'});
 const body=await page.locator('body').innerText();assert.match(body,/Verified schedule fixture/);assert.doesNotMatch(body,/Expired verification fixture/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal((await api.get('/go/show?show='+ids[1],{maxRedirects:0})).headers().location,'https://www.whatnot.com/user/treasure_hauls');
 assert.equal((await api.get('/go/show?show='+ids[0],{maxRedirects:0})).headers().location,'https://www.whatnot.com/live/browser-fresh');
 assert.equal((await api.get('/api/live/manage')).status(),401);
 owner=await createOwnerSession(p,base);
 await context.addCookies(owner.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1),url:base};}));
 await page.goto(base+'/stream/growth',{waitUntil:'networkidle'});await page.getByRole('heading',{name:'Whatnot schedule sync',exact:true}).waitFor();await page.getByText('Last check:',{exact:false}).waitFor();
 assert.match(await page.locator('body').innerText(),/every four hours/);
 assert.equal(await page.getByRole('button',{name:'Save show draft',exact:true}).isVisible(),false,'manual entry is an optional collapsed fallback');
 await page.screenshot({path:'/tmp/hauls-schedule/growth-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('PASS: verified schedule public, stale schedule hidden and redirect fallback, mobile layout, owner MFA and automatic-sync UI');
}finally{await browser?.close();await owner?.cleanup();await p.liveShow.deleteMany({where:{id:{in:ids}}});await api.dispose();await p.$disconnect();}
