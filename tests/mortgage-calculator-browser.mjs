import assert from 'node:assert/strict';
import { chromium, webkit, devices } from 'playwright';
import { expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.CALCULATOR_TEST_URL || 'http://127.0.0.1:3027';
const output = process.env.CALCULATOR_SCREENSHOTS || '/tmp/tolley-calculator-screenshots';
await mkdir(output, { recursive: true });
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch({ headless: true });
  try {
    const context = await browser.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined, colorScheme: 'light' });
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.__sharedEstimate = data; } });
    });
    const response = await page.goto(`${base}/agent/calculator`, { waitUntil: 'networkidle', timeout: 180000 });
    assert.equal(response.status(), 200);
    await expect(page.locator('[data-ready]')).toHaveAttribute('data-ready', 'true');
    await expect(page.getByRole('heading', { name: 'What could your payment be?' })).toBeVisible();
    await expect(page.getByTestId('monthly-payment')).toHaveText('$2,740');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${name} overflows`);
    assert.equal(await page.locator('#home-price').inputValue(), '350,000');
    await page.screenshot({ path: `${output}/${name}-mobile-light.png`, fullPage: true });

    await page.getByRole('group', { name: 'Down payment presets' }).getByRole('button', { name: /^20%/ }).click();
    await expect(page.getByText('With 20% or more down, this estimate has no PMI.')).toBeVisible();
    const lowerPayment = await page.getByTestId('monthly-payment').textContent();
    assert.notEqual(lowerPayment, '$2,740');
    await page.locator('#home-price').fill('500000');
    await page.locator('#home-price').blur();
    await expect(page.locator('#home-price')).toHaveValue('500,000');
    const beforeSlider = await page.getByTestId('monthly-payment').textContent();
    await page.locator('#home-price-slider').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('monthly-payment')).not.toHaveText(beforeSlider);
    await page.locator('#home-price-slider').evaluate(element => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, '400000'); element.dispatchEvent(new Event('input', { bubbles: true })); });
    await expect(page.locator('#home-price')).toHaveValue('400,000');
    await page.getByRole('button', { name: /^FHA/ }).click();
    await page.getByRole('group', { name: 'Down payment presets' }).getByRole('button', { name: /^3.5%/ }).click();
    await expect(page.getByText('FHA annual MIP: 0.55%. Applies for the loan term.')).toBeVisible();
    await page.getByRole('button', { name: /^VA/ }).click();
    await page.getByRole('group', { name: 'Down payment presets' }).getByRole('button', { name: /^0%/ }).click();
    await page.locator('#va-use').selectOption('exempt');
    await expect(page.getByText('VA loans have no monthly mortgage insurance.')).toBeVisible();
    await page.getByRole('button', { name: /^USDA/ }).click();
    await expect(page.locator('#loan-term')).toBeDisabled();
    await expect(page.locator('#loan-term')).toHaveValue('30');
    await page.getByRole('button', { name: 'Switch light or dark appearance' }).click();
    await expect(page.locator('[data-theme]')).toHaveAttribute('data-theme', 'dark');
    await page.screenshot({ path: `${output}/${name}-mobile-dark.png`, fullPage: true });
    await page.locator('summary').filter({ hasText: 'Cash needed at closing' }).click();
    await expect(page.getByText('Estimated cash to close', { exact: true })).toBeVisible();
    await page.locator('summary').filter({ hasText: 'The full cost over 30 years' }).click();
    await expect(page.getByText('Estimated total housing outlay', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Share this estimate' }).click();
    const shared = await page.evaluate(() => window.__sharedEstimate);
    assert.equal(new URL(shared.url).pathname, '/agent/calculator');
    console.log(`${name}: inputs, loan options, theme and expanded totals passed`);
    const finalPayment = await page.getByTestId('monthly-payment').textContent();
    await page.goto(shared.url, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('monthly-payment')).toHaveText(finalPayment);
    await expect(page.locator('[data-theme]')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: /^USDA/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Reset calculator' }).click();
    await expect(page.getByTestId('monthly-payment')).toHaveText('$2,740');
    assert.equal(new URL(page.url()).search, '');
    await page.setViewportSize({ width: 320, height: 740 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${name} narrow screen overflows`);
    assert.deepEqual(errors, [], `${name} browser errors`);
    await context.close();

    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 }, colorScheme: 'light' });
    await desktop.goto(`${base}/agent/calculator`, { waitUntil: 'networkidle' });
    await expect(desktop.locator('[data-ready]')).toHaveAttribute('data-ready', 'true');
    await desktop.screenshot({ path: `${output}/${name}-desktop-light.png`, fullPage: true });
    await desktop.getByRole('button', { name: 'Switch light or dark appearance' }).click();
    await expect(desktop.locator('[data-ready]')).toHaveAttribute('data-ready', 'true');
    await desktop.screenshot({ path: `${output}/${name}-desktop-dark.png`, fullPage: true });
    const noJs = await browser.newPage({ javaScriptEnabled: false });
    await noJs.goto(`${base}/agent/calculator`);
    await expect(noJs.getByRole('heading', { level: 1 })).toContainText('payment be?');
    await expect(noJs.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.tolley.io/agent/calculator');
    console.log(`${name}: mobile, narrow layout, theme, all loan types, inputs, sliders, totals, share round-trip and server HTML passed`);
  } finally { await browser.close(); }
}
