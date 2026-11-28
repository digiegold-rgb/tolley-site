// Real persistence tests use only this feature's disposable local database.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
const base = process.env.BUSINESS_TEST_URL || 'http://localhost:3079';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const dbUrl = new URL(process.env.DATABASE_URL || '');
assert.equal(dbUrl.hostname, '127.0.0.1'); assert.equal(dbUrl.port, '55479'); assert.equal(dbUrl.pathname, '/tolley_business_test');
const db = new PrismaClient();
const browser = await chromium.launch({ headless:true });
const artifacts = '/tmp/tolley-business-preview'; mkdirSync(artifacts, {recursive:true});
const tag = `business-test-${Date.now()}`;
try {
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route(/google-analytics|googletagmanager|connect\.facebook|analytics\.twitter|va\.vercel-scripts/, r=>r.abort());
  const page = await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  assert.equal((await page.goto(base+'/business?utm_source=business-test&utm_campaign=launch')).status(),200);
  await page.evaluate(()=>document.fonts.ready);
  assert.match(await page.title(), /Custom Business Software/);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://www.tolley.io/business');
  assert.equal(await page.locator('h1').count(),1); assert.equal(await page.locator('form').count(),1);
  await page.getByRole('button',{name:'Inventory',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Inventory',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByText('Confirm item, condition & location',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Job paperwork',exact:true}).click();
  await page.screenshot({path:artifacts+'/desktop.png',fullPage:true});
  const form=page.getByRole('form',{name:'Business software project inquiry'});
  await form.getByLabel('The task you want to improve').fill('We retype delivery slips into invoices. Prepare drafts for our review.');
  await form.getByLabel('Your name').fill(tag);
  await form.getByLabel('Email').fill(`${tag}@example.test`);
  await form.getByLabel('Country').fill('United Kingdom');
  await form.getByLabel('Time zone or city').fill('London / GMT');
  await form.getByLabel('Current tools').fill('Excel and our accounting system');
  await form.getByLabel('How often').fill('30 jobs a week');
  await form.locator('summary').click();
  await form.getByLabel('Budget & currency').fill('GBP 2,000');
  await form.getByLabel('How did you find me?').fill('ChatGPT');
  await page.route('**/api/lead/action',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Simulated failure'})}));
  await form.getByRole('button',{name:'Tell Jared about the work'}).click();
  await form.getByRole('alert').filter({hasText:'not saved'}).waitFor();
  assert.match(await form.getByLabel('The task you want to improve').inputValue(),/delivery slips/);
  assert.equal(await db.leadAction.count({where:{email:`${tag}@example.test`}}),0);
  await page.unroute('**/api/lead/action');
  let payload; page.on('request',r=>{if(r.url().endsWith('/api/lead/action'))payload=r.postDataJSON();});
  await form.getByRole('button',{name:'Tell Jared about the work'}).click();
  await page.getByRole('heading',{name:'Let’s understand the work.'}).waitFor({timeout:60000});
  const lead=await db.leadAction.findFirstOrThrow({where:{email:`${tag}@example.test`}});
  assert.equal(lead.subsite,'business'); assert.equal(lead.action,'request_business_project');
  assert.equal(lead.structured.country,'United Kingdom'); assert.equal(lead.structured.timeZone,'London / GMT');
  assert.equal(lead.structured.budget,'GBP 2,000'); assert.equal(lead.structured.frequency,'30 jobs a week');
  assert.equal(lead.attribution.reportedSource,'ChatGPT'); assert.equal(lead.attribution.campaignSource,'business-test');
  assert.equal(await db.leadNotification.count({where:{leadId:lead.id}}),2);
  assert.equal(await db.hqCustomerLink.count({where:{kind:'action',sourceId:lead.id}}),1);
  const retry=await context.request.post(base+'/api/lead/action',{data:payload});
  assert.equal(retry.status(),200); assert.equal((await retry.json()).receiptToken,lead.receiptToken);
  assert.equal(await db.leadAction.count({where:{email:`${tag}@example.test`}}),1);
  const invalid=await context.request.post(base+'/api/lead/action',{data:{...payload,fields:{...payload.fields,workflow:'invalid'}}});
  assert.equal(invalid.status(),400);
  const missing=await context.request.post(base+'/api/lead/action',{data:{...payload,fields:{workflow:'orders'}}});
  assert.equal(missing.status(),400);
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844}); await page.goto(base+'/business');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No overflow at ${width}`);
    await page.screenshot({path:`${artifacts}/mobile-${width}.png`,fullPage:true});
    await page.getByRole('link',{name:'Show me the repetitive part'}).click();
    await form.getByLabel('Your name').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${artifacts}/mobile-${width}-form.png`});
  }
  // The new global nav entry must not break existing narrow layouts.
  await page.goto(base+'/'); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await page.locator('a[href="/business"]').count());
  const noJs=await browser.newContext({javaScriptEnabled:false}); const staticPage=await noJs.newPage();
  await staticPage.goto(base+'/business'); const text=await staticPage.locator('main').innerText();
  assert.match(text,/worldwide/i); assert.match(text,/Projects are quoted individually/); assert.match(text,/Job paperwork to invoices/);
  assert.ok(await staticPage.locator('#service-details').isVisible());
  assert.ok(await staticPage.locator('a[href="mailto:support@tolley.io"]').count());
  assert.ok(!(await staticPage.getByRole('button',{name:'Tell Jared about the work'}).isVisible()));
  for(const path of ['/services','/start','/sitemap.xml','/llms.txt','/llms-full.txt','/api/agent/business','/api/v1/capabilities','/api/v1/knowledge?q=custom%20business%20software%20workflow%20automation']){
    const r=await context.request.get(base+path);assert.equal(r.status(),200,path);assert.match(await r.text(),/\/business/,path);
  }
  const og=await context.request.get(base+'/business/opengraph-image');assert.equal(og.status(),200);assert.match(og.headers()['content-type'],/image\/png/);
  for(const ua of ['Googlebot','OAI-SearchBot','Claude-SearchBot','PerplexityBot']){
    const r=await context.request.get(base+'/business',{headers:{'User-Agent':ua}});assert.equal(r.status(),200);
    const html=await r.text();assert.match(html,/Software for the work/);assert.doesNotMatch(r.headers()['x-robots-tag']||'',/noindex/);
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,artifacts,checks:['worldwide inquiry saved','notification outbox and owner customer link','failed save retains fields','retry deduplication','server field validation','referral retention','workflow preview','desktop and 320/390 mobile','no-JS content and email fallback','AI discovery and crawler responses','share image']},null,2));
} finally {await browser.close();await db.$disconnect();}
