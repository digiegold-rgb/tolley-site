import { chromium } from '@playwright/test';
const BASE = process.env.WALKTHROUGH_BASE_URL || 'http://localhost:3057';
const PASS = process.env.WALKTHROUGH_QA_PASSWORD;
const SHOTS = process.env.WALKTHROUGH_SHOTS || '/tmp/walkthrough-shots';
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.setDefaultTimeout(60000);
for (let i = 1; i <= 3; i++) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').first().fill('qa.walkthrough.0820@tolley.io');
  await page.locator('input[type=password]').first().fill(PASS);
  await page.locator('button[type=submit]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {});
  await page.goto(`${BASE}/animate`, { waitUntil: 'networkidle' });
  if (!(await page.getByRole('link', { name: 'Sign in' }).count())) break;
}
await page.waitForSelector('.animate-shell', { timeout: 60000 });
await page.getByText('Styles', { exact: true }).first().click();
const edit = page.getByRole('link', { name: /^Edit$/ }).first();
await edit.waitFor({ state: 'visible', timeout: 60000 });
await edit.click();
const adv = page.getByRole('button', { name: /^Advanced$/ }).first();
await adv.waitFor({ state: 'visible', timeout: 60000 });
await adv.click();
await page.waitForTimeout(4000);
const path = new URL(page.url()).pathname;
await page.screenshot({ path: `${SHOTS}/cl-05-advanced.png`, fullPage: false });
console.log(path === '/animate' ? '✓ Advanced editor stayed in-studio' : `✗ ESCAPED to ${path}`);
await b.close();
