/**
 * Walkthrough (2026-08-20): Character Lab end-to-end as a paying customer.
 * Login → Characters → preset chip → Generate 3 takes ($0.99 debit) →
 * wait for renders → adopt a take → assert saved.
 *
 * Usage: WALKTHROUGH_QA_PASSWORD=... node scripts/tmp-walkthrough-character-lab.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.WALKTHROUGH_BASE_URL || 'http://localhost:3057';
const EMAIL = 'qa.walkthrough.0820@tolley.io';
const PASS = process.env.WALKTHROUGH_QA_PASSWORD;
const SHOTS = process.env.WALKTHROUGH_SHOTS || '/tmp/walkthrough-shots';
if (!PASS) throw new Error('Set WALKTHROUGH_QA_PASSWORD');

const failures = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.log(`  ✗ ${m}`); failures.push(m); };

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.setDefaultTimeout(90000);

console.log('login…');
for (let attempt = 1; attempt <= 3; attempt++) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').first().fill(EMAIL);
  await page.locator('input[type=password]').first().fill(PASS);
  await page.locator('button[type=submit]').first().click();
  await page
    .waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 })
    .catch(() => {});
  await page.goto(`${BASE}/animate`, { waitUntil: 'networkidle' });
  const signedOut = await page.getByRole('link', { name: 'Sign in' }).count()
    + await page.getByRole('button', { name: 'Sign in' }).count();
  if (!signedOut) break;
  console.log(`  login attempt ${attempt} did not stick — retrying`);
}
console.log('landed:', page.url());

console.log('open Characters…');
await page.waitForSelector('.animate-shell', { timeout: 120000 }).catch(() => {});
await page.screenshot({ path: `${SHOTS}/cl-00-landing.png` });
const charNav = page.getByText('Characters', { exact: true }).first();
await charNav.waitFor({ state: 'visible', timeout: 60000 });
await charNav.click();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${SHOTS}/cl-01-characters.png` });

if (await page.getByText('Character Lab').count()) pass('Character Lab panel visible');
else fail('Character Lab panel missing');

console.log('preset + generate…');
await page.getByRole('button', { name: /Finance mentor/ }).first().click();
await page.waitForTimeout(500);
const gen = page.getByTestId('character-lab-generate');
if (!(await gen.count())) {
  fail('generate button missing');
} else {
  const label = await gen.textContent();
  if (label?.includes('$0.99')) pass(`price on button: "${label.trim()}"`);
  else fail(`price missing from button label: "${label}"`);
  await gen.click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SHOTS}/cl-02-generating.png` });
  if (await page.getByText(/Please stand by/).count()) pass('stand-by state shown');
  else console.log('  (no stand-by text yet — takes may have raced ahead)');

  // Wait up to 10 min for all three takes to resolve. Count only ENABLED
  // adopt buttons — the buttons exist (disabled) while takes render, which
  // fooled an earlier version of this spec into clicking too soon.
  const deadline = Date.now() + 10 * 60 * 1000;
  let doneButtons = 0;
  while (Date.now() < deadline) {
    doneButtons = await page
      .locator('button:not([disabled])', { hasText: 'Use this character' })
      .count();
    const failed = await page.getByText(/Take \d failed/).count();
    if (doneButtons + failed >= 3) break;
    await page.waitForTimeout(5000);
  }
  await page.screenshot({ path: `${SHOTS}/cl-03-takes.png` });
  if (doneButtons > 0) pass(`${doneButtons}/3 takes rendered`);
  else fail('no takes rendered within 8 min');

  if (doneButtons > 0) {
    console.log('adopt first take…');
    const enabled = page.getByRole('button', { name: 'Use this character' }).first();
    await enabled.click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${SHOTS}/cl-04-adopted.png` });
    if (await page.getByText('Saved ✓').count()) pass('take adopted and saved');
    else fail('adopt did not reach Saved state');
  }
}

// ── Advanced view toggle (2026-08-20 fix) ────────────────────────────────
console.log('check Advanced view…');
await page.getByText('Styles', { exact: true }).first().click();
await page.waitForTimeout(2500);
const editLink = page.getByRole('link', { name: /^Edit$/ }).first();
if (await editLink.count()) {
  await editLink.click();
  const advBtn = page.getByRole('button', { name: /^Advanced$/ }).first();
  await advBtn.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
  if (await advBtn.count()) {
    await advBtn.click();
    await page.waitForTimeout(3000);
    const path = new URL(page.url()).pathname;
    if (path !== '/animate') fail(`Advanced toggle ESCAPED to ${path}`);
    else if (await page.getByText(/Smart overlays|Pacing|pacing/i).count()) pass('Advanced editor renders in-studio');
    else {
      await page.screenshot({ path: `${SHOTS}/cl-05-advanced.png` });
      pass('Advanced toggle stayed in-studio (content screenshot saved)');
    }
    await page.screenshot({ path: `${SHOTS}/cl-05-advanced.png` });
  } else {
    fail('Simple/Advanced toggle not found in style editor');
  }
} else {
  console.log('  (no Edit link — skipped advanced check)');
}

await b.close();
console.log(failures.length ? `\nFAILURES: ${failures.length}` : '\nALL CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
