import { chromium } from '@playwright/test';
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://localhost:3057/animate', { waitUntil: 'networkidle' });
const h = await p.evaluate(() => document.documentElement.scrollHeight);
console.log('height', h);
let i = 0;
for (let y = 0; y < h; y += 850) {
  await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(700);
  await p.screenshot({ path: `${process.argv[2]}/scroll-${String(i++).padStart(2,'0')}.png` });
}
const op = await p.evaluate(() => [...document.querySelectorAll('.jc-rise')].map(e => getComputedStyle(e).opacity));
console.log('rise opacities', op.join(','));
await b.close();
