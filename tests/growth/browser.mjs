import assert from 'node:assert/strict';
import {chromium,request} from 'playwright';
import {PrismaClient} from '@prisma/client';
import sharp from 'sharp';
import {createOwnerSession,requireIsolatedServer} from '../helpers/owner-session.mjs';
const base='http://localhost:3026';requireIsolatedServer(base);
if(!process.env.DATABASE_URL?.endsWith('/tolley_growth_hq_test'))throw Error('Fixture DB required');
const p=new PrismaClient(),api=await request.newContext({baseURL:base,timeout:120000});let owner,browser;
try{
 assert.equal((await api.get('/api/hq/growth')).status(),401);
 assert.equal((await api.get('/api/hq/growth/photo?id=unknown')).status(),401);
 owner=await createOwnerSession(p,base);
 const admin=await request.newContext({baseURL:base,timeout:120000,extraHTTPHeaders:{Cookie:owner.cookie,Origin:base}});
 const image=await sharp({create:{width:20,height:20,channels:3,background:'#99aa88'}}).jpeg().toBuffer();
 const inquiry=await api.post('/api/live/sell',{multipart:{name:'Growth fixture',contact:'fixture@example.test',location:'Kansas City',details:'Fixture toolbox',attribution:JSON.stringify({reportedSource:'ChatGPT',referrerHost:'google.com',campaignSource:'fixture',landingPath:'/live/sell'}),photos:{name:'item.jpg',mimeType:'image/jpeg',buffer:image}}});
 assert.equal(inquiry.status(),200,await inquiry.text());const {leadId}=await inquiry.json();const lead=await p.growthLead.findUniqueOrThrow({where:{id:leadId}});assert.equal(lead.attribution.reportedSource,'ChatGPT');assert.equal(lead.attribution.browserSource,'google');
 const photo=await p.growthInquiryPhoto.findFirstOrThrow({where:{leadId}});assert.equal((await admin.get('/api/hq/growth/photo?id='+photo.id)).status(),200);
 assert.equal((await admin.post('/api/hq/growth',{data:{control:'blogPaused',paused:true}})).status(),200);
 assert.equal((await admin.get('/api/hq/growth?period=yesterday')).status(),200);
 assert.equal((await api.get('/live/announcement-image')).headers()['content-type'],'image/jpeg');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();page.setDefaultTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(page.url()+': '+e.stack));
 for(const path of ['/live/reselling','/live/sell','/blog']){await page.goto(base+path,{waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,path);}
 await context.addCookies(owner.cookie.split("; ").map(pair=>{const i=pair.indexOf("=");return {name:pair.slice(0,i),value:pair.slice(i+1),url:base};}));
 await page.goto(base+'/hq/growth',{waitUntil:'networkidle'});await page.getByRole('heading',{name:'Growth at a glance'}).waitFor();await page.getByRole('heading',{name:'Where we posted'}).waitFor();await page.screenshot({path:'/tmp/tolley-growth-hq-mobile.png',fullPage:true});
 assert.equal(errors.length,0,errors.join('\n'));
 await admin.dispose();console.log('Growth browser passed: owner access, private photos, saved inquiry attribution, pause, reporting, JPEG media, mobile public pages and HQ.');
}finally{await browser?.close();await owner?.cleanup();await api.dispose();await p.$disconnect();}
