// Run against an isolated local server with DAY_TEST_PIN supplied in memory.
// Screenshots contain only synthetic fixtures and are written to RAM.
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
const base = process.env.DAY_TEST_BASE || 'http://localhost:3027';
if (!process.env.DAY_TEST_PIN) throw new Error('DAY_TEST_PIN required');
const browser = await (process.env.DAY_TEST_WEBKIT ? webkit : chromium).launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  const errors = []; page.on('pageerror', e => errors.push(e.name));
  await page.goto(`${base}/day`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.getByRole('heading', { name: 'A clear start.' }).waitFor();
  await page.waitForLoadState('networkidle', { timeout: 120000 });
  const html = await page.content(); assert.doesNotMatch(html, /W\/D MRR|Seller alerts/);
  assert.match(await page.locator('link[rel="manifest"]').getAttribute('href'), /day\/manifest/);
  assert.equal(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content'), 'yes');
  assert.equal((await context.request.get(`${base}/api/day`)).status(), 401);
  assert.equal((await context.request.get(`${base}/day/summary.txt`)).status(), 401);
  await page.screenshot({ path: '/dev/shm/day-lock-mobile.png', fullPage: true });
  await page.getByLabel('Family PIN').fill(process.env.DAY_TEST_PIN);
  await page.getByRole('button', { name: 'Open my day' }).click();
  await page.getByRole('heading', { name: 'Your day, at a glance' }).waitFor({ timeout: 60000 });
  const stub = name => ({ status: 'stub', source: name, note: 'No verified read connection is available.', metrics: [], items: [] });
  const live = (source, metrics, items = []) => ({ status: 'live', source, note: 'Synthetic browser fixture. No customer data.', metrics: metrics.map(([label, value]) => ({ label, value })), items });
  const snapshot = { version: 1, generatedAt: new Date().toISOString(), day: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date()), sections: {
    stripe: live('Stripe · USD', [['W/D MRR', '$1,276.00'], ['Today’s income', '$246.00'], ['W/D past-dues', '$116.00']], ['2 overdue invoices · 2 past-due subscriptions']),
    cleanouts: live('Tolley saved cleanout inquiries', [['New today', '3']]),
    pay: stub('tolley-pay'), mls: live('/leads/digest', [['Seller alerts', '18']], ['91/100 · Sample property', '86/100 · Example property', '82/100 · Demo property']),
    whatnot: stub('Saved Whatnot show ledger'), calendar: stub('Calendar'),
  }};
  await page.route('**/api/day', route => route.fulfill({ json: { snapshot, storage: 'ready' } }));
  await page.getByRole('button', { name: 'Refresh', exact: false }).click();
  await page.getByText('$1,276.00').waitFor();
  for (const [name, width, height] of [['iphone', 390, 844], ['small-phone', 375, 667], ['desktop', 1536, 1100]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `${name}: horizontal overflow`);
    assert.equal(await page.locator('.day-card').count(), 6);
    await page.getByText('$1,276.00').waitFor();
    await page.screenshot({ path: `/dev/shm/day-${name}.png`, fullPage: true });
  }
  await page.unroute('**/api/day');
  const denied = await context.request.post(`${base}/api/day`, { headers: { Origin: 'https://example.invalid', 'Content-Type': 'application/json' }, data: {} });
  assert.equal(denied.status(), 403);
  const refreshed = await context.request.post(`${base}/api/day`, { headers: { Origin: base, 'Content-Type': 'application/json' }, data: {} });
  assert.equal(refreshed.status(), 200);
  const saved = await refreshed.json(); assert.equal(saved.storage, 'ready');
  console.log('Live pull and durable save:', Object.fromEntries(Object.entries(saved.snapshot.sections).map(([k,v]) => [k,v.status])));
  const cached = await (await context.request.get(`${base}/api/day`)).json(); assert.equal(cached.snapshot.generatedAt, saved.snapshot.generatedAt);
  const text = await context.request.get(`${base}/day/summary.txt`); assert.equal(text.status(), 200); assert.equal((await text.text()).trim().split('\n').length, 3); assert.match(text.headers()['cache-control'], /private.*no-store/);
  const fresh = await browser.newContext();
  const token = await fresh.request.get(`${base}/day/summary.txt`, { headers: { Authorization: 'Bearer local-synthetic-token' } }); assert.equal(token.status(), 200);
  assert.equal((await fresh.request.get(`${base}/api/day`, { headers: { Authorization: 'Bearer local-synthetic-token' } })).status(), 401);
  assert.equal((await fresh.request.get(`${base}/api/cron/day-snapshot`)).status(), 401);
  assert.deepEqual(errors, []);
  await fresh.close(); await context.close();
  console.log('Day browser: PIN, private responses, mobile/desktop layout, refresh, durable reread and Siri passed.');
} finally { await browser.close(); }
