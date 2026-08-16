import { chromium } from '@playwright/test';
const b = await chromium.launch(); const OUT = process.argv[2];
for (const [w,h,tag] of [[1440,900,'desk'],[390,844,'phone']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  const errs=[]; p.on('pageerror', e => errs.push(e.message));
  for (const [n, u] of [['login','/login?callbackUrl=%2Fanimate'],['signup','/signup?callbackUrl=%2Fanimate'],['landing','/animate']]) {
    await p.goto('http://localhost:3057'+u, { waitUntil: 'networkidle', timeout: 90000 }); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/auth-${n}-${tag}.png` });
  }
  console.log(tag, 'errors:', errs.join(' | ') || 'none');
}
await b.close();
