import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3057'; const OUT = process.argv[2];
const E = process.env.AUDIT_ANIMATE_EMAIL, P = process.env.AUDIT_ANIMATE_PASSWORD;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await page.route('**/api/**', async (route) => {
  const m = route.request().method().toUpperCase();
  if (['GET','HEAD','OPTIONS'].includes(m)) return route.continue();
  if (/\/api\/auth\/(callback|csrf|session|signin)/.test(route.request().url())) return route.continue();
  return route.fulfill({ status: 204, body: '' });
});
await page.route('**/api/vater/me**', async (route) => {
  const res = await route.fetch(); let j = {}; try { j = await res.json(); } catch {}
  j.beta = { ...(j.beta || {}), accessAllowed: true, termsAccepted: true, invited: true };
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
});
await page.goto(BASE + '/login?callbackUrl=%2Fanimate', { waitUntil: 'domcontentloaded' });
await page.locator('input[type=email]').first().fill(E);
await page.locator('input[type=password]').first().fill(P);
await page.locator('button[type=submit]').first().click();
await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 90000 });
const ROUTES = ['voices','direct','queue','course','rules'];
for (const theme of ['dark']) {
  for (const r of ROUTES) {
    await page.goto(BASE + (r === 'dashboard' ? '/animate' : `/animate#r=${r}`), { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    if (theme === 'light') {
      const cur = await page.evaluate(() => localStorage.getItem('jelly.theme'));
      if (cur !== 'light') { await page.locator('[data-testid=theme-toggle]').first().click().catch(()=>{}); await page.waitForTimeout(600); }
    }
    const ov = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    await page.screenshot({ path: `${OUT}/studio-${r}-${theme}.png` });
    console.log(r, theme, 'overflow=' + ov);
  }
}
// phone dashboard
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + '/animate', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/studio-dashboard-phone.png` });
console.log('errors:', errs.slice(0, 8).join(' | ') || 'none');
await b.close();
