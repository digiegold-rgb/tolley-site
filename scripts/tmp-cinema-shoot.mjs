import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3057';
const OUT = process.argv[2];
const b = await chromium.launch();
const pages = [
  ['landing', '/animate'], ['terms', '/animate/terms'], ['privacy', '/animate/privacy'], ['beta', '/animate/beta'], ['demo', '/animate/demo'],
];
for (const [w, h, tag] of [[1440, 900, 'desk'], [390, 844, 'phone']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  for (const [name, path] of pages) {
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 90000 }).catch(e => errs.push('NAV ' + e.message));
    await p.waitForTimeout(2500);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    await p.screenshot({ path: `${OUT}/${name}-${tag}.png`, fullPage: true });
    console.log(name, tag, 'overflow=' + overflow, errs.slice(0, 5).join(' | '));
    await p.close();
  }
  await ctx.close();
}
await b.close();
