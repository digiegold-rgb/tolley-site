import { chromium } from 'playwright-core';

// Read existing account sessions. No login automation, posts, or pin actions.
const [sessionDir, label] = process.argv.slice(2);
if (!sessionDir || !['homes', 'hauls'].includes(label)) throw new Error('Session directory and account label required');
let context;
try {
  context = await chromium.launchPersistentContext(sessionDir, {
    executablePath: process.env.PINTEREST_CHROMIUM || '/snap/bin/chromium',
    headless: true, viewport: { width: 1600, height: 1400 },
    args: ['--disable-dev-shm-usage'],
  });
  const page = await context.newPage();
  const pending = [];
  const bodies = [];
  page.on('response', response => {
    if (!response.url().includes('/_/graphql/')) return;
    pending.push(response.json().then(j => bodies.push(j)).catch(() => {}));
  });
  await page.goto('https://analytics.pinterest.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(12000);
  for (const y of [500, 1200, 2000]) { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(2000); }
  await Promise.all(pending);
  const byDay = new Map();
  let dataStatus = null;
  for (const body of bodies) {
    for (const series of body?.data?.v3AnalyticsMetricsGraphqlQuery?.data ?? []) {
      for (const row of series.series?.dailyMetrics ?? []) {
        const value = row.metrics?.impressionFloat;
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && row.date) byDay.set(row.date, Math.round(value));
        if (row.dataStatus) dataStatus = row.dataStatus;
      }
    }
  }
  const captured = byDay.size > 0;
  console.log(JSON.stringify({ label, captured, dataStatus, byDay: [...byDay].sort().map(([date, impressions]) => ({ date, impressions })), impressions30d: captured ? [...byDay.values()].reduce((a,b)=>a+b,0) : null }));
  if (!captured) { console.error('Pinterest analytics unavailable: account login or metric access needs attention. Existing counts preserved.'); process.exitCode = 3; }
} catch {
  console.error('Pinterest browser collection failed; existing counts preserved. Check browser availability and account session.');
  process.exitCode = 2;
} finally { await context?.close(); }
