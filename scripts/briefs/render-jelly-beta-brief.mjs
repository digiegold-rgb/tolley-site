import { chromium } from 'playwright';
const SRC = 'file:///home/jelly/tolley-site/scripts/briefs/jelly-beta-launch-2026-08.html';
const OUT = '/home/jelly/tolley-site/public/research/jelly-beta-launch-2026-08.pdf';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 1200 } });
await p.goto(SRC, { waitUntil: 'networkidle' });
await p.emulateMedia({ media: 'print' });
const fit = await p.evaluate(() => {
  const LIMIT = 11 * 96;
  return [...document.querySelectorAll('.page')].map((el, i) => ({
    page: i + 1,
    h: Math.round(el.getBoundingClientRect().height),
    over: Math.round(el.getBoundingClientRect().height - LIMIT),
    clipped: el.scrollHeight > el.clientHeight + 1,
  }));
});
console.table(fit);
const bad = fit.filter(f => f.over > 0 || f.clipped);
console.log(bad.length ? 'OVERFLOW: ' + JSON.stringify(bad) : 'ALL PAGES FIT');
await p.pdf({ path: OUT, format: 'Letter', printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' } });
await b.close();
