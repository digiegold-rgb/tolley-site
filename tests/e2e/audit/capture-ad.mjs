/**
 * capture-ad.mjs — READ-ONLY screen recordings of studio routes for the Jelly! Studio ad (jelly-ad-01).
 * Fork of capture-theme.mjs: same login, same write-guard (every non-GET /api/** is fulfilled locally with 204),
 * but records a short video per route (slow scroll + hover) and a full-page PNG. Desktop 1440x900 @2x so the
 * UI reads sharp as a 9:16 inset card.
 *
 *   set -a; . ~/.config/tolley-audit.env; set +a
 *   AD_OUT_DIR=/home/jelly/growth-engine/cinema/projects/jelly-ad-01/ui node tests/e2e/audit/capture-ad.mjs [route ...]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, renameSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://www.tolley.io';
const OUT = process.env.AD_OUT_DIR || '/home/jelly/growth-engine/cinema/projects/jelly-ad-01/ui';
const E = process.env.AUDIT_ANIMATE_EMAIL, P = process.env.AUDIT_ANIMATE_PASSWORD;
if (!E || !P) { console.error('AUDIT_ANIMATE_EMAIL / AUDIT_ANIMATE_PASSWORD missing'); process.exit(2); }
const SETTLE = 2500, HOLD = 6000;

// route → segments it feeds (documentation only)
const ROUTES = {
  'script-review': 's03 s04', 'create': 's05', 'voices': 's06 s07', 'styles': 's08', 'characters': 's09 s10',
  'video-editor': 's11 s12 s14', 'shorts-library': 's16', 'publishing': 's17 s18', 'socials': 's19',
  'feeds': 's21', 'autopilot': 's21', 'pricing': 's26', 'rules': 's24', 'direct': 's23', 'api-keys': 's25',
  'discord': 's25', 'listing': 's22', 'library': 's27', 'dashboard': 's20', 'learning-center': 's15',
};
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ROUTES);
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const results = [];
for (const r of want) {
  const ctx = await b.newContext({
    baseURL: BASE, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2,
    recordVideo: { dir: join(OUT, '_raw'), size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();
  await page.route('**/api/**', async (route) => {
    const m = route.request().method().toUpperCase();
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue();
    if (/\/api\/auth\/(callback|csrf|session|signin)/.test(route.request().url())) return route.continue();
    console.log(`[capture-guard] BLOCKED ${m} ${route.request().url()}`);
    return route.fulfill({ status: 204, body: '' });
  });
  try {
    await page.goto('/login?callbackUrl=%2Fanimate', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type=email]').first().fill(E);
    await page.locator('input[type=password]').first().fill(P);
    await page.locator('button[type=submit]').first().click();
    await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 60000 });
    const path = r === 'dashboard' ? '/animate' : `/animate#r=${r}`;
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(SETTLE);
    await page.screenshot({ path: join(OUT, `${r}.png`), fullPage: true }).catch(() => {});
    // hold, then a slow scroll down and back so the recording has motion
    await page.waitForTimeout(HOLD / 2);
    const h = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (let y = 0; y <= Math.min(h, 1400); y += 40) { await page.mouse.wheel(0, 40); await page.waitForTimeout(40); }
    await page.waitForTimeout(800);
    for (let y = 0; y <= Math.min(h, 1400); y += 80) { await page.mouse.wheel(0, -80); await page.waitForTimeout(30); }
    await page.mouse.move(720, 450); await page.waitForTimeout(HOLD / 2);
    results.push({ route: r, ok: true, feeds: ROUTES[r] || '' });
    console.log(`[capture] ${r} ok`);
  } catch (e) {
    results.push({ route: r, ok: false, err: String(e).split('\n')[0] });
    console.log(`[capture] ${r} FAIL ${String(e).split('\n')[0]}`);
  }
  const v = page.video();
  await ctx.close();
  if (v) { const p = await v.path(); const dst = join(OUT, `${r}.webm`); if (existsSync(p)) renameSync(p, dst); }
}
writeFileSync(join(OUT, 'capture-results.json'), JSON.stringify(results, null, 2));
await b.close();
