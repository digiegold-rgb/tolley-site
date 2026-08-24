import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3057';
const PASS = process.env.WALKTHROUGH_QA_PASSWORD;
const SHOTS = process.env.WALKTHROUGH_SHOTS || '/tmp/walkthrough-shots';
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.setDefaultTimeout(90000);
for (let i = 1; i <= 3; i++) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').first().fill('qa.walkthrough.0820@tolley.io');
  await page.locator('input[type=password]').first().fill(PASS);
  await page.locator('button[type=submit]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {});
  await page.goto(`${BASE}/animate`, { waitUntil: 'networkidle' });
  if (!(await page.getByRole('link', { name: 'Sign in' }).count())) break;
}
await page.waitForSelector('.animate-shell', { timeout: 120000 });
await page.getByText('Characters', { exact: true }).first().click();
await page.locator('img[title="Click to view full screen"]')
  .first().waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOTS}/lb-00-chars.png`, fullPage: true });
const img = page.locator('img[title="Click to view full screen"]').first();
if (!(await img.count())) { console.log('✗ no clickable character image found (see lb-00-chars.png)'); await b.close(); process.exit(1); }
// Wait for the grid image to actually LOAD (streams via the authed proxy).
await page.waitForFunction(
  () => { const el = document.querySelector('img[title="Click to view full screen"]'); return !!el && el.naturalWidth > 0; },
  { timeout: 60000 },
).then(() => console.log('✓ preview image loads through the proxy'))
 .catch(() => console.log('✗ preview image never loaded'));
await img.click();
await page.waitForTimeout(4000);
await page.screenshot({ path: `${SHOTS}/lb-01-open.png` });
const open = await page.getByRole('dialog', { name: /preview|full screen|—/ }).count()
  + await page.locator('[aria-label="Close preview"]').count();
console.log(open > 0 ? '✓ lightbox opened' : '✗ lightbox did not open');
await page.keyboard.press('Escape');
await page.waitForTimeout(800);
const closed = (await page.locator('[aria-label="Close preview"]').count()) === 0;
console.log(closed ? '✓ Escape closes it' : '✗ lightbox stuck open');
await b.close();
process.exit(open > 0 && closed ? 0 : 1);
