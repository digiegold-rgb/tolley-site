// Run only against the isolated test app: REVENUE_TEST_URL=http://127.0.0.1:3018 node tests/revenue-repair.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
const base = process.env.REVENUE_TEST_URL;
if (base !== 'http://127.0.0.1:3018' || !process.env.DATABASE_URL?.includes('127.0.0.1:55438/tolley_revenue_test')) {
  throw new Error('Tests require the isolated localhost app and database.');
}
const p = new PrismaClient();
const browser = await chromium.launch({ headless: true });
const poolSku = `revenue-test-${crypto.randomUUID()}`;
try {
  await p.poolProduct.create({ data: { sku: poolSku, name: 'Hydration test pool filter', category: 'Equipment', price: 58, retailPrice: 79, brand: 'Test', stockStatus: 'in_stock', specs: 'Test specification' } });
  const requestId = crypto.randomUUID();
  const payload = { requestId, subsite: 'wd', action: 'request_wd_quote', contact: { name: 'Test customer', email: `${requestId}@example.invalid` }, fields: { zip: '64052', unit_type: 'bundle' } };
  const submit = () => fetch(base + '/api/lead/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const [r1, r2] = await Promise.all([submit(), submit()]);
  assert.equal(r1.status, 200, await r1.text().then(t => t.slice(0,200)));
  assert.equal(r2.status, 200);
  const leads = await p.leadAction.findMany({ where: { email: `${requestId}@example.invalid` } });
  assert.equal(leads.length, 1);
  assert.equal(await p.leadNotification.count({ where: { leadId: leads[0].id } }), 2);
  assert.equal((await fetch(base + '/api/hq/business')).status, 401);
  assert.equal((await fetch(base + '/api/admin/persona', { headers: { authorization: 'Bearer %' } })).status, 401);
  const anonymousSession = await fetch(base + '/api/auth/session');
  assert.equal(anonymousSession.status, 200);
  assert.equal(await anonymousSession.json(), null);
  assert.equal((await fetch(base + '/api/cron/lead-notifications')).status, 401);
  const login = await fetch(base + '/api/wd/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: 'revenue-test-admin-only' }) });
  assert.equal(login.status, 200, 'Run the isolated server with WD_ADMIN_PIN_TOLLEY=revenue-test-admin-only');
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const business = await fetch(base + '/api/hq/business', { headers: { cookie } });
  assert.equal(business.status, 200);
  const summary = await business.json();
  assert.ok(summary.inbound.some(row => row.subsite === 'wd' && row._count._all > 0));
  assert.equal(summary.margin, null, 'missing cost reconciliation must not produce a profit claim');
  const inbox = await fetch(base + '/api/hq/inbound?subsite=wd', { headers: { cookie } });
  assert.equal(inbox.status, 200);
  assert.equal((await inbox.json()).leads.find(row => row.id === leads[0].id).notifications.length, 2);
  assert.equal((await fetch(base + '/api/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'event', site: 'wd', path: '/wd', event: 'payment_confirmed' }) })).status, 400);
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const hydrationErrors = [];
  context.on('page', page => page.on('pageerror', error => {
    if (/hydration|hydrating|Minified React error #418/i.test(error.message)) hydrationErrors.push(error.message);
  }));
  await context.route('**/*', route => {
    const req = route.request();
    if (!req.url().startsWith(base) && !req.url().startsWith('data:')) return route.abort();
    if (req.method() === 'POST') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"simulated"}' });
    return route.continue();
  });
  for (const width of [360, 390, 430]) {
    const page = await context.newPage(); await page.setViewportSize({ width, height: 900 });
    for (const path of ['/estate', '/leads/pricing']) {
      await page.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} overflow at ${width}`);
    }
    await page.close();
  }
  const page = await context.newPage(); await page.goto(base + '/wd', { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByPlaceholder('Your name *', { exact: true }).fill('Test');
  await page.getByPlaceholder('Email address', { exact: true }).fill('browser@example.invalid');
  await page.getByLabel('Delivery ZIP', { exact: true }).fill('64052');
  await page.getByRole('button', { name: 'Get My Free Quote', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Your request was not saved' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'We Got Your Info!' }).count(), 0);
  assert.equal(await page.getByPlaceholder('Your name *', { exact: true }).inputValue(), 'Test');
  await page.getByPlaceholder('you@email.com').fill('browser@example.invalid');
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => localStorage.getItem('wd_email_captured')), null);
  await page.goto(base + '/pools', { waitUntil: 'networkidle', timeout: 120000 });
  assert.deepEqual(hydrationErrors, [], 'public pages must hydrate without errors');
  console.log('PASS: durable capture, deduplication, notification queue, auth, mobile widths, and failed-form retry.');
} finally { await browser.close(); await p.poolProduct.deleteMany({ where: { sku: poolSku } }); await p.$disconnect(); }
