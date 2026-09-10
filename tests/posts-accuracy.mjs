// Destructive fixtures are restricted to the disposable revenue test database.
import assert from 'node:assert/strict';
import { createOwnerSession } from './helpers/owner-session.mjs';
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';

const base = process.env.REVENUE_TEST_URL;
if (base !== 'http://127.0.0.1:3018' || !process.env.DATABASE_URL?.includes('127.0.0.1:55438/tolley_revenue_test')) throw new Error('Isolated test app/database required');
const p = new PrismaClient();
let owner;
const day = 86400000, now = Date.now(), today = Math.floor(now / day) * day;
const sync = { 'x-sync-secret': 'posts-test-sync-only', 'Content-Type': 'application/json' };
let browser;
try {
  await p.channelViewStat.deleteMany();
  await p.channelVideoStat.deleteMany();
  await p.postLogEntry.deleteMany();
  await p.videoCost.deleteMany();
  owner = await createOwnerSession(p, base);
  const cookie = owner.cookie;
  const read = async path => {
    const response = await fetch(base + path, { headers: { cookie } });
    assert.equal(response.status, 200, path);
    return response.json();
  };
  for (const path of ['/api/hq/video-views', '/api/hq/view-counter', '/api/hq/post-log', '/api/hq/video-costs']) {
    assert.equal((await fetch(base + path)).status, 401, path + ' anonymous');
  }
  assert.equal((await fetch(base + '/api/hq/video-views', { headers: sync })).status, 200, 'collector can read tracked IDs');
  const event = { job: 'accuracy-test', runId: 'accuracy-run', title: 'City A', entries: [{ channel: 'pin', account: 'homes', status: 'ok', url: 'https://example.invalid/a', costCents: 21 }] };
  const post = async payload => {
    const r = await fetch(base + '/api/hq/post-log', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal(r.status, 200);
    return r.json();
  };
  const retries = await Promise.all([post(event), post(event), post(event)]);
  assert.equal(retries.reduce((n, r) => n + r.written, 0), 1, 'concurrent retry writes once');
  assert.equal((await post({ ...event, title: 'City B' })).written, 1, 'different titles remain distinct');
  assert.equal((await post({ ...event, entries: [{ ...event.entries[0], url: 'https://example.invalid/b' }] })).written, 1, 'different links remain distinct');
  assert.equal((await post({ ...event, entries: [{ ...event.entries[0], status: 'fail', error: 'test failure' }] })).written, 1, 'failure remains visible');
  const original = await p.postLogEntry.findFirst({ where: { title: 'City A', status: 'ok', url: 'https://example.invalid/a' } });
  const { id: _id, createdAt: _created, ...legacy } = original;
  await p.postLogEntry.create({ data: { ...legacy, id: 'legacy-exact-repeat' } });
  const reports = await read('/api/hq/post-log?days=1');
  assert.equal(reports.summary.rawRecords, 5);
  assert.equal(reports.summary.duplicateRecords, 1);
  assert.equal(reports.summary.posts, 4);
  assert.equal(reports.summary.ok, 3);
  assert.equal(reports.summary.failed, 1);
  assert.equal(reports.summary.publicationLinks, 2);
  assert.equal(reports.summary.costCents, 84);
  assert.equal(await p.postLogEntry.count(), 5, 'legacy data is preserved');

  await p.channelViewStat.createMany({ data: Array.from({ length: 30 }, (_, i) => ({ channelKey: 'yt-dgold', day: new Date(today - (i + 1) * day), dayViews: i === 0 ? 0 : 10, pulledAt: new Date(now) })) });
  await p.channelVideoStat.create({ data: { channelKey: 'fb-wd', videoId: 'old-cohort-only', title: 'Old upload', publishedAt: new Date(now - 5 * day), views: 9000n, pulledAt: new Date(now - 10 * day) } });
  let views = await read('/api/hq/view-counter');
  assert.equal(views.totals.d30.views, 290);
  assert.equal(views.totals.d30.partial, true, 'missing channels leave aggregate partial');
  assert.equal(views.channels.find(c => c.key === 'fb-wd').windows.d30.views, null, 'upload lifetime views never become period activity');
  assert.equal(views.channels.find(c => c.key === 'yt-dgold').windows.d30.partial, false);

  const push = await fetch(base + '/api/hq/view-counter', { method: 'POST', headers: sync, body: JSON.stringify([
    { channelKey: 'fb-wd', videoId: 'old-cohort-only', publishedAt: new Date(now - 5 * day).toISOString(), views: null },
    { channelKey: 'yt-dgold', day: new Date(today).toISOString(), totalViews: -1 },
    { channelKey: 'yt-dgold', videoId: 'zero-valid', title: 'Valid zero', publishedAt: new Date(now).toISOString(), views: 0 },
  ]) });
  assert.equal(push.status, 200);
  assert.deepEqual(await push.json(), { ok: true, upserted: 0, videos: 1, skipped: 2 });
  const videos = await read('/api/hq/video-views');
  assert.equal(videos.staleVideos, 1);
  assert.equal(videos.totalViews, 9000);
  assert.equal(videos.freshViews, 0, 'fresh zero is distinct from missing');
  assert.equal(videos.videos.find(v => v.videoId === 'old-cohort-only').views, 9000, 'null must not erase old known count');
  await p.videoCost.createMany({ data: [
    { videoKey: 'test-posted', pipeline: 'shorts', status: 'posted', estimated: true, clipsCents: 100, renderedAt: new Date(now) },
    { videoKey: 'test-draft', pipeline: 'shorts', status: 'rendered', estimated: true, clipsCents: 50, renderedAt: new Date(now) },
    { videoKey: 'test-overhead', pipeline: 'overhead', estimated: true, clipsCents: 25, renderedAt: new Date(now) },
  ] });
  const costs = await read('/api/hq/video-costs');
  assert.equal(costs.grandTotalCents, 175);
  assert.equal(costs.videoCount, 2);
  assert.equal(costs.postedCount, 1);
  assert.equal(costs.draftCount, 1);
  assert.equal(costs.reconciled, false);
  assert.ok(costs.lastSyncedAt);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  await context.addCookies(cookie.split('; ').map(pair => {
    const index = pair.indexOf('=');
    return { name: pair.slice(0, index), value: pair.slice(index + 1), url: base };
  }));
  await context.route('**/*', route => {
    const req = route.request();
    if (!req.url().startsWith(base) && !req.url().startsWith('data:')) return route.abort();
    if (req.method() !== 'GET' || req.url().includes('/api/hq/ads-status')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"disabled in isolated test"}' });
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/hq?tab=posts', { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByText('RECORDED VIDEO COSTS · INCOMPLETE LEDGER', { exact: true }).waitFor();
  await page.getByText(/3 reported successes/).waitFor();
  await page.getByText(/Recorded view activity/).waitFor();
  await page.getByText('Tracked videos — stored view counts', { exact: true }).waitFor();
  assert.deepEqual(errors, [], 'Posts dashboard must render without client errors');
  await page.screenshot({ path: '/tmp/tolley-posts-isolated.png', fullPage: true });
  await p.channelViewStat.deleteMany();
  views = await read('/api/hq/view-counter');
  assert.equal(views.totals.d30.views, null, 'no data must never display a zero total');
  console.log('PASS: concurrent idempotency, distinct publications, preserved legacy rows, auth, complete/partial/unknown windows, invalid-metric rejection, cost scope, browser rendering.');
} finally {
  await owner?.cleanup();
  await browser?.close();
  await p.$disconnect();
}
