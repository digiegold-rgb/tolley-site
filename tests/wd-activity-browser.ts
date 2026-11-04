import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { snapshotSchema } from '../lib/wd-activity/core';
const base = 'http://127.0.0.1:3027';
if (process.env.DATABASE_URL !== 'postgresql://postgres@127.0.0.1:55438/tolley_route_test') throw Error('Use the isolated route test database');
async function run() {
  const db = new PrismaClient();
  try {
    const response = await fetch(base + '/api/wd/activity'); assert.equal(response.status, 200);
    const snapshot = snapshotSchema.parse(await response.json()); assert.ok(snapshot.events.length > 0);
    assert.equal((await fetch(base + '/wd/activity', { redirect: 'manual' })).status, 200);
    for (const path of ['/api/wd/clients', '/api/wd/repairs', '/api/wd/messages']) assert.equal((await fetch(base + path)).status, 401, path);
    assert.equal((await fetch(base + '/api/wd/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 405);
    // Prove that even an accidental contaminated stored snapshot fails closed.
    const bad = JSON.stringify({ ...snapshot, exactAddress: '123 PRIVATE-CANARY ST', profit: 987654 });
    await db.$executeRaw`UPDATE "WdActivitySnapshot" SET payload = ${bad}::jsonb WHERE id = 'current'`;
    try { const denied = await fetch(base + '/api/wd/activity'); assert.equal(denied.status, 503); assert.ok(!(await denied.text()).includes('PRIVATE-CANARY')); }
    finally { const clean = JSON.stringify(snapshot); await db.$executeRaw`UPDATE "WdActivitySnapshot" SET payload = ${clean}::jsonb WHERE id = 'current'`; }
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors: string[] = [], privateFetches: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => { if (/\/api\/wd\/(clients|repairs|messages|stripe)/.test(r.url())) privateFetches.push(r.url()); });
      await page.goto(base + '/wd/activity', { waitUntil: 'networkidle', timeout: 120000 });
      await page.getByRole('heading', { name: 'Every rental, in perspective.' }).waitFor();
      await page.locator('.route-month').first().waitFor();
      await page.screenshot({ path: '/tmp/tolley-wd-calendar.png', fullPage: false });
      await page.locator('.route-day').filter({ has: page.locator('small') }).first().click();
      await page.locator('#wd-day-details tbody tr').first().waitFor();
      await page.getByRole('button', { name: 'Map', exact: true }).click(); await page.locator('.leaflet-interactive').first().waitFor();
      await page.locator('.route-map').scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
      await page.screenshot({ path: '/tmp/tolley-wd-map.png', fullPage: false });
      await page.getByLabel('Map measure').selectOption('rentals'); await page.locator('.leaflet-interactive').first().waitFor();
      await page.getByRole('button', { name: 'Rentals', exact: true }).click(); assert.ok(await page.locator('tbody tr').count() > 0);
      await page.getByRole('button', { name: 'Repairs', exact: true }).click(); await page.getByRole('heading', { name: 'The maintenance toolkit' }).waitFor();
      await page.screenshot({ path: '/tmp/tolley-wd-repairs.png', fullPage: false });
      await page.getByLabel('First name or city').fill('zznonexistent'); await page.getByText('No service notes match this selection.').waitFor();
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      const download = page.waitForEvent('download'); await page.getByRole('button', { name: /Export activity/ }).click(); const file = await download; assert.equal(file.suggestedFilename(), 'wash-dry-activity.csv');
      assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'), 'https://www.tolley.io/wd/activity/share');
      const image = await fetch(base + '/wd/activity/share'); assert.equal(image.status, 200); assert.match(image.headers.get('content-type') || '', /image\/png/); fs.writeFileSync('/tmp/tolley-wd-share.png', Buffer.from(await image.arrayBuffer()));
      await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Calendar', exact: true }).click();
      await page.screenshot({ path: '/tmp/tolley-wd-mobile.png', fullPage: false });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no mobile overflow');
      assert.deepEqual(errors, []); assert.deepEqual(privateFetches, []);
      console.log('PASS: public calendar/map/rentals/repairs, CSV, rich preview, mobile, no private API fetches, private API gates and contaminated-snapshot rejection');
    } finally { await browser.close(); }
  } finally { await db.$disconnect(); }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
