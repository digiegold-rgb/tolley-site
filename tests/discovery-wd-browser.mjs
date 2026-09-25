import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.DISCOVERY_TEST_URL || 'http://localhost:3024';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local test only');
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  let succeed = false, payload;
  await context.route('**/api/lead/action', async route => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: succeed ? 200 : 500, contentType: 'application/json', body: JSON.stringify(succeed ? { receiptToken: 'test-inquiry' } : { error: 'Test storage failure' }) });
  });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  await page.goto(base + '/wd', { referer: 'https://chatgpt.com/', timeout: 120000 });
  const form = page.locator('form').filter({ has: page.getByPlaceholder('Your name *') });
  await form.getByPlaceholder('Your name *').fill('Test inquiry');
  await form.getByPlaceholder('Phone number').fill('555-010-1234');
  await form.getByLabel('Delivery ZIP').fill('64055');
  await form.getByPlaceholder('ChatGPT, a friend, Google…').fill('ChatGPT');
  await form.getByRole('button', { name: 'Get My Free Quote' }).click();
  await page.getByText('Something went wrong. Please call us at').waitFor();
  assert.equal(await page.getByRole('heading', { name: 'We Got Your Info!' }).count(), 0);
  succeed = true;
  await form.getByRole('button', { name: 'Get My Free Quote' }).click();
  await page.getByRole('heading', { name: 'We Got Your Info!' }).waitFor();
  assert.equal(payload.subsite, 'wd'); assert.equal(payload.attribution.reportedSource, 'ChatGPT');
  console.log(JSON.stringify({ ok: true, checks: ['WD form preserves durable lead API', 'failure does not show success', 'reported referral submitted'] }));
} finally { await browser.close(); }
