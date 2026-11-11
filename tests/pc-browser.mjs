// End-to-end checks against this feature's disposable local database only.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const base = process.env.PC_TEST_URL || 'http://localhost:3072';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const dbUrl = new URL(process.env.DATABASE_URL || '');
assert.equal(dbUrl.hostname, '127.0.0.1');
assert.equal(dbUrl.port, '55472');
assert.equal(dbUrl.pathname, '/tolley_pc');
const db = new PrismaClient();
const browser = await chromium.launch({ headless: true });
const tag = `pc-test-${Date.now()}`;
const artifacts = '/tmp/tolley-pc-preview';
mkdirSync(artifacts, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route(/google-analytics|googletagmanager|connect\.facebook|analytics\.twitter|va\.vercel-scripts/, route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const response = await page.goto(`${base}/pc?utm_source=pc-test&utm_campaign=launch`);
  assert.equal(response.status(), 200);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.match(await page.title(), /Custom PC Builds in Kansas City/);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://www.tolley.io/pc');
  assert.equal(await page.locator('form').count(), 1, 'Only the structured build form is rendered');
  await page.screenshot({ path: `${artifacts}/desktop.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  const form = page.getByRole('form', { name: 'Custom PC build request' });
  await form.getByLabel('Creative work', { exact: true }).check();
  await form.getByLabel('I’m supplying the parts').check();
  await form.getByLabel('Your goals', { exact: true }).fill('Video editing and a quiet build; customer-supplied parts.');
  await form.getByLabel('Approximate budget').fill('$300 assembly budget; parts already owned');
  await form.getByLabel('Preferred date').fill('2027-01-15');
  await form.getByLabel('Parts list or link').fill('https://example.test/parts');
  await form.getByLabel('Your name', { exact: true }).fill(tag);
  await form.getByLabel('Your city', { exact: true }).fill('Independence, MO');
  await form.getByRole('button', { name: 'Let’s talk about your build' }).click();
  await form.getByRole('alert').waitFor();
  assert.match(await form.getByRole('alert').textContent(), /phone number or email/);
  await form.getByLabel('Email', { exact: true }).fill(`${tag}@example.test`);
  await form.getByLabel('How did you find me?').fill('ChatGPT');
  await page.route('**/api/lead/action', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Simulated failure' }) }));
  await form.getByRole('button', { name: 'Let’s talk about your build' }).click();
  await form.getByRole('alert').filter({ hasText: 'not saved' }).waitFor();
  assert.equal(await form.getByLabel('Your goals', { exact: true }).inputValue(), 'Video editing and a quiet build; customer-supplied parts.');
  assert.equal(await db.leadAction.count({ where: { email: `${tag}@example.test` } }), 0);
  await page.unroute('**/api/lead/action');
  let payload;
  page.on('request', r => { if (r.url().endsWith('/api/lead/action')) payload = r.postDataJSON(); });
  await form.getByRole('button', { name: 'Let’s talk about your build' }).click();
  await page.getByRole('heading', { name: 'Your next build starts here.' }).waitFor({ timeout: 30000 });
  const lead = await db.leadAction.findFirstOrThrow({ where: { email: `${tag}@example.test` } });
  assert.equal(lead.subsite, 'pc'); assert.equal(lead.action, 'request_pc_build'); assert.equal(lead.status, 'new');
  assert.equal(lead.structured.parts, 'supplied'); assert.equal(lead.structured.useCase, 'creator');
  assert.equal(lead.structured.preferredDate, '2027-01-15');
  assert.equal(lead.structured.partsList, 'https://example.test/parts');
  assert.equal(lead.attribution.reportedSource, 'ChatGPT'); assert.equal(lead.attribution.campaignSource, 'pc-test');
  assert.equal(await db.leadNotification.count({ where: { leadId: lead.id } }), 2);
  assert.equal(await db.hqCustomerLink.count({ where: { kind: 'action', sourceId: lead.id } }), 1);
  const retry = await context.request.post(`${base}/api/lead/action`, { data: payload });
  assert.equal(retry.status(), 200); assert.equal((await retry.json()).receiptToken, lead.receiptToken);
  assert.equal(await db.leadAction.count({ where: { email: `${tag}@example.test` } }), 1, 'A retry must not duplicate the inquiry');
  const invalid = await context.request.post(`${base}/api/lead/action`, { data: { ...payload, fields: { ...payload.fields, parts: 'invalid' } } });
  assert.equal(invalid.status(), 400);

  // The other service path persists with no requested date or parts list.
  const sourced = await context.request.post(`${base}/api/lead/action`, { data: { ...payload, requestId: `${tag}-sourced`, contact: { email: `${tag}-sourced@example.test` }, fields: { useCase: 'gaming', parts: 'source', city: 'Kansas City', notes: 'Help plan and source a gaming PC.' } } });
  assert.equal(sourced.status(), 200);
  const sourcedLead = await db.leadAction.findFirstOrThrow({ where: { email: `${tag}-sourced@example.test` } });
  assert.equal(sourcedLead.structured.parts, 'source');
  assert.equal(sourcedLead.structured.preferredDate, undefined);

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${base}/pc`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}px`);
    await page.locator('.pc-mobile-cta a[href="#request"]').click();
    assert.ok(await form.isVisible());
    await page.screenshot({ path: `${artifacts}/mobile-${width}-form.png` });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${artifacts}/mobile-${width}.png`, fullPage: true });
  }
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noJs.newPage();
  await staticPage.goto(`${base}/pc`);
  assert.match(await staticPage.locator('main').innerText(), /Apple Genius/);
  assert.ok(await staticPage.locator('a[href="tel:+19132833826"]').count());
  assert.ok(await staticPage.locator('#service-details').isVisible());
  const uppercase = await context.request.get(`${base}/PC?utm_source=case-test`, { maxRedirects: 0 });
  assert.equal(uppercase.status(), 308);
  assert.match(uppercase.headers().location, /\/pc\?utm_source=case-test$/);
  for (const path of ['/services', '/start', '/', '/sitemap.xml', '/llms.txt', '/llms-full.txt', '/api/agent/pc']) {
    const result = await context.request.get(base + path);
    assert.equal(result.status(), 200, path); assert.match(await result.text(), /\/pc/, path);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, draftOnly: true, tests: ['both parts paths saved', 'failed save retains form', 'retry deduplication', 'owner outbox and customer history', 'referral retention', 'invalid parts rejected', 'mobile 390/320', 'no-JS content and call fallback', 'uppercase canonical redirect', 'public discovery'], artifacts }, null, 2));
} finally {
  await browser.close(); await db.$disconnect();
}
