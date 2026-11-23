import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';

const base = process.env.HEAT_TEST_URL || 'http://127.0.0.1:3029';
assert.match(base, /^http:\/\/127\.0\.0\.1:/, 'Test must stay local');
assert.match(process.env.DATABASE_URL || '', /127\.0\.0\.1:55439\/heatctl_test/, 'Test DB only');
const auth = { authorization: 'Bearer heatctl-test-token', 'content-type': 'application/json' };
const cookie = `heat_access=${createHmac('sha256', 'heatctl-local-test-only').update('heat:7941').digest('base64url')}`;
const source = JSON.parse(await readFile('/home/jelly/heatctl/state.json', 'utf8')).last_decision;
const event = { ...source, id: randomUUID(), ts: new Date().toISOString() };
const db = new PrismaClient();
const request = async (path, method = 'GET', body, headers = {}) => fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
try {
  assert.equal((await request('/api/heat/planner')).status, 401);
  assert.equal((await request('/api/heat/ingest', 'POST', { events: [event] })).status, 401);
  for (let i = 0; i < 2; i++) {
    const r = await request('/api/heat/ingest', 'POST', { events: [event] }, auth);
    assert.equal(r.status, 200, await r.clone().text());
    assert.deepEqual((await r.json()).event_ids, [event.id]);
  }
  assert.equal(await db.heatDecision.count({ where: { id: event.id } }), 1);
  assert.equal((await request('/api/heat/ingest', 'POST', { events: [{ ...event, id: randomUUID(), inputs: { token: 'reject-me' } }] }, auth)).status, 400);
  const view = await request('/api/heat/planner', 'GET', undefined, { cookie });
  assert.equal(view.status, 200); assert.equal((await view.json()).latest.mode, 'shadow');
  assert.equal((await request('/api/heat/commands', 'POST', { action: 'warm' }, { cookie, origin: 'https://evil.example', 'content-type': 'application/json' })).status, 403);
  assert.equal((await request('/api/heat/commands', 'POST', { action: 'live' }, { cookie, origin: base, 'content-type': 'application/json' })).status, 400);
  const command = await request('/api/heat/commands', 'POST', { action: 'warm', target_f: 71, hours: 2 }, { cookie, origin: base, 'content-type': 'application/json' });
  assert.equal(command.status, 202, await command.clone().text());
  const commandId = (await command.json()).id;
  const commands = await request('/api/heat/commands', 'GET', undefined, auth);
  assert.ok((await commands.json()).commands.some(c => c.id === commandId));
  const ack = { id: randomUUID(), ts: new Date().toISOString(), kind: 'command_ack', mode: 'shadow', season: 'heat', command_id: commandId, result: 'accepted_shadow' };
  assert.equal((await request('/api/heat/ingest', 'POST', { events: [ack] }, auth)).status, 200);
  assert.equal((await db.heatCommand.findUnique({ where: { id: commandId } })).status, 'accepted_shadow');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addCookies([{ name: 'heat_access', value: cookie.split('=')[1], url: base }]);
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/heat', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Crazy Monkey planner' }).waitFor();
    await page.getByText('heat · shadow', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole('button', { name: 'Warm now', exact: true }).click();
    await page.getByText('Queued for Spark.', { exact: false }).waitFor();
    await page.screenshot({ path: '/tmp/heat-planner-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  console.log('PASS: local authenticated ingestion, idempotency, secret rejection, CSRF, command ack, shadow UI, mobile/desktop overflow and browser errors.');
} finally { await db.$disconnect(); }
