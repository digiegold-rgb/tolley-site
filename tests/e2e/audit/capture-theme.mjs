/**
 * Supplementary READ-ONLY capture: light-theme and collapsed-sidebar shots for
 * every studio route, plus a per-route sidebar-nav enumeration.
 *
 * The main animate.spec.ts sweep runs its theme/sidebar helpers immediately
 * after networkidle, before the studio chrome has hydrated, so its themeB shots
 * can duplicate themeA. This pass waits for hydration and is purely additive —
 * it performs no writes (no non-GET request is ever issued) and only clicks the
 * theme toggle and the sidebar collapse chevron.
 *
 * Usage:
 *   set -a; . ~/.config/tolley-audit.env; set +a
 *   AUDIT_OUT_DIR=/home/jelly/Shared/site-audit/2026-08-15/baseline \
 *     node tests/e2e/audit/capture-theme.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://www.tolley.io';
const OUT = join(process.env.AUDIT_OUT_DIR || '/home/jelly/Shared/site-audit/2026-08-15/baseline', 'animate');
const SHOTS = join(OUT, 'shots');
const E = process.env.AUDIT_ANIMATE_EMAIL, P = process.env.AUDIT_ANIMATE_PASSWORD;
const SETTLE = 2500;

const ROUTES = ['dashboard','direct','script-review','library','queue','recent','voices','feeds',
  'autopilot','publishing','niche-finder','styles','project-history','video-editor','course',
  'rules','pricing','discord'];

mkdirSync(SHOTS, { recursive: true });

const FP = () => (() => {
  const t = (c) => !c || c === 'transparent' || /rgba\(0, 0, 0, 0\)/.test(c);
  let el = document.elementFromPoint(Math.floor(innerWidth * 0.65), Math.floor(innerHeight * 0.5)), bg = '';
  while (el) { const c = getComputedStyle(el).backgroundColor; if (!t(c)) { bg = c; break; } el = el.parentElement; }
  const side = window.__findSidebar();
  return { bg, sidebarWidth: side ? Math.round(side.getBoundingClientRect().width) : null };
})();

const NAVS = () => (() => {
  const side = window.__findSidebar();
  if (!side) return [];
  const out = [];
  for (const el of Array.from(side.querySelectorAll('div'))) {
    const s = el.getAttribute('style') || '';
    if (!s.includes('cursor: pointer')) continue;
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 40 || out.includes(t)) continue;
    out.push(t);
  }
  return out;
})();

/**
 * Shared in-page helpers, installed on every document.
 *
 * `__findSidebar` returns the TALLEST left-anchored column (the sidebar root).
 * Taking the first match instead returns the inner nav column, which excludes
 * the header row holding the collapse chevron.
 *
 * `__clickTheme` picks the header's round pointer buttons (bell, theme toggle,
 * avatar) and clicks the second from the left — the sun/moon. A direct DOM
 * click is used rather than Playwright's actionability-checked click, which
 * times out against these unlabelled divs.
 */
const INIT = () => {
  window.__findSidebar = () => {
    let best = null;
    for (const e of Array.from(document.querySelectorAll('div'))) {
      const r = e.getBoundingClientRect();
      if (r.left <= 2 && r.width >= 56 && r.width <= 320 && r.height > window.innerHeight * 0.5) {
        if (!best || r.height > best.getBoundingClientRect().height) best = e;
      }
    }
    return best;
  };
  window.__clickTheme = () => {
    const btns = Array.from(document.querySelectorAll('div'))
      .filter((e) => {
        const s2 = e.getAttribute('style') || '';
        const r = e.getBoundingClientRect();
        return s2.includes('border-radius: 50%') && s2.includes('cursor: pointer')
          && s2.includes('padding: 8px') && r.top < 140 && r.width > 0;
      })
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    if (btns.length < 2) return false;
    btns[1].click();
    return true;
  };
};

const CLICK_THEME = () => window.__clickTheme();

const b = await chromium.launch();
const ctx = await b.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(INIT);

// Defence in depth: this pass must never write. Fulfil any non-GET /api/** locally.
await page.route('**/api/**', async (route) => {
  const m = route.request().method().toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue();
  if (/\/api\/auth\/(callback|csrf|session|signin)/.test(route.request().url())) return route.continue();
  console.log(`[capture-guard] BLOCKED ${m} ${route.request().url()}`);
  return route.fulfill({ status: 204, body: '' });
});

await page.goto('/login?callbackUrl=%2Fanimate', { waitUntil: 'domcontentloaded' });
await page.locator('input[type=email]').first().fill(E);
await page.locator('input[type=password]').first().fill(P);
await page.locator('button[type=submit]').first().click();
await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 60000 });

const round = 'div[style*="border-radius: 50%"][style*="cursor: pointer"]';
const results = [];

for (const r of ROUTES) {
  const path = r === 'dashboard' ? '/animate' : `/animate#r=${r}`;
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(SETTLE);

  const dark = await page.evaluate(FP);
  const navs = await page.evaluate(NAVS);
  await page.screenshot({ path: join(SHOTS, `public-${r}-dark@desktop.png`), fullPage: true }).catch(() => {});

  // light theme
  let light = null;
  try {
    const clicked = await page.evaluate(CLICK_THEME);
    await page.waitForTimeout(1200);
    light = clicked ? await page.evaluate(FP) : { error: 'theme toggle not found' };
    if (clicked) {
      await page.screenshot({ path: join(SHOTS, `public-${r}-light@desktop.png`), fullPage: true }).catch(() => {});
      await page.evaluate(CLICK_THEME); // restore dark
      await page.waitForTimeout(600);
    }
  } catch (e) { light = { error: String(e).split('\n')[0] }; }

  // collapsed sidebar
  let collapsed = null;
  try {
    const did = await page.evaluate(() => {
      const side = window.__findSidebar();
      if (!side) return false;
      for (const el of Array.from(side.querySelectorAll('div'))) {
        const s = el.getAttribute('style') || '';
        if (!s.includes('cursor: pointer')) continue;
        if ((el.textContent || '').trim()) continue;
        if (!el.querySelector('svg')) continue;
        el.click(); return true;
      }
      return false;
    });
    await page.waitForTimeout(900);
    collapsed = did ? await page.evaluate(FP) : { error: 'chevron not found' };
    if (did) await page.screenshot({ path: join(SHOTS, `public-${r}-sidebar-collapsed@desktop.png`), fullPage: true }).catch(() => {});
  } catch (e) { collapsed = { error: String(e).split('\n')[0] }; }

  const row = { route: r, dark, light, collapsed, navCount: navs.length, navs };
  results.push(row);
  console.log(`[capture] ${r} dark=${dark.bg} light=${light?.bg ?? light?.error} sidebar=${dark.sidebarWidth}->${collapsed?.sidebarWidth ?? collapsed?.error} navs=${navs.length}`);
}

writeFileSync(join(OUT, 'theme-sidebar-capture.json'), JSON.stringify(results, null, 2));
console.log(`[capture] wrote ${join(OUT, 'theme-sidebar-capture.json')}`);
await b.close();
